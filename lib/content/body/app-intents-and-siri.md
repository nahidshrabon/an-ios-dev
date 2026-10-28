**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**App Intents** is how your app tells the system "**here are things I can do**". Define an action **once**, as a Swift type, and it shows up in **Siri**, the **Shortcuts** app, **Spotlight**, **widgets** and **controls**, the **Action Button**, and more. This section covers intents, parameters, entities, App Shortcuts, snippets, newer features, testing, and moving from the older SiriKit.

Several lessons cover APIs **new in the iOS 27 SDK** (in their titles). New APIs can change between betas, so check the current documentation before relying on their exact shape.

---

## 51.1 Why App Intents Is Now the Siri Surface 🟢

Before App Intents, each system feature had its **own** integration: **SiriKit** (`INIntent`) for Siri, a separate setup for Shortcuts, separate code for Spotlight. **App Intents** (iOS 16+) **unifies** them:

```
            ┌──► Siri ("Mark a recipe cooked in RecipeApp")
            ├──► Shortcuts app (build automations)
AppIntent ──┼──► Spotlight (actions in search results)
            ├──► Widgets & controls (interactive buttons, 52)
            ├──► Action Button, Control Center
            └──► Apple Intelligence & Visual Intelligence
```

The **architecture** is simpler too:

| | SiriKit `INIntent` (old) | App Intents (new) |
|---|---|---|
| Definition | An `.intentdefinition` file + generated code | Plain **Swift** types |
| Where it runs | A separate **Intents extension** process | Usually **in your app** (or an extension, if you choose) |
| Surfaces | Mostly Siri | Siri, Shortcuts, Spotlight, widgets, controls, … |

An intent is just a **Swift type** that conforms to a protocol. That's a much simpler mental model, and the same definition works **everywhere** the system wants to know "what can this app do?".

---

## 51.2 Your First AppIntent 🟢

An **`AppIntent`** describes **one action**. Its **`perform()`** method does the work:

```swift
import AppIntents

struct MarkRecipeCookedIntent: AppIntent {
    static let title: LocalizedStringResource = "Mark Recipe as Cooked"
    static let description = IntentDescription("Marks a recipe as cooked today.")

    @Parameter(title: "Recipe")
    var recipe: RecipeEntity                         // 51.4

    @Dependency private var recipeStore: RecipeStore // injected (51.14)

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try await recipeStore.markCooked(recipe.id)
        return .result(dialog: "Marked \(recipe.title) as cooked.")   // spoken by Siri / shown in Shortcuts
    }
}
```

- **`title`** is the name users see everywhere (Shortcuts, Siri suggestions, Spotlight).
- **`perform()`** is **`async throws`**: it can call your existing **async** services, just like the rest of the app (45.5).
- Throwing an error shows a **failure** message to the user.

A good intent is a **thin wrapper**: it **calls** logic the app **already has**, instead of duplicating it. That keeps the app and its intents consistent, and makes intents easy to test.

Register the dependency once at launch:

```swift
@main
struct RecipeApp: App {
    init() {
        let store = RecipeStore()
        AppDependencyManager.shared.add(dependency: store)     // available to @Dependency in intents
    }
    var body: some Scene { WindowGroup { ContentView() } }
}
```

That's all: the intent now appears in the **Shortcuts** app automatically. No registration list, no extension.

---

## 51.3 IntentParameter and Parameter Summaries 🟢

**`@Parameter`** declares an **input**. A **parameter summary** turns the intent into a **readable sentence**:

```swift
struct SetCookTimerIntent: AppIntent {
    static let title: LocalizedStringResource = "Set Cook Timer"

    @Parameter(title: "Recipe")
    var recipe: RecipeEntity

    @Parameter(title: "Minutes", default: 10, inclusiveRange: (1, 240))
    var minutes: Int

    static var parameterSummary: some ParameterSummary {
        Summary("Set a \(\.$minutes)-minute timer for \(\.$recipe)")
    }

    func perform() async throws -> some IntentResult {
        // start the timer
        return .result()
    }
}
```

In the Shortcuts editor, this shows as a sentence with **tappable** blanks:

> Set a **[10]**-minute timer for **[Pasta Carbonara]**

The **`\.$minutes`** syntax refers to the **parameter itself** (its projected value, 12.6), so the editor can make it editable in place.

Parameters can be:

| Type | Example |
|---|---|
| Basic values | `String`, `Int`, `Double`, `Bool`, `Date`, `URL` |
| Fixed choices | An **`AppEnum`** (51.5) |
| Your app's things | An **`AppEntity`** (51.4) |
| Optional | `var note: String?`: Siri doesn't ask for it |

If a **required** parameter has no value, Siri or Shortcuts **asks** the user for it ("Which recipe?"). Writing the summary is real **UX writing**: it's the sentence users read when building automations.

---

## 51.4 AppEntity and EntityQuery 🟡

An **`AppEntity`** is a **thing** in your app that intents can refer to: a recipe, a playlist, a contact. An **`EntityQuery`** tells the system how to **find** entities:

```swift
struct RecipeEntity: AppEntity {
    let id: UUID
    let title: String

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Recipe"
    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)", image: .init(systemName: "fork.knife"))
    }
    static let defaultQuery = RecipeEntityQuery()
}

struct RecipeEntityQuery: EntityStringQuery {
    @Dependency private var recipeStore: RecipeStore

    // "Give me the entities with these IDs" (e.g. a recipe saved in a shortcut)
    func entities(for identifiers: [UUID]) async throws -> [RecipeEntity] {
        try await recipeStore.recipes(withIDs: identifiers).map { RecipeEntity(id: $0.id, title: $0.title) }
    }

    // "What should I show before the user types anything?"
    func suggestedEntities() async throws -> [RecipeEntity] {
        try await recipeStore.recentRecipes().map { RecipeEntity(id: $0.id, title: $0.title) }
    }

    // "The user typed 'carb': what matches?"
    func entities(matching string: String) async throws -> [RecipeEntity] {
        try await recipeStore.search(string).map { RecipeEntity(id: $0.id, title: $0.title) }
    }
}
```

| Method | Called when |
|---|---|
| `entities(for:)` | The system has **IDs** (from a saved shortcut) and needs the **current** entities |
| `suggestedEntities()` | Showing a **default list**, before any search |
| `entities(matching:)` | The user **types** a search (from `EntityStringQuery`) |

This powers the "**pick a recipe**" experience in Shortcuts and Siri's "which recipe?" follow-up.

Keep the entity **small**: an **ID** and what's needed to **show** it. The query loads from your **existing** data layer (SwiftData, 41), so there's no separate store for intents. The **ID must be stable**: shortcuts store it and look the entity up later.

---

## 51.5 AppEnum for Fixed Options 🟢

For a **small, fixed** set of choices, use **`AppEnum`** instead of an entity:

```swift
enum RecipeSortOrder: String, AppEnum {
    case title, cookTime, dateAdded

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Sort Order"
    static let caseDisplayRepresentations: [RecipeSortOrder: DisplayRepresentation] = [
        .title: "Title",
        .cookTime: "Cook Time",
        .dateAdded: DisplayRepresentation(title: "Date Added", image: .init(systemName: "calendar"))
    ]
}

struct ShowRecipesIntent: AppIntent {
    static let title: LocalizedStringResource = "Show Recipes"
    static let openAppWhenRun = true                    // this one opens the app

    @Parameter(title: "Sort By", default: .title)
    var sortOrder: RecipeSortOrder

    func perform() async throws -> some IntentResult { .result() }
}
```

| Use | When |
|---|---|
| `AppEnum` | A **fixed** list known at **compile time**: sort orders, meal types, sizes |
| `AppEntity` | An **open-ended**, **changing** list from your **data**: recipes, users, files |

An `AppEnum` is shown as a simple **picker**. It needs no query, because the system already knows all the cases. It's a normal Swift enum (6), plus **display names** for the UI.

---

## 51.6 AppShortcutsProvider and Phrase Design 🟢

**App Shortcuts** are intents your app **offers ready-made**, with **phrases** Siri recognizes. They work **right after install**: the user doesn't have to build anything in the Shortcuts app.

```swift
struct RecipeAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: MarkRecipeCookedIntent(),
            phrases: [
                "Mark a recipe cooked in \(.applicationName)",
                "Mark \(\.$recipe) as cooked in \(.applicationName)"       // a phrase with a parameter
            ],
            shortTitle: "Mark Cooked",
            systemImageName: "checkmark.circle"
        )
        AppShortcut(
            intent: SetCookTimerIntent(),
            phrases: ["Start a cook timer in \(.applicationName)"],
            shortTitle: "Cook Timer",
            systemImageName: "timer"
        )
    }
}
```

