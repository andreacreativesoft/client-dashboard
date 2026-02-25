"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SiteCheck } from "@/types/database";

interface SecurityResult {
  name: string;
  status: "pass" | "fail" | "warning";
  value: string;
  details: string;
  category: "headers" | "wordpress" | "server" | "access";
}

interface SecurityCheckerProps {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  lastCheck?: SiteCheck | null;
  compact?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  headers: "Security Headers",
  wordpress: "WordPress Security",
  server: "Server Configuration",
  access: "File Access",
};

// ─── Severity levels for color-coding ──────────────────────────────────
type Severity = "critical" | "high" | "medium" | "low";

const CHECK_SEVERITY: Record<string, Severity> = {
  // Critical (red) — immediate security risk
  "HTTPS": "critical",
  "wp-config.php Exposed": "critical",
  "PHP Errors Visible": "critical",
  // High (orange) — active attack vectors
  "XML-RPC": "high",
  "Login Page Exposed": "high",
  "User Enumeration": "high",
  "REST API User Listing": "high",
  "WordPress Version Exposed": "high",
  // Medium (yellow) — missing security headers
  "HSTS": "medium",
  "X-Frame-Options": "medium",
  "X-Content-Type-Options": "medium",
  "Content-Security-Policy": "medium",
  "Referrer-Policy": "medium",
  "Permissions-Policy": "medium",
  // Low (blue-grey) — information disclosure
  "Server Header": "low",
  "X-Powered-By": "low",
  "readme.html Exposed": "low",
  "Directory Listing": "low",
};

const SEVERITY_STYLES: Record<Severity, { badge: string; label: string }> = {
  critical: { badge: "bg-red-600 text-white", label: "Critical" },
  high:     { badge: "bg-orange-500 text-white", label: "High" },
  medium:   { badge: "bg-yellow-500 text-black", label: "Medium" },
  low:      { badge: "bg-slate-400 text-white", label: "Low" },
};

function getSeverity(checkName: string): Severity {
  return CHECK_SEVERITY[checkName] || "medium";
}

function SeverityBadge({ name, value }: { name: string; value: string }) {
  const severity = getSeverity(name);
  const style = SEVERITY_STYLES[severity];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}>
      {value}
    </span>
  );
}

