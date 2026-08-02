import type { Quiz } from "./types";

export const quizzes: Quiz[] = [
  {
    id: "swift-basics-quiz",
    title: "Swift Basics Quiz",
    description: "Check your understanding of variables, optionals, and functions in Swift.",
    relatedArticleSlug: "swift-basics",
    questions: [
      {
        id: "q1",
        prompt: "What keyword declares a constant in Swift?",
        options: [
          { id: "a", text: "var" },
          { id: "b", text: "let" },
          { id: "c", text: "const" },
          { id: "d", text: "final" },
        ],
        correctOptionId: "b",
      },
      {
        id: "q2",
        prompt: "What does `String?` mean in Swift?",
        options: [
          { id: "a", text: "A string that is always empty" },
          { id: "b", text: "A mutable string" },
          { id: "c", text: "An optional that may hold a String or be nil" },
          { id: "d", text: "A string constant" },
        ],
        correctOptionId: "c",
      },
      {
        id: "q3",
        prompt: "In `func greet(person name: String)`, what is `person` called?",
        options: [
          { id: "a", text: "The internal parameter name" },
          { id: "b", text: "The external argument label" },
          { id: "c", text: "The return type" },
          { id: "d", text: "A generic constraint" },
        ],
        correctOptionId: "b",
      },
    ],
  },
];

export function getAllQuizzes(): Quiz[] {
  return quizzes;
}

export function getQuiz(id: string): Quiz | undefined {
  return quizzes.find((quiz) => quiz.id === id);
}
