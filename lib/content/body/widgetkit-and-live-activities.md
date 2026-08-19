## 52.1 Widget Anatomy and the Widget Extension Target

A widget lives in its own dedicated extension target (a separate, sandboxed process from the main app, echoing the extension model previewed in section 53), built from three core pieces: a `TimelineProvider` supplying data over time, a SwiftUI view rendering each timeline entry, and a `Widget` conformer tying them together.

```swift
struct RecipeWidget: Widget {
    let kind: String = "RecipeWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: RecipeTimelineProvider()) { entry in
            RecipeWidgetView(entry: entry)
        }
        .configurationDisplayName("Recipe of the Day")
        .description("Shows a featured recipe suggestion.")
    }
}
```

Because a widget extension runs as its own separate process, it cannot directly access the main app's in-memory state — it can only work with data the main app has explicitly persisted somewhere the extension can also read, which is exactly why shared storage mechanisms (App Groups, section 43.2; shared SwiftData containers, section 41.20) are a prerequisite for any widget showing genuinely live, app-generated data rather than static placeholder content.

---

## 52.2 TimelineProvider and Entries

A `TimelineProvider` supplies the actual data a widget displays, structured as a `Timeline` of dated `TimelineEntry` values — WidgetKit renders whichever entry's date has most recently passed, automatically advancing to the next entry as its own scheduled date arrives, without the widget process needing to be actively running at that moment.

```swift
struct RecipeEntry: TimelineEntry {
    let date: Date
    let recipe: Recipe
}

struct RecipeTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> RecipeEntry {
        RecipeEntry(date: Date(), recipe: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (RecipeEntry) -> Void) {
        completion(RecipeEntry(date: Date(), recipe: currentFeaturedRecipe()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<RecipeEntry>) -> Void) {
        let entries = (0..<3).map { offset in
            RecipeEntry(date: Calendar.current.date(byAdding: .hour, value: offset * 8, to: Date())!, recipe: featuredRecipe(for: offset))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}
```

This design is a direct consequence of the strict reload budget covered next (52.3): rather than the widget process needing to wake up and recompute its content at every single display refresh, `getTimeline()` front-loads several future entries at once (here, three entries spaced 8 hours apart), and the system handles advancing through them on schedule entirely on its own, without needing to re-invoke the extension's code for each individual transition — `placeholder()` provides generic, non-personalized content shown briefly while a widget's real data is still loading (e.g., right after being added to the Home Screen), and `getSnapshot()` provides a quick, representative preview used in contexts like the widget gallery.

---

## 52.3 Reload Policies and the Budget System

A `Timeline`'s reload `policy` determines when WidgetKit should next call back into the provider to fetch a fresh timeline, and the system imposes a strict overall daily budget on how many times a given widget can actually be reloaded — making the choice of policy a genuine trade-off between freshness and staying within budget.

```swift
// .atEnd: request a new timeline once the last provided entry's date has passed
Timeline(entries: entries, policy: .atEnd)

// .after(date): request a new timeline at a specific future point, even if
// entries remain — useful when you know content becomes stale at a known time
Timeline(entries: entries, policy: .after(refreshDate))

// .never: this timeline's entries are the final ones; no further reload requested
Timeline(entries: entries, policy: .never)
```

Because the system's daily reload budget is limited and shared across however many widgets a user has of a given kind, front-loading multiple entries into one timeline (as shown in 52.2) is a meaningfully more budget-efficient strategy than requesting frequent reloads for single-entry timelines — a widget that requests a fresh reload every 15 minutes will exhaust its daily budget far faster than one that computes a handful of entries covering the next several hours in a single reload, directly connecting to the general resource-discipline theme from background execution budgets (section 49.13).

---

## 52.4 Widget Families and Sizes

A widget can support multiple sizes — `.systemSmall`, `.systemMedium`, `.systemLarge`, `.systemExtraLarge` (iPad only), plus Lock Screen-specific families (52.7) — with `WidgetFamily` read via `@Environment(\.widgetFamily)` inside the widget's view to render appropriately different layouts for each.

```swift
struct RecipeWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: RecipeEntry

    var body: some View {
        switch family {
        case .systemSmall:
            Text(entry.recipe.title).font(.caption)
        case .systemMedium:
            HStack { RecipeImage(entry.recipe); Text(entry.recipe.title) }
        default:
            RecipeDetailWidgetLayout(recipe: entry.recipe)
        }
    }
}
```

