import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const email = data.claims.email as string | undefined;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
      <div className="flex items-center justify-between border-b border-black/10 pb-4 dark:border-white/10">
        <nav className="flex gap-4 text-sm font-medium">
          <Link href="/dashboard" className="hover:underline">
            Progress
          </Link>
          <Link href="/dashboard/quizzes" className="hover:underline">
            Quizzes
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          {email && (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {email}
            </span>
          )}
          <SignOutButton />
        </div>
      </div>
      <div className="flex-1 pt-8">{children}</div>
    </div>
  );
}
