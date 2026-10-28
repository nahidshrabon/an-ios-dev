**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Most apps are lists: messages, settings, photos, search results. SwiftUI gives you **`List`** for row-based screens (like `UITableView`), and **`ScrollView`** with **lazy stacks and grids** for custom layouts (like `UICollectionView`). This section covers both, plus search, refresh, scrolling control, and speed.

The examples use this small model. It's called `Todo`, not `Task`, so it doesn't clash with Swift's `Task` (17):

```swift
struct Todo: Identifiable, Hashable {
    let id = UUID()
    var title: String
    var isDone = false
}
```

---

## 26.1 `List` with Static Rows 🟢

A **`List`** is a scrolling container of **rows**. For a few fixed rows, write them directly, like a stack:

```swift
List {
    Text("Row One")
    Text("Row Two")
    Text("Row Three")
}
```

Compared to a `VStack`, a `List` gives you a lot **for free**:

| Feature | `VStack` | `List` |
|---|---|---|
| Scrolling | ❌ (needs a `ScrollView`) | ✅ |
| Row separators and insets | ❌ | ✅ |
| Tap highlight, selection | ❌ | ✅ |
| Swipe actions, delete, reorder | ❌ | ✅ |
| Only builds visible rows | ❌ | ✅ |

Rows can hold **any view**, not just text:

```swift
List {
    Label("Wi-Fi", systemImage: "wifi")
    Toggle("Airplane Mode", isOn: $airplaneMode)
    NavigationLink("General") { GeneralSettingsView() }
}
```

---

## 26.2 `List` with `ForEach` over Data 🟢

For rows that come from **data**, use **`ForEach`** inside a `List`. It makes one row per element:

```swift
struct TodoListView: View {
    let todos: [Todo]

    var body: some View {
        List {
            ForEach(todos) { todo in
                Text(todo.title)
            }
        }
    }
}
```

When the whole list is **one** data source, there's a short form:

```swift
List(todos) { todo in
    Text(todo.title)
}
```

You need the **`ForEach`** form when you **mix** things: static rows plus data, several data sources, sections (26.4), or delete and move (26.6, 26.7):

```swift
List {
    Text("Header row")              // static
    ForEach(todos) { todo in        // dynamic
        TodoRow(todo: todo)
    }
    Button("Add Todo") { addTodo() }   // static again
}
```

Give each row its **own small view** (`TodoRow`). It keeps `body` short, and SwiftUI can update rows one by one.

---

## 26.3 `Identifiable` and Row Identity 🟢

`ForEach` needs to know **which row is which**. Each element needs a **stable, unique ID**. You get it in one of two ways:

```swift
// 1. Conform to Identifiable (7.10): ForEach(todos) just works
struct Todo: Identifiable {
    let id = UUID()
    var title: String
}

// 2. Give a key path to a unique property
ForEach(users, id: \.email) { user in
    Text(user.name)
}
```

The ID lets SwiftUI understand changes. When a row moves, it's "the **same row**, moved", not "one row removed and another added". So animations look right, and each row keeps its `@State` (25.14).

⚠️ The ID must be **unique** and **stable**. Common mistakes:

```swift
// ❌ Titles can repeat: two "Buy milk" rows confuse SwiftUI
ForEach(todos, id: \.title) { ... }

// ❌ A new ID on every redraw: every row is "new" each time, and state is lost
ForEach(todos.map { RowModel(id: UUID(), todo: $0) }) { ... }

// ⚠️ Index-based: OK for a fixed list, wrong when rows are inserted or removed
ForEach(todos.indices, id: \.self) { index in ... }
```

The best ID is one that comes **from your data**, like a database or server ID.

---

## 26.4 List Sections, Headers, and Footers 🟢

A **`Section`** groups rows, with an optional **header** and **footer**:

```swift
List {
    Section("Fruits") {
        Text("Apple")
        Text("Banana")
    }
    Section {
        Text("Carrot")
        Text("Potato")
    } header: {
        Text("Vegetables")
    } footer: {
        Text("Locally sourced")
    }
}
```

The short form `Section("Title")` is for a **plain text header**. Use the `header:`/`footer:` closures when you need **more**, like an icon or a button:

```swift
Section {
    ForEach(favorites) { FavoriteRow(item: $0) }
} header: {
    HStack {
        Label("Favorites", systemImage: "star.fill")
        Spacer()
        Button("Edit") { isEditing.toggle() }
            .font(.caption)
    }
}
```

