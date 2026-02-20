<?php
/**
 * Plugin Name: Dashboard Connector
 * Description: Exposes secure REST API endpoints for the Client Dashboard platform. Drop into wp-content/mu-plugins/.
 * Version: 1.0.0
 * Author: ACSD
 * Requires PHP: 7.4
 *
 * Endpoints (all require Application Password authentication):
 *   GET  /wp-json/dashboard/v1/debug-log    — Read debug.log (last N lines)
 *   GET  /wp-json/dashboard/v1/site-health  — Server/WP/PHP info, plugins, theme
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {

    // --- Debug Log Endpoint ---
    register_rest_route('dashboard/v1', '/debug-log', [
        'methods'             => 'GET',
        'callback'            => 'dashboard_connector_debug_log',
        'permission_callback' => 'dashboard_connector_check_admin',
        'args'                => [
            'lines' => [
                'default'           => 200,
                'sanitize_callback' => 'absint',
                'validate_callback' => function ($value) {
                    return is_numeric($value) && (int) $value > 0 && (int) $value <= 1000;
                },
            ],
        ],
    ]);

    // --- Site Health Endpoint ---
    register_rest_route('dashboard/v1', '/site-health', [
        'methods'             => 'GET',
        'callback'            => 'dashboard_connector_site_health',
        'permission_callback' => 'dashboard_connector_check_admin',
    ]);
});

/**
 * Permission callback – only administrators allowed.
 */
function dashboard_connector_check_admin(WP_REST_Request $request): bool {
    return current_user_can('manage_options');
}

/**
 * Read the last N lines of debug.log.
 */
function dashboard_connector_debug_log(WP_REST_Request $request): WP_REST_Response {
    $lines_requested = (int) $request->get_param('lines');
    $debug_log_path  = WP_CONTENT_DIR . '/debug.log';

    $debug_enabled = defined('WP_DEBUG') && WP_DEBUG;
    $log_enabled   = defined('WP_DEBUG_LOG') && WP_DEBUG_LOG;

    if (!file_exists($debug_log_path)) {
        return new WP_REST_Response([
            'lines'         => [],
            'file_size'     => 0,
            'debug_enabled' => $debug_enabled,
            'log_enabled'   => $log_enabled,
            'last_modified' => null,
        ], 200);
    }

    $file_size     = filesize($debug_log_path);
    $last_modified = gmdate('c', filemtime($debug_log_path));

    // Read last N lines efficiently (read from end of file)
    $lines = [];
    $fp    = fopen($debug_log_path, 'r');

    if ($fp) {
        // For files under 1MB, just read the whole thing
        if ($file_size < 1048576) {
            $content = fread($fp, $file_size);
            $all     = explode("\n", trim($content));
            $lines   = array_slice($all, -$lines_requested);
        } else {
            // For larger files, seek from the end
            $chunk_size = min($file_size, $lines_requested * 512);
            fseek($fp, -$chunk_size, SEEK_END);
            $content = fread($fp, $chunk_size);
            $all     = explode("\n", trim($content));
            // Drop first line (likely partial)
            if (count($all) > 1) {
                array_shift($all);
            }
            $lines = array_slice($all, -$lines_requested);
        }
        fclose($fp);
    }

    return new WP_REST_Response([
        'lines'         => array_values($lines),
        'file_size'     => $file_size,
        'debug_enabled' => $debug_enabled,
        'log_enabled'   => $log_enabled,
        'last_modified' => $last_modified,
    ], 200);
}

/**
 * Gather site health information.
 */
