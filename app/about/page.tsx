import type { Metadata } from "next";
import {
  GitHubIcon,
  InfoIcon,
  StarIcon,
  LinkedInIcon,
  MailIcon,
} from "@/components/Icons";
import { PageHeader } from "@/components/PageHeader";

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

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={InfoIcon} title="About us" />

      <section className="relative mt-6 overflow-hidden rounded-2xl border border-black/10 bg-gradient-to-br from-accent/10 via-transparent to-transparent p-6 sm:p-8 dark:border-white/10">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="font-heading flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-semibold text-white shadow-sm"
          >
            NI
          </div>
          <div>
            <p className="font-heading text-sm font-semibold uppercase tracking-wide text-accent">
              Hello there
            </p>
            <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              I&apos;m Md. Nahidul Islam
            </h2>
          </div>
        </div>

        <p className="mt-5 leading-relaxed text-zinc-600 dark:text-zinc-400">
          I built{" "}
          <span className="font-heading font-semibold text-foreground">
            an <span className="text-accent">iOS</span> dev
          </span>{" "}
          for my own use, as a place to read, track my progress, and practice
          with quizzes.
        </p>
        <p className="mt-3 font-medium text-foreground">
          If it ends up helping you too, that&apos;s a bonus.
        </p>
      </section>

      <section className="mt-6 flex items-start gap-3 rounded-2xl border border-black/10 p-5 dark:border-white/10">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <InfoIcon className="size-5" />
        </div>
        <div>
          <h3 className="font-heading font-medium">Found an issue?</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            If you run into any issue, report it and I&apos;ll fix it.
          </p>
        </div>
      </section>

      <a
        href="https://github.com/nahidshrabon/an-ios-dev"
        target="_blank"
        rel="noopener noreferrer"
        className="group mt-3 flex items-center gap-3 rounded-2xl border border-black/10 p-5 transition hover:border-accent/40 hover:bg-accent/5 dark:border-white/10"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
          <StarIcon className="size-5" />
        </div>
        <div>
          <h3 className="font-heading font-medium">Like it? Give it a star</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            A star on GitHub helps others find the project.
          </p>
        </div>
      </a>

      <h2 className="font-heading mt-10 text-sm font-semibold uppercase tracking-wide text-accent">
        Get in touch
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {LINKS.map(({ label, handle, href, external, Icon }) => (
          <li key={label}>
            <a
              href={href}
              {...(external && {
                target: "_blank",
                rel: "noopener noreferrer",
              })}
              className="group flex h-full flex-col gap-3 rounded-2xl border border-black/10 p-4 transition hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent/5 dark:border-white/10"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                <Icon className="size-5" />
              </span>
              <span>
                <span className="font-heading block font-medium">{label}</span>
                <span className="mt-0.5 block break-all text-sm text-zinc-600 dark:text-zinc-400">
                  {handle}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
