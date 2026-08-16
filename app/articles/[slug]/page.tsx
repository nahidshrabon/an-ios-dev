import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllArticles, getArticle } from "@/lib/content/articles";
import { getAllQuizzes } from "@/lib/content/quizzes";
import { getRoadmapSectionByArticleSlug } from "@/lib/content/roadmap";
import { createClient, getClaims } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { ReadingStatusProvider } from "@/components/ReadingStatusProvider";
import { ReadingStatusControl } from "@/components/ReadingStatusControl";
import { ArticleTitleReadBadge } from "@/components/ArticleTitleReadBadge";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ArticleBackLink } from "@/components/ArticleBackLink";
import { ChevronLeftIcon } from "@/components/Icons";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
};

export function generateStaticParams() {
  return getAllArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    return { title: "Article not found" };
  }

  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
    },
  };
}

export default async function ArticlePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { from } = await searchParams;
  const article = getArticle(slug);

  if (!article) {
    notFound();
  }

  const relatedQuiz = getAllQuizzes().find(
    (quiz) => quiz.relatedArticleSlug === article.slug
  );
  const section = getRoadmapSectionByArticleSlug(article.slug);

  // The left sidebar only replaces the top nav when arriving from the
  // roadmap — direct/listing visits keep the plain top nav instead.
  let email: string | undefined;
  if (from === "roadmap") {
    const { data, error } = await getClaims();
    email = data?.claims.email as string | undefined;
    if (!data?.claims && error) {
      const supabase = await createClient();
      const { data: userData } = await supabase.auth.getUser();
      email = userData.user?.email;
    }
  }

  const content = (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Suspense
        fallback={
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 text-base font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400"
          >
            <ChevronLeftIcon className="size-4" />
            All articles
          </Link>
        }
      >
        <ArticleBackLink />
      </Suspense>
      <ReadingStatusProvider articleSlug={article.slug}>
        <h1 className="font-heading mt-4 text-3xl font-semibold tracking-tight">
          {section ? `${section.number}. ` : ""}
          {article.title}
          <ArticleTitleReadBadge />
        </h1>
        <p className="font-article mt-2 text-zinc-600 dark:text-zinc-400">
          {article.description}
        </p>

        <div className="mt-10">
          <MarkdownContent
            content={article.content}
            articleSlug={article.slug}
          />
        </div>

        <div className="mt-12 flex flex-col overflow-hidden rounded-xl border border-black/10 sm:flex-row sm:items-center dark:border-white/10">
          <div className="flex items-center p-5 sm:flex-1">
            <ReadingStatusControl />
          </div>

          {relatedQuiz && (
            <div className="flex items-center border-t border-black/10 p-5 sm:flex-1 sm:border-t-0 sm:border-l dark:border-white/10">
              <Link
                href={`/quizzes/${relatedQuiz.id}`}
                className="font-heading inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-white"
              >
                Take a quiz
              </Link>
            </div>
          )}
        </div>
      </ReadingStatusProvider>
    </main>
  );

  if (email) {
    return (
      <AppShell email={email} wrapContent={false} showMobileBar={false}>
        {content}
      </AppShell>
    );
  }

  return content;
}
