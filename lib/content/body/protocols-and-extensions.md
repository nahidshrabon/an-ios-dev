# Part 1, Section 7 — Protocols and Extensions 🟢

*Estimated read time: ~30 minutes*

This section covers protocols — Swift's contracts for shared behavior across unrelated types — and extensions, which let you add functionality to existing types (including ones you don't own). Together they underpin most of Swift's standard library conformances like `Equatable`, `Hashable`, and `Comparable`.

---

## 7.1 Defining and Conforming to a Protocol

A protocol declares a set of requirements — properties and methods — that a conforming type must implement, without providing the implementation itself:

```swift
protocol Greetable {
    var name: String { get }
    func greet() -> String
}

struct Person: Greetable {
    var name: String
    func greet() -> String {
        "Hello, I'm \(name)"
    }
}

let person = Person(name: "Nahidul")
print(person.greet())   // "Hello, I'm Nahidul"
```

Any type — struct, class, or enum — can conform to a protocol, listed after `:` (or after the superclass, for classes) separated by commas if conforming to multiple protocols:

```swift
class Employee: Greetable {
    var name: String
    init(name: String) { self.name = name }
    func greet() -> String { "Hi, I work here. I'm \(name)" }
}
```

A protocol itself has no storage and no implementation — it's purely a contract; conforming types must supply the actual behavior.

---

## 7.2 Protocol Properties and Method Requirements

Protocol property requirements specify whether they need to be gettable (`{ get }`) or gettable-and-settable (`{ get set }`) — the conforming type can use a stored property, a computed property, or (for `get`-only) even a `let` constant, as long as it satisfies the requirement:

```swift
protocol Vehicle {
    var speed: Double { get set }   // conformer must support both reading and writing
    var maxSpeed: Double { get }     // conformer only needs to support reading
    func accelerate(by amount: Double)
}

struct Car: Vehicle {
    var speed: Double = 0
    var maxSpeed: Double = 200   // a stored property satisfies a get-only requirement fine

    mutating func accelerate(by amount: Double) {
        speed = min(speed + amount, maxSpeed)
    }
}
```

Method requirements just declare the signature — parameters, return type, and whether the method is expected to mutate `self` (marked with `mutating` in the protocol itself if a struct/enum conformer needs to be able to mutate):

```swift
protocol Resettable {
    mutating func reset()
}
```

---

## 7.3 Protocol Inheritance and Composition

A protocol can inherit from one or more other protocols, requiring conformers to satisfy the combined set of requirements:

```swift
protocol Named {
    var name: String { get }
}

protocol Aged {
    var age: Int { get }
}

protocol Person: Named, Aged {
    func introduce() -> String
}

struct Student: Person {
    var name: String
    var age: Int
    func introduce() -> String { "\(name), age \(age)" }
}
```

**Protocol composition** lets you require conformance to *multiple* protocols at once, right at the point of use, without needing to declare a new combined protocol — using `&`:

```swift
func printProfile(_ value: Named & Aged) {
    print("\(value.name) is \(value.age) years old")
}

printProfile(Student(name: "Ada", age: 22))
```

This is especially useful for function parameters that need just a slice of behavior from several different protocols, without forcing every caller's type into a rigid inheritance hierarchy.

---

## 7.4 Extensions: Adding Methods to Existing Types

`extension` adds new functionality — methods, computed properties, initializers, subscripts, protocol conformances — to an *existing* type, including ones you don't own the source code for, like `Int` or `String`:

```swift
extension Int {
    var squared: Int {
        self * self
    }

    func times(_ action: () -> Void) {
        for _ in 0..<self {
            action()
        }
    }
}

print(5.squared)   // 25

3.times {
    print("Hello!")
}
// Hello!
// Hello!
// Hello!
```

Extensions **cannot** add new stored properties (only computed ones) to a type, since that would require changing the type's memory layout after the fact:

```swift
extension Int {
    var doubled: Int { self * 2 }   // ✅ computed property — fine

    var cachedValue: Int = 0   // ❌ error: extensions must not contain stored properties
}
```

---

## 7.5 Protocol Extensions and Default Implementations

Extending a protocol itself (rather than a specific conforming type) lets you provide **default implementations** for its requirements — any conforming type gets that behavior automatically, and can still override it with its own implementation if needed:

```swift
protocol Greetable {
    var name: String { get }
    func greet() -> String
}

extension Greetable {
    func greet() -> String {
        "Hello, I'm \(name)"   // default implementation
    }
}

struct Robot: Greetable {
    var name: String
    // no need to implement greet() — uses the protocol extension's default
}

print(Robot(name: "R2D2").greet())   // "Hello, I'm R2D2"
```

Protocol extensions can also add entirely new methods **not** declared as requirements at all — utility methods built purely in terms of the protocol's actual requirements, available to every conformer for free:

```swift
extension Greetable {
    func shout() -> String {
        greet().uppercased()
    }
}

print(Robot(name: "R2D2").shout())   // "HELLO, I'M R2D2"
```

---

