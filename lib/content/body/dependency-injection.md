**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 47.1 Why Singletons Hurt Testability 🟢

A **dependency** is something a type needs to do its job. For example, a view model needs a service to load recipes. A **singleton** is a class that has **only one instance**, and that instance is global, so any code can reach it from anywhere. This is what a singleton looks like:

```swift
final class NetworkService {
    static let shared = NetworkService()   // the one and only instance
    private init() {}                      // nobody else can create another one

    func fetchRecipes() async throws -> [Recipe] {
        // real network call
        []
    }
}

// Any code can use it, from anywhere:
let recipes = try await NetworkService.shared.fetchRecipes()
```

It is convenient, because you never have to pass it around. But it makes code hard to test:

```swift
// PROBLEM: this view model secretly depends on one global object.
// There is no way to give it a fake service in a test.
final class RecipeListViewModel {
    func loadRecipes() async {
        let recipes = try? await NetworkService.shared.fetchRecipes()
    }
}
```

Singletons are not "bad" by themselves. The problem is **hidden dependencies**:

- **Hidden:** nothing in `RecipeListViewModel`'s interface says it needs `NetworkService`. You only find out by reading the code inside.
- **Impossible to replace:** a test would call the real network, unless you change the shared global object itself.
- **Fragile:** shared global state can make tests affect each other, especially when they run at the same time or in a different order.

**Everything else in this section solves this one problem:** dependencies that are hidden and can't be replaced. The solution is called **dependency injection (DI)**: give a type its dependencies from outside, instead of letting it reach for them.

---

## 47.2 Initializer Injection 🟢

The simplest form of DI: **pass the dependencies into the initializer**. They become a visible, required part of the type's interface.

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

// In the app:  RecipeListViewModel(recipeService: DefaultRecipeService())
// In a test:   RecipeListViewModel(recipeService: FakeRecipeService(returning: [...]))
```

This fixes the problem from 47.1:

- **Visible:** anyone who reads `init` sees what the view model depends on.
- **Replaceable:** the app passes the real service, and a test passes a fake one. No global state changes.

**Almost every other DI technique in this section is a variation of this idea.**

---

## 47.3 Environment-Based Injection in SwiftUI 🟡

**The problem.** With initializer injection (47.2), a dependency must be passed through every view on the way down, even views that do not use it. This is called **prop drilling**:

```swift
struct RootView: View {
    let recipeService: RecipeService
    var body: some View { RecipeListScreen(recipeService: recipeService) }
}

struct RecipeListScreen: View {
    let recipeService: RecipeService          // only passes it along
    var body: some View { RecipeRow(recipeService: recipeService) }
}

struct RecipeRow: View {
    let recipeService: RecipeService          // finally uses it
    // ...
}
```

`RecipeListScreen` does not use the service. It only passes it down, and the longer the chain, the more extra code.

**Why the name?** The term comes from React (a JavaScript UI library), where values passed into a component are called **props**. Here, `recipeService` is the prop. The value has to go through every layer to reach the view that needs it, like a drill bit going down through layers of rock. That is "drilling".

**The solution.** SwiftUI's **environment** is a shared box of values that SwiftUI passes down the view tree for you. You put a value in once near the top, and any child view can take it out. Setting up your own value takes four steps:

```swift
// Step 1: a key. It gives the value a default.
private struct RecipeServiceKey: EnvironmentKey {
    static let defaultValue: RecipeService = DefaultRecipeService()
}

// Step 2: add a named slot to the environment: \.recipeService
extension EnvironmentValues {
    var recipeService: RecipeService {
        get { self[RecipeServiceKey.self] }
        set { self[RecipeServiceKey.self] = newValue }
    }
}

// Step 3: put a value in, once, near the top
ContentView().environment(\.recipeService, DefaultRecipeService())

