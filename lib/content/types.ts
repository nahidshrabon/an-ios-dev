export interface ArticleSection {
  id: string;
  heading: string;
  body: string;
}

export interface Article {
  /** Permanent identifier — referenced by reading_progress rows once a user reads this. Do not rename. */
  slug: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  sections: ArticleSection[];
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
}

export interface Quiz {
  /** Permanent identifier — referenced by quiz_attempts rows once a user takes this. Do not rename. */
  id: string;
  title: string;
  description: string;
  relatedArticleSlug?: string;
  questions: QuizQuestion[];
}
