*Estimated read time: ~30 minutes*

---

## 25.1 `@State` for Local View State

`@State` marks a value as owned and managed by a specific view — SwiftUI persists this storage across `body` re-evaluations (recall section 23.2's "views are descriptions" point: the *view* is recreated constantly, but `@State`'s underlying storage survives that, living outside the view value itself) and triggers a re-render automatically whenever the value changes.

```swift
struct CounterView: View {
    @State private var count = 0

    var body: some View {
        VStack {
            Text("Count: \(count)")
            Button("Increment") {
                count += 1   // triggers body to re-run, since count is @State
            }
        }
    }
}
```

`@State` should almost always be declared `private` — it represents state that conceptually belongs to and is fully managed by this specific view, not something a parent should reach in and directly modify (that's what `@Binding`, covered next, is for).

---

## 25.2 `@Binding` for Two-Way Child State

`@Binding` lets a child view read *and write* a piece of state that's actually owned by a parent (or some other ancestor) — the child doesn't own the storage itself; it holds a reference-like connection to the parent's `@State` (or other source of truth).

```swift
struct ToggleView: View {
    @Binding var isOn: Bool

    var body: some View {
        Button(isOn ? "On" : "Off") {
            isOn.toggle()   // mutates the PARENT's actual state, through this binding
        }
    }
}

struct ParentView: View {
    @State private var isEnabled = false

    var body: some View {
        ToggleView(isOn: $isEnabled)   // pass a binding, not the raw value
    }
}
```

This is precisely how SwiftUI achieves two-way data flow without needing delegate protocols or completion-handler callbacks (the UIKit-era approach) — the child can both read the current value and write a new one back, and the parent's own `@State` updates (and re-renders) automatically as a result.

---

## 25.3 Passing Bindings with `$`

The `$` prefix on a `@State` (or `@Observable` model property, via `@Bindable`, see 25.5) property produces a `Binding` to it, which is exactly what `@Binding`-typed parameters expect to receive:

```swift
struct ParentView: View {
    @State private var text = ""

    var body: some View {
        TextField("Enter text", text: $text)   // TextField's "text:" parameter expects a Binding<String>
        CustomEditor(content: $text)             // passing the same binding to a custom child view
    }
}
```

`$propertyName` is available automatically for any `@State`, `@Binding`, or `@Bindable`-wrapped property — it's the property wrapper's `projectedValue` (recall section 12.6's general property-wrapper mechanism), which for these specific wrappers happens to produce a `Binding<Value>`.

---

## 25.4 `@Observable` for Model Objects

`@Observable` (recall the macro mechanics from section 13.5) marks a reference type (a class) whose properties SwiftUI automatically tracks — any view reading a specific property of an `@Observable` object automatically re-renders when that specific property changes, without needing `@State`, `@Published`, or any other wrapper on the properties themselves.

```swift
@Observable
class UserSettings {
    var username: String = ""
    var isDarkMode: Bool = false
}

struct SettingsView: View {
    var settings: UserSettings   // no property wrapper needed on this parameter itself

    var body: some View {
        Text(settings.username)   // this view re-renders only when "username" specifically changes
    }
}
```

This directly builds on the `Observation` module's fine-grained, per-property tracking from section 14.20 — a view only re-renders for the specific `@Observable` properties it actually reads inside `body`, not for every change to any property on the object, which is a meaningfully more precise (and often more performant) model than the older `ObservableObject` approach covered in 25.12.

---

## 25.5 `@Bindable` for Bindings into Observable Models

While a view can simply hold a plain reference to an `@Observable` object (25.4) to *read* its properties, creating a `Binding` to one of that object's properties (e.g. to pass to a `TextField`) requires wrapping the reference with `@Bindable` first:

```swift
@Observable
class UserSettings {
    var username: String = ""
}

struct SettingsView: View {
    @Bindable var settings: UserSettings

    var body: some View {
        TextField("Username", text: $settings.username)   // $ now works on this property, via @Bindable
    }
}
```

Without `@Bindable`, a plain `var settings: UserSettings` parameter lets you read `settings.username` directly, but `$settings.username` wouldn't be available — `@Bindable` is specifically what enables projecting individual properties of an `@Observable` reference type into `Binding`s, mirroring what `@State`'s own `$` prefix does for value-type local state.

---

## 25.6 `@Environment` for System Values

`@Environment` reads values implicitly passed down through the view hierarchy, without needing to be threaded explicitly through every intermediate view's initializer — SwiftUI provides many built-in environment values out of the box (color scheme, recall section 23.16; size class; locale; and dozens more).

```swift
struct AdaptiveView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.locale) private var locale

    var body: some View {
        Text("Locale: \(locale.identifier)")
    }
}
```

This mirrors `@TaskLocal`'s conceptual role from section 18.10 — implicitly-available context flowing down through a hierarchy without explicit parameter-passing — except scoped to SwiftUI's view tree rather than a task hierarchy, and specifically readable (and, for custom values, writable) via the `\.keyPath` syntax from key paths (recall section 11.1).

---

## 25.7 Injecting Your Own Objects into the Environment

Beyond system-provided values, you can inject your *own* `@Observable` objects into the environment with `.environment(_:)`, making them implicitly available to every descendant view without manually passing them through each intermediate view's initializer:

```swift
@Observable
class AppState {
    var isLoggedIn = false
}

struct RootView: View {
    @State private var appState = AppState()

    var body: some View {
        ContentView()
            .environment(appState)   // available to ContentView AND all of its descendants
    }
}

struct DeeplyNestedView: View {
    @Environment(AppState.self) private var appState   // reads it, however many levels deep

    var body: some View {
        Text(appState.isLoggedIn ? "Logged in" : "Logged out")
    }
}
```

This solves the classic "prop drilling" problem — passing a value through five layers of intermediate views that don't themselves need it, purely so a deeply-nested view can eventually receive it — by making the object implicitly available anywhere in the subtree below where it was injected, retrieved by its type via `@Environment(AppState.self)`.

---

## 25.8 Custom Environment Values with `@Entry`

Beyond injecting whole `@Observable` objects (25.7), you can define your own custom environment *keys* for simple values, using the `@Entry` macro — a significant simplification over the older, considerably more verbose `EnvironmentKey` protocol conformance boilerplate previously required.

```swift
extension EnvironmentValues {
    @Entry var accentColor: Color = .blue
}

struct ParentView: View {
    var body: some View {
        ChildView()
            .environment(\.accentColor, .purple)
    }
}

struct ChildView: View {
    @Environment(\.accentColor) private var accentColor

    var body: some View {
        Text("Styled")
            .foregroundStyle(accentColor)
    }
}
```

`@Entry` reduces what used to require a full custom `EnvironmentKey` struct (with a `defaultValue` static property) plus a separate `EnvironmentValues` extension, down to a single, concise property declaration — directly making custom environment values as easy to define as SwiftUI's own built-in ones.

---

## 25.9 `@AppStorage` for Simple Persistence

`@AppStorage` is a property wrapper backing a property directly with `UserDefaults` (recall section 43.1's fuller persistence coverage) — reading and writing it automatically persists the value across app launches, and (like `@State`) triggers a view re-render when the underlying value changes.

```swift
struct SettingsView: View {
    @AppStorage("username") private var username: String = "Guest"
    @AppStorage("launchCount") private var launchCount: Int = 0

    var body: some View {
        VStack {
            TextField("Username", text: $username)   // automatically persisted on every edit
            Text("Launched \(launchCount) times")
        }
    }
}
```

This is conceptually very similar to the custom `@UserDefault` property wrapper built from scratch in section 12.7 — `@AppStorage` is essentially that same pattern, provided directly by SwiftUI, specifically integrated with the view-update system so that reading/writing the value behaves like `@State` while being transparently backed by `UserDefaults` underneath.

---

## 25.10 `@SceneStorage` for State Restoration

`@SceneStorage` persists a value tied to a specific *scene* instance (a particular window, on platforms supporting multiple windows) rather than globally across the whole app like `@AppStorage` — intended specifically for restoring transient UI state (like a scroll position, or which tab was selected) if that scene is suspended and later relaunched by the system.

```swift
struct BrowserView: View {
    @SceneStorage("selectedTab") private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            // ... tabs ...
        }
    }
}
```

Unlike `@AppStorage` (which is genuinely shared, persistent data meaningful across the whole app and every window), `@SceneStorage` is meant for lightweight, scene-specific UI state that helps a single window resume exactly where the user left off — not a general-purpose persistence mechanism for meaningful application data.

---

## 25.11 `@FocusState` for Keyboard Focus

`@FocusState` tracks and controls which specific input element (a `TextField`, `SecureField`, `TextEditor`) currently has keyboard focus, letting you both read the current focus state and programmatically move focus between fields:

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
            SecureField("Password", text: $password)
                .focused($focusedField, equals: .password)
            Button("Next") {
                focusedField = .password   // programmatically move focus
            }
        }
        .onAppear {
            focusedField = .username   // auto-focus the first field when the view appears
        }
    }
}
```

This is the modern, SwiftUI-native replacement for manually calling `becomeFirstResponder()`/`resignFirstResponder()` on individual UIKit text fields — an enum (as shown) is the idiomatic way to represent "which of several possible fields is focused," directly tying into section 6.22's "model state with enums" theme.

---

## 25.12 `ObservableObject` and `@StateObject` — Legacy Code Literacy 🔵

Before `@Observable` (25.4), SwiftUI's data-binding model was built on Combine's `ObservableObject`/`@Published` (recall section 22.9), paired with `@StateObject` (for the view that owns/creates the object) or `@ObservedObject` (for a view that merely receives an already-existing instance from elsewhere).

```swift
class OldStyleViewModel: ObservableObject {
    @Published var username: String = ""
}