/** How-to-fix recommendations for each security check */
const FIX_GUIDES: Record<string, { fix: string; code?: string }> = {
  HTTPS: {
    fix: "Install an SSL certificate via your hosting panel (most hosts offer free Let's Encrypt). Then force HTTPS in WordPress: Settings → General → change both URLs to https://.",
  },
  HSTS: {
    fix: "Add the Strict-Transport-Security header to your server config. This tells browsers to always use HTTPS.",
    code: "# Apache (.htaccess)\nHeader always set Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\"\n\n# Nginx\nadd_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always;",
  },
  "X-Frame-Options": {
    fix: "Add the X-Frame-Options header to prevent your site from being loaded in iframes (clickjacking protection).",
    code: "# Apache (.htaccess)\nHeader always set X-Frame-Options \"SAMEORIGIN\"\n\n# Nginx\nadd_header X-Frame-Options \"SAMEORIGIN\" always;",
  },
  "X-Content-Type-Options": {
    fix: "Add X-Content-Type-Options to prevent MIME-type sniffing attacks.",
    code: "# Apache (.htaccess)\nHeader always set X-Content-Type-Options \"nosniff\"\n\n# Nginx\nadd_header X-Content-Type-Options \"nosniff\" always;",
  },
  "Content-Security-Policy": {
    fix: "Add a Content-Security-Policy header to control which resources can be loaded. Start with a permissive policy and tighten gradually.",
    code: "# Apache (.htaccess) — basic starter policy\nHeader always set Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;\"\n\n# Or use a plugin: Headers Security Advanced & HSTS WP",
  },
  "Referrer-Policy": {
    fix: "Add a Referrer-Policy header to control how much referrer info is sent with requests.",
    code: "# Apache (.htaccess)\nHeader always set Referrer-Policy \"strict-origin-when-cross-origin\"\n\n# Nginx\nadd_header Referrer-Policy \"strict-origin-when-cross-origin\" always;",
  },
  "Permissions-Policy": {
    fix: "Add a Permissions-Policy header to restrict browser features like camera, microphone, geolocation, etc.",
    code: "# Apache (.htaccess)\nHeader always set Permissions-Policy \"camera=(), microphone=(), geolocation=(), interest-cohort=()\"\n\n# Nginx\nadd_header Permissions-Policy \"camera=(), microphone=(), geolocation=()\" always;",
  },
  "Server Header": {
    fix: "Hide the server software version to prevent targeted attacks.",
    code: "# Apache (.htaccess)\nServerTokens Prod\nServerSignature Off\n\n# Nginx (in nginx.conf)\nserver_tokens off;",
  },
  "X-Powered-By": {
    fix: "Remove the X-Powered-By header that exposes your PHP version.",
    code: "# php.ini\nexpose_php = Off\n\n# Apache (.htaccess)\nHeader unset X-Powered-By\nHeader always unset X-Powered-By\n\n# Nginx\nfastcgi_hide_header X-Powered-By;\nproxy_hide_header X-Powered-By;",
  },
  "WordPress Version Exposed": {
    fix: "Remove the WordPress version from your site's HTML source.",
    code: "// Add to functions.php or a custom plugin:\nremove_action('wp_head', 'wp_generator');\n\n// Also remove from RSS feeds:\nadd_filter('the_generator', '__return_empty_string');\n\n// Remove ver= from scripts/styles:\nadd_filter('style_loader_src', function($src) {\n  return remove_query_arg('ver', $src);\n});\nadd_filter('script_loader_src', function($src) {\n  return remove_query_arg('ver', $src);\n});",
  },
  "XML-RPC": {
    fix: "Disable XML-RPC to prevent brute force and DDoS attacks. Not needed unless you use the WordPress mobile app or Jetpack.",
    code: "# Apache (.htaccess) — block XML-RPC\n<Files xmlrpc.php>\n  Require all denied\n</Files>\n\n// Or in functions.php:\nadd_filter('xmlrpc_enabled', '__return_false');\n\n// Or use plugin: Disable XML-RPC",
  },
  "Login Page Exposed": {
    fix: "Hide or protect the default wp-login.php URL. Use a plugin to change the login URL, or add HTTP authentication.",
    code: "# Option 1: Use plugin \"WPS Hide Login\" to change login URL\n# Option 2: Limit access by IP in .htaccess:\n<Files wp-login.php>\n  Require ip YOUR_IP_HERE\n</Files>\n\n# Option 3: Add HTTP Basic Auth:\n<Files wp-login.php>\n  AuthType Basic\n  AuthName \"Protected\"\n  AuthUserFile /path/to/.htpasswd\n  Require valid-user\n</Files>",
  },
  "User Enumeration": {
    fix: "Block author enumeration to prevent username discovery via /?author=N URLs.",
    code: "# Apache (.htaccess)\nRewriteEngine On\nRewriteCond %{QUERY_STRING} author=\\d\nRewriteRule ^ /? [L,R=301]\n\n// Or in functions.php:\nadd_action('template_redirect', function() {\n  if (is_author()) {\n    wp_redirect(home_url(), 301);\n    exit;\n  }\n});",
  },
  "REST API User Listing": {
    fix: "Restrict the WordPress REST API user endpoint to prevent public username listing.",
    code: "// Add to functions.php:\nadd_filter('rest_endpoints', function($endpoints) {\n  if (isset($endpoints['/wp/v2/users'])) {\n    unset($endpoints['/wp/v2/users']);\n  }\n  if (isset($endpoints['/wp/v2/users/(?P<id>[\\\\d]+)'])) {\n    unset($endpoints['/wp/v2/users/(?P<id>[\\\\d]+)']);\n  }\n  return $endpoints;\n});",
  },
  "wp-config.php Exposed": {
    fix: "CRITICAL: Your wp-config.php is publicly accessible, exposing database credentials. Move it above the web root or block access immediately.",
    code: "# Apache (.htaccess) — URGENT\n<Files wp-config.php>\n  Require all denied\n</Files>\n\n# Nginx\nlocation = /wp-config.php {\n  deny all;\n}\n\n# Best practice: Move wp-config.php one directory above web root",
  },
  "readme.html Exposed": {
    fix: "Delete the readme.html file from your WordPress root directory, or block access to it.",
    code: "# Delete the file:\nrm readme.html\n\n# Or block via .htaccess:\n<Files readme.html>\n  Require all denied\n</Files>",
  },
  "PHP Errors Visible": {
    fix: "Disable PHP error display in production. Errors should only be logged, not shown to visitors.",
    code: "// In wp-config.php:\ndefine('WP_DEBUG', false);\ndefine('WP_DEBUG_DISPLAY', false);\ndefine('WP_DEBUG_LOG', true); // logs to wp-content/debug.log\n\n# In php.ini:\ndisplay_errors = Off\nlog_errors = On",
  },
  "Directory Listing": {
    fix: "Disable directory listing to prevent file structure exposure.",
    code: "# Apache (.htaccess)\nOptions -Indexes\n\n# Nginx (in server block)\nautoindex off;",
  },
};

