import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SiteHealthData } from "@/types/wordpress";

interface ServerInfoCardProps {
  health: SiteHealthData;
}

function VersionBadge({ version, minVersion, label }: { version: string; minVersion?: string; label: string }) {
  const isOutdated = minVersion ? compareVersions(version, minVersion) < 0 : false;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium">{version}</span>
        {isOutdated && (
          <Badge className="bg-yellow-600 text-[10px] text-white hover:bg-yellow-700">
            Outdated
          </Badge>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, value, good }: { label: string; value: string | boolean; good?: boolean }) {
  const display = typeof value === "boolean" ? (value ? "Enabled" : "Disabled") : value;
  const isGood = good !== undefined ? good : (typeof value === "boolean" ? value : true);

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        {typeof value === "boolean" ? (
          <span className={`flex items-center gap-1 text-sm font-medium ${isGood ? "text-green-600" : "text-destructive"}`}>
            {isGood ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            )}
            {display}
          </span>
        ) : (
          <span className="text-sm font-medium">{display}</span>
        )}
      </div>
    </div>
  );
}

export function ServerInfoCard({ health }: ServerInfoCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3m-19.5 0a4.5 4.5 0 0 1 .9-2.7L5.737 5.1a3.375 3.375 0 0 1 2.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 0 1 .9 2.7m0 0a3 3 0 0 1-3 3m0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm-3 6h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Z" />
          </svg>
          Server Info
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Left column */}
          <div className="space-y-3">
            <VersionBadge label="WordPress" version={health.wp_version} minVersion="6.4" />
            <VersionBadge label="PHP" version={health.php_version} minVersion="8.0" />
            <VersionBadge label="MySQL" version={health.mysql_version} minVersion="5.7" />
            <StatusRow label="Server" value={health.server_software} />
            <StatusRow label="Memory Limit" value={health.memory_limit} />
          </div>

          {/* Right column */}
          <div className="space-y-3">
            <StatusRow label="Max Upload" value={health.max_upload_size} />
            <StatusRow label="SSL" value={health.ssl_enabled} good={health.ssl_enabled} />
            <StatusRow label="WP-Cron" value={health.wp_cron_enabled} good={health.wp_cron_enabled} />
            <StatusRow label="Debug Mode" value={health.debug_mode} good={!health.debug_mode} />
            <StatusRow label="Multisite" value={health.is_multisite} good={undefined} />
          </div>
        </div>

        {/* Extra info row */}
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <StatusRow label="Permalink Structure" value={health.permalink_structure || "Plain"} />
          <StatusRow label="Timezone" value={health.timezone || "UTC"} />
          <StatusRow label="Database Size" value={health.db_size} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compare two semver-like version strings.
 * Returns -1 if a < b, 0 if a == b, 1 if a > b.
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map((n) => parseInt(n, 10) || 0);
  const partsB = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const va = partsA[i] || 0;
    const vb = partsB[i] || 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}
