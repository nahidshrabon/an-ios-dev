**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

SwiftUI runs on **iPhone, iPad, Mac, Apple Watch, Apple TV, and Vision Pro**. Much of your code can be **shared**, but each platform has its own **screen size**, **input** (touch, mouse, Digital Crown, remote), and **conventions** (menus, windows, focus). This section covers how to **adapt** one app to many platforms without making a mess of the code.

---

## 33.1 Size Classes and Adaptive Layout 🟢

A **size class** describes the available space in **broad** terms: **`.compact`** (narrow) or **`.regular`** (wide). Read it from the environment and adapt the layout:

```swift
struct AdaptiveLayoutView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        Group {
            if horizontalSizeClass == .compact {
                VStack {
                    ImagePane()
                    DetailPane()
                }
            } else {
                HStack {
                    ImagePane()
                    DetailPane()
                }
            }
        }
    }
}
```

| Context | Horizontal size class |
|---|---|
| iPhone, portrait | `.compact` |
| Large iPhone, landscape | `.regular` |
| iPad, full screen | `.regular` |
| iPad, narrow window or side-by-side | `.compact` |
| Mac window | `.regular` |

Size classes describe **space**, not **devices**. That's why they're better than checking the device model or screen size: an iPad in a narrow window **is** compact, even though it's an iPad. The same idea powers `NavigationSplitView`'s switch between one and several columns (27.6).

⚠️ The `if`/`else` above makes **two different views** (25.14): when the size class changes, `ImagePane` and `DetailPane` are **rebuilt** and lose their `@State`. To **keep** them, switch the **layout** instead, with **`AnyLayout`** (23.13):

```swift
struct AdaptiveLayoutView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        let layout = horizontalSizeClass == .compact
            ? AnyLayout(VStackLayout())
            : AnyLayout(HStackLayout())

        layout {
            ImagePane()      // same identity in both layouts: state is kept
            DetailPane()
        }
    }
}
```

Size classes only have **two** values. For finer decisions, use **`ViewThatFits`** (24.17) or **`.onGeometryChange`** (24.20) to react to the **real** width.

---

## 33.2 iPad-Specific Layout Considerations 🟡

The iPad isn't just a "big iPhone". It has:

- **Resizable windows** and **multitasking**: your window can be any size, and change size **at any time**.
- **Keyboard and trackpad** support: users expect **shortcuts** and **pointer** effects.
- **More space**: often room for **more information** at once, like a sidebar plus content plus details.

```swift
struct IPadAwareView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        NavigationSplitView {
            SidebarList()
        } detail: {
            if horizontalSizeClass == .regular {
                DetailWithSupplementaryPane()    // extra info when there's room
            } else {
                DetailPane()
            }
        }
        .navigationSplitViewStyle(.balanced)     // sidebar and detail share the width
    }
}
```

Because windows **resize live**, never decide the layout **once at launch**. Read the size class (or geometry) in `body`, so the view updates **whenever** it changes.

Make the iPad feel **at home** with keyboard and pointer support:

```swift
Button("New Note", systemImage: "square.and.pencil") { createNote() }
    .keyboardShortcut("n", modifiers: .command)     // ⌘N; listed when the user holds ⌘

Image(systemName: "star")
    .padding(8)
    .hoverEffect(.highlight)                       // reacts when the trackpad pointer is over it
```

From iPadOS 26, iPad apps also get a **menu bar** at the top of the screen. Your **`.commands`** (33.4) appear there, just like on the Mac.

Test on **several** window sizes: full screen, half, and the smallest allowed. Xcode Previews can help (23.15).

---

## 33.3 macOS: WindowGroup, Window, and Settings 🟢

On the Mac, your `App` declares **scenes**, and each scene type behaves differently:

```swift
@main
struct MyMacApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()                 // File → New Window opens another one
        }

        Window("About", id: "about") {
            AboutView()                   // only one can be open
        }

        Settings {
            SettingsView()                // App menu → Settings… (⌘,)
        }
    }
}
```

| Scene | How many windows | Use for |
|---|---|---|
| `WindowGroup` | **Many**, of the same kind | The main content; documents; one window per item |
| `Window` | Exactly **one** | Utility windows: About, Activity, Inspector |
| `Settings` | One, special | The app's **Settings** window |

