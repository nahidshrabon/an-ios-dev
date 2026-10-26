**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**Widgets** show a small, glanceable piece of your app on the Home Screen, Lock Screen, StandBy, and more. **Live Activities** show a **live event** (a timer, a delivery) on the Lock Screen and in the **Dynamic Island**. Both are built with **WidgetKit** and **SwiftUI**. This section covers how widgets get data, sizes, configuration, buttons, controls, sharing data with the app, and the full Live Activity lifecycle.

---

## 52.1 Widget Anatomy and the Widget Extension Target 🟢

A widget lives in a **widget extension**: a separate **target** that runs in its **own process**, not inside your app (File ▸ New ▸ Target ▸ Widget Extension). Every widget has **three pieces**:

| Piece | Job |
|---|---|
| **`TimelineProvider`** | Supplies the **data**, as entries over time (52.2) |
| A SwiftUI **view** | Draws **one entry** |
| A **`Widget`** type | Ties them together and names the widget |

```swift
import WidgetKit
import SwiftUI

struct RecipeWidget: Widget {
    let kind = "RecipeWidget"                       // a stable ID for this widget type

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: RecipeTimelineProvider()) { entry in
            RecipeWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)   // required since iOS 17
        }
        .configurationDisplayName("Recipe of the Day")              // shown in the widget gallery
        .description("Shows a featured recipe.")
    }
}

@main
struct RecipeWidgetBundle: WidgetBundle {           // one extension can hold several widgets
    var body: some Widget {
        RecipeWidget()
    }
}
```

Because the widget runs in a **different process**, it **can't** see your app's **memory**: no shared singletons, no view models. It can only read data the app has **saved** somewhere **both** can reach, like an **App Group** (43.2, 41.20; see 52.9). This is the first thing to plan for any widget that shows real app data.

---

## 52.2 TimelineProvider and Entries 🟢

A widget doesn't run all the time. Instead, its provider hands WidgetKit a **timeline**: a list of **entries**, each with a **date**. WidgetKit shows each entry when its date arrives, **without** running your code again:

```
getTimeline() returns:
  09:00 → Carbonara      ← shown now
  17:00 → Risotto        ← system switches at 17:00 by itself
  01:00 → Pancakes       ← and again at 01:00
```

```swift
struct RecipeEntry: TimelineEntry {
    let date: Date          // required: when to show this entry
    let recipe: Recipe
}

struct RecipeTimelineProvider: TimelineProvider {
    // Generic content while the real data loads (shown redacted)
    func placeholder(in context: Context) -> RecipeEntry {
        RecipeEntry(date: .now, recipe: .placeholder)
    }

    // A quick sample, e.g. for the widget gallery
    func getSnapshot(in context: Context, completion: @escaping (RecipeEntry) -> Void) {
        let recipe = context.isPreview ? .sample : SharedStore.featuredRecipe()
        completion(RecipeEntry(date: .now, recipe: recipe))
    }

    // The real data: several future entries at once
    func getTimeline(in context: Context, completion: @escaping (Timeline<RecipeEntry>) -> Void) {
        let now = Date.now
        let entries = (0..<3).map { offset in
            RecipeEntry(date: now.addingTimeInterval(Double(offset) * 8 * 3600),
                        recipe: SharedStore.featuredRecipe(slot: offset))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}
```

| Method | Used for |
|---|---|
| `placeholder(in:)` | **Generic** content shown **briefly** while loading. Must be **fast**, no real data needed |
| `getSnapshot(in:completion:)` | **One** entry for **previews** (the gallery). Use sample data when `context.isPreview` |
| `getTimeline(in:completion:)` | The **real** entries, plus a **reload policy** (52.3) |

Why **several** entries at once? Because reloads are **limited** (52.3). One reload that covers the next day is much cheaper than waking the widget every hour.

---

## 52.3 Reload Policies and the Budget System 🟡

The timeline's **policy** says when WidgetKit should ask for a **new** timeline:

```swift
Timeline(entries: entries, policy: .atEnd)               // after the last entry's date
Timeline(entries: entries, policy: .after(refreshDate))  // at (or after) this date
Timeline(entries: entries, policy: .never)               // only when the app asks (52.9)
```

The policy is a **request**, not a promise. The system gives each widget a daily **budget** of reloads. Apple says a widget the user **looks at often** typically gets around **40–70** reloads a day (roughly every 15–60 minutes). The budget depends on how often the widget is **seen**, and other factors.

Reloads **don't** use the budget when:

- the **app is in the foreground** and asks for a reload,
- the app has an active **audio** or **navigation** session,
- the system **locale** or Dynamic Type / accessibility settings change.

So:

| Do | Don't |
|---|---|
| Put **many entries** in one timeline | Return **one** entry and ask to reload every 5 minutes |
| Reload from the **app** when data really changes (52.9) | Use reloads to fake a **clock** |
| Use **self-updating text** for times | Reload every second for a countdown |

**Self-updating text** is a big one. These views update **on their own**, with **no** reloads:

```swift
Text(entry.timerEnd, style: .timer)                 // "12:34" counting
Text(entry.date, style: .relative)                  // "5 min ago"
Text(timerInterval: entry.start...entry.timerEnd, countsDown: true)
ProgressView(timerInterval: entry.start...entry.timerEnd) // a bar that fills over time
```

This is the same idea as background budgets (49.13): the system shares **limited** resources, so design for **few**, smart updates.

---

## 52.4 Widget Families and Sizes 🟢

A widget can support several **sizes**, called **families**:

| Family | Where |
|---|---|
| `.systemSmall`, `.systemMedium`, `.systemLarge` | Home Screen, Today view (and Mac desktop) |
| `.systemExtraLarge` | iPad |
| `.accessoryCircular`, `.accessoryRectangular`, `.accessoryInline` | Lock Screen, watchOS (52.7) |

Choose the sizes on the widget, and read the **current** one in the view:

```swift
struct RecipeWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "RecipeWidget", provider: RecipeTimelineProvider()) { entry in
            RecipeWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .supportedFamilies([.systemSmall, .systemMedium])     // only these sizes
    }
}

struct RecipeWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: RecipeEntry

    var body: some View {
        switch family {
        case .systemSmall:
            VStack(alignment: .leading) {
                Text(entry.recipe.title).font(.headline)
                Text("\(entry.recipe.minutes) min").font(.caption).foregroundStyle(.secondary)
            }
        case .systemMedium:
            HStack {
                RecipeThumbnail(recipe: entry.recipe)
                Text(entry.recipe.title).font(.headline)
            }
        default:
            RecipeDetailLayout(recipe: entry.recipe)
        }
    }
}
```

It's like **size classes** (33.1): one view, several layouts. But a widget family is a **fixed** size, so you design each one **on purpose**. Don't just shrink the large layout into the small one.

Preview each family with the **`#Preview`** macro (iOS 17):

```swift
#Preview(as: .systemSmall) {
    RecipeWidget()
} timeline: {
    RecipeEntry(date: .now, recipe: .sample)
    RecipeEntry(date: .now, recipe: .sample2)       // see the switch between entries
}
```

---

## 52.5 Configurable Widgets with AppIntentConfiguration 🟡

Users can **edit** some widgets (long-press ▸ **Edit Widget**), for example to pick **which** recipe collection to show. This uses **App Intents** (51): the options are just **`@Parameter`s**.

**1. The configuration intent:**

```swift
import AppIntents

struct SelectCollectionIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Select Collection"

    @Parameter(title: "Collection")
    var collection: CollectionEntity?               // an AppEntity (51.4), with its query
}
```

**2. A provider that receives the configuration.** It's an **`AppIntentTimelineProvider`**, with **async** methods:

```swift
struct CollectionTimelineProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> RecipeEntry {
        RecipeEntry(date: .now, recipe: .placeholder)
    }

    func snapshot(for configuration: SelectCollectionIntent, in context: Context) async -> RecipeEntry {
        RecipeEntry(date: .now, recipe: .sample)
    }

    func timeline(for configuration: SelectCollectionIntent, in context: Context) async -> Timeline<RecipeEntry> {
        let recipes = await SharedStore.recipes(in: configuration.collection?.id)   // use the user's choice
        let entries = recipes.prefix(3).enumerated().map { index, recipe in
            RecipeEntry(date: .now.addingTimeInterval(Double(index) * 3600), recipe: recipe)
        }
        return Timeline(entries: entries, policy: .atEnd)
    }
}
```

**3. The widget, using `AppIntentConfiguration`:**

```swift
struct CollectionWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "CollectionWidget",
                               intent: SelectCollectionIntent.self,
                               provider: CollectionTimelineProvider()) { entry in
            RecipeWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
    }
}
```

This replaces the old **`IntentConfiguration`**, which used SiriKit intent files. The **entity picker** the user sees in "Edit Widget" is the **same** one Siri and Shortcuts use (51.4). One system, many surfaces.

---

## 52.6 Interactive Widgets with Buttons and Toggles 🟡

Since iOS 17, widgets can contain **`Button`** and **`Toggle`**. They run an **App Intent** (51.2) **without opening the app**:

```swift
struct MarkRecipeCookedIntent: AppIntent {
    static let title: LocalizedStringResource = "Mark Recipe as Cooked"

    @Parameter(title: "Recipe ID")
    var recipeID: String

    init() {}                                        // App Intents need an empty init
    init(recipeID: String) { self.recipeID = recipeID }

    func perform() async throws -> some IntentResult {
        try await SharedStore.markCooked(recipeID)  // write to the shared App Group store
        return .result()
    }
}

struct RecipeWidgetView: View {
    let entry: RecipeEntry

    var body: some View {
        HStack {
            Text(entry.recipe.title)
            Spacer()
            Button(intent: MarkRecipeCookedIntent(recipeID: entry.recipe.id.uuidString)) {
                Image(systemName: entry.recipe.isCooked ? "checkmark.circle.fill" : "circle")
            }
            .buttonStyle(.plain)
        }
    }
}
```

What happens on a tap:

```
tap → system runs perform() (app stays closed)
    → WidgetKit reloads the timeline
    → the widget shows the new entry
```

Use **`Toggle(isOn:intent:)`** for on/off state. Keep actions **small and quick**: "mark cooked", "start timer", "check off item". Anything that needs a **screen** should open the app instead (52.10).

The intent can be the **same** one you offer to Siri and Shortcuts (51). That's App Intents' "**write once, use everywhere**" design again.

---

## 52.7 Lock Screen and StandBy Widgets 🟡

**Lock Screen** widgets (iOS 16) use the three **accessory** families:

```swift
.supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
```

| Family | Looks like |
|---|---|
| `.accessoryCircular` | A small circle: a gauge, an icon, a number |
| `.accessoryRectangular` | A few lines of text |
| `.accessoryInline` | One line of text above the clock |

On the Lock Screen, widgets are drawn in a **vibrant**, **monochrome** style: the system **ignores** your colors and tints the content to match the wallpaper. Design with **shapes and contrast**, not color. You can check the mode:

```swift
struct LockScreenRecipeView: View {
    @Environment(\.widgetRenderingMode) private var renderingMode
    let entry: RecipeEntry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()                      // the standard soft background
            VStack {
                Image(systemName: "fork.knife")
                    .widgetAccentable()                      // tinted with the accent in .accented mode
                Text("\(entry.recipe.minutes)m").font(.caption)
            }
        }
    }
}
```

| `widgetRenderingMode` | When |
|---|---|
| `.fullColor` | Normal Home Screen |
| `.vibrant` | Lock Screen, StandBy at night (shown in red) |
| `.accented` | Tinted Home Screen styles, watchOS: content split into accent and default groups |

The **same** accessory families power **watchOS complications** (33.8). One widget can serve both.

**StandBy** (iOS 17) is the full-screen mode when an iPhone is **charging on its side**. It shows your **`.systemSmall`** widget, **scaled up**, and **without** its background. It's seen from **across the room**, often in the **dark**, so use **big, bold** content. Check the background with:

```swift
@Environment(\.showsWidgetContainerBackground) private var showsBackground
```

---

## 52.8 ControlWidget for Control Center 🟡

**Controls** (iOS 18) are small **buttons** and **toggles** that live in **Control Center**, on the **Lock Screen**, and on the **Action Button**. They're built in the widget extension with **`ControlWidget`**, not `Widget`.

A **button** control runs an intent (as in 51.15):

```swift
struct StartTimerControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.example.recipes.start-timer") {
            ControlWidgetButton(action: StartCookingTimerIntent()) {
                Label("Cook Timer", systemImage: "timer")
            }
        }
        .displayName("Start Cook Timer")
    }
}
```

A **toggle** control also needs its **current value**, from a **value provider**, and a **`SetValueIntent`** to change it:

```swift
struct TimerToggleControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.example.recipes.timer-toggle",
                                   provider: TimerStateProvider()) { isRunning in
            ControlWidgetToggle("Cook Timer", isOn: isRunning, action: SetTimerRunningIntent()) { isOn in
                Label(isOn ? "Running" : "Stopped", systemImage: "timer")
            }
        }
        .displayName("Cook Timer")
    }
}

struct TimerStateProvider: ControlValueProvider {
    var previewValue: Bool { false }                           // shown in the controls gallery
    func currentValue() async throws -> Bool {
        SharedStore.isTimerRunning()
    }
}

struct SetTimerRunningIntent: SetValueIntent {
    static let title: LocalizedStringResource = "Set Cook Timer"

    @Parameter(title: "Running")
    var value: Bool                                            // the new value from the toggle

    func perform() async throws -> some IntentResult {
        if value {
            try await CookTimer.start()
        } else {
            await CookTimer.stop()
        }
        return .result()
    }
}
```

| | `Widget` | `ControlWidget` |
|---|---|---|
| Shows | **Information** (glanceable content) | **One action** or **one on/off state** |
| Layout | Your own SwiftUI layout | A **system-styled** symbol and label |
| Updates | Timeline (52.2) | Value provider; reload with `ControlCenter.shared.reloadControls(ofKind:)` |

Think of the **flashlight** or **camera** button: instantly clear, one purpose.

---

## 52.9 Sharing Data with the Host App 🟢

The app and the widget are **separate processes** (52.1), so they share data through an **App Group** container. Turn on the **same** App Group on **both** targets, then:

```swift
enum SharedStore {
    static let defaults = UserDefaults(suiteName: "group.com.example.recipes")!   // 43.2

    static func saveFeatured(_ recipe: Recipe) throws {
        defaults.set(try JSONEncoder().encode(recipe), forKey: "featuredRecipe")
    }

    static func featuredRecipe() -> Recipe {
        guard let data = defaults.data(forKey: "featuredRecipe"),
              let recipe = try? JSONDecoder().decode(Recipe.self, from: data) else {
            return .placeholder
        }
        return recipe
    }
}
```

For bigger data, use a **shared SwiftData** container in the group folder (41.20).

When the **app** changes something the widget shows, **tell** WidgetKit:

```swift
// In the app, after saving:
try SharedStore.saveFeatured(recipe)
WidgetCenter.shared.reloadTimelines(ofKind: "RecipeWidget")   // just this widget kind
// or: WidgetCenter.shared.reloadAllTimelines()
```

Without this call, the widget only updates at its **next scheduled** reload (52.3), which could be **hours** away. And when the app is in the **foreground**, this reload **doesn't** use the widget's budget.

| Data flow | How |
|---|---|
| App → widget | Save to the App Group, then `reloadTimelines(ofKind:)` |
| Widget → app | An interactive widget's intent (52.6) writes to the App Group; the app reads it on next launch or `scenePhase` change |
| Tap → app screen | `.widgetURL(_:)` or `Link` opens a deep link (49.7) |

---

## 52.10 Widget Rendering Constraints and Limits 🟢

A widget is **not** a mini app. WidgetKit **renders your view ahead of time** and shows that result. So many normal SwiftUI features **don't work**:

| Not supported | Do this instead |
|---|---|
| **Scrolling** (`ScrollView`, `List` scrolling) | Show the top few items |
| **Gestures** (`onTapGesture`, drags) | `Button(intent:)` (52.6), or a deep link |
| **Continuous animations** | Animated **transitions between entries** only (`.contentTransition(.numericText())`) |
| **UIKit views** (`UIViewRepresentable`), video, live maps | Images; `MKMapSnapshotter` for a map image |
| **Network calls in the view** | Fetch in the **provider**, before building the entry |

Taps that **open the app**:

```swift
// Whole widget: one URL (the only option for a small widget without buttons)
RecipeWidgetView(entry: entry)
    .widgetURL(URL(string: "recipes://recipe/\(entry.recipe.id)"))

// Medium and large: several tap targets
Link(destination: URL(string: "recipes://recipe/\(recipe.id)")!) {
    Text(recipe.title)
}
```

The extension also has a **small memory limit**. Large images are a common cause of crashes: **resize** them to the widget's size before saving them to the App Group (53.11).

Design for a **glanceable snapshot**: the user should understand it in **one second**.

---

## 52.11 Live Activities: ActivityAttributes 🟡

A **Live Activity** shows a **live event** on the **Lock Screen** and in the **Dynamic Island**: a cooking timer, a food delivery, a sports score. It lasts for the **event**, then goes away.

Its data is split into **two parts**:

```swift
import ActivityKit

struct CookingTimerAttributes: ActivityAttributes {
    // Changes during the activity
    struct ContentState: Codable, Hashable {
        var endDate: Date            // when the timer finishes
        var isPaused: Bool
    }

    // Set once at the start, never changes
    let recipeTitle: String
}
```

