import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, email } = await getAuthenticatedUser();

  if (!userId) {
    redirect("/login");
  }

  return <AppShell email={email}>{children}</AppShell>;
}
