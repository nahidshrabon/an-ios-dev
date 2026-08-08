import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — proxy.ts refreshes the
            // session on the response instead, so this is safe to ignore.
          }
        },
      },
    }
  );
}

// Memoized per request: the dashboard layout and each dashboard page all
// need the current user's claims, but they'd otherwise each trigger their
// own round trip to Supabase for the identical result. `cache()` collapses
// every call within one render pass into a single lookup.
export const getClaims = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.getClaims();
});
