## 51.1 Why App Intents Is Now the Siri Surface

App Intents unifies what used to be several separate, framework-specific integration points (SiriKit's `INIntent` for Siri specifically, a separate Shortcuts app integration mechanism, Spotlight indexing) into one Swift-native framework that simultaneously powers Siri, the Shortcuts app, Spotlight suggestions, widgets, and more from a single intent definition.

```swift
// One AppIntent definition simultaneously powers Siri requests,
// Shortcuts automations, Spotlight suggestions, and more —
// no separate integration code needed per surface.
```

The core shift from SiriKit is architectural: rather than implementing a separate Intents extension process (a genuinely different, sandboxed target with its own lifecycle) that Siri communicates with via IPC, App Intents live directly in the main app's process as ordinary Swift types conforming to a protocol — a much simpler mental model, and one that naturally extends to every surface that wants to expose "things this app can do" to the system, not just Siri specifically.

---

## 51.2 Your First AppIntent

An `AppIntent` conformer describes one specific action the app can perform, with a `perform()` method containing the actual logic — the framework handles presenting it to Siri, Shortcuts, and other surfaces based on this single definition.

```swift
import AppIntents

struct MarkRecipeCookedIntent: AppIntent {
    static var title: LocalizedStringResource = "Mark Recipe as Cooked"

    @Parameter(title: "Recipe")
    var recipe: RecipeEntity

    func perform() async throws -> some IntentResult {
        try await recipeStore.markCooked(recipe.id)
        return .result()
    }
}
```

`static var title` provides the human-readable name shown throughout the system (Shortcuts app, Siri suggestions), and `perform()` is where the actual action happens — since it's `async throws`, it can naturally call into the same async service/repository layer (section 45.5) the rest of the app already uses, meaning an intent's implementation is typically a thin wrapper around logic the app already has, rather than a parallel, duplicated implementation.

---

## 51.3 IntentParameter and Parameter Summaries

`@Parameter` declares an input an intent needs, and a parameter summary provides a natural-language template showing how the intent (with its filled-in parameters) reads as a coherent sentence throughout Shortcuts and Siri.

```swift
struct SetCookTimerIntent: AppIntent {
    static var title: LocalizedStringResource = "Set Cook Timer"

    @Parameter(title: "Recipe")
    var recipe: RecipeEntity

    @Parameter(title: "Minutes", default: 10)
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

The `parameterSummary`, built using key-path references to the declared `@Parameter` properties, is what produces the natural-language rendering users see and edit directly within the Shortcuts app's visual editor (e.g., "Set a [10]-minute timer for [Pasta Carbonara]," with the bracketed values individually tappable and editable) — getting this summary right is a genuine UX design task, not just a technical declaration, since it's literally the sentence a user reads and constructs their automation around.

---

## 51.4 AppEntity and EntityQuery

`AppEntity` represents a specific, identifiable "thing" the app knows about (like a specific recipe) that Siri/Shortcuts can reference by name or by resolving a search — paired with `EntityQuery`, which tells the system how to find and resolve entities matching a given search string or set of identifiers.

```swift
struct RecipeEntity: AppEntity {
    let id: UUID
    let title: String

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Recipe"
    var displayRepresentation: DisplayRepresentation { DisplayRepresentation(title: "\(title)") }
    static var defaultQuery = RecipeEntityQuery()
}

struct RecipeEntityQuery: EntityQuery {
    func entities(for identifiers: [UUID]) async throws -> [RecipeEntity] {
        try await recipeStore.recipes(withIDs: identifiers).map { RecipeEntity(id: $0.id, title: $0.title) }
    }

    func suggestedEntities() async throws -> [RecipeEntity] {
        try await recipeStore.recentRecipes().map { RecipeEntity(id: $0.id, title: $0.title) }
    }
}
```

This is what powers the "type to search for a specific recipe" experience when a user configures a Shortcut using `MarkRecipeCookedIntent`'s `recipe` parameter (from 51.2) — `entities(for:)` resolves specific known identifiers back into full entity objects (e.g., loading a previously-selected recipe by ID), while `suggestedEntities()` provides a reasonable default list (like recently-viewed recipes) shown before the user has typed anything, both mapping directly onto the app's existing data layer rather than requiring a separate, App-Intents-specific data store.

---

## 51.5 AppEnum for Fixed Options

`AppEnum` represents a parameter with a small, fixed set of choices (rather than an open-ended, searchable entity) — appropriate for something like a sort order or a filter category that has a known, bounded set of valid values.

```swift
enum RecipeSortOrder: String, AppEnum {
    case title, cookTime, dateAdded

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Sort Order"
    static var caseDisplayRepresentations: [RecipeSortOrder: DisplayRepresentation] = [
        .title: "Title",
        .cookTime: "Cook Time",
        .dateAdded: "Date Added"
    ]
}
```

Unlike `AppEntity`, which requires an `EntityQuery` to resolve arbitrary values by search, `AppEnum` presents its `caseDisplayRepresentations` directly as a fixed picker within Shortcuts/Siri — appropriate for exactly the same kind of bounded, enumerable choice set that would use a plain Swift `enum` elsewhere in the app (recall enum modeling, section 6), just with the additional display-representation metadata App Intents needs to present it as a user-facing picker.

---

## 51.6 AppShortcutsProvider and Phrase Design

`AppShortcutsProvider` declares a curated set of an app's intents as "App Shortcuts" — pre-packaged, discoverable automations that appear automatically in Spotlight and Siri suggestions without the user needing to manually build them in the Shortcuts app first, each associated with specific trigger phrases.

```swift
struct RecipeAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: MarkRecipeCookedIntent(),
            phrases: ["Mark a recipe cooked in \(.applicationName)"],
            shortTitle: "Mark Cooked",
            systemImageName: "checkmark.circle"
        )
    }
}
```

App Shortcuts are meaningfully different from ordinary custom Shortcuts a user builds themselves — because they're pre-declared by the app with pre-written phrases, the system can surface them proactively (in Spotlight, in Siri suggestions) *before* a user has ever manually configured anything, dramatically lowering the discovery barrier compared to requiring users to know App Intents exist at all and build their own automation first. Phrase design (crafting a natural-sounding trigger phrase that includes `\(.applicationName)`, required so Siri can disambiguate which app's shortcut is being invoked when phrases might otherwise be ambiguous across apps) is a genuine, user-facing writing task.

---

## 51.7 Localizing Shortcut Phrases

Shortcut phrases, parameter titles, and entity display names all flow through Xcode's standard localization system (`.xcstrings` catalogs), letting an app's Siri/Shortcuts integration work naturally across every language the app supports, not just the phrases' original authored language.

```swift
static var appShortcuts: [AppShortcut] {
    AppShortcut(
        intent: MarkRecipeCookedIntent(),
        phrases: [
            "Mark a recipe cooked in \(.applicationName)",
            "Mark recipe as done in \(.applicationName)" // an alternate phrasing, also localized
        ],
        shortTitle: "Mark Cooked",
        systemImageName: "checkmark.circle"
    )
}
```

Because `LocalizedStringResource` (used throughout App Intents' `title`, `phrases`, and display representations) is the same localization mechanism used elsewhere in the app, translated phrase variants are added the same way any other localized string would be — but with an added consideration specific to voice: a phrase that sounds natural and unambiguous in one language may need a genuinely different sentence structure (not just a word-for-word translation) to sound natural when actually spoken aloud to Siri in another language, making shortcut phrase localization a slightly more nuanced task than typical UI string translation.

---

## 51.8 Interactive Snippets and SnippetIntent

An intent can return a **snippet** — a small, custom SwiftUI view shown directly within the Siri/Shortcuts interface as a visual confirmation or result, rather than just a spoken/text response — via `IntentResult`'s snippet-returning variants or a dedicated `SnippetIntent`.

```swift
struct MarkRecipeCookedIntent: AppIntent {
    // ... title, parameters as before

