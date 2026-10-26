**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

In SwiftUI, the **UI is a function of state**: you change data, and SwiftUI redraws the views that read it. This section covers **where state lives** (who owns it) and **how it flows** (who can read or change it). The main rule: every piece of data should have **one source of truth**.

| Wrapper | Owns the data? | Use for |
|---|---|---|
| `@State` | ✅ Yes | Simple local values, and `@Observable` objects the view creates |
| `@Binding` | ❌ No | Read and write a parent's value |
| `@Bindable` | ❌ No | Make bindings to an `@Observable` object's properties |
| `@Environment` | ❌ No | Values passed down the whole tree |
| `@AppStorage` / `@SceneStorage` | ✅ Yes (saved) | Small values that survive relaunch |
| `@FocusState` | ✅ Yes | Which text field has the keyboard |

---

## 25.1 `@State` for Local View State 🟢

**`@State`** marks a value that **this view owns**. Remember 23.2: the view **struct** is recreated all the time. `@State` storage lives **outside** the struct, managed by SwiftUI, so it **survives**. When the value changes, SwiftUI **redraws** the view.

```swift
struct CounterView: View {
    @State private var count = 0

    var body: some View {
        VStack {
            Text("Count: \(count)")
            Button("Increment") {
                count += 1   // changes the state → body runs again
            }
        }
    }
}
```

Make `@State` **`private`**. It belongs to this view. A parent shouldn't set it from outside; if the parent needs to control it, it should own it and pass a **binding** (25.2).

`@State` works for **any value type**: numbers, strings, structs, enums, arrays:

```swift
struct EditorView: View {
    @State private var draft = Note(title: "", body: "")   // a struct
    @State private var isShowingPreview = false
    @State private var tags: [String] = []

    var body: some View {
        Form {
            TextField("Title", text: $draft.title)   // bind to one property of the struct
            Toggle("Preview", isOn: $isShowingPreview)
        }
    }
}
```

⚠️ The **initial value** is used **only the first time**. If a parent passes a new value later, `@State` **keeps its own**:

```swift
struct Badge: View {
    @State private var count: Int

    init(count: Int) {
        _count = State(initialValue: count)   // used once; later changes from the parent are ignored
    }

    var body: some View { Text("\(count)") }
}
```

If the value comes from the parent, it usually should be a plain `let` or a `@Binding`, not `@State`.

---

## 25.2 `@Binding` for Two-Way Child State 🟢

A **`@Binding`** lets a child **read and write** a value that **someone else owns**. The child has no storage of its own; it holds a **connection** to the parent's `@State`.

```swift
struct ToggleView: View {
    @Binding var isOn: Bool

    var body: some View {
        Button(isOn ? "On" : "Off") {
            isOn.toggle()   // changes the PARENT's state, through the binding
        }
    }
}

struct ParentView: View {
    @State private var isEnabled = false

    var body: some View {
        VStack {
            ToggleView(isOn: $isEnabled)        // pass a binding with $
            Text(isEnabled ? "Enabled" : "Disabled")   // updates too
        }
    }
}
```

In UIKit, you'd use a **delegate** or a **callback** to send a change back up. In SwiftUI, a binding does both: the child **reads** the current value and **writes** new ones.

| Child needs to… | Pass |
|---|---|
| Only read the value | A plain `let` property |
| Read and change it | A `@Binding` |
| Tell the parent "something happened" | A closure, like `onSave: () -> Void` |

In **previews**, use **`.constant`** for a binding that never changes, or `@Previewable @State` for a working one:

```swift
#Preview {
    ToggleView(isOn: .constant(true))
}

#Preview("Interactive") {
    @Previewable @State var isOn = false
    ToggleView(isOn: $isOn)
}
```

---

## 25.3 Passing Bindings with `$` 🟢

The **`$` prefix** turns a `@State` (or `@Binding`, or `@Bindable` property, 25.5) into a **`Binding`**. That's what controls like `TextField` and `Toggle` expect:

```swift
struct ParentView: View {
    @State private var text = ""

    var body: some View {
        TextField("Enter text", text: $text)   // TextField's text: needs a Binding<String>
        CustomEditor(content: $text)            // the same binding, passed to your own view
    }
}
```

