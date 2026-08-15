## 33.1 Size Classes and Adaptive Layout

`@Environment(\.horizontalSizeClass)` and `@Environment(\.verticalSizeClass)` expose whether the current context is `.compact` or `.regular`, letting a single view adapt its layout to available space rather than needing platform-specific branches.

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

Size classes abstract away the specific device — an iPhone in portrait and a small multitasking Slide Over window on iPad might both report `.compact`, while an iPad in full-screen landscape and a Mac window report `.regular`. Designing against size class (rather than checking `UIDevice` model or screen dimensions directly) is the idiomatic SwiftUI approach, and it's exactly the same mechanism underlying `NavigationSplitView`'s automatic single-column-vs-multi-column adaptation (section 27.5).

---

## 33.2 iPad-Specific Layout Considerations

Beyond size classes, iPad introduces specific considerations: multitasking (Split View, Slide Over), external keyboard/pointer support, and significantly more available screen real estate that often calls for genuinely different information density than a phone layout.

```swift
struct iPadAwareView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        NavigationSplitView {
            SidebarList()
        } detail: {
            if horizontalSizeClass == .regular {
                DetailWithSupplementaryPane()
            } else {
                DetailPane()
            }
        }
        .navigationSplitViewStyle(.balanced)
    }
}
```

Because iPad windows can be resized via multitasking, a layout that looks correct at launch must keep responding correctly as `horizontalSizeClass` changes live during the app's lifetime — this is one reason size-class-driven layout (33.1) is preferable to a one-time layout decision made only at launch. `.navigationSplitViewStyle(.balanced)` is one of several styles controlling how `NavigationSplitView`'s columns share available width, particularly relevant on iPad's wider layouts.

---

## 33.3 macOS: WindowGroup, Window, and Settings

On macOS, `WindowGroup` (also used on iOS) supports multiple simultaneous windows of the same document/scene type, `Window` declares a single unique window instance, and `Settings` provides the standard macOS Preferences/Settings window.

```swift
@main
struct MyMacApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }

        Window("About", id: "about") {
            AboutView()
        }

        Settings {
            SettingsView()
        }
    }
}
```

`WindowGroup` is appropriate for document-style or repeatable content where the user might reasonably want several windows open at once (like multiple text documents). `Window` is for singleton utility windows, like an "About" panel, that should never have more than one instance open. `Settings` is specifically recognized by macOS as the app's Preferences window, automatically wired into the standard `App Name > Settings…` menu location and its conventional `Cmd+,` keyboard shortcut.

---

## 33.4 macOS: MenuBarExtra and Commands

`MenuBarExtra` declares a persistent menu bar icon/menu (the kind used by utility apps that live primarily in the menu bar), and `Commands` lets an app customize its menu bar's command menus (File, Edit, View, etc.).

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

`.menuBarExtraStyle(.window)` renders the menu bar extra's content as a floating window-style panel rather than a plain dropdown menu, appropriate for richer interactive content. `Commands` (via `.commands { }` on a `Scene`) lets an app insert, replace, or remove standard menu items — here replacing the default "New" menu item's behavior entirely with a custom action and its own keyboard shortcut, letting apps integrate deeply with macOS's traditional menu bar conventions.

---

## 33.5 openWindow and Window Management

