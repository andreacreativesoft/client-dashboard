<?php
/**
 * Plugin Name: Andrea Creative Dashboard Connector
 * Description: REST API endpoints for Andrea Creative Client Dashboard
 * Version: 1.0.0
 * Author: Andrea Creative
 *
 * Drop this file into wp-content/mu-plugins/
 * Configure DASHBOARD_SHARED_SECRET in wp-config.php:
 *   define('DASHBOARD_SHARED_SECRET', 'your-secret-here');
 */

if (!defined('ABSPATH')) exit;

define('DASHBOARD_CONNECTOR_VERSION', '1.1.0');

/**
 * Restore Authorization header from X-WP-Auth for hosts that strip it.
 * Many shared hosting providers (Apache CGI/FastCGI, LiteSpeed) strip the
 * standard Authorization header before PHP can read it. The dashboard sends
 * credentials via both Authorization and X-WP-Auth. This block restores
 * the auth so WordPress Application Passwords can authenticate normally.
 */
(function() {
    $custom_auth = isset($_SERVER['HTTP_X_WP_AUTH']) ? $_SERVER['HTTP_X_WP_AUTH'] : '';
    if (!empty($custom_auth) && empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $_SERVER['HTTP_AUTHORIZATION'] = $custom_auth;
        // Also set PHP_AUTH_* for CGI/FastCGI environments
        if (strpos($custom_auth, 'Basic ') === 0) {
            $decoded = base64_decode(substr($custom_auth, 6));
            if ($decoded !== false && strpos($decoded, ':') !== false) {
                list($user, $pass) = explode(':', $decoded, 2);
                $_SERVER['PHP_AUTH_USER'] = $user;
                $_SERVER['PHP_AUTH_PW'] = $pass;
            }
        }
    }
})();

class Dashboard_Connector {

    private $namespace = 'dashboard/v1';
    private $rate_limit_key = 'dashboard_connector_rate_';
    private $rate_limit_max = 60;

    public function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    // ═══════════════════════════════════════════
    //  ROUTE REGISTRATION
    // ═══════════════════════════════════════════

    public function register_routes() {

        register_rest_route($this->namespace, '/site-health', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_site_health'],
            'permission_callback' => [$this, 'check_permissions'],
        ]);

