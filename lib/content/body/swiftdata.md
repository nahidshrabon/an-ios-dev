**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**SwiftData** (iOS 17+) is Apple's modern framework for **saving app data on the device**: notes, recipes, workouts, anything with structure. You write normal Swift classes, mark them with **`@Model`**, and SwiftData stores them (in SQLite, under the hood), keeps SwiftUI views **in sync**, and can **sync to iCloud**. It's built on the same engine as Core Data (42), with a much more Swift-friendly API.

---

## 41.1 @Model and Your First Persisted Type 🟢

Put **`@Model`** on a class, and SwiftData can **save** it. No separate schema file, no code generation:

```swift
import SwiftData

@Model
final class Recipe {
    var title: String
    var minutesToCook: Int
    var isFavorite: Bool = false
    var createdAt: Date = Date.now

    init(title: String, minutesToCook: Int) {
        self.title = title
        self.minutesToCook = minutesToCook
    }
}
```

`@Model` is a **macro** (13). At compile time, it adds everything SwiftData needs: storage, **change tracking**, and **`@Observable`**-style observation, so SwiftUI views update when a property changes. Your code still looks like a **plain class**.

Rules to know:

- It must be a **class** (not a struct): saved objects have **identity**, and SwiftData tracks changes to the same object over time.
- Stored properties are saved automatically: `String`, numbers, `Bool`, `Date`, `Data`, `URL`, `UUID`, **enums** and **structs** that are `Codable`, optionals, arrays, and other `@Model` types (relationships, 41.7).
- **Computed** properties aren't saved. Use **`@Transient`** for a stored property you **don't** want saved.

That's SwiftData's idea: **persistence should feel like writing normal Swift**.

---

## 41.2 ModelContainer and App Setup 🟢

A **`ModelContainer`** owns the **storage**: the schema (your model types) and the database file. Attach one at the **root** of the app:

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

**`.modelContainer(for:)`** does two things:

1. Creates (or opens) the **store** for those model types.
2. Puts a **`ModelContext`** (the object you use to insert, delete, and save; 41.5) into the SwiftUI **environment**, so **every** view below can use it.

List **all** your model types. Related types (41.7) must live in the **same** container:

```swift
.modelContainer(for: [Recipe.self, Ingredient.self, Tag.self])
```

For **previews** and **tests**, use an **in-memory** container: nothing is written to disk, and each run starts empty:

```swift
#Preview {
    RecipeListView()
        .modelContainer(for: Recipe.self, inMemory: true)
}
```

---

## 41.3 @Query to Fetch and Display 🟢

**`@Query`** fetches saved objects **inside a view**, and keeps the result **live**:

```swift
struct RecipeListView: View {
    @Query(sort: \Recipe.title) private var recipes: [Recipe]

    var body: some View {
        List(recipes) { recipe in
            Text(recipe.title)
        }
    }
}
```

`recipes` works like a normal **array** in `body`. But SwiftData keeps it **in sync** with the store: when **any** code **inserts**, **deletes**, or **edits** a `Recipe`, this view **updates automatically**. No refetching, no notifications.

It's like `@State` (25.1), but the data lives in the **database**. It's the SwiftData version of Core Data's `@FetchRequest` (42.11).

`@Query` can **filter**, **sort**, and **limit**:

```swift
@Query(filter: #Predicate<Recipe> { $0.isFavorite },           // 41.9
       sort: [SortDescriptor(\Recipe.createdAt, order: .reverse)])
private var favorites: [Recipe]

@Query(FetchDescriptor<Recipe>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)],
                               fetchLimit: 5))                   // only the 5 newest
private var recent: [Recipe]
```

`@Query` only works **inside SwiftUI views**. Elsewhere, fetch with **`modelContext.fetch(FetchDescriptor<Recipe>())`**.

---

## 41.4 Inserting and Deleting Objects 🟢

**Create** an object, then **`insert`** it into a context. **`delete`** removes one:

