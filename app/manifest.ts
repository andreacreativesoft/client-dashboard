import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Client Dashboard",
    short_name: "Dashboard",
    description: "Client dashboard for leads, analytics, and business insights",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2A5959",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-72x72.png",
        sizes: "72x72",
        type: "image/png",
      },
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
