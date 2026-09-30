"use client";

// Replaces the root layout when the layout itself throws, so it renders its
// own document. Global styles and fonts don't reach it — hence the inline
// <style> rather than Tailwind classes.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong | an iOS dev</title>
        <style>{`
          :root { color-scheme: light dark; --bg: #ffffff; --fg: #171717; --muted: #52525b; --accent: #007aff; --line: rgba(0,0,0,.1); }
          @media (prefers-color-scheme: dark) {
            :root { --bg: #0a0a0a; --fg: #ededed; --muted: #a1a1aa; --accent: #0a84ff; --line: rgba(255,255,255,.15); }
          }
          body { margin: 0; background: var(--bg); color: var(--fg);
            font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
          .wrap { max-width: 28rem; margin: 0 auto; min-height: 100vh; display: flex;
            flex-direction: column; justify-content: center; padding: 4rem 1.5rem; }
          h1 { font-size: 1.5rem; font-weight: 600; letter-spacing: -0.015em; margin: 0; }
          p { color: var(--muted); margin: .5rem 0 0; line-height: 1.6; }
          .ref { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .75rem; margin-top: 1rem; }
          .actions { display: flex; flex-wrap: wrap; gap: .75rem; margin-top: 2rem; }
          button, a { font: inherit; font-size: .875rem; border-radius: 9999px;
            padding: .5rem 1rem; cursor: pointer; text-decoration: none; }
          button { background: var(--accent); color: #fff; border: 0; }
          a { border: 1px solid var(--line); color: inherit; }
        `}</style>

        <div className="wrap">
          <h1>Something went wrong</h1>
          <p>
            The page couldn&apos;t be loaded. This is often temporary — trying
            again usually clears it.
          </p>
          {error.digest && <p className="ref">Reference: {error.digest}</p>}
          <div className="actions">
            <button type="button" onClick={retry}>
              Try again
            </button>
            {/* A real navigation, not <Link>: the root layout threw, so a
                client-side transition would re-enter the same broken tree. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/">Go home</a>
          </div>
        </div>
      </body>
    </html>
  );
}
