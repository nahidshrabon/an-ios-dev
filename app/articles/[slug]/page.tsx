import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAllArticles, getArticle } from "@/lib/content/articles";
import { getAllQuizzes } from "@/lib/content/quizzes";
import { ReadingStatusControl } from "@/components/ReadingStatusControl";

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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <Link
        href="/articles"
        className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← All articles
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        {article.title}
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        {article.description}
      </p>

      <div className="mt-10 flex flex-col gap-8">
        {article.sections.map((section) => (
          <section key={section.id} id={section.id}>
            <h2 className="text-xl font-medium">{section.heading}</h2>
            <p className="mt-2 leading-7 text-zinc-700 dark:text-zinc-300">
              {section.body}
            </p>
          </section>
        ))}
      </div>

      <ReadingStatusControl slug={article.slug} />

      {relatedQuiz && (
        <div className="mt-4 rounded-xl border border-black/10 p-5 dark:border-white/10">
          <p className="font-medium">{relatedQuiz.title}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {relatedQuiz.description}
          </p>
          <Link
            href="/login"
            className="mt-3 inline-block text-sm underline"
          >
            Log in to take this quiz
          </Link>
        </div>
      )}
    </main>
  );
}
