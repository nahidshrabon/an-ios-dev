"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  isRoadmapSectionCompleted,
  type RoadmapPart,
  type RoadmapSection,
} from "@/lib/content/roadmap";

export function RoadmapChecklist({
  parts,
  manualCompleted,
  readArticleSlugs,
  userId,
}: {
  parts: RoadmapPart[];
  manualCompleted: Record<string, boolean>;
  readArticleSlugs: string[];
  userId: string;
}) {
  const [manual, setManual] =
    useState<Record<string, boolean>>(manualCompleted);
  const [supabase] = useState(() => createClient());
  const readSlugs = useMemo(
    () => new Set(readArticleSlugs),
    [readArticleSlugs]
  );

  function isCompleted(section: RoadmapSection): boolean {
    return isRoadmapSectionCompleted(section, manual, readSlugs);
  }

  const totalSections = useMemo(
    () => parts.reduce((sum, part) => sum + part.sections.length, 0),
    [parts]
  );
  const completedCount = useMemo(
    () =>
      parts.reduce(
        (sum, part) => sum + part.sections.filter(isCompleted).length,
        0
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parts, manual, readSlugs]
  );
  const percent =
    totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  async function toggle(sectionId: string) {
    const next = !manual[sectionId];
    setManual((prev) => ({ ...prev, [sectionId]: next }));
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

      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Check off a section once you've covered it. Sections with a{" "}
        <strong className="font-medium text-foreground">Read →</strong> link
        have a published article — those check themselves automatically as
        soon as you mark that article read on its page, so there's nothing to
        click there. Everything else you check by hand as you go.
      </p>

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
          const partCompleted = part.sections.filter(isCompleted).length;
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
                {part.sections.map((sec) => {
                  const done = isCompleted(sec);
                  const isAuto = !!sec.articleSlug;
                  return (
                    <li
                      key={sec.id}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-black/[.03] dark:hover:bg-white/5"
                    >
                      <label
                        className={`flex flex-1 items-center gap-3 text-sm ${
                          isAuto ? "cursor-default" : "cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={done}
                          disabled={isAuto}
                          onChange={isAuto ? undefined : () => toggle(sec.id)}
                          title={
                            isAuto
                              ? "Synced automatically from the article's reading status"
                              : undefined
                          }
                          className="size-4 shrink-0 accent-foreground disabled:opacity-60"
                        />
                        <span
                          className={
                            done
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
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}
