"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
// Type-only: importing the builder itself would pull `fs` into the browser.
import type { SearchEntry } from "@/lib/content/search-index";
import { SearchIcon, XIcon } from "@/components/Icons";
import { matchesAllTerms, toSearchTerms } from "@/lib/search";

// The index is ~150KB, so it is fetched once on first open and kept for the
// rest of the session rather than shipped with every page.
let cachedIndex: SearchEntry[] | null = null;
let inflight: Promise<SearchEntry[]> | null = null;

function loadIndex(): Promise<SearchEntry[]> {
  if (cachedIndex) return Promise.resolve(cachedIndex);
  inflight ??= fetch("/api/search-index")
    .then((res) => res.json() as Promise<SearchEntry[]>)
    .then((data) => {
      cachedIndex = data;
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

type Pane = "articles" | "headings";

export function SiteSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SearchEntry[] | null>(cachedIndex);
  const [query, setQuery] = useState("");
  const [activeArticle, setActiveArticle] = useState(0);
  const [activeHeading, setActiveHeading] = useState(0);
  const [pane, setPane] = useState<Pane>("articles");
  const inputRef = useRef<HTMLInputElement>(null);
  const articleListRef = useRef<HTMLUListElement>(null);

  const openSearch = useCallback(() => {
    setOpen(true);
    if (!cachedIndex) void loadIndex().then(setIndex);
  }, []);

  // ⌘K / Ctrl+K is an accelerator only — the visible bar is the real entry point.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const terms = useMemo(() => toSearchTerms(query), [query]);

  const results = useMemo(() => {
    if (!index) return [];
    if (terms.length === 0) return index;
    return index.filter((entry) => {
      const haystack = [
        entry.title,
        entry.description,
        entry.tags.join(" "),
        entry.headings.map((heading) => heading.title).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return matchesAllTerms(haystack, terms);
    });
  }, [index, terms]);

  function updateQuery(value: string) {
    setQuery(value);
    setActiveArticle(0);
    setActiveHeading(0);
    setPane("articles");
  }

  const current = results[activeArticle];

  // Headings narrowed by the same query, falling back to the full list so the
  // right pane is never empty just because the match was on the title.
  const headings = useMemo(() => {
    if (!current) return [];
    if (terms.length === 0) return current.headings;
    const matching = current.headings.filter((heading) =>
      matchesAllTerms(heading.title.toLowerCase(), terms)
    );
    return matching.length > 0 ? matching : current.headings;
  }, [current, terms]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    const inHeadings = pane === "headings" && headings.length > 0;
    const length = inHeadings ? headings.length : results.length;
    if (length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const setter = inHeadings ? setActiveHeading : setActiveArticle;
      setter((value) => (value + delta + length) % length);
      return;
    }

    if (event.key === "ArrowRight" && pane === "articles" && headings.length) {
      event.preventDefault();
      setPane("headings");
      setActiveHeading(0);
      return;
    }

    if (event.key === "ArrowLeft" && pane === "headings") {
      event.preventDefault();
      setPane("articles");
      return;
    }

    if (event.key === "Enter" && current) {
      event.preventDefault();
      go(
        inHeadings
          ? `/articles/${current.slug}#${headings[activeHeading].slug}`
          : `/articles/${current.slug}`
      );
    }
  }

  useEffect(() => {
    articleListRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeArticle]);

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        aria-label="Search articles"
        className={`flex items-center gap-2 rounded-full border border-black/10 px-2.5 py-1.5 text-sm text-zinc-500 transition-colors hover:border-black/20 dark:border-white/15 dark:hover:border-white/25 ${className}`}
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="hidden truncate md:inline">Search…</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh] backdrop-blur-sm"
          onMouseDown={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search articles"
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={onKeyDown}
            className="flex max-h-[75vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-black/10 bg-background shadow-2xl dark:border-white/15"
          >
            <div className="flex items-center gap-3 border-b border-black/10 px-4 dark:border-white/10">
              <SearchIcon className="size-4 shrink-0 text-zinc-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Search articles and sections…"
                aria-label="Search articles and sections"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"
              />
              <button
                type="button"
                onClick={close}
                aria-label="Close search"
                className="text-zinc-500 hover:text-foreground"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {!index ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">
                Loading…
              </p>
            ) : results.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">
                Nothing matches “{query}”.
              </p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                <ul
                  ref={articleListRef}
                  className="min-h-0 flex-1 overflow-y-auto p-2 sm:max-w-[45%] sm:border-r sm:border-black/10 sm:dark:border-white/10"
                >
                  {results.map((entry, entryIndex) => (
                    <li key={entry.slug}>
                      <button
                        type="button"
                        data-active={entryIndex === activeArticle}
                        onMouseEnter={() => {
                          setActiveArticle(entryIndex);
                          setPane("articles");
                        }}
                        onClick={() => go(`/articles/${entry.slug}`)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          entryIndex === activeArticle
                            ? "bg-accent/10 text-accent"
                            : "hover:bg-black/[.04] dark:hover:bg-white/5"
                        }`}
                      >
                        <span className="font-heading block truncate font-medium">
                          {entry.title}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          {entry.headings.length} sections
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>

                <ul className="min-h-0 flex-1 overflow-y-auto border-t border-black/10 p-2 sm:border-t-0 dark:border-white/10">
                  {headings.map((heading, headingIndex) => (
                    <li key={heading.slug}>
                      <button
                        type="button"
                        onMouseEnter={() => {
                          setPane("headings");
                          setActiveHeading(headingIndex);
                        }}
                        onClick={() =>
                          current &&
                          go(`/articles/${current.slug}#${heading.slug}`)
                        }
                        className={`w-full rounded-lg py-1.5 pr-3 text-left text-sm transition-colors ${
                          heading.level === 3 ? "pl-6" : "pl-3"
                        } ${
                          pane === "headings" && headingIndex === activeHeading
                            ? "bg-accent/10 text-accent"
                            : "text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/5"
                        }`}
                      >
                        <span className="block truncate">{heading.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