Sections often come **from data**, for example grouping todos:

```swift
List {
    Section("To Do") {
        ForEach(todos.filter { !$0.isDone }) { TodoRow(todo: $0) }
    }
    Section("Done") {
        ForEach(todos.filter { $0.isDone }) { TodoRow(todo: $0) }
    }
}
```

---

## 26.5 List Styles 🟢

**`.listStyle()`** changes how a list **looks**. The data and behavior stay the same:

```swift
List { /* ... */ }
    .listStyle(.plain)          // simple rows, edge to edge
List { /* ... */ }
    .listStyle(.insetGrouped)   // rounded cards on a gray background, like the Settings app
List { /* ... */ }
    .listStyle(.sidebar)        // for the sidebar of a NavigationSplitView (27.6)
```

| Style | Good for |
|---|---|
| `.plain` | Content lists: messages, feeds, search results |
| `.insetGrouped` | Settings and forms |
| `.grouped` | Grouped sections, full width |
| `.sidebar` | Navigation in a split view (iPad, Mac) |

To use your **own background**, hide the default one first:

```swift
List { /* ... */ }
    .scrollContentBackground(.hidden)
    .background(.indigo.gradient)
```

---

## 26.6 Swipe to Delete with `onDelete` 🟢

Add **`.onDelete`** to a `ForEach` to get the standard **swipe to delete**. You receive an **`IndexSet`**: the positions of the rows to remove.

```swift
struct TodoListView: View {
    @State private var todos: [Todo] = [/* ... */]

    var body: some View {
        List {
            ForEach(todos) { todo in
                Text(todo.title)
            }
            .onDelete { indexSet in
                todos.remove(atOffsets: indexSet)
            }
        }
    }
}
```

Two rules:

- It goes on the **`ForEach`**, not on the `List` or a static row.
- The indexes refer to the array **given to that `ForEach`**.

The second rule matters when you **filter**. The indexes point into the **filtered** array, not the original one:

```swift
let visible = todos.filter { !$0.isDone }

ForEach(visible) { TodoRow(todo: $0) }
    .onDelete { indexSet in
        // ❌ todos.remove(atOffsets: indexSet) deletes the wrong rows
        let ids = indexSet.map { visible[$0].id }      // ✅ map to IDs first
        todos.removeAll { ids.contains($0.id) }
    }
```

---

## 26.7 Reordering with `onMove` and `EditButton` 🟢

**`.onMove`** lets users **drag rows** to a new position. You get the source indexes and the destination, and apply them with `move(fromOffsets:toOffset:)`:

```swift
List {
    ForEach(todos) { todo in
        Text(todo.title)
    }
    .onDelete { todos.remove(atOffsets: $0) }
    .onMove { source, destination in
        todos.move(fromOffsets: source, toOffset: destination)
    }
}
.toolbar {
    EditButton()   // switches the list into and out of edit mode
}
```

**`EditButton`** is a ready-made "Edit / Done" button. In **edit mode**, the list shows **delete buttons** and **reorder handles** on each row.

You can also control edit mode **yourself**:

```swift
@State private var editMode: EditMode = .inactive

List { /* ... */ }
    .environment(\.editMode, $editMode)

Button(editMode.isEditing ? "Done" : "Reorder") {
    withAnimation {
        editMode = editMode.isEditing ? .inactive : .active
    }
}
```

If you save the order (for example, in a database), store a **sort index** on each item and update it after the move.

---

## 26.8 Custom Swipe Actions 🟢

**`.swipeActions()`** adds your **own buttons** behind a row. You choose the **edge** (leading or trailing), the **color**, and the **icon**:

```swift
ForEach(todos) { todo in
    Text(todo.title)
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                delete(todo)
            } label: {
                Label("Delete", systemImage: "trash")
            }
            Button {
                archive(todo)
            } label: {
                Label("Archive", systemImage: "archivebox")
            }
            .tint(.orange)
        }
        .swipeActions(edge: .leading) {
            Button {
                toggleDone(todo)
            } label: {
                Label("Done", systemImage: "checkmark")
            }
            .tint(.green)
        }
}
```

Good to know:

- **`role: .destructive`** makes the button **red** (28.11).
- **`.tint()`** colors other buttons.
- The **first** button is the one a **full swipe** triggers. Turn that off with `allowsFullSwipe: false` for actions that need care.
- Once you add **trailing** swipe actions, the default `onDelete` swipe is **replaced**. Add your own delete button, like above.

Add a **context menu** too, so the same actions work with a long press (and with a mouse on iPad and Mac):

```swift
Text(todo.title)
    .contextMenu {
        Button("Archive", systemImage: "archivebox") { archive(todo) }
        Button("Delete", systemImage: "trash", role: .destructive) { delete(todo) }
    }
```

---

## 26.9 Row Separators and Insets 🟡

Modifiers **on a row** control its **separator** (the thin line), its **insets** (inner padding), and its **background**:

```swift
ForEach(todos) { todo in
    Text(todo.title)
        .listRowSeparator(.hidden)            // no line under this row
        .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))   // custom padding
        .listRowBackground(Color.yellow.opacity(0.2))                            // row background
}

List { /* ... */ }
    .listRowSeparatorTint(.blue)              // separator color for the list
    .listRowSpacing(8)                        // space between rows
```

A common use is a **card-style feed** that doesn't look like a table:

```swift
List(posts) { post in
    PostCard(post: post)
        .listRowSeparator(.hidden)
        .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
        .listRowBackground(Color.clear)
}
.listStyle(.plain)
```

You still get the `List` features (lazy loading, swipe actions, refresh) with a fully custom look.

---

## 26.10 Selection in Lists, Single and Multiple 🟡

Pass a **`selection:`** binding to track selected rows. Use an **optional** for **one** row, or a **`Set`** for **many**:

```swift
struct TodoListView: View {
    @State private var selectedTodo: Todo.ID?

    var body: some View {
        List(todos, selection: $selectedTodo) { todo in
            Text(todo.title)
        }
    }
}

struct MultiSelectView: View {
    @State private var selectedTodos: Set<Todo.ID> = []

    var body: some View {
        List(todos, selection: $selectedTodos) { todo in
            Text(todo.title)
        }
        .toolbar {
            EditButton()   // on iPhone, multi-select shows checkmarks in edit mode
        }
    }
}
```

Selection uses the row's **ID**, not the element itself. That's why `selectedTodo` is a **`Todo.ID?`**, not a `Todo?`. The ID stays **stable** when the array changes, is sorted, or the item is edited. A stored copy of the item would go out of date.

To get the item back from the ID:

```swift
var selected: Todo? {
    todos.first { $0.id == selectedTodo }
}
```

Selection is the base of **split views** (27.6): the sidebar list's selection decides what the detail column shows. On iPad and Mac, multi-select also works with **Shift** and **Command** clicks.

---

## 26.11 `.searchable()` and Search Scopes 🟡

**`.searchable()`** adds the system **search bar**. It's usually placed on a `List` inside a `NavigationStack`. **Search scopes** add buttons to narrow the search:

```swift
struct SearchableListView: View {
    @State private var searchText = ""
    @State private var scope: SearchScope = .all
    let todos: [Todo]

    enum SearchScope: String, CaseIterable {
        case all = "All", active = "Active", completed = "Completed"
    }

    var filteredTodos: [Todo] {
        todos.filter { todo in
            let matchesText = searchText.isEmpty
                || todo.title.localizedCaseInsensitiveContains(searchText)
            let matchesScope = switch scope {
            case .all: true
            case .active: !todo.isDone
            case .completed: todo.isDone
            }
            return matchesText && matchesScope
        }
    }

    var body: some View {
        NavigationStack {
            List(filteredTodos) { todo in
                Text(todo.title)
            }
            .navigationTitle("Todos")
            .searchable(text: $searchText, prompt: "Search todos")
            .searchScopes($scope) {
                ForEach(SearchScope.allCases, id: \.self) { scope in
                    Text(scope.rawValue).tag(scope)
                }
            }
        }
    }
}
```

`.searchable()` only gives you the **UI** and the **text**. **Filtering is your job** (`filteredTodos`). It's the same split as `onDelete`: SwiftUI handles the gesture, you change the data.

Useful extras:

```swift
.searchable(text: $searchText)
.searchSuggestions {
    ForEach(recentSearches, id: \.self) { term in
        Text(term).searchCompletion(term)     // tap to fill the search field
    }
}
.overlay {
    if filteredTodos.isEmpty && !searchText.isEmpty {
        ContentUnavailableView.search(text: searchText)   // the standard "No Results" screen
    }
}
```

