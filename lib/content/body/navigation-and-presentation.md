**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**Navigation** moves the user **between screens**: pushing onto a stack, picking from a sidebar, or switching tabs. **Presentation** shows something **on top** for a short task: a sheet, an alert, a menu. In SwiftUI, both are driven by **state**. You don't call `push` or `present`; you change a value, and the UI follows.

---

## 27.1 `NavigationStack` and `NavigationLink` 🟢

A **`NavigationStack`** holds a **stack of screens**. A **`NavigationLink`** pushes a new screen when tapped. The back button pops it. This is SwiftUI's `UINavigationController`.

```swift
NavigationStack {
    List(items) { item in
        NavigationLink(item.title) {
            DetailView(item: item)   // pushed when the row is tapped
        }
    }
    .navigationTitle("Items")
}
```

A link's label can be **any view**:

```swift
NavigationLink {
    DetailView(item: item)
} label: {
    HStack {
        Image(systemName: item.icon)
        Text(item.title)
    }
}
```

This **inline** form puts the destination **inside** the link. It's fine for a few links. In a long list, each row creates its destination's **struct** (its `init` runs) even before any tap. And you can't push a screen **from code**. The **value-based** form (27.3) fixes both, and is the usual choice for data.

Put **one** `NavigationStack` at the **root** of a flow. Don't wrap pushed screens in another `NavigationStack`; that creates a stack inside a stack.

---

## 27.2 Navigation Titles and Display Modes 🟢

**`.navigationTitle()`** sets the bar title. Put it on the **content inside** the stack, not on the `NavigationStack` itself. **`.navigationBarTitleDisplayMode()`** picks a **large** or **inline** title:

```swift
List(items) { item in /* ... */ }
    .navigationTitle("Items")
    .navigationBarTitleDisplayMode(.large)    // big title; the default at the root of a stack

DetailView(item: item)
    .navigationTitle(item.title)
    .navigationBarTitleDisplayMode(.inline)   // small, centered title; common for pushed screens
```

A large title **shrinks to inline** by itself when the user scrolls. You don't write any code for that.

More title options:

```swift
.toolbarTitleDisplayMode(.inlineLarge)        // large, but placed in the bar row (iOS 17)

.toolbar {
    ToolbarItem(placement: .principal) {      // a fully custom title view
        Image("logo").resizable().scaledToFit().frame(height: 28)
    }
}
```

---

## 27.3 Value-Based Navigation with `navigationDestination(for:)` 🟢

With **value-based** navigation, a link carries a **value** (data), not a view. You say **once**, with **`navigationDestination(for:)`**, which view to show for that **type**:

```swift
struct Item: Identifiable, Hashable {
    let id = UUID()
    var title: String
}

NavigationStack {
    List(items) { item in
        NavigationLink(item.title, value: item)   // carries a VALUE
    }
    .navigationDestination(for: Item.self) { item in
        DetailView(item: item)   // built only when this item is actually opened
    }
}
```

Why it's better:

- The destination is built **only when needed**.
- A "destination" is **just a value**, so you can push from **code** (27.4) or from a **deep link** (27.5).
- Each **type** maps to one screen, in one place.

You can register **several types** on one stack:

```swift
NavigationStack {
    HomeView()
        .navigationDestination(for: Item.self) { ItemDetailView(item: $0) }
        .navigationDestination(for: User.self) { ProfileView(user: $0) }
        .navigationDestination(for: Tag.self) { TagView(tag: $0) }
}
```

⚠️ Put `.navigationDestination` on a view **that's always there** (like the `List`), **not inside** a row or a lazy container. Rows come and go as you scroll, and the destination would disappear with them.

---

## 27.4 `NavigationPath` and Programmatic Navigation 🟡

Bind the stack to a **path** to control it **from code**. **`NavigationPath`** is a list of values that can hold **different types**:

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
        path.append(item)             // push a screen, no tap needed
    }

    func popToRoot() {
        path.removeLast(path.count)   // pop back to the root
    }
}
```

If the stack only holds **one type**, a plain **array** is simpler. You can read it too:

```swift
@State private var path: [Item] = []

NavigationStack(path: $path) { /* ... */ }

path.append(item)        // push
path.removeLast()        // pop one
path = []                // pop to root
let current = path.last  // which screen is on top
```

In bigger apps, the path often lives in a **router** object, so any screen can navigate:

```swift
enum Route: Hashable {
    case item(Item)
    case profile(User)
    case settings
}