// Step 4: read it in any child view, with no passing
struct RecipeListView: View {
    @Environment(\.recipeService) private var recipeService
}
```

- **Steps 1 and 2** are setup. You write them once for each dependency. They create a slot named `\.recipeService`.
- **Step 3** fills the slot. Every view below this point can read it.
- **Step 4** reads the slot. The view in between never has to know about it.

**The same swap as before.** To use a fake, put it in the slot instead. This is common in SwiftUI previews and tests:

```swift
#Preview {
    RecipeListView()
        .environment(\.recipeService, FakeRecipeService(returning: []))
}
```

This works like `@Environment(\.modelContext)` for SwiftData (section 41.4).

**The trade-off:** the dependency is less visible. Any child view can use an environment value, and the views in between do not show it. So many teams use `@Environment` for a few dependencies that are needed almost everywhere, and use **initializer injection for a type's main dependencies**.

---

## 47.4 Protocols for Swappable Services 🟡

To replace a dependency, the type must depend on a **protocol**, not on a concrete class. We have used this idea before (`APIClient` in section 40.1, `RecipeService` in section 45.5). This is the general technique behind it.

```swift
protocol RecipeService {
    func getRecipes() async throws -> [Recipe]
}

// The real one
final class DefaultRecipeService: RecipeService {
    func getRecipes() async throws -> [Recipe] { /* real network call */ [] }
}

// A fake one for tests: returns fixed data, no network
final class FakeRecipeService: RecipeService {
    let recipesToReturn: [Recipe]
    init(returning recipes: [Recipe]) { recipesToReturn = recipes }
    func getRecipes() async throws -> [Recipe] { recipesToReturn }
}
```

Together with initializer injection (47.2), this is what makes swapping possible:

- A view model that needs a concrete `DefaultRecipeService` can only ever use that one class.
- A view model that needs the `RecipeService` **protocol** can use any type that follows it, including a **fake** (also called a test double) that returns fixed data with no network.

---

## 47.5 Closure-Based Dependencies Instead of Protocols 🟡

For a dependency with only one or two methods, a **closure** (or a struct that holds closures) can replace a protocol with less code. Protocols are still the common choice, but this is a good lighter option.

```swift
// With a protocol: more code, but familiar
protocol RecipeFetcher {
    func fetch() async throws -> [Recipe]
}

// With a closure: less code, good for one method
struct RecipeFetching {
    var fetch: () async throws -> [Recipe]
}

let production = RecipeFetching(fetch: { try await apiClient.getRecipes() })
let testing = RecipeFetching(fetch: {
    [Recipe(id: UUID(), title: "Test", minutesToCook: 5)]
})
```

A struct of closures can be swapped just like a protocol, but you don't need a separate named type for every version (production, test, preview). This idea is central to `swift-dependencies` (47.7).

Use closures for **small, narrow dependencies**. Use protocols for **larger service interfaces**, where they are easier to find and read.

---

## 47.6 The Composition Root 🟡

The **composition root** is the one place in your app where the real (concrete) dependencies are chosen and connected. It is usually near the app's entry point. Everything else just receives what it needs.

```swift
@main
struct RecipeApp: App {
    // The composition root: the ONE place where concrete types are chosen
    let recipeService: RecipeService = DefaultRecipeService()
    let apiClient: APIClient = DefaultAPIClient(baseURL: productionBaseURL)

    var body: some Scene {
        WindowGroup {
            RecipeListView(viewModel: RecipeListViewModel(recipeService: recipeService))
        }
    }
}
```

Without a composition root, the choice "which `RecipeService` do we use?" can be spread all over the code. Each place might choose differently.

With one, **only this place knows the concrete types**. The rest of the app (view models, services) uses only protocols (47.4). If you want to change a real implementation, you change it in one known location. The root is usually the `App` type, or a small `AppDependencies` type that it owns.

---

## 47.7 swift-dependencies and @Dependency 🟡

**`swift-dependencies`** is a popular library for DI. TCA uses it too (the `@Dependency` from 46.8), but you can use it alone in any Swift project, including plain SwiftUI and MVVM apps.

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
    // no initializer parameter: @Dependency finds the service for you
}
```