```swift
struct AddRecipeView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""

    var body: some View {
        Form {
            TextField("Title", text: $title)
            Button("Save") {
                let recipe = Recipe(title: title, minutesToCook: 30)
                modelContext.insert(recipe)       // now SwiftData tracks it
                dismiss()
            }
            .disabled(title.isEmpty)
        }
    }
}

struct RecipeListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var recipes: [Recipe]

    var body: some View {
        List {
            ForEach(recipes) { Text($0.title) }
                .onDelete { offsets in
                    for index in offsets {
                        modelContext.delete(recipes[index])   // swipe to delete (26.6)
                    }
                }
        }
    }
}
```

**`@Environment(\.modelContext)`** reads the context that `.modelContainer()` put in the environment (41.2).

- **`insert`** registers a **new** object with the context.
- **`delete`** marks an object to be **removed**.
- **Editing** needs no call at all: just change a property (`recipe.title = "Pasta"`). The context **notices** automatically.

None of these write to **disk** immediately. They're **pending changes** until the context **saves** (41.5). But `@Query` views update **right away**, so the UI feels instant.

---

## 41.5 modelContext and Saving 🟢

A **`ModelContext`** keeps track of **pending changes**: inserts, deletes, and edits. **`save()`** writes them to the store:

```swift
struct EditRecipeView: View {
    @Environment(\.modelContext) private var modelContext
    @Bindable var recipe: Recipe          // @Model types are observable, so @Bindable works

    var body: some View {
        Form {
            TextField("Title", text: $recipe.title)          // edits are tracked immediately
            Stepper("Minutes: \(recipe.minutesToCook)", value: $recipe.minutesToCook, in: 1...240)
            Toggle("Favorite", isOn: $recipe.isFavorite)

            Button("Save Now") {
                do {
                    try modelContext.save()
                } catch {
                    print("Save failed: \(error)")
                }
            }
        }
    }
}
```

**`@Bindable`** (25.5) lets you bind form controls straight to the model's properties: `@Model` classes are **observable**, like `@Observable` ones.

**Do you need to call `save()`?** Often **no**. The **main** context (from `.modelContainer`) **autosaves**: after changes, at reasonable intervals, and when the app goes to the **background**. Call `save()` yourself when you need the write to happen **now**:

- Right before something that **reads the file** separately (a widget, a share extension).
- After a big **import**.
- In **background** contexts (41.15), which **don't** autosave.

| Context | Autosaves? |
|---|---|
| `container.mainContext` / `@Environment(\.modelContext)` | ✅ Yes |
| A context you create, or one in a `@ModelActor` | ❌ No: call `save()` |

To **undo** edits (like a Cancel button), use **`modelContext.rollback()`**, or turn on the context's **undo manager** (`.modelContainer(for:isUndoEnabled: true)`), which also enables **⌘Z** and shake to undo.

---

## 41.6 @Attribute Options 🟡

**`@Attribute`** changes **how** one property is stored:

```swift
@Model
final class User {
    @Attribute(.unique) var email: String
    @Attribute(.externalStorage) var profileImageData: Data?
    @Attribute(originalName: "name") var displayName: String     // renamed from "name" (41.17)
    @Transient var isSelected = false                            // not saved at all

    init(email: String, displayName: String) {
        self.email = email
        self.displayName = displayName
    }
}
```

| Option | Effect |
|---|---|
| `.unique` | No two objects can have the same value |
| `.externalStorage` | Store big data (images, files) as a **separate file**, not inside the database |
| `originalName:` | The property was **renamed**; find the old data under the old name |
| `.preserveValueOnDeletion` | Keep this value in the history after delete (iOS 18) |

**`.unique`** works as an **"upsert"** (update or insert): inserting a second `User` with an **existing** email **updates** the existing record instead of creating a duplicate. Great for data that comes from a **server**, keyed by the server's ID:

```swift
@Model
final class Article {
    @Attribute(.unique) var serverID: Int     // re-importing the feed updates, never duplicates
    var title: String
    init(serverID: Int, title: String) { self.serverID = serverID; self.title = title }
}
```

From iOS 18, the **`#Unique`** macro makes a **combination** of properties unique, and **`#Index`** adds **indexes** for faster filtering and sorting on big tables:

```swift
@Model
final class Booking {
    #Unique<Booking>([\.roomNumber, \.date])     // one booking per room per day
    #Index<Booking>([\.date])                    // fast "bookings on this date" queries
    var roomNumber: Int
    var date: Date
    init(roomNumber: Int, date: Date) { self.roomNumber = roomNumber; self.date = date }
}
```