Declaring `.supportedFamilies([.systemSmall, .systemMedium])` on the `Widget` conformer opts into specific sizes, and the view itself is responsible for adapting its actual layout per family — much like SwiftUI's general size-class-driven adaptive layout (section 33.1), a single widget view definition handles multiple presentation contexts, just driven by `widgetFamily` specifically rather than the more general `horizontalSizeClass`/`verticalSizeClass`.

---

## 52.5 Configurable Widgets with AppIntentConfiguration

`AppIntentConfiguration` (replacing the older `IntentConfiguration`/`INIntent`-based system, consistent with section 51's broader App Intents transition) lets a user customize a widget's behavior — like choosing which specific recipe collection to feature — directly from the widget's edit UI, backed by an `AppIntent` and `AppEntity` (sections 51.2, 51.4).

```swift
struct SelectCollectionIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Select Collection"

    @Parameter(title: "Collection")
    var collection: CollectionEntity?
}

struct RecipeWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "RecipeWidget", intent: SelectCollectionIntent.self, provider: RecipeTimelineProvider()) { entry in
            RecipeWidgetView(entry: entry)
        }
    }
}
```

`WidgetConfigurationIntent` is a specialized `AppIntent` variant specifically for widget configuration — the same `@Parameter`/`AppEntity` infrastructure from section 51 powers the widget's "Edit Widget" long-press UI, meaning the searchable entity-picking experience users see when configuring a widget is built from exactly the same underlying mechanism that powers Siri/Shortcuts parameter resolution, rather than a separate, widget-specific configuration system.

---

## 52.6 Interactive Widgets with Buttons and Toggles

Modern widgets support limited interactivity directly within the widget itself — `Button` and `Toggle` can trigger an `AppIntent`'s `perform()` method without launching the containing app at all, appropriate for quick, self-contained actions like marking something complete.

```swift
struct RecipeWidgetView: View {
    let entry: RecipeEntry

    var body: some View {
        HStack {
            Text(entry.recipe.title)
            Button(intent: MarkRecipeCookedIntent(recipe: entry.recipe.asEntity)) {
                Image(systemName: "checkmark.circle")
            }
        }
    }
}
```

`Button(intent:)` directly invokes the specified `AppIntent`'s `perform()` in the background, without requiring the widget to open the containing app or present any UI — this reuses the exact same `AppIntent` infrastructure from section 51 (the very same `MarkRecipeCookedIntent` originally built for Siri/Shortcuts could be the identical intent triggered here from a widget button), reflecting App Intents' unified, multi-surface design once again.

---

## 52.7 Lock Screen and StandBy Widgets

Beyond the Home Screen, widgets can also target the Lock Screen (circular, rectangular, and inline families) and StandBy mode (a dedicated always-on-style presentation when an iPhone is charging horizontally) — each with tighter rendering constraints (52.10) than Home Screen widgets, typically rendering in a monochrome, high-contrast style rather than full color.

```swift
.supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
```

These accessory families (the same families referenced for watchOS complications in section 33.8, since Lock Screen widgets and watch complications share underlying WidgetKit infrastructure) impose meaningfully tighter space and rendering constraints than Home Screen widgets — a Lock Screen widget's content is typically rendered using the system's tint color rather than arbitrary custom colors, and StandBy widgets need to remain legible and glanceable from across a room in a dimly-lit environment, both pushing widget content design toward simplicity and high information density over rich visual styling.

---

## 52.8 ControlWidget for Control Center

`ControlWidget` (distinct from a standard `Widget`) powers Control Center controls and the Lock Screen's control area — compact, typically single-action controls (a toggle, a button) rather than the richer, multi-element layouts a standard widget can present.

```swift
struct RecipeTimerControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "RecipeTimerControl") {
            ControlWidgetButton(action: StartCookingTimerIntent()) {
                Label("Start Timer", systemImage: "timer")
            }
        }
    }
}
```

Like interactive Home Screen widgets (52.6), `ControlWidget` actions are backed by `AppIntent`s — but `ControlWidget` is architecturally its own distinct WidgetKit surface, intentionally simpler and more compact than a full `Widget`, since Control Center controls are meant to be instantly-recognizable, single-purpose actions (much like a Camera or Flashlight toggle) rather than glanceable information displays, the role standard widgets are better suited for.

---

## 52.9 Sharing Data with the Host App

Because a widget extension runs as a separate process from the main app (52.1), any data the widget displays must be written somewhere both processes can read — the same App Group-based shared storage mechanisms covered in sections 41.20 (shared SwiftData) and 43.2 (shared UserDefaults) are the standard tools, alongside explicitly requesting a timeline reload when the main app changes underlying data.

```swift
// From the main app, after saving new data the widget should reflect:
WidgetCenter.shared.reloadTimelines(ofKind: "RecipeWidget")
```

`WidgetCenter.shared.reloadTimelines(ofKind:)` is the explicit signal the main app sends to prompt WidgetKit to re-invoke the widget's `TimelineProvider` sooner than its next scheduled reload would naturally occur — essential for keeping a widget reasonably current after a meaningful data change (like the user marking a recipe as their new favorite), since otherwise the widget would only reflect that change once its existing timeline's reload policy (52.3) eventually triggers on its own.

---

## 52.10 Widget Rendering Constraints and Limits

Widgets operate under meaningfully stricter rendering constraints than a full app screen — no scrolling content, no arbitrary gestures beyond tapping/Button-triggered intents, restricted view modifier support (some SwiftUI modifiers simply have no effect or aren't available within a widget's rendering context), and a limited memory budget for the extension process itself.

```plaintext
Widgets CANNOT: scroll, support drag gestures, use most animation
timing curves freely, or arbitrarily nest deep view hierarchies —
design for a static, glanceable snapshot, not an interactive mini-app
```

These constraints exist because a widget is fundamentally meant to be a glanceable, quickly-rendered snapshot rather than a miniature interactive app — the rendering environment is deliberately more restrictive to keep widgets lightweight and fast to render across potentially many simultaneous widgets on a Home Screen, and designing within these constraints (rather than attempting to force full-app interactivity into a widget) is essential to building a widget that actually works reliably rather than silently failing to render certain unsupported constructs.

---

## 52.11 Live Activities: ActivityAttributes

A Live Activity is a persistent, updatable, glanceable UI shown on the Lock Screen and in the Dynamic Island for an ongoing, real-time event (a food delivery tracker, a live sports score, a cooking timer) — defined via `ActivityAttributes`, which splits an activity's data into fixed attributes (set once, at creation) and dynamic `ContentState` (updated repeatedly over the activity's lifetime).