@Observable
final class Router {
    var path: [Route] = []

    func open(_ route: Route) { path.append(route) }
    func popToRoot() { path.removeAll() }
}

struct RootView: View {
    @State private var router = Router()

    var body: some View {
        NavigationStack(path: $router.path) {
            HomeView()
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .item(let item): ItemDetailView(item: item)
                    case .profile(let user): ProfileView(user: user)
                    case .settings: SettingsView()
                    }
                }
        }
        .environment(router)       // any screen can call router.open(...)
    }
}
```

An **enum of routes** (6.22) lists every screen in one place, and the compiler checks the `switch`.

---

## 27.5 Deep Linking into a Navigation Stack 🟡

A **deep link** opens the app on a **specific screen** from a URL (URL schemes and universal links are in 49.5–49.7). With a path, it's simple: **parse the URL into values**, then **set the path**:

```swift
struct ContentView: View {
    @State private var path: [Route] = []

    var body: some View {
        NavigationStack(path: $path) {
            RootView()
                .navigationDestination(for: Route.self) { route in
                    destination(for: route)
                }
        }
        .onOpenURL { url in
            if let routes = parseRoutes(from: url) {
                path = routes             // jump straight to the linked screen
            }
        }
    }
}
```

A link can open **several levels deep**. Set all the screens at once, so the **back button** works naturally:

```swift
enum Route: Hashable {
    case user(id: Int)
    case post(id: Int)
}

// myapp://users/42/posts/7
func parseRoutes(from url: URL) -> [Route]? {
    let parts = url.pathComponents.filter { $0 != "/" }   // ["42", "posts", "7"], host is "users"
    guard url.host == "users", parts.count >= 1, let userID = Int(parts[0]) else { return nil }

    var routes: [Route] = [.user(id: userID)]
    if parts.count == 3, parts[1] == "posts", let postID = Int(parts[2]) {
        routes.append(.post(id: postID))    // the user screen, then the post on top
    }
    return routes
}
```

Pass **IDs** in routes, not full models. The destination screen loads the data. Then a route is small, `Hashable`, and easy to build from a URL.

---

## 27.6 `NavigationSplitView` Two-Column 🟡

**`NavigationSplitView`** shows a **sidebar** and a **detail** area. On iPad and Mac, both columns show **side by side**. On iPhone, it **collapses** into one column that works like a stack.

```swift
struct ContentView: View {
    @State private var selectedItem: Item?

    var body: some View {
        NavigationSplitView {
            List(items, selection: $selectedItem) { item in
                NavigationLink(item.title, value: item)   // the value is the selection tag
            }
            .navigationTitle("Items")
        } detail: {
            if let selectedItem {
                DetailView(item: selectedItem)
            } else {
                ContentUnavailableView("Select an item", systemImage: "doc")
            }
        }
    }
}
```

The **selection** drives everything: tapping a row sets `selectedItem`, and the detail column shows it. One view definition works on **every** device size.

You can control **which columns show**, and their width:

```swift
@State private var columnVisibility: NavigationSplitViewVisibility = .all

NavigationSplitView(columnVisibility: $columnVisibility) {
    Sidebar()
        .navigationSplitViewColumnWidth(min: 200, ideal: 250, max: 320)
} detail: {
    Detail()
}
.navigationSplitViewStyle(.balanced)     // or .prominentDetail
```

The detail column can have its **own** `NavigationStack`, to push more screens inside it:

```swift
} detail: {
    NavigationStack {
        DetailView(item: selectedItem)
            .navigationDestination(for: Comment.self) { CommentView(comment: $0) }
    }
}
```

---

## 27.7 `NavigationSplitView` Three-Column 🟡

With **three** columns you get **sidebar → content → detail**. This is the **Mail** layout: mailboxes → messages → one message.

```swift
@State private var selectedFolder: Folder?
@State private var selectedMessage: Message?

