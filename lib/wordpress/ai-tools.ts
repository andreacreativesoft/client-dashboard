/**
 * Claude tool definitions for WordPress AI command interface.
 * These tools let Claude inspect and propose changes to a WordPress site.
 */

import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const wpAITools: Tool[] = [
  {
    name: "list_media",
    description:
      "List media items (images, files) from the WordPress media library. Returns id, title, alt_text, source_url, dimensions, and mime_type. Use to find images that need ALT text or other updates.",
    input_schema: {
      type: "object" as const,
      properties: {
        per_page: { type: "number", description: "Number of items (max 100)", default: 50 },
        page: { type: "number", description: "Page number", default: 1 },
        search: { type: "string", description: "Search term to filter" },
      },
      required: [],
    },
  },
  {
    name: "get_media_item",
    description:
      "Get details of a single media item by ID, including full URL for image analysis.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "The media item ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_media_alt",
    description: "Update the ALT text of a media item. Used for accessibility improvements.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "The media item ID" },
        alt_text: { type: "string", description: "The new ALT text" },
      },
      required: ["id", "alt_text"],
    },
  },
  {
    name: "list_pages",
    description: "List all pages on the WordPress site. Returns id, title, slug, status, excerpt.",
    input_schema: {
      type: "object" as const,
      properties: {
        per_page: { type: "number", default: 100 },
        page: { type: "number", default: 1 },
        search: { type: "string" },
        status: { type: "string", default: "publish" },
      },
      required: [],
    },
  },
  {
    name: "get_page",
    description:
      "Get full details of a single page including content, meta, and Yoast SEO data.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "The page ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_page",
    description:
      "Update a page. Can modify title, content, excerpt, slug, status, or meta fields.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
        title: { type: "string" },
        content: { type: "string" },
        excerpt: { type: "string" },
        slug: { type: "string" },
        status: { type: "string" },
        meta: {
          type: "object",
          description: "Meta fields (e.g., _yoast_wpseo_metadesc)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "list_posts",
    description: "List all blog posts. Returns id, title, slug, status, excerpt.",
    input_schema: {
      type: "object" as const,
      properties: {
        per_page: { type: "number", default: 100 },
        page: { type: "number", default: 1 },
        search: { type: "string" },
        status: { type: "string", default: "publish" },
      },
      required: [],
    },
  },
  {
    name: "get_post",
    description:
      "Get full details of a single blog post including content, meta, and SEO data.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_post",
    description:
      "Update a blog post. Can modify title, content, excerpt, slug, status, or meta.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number" },
        title: { type: "string" },
        content: { type: "string" },
        excerpt: { type: "string" },
        slug: { type: "string" },
        status: { type: "string" },
        meta: { type: "object" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_site_health",
    description:
      "Get WordPress site health: versions, theme, disk usage, configuration.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_plugins",
    description:
      "List all installed plugins with activation status and update availability.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "toggle_plugin",
    description: "Activate or deactivate a WordPress plugin.",
    input_schema: {
      type: "object" as const,
      properties: {
        plugin: {
          type: "string",
          description: 'Plugin file path (e.g., "akismet/akismet.php")',
        },
        activate: { type: "boolean" },
      },
      required: ["plugin", "activate"],
    },
  },
  {
    name: "analyze_image",
    description:
      "Analyze an image using Claude Vision to generate descriptive ALT text.",
    input_schema: {
      type: "object" as const,
      properties: {
        image_url: { type: "string", description: "Full URL to the image" },
        context: {
          type: "string",
          description: "Context about where this image appears",
        },
      },
      required: ["image_url"],
    },
  },
  {
    name: "list_menus",
    description: "List all navigation menus.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_menu_items",
    description: "Get all items in a specific navigation menu.",
    input_schema: {
      type: "object" as const,
      properties: {
        menu_id: { type: "number" },
      },
      required: ["menu_id"],
    },
  },
  {
    name: "create_menu_item",
    description: "Add a new item to a navigation menu.",
    input_schema: {
      type: "object" as const,
      properties: {
        menu_id: { type: "number" },
        title: { type: "string" },
        url: { type: "string" },
        object_id: {
          type: "number",
          description: "Page/post ID for content items",
        },
        object: {
          type: "string",
          description: "Object type: page, post, category",
        },
        type: {
          type: "string",
          description: "Item type: custom, post_type, taxonomy",
        },
        parent: {
          type: "number",
          description: "Parent menu item ID for sub-items",
        },
      },
      required: ["menu_id", "title"],
    },
  },
  // ─── Plugin/Theme/Core Updates ──────────────────────────────────

  {
    name: "update_plugin",
    description:
      "Update a WordPress plugin to its latest version. Requires the mu-plugin. Use list_plugins first to see which plugins have updates available.",
    input_schema: {
      type: "object" as const,
      properties: {
        plugin: {
          type: "string",
          description: 'Plugin file path (e.g., "akismet/akismet.php"). Get this from list_plugins.',
        },
      },
      required: ["plugin"],
    },
  },
  {
    name: "list_themes",
    description:
      "List all installed themes with activation status, version, and update availability.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "update_theme",
    description:
      "Update a WordPress theme to its latest version. Use list_themes first to check for updates.",
    input_schema: {
      type: "object" as const,
      properties: {
        theme: {
          type: "string",
          description: "Theme slug (directory name)",
        },
      },
      required: ["theme"],
    },
  },
  {
    name: "update_core",
    description:
      "Update WordPress core to the latest version. Use get_site_health first to check current version.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },

  // ─── WooCommerce ─────────────────────────────────────────────────

  {
    name: "get_wc_orders",
    description:
      "List WooCommerce orders. Returns order ID, status, total, customer, items. Requires WooCommerce to be active.",
    input_schema: {
      type: "object" as const,
      properties: {
        per_page: { type: "number", description: "Orders per page (max 100)", default: 10 },
        page: { type: "number", description: "Page number", default: 1 },
        status: {
          type: "string",
          description: "Filter by status: processing, on-hold, completed, cancelled, refunded, failed, or any",
        },
      },
      required: [],
    },
  },
  {
    name: "get_wc_order",
    description:
      "Get full details of a single WooCommerce order including items, billing, shipping, and order notes.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "The order ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_wc_stats",
    description:
      "Get WooCommerce store stats: today/month orders and revenue, orders by status, low stock products, total products.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_wc_products",
    description:
      "List WooCommerce products with name, price, SKU, stock, and image. Use to find products before updating them.",
    input_schema: {
      type: "object" as const,
      properties: {
        per_page: { type: "number", description: "Products per page (max 100)", default: 20 },
        page: { type: "number", description: "Page number", default: 1 },
        search: { type: "string", description: "Search by product name" },
        status: { type: "string", description: "Filter by status: publish, draft, pending, private", default: "publish" },
      },
      required: [],
    },
  },
  {
    name: "get_wc_product",
    description:
      "Get full details of a single WooCommerce product including description, prices, stock, images, categories, and tags.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "number", description: "The product ID" },
      },
      required: ["id"],
    },
  },
  {
    name: "update_wc_product",
    description:
      "Update a WooCommerce product. Can change name, price, sale price, description, SKU, stock, status, or image. For image changes, provide an attachment ID from the media library.",
    input_schema: {
      type: "object" as const,
      properties: {
        product_id: { type: "number", description: "The product ID to update" },
        name: { type: "string", description: "Product name/title" },
        regular_price: { type: "string", description: "Regular price (e.g. '29.99')" },
        sale_price: { type: "string", description: "Sale price (empty string to remove sale)" },
        description: { type: "string", description: "Full product description (HTML)" },
        short_description: { type: "string", description: "Short description (HTML)" },
        sku: { type: "string", description: "Product SKU" },
        status: { type: "string", description: "Product status: publish, draft, pending, private" },
        stock_quantity: { type: "number", description: "Stock quantity" },
        stock_status: { type: "string", description: "Stock status: instock, outofstock, onbackorder" },
        image_id: { type: "number", description: "Media library attachment ID for product image" },
      },
      required: ["product_id"],
    },
  },

  // ─── User Management ─────────────────────────────────────────────

  {
    name: "list_wp_users",
    description:
      "List all WordPress users with their roles, emails, and registration dates.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "create_wp_user",
    description:
      "Create a new WordPress user. Generates a secure password if not provided.",
    input_schema: {
      type: "object" as const,
      properties: {
        username: { type: "string", description: "Login username" },
        email: { type: "string", description: "Email address" },
        role: {
          type: "string",
          description: "WordPress role: administrator, editor, author, contributor, subscriber, shop_manager, customer",
          default: "subscriber",
        },
        password: { type: "string", description: "Password (auto-generated if omitted)" },
        first_name: { type: "string" },
        last_name: { type: "string" },
      },
      required: ["username", "email"],
    },
  },
  {
    name: "update_wp_user",
    description:
      "Update an existing WordPress user's email, name, role, or password.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: { type: "number", description: "The user ID" },
        email: { type: "string" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        display_name: { type: "string" },
        role: { type: "string" },
        password: { type: "string" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "delete_wp_user",
    description:
      "Delete a WordPress user and reassign their content to another user.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: { type: "number", description: "User ID to delete" },
        reassign: { type: "number", description: "User ID to reassign content to (default: 1 = admin)" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "send_password_reset",
    description:
      "Send a password reset email to a WordPress user. Uses WordPress built-in password reset system. The user will receive an email with a link to set a new password.",
    input_schema: {
      type: "object" as const,
      properties: {
        user_id: { type: "number", description: "The user ID to send the reset email to" },
      },
      required: ["user_id"],
    },
  },

  // ─── Debug & Maintenance ─────────────────────────────────────────

  {
    name: "get_debug_log",
    description:
      "Read the WordPress debug.log file. Returns parsed entries with severity levels (fatal, warning, notice, deprecated). Use to diagnose site issues.",
    input_schema: {
      type: "object" as const,
      properties: {
        lines: {
          type: "number",
          description: "Number of recent log lines to fetch (max 2000)",
          default: 200,
        },
      },
      required: [],
    },
  },
  {
    name: "get_db_health",
    description:
      "Get WordPress database health: revisions count, transients, autoload size, spam comments. Use to diagnose performance issues.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "clear_cache",
    description:
      "Clear all WordPress caches: object cache, page cache plugins (WP Rocket, W3TC, LiteSpeed, etc.), and transients.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "toggle_maintenance",
    description: "Enable or disable WordPress maintenance mode.",
    input_schema: {
      type: "object" as const,
      properties: {
        enable: { type: "boolean", description: "true to enable, false to disable" },
      },
      required: ["enable"],
    },
  },

  // ─── Proposals ───────────────────────────────────────────────────

  {
    name: "propose_changes",
    description:
      "When you have determined what changes need to be made, use this tool to propose them to the user for review. The user will see a table of proposed changes and can select which ones to apply. ALWAYS use this tool for content changes (pages, posts, media ALT text). Direct action tools (update_plugin, update_theme, update_core, create_wp_user, delete_wp_user, clear_cache, toggle_maintenance) execute immediately without proposals.",
    input_schema: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description: "Summary of analysis and proposed changes",
        },
        changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              resource_type: {
                type: "string",
                description: "Type: media, page, post, plugin, theme, menu_item, user",
              },
              resource_id: { type: "string", description: "Resource ID" },
              resource_title: {
                type: "string",
                description: "Human-readable title",
              },
              field: { type: "string", description: "Field being changed" },
              current_value: {
                type: "string",
                description: "Current value (empty if none)",
              },
              proposed_value: {
                type: "string",
                description: "Proposed new value",
              },
            },
            required: [
              "resource_type",
              "resource_id",
              "resource_title",
              "field",
              "current_value",
              "proposed_value",
            ],
          },
        },
      },
      required: ["description", "changes"],
    },
  },
];
