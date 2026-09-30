"use client";

import { useEffect } from "react";
import Link from "next/link";

// Wraps every route below the root layout. The root layout itself is covered
// by global-error.tsx instead.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        That page didn&apos;t load. This is often temporary — trying again
        usually clears it.
      </p>

      {/* A hash, not the message: it's safe to show and matches the server log. */}
      {error.digest && (
        <p className="mt-4 font-mono text-xs text-zinc-500">
          Reference: {error.digest}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={retry}
          className="font-heading rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0066d6] dark:hover:bg-[#3aa0ff]"
        >
          Try again
        </button>
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