`$text` is the wrapper's **`projectedValue`** (12.6). For these wrappers, it's a `Binding<Value>`.

You can also **bind to a part** of a value, with a key path:

```swift
@State private var user = User(name: "", age: 0)

TextField("Name", text: $user.name)     // Binding<String> to one property
Stepper("Age: \(user.age)", value: $user.age)
```

Sometimes you need a **custom binding**, for example to change a value on the way in or out:

```swift
// A Toggle that works with an optional date: on = has a date
Toggle("Has due date", isOn: Binding(
    get: { task.dueDate != nil },
    set: { task.dueDate = $0 ? .now : nil }
))
```

Keep custom bindings **small**. If the logic grows, move it into the model.

---

## 25.4 `@Observable` for Model Objects 🟢

**`@Observable`** (the macro from 13.5) marks a **class** whose properties SwiftUI **watches**. No wrapper is needed on each property. A view that **reads** a property redraws **only when that property** changes:

```swift
@Observable
class UserSettings {
    var username: String = ""
    var isDarkMode: Bool = false
}

struct SettingsView: View {
    var settings: UserSettings   // no wrapper needed just to read

    var body: some View {
        Text(settings.username)   // redraws only when username changes
    }
}
```

This uses the **Observation** module's **per-property tracking** (14.20). It's more exact than the older `ObservableObject` system (25.12), so fewer views redraw.

A typical **view model**:

```swift
@Observable
final class RecipeListModel {
    var recipes: [Recipe] = []
    var isLoading = false
    var errorMessage: String?

    @ObservationIgnored
    private let api: RecipeAPI       // not watched; changes here never redraw views

    init(api: RecipeAPI) { self.api = api }

    func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            recipes = try await api.fetchRecipes()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
```

Use **`@ObservationIgnored`** for properties that views never need to watch, like services and caches.

---

## 25.5 `@Bindable` for Bindings into Observable Models 🟡

A plain reference to an `@Observable` object lets you **read** its properties. To make a **`Binding`** to one of them (for a `TextField`, for example), mark the reference with **`@Bindable`**:

```swift
@Observable
class UserSettings {
    var username: String = ""
}

struct SettingsView: View {
    @Bindable var settings: UserSettings

    var body: some View {
        TextField("Username", text: $settings.username)   // $ works thanks to @Bindable
    }
}
```

Without `@Bindable`, `settings.username` still **reads** fine, but `$settings.username` **doesn't compile**. `@Bindable` adds the `$` projection, like `@State` does for local values.

You don't need it everywhere:

| You have | To get a binding |
|---|---|
| `@State private var model = Model()` | `$model.name` already works |
| `var model: Model` (passed in) | Mark it `@Bindable var model: Model` |
| `@Environment(Model.self) var model` | Make a local `@Bindable` in `body` (below) |

```swift
struct ProfileEditor: View {
    @Environment(Profile.self) private var profile

    var body: some View {
        @Bindable var profile = profile        // a local bindable copy of the reference
        TextField("Name", text: $profile.name)
    }
}
```

---

## 25.6 `@Environment` for System Values 🟢

**`@Environment`** reads values that are **passed down** the view tree **automatically**. You don't have to pass them through every `init`. SwiftUI has many built-in ones:

```swift
struct AdaptiveView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.locale) private var locale

    var body: some View {
        if sizeClass == .compact {
            VStack { content }      // iPhone portrait
        } else {
            HStack { content }      // iPad, or iPhone landscape on big phones
        }
    }

    var content: some View {
        Text("Locale: \(locale.identifier)")
    }
}
```

Some environment values are **actions** you call:

```swift
struct DetailView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack {
            Button("Help") { openURL(URL(string: "https://example.com/help")!) }
            Button("Close") { dismiss() }    // closes the sheet or pops the navigation stack
        }
    }
}
```

A parent can **change** a value for its whole subtree:

```swift
SettingsForm()
    .environment(\.locale, Locale(identifier: "fr"))   // for previews or tests
    .disabled(isSaving)          // many modifiers set environment values too
```

