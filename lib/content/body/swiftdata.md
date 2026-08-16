## 41.1 @Model and Your First Persisted Type

`@Model` transforms an ordinary Swift class into a persisted, SwiftData-managed type — no separate schema file or code generation step required, unlike Core Data's `.xcdatamodeld`.

```swift
import SwiftData

@Model
final class Recipe {
    var title: String
    var minutesToCook: Int
    var isFavorite: Bool = false

    init(title: String, minutesToCook: Int) {
        self.title = title
        self.minutesToCook = minutesToCook
    }
}
```

`@Model` is a Swift macro (recall macros, section 13) that expands `Recipe` at compile time, adding the storage and change-tracking machinery SwiftData needs, while leaving the type looking like an ordinary Swift class with stored properties and a normal initializer. This is SwiftData's core design philosophy: persistence should feel like writing regular Swift model types, not learning a separate object-graph API layered on top of your actual domain model.

---

## 41.2 ModelContainer and App Setup

A `ModelContainer` owns the underlying storage (schema, database file, and configuration) for one or more `@Model` types, and is typically attached at the app's root via `.modelContainer()`.

```swift
@main
struct RecipeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: Recipe.self)
    }
}
```

`.modelContainer(for:)` sets up the container and, critically, injects a `modelContext` (41.5) into the SwiftUI environment automatically, making it available to every view in the hierarchy without manual passing. For apps with several model types, `.modelContainer(for: [Recipe.self, Ingredient.self])` registers them together in one shared container, since related model types generally need to share the same underlying store to support relationships (41.7) between them.

---

## 41.3 @Query to Fetch and Display

`@Query` is a property wrapper that declares a live, automatically-updating fetch of persisted model instances directly within a SwiftUI view — the SwiftData analog of `@FetchRequest` from Core Data's SwiftUI integration.

```swift
struct RecipeListView: View {
    @Query private var recipes: [Recipe]

    var body: some View {
        List(recipes) { recipe in
            Text(recipe.title)
        }
    }
}
```

Once declared, `recipes` behaves like an ordinary array for display purposes, but SwiftData keeps it automatically synchronized with the underlying store — insertions, deletions, or edits to any `Recipe` (from anywhere in the app) are reflected in this view's `body` re-evaluation without any manual refetching or notification handling, closely mirroring how `@State`-driven views automatically reflect local state changes (section 25).

---

## 41.4 Inserting and Deleting Objects

New model instances are inserted into a `modelContext`, and existing ones removed via `delete()` — both operations are simple, direct method calls rather than requiring separate "create request"/"delete request" object types.

```swift
struct AddRecipeView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var title = ""

    var body: some View {
        Form {
            TextField("Title", text: $title)
            Button("Save") {
                let recipe = Recipe(title: title, minutesToCook: 30)
                modelContext.insert(recipe)
            }
        }
    }
}

struct DeleteExampleView: View {
    @Environment(\.modelContext) private var modelContext
    let recipe: Recipe

    var body: some View {
        Button("Delete", role: .destructive) {
            modelContext.delete(recipe)
        }
    }
}
```

`@Environment(\.modelContext)` reads the context injected automatically by `.modelContainer()` (41.2) — `modelContext.insert(recipe)` registers a newly-created instance for persistence, and `modelContext.delete(recipe)` marks an existing instance for removal. Neither call immediately writes to disk by itself; that's the role of saving, covered next.

---

## 41.5 modelContext and Saving

`ModelContext` tracks pending changes (inserts, deletes, and property mutations on already-persisted objects) in memory, and `save()` commits those pending changes to the underlying store — though SwiftData also autosaves at reasonable intervals and lifecycle points by default.

```swift
struct EditRecipeView: View {
    @Environment(\.modelContext) private var modelContext
    @Bindable var recipe: Recipe

    var body: some View {
        Form {
            TextField("Title", text: $recipe.title)
            Button("Save Now") {
                try? modelContext.save()
            }
        }
    }
}
```

