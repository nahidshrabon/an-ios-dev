import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <p className="font-heading text-sm font-medium text-accent">404</p>
      <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        That link may be out of date, or the page may have moved. Search from
        the bar in the header, or start from one of these.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/articles"
          className="font-heading rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0066d6] dark:hover:bg-[#3aa0ff]"
        >
          Browse articles
        </Link>
        <Link
          href="/"
          className="font-heading rounded-full border border-black/10 px-4 py-2 text-sm transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-white/5"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