NavigationSplitView {
    List(folders, selection: $selectedFolder) { folder in
        NavigationLink(folder.name, value: folder)
    }
} content: {
    if let selectedFolder {
        List(selectedFolder.messages, selection: $selectedMessage) { message in
            NavigationLink(message.subject, value: message)
        }
    } else {
        Text("Select a folder")
    }
} detail: {
    if let selectedMessage {
        MessageDetailView(message: selectedMessage)
    } else {
        Text("Select a message")
    }
}
```

On smaller widths it **collapses step by step**: two columns, then one, with **back** navigation between them. Same as the two-column version, just with one more level.

Remember to **clear** the inner selection when the outer one changes, so you don't show a message from the wrong folder:

```swift
.onChange(of: selectedFolder) {
    selectedMessage = nil
}
```

---

## 27.8 `TabView` and the `Tab` API 🟢

**`TabView`** switches between the app's **top-level sections**. The **`Tab`** API (iOS 18) gives each tab a **title**, an **icon**, and a **value** for selection:

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
            Tab("Search", systemImage: "magnifyingglass", value: .search, role: .search) {
                SearchView()         // role: .search gets special placement on iOS 26
            }
            Tab("Profile", systemImage: "person", value: .profile) {
                ProfileView()
            }
            .badge(3)                // a red badge on the tab
        }
    }
}
```

Use an **enum** for the selection, not an `Int` index. `selection = .profile` is **clear**, and it doesn't break if you **reorder** or **add** tabs. An index would silently point to the wrong tab.

Switching tabs **from code** is just setting the value:

```swift
Button("Go to Profile") { selection = .profile }
```

Each tab usually has its **own** `NavigationStack`. Then each tab keeps its own back history:

```swift
Tab("Home", systemImage: "house", value: .home) {
    NavigationStack { HomeView() }
}
```

In older code, you'll see `.tabItem { Label(...) }` and `.tag(...)`. That style still works, but `Tab` is the modern way.

---

## 27.9 Sidebar-Adaptable Tabs on iPad 🟡

With **`.tabViewStyle(.sidebarAdaptable)`**, tabs show as a **tab bar** on iPhone, and on iPad the user can switch to a **sidebar**. **`TabSection`** groups tabs in the sidebar:

```swift
enum LibraryTab: Hashable {
    case home, albums, playlists
}

TabView(selection: $selection) {
    Tab("Home", systemImage: "house", value: LibraryTab.home) {
        HomeView()
    }
    TabSection("Library") {
        Tab("Albums", systemImage: "square.stack", value: LibraryTab.albums) {
            AlbumsView()
        }
        Tab("Playlists", systemImage: "music.note.list", value: LibraryTab.playlists) {
            PlaylistsView()
        }
    }
}
.tabViewStyle(.sidebarAdaptable)
```

You describe the tabs **once**. The system picks a **tab bar** or a **sidebar** based on the space. It's the same idea as `NavigationSplitView`: one declaration, the right look for each device.

This style is good for apps with **many** sections, like Music or Files. A sidebar can hold more items than a tab bar's 4–5 slots.

---

## 27.10 Tab Customization and Persistence 🟡

With the sidebar-adaptable style, users can **customize** tabs: reorder them, and hide or show them. You keep their choices in a **`TabViewCustomization`** value. To **save** it across launches, store it in **`@AppStorage`**:

```swift
struct ContentView: View {
    @AppStorage("tabCustomization") private var customization = TabViewCustomization()
    @State private var selection: AppTab = .home

    var body: some View {
        TabView(selection: $selection) {
            Tab("Home", systemImage: "house", value: .home) {
                HomeView()
            }
            .customizationID("home")         // a stable ID for saving this tab's settings

            Tab("Search", systemImage: "magnifyingglass", value: .search) {
                SearchView()
            }
            .customizationID("search")
            .customizationBehavior(.disabled, for: .sidebar, .tabBar)   // this one can't be moved or hidden
        }
        .tabViewStyle(.sidebarAdaptable)
        .tabViewCustomization($customization)
    }
}
```

Each customizable tab needs a **`.customizationID()`**. It's separate from the selection `value:`. Keep it **the same across app versions**, or users lose their saved setup.

Some tabs can start **hidden**, for the user to add if they want:

```swift
Tab("Downloads", systemImage: "arrow.down.circle", value: .downloads) {
    DownloadsView()
}
.customizationID("downloads")
.defaultVisibility(.hidden, for: .tabBar)
```

---

## 27.11 Sheets with `.sheet()` 🟢

