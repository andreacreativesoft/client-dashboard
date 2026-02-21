import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DiskUsage } from "@/types/wordpress";

interface DiskUsageCardProps {
  disk: DiskUsage;
}

/**
 * Parse a human-readable size string (e.g. "1.2 GB", "345 MB", "12 KB") to bytes.
 */
function parseSizeToBytes(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) return 0;

  const value = parseFloat(match[1] || "0");
  const unit = (match[2] || "B").toUpperCase();

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return value * (multipliers[unit] || 1);
}

function UsageBar({ label, size, maxBytes, color }: { label: string; size: string; maxBytes: number; color: string }) {
  const bytes = parseSizeToBytes(size);
  const percentage = maxBytes > 0 ? Math.min((bytes / maxBytes) * 100, 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{size}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.max(percentage, 1)}%` }}
        />
      </div>
    </div>
  );
}

export function DiskUsageCard({ disk }: DiskUsageCardProps) {
  const totalBytes = parseSizeToBytes(disk.total_size);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
          Disk Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <UsageBar
            label="Uploads"
            size={disk.uploads_size}
            maxBytes={totalBytes}
            color="bg-blue-600"
          />
          <UsageBar
            label="Plugins"
            size={disk.plugins_size}
            maxBytes={totalBytes}
            color="bg-green-600"
          />
          <UsageBar
            label="Themes"
            size={disk.themes_size}
            maxBytes={totalBytes}
            color="bg-purple-600"
          />

          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total</span>
              <span className="text-sm font-bold">{disk.total_size}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
