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
    slug: "control-flow",
    title: "Control Flow",
    description:
      "How Swift makes decisions and repeats work: if/switch branching, every loop form, early-exit tools (guard, break, continue), and defer for guaranteed cleanup.",
    tags: ["swift", "control-flow"],
    publishedAt: "2026-08-02",
    content: loadBody("control-flow.md"),
  },
  {
    slug: "collections",
    title: "Collections",
    description:
      "Swift's three core collection types — Array, Dictionary, Set — and the functional operations (map, filter, reduce, and friends) that transform them without hand-written loops.",
    tags: ["swift", "collections"],
    publishedAt: "2026-08-02",
    content: loadBody("collections.md"),
  },
  {
    slug: "optionals",
    title: "Optionals",
    description:
      "Swift's answer to the billion-dollar mistake of null references: optionals as a first-class part of the type system, every way to safely unwrap them, and the pitfalls of forcing your way past that safety.",
    tags: ["swift", "optionals"],
    publishedAt: "2026-08-02",
    content: loadBody("optionals.md"),
  },
  {
    slug: "functions-and-closures",
    title: "Functions and Closures",
    description:
      "Declaring and calling functions with Swift's label system, the full spectrum of parameter behaviors, and closures — from long-form syntax down to shorthand, including capture semantics and escaping.",
    tags: ["swift", "functions", "closures"],
    publishedAt: "2026-08-02",
    content: loadBody("functions-and-closures.md"),
  },
];

export function getAllArticles(): Article[] {
  return articles;
}

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}
