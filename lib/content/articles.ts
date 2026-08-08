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
  {
    slug: "swift-evolution-literacy",
    title: "Swift Evolution Literacy",
    description:
      "How Swift itself changes over time: the Swift Evolution process, staged feature adoption via upcoming feature flags, and a version-by-version summary of what Swift 6.0 through 6.4 actually changed — mostly around concurrency.",
    tags: ["swift","swift-evolution"],
    publishedAt: "2026-08-08",
    content: loadBody("swift-evolution-literacy.md"),
  },
  {
    slug: "async-await-foundations",
    title: "Async/Await Foundations",
    description:
      "The problem async/await solves, writing and calling async functions, what actually happens at a suspension point, entering async code from synchronous contexts with Task, and the cooperative thread pool that powers all of it.",
    tags: ["swift","concurrency","async-await"],
    publishedAt: "2026-08-08",
    content: loadBody("async-await-foundations.md"),
  },
  {
    slug: "structured-concurrency",
    title: "Structured Concurrency",
    description:
      "Swift's structured concurrency model: async let for simple parallel work, task groups for dynamic parallel work, cooperative cancellation, and bridging older callback-based APIs into async/await with continuations.",
    tags: ["swift","concurrency","structured-concurrency"],
    publishedAt: "2026-08-08",
    content: loadBody("structured-concurrency.md"),
  },
  {
    slug: "actors-and-isolation",
    title: "Actors and Isolation",
    description:
      "Actors — Swift's mechanism for eliminating data races on shared mutable state — reentrancy, global actors and @MainActor, and the newer isolation-control tools that refine how isolation actually behaves.",
    tags: ["swift","concurrency","actors"],
    publishedAt: "2026-08-08",
    content: loadBody("actors-and-isolation.md"),
  },
  {
    slug: "sendable-and-data-race-safety",
    title: "Sendable and Data-Race Safety",
    description:
      "Sendable — the protocol marking types safe to pass across isolation boundaries — its automatic and manual conformance rules, region-based isolation, and the practical workflow for migrating a module to Swift 6 mode.",
    tags: ["swift","concurrency","sendable"],
    publishedAt: "2026-08-08",
    content: loadBody("sendable-and-data-race-safety.md"),
  },
  {
    slug: "async-sequence-and-streams",
    title: "AsyncSequence and Streams",
    description:
      "AsyncSequence, the async counterpart to Sequence — AsyncStream for bridging callback-based event sources, buffering and back-pressure, writing a custom async sequence, and the swift-async-algorithms package.",
    tags: ["swift","concurrency","async-sequence"],
    publishedAt: "2026-08-08",
    content: loadBody("async-sequence-and-streams.md"),
  },
  {
    slug: "legacy-concurrency",
    title: "Legacy Concurrency",
    description:
      "The concurrency tools that predate Swift Concurrency — GCD, locks, OperationQueue, and Combine — which you'll still regularly encounter in existing codebases, third-party libraries, and Apple documentation.",
    tags: ["swift","concurrency","gcd","combine"],
    publishedAt: "2026-08-08",
    content: loadBody("legacy-concurrency.md"),
  },
  {
    slug: "swiftui-fundamentals",
    title: "SwiftUI Fundamentals",
    description:
      "The View protocol, why views are descriptions rather than objects, the core content views (Text, Image, SF Symbols, Label), view modifiers and why their order matters, color and font systems, and Xcode Previews.",
    tags: ["swiftui","fundamentals"],
    publishedAt: "2026-08-08",
    content: loadBody("swiftui-fundamentals.md"),
  },
  {
    slug: "layout",
    title: "Layout",
    description:
      "SwiftUI's layout system: the three basic stacks, spacing and alignment, .frame() and .padding(), the parent-proposes/child-decides negotiation model underlying all of it, shapes and clipping, safe areas, and GeometryReader.",
    tags: ["swiftui","layout"],
    publishedAt: "2026-08-08",
    content: loadBody("layout.md"),
  },
  {
    slug: "state-management",
    title: "State Management",
    description:
      "SwiftUI's property wrappers for managing state: @State, @Binding, @Observable/@Bindable, @Environment, persistence wrappers, @FocusState, legacy ObservableObject literacy, and the deeper mechanics of view identity.",
    tags: ["swiftui","state-management"],
    publishedAt: "2026-08-08",
    content: loadBody("state-management.md"),
  },
  {
    slug: "lists-and-collections",
    title: "Lists and Collections",
    description:
      "List (rows, sections, styles, swipe actions, selection), search and pull-to-refresh, ScrollView/LazyVStack/grids for custom scrolling layouts, programmatic scroll control, and what actually causes scrolling performance problems.",
    tags: ["swiftui","lists"],
    publishedAt: "2026-08-08",
    content: loadBody("lists-and-collections.md"),
  },
  {
    slug: "navigation-and-presentation",
    title: "Navigation and Presentation",
    description:
      "SwiftUI's navigation system (NavigationStack, value-based navigation, split views, tabs) and its presentation mechanisms (sheets, full screen covers, popovers, alerts, toolbars, context menus).",
    tags: ["swiftui","navigation"],
    publishedAt: "2026-08-08",
    content: loadBody("navigation-and-presentation.md"),
  },
  {
    slug: "forms-and-input",
    title: "Forms and Input",
    description:
      "SwiftUI's Form container paired with the full input-control toolkit: text entry, secure entry, toggles, sliders, pickers, buttons, validation patterns, and keyboard handling.",
    tags: ["swiftui","forms"],
    publishedAt: "2026-08-08",
    content: loadBody("forms-and-input.md"),
  },
  {
    slug: "animation",
    title: "Animation",
    description:
      "The full animation toolkit: implicit and explicit animation, curves and springs, transitions, matchedGeometryEffect, the newer phase and keyframe animators, custom Animatable conformance, and practical debugging.",
    tags: ["swiftui","animation"],
    publishedAt: "2026-08-08",
    content: loadBody("animation.md"),
  },
  {
    slug: "drawing-and-custom-graphics",
    title: "Drawing and Custom Graphics",
    description:
      "SwiftUI's vector drawing toolkit: Path and custom Shape conformance, stroking and filling, the immediate-mode Canvas API, time-driven drawing with TimelineView, geometry-aware effects, and Metal-backed shaders.",
    tags: ["swiftui","graphics","drawing"],
    publishedAt: "2026-08-08",
    content: loadBody("drawing-and-custom-graphics.md"),
  },
];

export function getAllArticles(): Article[] {
  return articles;
}

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}
