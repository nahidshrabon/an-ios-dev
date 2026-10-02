## 45.1 Why Views Over 300 Lines Become Unmaintainable

A view that does too many jobs (loading data, checking business rules, formatting, layout) is hard to read, test, and change.

"300 lines" is only a rough warning. The real problem is the number of jobs, not the number of lines. If you change one job, you can break another.

When a view has many jobs, move each job to its own place (see 45.2).

---

## 45.2 Separating Model, Logic, and Presentation

Split your code into three parts: the **model** (the data), the **logic** (what the app decides), and the **presentation** (what the user sees).

```swift
// Model: only data
struct Recipe: Identifiable, Codable {
    let id: UUID
    var title: String
    var minutesToCook: Int
}

// Logic: decisions, no UI
struct RecipeValidator {
    static func isValid(_ recipe: Recipe) -> Bool {
        !recipe.title.isEmpty && recipe.minutesToCook > 0
    }
}

// Presentation: only layout
struct RecipeRow: View {
    let recipe: Recipe
    var body: some View {
        Text(recipe.title)
    }
}
```

A view should not hold logic. Logic should not know about the screen. Every pattern in sections 45–46 is just a way to connect these three parts.

---

## 45.3 MVVM with @Observable View Models

MVVM (Model-View-ViewModel) adds a **view model**: a class that holds the data a view shows and asks for that data when needed. The view only draws the screen. In SwiftUI, view models use `@Observable` (section 25).

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

To keep this example short, the view model calls `apiClient` directly. In 45.5 we replace it with a service.

The view model asks for the data, tracks loading, and handles errors. The view only shows `recipes` and `isLoading`, and calls `loadRecipes()` when the screen appears.

When a view creates its own view model, use `@State private var viewModel`. SwiftUI rebuilds views often, and `@State` keeps the same view model alive while the view is on screen. If another view passes the view model in, a plain `let` is enough.

---

## 45.4 What Belongs in a View Model and What Doesn't

A view model should prepare data for one screen and react to what the user does. It should not fetch or save data itself (network calls, database queries).

```swift
@Observable
final class RecipeListViewModel {
    // BELONGS: data for the screen, and deciding when to call the service
    private(set) var recipes: [Recipe] = []
    private let recipeService: RecipeService

    // DOESN'T BELONG: URLRequest, JSONDecoder, database queries.
    // That is the service's job (45.5).
}
```

Two mistakes to avoid. If the view model does too little, logic ends up in the view. If it does too much, it fills up with network and database code.

A simple test: the view model calls services and shapes the result for the screen. It never calls `URLSession`, `JSONDecoder`, or SwiftData directly.

---

## 45.5 Service and Repository Layers

A **repository** hides where data is stored (network, database). A **service** can use repositories and add logic on top. Both sit between the view model and the data. In this course, `RecipeService` is simple, so it acts like a repository.

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
        // (simplified) save remote data to the local database, then return it
        return remoteRecipes
    }

    func save(_ recipe: Recipe) async throws {
        try await apiClient.createRecipe(recipe)
    }
}
```

`APIClient` (section 40.1) hides the network details. `RecipeService` goes one step further: it hides *where* recipes come from (network, database, or both). The view model only knows the `RecipeService` protocol.

---

## 45.6 Mapping DTOs to Domain Models

A **DTO** (Data Transfer Object) is data in the exact shape the server sends. Do not use it inside your app. Convert it to your own model (the domain model) first.

```swift
// DTO: matches the server's JSON exactly
struct RecipeDTO: Decodable {
    let recipe_id: String
    let recipe_title: String
    let cook_time_minutes: Int?
}

// Domain model: clean Swift, shaped for what the app needs (same Recipe as 45.2)
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

Without mapping, the server's odd choices leak into your app: snake_case names, optional fields, and an ID that is a string instead of a `UUID`. If the server changes its JSON, you would have to fix code everywhere.

With mapping, only the `init(dto:)` code changes. The rest of the app uses the clean `Recipe`.

---

## 45.7 Making Wrong States Impossible

Design your types so that wrong or mixed-up data cannot be created at all. This idea first appeared with enums (section 6) and loading states (section 39.9).

```swift
// WORSE: the fields are separate, so they can disagree
struct BadRecipeUpload {
    var isUploading: Bool
    var uploadedURL: URL?
    var uploadError: Error? // nothing stops isUploading == true AND uploadedURL != nil
}

// BETTER: only one state at a time
enum RecipeUploadState {
    case idle
    case uploading(progress: Double)
    case succeeded(URL)
    case failed(Error)
}
```

With `RecipeUploadState`, "uploading" and "succeeded" cannot both be true. No code, even buggy code, can create that mix, because Swift does not allow it.

This is stronger than "be careful to keep the flags in sync". The type itself prevents a whole group of bugs.

---

## 45.8 Using an Enum for Screen State

Like 45.7, but for a whole screen: describe everything the screen can be doing with one enum. This extends the `LoadState` idea from section 39.9.

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

Without an enum, you often have many separate properties (`isLoading`, `isEditing`, `isSaving`, `error`, `recipe`), and the view must work out which combination to show.

With one enum, the state decides what to show. The view is a simple `switch` with one case per state, and Swift makes sure you handle every case (section 6). Here the state lives in the view, but it can live in a view model too.

---

## 45.9 Folder Structure That Scales

There are two main ways to organize files: **by type** (all views together, all models together) or **by feature** (everything for one feature together).

```plaintext
By type (fine for small apps, hard when they grow):
  Views/RecipeListView.swift, RecipeDetailView.swift, ProfileView.swift...
  ViewModels/RecipeListViewModel.swift, ProfileViewModel.swift...
  Models/Recipe.swift, User.swift...

By feature (works better for big apps):
  Recipes/RecipeListView.swift, RecipeListViewModel.swift, Recipe.swift...
  Profile/ProfileView.swift, ProfileViewModel.swift, User.swift...
```

By type: to work on one feature, you jump between many folders. The folders keep growing, and you can't see "everything about recipes" in one place.

By feature: everything for one feature is together. This works better as the app grows, and it makes it easier to split features into separate Swift packages later.

---

## 45.10 Where to Put Shared Code

Some code is used by many features, like a date formatter, design tokens (section 32.14), or the networking layer (section 40.1). Give it its own folder, and keep that folder tidy.

```plaintext
Recipes/          (feature-specific)
Profile/          (feature-specific)
Shared/
  DesignSystem/    — design tokens, reusable SwiftUI components
  Networking/      — APIClient, Endpoint (section 40.1)
  Persistence/     — SwiftData container setup
  Extensions/      — small, general-purpose extensions
```

Put code in `Shared` (or `Core`/`Common`) only if **several** features use it. If only one feature uses it, keep it in that feature's folder. Do not use `Shared` as a dumping ground.

Later, a well-kept `Shared` folder can become its own Swift package that many features, or even many apps, depend on.

---

## Summary

| Concept | Key Idea | Purpose |
|---|---|---|
| Big views | Too many jobs, not too many lines | Know why big views are hard to maintain |
| Three parts | Model / Logic / Presentation | The base of every pattern |
| MVVM | `@Observable` view models | Views only draw the screen |
| View model scope | Prepare data, don't fetch it | Keep network and database code out |
| Service / repository | Hide where data comes from | View models stay simple and testable |
| DTO to domain model | Convert server data once | Server changes don't spread through the app |
| Wrong states | Use enums, not separate flags | Mixed-up states can't exist |
| Screen state | One enum per screen | The view is a simple `switch` |
| Folders | Organize by feature, not by type | Easier to grow |
| Shared code | A small `Shared` folder | Only code that several features use |