**`.externalStorage`** is a **hint**: SwiftData stores large values in separate files, so the main database stays **small and fast** for the queries that don't need the image.

---

## 41.7 @Relationship and Delete Rules 🟡

When one model **refers** to another, that's a **relationship**. Just use the other `@Model` type (or an array of it) as a property. **`@Relationship`** sets **options**, like the **delete rule**:

```swift
@Model
final class Recipe {
    var title: String
    @Relationship(deleteRule: .cascade) var ingredients: [Ingredient] = []   // one recipe → many ingredients

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

// Usage
let pasta = Recipe(title: "Pasta")
modelContext.insert(pasta)
pasta.ingredients.append(Ingredient(name: "Spaghetti", quantity: "200 g"))   // saved with the recipe
```

The **delete rule** says what happens to **related** objects when you delete **this** one:

| Rule | When a `Recipe` is deleted… | Use when |
|---|---|---|
| `.cascade` | Its ingredients are **deleted too** | The children **belong** to the parent and mean nothing alone |
| `.nullify` (default) | Ingredients **stay**; their link to the recipe is cleared | The related objects can live on their own |
| `.deny` | The delete is **refused** while ingredients exist | You must remove children first |
| `.noAction` | Nothing happens to the others | Rare; you clean up yourself |

Choosing the rule is a real **modeling** decision. A recipe's ingredients → **cascade**. A recipe's **tags** (shared by many recipes) → **nullify**: deleting one recipe shouldn't delete the "Vegan" tag. It's the same idea as `ON DELETE CASCADE` in SQL databases.

---

## 41.8 Inverse Relationships 🟡

Often both sides **point at each other**: a recipe has `ingredients`, and each ingredient knows its `recipe`. Tell SwiftData they're **one** relationship with **`inverse:`**:

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
    var recipe: Recipe?          // the other side: optional, since it may be unset for a moment

    init(name: String) { self.name = name }
}

// Set ONE side; SwiftData sets the other
let salt = Ingredient(name: "Salt")
pasta.ingredients.append(salt)
print(salt.recipe?.title)       // "Pasta": filled in automatically
```

**`inverse: \Ingredient.recipe`** says: "`Recipe.ingredients` and `Ingredient.recipe` are the **two ends** of the **same** link". Then changing **one** side **updates the other** automatically. Without it, they could be treated as **two separate** relationships, and get **out of sync**.

SwiftData can sometimes **guess** the inverse, but declaring it **explicitly** is clearer and avoids surprises. Put `@Relationship(inverse:)` on **one** side only.

Many-to-many works the same way, with arrays on **both** sides:

```swift
@Model final class Recipe {
    var title: String
    @Relationship(inverse: \Tag.recipes) var tags: [Tag] = []
    init(title: String) { self.title = title }
}

@Model final class Tag {
    var name: String
    var recipes: [Recipe] = []
    init(name: String) { self.name = name }
}
```

---

## 41.9 #Predicate for Filtering 🟢

**`#Predicate`** describes a **filter** in normal, **type-checked** Swift:

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

It looks like a closure, but the macro **turns it into a database query**. The filtering happens **in the database**, not by loading everything and filtering in Swift.

Compare with Core Data's old **string** predicates:

```swift
// Core Data: a string; typos and wrong types only fail at RUN time
NSPredicate(format: "minutesToCok <= %d", 20)          // typo in the key → crash

// SwiftData: real Swift; typos fail at COMPILE time
#Predicate<Recipe> { $0.minutesToCook <= 20 }
```

More examples:

```swift
// Combine conditions
#Predicate<Recipe> { $0.isFavorite && $0.minutesToCook < 30 }

// Text search (case- and accent-insensitive, the way users expect)
let search = searchText                                 // copy to a local constant first
#Predicate<Recipe> { $0.title.localizedStandardContains(search) }

// Through a relationship
#Predicate<Recipe> { recipe in
    recipe.ingredients.contains { $0.name == "Garlic" }
}

// Optionals
#Predicate<Ingredient> { $0.recipe?.isFavorite == true }
```

⚠️ Use **local constants** for outside values (`let search = searchText`). Referring to a property of `self` inside the predicate (like `self.searchText`) isn't allowed.