It's like `@TaskLocal` (18.10): context that flows **down** a tree without extra parameters. Here the tree is the **view** tree.

---

## 25.7 Injecting Your Own Objects into the Environment 🟡

You can put your **own `@Observable` objects** into the environment with `.environment(_:)`. Then **any view below** can read them:

```swift
@Observable
class AppState {
    var isLoggedIn = false
}

struct RootView: View {
    @State private var appState = AppState()   // the owner

    var body: some View {
        ContentView()
            .environment(appState)   // ContentView and everything below it can read it
    }
}

struct DeeplyNestedView: View {
    @Environment(AppState.self) private var appState   // found by type, any depth

    var body: some View {
        Text(appState.isLoggedIn ? "Logged in" : "Logged out")
    }
}
```

This fixes **prop drilling**: passing a value through five views that don't use it, just so the sixth can.

⚠️ If no ancestor provided the object, `@Environment(AppState.self)` **crashes**. If it's really optional, read it as an optional:

```swift
@Environment(AppState.self) private var appState: AppState?   // nil if not provided
```

Remember to inject it in **previews** too:

```swift
#Preview {
    DeeplyNestedView()
        .environment(AppState())
}
```

Use the environment for **app-wide** things (the session, the theme, a router). For data only one or two views use, a normal parameter is clearer.

---

## 25.8 Custom Environment Values with `@Entry` 🟡

For **simple values** (not whole objects), you can add your own **environment keys**. The **`@Entry`** macro makes this one line:

```swift
extension EnvironmentValues {
    @Entry var cardTint: Color = .blue          // the default value
}

struct ParentView: View {
    var body: some View {
        ChildView()
            .environment(\.cardTint, .purple)   // override it for this subtree
    }
}

struct ChildView: View {
    @Environment(\.cardTint) private var cardTint

    var body: some View {
        Text("Styled")
            .foregroundStyle(cardTint)
    }
}
```

Before `@Entry`, you had to write a key type by hand. It's good to recognize in older code:

```swift
// The old way, which @Entry writes for you
private struct CardTintKey: EnvironmentKey {
    static let defaultValue: Color = .blue
}

extension EnvironmentValues {
    var cardTint: Color {
        get { self[CardTintKey.self] }
        set { self[CardTintKey.self] = newValue }
    }
}
```

A nice touch is a **modifier** that sets it, so it reads like a built-in one:

```swift
extension View {
    func cardTint(_ color: Color) -> some View {
        environment(\.cardTint, color)
    }
}

ChildView().cardTint(.green)
```

---

## 25.9 `@AppStorage` for Simple Persistence 🟢

**`@AppStorage`** saves a value in **`UserDefaults`** (43.1). The value **survives app relaunch**, and changing it **redraws** the view, like `@State`:

```swift
struct SettingsView: View {
    @AppStorage("username") private var username: String = "Guest"
    @AppStorage("launchCount") private var launchCount: Int = 0

    var body: some View {
        VStack {
            TextField("Username", text: $username)   // saved on every edit
            Text("Launched \(launchCount) times")
        }
    }
}
```

The default (`"Guest"`) is used only when **nothing is saved yet**.

It works with **enums** that have a `String` or `Int` raw value. This is great for settings:

```swift
enum Theme: String, CaseIterable {
    case system, light, dark
}

struct ThemePicker: View {
    @AppStorage("theme") private var theme: Theme = .system

    var body: some View {
        Picker("Theme", selection: $theme) {
            ForEach(Theme.allCases, id: \.self) { Text($0.rawValue.capitalized) }
        }
    }
}
```

Every view using the **same key** sees the **same value**, and updates together.

It's the same idea as the `@UserDefault` wrapper built in 12.7, but connected to SwiftUI updates.

| ✅ Good for | ❌ Not for |
|---|---|
| Small settings (theme, sort order, "has seen onboarding") | Large data, lists of records (use SwiftData, 41) |
| Simple types: `Bool`, `Int`, `Double`, `String`, `URL`, `Data` | Passwords and tokens (use the Keychain, 43) |

---

## 25.10 `@SceneStorage` for State Restoration 🟡

