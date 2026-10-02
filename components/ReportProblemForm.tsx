"use client";

import { useActionState, useState } from "react";
import { submitReport } from "@/lib/actions/reports";
import {
  MESSAGE_MAX,
  MESSAGE_MIN,
  PAGE_URL_MAX,
  REPORT_CATEGORIES,
} from "@/lib/reports";
import { CheckIcon, SpinnerIcon } from "@/components/Icons";

const FIELD =
  "w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm transition-colors outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 dark:border-white/15";

/**
 * useActionState has no reset, so "Send another" remounts the form under a
 * new key to start from a clean state.
 */
export function ReportProblemForm({ initialPage }: { initialPage?: string }) {
  const [formKey, setFormKey] = useState(0);
  return (
    <Form
      key={formKey}
      initialPage={formKey === 0 ? initialPage : undefined}
      onReset={() => setFormKey((k) => k + 1)}
    />
  );
}

function Form({
  initialPage,
  onReset,
}: {
  initialPage?: string;
  onReset: () => void;
}) {
  const [state, formAction, pending] = useActionState(submitReport, null);
  // Controlled because React resets uncontrolled fields after every form
  // action, which would wipe the user's input when validation fails.
  const [category, setCategory] = useState("bug");
  const [pageUrl, setPageUrl] = useState(initialPage ?? "");
  const [message, setMessage] = useState("");

  if (state?.ok) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-black/10 p-6 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <CheckIcon className="size-5" />
          </div>
          <div>
            <h2 className="font-heading font-medium">
              Thanks — I&apos;ll take a look
            </h2>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Your report has been sent.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="font-heading inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-sm transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-[#1a1a1a]"
        >
          Send another
        </button>
      </div>
    );
  }

  const length = message.trim().length;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-2xl border border-black/10 p-6 dark:border-white/10"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="report-category"
          className="font-heading text-sm font-medium"
        >
          What kind of problem?
        </label>
        <select
          id="report-category"
          name="category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={FIELD}
        >
          {REPORT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="report-page"
          className="font-heading text-sm font-medium"
        >
          Where did it happen?{" "}
          <span className="font-sans font-normal text-zinc-500">
            (optional)
          </span>
        </label>
        <input
          id="report-page"
          name="page_url"
          type="text"
          maxLength={PAGE_URL_MAX}
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          placeholder="e.g. the SwiftUI basics article, or a page link"
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="report-message"
          className="font-heading text-sm font-medium"
        >
          What went wrong?
        </label>
        <textarea
          id="report-message"
          name="message"
          required
          minLength={MESSAGE_MIN}
          maxLength={MESSAGE_MAX}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What did you expect, and what happened instead?"
          className={`${FIELD} resize-y`}
        />
        <p className="self-end text-xs text-zinc-500">
          {length}/{MESSAGE_MAX}
        </p>
      </div>

      {state && !state.ok && (
        <p
          role="alert"
          className="text-sm font-medium text-red-700 dark:text-red-400"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="font-heading inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-[#0066d6] disabled:opacity-60 dark:hover:bg-[#3aa0ff]"
      >
        {pending && <SpinnerIcon className="size-4 animate-spin" />}
        {pending ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}
