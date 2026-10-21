import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  NEXT_PATH_COOKIE,
  NEXT_PATH_COOKIE_PATH,
  safeNextPath,
} from "@/lib/safe-redirect";

// Handles the redirect back from GitHub OAuth, email confirmation links, and
// password reset links. Two exchange styles are supported:
//
//   ?token_hash=<hash>&type=<type>  — works in any browser / on any device
//   ?code=<code>                    — PKCE; only works in the same browser
//                                     that started the flow (the matching
//                                     verifier is stored in a cookie there)
//
// The email templates decide which one the link carries. Prefer the
// token-hash form for the password-reset template so a link requested on a
// laptop still works when opened on a phone.
// Redirects here must be relative, and must not go through a Location header.
//
// Relative, because `new URL(request.url).origin` inside a Netlify function
// resolves to the deploy-specific domain (<hash>--<site>.netlify.app), not
// the production one. Sending the browser there after a successful exchange
// strands it on a domain the session cookies were never set for, so it
// arrives logged out. A relative path always resolves against the domain the
// browser is already on — the same one holding the cookies.
//
// Not a Location header, because Netlify's Next.js runtime re-appends the
// original request's query string (our one-time `code`) onto whatever a
// Route Handler redirects to (netlify/next-runtime#2209). Cookies are set by
// the time we respond, so a client-side bounce is equivalent and avoids it.
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function redirectResponse(path: string) {
  return new NextResponse(
    `<!doctype html><meta http-equiv="refresh" content="0;url=${escapeHtml(
      path
    )}"><script>location.replace(${JSON.stringify(path).replace(
      /</g,
      "\\u003c"
    )})</script>`,
    {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}

// Failures send /login a short ?error= code, never the message itself. The
// login page looks each code up in its own list (CALLBACK_ERRORS) and shows
// nothing for any other value, so a crafted /login?error= link can't put its
// own words on the real login page.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const errorCode = searchParams.get("error_code");

  // ?next= wins (the password-reset link sets it); otherwise the destination
  // remembered when a GitHub or email sign-up started. Cleared either way,
  // so it can't steer a later sign-in.
  const cookieStore = await cookies();
  const rememberedNext = cookieStore.get(NEXT_PATH_COOKIE)?.value;
  if (rememberedNext !== undefined) {
    cookieStore.delete({ name: NEXT_PATH_COOKIE, path: NEXT_PATH_COOKIE_PATH });
  }
  const next = safeNextPath(searchParams.get("next") ?? rememberedNext);

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
      token_hash: tokenHash,
    });
    if (!error) {
      return redirectResponse(next);
    }
    console.error("[auth/callback] verifyOtp failed:", error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectResponse(next);
    }
    // A present-but-rejected code is almost always one of: already consumed
    // (an email link-scanner prefetched it), expired, or — for PKCE — opened
    // in a different browser than the one that requested it, so the matching
    // verifier cookie isn't here. The specific reason is logged server-side
    // for diagnosis; users get the actionable summary without the raw error.
    console.error("[auth/callback] exchangeCodeForSession failed:", error);
    // The different-browser case gets its own message: there is no resend
    // button to point at, and Supabase verified the email before redirecting
    // here, so a new account is already confirmed and just needs a login.
    if (error.code === "pkce_code_verifier_not_found") {
      return redirectResponse("/login?error=link_other_browser");
    }
    return redirectResponse("/login?error=link_invalid");
  }

  // Email scanners (e.g. Gmail's link-safety prefetch) sometimes visit
  // confirmation links before the user does, consuming the one-time code.
  // If that happened, the account is usually already confirmed — the code
  // just isn't valid for a second use.
  if (errorCode === "otp_expired") {
    return redirectResponse("/login?error=link_used");
  }

  return redirectResponse("/login?error=auth_failed");
}
