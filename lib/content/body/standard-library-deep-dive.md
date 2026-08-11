## 14.1 `Sequence` and `IteratorProtocol`

`Sequence` is the most basic protocol enabling `for-in` iteration — it requires only a `makeIterator()` method returning something conforming to `IteratorProtocol`, which itself requires just one method: `next()`, returning the next element or `nil` when exhausted.

```swift
struct Countdown: Sequence {
    let start: Int

    func makeIterator() -> CountdownIterator {
        CountdownIterator(current: start)
    }
}

struct CountdownIterator: IteratorProtocol {
    var current: Int
    mutating func next() -> Int? {
        guard current > 0 else { return nil }
        defer { current -= 1 }
        return current
    }
}

for number in Countdown(start: 3) {
    print(number)   // 3, 2, 1
}
```

Every `for-in` loop you've written since section 2 desugars to exactly this: call `makeIterator()`, then repeatedly call `next()` until it returns `nil`. `map`, `filter`, and friends (section 3) are all defined in terms of `Sequence`, which is why any custom type conforming to it gets those operations for free.

---

## 14.2 `Collection` and Its Index Model

`Collection` refines `Sequence` by adding random access via indices — `startIndex`, `endIndex`, and a way to advance an index (`index(after:)`) — enabling subscript access (`collection[index]`) rather than only sequential iteration.

```swift
protocol Collection: Sequence {
    associatedtype Index: Comparable
    var startIndex: Index { get }
    var endIndex: Index { get }   // "one past the last valid index"
    subscript(position: Index) -> Element { get }
    func index(after i: Index) -> Index
}
```

This is exactly the index model you saw with `String.Index` back in section 1.7 — `String` conforms to `Collection` (via `BidirectionalCollection`, see 14.3), which is precisely why it uses `startIndex`/`endIndex`/`index(after:)` instead of plain integers.

---

## 14.3 `BidirectionalCollection` and `RandomAccessCollection`

`BidirectionalCollection` adds `index(before:)`, enabling backward traversal (needed for things like `.last`, or iterating in reverse). `RandomAccessCollection` further guarantees that computing the distance between any two indices, or advancing by an arbitrary offset, is O(1) — not just possible, but *fast*.

```swift
// String is BidirectionalCollection but NOT RandomAccessCollection,
// because grapheme clusters have variable byte-width (recall 1.7/1.9) —
// jumping forward N characters requires scanning, not O(1) arithmetic.

// Array IS RandomAccessCollection — arr[500] and arr[999] are both O(1),
// and computing the distance between two array indices is instant arithmetic.
let arr = Array(1...1000)
let distance = arr.distance(from: arr.startIndex, to: arr.index(arr.startIndex, offsetBy: 500))
print(distance)   // 500, computed instantly
```

This hierarchy — `Sequence` → `Collection` → `BidirectionalCollection` → `RandomAccessCollection` — is exactly why `String` deliberately lacks integer subscripting (1.7) while `Array` has it: the protocols themselves encode the actual complexity guarantees each type can honestly provide.

---

## 14.4 `RangeReplaceableCollection` and `MutableCollection`

`MutableCollection` adds the ability to *change* existing elements in place via subscript assignment (`collection[i] = newValue`), without changing the collection's length. `RangeReplaceableCollection` goes further, supporting insertion, removal, and appending — changing the collection's actual size (this is what gives `Array` its `append`, `insert`, `remove` methods from section 3.2).

```swift
var numbers = [1, 2, 3]
numbers[0] = 100          // MutableCollection: in-place element replacement
numbers.append(4)          // RangeReplaceableCollection: changes the count
numbers.removeFirst()      // RangeReplaceableCollection: changes the count
print(numbers)   // [100, 3, 4]
```

`Set` and `Dictionary`, notably, are **not** `RangeReplaceableCollection` in the same sense — they have their own specialized insertion/removal APIs (recall sections 3.4–3.7), since "range" doesn't meaningfully apply to their unordered structure.

