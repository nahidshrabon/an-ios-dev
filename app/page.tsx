import Link from "next/link";
import { GetStartedButton } from "@/components/GetStartedButton";
import { ReadIcon, TrackIcon, TestIcon } from "@/components/HowItWorksIcons";
import { BookmarkIcon } from "@/components/Icons";

const HOW_IT_WORKS = [
  {
    Icon: ReadIcon,
    title: "1. Read",
    description: "Work through articles on Swift, SwiftUI, and app architecture.",
  },
  {
    Icon: BookmarkIcon,
    title: "2. Bookmark",
    description: "Save key sections while reading and find them all in one place.",
  },
  {
    Icon: TrackIcon,
    title: "3. Track",
    description:
      "Mark your progress — it's saved to your account, not just this browser.",
  },
  {
    Icon: TestIcon,
    title: "4. Test yourself",
    description: "Take short quizzes and see your scores improve over time.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center bg-background">
      <section className="w-full max-w-4xl px-6 py-20 sm:py-28">
        <div className="grid grid-cols-1 items-start gap-10 sm:grid-cols-2 sm:gap-12">
          <div className="text-center sm:text-left">
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Learn iOS development, one article at a time.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600 dark:text-zinc-400 sm:mx-0">
              Read short, focused articles on Swift and SwiftUI, track your
              progress, and test what you&apos;ve learned with quizzes — synced
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

          <div>
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-accent">
              How it works
            </h2>
            <ol className="mt-4 flex flex-col gap-5">
              {HOW_IT_WORKS.map(({ Icon, title, description }) => (
                <li key={title} className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}
