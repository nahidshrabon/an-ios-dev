/**
 * Where to send someone after they sign in, given an untrusted `?next=`.
 *
 * Shared by /auth/callback and the login form so both apply one rule: only
 * internal, single-slash paths built from an unambiguous character set get
 * through — never `//host`, `/\host`, or an absolute URL, which would turn
 * the link into an open redirect. Anything else falls back to the roadmap.
 */
export function safeNextPath(next: string | null | undefined): string {
  return next && /^\/(?![/\\])[A-Za-z0-9\-._~/]*$/.test(next)
    ? next
    : "/roadmap";
}

// Carries `next` through a sign-in whose return URL can't hold it: the
// GitHub redirect (see OAuthButtons) and the sign-up confirmation email.
// Scoped to /auth/callback, which falls back to it when its own ?next= is
// absent and then clears it. An hour is long enough to confirm an email.
export const NEXT_PATH_COOKIE = "auth_next";
export const NEXT_PATH_COOKIE_PATH = "/auth/callback";

// Browser only. The value goes through safeNextPath first, whose character
// set is all legal cookie characters, so it is stored as is.
export function rememberNextPath(next: string | null | undefined) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${NEXT_PATH_COOKIE}=${safeNextPath(
    next
  )}; Path=${NEXT_PATH_COOKIE_PATH}; Max-Age=3600; SameSite=Lax${secure}`;
}
