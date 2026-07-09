import { cn } from "@/lib/utils";

const SIZES = {
    xs: { px: 24, text: "text-[10px]" },
    sm: { px: 32, text: "text-xs" },
    md: { px: 36, text: "text-sm" },
    lg: { px: 40, text: "text-sm" },
    xl: { px: 48, text: "text-base" },
    "2xl": { px: 64, text: "text-lg" },
} as const;

export type AvatarSize = keyof typeof SIZES;

/** First letter of the first and last name parts ("Mathias Billot" → "MB"). */
function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0] ?? "";
    if (!first) return "?";
    const firstLetter = first[0] ?? "";
    const lastLetter = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (first[1] ?? "");
    return (firstLetter + lastLetter).toUpperCase();
}

interface AvatarProps {
    /** Full name — drives the initials fallback and the image alt text. */
    name: string;
    /** Avatar image URL; falls back to initials when absent. */
    src?: string | null;
    size?: AvatarSize;
    className?: string;
}

/**
 * Unified avatar used across the app: shows the user's image when available,
 * otherwise their initials on a brand-tinted circle. One look everywhere.
 */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
    const { px, text } = SIZES[size];

    if (src) {
        // Plain <img>: avatar URLs include the local Supabase storage host
        // (127.0.0.1) which isn't allowlisted for next/image — and these are tiny.
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={src}
                alt={name}
                width={px}
                height={px}
                style={{ width: px, height: px }}
                className={cn("shrink-0 rounded-full object-cover", className)}
            />
        );
    }

    return (
        <span
            aria-label={name}
            style={{ width: px, height: px }}
            className={cn(
                "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-brand-soft font-bold text-brand",
                text,
                className,
            )}>
            {initials(name)}
        </span>
    );
}