**`Settings`** is recognized by macOS: it's added to the **app menu** as "Settings…" with the standard **⌘,** shortcut, automatically. A typical settings view uses a `TabView` with `Form`s:

```swift
struct SettingsView: View {
    var body: some View {
        TabView {
            Tab("General", systemImage: "gear") { GeneralSettings() }
            Tab("Accounts", systemImage: "person.crop.circle") { AccountSettings() }
        }
        .frame(width: 450, height: 300)
    }
}
```

Control window **size** with scene modifiers:

```swift
WindowGroup {
    ContentView()
}
.defaultSize(width: 900, height: 600)        // the first size
.windowResizability(.contentMinSize)          // can't shrink below the content's minimum size
```

---

## 33.4 macOS: MenuBarExtra and Commands 🟡

**`MenuBarExtra`** puts an **icon in the menu bar** (top right of the Mac screen), with a menu or a small panel. **`Commands`** customize the app's **menus** (File, Edit, View, and so on).

```swift
@main
struct MenuBarUtilityApp: App {
    var body: some Scene {
        MenuBarExtra("Status", systemImage: "chart.bar.fill") {
            Text("Current Value: 42")
            Divider()
            Button("Quit") { NSApplication.shared.terminate(nil) }
        }
        .menuBarExtraStyle(.window)

        WindowGroup {
            ContentView()
        }
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Report") { }
                    .keyboardShortcut("n", modifiers: [.command, .shift])
            }
        }
    }
}
```

**`MenuBarExtra`** styles:

| Style | Looks like |
|---|---|
| `.menu` (default) | A normal **dropdown menu** of items |
| `.window` | A **floating panel** under the icon, for rich content: charts, sliders, text fields |

A `MenuBarExtra` is **always there** while the app runs, even with no windows open. Many utility apps live **only** in the menu bar. To hide the Dock icon for such an app, set **`LSUIElement`** ("Application is agent") to `YES` in Info.plist.

**`Commands`** change the menus:

```swift
.commands {
    CommandGroup(replacing: .newItem) {           // replace File → New
        Button("New Report") { }
            .keyboardShortcut("n", modifiers: [.command, .shift])
    }
    CommandGroup(after: .sidebar) {               // add to the View menu, after the sidebar item
        Button("Show Inspector") { }
            .keyboardShortcut("i", modifiers: [.command, .option])
    }
    CommandMenu("Report") {                       // a whole new top-level menu
        Button("Export PDF…") { }
        Button("Print…") { }
    }
}
```

`CommandGroup(replacing: .newItem)` **removes** the standard "New" items and puts **yours** in their place. `before:` and `after:` **add** items next to standard ones without removing them.

Mac users expect **every** action to be in a **menu**, with a **shortcut** for common ones. Menus also make actions **discoverable** and **searchable** (Help → Search).

---

## 33.5 openWindow and Window Management 🟡

The **`openWindow`** environment action opens a window **from code**. You can open a window **for a value**, like a specific document:

```swift
struct DocumentListView: View {
    @Environment(\.openWindow) private var openWindow

    let documents: [Document]

    var body: some View {
        List(documents) { document in
            Button(document.title) {
                openWindow(id: "documentWindow", value: document.id)
            }
        }
    }
}

@main
struct DocumentApp: App {
    var body: some Scene {
        WindowGroup {
            DocumentListView(documents: Document.all)
        }

        WindowGroup(id: "documentWindow", for: Document.ID.self) { $documentID in
            if let documentID {
                DocumentDetailView(documentID: documentID)
            }
        }
    }
}
```

How it fits:

1. **`WindowGroup(id:for:)`** declares windows that take a **value** of a type (here `Document.ID`).
2. **`openWindow(id:value:)`** opens one with a **specific value**.
3. The window's closure gets the value as a **binding**.

If a window for **the same value** is already open, SwiftUI **brings it to the front** instead of opening a duplicate.

This is **value-based navigation** (27.3), but for **whole windows**: you pass **data** (an ID), not a view, and the scene decides what to show. The value must be **`Codable`** and **`Hashable`**, so the system can **restore** windows after relaunch. Pass **IDs**, not big models.

Related actions:

