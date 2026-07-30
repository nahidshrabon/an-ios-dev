import type { Article } from "./types";

export const articles: Article[] = [
  {
    slug: "getting-started-with-swift",
    title: "Getting Started with Swift",
    description:
      "The essentials of Swift syntax — variables, optionals, and functions — for anyone starting iOS development.",
    tags: ["swift", "basics"],
    publishedAt: "2026-01-05",
    sections: [
      {
        id: "why-swift",
        heading: "Why Swift",
        body: "Swift is Apple's modern language for iOS, macOS, watchOS, and tvOS development. It was designed to be safe, fast, and expressive — replacing Objective-C as the default choice for new Apple platform apps. If you're starting iOS development today, Swift is where you begin.",
      },
      {
        id: "variables-and-optionals",
        heading: "Variables and Optionals",
        body: "Swift distinguishes between `let` (a constant, assigned once) and `var` (a variable that can change). One of Swift's defining features is optionals — a type that can either hold a value or be `nil`. Writing `var name: String?` means name might not have a value at all, and the compiler forces you to handle that possibility before using it, which eliminates a huge class of null-pointer crashes common in other languages.",
      },
      {
        id: "functions",
        heading: "Functions",
        body: "Functions in Swift are declared with `func`, and every parameter can have both an external argument label and an internal parameter name, e.g. `func greet(person name: String) -> String`. This dual-naming convention is part of what makes Swift call sites read like natural language.",
      },
    ],
  },
  {
    slug: "swiftui-basics",
    title: "SwiftUI Basics",
    description:
      "How SwiftUI's declarative views, modifiers, and state work together to build iOS interfaces.",
    tags: ["swiftui", "ui"],
    publishedAt: "2026-01-12",
    sections: [
      {
        id: "declarative-ui",
        heading: "Declarative UI",
        body: "SwiftUI lets you describe what your interface should look like for a given state, rather than writing imperative code to mutate views step by step. A `Text(\"Hello\")` view isn't an instruction to draw text — it's a description that SwiftUI turns into pixels, and re-renders automatically whenever the underlying data changes.",
      },
      {
        id: "views-and-modifiers",
        heading: "Views and Modifiers",
        body: "Every visual element in SwiftUI — text, images, buttons, stacks — conforms to the `View` protocol. Modifiers like `.padding()`, `.foregroundColor(.blue)`, or `.font(.title)` don't mutate a view in place; each one wraps the view in a new one with that modification applied, which is why modifier order can change the result.",
      },
      {
        id: "state-and-binding",
        heading: "State and Binding",
        body: "`@State` marks a piece of data as owned by a view and, when it changes, triggers a re-render of that view and its children. `@Binding` lets a child view read and write a value it doesn't own, creating a two-way connection back to the parent's `@State`. Together they're the foundation of how SwiftUI keeps UI in sync with data.",
      },
    ],
  },
  {
    slug: "understanding-mvvm",
    title: "Understanding MVVM in iOS Apps",
    description:
      "Why MVVM is the most common architecture pattern in SwiftUI apps, and how the pieces fit together.",
    tags: ["architecture", "swiftui"],
    publishedAt: "2026-01-19",
    sections: [
      {
        id: "the-problem",
        heading: "The Problem MVVM Solves",
        body: "As soon as a view needs to fetch data, validate input, or talk to a database, putting that logic directly inside the view makes it hard to test and hard to reuse. MVVM (Model-View-ViewModel) separates concerns: the Model holds your data, the View renders it, and the ViewModel sits in between, holding presentation logic and state the View observes.",
      },
      {
        id: "viewmodel-in-swiftui",
        heading: "ViewModel in SwiftUI",
        body: "In SwiftUI, a ViewModel is typically a class marked `@Observable` (or conforming to `ObservableObject` in older code), exposing published properties the View reads and methods the View calls in response to user actions. The View itself stays a thin, mostly declarative description of layout — all the decision-making lives in the ViewModel.",
      },
      {
        id: "when-to-use-it",
        heading: "When to Use It",
        body: "MVVM shines once a screen has real logic: network calls, validation, multiple pieces of derived state. For a purely static screen, introducing a ViewModel is often unnecessary ceremony — it's fine for a View to just render fixed content directly.",
      },
    ],
  },
];

export function getAllArticles(): Article[] {
  return articles;
}

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}