struct OldStyleView: View {
    @StateObject private var viewModel = OldStyleViewModel()   // this view OWNS the instance

    var body: some View {
        TextField("Username", text: $viewModel.username)
    }
}

struct ChildView: View {
    @ObservedObject var viewModel: OldStyleViewModel   // this view merely RECEIVES an existing instance

    var body: some View {
        Text(viewModel.username)
    }
}
```

The `@StateObject`/`@ObservedObject` distinction (owns vs. merely receives) mattered a great deal under this older system, since using `@ObservedObject` for an object a view itself creates could cause it to be recreated unexpectedly on every `body` re-evaluation — `@Observable` (25.4) eliminates this entire distinction and its associated pitfalls, which is a major reason for its introduction, but recognizing this older pattern remains essential for reading and maintaining existing SwiftUI codebases.

---

## 25.13 `@Observable` vs `ObservableObject` Tracking Granularity 🟠

The core practical difference between the two systems, beyond syntax: `ObservableObject`'s `objectWillChange` (recall section 22.9) fires as one blanket signal any time *any* `@Published` property changes, causing every view observing that object to re-evaluate its `body` regardless of which specific property it actually reads — `@Observable`'s tracking is precise per-property, notifying only views that actually read the specific property that changed.

```swift
// ObservableObject: ANY @Published change re-renders ALL observing views,
// even ones that only read a completely different, unrelated property
class OldViewModel: ObservableObject {
    @Published var name = ""
    @Published var age = 0
}