A **sheet** slides up from the bottom for a **focused task**, like creating a new item. When it closes, the user is back where they were. You show it by setting **state**:

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
```

When the sheet's content **depends on an item**, use **`.sheet(item:)`**. It shows when the value is set, and passes it in:

```swift
@State private var editingItem: Item?      // nil = no sheet

List(items) { item in
    Button(item.title) { editingItem = item }
}
.sheet(item: $editingItem) { item in       // Item must be Identifiable
    EditItemView(item: item)
}
```

With `isPresented:` you'd need **two** pieces of state (a `Bool` **and** the item), which can get **out of sync**. With `item:`, there's **one**.

Run code when the sheet closes with **`onDismiss:`**:

```swift
.sheet(isPresented: $isShowingSheet, onDismiss: reloadData) {
    AddItemView()
}
```

To stop **swipe-down** closing (for example, with unsaved changes):

```swift
AddItemView()
    .interactiveDismissDisabled(hasUnsavedChanges)
```

---

## 27.12 Presentation Detents 🟢

**`.presentationDetents()`** sets the **heights** a sheet can have. With several, the user **drags** between them, like the Maps bottom sheet:

```swift
.sheet(isPresented: $isShowingSheet) {
    AddItemView()
        .presentationDetents([.medium, .large])   // drag between half and full height
}

.sheet(isPresented: $isShowingSheet) {
    QuickActionView()
        .presentationDetents([.height(200)])      // fixed 200 points
}

.sheet(isPresented: $isShowingSheet) {
    FiltersView()
        .presentationDetents([.fraction(0.3), .large])   // 30% of the screen, or full
}
```

Without detents, a sheet is **full height** (`.large`) on iPhone.

More options for a **Maps-style** sheet:

```swift
@State private var detent: PresentationDetent = .fraction(0.2)

MapView()
    .sheet(isPresented: .constant(true)) {
        PlacesList()
            .presentationDetents([.fraction(0.2), .medium, .large], selection: $detent)
            .presentationDragIndicator(.visible)                                 // the small grab bar
            .presentationBackgroundInteraction(.enabled(upThrough: .medium))     // map stays usable behind
            .interactiveDismissDisabled()                                        // always on screen
    }
```

With `selection:`, you can **read** the current height and **change** it from code.

---

## 27.13 `.presentationBackground()` and `.presentationSizing()` 🟡

**`.presentationBackground()`** changes the sheet's **background**: a color, a material (blur), or even clear. **`.presentationSizing()`** (iOS 18) picks a **size style**, which matters mostly on **iPad and Mac**, where sheets don't fill the screen:

```swift
.sheet(isPresented: $isShowingSheet) {
    QuickActionView()
        .presentationBackground(.thinMaterial)   // see-through and blurred
        .presentationSizing(.form)               // the standard form size on iPad/Mac
}
```

| Sizing | Look on iPad and Mac |
|---|---|
| `.automatic` | The system default |
| `.form` | A medium, form-sized panel |
| `.page` | A larger, page-sized panel |
| `.fitted` | Sized to fit the content |

Other look-and-feel modifiers you can combine:

```swift
.presentationCornerRadius(24)
.presentationContentInteraction(.scrolls)   // a scroll inside scrolls first, before resizing the sheet
```

Use these for sheets that should feel like a **floating panel**. For normal sheets, the **defaults** are usually best.

---

## 27.14 Full Screen Covers 🟢

**`.fullScreenCover()`** works like `.sheet()`, but covers the **whole screen**. Nothing shows behind it, and there's **no swipe-down** to close. Use it for flows that **must be finished**, like onboarding or sign-in:

```swift
.fullScreenCover(isPresented: $isShowingOnboarding) {
    OnboardingView()
}

struct OnboardingView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack {
            Text("Welcome!")
            Button("Get Started") { dismiss() }   // you MUST give a way out
        }
    }
}
```

| | `.sheet()` | `.fullScreenCover()` |
|---|---|---|
| Covers | Part of the screen (on iPhone, the old screen peeks out at the top) | The whole screen |
| Swipe down to close | ✅ | ❌ |
| Use for | Short tasks: add, edit, share | Flows the user must complete |

If you only want to **block swipe-down** on a sheet, use `.interactiveDismissDisabled()` instead (27.11).

---

## 27.15 Popovers 🟢

A **popover** is a small floating panel with an **arrow** that points to the button that opened it. On **iPad and Mac**, it's a real popover. On **iPhone**, there isn't room, so it **becomes a sheet** automatically:

```swift
@State private var isShowingPopover = false