`@Bindable` (recall from `@Observable` material, section 25) lets `recipe`'s properties be bound directly to form controls — since `@Model` types are automatically `@Observable`-conformant, edits to `recipe.title` here are tracked by the context immediately, and mutating a persisted object's property is sufficient on its own to mark it as needing to be saved. Calling `save()` explicitly is appropriate when an immediate, guaranteed write is important (like right before navigating away), though for many everyday interactions, SwiftData's automatic autosave behavior means an explicit `save()` call isn't strictly required.

---

## 41.6 @Attribute Options

`@Attribute` customizes how a specific property is persisted — common uses include enforcing uniqueness and controlling external storage for large binary data.

```swift
@Model
final class User {
    @Attribute(.unique) var email: String
    @Attribute(.externalStorage) var profileImageData: Data?
    var displayName: String

    init(email: String, displayName: String) {
        self.email = email
        self.displayName = displayName
    }
}
```

`@Attribute(.unique)` enforces a uniqueness constraint at the storage level — attempting to insert a second `User` with an already-existing `email` value updates the existing record rather than creating a duplicate, useful for natural identifiers like an email address or external API ID. `@Attribute(.externalStorage)` hints to SwiftData that large binary data (like an image) should be stored as a separate file referenced by the database rather than inline within it, improving performance for the common case of occasionally-large blob properties mixed in with otherwise small, frequently-queried model data.

---

## 41.7 @Relationship and Delete Rules

`@Relationship` declares and configures a connection between two `@Model` types, including a delete rule governing what happens to related objects when the "parent" side of the relationship is deleted.

```swift
@Model
final class Recipe {
    var title: String
    @Relationship(deleteRule: .cascade) var ingredients: [Ingredient] = []

    init(title: String) {
        self.title = title
    }
}

@Model
final class Ingredient {
    var name: String
    var quantity: String

    init(name: String, quantity: String) {
        self.name = name
        self.quantity = quantity
    }
}
```

`deleteRule: .cascade` means deleting a `Recipe` automatically deletes all of its associated `Ingredient` objects too, since ingredients with no owning recipe wouldn't be meaningful on their own — other options include `.nullify` (clear the relationship reference but leave the related object intact) and `.deny` (prevent deletion of the parent while related objects still exist). Choosing the correct delete rule per relationship is a real modeling decision, directly parallel to foreign key `ON DELETE` behavior in traditional relational databases.

---

## 41.8 Inverse Relationships

When two `@Model` types reference each other in both directions (a `Recipe` has `ingredients`, and each `Ingredient` optionally knows its owning `recipe`), SwiftData needs the inverse relationship declared so it can keep both sides consistent automatically.

```swift
@Model
final class Recipe {
    var title: String
    @Relationship(deleteRule: .cascade, inverse: \Ingredient.recipe)
    var ingredients: [Ingredient] = []

    init(title: String) { self.title = title }
}

@Model
final class Ingredient {
    var name: String
    var recipe: Recipe?

    init(name: String) { self.name = name }
}
```

The `inverse:` parameter (using a key path, `\Ingredient.recipe`) tells SwiftData that `Recipe.ingredients` and `Ingredient.recipe` are two sides of the *same* logical relationship, not two independent ones — this means appending an `Ingredient` to `recipe.ingredients` automatically sets that ingredient's `.recipe` back-reference too, without needing to manually keep both sides in sync by hand. Declaring the inverse explicitly (rather than letting SwiftData guess) is the recommended, unambiguous approach whenever a bidirectional relationship exists.

---

## 41.9 #Predicate for Filtering

`#Predicate` is a Swift macro for expressing type-safe, compile-time-checked filter conditions, usable both with `@Query`'s `filter:` parameter and with manually-constructed `FetchDescriptor`s.

```swift
struct QuickRecipesView: View {
    @Query(filter: #Predicate<Recipe> { $0.minutesToCook <= 20 })
    private var quickRecipes: [Recipe]

    var body: some View {
        List(quickRecipes) { recipe in
            Text(recipe.title)
        }
    }
}
```

