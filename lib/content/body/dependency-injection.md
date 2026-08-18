## 47.1 Why Singletons Hurt Testability

A singleton (`SomeService.shared`) is globally accessible, convenient to reach for from anywhere — and precisely because of that global reachability, it's genuinely difficult to substitute with a test double, since every piece of code that reaches for `.shared` is implicitly, invisibly coupled to that one specific global instance.

```swift
// PROBLEM: RecipeListViewModel is invisibly coupled to a specific global
// instance — there's no way to substitute a fake service for testing
// without actually modifying NetworkService.shared itself
final class RecipeListViewModel {
    func loadRecipes() async {
        let recipes = try? await NetworkService.shared.fetchRecipes()
    }
}
```

The core problem isn't that singletons are inherently "bad" as a general concept — it's that reaching for a globally-accessible instance from deep inside a type's implementation makes that dependency invisible from the outside (nothing in `RecipeListViewModel`'s public interface reveals it depends on `NetworkService`) and therefore impossible to substitute without actually mutating shared global state, which is fragile, hard to reason about, and can cause tests to interfere with each other if run concurrently or in different orders. This single problem — hidden, unsubstitutable dependencies — is what every technique in the rest of this section directly addresses.

---

## 47.2 Initializer Injection

The most direct, foundational DI technique: pass an object's dependencies into its initializer, making them an explicit, visible part of its public interface rather than something it reaches for internally.

```swift
final class RecipeListViewModel {
    private let recipeService: RecipeService

    init(recipeService: RecipeService) {
        self.recipeService = recipeService
    }

    func loadRecipes() async {
        let recipes = try? await recipeService.getRecipes()
    }
}

// Production: RecipeListViewModel(recipeService: DefaultRecipeService())
// Testing:    RecipeListViewModel(recipeService: FakeRecipeService(returning: [...]))
```

This is the single most important shift from 47.1's problem: `recipeService` is now a visible, required parameter of `RecipeListViewModel.init`, meaning anyone reading the type's public interface immediately sees exactly what it depends on, and any caller — production code or a test — can supply whatever conforming implementation is appropriate for that context, with no need to mutate shared global state at all. Nearly every other DI technique in this section is, at its core, a variation or refinement of this same fundamental idea.

---

## 47.3 Environment-Based Injection in SwiftUI

SwiftUI's own `@Environment` system provides a framework-native mechanism for injecting dependencies implicitly down a view hierarchy, avoiding the need to manually thread a dependency through every intermediate view's initializer.

```swift
private struct RecipeServiceKey: EnvironmentKey {
    static let defaultValue: RecipeService = DefaultRecipeService()
}

extension EnvironmentValues {
    var recipeService: RecipeService {
        get { self[RecipeServiceKey.self] }
        set { self[RecipeServiceKey.self] = newValue }
    }
}

// Injected once, at the root:
ContentView().environment(\.recipeService, DefaultRecipeService())

// Read anywhere in the hierarchy without manual threading:
struct RecipeListView: View {
    @Environment(\.recipeService) private var recipeService
}
```

This is a genuinely different mechanism from initializer injection (47.2) — rather than every intermediate view needing to accept and pass along a dependency it doesn't itself use (a pattern sometimes called "prop drilling"), `@Environment` lets a dependency be injected once near the root and read directly by any descendant that actually needs it, similar in spirit to how `@Environment(\.modelContext)` (section 41.4) delivers SwiftData's context without manual threading. The trade-off is that a dependency's requirement becomes less visible at a glance (any descendant view can silently depend on an environment value with no compiler-enforced declaration at intermediate levels), which is why many teams reserve `@Environment`-based injection for a smaller set of genuinely widely-needed dependencies, preferring explicit initializer injection for a type's primary, defining dependencies.

---

## 47.4 Protocol Abstractions for Swappable Services

Injecting a *protocol* type (rather than a concrete class) is what actually makes substitution possible — this is the same pattern seen throughout the curriculum (`APIClient`, section 40.1; `RecipeService`, section 45.5), formalized here as the general DI technique it represents.