## 7.6 Conditional Conformance

Conditional conformance lets a generic type conform to a protocol only when its type parameter itself satisfies some condition — expressed with a `where` clause on the extension:

```swift
protocol Summable {
    static func + (lhs: Self, rhs: Self) -> Self
}

extension Array: Summable where Element: Summable {
    static func + (lhs: [Element], rhs: [Element]) -> [Element] {
        zip(lhs, rhs).map { $0 + $1 }
    }
}
```

The standard library itself uses this heavily — for example, `Array` conforms to `Equatable` only when its `Element` type is itself `Equatable`:

```swift
// This works because Int: Equatable
let a = [1, 2, 3]
let b = [1, 2, 3]
print(a == b)   // true — Array<Int> gets == because Int is Equatable

struct NotEquatable { }
let c = [NotEquatable(), NotEquatable()]
// c == c   // ❌ error: NotEquatable doesn't conform to Equatable, so [NotEquatable] doesn't either
```

---

## 7.7 `Equatable` and Custom Equality

`Equatable` requires a type to implement `==`, enabling comparison with `==`/`!=` and usage in APIs that require equality (like `Array.contains`, or `firstIndex(of:)`). For simple structs and enums with all-`Equatable` members, Swift **synthesizes** `==` automatically — you don't need to write it yourself:

```swift
struct Point: Equatable {
    var x: Int
    var y: Int
}

let p1 = Point(x: 1, y: 2)
let p2 = Point(x: 1, y: 2)
print(p1 == p2)   // true — synthesized automatically
```

When you need custom equality logic (e.g. comparing only some properties, or case-insensitive string comparison), implement `==` yourself:

```swift
struct User: Equatable {
    var id: Int
    var name: String

    static func == (lhs: User, rhs: User) -> Bool {
        lhs.id == rhs.id   // only compare by ID, ignore name differences
    }
}

let u1 = User(id: 1, name: "Alice")
let u2 = User(id: 1, name: "Alicia")
print(u1 == u2)   // true — same ID, despite different names
```

---

## 7.8 `Hashable` and Custom Hashing

`Hashable` (which itself requires `Equatable`) is needed for a type to be used as a `Dictionary` key or stored in a `Set` (recall sections 3.4 and 3.6). Like `Equatable`, Swift synthesizes `hash(into:)` automatically for structs/enums whose members are all `Hashable`:

```swift
struct Point: Hashable {
    var x: Int
    var y: Int
}

let points: Set<Point> = [Point(x: 1, y: 2), Point(x: 1, y: 2), Point(x: 3, y: 4)]
print(points.count)   // 2 — duplicates collapse, since Point is Hashable
```

For custom hashing (usually to match custom `==` logic — hash and equality must stay consistent, so equal values *must* produce the same hash), implement `hash(into:)` yourself:

```swift
struct User: Hashable {
    var id: Int
    var name: String

    static func == (lhs: User, rhs: User) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)   // must hash only what == compares, or Set/Dictionary break
    }
}
```

**Critical rule:** if two values are `==`, they must produce the same hash. Violating this breaks `Set` and `Dictionary` in ways that are hard to debug (lookups silently failing, duplicates not collapsing).

---

## 7.9 `Comparable` and Sortable Types

`Comparable` (which requires `Equatable`) enables `<`, `>`, `<=`, `>=`, and lets a type be used with `sorted()` without a custom closure (recall 3.8). You implement `<`; Swift derives the rest:

```swift
struct Version: Comparable {
    var major: Int
    var minor: Int

    static func < (lhs: Version, rhs: Version) -> Bool {
        if lhs.major != rhs.major { return lhs.major < rhs.major }
        return lhs.minor < rhs.minor
    }
}

let versions = [Version(major: 2, minor: 1), Version(major: 1, minor: 5), Version(major: 2, minor: 0)]
let sorted = versions.sorted()   // works directly, no closure needed
print(sorted.map { "\($0.major).\($0.minor)" })   // ["1.5", "2.0", "2.1"]
```

Swift can also synthesize `Comparable` automatically for simple structs where you don't need custom ordering logic beyond declaration order of properties (as of recent Swift versions, though this synthesis is narrower than `Equatable`/`Hashable`'s — for full control, implementing `<` yourself as shown remains the standard approach).

---

## 7.10 `Identifiable` and Stable IDs

`Identifiable` requires a single property, `id`, providing a stable identity for a value distinct from its equality — crucial for SwiftUI's `List`/`ForEach` (sections 26+), which need to track *which* item is which even as its other properties change.

```swift
struct Task: Identifiable {
    let id: UUID = UUID()
    var title: String
    var isDone: Bool
}

let task1 = Task(title: "Write code", isDone: false)
let task2 = Task(title: "Write code", isDone: false)
print(task1.id == task2.id)   // false — distinct identities, even with identical other properties
```

The key distinction from `Equatable`: two `Identifiable` values can be "the same thing" (same `id`) even while their other properties have changed over time (e.g. `isDone` flips from `false` to `true`), whereas `Equatable` compares the *current* values, not identity over time.

