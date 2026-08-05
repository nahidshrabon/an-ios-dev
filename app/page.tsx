import Link from "next/link";
import { getAllArticles } from "@/lib/content/articles";
import { GetStartedButton } from "@/components/GetStartedButton";

export default function Home() {
  const previewArticles = getAllArticles().slice(0, 3);

  return (
    <main className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black">
      <section className="w-full max-w-3xl px-6 py-24 text-center sm:text-left">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Learn iOS development, one article at a time.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400 sm:mx-0 mx-auto">
          Read short, focused articles on Swift and SwiftUI, track your
          progress, and test what you've learned with quizzes — synced
          across every device you use.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-start justify-center">
          <GetStartedButton />
          <Link
            href="/articles"
            className="flex h-12 items-center justify-center rounded-full border border-black/10 px-6 transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-[#1a1a1a]"
          >
            Browse articles
          </Link>
        </div>
      </section>

      <section className="w-full max-w-3xl px-6 pb-16">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          How it works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          <li className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <p className="font-medium">1. Read</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Work through articles on Swift, SwiftUI, and app architecture.
            </p>
          </li>
          <li className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <p className="font-medium">2. Track</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Mark your progress — it's saved to your account, not just this
              browser.
            </p>
          </li>
          <li className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <p className="font-medium">3. Test yourself</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Take short quizzes and see your scores improve over time.
            </p>
          </li>
        </ol>
      </section>

      <section className="w-full max-w-3xl px-6 pb-24">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Start with
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {previewArticles.map((article) => (
            <li key={article.slug}>
              <Link
                href={`/articles/${article.slug}`}
                className="block rounded-xl border border-black/10 p-4 transition-colors hover:bg-black/[.03] dark:border-white/10 dark:hover:bg-[#161616]"
              >
                <p className="font-medium">{article.title}</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {article.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