```swift
struct CookingTimerAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var remainingSeconds: Int
        var isPaused: Bool
    }

    let recipeTitle: String // fixed for the activity's entire lifetime
}
```

This fixed/dynamic split directly mirrors the two most common categories of data a real-time tracked event has: some information genuinely doesn't change once the activity starts (which recipe is being cooked), while other information updates frequently throughout the activity's life (remaining time) — structuring `ActivityAttributes` this way lets the system optimize update delivery, since only the smaller, frequently-changing `ContentState` needs to be transmitted on each update, not the entire activity's data.

---

## 52.12 Live Activities: Starting, Updating, Ending

An app starts, updates, and ends a Live Activity via `Activity<Attributes>`'s static/instance methods, directly from the main app's own process (unlike widgets, a Live Activity is initiated by the app itself, typically in direct response to a user action like starting a cooking timer).

```swift
func startCookingTimer(for recipe: Recipe, seconds: Int) throws {
    let attributes = CookingTimerAttributes(recipeTitle: recipe.title)
    let initialState = CookingTimerAttributes.ContentState(remainingSeconds: seconds, isPaused: false)
    let activity = try Activity.request(attributes: attributes, content: .init(state: initialState, staleDate: nil))
}

func updateTimer(_ activity: Activity<CookingTimerAttributes>, remainingSeconds: Int) async {
    await activity.update(.init(state: .init(remainingSeconds: remainingSeconds, isPaused: false), staleDate: nil))
}

func endTimer(_ activity: Activity<CookingTimerAttributes>) async {
    await activity.end(.init(state: .init(remainingSeconds: 0, isPaused: false), staleDate: nil), dismissalPolicy: .immediate)
}
```

`Activity.request()` starts the Live Activity and immediately shows it on the Lock Screen/Dynamic Island, `.update()` pushes a new `ContentState` reflecting the activity's current progress (called repeatedly as the underlying real-time event actually progresses — e.g., once per second for a live timer), and `.end()` terminates the activity with a final state and a `dismissalPolicy` controlling exactly when it disappears from the Lock Screen after ending (`.immediate` versus giving the user a brief window to see the final state before automatic dismissal).

---

## 52.13 Dynamic Island Regions and Layout

