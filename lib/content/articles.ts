import fs from "fs";
import path from "path";
import type { Article } from "./types";

const bodyCache = new Map<string, string>();

// In dev, re-read the file on every access so edits show up on refresh.
// In production, read each file once.
function loadBody(filename: string): string {
  const cached = bodyCache.get(filename);
  if (cached !== undefined) return cached;
  const body = fs.readFileSync(
    path.join(process.cwd(), "lib/content/body", filename),
    "utf-8"
  );
  if (process.env.NODE_ENV === "production") bodyCache.set(filename, body);
  return body;
}

export const articles: Article[] = [
  {
    slug: "swift-basics",
    title: "Swift Basics",
    description:
      "The basics of Swift: let and var, type inference, integers and floating point, booleans, strings and string indices, Unicode characters, tuples, type conversion, and comments.",
    tags: ["swift", "basics"],
    publishedAt: "2026-08-02",
    get content() {
      return loadBody("swift-basics.md");
    },
  },
  {
    slug: "control-flow",
    title: "Control Flow",
    description:
      "How Swift makes decisions and repeats work: if and switch (also as expressions), patterns and where clauses, every loop form, labels, stride, guard for early exit, and defer for cleanup.",
    tags: ["swift", "control-flow"],
    publishedAt: "2026-08-02",
    get content() {
      return loadBody("control-flow.md");
    },
  },
  {
    slug: "collections",
    title: "Collections",
    description:
      "Swift's three main collections, Array, Dictionary, and Set, plus sorting and the operations that replace hand-written loops: map, filter, reduce, compactMap, flatMap, search helpers, slices, and lazy sequences.",
    tags: ["swift", "collections"],
    publishedAt: "2026-08-02",
    get content() {
      return loadBody("collections.md");
    },
  },
  {
    slug: "optionals",
    title: "Optionals",
    description:
      "How Swift handles missing values safely: optionals, if let and guard let, optional chaining, ??, why force unwrapping crashes, implicitly unwrapped optionals, optional patterns, map and flatMap, nested optionals, and sorting with nil.",
    tags: ["swift", "optionals"],
    publishedAt: "2026-08-02",
    get content() {
      return loadBody("optionals.md");
    },
  },
  {
    slug: "functions-and-closures",
    title: "Functions and Closures",
    description:
      "Writing and calling functions with Swift's label system, default, variadic, and inout parameters, and closures from the full form to $0, including trailing closures, capturing, [weak self], escaping, and autoclosures.",
    tags: ["swift", "functions", "closures"],
    publishedAt: "2026-08-02",
    get content() {
      return loadBody("functions-and-closures.md");
    },
  },
  {
    slug: "structs-classes-enums",
    title: "Structs, Classes, and Enums",
    description:
      "Swift's three kinds of custom types: structs (values), classes (references and inheritance), and enums with raw or associated values, plus initializers, computed and lazy properties, observers, static members, subscripts, and modeling state.",
    tags: ["swift","structs","classes","enums"],
    publishedAt: "2026-08-04",
    get content() {
      return loadBody("structs-classes-enums.md");
    },
  },
  {
    slug: "protocols-and-extensions",
    title: "Protocols and Extensions",
    description:
      "Protocols as contracts that unrelated types can share, and extensions that add features to existing types: default implementations, conditional conformance, Equatable, Hashable, Comparable, Identifiable, dispatch rules, and @retroactive.",
    tags: ["swift","protocols","extensions"],
    publishedAt: "2026-08-04",
    get content() {
      return loadBody("protocols-and-extensions.md");
    },
  },
  {
    slug: "generics",
    title: "Generics",
    description:
      "Writing code once for many types: generic functions and types, constraints, associated types, constrained extensions, some vs. any, primary associated types, type erasure, parameter packs, and phantom types.",
    tags: ["swift","generics"],
    publishedAt: "2026-08-04",
    get content() {
      return loadBody("generics.md");
    },
  },
  {
    slug: "error-handling",
    title: "Error Handling",
    description:
      "Swift's explicit error handling: custom error types, throws and do/catch, try vs. try? vs. try!, rethrows, typed throws, the Result type, organizing errors in layers, and showing safe messages to users.",
    tags: ["swift","error-handling"],
    publishedAt: "2026-08-04",
    get content() {
      return loadBody("error-handling.md");
    },
  },
  {
    slug: "memory-management",
    title: "Memory Management",
    description:
      "How Swift frees objects with ARC: strong references, retain cycles and how to break them with weak and unowned (in closures, delegates, and Tasks), finding leaks, copy-on-write, stack vs. heap, and exclusivity.",
    tags: ["swift","memory-management","arc"],
    publishedAt: "2026-08-04",
    get content() {
      return loadBody("memory-management.md");
    },
  },
  {
    slug: "advanced-type-system",
    title: "Advanced Type System",
    description:
      "Swift's more specialized type features: key paths, dynamic member lookup and dynamic calls, custom operators and precedence, noncopyable types and ownership, ~Escapable and Span, access control with package, and library evolution.",
    tags: ["swift","type-system"],
    publishedAt: "2026-08-04",
    get content() {
      return loadBody("advanced-type-system.md");
    },
  },
  {
    slug: "result-builders-and-property-wrappers",
    title: "Result Builders and Property Wrappers",
    description:
      "The mechanism behind SwiftUI's declarative view syntax and behind @State/@Published — building a minimal result builder and property wrapper from scratch to demystify both.",
    tags: ["swift","result-builders","property-wrappers"],
    publishedAt: "2026-08-04",
    get content() {
      return loadBody("result-builders-and-property-wrappers.md");
    },
  },
  {
    slug: "macros",
    title: "Macros",
    description:
      "Compile-time code generation that replaced older codegen scripts: freestanding and attached macro kinds, the SwiftSyntax foundation they're built on, and the practical workflow for writing and debugging one.",
    tags: ["swift","macros"],
    publishedAt: "2026-08-04",
    get content() {
      return loadBody("macros.md");
    },
  },
  {
    slug: "standard-library-deep-dive",
    title: "Standard Library Deep Dive",
    description:
      "Underneath the collection protocols, Codable in depth, and a tour of modern standard-library additions for regex, formatting, time, and observation.",
    tags: ["swift","standard-library"],
    publishedAt: "2026-08-04",
    get content() {
      return loadBody("standard-library-deep-dive.md");
    },
  },
  {
    slug: "low-level-swift",
    title: "Low-Level Swift",
    description:
      "Unsafe pointer types, newer memory-safe alternatives like Span and InlineArray, custom storage management, and interoperability with C, C++, and Objective-C.",
    tags: ["swift","low-level","unsafe"],
    publishedAt: "2026-08-04",
    get content() {
      return loadBody("low-level-swift.md");
    },
  },
  {
    slug: "swift-evolution-literacy",
    title: "Swift Evolution Literacy",
    description:
      "How Swift itself changes over time: the Swift Evolution process, staged feature adoption via upcoming feature flags, and a version-by-version summary of what Swift 6.0 through 6.4 actually changed — mostly around concurrency.",
    tags: ["swift","swift-evolution"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("swift-evolution-literacy.md");
    },
  },
  {
    slug: "async-await-foundations",
    title: "Async/Await Foundations",
    description:
      "The problem async/await solves, writing and calling async functions, what actually happens at a suspension point, entering async code from synchronous contexts with Task, and the cooperative thread pool that powers all of it.",
    tags: ["swift","concurrency","async-await"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("async-await-foundations.md");
    },
  },
  {
    slug: "structured-concurrency",
    title: "Structured Concurrency",
    description:
      "Swift's structured concurrency model: async let for simple parallel work, task groups for dynamic parallel work, cooperative cancellation, and bridging older callback-based APIs into async/await with continuations.",
    tags: ["swift","concurrency","structured-concurrency"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("structured-concurrency.md");
    },
  },
  {
    slug: "actors-and-isolation",
    title: "Actors and Isolation",
    description:
      "Actors — Swift's mechanism for eliminating data races on shared mutable state — reentrancy, global actors and @MainActor, and the newer isolation-control tools that refine how isolation actually behaves.",
    tags: ["swift","concurrency","actors"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("actors-and-isolation.md");
    },
  },
  {
    slug: "sendable-and-data-race-safety",
    title: "Sendable and Data-Race Safety",
    description:
      "Sendable — the protocol marking types safe to pass across isolation boundaries — its automatic and manual conformance rules, region-based isolation, and the practical workflow for migrating a module to Swift 6 mode.",
    tags: ["swift","concurrency","sendable"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("sendable-and-data-race-safety.md");
    },
  },
  {
    slug: "async-sequence-and-streams",
    title: "AsyncSequence and Streams",
    description:
      "AsyncSequence, the async counterpart to Sequence — AsyncStream for bridging callback-based event sources, buffering and back-pressure, writing a custom async sequence, and the swift-async-algorithms package.",
    tags: ["swift","concurrency","async-sequence"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("async-sequence-and-streams.md");
    },
  },
  {
    slug: "legacy-concurrency",
    title: "Legacy Concurrency",
    description:
      "The concurrency tools that predate Swift Concurrency — GCD, locks, OperationQueue, and Combine — which you'll still regularly encounter in existing codebases, third-party libraries, and Apple documentation.",
    tags: ["swift","concurrency","gcd","combine"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("legacy-concurrency.md");
    },
  },
  {
    slug: "swiftui-fundamentals",
    title: "SwiftUI Fundamentals",
    description:
      "The View protocol, why views are descriptions rather than objects, the core content views (Text, Image, SF Symbols, Label), view modifiers and why their order matters, color and font systems, and Xcode Previews.",
    tags: ["swiftui","fundamentals"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("swiftui-fundamentals.md");
    },
  },
  {
    slug: "layout",
    title: "Layout",
    description:
      "SwiftUI's layout system: the three basic stacks, spacing and alignment, .frame() and .padding(), the parent-proposes/child-decides negotiation model underlying all of it, shapes and clipping, safe areas, and GeometryReader.",
    tags: ["swiftui","layout"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("layout.md");
    },
  },
  {
    slug: "state-management",
    title: "State Management",
    description:
      "SwiftUI's property wrappers for managing state: @State, @Binding, @Observable/@Bindable, @Environment, persistence wrappers, @FocusState, legacy ObservableObject literacy, and the deeper mechanics of view identity.",
    tags: ["swiftui","state-management"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("state-management.md");
    },
  },
  {
    slug: "lists-and-collections",
    title: "Lists and Collections",
    description:
      "List (rows, sections, styles, swipe actions, selection), search and pull-to-refresh, ScrollView/LazyVStack/grids for custom scrolling layouts, programmatic scroll control, and what actually causes scrolling performance problems.",
    tags: ["swiftui","lists"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("lists-and-collections.md");
    },
  },
  {
    slug: "navigation-and-presentation",
    title: "Navigation and Presentation",
    description:
      "SwiftUI's navigation system (NavigationStack, value-based navigation, split views, tabs) and its presentation mechanisms (sheets, full screen covers, popovers, alerts, toolbars, context menus).",
    tags: ["swiftui","navigation"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("navigation-and-presentation.md");
    },
  },
  {
    slug: "forms-and-input",
    title: "Forms and Input",
    description:
      "SwiftUI's Form container paired with the full input-control toolkit: text entry, secure entry, toggles, sliders, pickers, buttons, validation patterns, and keyboard handling.",
    tags: ["swiftui","forms"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("forms-and-input.md");
    },
  },
  {
    slug: "animation",
    title: "Animation",
    description:
      "The full animation toolkit: implicit and explicit animation, curves and springs, transitions, matchedGeometryEffect, the newer phase and keyframe animators, custom Animatable conformance, and practical debugging.",
    tags: ["swiftui","animation"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("animation.md");
    },
  },
  {
    slug: "drawing-and-custom-graphics",
    title: "Drawing and Custom Graphics",
    description:
      "SwiftUI's vector drawing toolkit: Path and custom Shape conformance, stroking and filling, the immediate-mode Canvas API, time-driven drawing with TimelineView, geometry-aware effects, and Metal-backed shaders.",
    tags: ["swiftui","graphics","drawing"],
    publishedAt: "2026-08-08",
    get content() {
      return loadBody("drawing-and-custom-graphics.md");
    },
  },
  {
    slug: "swiftui-architecture-and-internals",
    title: "SwiftUI Architecture and Internals",
    description:
      "How SwiftUI actually works under the hood: ViewBuilder and TupleView, AnyView's real cost, custom ViewModifier and PreferenceKey for upward data flow, the Layout protocol, and diagnosing body invalidation storms.",
    tags: ["swiftui", "architecture", "performance"],
    publishedAt: "2026-08-15",
    get content() {
      return loadBody("swiftui-architecture-and-internals.md");
    },
  },
  {
    slug: "liquid-glass-and-modern-design",
    title: "Liquid Glass and Modern Design",
    description:
      "Apple's modern cross-platform material and design language: .glassEffect() and GlassEffectContainer, glass morphing, where glass is and isn't appropriate, accessibility fallbacks, SF Symbols 7, and building a design token system.",
    tags: ["swiftui", "liquid-glass", "design"],
    publishedAt: "2026-08-15",
    get content() {
      return loadBody("liquid-glass-and-modern-design.md");
    },
  },
  {
    slug: "multiplatform-swiftui",
    title: "Multiplatform SwiftUI",
    description:
      "Targeting multiple Apple platforms from a shared codebase: size classes and adaptive layout, iPad multitasking, macOS scene types and menu bar apps, Mac Catalyst vs. native macOS, watchOS and tvOS, and sharing code cleanly across platforms.",
    tags: ["swiftui", "multiplatform", "macos", "watchos", "tvos"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("multiplatform-swiftui.md");
    },
  },
  {
    slug: "document-based-apps",
    title: "Document-Based Apps",
    description:
      "First-class SwiftUI support for document apps via DocumentGroup and the FileDocument/ReferenceFileDocument protocols: value vs. reference document models, async streaming I/O, snapshot-based saving, custom UTType declarations, and multi-format support.",
    tags: ["swiftui", "documents", "filedocument"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("document-based-apps.md");
    },
  },
  {
    slug: "uikit-essentials",
    title: "UIKit Essentials",
    description:
      "Why UIKit still matters in a SwiftUI-first world: the view controller and view lifecycle, programmatic UI vs. Interface Builder, delegates and target-action, the responder chain, gesture recognizers, view controller containment, and UIScene.",
    tags: ["uikit", "essentials"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("uikit-essentials.md");
    },
  },
  {
    slug: "auto-layout",
    title: "Auto Layout",
    description:
      "UIKit's constraint-based layout system as a system of linear equations: NSLayoutConstraint and anchors, priorities, content hugging and compression resistance, UIStackView, safe area handling, and debugging conflicts and ambiguity.",
    tags: ["uikit", "auto-layout"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("auto-layout.md");
    },
  },
  {
    slug: "table-and-collection-views",
    title: "Table and Collection Views",
    description:
      "UITableView and UICollectionView's data source/delegate patterns, cell reuse and self-sizing, UICollectionViewFlowLayout and custom layouts, prefetching for scroll performance, and animated inserts, deletes, and reorders.",
    tags: ["uikit", "table-view", "collection-view"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("table-and-collection-views.md");
    },
  },
  {
    slug: "uikit-and-swiftui-interop",
    title: "UIKit and SwiftUI Interop",
    description:
      "Bridging the two frameworks in both directions: UIViewRepresentable and UIViewControllerRepresentable, the Coordinator pattern, hosting SwiftUI inside UIKit with UIHostingController, UIHostingConfiguration for cells, and cross-boundary data flow.",
    tags: ["uikit", "swiftui", "interop"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("uikit-and-swiftui-interop.md");
    },
  },
  {
    slug: "networking-fundamentals",
    title: "Networking Fundamentals",
    description:
      "URLSession with async/await: building requests and query strings, sending JSON, authentication headers, distinguishing transport errors from HTTP errors, decoding responses, loading/error UI states, AsyncImage, file uploads and downloads, and client-side secrets.",
    tags: ["networking", "urlsession"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("networking-fundamentals.md");
    },
  },
  {
    slug: "advanced-networking",
    title: "Advanced Networking",
    description:
      "Production-grade networking: a reusable generic API client, retry with exponential backoff, request cancellation and deduplication, caching and ETags, background transfers, WebSockets and SSE, certificate pinning, ATS, connectivity monitoring, and OAuth 2.0 with PKCE.",
    tags: ["networking", "urlsession", "advanced"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("advanced-networking.md");
    },
  },
  {
    slug: "swiftdata",
    title: "SwiftData",
    description:
      "Apple's modern, Swift-native persistence framework: @Model and ModelContainer, @Query, relationships and #Predicate, sorting, background work with @ModelActor, schema migrations, CloudKit sync, and performance debugging.",
    tags: ["swiftdata", "persistence"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("swiftdata.md");
    },
  },
  {
    slug: "core-data",
    title: "Core Data",
    description:
      "Apple's original object-graph persistence framework: the managed object model, NSPersistentContainer, contexts and concurrency, NSFetchedResultsController, batch operations, faulting, migration, persistent history, and CloudKit integration.",
    tags: ["core-data", "persistence"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("core-data.md");
    },
  },
  {
    slug: "other-persistence",
    title: "Other Persistence",
    description:
      "Lighter-weight persistence tools: UserDefaults, App Groups, Codable JSON files, the Documents/Caches/temp directory structure, FileManager, the Keychain and biometric-gated items, data protection classes, GRDB/SQLite, and cache eviction design.",
    tags: ["persistence", "userdefaults", "keychain"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("other-persistence.md");
    },
  },
  {
    slug: "cloudkit-and-sync",
    title: "CloudKit and Sync",
    description:
      "CloudKit's core concepts and APIs directly: containers/databases/records, change-token-based incremental sync, subscriptions, CKShare collaboration, CKSyncEngine, conflict resolution, offline-first architecture, debugging, and CRDTs.",
    tags: ["cloudkit", "sync", "persistence"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("cloudkit-and-sync.md");
    },
  },
  {
    slug: "architecture-foundations",
    title: "Architecture Foundations",
    description:
      "Why big views are hard to maintain, splitting code into model, logic, and presentation, MVVM with @Observable, what belongs in a view model, service and repository layers, DTO-to-domain mapping, making wrong states impossible, screen state as an enum, and folder structure that scales.",
    tags: ["architecture", "mvvm"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("architecture-foundations.md");
    },
  },
  {
    slug: "architecture-patterns",
    title: "Architecture Patterns",
    description:
      "MVC, MVP, MVVM, VIPER, Clean Architecture, unidirectional data flow and the Composable Architecture, the Coordinator pattern vs. SwiftUI navigation, use cases, choosing an architecture for your team size, and a side-by-side comparison of all the patterns.",
    tags: ["architecture", "tca", "viper"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("architecture-patterns.md");
    },
  },
  {
    slug: "dependency-injection",
    title: "Dependency Injection",
    description:
      "Why singletons hurt testing, initializer and @Environment injection, protocols and closures, the composition root, swift-dependencies, injecting a Clock to control time, and concurrency-safe dependencies.",
    tags: ["architecture", "dependency-injection", "testing"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("dependency-injection.md");
    },
  },
  {
    slug: "modularization",
    title: "Modularization",
    description:
      "When to split an app into modules, local Swift packages, feature module boundaries, interface and implementation modules, module-level dependency inversion, the package access level, circular dependencies, linking trade-offs, and Tuist and Bazel.",
    tags: ["architecture", "modularization", "swift-package-manager"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("modularization.md");
    },
  },
  {
    slug: "app-lifecycle-and-system-integration",
    title: "App Lifecycle and System Integration",
    description:
      "The App protocol and scene phases, Info.plist and entitlements, custom URL schemes vs. universal links, Handoff, state restoration, BGAppRefreshTask/BGProcessingTask, background execution budgets, Core Spotlight, and SharePlay.",
    tags: ["platform", "lifecycle", "background-tasks"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("app-lifecycle-and-system-integration.md");
    },
  },
  {
    slug: "notifications",
    title: "Notifications",
    description:
      "Requesting permission, local notifications and triggers, categories and interactive actions, APNs and device tokens, handling taps, silent push, service and content extensions, threading, time-sensitive/critical alerts, and debugging delivery.",
    tags: ["platform", "notifications", "push"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("notifications.md");
    },
  },
  {
    slug: "app-intents-and-siri",
    title: "App Intents and Siri",
    description:
      "The unified App Intents framework powering Siri, Shortcuts, Spotlight, and widgets: AppIntent, parameters and summaries, AppEntity/EntityQuery, AppEnum, App Shortcuts, snippets, relevance, long-running intents, and testing.",
    tags: ["platform", "app-intents", "siri"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("app-intents-and-siri.md");
    },
  },
  {
    slug: "widgetkit-and-live-activities",
    title: "WidgetKit and Live Activities",
    description:
      "Widget anatomy, TimelineProvider and reload budgets, widget families, AppIntentConfiguration, interactive widgets, Lock Screen/StandBy/Control Center surfaces, and the full Live Activities lifecycle with Dynamic Island and push updates.",
    tags: ["platform", "widgetkit", "live-activities"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("widgetkit-and-live-activities.md");
    },
  },
  {
    slug: "app-extensions",
    title: "App Extensions",
    description:
      "The sandboxed extension process model: share and action extensions, custom keyboards, photo editing extensions, Safari web extensions, SFSafariViewController, App Clips, Network Extension, and extension memory limits.",
    tags: ["platform", "extensions", "app-clips"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("app-extensions.md");
    },
  },
  {
    slug: "location-and-maps",
    title: "Location and Maps",
    description:
      "Location permission tiers, the async CLLocationUpdate/CLMonitor APIs, accuracy authorization, significant location change, background location, SwiftUI Map with annotations and overlays, camera control, local search, directions, and geocoding.",
    tags: ["platform", "corelocation", "mapkit"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("location-and-maps.md");
    },
  },
  {
    slug: "camera-photos-and-media",
    title: "Camera, Photos, and Media",
    description:
      "Privacy-preserving photo picking, PhotoKit and limited library access, AVCaptureSession photo/video/frame capture, AVPlayer playback, AVAudioSession and AVAudioEngine, recording, export and composition, HLS streaming, and Now Playing integration.",
    tags: ["platform", "avfoundation", "photokit"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("camera-photos-and-media.md");
    },
  },
  {
    slug: "storekit-and-monetization",
    title: "StoreKit and Monetization",
    description:
      "In-app purchase product types, StoreKit 2's async product fetching and purchasing, Transaction.updates and verification, SubscriptionStoreView, subscription groups and offers, server notifications, receipt validation, restoring, refunds, and testing.",
    tags: ["platform", "storekit", "monetization"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("storekit-and-monetization.md");
    },
  },
  {
    slug: "other-system-frameworks",
    title: "Other System Frameworks",
    description:
      "A broad survey: HealthKit, EventKit, Contacts, Core Motion, Core Bluetooth (central and peripheral), AccessorySetupKit, Core NFC, PassKit/Apple Pay and Wallet, CarPlay templates, Screen Time APIs, Transferable, Translation, and App Attest.",
    tags: ["platform", "healthkit", "corebluetooth"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("other-system-frameworks.md");
    },
  },
  {
    slug: "foundation-models",
    title: "Foundation Models",
    description:
      "Apple's on-device LLM: checking availability, sessions, instructions and prompts, context windows, streaming, @Generable and @Guide, tools, images, cloud routing to Claude and Gemini, warm-up, guardrails, prompt injection, and LoRA adapters.",
    tags: ["ai", "foundation-models", "on-device"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("foundation-models.md");
    },
  },
  {
    slug: "core-ml-and-custom-models",
    title: "Core ML and Custom Models",
    description:
      "Running your own ML models on-device: adding a .mlpackage, predictions, converting with coremltools, quantization and palettization, compute units, the performance report, stateful models, Create ML, Core AI, and MLX.",
    tags: ["ai", "core-ml", "on-device"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("core-ml-and-custom-models.md");
    },
  },
  {
    slug: "vision-speech-and-language",
    title: "Vision, Speech, and Language",
    description:
      "Understanding images, speech, text, and sound: the modern Vision API, OCR, barcodes, faces, feature prints, document scanning, SpeechAnalyzer, Natural Language, Sound Analysis, and Image Playground.",
    tags: ["ai", "vision", "speech"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("vision-speech-and-language.md");
    },
  },
  {
    slug: "ai-assisted-development",
    title: "AI-Assisted Development",
    description:
      "Using AI to build apps: Xcode coding intelligence, choosing on-device or cloud models, agents, generating SwiftUI, localization, Claude Code, CLAUDE.md, MCP servers, and reviewing generated Swift for concurrency bugs, retain cycles, and secrets.",
    tags: ["ai", "tooling", "claude-code"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("ai-assisted-development.md");
    },
  },
  {
    slug: "core-animation-and-graphics",
    title: "Core Animation and Graphics",
    description:
      "The layer tree and CALayer, implicit vs. explicit animation, CABasicAnimation/CAKeyframeAnimation, CATransaction, CADisplayLink, the commit cycle, offscreen rendering costs, Core Graphics drawing and PDF generation, Core Image filters and custom CIKernel filters, and color management including wide gamut and HDR/EDR.",
    tags: ["graphics", "core-animation", "core-graphics"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("core-animation-and-graphics.md");
    },
  },
  {
    slug: "metal",
    title: "Metal",
    description:
      "Apple's low-level GPU programming framework: devices, command queues, and buffers, building a render pipeline, Metal Shading Language basics, vertex and fragment shaders, compute shaders, Metal Performance Shaders, MetalFX upscaling, and profiling with the Metal debugger.",
    tags: ["graphics", "metal", "gpu"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("metal.md");
    },
  },
  {
    slug: "realitykit-arkit-and-visionos",
    title: "RealityKit, ARKit, and visionOS",
    description:
      "RealityKit's entity-component model and RealityView, USDZ assets and Reality Composer Pro, shader graph materials, ARKit world tracking, plane/image/object detection, scene reconstruction and occlusion, face and body tracking, and visionOS windows, volumes, immersive spaces, ornaments, gaze/pinch input, hand tracking, and performance budgets.",
    tags: ["graphics", "realitykit", "arkit", "visionos"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("realitykit-arkit-and-visionos.md");
    },
  },
  {
    slug: "testing-foundations",
    title: "Testing Foundations",
    description:
      "Why tests exist, Swift Testing's @Test/#expect/#require, @Suite grouping, parameterized and zipped/cross-product tests, test traits and tags, .serialized/.timeLimit, testing async code, confirmation() for callbacks, writing testable code, mock services, XCTest literacy, and incremental migration.",
    tags: ["testing", "swift-testing", "xctest"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("testing-foundations.md");
    },
  },
  {
    slug: "advanced-testing",
    title: "Advanced Testing",
    description:
      "Test doubles beyond mocks, testing actors and isolated code, TestClock, snapshot testing setup and cross-device considerations, testing SwiftUI/@Observable state and App Intents, contract testing, recorded fixtures vs. live integration, honest code coverage, property-based and mutation testing, test plans, and sharding.",
    tags: ["testing", "swift-testing", "snapshot-testing"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("advanced-testing.md");
    },
  },
  {
    slug: "ui-testing",
    title: "UI Testing",
    description:
      "XCUITest setup and recording, element queries and predicates, accessibility identifiers as stable selectors, waiting strategies, handling system permission dialogs, launch arguments for test-only state, the page object pattern, diagnosing flaky UI tests, the accessibility audit API, and screenshots in test reports.",
    tags: ["testing", "xcuitest", "ui-testing"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("ui-testing.md");
    },
  },
  {
    slug: "debugging",
    title: "Debugging",
    description:
      "Breakpoints and actions, the variables view and stepping, LLDB's po/p/v and expression, async/task debugging, reading common crash types and watchdog terminations, the View Hierarchy and Memory Graph debuggers, Zombie Objects, sanitizers, Logger/os_log, Console.app, symbolication, sysdiagnose, and debugging extensions.",
    tags: ["debugging", "lldb", "instruments"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("debugging.md");
    },
  },
  {
    slug: "performance",
    title: "Performance",
    description:
      "Measuring before optimizing, Instruments' Time Profiler/Allocations/Leaks/Animation Hitches/System Trace, os_signpost, launch time phases, scroll performance and frame budgets, ProMotion, image downsampling, main thread hangs, jetsam limits, binary size, MetricKit, Organizer, energy impact, and performance budgets.",
    tags: ["performance", "instruments", "metrickit"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("performance.md");
    },
  },
  {
    slug: "accessibility",
    title: "Accessibility",
    description:
      "VoiceOver navigation and testing, accessibility labels/values/hints/traits, grouping and custom actions, the rotor, accessibilityRepresentation, reading order, Dynamic Type, Reduce Motion/Transparency, Increase Contrast, Differentiate Without Color, tap target sizes, Switch/Voice Control, Full Keyboard Access, the Accessibility Inspector, Nutrition Labels, and media captions.",
    tags: ["accessibility", "voiceover", "dynamic-type"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("accessibility.md");
    },
  },
  {
    slug: "localization",
    title: "Localization",
    description:
      "String Catalogs and extraction, translation states and comments, pluralization, device/width variations, AttributedString/Markdown localization, FormatStyle for dates and numbers, locale-aware sorting, RTL layout and mirroring, non-Gregorian calendars, time zone/DST edge cases, pseudolocalization, App Store metadata, and AI-assisted localization.",
    tags: ["localization", "internationalization", "rtl"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("localization.md");
    },
  },
  {
    slug: "xcode-and-the-build-system",
    title: "Xcode and the Build System",
    description:
      "Xcode shortcuts, targets and schemes, build settings and .xcconfig files, Run Script phases, Debug vs. Release, optimization levels, strict concurrency, fixing slow builds, compilation modes, explicit modules, and #Playground.",
    tags: ["xcode", "build-system", "tooling"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("xcode-and-the-build-system.md");
    },
  },
  {
    slug: "swift-package-manager",
    title: "Swift Package Manager",
    description:
      "Adding packages, version rules and Package.resolved, creating packages, targets and products, resources and Bundle.module, local packages, choosing dependencies, binary targets, build and command plugins, traits, private registries, and leaving CocoaPods.",
    tags: ["spm", "package-manager", "dependencies"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("swift-package-manager.md");
    },
  },
  {
    slug: "git-and-collaboration",
    title: "Git and Collaboration",
    description:
      "Staging and commits, branches and merging, rebasing, .pbxproj conflicts, .gitignore for Xcode, pull requests and reviews, commit messages that explain why, Git hooks, trunk-based vs. release branches, and open-source contributions.",
    tags: ["git", "collaboration", "version-control"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("git-and-collaboration.md");
    },
  },
  {
    slug: "code-quality-tooling",
    title: "Code Quality Tooling",
    description:
      "Tools that keep code clean: SwiftLint and custom rules, SwiftFormat and swift-format, Periphery for dead code, Danger-Swift for pull requests, warnings-as-errors, and Sourcery for generated code.",
    tags: ["tooling", "swiftlint", "code-quality"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("code-quality-tooling.md");
    },
  },
  {
    slug: "ci-cd",
    title: "CI/CD",
    description:
      "Building and testing every change: why CI matters, xcodebuild, result bundles, GitHub Actions and Xcode Cloud, caching, Fastlane and match, TestFlight uploads, the App Store Connect API, build numbers, dSYMs, faster pipelines, and merge queues.",
    tags: ["ci-cd", "fastlane", "github-actions"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("ci-cd.md");
    },
  },
  {
    slug: "code-signing-and-distribution",
    title: "Code Signing and Distribution",
    description:
      "How signing works and how apps get to users: certificates, App IDs and profiles, automatic vs. manual signing, entitlements, fixing signing errors, archives and export, ad hoc and enterprise distribution, MDM, and EU distribution.",
    tags: ["code-signing", "distribution", "provisioning"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("code-signing-and-distribution.md");
    },
  },
  {
    slug: "app-store",
    title: "App Store",
    description:
      "Getting an app into the App Store: the app record, ASO, screenshots, the privacy manifest and required reason APIs, privacy labels, TestFlight, submitting and review, rejections, phased release, rating prompts, product pages, and app size.",
    tags: ["app-store", "app-review", "testflight"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("app-store.md");
    },
  },
  {
    slug: "security-and-privacy",
    title: "Security and Privacy",
    description:
      "Keeping apps and users safe: threat modeling, secrets and the Keychain, CryptoKit, the Secure Enclave, Face ID, certificate pinning, jailbreak checks, App Tracking Transparency, ad attribution, secure logging, supply chain risk, GDPR and CCPA, and data minimization.",
    tags: ["security", "privacy", "cryptokit"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("security-and-privacy.md");
    },
  },
  {
    slug: "observability-and-analytics",
    title: "Observability and Analytics",
    description:
      "Seeing what happens in production: event design, type-safe analytics, batching, crash reports and Organizer, crash-free sessions, hang rate, MetricKit, distributed tracing, feature flags, kill switches, A/B testing, and flag cleanup.",
    tags: ["observability", "analytics", "feature-flags"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("observability-and-analytics.md");
    },
  },
  {
    slug: "swift-outside-ios",
    title: "Swift Outside iOS",
    description:
      "Swift beyond the app: Vapor and Hummingbird servers, SwiftNIO event loops, sharing models with a server, Swift on Linux, the static Linux SDK, WebAssembly, Embedded Swift, swift-log and friends, and cross-platform UI choices.",
    tags: ["swift", "server-side", "vapor"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("swift-outside-ios.md");
    },
  },
  {
    slug: "engineering-craft",
    title: "Engineering Craft",
    description:
      "The skills around the code: design docs, ADRs, code review, estimation, tech debt, mobile incident response, rollback vs. hotfix, blameless postmortems, mentoring, interviews, portfolios, staying current, open source, and technical writing.",
    tags: ["career", "engineering-craft", "mentoring"],
    publishedAt: "2026-08-16",
    get content() {
      return loadBody("engineering-craft.md");
    },
  },
];

export function getAllArticles(): Article[] {
  return articles;
}

export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}

/**
 * Tags broad enough to be worth offering as a filter, most-used first.
 *
 * Most tags are article-specific keywords used exactly once ("gcd",
 * "voiceover", "testflight") — invaluable for search, but useless as filter
 * chips, since each would narrow to a single article. The threshold keeps
 * only the handful that behave like real categories.
 */
export function getFilterTags(minArticles = 3): string[] {
  const counts = new Map<string, number>();
  articles.forEach((article) => {
    article.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  });

  return [...counts.entries()]
    .filter(([, count]) => count >= minArticles)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}
