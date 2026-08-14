import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed middleware.ts to proxy.ts; this refreshes the Supabase
// session cookie and gates the authenticated /roadmap and /quizzes routes.
//
// Scoped to those routes only — public pages (/, /articles, auth forms)
// have no need for a session check here and shouldn't have their load time
// held hostage by a Supabase round-trip. The app layout also does its
// own authoritative server-side session check, so this is purely a fast-path
// redirect + cookie refresh for the routes that actually need it.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/roadmap/:path*", "/quizzes/:path*", "/bookmarks/:path*"],
};
