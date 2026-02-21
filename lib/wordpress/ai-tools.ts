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
  {
    name: "propose_changes",
    description:
      "When you have determined what changes need to be made, use this tool to propose them to the user for review. The user will see a table of proposed changes and can select which ones to apply. ALWAYS use this tool instead of directly making changes.",
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
                description: "Type: media, page, post, plugin, menu_item",
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