`#Predicate<Recipe> { $0.minutesToCook <= 20 }` looks like an ordinary Swift closure, but the macro actually captures and translates this expression into a query executed by the underlying store — writing filter logic as genuine, type-checked Swift code (rather than a stringly-typed predicate format, as Core Data's older `NSPredicate` traditionally required) is one of SwiftData's most significant ergonomic improvements over its predecessor.

---

## 41.10 #Predicate Limitations and Compile Errors

Because `#Predicate` expressions must be translatable into the underlying store's actual query language, not every valid Swift expression is permitted inside one — certain operations (like calling arbitrary custom functions, or some string/collection operations) produce compile-time errors rather than silently failing at runtime.

```swift
// This will NOT compile — arbitrary custom function calls aren't
// translatable into a query the persistence store can execute:
//
// #Predicate<Recipe> { customValidation($0.title) }

// Supported instead: expressing the same logic using operations
// #Predicate can actually translate
#Predicate<Recipe> { $0.title.count > 0 && $0.minutesToCook < 60 }
```

This compile-time restriction is a deliberate design trade-off: rather than allowing arbitrary Swift code inside a predicate and having it fail unpredictably or silently at runtime when the store can't execute it, `#Predicate`'s macro implementation rejects unsupported expressions immediately at compile time, giving a clear, actionable error rather than a confusing runtime failure — understanding which operations are and aren't supported (a set that has expanded across SwiftData releases) is a practical skill for anyone writing non-trivial predicates.

---

## 41.11 Sort Descriptors and Dynamic Sorting

`@Query`'s `sort:` parameter (or a `SortDescriptor` passed to a `FetchDescriptor`) controls result ordering, and can be driven dynamically by app state for user-controllable sorting.

```swift
struct SortableRecipeListView: View {
    @State private var sortOrder: [SortDescriptor<Recipe>] = [SortDescriptor(\.title)]

    var body: some View {
        VStack {
            Picker("Sort", selection: $sortOrder) {
                Text("Title").tag([SortDescriptor(\Recipe.title)])
                Text("Cook Time").tag([SortDescriptor(\Recipe.minutesToCook)])
            }
            RecipeListContent(sortOrder: sortOrder)
        }
    }
}

struct RecipeListContent: View {
    @Query private var recipes: [Recipe]

    init(sortOrder: [SortDescriptor<Recipe>]) {
        _recipes = Query(sort: sortOrder)
    }

    var body: some View {
        List(recipes) { Text($0.title) }
    }
}
```

Because `@Query`'s configuration (including `sort:`) must be set at initialization time, driving dynamic sort order requires the pattern shown — a parent view holds the current `sortOrder` as `@State`, and a child view re-initializes its own `@Query` with that sort order via a custom `init`, causing SwiftUI to recreate the child (and its query) whenever the parent's sort selection changes.

---

## 41.12 Section Fetches in @Query (iOS 27)

Newer SwiftData supports section-grouped fetches directly through `@Query`, returning results already organized into named groups (like a contacts list grouped alphabetically) without manual client-side grouping logic.

```swift
struct GroupedRecipeListView: View {
    @Query(sort: \Recipe.title) private var recipes: [Recipe]

    // Section-aware query variant (iOS 27) groups results server-side:
    // @Query(sort: \Recipe.title, groupBy: \Recipe.category) private var groupedRecipes

    var body: some View {
        List {
            ForEach(Dictionary(grouping: recipes, by: { String($0.title.prefix(1)) }).sorted(by: { $0.key < $1.key }), id: \.key) { letter, items in
                Section(letter) {
                    ForEach(items) { Text($0.title) }
                }
            }
        }
    }
}
```

Prior to native section-fetch support, grouping query results (like the alphabetical `Dictionary(grouping:by:)` shown as a fallback) had to be done manually on the client side after fetching a flat array — the newer grouped `@Query` variant pushes this grouping down to the underlying store itself, which can be considerably more efficient for large datasets, since the store can leverage its own indexing rather than the app re-sorting and re-grouping an already-fetched flat result set in memory.

---

## 41.13 @Attribute(.codable) for Explicit Storage (iOS 27)

`@Attribute(.codable)` explicitly directs SwiftData to persist a property using its `Codable` conformance (serialized, e.g., as JSON) rather than attempting to map it to native store column types — useful for complex value types that don't map cleanly onto SwiftData's default storage representations.

```swift
struct NutritionInfo: Codable {
    var calories: Int
    var protein: Double
}

@Model
final class Recipe {
    var title: String
    @Attribute(.codable) var nutrition: NutritionInfo?

    init(title: String) { self.title = title }
}
```

Without this explicit directive, SwiftData's automatic handling of complex nested value types can vary by version and type shape — `@Attribute(.codable)` removes the ambiguity, explicitly opting a property into `Codable`-based serialization, which trades some query-ability (you generally can't write a `#Predicate` filtering on fields *inside* a codable-serialized blob) for the ability to persist arbitrary `Codable` structures without needing to model them as their own separate `@Model` types.