```swift
@Environment(\.dismissWindow) private var dismissWindow     // close a window by id
@Environment(\.openSettings) private var openSettings       // macOS: open the Settings scene

Button("Close Inspector") { dismissWindow(id: "inspector") }
Button("Preferences…") { openSettings() }
```

`openWindow` works on **iPad** too, when the app supports **multiple windows** (`UIApplicationSupportsMultipleScenes` in Info.plist), and on **visionOS**.

---

## 33.6 Mac Catalyst vs. Native macOS SwiftUI 🟡

There are **three** ways to get an iOS app onto the Mac:

| Option | What it is | Effort | Feels native |
|---|---|---|---|
| **"Designed for iPad"** | The **unchanged** iPad app, run on Apple silicon Macs | None | Least |
| **Mac Catalyst** | Your **iPad** app, rebuilt for Mac, with Mac adaptations (menus, pointer, window controls) | Low–medium | Medium |
| **Native macOS** | A real **macOS** target, built on AppKit, sharing SwiftUI code | Medium–high | Most |

You can tell them apart **at compile time**:

```swift
#if targetEnvironment(macCatalyst)
// Mac Catalyst: iOS code running on the Mac
#elseif os(macOS)
// Native macOS
#elseif os(iOS)
// iPhone and iPad
#endif
```

⚠️ Under **Mac Catalyst**, `os(iOS)` is **also true**, because Catalyst compiles the **iOS** SDK. That's why the **`macCatalyst`** check must come **first**.

**Catalyst** is the **fastest** path for an existing iPad app: the same UIKit and SwiftUI code mostly just works. But some details can feel **"iPad-like"** on the Mac: control sizes, window behavior, menus.

A **native macOS** target (in the same Xcode project, sharing view code) gets **Mac-only** features like `MenuBarExtra` (33.4), `Settings` (33.3), and native AppKit controls. It feels the **most** at home, but needs **more** platform-specific work and testing.

A common path: **start** with Catalyst or "Designed for iPad", then move to a **native** target if the Mac version becomes important. With SwiftUI, much of the **view** code can be shared either way.

---

## 33.7 watchOS App Structure and Digital Crown 🟢

A watchOS app uses the **same** `App`, `Scene`, and `View` structure. The difference is the **tiny screen**: show **one thing** at a time, use **big** text and **few** taps. The **Digital Crown** is a great input for fine adjustments:

```swift
struct WatchCounterView: View {
    @State private var value: Double = 0

    var body: some View {
        VStack {
            Text("\(Int(value))")
                .font(.largeTitle)
            Text("Rotate Crown")
                .font(.caption2)
        }
        .focusable()                                         // needed to receive Crown input
        .digitalCrownRotation($value, from: 0, through: 100, by: 1)
    }
}
```

**`.digitalCrownRotation()`** binds a value to the **Crown**. Turning it changes the value smoothly, with **haptic** clicks at each step. It's easier than tapping tiny buttons.

**`.focusable()`** is **required**. The Crown sends its input to the **focused** view. If nothing is focusable, the Crown has nowhere to go. It's the same "who gets the input?" idea as `@FocusState` for the keyboard (28.15).

More options:

```swift
.digitalCrownRotation(
    $value,
    from: 0, through: 100, by: 5,
    sensitivity: .medium,             // how much turning is needed
    isContinuous: false,              // stop at the ends (true = wrap around)
    isHapticFeedbackEnabled: true
)
```

Common watchOS layouts:

```swift
TabView {
    SummaryView()
    DetailsView()
}
.tabViewStyle(.verticalPage)          // swipe or turn the Crown to move between pages
```

---

## 33.8 watchOS Complications 🟡

**Complications** are the small pieces of data on a **watch face**: steps, weather, the next meeting. On modern watchOS, they're **WidgetKit widgets** (52), with special **accessory** families:

```swift
struct StepCountComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "StepCount", provider: StepCountProvider()) { entry in
            StepCountView(entry: entry)
        }
        .configurationDisplayName("Steps")
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline, .accessoryRectangular])
    }
}

struct StepCountView: View {
    @Environment(\.widgetFamily) private var family
    let entry: StepEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            Gauge(value: Double(entry.stepCount), in: 0...10_000) {
                Image(systemName: "figure.walk")
            }
            .gaugeStyle(.accessoryCircularCapacity)
        case .accessoryInline:
            Text("\(entry.stepCount) steps")
        default:
            Text("\(entry.stepCount)")
                .font(.caption2.bold())
        }
    }
}
```

