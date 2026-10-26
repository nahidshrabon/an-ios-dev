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
      "The features behind SwiftUI's view syntax and @State: building a result builder and a property wrapper from scratch, with buildBlock, buildOptional, buildEither, buildArray, wrappedValue, projectedValue, and composition.",
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
      "Code that writes code at compile time: freestanding and attached macros (member, peer, accessor, extension), how @Observable uses them, SwiftSyntax, writing and testing a macro package, Expand Macro, and build-time cost.",
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
      "Beneath the collection protocols, Codable in depth (keys, custom decoding, polymorphic JSON, strategies), and modern standard-library tools for regex, formatting, units, rich text, time, observation, and locking.",
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
      "Swift close to the metal: unsafe pointers, scoped buffer access, safe Span and InlineArray, ContiguousArray, ManagedBuffer, memory rebinding, and calling C, C++, and Objective-C.",
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
      "How Swift itself changes: the Swift Evolution process, upcoming feature flags and language modes, and what Swift 6.0 through 6.4 changed, mostly around concurrency.",
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
      "Why async/await replaced callbacks, writing and calling async functions, what happens at a suspension point, Task and the .task modifier, Task.sleep, the cooperative thread pool, why blocking it is dangerous, Task.detached, and priority.",
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
      "Swift's structured concurrency: async let for a few parallel tasks, task groups for many, error propagation and result order, cooperative cancellation, task-local values, and turning old callbacks into async functions with continuations.",
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
      "Actors, Swift's tool against data races: reentrancy and how to handle it, isolated parameters, @MainActor and its inference, global actors, nonisolated and its variants, @concurrent, main actor by default, custom executors, and isolated conformances.",
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
      "Sendable, the protocol for values that are safe to share across isolation domains: automatic and manual conformance, @Sendable closures, @unchecked Sendable, sending, region-based isolation, common Swift 6 errors, and migrating to Swift 6 mode.",
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
      "AsyncSequence, the async version of Sequence: for await, AsyncStream for wrapping callbacks and delegates, buffering policies, writing your own async sequence, swift-async-algorithms operators, and Observations.",
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
      "The tools before Swift concurrency that you'll still meet in real code: GCD queues and QoS, DispatchGroup, OperationQueue, locks, deadlocks, and Combine, plus how to migrate each one to async/await.",
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
      "SwiftUI basics: the View protocol, views as descriptions, Text, Image, SF Symbols, and Label, view modifiers and why their order matters, colors, fonts, Dynamic Type, Previews, and dark mode.",
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
      "How SwiftUI layout works: stacks, spacers, alignment, padding and frames, the parent-proposes/child-decides rule behind all of it, shapes and clipping, safe areas, ViewThatFits, GeometryReader, and its newer alternatives.",
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
      "Where SwiftUI state lives and how it flows: @State, @Binding, @Observable and @Bindable, @Environment and @Entry, @AppStorage, @SceneStorage, @FocusState, the older ObservableObject system, and how view identity keeps or resets state.",
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
      "Lists and scrolling: List rows, identity, sections and styles, delete, move, and swipe actions, selection, search and pull to refresh, lazy stacks and grids, scroll position and snapping, and what makes scrolling slow.",
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
      "Moving between screens and showing things on top: NavigationStack, value-based links, paths, deep links, split views, tabs, sheets and detents, full screen covers, popovers, alerts, dialogs, toolbars, context menus, and zoom transitions.",
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
      "Forms and the controls that go in them: Form and Section, text and password fields, keyboards and AutoFill, toggles, sliders, steppers, pickers, date and color pickers, button roles and glass styles, validation, and moving focus between fields.",
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
      "Animating state changes in SwiftUI: implicit and explicit animation, curves and springs, transitions, matchedGeometryEffect, phase and keyframe animators, Animatable shapes, transactions, Reduce Motion, and fixing animations that jump.",
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
      "Drawing your own graphics: Path and custom shapes, fill and stroke, trim, Canvas for fast drawing, TimelineView for time-based drawing, visualEffect, GeometryEffect, SwiftUI Metal shaders, and blend modes.",
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
      "How SwiftUI works under the hood: ViewBuilder and TupleView, branch identity, why AnyView costs more, custom ViewModifiers, PreferenceKey and Anchor for data that flows up, the Layout protocol, equatable(), and finding views that redraw too often.",
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
      "Apple's Liquid Glass design in SwiftUI: glassEffect and GlassEffectContainer, glass morphing, glass in bars, concentric corners, when not to use glass, accessibility fallbacks, SF Symbols 7, custom symbols, Icon Composer, and design tokens.",
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
      "One SwiftUI app on many platforms: size classes and adaptive layout, iPad windows, macOS scenes, menu bar apps and commands, openWindow, Mac Catalyst vs. native macOS, watchOS and the Digital Crown, tvOS focus, and sharing code cleanly.",
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
      "Building document apps in SwiftUI: DocumentGroup, FileDocument vs. ReferenceFileDocument, snapshots for safe background saving, undo-based change tracking, async document I/O, custom UTType declarations, and opening and saving several formats.",
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
      "The core of UIKit and why it still matters: the view controller lifecycle, frames and bounds, programmatic UI vs. Interface Builder, delegates and target-action, the responder chain, gestures, containment, custom transitions, UIScene, and traits.",
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
      "UIKit's constraint-based layout: constraints as equations, NSLayoutConstraint and anchors, priorities, content hugging and compression resistance, UIStackView, the safe area and other layout guides, fixing conflicts and ambiguity, and self-sizing.",
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
      "UIKit lists and grids: data sources and delegates, cell reuse and self-sizing cells, flow and compositional layouts, headers and footers, prefetching, custom layouts, index paths, and safe animated updates with diffable data sources.",
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
      "Mixing UIKit and SwiftUI in both directions: UIViewRepresentable and UIViewControllerRepresentable, the Coordinator, context and environment, UIHostingController, sizing across the boundary, SwiftUI cells with UIHostingConfiguration, two-way data flow, and cleanup.",
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
      "Talking to servers with URLSession and async/await: HTTP basics, URLRequest and safe query strings, sending JSON, bearer tokens, transport vs. HTTP errors, decoding, loading and error states, AsyncImage, uploads and downloads, and why app secrets aren't secret.",
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
      "Production networking: a reusable API client, retries with backoff and jitter, cancellation, request coalescing, caching and ETags, background transfers, WebSockets and server-sent events, streaming, certificate pinning, ATS, connectivity, and OAuth with PKCE.",
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
      "Saving data with SwiftData: @Model, ModelContainer, @Query, insert, delete, and save, attributes, relationships and inverses, #Predicate, dynamic sorting, background work with @ModelActor, migrations, CloudKit sync, sharing with widgets, and performance.",
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
      "Working with Core Data, the engine under SwiftData: the managed object model, NSPersistentContainer, contexts and perform, NSPredicate, NSFetchedResultsController, parent/child contexts, batch requests, faulting, migrations, history tracking, and CloudKit sync.",
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
      "Lighter storage tools and security: UserDefaults, App Groups, Codable JSON files, the standard folders, FileManager, the Keychain and biometric-protected items, file data protection, GRDB and SQLite, full-text search with FTS5, and cache cleanup rules.",
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
      "CloudKit underneath automatic sync: containers, databases, and records, zones and change tokens, subscriptions and silent pushes, sharing with CKShare, CKSyncEngine, conflict resolution, offline-first design, debugging sync, and CRDTs.",
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
      "How an app fits into the system: scene phases, background and foreground, Info.plist and entitlements, URL schemes and universal links, routing, Handoff, state restoration, background tasks and their budgets, Spotlight, and SharePlay.",
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
      "Local and push notifications: permission, triggers, actions, APNs auth and device tokens, handling taps, silent pushes, service and content extensions, grouping, interruption levels, and debugging delivery step by step.",
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
      "Exposing app actions to the system with App Intents: intents and parameters, entities and queries, App Shortcuts and phrases, snippets, newer relevance, paging, sync, long-running, and execution APIs, testing, controls, Visual Intelligence, and moving from SiriKit.",
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
      "Building widgets and Live Activities: timelines and reload budgets, sizes, configurable and interactive widgets, Lock Screen, StandBy, and controls, sharing data with the app, rendering limits, and the Live Activity lifecycle with the Dynamic Island and push updates.",
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
      "How extensions run and what each type does: share and action extensions, custom keyboards, photo editing, Safari web extensions, choosing a web view, App Clips and their invocations, Network Extension, and the tight memory limits.",
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
      "Core Location and MapKit: permission levels, live updates, approximate location, geofences, low-power and background tracking, SwiftUI maps with pins, overlays, and camera control, place search, directions, Look Around, and geocoding.",
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
      "Photos, camera, and media: private photo picking, PhotoKit and limited access, a custom camera with photo, video, and live-frame capture, playback, audio sessions, AVAudioEngine, recording, export and editing, HLS streaming, MusicKit and ShazamKit, and Lock Screen controls.",
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
      "Selling digital content with StoreKit 2: product types, loading and buying products, entitlements and verification, ready-made paywalls, subscription groups and offers, server notifications and validation, restores, refunds, testing, and common purchase bugs.",
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
      "A practical tour of more system frameworks: HealthKit, EventKit, Contacts, Core Motion, Bluetooth central and peripheral, AccessorySetupKit, Core NFC, Apple Pay and Wallet, CarPlay, Screen Time, Transferable, Translation, and App Attest, and the privacy patterns they share.",
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
      "The layer level under every view: CALayer, implicit and explicit layer animation, CATransaction, CADisplayLink, the commit cycle, offscreen rendering, Core Graphics images and PDFs, Core Image filters and custom kernels, wide color, and HDR.",
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
      "Apple's low-level GPU API: when to use it, devices, queues, and buffers, a complete render pipeline with MTKView, Metal Shading Language, vertex, fragment, and compute shaders, Metal Performance Shaders, MetalFX upscaling, and GPU debugging.",
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
      "3D and spatial apps: RealityKit entities, components, and systems, RealityView, USDZ and Reality Composer Pro, ARKit tracking, planes, images, and occlusion, face and body tracking, and visionOS scenes, input, hand tracking, spatial capture, and performance.",
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
      "Swift Testing from the ground up: why tests exist, #expect and #require, suites, parameterized tests, traits, tags, async tests, confirmation(), designing testable code with pure functions and injected dependencies, test doubles, reading XCTest, and migrating step by step.",
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
      "Beyond the basics: kinds of test doubles, testing actors and time, snapshot tests, SwiftUI and @Observable state, App Intents, contract tests, fixtures vs. live tests, honest coverage, property-based and mutation testing, test plans, and sharding.",
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
      "Testing the app like a user with XCUITest: queries and stable identifiers, waiting instead of sleeping, system alerts, launch arguments for clean test state, page objects, fixing flaky tests, accessibility audits, and screenshots and videos in reports.",
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
      "The debugging toolbox: breakpoints and actions, LLDB's v, p, po, and expression, async and concurrency debugging, reading common crashes and watchdog kills, view and memory debuggers, sanitizers, Logger and Console, symbolication, sysdiagnose, and extensions.",
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
      "Measuring and fixing performance: Instruments tools, signposts, launch time, scrolling and frame budgets, ProMotion, image downsampling, hangs, memory limits, app size, MetricKit and the Organizer, energy, and performance budgets in CI.",
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
      "Making the app work for everyone: testing with VoiceOver, labels, values, hints, traits, grouping, actions, the rotor, custom controls, reading order, Dynamic Type, motion, contrast, and color settings, tap targets, Voice Control, keyboard access, tools, Nutrition Labels, and media.",
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
