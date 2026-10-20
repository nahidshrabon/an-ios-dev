"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Where the reader was before the current page, within this visit. Module
// scope rather than state: nothing renders from it, and a full page load
// (a direct visit, a new tab) correctly starts it over at null.
let previousPathname: string | null = null;
let currentPathname: string | null = null;
// history.length on arriving at the current pathname. If it has grown since,
// entries were pushed on top (a #section jump from search), so one step back
// would land on this same page rather than the previous one.
let historyLengthOnArrival = 0;

/** Mounted once, in the root layout. */
export function PathnameTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === currentPathname) return;
    previousPathname = currentPathname;
    currentPathname = pathname;
    historyLengthOnArrival = window.history.length;
  }, [pathname]);

  return null;
}

/** Whether one step back in history returns to `pathname` within the site. */
export function cameFrom(pathname: string) {
  return (
    previousPathname === pathname &&
    window.history.length === historyLengthOnArrival
  );
}
