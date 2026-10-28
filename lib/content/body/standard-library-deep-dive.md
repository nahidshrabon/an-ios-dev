**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 14.1 `Sequence` and `IteratorProtocol` 🟡

**`Sequence`** is the most basic protocol for `for-in` loops. It needs only one method, **`makeIterator()`**. That returns an **iterator** (`IteratorProtocol`), which needs only one method too: **`next()`**. It returns the next element, or **`nil`** when there are no more.

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

Every `for-in` loop (section 2) is really this:

```swift
// What you write:
for number in Countdown(start: 3) { print(number) }

// What Swift does:
var iterator = Countdown(start: 3).makeIterator()
while let number = iterator.next() {
    print(number)
}
```

And because `map`, `filter`, `contains`, `reduce` (section 3) are written **for `Sequence`**, your type gets them **for free**:

```swift
Countdown(start: 5).map { $0 * 10 }      // [50, 40, 30, 20, 10]
Countdown(start: 5).filter { $0.isMultiple(of: 2) }   // [4, 2]
```

A quick way to make a sequence without a new type: `sequence(first:next:)`:

```swift
let powersOfTwo = sequence(first: 1) { $0 < 100 ? $0 * 2 : nil }
print(Array(powersOfTwo))   // [1, 2, 4, 8, 16, 32, 64, 128]
```

---

## 14.2 `Collection` and Its Index Model 🟡

**`Collection`** builds on `Sequence`. It adds **indices**: `startIndex`, `endIndex`, and a way to move to the next index (`index(after:)`). With these, you can read elements by **subscript** (`collection[index]`), and loop over the same collection **many times**.

```swift
protocol Collection: Sequence {
    associatedtype Index: Comparable
    var startIndex: Index { get }
    var endIndex: Index { get }   // "one past the last valid index"
    subscript(position: Index) -> Element { get }
    func index(after i: Index) -> Index
}
```

| | `Sequence` | `Collection` |
|---|---|---|
| Loop over it | ✅ | ✅ |
| Loop **again** | Not guaranteed | ✅ Always |
| `count`, `isEmpty`, `first` | Some, maybe slow | ✅ |
| Subscript with an index | ❌ | ✅ |

The index is **not always an `Int`**. This is exactly the `String.Index` model from 1.7: `String` is a `Collection` whose index is `String.Index`.

```swift
let word = "Swift"
var i = word.startIndex
while i != word.endIndex {
    print(word[i])               // S, w, i, f, t
    i = word.index(after: i)
}
```

---

## 14.3 `BidirectionalCollection` and `RandomAccessCollection` 🔴

- **`BidirectionalCollection`** adds `index(before:)`: you can go **backward**. That's needed for `last`, `reversed()`, and `dropLast()`.
- **`RandomAccessCollection`** promises that **jumping** any distance, and **measuring** the distance between two indices, is **O(1)**: not just possible, but **fast**.

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

```plaintext
Sequence                       for-in
  └─ Collection                indices, subscript, count
       └─ BidirectionalCollection   go backward: last, reversed()
            └─ RandomAccessCollection   jump anywhere in O(1)

String:  up to Bidirectional
Array:   all the way to RandomAccess
```

This hierarchy explains why `String` has **no `Int` subscript** (1.7) but `Array` does: the protocols **describe honestly** how fast each type can be.

It also matters for **your own code**. Some algorithms are only fast on random-access collections, so you can require that:

```swift
func middle<C: RandomAccessCollection>(_ items: C) -> C.Element? {
    guard !items.isEmpty else { return nil }
    let mid = items.index(items.startIndex, offsetBy: items.count / 2)   // O(1) here
    return items[mid]
}

middle([1, 2, 3, 4, 5])   // 3
// middle("hello")        // ❌ String isn't RandomAccessCollection
```

---

## 14.4 `RangeReplaceableCollection` and `MutableCollection` 🟡

- **`MutableCollection`**: you can **replace** elements in place (`collection[i] = newValue`). The **count stays the same**.
- **`RangeReplaceableCollection`**: you can **insert, remove, and append**. The **count changes**. This is where `Array` gets `append`, `insert`, and `remove` (3.2).