Button("Info", systemImage: "info.circle") {
    isShowingPopover = true
}
.popover(isPresented: $isShowingPopover) {
    Text("Additional details")
        .padding()
}
```

You write **one** `.popover()`, and the system picks the right style for the device. It's the same "one declaration, right look" idea as split views and adaptable tabs.

To keep a **real popover** on iPhone too (good for small tips), use **`.presentationCompactAdaptation`**:

```swift
.popover(isPresented: $isShowingPopover) {
    Text("Tap to copy the link")
        .padding()
        .presentationCompactAdaptation(.popover)   // a popover on iPhone, not a sheet
}
```

---

## 27.16 Alerts 🟢

An **alert** is a small **centered box** with a title, an optional message, and buttons. It **blocks** the app until the user answers. Use it for **important** questions and **errors**:

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

When the alert depends on **which item**, pass it with **`presenting:`**. The item is handed to your buttons and message:

```swift
@State private var itemToDelete: Item?

.alert(
    "Delete \(itemToDelete?.title ?? "")?",
    isPresented: Binding(
        get: { itemToDelete != nil },
        set: { if !$0 { itemToDelete = nil } }
    ),
    presenting: itemToDelete
) { item in
    Button("Delete", role: .destructive) { delete(item) }
} message: { item in
    Text("\"\(item.title)\" will be removed from all devices.")
}
```

Alerts can also hold a **text field**, for quick input:

```swift
.alert("Rename", isPresented: $isRenaming) {
    TextField("Name", text: $newName)
    Button("Save") { rename(to: newName) }
    Button("Cancel", role: .cancel) { }
}
```

The **older** form, `.alert(item:) { Alert(...) }`, is deprecated. You'll still see it in old code.

---

## 27.17 Confirmation Dialogs 🟢

A **confirmation dialog** shows a **list of actions**. On iPhone it appears near the **bottom** (or near the button that opened it); on iPad it's shown as a **popover**. It's the SwiftUI version of an **action sheet**:

```swift
.confirmationDialog("Choose an action", isPresented: $isShowingActions, titleVisibility: .visible) {
    Button("Share") { share() }
    Button("Duplicate") { duplicate() }
    Button("Delete", role: .destructive) { delete() }
    Button("Cancel", role: .cancel) { }
} message: {
    Text("What would you like to do with this item?")
}
```

| Use | When |
|---|---|
| `.alert()` | A **yes/no** question, or an **error** the user must read |
| `.confirmationDialog()` | **Several** actions to pick from, or confirming an action the user just started ("Discard draft?") |

A dialog can be **dismissed by tapping outside**, so it shouldn't be the only way to handle an important error.

---

## 27.18 `@Environment(\.dismiss)` 🟢

**`@Environment(\.dismiss)`** lets a presented view **close itself**: a sheet, a full screen cover, a popover, or a pushed screen. No binding from the parent is needed:

```swift
struct AddItemView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                // ... fields ...
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveItem()
                        dismiss()     // closes the sheet
                    }
                }
            }
        }
    }
}
```

It's better than passing an `isPresented` **binding** down just so the child can set it to `false`. `dismiss()` works **the same** for every presentation style, and the child doesn't need to know **how** it was shown.

⚠️ Read `dismiss` **inside the presented view**. If you read it in the **parent** and call it there, it closes the **parent** (for example, pops the parent screen), not the sheet.

Related: **`@Environment(\.isPresented)`** tells a view whether it's currently presented.

---

## 27.19 Toolbars and `ToolbarItem` Placements 🟢

**`.toolbar`** adds buttons to the **navigation bar** or the **bottom bar**. Each **`ToolbarItem`**'s **`placement:`** says **where** it goes:

```swift
.toolbar {
    ToolbarItem(placement: .topBarLeading) {
        Button("Cancel") { dismiss() }
    }
    ToolbarItem(placement: .topBarTrailing) {
        Button("Save") { save() }
    }
    ToolbarItem(placement: .bottomBar) {
        Button("Add", systemImage: "plus") { addItem() }
    }
}
```

There are two kinds of placement:

| Kind | Examples | Meaning |
|---|---|---|
| **Position** | `.topBarLeading`, `.topBarTrailing`, `.bottomBar`, `.principal` | An exact spot |
| **Meaning** | `.confirmationAction`, `.cancellationAction`, `.primaryAction` | What the button **does**; the system picks the right spot for each platform |

**Meaning-based** placements are best for sheets and forms. On iPhone, "Save" goes top-right; on Mac, it goes where Mac users expect it.

`.navigationBarLeading` and `.navigationBarTrailing` are the **older names** (deprecated) for `.topBarLeading` and `.topBarTrailing`.

Group several items, and space them:

```swift
.toolbar {
    ToolbarItemGroup(placement: .bottomBar) {
        Button("Back", systemImage: "chevron.left") { }
        Spacer()
        Button("Share", systemImage: "square.and.arrow.up") { }
    }
    ToolbarSpacer(.fixed, placement: .topBarTrailing)   // a gap between glass groups (iOS 26)
}
```

---

## 27.20 Toolbar Visibility Priority and Auto-Minimizing (iOS 27) 🔴

When a bar has **too many items** for its width (a narrow iPad window, or large Dynamic Type), something must give. **Visibility priority** says **which items shrink or hide first**. It's the toolbar version of `.layoutPriority()` (24.10).

```swift
.toolbar {
    ToolbarItem(placement: .topBarTrailing) {
        Button("Share", systemImage: "square.and.arrow.up") { share() }
            .toolbarItemVisibilityPriority(.high)   // kept visible the longest
    }
    ToolbarItem(placement: .topBarTrailing) {
        Button("More Options", systemImage: "ellipsis.circle") { }
            .toolbarItemVisibilityPriority(.low)    // minimized or hidden first
    }
}
```

⚠️ These are **new APIs**, from the iOS 27 SDK in this lesson's title. Names and details can change between betas, so **check the current SDK documentation** before you depend on them.

Bars that **minimize** to give content more room already exist. The iOS 26 **tab bar** can shrink while the user scrolls down:

```swift
TabView { /* ... */ }
    .tabBarMinimizeBehavior(.onScrollDown)    // tab bar shrinks while reading, returns on scroll up
