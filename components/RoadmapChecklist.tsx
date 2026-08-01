"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { RoadmapPart } from "@/lib/content/roadmap";

export function RoadmapChecklist({
  parts,
  initialCompleted,
  userId,
}: {
  parts: RoadmapPart[];
  initialCompleted: Record<string, boolean>;
  userId: string;
}) {
  const [completed, setCompleted] =
    useState<Record<string, boolean>>(initialCompleted);
  const [supabase] = useState(() => createClient());

  const totalSections = useMemo(
    () => parts.reduce((sum, part) => sum + part.sections.length, 0),
    [parts]
  );
  const completedCount = Object.values(completed).filter(Boolean).length;
  const percent =
    totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  async function toggle(sectionId: string) {
    const next = !completed[sectionId];
    setCompleted((prev) => ({ ...prev, [sectionId]: next }));
    await supabase.from("roadmap_progress").upsert({
      user_id: userId,
      section_id: sectionId,
      completed: next,
      updated_at: new Date().toISOString(),
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Roadmap</h1>

      <div className="mt-6 rounded-xl border border-black/10 p-5 dark:border-white/10">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {completedCount} / {totalSections} sections completed
          </p>
          <p className="text-2xl font-semibold">{percent}%</p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-foreground transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4">
        {parts.map((part) => {
          const partCompleted = part.sections.filter(
            (s) => completed[s.id]
          ).length;
          return (
            <details
              key={part.id}
              open
              className="rounded-xl border border-black/10 p-4 dark:border-white/10"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-medium">{part.title}</span>
                <span className="text-sm text-zinc-500">
                  {partCompleted}/{part.sections.length}
                </span>
              </summary>
              <ul className="mt-3 flex flex-col gap-1">
                {part.sections.map((sec) => (
                  <li
                    key={sec.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-black/[.03] dark:hover:bg-white/5"
                  >
                    <label className="flex flex-1 cursor-pointer items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={!!completed[sec.id]}
                        onChange={() => toggle(sec.id)}
                        className="size-4 shrink-0 accent-foreground"
                      />
                      <span
                        className={
                          completed[sec.id]
                            ? "text-zinc-500 line-through dark:text-zinc-500"
                            : ""
                        }
                      >
                        {sec.number}. {sec.title}
                      </span>
                    </label>
                    {sec.articleSlug && (
                      <Link
                        href={`/articles/${sec.articleSlug}`}
                        className="shrink-0 text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
                      >
                        Read →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}
