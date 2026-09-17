import { NextResponse } from "next/server";
import { buildSearchIndex } from "@/lib/content/search-index";

// Articles are compiled into the bundle, so the index only changes on deploy.
// Prerendering it keeps the ~150KB payload off every page load: the search UI
// fetches it once, the first time someone actually opens search.
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(buildSearchIndex());
}
