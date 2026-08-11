## 12.1 What a Result Builder Is

A result builder (marked `@resultBuilder`) is a type that transforms a specially-formatted block of statements — one that looks like plain sequential code — into a single combined value, by intercepting the block at compile time and rewriting it into a series of method calls. This is exactly what makes SwiftUI's view syntax work:

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

That `VStack { ... }` closure doesn't just execute two statements and discard their results — the compiler rewrites it, behind the scenes, into a call combining both `Text` views into a single value the `VStack` can lay out. The rest of this section builds a minimal version of this mechanism from scratch to demystify it.

---

## 12.2 Building a Minimal `@resultBuilder`

A result builder is declared with the `@resultBuilder` attribute on a type (usually an empty `enum`, since it only needs static methods) and must implement at least `buildBlock(_:)`, which combines a list of individual component values into one:

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

The `@StringBuilder` attribute on the `content` parameter tells the compiler to apply the result-builder transformation to whatever closure is passed there — each bare statement inside the closure (`"Hello"`, `"World"`, etc.) becomes one component, which `buildBlock` then combines into the final `String`.

---

## 12.3 `buildBlock`, `buildOptional`, `buildEither`

A minimal result builder only needs `buildBlock`, but supporting `if`, `if/else`, and other control flow inside the builder's block requires additional methods the compiler calls automatically when it encounters that syntax:

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

Each control-flow construct you want to support inside the builder's block (loops, `switch`, availability checks) requires its own corresponding `build...` method — `buildArray` for `for` loops, `buildLimitedAvailability` for `#available` checks, and so on.

---

## 12.4 How `ViewBuilder` Works Internally

SwiftUI's `@ViewBuilder` is a result builder exactly like the ones you've just built — its `buildBlock` combines multiple `View`-conforming values into a single combined view (often using an internal tuple-view wrapper type), and it implements `buildOptional`/`buildEither` to support `if`/`if-else` inside a view hierarchy, and `buildArray` to support `for` loops:

```swift
// conceptually, roughly what @ViewBuilder's buildBlock does (simplified):
@resultBuilder
enum SimpleViewBuilder {
    static func buildBlock<V0: View, V1: View>(_ v0: V0, _ v1: V1) -> TupleView<(V0, V1)> {
        TupleView((v0, v1))
    }
}
```

This is why a `VStack { }`'s closure body can contain a sequence of view expressions that *look* like independent statements — the compiler is actually assembling them into one nested, strongly-typed composite view value via exactly the mechanism from 12.2–12.3, just with many more overloads (for 2, 3, 4... up to 10 components) and view-specific combining logic instead of simple string concatenation.

---

## 12.5 Property Wrapper Anatomy: `wrappedValue`

A property wrapper is a type (usually a `struct`) annotated with `@propertyWrapper`, which must define a `wrappedValue` property — this is what gets exposed whenever you access the property the wrapper is attached to, letting the wrapper interpose custom storage or logic around every read and write.

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

The `@Clamped(0...100) var volume: Int = 150` syntax is sugar — under the hood, Swift actually stores a hidden `_volume: Clamped` property and routes every access to `volume` through `_volume.wrappedValue`, entirely transparently to code using `settings.volume`.

---

## 12.6 `projectedValue` and the `$` Prefix

A property wrapper can optionally expose a second, secondary value — the **projected value** — accessed with a `$` prefix, via a `projectedValue` property on the wrapper. This is exactly how SwiftUI's `@State`'s `$` produces a `Binding`:

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

`$count` accesses `_count.projectedValue`, exactly parallel to how `count` accesses `_count.wrappedValue` — this is precisely the mechanism behind writing `$isEnabled` in SwiftUI to get a `Binding<Bool>` from an `@State private var isEnabled: Bool`.

---

## 12.7 Writing a Custom Property Wrapper

Combining everything from 12.5–12.6, here's a complete, realistic custom property wrapper — one that persists a value to `UserDefaults` automatically on every write, a common real-world use case:

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

This pattern — wrap a cross-cutting concern (persistence, validation, logging, thread-safety) once inside a reusable property wrapper — is exactly why property wrappers exist: it lets you attach that behavior declaratively (`@UserDefault("key")`) to any property, without repeating the underlying get/set logic by hand at every use site.

---

## 12.8 Property Wrapper Limitations and Composition

Property wrappers have a few notable constraints worth knowing. They generally cannot be applied to computed properties (only stored ones), since the wrapper itself needs to own the actual storage. Accessing `self` or other properties from within the wrapper's own `init`/`wrappedValue` implementation is restricted in certain contexts, since the wrapper is initialized as part of the enclosing type's own initialization sequence.

Multiple property wrappers *can* be composed (stacked) on a single property, applied in the order written, though this quickly becomes hard to reason about and is used sparingly in practice:

```swift
@propertyWrapper
struct Capitalized {
    var wrappedValue: String {
        didSet { wrappedValue = wrappedValue.capitalized }
    }
    init(wrappedValue: String) {
        self.wrappedValue = wrappedValue.capitalized
    }
}

@propertyWrapper
struct Trimmed {
    var wrappedValue: String {
        didSet { wrappedValue = wrappedValue.trimmingCharacters(in: .whitespaces) }
    }
    init(wrappedValue: String) {
        self.wrappedValue = wrappedValue.trimmingCharacters(in: .whitespaces)
    }
}

struct Form {
    @Capitalized @Trimmed var name: String = "  ada  "
}

var form = Form()
print(form.name)   // "Ada" — Trimmed runs first (innermost), then Capitalized wraps its result
```

Composition order matters (innermost wrapper applies first, closest to the raw value), and debugging deeply-stacked wrappers can become confusing quickly — in practice, most real-world code uses at most one property wrapper per property, reserving composition for narrow, well-understood cases.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Result builders | Transform a block of statements into a single combined value at compile time |
| `buildBlock` | The minimum required method — combines a sequence of components into one result |
| `buildOptional`/`buildEither` | Enable `if` and `if/else` support inside a result-builder-annotated closure |
| `@ViewBuilder` | SwiftUI's own result builder — the exact same mechanism, applied to combining `View` values |
| Property wrapper anatomy | A `@propertyWrapper` struct with a required `wrappedValue`, intercepting every read/write |
| Projected value (`$`) | An optional secondary value exposed via `$property`, e.g. how `@State` produces a `Binding` |
| Custom wrappers | Package cross-cutting concerns (persistence, validation, logging) into a reusable, declarative attribute |
| Limitations | Only stored properties, not computed ones; composing multiple wrappers works but adds complexity |

**Next up:** [Section 13 — Macros](/articles/macros).
