import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertIcon,
  GitHubIcon,
  InfoIcon,
  StarIcon,
  LinkedInIcon,
  MailIcon,
} from "@/components/Icons";
import { PageHeader } from "@/components/PageHeader";
import { AppShell } from "@/components/AppShell";
import { Nav } from "@/components/Nav";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "About us" };

const LINKS = [
  {
    label: "GitHub",
    handle: "@nahidshrabon",
    href: "https://github.com/nahidshrabon",
    external: true,
    Icon: GitHubIcon,
  },
  {
    label: "LinkedIn",
    handle: "in/nahidshrabon",
    href: "https://www.linkedin.com/in/nahidshrabon",
    external: true,
    Icon: LinkedInIcon,
  },
  {
    label: "Email",
    handle: "nahidshrabon@gmail.com",
    href: "mailto:nahidshrabon@gmail.com",
    external: false,
    Icon: MailIcon,
  },
] as const;

// Reachable without an account, but signed-in readers arrive from the
// sidebar and should keep it. The page therefore picks its own chrome:
// AppShell when there's a session, the plain public layout otherwise.
// That makes this route server-rendered rather than static, which is the
// cost of the shell depending on who is asking.
export default async function AboutPage() {
  const { userId, email } = await getAuthenticatedUser();

  const content = (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <PageHeader icon={InfoIcon} title="About us" />

      <section className="mt-5 flex items-start gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10">
        <div
          aria-hidden="true"
          className="font-heading flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent"
        >
          NI
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-medium">
            I&apos;m Md. Nahidul Islam
          </h2>
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
            I built{" "}
            <span className="font-heading font-semibold text-foreground">
              an <span className="text-accent">iOS</span> dev
            </span>{" "}
            for my own use, as a place to read, track my progress, and practice
            with quizzes. If it ends up helping you too, that&apos;s a bonus.
          </p>

          <ul className="mt-3 flex flex-wrap gap-2">
            {LINKS.map(({ label, handle, href, external, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  aria-label={`${label}: ${handle}`}
                  {...(external && {
                    target: "_blank",
                    rel: "noopener noreferrer",
                  })}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-background px-3 text-sm transition-colors hover:border-accent/40 hover:bg-accent/5 dark:border-white/15"
                >
                  <Icon className="size-4 text-accent" />
                  {handle}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Link
          href="/report"
          className="group flex items-center gap-3 rounded-2xl border border-black/10 p-4 transition hover:border-accent/40 hover:bg-accent/5 dark:border-white/10"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
            <AlertIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-heading text-sm font-medium">
              Found an issue?
            </h3>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Report it and I&apos;ll fix it.
            </p>
          </div>
        </Link>

        <a
          href="https://github.com/nahidshrabon/an-ios-dev"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-2xl border border-black/10 p-4 transition hover:border-accent/40 hover:bg-accent/5 dark:border-white/10"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
            <StarIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-heading text-sm font-medium">
              Like it? Give it a star
            </h3>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              It helps others find the project.
            </p>
          </div>
        </a>
      </div>
    </main>
  );

  // wrapContent={false}: the content above already provides its own <main>.
  if (userId) {
    return (
      <AppShell email={email} wrapContent={false}>
        {content}
      </AppShell>
    );
  }

  return (
    <>
      <Nav userEmail={null} />
      {content}
    </>
  );
}