```swift
protocol RecipeService {
    func getRecipes() async throws -> [Recipe]
}

final class DefaultRecipeService: RecipeService {
    func getRecipes() async throws -> [Recipe] { /* real network call */ [] }
}

final class FakeRecipeService: RecipeService {
    let recipesToReturn: [Recipe]
    init(returning recipes: [Recipe]) { recipesToReturn = recipes }
    func getRecipes() async throws -> [Recipe] { recipesToReturn }
}
```

Combined with initializer injection (47.2), depending on a protocol rather than a concrete type is what makes the substitution actually meaningful — a `RecipeListViewModel` that requires a concrete `DefaultRecipeService` can only ever be given exactly that one implementation, while one that requires the `RecipeService` protocol can be given any conforming type, including test-only fakes that return canned, deterministic data with no real network calls involved at all.

---

## 47.5 Closure-Based Dependencies Instead of Protocols

For a dependency with just one or two methods, a plain closure (or a struct bundling a few closures) can serve the same substitution purpose as a full protocol, with less ceremony — a lighter-weight alternative worth knowing about even though protocols remain the more common default.

```swift
// Protocol-based (more ceremony, but conventional and discoverable)
protocol RecipeFetcher {
    func fetch() async throws -> [Recipe]
}

// Closure-based (less ceremony, especially for a single-method dependency)
struct RecipeFetching {
    var fetch: () async throws -> [Recipe]
}

let production = RecipeFetching(fetch: { try await apiClient.getRecipes() })
let testing = RecipeFetching(fetch: { [Recipe(title: "Test")] })
```

A struct wrapping one or more closures achieves the exact same substitutability as a protocol with one or more methods, but without needing a separate named conforming type for every variant (production, test, preview) — this pattern is central to `swift-dependencies`' design (47.7) and is worth recognizing as a legitimate, lighter alternative to protocols specifically for smaller, narrowly-scoped dependencies, even though protocols remain the more broadly conventional and often more discoverable default for larger service interfaces.

---

## 47.6 The Composition Root

The "composition root" is the single, specific place in an app where all the concrete dependency implementations are actually chosen and wired together — typically near the app's entry point — keeping that decision-making out of the rest of the codebase entirely.

```swift
@main
struct RecipeApp: App {
    // The composition root: THE ONE place concrete types are chosen
    let recipeService: RecipeService = DefaultRecipeService()
    let apiClient: APIClient = DefaultAPIClient(baseURL: productionBaseURL)

    var body: some Scene {
        WindowGroup {
            RecipeListView(viewModel: RecipeListViewModel(recipeService: recipeService))
        }
    }
}
```

Without a clear composition root, decisions like "which concrete `RecipeService` implementation do we actually use" can end up scattered throughout the codebase, each call site independently choosing (and potentially inconsistently choosing) a concrete type — centralizing this decision in one place (typically the `App` type itself, or a small dedicated `AppDependencies` type it owns) means the rest of the codebase, all the way down through view models and services, deals exclusively in protocol types (47.4) and never itself decides which concrete implementation to instantiate, keeping that one significant decision auditable from a single, well-known location.

---

## 47.7 swift-dependencies and @Dependency

`swift-dependencies` is a popular, standalone Swift library (also used internally by TCA, section 46.8) providing a structured, `@Dependency`-based system for declaring, injecting, and overriding dependencies — usable independently of TCA in any Swift codebase, including plain SwiftUI/MVVM apps.

```swift
import Dependencies

private enum RecipeServiceKey: DependencyKey {
    static let liveValue: RecipeService = DefaultRecipeService()
    static let testValue: RecipeService = FakeRecipeService(returning: [])
}

extension DependencyValues {
    var recipeService: RecipeService {
        get { self[RecipeServiceKey.self] }
        set { self[RecipeServiceKey.self] = newValue }
    }
}

final class RecipeListViewModel {
    @Dependency(\.recipeService) var recipeService
    // no initializer parameter needed — @Dependency resolves it automatically
}
```

