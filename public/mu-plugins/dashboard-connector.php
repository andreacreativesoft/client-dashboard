<?php
/**
 * Plugin Name: Andrea Creative Dashboard Connector
 * Description: REST API endpoints for Andrea Creative Client Dashboard
 * Version: 1.3.0
 * Author: Andrea Creative
 *
 * Drop this file into wp-content/mu-plugins/
 * A shared secret is auto-generated on install. No Application Password needed.
 */

if (!defined('ABSPATH')) exit;

define('DASHBOARD_CONNECTOR_VERSION', '1.3.0');

class Dashboard_Connector {

    private $namespace = 'dashboard/v1';
    private $rate_limit_key = 'dashboard_connector_rate_';
    private $rate_limit_max = 60;

    public function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);

        // Auto-generate shared secret on first load
        $this->ensure_secret();

        // Authenticate standard WP REST API requests (/wp/v2/*) via shared secret
        // so no Application Password is needed
        add_filter('determine_current_user', [$this, 'authenticate_via_secret'], 20);
    }

    /**
     * Auto-generate shared secret if none exists.
     */
    private function ensure_secret() {
        $secret = get_option('dashboard_shared_secret', '');
        if (empty($secret)) {
            $secret = bin2hex(random_bytes(32));
            update_option('dashboard_shared_secret', $secret, true);
        }
    }

    /**
     * Authenticate WP REST API requests via X-Dashboard-Secret header.
     * This allows the dashboard to call standard /wp/v2/* endpoints
     * without needing an Application Password.
     */
    public function authenticate_via_secret($user_id) {
        // Don't override if already authenticated
        if ($user_id) return $user_id;

        // Only act on REST API requests
        if (!defined('REST_REQUEST') || !REST_REQUEST) return $user_id;

        $secret = isset($_SERVER['HTTP_X_DASHBOARD_SECRET'])
            ? $_SERVER['HTTP_X_DASHBOARD_SECRET']
            : '';

        if (empty($secret)) return $user_id;

        $expected = $this->get_expected_secret();
        if (empty($expected)) return $user_id;

        if (!hash_equals($expected, $secret)) return $user_id;

        // Valid secret — authenticate as the first administrator
        $admins = get_users(['role' => 'administrator', 'number' => 1, 'orderby' => 'ID', 'order' => 'ASC']);
        if (!empty($admins)) {
            return $admins[0]->ID;
        }

        return $user_id;
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

        register_rest_route($this->namespace, '/db-health', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_db_health'],
            'permission_callback' => [$this, 'check_permissions'],
        ]);

        register_rest_route($this->namespace, '/plugins/update', [
            'methods'             => 'POST',
            'callback'            => [$this, 'update_plugin'],
            'permission_callback' => [$this, 'check_write_permissions'],
            'args' => [
                'plugin' => [
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ]);

        register_rest_route($this->namespace, '/themes', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_themes'],
            'permission_callback' => [$this, 'check_permissions'],
        ]);

        register_rest_route($this->namespace, '/themes/update', [
            'methods'             => 'POST',
            'callback'            => [$this, 'update_theme'],
            'permission_callback' => [$this, 'check_write_permissions'],
            'args' => [
                'theme' => [
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ]);

        register_rest_route($this->namespace, '/core/update', [
            'methods'             => 'POST',
            'callback'            => [$this, 'update_core'],
            'permission_callback' => [$this, 'check_write_permissions'],
        ]);

        register_rest_route($this->namespace, '/woocommerce/orders', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_wc_orders'],
            'permission_callback' => [$this, 'check_permissions'],
            'args' => [
                'per_page' => ['default' => 10, 'sanitize_callback' => 'absint'],
                'page'     => ['default' => 1, 'sanitize_callback' => 'absint'],
                'status'   => ['default' => 'any', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);

        register_rest_route($this->namespace, '/woocommerce/order/(?P<id>\d+)', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_wc_order'],
            'permission_callback' => [$this, 'check_permissions'],
        ]);

        register_rest_route($this->namespace, '/woocommerce/stats', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_wc_stats'],
            'permission_callback' => [$this, 'check_permissions'],
        ]);

        register_rest_route($this->namespace, '/woocommerce/products', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_wc_products'],
            'permission_callback' => [$this, 'check_permissions'],
            'args' => [
                'per_page' => ['default' => 20, 'sanitize_callback' => 'absint'],
                'page'     => ['default' => 1, 'sanitize_callback' => 'absint'],
                'search'   => ['default' => '', 'sanitize_callback' => 'sanitize_text_field'],
                'status'   => ['default' => 'publish', 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);

        register_rest_route($this->namespace, '/woocommerce/product/(?P<id>\d+)', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_wc_product'],
            'permission_callback' => [$this, 'check_permissions'],
        ]);

        register_rest_route($this->namespace, '/woocommerce/product/update', [
            'methods'             => 'POST',
            'callback'            => [$this, 'update_wc_product'],
            'permission_callback' => [$this, 'check_write_permissions'],
            'args' => [
                'product_id' => ['required' => true, 'sanitize_callback' => 'absint'],
            ],
        ]);

        register_rest_route($this->namespace, '/woocommerce/order/update', [
            'methods'             => 'POST',
            'callback'            => [$this, 'update_wc_order'],
            'permission_callback' => [$this, 'check_write_permissions'],
            'args' => [
                'order_id' => ['required' => true, 'sanitize_callback' => 'absint'],
                'status'   => ['required' => true, 'sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);

        register_rest_route($this->namespace, '/posts/create', [
            'methods'             => 'POST',
            'callback'            => [$this, 'create_post_with_seo'],
            'permission_callback' => [$this, 'check_write_permissions'],
            'args' => [
                'title'   => ['required' => true, 'sanitize_callback' => 'sanitize_text_field'],
                'content' => ['required' => true],
            ],
        ]);

        register_rest_route($this->namespace, '/users', [
            'methods'             => 'GET',
            'callback'            => [$this, 'get_wp_users'],
            'permission_callback' => [$this, 'check_permissions'],
        ]);

        register_rest_route($this->namespace, '/users/create', [
            'methods'             => 'POST',
            'callback'            => [$this, 'create_wp_user'],
            'permission_callback' => [$this, 'check_write_permissions'],
            'args' => [
                'username' => ['required' => true, 'sanitize_callback' => 'sanitize_user'],
                'email'    => ['required' => true, 'sanitize_callback' => 'sanitize_email'],
                'role'     => ['default' => 'subscriber', 'sanitize_callback' => 'sanitize_text_field'],
                'password' => ['sanitize_callback' => 'sanitize_text_field'],
                'first_name' => ['sanitize_callback' => 'sanitize_text_field'],
                'last_name'  => ['sanitize_callback' => 'sanitize_text_field'],
            ],
        ]);

        register_rest_route($this->namespace, '/users/update', [
            'methods'             => 'POST',
            'callback'            => [$this, 'update_wp_user'],
            'permission_callback' => [$this, 'check_write_permissions'],
            'args' => [
                'user_id' => ['required' => true, 'sanitize_callback' => 'absint'],
            ],
        ]);

        register_rest_route($this->namespace, '/users/delete', [
            'methods'             => 'POST',
            'callback'            => [$this, 'delete_wp_user'],
            'permission_callback' => [$this, 'check_write_permissions'],
            'args' => [
                'user_id'  => ['required' => true, 'sanitize_callback' => 'absint'],
                'reassign' => ['default' => 1, 'sanitize_callback' => 'absint'],
            ],
        ]);

        register_rest_route($this->namespace, '/users/password-reset', [
            'methods'             => 'POST',
            'callback'            => [$this, 'send_password_reset'],
            'permission_callback' => [$this, 'check_write_permissions'],
            'args' => [
                'user_id' => ['required' => true, 'sanitize_callback' => 'absint'],
            ],
        ]);

        // Register shared secret — only requires admin auth (no secret check)
        register_rest_route($this->namespace, '/register-secret', [
            'methods'             => 'POST',
            'callback'            => [$this, 'register_secret'],
            'permission_callback' => [$this, 'check_admin_only'],
            'args' => [
                'secret' => [
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ]);

        // Webhook config — pushed from dashboard on connect / key regenerate
        register_rest_route($this->namespace, '/webhook-config', [
            'methods'             => 'POST',
            'callback'            => [$this, 'save_webhook_config'],
            'permission_callback' => [$this, 'check_permissions'],
            'args' => [
                'api_key' => [
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ],
                'dashboard_url' => [
                    'required'          => true,
                    'sanitize_callback' => 'esc_url_raw',
                ],
                'webhook_url' => [
                    'required'          => true,
                    'sanitize_callback' => 'esc_url_raw',
                ],
                'website_id' => [
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ],
            ],
        ]);
    }

    // ═══════════════════════════════════════════
    //  AUTHENTICATION & AUTHORIZATION
    // ═══════════════════════════════════════════

    /**
     * Admin-only check (no secret required). Used for /register-secret.
     */
    public function check_admin_only(WP_REST_Request $request) {
        if (!is_user_logged_in()) {
            return new WP_Error('rest_not_logged_in', 'Authentication required.', ['status' => 401]);
        }

        if (!current_user_can('manage_options')) {
            return new WP_Error('rest_forbidden', 'Administrator access required.', ['status' => 403]);
        }

        return true;
    }

    /**
     * Get the expected shared secret. Checks wp_options first, then wp-config.php.
     */
    private function get_expected_secret() {
        // 1. Check wp_options (set by /register-secret)
        $db_secret = get_option('dashboard_shared_secret', '');
        if (!empty($db_secret)) {
            return $db_secret;
        }

        // 2. Fallback to wp-config.php constant
        if (defined('DASHBOARD_SHARED_SECRET') && !empty(DASHBOARD_SHARED_SECRET)) {
            return DASHBOARD_SHARED_SECRET;
        }

        return '';
    }

    /**
     * Permission check for custom endpoints — shared secret only.
     * No Application Password or WordPress user login required.
     */
    public function check_permissions(WP_REST_Request $request) {
        $secret = $request->get_header('X-Dashboard-Secret');
        $expected = $this->get_expected_secret();

        if (empty($expected)) {
            return new WP_Error('rest_config_error', 'Shared secret not configured. Check Settings > Dashboard Connector.', ['status' => 500]);
        }

        if (empty($secret) || !hash_equals($expected, (string) $secret)) {
            return new WP_Error('rest_forbidden', 'Invalid or missing dashboard secret.', ['status' => 403]);
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
        $wpdb->query($wpdb->prepare("DELETE FROM {$wpdb->options} WHERE option_name LIKE %s", '_transient_%'));
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
        if (!copy($config_file, $backup_file)) {
            return new WP_Error('backup_failed', 'Could not create wp-config.php backup. Aborting.', ['status' => 500]);
        }

        $result = file_put_contents($config_file, $new_content);
        if ($result === false) {
            if (!copy($backup_file, $config_file)) {
                return new WP_Error('write_failed', 'Could not write wp-config.php and backup restore failed. Manual restore needed from: ' . basename($backup_file), ['status' => 500]);
            }
            return new WP_Error('write_failed', 'Could not write wp-config.php. Backup restored.', ['status' => 500]);
        }

        return rest_ensure_response([
            'success' => true,
            'debug'   => $enable,
            'backup'  => basename($backup_file),
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: DATABASE HEALTH
    // ═══════════════════════════════════════════

    public function get_db_health(WP_REST_Request $request) {
        global $wpdb;

        $prefix = $wpdb->prefix;

        // Post revisions count
        $revisions = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$prefix}posts WHERE post_type = 'revision'"
        );

        // Transients count
        $transients = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$prefix}options WHERE option_name LIKE '_transient_%'"
        );

        // Expired transients
        $expired_transients = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$prefix}options
             WHERE option_name LIKE '_transient_timeout_%'
               AND option_value < UNIX_TIMESTAMP()"
        );

        // Autoloaded options size (KB)
        $autoload_bytes = (int) $wpdb->get_var(
            "SELECT SUM(LENGTH(option_value)) FROM {$prefix}options WHERE autoload = 'yes'"
        );
        $autoload_kb = round($autoload_bytes / 1024);

        // Spam comments
        $spam_comments = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$prefix}comments WHERE comment_approved = 'spam'"
        );

        // Total tables and DB size
        $db_size = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2)
                 FROM information_schema.TABLES
                 WHERE table_schema = %s",
                DB_NAME
            )
        );

        // Total posts/pages count
        $total_posts = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$prefix}posts WHERE post_status = 'publish' AND post_type = 'post'"
        );
        $total_pages = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$prefix}posts WHERE post_status = 'publish' AND post_type = 'page'"
        );

        return rest_ensure_response([
            'revisions'          => $revisions,
            'transients'         => $transients,
            'expired_transients' => $expired_transients,
            'autoload_kb'        => $autoload_kb,
            'spam_comments'      => $spam_comments,
            'db_size_mb'         => $db_size . ' MB',
            'total_posts'        => $total_posts,
            'total_pages'        => $total_pages,
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: UPDATE PLUGIN
    // ═══════════════════════════════════════════

    public function update_plugin(WP_REST_Request $request) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/misc.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

        $plugin_file = $request->get_param('plugin');

        $all_plugins = get_plugins();
        if (!isset($all_plugins[$plugin_file])) {
            return new WP_Error('plugin_not_found', 'Plugin not found.', ['status' => 404]);
        }

        $skin = new WP_Ajax_Upgrader_Skin();
        $upgrader = new Plugin_Upgrader($skin);
        $result = $upgrader->upgrade($plugin_file);

        if (is_wp_error($result)) {
            return new WP_Error('update_failed', $result->get_error_message(), ['status' => 500]);
        }

        if ($result === false) {
            $errors = $skin->get_errors();
            $msg = is_wp_error($errors) ? $errors->get_error_message() : 'Update failed — plugin may already be up to date.';
            return new WP_Error('update_failed', $msg, ['status' => 500]);
        }

        // Get new version
        $updated_plugins = get_plugins();
        $new_version = $updated_plugins[$plugin_file]['Version'] ?? 'unknown';

        return rest_ensure_response([
            'success'     => true,
            'plugin'      => $plugin_file,
            'old_version' => $all_plugins[$plugin_file]['Version'],
            'new_version' => $new_version,
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: THEMES
    // ═══════════════════════════════════════════

    public function get_themes(WP_REST_Request $request) {
        $themes = wp_get_themes();
        $active = get_stylesheet();
        $update_themes = get_site_transient('update_themes');

        $result = [];
        foreach ($themes as $slug => $theme) {
            $has_update = isset($update_themes->response[$slug]);
            $result[] = [
                'slug'             => $slug,
                'name'             => $theme->get('Name'),
                'version'          => $theme->get('Version'),
                'active'           => ($slug === $active),
                'is_child_theme'   => (bool) $theme->parent(),
                'parent_theme'     => $theme->parent() ? $theme->parent()->get('Name') : null,
                'author'           => $theme->get('Author'),
                'update_available' => $has_update,
                'update_version'   => $has_update ? ($update_themes->response[$slug]['new_version'] ?? null) : null,
            ];
        }

        return rest_ensure_response($result);
    }

    public function update_theme(WP_REST_Request $request) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/misc.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

        $theme_slug = $request->get_param('theme');
        $theme = wp_get_theme($theme_slug);

        if (!$theme->exists()) {
            return new WP_Error('theme_not_found', 'Theme not found.', ['status' => 404]);
        }

        $old_version = $theme->get('Version');

        $skin = new WP_Ajax_Upgrader_Skin();
        $upgrader = new Theme_Upgrader($skin);
        $result = $upgrader->upgrade($theme_slug);

        if (is_wp_error($result)) {
            return new WP_Error('update_failed', $result->get_error_message(), ['status' => 500]);
        }

        if ($result === false) {
            $errors = $skin->get_errors();
            $msg = is_wp_error($errors) ? $errors->get_error_message() : 'Update failed — theme may already be up to date.';
            return new WP_Error('update_failed', $msg, ['status' => 500]);
        }

        $updated_theme = wp_get_theme($theme_slug);
        return rest_ensure_response([
            'success'     => true,
            'theme'       => $theme_slug,
            'old_version' => $old_version,
            'new_version' => $updated_theme->get('Version'),
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: CORE UPDATE
    // ═══════════════════════════════════════════

    public function update_core(WP_REST_Request $request) {
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/misc.php';
        require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        require_once ABSPATH . 'wp-admin/includes/update.php';

        $old_version = get_bloginfo('version');

        wp_version_check();
        $updates = get_core_updates();

        if (empty($updates) || !is_array($updates) || $updates[0]->response === 'latest') {
            return rest_ensure_response([
                'success' => true,
                'message' => 'WordPress is already up to date.',
                'version' => $old_version,
            ]);
        }

        $skin = new WP_Ajax_Upgrader_Skin();
        $upgrader = new Core_Upgrader($skin);
        $result = $upgrader->upgrade($updates[0]);

        if (is_wp_error($result)) {
            return new WP_Error('update_failed', $result->get_error_message(), ['status' => 500]);
        }

        return rest_ensure_response([
            'success'     => true,
            'old_version' => $old_version,
            'new_version' => is_string($result) ? $result : get_bloginfo('version'),
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: WOOCOMMERCE ORDERS
    // ═══════════════════════════════════════════

    public function get_wc_orders(WP_REST_Request $request) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('wc_not_active', 'WooCommerce is not installed or active.', ['status' => 404]);
        }

        $per_page = min($request->get_param('per_page') ?: 10, 100);
        $page = $request->get_param('page') ?: 1;
        $status = $request->get_param('status') ?: 'any';

        $args = [
            'limit'   => $per_page,
            'page'    => $page,
            'orderby' => 'date',
            'order'   => 'DESC',
            'return'  => 'objects',
        ];

        if ($status !== 'any') {
            $args['status'] = $status;
        }

        $orders = wc_get_orders($args);
        $result = [];

        foreach ($orders as $order) {
            $items = [];
            foreach ($order->get_items() as $item) {
                $items[] = [
                    'name'     => $item->get_name(),
                    'quantity' => $item->get_quantity(),
                    'total'    => $item->get_total(),
                ];
            }

            $result[] = [
                'id'               => $order->get_id(),
                'status'           => $order->get_status(),
                'total'            => $order->get_total(),
                'currency'         => $order->get_currency(),
                'date_created'     => $order->get_date_created() ? $order->get_date_created()->format('Y-m-d H:i:s') : null,
                'customer_name'    => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
                'customer_email'   => $order->get_billing_email(),
                'payment_method'   => $order->get_payment_method_title(),
                'items'            => $items,
                'items_count'      => count($items),
            ];
        }

        // Total count (use direct query for performance)
        global $wpdb;
        if ($status !== 'any') {
            $total = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}wc_orders WHERE status = %s",
                'wc-' . $status
            ));
        } else {
            $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}wc_orders");
        }

        return rest_ensure_response([
            'orders'      => $result,
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $per_page,
            'total_pages' => ceil($total / $per_page),
        ]);
    }

    public function get_wc_order(WP_REST_Request $request) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('wc_not_active', 'WooCommerce is not installed or active.', ['status' => 404]);
        }

        $order_id = $request->get_param('id');
        $order = wc_get_order($order_id);

        if (!$order) {
            return new WP_Error('order_not_found', 'Order not found.', ['status' => 404]);
        }

        $items = [];
        foreach ($order->get_items() as $item) {
            $product = $item->get_product();
            $items[] = [
                'name'       => $item->get_name(),
                'product_id' => $item->get_product_id(),
                'sku'        => $product ? $product->get_sku() : '',
                'quantity'   => $item->get_quantity(),
                'subtotal'   => $item->get_subtotal(),
                'total'      => $item->get_total(),
                'tax'        => $item->get_total_tax(),
            ];
        }

        return rest_ensure_response([
            'id'               => $order->get_id(),
            'status'           => $order->get_status(),
            'total'            => $order->get_total(),
            'subtotal'         => $order->get_subtotal(),
            'total_tax'        => $order->get_total_tax(),
            'total_shipping'   => $order->get_shipping_total(),
            'discount_total'   => $order->get_discount_total(),
            'currency'         => $order->get_currency(),
            'date_created'     => $order->get_date_created() ? $order->get_date_created()->format('Y-m-d H:i:s') : null,
            'date_modified'    => $order->get_date_modified() ? $order->get_date_modified()->format('Y-m-d H:i:s') : null,
            'payment_method'   => $order->get_payment_method_title(),
            'transaction_id'   => $order->get_transaction_id(),
            'customer_note'    => $order->get_customer_note(),
            'billing' => [
                'first_name' => $order->get_billing_first_name(),
                'last_name'  => $order->get_billing_last_name(),
                'email'      => $order->get_billing_email(),
                'phone'      => $order->get_billing_phone(),
                'address_1'  => $order->get_billing_address_1(),
                'city'       => $order->get_billing_city(),
                'state'      => $order->get_billing_state(),
                'postcode'   => $order->get_billing_postcode(),
                'country'    => $order->get_billing_country(),
            ],
            'shipping' => [
                'first_name' => $order->get_shipping_first_name(),
                'last_name'  => $order->get_shipping_last_name(),
                'address_1'  => $order->get_shipping_address_1(),
                'city'       => $order->get_shipping_city(),
                'state'      => $order->get_shipping_state(),
                'postcode'   => $order->get_shipping_postcode(),
                'country'    => $order->get_shipping_country(),
            ],
            'items' => $items,
            'notes' => $this->get_order_notes($order),
        ]);
    }

    private function get_order_notes($order) {
        $notes = wc_get_order_notes(['order_id' => $order->get_id(), 'limit' => 20]);
        $result = [];
        foreach ($notes as $note) {
            $result[] = [
                'id'           => $note->id,
                'content'      => $note->content,
                'customer_note' => $note->customer_note,
                'added_by'     => $note->added_by,
                'date_created' => $note->date_created ? $note->date_created->format('Y-m-d H:i:s') : null,
            ];
        }
        return $result;
    }

    public function get_wc_stats(WP_REST_Request $request) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('wc_not_active', 'WooCommerce is not installed or active.', ['status' => 404]);
        }

        // Today's stats
        $today_start = date('Y-m-d 00:00:00');
        $today_orders = wc_get_orders([
            'date_created' => '>=' . $today_start,
            'status'       => ['wc-completed', 'wc-processing', 'wc-on-hold'],
            'return'       => 'objects',
        ]);

        $today_revenue = 0;
        foreach ($today_orders as $order) {
            $today_revenue += (float) $order->get_total();
        }

        // This month
        $month_start = date('Y-m-01 00:00:00');
        $month_orders = wc_get_orders([
            'date_created' => '>=' . $month_start,
            'status'       => ['wc-completed', 'wc-processing', 'wc-on-hold'],
            'return'       => 'objects',
        ]);

        $month_revenue = 0;
        foreach ($month_orders as $order) {
            $month_revenue += (float) $order->get_total();
        }

        // Orders by status
        $statuses = ['processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'];
        $by_status = [];
        global $wpdb;
        foreach ($statuses as $status) {
            $count = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->prefix}wc_orders WHERE status = %s",
                'wc-' . $status
            ));
            if ($count > 0) {
                $by_status[$status] = $count;
            }
        }

        // Low stock (if inventory management enabled)
        $low_stock = [];
        $low_stock_products = wc_get_products([
            'status'     => 'publish',
            'limit'      => 10,
            'orderby'    => 'meta_value_num',
            'order'      => 'ASC',
            'meta_key'   => '_stock',
            'stock_status' => 'instock',
            'manage_stock' => true,
        ]);

        foreach ($low_stock_products as $product) {
            $stock = $product->get_stock_quantity();
            if ($stock !== null && $stock <= 5) {
                $low_stock[] = [
                    'id'    => $product->get_id(),
                    'name'  => $product->get_name(),
                    'stock' => $stock,
                    'sku'   => $product->get_sku(),
                ];
            }
        }

        return rest_ensure_response([
            'today_orders'     => count($today_orders),
            'today_revenue'    => round($today_revenue, 2),
            'month_orders'     => count($month_orders),
            'month_revenue'    => round($month_revenue, 2),
            'currency'         => get_woocommerce_currency(),
            'orders_by_status' => $by_status,
            'low_stock'        => $low_stock,
            'total_products'   => (int) wp_count_posts('product')->publish,
        ]);
    }

    public function get_wc_products(WP_REST_Request $request) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce is not installed or active.', ['status' => 400]);
        }

        $per_page = min($request->get_param('per_page') ?: 20, 100);
        $page     = $request->get_param('page') ?: 1;
        $search   = $request->get_param('search') ?: '';
        $status   = $request->get_param('status') ?: 'publish';

        $args = [
            'limit'  => $per_page,
            'page'   => $page,
            'status' => $status,
            'return' => 'objects',
        ];
        if ($search) {
            $args['s'] = $search;
        }

        $products = wc_get_products($args);
        $total = (new WC_Product_Query(array_merge($args, ['limit' => -1, 'return' => 'ids'])))->get_products();

        $result = [];
        foreach ($products as $product) {
            $image_id  = $product->get_image_id();
            $image_url = $image_id ? wp_get_attachment_url($image_id) : null;

            $result[] = [
                'id'            => $product->get_id(),
                'name'          => $product->get_name(),
                'slug'          => $product->get_slug(),
                'type'          => $product->get_type(),
                'status'        => $product->get_status(),
                'sku'           => $product->get_sku(),
                'price'         => $product->get_price(),
                'regular_price' => $product->get_regular_price(),
                'sale_price'    => $product->get_sale_price(),
                'stock_status'  => $product->get_stock_status(),
                'stock_quantity' => $product->get_stock_quantity(),
                'image_url'     => $image_url,
                'categories'    => wp_list_pluck($product->get_category_ids() ? get_terms(['taxonomy' => 'product_cat', 'include' => $product->get_category_ids(), 'hide_empty' => false]) : [], 'name'),
            ];
        }

        return rest_ensure_response([
            'products'    => $result,
            'total'       => count($total),
            'page'        => $page,
            'per_page'    => $per_page,
            'total_pages' => ceil(count($total) / $per_page),
        ]);
    }

    public function get_wc_product(WP_REST_Request $request) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce is not installed or active.', ['status' => 400]);
        }

        $product = wc_get_product($request['id']);
        if (!$product) {
            return new WP_Error('product_not_found', 'Product not found.', ['status' => 404]);
        }

        $image_id  = $product->get_image_id();
        $image_url = $image_id ? wp_get_attachment_url($image_id) : null;
        $gallery   = array_map('wp_get_attachment_url', $product->get_gallery_image_ids());

        return rest_ensure_response([
            'id'              => $product->get_id(),
            'name'            => $product->get_name(),
            'slug'            => $product->get_slug(),
            'type'            => $product->get_type(),
            'status'          => $product->get_status(),
            'description'     => $product->get_description(),
            'short_description' => $product->get_short_description(),
            'sku'             => $product->get_sku(),
            'price'           => $product->get_price(),
            'regular_price'   => $product->get_regular_price(),
            'sale_price'      => $product->get_sale_price(),
            'stock_status'    => $product->get_stock_status(),
            'stock_quantity'  => $product->get_stock_quantity(),
            'weight'          => $product->get_weight(),
            'image_url'       => $image_url,
            'gallery_urls'    => $gallery,
            'categories'      => wp_list_pluck($product->get_category_ids() ? get_terms(['taxonomy' => 'product_cat', 'include' => $product->get_category_ids(), 'hide_empty' => false]) : [], 'name'),
            'tags'            => wp_list_pluck($product->get_tag_ids() ? get_terms(['taxonomy' => 'product_tag', 'include' => $product->get_tag_ids(), 'hide_empty' => false]) : [], 'name'),
        ]);
    }

    public function update_wc_product(WP_REST_Request $request) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce is not installed or active.', ['status' => 400]);
        }

        $product_id = $request->get_param('product_id');
        $product = wc_get_product($product_id);
        if (!$product) {
            return new WP_Error('product_not_found', 'Product not found.', ['status' => 404]);
        }

        $updated = [];

        // Price fields
        if ($request->has_param('regular_price')) {
            $product->set_regular_price(sanitize_text_field($request->get_param('regular_price')));
            $updated[] = 'regular_price';
        }
        if ($request->has_param('sale_price')) {
            $val = $request->get_param('sale_price');
            $product->set_sale_price($val === '' ? '' : sanitize_text_field($val));
            $updated[] = 'sale_price';
        }

        // Text fields
        if ($request->has_param('name')) {
            $product->set_name(sanitize_text_field($request->get_param('name')));
            $updated[] = 'name';
        }
        if ($request->has_param('description')) {
            $product->set_description(wp_kses_post($request->get_param('description')));
            $updated[] = 'description';
        }
        if ($request->has_param('short_description')) {
            $product->set_short_description(wp_kses_post($request->get_param('short_description')));
            $updated[] = 'short_description';
        }
        if ($request->has_param('sku')) {
            $product->set_sku(sanitize_text_field($request->get_param('sku')));
            $updated[] = 'sku';
        }
        if ($request->has_param('status')) {
            $product->set_status(sanitize_text_field($request->get_param('status')));
            $updated[] = 'status';
        }

        // Stock
        if ($request->has_param('stock_quantity')) {
            $product->set_manage_stock(true);
            $product->set_stock_quantity((int) $request->get_param('stock_quantity'));
            $updated[] = 'stock_quantity';
        }
        if ($request->has_param('stock_status')) {
            $product->set_stock_status(sanitize_text_field($request->get_param('stock_status')));
            $updated[] = 'stock_status';
        }

        // Image — accepts a media library attachment ID
        if ($request->has_param('image_id')) {
            $image_id = absint($request->get_param('image_id'));
            if ($image_id && wp_get_attachment_url($image_id)) {
                $product->set_image_id($image_id);
                $updated[] = 'image_id';
            } else {
                return new WP_Error('invalid_image', 'Attachment ID not found in media library.', ['status' => 400]);
            }
        }

        if (empty($updated)) {
            return new WP_Error('no_changes', 'No valid fields provided to update.', ['status' => 400]);
        }

        $product->save();

        return rest_ensure_response([
            'success'    => true,
            'product_id' => $product_id,
            'updated'    => $updated,
        ]);
    }

    public function update_wc_order(WP_REST_Request $request) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_not_active', 'WooCommerce is not installed or active.', ['status' => 400]);
        }

        $order_id = $request->get_param('order_id');
        $status   = $request->get_param('status');

        $order = wc_get_order($order_id);
        if (!$order) {
            return new WP_Error('order_not_found', 'Order not found.', ['status' => 404]);
        }

        $valid_statuses = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'];
        // Strip wc- prefix if provided
        $status = str_replace('wc-', '', $status);
        if (!in_array($status, $valid_statuses)) {
            return new WP_Error('invalid_status', 'Invalid order status. Valid: ' . implode(', ', $valid_statuses), ['status' => 400]);
        }

        $old_status = $order->get_status();
        $order->update_status($status, 'Status updated via Dashboard AI.');

        // Add optional note
        $note = $request->get_param('note');
        if ($note) {
            $order->add_order_note(sanitize_text_field($note), 0, true);
        }

        return rest_ensure_response([
            'success'    => true,
            'order_id'   => $order_id,
            'old_status' => $old_status,
            'new_status' => $status,
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: CREATE POST WITH SEO
    // ═══════════════════════════════════════════

    public function create_post_with_seo(WP_REST_Request $request) {
        $title   = $request->get_param('title');
        $content = $request->get_param('content');
        $status  = $request->get_param('status') ?: 'draft';
        $excerpt = $request->get_param('excerpt') ?: '';
        $slug    = $request->get_param('slug') ?: '';

        // Validate status
        $valid_statuses = ['publish', 'draft', 'pending', 'private'];
        if (!in_array($status, $valid_statuses)) {
            return new WP_Error('invalid_status', 'Invalid post status.', ['status' => 400]);
        }

        $post_data = [
            'post_title'   => $title,
            'post_content' => wp_kses_post($content),
            'post_status'  => $status,
            'post_type'    => 'post',
            'post_author'  => get_current_user_id(),
        ];

        if ($excerpt) {
            $post_data['post_excerpt'] = sanitize_textarea_field($excerpt);
        }
        if ($slug) {
            $post_data['post_name'] = sanitize_title($slug);
        }

        $post_id = wp_insert_post($post_data, true);

        if (is_wp_error($post_id)) {
            return new WP_Error('create_failed', $post_id->get_error_message(), ['status' => 500]);
        }

        // Set categories if provided
        $categories = $request->get_param('categories');
        if ($categories && is_array($categories)) {
            $cat_ids = [];
            foreach ($categories as $cat_name) {
                $term = get_term_by('name', $cat_name, 'category');
                if ($term) {
                    $cat_ids[] = $term->term_id;
                } else {
                    // Create category if it doesn't exist
                    $new_term = wp_insert_term($cat_name, 'category');
                    if (!is_wp_error($new_term)) {
                        $cat_ids[] = $new_term['term_id'];
                    }
                }
            }
            if (!empty($cat_ids)) {
                wp_set_post_categories($post_id, $cat_ids);
            }
        }

        // Set tags if provided
        $tags = $request->get_param('tags');
        if ($tags && is_array($tags)) {
            wp_set_post_tags($post_id, $tags);
        }

        // Set featured image if media ID provided
        $featured_image_id = $request->get_param('featured_image_id');
        if ($featured_image_id) {
            set_post_thumbnail($post_id, absint($featured_image_id));
        }

        // Set Yoast SEO fields if available
        $meta_description = $request->get_param('meta_description');
        if ($meta_description) {
            update_post_meta($post_id, '_yoast_wpseo_metadesc', sanitize_text_field($meta_description));
        }

        $focus_keyword = $request->get_param('focus_keyword');
        if ($focus_keyword) {
            update_post_meta($post_id, '_yoast_wpseo_focuskw', sanitize_text_field($focus_keyword));
        }

        $seo_title = $request->get_param('seo_title');
        if ($seo_title) {
            update_post_meta($post_id, '_yoast_wpseo_title', sanitize_text_field($seo_title));
        }

        return rest_ensure_response([
            'success'  => true,
            'post_id'  => $post_id,
            'title'    => $title,
            'status'   => $status,
            'url'      => get_permalink($post_id),
            'edit_url' => admin_url("post.php?post={$post_id}&action=edit"),
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: USER MANAGEMENT
    // ═══════════════════════════════════════════

    public function get_wp_users(WP_REST_Request $request) {
        $users = get_users([
            'orderby' => 'registered',
            'order'   => 'DESC',
            'number'  => 100,
        ]);

        $result = [];
        foreach ($users as $user) {
            $result[] = [
                'id'           => $user->ID,
                'username'     => $user->user_login,
                'email'        => $user->user_email,
                'display_name' => $user->display_name,
                'first_name'   => $user->first_name,
                'last_name'    => $user->last_name,
                'role'         => !empty($user->roles) ? $user->roles[0] : 'none',
                'registered'   => $user->user_registered,
                'last_login'   => get_user_meta($user->ID, 'last_login', true) ?: null,
            ];
        }

        return rest_ensure_response($result);
    }

    public function create_wp_user(WP_REST_Request $request) {
        $username = $request->get_param('username');
        $email = $request->get_param('email');
        $role = $request->get_param('role') ?: 'subscriber';
        $password = $request->get_param('password') ?: wp_generate_password(16, true, true);
        $first_name = $request->get_param('first_name') ?: '';
        $last_name = $request->get_param('last_name') ?: '';

        if (username_exists($username)) {
            return new WP_Error('username_exists', 'Username already exists.', ['status' => 409]);
        }
        if (email_exists($email)) {
            return new WP_Error('email_exists', 'Email already exists.', ['status' => 409]);
        }

        $user_id = wp_insert_user([
            'user_login' => $username,
            'user_email' => $email,
            'user_pass'  => $password,
            'role'       => $role,
            'first_name' => $first_name,
            'last_name'  => $last_name,
        ]);

        if (is_wp_error($user_id)) {
            return new WP_Error('create_failed', $user_id->get_error_message(), ['status' => 500]);
        }

        return rest_ensure_response([
            'success'  => true,
            'user_id'  => $user_id,
            'username' => $username,
            'email'    => $email,
            'role'     => $role,
        ]);
    }

    public function update_wp_user(WP_REST_Request $request) {
        $user_id = $request->get_param('user_id');
        $user = get_user_by('id', $user_id);

        if (!$user) {
            return new WP_Error('user_not_found', 'User not found.', ['status' => 404]);
        }

        $data = ['ID' => $user_id];
        $params = $request->get_json_params();

        if (isset($params['email'])) $data['user_email'] = sanitize_email($params['email']);
        if (isset($params['first_name'])) $data['first_name'] = sanitize_text_field($params['first_name']);
        if (isset($params['last_name'])) $data['last_name'] = sanitize_text_field($params['last_name']);
        if (isset($params['display_name'])) $data['display_name'] = sanitize_text_field($params['display_name']);
        if (isset($params['password'])) $data['user_pass'] = $params['password'];

        $result = wp_update_user($data);

        if (is_wp_error($result)) {
            return new WP_Error('update_failed', $result->get_error_message(), ['status' => 500]);
        }

        // Handle role change separately
        if (isset($params['role'])) {
            $user = new WP_User($user_id);
            $user->set_role(sanitize_text_field($params['role']));
        }

        return rest_ensure_response([
            'success' => true,
            'user_id' => $user_id,
        ]);
    }

    public function delete_wp_user(WP_REST_Request $request) {
        require_once ABSPATH . 'wp-admin/includes/user.php';

        $user_id = $request->get_param('user_id');
        $reassign = $request->get_param('reassign') ?: 1;

        $user = get_user_by('id', $user_id);
        if (!$user) {
            return new WP_Error('user_not_found', 'User not found.', ['status' => 404]);
        }

        // Prevent deleting the current user
        if ($user_id === get_current_user_id()) {
            return new WP_Error('cannot_delete_self', 'Cannot delete your own account.', ['status' => 403]);
        }

        $result = wp_delete_user($user_id, $reassign);

        if (!$result) {
            return new WP_Error('delete_failed', 'Failed to delete user.', ['status' => 500]);
        }

        return rest_ensure_response([
            'success'  => true,
            'user_id'  => $user_id,
            'reassigned_to' => $reassign,
        ]);
    }

    public function send_password_reset(WP_REST_Request $request) {
        $user_id = $request->get_param('user_id');

        $user = get_user_by('id', $user_id);
        if (!$user) {
            return new WP_Error('user_not_found', 'User not found.', ['status' => 404]);
        }

        // Use WordPress built-in password reset
        $result = retrieve_password($user->user_login);

        if (is_wp_error($result)) {
            return new WP_Error('reset_failed', $result->get_error_message(), ['status' => 500]);
        }

        return rest_ensure_response([
            'success' => true,
            'user_id' => $user_id,
            'email'   => $user->user_email,
            'message' => 'Password reset email sent to ' . $user->user_email,
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: REGISTER SHARED SECRET
    // ═══════════════════════════════════════════

    public function register_secret(WP_REST_Request $request) {
        $secret = $request->get_param('secret');

        if (empty($secret) || strlen($secret) < 32) {
            return new WP_Error('invalid_secret', 'Secret must be at least 32 characters.', ['status' => 400]);
        }

        // Store in wp_options (autoloaded for performance)
        update_option('dashboard_shared_secret', $secret, true);

        return rest_ensure_response([
            'success' => true,
            'message' => 'Shared secret registered successfully.',
        ]);
    }

    // ═══════════════════════════════════════════
    //  ENDPOINT: WEBHOOK CONFIG
    // ═══════════════════════════════════════════

    public function save_webhook_config(WP_REST_Request $request) {
        $config = [
            'api_key'       => $request->get_param('api_key'),
            'dashboard_url' => untrailingslashit($request->get_param('dashboard_url')),
            'webhook_url'   => $request->get_param('webhook_url'),
            'website_id'    => $request->get_param('website_id'),
            'updated_at'    => current_time('mysql'),
        ];

        update_option('dashboard_webhook_config', $config, false);

        return rest_ensure_response([
            'success' => true,
            'message' => 'Webhook configuration saved.',
        ]);
    }

    // ═══════════════════════════════════════════
    //  ADMIN MENU & SETTINGS PAGE
    // ═══════════════════════════════════════════

    public function add_admin_menu() {
        add_options_page(
            'Dashboard Connector',
            'Dashboard Connector',
            'manage_options',
            'dashboard-connector',
            [$this, 'render_admin_page']
        );
    }

    public function enqueue_admin_assets($hook) {
        if ($hook !== 'settings_page_dashboard-connector') return;

        wp_enqueue_style(
            'dashboard-connector-admin',
            false // inline only
        );

        // Inline CSS for the admin page
        wp_add_inline_style('dashboard-connector-admin', $this->get_admin_css());

        // Clipboard JS
        wp_add_inline_script('jquery', $this->get_admin_js());
    }

    public function render_admin_page() {
        $config = get_option('dashboard_webhook_config', []);
        $secret = $this->get_expected_secret();
        $has_secret = !empty($secret);

        $api_key       = $config['api_key'] ?? '';
        $dashboard_url = $config['dashboard_url'] ?? '';
        $webhook_url   = $config['webhook_url'] ?? '';
        $website_id    = $config['website_id'] ?? '';
        $updated_at    = $config['updated_at'] ?? '';

        $is_configured = !empty($api_key) && !empty($webhook_url);
        ?>
        <div class="wrap dc-wrap">
            <h1 class="dc-title">
                <span class="dc-logo">AC</span>
                Dashboard Connector
                <span class="dc-version">v<?php echo esc_html(DASHBOARD_CONNECTOR_VERSION); ?></span>
            </h1>

            <!-- Shared Secret -->
            <div class="dc-card">
                <h2 class="dc-card-title">Shared Secret</h2>
                <p class="dc-description">Copy this secret into the Dashboard when connecting this website. No Application Password needed.</p>

                <div class="dc-key-box">
                    <code id="dc-shared-secret"><?php echo esc_html($secret); ?></code>
                    <button type="button" class="button dc-copy-btn" data-target="dc-shared-secret" title="Copy shared secret">
                        <span class="dashicons dashicons-clipboard"></span> Copy
                    </button>
                </div>
                <p class="dc-hint">This secret was auto-generated when the plugin was installed. It authenticates the Dashboard connection.</p>
            </div>

            <!-- Connection Status -->
            <div class="dc-card">
                <h2 class="dc-card-title">Connection Status</h2>
                <table class="dc-table">
                    <?php if ($dashboard_url): ?>
                    <tr>
                        <td class="dc-label">Dashboard URL</td>
                        <td><a href="<?php echo esc_url($dashboard_url); ?>" target="_blank"><?php echo esc_html($dashboard_url); ?></a></td>
                    </tr>
                    <?php endif; ?>
                    <?php if ($updated_at): ?>
                    <tr>
                        <td class="dc-label">Last Updated</td>
                        <td><?php echo esc_html($updated_at); ?></td>
                    </tr>
                    <?php endif; ?>
                </table>
            </div>

            <?php if ($is_configured): ?>
            <!-- Webhook API Key -->
            <div class="dc-card">
                <h2 class="dc-card-title">Webhook API Key</h2>
                <p class="dc-description">Use this key to send leads from your contact forms to the Dashboard.</p>

                <div class="dc-key-box">
                    <code id="dc-api-key"><?php echo esc_html($api_key); ?></code>
                    <button type="button" class="button dc-copy-btn" data-target="dc-api-key" title="Copy API key">
                        <span class="dashicons dashicons-clipboard"></span> Copy
                    </button>
                </div>

                <div class="dc-key-box dc-key-box-url">
                    <label class="dc-label">Full Webhook URL</label>
                    <code id="dc-webhook-url"><?php echo esc_html($webhook_url); ?></code>
                    <button type="button" class="button dc-copy-btn" data-target="dc-webhook-url" title="Copy webhook URL">
                        <span class="dashicons dashicons-clipboard"></span> Copy
                    </button>
                </div>

                <?php if ($dashboard_url && $website_id): ?>
                <div class="dc-regenerate">
                    <button type="button" class="button" id="dc-regenerate-btn" data-action="regenerate">
                        <span class="dashicons dashicons-update"></span> Regenerate Key
                    </button>
                    <span id="dc-regenerate-status"></span>
                    <input type="hidden" id="dc-website-id" value="<?php echo esc_attr($website_id); ?>" />
                    <input type="hidden" id="dc-dashboard-url" value="<?php echo esc_attr($dashboard_url); ?>" />
                    <p class="dc-hint">Generates a new random key on the Dashboard. The old key stops working immediately.</p>
                </div>
                <?php endif; ?>
            </div>

            <!-- Form Plugin Setup -->
            <div class="dc-card">
                <h2 class="dc-card-title">Form Plugin Setup</h2>
                <p class="dc-description">Copy the webhook URL above and paste it into your form plugin:</p>

                <div class="dc-accordion">
                    <details>
                        <summary><strong>Elementor Forms</strong></summary>
                        <ol>
                            <li>Edit the form widget</li>
                            <li>Go to <strong>Actions After Submit</strong></li>
                            <li>Add <strong>Webhook</strong></li>
                            <li>Paste the webhook URL into the <strong>URL</strong> field</li>
                        </ol>
                    </details>

                    <details>
                        <summary><strong>Contact Form 7</strong></summary>
                        <ol>
                            <li>Install a CF7 webhook plugin (e.g. CF7 to Webhook)</li>
                            <li>Edit your form &rarr; <strong>Webhook</strong> tab</li>
                            <li>Paste the webhook URL</li>
                            <li>Set method to <strong>POST</strong></li>
                        </ol>
                    </details>

                    <details>
                        <summary><strong>WPForms</strong></summary>
                        <ol>
                            <li>Edit your form &rarr; <strong>Settings &rarr; Notifications</strong></li>
                            <li>Or use the Webhooks addon</li>
                            <li>Paste the webhook URL</li>
                        </ol>
                    </details>

                    <details>
                        <summary><strong>Gravity Forms</strong></summary>
                        <ol>
                            <li>Edit form &rarr; <strong>Settings &rarr; Webhooks</strong></li>
                            <li>Add feed &rarr; paste the webhook URL</li>
                            <li>Request method: <strong>POST</strong>, format: <strong>JSON</strong></li>
                        </ol>
                    </details>

                    <details>
                        <summary><strong>Any Other Form</strong></summary>
                        <p>Send a <strong>POST</strong> request to the webhook URL with a JSON body:</p>
                        <pre>{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "message": "Your message"
}</pre>
                        <p class="dc-hint">The dashboard auto-detects field names in multiple languages (EN, RO, FR, NL, ES, DE, RU).</p>
                    </details>
                </div>
            </div>

            <?php elseif ($has_secret && $website_id): ?>
            <!-- Connected but no key yet — Generate button -->
            <div class="dc-card">
                <h2 class="dc-card-title">Webhook API Key</h2>
                <p class="dc-description">No webhook key has been configured yet. Generate one to start receiving leads from your forms.</p>

                <div class="dc-generate-box">
                    <button type="button" class="button button-primary button-hero" id="dc-regenerate-btn" data-action="generate">
                        <span class="dashicons dashicons-randomize"></span> Generate Random Key
                    </button>
                    <span id="dc-regenerate-status"></span>
                    <input type="hidden" id="dc-website-id" value="<?php echo esc_attr($website_id); ?>" />
                    <input type="hidden" id="dc-dashboard-url" value="<?php echo esc_attr($dashboard_url); ?>" />
                </div>
                <p class="dc-hint" style="margin-top:12px">Creates a secure random API key on the Dashboard and saves it here automatically.</p>
            </div>

            <?php else: ?>
            <!-- Not connected yet -->
            <div class="dc-card dc-card-empty">
                <span class="dashicons dashicons-admin-links dc-empty-icon"></span>
                <h3>Connect to Dashboard</h3>
                <p>Copy the Shared Secret above and connect this site from the Dashboard.</p>
                <ol>
                    <li>Go to <strong>Dashboard &rarr; Admin &rarr; Clients &rarr; [Client] &rarr; Website</strong></li>
                    <li>Click <strong>Connect WordPress</strong></li>
                    <li>Enter this site's URL and paste the <strong>Shared Secret</strong></li>
                    <li>Then click <strong>Generate Random Key</strong> here for the webhook</li>
                </ol>
            </div>
            <?php endif; ?>

            <!-- Test Webhook -->
            <div class="dc-card">
                <h2 class="dc-card-title">Test Webhook</h2>
                <p class="dc-description">Send a test lead to verify your connection.</p>
                <button type="button" class="button button-primary" id="dc-test-webhook" <?php echo $is_configured ? '' : 'disabled'; ?>>
                    <span class="dashicons dashicons-megaphone"></span> Send Test Lead
                </button>
                <span id="dc-test-status"></span>
            </div>
        </div>
        <?php
    }

    private function get_admin_css() {
        return '
        .dc-wrap { max-width: 720px; }
        .dc-title { display: flex; align-items: center; gap: 10px; font-size: 22px; margin-bottom: 20px; }
        .dc-logo { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #1d2327; color: #fff; border-radius: 8px; font-size: 14px; font-weight: 700; }
        .dc-version { font-size: 12px; color: #999; font-weight: 400; }
        .dc-card { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
        .dc-card-title { font-size: 15px; margin: 0 0 6px; }
        .dc-description { color: #666; font-size: 13px; margin: 0 0 16px; }
        .dc-table { width: 100%; border-collapse: collapse; }
        .dc-table td { padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; vertical-align: middle; }
        .dc-table tr:last-child td { border-bottom: none; }
        .dc-label { font-weight: 600; color: #555; width: 140px; }
        .dc-badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; font-weight: 600; }
        .dc-badge-ok { background: #d4edda; color: #155724; }
        .dc-badge-warn { background: #fff3cd; color: #856404; }
        .dc-hint { color: #999; font-size: 12px; margin-top: 4px; }
        .dc-key-box { background: #f8f9fa; border: 1px solid #e2e4e7; border-radius: 6px; padding: 12px 14px; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; }
        .dc-key-box-url { flex-direction: column; align-items: flex-start; }
        .dc-key-box-url .dc-copy-btn { align-self: flex-end; }
        .dc-key-box code { flex: 1; font-size: 13px; word-break: break-all; background: none; padding: 0; }
        .dc-copy-btn { white-space: nowrap; }
        .dc-copy-btn .dashicons { font-size: 16px; width: 16px; height: 16px; vertical-align: middle; margin-top: -2px; }
        .dc-regenerate { margin-top: 8px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .dc-regenerate .dashicons { font-size: 16px; width: 16px; height: 16px; vertical-align: middle; margin-top: -2px; }
        .dc-generate-box { text-align: center; padding: 16px 0; }
        .dc-generate-box .dashicons { font-size: 20px; width: 20px; height: 20px; vertical-align: middle; margin-top: -2px; margin-right: 4px; }
        .dc-generate-box #dc-regenerate-status { display: block; margin-top: 10px; }
        .dc-card-empty { text-align: center; padding: 40px 20px; color: #666; }
        .dc-empty-icon { font-size: 40px; width: 40px; height: 40px; color: #ccc; margin-bottom: 10px; }
        .dc-card-empty ol { text-align: left; display: inline-block; }
        .dc-accordion details { border-bottom: 1px solid #f0f0f0; padding: 8px 0; }
        .dc-accordion details:last-child { border-bottom: none; }
        .dc-accordion summary { cursor: pointer; padding: 4px 0; font-size: 13px; }
        .dc-accordion ol, .dc-accordion p { font-size: 13px; margin: 8px 0 4px 20px; color: #555; }
        .dc-accordion pre { background: #f1f1f1; padding: 10px; border-radius: 4px; font-size: 12px; overflow-x: auto; }
        #dc-test-webhook .dashicons { font-size: 16px; width: 16px; height: 16px; vertical-align: middle; margin-top: -2px; }
        ';
    }

    private function get_admin_js() {
        return "
        jQuery(function($) {
            // Copy to clipboard
            $(document).on('click', '.dc-copy-btn', function() {
                var target = $(this).data('target');
                var text = $('#' + target).text().trim();
                navigator.clipboard.writeText(text).then(function() {
                    var btn = $(this);
                    var orig = btn.html();
                    btn.html('<span class=\"dashicons dashicons-yes\"></span> Copied!');
                    setTimeout(function() { btn.html(orig); }, 2000);
                }.bind(this));
            });

            // Test webhook
            $('#dc-test-webhook').on('click', function() {
                var btn = $(this);
                var status = $('#dc-test-status');
                var webhookUrl = $('#dc-webhook-url').text().trim();

                if (!webhookUrl) { status.text('No webhook URL configured.').css('color', '#dc3232'); return; }

                btn.prop('disabled', true);
                status.text('Sending...').css('color', '#666');

                $.ajax({
                    url: webhookUrl,
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        name: 'Test Lead from WordPress',
                        email: 'test@' + window.location.hostname,
                        phone: '+1234567890',
                        message: 'This is a test lead sent from the Dashboard Connector settings page.',
                        form_name: 'dashboard-connector-test'
                    }),
                    success: function(resp) {
                        status.html('<span style=\"color:#46b450\">&#10003; Test lead sent successfully!</span>');
                        btn.prop('disabled', false);
                    },
                    error: function(xhr) {
                        status.html('<span style=\"color:#dc3232\">&#10007; Failed: ' + (xhr.responseJSON?.error || xhr.statusText) + '</span>');
                        btn.prop('disabled', false);
                    }
                });
            });

            // Generate / Regenerate key
            $('#dc-regenerate-btn').on('click', function() {
                var btn = $(this);
                var action = btn.data('action') || 'regenerate';

                if (action === 'regenerate') {
                    if (!confirm('Regenerate the webhook API key?\\nThe old key will stop working immediately.')) return;
                } else {
                    if (!confirm('Generate a new random webhook API key for this website?')) return;
                }

                var status = $('#dc-regenerate-status');
                var dashboardUrl = $('#dc-dashboard-url').val();
                var websiteId = $('#dc-website-id').val();

                btn.prop('disabled', true);
                status.text(action === 'generate' ? 'Generating...' : 'Regenerating...').css('color', '#666');

                $.ajax({
                    url: dashboardUrl + '/api/webhooks/' + websiteId + '/regenerate',
                    method: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        shared_secret: '" . esc_js($this->get_expected_secret()) . "',
                        site_url: window.location.origin
                    }),
                    success: function(resp) {
                        if (resp.success && resp.api_key) {
                            // Save updated config to WP options via REST API
                            $.ajax({
                                url: '" . esc_js(rest_url('dashboard/v1/webhook-config')) . "',
                                method: 'POST',
                                contentType: 'application/json',
                                beforeSend: function(xhr) {
                                    xhr.setRequestHeader('X-WP-Nonce', '" . esc_js(wp_create_nonce('wp_rest')) . "');
                                    xhr.setRequestHeader('X-Dashboard-Secret', '" . esc_js($this->get_expected_secret()) . "');
                                },
                                data: JSON.stringify({
                                    api_key: resp.api_key,
                                    dashboard_url: dashboardUrl,
                                    webhook_url: resp.webhook_url,
                                    website_id: websiteId
                                }),
                                complete: function() {
                                    var msg = action === 'generate' ? 'Key generated!' : 'Key regenerated!';
                                    status.html('<span style=\"color:#46b450\">&#10003; ' + msg + ' Reloading...</span>');
                                    setTimeout(function() { window.location.reload(); }, 1000);
                                }
                            });
                        } else {
                            status.html('<span style=\"color:#dc3232\">&#10007; ' + (resp.error || 'Failed') + '</span>');
                            btn.prop('disabled', false);
                        }
                    },
                    error: function(xhr) {
                        status.html('<span style=\"color:#dc3232\">&#10007; Failed: ' + (xhr.responseJSON?.error || xhr.statusText) + '</span>');
                        btn.prop('disabled', false);
                    }
                });
            });
        });
        ";
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
