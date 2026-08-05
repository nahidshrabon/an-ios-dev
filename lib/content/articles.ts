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
  {
    slug: "structs-classes-enums",
    title: "Structs, Classes, and Enums",
    description:
      "Swift's three core custom type kinds — struct value semantics, class reference semantics and inheritance, and enums with raw or associated values — plus computed properties, observers, static members, and subscripts.",
    tags: ["swift","structs","classes","enums"],
    publishedAt: "2026-08-04",
    content: loadBody("structs-classes-enums.md"),
  },
  {
    slug: "protocols-and-extensions",
    title: "Protocols and Extensions",
    description:
      "Protocols as contracts for shared behavior across unrelated types, and extensions that add functionality to existing types — the foundation behind Equatable, Hashable, and Comparable.",
    tags: ["swift","protocols","extensions"],
    publishedAt: "2026-08-04",
    content: loadBody("protocols-and-extensions.md"),
  },
  {
    slug: "generics",
    title: "Generics",
    description:
      "Writing code that works across many types without duplication: generic functions and types, constraints, associated types, and the some/any distinction for working with protocols abstractly.",
    tags: ["swift","generics"],
    publishedAt: "2026-08-04",
    content: loadBody("generics.md"),
  },
  {
    slug: "error-handling",
    title: "Error Handling",
    description:
      "Swift's typed, explicit error-handling model: custom error types, throws/try/catch, the difference between try, try?, and try!, and the Result type as an alternative representation.",
    tags: ["swift","error-handling"],
    publishedAt: "2026-08-04",
    content: loadBody("error-handling.md"),
  },
  {
    slug: "memory-management",
    title: "Memory Management",
    description:
      "Automatic Reference Counting — how Swift manages class instance lifetimes, retain cycles and how to break them with weak/unowned, copy-on-write, and other advanced memory topics.",
    tags: ["swift","memory-management","arc"],
    publishedAt: "2026-08-04",
    content: loadBody("memory-management.md"),
  },
  {
    slug: "advanced-type-system",
    title: "Advanced Type System",
    description:
      "Swift's more specialized type-system features: key paths, dynamic member/callable lookup, operator overloading, ownership and noncopyable types, access control, and library-evolution attributes.",
    tags: ["swift","type-system"],
    publishedAt: "2026-08-04",
    content: loadBody("advanced-type-system.md"),
  },
  {
    slug: "result-builders-and-property-wrappers",
    title: "Result Builders and Property Wrappers",
    description:
      "The mechanism behind SwiftUI's declarative view syntax and behind @State/@Published — building a minimal result builder and property wrapper from scratch to demystify both.",
    tags: ["swift","result-builders","property-wrappers"],
    publishedAt: "2026-08-04",
    content: loadBody("result-builders-and-property-wrappers.md"),
  },
  {
    slug: "macros",
    title: "Macros",
    description:
      "Compile-time code generation that replaced older codegen scripts: freestanding and attached macro kinds, the SwiftSyntax foundation they're built on, and the practical workflow for writing and debugging one.",
    tags: ["swift","macros"],
    publishedAt: "2026-08-04",
    content: loadBody("macros.md"),
  },
  {
    slug: "standard-library-deep-dive",
    title: "Standard Library Deep Dive",
    description:
      "Underneath the collection protocols, Codable in depth, and a tour of modern standard-library additions for regex, formatting, time, and observation.",
    tags: ["swift","standard-library"],
    publishedAt: "2026-08-04",
    content: loadBody("standard-library-deep-dive.md"),
  },
  {
    slug: "low-level-swift",
    title: "Low-Level Swift",
    description:
      "Unsafe pointer types, newer memory-safe alternatives like Span and InlineArray, custom storage management, and interoperability with C, C++, and Objective-C.",
    tags: ["swift","low-level","unsafe"],
    publishedAt: "2026-08-04",
    content: loadBody("low-level-swift.md"),
  },
];

export function getAllArticles(): Article[] {
  return articles;
}

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}
