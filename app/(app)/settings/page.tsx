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
  title: "Reset all progress",
  description:
    "Clears roadmap checkmarks, article read status, quiz history, and bookmarks in one go.",
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
    title: "Roadmap checkmarks",
    description:
      "Clears manually-checked sections and article read status (which also auto-completes sections).",
    label: "Reset checkmarks",
    confirmLabel: "Yes, reset checkmarks",
    warning:
      "This will permanently uncheck your roadmap sections and mark every article as unread again. This can't be undone.",
    successMessage: "Your roadmap checkmarks have been reset.",
    action: resetRoadmapProgress,
  },
  {
    key: "quizzes",
    title: "Quiz history",
    description: "Deletes your past quiz attempts and scores.",
    label: "Reset quiz history",
    confirmLabel: "Yes, reset quiz history",
    warning:
      "This will permanently delete your quiz attempt history. This can't be undone.",
    successMessage: "Your quiz history has been reset.",
    action: resetQuizHistory,
  },
  {
    key: "bookmarks",
    title: "Bookmarks",
    description: "Deletes all of your saved bookmarks.",
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

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-xl border-2 border-red-200 p-5 dark:border-red-400/30">
          <div>
            <h3 className="font-heading text-sm font-medium">
              {RESET_ALL.title}
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {RESET_ALL.description}
            </p>
          </div>
          <div>
            <ResetActionButton
              label={RESET_ALL.label}
              confirmLabel={RESET_ALL.confirmLabel}
              warning={RESET_ALL.warning}
              successMessage={RESET_ALL.successMessage}
              action={RESET_ALL.action}
            />
          </div>
        </div>

        {RESET_SECTIONS.map((section) => (
          <div
            key={section.key}
            className="flex flex-col gap-4 rounded-xl border border-black/10 p-5 dark:border-white/10"
          >
            <div>
              <h3 className="font-heading text-sm font-medium">
                {section.title}
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {section.description}
              </p>
            </div>
            <div>
              <ResetActionButton
                label={section.label}
                confirmLabel={section.confirmLabel}
                warning={section.warning}
                successMessage={section.successMessage}
                action={section.action}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
