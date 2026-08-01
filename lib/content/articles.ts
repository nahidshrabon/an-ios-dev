import fs from "fs";
import path from "path";
import type { Article } from "./types";

function loadBody(filename: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), "lib/content/body", filename),
    "utf-8"
  );
}

export const articles: Article[] = [
  {
    slug: "swift-basics",
    title: "Swift Basics",
    description:
      "The twelve foundational Swift concepts: variables and constants, type inference, integers and floating point, booleans, strings, tuples, type conversion, and documentation comments.",
    tags: ["swift", "basics"],
    publishedAt: "2026-08-02",
    content: loadBody("swift-basics.md"),
  },
  {
    slug: "swiftui-basics",
    title: "SwiftUI Basics",
    description:
      "How SwiftUI's declarative views, modifiers, and state work together to build iOS interfaces.",
    tags: ["swiftui", "ui"],
    publishedAt: "2026-01-12",
    content: loadBody("swiftui-basics.md"),
  },
  {
    slug: "understanding-mvvm",
    title: "Understanding MVVM in iOS Apps",
    description:
      "Why MVVM is the most common architecture pattern in SwiftUI apps, and how the pieces fit together.",
    tags: ["architecture", "swiftui"],
    publishedAt: "2026-01-19",
    content: loadBody("understanding-mvvm.md"),
  },
];

export function getAllArticles(): Article[] {
  return articles;
}

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}