You register one value for each situation: `liveValue` in the app, `testValue` in tests (and `previewValue` in SwiftUI previews). The library picks the right one automatically.

Here is how the three main techniques compare:

| Technique | How it gets the dependency | Works in | Downside |
|---|---|---|---|
| Initializer injection (47.2) | Passed to `init` | Any Swift code | Every type in between must pass it along |
| `@Environment` (47.3) | Read from the SwiftUI environment | SwiftUI views only | Dependency is less visible |
| `swift-dependencies` (47.7) | `@Dependency` finds it | Any Swift code | An extra library to learn |

`swift-dependencies` is a middle way. It resolves dependencies without passing them through every `init`, like `@Environment`, but it works outside SwiftUI as well. It also swaps in `testValue` and `previewValue` for you, with no setup at each place of use.

---

## 47.8 Injecting a Clock to Control Time 🟡

**Time is a dependency too.** Code that calls `Date()` or `Task.sleep()` directly is hard to test. A test can't wait a real 30 seconds for a timeout, and it can't control what "now" is when it checks the result.

```swift
// A small clock for this lesson (Swift also has its own Clock protocol)
protocol AppClock {
    func now() -> Date
    func sleep(for duration: Duration) async throws
}

// The real clock, used in the app
struct SystemClock: AppClock {
    func now() -> Date { Date() }
    func sleep(for duration: Duration) async throws { try await Task.sleep(for: duration) }
}

// A fake clock, used in tests
final class TestClock: AppClock {
    var currentTime: Date
    init(currentTime: Date) { self.currentTime = currentTime }
    func now() -> Date { currentTime }
    func sleep(for duration: Duration) async throws { /* move currentTime forward at once, no real waiting */ }
}
```

If the code uses an injected clock instead of `Date()` and `Task.sleep()`, a test can use `TestClock`. It reports a fixed "now", and `sleep(for:)` finishes at once.

This makes fast, repeatable tests possible for time-based code, like the retry with exponential backoff from section 40.3, or a cache expiry check from section 43.12. The test does not need to run as long as the real code would.

---

## 47.9 Concurrency-Aware Dependency Design 🔴

Dependencies are often used from several tasks at the same time. So they must be safe for Swift's concurrency rules (Part 2). A badly designed dependency can cause **data races** (two tasks changing the same data at once) or `Sendable` errors.

```swift
// A dependency designed for concurrency: it must be Sendable
protocol RecipeService: Sendable {
    func getRecipes() async throws -> [Recipe]
}

// If the real implementation keeps changing data (like a cache),
// protect that data. An actor is often a good choice:
actor CachingRecipeService: RecipeService {
    private var cache: [Recipe] = []
    func getRecipes() async throws -> [Recipe] {
        if cache.isEmpty { cache = try await fetchFromNetwork() }
        return cache
    }
    private func fetchFromNetwork() async throws -> [Recipe] { [] }
}
```

**Marking the protocol `Sendable`** (section 20) says: "any type that follows this must be safe to use from many tasks at once."

- **No changing data (stateless):** this is easy, and nothing more is needed.
- **Changing data (like a cache):** the data needs protection. An **`actor`** makes sure only one task at a time touches it, as in `CachingRecipeService`.

This connects DI back to the actor and structured concurrency lessons in Part 2.

---

## Summary

| Concept | Key Idea | Purpose |
|---|---|---|
| The problem | Hidden dependencies you can't replace | Why singletons make testing hard |
| Initializer injection | Pass dependencies to `init` | Visible and replaceable |
| `@Environment` | Put it in once, read it in any child view | No prop drilling, but SwiftUI only |
| Protocols | Depend on a protocol, not a class | Lets you swap the real and fake versions |
| Closures | A struct of closures | Less code for small dependencies |
| Composition root | One place chooses the real types | The rest of the app only sees protocols |
| `swift-dependencies` | `@Dependency` with live and test values | Works anywhere, and swaps for tests |
| Clock | Inject time instead of `Date()` | Fast, repeatable time tests |
| Concurrency | `Sendable` and actors | Avoid data races |
