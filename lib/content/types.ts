export interface Article {
  /** Permanent identifier — referenced by reading_progress rows once a user reads this. Do not rename. */
  slug: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  /** Full article body as markdown — rendered via MarkdownContent. */
  content: string;
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  /** Shown only after the quiz is submitted, never while answering. */
  explanation: string;
}

export interface Quiz {
  /** Permanent identifier — referenced by quiz_attempts rows once a user takes this. Do not rename. */
  id: string;
  title: string;
  description: string;
  relatedArticleSlug?: string;
  /** Set once the questions have been proofread for correctness. Defaults to false. */
  reviewed?: boolean;
  questions: QuizQuestion[];
}