---

## 41.14 ResultsObserver Outside SwiftUI Views (iOS 27) 🟠

`@Query` is inherently a SwiftUI-specific mechanism — `ResultsObserver` (and related APIs) provide an equivalent live-updating observation capability for non-SwiftUI contexts, like a plain Swift class or a background service that needs to react to data changes without being a `View`.

```swift
@Observable
final class RecipeMonitor {
    private var observer: ResultsObserver<Recipe>?
    var recipes: [Recipe] = []

    func startObserving(context: ModelContext) {
        observer = ResultsObserver(context: context, descriptor: FetchDescriptor<Recipe>()) { [weak self] results in
            self?.recipes = results
        }
    }
}
```

This fills a real gap — plenty of legitimate app logic (a widget's timeline provider, a background-processing coordinator, a UIKit view controller per section 38.8's model-sharing pattern) needs live data observation without being a SwiftUI `View` that could use `@Query` directly. `ResultsObserver` provides that same "stay automatically in sync with the store" behavior through a class-based API usable anywhere in the app, not just within SwiftUI's view body evaluation cycle.

---

## 41.15 Background Work with ModelActor 🟠

`ModelActor` provides an actor-isolated (recall actors, section 19) `ModelContext` for performing potentially expensive persistence work off the main thread, without risking the data races that would result from sharing a single `ModelContext` across concurrent tasks.

```swift
@ModelActor
actor RecipeImporter {
    func importRecipes(from data: [RecipeDTO]) throws {
        for dto in data {
            let recipe = Recipe(title: dto.title, minutesToCook: dto.cookTime)
            modelContext.insert(recipe)
        }
        try modelContext.save()
    }
}
```

`@ModelActor` (a macro, like `@Model` itself) generates an actor-isolated `modelContext` specific to this actor instance, ensuring all access to it is automatically serialized by Swift's actor isolation guarantees — this is the correct, safe way to perform a large batch import or other expensive persistence operation without blocking the main thread, since a plain `ModelContext` (like the one from `@Environment(\.modelContext)`) is tied to the main actor and unsafe to access concurrently from a background task.

---

## 41.16 Schema Versioning with VersionedSchema 🟠

As an app evolves, its `@Model` types inevitably need to change — `VersionedSchema` formally captures a specific version of the model schema, providing the foundation for SwiftData to understand how to migrate existing user data from an older schema version to a newer one.

```swift
enum RecipeSchemaV1: VersionedSchema {
    static var versionIdentifier: Schema.Version = .init(1, 0, 0)
    static var models: [any PersistentModel.Type] { [Recipe.self] }
}

enum RecipeSchemaV2: VersionedSchema {
    static var versionIdentifier: Schema.Version = .init(2, 0, 0)
    static var models: [any PersistentModel.Type] { [Recipe.self] }
}
```