```swift
var numbers = [1, 2, 3]
numbers[0] = 100          // MutableCollection: in-place element replacement
numbers.append(4)          // RangeReplaceableCollection: changes the count
numbers.removeFirst()      // RangeReplaceableCollection: changes the count
print(numbers)   // [100, 3, 4]
```

| Type | `MutableCollection` | `RangeReplaceableCollection` |
|---|---|---|
| `Array` | ✅ | ✅ |
| `String` | ❌ (characters vary in size) | ✅ (`append`, `insert`) |
| `Set`, `Dictionary` | ❌ | ❌ (they have their own `insert`/`remove`) |

`Set` and `Dictionary` aren't range-replaceable: they have **no order**, so "replace the range from index 2 to 5" doesn't make sense for them (3.4–3.7).

Some useful in-place algorithms come from `MutableCollection`:

```swift
var scores = [70, 95, 82, 60]
scores.sort()                                   // [60, 70, 82, 95]
scores.reverse()                                // [95, 82, 70, 60]
let split = scores.partition { $0 < 75 }        // moves < 75 to the end, returns the split index
```

---

## 14.5 Writing a Custom `Collection` 🔴

Putting 14.1–14.4 together: a small custom `Collection`, a stack that exposes all the standard operations once the core requirements are met:

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

**The payoff:** write **four** small requirements (`startIndex`, `endIndex`, `subscript`, `index(after:)`), and you get **dozens** of operations for free: `map`, `filter`, `reduce`, `first(where:)`, `contains`, `isEmpty`, `count`, `firstIndex(of:)`, `prefix`, `dropFirst`, and many more.

Because the storage is an array, it's easy to go further. Adding `RandomAccessCollection` costs **nothing extra** here, since `Int` indices already support it:

```swift
extension FixedStack: RandomAccessCollection { }

stack.last          // Optional(3) — from BidirectionalCollection
stack.reversed()    // [3, 2, 1]
```

And SwiftUI's `ForEach` and `List` accept any `RandomAccessCollection`, so this works directly:

```swift
ForEach(stack, id: \.self) { Text("\($0)") }
```

---

## 14.6 `Codable`: Automatic Synthesis 🟢

**`Codable`** (short for `Encodable & Decodable`) converts a type **to and from** outside formats like **JSON**. For a struct whose properties are **all `Codable`**, Swift **writes the whole implementation for you**:

```swift
struct User: Codable {
    var name: String
    var age: Int
}

let user = User(name: "Alex", age: 28)

let encoder = JSONEncoder()
let data = try encoder.encode(user)
print(String(data: data, encoding: .utf8)!)
// {"name":"Alex","age":28}

let decoder = JSONDecoder()
let decoded = try decoder.decode(User.self, from: data)
print(decoded.name)   // "Alex"
```

Already `Codable`: `String`, `Int`, `Double`, `Bool`, `Date`, `URL`, `UUID`, `Data`, and any `Array`, `Dictionary`, `Set`, or `Optional` of `Codable` types. Enums with raw values or associated values can be `Codable` too.

**Optional properties** are fine. If the key is **missing** in the JSON, the value is just `nil`:

```swift
struct Profile: Codable {
    var name: String
    var bio: String?     // missing "bio" in JSON → nil, no error
}
```

When decoding **fails**, the error says exactly what is wrong. Print it while debugging:

```swift
do {
    _ = try JSONDecoder().decode(User.self, from: Data(#"{"name": "Alex"}"#.utf8))
} catch {
    print(error)
    // keyNotFound(CodingKeys(stringValue: "age", ...), ... "No value associated with key age")
}
```

Make encoded JSON **readable** for debugging:

```swift
encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
```

---

## 14.7 `CodingKeys` and Key Remapping 🟢