The `openWindow` environment action programmatically opens a new window (by scene ID or value-based identity), letting code — rather than only direct user interaction with the Window menu — trigger new window creation.

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
        WindowGroup(id: "documentWindow", for: Document.ID.self) { $documentID in
            if let documentID {
                DocumentDetailView(documentID: documentID)
            }
        }
    }
}
```

`openWindow(id:value:)` pairs with a `WindowGroup(id:for:)` scene declaration that accepts a value type (here `Document.ID`) — tapping a row programmatically opens a new window scoped to that specific document's identity, with `WindowGroup`'s closure receiving the value as a binding. This value-based window opening mirrors the value-based navigation pattern from section 27.2, extended to the level of entire windows rather than in-window navigation destinations.

---

## 33.6 Mac Catalyst vs. Native macOS SwiftUI

Mac Catalyst runs an iPad app's UIKit/SwiftUI code on macOS with adaptations (traffic-light window controls, pointer support, menu bar integration), while native macOS SwiftUI is written and compiled specifically targeting macOS's own AppKit-backed platform layer — the two represent different trade-offs for bringing an app to the Mac.

```swift
#if targetEnvironment(macCatalyst)
// Mac Catalyst-specific adjustments — running iOS/iPadOS code on macOS
#elseif os(macOS)
// Native macOS SwiftUI — genuinely macOS-targeted build
#endif
```

Mac Catalyst is generally the faster path to a Mac version of an existing iPad app, since it reuses the same UIKit/SwiftUI codebase largely unmodified, but can feel less "genuinely native" in subtle interaction details. A dedicated native macOS SwiftUI target (a separate platform target in the same Xcode project, sharing SwiftUI view code where practical) gives access to macOS-specific scene types (`MenuBarExtra`, `Settings`) and typically produces a more polished, platform-idiomatic result, at the cost of more implementation and testing effort maintaining platform-specific behavior.

---

## 33.7 watchOS App Structure and Digital Crown

A watchOS app follows the same `App`/`Scene`/`View` structure as other Apple platforms, but with UI patterns adapted for a much smaller display, and the Digital Crown available as a distinctive input mechanism for fine-grained scrolling or value adjustment.

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
        .focusable()
        .digitalCrownRotation($value, from: 0, through: 100, by: 1)
    }
}
```

`.digitalCrownRotation()` binds a value to the physical Digital Crown's rotation, letting users make fine, tactile adjustments without needing to tap small on-screen targets — well suited to the watch's constrained display. `.focusable()` is required for a view to actually receive Digital Crown input, since the crown's rotation needs a specific focused element to direct its input toward, similar in spirit to `@FocusState`'s role in directing keyboard input (section 28.15) but for this platform-specific input mechanism.

---

## 33.8 watchOS Complications

Complications are the small, glanceable pieces of app data shown directly on a watch face — implemented via WidgetKit on modern watchOS, sharing much of the same timeline-based architecture used for iOS/iPadOS home screen widgets.

```swift
struct StepCountComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "StepCount", provider: StepCountProvider()) { entry in
            Text("\(entry.stepCount)")
                .font(.caption2.bold())
        }
        .supportedFamilies([.accessoryCircular, .accessoryCorner, .accessoryInline])
    }
}
```

Modern watchOS complications are built as WidgetKit `Widget`s using families like `.accessoryCircular`, `.accessoryCorner`, and `.accessoryInline` — specifically shaped for watch face placement — rather than a separate, watch-only complication API. This unification means much of the timeline-provider and entry-view logic used for other widget contexts (home screen, Lock Screen) can be shared or closely mirrored for watch face complications.

---

## 33.9 tvOS Focus Engine Basics

tvOS has no touch input — navigation happens entirely through the Siri Remote's directional swipes, and the system's focus engine determines which on-screen element is currently "focused" and eligible to be activated.

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
                    .focusable()
                    .focused($focusedItem, equals: index)
                    .scaleEffect(focusedItem == index ? 1.1 : 1.0)
                    .animation(.spring, value: focusedItem)
            }
        }
    }
}
```

Since there's no cursor or touch point on tvOS, every interactive element must be genuinely focusable, and the system automatically moves focus between elements based on remote swipe direction and on-screen spatial layout. `@FocusState` (the same mechanism from section 28.15's keyboard focus management) tracks which element currently holds focus, letting the UI apply the platform-conventional visual treatment for focused elements — commonly a scale-up and highlight, as shown, giving users clear visual feedback about which element the remote's next click will activate.

---

## 33.10 Platform Conditionals and anyAppleOS

Compile-time platform conditionals (`#if os(iOS)`, `#if os(macOS)`, etc.) let shared code branch for platform-specific APIs, while cross-platform availability checks (informally referred to as "anyAppleOS" patterns) help write code that compiles cleanly everywhere a shared module targets.

