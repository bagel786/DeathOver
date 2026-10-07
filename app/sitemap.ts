import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  // Update these dates when the corresponding page content changes, not on every build.
  return [
    {
      url: "https://www.deathover.xyz/",
      lastModified: "2026-10-07",
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://www.deathover.xyz/about",
      lastModified: "2026-10-07",
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://www.deathover.xyz/how-to-play",
      lastModified: "2026-10-07",
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
