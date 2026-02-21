# WordPress AI Dashboard — Capabilities Reference

Quick reference for what the AI assistant can and cannot do.
Read this instead of scanning the full codebase.

---

## Architecture

- **AI Route:** `app/api/wordpress/[websiteId]/ai-command/route.ts`
- **Apply Route:** `app/api/wordpress/[websiteId]/ai-command/apply/route.ts`
- **Tool Definitions:** `lib/wordpress/ai-tools.ts` (Claude tool schemas)
- **WP Client:** `lib/wordpress/wp-client.ts` (REST API client)
- **mu-plugin:** `public/mu-plugins/dashboard-connector.php` (WordPress-side custom endpoints)
- **Queue:** `lib/wordpress/queue-processor.ts` (action queue + conflict detection)

## Two-Tier Action Model

### Proposal-Based (user reviews before apply)
Content changes go through `propose_changes` → user selects → `apply/route.ts` executes.

| Resource | Fields | Apply Method |
|----------|--------|--------------|
| **media** | `alt_text` | `updateMediaItem()` |
| **page** | `title`, `content`, `excerpt`, `slug`, `status`, `meta_description` | `updatePage()` |
| **post** | `title`, `content`, `excerpt`, `slug`, `status`, `meta_description` | `updatePost()` |
| **menu_item** | `title` | `createMenuItem()` |
| **plugin** | `status` (active/inactive) | `togglePlugin()` |
| **user** | any field | `updateWpUser()` |

Meta description is handled specially — written to `meta._yoast_wpseo_metadesc`.

### Direct Actions (execute immediately, no proposal)
These run instantly when the AI calls them. The AI should confirm with the user in its message first.

| Tool | What it does |
|------|-------------|
| `update_plugin` | Updates a plugin to latest version |
| `update_theme` | Updates a theme to latest version |
| `update_core` | Updates WordPress core to latest |
| `create_wp_user` | Creates a new WP user |
| `update_wp_user` | Updates user email/name/role/password |
| `delete_wp_user` | Deletes user, reassigns content |
| `clear_cache` | Clears object cache + page cache plugins |
| `toggle_maintenance` | Enables/disables maintenance mode |

---

## All 32 Tools by Category

### Content — Read
| Tool | Description |
|------|-------------|
| `list_media` | List media library items (paginated, searchable) |
| `get_media_item` | Get single media item details |
| `list_pages` | List pages (paginated, searchable, filterable by status) |
| `get_page` | Get full page with content + meta + Yoast SEO |
| `list_posts` | List posts (paginated, searchable, filterable by status) |
| `get_post` | Get full post with content + meta + SEO |
| `list_menus` | List all navigation menus |
| `get_menu_items` | Get items in a specific menu |

### Content — Write (proposal-only, noted but not executed)
| Tool | Description |
|------|-------------|
| `update_media_alt` | Propose ALT text change |
| `update_page` | Propose page field change |
| `update_post` | Propose post field change |
| `toggle_plugin` | Propose plugin activate/deactivate |
| `create_menu_item` | Propose new menu item |

### Image Analysis
| Tool | Description |
|------|-------------|
| `analyze_image` | Uses Claude Vision to generate ALT text from image URL |

### Site Health & Diagnostics — Read
| Tool | Description |
|------|-------------|
| `get_site_health` | WP versions, theme, disk usage, config |
| `list_plugins` | All plugins with status + update availability |
| `list_themes` | All themes with status + update availability |
| `get_debug_log` | Read debug.log (parsed entries with severity) |
| `get_db_health` | Revisions, transients, autoload size, spam comments |

### Plugin/Theme/Core Updates — Direct Action
| Tool | Description |
|------|-------------|
| `update_plugin` | Update plugin to latest version |
| `update_theme` | Update theme to latest version |
| `update_core` | Update WordPress core |

### WooCommerce — Read
| Tool | Description |
|------|-------------|
| `get_wc_orders` | List orders (paginated, filterable by status) |
| `get_wc_order` | Full order details (items, billing, shipping, notes) |
| `get_wc_stats` | Store stats: revenue, orders by status, low stock |

### User Management
| Tool | Description |
|------|-------------|
| `list_wp_users` | List all WP users with roles + registration dates |
| `create_wp_user` | Create user (auto-generates password if omitted) |
| `update_wp_user` | Update user fields |
| `delete_wp_user` | Delete user + reassign content |

### Maintenance — Direct Action
| Tool | Description |
|------|-------------|
| `clear_cache` | Clear all caches (object, page, transients) |
| `toggle_maintenance` | Enable/disable maintenance mode |

### Proposals
| Tool | Description |
|------|-------------|
| `propose_changes` | Bundle all content changes for user review |

---

## What It CANNOT Do

- **Upload media** — no file upload endpoint
- **Delete media/pages/posts** — no delete tools defined
- **Edit WooCommerce orders** — read-only (no create/update/refund)
- **Create/edit products** — no product endpoints
- **Install new plugins/themes** — only update existing ones
- **Edit wp-config.php or .htaccess** — no filesystem write access
- **Run WP-CLI commands** — no shell access (unless SSH is configured separately)
- **Manage taxonomies** (categories, tags) — no tools for these
- **Manage comments** — no comment tools
- **Manage widgets/sidebars** — no tools
- **Manage redirects** — no tools
- **Multi-site operations** — single-site only
- **Schedule/cron management** — no tools
- **Edit theme files/templates** — no file editor

## Dependencies & Requirements

- **mu-plugin required for:** all custom endpoints (site-health, plugins, themes, debug-log, db-health, cache, maintenance, WooCommerce, users, plugin/theme/core updates)
- **Standard WP REST API for:** media, pages, posts, menus (no mu-plugin needed)
- **WooCommerce plugin required for:** `get_wc_orders`, `get_wc_order`, `get_wc_stats` — returns error if not installed
- **Yoast SEO for:** `meta_description` field to work (writes to `_yoast_wpseo_metadesc`)

## Action Queue & Conflict Detection

- Every applied change is logged in `wp_action_queue` table with `before_state` and `after_state`
- `checkBatchConflicts()` prevents concurrent changes to the same resource
- Failed actions are marked with `status: "failed"` and error message
- Queue entries enable rollback via stored `before_state`

## Token Usage & Cost Tracking

- Every AI command session tracks input/output tokens in `wp_ai_usage` table
- Model: `claude-sonnet-4-20250514`
- Cost formula: `(input_tokens * 3 + output_tokens * 15) / 1_000_000` USD
- Max iterations per command: 20 agentic loops

## Auth & Security

- All AI commands require admin role (`requireAdmin()`)
- WP client authenticates via Application Password + `X-Dashboard-Secret` header
- Write operations require `X-Dashboard-Action: confirm` header
- Credentials stored encrypted (AES via `TOKEN_ENCRYPTION_KEY`)
