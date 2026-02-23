"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAdminSetting, SETTING_KEYS } from "@/lib/actions/admin-settings";
import { wpAITools } from "@/lib/wordpress/ai-tools";

type Tab = "settings" | "authentication" | "tools";

interface AISettingsDashboardProps {
  initialSettings: Record<string, string>;
}

export function AISettingsDashboard({ initialSettings }: AISettingsDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("settings");

  const tabs: { key: Tab; label: string }[] = [
    { key: "settings", label: "Settings" },
    { key: "authentication", label: "Authentication" },
    { key: "tools", label: "Tools" },
  ];

  return (
    <div>
      {/* Tab navigation */}
      <div className="mb-6 flex gap-1 rounded-lg border border-border p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "settings" && <SettingsTab initialSettings={initialSettings} />}
      {activeTab === "authentication" && <AuthenticationTab initialSettings={initialSettings} />}
      {activeTab === "tools" && <ToolsTab initialSettings={initialSettings} />}
    </div>
  );
}

// ─── Settings Tab ────────────────────────────────────────────────────────

function SettingsTab({ initialSettings }: { initialSettings: Record<string, string> }) {
  const [aiEnabled, setAiEnabled] = useState(
    initialSettings[SETTING_KEYS.AI_ENABLED] !== "false"
  );
  const [aiModel, setAiModel] = useState(
    initialSettings[SETTING_KEYS.AI_MODEL] || "claude-sonnet-4-20250514"
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const results = await Promise.all([
      updateAdminSetting(SETTING_KEYS.AI_ENABLED, aiEnabled ? "true" : "false"),
      updateAdminSetting(SETTING_KEYS.AI_MODEL, aiModel),
    ]);

    const failed = results.find((r) => !r.success);
    if (failed) {
      setMessage(`Error: ${failed.error}`);
    } else {
      setMessage("Settings saved successfully.");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* AI Enabled toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-medium">AI Assistant</Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable the WordPress AI command interface for all websites.
              </p>
            </div>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                aiEnabled ? "bg-foreground" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                  aiEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* AI Model */}
          <div className="space-y-2">
            <Label htmlFor="ai-model">AI Model</Label>
            <select
              id="ai-model"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm md:w-auto"
            >
              <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Faster, cheaper)</option>
              <option value="claude-opus-4-6">Claude Opus 4.6 (Most capable)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              The AI model used for WordPress site analysis and commands.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
            {message && (
              <p className={`text-sm ${message.startsWith("Error") ? "text-destructive" : "text-muted-foreground"}`}>
                {message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Authentication Tab ──────────────────────────────────────────────────

function AuthenticationTab({ initialSettings }: { initialSettings: Record<string, string> }) {
  const existingKey = initialSettings[SETTING_KEYS.ANTHROPIC_API_KEY] || "";
  const [apiKey, setApiKey] = useState(existingKey);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function maskKey(key: string): string {
    if (!key) return "";
    if (key.length <= 12) return "****";
    return key.slice(0, 7) + "..." + key.slice(-4);
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const result = await updateAdminSetting(SETTING_KEYS.ANTHROPIC_API_KEY, apiKey);
    if (result.success) {
      setMessage("API key saved successfully. It is stored encrypted in the database.");
    } else {
      setMessage(`Error: ${result.error}`);
    }
    setSaving(false);
  }

  async function handleRemove() {
    setSaving(true);
    setMessage("");

    const result = await updateAdminSetting(SETTING_KEYS.ANTHROPIC_API_KEY, "");
    if (result.success) {
      setApiKey("");
      setMessage("API key removed. The system will fall back to the environment variable if set.");
    } else {
      setMessage(`Error: ${result.error}`);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Anthropic API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The API key used for the WordPress AI assistant. You can get one from{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-foreground/80"
            >
              console.anthropic.com
            </a>.
            The key is encrypted before being stored in the database.
          </p>

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-api03-..."
                  className="pr-20"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {existingKey && (
              <p className="text-xs text-muted-foreground">
                Current key: {maskKey(existingKey)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !apiKey}>
              {saving ? "Saving..." : "Save API Key"}
            </Button>
            {existingKey && (
              <Button variant="outline" onClick={handleRemove} disabled={saving}>
                Remove
              </Button>
            )}
          </div>

          {message && (
            <p className={`text-sm ${message.startsWith("Error") ? "text-destructive" : "text-muted-foreground"}`}>
              {message}
            </p>
          )}

          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <h4 className="text-sm font-medium">How it works</h4>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>1. The API key set here takes priority over the environment variable.</li>
              <li>2. If no key is set here, the system falls back to the <code className="rounded bg-muted px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code> environment variable.</li>
              <li>3. The key is encrypted using AES-256 before being stored.</li>
              <li>4. You can purchase credits at <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">console.anthropic.com/settings/billing</a>.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tools Tab ───────────────────────────────────────────────────────────

type ToolCategory = {
  label: string;
  settingKey: string;
  description: string;
  tools: string[];
};

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    label: "Read Tools",
    settingKey: SETTING_KEYS.AI_READ_TOOLS_ENABLED,
    description: "Tools for reading content, plugins, themes, and diagnostics.",
    tools: [
      "list_media", "get_media_item", "list_pages", "get_page",
      "list_posts", "get_post", "list_plugins", "list_themes",
      "list_menus", "get_menu_items", "get_site_health",
      "get_debug_log", "get_db_health", "list_wp_users", "analyze_image",
    ],
  },
  {
    label: "Write Tools",
    settingKey: SETTING_KEYS.AI_WRITE_TOOLS_ENABLED,
    description: "Tools for creating and updating content, plugins, themes, and core.",
    tools: [
      "update_media_alt", "update_page", "update_post",
      "toggle_plugin", "create_menu_item", "update_plugin",
      "update_theme", "update_core", "create_post",
      "create_wp_user", "update_wp_user", "send_password_reset",
      "clear_cache", "toggle_maintenance", "propose_changes",
    ],
  },
  {
    label: "Delete Tools",
    settingKey: SETTING_KEYS.AI_DELETE_TOOLS_ENABLED,
    description: "Tools that can delete resources (users, content).",
    tools: ["delete_wp_user"],
  },
  {
    label: "WooCommerce Tools",
    settingKey: SETTING_KEYS.AI_WOOCOMMERCE_TOOLS_ENABLED,
    description: "Tools for managing WooCommerce orders, products, and stats.",
    tools: [
      "get_wc_orders", "get_wc_order", "get_wc_stats",
      "list_wc_products", "get_wc_product", "update_wc_product", "update_wc_order",
    ],
  },
  {
    label: "User Management",
    settingKey: SETTING_KEYS.AI_USER_MANAGEMENT_ENABLED,
    description: "Tools for creating, updating, and deleting WordPress users.",
    tools: [
      "list_wp_users", "create_wp_user", "update_wp_user",
      "delete_wp_user", "send_password_reset",
    ],
  },
];

function ToolsTab({ initialSettings }: { initialSettings: Record<string, string> }) {
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const cat of TOOL_CATEGORIES) {
      initial[cat.settingKey] = initialSettings[cat.settingKey] !== "false";
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function handleToggle(key: string) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    const results = await Promise.all(
      Object.entries(toggles).map(([key, value]) =>
        updateAdminSetting(key, value ? "true" : "false")
      )
    );

    const failed = results.find((r) => !r.success);
    if (failed) {
      setMessage(`Error: ${failed.error}`);
    } else {
      setMessage("Tool settings saved successfully.");
    }
    setSaving(false);
  }

  // Build a lookup of tool name -> description from wpAITools
  const toolDescriptions: Record<string, string> = {};
  for (const tool of wpAITools) {
    if (tool.name && tool.description) {
      toolDescriptions[tool.name] = tool.description;
    }
  }

  return (
    <div className="space-y-6">
      {/* Category toggles */}
      {TOOL_CATEGORIES.map((cat) => (
        <Card key={cat.settingKey}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{cat.label}</CardTitle>
                <p className="text-sm text-muted-foreground">{cat.description}</p>
              </div>
              <button
                onClick={() => handleToggle(cat.settingKey)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  toggles[cat.settingKey] ? "bg-foreground" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                    toggles[cat.settingKey] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cat.tools.map((toolName) => (
                <div
                  key={toolName}
                  className="flex items-start gap-3 rounded-lg border border-border p-3"
                >
                  <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${toggles[cat.settingKey] ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium font-mono">{toolName}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {toolDescriptions[toolName] || "No description available."}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Tool Settings"}
        </Button>
        {message && (
          <p className={`text-sm ${message.startsWith("Error") ? "text-destructive" : "text-muted-foreground"}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