// @Observable: a view reading only "name" re-renders ONLY when "name" changes,
// completely unaffected by "age" changing
@Observable
class NewViewModel {
    var name = ""
    var age = 0
}
```

This granularity difference can have a real, measurable performance impact for view hierarchies observing large model objects with many properties — under the old system, a view reading just one property of a large `ObservableObject` still re-renders on every unrelated property change; under `@Observable`, it doesn't, since the `Observation` module (section 14.20) tracks reads at the individual-property level rather than the whole-object level.

---

## 25.14 View Identity: Structural vs. Explicit

SwiftUI determines whether two `body` evaluations represent "the same view continuing to exist" (preserving its `@State`) or "a genuinely different view" (resetting `@State` fresh) primarily through **structural identity** — a view's position and type within the overall view tree — unless you override this with **explicit identity** via `.id()`.

```swift
// Structural identity: SwiftUI infers "same view" purely from consistent position/type in the hierarchy
if showDetail {
    DetailView()   // this specific position in the tree
} else {
    Text("No detail")
}
// Switching back and forth between these two branches creates/destroys DetailView's state each time,
// since its structural position (relative to the conditional) determines its identity

// Explicit identity: forces SwiftUI to treat this as a genuinely different view whenever "id" changes
DetailView(item: currentItem)
    .id(currentItem.id)
```

Understanding structural identity explains a wide range of otherwise-mysterious SwiftUI state-reset behavior — a view's `@State` persists across re-renders only as long as SwiftUI considers it to remain "the same view" by this identity rule, not merely because the same Swift type is used somewhere in the tree.

---

## 25.15 Why `.id()` Resets State 🔵

Explicitly applying `.id(someValue)` to a view tells SwiftUI to treat it as an entirely new, distinct view identity whenever `someValue` changes — which deliberately, intentionally discards and recreates that view's `@State` from scratch, rather than preserving it across the change.

```swift
struct ProfileView: View {
    let userID: String