| Family | Where on the face |
|---|---|
| `.accessoryCircular` | A small circle |
| `.accessoryCorner` | A face corner, curved |
| `.accessoryInline` | One line of text, often at the top |
| `.accessoryRectangular` | A wider box with a few lines |

Because complications **are** widgets, much of the code (the **timeline provider**, the **entry**, even some **views**) can be **shared** with iPhone **Lock Screen** widgets, which use the **same** accessory families. One widget extension can serve both.

Watch faces often show complications in **one color** (tinted). Use `.widgetAccentable()` to mark the parts that should get the accent color.

---

## 33.9 tvOS Focus Engine Basics 🟡

Apple TV has **no touch screen**. Users move around with the **Siri Remote**: swipe to move, click to select. The **focus engine** decides **which** element is **focused** (highlighted), and moves focus based on the swipe **direction** and the **layout** on screen.

```swift
struct TVFocusDemoView: View {
    @Namespace private var namespace
    @FocusState private var focusedItem: Int?

    var body: some View {
        HStack(spacing: 40) {
            ForEach(0..<5) { index in
                RoundedRectangle(cornerRadius: 16)
                    .fill(focusedItem == index ? .blue : .gray)
                    .frame(width: 200, height: 120)
                    .focusable()                                    // can receive focus
                    .focused($focusedItem, equals: index)           // track which one has it
                    .prefersDefaultFocus(index == 0, in: namespace) // start on the first item
                    .scaleEffect(focusedItem == index ? 1.1 : 1.0)  // the usual "lift" on focus
                    .animation(.spring, value: focusedItem)
            }
        }
        .focusScope(namespace)
    }
}
```

The rules are different from iOS:

- **Only focusable views** can be reached. On iOS, users can tap **anything**; on tvOS, if a view can't get focus, the user **can't get to it** at all.
- Users must always **see** what's focused. Use a clear change: **scale**, **shadow**, **highlight**.

**`@FocusState`** works the same as for text fields (28.15): it **tracks** which element has focus, and you can **set** it to move focus from code. On tvOS, it's how you **style** the focused item and **react** when focus moves (for example, to show a preview).

Standard controls handle focus **for you**. A `Button` is focusable, and the **`.card`** style gives it the familiar tvOS lift-and-shine look:

```swift
Button { play(movie) } label: {
    MoviePoster(movie: movie)
}
.buttonStyle(.card)
```

Use **`.focusSection()`** to group items, so swiping from far away moves focus **into** the group naturally.

---

## 33.10 Platform Conditionals and anyAppleOS 🟢

**`#if os(...)`** includes code **only** for certain platforms. It's checked at **compile time**:

```swift
func platformName() -> String {
    #if os(iOS)
    "iOS"
    #elseif os(macOS)
    "macOS"
    #elseif os(watchOS)
    "watchOS"
    #elseif os(tvOS)
    "tvOS"
    #elseif os(visionOS)
    "visionOS"
    #else
    "Unknown"
    #endif
}
```

The code in the **other** branches is **never compiled** for that platform. That's **essential** for **platform-only** APIs: `MenuBarExtra` (macOS) and `.digitalCrownRotation()` (watchOS) don't **exist** on iOS, so they must be inside `#if`, or the iOS build fails.

Before reaching for `#if`, check if a **cross-platform** API already does the job. For toolbars, a **meaning-based** placement (27.19) works everywhere, with no `#if`:

```swift
// ❌ Two branches for the same button
#if os(iOS)
ToolbarItem(placement: .topBarTrailing) { shareButton }
#elseif os(macOS)
ToolbarItem(placement: .automatic) { shareButton }
#endif

// ✅ One line: the system places it right on each platform
ToolbarItem(placement: .primaryAction) { shareButton }
```

Other useful checks:

```swift
#if canImport(UIKit)          // any platform with UIKit (iOS, iPadOS, tvOS, visionOS, Catalyst)
import UIKit
#endif

#if targetEnvironment(simulator)
let useMockLocation = true
#endif
```