| Part | Example | Changes? |
|---|---|---|
| Attributes (the struct's own properties) | Recipe name, order number | **No**, fixed at start |
| **`ContentState`** | Time left, driver's location, score | **Yes**, on every update |

Updates only send the small **`ContentState`**. The total data must stay **under 4 KB**, so send **values**, not images.

Note the timer stores an **end date**, not "seconds left". The view counts down **by itself** (52.3), so you don't need an update every second.

The UI is defined in the **widget extension**, with **`ActivityConfiguration`**:

```swift
struct CookingTimerLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CookingTimerAttributes.self) { context in
            // Lock Screen (and banner on devices without a Dynamic Island)
            HStack {
                Text(context.attributes.recipeTitle).font(.headline)
                Spacer()
                Text(timerInterval: Date.now...context.state.endDate, countsDown: true)
                    .monospacedDigit()
            }
            .padding()
        } dynamicIsland: { context in
            CookingTimerIsland.make(context: context)            // 52.13
        }
    }
}
```

Add **`NSSupportsLiveActivities = YES`** to the **app's** Info.plist, and add the activity to your `WidgetBundle`.

---

## 52.12 Live Activities: Starting, Updating, Ending 🟡

The **app** starts a Live Activity, usually right after a **user action** ("Start timer"). Unlike a widget, the user doesn't add it: the app **requests** it.

```swift
import ActivityKit

func startCookingTimer(for recipe: Recipe, minutes: Int) throws -> Activity<CookingTimerAttributes>? {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }   // the user can turn them off

    let attributes = CookingTimerAttributes(recipeTitle: recipe.title)
    let state = CookingTimerAttributes.ContentState(
        endDate: .now.addingTimeInterval(Double(minutes) * 60),
        isPaused: false
    )
    return try Activity.request(
        attributes: attributes,
        content: ActivityContent(state: state, staleDate: nil)
    )
}

func pause(_ activity: Activity<CookingTimerAttributes>) async {
    var state = activity.content.state
    state.isPaused = true
    await activity.update(ActivityContent(state: state, staleDate: nil))
}

func finish(_ activity: Activity<CookingTimerAttributes>) async {
    let final = CookingTimerAttributes.ContentState(endDate: .now, isPaused: false)
    await activity.end(ActivityContent(state: final, staleDate: nil),
                       dismissalPolicy: .after(.now.addingTimeInterval(15 * 60)))
}
```

| Step | API | Notes |
|---|---|---|
| Start | `Activity.request(attributes:content:)` | App must be in the **foreground** (or use push-to-start, 52.14) |
| Update | `activity.update(_:)` | Only when the state **really** changes: pause, resume, new step |
| End | `activity.end(_:dismissalPolicy:)` | Show a **final** state |

**`dismissalPolicy`** decides how long the **ended** activity stays on the Lock Screen:

| Policy | Effect |
|---|---|
| `.default` | Stays for a while (up to **4 hours**) so the user sees the result |
| `.immediate` | Removed right away |
| `.after(date)` | Removed at that time (within the 4-hour window) |

Limits to know: an activity can be active for up to **8 hours**; after that, the system ends it (it can stay on the Lock Screen a bit longer). Find running activities again after a relaunch with **`Activity<CookingTimerAttributes>.activities`**.

---

## 52.13 Dynamic Island Regions and Layout 🟡

On iPhones with a **Dynamic Island**, a Live Activity has **three** presentations:

| Presentation | When | Space |
|---|---|---|
| **Compact** (leading + trailing) | Your activity is the **only** one running | Two small areas, left and right of the camera |
| **Minimal** | **Several** apps' activities run at once | One tiny circle |
| **Expanded** | The user **long-presses**, or an update has an **alert** | A larger card: leading, trailing, center, bottom |

```swift
enum CookingTimerIsland {
    static func make(context: ActivityViewContext<CookingTimerAttributes>) -> DynamicIsland {
        DynamicIsland {
            DynamicIslandExpandedRegion(.leading) {
                Image(systemName: "fork.knife")
            }
            DynamicIslandExpandedRegion(.trailing) {
                Text(timerInterval: Date.now...context.state.endDate, countsDown: true)
                    .monospacedDigit()
                    .frame(width: 60)
            }
            DynamicIslandExpandedRegion(.bottom) {
                Text(context.attributes.recipeTitle).font(.headline)
            }
        } compactLeading: {
            Image(systemName: "fork.knife")
        } compactTrailing: {
            Text(timerInterval: Date.now...context.state.endDate, countsDown: true)
                .monospacedDigit()
                .frame(width: 44)
        } minimal: {
            Image(systemName: "timer")
        }
        .widgetURL(URL(string: "recipes://timer"))             // tap opens the app here
        .keylineTint(.orange)                                    // the island's outline color
    }
}
```

Design tips:

- **Compact**: only the **most important** fact. Here: an icon and the time left.
- **Minimal**: often just an **icon**, or a **tiny** value.
- **Expanded**: more detail, but still **glanceable**: not a full screen.
- Use the **same** state data everywhere, so all presentations agree.

Design **every** region on purpose. The compact view is what users see **most**.

---

## 52.14 Push-Updated Live Activities 🔴

Some events are known only by a **server**: where the delivery driver is, the current score. For these, the **server** updates the Live Activity with a special **push** (APNs, 50.4), even while the app isn't running.

**1. Ask for a push token** when starting the activity:

```swift
let activity = try Activity.request(
    attributes: attributes,
    content: ActivityContent(state: state, staleDate: nil),
    pushType: .token                                  // this activity gets its own push token
)

Task {
    for await tokenData in activity.pushTokenUpdates {          // can change; watch it
        let token = tokenData.map { String(format: "%02x", $0) }.joined()
        try await api.registerLiveActivityToken(token, orderID: order.id)
    }
}
```

**2. The server sends** to APNs with these headers:

```
apns-push-type: liveactivity
apns-topic: com.example.recipes.push-type.liveactivity
apns-priority: 10        (5 = low priority, not shown at once)
```

**3. The payload:**

```json
{
  "aps": {
    "timestamp": 1767225600,
    "event": "update",
    "content-state": {
      "endDate": 788918520,
      "isPaused": false
    },
    "stale-date": 1767229200,
    "alert": {
      "title": "Almost ready",
      "body": "2 minutes left on your pasta"
    }
  }
}
```

| Key | Meaning |
|---|---|
| `event` | `"update"`, `"end"`, or `"start"` (push-to-start) |
| `content-state` | Must **decode** into your `ContentState` |
| `timestamp` | Newer updates win; older ones are ignored |
| `alert` | Optional: lights up the screen and expands the island |
| `dismissal-date` | With `"end"`: when to remove it |

⚠️ A common bug: **`content-state`** is decoded with the default **`JSONDecoder`**. A `Date` is then a number of seconds since **2001** (not 1970)! Above, `788918520` is 1 January 2026, 00:02 UTC. Use the same encoding on the server, or store plain numbers (like a Unix timestamp) in `ContentState`.

More options:

- **Push-to-start** (iOS 17.2): the server can **start** an activity. Get the token from `Activity<CookingTimerAttributes>.pushToStartTokenUpdates`.
- **Broadcast** pushes (iOS 18): one push on a **channel** updates **many** users' activities at once, like a live sports score.
- High-priority pushes have a **budget**. For very frequent updates, add `NSSupportsLiveActivitiesFrequentUpdates` to Info.plist.

---

## 52.15 Debugging Widgets and Extensions 🟡

The widget runs in its **own process** (52.1). Breakpoints in the **app's** scheme **don't stop** in widget code, because the debugger is attached to the **app**, not the extension.

How to debug:

1. Choose the **widget extension's scheme** in Xcode and run it. Xcode installs the widget and attaches the debugger to the **extension** process. (The scheme's settings choose which widget **kind** and **family** to show.)
2. Use **`#Preview(as:)`** with several entries (52.4) for fast layout work.
3. Log with **`Logger`** and read the logs in the **Console** app (68).

