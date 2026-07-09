import type { NextConfig } from "next";

// La CSP doit autoriser l'API Supabase réellement utilisée (REST + Auth + Realtime).
// On dérive l'origine de NEXT_PUBLIC_SUPABASE_URL pour couvrir aussi bien le
// Supabase local (http://127.0.0.1:54321) que le cloud (https://*.supabase.co).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
const supabaseWsOrigin = supabaseOrigin.replace(/^http/, "ws"); // http→ws, https→wss
const isDev = process.env.NODE_ENV !== "production";

const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    supabaseOrigin,
    supabaseWsOrigin,
    // Filet de sécurité en dev : Supabase local + proxy sur des ports variables.
    ...(isDev
        ? ["http://127.0.0.1:*", "http://localhost:*", "ws://127.0.0.1:*", "ws://localhost:*"]
        : []),
]
    .filter(Boolean)
    .join(" ");

const nextConfig: NextConfig = {
    // Minimal self-contained server bundle for Docker (see Dockerfile).
    output: "standalone",

    serverExternalPackages: ["ssh2", "node-ssh"],

    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "*.supabase.co",
                pathname: "/storage/v1/object/public/**",
            },
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
            },
        ],
    },

    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    {
                        key: "Content-Security-Policy",
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' data: https:",
                            "font-src 'self' data:",
                            `connect-src ${connectSrc}`,
                            "frame-ancestors 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                        ].join("; "),
                    },
                    {
                        key: "Permissions-Policy",
                        value: "camera=(), microphone=(), geolocation=()",
                    },
                ],
            },
            {
                source: "/sw.js",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "no-cache, no-store, must-revalidate",
                    },
                    {
                        key: "Content-Type",
                        value: "application/javascript; charset=utf-8",
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
