import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What an iOS dev collects, where it is stored, and how to delete it.",
};

const PROSE =
  "mt-8 flex flex-col gap-8 text-zinc-600 dark:text-zinc-400 " +
  "[&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground " +
  "[&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 " +
  "[&_a]:underline";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated 14 September 2026</p>

      <div className={PROSE}>
        <section>
          <h2>Who runs this site</h2>
          <p>
            an iOS dev is a small, independent learning tracker for iOS
            development, run by one person. Questions about this policy can go
            to{" "}
            <a href="mailto:nahidshrabon@gmail.com">nahidshrabon@gmail.com</a>.
          </p>
        </section>

        <section>
          <h2>What we collect</h2>
          <p>
            You can read every article without an account. If you create one, we
            store:
          </p>
          <ul>
            <li>
              <strong>Account details.</strong> Your email address. If you sign
              in with Google or GitHub, we also receive the basic profile
              information those services share — your name, email address, and
              avatar image URL. We never receive your Google or GitHub password.
            </li>
            <li>
              <strong>Learning activity.</strong> Which articles you have marked
              unread, in progress, or read; which roadmap sections you have
              checked off; your quiz attempts, including the answers you chose,
              your score, and when you finished; and the article headings you
              have bookmarked.
            </li>
          </ul>
        </section>

        <section>
          <h2>What we do not collect</h2>
          <p>
            There is no analytics, advertising, or third-party tracking on this
            site. We do not build advertising profiles, and we do not sell or
            share your data with advertisers or data brokers. The site is free,
            so we never ask for or store payment details.
          </p>
        </section>

        <section>
          <h2>Cookies</h2>
          <p>
            The only cookies set are the ones needed to keep you signed in —
            session tokens issued by Supabase Auth. There are no advertising or
            tracking cookies. Clearing these cookies signs you out.
          </p>
        </section>

        <section>
          <h2>Where your data is stored</h2>
          <p>
            We rely on a small number of providers, each of which processes data
            under its own privacy policy:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> — hosts the database and handles
              authentication.
            </li>
            <li>
              <strong>Netlify</strong> — hosts and serves the site.
            </li>
            <li>
              <strong>Google and GitHub</strong> — only if you choose one of
              them to sign in.
            </li>
          </ul>
          <p>
            Every row we store is tied to your user ID and protected by
            row-level security rules, so your progress, quiz history, and
            bookmarks are readable only by your own account.
          </p>
        </section>

        <section>
          <h2>Deleting your data</h2>
          <p>
            You can erase your learning data at any time from the Settings page:
            reset your roadmap, quiz history, or bookmarks individually, or
            reset everything at once. These deletions are permanent and cannot
            be undone.
          </p>
          <p>
            To delete your account entirely, including the email address
            attached to it, email{" "}
            <a href="mailto:nahidshrabon@gmail.com">nahidshrabon@gmail.com</a>{" "}
            and we will remove it.
          </p>
        </section>

        <section>
          <h2>Children</h2>
          <p>
            This site is not directed at children under 13, and we do not
            knowingly collect their personal information.
          </p>
        </section>

        <section>
          <h2>Changes to this policy</h2>
          <p>
            If this policy changes, the &ldquo;last updated&rdquo; date above
            changes with it. Significant changes will be noted on the site.
          </p>
        </section>
      </div>
    </main>
  );
}
