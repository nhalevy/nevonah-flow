import type { MetadataRoute } from "next";

// Makes the app installable ("Add to Home screen") and shows it in Android's Share menu.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NEVONAH FLOW",
    short_name: "Flow",
    description: "A calm command center for Personal, Nevonah and Chabad TMR.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4f0",
    theme_color: "#f6f4f0",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  } as MetadataRoute.Manifest;
}
