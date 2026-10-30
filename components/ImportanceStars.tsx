import { StarIcon } from "@/components/Icons";
import type { Importance } from "@/lib/content/roadmap";

const importanceLabels: Record<Importance, string> = {
  1: "Niche",
  2: "Specialized",
  3: "Useful",
  4: "Important",
  5: "Essential",
};

const starValues = [1, 2, 3, 4, 5] as const;

export function ImportanceStars({
  importance,
  className = "",
}: {
  importance: Importance;
  className?: string;
}) {
  const label = `Importance: ${importance} of 5 (${importanceLabels[importance]})`;

  // One labelled image for screen readers instead of five separate stars.
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center gap-px ${className}`}
    >
      {starValues.map((value) => (
        <StarIcon
          key={value}
          filled={value <= importance}
          className={`size-3.5 ${
            value <= importance
              ? "text-amber-500 dark:text-amber-400"
              : "text-zinc-300 dark:text-zinc-600"
          }`}
        />
      ))}
    </span>
  );
}
