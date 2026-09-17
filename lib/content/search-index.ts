import GithubSlugger from "github-slugger";
import { getAllArticles } from "./articles";

export interface SearchHeading {
  /** Anchor id on the rendered page — must match what rehype-slug produces. */
  slug: string;
  title: string;
  level: 2 | 3;
}

export interface SearchEntry {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  headings: SearchHeading[];
}

/** Heading text is markdown; the rendered anchor is slugged from its plain text. */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    // Underscores only mark emphasis between word boundaries — intraword ones
    // are literal, so identifiers like os_unfair_lock keep them and match the
    // anchor rehype-slug renders.
    .replace(/(?<![A-Za-z0-9_])__(.+?)__(?![A-Za-z0-9_])/g, "$1")
    .replace(/(?<![A-Za-z0-9_])_(.+?)_(?![A-Za-z0-9_])/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .trim();
}

function extractHeadings(content: string): SearchHeading[] {
  // A fresh slugger per article: github-slugger dedupes within a document by
  // appending -1, -2, and rehype-slug does the same per page. Sharing one
  // across articles would drift from the rendered anchors.
  const slugger = new GithubSlugger();
  const headings: SearchHeading[] = [];
  let inFence = false;

  for (const line of content.split("\n")) {
    if (/^\s{0,3}(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;

    const title = toPlainText(match[2]);
    if (!title) continue;

    headings.push({
      slug: slugger.slug(title),
      title,
      level: match[1].length as 2 | 3,
    });
  }

  return headings;
}

/** Article bodies never reach the browser — only this lightweight index does. */
export function buildSearchIndex(): SearchEntry[] {
  return getAllArticles().map(({ slug, title, description, tags, content }) => ({
    slug,
    title,
    description,
    tags,
    headings: extractHeadings(content),
  }));
}
