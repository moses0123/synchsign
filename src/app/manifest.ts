import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SyncSign",
    short_name: "SyncSign",
    description: "Send, sign and verify documents from any device.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#f7fbff",
    theme_color: "#0ea5e9",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New envelope", url: "/app/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Sign a document myself", url: "/app/new?self=1", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Documents", url: "/app/documents", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    share_target: {
      action: "/app/new",
      method: "GET",
      params: { title: "title" },
    },
  } as MetadataRoute.Manifest;
}
