import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() verifies the JWT (locally via WebCrypto/JWKS for the default
  // asymmetric-key projects) — safe to trust for route protection, unlike
  // getSession() which doesn't guarantee revalidation here.
  //
  // It returns one of three shapes: authenticated (data.claims set), a
  // definitive "no session" (data: null, error: null), or a verification
  // failure (data: null, error: AuthError) — e.g. a cold serverless
  // instance failing to fetch the JWKS on its first request. Only the
  // "no session" case means the user is actually logged out; an error
  // is inconclusive; the app layout re-checks server-side anyway,
  // so this proxy check can fail open rather than bouncing a valid
  // session to /login over a transient blip.
  const { data, error } = await supabase.auth.getClaims();
  const definitelyLoggedOut = error === null && !data?.claims;

  const isGatedRoute =
    request.nextUrl.pathname.startsWith("/roadmap") ||
    request.nextUrl.pathname.startsWith("/quizzes") ||
    request.nextUrl.pathname.startsWith("/bookmarks");

  if (isGatedRoute && definitelyLoggedOut) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