```

Whatever the API, the design rule is the same: put the **most important** action where it **always fits**, and expect the less important ones to **move or hide** on small screens.

---

## 27.21 Toolbar Overflow Menus and Pinned Placements (iOS 27) 🔴

Items that don't fit don't have to **disappear**. They can move into an **overflow menu** (the "•••" button). And an item can be **pinned**, so it **never** moves there:

```swift
.toolbar {
    ToolbarItem(placement: .topBarTrailing) {
        Button("Search", systemImage: "magnifyingglass") { }
            .toolbarItemPinning(.pinned)    // always visible; never goes into overflow
    }
    ToolbarItem(placement: .topBarTrailing) {
        Button("Filter", systemImage: "line.3.horizontal.decrease.circle") { }
        // may move into the overflow menu when space is short
    }
}
```

⚠️ As in 27.20, the pinning API is **new** in the iOS 27 SDK. Check the current docs for the exact names.

An overflow menu has existed on iPad since **iPadOS 16**, with **customizable** toolbars. **Secondary actions** go into it when there's no room:

```swift
.toolbar(id: "editor") {
    ToolbarItem(id: "bold", placement: .secondaryAction) {
        Button("Bold", systemImage: "bold") { }
    }
    ToolbarItem(id: "italic", placement: .secondaryAction) {
        Button("Italic", systemImage: "italic") { }
    }
}
.toolbarRole(.editor)    // an editor-style bar: title on the leading side, actions in the middle
```

| Item kind | Behavior when space is short |
|---|---|
| Pinned | Always stays in the bar |
| Normal | May move into the overflow menu |
| Low priority | Minimized or moved first |

Pin only **one or two** key actions (like Search or Compose). If everything is pinned, nothing can move, and the bar gets crowded again.

---

## 27.22 Context Menus 🟢

**`.contextMenu`** adds a menu that opens on **long press** (or right-click on Mac and iPad with a mouse). It's great for row actions, next to swipe actions (26.8):

```swift
Text(item.title)
    .contextMenu {
        Button("Edit", systemImage: "pencil") { edit(item) }
        Button("Duplicate", systemImage: "doc.on.doc") { duplicate(item) }
        Divider()
        Button("Delete", systemImage: "trash", role: .destructive) { delete(item) }
    }