---

## 14.5 Writing a Custom `Collection`

Combining 14.1–14.4, here's a minimal custom `Collection` — a fixed-size circular buffer exposing standard collection operations for free once the core requirements are satisfied:

```swift
struct FixedStack<Element>: Collection {
    private var elements: [Element] = []

    var startIndex: Int { elements.startIndex }
    var endIndex: Int { elements.endIndex }

    subscript(position: Int) -> Element { elements[position] }

    func index(after i: Int) -> Int { elements.index(after: i) }

    mutating func push(_ element: Element) {
        elements.append(element)
    }
}

var stack = FixedStack<Int>()
stack.push(1)
stack.push(2)
stack.push(3)

print(stack.map { $0 * 2 })         // [2, 4, 6] — map works automatically
print(stack.filter { $0 > 1 })       // [2, 3] — filter works automatically
print(stack.count)                    // 3 — count works automatically
```

This is the real payoff of the `Sequence`/`Collection` protocol hierarchy: implement four small requirements (`startIndex`, `endIndex`, `subscript`, `index(after:)`), and every higher-order operation from section 3 (`map`, `filter`, `reduce`, `first(where:)`, and dozens more) becomes available automatically, entirely for free.

---

## 14.6 `Codable`: Automatic Synthesis

`Codable` (a combination of `Encodable` and `Decodable`) enables converting a type to and from external representations like JSON. For simple structs whose properties are all themselves `Codable`, Swift synthesizes the entire implementation automatically:

```swift
struct User: Codable {
    var name: String
    var age: Int
}

let user = User(name: "Nahidul", age: 28)

let encoder = JSONEncoder()
let data = try encoder.encode(user)
print(String(data: data, encoding: .utf8)!)
// {"name":"Nahidul","age":28}

let decoder = JSONDecoder()
let decoded = try decoder.decode(User.self, from: data)
print(decoded.name)   // "Nahidul"
```

No manual encoding/decoding code is required at all here — as long as every property is itself `Codable` (which all the basic types, `Array`, `Dictionary`, and `Optional` of `Codable` types already are), the compiler generates a complete, correct implementation.

---

## 14.7 `CodingKeys` and Key Remapping

When your Swift property names don't match the external JSON key names (a very common situation — JSON often uses `snake_case` while Swift convention is `camelCase`), a `CodingKeys` enum lets you remap them explicitly, while keeping automatic synthesis for everything else:

```swift
struct User: Codable {
    var fullName: String
    var yearsOld: Int

    enum CodingKeys: String, CodingKey {
        case fullName = "full_name"
        case yearsOld = "age"
    }
}

let json = """
{"full_name": "Nahidul", "age": 28}
""".data(using: .utf8)!

let user = try JSONDecoder().decode(User.self, from: json)
print(user.fullName)   // "Nahidul"
```

`CodingKeys` must list every property you want encoded/decoded (omitting one excludes it from both directions), and its raw values are what actually appear in the encoded JSON — the enum case names are just the Swift-side mapping.

---

## 14.8 Custom `init(from:)` and `encode(to:)`

When automatic synthesis isn't flexible enough — non-standard JSON shapes, computed transformations during decoding, conditional logic — you implement `Decodable`'s `init(from:)` and `Encodable`'s `encode(to:)` by hand:

```swift
struct Temperature: Codable {
    var celsius: Double

    enum CodingKeys: String, CodingKey {
        case fahrenheit
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let f = try container.decode(Double.self, forKey: .fahrenheit)
        celsius = (f - 32) / 1.8   // transform during decode
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(celsius * 9 / 5 + 32, forKey: .fahrenheit)
    }
}
```

Here, the external JSON representation (`fahrenheit`) is entirely different from the internal Swift storage (`celsius`) — a transformation automatic synthesis simply couldn't express, requiring the manual implementation to bridge the two representations explicitly.

---

## 14.9 Nested and Keyed Containers

