**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 12.1 What a Result Builder Is 🟢

A **result builder** (a type marked `@resultBuilder`) turns a **block of statements**, which looks like normal code, into **one combined value**. The compiler **rewrites** the block into a series of method calls on the builder.

This is exactly what makes SwiftUI's view syntax work:

```swift
struct ContentView: View {
    var body: some View {
        VStack {          // <- this closure is secretly a result-builder-transformed block
            Text("Hello")
            Text("World")
        }
    }
}
```

In a normal closure, `Text("Hello")` on its own line would create a value and **throw it away**. Here, the compiler **collects** both `Text` values and combines them into one value the `VStack` can lay out. Roughly:

```swift
// What you write:
VStack {
    Text("Hello")
    Text("World")
}

// Roughly what the compiler turns it into:
VStack {
    let v0 = Text("Hello")
    let v1 = Text("World")
    return ViewBuilder.buildBlock(v0, v1)
}
```

The rest of this section builds a small version **from scratch**, so there is no magic left.

---

## 12.2 Building a Minimal `@resultBuilder` 🟡

Declare a result builder with **`@resultBuilder`** on a type. It's usually an empty `enum`, because it only needs **static methods**. The one required method is **`buildBlock`**: it combines the separate pieces into one result.

```swift
@resultBuilder
enum StringBuilder {
    static func buildBlock(_ components: String...) -> String {
        components.joined(separator: "\n")
    }
}

func makeText(@StringBuilder content: () -> String) -> String {
    content()
}

let result = makeText {
    "Hello"
    "World"
    "from Swift"
}
print(result)
// Hello
// World
// from Swift
```

`@StringBuilder` on the `content` parameter tells the compiler: "transform any closure passed here with this builder". Each line in the closure (`"Hello"`, `"World"`, ...) becomes one **component**, and `buildBlock` joins them.

You can also put the builder on a **computed property** or a **function**, the same way `body` uses `@ViewBuilder`:

```swift
struct Email {
    let name: String

    @StringBuilder
    var text: String {
        "Hi \(name),"
        "Thanks for signing up!"
        "— The Team"
    }
}

print(Email(name: "Ada").text)
// Hi Ada,
// Thanks for signing up!
// — The Team
```

---

## 12.3 `buildBlock`, `buildOptional`, `buildEither` 🟡

`buildBlock` alone handles plain lists of lines. To support **control flow** (`if`, `if`/`else`, `for`) inside the block, the builder needs **more methods**. The compiler calls them automatically when it sees that syntax:

```swift
@resultBuilder
enum StringBuilder {
    static func buildBlock(_ components: String...) -> String {
        components.joined(separator: "\n")
    }

    // supports a plain "if" with no "else" (the condition might produce nothing)
    static func buildOptional(_ component: String?) -> String {
        component ?? ""
    }

    // supports "if / else" — buildEither(first:) for the true branch, (second:) for the false branch
    static func buildEither(first component: String) -> String {
        component
    }
    static func buildEither(second component: String) -> String {
        component
    }
}

func makeText(@StringBuilder content: () -> String) -> String {
    content()
}

let showExtra = true
let result = makeText {
    "Header"
    if showExtra {
        "Extra content"
    } else {
        "No extra content"
    }
    "Footer"
}
print(result)
// Header
// Extra content
// Footer
```

| Syntax in the block | Builder method needed |
|---|---|
| Lines of values | `buildBlock` |
| `if` (no `else`) | `buildOptional` |
| `if`/`else`, `switch` | `buildEither(first:)` and `buildEither(second:)` |
| `for ... in` | `buildArray` |
| `if #available(...)` | `buildLimitedAvailability` |

Adding **`for` loop** support:

```swift
extension StringBuilder {
    static func buildArray(_ components: [String]) -> String {
        components.joined(separator: "\n")
    }
}

let list = makeText {
    "Shopping list:"
    for item in ["milk", "eggs", "bread"] {
        "- \(item)"
    }
}
// Shopping list:
// - milk
// - eggs
// - bread
```

If a method is **missing**, the compiler tells you which syntax isn't supported:

```plaintext
error: closure containing control flow statement cannot be used with result builder 'StringBuilder'
```

---

## 12.4 How `ViewBuilder` Works Internally 🔴

SwiftUI's **`@ViewBuilder`** is a result builder **exactly like** the ones above. Its `buildBlock` combines several views into **one** view (often wrapped in a `TupleView`). It has `buildOptional` and `buildEither` for `if` and `if`/`else`:

```swift
// conceptually, roughly what @ViewBuilder's buildBlock does (simplified):
@resultBuilder
enum SimpleViewBuilder {
    static func buildBlock<V0: View, V1: View>(_ v0: V0, _ v1: V1) -> TupleView<(V0, V1)> {
        TupleView((v0, v1))
    }
}
```

So a `VStack { }` body that **looks** like separate statements is actually **assembled** into one nested, strongly-typed view value. You can see the real type:

```swift
let stack = VStack {
    Text("Title")
    if isLoggedIn {
        Text("Welcome back")
    } else {
        Button("Log in") { }
    }
}
print(type(of: stack))
// VStack<TupleView<(Text, _ConditionalContent<Text, Button<Text>>)>>
```

Notice `_ConditionalContent`: that's what `buildEither` produces for `if`/`else`. Both branches are part of the **type**, which helps SwiftUI know the view's structure.

(Older SwiftUI versions had `buildBlock` overloads for up to **10** child views, which is why you once saw "extra argument" errors past 10. Newer versions use parameter packs (8.12), so that limit is gone.)

You can use `@ViewBuilder` in **your own** code, so callers can pass views the same way:

```swift
struct Card<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            content
        }
        .padding()
        .background(.thinMaterial, in: .rect(cornerRadius: 12))
    }
}

Card {
    Text("Pancakes").font(.headline)
    Text("20 minutes")
}
```

---

## 12.5 Property Wrapper Anatomy: `wrappedValue` 🟡

A **property wrapper** is a type (usually a struct) marked **`@propertyWrapper`**. It **must** have a **`wrappedValue`** property. Every read and write of the wrapped property goes **through** `wrappedValue`, so the wrapper can add its own logic.

```swift
@propertyWrapper
struct Clamped {
    private var value: Int
    private let range: ClosedRange<Int>

    init(wrappedValue: Int, _ range: ClosedRange<Int>) {
        self.range = range
        self.value = min(max(wrappedValue, range.lowerBound), range.upperBound)
    }

    var wrappedValue: Int {
        get { value }
        set { value = min(max(newValue, range.lowerBound), range.upperBound) }
    }
}

struct Settings {
    @Clamped(0...100) var volume: Int = 150   // clamped down to 100 immediately
}

var settings = Settings()
print(settings.volume)   // 100 — clamped by the wrapper's init
settings.volume = -20
print(settings.volume)   // 0 — clamped by the wrapper's setter
```

`@Clamped(0...100) var volume: Int = 150` is **shorthand**. The compiler really generates something like this:

```swift
struct Settings {
    private var _volume = Clamped(wrappedValue: 150, 0...100)   // the hidden storage

    var volume: Int {                                              // what you use
        get { _volume.wrappedValue }
        set { _volume.wrappedValue = newValue }
    }
}
```

That also explains the **`init(wrappedValue:)`** name: the `= 150` default is passed in as the `wrappedValue:` argument, and the `(0...100)` part becomes the other arguments.

Property wrappers work on **local variables** too:

```swift
func demo() {
    @Clamped(0...100) var level = 250
    print(level)       // 100
}
```

---

## 12.6 `projectedValue` and the `$` Prefix 🟡

A property wrapper can expose a **second** value: the **projected value**. You read it with a **`$` prefix**. Define it with a **`projectedValue`** property.

This is how `$` on SwiftUI's `@State` gives you a `Binding`:

```swift
@propertyWrapper
struct Logged<Value> {
    private var value: Value
    private let name: String

    init(wrappedValue: Value, _ name: String) {
        self.value = wrappedValue
        self.name = name
    }

    var wrappedValue: Value {
        get { value }
        set {
            print("\(name) changed from \(value) to \(newValue)")
            value = newValue
        }
    }

    var projectedValue: String {
        "Wrapper watching: \(name)"
    }
}

struct Counter {
    @Logged("count") var count: Int = 0
}

var counter = Counter()
counter.count = 5              // "count changed from 0 to 5"
print(counter.$count)           // "Wrapper watching: count" — accessed via the $ prefix
```

| You write | Swift reads |
|---|---|
| `counter.count` | `counter._count.wrappedValue` |
| `counter.$count` | `counter._count.projectedValue` |

The projected value can be **any type**. A useful choice is to return the **wrapper itself**, or something with extra features. Here, `$` gives a "reset" control:

```swift
@propertyWrapper
struct Resettable<Value> {
    private let initial: Value
    var wrappedValue: Value

    init(wrappedValue: Value) {
        self.initial = wrappedValue
        self.wrappedValue = wrappedValue
    }

    var projectedValue: Resettable<Value> {
        get { self }
        set { self = newValue }
    }

    mutating func reset() { wrappedValue = initial }
}

struct Filters {
    @Resettable var maxPrice = 100
}

var filters = Filters()
filters.maxPrice = 20
filters.$maxPrice.reset()
print(filters.maxPrice)   // 100
```