function FixTooltip({ checkName }: { checkName: string }) {
  const [open, setOpen] = useState(false);
  const guide = FIX_GUIDES[checkName];
  if (!guide) return null;

  return (
    <div className="relative inline-flex">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="How to fix"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-6 top-0 z-50 w-72 rounded-lg border border-border bg-background p-3 shadow-lg sm:w-96">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">How to fix</p>
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-xs text-foreground">{guide.fix}</p>
          {guide.code && (
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-[10px] leading-relaxed text-muted-foreground">
              {guide.code}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── .htaccess Generator ───────────────────────────────────────────────
const HTACCESS_RULES: Record<string, string> = {
  HSTS: `# HSTS — force HTTPS for all future visits
<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
</IfModule>`,
  "X-Frame-Options": `# Clickjacking protection
<IfModule mod_headers.c>
  Header always set X-Frame-Options "SAMEORIGIN"
</IfModule>`,
  "X-Content-Type-Options": `# Prevent MIME-type sniffing
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
</IfModule>`,
  "Content-Security-Policy": `# Content Security Policy (adjust as needed for your site)
<IfModule mod_headers.c>
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:;"
</IfModule>`,
  "Referrer-Policy": `# Referrer policy
<IfModule mod_headers.c>
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>`,
  "Permissions-Policy": `# Restrict browser features
<IfModule mod_headers.c>
  Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), interest-cohort=()"
</IfModule>`,
  "X-Powered-By": `# Remove PHP version exposure
<IfModule mod_headers.c>
  Header unset X-Powered-By
  Header always unset X-Powered-By
</IfModule>`,
  "Server Header": `# Minimize server info exposure
ServerSignature Off`,
  "XML-RPC": `# Block XML-RPC (brute force / DDoS vector)
<Files xmlrpc.php>
  <IfModule mod_authz_core.c>
    Require all denied
  </IfModule>
  <IfModule !mod_authz_core.c>
    Order deny,allow
    Deny from all
  </IfModule>
</Files>`,
  "wp-config.php Exposed": `# Block access to wp-config.php
<Files wp-config.php>
  <IfModule mod_authz_core.c>
    Require all denied
  </IfModule>
  <IfModule !mod_authz_core.c>
    Order deny,allow
    Deny from all
  </IfModule>
</Files>`,
  "readme.html Exposed": `# Block access to readme.html
<Files readme.html>
  <IfModule mod_authz_core.c>
    Require all denied
  </IfModule>
  <IfModule !mod_authz_core.c>
    Order deny,allow
    Deny from all
  </IfModule>
</Files>`,
  "Directory Listing": `# Disable directory listing
Options -Indexes`,
  "User Enumeration": `# Block author enumeration
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{QUERY_STRING} author=\\d
  RewriteRule ^ /? [L,R=301]
</IfModule>`,
};

function generateHtaccess(failingChecks: SecurityResult[]): string {
  const lines: string[] = [
    "# ════════════════════════════════════════════════════════════",
    "# WordPress Security Hardening Rules",
    `# Generated by Client Dashboard — ${new Date().toISOString().split("T")[0]}`,
    "# Add these rules to the TOP of your .htaccess file",
    "# (before the WordPress rewrite rules)",
    "# ════════════════════════════════════════════════════════════",
    "",
  ];

  const added = new Set<string>();

  // Sort by severity: critical first
  const sorted = [...failingChecks].sort((a, b) => {
    const order: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[getSeverity(a.name)] ?? 2) - (order[getSeverity(b.name)] ?? 2);
  });

  for (const check of sorted) {
    const rule = HTACCESS_RULES[check.name];
    if (rule && !added.has(check.name)) {
      const severity = getSeverity(check.name);
      lines.push(`# [${SEVERITY_STYLES[severity].label.toUpperCase()}] ${check.name}`);
      lines.push(rule);
      lines.push("");
      added.add(check.name);
    }
  }

  if (added.size === 0) {
    return "# No .htaccess rules needed — all checks passed!";
  }

  lines.push("# ════════════════════════════════════════════════════════════");
  lines.push("# END Security Hardening Rules");
  lines.push("# ════════════════════════════════════════════════════════════");

  return lines.join("\n");
}

function DownloadHtaccess({ results, websiteName }: { results: SecurityResult[]; websiteName: string }) {
  const failing = results.filter((r) => r.status !== "pass");
  const htaccessRulesAvailable = failing.some((r) => HTACCESS_RULES[r.name]);

  if (!htaccessRulesAvailable) return null;

  function handleDownload() {
    const content = generateHtaccess(failing);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `htaccess-security-rules-${websiteName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ruleCount = failing.filter((r) => HTACCESS_RULES[r.name]).length;

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium">Download .htaccess Security Rules</p>
          <p className="text-[10px] text-muted-foreground">
            {ruleCount} fix{ruleCount !== 1 ? "es" : ""} available — add to the top of your .htaccess file
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleDownload} className="shrink-0 gap-1.5">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download
        </Button>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 80 ? "default" : score >= 50 ? "warning" : "destructive";
  return <Badge variant={variant}>{score}/100</Badge>;
}

export function SecurityChecker({
  websiteId,
  websiteName,
  websiteUrl,
  lastCheck,
  compact = false,
}: SecurityCheckerProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    summary: { passed: number; warnings: number; failed: number; totalChecks: number };
    results: SecurityResult[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  async function runCheck() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/tools/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Security audit failed");
      } else {
        setResult({
          score: data.score,
          summary: data.summary,
          results: data.results,
        });
      }
    } catch {
      setError("Network error — could not run audit");
    } finally {
      setLoading(false);
    }
  }

  const displayResult = result;
  const displayScore = displayResult?.score ?? (lastCheck?.score || null);
  const displaySummary = displayResult?.summary || (lastCheck?.summary as {
    passed?: number;
    warnings?: number;
    failed?: number;
    totalChecks?: number;
  } | undefined);
  const displayResults = displayResult?.results || (lastCheck?.results as unknown as SecurityResult[] | undefined);

  const filteredResults = displayResults
    ? activeCategory === "all"
      ? displayResults
      : displayResults.filter((r) => r.category === activeCategory)
    : undefined;

  // Count by category
  const categoryCounts = displayResults?.reduce((acc, r) => {
    if (r.status !== "pass") {
      acc[r.category] = (acc[r.category] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  if (compact) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Security Audit</p>
          {displayScore !== null ? (
            <p className="text-xs text-muted-foreground">
              Score: {displayScore}/100 — {displaySummary?.passed || 0} passed, {displaySummary?.failed || 0} failed
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Not checked yet</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {displayScore !== null && <ScoreBadge score={displayScore} />}
          <Button size="sm" onClick={runCheck} disabled={loading}>
            {loading ? "Checking..." : "Check"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Security Audit</CardTitle>
          <p className="text-xs text-muted-foreground">{websiteName} — {websiteUrl}</p>
        </div>
        <Button onClick={runCheck} disabled={loading}>
          {loading ? "Scanning..." : "Run Security Audit"}
        </Button>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {displayScore !== null && displaySummary && (
          <div className="mb-4 flex items-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full border-4 ${
              displayScore >= 80
                ? "border-green-500"
                : displayScore >= 50
                  ? "border-yellow-500"
                  : "border-red-500"
            }`}>
              <span className="text-xl font-bold">{displayScore}</span>
            </div>
            <div className="space-y-1 text-xs">
              <p><span className="text-success">&#10003;</span> {displaySummary.passed} passed</p>
              <p><span className="text-warning">&#9888;</span> {displaySummary.warnings} warnings</p>
              <p><span className="text-destructive">&#10007;</span> {displaySummary.failed} critical</p>
            </div>
          </div>
        )}

        {/* .htaccess download */}
        {displayResults && displayResults.length > 0 && displayResults.some((r) => r.status !== "pass") && (
          <div className="mb-3">
            <DownloadHtaccess results={displayResults} websiteName={websiteName} />
          </div>
        )}

        {/* Toggle to show/hide details */}
        {displayResults && displayResults.length > 0 && !showDetails && (
          <button
            onClick={() => setShowDetails(true)}
            className="w-full rounded-lg border border-border p-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            {displayResults.length} checks completed — click to view details
          </button>
        )}

        {displayResults && displayResults.length > 0 && showDetails && (
          <div className="space-y-3">
            {/* Category filter */}
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    activeCategory === "all" ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  All ({displayResults.length})
                </button>
                {(["headers", "wordpress", "server", "access"] as const).map((cat) => {
                  const count = displayResults.filter((r) => r.category === cat).length;
                  const issues = categoryCounts?.[cat] || 0;
                  if (count === 0) return null;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                        activeCategory === cat ? "bg-foreground text-background" : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {CATEGORY_LABELS[cat]} {issues > 0 && <span className="text-destructive">({issues})</span>}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
              >
                Hide details
              </button>
            </div>

            {/* Toggle pass/fail filter */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {expanded ? "Show issues only" : "Show all checks"}
            </button>

            {/* Results list */}
            <div className="space-y-1.5">
              {(expanded ? filteredResults : filteredResults?.filter((r) => r.status !== "pass"))?.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded border border-border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium">{item.name}</p>
                      <span className="text-[9px] text-muted-foreground uppercase">{item.category}</span>
                      {item.status !== "pass" && <FixTooltip checkName={item.name} />}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.details}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {item.status === "pass" ? (
                      <Badge variant="success">{item.value}</Badge>
                    ) : (
                      <SeverityBadge name={item.name} value={item.value} />
                    )}
                    {item.status !== "pass" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={runCheck}
                        disabled={loading}
                        className="h-6 px-2 text-[10px]"
                        title="Re-run security audit"
                      >
                        {loading ? "..." : "Retest"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!expanded && filteredResults?.every((r) => r.status === "pass") && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  All checks passed. Click &quot;Show all checks&quot; to see all results.
                </p>
              )}
            </div>
          </div>
        )}

        {!displayResults && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            Click &quot;Run Security Audit&quot; to check security headers, WordPress hardening, exposed files, and more.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