Each `VersionedSchema` conformer represents a frozen snapshot of what the model layer looked like at a specific point — as the app's actual `@Model` definitions evolve over releases, these version markers give SwiftData (via a `SchemaMigrationPlan`, working alongside 41.17's migration types) a clear before-and-after picture to reason about when a user upgrades from an app version using an older schema to one using a newer one.

---

## 41.17 Lightweight vs. Custom Migrations 🟠

SwiftData distinguishes between lightweight migrations (simple, automatically-inferred changes like adding an optional property) and custom migrations (requiring explicit transformation logic, like renaming a property or restructuring a relationship) via a `SchemaMigrationPlan`.

```swift
enum RecipeMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] { [RecipeSchemaV1.self, RecipeSchemaV2.self] }

    static var stages: [MigrationStage] {
        [.custom(
            fromVersion: RecipeSchemaV1.self,
            toVersion: RecipeSchemaV2.self,
            willMigrate: nil,
            didMigrate: { context in
                // e.g., populate a new required field with a computed default
            }
        )]
    }
}
```

Lightweight migrations (adding a new optional property, for instance) SwiftData can typically infer and apply automatically with no explicit migration stage needed at all. Custom migrations, as shown, require an explicit `MigrationStage.custom` with `willMigrate`/`didMigrate` closures — necessary whenever the transformation from old to new schema isn't a simple structural addition, such as needing to compute a new field's initial value from existing data, or restructuring how a relationship is represented.

---

## 41.18 SwiftData with CloudKit Sync 🟠

SwiftData integrates with CloudKit (section 44) to provide automatic multi-device sync of persisted data, enabled largely through configuration rather than manual sync code — though it comes with specific modeling constraints (covered next, 41.19) that CloudKit's own data model imposes.

```swift
let configuration = ModelConfiguration(cloudKitDatabase: .automatic)
let container = try ModelContainer(for: Recipe.self, configurations: configuration)
```

`cloudKitDatabase: .automatic` opts a `ModelContainer` into CloudKit-backed sync with minimal additional code — SwiftData handles translating local model changes into CloudKit record operations and vice versa, giving an app "iCloud sync across the user's devices" largely as a configuration choice rather than requiring hand-written sync logic, which is a substantial simplification compared to CloudKit integration built directly on Core Data (`NSPersistentCloudKitContainer`, section 42.12) or raw CloudKit APIs.

---

## 41.19 SwiftData Constraints Under CloudKit 🟠

CloudKit's own data model imposes real constraints on what a SwiftData schema can look like when CloudKit sync is enabled — most notably, all properties must be optional (or have a default value) and unique constraints (`@Attribute(.unique)`, 41.6) aren't supported, since CloudKit's own record model doesn't enforce uniqueness the same way a local SQL-backed store can.

```swift
// Under CloudKit sync, this WON'T work (unique constraint unsupported):
// @Attribute(.unique) var email: String

// Instead, CloudKit-compatible modeling requires either:
// - dropping the uniqueness requirement and handling duplicates in app logic, or
// - using a non-CloudKit-synced local-only container for data with true uniqueness needs
var email: String = ""
```

These constraints exist because CloudKit's record-based sync model fundamentally differs from a local relational store's guarantees — CloudKit doesn't provide the kind of transactional, store-level uniqueness enforcement that a local SQLite-backed `ModelContainer` can, and every property needing a sensible default/optional value reflects CloudKit's eventually-consistent, multi-device nature, where a record might sync in a partially-populated state from an older app version. Designing a SwiftData schema with CloudKit sync in mind from the outset avoids painful retrofitting later.

---

## 41.20 Sharing a Container with Widgets and Extensions 🟠

For a widget, share extension, or other app extension to read/write the same persisted data as the main app, the `ModelContainer` must be configured with a shared App Group container location (recall App Groups, previewed further in section 43.2) rather than each target using its own isolated default storage location.