**`@SceneStorage`** saves a value for **one scene** (one window), not the whole app. It's for **restoring UI state**: when the system closes your app in the background and the user comes back, the window looks **the same as before**.

```swift
struct BrowserView: View {
    @SceneStorage("selectedTab") private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Home", systemImage: "house", value: 0) { HomeView() }
            Tab("Search", systemImage: "magnifyingglass", value: 1) { SearchView() }
        }
    }
}
```

On iPad and Mac, **each window** keeps its own value. Two windows can show two different tabs.

A common use is restoring the **selected item** or a **draft**:

```swift
struct NotesView: View {
    @SceneStorage("selectedNoteID") private var selectedNoteID: String?
    @SceneStorage("searchText") private var searchText = ""

    var body: some View {
        // ...
    }
}
```

| | `@AppStorage` | `@SceneStorage` |
|---|---|---|
| Scope | The whole app | One window |
| Lifetime | Until deleted | Restored if possible; lost if the user closes the window |
| Use for | Real settings | Where the user was in the UI |

Keep scene storage **small**, and never put important data **only** there. The system may throw it away.

---

## 25.11 `@FocusState` for Keyboard Focus 🟡

**`@FocusState`** tracks **which text field** has the keyboard. You can **read** it, and **set** it to move focus:

```swift
enum Field {
    case username, password
}

struct LoginView: View {
    @State private var username = ""
    @State private var password = ""
    @FocusState private var focusedField: Field?

    var body: some View {
        VStack {
            TextField("Username", text: $username)
                .focused($focusedField, equals: .username)
                .submitLabel(.next)
            SecureField("Password", text: $password)
                .focused($focusedField, equals: .password)
                .submitLabel(.go)
        }
        .onSubmit {                       // Return key pressed
            switch focusedField {
            case .username: focusedField = .password   // jump to the next field
            case .password: logIn()
            case nil: break
            }
        }
        .onAppear {
            focusedField = .username      // focus the first field on open
        }
    }

    func logIn() {
        focusedField = nil                // set to nil to hide the keyboard
        // ...
    }
}
```

For a **single** field, a `Bool` is enough:

```swift
@FocusState private var isSearchFocused: Bool

TextField("Search", text: $query)
    .focused($isSearchFocused)

Button("Cancel") { isSearchFocused = false }   // hides the keyboard
```

This replaces UIKit's `becomeFirstResponder()` and `resignFirstResponder()`. An **enum** for "which field" is the clean way to model it (6.22).

---

## 25.12 `ObservableObject` and `@StateObject` — Legacy Code Literacy 🟡

Before `@Observable`, SwiftUI used Combine's **`ObservableObject`** and **`@Published`** (22.9). You'll see this in many existing apps. It comes with two wrappers:

- **`@StateObject`**: this view **creates and owns** the object.
- **`@ObservedObject`**: this view **receives** an object owned by someone else.

```swift
class OldStyleViewModel: ObservableObject {
    @Published var username: String = ""
}

struct OldStyleView: View {
    @StateObject private var viewModel = OldStyleViewModel()   // this view OWNS it

    var body: some View {
        TextField("Username", text: $viewModel.username)
        ChildView(viewModel: viewModel)
    }
}

struct ChildView: View {
    @ObservedObject var viewModel: OldStyleViewModel   // only RECEIVES it

    var body: some View {
        Text(viewModel.username)
    }
}
```

The classic bug: using `@ObservedObject` for an object the view **creates itself**:

```swift
struct BuggyView: View {
    @ObservedObject var viewModel = OldStyleViewModel()   // ❌ a new object each time the parent redraws
}
```

Every time the parent redraws, `BuggyView` is recreated, and so is the view model. Its data is **lost**. `@StateObject` fixes this by keeping the first instance.

How the old and new wrappers map:

| Old (`ObservableObject`) | New (`@Observable`) |
|---|---|
| `class Model: ObservableObject` | `@Observable class Model` |
| `@Published var name` | `var name` |
| `@StateObject var model = Model()` | `@State var model = Model()` |
| `@ObservedObject var model` | `var model` (or `@Bindable var model`) |
| `@EnvironmentObject var model` | `@Environment(Model.self) var model` |
| `.environmentObject(model)` | `.environment(model)` |

