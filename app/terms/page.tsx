import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms you agree to when using an iOS dev.",
};

const PROSE =
  "mt-8 flex flex-col gap-8 text-zinc-600 dark:text-zinc-400 " +
  "[&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground " +
  "[&_p]:mt-2 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 " +
  "[&_a]:underline";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated 14 September 2026</p>

      <div className={PROSE}>
        <section>
          <h2>Accepting these terms</h2>
          <p>
            By using an iOS dev, you agree to these terms. If you do not agree
            with them, please do not use the site.
          </p>
        </section>

        <section>
          <h2>What this service is</h2>
          <p>
            an iOS dev provides free educational material about iOS development,
            along with tools to track your reading, check off a roadmap, take
            quizzes, and save bookmarks. It is a personal learning project, not
            professional or career advice. The content may contain mistakes or
            become outdated, so verify anything important against official
            documentation before relying on it.
          </p>
        </section>

        <section>
          <h2>Your account</h2>
          <p>
            You are responsible for keeping your login credentials secure and
            for activity that happens under your account. If you believe someone
            else has gained access to it, email{" "}
            <a href="mailto:nahidshrabon@gmail.com">nahidshrabon@gmail.com</a>.
          </p>
        </section>

        <section>
          <h2>Acceptable use</h2>
          <p>While using the site, please do not:</p>
          <ul>
            <li>
              attempt to gain unauthorized access to the site, its database, or
              another person&apos;s account;
            </li>
            <li>
              disrupt or overload the service, including through automated bulk
              requests or scraping;
            </li>
            <li>use the site for any unlawful purpose.</li>
          </ul>
        </section>

        <section>
          <h2>Content and ownership</h2>
          <p>
            The articles, quizzes, and design of this site belong to its
            operator. You are welcome to read and use them for your own personal
            learning. Republishing or redistributing them, in whole or at scale,
            requires permission first.
          </p>
        </section>

        <section>
          <h2>Availability and warranties</h2>
          <p>
            The site is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo;, without warranties of any kind. There is no
            guarantee of uptime, and the service may be changed, interrupted, or
            discontinued at any time. Keep your own record of anything you
            cannot afford to lose — stored progress may be lost.
          </p>
        </section>

        <section>
          <h2>Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, the operator of this site is
            not liable for any indirect, incidental, or consequential damages,
            or for any loss of data, arising from your use of the site.
          </p>
        </section>

        <section>
          <h2>Ending access</h2>
          <p>
            Accounts that violate these terms may be suspended or removed. You
            can stop using the site at any time and request deletion of your
            account as described in the{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </section>

        <section>
          <h2>Changes to these terms</h2>
          <p>
            If these terms change, the &ldquo;last updated&rdquo; date above
            changes with them. Continuing to use the site after a change means
            you accept the revised terms.
          </p>
        </section>
      </div>
    </main>
  );
}