For **server** search, don't send a request on every keystroke. Wait for a short pause first (`debounce`, 21.15), or use `.task(id: searchText)` with a small sleep:

```swift
.task(id: searchText) {
    try? await Task.sleep(for: .milliseconds(300))   // cancelled if the text changes again
    guard !Task.isCancelled else { return }
    results = await api.search(searchText)
}
```

---

## 26.12 `.refreshable()` for Pull to Refresh 🟢

**`.refreshable()`** adds **pull to refresh**. Your closure is **`async`**. The spinner shows **until the closure returns**:

```swift
struct TodoListView: View {
    @State private var todos: [Todo] = []

    var body: some View {
        List(todos) { todo in
            Text(todo.title)
        }
        .refreshable {
            todos = await fetchLatestTodos()   // the spinner stays until this finishes
        }
    }
}
```

No manual spinner code. In UIKit, you had to call `beginRefreshing()` and `endRefreshing()` on a `UIRefreshControl` yourself.

⚠️ **Await** the work. Don't start a separate `Task` inside, or the spinner disappears **at once**:

```swift
.refreshable {
    Task { await model.reload() }   // ❌ returns immediately; the spinner hides too early
}

.refreshable {
    await model.reload()            // ✅ the spinner waits for the reload
}
```

Handle errors **inside** the closure, since it can't throw:

```swift
.refreshable {
    do {
        todos = try await api.fetchTodos()
    } catch {
        errorMessage = error.localizedDescription
    }
}
```

---

## 26.13 `ScrollView` and `LazyVStack` 🟢

**`ScrollView`** scrolls **any content**, not only rows. Inside it, a **`LazyVStack`** creates its children **only when they're about to appear**. A plain `VStack` creates **all** of them at once.

```swift
ScrollView {
    LazyVStack(spacing: 12) {
        ForEach(items) { item in
            ItemRow(item: item)
        }
    }
    .padding()
}

ScrollView(.horizontal) {
    LazyHStack {
        ForEach(items) { item in
            ItemCard(item: item)
        }
    }
}
.scrollIndicators(.hidden)
```

It's like `.lazy` sequences (3.18). With 1,000 items, a `VStack` builds 1,000 rows before showing anything. A `LazyVStack` builds the ~10 that fit on screen, then more as you scroll.

| Few items (under ~50) | Many items |
|---|---|
| `VStack` in a `ScrollView` is fine | `LazyVStack`, `LazyVGrid`, or `List` |

Lazy stacks can **pin** section headers while scrolling:

```swift
ScrollView {
    LazyVStack(pinnedViews: [.sectionHeaders]) {
        ForEach(groups) { group in
            Section {
                ForEach(group.items) { ItemRow(item: $0) }
            } header: {
                Text(group.title)
                    .font(.headline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.bar)
            }
        }
    }
}
```

**Infinite scroll** is easy: load more when the **last row appears**:

```swift
ForEach(items) { item in
    ItemRow(item: item)
        .onAppear {
            if item.id == items.last?.id {
                Task { await model.loadNextPage() }
            }
        }
}
```

---

## 26.14 `LazyVGrid` and `GridItem` Sizing 🟡

**`LazyVGrid`** places items in a **grid** and, like `LazyVStack`, creates cells **lazily**. Each **`GridItem`** describes one **column**:

```swift
let columns = [
    GridItem(.flexible()),     // three columns that share the width equally
    GridItem(.flexible()),
    GridItem(.flexible())
]

ScrollView {
    LazyVGrid(columns: columns, spacing: 16) {
        ForEach(items) { item in
            ItemThumbnail(item: item)
        }
    }
}
```

There are **three** kinds of column:

```swift
GridItem(.fixed(80))                  // exactly 80 points wide
GridItem(.flexible(minimum: 60))      // shares the space, but at least 60
GridItem(.adaptive(minimum: 100))     // AS MANY columns as fit, each at least 100 wide
```

**`.adaptive`** is the go-to for **photo grids**. One `GridItem` can become 3 columns on iPhone and 8 on iPad, with no extra code:

```swift
let adaptiveColumns = [GridItem(.adaptive(minimum: 100), spacing: 2)]

ScrollView {
    LazyVGrid(columns: adaptiveColumns, spacing: 2) {
        ForEach(photos) { photo in
            PhotoCell(photo: photo)
                .aspectRatio(1, contentMode: .fill)   // square cells (24.16)
        }
    }
}
```

| Column | Count | Width |
|---|---|---|
| `.fixed(80)` | One | Exactly 80 |
| `.flexible()` | One | A share of the free space |
| `.adaptive(minimum: 100)` | As many as fit | At least 100 each |

For a **horizontal** grid, use **`LazyHGrid`** with `rows:` instead of `columns:`.

---

## 26.15 `Grid` for Fixed Two-Dimensional Layouts 🟡

**`Grid`** is for **small**, fixed layouts where **rows and columns line up** with each other, like a form or a small table. Unlike `LazyVGrid`, it is **not lazy**, and its columns get **one width** across **all rows**:

```swift
Grid(alignment: .leading) {
    GridRow {
        Text("Name:")
        Text("Alex")
    }
    GridRow {
        Text("Email:")
        Text("alex@example.com")
    }
}
// The second column starts at the same x in every row,
// even though "Name:" and "Email:" have different widths
```

A small **table** with a header and a line:

```swift
Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 8) {
    GridRow {
        Text("Item").bold()
        Text("Qty").bold()
        Text("Price").bold()
            .gridColumnAlignment(.trailing)    // the whole column aligns trailing
    }
    Divider()                                  // outside a GridRow: spans all columns
    ForEach(lines) { line in
        GridRow {
            Text(line.name)
            Text("\(line.quantity)")
            Text(line.price, format: .currency(code: "USD"))
        }
    }
    GridRow {
        Text("Total").bold()
            .gridCellColumns(2)                // this cell spans two columns
        Text(total, format: .currency(code: "USD")).bold()
    }
}
```

| | `Grid` | `LazyVGrid` |
|---|---|---|
| Lazy | ❌ builds all cells | ✅ builds visible cells |
| Columns line up across rows | ✅ | Only with fixed column specs |
| Best for | Forms, small tables | Long, scrolling collections |

---

## 26.16 `.scrollPosition()` and Programmatic Scrolling 🟡

**`.scrollPosition(id:)`** lets you **read** and **set** which item a scroll view is showing. It uses the item's **ID**, not a pixel offset:

```swift
struct ScrollableList: View {
    @State private var scrolledID: Todo.ID?

    var body: some View {
        VStack {
            ScrollView {
                LazyVStack {
                    ForEach(todos) { todo in
                        TodoRow(todo: todo)
                    }
                }
                .scrollTargetLayout()          // tells SwiftUI which views to track
            }
            .scrollPosition(id: $scrolledID)

            Button("Scroll to first") {
                withAnimation {
                    scrolledID = todos.first?.id   // scrolls to that item
                }
            }
        }
    }
}
```

Using an **ID** is safer than a raw offset. If rows are added, removed, or resized, the ID still points at the **right item**. A pixel offset would point at the wrong place.

The **`ScrollPosition`** type (iOS 18) adds more ways to scroll: to an **edge**, an **ID**, or a **point**:

```swift
@State private var position = ScrollPosition(edge: .top)

ScrollView {
    LazyVStack {
        ForEach(messages) { MessageRow(message: $0) }
    }
}
.scrollPosition($position)
.onChange(of: messages.count) {
    withAnimation { position.scrollTo(edge: .bottom) }   // jump to the newest message
}
```

For a **chat** screen that starts at the bottom, there's also `.defaultScrollAnchor(.bottom)`.

In older code, you'll see **`ScrollViewReader`** with `proxy.scrollTo(id)`. It still works, but the newer APIs are simpler.

---

## 26.17 `.scrollTargetBehavior()` and Paging 🟡

**`.scrollTargetBehavior()`** decides where scrolling **stops** (snaps) when the user lifts their finger:

- **`.paging`**: stops on **full pages**, one screen width at a time.
- **`.viewAligned`**: stops so that a **child view** lines up with the edge.

```swift
ScrollView(.horizontal) {
    LazyHStack {
        ForEach(items) { item in
            ItemCard(item: item)
                .containerRelativeFrame(.horizontal)   // each card is one screen wide (24.21)
        }
    }
    .scrollTargetLayout()
}
.scrollTargetBehavior(.viewAligned)
```