`swift-dependencies` sits conceptually between manual initializer injection (47.2, maximally explicit but requiring every intermediate type to thread dependencies through) and SwiftUI's `@Environment` (47.3, implicit but SwiftUI-only) — it provides environment-like implicit resolution (no need to manually pass dependencies through every initializer) while working in any Swift context (view models, services, even non-SwiftUI code), with built-in, first-class support for swapping in `testValue` automatically within a test context, and `previewValue` within SwiftUI previews, without any manual setup at each individual call site.

---

## 47.8 Injecting a Clock for Deterministic Time

Time itself is a dependency — code that calls `Date()` directly, or uses `Task.sleep()` with a real-world duration, is difficult to test deterministically, since a test can't easily "wait" for a real 30-second timeout or reliably control exactly what "now" is at assertion time.

```swift
protocol Clock {
    func now() -> Date
    func sleep(for duration: Duration) async throws
}

struct SystemClock: Clock {
    func now() -> Date { Date() }
    func sleep(for duration: Duration) async throws { try await Task.sleep(for: duration) }
}

final class TestClock: Clock {
    var currentTime: Date
    init(currentTime: Date) { self.currentTime = currentTime }
    func now() -> Date { currentTime }
    func sleep(for duration: Duration) async throws { /* advance currentTime instantly, no real delay */ }
}
```

By depending on an injected `Clock` protocol rather than calling `Date()`/`Task.sleep()` directly, a test can substitute a `TestClock` that reports a fixed, controllable "now" and resolves `sleep(for:)` instantly rather than actually waiting — this is precisely the technique that makes it practical to write a fast, deterministic test for time-dependent logic (like the exponential backoff retry pattern from section 40.3, or a cache expiration check from 43.12) without the test itself needing to run for the same real-world duration as the production code it's testing.

---

## 47.9 Concurrency-Aware Dependency Design 🔴

Injected dependencies used from concurrent contexts must themselves be designed with Swift's concurrency safety model (Part 2) in mind — a naively-designed dependency protocol can become a source of data races or `Sendable` conformance friction once actually used across actor boundaries.

```swift
// A dependency protocol designed with concurrency safety in mind:
protocol RecipeService: Sendable {
    func getRecipes() async throws -> [Recipe]
}

// If the concrete implementation holds mutable state, it needs its own
// isolation strategy — an actor is often the right choice:
actor CachingRecipeService: RecipeService {
    private var cache: [Recipe] = []
    func getRecipes() async throws -> [Recipe] {
        if cache.isEmpty { cache = try await fetchFromNetwork() }
        return cache
    }
    private func fetchFromNetwork() async throws -> [Recipe] { [] }
}
```

Marking the `RecipeService` protocol itself as `Sendable` (recall `Sendable`, section 20) is a deliberate design choice communicating "any conforming implementation must be safe to use across concurrency domains" — for a stateless implementation this is trivial, but for one that holds mutable internal state (like a caching layer), that state needs its own isolation strategy, with an `actor`-based implementation (as shown) being a natural, common choice, directly connecting this section's dependency injection principles back to the structured concurrency and actor isolation material from Part 2.

---

## Summary

| Concept | Key Idea | Purpose |
|---|---|---|
| The core problem | Hidden, unsubstitutable global dependencies | Why singletons undermine testability |
| Foundational technique | Constructor parameters | Explicit, visible, substitutable dependencies |
| SwiftUI-native injection | `@Environment`, custom `EnvironmentKey` | Implicit injection without manual threading |
| Substitutability | Depend on protocols, not concrete types | What actually enables swapping implementations |
| Lighter alternative | Closure/struct-based dependencies | Less ceremony for small, narrowly-scoped dependencies |
| Centralized decision-making | The composition root | One place where concrete types are chosen |
| Structured DI library | `swift-dependencies`, `@Dependency` | Implicit resolution usable beyond SwiftUI/TCA |
| Deterministic testing | Injected `Clock` protocol | Fast, controllable tests for time-dependent logic |
| Safety under concurrency | `Sendable` dependencies, actor-based implementations | Avoid data races when dependencies cross concurrency domains |