---

## 41.10 #Predicate Limitations and Compile Errors 🟡

A predicate must be **translated** into the store's query language (SQL). So **not every** Swift expression is allowed: only operations SwiftData knows how to translate.

```swift
// ❌ Won't compile: the database can't run YOUR Swift function
#Predicate<Recipe> { customValidation($0.title) }

// ✅ Use operations the predicate CAN translate
#Predicate<Recipe> { !$0.title.isEmpty && $0.minutesToCook < 60 }
```

Many unsupported things are caught at **compile time**, with an error like "*The \_ function is not supported in this predicate*". That's the design goal: fail **early**, with a clear message.

But **not everything** is caught early. Some expressions **compile** fine, but the store can't run them, and you get a **run-time** error when fetching (for example, certain `String` methods, or some operations on computed properties). So:

- **Test** every non-trivial predicate (a quick unit test with an in-memory container, 41.2).
- Prefer the **known-good** operations: comparisons, `&&`/`||`/`!`, `contains`, `localizedStandardContains`, `starts(with:)`, optional checks, and `contains(where:)` on relationships.
- Filter on **stored** properties, not computed ones (the database only knows stored ones).

If you **really** need custom Swift logic, fetch a **narrowed** set with a simple predicate, then filter the rest **in Swift**:

```swift
let candidates = try modelContext.fetch(FetchDescriptor<Recipe>(
    predicate: #Predicate { $0.minutesToCook < 60 }       // the database does the heavy filtering
))
let valid = candidates.filter { customValidation($0.title) }   // Swift does the special part
```

The list of supported operations **grows** with each release, so check the docs for your minimum OS.

---

## 41.11 Sort Descriptors and Dynamic Sorting 🟡

`@Query(sort:)` sets the **order**. But `@Query`'s settings are fixed **when the view is created**. To let the user **change** the sort (or a search filter), give the query to a **child view** that builds it in **`init`**:

```swift
struct SortableRecipeListView: View {
    @State private var sortOrder = [SortDescriptor(\Recipe.title)]
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            RecipeListContent(sortOrder: sortOrder, searchText: searchText)
                .searchable(text: $searchText)
                .toolbar {
                    Picker("Sort", selection: $sortOrder) {
                        Text("Title").tag([SortDescriptor(\Recipe.title)])
                        Text("Cook Time").tag([SortDescriptor(\Recipe.minutesToCook)])
                        Text("Newest").tag([SortDescriptor(\Recipe.createdAt, order: .reverse)])
                    }
                }
        }
    }
}

struct RecipeListContent: View {
    @Query private var recipes: [Recipe]

    init(sortOrder: [SortDescriptor<Recipe>], searchText: String) {
        _recipes = Query(
            filter: #Predicate { searchText.isEmpty || $0.title.localizedStandardContains(searchText) },
            sort: sortOrder
        )
    }

    var body: some View {
        List(recipes) { Text($0.title) }
    }
}
```

How it works:

1. The **parent** keeps the user's choices (`sortOrder`, `searchText`) in `@State`.
2. When they change, the parent's `body` runs and creates a **new** `RecipeListContent` with the new values.
3. The child's **`init`** builds a **new** `Query` (assigned to `_recipes`, the wrapper itself), so the list is fetched with the new sort and filter.

You can't just change a property on an existing `@Query`; there's no setter. Building it in `init` is the standard pattern.

---

## 41.12 Section Fetches in @Query (iOS 27) 🟡

Many lists are **grouped**: contacts by letter, transactions by month, recipes by category. Today, you usually fetch a **flat** list and **group it yourself**:

```swift
struct GroupedRecipeListView: View {
    @Query(sort: \Recipe.title) private var recipes: [Recipe]

    private var sections: [(letter: String, recipes: [Recipe])] {
        Dictionary(grouping: recipes) { String($0.title.prefix(1)).uppercased() }
            .map { (letter: $0.key, recipes: $0.value) }
            .sorted { $0.letter < $1.letter }
    }

    var body: some View {
        List {
            ForEach(sections, id: \.letter) { section in
                Section(section.letter) {
                    ForEach(section.recipes) { Text($0.title) }
                }
            }
        }
    }
}
```

