"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/Icons";

type Theme = "light" | "system" | "dark";

const OPTIONS = [
  { value: "light", label: "Light theme", Icon: SunIcon },
  { value: "system", label: "Match system theme", Icon: MonitorIcon },
  { value: "dark", label: "Dark theme", Icon: MoonIcon },
] as const;

/** Mirrors the pre-paint script in the root layout. */
function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

/*
 * localStorage is an external store, so the choice is read through
 * useSyncExternalStore rather than mirrored into component state. That keeps
 * the server render ("system") from clashing with the stored value at
 * hydration, and lets a change in one tab update the others.
 */
let listeners: Array<() => void> = [];

function subscribe(onStoreChange: () => void) {
  listeners.push(onStoreChange);
  // Fired only by *other* tabs; same-tab writes notify via emit().
  const onStorage = (event: StorageEvent) => {
    if (event.key !== "theme") return;
    applyTheme(readTheme());
    onStoreChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners = listeners.filter((listener) => listener !== onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function emit() {
  listeners.forEach((listener) => listener());
}

function readTheme(): Theme {
  const stored = localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** The server can't know the stored choice; it assumes "system". */
function readServerTheme(): Theme {
  return "system";
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, readTheme, readServerTheme);

  // Only while following the system: react to the OS flipping mid-session.
  useEffect(() => {
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  function select(next: Theme) {
    // "system" is stored as absence, matching what the layout script expects.
    if (next === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", next);
    }
    applyTheme(next);
    emit();
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className={`inline-flex items-center gap-0.5 rounded-full border border-black/10 p-0.5 dark:border-white/10 ${className ?? ""}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            onClick={() => select(value)}
            title={label}
            aria-label={label}
            aria-pressed={active}
            className={`rounded-full p-1.5 transition-colors ${
              active
                ? "bg-accent text-white"
                : "text-zinc-500 hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            }`}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