function dashboard_connector_site_health(WP_REST_Request $request): WP_REST_Response {
    global $wpdb;

    // WordPress version
    $wp_version = get_bloginfo('version');

    // PHP version
    $php_version = phpversion();

    // Server software
    $server_software = isset($_SERVER['SERVER_SOFTWARE']) ? sanitize_text_field($_SERVER['SERVER_SOFTWARE']) : 'Unknown';

    // MySQL version
    $mysql_version = $wpdb->db_version();

    // Active theme
    $theme = wp_get_theme();
    $theme_info = [
        'name'     => $theme->get('Name'),
        'version'  => $theme->get('Version'),
        'template' => $theme->get_template(),
    ];

    // Plugins
    if (!function_exists('get_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    $all_plugins    = get_plugins();
    $active_plugins = get_option('active_plugins', []);
    $update_plugins = get_site_transient('update_plugins');

    $plugins = [];
    foreach ($all_plugins as $plugin_file => $plugin_data) {
        $slug           = dirname($plugin_file);
        $update_version = null;

        if ($update_plugins && isset($update_plugins->response[$plugin_file])) {
            $update_version = $update_plugins->response[$plugin_file]->new_version;
        }

        $plugins[] = [
            'name'             => $plugin_data['Name'],
            'slug'             => $slug === '.' ? basename($plugin_file, '.php') : $slug,
            'version'          => $plugin_data['Version'],
            'active'           => in_array($plugin_file, $active_plugins, true),
            'update_available' => $update_version,
        ];
    }

    // Sort: active first, then alphabetical
    usort($plugins, function ($a, $b) {
        if ($a['active'] !== $b['active']) {
            return $b['active'] ? 1 : -1;
        }
        return strcasecmp($a['name'], $b['name']);
    });

    // Database size
    $db_size = 0;
    $tables  = $wpdb->get_results("SHOW TABLE STATUS", ARRAY_A);
    if ($tables) {
        foreach ($tables as $table) {
            $db_size += (int) $table['Data_length'] + (int) $table['Index_length'];
        }
    }

    // Autoload size
    $autoload_size = $wpdb->get_var(
        "SELECT SUM(LENGTH(option_value)) FROM {$wpdb->options} WHERE autoload = 'yes'"
    );

    // Disk usage (wp-content)
    $disk_usage = dashboard_connector_dir_size(WP_CONTENT_DIR);

    // Debug mode
    $debug_mode = defined('WP_DEBUG') && WP_DEBUG;

    return new WP_REST_Response([
        'wordpress_version'  => $wp_version,
        'php_version'        => $php_version,
        'server_software'    => $server_software,
        'mysql_version'      => $mysql_version,
        'theme'              => $theme_info,
        'plugins'            => $plugins,
        'disk_usage'         => dashboard_connector_format_bytes($disk_usage),
        'db_size'            => dashboard_connector_format_bytes((int) $db_size),
        'autoload_size'      => dashboard_connector_format_bytes((int) $autoload_size),
        'debug_mode'         => $debug_mode,
        'memory_limit'       => ini_get('memory_limit'),
        'max_execution_time' => (int) ini_get('max_execution_time'),
        'upload_max_filesize' => ini_get('upload_max_filesize'),
    ], 200);
}

/**
 * Calculate directory size recursively (max 2 levels deep for performance).
 */
function dashboard_connector_dir_size(string $dir, int $depth = 0): int {
    $size = 0;
    if ($depth > 2 || !is_dir($dir)) {
        return $size;
    }

    $iterator = new DirectoryIterator($dir);
    foreach ($iterator as $item) {
        if ($item->isDot()) continue;
        if ($item->isFile()) {
            $size += $item->getSize();
        } elseif ($item->isDir()) {
            $size += dashboard_connector_dir_size($item->getPathname(), $depth + 1);
        }
    }
    return $size;
}

/**
 * Format bytes to human-readable string.
 */
function dashboard_connector_format_bytes(int $bytes): string {
    if ($bytes >= 1073741824) {
        return number_format($bytes / 1073741824, 1) . ' GB';
    }
    if ($bytes >= 1048576) {
        return number_format($bytes / 1048576, 1) . ' MB';
    }
    if ($bytes >= 1024) {
        return number_format($bytes / 1024, 1) . ' KB';
    }
    return $bytes . ' B';
}