    func perform() async throws -> some IntentResult & ShowsSnippetView {
        try await recipeStore.markCooked(recipe.id)
        return .result(view: RecipeCookedSnippetView(recipe: recipe))
    }
}

struct RecipeCookedSnippetView: View {
    let recipe: RecipeEntity
    var body: some View {
        Label("\(recipe.title) marked as cooked!", systemImage: "checkmark.circle.fill")
            .padding()
    }
}
```

`ShowsSnippetView` in the return type signals that this intent provides rich visual feedback, and the snippet itself is ordinary SwiftUI — reusing the same view-building skills from throughout Part 3 rather than requiring a separate UI paradigm specific to Siri — giving users meaningfully better confirmation than a generic spoken "Okay, done" response, especially valuable for intents whose result benefits from visual context (like confirming exactly which recipe and cook time a timer intent configured).

---

## 51.9 RelevantEntities for Contextual Suggestions (iOS 27)

`RelevantEntities` lets an app proactively signal to the system which specific entities are contextually relevant right now (based on the user's current location, time of day, or recent app activity), improving the quality and timeliness of Siri/Spotlight suggestions without the user needing to explicitly search.

```swift
func updateRelevantRecipes() async {
    let dinnerRecipes = try? await recipeStore.recipesForMealType(.dinner)
    let relevantEntities = (dinnerRecipes ?? []).map {
        RelevantIntent(MarkRecipeCookedIntent(recipe: RecipeEntity(id: $0.id, title: $0.title)), context: .init())
    }
    await RelevantIntentManager.shared.updateRelevantIntents(relevantEntities)
}
```

Rather than the system needing to guess at relevance purely from general usage patterns, `RelevantEntities` lets the app itself supply specific, timely signals (e.g., "these are dinner recipes, and it's currently dinner time") — this is a proactive push mechanism complementing `EntityQuery`'s `suggestedEntities()` (51.4), which instead responds reactively when the user is actively browsing a parameter's options within Shortcuts.

---

## 51.10 EntityCollection for Lazy Resolution (iOS 27)

`EntityCollection` supports lazily-paginated resolution of large entity sets, avoiding the need to eagerly load and return an entire potentially-huge collection (like thousands of recipes) just to satisfy a search that might only need the first handful of matching results.

```swift
struct RecipeEntityQuery: EntityQuery {
    func entities(matching string: String) async throws -> EntityCollection<RecipeEntity> {
        EntityCollection { cursor in
            let page = try await recipeStore.searchRecipes(matching: string, cursor: cursor)
            return .init(items: page.items.map { RecipeEntity(id: $0.id, title: $0.title) }, nextCursor: page.nextCursor)
        }
    }
}
```

Without lazy pagination, an `EntityQuery` conformer would need to either load an entire large dataset into memory up front (wasteful for a dataset with thousands of entries when the user is only going to see the first handful matching what they've typed so far) or implement ad hoc, manual pagination logic itself — `EntityCollection`'s cursor-based design provides the same underlying pattern as many pagination APIs (including similar concepts from networking, Part 5) directly within the App Intents framework, letting entity search scale gracefully to large datasets.

---

## 51.11 SyncableEntity for Cross-Device IDs (iOS 27)

`SyncableEntity` addresses a subtle but real problem: if an app's data syncs across devices (via CloudKit, section 44, or SwiftData's CloudKit integration, section 41.18) but entity identifiers aren't consistently synced too, a Shortcut referencing a specific recipe built on one device might fail to resolve that same recipe correctly on another of the user's devices.

```swift
struct RecipeEntity: AppEntity, SyncableEntity {
    let id: UUID // must be the SAME identifier across all of the user's devices,
                 // consistent with how the underlying data itself syncs via CloudKit
    // ...
}
```

`SyncableEntity` formalizes the expectation that an entity's identifier must remain stable and consistent across the user's devices for a Shortcut to work reliably regardless of which specific device it's ultimately run on — this connects directly back to CloudKit's own record identity model (section 44.1), since an entity ID that's meant to be stable across devices needs to be backed by data that's *actually* synced with that same stable identity, not just locally-generated IDs that happen to coincidentally look similar.

---

## 51.12 LongRunningIntent Beyond the 30s Limit (iOS 27)

Ordinary `AppIntent`s are expected to complete within a short time budget (similar in spirit to `BGAppRefreshTask`'s strict budget, section 49.10) — `LongRunningIntent` explicitly opts an intent into a longer execution allowance, appropriate for genuinely lengthy operations (like a large data export or an extended timer) that can't reasonably complete within the standard short window.

```swift
struct ExportAllRecipesIntent: AppIntent, LongRunningIntent {
    static var title: LocalizedStringResource = "Export All Recipes"

