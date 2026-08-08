import Link from "next/link";
import { getAllArticles } from "@/lib/content/articles";
import { GetStartedButton } from "@/components/GetStartedButton";
import { HeroCodeCard } from "@/components/HeroCodeCard";
import { ReadIcon, TrackIcon, TestIcon } from "@/components/HowItWorksIcons";

export default function Home() {
  const previewArticles = getAllArticles().slice(0, 3);

  return (
    <main className="flex flex-1 flex-col items-center bg-background">
      <section className="w-full max-w-4xl px-6 py-20 sm:py-28">
        <div className="grid items-center gap-10 sm:grid-cols-2 sm:gap-12">
          <div className="text-center sm:text-left">
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Learn iOS development, one article at a time.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400 sm:mx-0">
              Read short, focused articles on Swift and SwiftUI, track your
              progress, and test what you've learned with quizzes — synced
              across every device you use.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row sm:justify-start">
              <GetStartedButton />
              <Link
                href="/articles"
                className="font-heading flex h-12 items-center justify-center rounded-full border border-black/10 px-6 transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-[#1a1a1a]"
              >
                Browse articles
              </Link>
            </div>
          </div>
          <div className="flex justify-center sm:justify-end">
            <HeroCodeCard />
          </div>
        </div>
      </section>

      <section className="w-full max-w-4xl border-t border-black/5 px-6 py-16 dark:border-white/10">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-accent">
          How it works
        </h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          <li className="rounded-xl border border-black/10 p-5 dark:border-white/10">
            <div className="flex size-10 items-center justify-center rounded-full bg-accent/10 text-accent">
              <ReadIcon className="size-5" />
            </div>
            <p className="mt-3 font-medium">1. Read</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Work through articles on Swift, SwiftUI, and app architecture.
            </p>
          </li>
          <li className="rounded-xl border border-black/10 p-5 dark:border-white/10">
            <div className="flex size-10 items-center justify-center rounded-full bg-accent/10 text-accent">
              <TrackIcon className="size-5" />
            </div>
            <p className="mt-3 font-medium">2. Track</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Mark your progress — it's saved to your account, not just this
              browser.
            </p>
          </li>
          <li className="rounded-xl border border-black/10 p-5 dark:border-white/10">
            <div className="flex size-10 items-center justify-center rounded-full bg-accent/10 text-accent">
              <TestIcon className="size-5" />
            </div>
            <p className="mt-3 font-medium">3. Test yourself</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Take short quizzes and see your scores improve over time.
            </p>
          </li>
        </ol>
      </section>

      <section className="w-full max-w-4xl border-t border-black/5 px-6 pt-16 pb-24 dark:border-white/10">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-accent">
          Start with
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {previewArticles.map((article) => (
            <li key={article.slug}>
              <Link
                href={`/articles/${article.slug}`}
                className="block rounded-xl border border-black/10 p-4 transition-all hover:-translate-y-0.5 hover:border-black/15 hover:shadow-sm dark:border-white/10 dark:hover:border-white/20"
              >
                <p className="font-heading font-medium">{article.title}</p>
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