This works on every version, but it **regroups** the whole array in Swift every time `body` runs. For **big** lists, that's wasted work.

The iOS 27 SDK (in the title) adds **section-aware** queries: the **store** groups the results, using its own sorting and indexes, and hands you ready-made sections. That's more efficient for large data sets, and the code gets shorter.

⚠️ This is a **new API**, and its exact form (parameter names, result types) may differ from what you'd guess. Check the current SwiftData documentation before using it, and keep the manual version above for earlier OS versions.

If you group manually on big lists, at least **sort by the grouping key** in the query, and compute sections **once per change** (for example, in a model), not on every `body` run.

---

## 41.13 @Attribute(.codable) for Explicit Storage (iOS 27) 🟡

You can store **`Codable` structs** in a model property. By default, SwiftData decides **how**: it may **flatten** the struct's fields into separate columns, which makes them **queryable**, but the exact behavior depends on the type's shape and the OS version.

```swift
struct NutritionInfo: Codable {
    var calories: Int
    var protein: Double
}

@Model
final class Recipe {
    var title: String
    @Attribute(.codable) var nutrition: NutritionInfo?     // iOS 27 SDK: stored as encoded data

    init(title: String) { self.title = title }
}
```

The iOS 27 SDK adds an **explicit** option: **`@Attribute(.codable)`** says "store this value **as encoded data**, using its `Codable` conformance". No guessing.

⚠️ As with other new APIs in this course, confirm the exact spelling in the current documentation.

The **trade-off**:

| | Separate `@Model` type or flattened fields | Stored as a `Codable` blob |
|---|---|---|
| Filter/sort by inner fields in `#Predicate` | ✅ Yes | ❌ No: the database sees one opaque value |
| Modeling effort | More: another type, a relationship | Less: any `Codable` struct |
| Good for | Data you **search** or **sort** by | Data you only **load and show** (settings, metadata) |

Rule of thumb: if you'll ever write `#Predicate { $0.nutrition.calories < 500 }`, **don't** store it as a blob.

---

## 41.14 ResultsObserver Outside SwiftUI Views (iOS 27) 🔴

**`@Query`** only works inside **SwiftUI views**. But other code also needs **live** data: a **view model**, a **UIKit** view controller, a background **service**, a widget's timeline code.

Before iOS 27, the usual options were:

```swift
// 1. Fetch once (not live)
let recipes = try modelContext.fetch(FetchDescriptor<Recipe>(sortBy: [SortDescriptor(\.title)]))

// 2. Re-fetch when the store changes, by listening for save notifications
for await _ in NotificationCenter.default.notifications(named: ModelContext.didSave) {
    recipes = try modelContext.fetch(FetchDescriptor<Recipe>())
}
```

The iOS 27 SDK adds **`ResultsObserver`**: the same **"stay in sync with the store"** behavior as `@Query`, for **any** class:

```swift
@Observable
final class RecipeMonitor {
    private var observer: ResultsObserver<Recipe>?
    var recipes: [Recipe] = []

    func startObserving(context: ModelContext) {
        observer = ResultsObserver(context: context, descriptor: FetchDescriptor<Recipe>()) { [weak self] results in
            self?.recipes = results                   // called again whenever matching data changes
        }
    }
}
```

⚠️ This is a **new API**; check the current documentation for its exact shape before relying on this code.

It fills a real **gap**: logic that isn't a `View`, like a view model shared with UIKit (38.5) or a service that reacts to data changes, can now watch the store **without** hand-written notification code. Keep a **reference** to the observer (here, a property) for as long as you want updates.

---

## 41.15 Background Work with ModelActor 🔴

A **`ModelContext`** isn't thread-safe. The main one (`@Environment(\.modelContext)`) belongs to the **main actor**. Using it from a background task causes **data races** (20).

For heavy work (importing thousands of records, a big cleanup), use **`@ModelActor`**: an **actor** (19) with its **own** context:

```swift
@ModelActor
actor RecipeImporter {
    func importRecipes(from data: [RecipeDTO]) throws {
        for dto in data {
            let recipe = Recipe(title: dto.title, minutesToCook: dto.cookTime)
            modelContext.insert(recipe)
        }
        try modelContext.save()              // background contexts don't autosave
    }

    func markAllFavorite(_ ids: [PersistentIdentifier]) throws {
        for id in ids {
            if let recipe = self[id, as: Recipe.self] {   // look up by ID in THIS context
                recipe.isFavorite = true
            }
        }
        try modelContext.save()
    }
}

// Usage: create it with the container, call it with await
let importer = RecipeImporter(modelContainer: container)
try await importer.importRecipes(from: downloadedDTOs)
```

**`@ModelActor`** (a macro) gives the actor a **`modelContext`** and an `init(modelContainer:)`. All access to that context goes through the actor, **one call at a time**, off the main thread, so the UI stays smooth.

When the actor **saves**, the main context **sees** the changes, and `@Query` views update.

⚠️ **Model objects are not `Sendable`**: a `Recipe` from the main context must **not** be passed into the actor (or back out). Pass its **`persistentModelID`** instead, and look it up **inside** the other context, as `markAllFavorite` does:

```swift
let ids = selectedRecipes.map(\.persistentModelID)     // IDs are Sendable
try await importer.markAllFavorite(ids)
```

---

## 41.16 Schema Versioning with VersionedSchema 🔴

Apps change. Version 2 adds a property, renames another, splits a model in two. But users already have **version 1 data** on their devices. **Migration** turns old data into the new shape.

First, describe **each version** of your models with a **`VersionedSchema`**. Each version holds its **own copy** of the model types, frozen as they were:

```swift
enum RecipeSchemaV1: VersionedSchema {
    static let versionIdentifier = Schema.Version(1, 0, 0)
    static var models: [any PersistentModel.Type] { [Recipe.self] }

    @Model
    final class Recipe {
        var title: String
        var minutes: Int
        init(title: String, minutes: Int) { self.title = title; self.minutes = minutes }
    }
}

enum RecipeSchemaV2: VersionedSchema {
    static let versionIdentifier = Schema.Version(2, 0, 0)
    static var models: [any PersistentModel.Type] { [Recipe.self] }

    @Model
    final class Recipe {
        var title: String
        @Attribute(originalName: "minutes") var minutesToCook: Int   // renamed
        var difficulty: Int = 1                                     // new, with a default
        init(title: String, minutesToCook: Int) { self.title = title; self.minutesToCook = minutesToCook }
    }
}

// The rest of the app uses the latest version
typealias Recipe = RecipeSchemaV2.Recipe
```

Each schema is a **snapshot**: "this is what the models looked like in that release". SwiftData compares the **stored** data's version with the **current** one, and uses a **migration plan** (41.17) to get from one to the other.

Start versioning **before** your first App Store release. Adding it later works, but it's easier when version 1 is captured from the beginning.

---

## 41.17 Lightweight vs. Custom Migrations 🔴

A **`SchemaMigrationPlan`** lists the schema versions in order, and **how** to move between them:

```swift
enum RecipeMigrationPlan: SchemaMigrationPlan {
    static var schemas: [any VersionedSchema.Type] {
        [RecipeSchemaV1.self, RecipeSchemaV2.self, RecipeSchemaV3.self]
    }

    static var stages: [MigrationStage] { [v1ToV2, v2ToV3] }

    // Simple changes: SwiftData figures it out
    static let v1ToV2 = MigrationStage.lightweight(
        fromVersion: RecipeSchemaV1.self,
        toVersion: RecipeSchemaV2.self
    )

    // Changes that need YOUR logic
    static let v2ToV3 = MigrationStage.custom(
        fromVersion: RecipeSchemaV2.self,
        toVersion: RecipeSchemaV3.self,
        willMigrate: { context in
            // runs on the OLD schema: e.g., remove duplicates before adding a unique constraint
        },
        didMigrate: { context in
            // runs on the NEW schema: e.g., fill in a new field from existing data
            let recipes = try context.fetch(FetchDescriptor<RecipeSchemaV3.Recipe>())
            for recipe in recipes {
                recipe.difficulty = recipe.minutesToCook > 60 ? 3 : 1
            }
            try context.save()
        }
    )
}

// Use the plan when creating the container
let container = try ModelContainer(for: Recipe.self, migrationPlan: RecipeMigrationPlan.self)
```

