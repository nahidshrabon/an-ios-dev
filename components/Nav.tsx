import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-semibold tracking-tight">
          Become an iOS Dev
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/articles" className="hover:underline">
            Articles
          </Link>
          <Link href="/login" className="hover:underline">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-foreground px-4 py-1.5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}
