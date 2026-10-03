import type { Metadata } from "next";
import { AlertIcon } from "@/components/Icons";
import { PageHeader } from "@/components/PageHeader";
import { ReportHistory } from "@/components/ReportHistory";
import { ReportProblemForm } from "@/components/ReportProblemForm";

export const metadata: Metadata = { title: "Report a problem" };

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page } = await searchParams;
  const initialPage = typeof page === "string" ? page : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon={AlertIcon} title="Report a problem" />
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Found a bug, a mistake in an article, or something that just
        doesn&apos;t feel right? Tell me about it and I&apos;ll fix it.
      </p>
      <div className="mt-6">
        <ReportProblemForm initialPage={initialPage} />
      </div>
      <ReportHistory />
    </div>
  );
}