Why App Shortcuts matter: most users will **never** open the Shortcuts app to build an automation. App Shortcuts appear **automatically** in **Spotlight**, in **Siri suggestions**, and in the Shortcuts app's **app section**, so users **discover** them.

Phrase rules and tips:

- Every phrase must include **`\(.applicationName)`**. It tells Siri **which app** you mean ("Start a timer" alone could be any app).
- A phrase can include **one** entity or enum parameter, like `\(\.$recipe)`: "Mark **Carbonara** as cooked in RecipeApp".
- Write phrases people would **actually say**. Add a few **variations**.
- An app can have up to **10** App Shortcuts. Pick your most **useful** actions.
- When your entities change (new recipes), call `RecipeAppShortcuts.updateAppShortcutParameters()` so Siri learns the new names.

Phrase writing is real **user-facing writing**, not just code.

---

## 51.7 Localizing Shortcut Phrases 🟡

Intent titles, parameter names, display representations, and **phrases** are all **`LocalizedStringResource`**s, so they go through Xcode's normal **String Catalog** (`.xcstrings`, 71) like every other string:

```swift
static var appShortcuts: [AppShortcut] {
    AppShortcut(
        intent: MarkRecipeCookedIntent(),
        phrases: [
            "Mark a recipe cooked in \(.applicationName)",
            "Mark recipe as done in \(.applicationName)"     // more variations = better recognition
        ],
        shortTitle: "Mark Cooked",
        systemImageName: "checkmark.circle"
    )
}
```

Xcode extracts App Shortcut phrases into a separate **`AppShortcuts.xcstrings`** catalog, where translators add each language's phrases.

But **voice** phrases need more care than screen text:

- A word-for-word translation can sound **unnatural** when **spoken**. Translators should write how people **really say** it in that language, even with a different sentence structure.
- The **app name** may sit in a different **position** in the sentence.
- Add **several** natural variations per language, not just one.
- **Test** each language by actually **speaking** to Siri on a device set to that language.

---

## 51.8 Interactive Snippets and SnippetIntent 🟡

An intent can return a **snippet**: a small **SwiftUI** view shown in Siri, Spotlight, or Shortcuts as the **result**, instead of only a spoken sentence:

```swift
struct MarkRecipeCookedIntent: AppIntent {
    // ... title and parameters as before

    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        try await recipeStore.markCooked(recipe.id)
        return .result(
            dialog: "Done!",
            view: RecipeCookedSnippetView(recipe: recipe)
        )
    }
}

struct RecipeCookedSnippetView: View {
    let recipe: RecipeEntity

    var body: some View {
        HStack {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green).font(.title)
            VStack(alignment: .leading) {
                Text(recipe.title).font(.headline)
                Text("Marked as cooked today").font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}
```

**`ShowsSnippetView`** in the return type says "this intent returns a view". The snippet is **plain SwiftUI** (Part 3): no new UI system to learn.

From iOS 26, snippets can also be **interactive**: a **`SnippetIntent`** renders a snippet that contains **buttons** (backed by other intents), and the snippet **updates** after each tap. For example, a "cook timer" snippet with **+1 min** and **Stop** buttons, all without opening the app.

Snippets give much better feedback than a generic "OK, done": the user **sees** which recipe and what changed.

---

## 51.9 RelevantEntities for Contextual Suggestions (iOS 27) 🔴

**Suggestions** are best when they appear at the **right moment**: dinner recipes around **dinner time**, the gym playlist **at the gym**. Your app often **knows** what's relevant better than the system can guess.

Since iOS 17, apps can tell the system which **intents** are relevant, and **when**, through **`RelevantIntentManager`**:

```swift
func updateRelevantRecipes() async {
    let dinnerRecipes = (try? await recipeStore.recipesForMealType(.dinner)) ?? []

    let relevant = dinnerRecipes.prefix(5).map { recipe in
        var intent = MarkRecipeCookedIntent()
        intent.recipe = RecipeEntity(id: recipe.id, title: recipe.title)
        return RelevantIntent(intent,
                              widgetKind: "RecipeWidget",
                              relevance: RelevantContext.date(from: dinnerStart, to: dinnerEnd))
    }
    try? await RelevantIntentManager.shared.updateRelevantIntents(Array(relevant))
}
```