        register_rest_route($this->namespace, '/debug-log', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_debug_log'],
            'permission_callback' => [$this, 'check_permissions'],
            'args' => [
                'lines' => [
                    'default'           => 200,
                    'sanitize_callback' => 'absint',
                    'validate_callback' => function($value) {
                        return is_numeric($value) && $value > 0 && $value <= 2000;
                    },
                ],
            ],
        ]);

        register_rest_route($this->namespace, '/plugins', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_plugins'],
            'permission_callback' => [$this, 'check_permissions'],
        ]);

        register_rest_route($this->namespace, '/plugins/toggle', [
            'methods'             => 'POST',
            'callback'            => [$this, 'toggle_plugin'],
            'permission_callback' => [$this, 'check_write_permissions'],
            'args' => [
                'plugin' => [
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ],
                'activate' => [
                    'required'          => true,
                    'validate_callback' => function($value) {
                        return is_bool($value) || in_array($value, ['true', 'false', '0', '1'], true);
                    },
                ],
            ],
        ]);

        register_rest_route($this->namespace, '/cache/clear', [
            'methods'             => 'POST',
            'callback'            => [$this, 'clear_cache'],
            'permission_callback' => [$this, 'check_write_permissions'],
        ]);

        register_rest_route($this->namespace, '/maintenance', [
            'methods'             => 'POST',
            'callback'            => [$this, 'toggle_maintenance'],
            'permission_callback' => [$this, 'check_write_permissions'],
            'args' => [
                'enable' => [
                    'required'          => true,
                    'validate_callback' => function($value) {
                        return is_bool($value) || in_array($value, ['true', 'false', '0', '1'], true);
                    },
                ],
            ],
        ]);

        register_rest_route($this->namespace, '/debug-mode', [
            'methods'             => 'POST',
            'callback'            => [$this, 'toggle_debug_mode'],
            'permission_callback' => [$this, 'check_write_permissions'],
            'args' => [
                'enable' => [
                    'required'          => true,
                    'validate_callback' => function($value) {
                        return is_bool($value) || in_array($value, ['true', 'false', '0', '1'], true);
                    },
                ],
            ],
        ]);
    }

    // ═══════════════════════════════════════════
    //  AUTHENTICATION & AUTHORIZATION
    // ═══════════════════════════════════════════

    public function check_permissions(WP_REST_Request $request) {
        if (!is_user_logged_in()) {
            return new WP_Error('rest_not_logged_in', 'Authentication required.', ['status' => 401]);
        }

        if (!current_user_can('manage_options')) {
            return new WP_Error('rest_forbidden', 'Administrator access required.', ['status' => 403]);
        }

        $secret = $request->get_header('X-Dashboard-Secret');
        $expected = defined('DASHBOARD_SHARED_SECRET') ? DASHBOARD_SHARED_SECRET : '';

        if (empty($expected)) {
            return new WP_Error('rest_config_error', 'DASHBOARD_SHARED_SECRET not configured in wp-config.php.', ['status' => 500]);
        }

        if (!hash_equals($expected, (string) $secret)) {
            return new WP_Error('rest_forbidden', 'Invalid dashboard secret.', ['status' => 403]);
        }

        $rate_check = $this->check_rate_limit();
        if (is_wp_error($rate_check)) {
            return $rate_check;
        }

        return true;
    }

    public function check_write_permissions(WP_REST_Request $request) {
        $read_check = $this->check_permissions($request);
        if (is_wp_error($read_check)) {
            return $read_check;
        }

        $action_header = $request->get_header('X-Dashboard-Action');
        if ($action_header !== 'confirm') {
            return new WP_Error(
                'rest_action_not_confirmed',
                'Write actions require X-Dashboard-Action: confirm header.',
                ['status' => 400]
            );
        }

        return true;
    }

    private function check_rate_limit() {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $key = $this->rate_limit_key . md5($ip);
        $current = get_transient($key);

        if ($current === false) {
            set_transient($key, 1, 60);
            return true;
        }

        if ((int) $current >= $this->rate_limit_max) {
            return new WP_Error(
                'rest_rate_limited',
                'Rate limit exceeded. Maximum 60 requests per minute.',
                ['status' => 429]
            );
        }

        set_transient($key, (int) $current + 1, 60);
        return true;
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: SITE HEALTH
    // ═══════════════════════════════════════════

    public function get_site_health(WP_REST_Request $request) {
        global $wpdb;

        $wp_version = get_bloginfo('version');
        $php_version = phpversion();
        $server_software = $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown';
        $mysql_version = $wpdb->get_var('SELECT VERSION()');

        $theme = wp_get_theme();
        $parent_theme = $theme->parent();
        $theme_info = [
            'name'           => $theme->get('Name'),
            'version'        => $theme->get('Version'),
            'template'       => $theme->get_template(),
            'stylesheet'     => $theme->get_stylesheet(),
            'is_child_theme' => (bool) $parent_theme,
        ];
        if ($parent_theme) {
            $theme_info['parent_theme'] = $parent_theme->get('Name');
        }

        $uploads_dir = wp_upload_dir();
        $disk_usage = [
            'uploads_size' => $this->get_directory_size($uploads_dir['basedir']),
            'plugins_size' => $this->get_directory_size(WP_PLUGIN_DIR),
            'themes_size'  => $this->get_directory_size(get_theme_root()),
            'total_size'   => $this->get_directory_size(ABSPATH),
        ];

        $db_size = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2)
                 FROM information_schema.TABLES
                 WHERE table_schema = %s",
                DB_NAME
            )
        );

        return rest_ensure_response([
            'connector_version'   => DASHBOARD_CONNECTOR_VERSION,
            'wp_version'          => $wp_version,
            'php_version'         => $php_version,
            'server_software'     => $server_software,
            'mysql_version'       => $mysql_version,
            'active_theme'        => $theme_info,
            'disk_usage'          => $disk_usage,
            'db_size'             => $db_size . ' MB',
            'max_upload_size'     => size_format(wp_max_upload_size()),
            'memory_limit'        => WP_MEMORY_LIMIT,
            'is_multisite'        => is_multisite(),
            'ssl_enabled'         => is_ssl(),
            'debug_mode'          => defined('WP_DEBUG') && WP_DEBUG,
            'wp_cron_enabled'     => !(defined('DISABLE_WP_CRON') && DISABLE_WP_CRON),
            'timezone'            => wp_timezone_string(),
            'permalink_structure' => get_option('permalink_structure') ?: 'Plain',
            'site_url'            => get_site_url(),
            'home_url'            => get_home_url(),
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: DEBUG LOG
    // ═══════════════════════════════════════════

    public function get_debug_log(WP_REST_Request $request) {
        $lines = $request->get_param('lines') ?: 200;
        $log_file = WP_CONTENT_DIR . '/debug.log';

        if (!file_exists($log_file)) {
            return rest_ensure_response([
                'entries'       => [],
                'file_size'     => '0 B',
                'last_modified' => null,
                'truncated'     => false,
                'message'       => 'debug.log does not exist. Enable WP_DEBUG_LOG in wp-config.php.',
            ]);
        }

        $file_size = filesize($log_file);
        $last_modified = gmdate('Y-m-d\TH:i:s\Z', filemtime($log_file));

        $raw_lines = $this->tail_file($log_file, $lines);
        $entries = $this->parse_debug_log($raw_lines);

        return rest_ensure_response([
            'entries'       => $entries,
            'file_size'     => size_format($file_size),
            'last_modified' => $last_modified,
            'truncated'     => (substr_count(file_get_contents($log_file), "\n") > $lines),
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: PLUGINS
    // ═══════════════════════════════════════════

    public function get_plugins(WP_REST_Request $request) {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $all_plugins = get_plugins();
        $active_plugins = get_option('active_plugins', []);
        $update_plugins = get_site_transient('update_plugins');
        $mu_plugins = get_mu_plugins();

        $result = [];

        foreach ($all_plugins as $file => $plugin) {
            $slug = dirname($file);
            if ($slug === '.') $slug = basename($file, '.php');

            $has_update = false;
            $update_version = null;
            if (isset($update_plugins->response[$file])) {
                $has_update = true;
                $update_version = $update_plugins->response[$file]->new_version ?? null;
            }

            $result[] = [
                'slug'             => $slug,
                'file'             => $file,
                'name'             => $plugin['Name'],
                'version'          => $plugin['Version'],
                'status'           => in_array($file, $active_plugins) ? 'active' : 'inactive',
                'update_available' => $has_update,
                'update_version'   => $update_version,
                'author'           => wp_strip_all_tags($plugin['Author']),
                'description'      => wp_strip_all_tags($plugin['Description']),
                'plugin_uri'       => $plugin['PluginURI'],
                'requires_wp'      => $plugin['RequiresWP'] ?? null,
                'requires_php'     => $plugin['RequiresPHP'] ?? null,
            ];
        }

        // Include mu-plugins
        foreach ($mu_plugins as $file => $plugin) {
            $result[] = [
                'slug'             => basename($file, '.php'),
                'file'             => $file,
                'name'             => $plugin['Name'],
                'version'          => $plugin['Version'],
                'status'           => 'must-use',
                'update_available' => false,
                'update_version'   => null,
                'author'           => wp_strip_all_tags($plugin['Author']),
                'description'      => wp_strip_all_tags($plugin['Description']),
                'plugin_uri'       => $plugin['PluginURI'] ?? '',
                'requires_wp'      => null,
                'requires_php'     => null,
            ];
        }

        return rest_ensure_response($result);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: TOGGLE PLUGIN
    // ═══════════════════════════════════════════

    public function toggle_plugin(WP_REST_Request $request) {
        if (!function_exists('activate_plugin')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $plugin_file = $request->get_param('plugin');
        $activate = filter_var($request->get_param('activate'), FILTER_VALIDATE_BOOLEAN);

        $all_plugins = get_plugins();
        if (!isset($all_plugins[$plugin_file])) {
            return new WP_Error('plugin_not_found', 'Plugin not found.', ['status' => 404]);
        }

        // Prevent toggling the dashboard connector itself
        if (strpos($plugin_file, 'dashboard-connector') !== false) {
            return new WP_Error('rest_forbidden', 'Cannot toggle the dashboard connector.', ['status' => 403]);
        }

        if ($activate) {
            $result = activate_plugin($plugin_file);
            if (is_wp_error($result)) {
                return new WP_Error('activation_failed', $result->get_error_message(), ['status' => 500]);
            }
            $status = 'active';
        } else {
            deactivate_plugins($plugin_file);
            $status = 'inactive';
        }

        return rest_ensure_response([
            'success' => true,
            'plugin'  => $plugin_file,
            'status'  => $status,
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: CLEAR CACHE
    // ═══════════════════════════════════════════

    public function clear_cache(WP_REST_Request $request) {
        $cleared = [];

        // WordPress object cache
        if (function_exists('wp_cache_flush')) {
            wp_cache_flush();
            $cleared[] = 'wp_object_cache';
        }

        // WP Rocket
        if (function_exists('rocket_clean_domain')) {
            rocket_clean_domain();
            $cleared[] = 'wp_rocket';
        }

        // W3 Total Cache
        if (function_exists('w3tc_flush_all')) {
            w3tc_flush_all();
            $cleared[] = 'w3_total_cache';
        }

        // LiteSpeed Cache
        if (class_exists('LiteSpeed\Purge')) {
            do_action('litespeed_purge_all');
            $cleared[] = 'litespeed_cache';
        }

        // WP Super Cache
        if (function_exists('wp_cache_clear_cache')) {
            wp_cache_clear_cache();
            $cleared[] = 'wp_super_cache';
        }

        // WP Fastest Cache
        if (class_exists('WpFastestCache')) {
            do_action('wpfc_clear_all_cache');
            $cleared[] = 'wp_fastest_cache';
        }

        // Autoptimize
        if (class_exists('autoptimizeCache')) {
            autoptimizeCache::clearall();
            $cleared[] = 'autoptimize';
        }

        // Clear transients
        global $wpdb;
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_%'");
        $cleared[] = 'transients';

        return rest_ensure_response([
            'success' => true,
            'cleared' => $cleared,
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: TOGGLE MAINTENANCE MODE
    // ═══════════════════════════════════════════

    public function toggle_maintenance(WP_REST_Request $request) {
        $enable = filter_var($request->get_param('enable'), FILTER_VALIDATE_BOOLEAN);
        $maintenance_file = ABSPATH . '.maintenance';

        if ($enable) {
            $content = '<?php $upgrading = ' . time() . '; ?>';
            $result = file_put_contents($maintenance_file, $content);
            if ($result === false) {
                return new WP_Error('write_failed', 'Could not create .maintenance file.', ['status' => 500]);
            }
        } else {
            if (file_exists($maintenance_file)) {
                $result = unlink($maintenance_file);
                if (!$result) {
                    return new WP_Error('delete_failed', 'Could not remove .maintenance file.', ['status' => 500]);
                }
            }
        }

        return rest_ensure_response([
            'success'     => true,
            'maintenance' => $enable,
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: TOGGLE DEBUG MODE
    // ═══════════════════════════════════════════

    public function toggle_debug_mode(WP_REST_Request $request) {
        $enable = filter_var($request->get_param('enable'), FILTER_VALIDATE_BOOLEAN);
        $config_file = ABSPATH . 'wp-config.php';

        if (!is_writable($config_file)) {
            return new WP_Error('write_failed', 'wp-config.php is not writable.', ['status' => 500]);
        }

        $config_content = file_get_contents($config_file);
        if ($config_content === false) {
            return new WP_Error('read_failed', 'Could not read wp-config.php.', ['status' => 500]);
        }

        $debug_value = $enable ? 'true' : 'false';

        // Replace existing debug constants
        $patterns = [
            "/define\s*\(\s*['\"]WP_DEBUG['\"]\s*,\s*(true|false)\s*\)\s*;/" =>
                "define('WP_DEBUG', {$debug_value});",
            "/define\s*\(\s*['\"]WP_DEBUG_LOG['\"]\s*,\s*(true|false)\s*\)\s*;/" =>
                "define('WP_DEBUG_LOG', {$debug_value});",
            "/define\s*\(\s*['\"]WP_DEBUG_DISPLAY['\"]\s*,\s*(true|false)\s*\)\s*;/" =>
                "define('WP_DEBUG_DISPLAY', false);",
        ];

        $new_content = $config_content;
        foreach ($patterns as $pattern => $replacement) {
            if (preg_match($pattern, $new_content)) {
                $new_content = preg_replace($pattern, $replacement, $new_content);
            }
        }

        // If WP_DEBUG not found at all, add the block
        if (!preg_match("/define\s*\(\s*['\"]WP_DEBUG['\"]/", $config_content)) {
            $debug_block = "\n// Debug settings managed by Andrea Creative Dashboard\ndefine('WP_DEBUG', {$debug_value});\ndefine('WP_DEBUG_LOG', {$debug_value});\ndefine('WP_DEBUG_DISPLAY', false);\n";

            $marker = "/* That's all, stop editing!";
            if (strpos($new_content, $marker) !== false) {
                $new_content = str_replace($marker, $debug_block . "\n" . $marker, $new_content);
            } else {
                $new_content = preg_replace(
                    "/(require_once\s*.*wp-settings\.php)/",
                    $debug_block . "\n$1",
                    $new_content
                );
            }
        }

        // Create backup before writing
        $backup_file = $config_file . '.dashboard-backup-' . date('YmdHis');
        copy($config_file, $backup_file);

        $result = file_put_contents($config_file, $new_content);
        if ($result === false) {
            copy($backup_file, $config_file);
            return new WP_Error('write_failed', 'Could not write wp-config.php. Backup restored.', ['status' => 500]);
        }

        return rest_ensure_response([
            'success' => true,
            'debug'   => $enable,
            'backup'  => basename($backup_file),
        ]);
    }

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

    private function tail_file($filepath, $lines = 200) {
        $file = new SplFileObject($filepath, 'r');
        $file->seek(PHP_INT_MAX);
        $total_lines = $file->key();
        $start = max(0, $total_lines - $lines);

        $result = [];
        $file->seek($start);
        while (!$file->eof()) {
            $line = $file->current();
            if (trim($line) !== '') {
                $result[] = $line;
            }
            $file->next();
        }

        return $result;
    }

    private function parse_debug_log($lines) {
        $entries = [];
        $current_entry = null;

        foreach ($lines as $line) {
            if (preg_match('/^\[([^\]]+)\]\s+(PHP\s+)?(Fatal error|Warning|Notice|Deprecated|Parse error|Strict Standards)?:?\s*(.*)$/i', $line, $matches)) {
                if ($current_entry) {
                    $entries[] = $current_entry;
                }

                $severity = 'unknown';
                $severity_raw = strtolower($matches[3] ?? '');
                if (strpos($severity_raw, 'fatal') !== false) $severity = 'fatal';
                elseif (strpos($severity_raw, 'warning') !== false) $severity = 'warning';
                elseif (strpos($severity_raw, 'notice') !== false) $severity = 'notice';
                elseif (strpos($severity_raw, 'deprecated') !== false) $severity = 'deprecated';
                elseif (strpos($severity_raw, 'parse') !== false) $severity = 'fatal';
                elseif (strpos($severity_raw, 'strict') !== false) $severity = 'notice';

                $message = trim($matches[4]);
                $file = null;
                $line_num = null;
                if (preg_match('/\s+in\s+(.+?)\s+on\s+line\s+(\d+)/', $message, $fm)) {
                    $file = $fm[1];
                    $line_num = (int) $fm[2];
                    $message = preg_replace('/\s+in\s+.+?\s+on\s+line\s+\d+/', '', $message);
                }

                $current_entry = [
                    'timestamp' => $matches[1],
                    'severity'  => $severity,
                    'message'   => $message,
                    'file'      => $file,
                    'line'      => $line_num,
                    'raw'       => trim($line),
                ];
            } else {
                // Multi-line entry continuation
                if ($current_entry) {
                    $current_entry['message'] .= "\n" . trim($line);
                    $current_entry['raw'] .= "\n" . trim($line);
                }
            }
        }

        if ($current_entry) {
            $entries[] = $current_entry;
        }

        return $entries;
    }

    private function get_directory_size($path) {
        if (!is_dir($path)) return '0 B';

        $size = 0;
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        $count = 0;
        foreach ($iterator as $file) {
            if ($count++ > 50000) break; // Safety limit
            if ($file->isFile()) {
                $size += $file->getSize();
            }
        }

        return size_format($size);
    }
}

new Dashboard_Connector();