```

Add a **`preview:`** to show a **bigger preview** of the content above the menu, like Photos and Safari links do:

```swift
PhotoThumbnail(photo: photo)
    .contextMenu {
        Button("Share", systemImage: "square.and.arrow.up") { share(photo) }
        Button("Favorite", systemImage: "heart") { favorite(photo) }
    } preview: {
        Image(photo.name)
            .resizable()
            .scaledToFit()
            .frame(width: 300)          // a large view of the photo
    }
```

Menus can have **submenus** and **sections**:

```swift
.contextMenu {
    Menu("Move to", systemImage: "folder") {
        ForEach(folders) { folder in
            Button(folder.name) { move(item, to: folder) }
        }
    }
    Section("Danger Zone") {
        Button("Delete", role: .destructive) { delete(item) }
    }
}
```

On a **`List` with selection**, `.contextMenu(forSelectionType:)` gives you **all selected rows** at once, and a primary action for double-click on Mac.

---

## 27.23 Zoom Navigation Transitions 🟡

The **zoom** transition (iOS 18) makes a **thumbnail grow** into the detail screen, like in Photos. You mark the **source** with **`.matchedTransitionSource()`**, and the **destination** with **`.navigationTransition(.zoom(...))`**. Both use the **same ID** and **namespace**:

```swift
struct PhotoGrid: View {
    @Namespace private var namespace
    let photos: [Photo]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))]) {
                    ForEach(photos) { photo in
                        NavigationLink(value: photo) {
                            PhotoThumbnail(photo: photo)
                                .matchedTransitionSource(id: photo.id, in: namespace)   // where it zooms from
                        }
                    }
                }
            }
            .navigationDestination(for: Photo.self) { photo in
                PhotoDetailView(photo: photo)
                    .navigationTransition(.zoom(sourceID: photo.id, in: namespace))     // zooms in from the source
            }
        }
    }
}
```

When the user goes **back**, it zooms **back into** the thumbnail. Users can also **swipe down** or **pinch** to close it.

It works for **sheets** and **full screen covers** too:

```swift
.fullScreenCover(item: $selectedPhoto) { photo in
    PhotoDetailView(photo: photo)
        .navigationTransition(.zoom(sourceID: photo.id, in: namespace))
}
```

It's related to **`matchedGeometryEffect`** (29.8–29.9), but built **for navigation**. You get the polished effect without writing the animation yourself.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `NavigationStack`/`NavigationLink` | Push screens; inline links are fine for a few static links |
| Navigation titles | Large at the root, inline for pushed screens; large shrinks on scroll |
| Value-based navigation | Links carry values; `navigationDestination(for:)` maps types to screens |
| `NavigationPath` | Control the stack from code; an array or a router for bigger apps |
| Deep linking | Parse the URL into routes, then set the path |
| `NavigationSplitView` (2/3-column) | Sidebar and detail side by side; collapses on iPhone |
| `TabView`/`Tab` API | Value-based tabs with an enum; one `NavigationStack` per tab |
| Sidebar-adaptable tabs | Tab bar or sidebar from one declaration; `TabSection` groups |
| Tab customization | `TabViewCustomization` in `@AppStorage`, with stable `customizationID`s |
| `.sheet()` | Short modal tasks; `item:` keeps one source of truth |
| Presentation detents | Sheet heights, with drag between them |
| `.presentationBackground()`/`.presentationSizing()` | Sheet background and size style (iPad/Mac) |
| Full screen covers | Whole screen, no swipe-down; give your own way out |
| Popovers | Arrow panel on iPad/Mac; a sheet on iPhone unless told otherwise |
| Alerts | Centered, blocking yes/no or error; `presenting:` for items |
| Confirmation dialogs | A list of actions to pick from |
| `@Environment(\.dismiss)` | A presented view closes itself; read it inside that view |
| Toolbars/`ToolbarItem` | Position or meaning-based placements; `topBar…` replaces `navigationBar…` |
| Toolbar visibility priority | Decides what shrinks first; new API, check the SDK |
| Toolbar overflow/pinning | Overflow menu for extras; pin only key actions |
| Context menus | Long-press actions, with an optional big preview |
| Zoom navigation transitions | A thumbnail zooms into its detail screen |