| Migration | Handles | Your code |
|---|---|---|
| **Lightweight** | Adding properties (optional or with a default), removing properties, renaming with `originalName:`, adding models | None |
| **Custom** | Computing new values from old data, splitting or merging models, removing duplicates before adding `.unique` | `willMigrate` / `didMigrate` closures |

- **`willMigrate`** runs **before** the change, with the **old** models.
- **`didMigrate`** runs **after**, with the **new** models.

⚠️ Test migrations with **real old data**: install the previous version of the app, create data, then install the new one. A failed migration can mean the store **won't open**, which is the worst bug an app can ship.

---

## 41.18 SwiftData with CloudKit Sync 🟡

SwiftData can **sync** your data across the user's devices through **iCloud** (CloudKit, 44), mostly by **configuration**:

```swift
let configuration = ModelConfiguration(cloudKitDatabase: .automatic)
let container = try ModelContainer(for: Recipe.self, configurations: configuration)
```

**`.automatic`** uses the **private** CloudKit database of the iCloud container set up for the app. SwiftData then turns local changes into CloudKit records, and records from other devices into local changes, **for you**. You write **no** sync code.

Setup steps in Xcode:

1. Add the **iCloud** capability, check **CloudKit**, and pick or create a **container**.
2. Add the **Background Modes** capability with **Remote notifications** (so the device hears about changes from other devices).
3. Make the models **CloudKit-compatible** (41.19).

Good to know:

- Sync is **eventually consistent**: changes arrive after a short delay, not instantly, and need the user to be signed in to iCloud.
- It syncs to the user's **private** database: **their** data, on **their** devices. Sharing with other users needs more (44).
- Compared to doing this with Core Data (`NSPersistentCloudKitContainer`, 42.12) or raw CloudKit (44), it's **much** less code.

---

## 41.19 SwiftData Constraints Under CloudKit 🟡

CloudKit's data model is **different** from a local SQLite database, so models that sync must follow some **rules**:

| Rule | Why |
|---|---|
| Every property is **optional** or has a **default value** | A record may arrive **partially**, or from an **older** app version that didn't have that field |
| **No `.unique`** attributes | CloudKit can't enforce uniqueness across devices that edit **offline** |
| All **relationships** are **optional** | Related records may sync in any **order** |
| No `.deny` delete rule | Can't be enforced across devices |

```swift
// ❌ Not CloudKit-compatible
@Model final class User {
    @Attribute(.unique) var email: String          // unique: not supported
    var name: String                               // no default
}

// ✅ CloudKit-compatible
@Model final class User {
    var email: String = ""                         // defaults everywhere
    var name: String = ""
    var recipes: [Recipe]? = []                    // optional relationship
    init() {}
}
```

Since there's no `.unique`, **duplicates** can appear (two devices create the "same" item while offline). Handle them in **app logic**: detect and merge duplicates after sync, keyed by a value you control (like a UUID you assign).

If some data **must** be unique and **doesn't** need syncing, keep it in a **second, local-only** configuration in the same container.

Design for CloudKit **from the start**. Making an existing schema CloudKit-compatible later means a migration, and possibly data cleanup.

---

## 41.20 Sharing a Container with Widgets and Extensions 🟡

A **widget** or **share extension** is a **separate program**, with its **own** sandbox. By default, it can't see the main app's database. To share it, put the store in an **App Group** container: a folder that all your targets can access (43.2).

```swift
// The simple way (iOS 17): name the App Group in the configuration
let configuration = ModelConfiguration(groupContainer: .identifier("group.com.example.myapp"))
let container = try ModelContainer(for: Recipe.self, configurations: configuration)

// Or with an explicit file URL inside the group folder
let sharedURL = FileManager.default
    .containerURL(forSecurityApplicationGroupIdentifier: "group.com.example.myapp")!
    .appending(path: "SharedRecipes.store")
let configuration2 = ModelConfiguration(url: sharedURL)
```

Steps:

1. Add the **App Groups** capability to **both** the app and the extension, with the **same** group ID.
2. Create the container with that group **in both targets** (put the setup code in a file shared by both).

Then the widget can show **today's recipe** from the same store the app writes to.

After the app changes data that a widget shows, **save**, and ask the widget to **reload** (52):

