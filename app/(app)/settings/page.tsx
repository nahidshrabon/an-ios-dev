import { getClaims } from "@/lib/supabase/server";
import { SettingsIcon } from "@/components/Icons";
import { PageHeader } from "@/components/PageHeader";
import { ResetActionButton } from "@/components/ResetActionButton";
import {
  resetAllProgress,
  resetRoadmapProgress,
  resetQuizHistory,
  resetBookmarks,
} from "@/lib/actions/settings";

const RESET_ALL = {
  label: "Reset everything",
  confirmLabel: "Yes, reset everything",
  warning:
    "This will permanently clear your roadmap checkmarks, article read status, quiz history, and bookmarks. This can't be undone.",
  successMessage: "All of your progress has been reset.",
  action: resetAllProgress,
} as const;

const RESET_SECTIONS = [
  {
    key: "roadmap",
    label: "Reset roadmap",
    confirmLabel: "Yes, reset roadmap",
    warning:
      "This will permanently uncheck your roadmap sections and mark every article as unread again. This can't be undone.",
    successMessage: "Your roadmap checkmarks have been reset.",
    action: resetRoadmapProgress,
  },
  {
    key: "quizzes",
    label: "Reset quizzes",
    confirmLabel: "Yes, reset quizzes",
    warning:
      "This will permanently delete your quiz attempt history. This can't be undone.",
    successMessage: "Your quiz history has been reset.",
    action: resetQuizHistory,
  },
  {
    key: "bookmarks",
    label: "Reset bookmarks",
    confirmLabel: "Yes, reset bookmarks",
    warning: "This will permanently delete all of your bookmarks. This can't be undone.",
    successMessage: "Your bookmarks have been reset.",
    action: resetBookmarks,
  },
] as const;

export default async function SettingsPage() {
  const { data: claims } = await getClaims();
  const email = claims?.claims.email as string | undefined;

  return (
    <div>
      <PageHeader icon={SettingsIcon} title="Settings" />

      {email && (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as {email}
        </p>
      )}

      <h2 className="font-heading mt-8 text-base font-medium">
        Reset progress
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Reset everything at once, or just one type of progress. Your account
        stays intact.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="flex flex-col justify-center gap-2 rounded-xl border border-red-200/70 bg-red-50/80 p-4 sm:flex-1 dark:border-red-400/15 dark:bg-red-400/10">
          <ResetActionButton
            label={RESET_ALL.label}
            confirmLabel={RESET_ALL.confirmLabel}
            warning={RESET_ALL.warning}
            successMessage={RESET_ALL.successMessage}
            action={RESET_ALL.action}
          />
        </div>

        {RESET_SECTIONS.map((section) => (
          <div
            key={section.key}
            className="flex flex-col justify-center gap-2 rounded-xl border border-red-200/70 bg-red-50/80 p-4 sm:flex-1 dark:border-red-400/15 dark:bg-red-400/10"
          >
            <ResetActionButton
              label={section.label}
              confirmLabel={section.confirmLabel}
              warning={section.warning}
              successMessage={section.successMessage}
              action={section.action}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
