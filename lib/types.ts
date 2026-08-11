export type ReadingStatus = "unread" | "in_progress" | "read";

export const READING_STATUSES: ReadingStatus[] = [
  "read",
  "in_progress",
  "unread",
];

export const READING_STATUS_LABELS: Record<ReadingStatus, string> = {
  unread: "Unread",
  in_progress: "In progress",
  read: "Read",
};