```swift
let sharedURL = FileManager.default
    .containerURL(forSecurityApplicationGroupIdentifier: "group.com.example.myapp")!
    .appendingPathComponent("SharedRecipes.sqlite")

let configuration = ModelConfiguration(url: sharedURL)
let container = try ModelContainer(for: Recipe.self, configurations: configuration)
```

By default, each app target (the main app, a widget extension, and so on) has its own separate sandboxed storage location — explicitly pointing the `ModelConfiguration` at a URL within a shared App Group container is what lets multiple targets genuinely read and write the same underlying SwiftData store, essential for a widget that needs to display live data the main app has persisted, like today's recipe suggestions.

---

## 41.21 Debugging SwiftData Performance 🔴

SwiftData performance issues typically trace back to over-fetching (retrieving more data or more relationships than a given screen actually needs) or excessive main-thread work — Xcode's Core Data/SwiftData Instruments template and SQL debug logging are the primary diagnostic tools, since SwiftData's underlying storage is, in most configurations, still backed by the same SQLite engine as Core Data.

```swift
// Launch argument for verbose SQL logging (added via Xcode scheme, Arguments tab):
// -com.apple.CoreData.SQLDebug 1
//
// This logs every actual SQL statement SwiftData's underlying store executes,
// letting you inspect exactly what's being queried and how often.
```

Enabling SQL debug logging surfaces the raw SQL statements underlying every `@Query` and `FetchDescriptor` execution — a very effective way to spot, for instance, an unexpectedly expensive query running far more often than intuition suggests (a body-invalidation-storm-adjacent problem, conceptually similar to the SwiftUI performance diagnostics from section 31.12–31.13, but at the persistence layer instead of the view layer). Common fixes once a problem is identified include narrowing a `@Query`'s `#Predicate` to fetch only what's actually displayed, and using `FetchDescriptor`'s `fetchLimit`/`propertiesToFetch` to avoid retrieving entire object graphs when only a few fields are actually needed.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Persisted model | `@Model` | Turn a Swift class into a persisted type |
| Storage setup | `ModelContainer`, `.modelContainer()` | Own schema/storage; inject context into SwiftUI |
| Live fetching | `@Query` | Auto-updating query results in a view |
| Mutating data | `modelContext.insert()`/`.delete()` | Register new/removed objects |
| Committing changes | `modelContext.save()` | Explicit write; autosave also occurs by default |
| Column-level customization | `@Attribute(.unique/.externalStorage)` | Uniqueness constraints, large blob storage |
| Object connections | `@Relationship(deleteRule:inverse:)` | Bidirectional, delete-rule-governed relationships |
| Type-safe filtering | `#Predicate` | Compile-checked query conditions |
| Result ordering | `SortDescriptor`, `@Query(sort:)` | Static and dynamically-driven sorting |
| Grouped results | Section-aware `@Query` (iOS 27) | Store-side grouping vs. client-side grouping |
| Complex value storage | `@Attribute(.codable)` (iOS 27) | Codable-based serialization for non-native shapes |
| Non-SwiftUI observation | `ResultsObserver` (iOS 27) | Live data observation outside `View` bodies |
| Safe background work | `@ModelActor` | Actor-isolated context for off-main-thread work |
| Schema evolution | `VersionedSchema`, `SchemaMigrationPlan` | Formal before/after schema snapshots |
| Migration logic | Lightweight vs. `.custom` stages | Automatic inference vs. explicit transformation |
| Multi-device sync | `ModelConfiguration(cloudKitDatabase:)` | Automatic CloudKit-backed sync |
| CloudKit modeling limits | Optional properties, no unique constraints | Reflects CloudKit's record-based sync model |
| Extension data sharing | App Group `ModelConfiguration(url:)` | Shared store across app and widget/extension targets |
| Performance diagnosis | SQL debug logging | Spot over-fetching and expensive queries |