    func perform() async throws -> some IntentResult {
        for await progress in exportAllRecipesWithProgress() {
            self.progress = progress // updates a live progress indicator in Shortcuts/Siri
        }
        return .result()
    }
}
```

This directly parallels `BGContinuedProcessingTask`'s role (section 49.12) for genuinely long user-initiated work — `LongRunningIntent` conformance signals to the system that this specific intent may need meaningfully more time than the default budget allows, and its progress can be surfaced live in the invoking surface (Shortcuts, Siri) rather than the user simply waiting with no feedback until the operation eventually completes or times out.

---

## 51.13 ExecutionTargets — Where an Intent Runs (iOS 27)

`ExecutionTargets` lets an intent declare which specific process/context it should actually run in — the main app process, a background extension process, or potentially a different device entirely in multi-device scenarios — giving more explicit control than earlier App Intents versions provided over where an intent's `perform()` actually executes.

```swift
struct MarkRecipeCookedIntent: AppIntent {
    static var supportedExecutionTargets: [ExecutionTarget] { [.foregroundApp, .background] }
    // ...
}
```

This matters because different intents have genuinely different execution needs — a simple, quick data mutation like marking a recipe cooked can reasonably run in the background without ever launching the app's UI, while an intent whose result depends on rendering a rich SwiftUI snippet (51.8), or that needs to interact with UI-specific state, may need to run with the app's UI process actually available — `ExecutionTargets` makes this requirement an explicit, declared part of the intent's definition rather than an implicit assumption the system has to guess at.

---

## 51.14 Testing with the AppIntentsTesting Framework (iOS 27)

`AppIntentsTesting` provides dedicated testing utilities for invoking an `AppIntent`'s `perform()` method directly in a test target, with helpers for constructing parameter values and asserting on the resulting `IntentResult` — extending the same dependency-injection-driven testability principles from section 47 to this specific framework.

```swift
import AppIntentsTesting