    var body: some View {
        DetailContent(userID: userID)
            .id(userID)   // switching users forces a fresh DetailContent, resetting any of its @State
    }
}
```

This is a deliberate, useful tool specifically when you *want* a full reset — for example, switching between entirely different users' profile screens, where any lingering `@State` (like a scroll position, or a text field's draft text) from the *previous* user's profile would be incorrect to carry over to the new one; `.id()` guarantees a clean slate exactly when identity genuinely changes.

---

## 25.16 What Actually Triggers a `body` Re-Evaluation 🟠

A view's `body` re-runs specifically when a piece of state it actually *reads* during that evaluation changes — this applies uniformly across `@State`, `@Binding`, `@Observable` properties actually accessed, `@Environment` values actually read, and so on; state that exists but is never actually read inside `body` doesn't trigger a re-evaluation when it changes.

```swift
@Observable
class Model {
    var name = ""
    var unused = 0   // never read in the view below
}

struct SomeView: View {
    var model: Model

    var body: some View {
        Text(model.name)   // only "name" is read here — "unused" changing will NOT re-trigger body
    }
}
```

This is precisely what makes `@Observable`'s fine-grained tracking work (25.4/25.13): SwiftUI (via the `Observation` module) records exactly which properties were actually accessed during a given `body` evaluation, and only re-triggers that specific view's `body` when one of those *specifically observed* properties subsequently changes — not for changes to properties the view's `body` never actually touched.

---

## 25.17 Lazy State Initialization for `@Observable` Types 🟠

Since `@Observable` types are ordinary reference types (classes), initializing one inside a view's own property declaration (rather than receiving it from a parent) runs the risk of recreating that instance on every `body` re-evaluation unless handled carefully — `@State` is specifically what guarantees an `@Observable` object a view itself creates is initialized only *once*, on that view's first appearance, and preserved thereafter.

```swift
struct ContentView: View {
    @State private var model = ExpensiveModel()   // @State ensures this runs only ONCE, not on every body re-evaluation

    var body: some View {
        Text(model.value)
    }
}
```

Without `@State` wrapping it, a plain `var model = ExpensiveModel()` property would actually be re-initialized fresh every time SwiftUI recreates the `ContentView` value itself (recall 23.2 — view values are cheap, disposable descriptions recreated constantly) — `@State`'s storage lives independently of the view value's own lifecycle, which is exactly what makes it the correct tool for a view-owned, expensive-to-create `@Observable` object that should genuinely persist across re-renders rather than being rebuilt from scratch each time.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `@State` | View-owned, persistent local state; almost always `private` |
| `@Binding` | Two-way connection to state actually owned by a parent/ancestor |
| `$` prefix | Produces a `Binding` from `@State`/`@Bindable`-wrapped properties, via `projectedValue` |
| `@Observable` | Marks a class for fine-grained, per-property SwiftUI tracking — no wrapper needed on individual properties |
| `@Bindable` | Required to project `Binding`s to individual properties of an `@Observable` reference |
| `@Environment` | Reads implicitly-passed-down values without threading them through every initializer |
| Injecting objects | `.environment(_:)` makes a custom `@Observable` object available anywhere in a subtree, solving prop drilling |
| `@Entry` | Concisely defines custom environment keys, replacing older, verbose `EnvironmentKey` boilerplate |
| `@AppStorage` | `UserDefaults`-backed property wrapper, persisting across app launches like `@State` |
| `@SceneStorage` | Scene-specific transient UI state restoration, not general persistent app data |
| `@FocusState` | Tracks and programmatically controls which input field has keyboard focus |
| `ObservableObject`/`@StateObject` | The pre-`@Observable` system; owns-vs-receives distinction mattered and caused real pitfalls |
| Tracking granularity | `objectWillChange` is blanket/whole-object; `@Observable` is precise per-property |
| View identity | Structural (position/type in the tree) by default; `.id()` for explicit, forced identity |
| `.id()` resets | Deliberately discards and recreates a view's state when its identity value changes |
| `body` re-evaluation | Triggered only by state actually *read* during that specific `body` evaluation |
| Lazy `@Observable` init | `@State` guarantees a view-created `@Observable` object initializes once, not on every re-render |

**Next up:** Section 26 — Lists and Collections.