The iOS 27 SDK (in the title) extends this idea to **entities**: the app can mark specific **entities** as relevant in a given **context** (time, place, recent activity), improving **Siri** and **Spotlight** suggestions directly.

⚠️ The exact iOS 27 API may differ from older relevance APIs; check the documentation.

The difference from `suggestedEntities()` (51.4):

| | `suggestedEntities()` | Relevance APIs |
|---|---|---|
| Direction | **Reactive**: called when the user is **picking** a value | **Proactive**: the app **pushes** hints to the system |
| When | Only while editing a shortcut / answering Siri | Any time; used to surface suggestions **before** the user asks |

Update relevance when the context **changes** (new data, a new day), and keep it **honest**: suggesting irrelevant things trains users to ignore them.

---

## 51.10 EntityCollection for Lazy Resolution (iOS 27) 🔴

Imagine an app with **50,000** recipes. When the user types "pa" in a Shortcuts picker, returning **all** matches at once means loading thousands of entities that will **never be shown**: slow and memory-hungry.

The iOS 27 SDK's **`EntityCollection`** lets a query return results **lazily**, **page by page**, using a **cursor** ("where I stopped last time"):

```swift
// ⚠️ New iOS 27 API: shape shown for illustration; check the documentation
struct RecipeEntityQuery: EntityStringQuery {
    func entities(matching string: String) async throws -> EntityCollection<RecipeEntity> {
        EntityCollection { cursor in
            let page = try await recipeStore.searchRecipes(matching: string, cursor: cursor)
            return .init(items: page.items.map { RecipeEntity(id: $0.id, title: $0.title) },
                         nextCursor: page.nextCursor)   // nil = no more pages
        }
    }
}
```

The system asks for the **first page**; only if the user **scrolls** does it ask for the **next**, passing the cursor back.

It's the same **cursor pagination** idea used by many server APIs and by CloudKit's query cursors (44.2): never load everything when the user only sees the first screen.

On earlier OS versions, **limit** results yourself (for example, the top 50 matches, best first), which covers most real use.

---

## 51.11 SyncableEntity for Cross-Device IDs (iOS 27) 🔴

Shortcuts **sync** across the user's devices through iCloud. A shortcut built on the **iPhone** that references "Pasta Carbonara" stores that recipe's **ID**. When the shortcut runs on the **iPad**, the iPad's query looks up **that ID**.

If each device gave the same recipe a **different** ID (for example, one generated locally when the data was first downloaded), the lookup **fails** on the other device.

The iOS 27 SDK's **`SyncableEntity`** makes this expectation **explicit**: entities that conform promise that their **ID is the same on all of the user's devices**:

```swift
// ⚠️ New iOS 27 API; check the documentation for its exact requirements
struct RecipeEntity: AppEntity, SyncableEntity {
    let id: UUID      // MUST be the same everywhere: e.g. the ID stored in the synced record
    let title: String
    // ...
}
```

The real work is in your **data model**: the ID must come from **synced** data, like the record's own identifier in CloudKit (44.1) or a UUID you generate **once** and store in the synced SwiftData model (41.18). Never use something **device-local**, like a database row number or `persistentModelID`.

---

## 51.12 LongRunningIntent Beyond the 30s Limit (iOS 27) 🔴

Normal intents should **finish quickly**: the system gives them a **short** time budget (around 30 seconds), like background refresh (49.10). But some actions really take longer: exporting all recipes, processing a video, syncing a large library.

The iOS 27 SDK's **`LongRunningIntent`** lets an intent **opt in** to a longer run, with **live progress** in the surface that started it (Siri, Shortcuts):

```swift
// ⚠️ New iOS 27 API; check the documentation for exact requirements
struct ExportAllRecipesIntent: AppIntent, LongRunningIntent, ProgressReportingIntent {
    static let title: LocalizedStringResource = "Export All Recipes"

    func perform() async throws -> some IntentResult {
        let recipes = try await recipeStore.allRecipes()
        progress.totalUnitCount = Int64(recipes.count)

        for recipe in recipes {
            try Task.checkCancellation()                    // the user can stop it
            try await exporter.export(recipe)
            progress.completedUnitCount += 1                // shown live to the user
        }
        return .result()
    }
}
```