Real-world JSON is often nested — objects inside objects, arrays of objects — and `Codable`'s container APIs (`nestedContainer`, `nestedUnkeyedContainer`) let you navigate that structure explicitly during manual decoding:

```swift
struct Response: Decodable {
    var username: String

    enum CodingKeys: String, CodingKey {
        case data
    }
    enum DataKeys: String, CodingKey {
        case user
    }
    enum UserKeys: String, CodingKey {
        case name
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let dataContainer = try container.nestedContainer(keyedBy: DataKeys.self, forKey: .data)
        let userContainer = try dataContainer.nestedContainer(keyedBy: UserKeys.self, forKey: .user)
        username = try userContainer.decode(String.self, forKey: .name)
    }
}

// decodes: {"data": {"user": {"name": "Nahidul"}}}
```

For most nested JSON, though, it's simpler to model the nesting directly as nested `Codable` structs and let automatic synthesis handle each layer — manual nested containers are typically reserved for cases where the Swift model's shape genuinely needs to differ from the JSON's shape.

---

## 14.10 Decoding Heterogeneous and Polymorphic JSON

A common, genuinely tricky real-world problem: JSON where a field's shape depends on another field's value (e.g. a `"type"` discriminator determining which additional fields are present) — `Codable` doesn't handle this automatically, but supports it via manual `init(from:)` logic that inspects a discriminator first:

```swift
protocol Shape: Decodable { }

struct Circle: Shape {
    var radius: Double
}
struct Square: Shape {
    var side: Double
}

enum ShapeWrapper: Decodable {
    case circle(Circle)
    case square(Square)

    enum CodingKeys: String, CodingKey {
        case type
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)
        let singleValueContainer = try decoder.singleValueContainer()
        switch type {
        case "circle":
            self = .circle(try singleValueContainer.decode(Circle.self))
        case "square":
            self = .square(try singleValueContainer.decode(Square.self))
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "Unknown shape type")
        }
    }
}
```

