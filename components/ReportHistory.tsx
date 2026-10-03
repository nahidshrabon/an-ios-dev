import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { REPORT_CATEGORIES } from "@/lib/reports";

type Report = {
  id: string;
  category: string;
  page_url: string | null;
  message: string;
  status: "open" | "resolved";
  reply: string | null;
  created_at: string;
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function categoryLabel(value: string) {
  return REPORT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export async function ReportHistory() {
  const { userId } = await getAuthenticatedUser();
  if (!userId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("problem_reports")
    .select("id, category, page_url, message, status, reply, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<Report[]>();

  if (error || !data || data.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-accent">
        Your reports
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {data.map((report) => (
          <li
            key={report.id}
            className="rounded-2xl border border-black/10 p-5 dark:border-white/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-heading text-sm font-medium">
                {categoryLabel(report.category)}
              </span>
              <div className="flex items-center gap-3">
                <time
                  dateTime={report.created_at}
                  className="text-xs text-zinc-500"
                >
                  {dateFormat.format(new Date(report.created_at))}
                </time>
                <StatusBadge status={report.status} />
              </div>
            </div>
            {report.page_url && (
              <p className="mt-1 break-all text-xs text-zinc-500">
                {report.page_url}
              </p>
            )}
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
              {report.message}
            </p>
            {report.reply && (
              <div className="mt-4 rounded-xl border-l-4 border-accent bg-accent/5 px-4 py-3">
                <p className="font-heading text-xs font-semibold uppercase tracking-wide text-accent">
                  Reply from Md. Nahidul Islam
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {report.reply}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatusBadge({ status }: { status: Report["status"] }) {
  return status === "resolved" ? (
    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-400/15 dark:text-green-300">
      Resolved
    </span>
  ) : (
    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
      Open
    </span>
  );
}