---

## 25.13 `@Observable` vs `ObservableObject` Tracking Granularity 🟡

The biggest real difference is **how much** gets redrawn.

- **`ObservableObject`**: any `@Published` change fires **`objectWillChange`**, and **every** view watching the object redraws, even views that read a different property.
- **`@Observable`**: only views that **read the changed property** redraw.

```swift
// ObservableObject: changing "age" redraws views that only show "name"
class OldViewModel: ObservableObject {
    @Published var name = ""
    @Published var age = 0
}

// @Observable: a view reading only "name" ignores changes to "age"
@Observable
class NewViewModel {
    var name = ""
    var age = 0
}
```

You can see it with a quick test. Add **`Self._printChanges()`** to `body` (it's a debug helper):

```swift
struct NameView: View {
    var model: NewViewModel

    var body: some View {
        let _ = Self._printChanges()   // prints to the console when body runs, and why
        Text(model.name)
    }
}
```

With a big model and many views, this difference can matter a lot for **performance**. With `@Observable`, you also don't need to split a big model into small ones just to avoid extra redraws.

---

## 25.14 View Identity: Structural vs. Explicit 🔴

SwiftUI must decide: is this **the same view** as last time (keep its `@State`), or a **new view** (start fresh)? It uses **identity**.

- **Structural identity**: the view's **type and position** in the `body` code. This is the default.
- **Explicit identity**: an ID you give, with `.id()` or `ForEach`'s `id:`.

```swift
// Structural identity: each branch of if/else is a DIFFERENT position
if showDetail {
    DetailView()        // position "true branch"
} else {
    Text("No detail")   // position "false branch"
}
// Each switch destroys one branch and creates the other.
// DetailView's @State starts fresh every time it comes back.

// Explicit identity: a new id means a new view
DetailView(item: currentItem)
    .id(currentItem.id)
```

This explains a common bug. Using `if` to change a **style** creates **two different views**:

```swift
// ❌ Two identities: toggling isHighlighted resets CardView's state, and can't animate smoothly
if isHighlighted {
    CardView().border(.yellow)
} else {
    CardView()
}

// ✅ One identity: only a value changes
CardView()
    .border(isHighlighted ? .yellow : .clear)
```

**Rule of thumb:** prefer changing **values** (a color, an opacity, a frame) over **`if`/`else`** when it's "the same thing, looking different". Use `if` when it's really a **different** thing.

In lists, `ForEach` uses each item's **`id`** as its identity. That's why IDs must be **stable and unique** (26.3). An ID that changes on every reload (like `UUID()` created in `body`) resets every row.

---

## 25.15 Why `.id()` Resets State 🟡

When the value passed to **`.id()`** changes, SwiftUI treats the view as **brand new**. The old one is removed (with its `@State`), and a new one is created from scratch.

```swift
struct ProfileView: View {
    let userID: String

    var body: some View {
        DetailContent(userID: userID)
            .id(userID)   // a new user → a fresh DetailContent, with fresh @State
    }
}
```

This is useful when you **want** a clean start. When you switch from one user's profile to another, the old **scroll position** or **draft text** shouldn't carry over.

Other common uses:

```swift
// Restart a view's .task when the input changes
ArticleView(articleID: articleID)
    .id(articleID)

// "Reset" button for a form: change the token, get a fresh form
@State private var formToken = UUID()

SignUpForm()
    .id(formToken)
Button("Start Over") { formToken = UUID() }
```

For the first case, there's often a lighter tool: `.task(id: articleID)` restarts **only the task**, and keeps the rest of the view's state.

⚠️ A new identity also means **no smooth animation** between old and new (at best a fade), and the whole subtree is rebuilt. Don't put `.id()` on things that change often for no reason.

---

## 25.16 What Actually Triggers a `body` Re-Evaluation 🔴

A view's `body` runs again when:

1. **State it read** in the last `body` run changes (`@State`, `@Binding`, `@Observable` properties, `@Environment` values), or
2. Its **parent** redraws and passes **different inputs** (the view's stored properties change).

State that exists but **isn't read** in `body` doesn't cause a redraw:

```swift
@Observable
class Model {
    var name = ""
    var unused = 0   // never read in the view below
}

struct SomeView: View {
    var model: Model

    var body: some View {
        Text(model.name)   // only "name" is read; changing "unused" will NOT run body again
    }
}
```

That's how `@Observable` tracking works (25.4, 25.13). While `body` runs, the Observation module **records** which properties were read. Later, only changes to **those** properties cause a redraw.

Reads in **closures** that run later (like a button action) are **not** tracked, because they don't happen during `body`:

```swift
var body: some View {
    Button("Show count") {
        print(model.count)   // read later, on tap; changing count won't redraw this view
    }
}
```

A tip that follows from this: **pass only what a child needs**. A child that gets the whole model, but reads one property, is fine with `@Observable`. But a child that gets a **big struct** will redraw when **any** part of the struct changes:

```swift
// Redraws whenever anything in `user` changes
UserAvatar(user: user)

// Redraws only when the URL changes
UserAvatar(imageURL: user.avatarURL)
```

Running `body` is usually **cheap**. SwiftUI only touches the screen for what really changed. But `body` should stay fast: no heavy work, no network calls, no sorting big arrays inside it.

---

## 25.17 Lazy State Initialization for `@Observable` Types 🔴

A view that **creates** its own `@Observable` model should keep it in **`@State`**. `@State` keeps the **first instance** for as long as the view exists:

```swift
struct ContentView: View {
    @State private var model = ExpensiveModel()   // the FIRST instance is kept across redraws

    var body: some View {
        Text(model.value)
    }
}
```

Without `@State`, a plain `var model = ExpensiveModel()` would give a **new, empty model** each time the parent recreates `ContentView` (23.2). All its data would be lost.

⚠️ But there's a catch. Unlike `@StateObject`, **`@State` doesn't delay** the `ExpensiveModel()` call. The expression still **runs every time** the view struct is created. SwiftUI then **throws away** the extra copy and keeps the first. So the model is **kept once**, but **created many times**:

```swift
@Observable
final class ExpensiveModel {
    var value = ""
    init() {
        print("init")   // printed on every parent redraw, not just once!
        // heavy setup here runs every time too
    }
}
```

For a **cheap** `init`, this doesn't matter. For an **expensive** one, delay the creation until the view appears, with an optional and `.task`:

```swift
struct ContentView: View {
    @State private var model: ExpensiveModel?

    var body: some View {
        Group {
            if let model {
                LoadedView(model: model)
            } else {
                ProgressView()
            }
        }
        .task {
            if model == nil {
                model = ExpensiveModel()   // created once, when the view appears
            }
        }
    }
}
```

Other good options:

- Keep `init` **cheap**: do heavy work in an `async` `load()` method called from `.task`.
- Create the model **higher up** (in the `App` or a parent that rarely redraws) and pass it down.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `@State` | Local state the view owns; `private`; survives redraws |
| `@Binding` | Read and write a value someone else owns |
| `$` prefix | Turns a wrapper into a `Binding`; works on struct properties too |
| `@Observable` | Watches each property of a class; only readers redraw |
| `@Bindable` | Adds `$` bindings to an `@Observable` object's properties |
| `@Environment` | Values and actions passed down the view tree |
| Injecting objects | `.environment(obj)` + `@Environment(Type.self)`; no prop drilling |
| `@Entry` | One-line custom environment values |
| `@AppStorage` | Small settings saved in `UserDefaults` |
| `@SceneStorage` | Per-window UI state, restored when possible |
| `@FocusState` | Read and move keyboard focus; `nil` hides the keyboard |
| `ObservableObject`/`@StateObject` | The older system: `@StateObject` owns, `@ObservedObject` receives |
| Tracking granularity | `objectWillChange` redraws all watchers; `@Observable` only readers |
| View identity | Type and position by default; `.id()` for explicit; prefer values over `if` |
| `.id()` resets | A new id means a new view with fresh state |
| `body` re-evaluation | State read in `body` changed, or the parent passed new inputs |
| Lazy `@Observable` init | `@State` keeps the first instance, but `init` still runs; delay heavy work |