This pattern — decode a discriminator field first, then branch to decode the rest of the payload according to that discriminator — is the standard approach for polymorphic JSON, and maps naturally onto an enum with associated values (recalling section 6.17/6.22's "make illegal states unrepresentable" theme).

---

## 14.11 `JSONDecoder` Strategies: Keys, Dates, Data

Beyond per-type `CodingKeys`, `JSONDecoder` (and `JSONEncoder`) support global **strategies** that apply automatically across an entire decode, covering common conventions without per-property boilerplate:

```swift
struct Event: Codable {
    var eventName: String   // JSON: "event_name" — auto-converted, no CodingKeys needed
    var startDate: Date
}

let decoder = JSONDecoder()
decoder.keyDecodingStrategy = .convertFromSnakeCase   // event_name -> eventName automatically
decoder.dateDecodingStrategy = .iso8601                 // parses ISO 8601 date strings into Date

let json = """
{"event_name": "Launch", "start_date": "2026-08-03T10:00:00Z"}
""".data(using: .utf8)!

let event = try decoder.decode(Event.self, from: json)
print(event.eventName)   // "Launch"
```

Other common strategies include `.base64` for `Data` fields (the default, decoding base64-encoded strings into raw bytes) and custom closures for both keys and dates when a project's convention doesn't match one of the built-in options.

---

## 14.12 Regex Literals and Matching

Since Swift 5.7, regular expressions are a first-class language feature — a regex literal (`/pattern/`) is checked and type-inferred at *compile time*, catching malformed patterns before runtime, unlike a regex built from a plain string:

```swift
let text = "Contact: nahid@example.com or 555-1234"

if let match = text.firstMatch(of: /[\w.]+@[\w.]+/) {
    print(match.0)   // "nahid@example.com"
}

let phonePattern = /(\d{3})-(\d{4})/
if let match = text.firstMatch(of: phonePattern) {
    print(match.0)   // "555-1234" — the full match
    print(match.1)   // "555"       — first capture group
    print(match.2)   // "1234"      — second capture group
}
```

Regex literals give you strongly-typed capture groups (`match.1`, `match.2` above are inferred as `Substring`, not `Any`), which is a meaningful improvement over `NSRegularExpression`'s stringly-typed, manually-indexed API from the Objective-C era.

---

## 14.13 `RegexBuilder` DSL

For complex patterns, `RegexBuilder` (paired with the result-builder mechanism from section 12) lets you construct a regex declaratively, composed from named, reusable pieces — often far more readable than a dense inline pattern string:

```swift
import RegexBuilder

let areaCode = Reference(Substring.self)
let number = Reference(Substring.self)

let phoneRegex = Regex {
    Capture(as: areaCode) {
        Repeat(.digit, count: 3)
    }
    "-"
    Capture(as: number) {
        Repeat(.digit, count: 4)
    }
}

let text = "Call 555-1234 today"
if let match = text.firstMatch(of: phoneRegex) {
    print(match[areaCode])   // "555"
    print(match[number])     // "1234"
}
```

`RegexBuilder` trades some conciseness for significantly better readability and named (rather than positionally-numbered) capture group access — valuable for complex patterns that would otherwise become an unreadable wall of regex syntax.

---

## 14.14 `FormatStyle` for Numbers and Currency

`FormatStyle` (used via the `.formatted()` method) replaces older, more verbose `NumberFormatter`/`DateFormatter` APIs with a concise, type-safe, locale-aware alternative:

```swift
let price = 1234.5

print(price.formatted(.currency(code: "USD")))     // "$1,234.50"
print(price.formatted(.number.precision(.fractionLength(1))))   // "1,234.5"
print(0.42.formatted(.percent))                       // "42%"

let count = 3
print(count.formatted(.number.grouping(.never)))     // "3"
```

The locale-awareness is automatic and significant: the exact same `.formatted(.currency(code: "USD"))` call produces different grouping/decimal separator conventions depending on the user's current locale, without any additional code — something `NumberFormatter` required considerably more boilerplate to configure correctly.

---

## 14.15 `FormatStyle` for Dates and Relative Time

The same `FormatStyle` system extends to dates, including human-friendly relative phrasing ("2 hours ago," "in 3 days") without manually computing time differences:

```swift
let date = Date()

print(date.formatted(date: .abbreviated, time: .shortened))   // e.g. "Aug 3, 2026 at 2:30 PM"
print(date.formatted(.dateTime.year().month().day()))          // e.g. "August 3, 2026"

let pastDate = Calendar.current.date(byAdding: .hour, value: -2, to: date)!
print(pastDate.formatted(.relative(presentation: .named)))      // "2 hours ago"
```

This system is what powers the relative timestamps commonly seen throughout iOS (Messages, Mail, and similar apps) without every app needing to hand-roll its own "time ago" calculation logic.

---

## 14.16 `Measurement` and Unit Conversion

`Measurement<UnitType>` pairs a numeric value with an explicit unit, and supports automatic, type-safe conversion between compatible units — eliminating an entire category of manual unit-conversion arithmetic bugs:

```swift
let distance = Measurement(value: 5, unit: UnitLength.kilometers)
let inMiles = distance.converted(to: .miles)
print(inMiles)   // 3.10686 mi

let temperature = Measurement(value: 100, unit: UnitTemperature.celsius)
print(temperature.converted(to: .fahrenheit))   // 212.0 °F

let total = Measurement(value: 5, unit: UnitLength.kilometers) + Measurement(value: 500, unit: .meters)
print(total.converted(to: .kilometers))   // 5.5 km — arithmetic across different but compatible units
```

Because the unit is part of the value's type-level information (not just a number you have to remember the meaning of separately), you get compile-time protection against accidentally treating meters as miles — directly related to the phantom-type pattern from section 8.13, applied to a real, ready-to-use standard-library type.

---

## 14.17 `AttributedString` and Markdown

`AttributedString` represents text with formatting information (bold, color, links) attached directly to specific ranges of the string — a modern, value-type replacement for `NSAttributedString`, with built-in Markdown parsing support:

```swift
var text = AttributedString("Hello, bold world!")
if let range = text.range(of: "bold") {
    text[range].font = .boldSystemFont(ofSize: 16)
}

let markdown = try! AttributedString(markdown: "This is **bold** and this is *italic*")
// "bold" and "italic" ranges automatically carry the appropriate formatting attributes
```

This is heavily used in SwiftUI's `Text` view (section 23), which accepts an `AttributedString` directly — letting you author simple rich text (bold, links, emphasis) using ordinary Markdown syntax rather than manually constructing formatting ranges.

---

## 14.18 `Duration`, `Instant`, and `Clock`

`Duration` represents a span of time with high precision (down to attoseconds) and a type-safe API, replacing ambiguous raw `Double` seconds/milliseconds values that were easy to mix up:

```swift
let timeout: Duration = .seconds(30)
let shortDelay: Duration = .milliseconds(500)
let combined = timeout + shortDelay
print(combined)   // 30.5 seconds
```

`Clock` is a protocol abstracting "a way to measure time passing" — `ContinuousClock` and `SuspendingClock` (see 14.19) are the two standard-library conformers, and an `Instant` is a specific point in time as measured by a particular clock, supporting arithmetic with `Duration`:

```swift
let clock = ContinuousClock()
let start = clock.now
// ... do some work ...
let elapsed = clock.now - start
print(elapsed)   // e.g. "0.003 seconds" — an Instant minus an Instant produces a Duration
```

This whole system (`Duration`/`Clock`/`Instant`) is deeply integrated with Swift Concurrency's `Task.sleep(for:)` (covered in Part 2, section 17.6), replacing the older, more error-prone `DispatchTime`/raw-seconds APIs.

---

## 14.19 `ContinuousClock` vs `SuspendingClock`

The distinction between Swift's two standard clocks matters specifically around device sleep: `ContinuousClock` keeps ticking even while the device is asleep (measuring genuine elapsed wall-clock time), while `SuspendingClock` pauses while the device is asleep (measuring only time the device was actually awake and running).

```swift
// ContinuousClock: use for measuring real-world elapsed time,
// e.g. "how long has this download actually been running, including any sleep time"
let wallClock = ContinuousClock()

// SuspendingClock: use for measuring active execution time,
// e.g. "how much CPU-active time has this task consumed" — sleep time doesn't count
let activeClock = SuspendingClock()
```

Choosing the wrong one produces subtly incorrect results for anything spanning a potential sleep/wake cycle — a countdown timer for a user-facing feature almost always wants `ContinuousClock` (real elapsed time matters to the user, awake or not), while performance instrumentation measuring actual CPU-active duration might specifically want `SuspendingClock`.

---

## 14.20 The `Observation` Module and `withObservationTracking`

The `Observation` module (introduced in iOS 17/Swift 5.9, powering `@Observable` from section 13.5) provides fine-grained change tracking for a type's properties — `withObservationTracking` lets you register a callback that fires the *next* time any property actually accessed inside its closure changes:

```swift
@Observable
class Counter {
    var count = 0
}

let counter = Counter()

withObservationTracking {
    print("Current count: \(counter.count)")   // accessing "count" registers it for tracking
} onChange: {
    print("count changed!")   // fires exactly once, the next time count changes
}

counter.count += 1   // "count changed!" fires here
```

The key advantage over the older `ObservableObject`/`@Published` system (covered for legacy literacy in section 25.12): tracking is precise, per-property, and determined dynamically by which properties were actually *read* during the tracked closure — not a blanket "notify on any change to any property" broadcast, which is what makes `@Observable`-backed SwiftUI views re-render only when a property they genuinely display actually changes.

---

## 14.21 `Synchronization`: `Mutex` and `Atomic`

The `Synchronization` module (Swift 6) provides low-level, high-performance primitives for protecting shared mutable state across threads, as an alternative to older lock types (`NSLock`, covered in section 10.5/22.5) or full actor isolation (Part 2) when you specifically need lightweight, low-level synchronization:

```swift
import Synchronization

let counter = Mutex(0)

counter.withLock { value in
    value += 1
}

print(counter.withLock { $0 })   // 1
```

`Atomic<T>` provides lock-free atomic operations for simple values (like a counter or flag) shared across threads, appropriate when a full `Mutex` (or an actor) would be heavier machinery than the situation actually needs — both are specialized, performance-oriented tools most relevant for library authors or code with proven, measured contention on a specific piece of shared state, not a default first reach for everyday app-level concurrency (which should generally prefer actors, covered in Part 2, section 19).

---

## 14.22 `Subprocess` 1.0 basics

`Subprocess` is a modern Swift API (reaching 1.0 alongside recent Swift/toolchain releases) for launching and communicating with external processes — replacing the older, more cumbersome Foundation `Process` API with a structured-concurrency-friendly, `async`/`await`-based interface:

```swift
import Subprocess

let result = try await run(.name("echo"), arguments: ["Hello from a subprocess"])
print(String(decoding: result.standardOutput, as: UTF8.self))
// "Hello from a subprocess"
```

This is primarily relevant for command-line tools, server-side Swift (Part 12), or build/automation scripts written in Swift rather than typical iOS app code (sandboxed iOS apps generally cannot spawn arbitrary subprocesses at all) — included here as a standard-library-adjacent tool worth recognizing, not one you'll reach for in ordinary app development.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `Sequence`/`IteratorProtocol` | The minimal protocol enabling `for-in`; every `for-in` loop desugars to this |
| `Collection` | Adds indexed, subscript-based access on top of `Sequence` |
| `Bidirectional`/`RandomAccessCollection` | Encode complexity guarantees — why `String` lacks `Int` subscripting but `Array` has it |
| `RangeReplaceable`/`MutableCollection` | Enable in-place mutation and size-changing operations like `append`/`insert`/`remove` |
| Custom `Collection` | Implement 4 requirements, get `map`/`filter`/`reduce`/dozens more for free |
| `Codable` synthesis | Automatic for simple, all-`Codable`-member structs |
| `CodingKeys` | Remaps Swift property names to different external JSON key names |
| Custom `init(from:)`/`encode(to:)` | Hand-write encoding/decoding when synthesis can't express the needed transformation |
| Nested containers | Navigate nested JSON structure explicitly during manual decoding |
| Polymorphic JSON | Decode a discriminator field first, then branch — maps naturally onto enums |
| Decoder/encoder strategies | Global key/date/data conventions applied without per-property boilerplate |
| Regex literals | Compile-time-checked `/pattern/` syntax with strongly-typed capture groups |
| `RegexBuilder` | A declarative, composable DSL alternative to dense inline regex patterns |
| `FormatStyle` (numbers) | Concise, locale-aware formatting via `.formatted(...)` |
| `FormatStyle` (dates) | Includes human-friendly relative phrasing like "2 hours ago" |
| `Measurement` | Type-safe values with units, supporting automatic, safe conversion |
| `AttributedString` | Value-type rich text with built-in Markdown parsing, used directly by SwiftUI `Text` |
| `Duration`/`Clock`/`Instant` | Type-safe time spans and clock abstractions, replacing raw-seconds APIs |
| `ContinuousClock` vs `SuspendingClock` | Keeps ticking through sleep vs. pauses during sleep |
| `Observation`/`withObservationTracking` | Fine-grained, per-property change tracking underlying `@Observable` |
| `Mutex`/`Atomic` | Low-level thread-safety primitives for specific, measured contention needs |
| `Subprocess` | Modern async API for launching external processes, mainly for CLI/server Swift |

**Next up:** [Section 15 — Low-Level Swift](/articles/low-level-swift).
