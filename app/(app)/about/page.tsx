import type { Metadata } from "next";
import {
  GitHubIcon,
  InfoIcon,
  LinkedInIcon,
  MailIcon,
} from "@/components/Icons";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = { title: "About us" };

const LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/nahidshrabon",
    external: true,
    Icon: GitHubIcon,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/nahidshrabon",
    external: true,
    Icon: LinkedInIcon,
  },
  {
    label: "nahidshrabon@gmail.com",
    href: "mailto:nahidshrabon@gmail.com",
    external: false,
    Icon: MailIcon,
  },
] as const;

export default function AboutPage() {
  return (
    <div>
      <PageHeader icon={InfoIcon} title="About us" />

      <p className="mt-4 max-w-2xl text-zinc-600 dark:text-zinc-400">
        Hi, I&apos;m Md. Nahidul Islam. I built an iOS dev for my own use, as a
        place to read, track my progress, and practice with quizzes. If it ends
        up helping you too, that&apos;s a bonus.
      </p>
      <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
        If you run into any issue, report it and I&apos;ll fix it.
      </p>

      <h2 className="font-heading mt-8 text-base font-medium">Get in touch</h2>
      <ul className="mt-3 flex flex-wrap gap-3">
        {LINKS.map(({ label, href, external, Icon }) => (
          <li key={label}>
            <a
              href={href}
              {...(external && {
                target: "_blank",
                rel: "noopener noreferrer",
              })}
              className="font-heading inline-flex h-10 items-center gap-2 rounded-full border border-black/10 px-4 text-sm transition-colors hover:bg-black/[.04] dark:border-white/15 dark:hover:bg-[#1a1a1a]"
            >
              <Icon className="size-4 text-accent" />
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
