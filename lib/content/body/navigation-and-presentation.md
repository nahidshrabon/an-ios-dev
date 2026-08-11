## 27.1 `NavigationStack` and `NavigationLink`

`NavigationStack` manages a stack of views, pushing new views on top as the user navigates deeper and popping them off as they navigate back — `NavigationLink` is the tappable control that triggers a push.

```swift
NavigationStack {
    List(items) { item in
        NavigationLink(item.title) {
            DetailView(item: item)   // pushed onto the stack when tapped
        }
    }
    .navigationTitle("Items")
}
```

This inline form of `NavigationLink` (directly embedding the destination view) works fine for simple cases, but for lists with many rows, it eagerly constructs every destination view up front — the value-based approach in 27.3 avoids this and is generally preferred for data-driven navigation.

---

## 27.2 Navigation Titles and Display Modes

`.navigationTitle()` sets the title shown in the navigation bar for a given screen, and `.navigationBarTitleDisplayMode()` controls whether it renders as a large, prominent title or a smaller inline one:

```swift
List(items) { item in /* ... */ }
    .navigationTitle("Items")
    .navigationBarTitleDisplayMode(.large)     // the large, prominent title style (the default at the top of a stack)

DetailView(item: item)
    .navigationTitle(item.title)
    .navigationBarTitleDisplayMode(.inline)     // smaller, centered title — common for detail/pushed screens
```

The large title typically collapses to the inline style automatically as the user scrolls content upward within that screen — this is standard system behavior, not something you need to implement manually.

---

## 27.3 Value-Based Navigation with `navigationDestination(for:)`

Rather than embedding a destination view directly in each `NavigationLink` (27.1), value-based navigation associates a **data type** with a destination view builder once, and each `NavigationLink` simply carries a value of that type — SwiftUI resolves the actual destination view lazily, only when that specific link is actually navigated to.

```swift
struct Item: Identifiable, Hashable {
    let id = UUID()
    var title: String
}

NavigationStack {
    List(items) { item in
        NavigationLink(item.title, value: item)   // carries a VALUE, not a view
    }
    .navigationDestination(for: Item.self) { item in
        DetailView(item: item)   // resolved lazily, only when this specific item is navigated to
    }
}
```

This is the generally preferred, more scalable pattern — it avoids eagerly constructing every possible destination view up front (as inline `NavigationLink`s from 27.1 do), and it's also what makes programmatic/deep-link navigation (27.4–27.5) straightforward, since a "destination" is just a plain value you can construct and push without needing a `NavigationLink` view at all.

---

## 27.4 `NavigationPath` and Programmatic Navigation

`NavigationPath` is a type-erased collection representing a stack's current navigation state, letting you push/pop screens programmatically (not just via `NavigationLink` taps) and mix multiple different value types within a single stack:

```swift
struct ContentView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            List(items) { item in
                NavigationLink(item.title, value: item)
            }
            .navigationDestination(for: Item.self) { item in
                DetailView(item: item)
            }
        }
    }

    func navigateToItem(_ item: Item) {
        path.append(item)   // programmatically pushes a new screen, without any NavigationLink tap
    }

    func popToRoot() {
        path.removeLast(path.count)   // pops all the way back to the root screen
    }
}
```

Binding a `NavigationPath` to `NavigationStack(path:)` gives you full external control over the stack's contents — essential for scenarios like "after successfully submitting a form, programmatically navigate three screens deep" or responding to a deep link (27.5) that needs to construct a specific navigation state directly, bypassing normal tap-driven navigation entirely.

---

## 27.5 Deep Linking into a Navigation Stack

Deep linking — opening the app directly to a specific screen from a URL (recall the URL scheme/universal link mechanics covered fully in section 49.5–49.7) — combines directly with `NavigationPath` (27.4): parse the incoming URL into the appropriate value(s), then programmatically build the `NavigationPath` to match.

```swift
struct ContentView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            RootView()
                .navigationDestination(for: Item.self) { item in
                    DetailView(item: item)
                }
        }
        .onOpenURL { url in
            if let item = parseItem(from: url) {
                path = NavigationPath([item])   // jump directly to the deep-linked screen
            }
        }
    }
}
```

For deep links needing to represent a multi-screen path (not just one destination), `NavigationPath([firstItem, secondItem])` constructs a stack with multiple screens pre-pushed at once — letting a single deep link open directly to a screen several levels deep, with the correct intermediate screens already present for the back button to work naturally.

---

## 27.6 `NavigationSplitView` Two-Column

