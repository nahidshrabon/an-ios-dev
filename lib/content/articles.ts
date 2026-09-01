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
  {
    slug: "swiftui-architecture-and-internals",
    title: "SwiftUI Architecture and Internals",
    description:
      "How SwiftUI actually works under the hood: ViewBuilder and TupleView, AnyView's real cost, custom ViewModifier and PreferenceKey for upward data flow, the Layout protocol, and diagnosing body invalidation storms.",
    tags: ["swiftui", "architecture", "performance"],
    publishedAt: "2026-08-15",
    content: loadBody("swiftui-architecture-and-internals.md"),
  },
  {
    slug: "liquid-glass-and-modern-design",
    title: "Liquid Glass and Modern Design",
    description:
      "Apple's modern cross-platform material and design language: .glassEffect() and GlassEffectContainer, glass morphing, where glass is and isn't appropriate, accessibility fallbacks, SF Symbols 7, and building a design token system.",
    tags: ["swiftui", "liquid-glass", "design"],
    publishedAt: "2026-08-15",
    content: loadBody("liquid-glass-and-modern-design.md"),
  },
  {
    slug: "multiplatform-swiftui",
    title: "Multiplatform SwiftUI",
    description:
      "Targeting multiple Apple platforms from a shared codebase: size classes and adaptive layout, iPad multitasking, macOS scene types and menu bar apps, Mac Catalyst vs. native macOS, watchOS and tvOS, and sharing code cleanly across platforms.",
    tags: ["swiftui", "multiplatform", "macos", "watchos", "tvos"],
    publishedAt: "2026-08-16",
    content: loadBody("multiplatform-swiftui.md"),
  },
  {
    slug: "document-based-apps",
    title: "Document-Based Apps",
    description:
      "First-class SwiftUI support for document apps via DocumentGroup and the FileDocument/ReferenceFileDocument protocols: value vs. reference document models, async streaming I/O, snapshot-based saving, custom UTType declarations, and multi-format support.",
    tags: ["swiftui", "documents", "filedocument"],
    publishedAt: "2026-08-16",
    content: loadBody("document-based-apps.md"),
  },
  {
    slug: "uikit-essentials",
    title: "UIKit Essentials",
    description:
      "Why UIKit still matters in a SwiftUI-first world: the view controller and view lifecycle, programmatic UI vs. Interface Builder, delegates and target-action, the responder chain, gesture recognizers, view controller containment, and UIScene.",
    tags: ["uikit", "essentials"],
    publishedAt: "2026-08-16",
    content: loadBody("uikit-essentials.md"),
  },
  {
    slug: "auto-layout",
    title: "Auto Layout",
    description:
      "UIKit's constraint-based layout system as a system of linear equations: NSLayoutConstraint and anchors, priorities, content hugging and compression resistance, UIStackView, safe area handling, and debugging conflicts and ambiguity.",
    tags: ["uikit", "auto-layout"],
    publishedAt: "2026-08-16",
    content: loadBody("auto-layout.md"),
  },
  {
    slug: "table-and-collection-views",
    title: "Table and Collection Views",
    description:
      "UITableView and UICollectionView's data source/delegate patterns, cell reuse and self-sizing, UICollectionViewFlowLayout and custom layouts, prefetching for scroll performance, and animated inserts, deletes, and reorders.",
    tags: ["uikit", "table-view", "collection-view"],
    publishedAt: "2026-08-16",
    content: loadBody("table-and-collection-views.md"),
  },
  {
    slug: "uikit-and-swiftui-interop",
    title: "UIKit and SwiftUI Interop",
    description:
      "Bridging the two frameworks in both directions: UIViewRepresentable and UIViewControllerRepresentable, the Coordinator pattern, hosting SwiftUI inside UIKit with UIHostingController, UIHostingConfiguration for cells, and cross-boundary data flow.",
    tags: ["uikit", "swiftui", "interop"],
    publishedAt: "2026-08-16",
    content: loadBody("uikit-and-swiftui-interop.md"),
  },
  {
    slug: "networking-fundamentals",
    title: "Networking Fundamentals",
    description:
      "URLSession with async/await: building requests and query strings, sending JSON, authentication headers, distinguishing transport errors from HTTP errors, decoding responses, loading/error UI states, AsyncImage, file uploads and downloads, and client-side secrets.",
    tags: ["networking", "urlsession"],
    publishedAt: "2026-08-16",
    content: loadBody("networking-fundamentals.md"),
  },
  {
    slug: "advanced-networking",
    title: "Advanced Networking",
    description:
      "Production-grade networking: a reusable generic API client, retry with exponential backoff, request cancellation and deduplication, caching and ETags, background transfers, WebSockets and SSE, certificate pinning, ATS, connectivity monitoring, and OAuth 2.0 with PKCE.",
    tags: ["networking", "urlsession", "advanced"],
    publishedAt: "2026-08-16",
    content: loadBody("advanced-networking.md"),
  },
  {
    slug: "swiftdata",
    title: "SwiftData",
    description:
      "Apple's modern, Swift-native persistence framework: @Model and ModelContainer, @Query, relationships and #Predicate, sorting, background work with @ModelActor, schema migrations, CloudKit sync, and performance debugging.",
    tags: ["swiftdata", "persistence"],
    publishedAt: "2026-08-16",
    content: loadBody("swiftdata.md"),
  },
  {
    slug: "core-data",
    title: "Core Data",
    description:
      "Apple's original object-graph persistence framework: the managed object model, NSPersistentContainer, contexts and concurrency, NSFetchedResultsController, batch operations, faulting, migration, persistent history, and CloudKit integration.",
    tags: ["core-data", "persistence"],
    publishedAt: "2026-08-16",
    content: loadBody("core-data.md"),
  },
  {
    slug: "other-persistence",
    title: "Other Persistence",
    description:
      "Lighter-weight persistence tools: UserDefaults, App Groups, Codable JSON files, the Documents/Caches/temp directory structure, FileManager, the Keychain and biometric-gated items, data protection classes, GRDB/SQLite, and cache eviction design.",
    tags: ["persistence", "userdefaults", "keychain"],
    publishedAt: "2026-08-16",
    content: loadBody("other-persistence.md"),
  },
  {
    slug: "cloudkit-and-sync",
    title: "CloudKit and Sync",
    description:
      "CloudKit's core concepts and APIs directly: containers/databases/records, change-token-based incremental sync, subscriptions, CKShare collaboration, CKSyncEngine, conflict resolution, offline-first architecture, debugging, and CRDTs.",
    tags: ["cloudkit", "sync", "persistence"],
    publishedAt: "2026-08-16",
    content: loadBody("cloudkit-and-sync.md"),
  },
  {
    slug: "architecture-foundations",
    title: "Architecture Foundations",
    description:
      "Why large views become unmaintainable, separating model/logic/presentation, MVVM with @Observable, what belongs in a view model, service/repository layers, DTO-to-domain mapping, illegal states unrepresentable, screen state as an enum, and project structure that scales.",
    tags: ["architecture", "mvvm"],
    publishedAt: "2026-08-16",
    content: loadBody("architecture-foundations.md"),
  },
  {
    slug: "architecture-patterns",
    title: "Architecture Patterns",
    description:
      "MVC, MVP, MVVM, VIPER, Clean Architecture, unidirectional data flow and the Composable Architecture, the Coordinator pattern vs. SwiftUI-native navigation, use cases/interactors, and choosing an architecture for a given team size.",
    tags: ["architecture", "tca", "viper"],
    publishedAt: "2026-08-16",
    content: loadBody("architecture-patterns.md"),
  },
  {
    slug: "dependency-injection",
    title: "Dependency Injection",
    description:
      "Why singletons hurt testability, initializer and @Environment-based injection, protocol and closure-based abstractions, the composition root, swift-dependencies, injecting a Clock for deterministic tests, and concurrency-aware dependency design.",
    tags: ["architecture", "dependency-injection", "testing"],
    publishedAt: "2026-08-16",
    content: loadBody("dependency-injection.md"),
  },
  {
    slug: "modularization",
    title: "Modularization",
    description:
      "When to split an app into modules, local Swift packages, feature module boundaries, the interface/implementation split, module-level dependency inversion, the package access level, circular dependencies, linking trade-offs, and Tuist/Bazel tooling.",
    tags: ["architecture", "modularization", "swift-package-manager"],
    publishedAt: "2026-08-16",
    content: loadBody("modularization.md"),
  },
  {
    slug: "app-lifecycle-and-system-integration",
    title: "App Lifecycle and System Integration",
    description:
      "The App protocol and scene phases, Info.plist and entitlements, custom URL schemes vs. universal links, Handoff, state restoration, BGAppRefreshTask/BGProcessingTask, background execution budgets, Core Spotlight, and SharePlay.",
    tags: ["platform", "lifecycle", "background-tasks"],
    publishedAt: "2026-08-16",
    content: loadBody("app-lifecycle-and-system-integration.md"),
  },
  {
    slug: "notifications",
    title: "Notifications",
    description:
      "Requesting permission, local notifications and triggers, categories and interactive actions, APNs and device tokens, handling taps, silent push, service and content extensions, threading, time-sensitive/critical alerts, and debugging delivery.",
    tags: ["platform", "notifications", "push"],
    publishedAt: "2026-08-16",
    content: loadBody("notifications.md"),
  },
  {
    slug: "app-intents-and-siri",
    title: "App Intents and Siri",
    description:
      "The unified App Intents framework powering Siri, Shortcuts, Spotlight, and widgets: AppIntent, parameters and summaries, AppEntity/EntityQuery, AppEnum, App Shortcuts, snippets, relevance, long-running intents, and testing.",
    tags: ["platform", "app-intents", "siri"],
    publishedAt: "2026-08-16",
    content: loadBody("app-intents-and-siri.md"),
  },
  {
    slug: "widgetkit-and-live-activities",
    title: "WidgetKit and Live Activities",
    description:
      "Widget anatomy, TimelineProvider and reload budgets, widget families, AppIntentConfiguration, interactive widgets, Lock Screen/StandBy/Control Center surfaces, and the full Live Activities lifecycle with Dynamic Island and push updates.",
    tags: ["platform", "widgetkit", "live-activities"],
    publishedAt: "2026-08-16",
    content: loadBody("widgetkit-and-live-activities.md"),
  },
  {
    slug: "app-extensions",
    title: "App Extensions",
    description:
      "The sandboxed extension process model: share and action extensions, custom keyboards, photo editing extensions, Safari web extensions, SFSafariViewController, App Clips, Network Extension, and extension memory limits.",
    tags: ["platform", "extensions", "app-clips"],
    publishedAt: "2026-08-16",
    content: loadBody("app-extensions.md"),
  },
  {
    slug: "location-and-maps",
    title: "Location and Maps",
    description:
      "Location permission tiers, the async CLLocationUpdate/CLMonitor APIs, accuracy authorization, significant location change, background location, SwiftUI Map with annotations and overlays, camera control, local search, directions, and geocoding.",
    tags: ["platform", "corelocation", "mapkit"],
    publishedAt: "2026-08-16",
    content: loadBody("location-and-maps.md"),
  },
  {
    slug: "camera-photos-and-media",
    title: "Camera, Photos, and Media",
    description:
      "Privacy-preserving photo picking, PhotoKit and limited library access, AVCaptureSession photo/video/frame capture, AVPlayer playback, AVAudioSession and AVAudioEngine, recording, export and composition, HLS streaming, and Now Playing integration.",
    tags: ["platform", "avfoundation", "photokit"],
    publishedAt: "2026-08-16",
    content: loadBody("camera-photos-and-media.md"),
  },
  {
    slug: "storekit-and-monetization",
    title: "StoreKit and Monetization",
    description:
      "In-app purchase product types, StoreKit 2's async product fetching and purchasing, Transaction.updates and verification, SubscriptionStoreView, subscription groups and offers, server notifications, receipt validation, restoring, refunds, and testing.",
    tags: ["platform", "storekit", "monetization"],
    publishedAt: "2026-08-16",
    content: loadBody("storekit-and-monetization.md"),
  },
  {
    slug: "other-system-frameworks",
    title: "Other System Frameworks",
    description:
      "A broad survey: HealthKit, EventKit, Contacts, Core Motion, Core Bluetooth (central and peripheral), AccessorySetupKit, Core NFC, PassKit/Apple Pay and Wallet, CarPlay templates, Screen Time APIs, Transferable, Translation, and App Attest.",
    tags: ["platform", "healthkit", "corebluetooth"],
    publishedAt: "2026-08-16",
    content: loadBody("other-system-frameworks.md"),
  },
  {
    slug: "foundation-models",
    title: "Foundation Models",
    description:
      "Apple's on-device LLM: availability checks, LanguageModelSession, instructions vs. prompts, context windows, streaming, @Generable/@Guide guided generation, tool calling, multimodal prompts, cloud routing to Claude and Gemini, latency budgeting, guardrails, prompt injection defense, and LoRA adapters.",
    tags: ["ai", "foundation-models", "on-device"],
    publishedAt: "2026-08-16",
    content: loadBody("foundation-models.md"),
  },
  {
    slug: "core-ml-and-custom-models",
    title: "Core ML and Custom Models",
    description:
      "Running custom, narrow-task ML models on-device: adding a .mlpackage to a project, making predictions, converting models with coremltools, quantization and palettization, compute unit selection, the performance report, stateful models, Create ML, Core AI, and MLX.",
    tags: ["ai", "core-ml", "on-device"],
    publishedAt: "2026-08-16",
    content: loadBody("core-ml-and-custom-models.md"),
  },
  {
    slug: "vision-speech-and-language",
    title: "Vision, Speech, and Language",
    description:
      "Apple's perceptual and language frameworks: the modern async Vision API, OCR, barcode detection, face/body detection, image feature prints, document scanning, SpeechAnalyzer transcription, Natural Language tokenization/tagging and embeddings, Sound Analysis, and Image Playground/Genmoji.",
    tags: ["ai", "vision", "speech"],
    publishedAt: "2026-08-16",
    content: loadBody("vision-speech-and-language.md"),
  },
  {
    slug: "ai-assisted-development",
    title: "AI-Assisted Development",
    description:
      "AI as part of the development process: Xcode 27 coding intelligence, on-device vs. cloud model routing, agentic multi-file workflows, generating SwiftUI views, AI-assisted localization, Xcode tool plugins, Claude Code, writing a CLAUDE.md, MCP servers, and reviewing generated Swift for concurrency bugs, retain cycles, and secrets.",
    tags: ["ai", "tooling", "claude-code"],
    publishedAt: "2026-08-16",
    content: loadBody("ai-assisted-development.md"),
  },
  {
    slug: "core-animation-and-graphics",
    title: "Core Animation and Graphics",
    description:
      "The layer tree and CALayer, implicit vs. explicit animation, CABasicAnimation/CAKeyframeAnimation, CATransaction, CADisplayLink, the commit cycle, offscreen rendering costs, Core Graphics drawing and PDF generation, Core Image filters and custom CIKernel filters, and color management including wide gamut and HDR/EDR.",
    tags: ["graphics", "core-animation", "core-graphics"],
    publishedAt: "2026-08-16",
    content: loadBody("core-animation-and-graphics.md"),
  },
  {
    slug: "metal",
    title: "Metal",
    description:
      "Apple's low-level GPU programming framework: devices, command queues, and buffers, building a render pipeline, Metal Shading Language basics, vertex and fragment shaders, compute shaders, Metal Performance Shaders, MetalFX upscaling, and profiling with the Metal debugger.",
    tags: ["graphics", "metal", "gpu"],
    publishedAt: "2026-08-16",
    content: loadBody("metal.md"),
  },
  {
    slug: "realitykit-arkit-and-visionos",
    title: "RealityKit, ARKit, and visionOS",
    description:
      "RealityKit's entity-component model and RealityView, USDZ assets and Reality Composer Pro, shader graph materials, ARKit world tracking, plane/image/object detection, scene reconstruction and occlusion, face and body tracking, and visionOS windows, volumes, immersive spaces, ornaments, gaze/pinch input, hand tracking, and performance budgets.",
    tags: ["graphics", "realitykit", "arkit", "visionos"],
    publishedAt: "2026-08-16",
    content: loadBody("realitykit-arkit-and-visionos.md"),
  },
  {
    slug: "testing-foundations",
    title: "Testing Foundations",
    description:
      "Why tests exist, Swift Testing's @Test/#expect/#require, @Suite grouping, parameterized and zipped/cross-product tests, test traits and tags, .serialized/.timeLimit, testing async code, confirmation() for callbacks, writing testable code, mock services, XCTest literacy, and incremental migration.",
    tags: ["testing", "swift-testing", "xctest"],
    publishedAt: "2026-08-16",
    content: loadBody("testing-foundations.md"),
  },
  {
    slug: "advanced-testing",
    title: "Advanced Testing",
    description:
      "Test doubles beyond mocks, testing actors and isolated code, TestClock, snapshot testing setup and cross-device considerations, testing SwiftUI/@Observable state and App Intents, contract testing, recorded fixtures vs. live integration, honest code coverage, property-based and mutation testing, test plans, and sharding.",
    tags: ["testing", "swift-testing", "snapshot-testing"],
    publishedAt: "2026-08-16",
    content: loadBody("advanced-testing.md"),
  },
  {
    slug: "ui-testing",
    title: "UI Testing",
    description:
      "XCUITest setup and recording, element queries and predicates, accessibility identifiers as stable selectors, waiting strategies, handling system permission dialogs, launch arguments for test-only state, the page object pattern, diagnosing flaky UI tests, the accessibility audit API, and screenshots in test reports.",
    tags: ["testing", "xcuitest", "ui-testing"],
    publishedAt: "2026-08-16",
    content: loadBody("ui-testing.md"),
  },
  {
    slug: "debugging",
    title: "Debugging",
    description:
      "Breakpoints and actions, the variables view and stepping, LLDB's po/p/v and expression, async/task debugging, reading common crash types and watchdog terminations, the View Hierarchy and Memory Graph debuggers, Zombie Objects, sanitizers, Logger/os_log, Console.app, symbolication, sysdiagnose, and debugging extensions.",
    tags: ["debugging", "lldb", "instruments"],
    publishedAt: "2026-08-16",
    content: loadBody("debugging.md"),
  },
  {
    slug: "performance",
    title: "Performance",
    description:
      "Measuring before optimizing, Instruments' Time Profiler/Allocations/Leaks/Animation Hitches/System Trace, os_signpost, launch time phases, scroll performance and frame budgets, ProMotion, image downsampling, main thread hangs, jetsam limits, binary size, MetricKit, Organizer, energy impact, and performance budgets.",
    tags: ["performance", "instruments", "metrickit"],
    publishedAt: "2026-08-16",
    content: loadBody("performance.md"),
  },
  {
    slug: "accessibility",
    title: "Accessibility",
    description:
      "VoiceOver navigation and testing, accessibility labels/values/hints/traits, grouping and custom actions, the rotor, accessibilityRepresentation, reading order, Dynamic Type, Reduce Motion/Transparency, Increase Contrast, Differentiate Without Color, tap target sizes, Switch/Voice Control, Full Keyboard Access, the Accessibility Inspector, Nutrition Labels, and media captions.",
    tags: ["accessibility", "voiceover", "dynamic-type"],
    publishedAt: "2026-08-16",
    content: loadBody("accessibility.md"),
  },
  {
    slug: "localization",
    title: "Localization",
    description:
      "String Catalogs and extraction, translation states and comments, pluralization, device/width variations, AttributedString/Markdown localization, FormatStyle for dates and numbers, locale-aware sorting, RTL layout and mirroring, non-Gregorian calendars, time zone/DST edge cases, pseudolocalization, App Store metadata, and AI-assisted localization.",
    tags: ["localization", "internationalization", "rtl"],
    publishedAt: "2026-08-16",
    content: loadBody("localization.md"),
  },
  {
    slug: "xcode-and-the-build-system",
    title: "Xcode and the Build System",
    description:
      "Xcode navigation and shortcuts, targets/schemes/configurations, build settings and inheritance, .xcconfig files, build phases and run scripts, per-configuration Info.plist, generated asset symbols, Debug vs. Release, optimization levels, strict concurrency settings, diagnosing slow builds, whole-module vs. incremental compilation, explicit modules, and #Playground.",
    tags: ["xcode", "build-system", "tooling"],
    publishedAt: "2026-08-16",
    content: loadBody("xcode-and-the-build-system.md"),
  },
  {
    slug: "swift-package-manager",
    title: "Swift Package Manager",
    description:
      "Adding a package dependency, version rules and Package.resolved, creating your own package, Package.swift anatomy, package resources and bundles, local package development, evaluating dependencies, binary targets and XCFrameworks, build and command plugins, package traits, private registries, and migrating off CocoaPods.",
    tags: ["spm", "package-manager", "dependencies"],
    publishedAt: "2026-08-16",
    content: loadBody("swift-package-manager.md"),
  },
  {
    slug: "git-and-collaboration",
    title: "Git and Collaboration",
    description:
      "Commits/staging/history, branching and merging, rebasing and interactive rebase, resolving merge conflicts in Xcode project files, .gitignore for Xcode, pull requests and review etiquette, writing commit messages that explain why, Git hooks, trunk-based development vs. release branches, and contributing to open source.",
    tags: ["git", "collaboration", "version-control"],
    publishedAt: "2026-08-16",
    content: loadBody("git-and-collaboration.md"),
  },
  {
    slug: "code-quality-tooling",
    title: "Code Quality Tooling",
    description:
      "SwiftLint setup and rules, SwiftFormat/swift-format, writing custom lint rules, Periphery for dead code detection, Danger-Swift for PR automation, warnings-as-errors policy, and Sourcery for code generation.",
    tags: ["tooling", "swiftlint", "code-quality"],
    publishedAt: "2026-08-16",
    content: loadBody("code-quality-tooling.md"),
  },
  {
    slug: "ci-cd",
    title: "CI/CD",
    description:
      "Why CI matters for mobile, xcodebuild for building and testing, result bundles and xcresulttool, GitHub Actions and Xcode Cloud, caching DerivedData/SPM checkouts, Fastlane lanes/actions/match, automating TestFlight uploads, the App Store Connect API, automated version numbering, automatic dSYM upload, CI build time optimization, and merge queues/build sharding.",
    tags: ["ci-cd", "fastlane", "github-actions"],
    publishedAt: "2026-08-16",
    content: loadBody("ci-cd.md"),
  },
  {
    slug: "code-signing-and-distribution",
    title: "Code Signing and Distribution",
    description:
      "Certificates/App IDs/profiles, automatic vs. manual signing, entitlements and capability drift, why signing breaks and how to diagnose it, archiving and exporting a build, ad hoc and enterprise distribution, MDM/custom app distribution, and notarization/alternative marketplaces in the EU.",
    tags: ["code-signing", "distribution", "provisioning"],
    publishedAt: "2026-08-16",
    content: loadBody("code-signing-and-distribution.md"),
  },
  {
    slug: "app-store",
    title: "App Store",
    description:
      "Creating an app record, metadata/keywords/ASO, screenshots and app previews, the privacy manifest, required reason APIs, privacy nutrition labels, TestFlight testing, submitting for review, App Review Guidelines that matter most, handling rejection, phased release, responding to reviews, custom product pages/A/B testing, and app size limits.",
    tags: ["app-store", "app-review", "testflight"],
    publishedAt: "2026-08-16",
    content: loadBody("app-store.md"),
  },
  {
    slug: "security-and-privacy",
    title: "Security and Privacy",
    description:
      "Threat modeling, where secrets should and shouldn't live, CryptoKit hashing/HMAC/symmetric/public key cryptography, Secure Enclave-backed keys, biometrics, certificate pinning, jailbreak/tamper detection, App Tracking Transparency, SKAdNetwork/AdAttributionKit, secure logging, supply chain auditing, GDPR/CCPA, and data minimization.",
    tags: ["security", "privacy", "cryptokit"],
    publishedAt: "2026-08-16",
    content: loadBody("security-and-privacy.md"),
  },
  {
    slug: "observability-and-analytics",
    title: "Observability and Analytics",
    description:
      "Event taxonomy design, type-safe analytics events, batching/offline queueing, crash reporting and symbolication, reading crash reports in Organizer, crash-free session rate as an SLO, hang rate monitoring, ingesting MetricKit, distributed tracing, feature flags/remote config, kill switches, A/B testing assignment/exposure logging, and feature flag debt.",
    tags: ["observability", "analytics", "feature-flags"],
    publishedAt: "2026-08-16",
    content: loadBody("observability-and-analytics.md"),
  },
  {
    slug: "swift-outside-ios",
    title: "Swift Outside iOS",
    description:
      "Server-side Swift with Vapor and Hummingbird, SwiftNIO event loops, sharing model code between app and server, Swift on Linux, the static Linux SDK, Swift for WebAssembly, Embedded Swift for microcontrollers, swift-log/metrics/service-lifecycle, and cross-platform UI trade-offs.",
    tags: ["swift", "server-side", "vapor"],
    publishedAt: "2026-08-16",
    content: loadBody("swift-outside-ios.md"),
  },
  {
    slug: "engineering-craft",
    title: "Engineering Craft",
    description:
      "Technical design documents, architecture decision records, code review judgment, estimation and breaking down epics, managing tech debt, mobile incident response, rollback vs. hotfix, blameless postmortems, mentoring, interview loops and preparation, portfolios, staying current, open-source contribution, and technical writing.",
    tags: ["career", "engineering-craft", "mentoring"],
    publishedAt: "2026-08-16",
    content: loadBody("engineering-craft.md"),
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
