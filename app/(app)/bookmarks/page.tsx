import Link from "next/link";
import { createClient, getClaims } from "@/lib/supabase/server";
import { getArticle } from "@/lib/content/articles";
import { ChevronRightIcon } from "@/components/Icons";

type BookmarkRow = {
  article_slug: string;
  heading_slug: string;
  heading_title: string;
  created_at: string;
};

export default async function BookmarksPage() {
  const { data: claims } = await getClaims();
  const userId = claims?.claims.sub as string;

  const supabase = await createClient();
  const { data: bookmarks } = await supabase
    .from("bookmarks")
    .select("article_slug, heading_slug, heading_title, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const groups = new Map<string, BookmarkRow[]>();
  (bookmarks as BookmarkRow[] | null)?.forEach((b) => {
    const list = groups.get(b.article_slug) ?? [];
    list.push(b);
    groups.set(b.article_slug, list);
  });

  const articleGroups = Array.from(groups.entries())
    .map(([slug, items]) => ({ slug, article: getArticle(slug), items }))
    .filter((group) => group.article);

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Bookmarks
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Sections you&apos;ve bookmarked while reading, grouped by article.
      </p>

      {articleGroups.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          No bookmarks yet. Click the bookmark icon next to any heading in an
          article to save it here.
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {articleGroups.map(({ slug, article, items }) => (
            <div
              key={slug}
              className="rounded-xl border border-black/10 p-4 dark:border-white/10"
            >
              <p className="font-heading font-medium">{article!.title}</p>
              <ul className="mt-3 flex flex-col gap-1">
                {items.map((b) => (
                  <li key={b.heading_slug}>
                    <Link
                      href={`/articles/${slug}#${b.heading_slug}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm transition-colors hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-white/5"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {b.heading_title}
                      </span>
                      <ChevronRightIcon className="size-4 shrink-0 text-zinc-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