When "**my widget doesn't update**", check these first. They are usually **not** bugs in the provider:

```
1. App Group: is the SAME group turned on for BOTH targets?
   (the widget reads an empty store and shows placeholder data)
2. Reload: does the app call WidgetCenter...reloadTimelines(ofKind:)
   after saving? Is the kind string spelled the same?
3. Budget: did it reload too often? In real use it may be throttled
   for a while. (While debugging in Xcode, the budget isn't applied,
   so this bug often shows up only on testers' devices.)
4. Policy: is the timeline's policy .never by mistake?
5. Memory: did the extension crash on a large image? (Console app)
6. Live Activities: does content-state decode into ContentState? (52.14)
```

Most widget bugs are **setup** problems: shared storage, reload signals, and budgets. Check those **before** you rewrite the provider.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Widget structure | `Widget`, `TimelineProvider`, a SwiftUI view | The three pieces of every widget |
| Data over time | `TimelineEntry`, `Timeline` | Many future entries; the system switches them |
| Reload budget | `.atEnd`, `.after`, `.never`; self-updating `Text` | Few, smart reloads |
| Sizes | `supportedFamilies`, `\.widgetFamily` | A designed layout per size |
| User configuration | `AppIntentConfiguration`, `AppIntentTimelineProvider` | Edit Widget options from App Intents |
| In-widget actions | `Button(intent:)`, `Toggle(isOn:intent:)` | Run an intent without opening the app |
| Lock Screen / StandBy | Accessory families, `widgetRenderingMode` | Monochrome, glanceable, also watchOS |
| Controls | `ControlWidget`, `ControlWidgetButton`, `ControlWidgetToggle` | One-tap actions in Control Center |
| Shared data | App Groups, `WidgetCenter.reloadTimelines(ofKind:)` | Save, then tell the widget |
| Rendering limits | No scrolling or gestures; `widgetURL`, `Link` | A snapshot, not a mini app |
| Live Activity data | `ActivityAttributes`, `ContentState` | Fixed data vs. changing data (< 4 KB) |
| Activity lifecycle | `request`, `update`, `end(dismissalPolicy:)` | Start from the app; end with a final state |
| Dynamic Island | Compact, minimal, expanded regions | The key fact in tiny space |
| Server updates | `pushType: .token`, `liveactivity` pushes | The server drives the activity |
| Debugging | Extension scheme, `#Preview`, setup checklist | Check App Group, reloads, budget first |