Often your Swift names **don't match** the JSON keys (JSON often uses `snake_case`; Swift uses `camelCase`). A **`CodingKeys`** enum maps them, and keeps automatic synthesis for everything else:

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
{"full_name": "Alex", "age": 28}
""".data(using: .utf8)!

let user = try JSONDecoder().decode(User.self, from: json)
print(user.fullName)   // "Alex"
```

Rules:

- The **case name** is your Swift property name. The **raw value** is the JSON key.
- `CodingKeys` must list **every property you want encoded and decoded**.
- **Leaving a property out** skips it in both directions. It then needs a **default value**:

```swift
struct Post: Codable {
    var title: String
    var isExpanded = false        // UI-only state, not in the JSON

    enum CodingKeys: String, CodingKey {
        case title                // isExpanded is left out on purpose
    }
}
```

(If **all** your differences are just snake_case vs camelCase, a decoder strategy (14.11) is simpler.)

---

## 14.8 Custom `init(from:)` and `encode(to:)` 🟡

When automatic synthesis **can't express** what you need (an odd JSON shape, a conversion while decoding, a fallback value), write **`init(from:)`** and **`encode(to:)`** yourself:

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

Here the JSON stores `fahrenheit`, but the Swift type stores `celsius`. Synthesis can't do that conversion.

A very common real need: a **default value** when a key is missing, instead of failing:

```swift
struct Settings: Decodable {
    var theme: String
    var fontSize: Int

    enum CodingKeys: String, CodingKey { case theme, fontSize }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        theme = try container.decodeIfPresent(String.self, forKey: .theme) ?? "system"
        fontSize = try container.decodeIfPresent(Int.self, forKey: .fontSize) ?? 16
    }
}
```

| Method | If the key is missing |
|---|---|
| `decode(_:forKey:)` | Throws `keyNotFound` |
| `decodeIfPresent(_:forKey:)` | Returns `nil` |

Note: if you write `init(from:)` in the **struct** itself, you lose the free memberwise init. Put it in an **extension** to keep both (6.2).

---

## 14.9 Nested and Keyed Containers 🔴

Real JSON is often **nested**: objects inside objects. The container APIs (`nestedContainer`, `nestedUnkeyedContainer`) let you **walk into** that structure while decoding:

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

// decodes: {"data": {"user": {"name": "Alex"}}}
```

This **flattens** three levels of JSON into one simple Swift property.

The other option: model the nesting with **small nested structs**, and let synthesis do the work. It's usually **simpler**:

```swift
struct ResponseDTO: Decodable {
    struct DataPart: Decodable {
        struct UserPart: Decodable { let name: String }
        let user: UserPart
    }
    let data: DataPart
}

let dto = try JSONDecoder().decode(ResponseDTO.self, from: json)
let username = dto.data.user.name
```

Use manual nested containers when your Swift model **must** have a different shape than the JSON.

---

## 14.10 Decoding Heterogeneous and Polymorphic JSON 🔴

A common, tricky case: JSON where the **shape depends on a field**, often a **`"type"`** field (a "discriminator"):

```json
[
  {"type": "circle", "radius": 2},
  {"type": "square", "side": 3}
]
```

`Codable` can't do this automatically. The standard solution: **read the `type` first**, then decode the rest based on it, into an **enum with associated values**:

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
        switch type {
        case "circle":
            self = .circle(try Circle(from: decoder))   // decode the same JSON object as a Circle
        case "square":
            self = .square(try Square(from: decoder))
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "Unknown shape type")
        }
    }
}

let shapes = try JSONDecoder().decode([ShapeWrapper].self, from: json)
for shape in shapes {
    switch shape {
    case .circle(let c): print("circle, radius \(c.radius)")
    case .square(let s): print("square, side \(s.side)")
    }
}
```

`Circle(from: decoder)` reads the **same** JSON object again, using `Circle`'s own synthesized decoding. The extra `"type"` key is simply ignored.

**Tip for servers that add new types later:** instead of throwing for an unknown type, add a `case unknown` and decode it **safely**. Then one new type from the server doesn't break the whole list:

```swift
default:
    self = .unknown(type)       // ignore it in the UI, instead of failing everything
```

---

## 14.11 `JSONDecoder` Strategies: Keys, Dates, Data 🟢

Besides per-type `CodingKeys`, `JSONDecoder` and `JSONEncoder` have **strategies** that apply to the **whole** decode. They cover common conventions without per-property code:

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

| Strategy | Common values |
|---|---|
| `keyDecodingStrategy` | `.useDefaultKeys`, `.convertFromSnakeCase`, `.custom { ... }` |
| `dateDecodingStrategy` | `.deferredToDate` (default), `.iso8601`, `.secondsSince1970`, `.formatted(...)`, `.custom { ... }` |
| `dataDecodingStrategy` | `.base64` (default), `.custom { ... }` |

A `.custom` date strategy, for a server that sends dates **with fractional seconds** (which `.iso8601` can't parse):

```swift
decoder.dateDecodingStrategy = .custom { decoder in
    let text = try decoder.singleValueContainer().decode(String.self)
    if let date = try? Date(text, strategy: .iso8601.year().month().day()
        .time(includingFractionalSeconds: true)) {
        return date
    }
    throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath,
                                            debugDescription: "Bad date: \(text)"))
}
```

**Tip:** create and configure your decoder **once** (for example in your API client), so every request uses the same rules.

---

## 14.12 Regex Literals and Matching 🟡

Since Swift 5.7, regular expressions are part of the language. A **regex literal** (`/pattern/`) is **checked at compile time**: a broken pattern is a **compile error**, not a runtime crash.

```swift
let text = "Contact: alex@example.com or 555-1234"

if let match = text.firstMatch(of: /[\w.]+@[\w.]+/) {
    print(match.0)   // "alex@example.com"
}

let phonePattern = /(\d{3})-(\d{4})/
if let match = text.firstMatch(of: phonePattern) {
    print(match.0)   // "555-1234" — the full match
    print(match.1)   // "555"       — first capture group
    print(match.2)   // "1234"      — second capture group
}
```

Capture groups are **typed**: `match.1` is a `Substring`, not `Any`. That's much nicer than the old `NSRegularExpression` API.

**Name** the groups for clearer code:

```swift
let pattern = /(?<area>\d{3})-(?<number>\d{4})/
if let match = text.firstMatch(of: pattern) {
    print(match.area, match.number)    // 555 1234
}
```

Other useful operations:

```swift
let log = "a1 b22 c333"
log.matches(of: /\d+/).map(\.0)                  // ["1", "22", "333"] — all matches
log.contains(/\d{3}/)                             // true
log.replacing(/\d+/, with: "#")                   // "a# b# c#"
"2026-10-26".wholeMatch(of: /\d{4}-\d{2}-\d{2}/) != nil   // true: the whole string must match
```

---

## 14.13 `RegexBuilder` DSL 🔴

For complex patterns, **`RegexBuilder`** lets you **build** a regex from named pieces, using a result builder (section 12). It's often **much easier to read** than a dense pattern string:

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

A big feature: **`TryCapture`** can **convert** a capture into a real type while matching. If the conversion fails, the match fails:

```swift
let priceRegex = Regex {
    "$"
    TryCapture {
        OneOrMore(.digit)
        "."
        Repeat(.digit, count: 2)
    } transform: { Double($0) }        // the capture becomes a Double
}

if let match = "Total: $42.50".firstMatch(of: priceRegex) {
    let price: Double = match.1        // 42.5, already a Double
}
```

You can also mix in Foundation's **parsers**, like currency:

```swift
let totalRegex = Regex {
    "Total: "
    Capture(.localizedCurrency(code: "USD", locale: Locale(identifier: "en_US")))   // captures a Decimal
}

if let match = "Total: $1,299.99".firstMatch(of: totalRegex) {
    print(match.1)   // 1299.99
}
```

`RegexBuilder` is **longer** than a literal, but much **clearer** for complex patterns, and gives **named, typed** captures.

---

## 14.14 `FormatStyle` for Numbers and Currency 🟢

**`FormatStyle`** (used with `.formatted()`) replaces the older, wordy `NumberFormatter`. It's short, type-safe, and **locale-aware**:

```swift
let price = 1234.5

print(price.formatted(.currency(code: "USD")))     // "$1,234.50"
print(price.formatted(.number.precision(.fractionLength(1))))   // "1,234.5"
print(0.42.formatted(.percent))                       // "42%"

let count = 3
print(count.formatted(.number.grouping(.never)))     // "3"
```

**Locale-awareness is automatic.** The same line gives different results for users in different regions:

```swift
let amount = 1234.5
amount.formatted(.currency(code: "EUR").locale(Locale(identifier: "de_DE")))  // "1.234,50 €"
amount.formatted(.currency(code: "EUR").locale(Locale(identifier: "en_US")))  // "€1,234.50"
```

More useful styles:

```swift
1_500_000.formatted(.number.notation(.compactName))        // "1.5M"
Int64(5_300_000).formatted(.byteCount(style: .file))         // "5.3 MB"
["Alex", "Sam", "Kim"].formatted(.list(type: .and))           // "Alex, Sam, and Kim"
```

SwiftUI's `Text` takes a format directly, and updates when the locale changes:

```swift
Text(price, format: .currency(code: "USD"))
```

You can also **parse** text back into numbers with the same styles:

```swift
let parsed = try Double("1,234.50", format: .number)   // 1234.5
```

---

## 14.15 `FormatStyle` for Dates and Relative Time 🟢

The same system formats **dates**, including friendly **relative** text like "2 hours ago", with no manual math:

```swift
let date = Date()

print(date.formatted(date: .abbreviated, time: .shortened))   // e.g. "Aug 3, 2026 at 2:30 PM"
print(date.formatted(.dateTime.year().month().day()))          // e.g. "August 3, 2026"

let pastDate = Calendar.current.date(byAdding: .hour, value: -2, to: date)!
print(pastDate.formatted(.relative(presentation: .named)))      // "2 hours ago"
```

Pick only the **parts** you want, in any order. The locale decides the final order and words:

```swift
date.formatted(.dateTime.weekday(.wide).hour().minute())   // e.g. "Monday 2:30 PM"
date.formatted(.iso8601)                                    // "2026-08-03T14:30:00Z" (for APIs)
```

Ranges and durations:

```swift
let end = date.addingTimeInterval(90 * 60)
(date..<end).formatted(date: .omitted, time: .shortened)   // e.g. "2:30 – 4:00 PM"

Duration.seconds(5400).formatted(.units(allowed: [.hours, .minutes]))   // "1 hr, 30 min"
```

In SwiftUI, a relative date can **update by itself**:

```swift
Text(post.date, style: .relative)    // "5 minutes", then "6 minutes", automatically
```

This powers the relative timestamps across iOS (Messages, Mail), so you don't need your own "time ago" code.

---

## 14.16 `Measurement` and Unit Conversion 🟢

**`Measurement<UnitType>`** stores a number **together with its unit**, and converts between compatible units **safely**. No more manual conversion math:

```swift
let distance = Measurement(value: 5, unit: UnitLength.kilometers)
let inMiles = distance.converted(to: .miles)
print(inMiles)   // 3.10686 mi

let temperature = Measurement(value: 100, unit: UnitTemperature.celsius)
print(temperature.converted(to: .fahrenheit))   // 212.0 °F

let total = Measurement(value: 5, unit: UnitLength.kilometers) + Measurement(value: 500, unit: .meters)
print(total.converted(to: .kilometers))   // 5.5 km — arithmetic across different but compatible units
```

The **unit type** is part of the value's **type**. Mixing incompatible units is a **compile error**:

```swift
let length = Measurement(value: 1, unit: UnitLength.meters)
let weight = Measurement(value: 1, unit: UnitMass.kilograms)
// length + weight   // ❌ error: can't add UnitLength and UnitMass
```

It's the phantom-type idea from 8.13, ready to use.

Display it in the **user's preferred units** automatically:

```swift
let run = Measurement(value: 10, unit: UnitLength.kilometers)
run.formatted(.measurement(width: .abbreviated, usage: .road))
// "10 km" in Germany, "6.2 mi" in the US
```

---

## 14.17 `AttributedString` and Markdown 🟢

**`AttributedString`** is text with **formatting attached to parts of it** (bold, color, links). It's the modern, value-type replacement for `NSAttributedString`, and it can **parse Markdown**:

```swift
var text = AttributedString("Hello, bold world!")
if let range = text.range(of: "bold") {
    text[range].font = .body.bold()          // a SwiftUI Font
    text[range].foregroundColor = Color.orange
}

let markdown = try! AttributedString(markdown: "This is **bold** and this is *italic*")
// "bold" and "italic" ranges automatically carry the appropriate formatting attributes
```

SwiftUI's **`Text`** (section 23) accepts an `AttributedString` directly:

```swift
Text(text)
Text(markdown)
```

A string **literal** in `Text` is treated as Markdown automatically:

```swift
Text("Read our **[terms](https://example.com/terms)** before you continue.")
// "terms" is bold and a tappable link
```

(A `String` **variable** is not parsed. Wrap it: `Text(try AttributedString(markdown: someString))`.)

Attributes can also be set on **all** the text, or found again later:

```swift
var greeting = AttributedString("Welcome back, Alex")
greeting.font = .title
if let nameRange = greeting.range(of: "Alex") {
    greeting[nameRange].foregroundColor = Color.blue
}
```

---

## 14.18 `Duration`, `Instant`, and `Clock` 🟡

**`Duration`** is a span of time with **high precision** and a **clear, typed API**. It replaces raw `Double` seconds or milliseconds, which are easy to mix up:

```swift
let timeout: Duration = .seconds(30)
let shortDelay: Duration = .milliseconds(500)
let combined = timeout + shortDelay
print(combined)   // 30.5 seconds
```

A **`Clock`** measures time passing. Swift has two: `ContinuousClock` and `SuspendingClock` (14.19). An **`Instant`** is one point in time on a clock. You can subtract instants to get a `Duration`:

```swift
let clock = ContinuousClock()
let start = clock.now
// ... do some work ...
let elapsed = clock.now - start
print(elapsed)   // e.g. "0.003 seconds" — an Instant minus an Instant produces a Duration
```

`measure` does the same in one call:

```swift
let elapsed = ContinuousClock().measure {
    _ = (1...1_000_000).reduce(0, +)
}
print(elapsed)   // e.g. 0.0021 seconds
```

`Duration` is built into Swift concurrency's `Task.sleep(for:)` (section 17.6):

```swift
try await Task.sleep(for: .seconds(2))           // clear unit, no "nanoseconds" math
try await Task.sleep(for: .milliseconds(250))
```

Compare with the older API, where a missing zero is a silent bug:

```swift
try await Task.sleep(nanoseconds: 2_000_000_000)   // 2 seconds... if you counted the zeros right
```

---

## 14.19 `ContinuousClock` vs `SuspendingClock` 🔴

The two clocks differ when the **device sleeps**:

- **`ContinuousClock`** keeps ticking **while the device sleeps**. It measures **real elapsed time**.
- **`SuspendingClock`** **pauses** while the device sleeps. It measures only time the device was **awake**.

```swift
// ContinuousClock: use for measuring real-world elapsed time,
// e.g. "how long has this download actually been running, including any sleep time"
let wallClock = ContinuousClock()

// SuspendingClock: use for measuring active execution time,
// e.g. "how much CPU-active time has this task consumed" — sleep time doesn't count
let activeClock = SuspendingClock()
```

| Need | Clock |
|---|---|
| A countdown the user sees ("offer ends in 10 min") | `ContinuousClock` |
| Timeouts for network requests | `ContinuousClock` |
| Measuring how long code actually ran | `SuspendingClock` |

The wrong choice gives **subtle bugs** for anything that spans a sleep. A user-facing timer almost always wants `ContinuousClock`: real time passes for the user, whether the screen is on or not.

You can pass a clock to `Task.sleep` too:

```swift
try await Task.sleep(for: .seconds(60), clock: .continuous)
```

(Note: neither clock is "wall-clock time" you show to users as a date. For that, use `Date`.)

---

## 14.20 The `Observation` Module and `withObservationTracking` 🔴

The **`Observation`** module (iOS 17, Swift 5.9) powers `@Observable` (13.5). It tracks changes **per property**. **`withObservationTracking`** lets you register a callback that fires the **next time** any property **read inside its closure** changes:

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

Two details:

- `onChange` fires **once**. To keep observing, register again inside it.
- It fires **just before** the new value is set (like `willSet`), so read the new value later, for example in a `Task`.

A small helper that keeps observing:

```swift
func observe(_ counter: Counter) {
    withObservationTracking {
        _ = counter.count
    } onChange: {
        Task { @MainActor in
            print("count is now \(counter.count)")
            observe(counter)            // register again for the next change
        }
    }
}
```

**Why it's better than `ObservableObject`/`@Published`** (legacy, section 25.12): tracking is **per property**, based on what the code **actually read**. A SwiftUI view that only shows `count` re-renders only when `count` changes, not when any other property changes.

(Newer SDKs also add an `Observations` async sequence that makes continuous observation easier.)

---

## 14.21 `Synchronization`: `Mutex` and `Atomic` 🔴

The **`Synchronization`** module (Swift 6, iOS 18) has low-level, fast tools to protect **shared mutable state** across threads. They're an alternative to older locks (`NSLock`, section 22.5) or actors (Part 2), when you need something **small and fast**:

```swift
import Synchronization

let counter = Mutex(0)

counter.withLock { value in
    value += 1
}

print(counter.withLock { $0 })   // 1
```

`Mutex` **owns** the value. You can only touch it **inside** `withLock`, so you can't forget to lock. And `Mutex` is `Sendable`, so it works in a `final class` that must be `Sendable`:

```swift
final class Cache: Sendable {
    private let storage = Mutex<[String: Data]>([:])

    func value(for key: String) -> Data? {
        storage.withLock { $0[key] }
    }

    func store(_ data: Data, for key: String) {
        storage.withLock { $0[key] = data }
    }
}
```

**`Atomic`** does **lock-free** operations on simple values, like a counter or a flag:

```swift
let requestCount = Atomic<Int>(0)
requestCount.add(1, ordering: .relaxed)
print(requestCount.load(ordering: .relaxed))   // 1
```

These are **specialized** tools for library authors, or for code where you **measured** a real bottleneck. For everyday app code, prefer **actors** (section 19).

---

## 14.22 `Subprocess` 1.0 basics 🔴

**`Subprocess`** is a modern Swift package for **starting other programs** and reading their output. It replaces Foundation's older, clunky `Process` API with an `async`/`await` interface:

```swift
import Subprocess

let result = try await run(
    .name("echo"),
    arguments: ["Hello from a subprocess"],
    output: .string(limit: 4096)
)
print(result.standardOutput ?? "")
// "Hello from a subprocess"
print(result.terminationStatus)   // exited(0)
```

Compare with the old `Process` API:

```swift
let process = Process()
process.executableURL = URL(fileURLWithPath: "/bin/echo")
process.arguments = ["Hello"]
let pipe = Pipe()
process.standardOutput = pipe
try process.run()
process.waitUntilExit()
let data = pipe.fileHandleForReading.readDataToEndOfFile()
```

It's mainly for **command-line tools**, **server-side Swift** (section 81), and **build scripts** written in Swift. **iOS apps can't start other processes**: the sandbox doesn't allow it. Know that it exists; you won't use it in app code.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `Sequence`/`IteratorProtocol` | `makeIterator()` + `next()`; every `for-in` uses them |
| `Collection` | Adds indices, subscripts, and repeatable looping |
| `Bidirectional`/`RandomAccessCollection` | Describe how fast moving through indices is; why `String` has no `Int` subscript |
| `RangeReplaceable`/`MutableCollection` | Replace elements in place, or change the count |
| Custom `Collection` | Four requirements, dozens of free operations |
| `Codable` synthesis | Free encoding and decoding when every property is `Codable` |
| `CodingKeys` | Map Swift names to JSON keys; leave out what you don't encode |
| Custom `init(from:)`/`encode(to:)` | For conversions and defaults; `decodeIfPresent` for missing keys |
| Nested containers | Walk into nested JSON, or use nested DTO structs |
| Polymorphic JSON | Read the `type` first, then decode into an enum case |
| Decoder/encoder strategies | Snake case, dates, and data rules for the whole decode |
| Regex literals | `/pattern/`, checked at compile time, with typed captures |
| `RegexBuilder` | Readable, composable regexes; `TryCapture` converts while matching |
| `FormatStyle` (numbers) | `.formatted(...)`: locale-aware currency, percent, compact numbers |
| `FormatStyle` (dates) | Parts, ranges, durations, and "2 hours ago" |
| `Measurement` | Values with units; safe conversion; local units for display |
| `AttributedString` | Rich text with Markdown; works directly in SwiftUI `Text` |
| `Duration`/`Clock`/`Instant` | Typed time spans; `Task.sleep(for: .seconds(2))` |
| `ContinuousClock` vs `SuspendingClock` | Counts sleep time vs pauses during sleep |
| `Observation`/`withObservationTracking` | Per-property change tracking behind `@Observable` |
| `Mutex`/`Atomic` | Small, fast thread-safety tools; actors first in app code |
| `Subprocess` | Run other programs from Swift; CLI and server only |
