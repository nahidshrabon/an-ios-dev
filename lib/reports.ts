// Shared by the submit action and the form. Kept out of lib/actions/reports.ts
// because a "use server" module may only export async functions.
export const REPORT_CATEGORIES = [
  { value: "bug", label: "Bug" },
  { value: "content", label: "Wrong or unclear content" },
  { value: "account", label: "Account / sign-in" },
  { value: "suggestion", label: "Suggestion" },
  { value: "other", label: "Other" },
] as const;

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
export const PAGE_URL_MAX = 500;

export type ReportResult = { ok: true } | { ok: false; error: string } | null;