@Test
func markingRecipeCookedUpdatesStore() async throws {
    let intent = MarkRecipeCookedIntent()
    intent.recipe = RecipeEntity(id: testRecipeID, title: "Test Recipe")

    let result = try await intent.perform()

    #expect(await recipeStore.isCooked(testRecipeID))
}
```

Because a well-designed `AppIntent`'s `perform()` method is typically a thin wrapper delegating to the app's existing, already-injectable service layer (51.2), testing an intent largely reuses the same dependency substitution techniques from section 47 — the framework's specific contribution is making it straightforward to construct intent instances with test parameter values and invoke `perform()` directly, without needing to actually route a request through Siri or Shortcuts to exercise the intent's logic in a test.

---

## 51.15 Action Button and Control Center Entry Points

The iPhone's Action Button (and Control Center, more broadly) can be configured to directly trigger a specific `AppIntent`, giving users a genuinely fast, one-press path to a frequently-used app action without opening the app or invoking Siri at all.

```swift
// The same MarkRecipeCookedIntent (or any AppIntent) is automatically
// eligible for Action Button / Control Center assignment — no
// additional, separate declaration is needed beyond the intent itself
// being a well-formed AppIntent with a clear title.
```

This is a direct, practical payoff of App Intents' unified design (51.1) — because the framework was built from the start to power multiple system surfaces from one shared intent definition, an intent originally created for Siri/Shortcuts automatically becomes available for Action Button and Control Center assignment too, with no additional per-surface integration work required, in sharp contrast to the older SiriKit model where each new surface (had it existed) would likely have needed its own separate integration path.

---

## 51.16 Visual Intelligence Integration 🔴

Visual Intelligence lets the system (and, by extension, App Intents) reason about on-screen or camera-captured visual content and route relevant actions to apps that have registered intents capable of handling that specific kind of visual context — a genuinely advanced, still-maturing integration point at the intersection of App Intents and on-device visual understanding.

```swift
// Conceptual: an intent can declare eligibility to handle visual
// content matching certain criteria (e.g., "an image containing
// recognizable food/recipe content"), becoming a candidate action
// the system offers when relevant visual content is on screen or captured
```

This represents the newest, most exploratory edge of the App Intents surface area — rather than the user explicitly invoking an app action by name (via Siri phrase or manual Shortcuts configuration), Visual Intelligence integration lets the system proactively suggest a relevant app action based purely on *what's visually present* (a photographed dish, an on-screen product), extending App Intents' reach from "things the user explicitly asks for" toward "things the system proactively suggests based on visual context," representing where this framework's capabilities are actively still expanding.

---

## 51.17 Migrating from SiriKit INIntent 🟠

Apps with an existing SiriKit `INIntent`-based integration face a genuine migration decision — App Intents and `INIntent` are architecturally distinct systems (a separate extension process versus in-process Swift types), meaning migration is a deliberate rewrite of the integration layer rather than a simple find-and-replace, though the underlying app logic being exposed typically doesn't need to change at all.

```plaintext
Migration approach, roughly:
1. Identify each existing INIntent and the app logic it ultimately calls
2. Reimplement each as an AppIntent, typically as a thin wrapper around
   that SAME existing app logic (the actual business logic layer, section
   45.5, generally doesn't need to change)
3. Add AppShortcutsProvider declarations for proactive discoverability
   (51.6), which the older SiriKit model didn't offer in the same way
4. Remove the old Intents extension target once migration is verified
```

Because a well-architected app already separates business logic from its specific integration surface (echoing section 45's foundational separation principle), migrating from `INIntent` to `AppIntent` is primarily about rewriting the thin integration/wrapper layer, not the underlying logic itself — this is precisely the kind of architectural payoff that disciplined separation of concerns is meant to provide, letting a significant framework-level migration touch a comparatively small, well-isolated slice of the overall codebase.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Unified framework | `AppIntent` protocol | One definition powers Siri, Shortcuts, Spotlight, and more |
| Basic action | `AppIntent`, `perform()` | An app action exposed to the system |
| Input & natural language | `@Parameter`, `parameterSummary` | Typed inputs with a readable sentence template |
| Searchable entities | `AppEntity`, `EntityQuery` | Reference specific app data by search/identifier |
| Fixed choices | `AppEnum` | Bounded, enumerable picker-style parameters |
| Proactive discovery | `AppShortcutsProvider`, phrases | Pre-packaged, system-surfaced automations |
| Voice localization | `LocalizedStringResource` | Natural-sounding phrases across languages |
| Rich visual feedback | Snippets, `ShowsSnippetView` | SwiftUI-based results within Siri/Shortcuts |
| Proactive relevance | `RelevantEntities` (iOS 27) | Push contextually relevant entities to the system |
| Scalable search | `EntityCollection` (iOS 27) | Lazy, paginated entity resolution |
| Cross-device consistency | `SyncableEntity` (iOS 27) | Stable identifiers across a user's synced devices |
| Extended time budget | `LongRunningIntent` (iOS 27) | Genuinely lengthy operations with live progress |
| Execution location | `ExecutionTargets` (iOS 27) | Explicit control over where `perform()` runs |
| Testability | `AppIntentsTesting` (iOS 27) | Direct, injectable testing of intent logic |
| Fast system access | Action Button, Control Center | One-press access with no additional integration work |
| Emerging surface | Visual Intelligence | Proactive suggestions from visual context |
| Legacy migration | SiriKit `INIntent` → `AppIntent` | Rewrite the thin integration layer, not the business logic |
