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