`NavigationSplitView` provides a sidebar-plus-detail layout — collapsing to a single-column, `NavigationStack`-like presentation on compact-width devices (iPhone) while showing both columns side by side on wider devices (iPad, Mac):

```swift
struct ContentView: View {
    @State private var selectedItem: Item?

    var body: some View {
        NavigationSplitView {
            List(items, selection: $selectedItem) { item in
                Text(item.title).tag(item)
            }
            .navigationTitle("Items")
        } detail: {
            if let selectedItem {
                DetailView(item: selectedItem)
            } else {
                Text("Select an item")
            }
        }
    }
}
```

This single view definition automatically adapts across size classes — on iPhone it behaves essentially like a `NavigationStack` (sidebar list, pushing to detail on selection), while on iPad/Mac it shows both the sidebar and detail simultaneously, without you writing separate layout code for each size class.

---

## 27.7 `NavigationSplitView` Three-Column

`NavigationSplitView` also supports a three-column configuration — sidebar, content list, and detail — common in apps like Mail (mailbox list → message list → message content):

```swift
NavigationSplitView {
    List(folders, selection: $selectedFolder) { folder in
        Text(folder.name)
    }
} content: {
    List(messagesInFolder, selection: $selectedMessage) { message in
        Text(message.subject)
    }
} detail: {
    if let selectedMessage {
        MessageDetailView(message: selectedMessage)
    } else {
        Text("Select a message")
    }
}
```

On narrower devices, this three-column configuration typically collapses progressively (showing one or two columns at a time, with back navigation between them) rather than all three simultaneously — exactly the same automatic, size-class-aware adaptation behavior as the two-column variant (27.6), just with an additional intermediate column to manage.

---

## 27.8 `TabView` and the `Tab` API

`TabView` presents a tab bar (or sidebar-style tab list on iPad, see 27.9) for switching between top-level sections of an app — the modern `Tab` API (superseding the older `.tabItem()` modifier style) associates each tab with a value for selection tracking and richer configuration:

```swift
struct ContentView: View {
    @State private var selection: AppTab = .home

    enum AppTab: Hashable {
        case home, search, profile
    }

    var body: some View {
        TabView(selection: $selection) {
            Tab("Home", systemImage: "house", value: .home) {
                HomeView()
            }
            Tab("Search", systemImage: "magnifyingglass", value: .search) {
                SearchView()
            }
            Tab("Profile", systemImage: "person", value: .profile) {
                ProfileView()
            }
        }
    }
}
```

