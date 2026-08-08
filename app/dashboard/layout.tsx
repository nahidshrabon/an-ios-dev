import { redirect } from "next/navigation";
import { createClient, getClaims } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, error } = await getClaims();

  let email: string | undefined = data?.claims.email as string | undefined;

  if (!data?.claims) {
    // A verification error (e.g. a cold instance failing to fetch the
    // JWKS) is not the same as "no session" — fall back to getUser(),
    // which asks Supabase's Auth server directly, before concluding the
    // user is actually logged out.
    if (error) {
      const supabase = await createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        redirect("/login");
      }
      email = userData.user.email;
    } else {
      redirect("/login");
    }
  }

  return <DashboardShell email={email}>{children}</DashboardShell>;
}
