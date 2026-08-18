import Link from "next/link";
import { createClient, getClaims } from "@/lib/supabase/server";
import { getArticle } from "@/lib/content/articles";
import { BookmarkIcon, ChevronRightIcon, InfoIcon } from "@/components/Icons";
import { PageHeader } from "@/components/PageHeader";

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
      <PageHeader icon={BookmarkIcon} title="Bookmarks" />
      <p className="mt-2 flex max-w-2xl items-start gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
        <InfoIcon className="mt-0.5 size-4 shrink-0" />
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
              className="rounded-xl border border-blue-200/70 bg-blue-50/80 p-4 dark:border-blue-400/15 dark:bg-blue-400/10"
            >
              <p className="font-heading font-medium text-blue-700 dark:text-blue-400">
                {article!.title}
              </p>
              <ul className="mt-3 flex flex-col gap-1">
                {items.map((b) => (
                  <li key={b.heading_slug}>
                    <Link
                      href={`/articles/${slug}#${b.heading_slug}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-blue-200/50 bg-white/70 px-3 py-2 text-sm transition-colors hover:bg-blue-100/60 dark:border-blue-400/10 dark:bg-white/5 dark:hover:bg-blue-400/15"
                    >
                      <span className="font-heading min-w-0 flex-1 truncate">
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
