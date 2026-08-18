## 45.1 Why Views Over 300 Lines Become Unmaintainable

A SwiftUI view file that grows unchecked — mixing network calls, business logic, formatting, navigation decisions, and layout all in one `body` — becomes progressively harder to read, test, and safely modify, regardless of how clean any individual line of code is.

```swift
// A warning sign, not a hard rule: when a single View's body and its
// directly-adjacent helper methods start doing meaningfully different
// KINDS of work (fetching, transforming, formatting, laying out), that's
// the signal to extract responsibilities — not merely to split by line count.
```

The "300 lines" figure itself is a rough heuristic, not a strict threshold — the real underlying problem isn't line count per se, it's *mixed responsibilities*: a view that both decides how to format a date for display and decides how to retry a failed network request is coupling two concerns that change for entirely different reasons and at entirely different rates. When a view accumulates enough of these unrelated concerns, every change (even a small formatting tweak) risks touching code involved in something completely unrelated, and every test of that view's logic requires standing up the entire tangled mess rather than testing each concern in isolation.

---

## 45.2 Separating Model, Logic, and Presentation

The foundational architectural move, underlying essentially every specific pattern covered in this and the next section, is separating three distinct concerns: the **model** (what the data *is*), business **logic** (what can be *done* with it and *when*), and **presentation** (how it's *displayed*).

```swift
// Model: pure data, no behavior about display or fetching
struct Recipe: Identifiable, Codable {
    let id: UUID
    var title: String
    var minutesToCook: Int
}

// Logic: what can be done, independent of any specific UI
struct RecipeValidator {
    static func isValid(_ recipe: Recipe) -> Bool {
        !recipe.title.isEmpty && recipe.minutesToCook > 0
    }
}

// Presentation: purely about layout and display, given already-prepared data
struct RecipeRow: View {
    let recipe: Recipe
    var body: some View {
        Text(recipe.title)
    }
}
```

This separation isn't about following a specific named pattern (MVVM, MVC, or otherwise) — it's a more fundamental discipline that any well-organized pattern builds on top of: a `View` should generally not contain business rules like validation logic, and a validation function should generally have no idea it's ever going to be displayed on screen. Every architectural pattern discussed in sections 45–46 is essentially a different specific way of organizing and connecting these three already-separated concerns.

---

## 45.3 MVVM with @Observable View Models

MVVM (Model-View-ViewModel) introduces a dedicated "view model" object that holds a view's presentation-ready state and orchestrates the logic needed to produce it, letting the `View` itself stay focused purely on layout — modern SwiftUI MVVM is built naturally around `@Observable` (section 25).

```swift
@Observable
final class RecipeListViewModel {
    private(set) var recipes: [Recipe] = []
    private(set) var isLoading = false
    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func loadRecipes() async {
        isLoading = true
        defer { isLoading = false }
        do {
            recipes = try await apiClient.getRecipes()
        } catch {
            // handle/report error
        }
    }
}

struct RecipeListView: View {
    @State private var viewModel: RecipeListViewModel

    init(apiClient: APIClient) {
        _viewModel = State(initialValue: RecipeListViewModel(apiClient: apiClient))
    }

    var body: some View {
        List(viewModel.recipes) { Text($0.title) }
            .task { await viewModel.loadRecipes() }
    }
}
```

The view model owns the async fetching logic, loading state, and error handling, exposing only already-prepared, display-ready state (`recipes`, `isLoading`) to the view — the view's `body` becomes almost entirely mechanical: lay out this data, call this method on this event, with essentially no independent judgment calls of its own. `@State private var viewModel` (holding the view model as reference-type state, since `@Observable` classes are reference types) is the standard modern pattern for a SwiftUI view owning its view model's lifetime.

---

## 45.4 What Belongs in a View Model and What Doesn't

A common MVVM mistake is either under-using the view model (leaving business logic scattered in the view) or over-using it (stuffing the view model with responsibilities that actually belong elsewhere, like raw network/persistence code) — drawing this boundary correctly is a genuine skill.

```swift
@Observable
final class RecipeListViewModel {
    // BELONGS: presentation-ready state, orchestration of when to call services
    private(set) var recipes: [Recipe] = []
    private let recipeService: RecipeService // a service layer, not raw URLSession

    // DOESN'T BELONG: raw URLRequest construction, JSONDecoder calls —
    // that's the service/repository layer's job (section 45.5), not the view model's
}
```

A useful test: a view model should generally *orchestrate* calls to lower-level services/repositories and shape their results into exactly what the view needs to display, but shouldn't itself contain raw `URLSession`/`JSONDecoder` calls, SwiftData query construction, or other genuinely low-level implementation details — those belong in a dedicated service or repository layer (45.5) that the view model depends on and coordinates, keeping the view model's own responsibility narrowly scoped to "prepare exactly what this screen needs to show, and react to what this screen's user does."

---

## 45.5 Service and Repository Layers

A service (or repository) layer sits between view models and raw data sources (network, persistence), providing a clean, domain-focused interface that hides the messy implementation details of *how* data is actually fetched or stored.

```swift
protocol RecipeService {
    func getRecipes() async throws -> [Recipe]
    func save(_ recipe: Recipe) async throws
}

final class DefaultRecipeService: RecipeService {
    private let apiClient: APIClient
    private let modelContext: ModelContext

    init(apiClient: APIClient, modelContext: ModelContext) {
        self.apiClient = apiClient
        self.modelContext = modelContext
    }

    func getRecipes() async throws -> [Recipe] {
        let remoteRecipes = try await apiClient.getRecipes()
        // sync remote data into local SwiftData store, return local source of truth
        return remoteRecipes
    }

    func save(_ recipe: Recipe) async throws {
        try await apiClient.createRecipe(recipe)
    }
}
```

This directly extends the API client protocol pattern from section 40.1 one layer further — where `APIClient` abstracted the raw networking details, `RecipeService` abstracts the higher-level question of "where recipes actually come from" (which might involve coordinating between a remote API and a local SwiftData cache), letting a view model depend only on the `RecipeService` protocol, entirely unaware of whether recipes ultimately come from a network call, a local database, or some combination of both.

---

## 45.6 Mapping DTOs to Domain Models

A DTO (Data Transfer Object — the shape of data as it comes over the network, matching a server's specific JSON structure) is often a poor fit to use directly as an app's internal domain model — an explicit mapping layer translates between the two, decoupling the app's internal design from the server's specific API shape.

```swift
// DTO: matches the server's exact JSON structure, including its quirks
struct RecipeDTO: Decodable {
    let recipe_id: String
    let recipe_title: String
    let cook_time_minutes: Int?
}

// Domain model: clean, idiomatic Swift, shaped around what the APP needs
struct Recipe: Identifiable {
    let id: UUID
    var title: String
    var minutesToCook: Int
}

extension Recipe {
    init(dto: RecipeDTO) {
        self.id = UUID(uuidString: dto.recipe_id) ?? UUID()
        self.title = dto.recipe_title
        self.minutesToCook = dto.cook_time_minutes ?? 0
    }
}
```

Without this mapping layer, a server's API quirks (snake_case field names, an optional field that should really have a sensible default, an ID represented as a string rather than a genuine `UUID`) leak directly into the app's internal model, and any change to the server's JSON shape would ripple out through every part of the app that touches that data — an explicit DTO-to-domain mapping step contains that impact to one well-defined translation boundary, letting the rest of the app work with a clean, idiomatic, server-shape-independent `Recipe` type.

---

## 45.7 Making Illegal States Unrepresentable

A recurring theme throughout this curriculum (first introduced with enums in section 6, and revisited for network loading states in section 39.9) — designing types so that invalid or contradictory combinations of data simply cannot be constructed, rather than relying on runtime checks or discipline to avoid them.

```swift
// WORSE: independently-settable fields allow nonsensical combinations
struct BadRecipeUpload {
    var isUploading: Bool
    var uploadedURL: URL?
    var uploadError: Error? // nothing prevents isUploading == true AND uploadedURL != nil simultaneously
}

// BETTER: the type itself enforces exactly one valid state at a time
enum RecipeUploadState {
    case idle
    case uploading(progress: Double)
    case succeeded(URL)
    case failed(Error)
}
```

The enum-based `RecipeUploadState` makes it structurally impossible to represent "currently uploading" and "already succeeded with a URL" simultaneously — there's no code path, however buggy, that could produce that contradictory combination, because the type system itself doesn't allow it. This is a genuinely different (and stronger) guarantee than "we're careful to always keep these flags in sync" — it's architectural discipline applied at the type-design level, and it's one of the single highest-leverage habits for reducing an entire category of bugs before they can even be written.

---

## 45.8 Modeling Screen State as an Enum

Building directly on 45.7, an entire screen's overall state — not just one specific concern like an upload — is often best modeled as a single enum, extending the `LoadState` pattern introduced for networking (section 39.9) into a general architectural technique.

```swift
enum RecipeDetailScreenState {
    case loading
    case loaded(Recipe)
    case editing(Recipe, draft: Recipe)
    case saving(Recipe)
    case error(Error)
}

struct RecipeDetailView: View {
    @State private var state: RecipeDetailScreenState = .loading

    var body: some View {
        switch state {
        case .loading: ProgressView()
        case .loaded(let recipe): RecipeReadOnlyView(recipe: recipe)
        case .editing(_, let draft): RecipeEditForm(draft: draft)
        case .saving: ProgressView("Saving…")
        case .error(let error): ErrorView(error: error)
        }
    }
}
```

Rather than a view model exposing a scattering of independent `@Published`/`@Observable` properties (`isLoading`, `isEditing`, `isSaving`, `error`, `recipe`) that the view must manually reconcile into "what should actually be shown right now," a single state enum makes that reconciliation the type's own job — the view's `body` becomes a straightforward, exhaustive `switch` with one case per genuinely distinct screen state, and the compiler's exhaustiveness checking (recall `switch` over enums, section 6) guarantees every state is explicitly handled somewhere.

---

## 45.9 Folder and Group Structure That Scales

How files are organized into folders/groups is a genuinely consequential architectural decision at scale — the two dominant approaches are organizing "by type" (all views together, all models together, all view models together) versus "by feature" (each feature's views, models, and view models grouped together).

```plaintext
By type (works fine for small apps, struggles as they grow):
  Views/RecipeListView.swift, RecipeDetailView.swift, ProfileView.swift...
  ViewModels/RecipeListViewModel.swift, ProfileViewModel.swift...
  Models/Recipe.swift, User.swift...

By feature (scales considerably better for larger apps):
  Recipes/RecipeListView.swift, RecipeListViewModel.swift, Recipe.swift...
  Profile/ProfileView.swift, ProfileViewModel.swift, User.swift...
```

Organizing "by type" means working on a single feature requires jumping between several distant folders for every related file, and the folders themselves grow unboundedly as the app grows, providing no natural way to see "everything related to recipes" at a glance. Organizing "by feature" instead groups everything relevant to one cohesive piece of app functionality together, which scales much better as an app grows to dozens of features, and naturally supports the kind of feature-level modularization (potentially even separate Swift packages per feature) that becomes increasingly valuable in larger codebases.

---

## 45.10 Choosing Where to Put Shared Logic

Not everything belongs cleanly inside one feature folder — genuinely shared logic (a date formatter used everywhere, a design token system per section 32.14, a networking layer per section 40.1) needs a deliberate home distinct from any single feature, without becoming a disorganized dumping ground.

```plaintext
Recipes/          (feature-specific)
Profile/          (feature-specific)
Shared/
  DesignSystem/    — design tokens, reusable custom SwiftUI components
  Networking/      — APIClient, Endpoint (section 40.1)
  Persistence/     — shared SwiftData container setup, service protocols
  Extensions/      — small, genuinely general-purpose Swift/SwiftUI extensions
```

A well-organized `Shared` (or `Core`/`Common`) area should hold things that are genuinely used across *multiple* features and have no natural single-feature home — the key discipline is resisting the temptation to put something there just because it's convenient, when it actually only serves one specific feature (which should keep it local to that feature's own folder instead). As an app and team grow, well-scoped shared modules like this are often exactly what eventually gets extracted into standalone Swift packages, letting different features (and even different apps within the same organization) depend on a stable, independently-versioned shared foundation.

---

## Summary

| Concept | Key Idea | Purpose |
|---|---|---|
| Root problem | Mixed responsibilities, not line count | Why large views become hard to maintain |
| Foundational separation | Model / Logic / Presentation | The discipline underlying every specific pattern |
| MVVM | `@Observable` view models | Views stay focused purely on layout |
| View model scope | Orchestration, not raw implementation | What belongs vs. what belongs elsewhere |
| Service/repository layer | Protocol-based data access abstraction | Hide "how" data is fetched/stored from view models |
| DTO-to-domain mapping | Explicit translation boundary | Decouple app design from server API shape |
| Illegal states | Enum-based, structurally-enforced validity | Make invalid combinations unconstructible |
| Screen state modeling | Single enum per screen | Exhaustive, compiler-checked state handling |
| Project structure | Organize by feature, not by type | Scales better as an app grows |
| Shared code | Deliberate, disciplined `Shared`/`Core` area | Genuinely cross-feature logic only |
