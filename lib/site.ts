/**
 * Site's canonical URL, normalised regardless of how the env var was entered:
 * scheme guaranteed, no trailing slash.
 *
 * The scheme matters — sitemap <loc> entries and robots.txt Sitemap: lines are
 * only valid as absolute URLs, so a bare "example.com" here silently produces a
 * sitemap search engines reject.
 */
export function getSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").trim();
  const absolute = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return absolute.replace(/\/+$/, "");
}
