"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SpinnerIcon } from "@/components/Icons";
import type { ResetResult } from "@/lib/actions/settings";

export function ResetActionButton({
  label,
  confirmLabel,
  warning,
  successMessage,
  action,
}: {
  label: string;
  confirmLabel: string;
  warning: string;
  successMessage: string;
  action: () => Promise<ResetResult>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setConfirming(false);
        setDone(true);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  if (done) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {successMessage}
      </p>
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/80 p-4 dark:border-red-400/20 dark:bg-red-400/10">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{warning}</p>
        {error && (
          <p className="text-sm font-medium text-red-700 dark:text-red-400">
            Something went wrong: {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="font-heading inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {isPending && <SpinnerIcon className="size-4 animate-spin" />}
            {isPending ? "Resetting…" : confirmLabel}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="font-heading rounded-full px-4 py-1.5 text-sm text-zinc-600 hover:underline dark:text-zinc-400"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="font-heading inline-flex items-center gap-1.5 rounded-full border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-400/30 dark:text-red-400 dark:hover:bg-red-400/10"
    >
      {label}
    </button>
  );
}
