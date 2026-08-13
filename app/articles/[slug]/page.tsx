import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllArticles, getArticle } from "@/lib/content/articles";
import { getAllQuizzes } from "@/lib/content/quizzes";
import { getRoadmapSectionByArticleSlug } from "@/lib/content/roadmap";
import { ReadingStatusControl } from "@/components/ReadingStatusControl";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ArticleBackLink } from "@/components/ArticleBackLink";
import { ArrowLeftIcon } from "@/components/Icons";

type Props = {
  params: Promise<{ slug: string }>;
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

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);

  if (!article) {
    notFound();
  }

  const relatedQuiz = getAllQuizzes().find(
    (quiz) => quiz.relatedArticleSlug === article.slug
  );
  const section = getRoadmapSectionByArticleSlug(article.slug);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Suspense
        fallback={
          <Link
            href="/articles"
            className="inline-flex items-center gap-1.5 text-base font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400"
          >
            <ArrowLeftIcon className="size-4" />
            All articles
          </Link>
        }
      >
        <ArticleBackLink />
      </Suspense>
      <h1 className="font-heading mt-4 text-3xl font-semibold tracking-tight">
        {section ? `${section.number}. ` : ""}
        {article.title}
      </h1>
      <p className="font-article mt-2 text-zinc-600 dark:text-zinc-400">
        {article.description}
      </p>

      <div className="mt-10">
        <MarkdownContent content={article.content} />
      </div>

      <ReadingStatusControl slug={article.slug} />

      {relatedQuiz && (
        <div className="mt-4 rounded-xl border border-black/10 p-5 dark:border-white/10">
          <p className="font-heading font-medium">{relatedQuiz.title}</p>
          <p className="font-article mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {relatedQuiz.description}
          </p>
          <Link
            href={`/quizzes/${relatedQuiz.id}`}
            className="mt-3 inline-block text-sm underline"
          >
            Take this quiz
          </Link>
        </div>
      )}
    </main>
  );
}