**`ProgressReportingIntent`** (available since iOS 16) gives the intent a **`progress`** object to update.

It's the intent version of **`BGContinuedProcessingTask`** (49.12): work the **user** started, that legitimately takes a while, with **visible** progress and a way to **cancel**, instead of silently timing out.

---

## 51.13 ExecutionTargets — Where an Intent Runs (iOS 27) 🔴

**Where** should an intent's `perform()` run?

- A quick data change ("mark cooked") can run in the **background**, without showing the app.
- "Show my recipes sorted by time" needs the app **on screen**.
- Some intents might start in the background and only **open the app** if needed (for example, to ask for login).

iOS 26 added **`supportedModes`** to declare this:

```swift
struct MarkRecipeCookedIntent: AppIntent {
    static let supportedModes: IntentModes = .background       // never opens the app

    // ...
}

struct ShowRecipeIntent: AppIntent {
    static let supportedModes: IntentModes = .foreground       // always opens the app

    // ...
}

struct SyncNowIntent: AppIntent {
    static let supportedModes: IntentModes = [.background, .foreground(.dynamic)]

    func perform() async throws -> some IntentResult {
        guard await session.isLoggedIn else {
            try await continueInForeground()                   // open the app only when needed
            return .result()
        }
        try await syncEngine.sync()
        return .result()
    }
}
```

(Older code used **`openAppWhenRun = true`** for "always foreground".)

The iOS 27 SDK's **`ExecutionTargets`** (in the title) takes this further, letting an intent declare which **processes or contexts** it can run in (the app, an extension, and more).

⚠️ Check the current documentation for the exact iOS 27 API.

The idea in both: make "**where does this run?**" an **explicit** part of the intent, instead of something the system has to guess.

---

## 51.14 Testing with the AppIntentsTesting Framework (iOS 27) 🟡

A well-built intent is a **thin wrapper** around app logic (51.2), so testing it is mostly the **same** as testing the rest of the app (65): inject **fake** dependencies, call the code, check the results.

You can already test intents **today** by creating one and calling **`perform()`** directly:

```swift
import Testing
import AppIntents
@testable import RecipeApp

@Test
func markingRecipeCookedUpdatesStore() async throws {
    let store = InMemoryRecipeStore(recipes: [.sample])        // a fake store
    AppDependencyManager.shared.add(dependency: store as RecipeStore)

    var intent = MarkRecipeCookedIntent()
    intent.recipe = RecipeEntity(id: Recipe.sample.id, title: Recipe.sample.title)

    _ = try await intent.perform()

    #expect(await store.isCooked(Recipe.sample.id))
}
```

The iOS 27 SDK adds an **`AppIntentsTesting`** framework (in the title) with helpers for building intents with test **parameter** values, running them like the system would, and checking the **result** (dialog, snippet, value).

⚠️ It's new; check the documentation for its API.

Also test the **queries** (51.4): `entities(for:)` with unknown IDs (should return fewer, not crash), and `entities(matching:)` with odd input. And try your App Shortcuts by **voice** on a real device.

---

## 51.15 Action Button and Control Center Entry Points 🟢

The **Action Button** (iPhone 15 Pro and later) and **Control Center** give users a **one-press** way to run your app's actions, without opening the app or talking to Siri.

**Action Button**: the user can assign it to a **Shortcut**, and your **App Shortcuts** (51.6) appear in that list. Every intent you offer as an App Shortcut is therefore **one setting away** from a hardware button.

**Control Center, Lock Screen, and the Action Button's "Controls"** (iOS 18) use **controls**: small widgets that run an intent. You build them in your **widget extension** (52):

```swift
import WidgetKit
import SwiftUI

struct StartTimerControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.example.myapp.start-timer") {
            ControlWidgetButton(action: StartDefaultTimerIntent()) {     // the SAME kind of AppIntent
                Label("Cook Timer", systemImage: "timer")
            }
        }
        .displayName("Cook Timer")
    }
}
```

This is App Intents' **unified design** (51.1) paying off: the **same** intent type that powers Siri and Shortcuts also powers the Action Button and controls. You write the **action** once; each new surface needs, at most, a small declaration like the control above.

---

## 51.16 Visual Intelligence Integration 🔴

