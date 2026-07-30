# Become an iOS Dev

A public learning tracker for iOS development: read articles, track your progress, take quizzes, and see your history sync across devices.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Supabase](https://supabase.com) — Postgres + Auth (email/password and Google OAuth), accessed via `@supabase/ssr`
- Deployed on [Vercel](https://vercel.com)

Articles and quiz content are hardcoded in `lib/content/` — only reading progress and quiz results are stored in Supabase.

## Local development

1. Copy `.env.example` to `.env.local` and fill in your Supabase project URL + anon key.
2. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000).

## Project structure

- `app/` — routes (App Router). Public: `/`, `/articles`, `/articles/[slug]`. Gated behind login: `/dashboard/*`.
- `lib/content/` — hardcoded articles and quizzes.
- `lib/supabase/` — Supabase client setup (`server.ts` for Server Components/Route Handlers, `client.ts` for Client Components).
- `proxy.ts` — refreshes the Supabase session cookie on each request (Next.js 16 renamed `middleware.ts` to `proxy.ts`).

Content `id`/`slug` fields are referenced by rows in the database once a user interacts with them — avoid renaming an existing article or quiz id.
