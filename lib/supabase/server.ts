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

// The single source of truth for "who is the current user" server-side.
//
// getClaims() verifies the session JWT locally (via WebCrypto/JWKS) and is
// normally enough on its own — but on a cold instance that hasn't fetched
// Supabase's JWKS keys yet, verification can fail transiently even for a
// perfectly valid session. That's not the same as "logged out": fall back
// to getUser(), which asks Supabase's Auth server directly, before
// concluding there's no user. Every call site that needs the current
// user's id/email should go through this rather than reading
// getClaims() directly, so that fallback isn't silently skipped.
export const getAuthenticatedUser = cache(async (): Promise<{
  userId: string | undefined;
  email: string | undefined;
}> => {
  const { data, error } = await getClaims();

  if (data?.claims) {
    return {
      userId: data.claims.sub,
      email: data.claims.email as string | undefined,
    };
  }

  if (error) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return { userId: user?.id, email: user?.email };
  }

  // A definitive "no session" (data: null, error: null) — actually logged out.
  return { userId: undefined, email: undefined };
});