The Dynamic Island presents a Live Activity across several distinct, purpose-specific regions — a compact leading/trailing pair (shown alongside other system UI when multiple things compete for the Island's space), a minimal single-glyph presentation (when even more space is constrained), and an expanded view (shown on long-press) with leading, trailing, center, and bottom regions.

```swift
DynamicIsland {
    DynamicIslandExpandedRegion(.leading) { Text("🍝") }
    DynamicIslandExpandedRegion(.trailing) { Text("\(entry.remainingSeconds)s") }
    DynamicIslandExpandedRegion(.bottom) { ProgressView(value: progress) }
} compactLeading: {
    Text("🍝")
} compactTrailing: {
    Text("\(entry.remainingSeconds)s")
} minimal: {
    Text("🍝")
}
```

Designing for all of these regions is a genuine, deliberate layout exercise, not an afterthought — the compact and minimal presentations must communicate the activity's most essential information in an extremely constrained space (potentially just one or two characters), while the expanded presentation has more room but still needs to remain glanceable rather than replicating a full app screen's information density, echoing the same "design for glanceability, not full interactivity" principle from widget constraints (52.10) but applied to the Dynamic Island's specific, further-constrained regions.

---

## 52.14 Push-Updated Live Activities 🔴

Beyond updating a Live Activity directly from the initiating app's own process (52.12), a Live Activity can also be updated via a specialized remote push notification — essential for activities whose progress is driven by a server (like a food delivery's actual location) rather than something the local device can compute or observe on its own.

```json
{
    "aps": {
        "timestamp": 1234567890,
        "event": "update",
        "content-state": {
            "remainingSeconds": 120,
            "isPaused": false
        }
    }
}
```

This connects directly back to push notification infrastructure (section 50.4–50.5) — a server holding the actual authoritative state of a real-world event (a delivery driver's live location, sent from the delivery company's own backend) pushes updates directly to the Live Activity via a specialized APNs payload shape, without the user's device needing to poll or otherwise determine that state locally, extending the same push infrastructure covered for ordinary notifications to this specific, richer, continuously-updating UI surface.

---

## 52.15 Debugging Widgets and Extensions 🟠

Widget debugging has genuine practical friction beyond ordinary app debugging — Xcode's scheme editor lets you select "Widget Extension" as the target to run/debug directly (attaching a debugger to the extension process specifically), and WidgetKit-specific console logging, combined with careful attention to the reload budget (52.3), are essential for diagnosing why a widget isn't updating as expected.

```plaintext
Common widget debugging steps:
1. In Xcode's scheme, choose the widget extension target directly to
   attach a debugger to IT specifically, not just the main app
2. Check for reload budget exhaustion — a widget that's requested too
   many reloads recently may simply be throttled, not broken
3. Verify shared App Group storage is actually configured correctly
   on BOTH the main app and widget extension targets (52.9) —
   a common, easy-to-miss source of "widget shows stale/empty data"
```

Because the widget extension is a genuinely separate process with its own lifecycle, breakpoints set only in the main app's scheme won't ever trigger for code running inside the widget extension — explicitly selecting the widget extension as the active scheme target is required to debug its `TimelineProvider` or view code directly, and a very common category of "my widget isn't updating" bug turns out to be a reload-budget exhaustion issue (52.3) rather than a genuine code defect, making budget awareness one of the first things worth checking before assuming the provider logic itself is broken.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Widget structure | `Widget`, `TimelineProvider`, SwiftUI view | The three core pieces of any widget |
| Data over time | `TimelineEntry`, `Timeline` | Front-loaded entries advanced automatically |
| Reload economy | `TimelineReloadPolicy`, daily budget | Balance freshness against a limited reload allowance |
| Multiple sizes | `WidgetFamily`, `@Environment(\.widgetFamily)` | Adaptive layout per widget size |
| User configuration | `AppIntentConfiguration`, `WidgetConfigurationIntent` | App-Intents-powered widget customization |
| In-widget actions | `Button(intent:)` | Trigger an `AppIntent` without opening the app |
| Lock Screen/StandBy | Accessory widget families | Tighter, monochrome, high-contrast presentation |
| Control Center | `ControlWidget` | Compact, single-action controls |
| Cross-process data | App Groups, `WidgetCenter.reloadTimelines()` | Shared storage plus explicit refresh signaling |
| Rendering limits | No scrolling, restricted modifiers | Design for a static snapshot, not a mini-app |
| Live event UI | `ActivityAttributes`, fixed vs. `ContentState` | Persistent, updatable Lock Screen/Island presence |
| Activity lifecycle | `Activity.request()`/`.update()`/`.end()` | Start, refresh, and conclude a Live Activity |
| Dynamic Island | Compact/minimal/expanded regions | Purpose-specific layout at each Island presentation |
| Server-driven updates | Push-updated Live Activities | APNs-delivered state for server-authoritative events |
| Debugging | Widget extension scheme, budget awareness | Attach to the right process; check for throttling first |