```swift
try modelContext.save()
WidgetCenter.shared.reloadAllTimelines()
```

If the app **already shipped** with the store in its own sandbox, moving to an App Group means **copying** the old store file to the new location on first launch.

---

## 41.21 Debugging SwiftData Performance 🔴

Slow SwiftData usually comes from **fetching too much**, or doing **heavy work on the main thread**. The tools come from Core Data, since the engine is the same.

**1. See the SQL.** Add this **launch argument** (Xcode → Product → Scheme → Edit Scheme → Run → Arguments):

```
-com.apple.CoreData.SQLDebug 1
```

Every SQL statement SwiftData runs is printed in the console, with timing. You'll spot problems quickly: the same query running **hundreds** of times, or a fetch loading **thousands** of rows for a screen that shows ten.

Also useful while developing: `-com.apple.CoreData.ConcurrencyDebug 1` **crashes** immediately when a context is used from the **wrong thread**, instead of corrupting data quietly.

**2. Fix what you find:**

```swift
// Only fetch what the screen shows
var descriptor = FetchDescriptor<Recipe>(
    predicate: #Predicate { $0.isFavorite },                 // filter in the database
    sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
)
descriptor.fetchLimit = 20                                   // first page only
descriptor.propertiesToFetch = [\.title, \.createdAt]        // skip big fields like image data
descriptor.relationshipKeyPathsForPrefetching = [\.ingredients]   // load related data in ONE query

// Just need a number? Count without loading objects
let favoriteCount = try modelContext.fetchCount(FetchDescriptor<Recipe>(predicate: #Predicate { $0.isFavorite }))
```

| Problem | Fix |
|---|---|
| Loading everything, filtering in Swift | Filter with `#Predicate` in the query |
| Long lists load slowly | `fetchLimit` + paging; lazy lists (26.13) |
| Big blobs loaded for every row | `.externalStorage`; `propertiesToFetch` |
| One query per row for related data ("N+1") | `relationshipKeyPathsForPrefetching` |
| Slow filters on big tables | `#Index` on the filtered properties (41.6) |
| Big imports freeze the UI | Do them in a `@ModelActor` (41.15) |

**3. Profile.** Instruments has **Core Data** and **SwiftData** tools (69) that show fetches and saves over time. It's the persistence version of the SwiftUI instrument (31.13).

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Persisted model | `@Model` | A normal Swift class that SwiftData saves and observes |
| Storage setup | `ModelContainer`, `.modelContainer()` | The store; puts a context in the environment |
| Live fetching | `@Query` | Auto-updating results inside views |
| Mutating data | `modelContext.insert()`/`.delete()` | Add and remove; edits are tracked automatically |
| Committing changes | `modelContext.save()` | The main context autosaves; background ones don't |
| Column-level customization | `@Attribute(.unique/.externalStorage)`, `#Unique`, `#Index` | Upserts, big data in files, indexes |
| Object connections | `@Relationship(deleteRule:inverse:)` | Links with delete rules; inverses stay in sync |
| Type-safe filtering | `#Predicate` | Compile-checked filters run by the database |
| Result ordering | `SortDescriptor`, `@Query` built in `init` | Dynamic sort and search via a child view |
| Grouped results | Section-aware `@Query` (iOS 27) | Store-side grouping; check the new API's docs |
| Complex value storage | `@Attribute(.codable)` (iOS 27) | Store as a blob; can't filter inside it |
| Non-SwiftUI observation | `ResultsObserver` (iOS 27) | Live results outside views |
| Safe background work | `@ModelActor`, `persistentModelID` | Off-main-thread work; pass IDs, not objects |
| Schema evolution | `VersionedSchema` | Frozen snapshots of each model version |
| Migration logic | `.lightweight` vs. `.custom` stages | Automatic for simple changes; code for the rest |
| Multi-device sync | `ModelConfiguration(cloudKitDatabase:)` | iCloud sync with almost no code |
| CloudKit modeling limits | Optionals/defaults, no `.unique` | Fits CloudKit's eventually consistent model |
| Extension data sharing | App Group `ModelConfiguration` | One store for the app, widgets, and extensions |
| Performance diagnosis | SQL debug log, `fetchLimit`, prefetching | Fetch only what the screen needs |
