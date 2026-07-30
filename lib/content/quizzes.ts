import type { Quiz } from "./types";

export const quizzes: Quiz[] = [
  {
    id: "swift-basics-quiz",
    title: "Swift Basics Quiz",
    description: "Check your understanding of variables, optionals, and functions in Swift.",
    relatedArticleSlug: "getting-started-with-swift",
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
  {
    id: "swiftui-basics-quiz",
    title: "SwiftUI Basics Quiz",
    description: "Test your knowledge of views, modifiers, and state in SwiftUI.",
    relatedArticleSlug: "swiftui-basics",
    questions: [
      {
        id: "q1",
        prompt: "What protocol must every SwiftUI visual element conform to?",
        options: [
          { id: "a", text: "Renderable" },
          { id: "b", text: "View" },
          { id: "c", text: "Drawable" },
          { id: "d", text: "UIElement" },
        ],
        correctOptionId: "b",
      },
      {
        id: "q2",
        prompt: "What happens when you apply a modifier like `.padding()` to a view?",
        options: [
          { id: "a", text: "It mutates the view in place" },
          { id: "b", text: "It wraps the view in a new view with that modification" },
          { id: "c", text: "It deletes the view and creates a new one from scratch" },
          { id: "d", text: "Nothing, modifiers are purely cosmetic hints" },
        ],
        correctOptionId: "b",
      },
      {
        id: "q3",
        prompt: "Which property wrapper lets a child view read and write a value owned by its parent?",
        options: [
          { id: "a", text: "@State" },
          { id: "b", text: "@Environment" },
          { id: "c", text: "@Binding" },
          { id: "d", text: "@Published" },
        ],
        correctOptionId: "c",
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