```swift
struct PlatformAwareToolbar: ToolbarContent {
    var body: some ToolbarContent {
        #if os(iOS)
        ToolbarItem(placement: .navigationBarTrailing) {
            Button("Share", systemImage: "square.and.arrow.up") { }
        }
        #elseif os(macOS)
        ToolbarItem(placement: .automatic) {
            Button("Share", systemImage: "square.and.arrow.up") { }
        }
        #endif
    }
}

func platformName() -> String {
    #if os(iOS)
    "iOS"
    #elseif os(macOS)
    "macOS"
    #elseif os(watchOS)
    "watchOS"
    #elseif os(tvOS)
    "tvOS"
    #else
    "Unknown"
    #endif
}
```

`#if os(...)` conditionals are resolved entirely at compile time, meaning platform-unavailable code is never even compiled into a given platform's build — essential for referencing genuinely platform-exclusive APIs like `MenuBarExtra` (macOS-only) or `.digitalCrownRotation()` (watchOS-only) from within an otherwise-shared source file, without breaking builds on platforms where those APIs don't exist.

---

## 33.11 Sharing a Codebase Across Platforms Cleanly 🟠

Beyond scattered `#if os()` blocks, a cleaner architecture for genuinely multiplatform apps typically separates platform-agnostic business logic and data models (shared unconditionally) from platform-specific UI, isolated behind small, well-defined protocol or view abstractions.

```swift
// Shared, platform-agnostic (no #if needed at all)
struct TaskItem: Identifiable, Codable {
    let id: UUID
    var title: String
    var isComplete: Bool
}

@Observable
class TaskStore {
    var tasks: [TaskItem] = []
    func toggle(_ task: TaskItem) { /* shared logic */ }
}

// Platform-specific presentation, isolated to its own small surface
struct TaskRowView: View {
    let task: TaskItem
    let onToggle: () -> Void

    var body: some View {
        #if os(watchOS)
        Text(task.title).font(.caption)
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

The general principle: business logic, data models, and networking (like `TaskItem` and `TaskStore` above) rarely need any platform awareness at all and should be written once, shared unconditionally across every target. Platform-specific concerns are then pushed down to the smallest possible surface — often a handful of individual view files — rather than scattering `#if os()` blocks broadly throughout the codebase. This keeps the majority of the app's logic genuinely platform-agnostic, with platform differences concentrated in a few clearly-identified, intentionally-isolated locations.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Adaptive layout | `horizontalSizeClass`/`verticalSizeClass` | Layout that responds to available space, not device |
| iPad multitasking | Live size class changes | Layout must adapt during app lifetime, not just at launch |
| Multiple windows | `WindowGroup` | Repeatable document/scene-style windows |
| Singleton windows | `Window` | Single-instance utility windows (e.g. About panel) |
| Preferences | `Settings` | Standard macOS Settings/Preferences window |
| Menu bar apps | `MenuBarExtra` | Persistent menu bar icon and menu |
| Menu customization | `Commands`, `CommandGroup` | Customize File/Edit/View menu bar menus |
| Programmatic windows | `openWindow`, `WindowGroup(id:for:)` | Value-based window opening |
| Bringing apps to Mac | Mac Catalyst vs. native macOS | Reuse vs. platform-idiomatic trade-off |
| Watch input | `.digitalCrownRotation()` | Tactile fine-grained value adjustment |
| Watch face data | WidgetKit complications | Timeline-based glanceable watch face content |
| TV navigation | Focus engine, `@FocusState` | Remote-driven, focus-based interaction |
| Compile-time branching | `#if os(...)` | Platform-exclusive code without breaking other targets |
| Clean multiplatform architecture | Shared logic + isolated platform views | Minimize scattered platform conditionals |

**Next up:** Section 34 — Document-Based Apps.