**`.scrollTargetLayout()`** marks the container whose **children** are the snap targets. **Without it**, `.viewAligned` doesn't know where the item edges are, so it **won't snap**.

A "**peek**" carousel that shows a bit of the next card:

```swift
ScrollView(.horizontal) {
    LazyHStack(spacing: 12) {
        ForEach(cards) { card in
            CardView(card: card)
                .containerRelativeFrame(.horizontal, count: 5, span: 4, spacing: 12)   // 4/5 of the width
        }
    }
    .scrollTargetLayout()
}
.contentMargins(.horizontal, 20, for: .scrollContent)
.scrollTargetBehavior(.viewAligned)
.scrollIndicators(.hidden)
```

| Behavior | Snaps to | Use for |
|---|---|---|
| `.paging` | Full pages (the scroll view's size) | Onboarding pages, full-screen photos |
| `.viewAligned` | Each child view | Cards, carousels, items smaller than the screen |

---

## 26.18 `.onScrollGeometryChange()` 🟡

**`.onScrollGeometryChange()`** watches a scroll view's **geometry**: its offset, content size, and visible size. It's like `.onGeometryChange()` (24.20), but for **scrolling**:

```swift
struct ScrollTrackingView: View {
    @State private var isScrolledPastTop = false

    var body: some View {
        ScrollView {
            content
        }
        .onScrollGeometryChange(for: Bool.self) { geometry in
            geometry.contentOffset.y + geometry.contentInsets.top > 0   // 1. compute a value
        } action: { wasScrolled, isScrolled in
            isScrolledPastTop = isScrolled                               // 2. react when it changes
        }
    }
}
```

The `contentInsets.top` part matters: the offset **starts negative** when there's a navigation bar above, so add the inset back to get "0 at the top".

Return a **small value** (like a `Bool`), so `action` runs only when something **important** changes, not on every pixel of scrolling.

Another common use: **show a "scroll to top" button** after scrolling down a bit:

```swift
.onScrollGeometryChange(for: Bool.self) { geo in
    geo.contentOffset.y > geo.containerSize.height    // scrolled more than one screen
} action: { _, isFar in
    withAnimation { showsScrollToTop = isFar }
}
```

There's a related modifier, **`.onScrollPhaseChange`**, that tells you if the user is **dragging**, the view is **decelerating**, or scrolling is **idle**. It's useful for pausing heavy work while scrolling.

---

## 26.19 `.scrollEdgeEffectStyle()` 🟡

When content scrolls **under** a bar (a navigation bar, toolbar, or tab bar), the system adds an **edge effect** so the bar's content stays readable. It's part of the **Liquid Glass** design (section 32).

**`.scrollEdgeEffectStyle()`** picks the look of that effect for an edge:

```swift
ScrollView {
    content
}
.scrollEdgeEffectStyle(.soft, for: .top)     // a soft fade and blur under the top bar

ScrollView {
    content
}
.scrollEdgeEffectStyle(.hard, for: .bottom)  // a sharper, more solid edge
```

| Style | Look |
|---|---|
| `.automatic` | The system decides (the default) |
| `.soft` | A gentle fade and blur |
| `.hard` | A clearer cut, more like an opaque bar |

This only changes **how it looks** at the edges. It doesn't change scrolling or your data. In most apps, the **default is right**; change it only when a design calls for it.

---

## 26.20 Reordering in Lists, Grids, and Sections (iOS 27) 🔴

Classic `onMove` (26.7) has **limits**: it reorders rows **inside one `ForEach`** in a `List`. It doesn't move rows **between sections**, and it doesn't work in **grids**.

Newer SDKs (the iOS 27 in the title) keep extending built-in reordering beyond flat lists, toward sections and grids. The exact API depends on your SDK and deployment target, so check the current documentation before relying on it.

The approach below works **today**, from iOS 16. It uses **drag and drop** with `Transferable` (57.14). First, make the item transferable:

```swift
import UniformTypeIdentifiers

extension UTType {
    static let todo = UTType(exportedAs: "com.example.todo")   // also declare it in Info.plist
}

struct Todo: Identifiable, Codable, Transferable {
    var id = UUID()
    var title: String
    var isDone = false

    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .todo)
    }
}
```

Then each section **accepts drops** at a position:

```swift
List {
    Section("To Do") {
        ForEach(todoItems) { todo in
            Text(todo.title)
                .draggable(todo)                        // can be picked up
        }
        .dropDestination(for: Todo.self) { dropped, index in
            move(dropped, toDone: false, at: index)     // dropped into "To Do" at this position
        }
    }
    Section("Done") {
        ForEach(doneItems) { todo in
            Text(todo.title)
                .draggable(todo)
        }
        .dropDestination(for: Todo.self) { dropped, index in
            move(dropped, toDone: true, at: index)
        }
    }
}
```

The `move` function updates **your data**: it removes the items from their old place, changes `isDone`, and inserts them at `index`. The same `.draggable` + `.dropDestination` pair works on **grid cells**, for a reorderable photo grid or a **Kanban board**.

---

## 26.21 List Performance: What Makes Scrolling Stutter 🔴

Scrolling **stutters** (drops frames) when the **main thread** is too busy to draw each frame in time (about 8–16 ms). The usual causes:

1. **Heavy work in a row's `body`**: sorting, formatting, image processing.
2. **Not using lazy containers**: a `VStack` with 1,000 rows builds them all.
3. **Images**: decoding big photos on the main thread, again and again.
4. **Unstable IDs**: rows that look "new" every time are rebuilt from scratch.

```swift
// ❌ Expensive work every time body runs (and it runs a lot while scrolling)
struct SlowRow: View {
    let todo: Todo
    var body: some View {
        Text(todo.title)
            .background(expensiveColorComputation())
    }
}

// ✅ Compute once, outside body: in the model, or when the data loads
struct FastRow: View {
    let title: String
    let color: Color          // already computed
    var body: some View {
        Text(title).background(color)
    }
}
```

Other common fixes:

```swift
// ❌ A new formatter on every redraw
Text(DateFormatter().string(from: date))
// ✅ Use the built-in format styles; they're cached for you
Text(date, format: .dateTime.day().month())

// ❌ Filtering inside ForEach: List must build every row to know what's there
ForEach(todos) { todo in
    if !todo.isDone { TodoRow(todo: todo) }
}
// ✅ Filter the data first; one row per element
ForEach(todos.filter { !$0.isDone }) { todo in
    TodoRow(todo: todo)
}

// ✅ Load and shrink images off the main thread, with a cache (69.12)
AsyncImage(url: thumbnailURL)      // ask the server for a small thumbnail, not the full photo
```

How to find the real cause:

- `Self._printChanges()` in a row's `body` shows **how often** it runs, and **why** (25.13).
- **Instruments** (section 69): the **SwiftUI** template, **Time Profiler**, and **Hitches** show what's slow.
- Always test **Release builds** on a **real, older device**. The simulator and Debug builds are not a good guide.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `List` (static/`ForEach`) | Rows with scrolling, styling, and editing for free; `ForEach` for data |
| `Identifiable`/row identity | Stable, unique IDs keep animations and row state correct |
| Sections/headers/footers | Group rows; use closures for rich headers |
| List styles | Change the look only: `.plain`, `.insetGrouped`, `.sidebar` |
| `onDelete`/`onMove` | Swipe to delete and drag to reorder; indexes refer to the `ForEach` data |
| Custom swipe actions | Your own buttons per edge; first one is the full-swipe action |
| Row separators/insets | Hide lines, change padding and backgrounds for custom rows |
| List selection | Tracks IDs: optional for one, `Set` for many |
| `.searchable()` | Gives the search bar; you do the filtering |
| `.refreshable()` | `async` pull to refresh; `await` the work inside |
| `ScrollView`/`LazyVStack` | Lazy stacks build rows only when needed |
| `LazyVGrid`/`GridItem` | `.fixed`, `.flexible`, or `.adaptive` columns |
| `Grid` | Small, eager layouts with columns aligned across rows |
| `.scrollPosition()` | Read and set the scroll position by item ID |
| `.scrollTargetBehavior()` | `.paging` or `.viewAligned` snapping; needs `.scrollTargetLayout()` |
| `.onScrollGeometryChange()` | React to scroll offset changes with a small computed value |
| `.scrollEdgeEffectStyle()` | The look of content scrolling under bars |
| Cross-section/grid reordering | `onMove` is per `ForEach`; drag and drop moves across sections and grids |
| Scrolling performance | Keep `body` light, use lazy containers, stable IDs, and small images |