**`#if`** is for **compile time**. **`if #available`** is for **run time**, on the **same** platform: "is this device's OS **new enough**?"

```swift
if #available(iOS 26, macOS 26, *) {
    content.glassEffect()
} else {
    content.background(.ultraThinMaterial)
}
```

Since 2025, all Apple platforms share **one version number** (iOS 26, macOS 26, watchOS 26, tvOS 26, visionOS 26). There's a Swift proposal for an **`anyAppleOS`** shorthand, so one availability check could cover all Apple platforms at that version. Check whether **your** Swift version supports it; if not, list the platforms, as above.

---

## 33.11 Sharing a Codebase Across Platforms Cleanly 🟡

`#if os()` blocks **everywhere** make code hard to read. A cleaner design has **layers**:

1. **Shared, with no platform code at all**: models, business logic, networking, persistence.
2. **Mostly shared**: SwiftUI views that work everywhere.
3. **Platform-specific**: a **few** small views or files, kept apart on purpose.

```swift
// 1. Shared, platform-agnostic: no #if needed at all
struct TaskItem: Identifiable, Codable {
    let id: UUID
    var title: String
    var isComplete: Bool
}

@Observable
final class TaskStore {
    var tasks: [TaskItem] = []
    func toggle(_ task: TaskItem) {
        guard let index = tasks.firstIndex(where: { $0.id == task.id }) else { return }
        tasks[index].isComplete.toggle()
    }
}

// 3. Platform-specific presentation, isolated in one small view
struct TaskRowView: View {
    let task: TaskItem
    let onToggle: () -> Void

    var body: some View {
        #if os(watchOS)
        Text(task.title).font(.caption)          // tiny screen: just the title
            .onTapGesture(perform: onToggle)
        #else
        HStack {
            Image(systemName: task.isComplete ? "checkmark.circle.fill" : "circle")
            Text(task.title)
        }
        .onTapGesture(perform: onToggle)
        #endif
    }
}
```

A typical **project layout**:

```
Shared/                 ← in every target
  Models/TaskItem.swift
  Stores/TaskStore.swift
  Networking/APIClient.swift
  Views/TaskListView.swift
iOS/                    ← iOS target only
  TaskRowView+iOS.swift
macOS/                  ← macOS target only
  MenuBarView.swift
  SettingsView.swift
watchOS/                ← watchOS target only
  ComplicationViews.swift
```

Files in a platform folder belong **only** to that target (set in Xcode's **target membership**), so they need **no `#if`** at all. For bigger apps, put the shared layer in a **Swift package** (73) that every target imports.

The rule: business logic **almost never** needs to know the platform. Push platform differences **down** to the **fewest, smallest** places, so most of the app is written **once**.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Adaptive layout | `horizontalSizeClass`, `AnyLayout` | Adapt to space, not device; keep state when switching |
| iPad multitasking | Live size changes, shortcuts, hover | Re-layout any time; support keyboard and pointer |
| Multiple windows | `WindowGroup` | Many windows of the same kind |
| Singleton windows | `Window` | Exactly one window, like About |
| Preferences | `Settings` | The Mac Settings window, with ⌘, |
| Menu bar apps | `MenuBarExtra` | An always-there menu bar icon; `.window` for rich panels |
| Menu customization | `Commands`, `CommandGroup`, `CommandMenu` | Replace, add, or create menus with shortcuts |
| Programmatic windows | `openWindow`, `WindowGroup(id:for:)` | Value-based windows; reuses an open one |
| Bringing apps to Mac | Designed for iPad, Catalyst, native macOS | Effort vs. native feel; check `macCatalyst` first |
| Watch input | `.digitalCrownRotation()` + `.focusable()` | Fine adjustments with the Crown |
| Watch face data | WidgetKit accessory families | Complications shared with Lock Screen widgets |
| TV navigation | Focus engine, `@FocusState`, `.card` | Everything reachable must be focusable and visibly focused |
| Compile-time branching | `#if os(...)`, `#if canImport` | Platform-only APIs; prefer cross-platform APIs first |
| Clean multiplatform architecture | Shared logic + small platform views | Few, isolated platform differences |