In SwiftUI:

```swift
@State private var isOn = false

Toggle("Wi-Fi", isOn: $isOn)   // $isOn is the projected value: a Binding<Bool>
```

---

## 12.7 Writing a Custom Property Wrapper 🟡

Putting 12.5 and 12.6 together: a complete, realistic property wrapper that **saves a value to `UserDefaults`** every time it's set.

```swift
@propertyWrapper
struct UserDefault<Value> {
    let key: String
    let defaultValue: Value
    let store: UserDefaults = .standard

    var wrappedValue: Value {
        get { store.object(forKey: key) as? Value ?? defaultValue }
        set { store.set(newValue, forKey: key) }
    }

    init(wrappedValue: Value, _ key: String) {
        self.defaultValue = wrappedValue
        self.key = key
    }
}

struct AppSettings {
    @UserDefault("username") var username: String = "Guest"
    @UserDefault("launchCount") var launchCount: Int = 0
}

var settings = AppSettings()
print(settings.username)     // "Guest" (or whatever was previously saved)
settings.launchCount += 1     // automatically persisted to UserDefaults on write
```

**Why property wrappers exist:** wrap a **cross-cutting concern** (saving, validation, logging, thread safety) **once**, then attach it anywhere with one word. No repeated get/set code.

(SwiftUI ships a ready-made version of this exact idea: **`@AppStorage("username")`**, which also refreshes the view when the value changes.)

Another common example: **trimming** text input automatically:

```swift
@propertyWrapper
struct Trimmed {
    private var value = ""

    var wrappedValue: String {
        get { value }
        set { value = newValue.trimmingCharacters(in: .whitespacesAndNewlines) }
    }

    init(wrappedValue: String) {
        self.wrappedValue = wrappedValue     // goes through the setter: trimmed
    }
}

struct SignUpForm {
    @Trimmed var email = ""
}

var form = SignUpForm()
form.email = "  ada@example.com \n"
print(form.email)   // "ada@example.com"
```

---

## 12.8 Property Wrapper Limitations and Composition 🔴

Some limits to know:

- They work on **stored** properties, not **computed** ones: the wrapper itself **is** the storage.
- A wrapper **can't easily see the object that contains it**. (SwiftUI's wrappers like `@State` work closely with SwiftUI itself to do that.)
- A wrapped property can't be `lazy`, `weak`, or `unowned`.

```swift
struct Broken {
    @Clamped(0...10) var computed: Int { 5 }
    // ❌ error: property wrapper cannot be applied to a computed property
}
```

You **can stack** several wrappers on one property. The **outer** wrapper wraps the **inner wrapper**, not the plain value. So the outer one must be **generic** over what it wraps:

```swift
@propertyWrapper
struct Counted<Value> {
    var wrappedValue: Value { didSet { changes += 1 } }
    private(set) var changes = 0
    var projectedValue: Int { changes }

    init(wrappedValue: Value) { self.wrappedValue = wrappedValue }
}

struct Player {
    @Counted @Clamped(0...100) var health: Int = 100
}

var player = Player()
player.health = 150     // the inner Clamped keeps it at 100
player.health = 40
print(player.health)    // 40
print(player.$health)   // 2 — `$` gives the OUTER wrapper's projected value
```

```plaintext
@Counted @Clamped(0...100) var health

storage:  Counted< Clamped >      ← outer wraps inner
                   └── Int        ← the inner wrapper is closest to the value
```

The **innermost** wrapper is **closest to the value**, and is applied first.

Stacked wrappers get **hard to understand and debug** quickly. Most real code uses **at most one** wrapper per property. Stack them only in small, well-understood cases.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Result builders | Turn a block of lines into one combined value, at compile time |
| `buildBlock` | The required method: combines the pieces into one result |
| `buildOptional`/`buildEither`/`buildArray` | Support `if`, `if`/`else`, and `for` in the block |
| `@ViewBuilder` | SwiftUI's result builder; you can use it for your own container views |
| Property wrapper anatomy | `@propertyWrapper` with a `wrappedValue`; the compiler stores it as `_name` |
| Projected value (`$`) | A second value via `$name`, like `@State`'s `Binding` |
| Custom wrappers | Package a repeated concern (saving, trimming, clamping) into one attribute |
| Limitations and composition | Stored properties only; the outer wrapper wraps the inner one; use rarely |