**Visual Intelligence** (iOS 26, on Apple Intelligence devices) lets users point the **camera** at something, or use a **screenshot**, and ask the system about what's **visible**. Apps can join in: when the user looks at a **dish**, your recipe app can offer **matching recipes**.

The integration uses App Intents types. The app provides a query that receives a **description of the visual content** and returns **matching entities**:

```swift
// iOS 26: shape for illustration; see the Visual Intelligence documentation for details
import VisualIntelligence

struct RecipeVisualSearchQuery: IntentValueQuery {
    func values(for input: SemanticContentDescriptor) async throws -> [RecipeEntity] {
        // input describes what the system saw (e.g. labels like "pasta", "tomato")
        try await recipeStore.recipes(matchingLabels: input.labels)
            .map { RecipeEntity(id: $0.id, title: $0.title) }
    }
}
```

The system shows your results next to other apps'. Tapping one opens your app on that recipe (with an `OpenIntent` for the entity).

This is the newest, still-growing edge of App Intents. Instead of the user **asking** by name ("open Carbonara in RecipeApp"), the system **suggests** your app based on what the user **sees**. It works **because** your app already describes its content as **entities** (51.4): the same building blocks, reused for a new surface.

---

## 51.17 Migrating from SiriKit INIntent 🟡

Apps with an older **SiriKit** integration (`INIntent`, an Intents extension, an `.intentdefinition` file) can move to App Intents. The two systems are **different** (a separate extension process vs. Swift types in the app), so it's a **rewrite of the integration layer**, but **not** of the app's logic.

```
Migration steps:
1. List each INIntent, and the app code it ends up calling.
2. Write an AppIntent for each, as a thin wrapper around that SAME code (45.5).
   Xcode can generate a starting point: open the .intentdefinition file and
   choose "Convert to App Intent".
3. Add an AppShortcutsProvider (51.6) for phrases and discovery: something
   the old model didn't offer in the same way.
4. Test on devices that ran the old version: existing user shortcuts should
   keep working (keep the old intents until the new ones are proven).
5. Remove the Intents extension and .intentdefinition file.
```

A few **specific** SiriKit **domains** (like messaging, calling, and workouts) still use their own SiriKit intents for deep system integration, so check whether your use case is one of them.

Why it's usually **not** painful: in a well-structured app, the **business logic** lives in services, separate from any one **surface** (45). Siri was just one more way to **call** that logic. Changing the "Siri adapter" from SiriKit to App Intents touches a **small, isolated** part of the codebase. That's exactly the payoff of good separation of concerns: a big framework change, but a small code change.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Unified framework | `AppIntent` protocol | One definition for Siri, Shortcuts, Spotlight, widgets, and more |
| Basic action | `perform()`, `@Dependency` | A thin wrapper around existing app logic |
| Input & natural language | `@Parameter`, `parameterSummary` | Typed inputs, shown as an editable sentence |
| Searchable entities | `AppEntity`, `EntityQuery`, `EntityStringQuery` | Your app's things, found by ID or search |
| Fixed choices | `AppEnum` | Picker-style parameters from an enum |
| Proactive discovery | `AppShortcutsProvider`, phrases | Ready-made actions with `\(.applicationName)` phrases |
| Voice localization | `LocalizedStringResource`, `AppShortcuts.xcstrings` | Natural spoken phrases per language |
| Rich visual feedback | Snippets, `ShowsSnippetView`, `SnippetIntent` | SwiftUI results, even interactive ones |
| Proactive relevance | `RelevantIntentManager`, relevant entities (iOS 27) | Tell the system what matters now |
| Scalable search | `EntityCollection` (iOS 27) | Page through big result sets lazily |
| Cross-device consistency | `SyncableEntity` (iOS 27) | Same entity IDs on all devices |
| Extended time budget | `LongRunningIntent` (iOS 27), `ProgressReportingIntent` | Long user-started work with live progress |
| Execution location | `supportedModes`, `ExecutionTargets` (iOS 27) | Declare where `perform()` runs |
| Testability | Call `perform()` with fakes; `AppIntentsTesting` (iOS 27) | Test intents like any other code |
| Fast system access | Action Button, `ControlWidget` | One-press actions from the same intents |
| Emerging surface | Visual Intelligence | Suggestions from what the user sees |
| Legacy migration | SiriKit `INIntent` → `AppIntent` | Rewrite the thin adapter, not the logic |
