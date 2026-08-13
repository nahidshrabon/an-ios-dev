import Link from "next/link";
import { createClient, getClaims } from "@/lib/supabase/server";
import { getAllQuizzes } from "@/lib/content/quizzes";
import { roadmap } from "@/lib/content/roadmap";
import { ArrowRightIcon, ChevronDownIcon, TrophyIcon } from "@/components/Icons";

export default async function QuizzesPage() {
  const { data: claims } = await getClaims();
  const userId = claims?.claims.sub as string;

  const supabase = await createClient();
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("quiz_id, score, total_questions")
    .eq("user_id", userId);

  const bestByQuiz: Record<string, { score: number; total: number }> = {};
  attempts?.forEach((a) => {
    const current = bestByQuiz[a.quiz_id];
    if (!current || a.score > current.score) {
      bestByQuiz[a.quiz_id] = { score: a.score, total: a.total_questions };
    }
  });

  const quizzesBySlug = new Map(
    getAllQuizzes()
      .filter((quiz) => quiz.relatedArticleSlug)
      .map((quiz) => [quiz.relatedArticleSlug, quiz])
  );
  const quizParts = roadmap
    .map((part) => ({
      ...part,
      sections: part.sections
        .map((section) => ({
          ...section,
          quiz: section.articleSlug
            ? quizzesBySlug.get(section.articleSlug)
            : undefined,
        }))
        .filter((section) => section.quiz),
    }))
    .filter((part) => part.sections.length > 0);

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Quizzes
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Practice each published roadmap topic with a short quiz. Entries match
        the roadmap numbering so you can move through them in order.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        {quizParts.map((part) => {
          return (
            <details
              key={part.id}
              open
              className="group rounded-xl border border-black/10 p-4 dark:border-white/10"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <span className="font-heading font-medium">{part.title}</span>
                <span className="flex items-center gap-2 text-sm text-zinc-500">
                  {part.sections.length}
                  <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
                </span>
              </summary>
              <ul className="mt-3 flex flex-col gap-1">
                {part.sections.map((section) => {
                  const quiz = section.quiz!;
                  const best = bestByQuiz[quiz.id];
                  return (
                    <li key={quiz.id}>
                      <Link
                        href={`/quizzes/${quiz.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-black/[.03] dark:hover:bg-white/5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="font-heading block truncate text-sm">
                            {section.number}. {section.title}
                          </span>
                          <span className="font-article mt-0.5 block text-sm text-zinc-600 dark:text-zinc-400">
                            {quiz.description}
                          </span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-3 text-xs text-zinc-500">
                          {best && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 font-medium text-accent">
                              <TrophyIcon className="size-3.5" />
                              {best.score}/{best.total}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            Start
                            <ArrowRightIcon className="size-3" />
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}