Using an enum (recall section 6.22's "model state with enums" theme) for tab selection, rather than a raw `Int` index, is the idiomatic modern pattern — it makes the code self-documenting and immune to bugs from tabs being reordered or added, unlike index-based selection which would silently break if the tab order changed.

---

## 27.9 Sidebar-Adaptable Tabs on iPad

On iPad, tabs declared with the modern `Tab` API can automatically adapt into a sidebar-style presentation (rather than a bottom tab bar) when there's sufficient width, and `TabSection` lets you group related tabs together within that sidebar for larger tab counts:

```swift
TabView(selection: $selection) {
    Tab("Home", systemImage: "house", value: .home) {
        HomeView()
    }
    TabSection("Library") {
        Tab("Albums", systemImage: "square.stack", value: .albums) {
            AlbumsView()
        }
        Tab("Playlists", systemImage: "music.note.list", value: .playlists) {
            PlaylistsView()
        }
    }
}
.tabViewStyle(.sidebarAdaptable)   // opts into sidebar presentation on sufficiently wide displays
```

This automatic adaptation is another instance of the same "one declaration, multiple size-class-appropriate presentations" theme seen with `NavigationSplitView` (27.6–27.7) — you describe the tab structure once, and the system chooses the appropriate visual presentation (bottom bar vs. sidebar) based on available width.

---

## 27.10 Tab Customization and Persistence

Modern `TabView` supports letting users customize which tabs are visible/reordered (similar to apps like the App Store's customizable tab bar), with `.tabViewCustomization()` persisting the user's chosen configuration automatically across app launches.

```swift
struct ContentView: View {
    @State private var customization = TabViewCustomization()

    var body: some View {
        TabView {
            Tab("Home", systemImage: "house", value: .home) {
                HomeView()
            }
            .customizationID("home")   // a stable identifier for this tab's customization state

            Tab("Search", systemImage: "magnifyingglass", value: .search) {
                SearchView()
            }
            .customizationID("search")
        }
        .tabViewCustomization($customization)
    }
}
```

Each customizable tab needs a stable `.customizationID()` (distinct from its selection `value:`) so the user's saved reordering/visibility preferences can be correctly reapplied across app launches, even if the underlying tab definitions or their order in code changes slightly between app versions.

---

## 27.11 Sheets with `.sheet()`

`.sheet()` presents a view modally, sliding up from the bottom, typically for a focused task (like composing a new item) that returns the user to their previous context once dismissed — triggered by a `Bool` or optional-item binding:

```swift
struct ContentView: View {
    @State private var isShowingSheet = false

    var body: some View {
        Button("Add Item") {
            isShowingSheet = true
        }
        .sheet(isPresented: $isShowingSheet) {
            AddItemView()
        }
    }
}

// item-based form: automatically presents when "selectedItem" becomes non-nil
.sheet(item: $selectedItem) { item in
    EditItemView(item: item)
}
```

The item-based form (`.sheet(item:)`) is often more convenient than the boolean form when the sheet's content genuinely depends on *which* item triggered it — it avoids needing two separate pieces of state (a boolean *and* the selected item) that could otherwise fall out of sync with each other.

---

## 27.12 Presentation Detents

`.presentationDetents()` controls how tall a sheet renders, supporting fixed heights, fractional heights, or letting the user drag between multiple detent "stops" (like Apple Maps' bottom sheet, which snaps between a small peek, a medium height, and a full-screen presentation):

```swift
.sheet(isPresented: $isShowingSheet) {
    AddItemView()
        .presentationDetents([.medium, .large])   // user can drag between medium and full-height
}

.sheet(isPresented: $isShowingSheet) {
    QuickActionView()
        .presentationDetents([.height(200)])       // a fixed, non-resizable 200pt height
}
```

Without `.presentationDetents()` specified at all, a sheet defaults to its standard full-height (large) presentation on iPhone — detents are specifically for the increasingly common pattern of a partial-height sheet that still shows some of the underlying content behind it.

---

## 27.13 `.presentationBackground()` and `.presentationSizing()`

`.presentationBackground()` customizes a sheet's background (letting it be transparent, a custom color, or a material/blur effect, rather than the default opaque system background); `.presentationSizing()` provides finer control over the presentation's actual sizing behavior beyond what detents alone express.

```swift
.sheet(isPresented: $isShowingSheet) {
    QuickActionView()
        .presentationBackground(.thinMaterial)   // a translucent, blurred background instead of opaque
        .presentationSizing(.form)                 // sizing behavior tuned for form-style content
}
```

These modifiers are typically layered together with `.presentationDetents()` for a fully custom sheet presentation — controlling not just how tall the sheet is, but also its background material and overall sizing strategy, useful for sheets that need to feel more like a floating panel than the standard full-opacity system sheet.

---

## 27.14 Full Screen Covers

`.fullScreenCover()` is nearly identical to `.sheet()` in API shape, but presents content covering the *entire* screen with no visible underlying context and (by default) no drag-to-dismiss gesture — appropriate for flows that genuinely shouldn't be casually dismissed, like an onboarding sequence or a mandatory sign-in screen.

```swift
.fullScreenCover(isPresented: $isShowingOnboarding) {
    OnboardingView()
}
```

The key behavioral distinction from `.sheet()`: a full screen cover has no built-in swipe-down-to-dismiss gesture by default, and doesn't show any of the presenting view peeking out from behind it — appropriate specifically when you want to fully block interaction with the rest of the app until the covering flow explicitly completes or is dismissed through its own UI.

---

## 27.15 Popovers

`.popover()` presents content in a small, anchored floating panel — on iPad/Mac, it renders as a genuine popover with a pointing arrow anchored to its trigger; on iPhone (where a small floating popover would be impractical on a compact screen), it automatically adapts to present as a sheet instead.

```swift
.popover(isPresented: $isShowingPopover) {
    Text("Additional details")
        .padding()
}
```

This automatic adaptation (popover on regular-width devices, sheet on compact-width) is another instance of the same size-class-aware, single-declaration theme seen with `NavigationSplitView` and sidebar-adaptable tabs — you write one `.popover()` call, and the system chooses the presentation style appropriate to the current device/size class.

---

## 27.16 Alerts

`.alert()` presents the standard system alert dialog — a title, optional message, and one or more buttons — used for critical, blocking confirmations or error messages that genuinely require the user's immediate attention before continuing.

```swift
.alert("Delete Item?", isPresented: $isShowingDeleteAlert) {
    Button("Cancel", role: .cancel) { }
    Button("Delete", role: .destructive) {
        deleteItem()
    }
} message: {
    Text("This action cannot be undone.")
}
```

Alerts also support an item-based form (`.alert(item:)`, mirroring `.sheet(item:)` from 27.11) for cases where the alert's content depends on which specific item triggered it — like showing a different confirmation message depending on which row's delete button was tapped.

---

## 27.17 Confirmation Dialogs

`.confirmationDialog()` presents an action sheet — a set of buttons sliding up from the bottom, distinct from `.alert()`'s centered dialog box — typically used for presenting several related action choices at once (rather than a simple confirm/cancel binary).

```swift
.confirmationDialog("Choose an action", isPresented: $isShowingActionSheet) {
    Button("Share") { share() }
    Button("Duplicate") { duplicate() }
    Button("Delete", role: .destructive) { delete() }
    Button("Cancel", role: .cancel) { }
} message: {
    Text("What would you like to do with this item?")
}
```

The distinction from `.alert()` is largely about how many options are being presented and their visual weight — `.confirmationDialog()`'s bottom-sliding action sheet reads naturally for a list of several possible actions, while `.alert()`'s centered format is better suited to a simple, focused confirm/cancel or error-acknowledgment decision.

---

## 27.18 `@Environment(\.dismiss)`

`@Environment(\.dismiss)` provides a way for a presented view (a sheet, full screen cover, or pushed navigation destination) to dismiss *itself*, without needing an explicit binding passed down from its presenter:

```swift
struct AddItemView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Form {
            // ... fields ...
            Button("Save") {
                saveItem()
                dismiss()   // dismisses this view, however it was presented
            }
        }
    }
}
```

This is generally preferable to threading an explicit `@Binding<Bool>` down into every presented view purely so it can set it to `false` to dismiss itself — `dismiss()` works uniformly regardless of *how* the view was presented (sheet, full screen cover, or a pushed `NavigationStack` destination), without the presented view needing any knowledge of its specific presentation mechanism.

---

## 27.19 Toolbars and `ToolbarItem` Placements

`.toolbar()` adds buttons and other controls to a screen's navigation bar (or bottom bar), with `ToolbarItem`'s `placement:` parameter determining exactly where each item appears:

```swift
.toolbar {
    ToolbarItem(placement: .navigationBarLeading) {
        Button("Cancel") { dismiss() }
    }
    ToolbarItem(placement: .navigationBarTrailing) {
        Button("Save") { save() }
    }
    ToolbarItem(placement: .bottomBar) {
        Button("Add", systemImage: "plus") { addItem() }
    }
}
```

Common placements include `.navigationBarLeading`/`.navigationBarTrailing` (the standard leading/trailing nav bar positions), `.principal` (the title area, for a custom title view), and `.bottomBar` (a separate toolbar area along the bottom edge) — the system also handles adapting these positions sensibly across platforms (iPhone vs. iPad vs. Mac) automatically.

---

## 27.20 Toolbar Visibility Priority and Auto-Minimizing (iOS 27)

Recent iOS versions introduced automatic toolbar item prioritization — when there isn't enough horizontal space to show every toolbar item at full size, lower-priority items automatically collapse into a more compact representation (an icon-only button, or folding into an overflow menu, see 27.21) rather than the toolbar simply overflowing or clipping content.

```swift
.toolbar {
    ToolbarItem(placement: .navigationBarTrailing) {
        Button("Share", systemImage: "square.and.arrow.up") { share() }
            .toolbarItemVisibilityPriority(.high)   // protected from auto-minimizing first
    }
    ToolbarItem(placement: .navigationBarTrailing) {
        Button("More Options", systemImage: "ellipsis.circle") { }
            .toolbarItemVisibilityPriority(.low)     // collapses/hides first under space pressure
    }
}
```

This directly parallels `.layoutPriority()`'s role in stack layout (recall section 24.10) — applied specifically to toolbar items, letting you designate which controls should be protected from automatic space-driven compression and which should yield first when the toolbar genuinely can't fit everything at its ideal size.

---

## 27.21 Toolbar Overflow Menus and Pinned Placements (iOS 27)

Complementing 27.20's auto-minimizing behavior, toolbar items that don't fit can automatically collapse into a system-provided overflow menu (rather than being hidden entirely), and specific items can be explicitly **pinned** to always remain visible regardless of available space, never candidates for overflow collapse.

```swift
.toolbar {
    ToolbarItem(placement: .navigationBarTrailing) {
        Button("Search", systemImage: "magnifyingglass") { }
            .toolbarItemPinning(.pinned)   // always visible, never collapses into overflow
    }
    ToolbarItem(placement: .navigationBarTrailing) {
        Button("Filter", systemImage: "line.3.horizontal.decrease.circle") { }
            // eligible for overflow collapse if space runs short
    }
}
```

This gives fine-grained control over toolbar degradation under space pressure — critical actions (like a persistent search button) can be pinned to guarantee they're always immediately accessible, while less critical, secondary actions gracefully fold into an overflow menu rather than competing for the same limited toolbar space.

---

## 27.22 Context Menus

`.contextMenu()` attaches a long-press-triggered menu of actions to any view, commonly used for row-level actions in a list as an alternative (or supplement) to swipe actions (recall section 26.8):

```swift
Text(item.title)
    .contextMenu {
        Button("Edit", systemImage: "pencil") { edit(item) }
        Button("Duplicate", systemImage: "doc.on.doc") { duplicate(item) }
        Button("Delete", systemImage: "trash", role: .destructive) { delete(item) }
    }
```

Context menus can also include a `preview:` closure showing an enlarged, non-interactive preview of the content above the menu itself (commonly seen with link/image previews throughout iOS) — providing additional visual context for what the menu's actions will actually apply to, before the user commits to a choice.

---

## 27.23 Zoom Navigation Transitions

The `.navigationTransition(.zoom(...))` modifier (paired with a matching `.matchedTransitionSource()` on the triggering element) produces a smooth zoom effect when navigating from a source element (like a grid thumbnail) into a detail view, visually connecting the two rather than using a plain slide/push transition.

```swift
NavigationLink(value: item) {
    ItemThumbnail(item: item)
        .matchedTransitionSource(id: item.id, in: namespace)
}
.navigationDestination(for: Item.self) { item in
    DetailView(item: item)
        .navigationTransition(.zoom(sourceID: item.id, in: namespace))
}
```

This is conceptually closely related to `matchedGeometryEffect` (covered fully in section 29.8–29.9), but purpose-built specifically for navigation transitions — producing the polished "thumbnail grows into full detail view" effect seen throughout Apple's own apps (like Photos), without needing to hand-roll the geometry-matching animation yourself.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `NavigationStack`/`NavigationLink` | Push-based navigation; inline links eagerly construct destinations |
| Navigation titles | `.navigationTitle()` plus `.navigationBarTitleDisplayMode()` for large vs. inline styling |
| Value-based navigation | `navigationDestination(for:)` resolves destinations lazily from plain data values — the preferred pattern |
| `NavigationPath` | Type-erased, programmatically controllable stack state, mixing multiple value types |
| Deep linking | Parse a URL, then construct a `NavigationPath` matching the intended destination(s) |
| `NavigationSplitView` (2/3-column) | Sidebar-plus-detail (or sidebar/content/detail) layout, auto-adapting across size classes |
| `TabView`/`Tab` API | Modern, value-based tab selection using an enum rather than raw indices |
| Sidebar-adaptable tabs | Tabs auto-present as a sidebar on wide iPad displays; `TabSection` groups related tabs |
| Tab customization | `.tabViewCustomization()` persists user-reordered/hidden tabs via stable `.customizationID()`s |
| `.sheet()` | Modal, bottom-sliding presentation; item-based form avoids desynced boolean+item state |
| Presentation detents | Fixed/fractional/multi-stop sheet heights, for partial-height presentations |
| `.presentationBackground()`/`.presentationSizing()` | Customize a sheet's background material and sizing strategy |
| Full screen covers | Like sheets, but covering the entire screen with no default dismiss gesture |
| Popovers | Anchored floating panel on iPad/Mac; automatically becomes a sheet on iPhone |
| Alerts | Centered, blocking dialog for critical confirmations or errors |
| Confirmation dialogs | Bottom-sliding action sheet for presenting several related action choices |
| `@Environment(\.dismiss)` | Lets a presented view dismiss itself, uniformly regardless of presentation mechanism |
| Toolbars/`ToolbarItem` | `placement:` determines where controls appear; adapts sensibly across platforms |
| Toolbar visibility priority | Auto-minimizes lower-priority items under space pressure, mirroring `.layoutPriority()` |
| Toolbar overflow/pinning | Items collapse into an overflow menu or stay explicitly pinned, never overflow-eligible |
| Context menus | Long-press-triggered action menu, with an optional enlarged preview of the content |
| Zoom navigation transitions | Smooth zoom effect connecting a source element to its detail view during navigation |

**Next up:** Section 28 — Forms and Input.