---

## 7.11 `CustomStringConvertible` for Better Printing

By default, `print()`-ing a custom struct/class gives an unhelpful, generic description. Conforming to `CustomStringConvertible` and implementing `description` lets you control exactly what gets printed:

```swift
struct Point {
    var x: Int
    var y: Int
}

print(Point(x: 3, y: 4))
// Point(x: 3, y: 4) — default, auto-generated description

struct BetterPoint: CustomStringConvertible {
    var x: Int
    var y: Int

    var description: String {
        "(\(x), \(y))"
    }
}

print(BetterPoint(x: 3, y: 4))
// (3, 4) — uses your custom description
```

This is also exactly what powers string interpolation of custom types (recall 1.6) — `"\(myBetterPoint)"` uses the same `description` property. A related protocol, `CustomDebugStringConvertible` (with `debugDescription`), controls output specifically for `debugPrint()` and Xcode's debugger variable view.

---

## 7.12 Protocol Witness Dispatch vs Extension Static Dispatch 🔵

This is a subtler but important distinction: methods satisfying a protocol *requirement* use **dynamic (witness table) dispatch** — the correct implementation is looked up at runtime based on the concrete type. Methods added purely in a protocol *extension*, without being declared as a requirement, use **static dispatch** — resolved at compile time based on the *static* type of the reference.

```swift
protocol Greeter {
    func greet() -> String   // a requirement
}

extension Greeter {
    func greet() -> String { "Default greeting" }   // default implementation, still a requirement
    func farewell() -> String { "Default farewell" }   // NOT a requirement — extension-only method
}

struct FriendlyGreeter: Greeter {
    func greet() -> String { "Hi there!" }        // overrides the requirement
    func farewell() -> String { "See you soon!" } // does NOT override — this is a separate, unrelated method
}

let concrete = FriendlyGreeter()
let abstracted: Greeter = FriendlyGreeter()

print(concrete.greet())      // "Hi there!"       — same either way
print(abstracted.greet())    // "Hi there!"       — witness dispatch: looks up the real type's implementation

print(concrete.farewell())   // "See you soon!"   — static type is FriendlyGreeter, uses its own method
print(abstracted.farewell()) // "Default farewell" — static type is Greeter, uses the protocol extension's version!
```

The `farewell()` discrepancy is the classic gotcha: because `farewell()` was never declared as a protocol *requirement*, calling it through a variable typed as the protocol (`abstracted`) always resolves to the protocol extension's implementation, ignoring `FriendlyGreeter`'s own version — even though the object is genuinely a `FriendlyGreeter` at runtime. The fix, if dynamic behavior is wanted, is to declare `farewell()` as an actual protocol requirement.

---

## 7.13 `@retroactive` Conformance 🟠

Adding a protocol conformance to a type you don't own (e.g. a type from a third-party library or Apple's own frameworks) from your own module is called a **retroactive conformance**. Since Swift 6, doing this without marking it explicitly produces a warning, because retroactive conformances can silently conflict if two different modules each add the same conformance independently — `@retroactive` marks the conformance as an intentional, acknowledged choice.

```swift
// Suppose SomeThirdPartyType doesn't conform to Comparable, and you want to sort an array of them.
extension SomeThirdPartyType: @retroactive Comparable {
    static func < (lhs: SomeThirdPartyType, rhs: SomeThirdPartyType) -> Bool {
        lhs.someProperty < rhs.someProperty
    }
}
```

This is purely a documentation/safety annotation for the compiler — it doesn't change runtime behavior, but it makes explicit (both to the compiler's conflict-detection and to future readers) that you're deliberately extending a type you don't control, accepting the risk that another module might do the same thing incompatibly.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Protocol basics | A contract of property/method requirements; any struct, class, or enum can conform |
| Property/method requirements | `{ get }` vs `{ get set }`; mutating methods must say so in the protocol |
| Protocol inheritance/composition | Protocols can inherit from others; `&` combines multiple protocols at the point of use |
| Extensions | Add methods, computed properties, initializers, and conformances to existing types — no new stored properties |
| Protocol extensions | Provide default implementations conformers can use as-is or override |
| Conditional conformance | A generic type conforms to a protocol only when its type parameter also satisfies a condition |
| `Equatable` | Enables `==`; synthesized automatically for simple types, or implement `==` for custom logic |
| `Hashable` | Needed for Set/Dictionary keys; equal values must always produce equal hashes |
| `Comparable` | Implement `<`; unlocks `sorted()` and the other ordering operators |
| `Identifiable` | A stable `id` distinct from equality — critical for SwiftUI lists |
| `CustomStringConvertible` | Controls `print()`/interpolation output via a custom `description` |
| Witness vs static dispatch | Requirement methods dispatch dynamically; extension-only methods dispatch statically based on the static type |
| `@retroactive` | Marks an intentional conformance added to a type you don't own, flagging potential cross-module conflicts |

**Next up:** [Section 8 — Generics](/articles/generics).
