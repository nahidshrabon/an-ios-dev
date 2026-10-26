**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 7.1 Defining and Conforming to a Protocol 🟢

A **protocol** is a **contract**: a list of properties and methods that a type **promises** to have. The protocol says **what**, not **how**. A type that keeps the promise **conforms** to the protocol.

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

let person = Person(name: "Alex")
print(person.greet())   // "Hello, I'm Alex"
```

**Any** type can conform: a struct, a class, or an enum. List the protocols after `:`. For a class, the superclass comes first:

```swift
class Employee: Greetable {
    var name: String
    init(name: String) { self.name = name }
    func greet() -> String { "Hi, I work here. I'm \(name)" }
}
```

If a type forgets a requirement, the compiler tells you, and Xcode offers a **Fix** button that adds stubs:

```swift
struct Robot: Greetable {
    var name: String
}   // ❌ error: type 'Robot' does not conform to protocol 'Greetable'
```

**Why protocols matter:** code can work with **any** conforming type, without knowing the concrete type:

```swift
func welcomeAll(_ guests: [any Greetable]) {
    for guest in guests {
        print(guest.greet())
    }
}

welcomeAll([Person(name: "Alex"), Employee(name: "Sam")])
```

(`any Greetable` means "some value of any type that conforms". Section 11 explains `any` and `some`.)

---

## 7.2 Protocol Properties and Method Requirements 🟢

A **property requirement** says whether the property must be **readable** (`{ get }`) or **readable and writable** (`{ get set }`). The conforming type can satisfy it with a stored property, a computed property, or (for `{ get }`) even a `let`:

```swift
protocol Vehicle {
    var speed: Double { get set }   // conformer must support both reading and writing
    var maxSpeed: Double { get }     // conformer only needs to support reading
    mutating func accelerate(by amount: Double)
}

struct Car: Vehicle {
    var speed: Double = 0
    var maxSpeed: Double = 200   // a stored property satisfies a get-only requirement fine

    mutating func accelerate(by amount: Double) {
        speed = min(speed + amount, maxSpeed)
    }
}
```

Notice `mutating` in the **protocol**. A struct can only change itself in a requirement that the protocol marks `mutating`. Without it, `Car` would not compile:

```swift
protocol Vehicle {
    func accelerate(by amount: Double)        // not mutating
}
struct Car: Vehicle {
    var speed = 0.0
    mutating func accelerate(by amount: Double) { speed += amount }
}   // ❌ error: type 'Car' does not conform to protocol 'Vehicle'
    //    (candidate is marked 'mutating' but protocol does not allow it)
```

Classes don't need `mutating` (they're reference types), so a class can still conform to a protocol with `mutating` requirements.

```swift
protocol Resettable {
    mutating func reset()
}

struct Score: Resettable {
    var value = 10
    mutating func reset() { value = 0 }
}
```

Protocols can also require **initializers** and **static** members:

```swift
protocol Defaultable {
    init()
    static var placeholder: Self { get }
}
```

---

## 7.3 Protocol Inheritance and Composition 🟢

A protocol can **inherit** from other protocols. A conforming type must then meet **all** the requirements together:

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

**Protocol composition** with `&` asks for **several protocols at once**, right where you need them, without creating a new protocol:

```swift
func printProfile(_ value: Named & Aged) {
    print("\(value.name) is \(value.age) years old")
}

printProfile(Student(name: "Ada", age: 22))
```

This keeps functions **flexible**: they ask only for the pieces they need. Any type with a `name` and an `age` works, even if it has nothing to do with `Person`.

A `typealias` gives a composition a name. `Codable` is exactly this:

```swift
typealias Codable = Decodable & Encodable   // how the standard library defines it
```

Keep protocols **small and focused**. Many small protocols, combined with `&`, are easier to reuse than one big protocol with everything.

---

## 7.4 Extensions: Adding Methods to Existing Types 🟢

An **extension** adds new features to an **existing** type, even one you don't have the source for, like `Int` or `String`. It can add methods, computed properties, initializers, subscripts, nested types, and protocol conformances:

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

Real-world extensions you'll write often:

```swift
extension String {
    var isValidEmail: Bool {
        contains("@") && contains(".")       // simple check for illustration
    }
}

extension Date {
    var isWeekend: Bool {
        Calendar.current.isDateInWeekend(self)
    }
}

extension Color {
    static let brand = Color(red: 0.2, green: 0.4, blue: 0.9)
}

"alex@example.com".isValidEmail   // true
Text("Hi").foregroundStyle(Color.brand)
```

Extensions **can't add stored properties**. That would change the type's memory layout after it was defined. Only computed properties are allowed:

```swift
extension Int {
    var doubled: Int { self * 2 }   // ✅ computed property — fine

    var cachedValue: Int = 0   // ❌ error: extensions must not contain stored properties
}
```

Extensions are also great for **organizing your own types**. Many teams put each protocol conformance in its own extension:

```swift
struct RecipeListView: View {
    var body: some View { /* ... */ }
}

// MARK: - Helpers
extension RecipeListView {
    private func formattedTime(_ minutes: Int) -> String { "\(minutes) min" }
}
```

---

## 7.5 Protocol Extensions and Default Implementations 🟡

You can extend a **protocol itself**. This gives **default implementations** to its requirements. Every conforming type gets them **for free**, and can still write **its own version** instead:

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

A protocol extension can also add **new methods** that are **not** requirements. They're built from the requirements, and every conforming type gets them:

```swift
extension Greetable {
    func shout() -> String {
        greet().uppercased()
    }
}

print(Robot(name: "R2D2").shout())   // "HELLO, I'M R2D2"
```

This is how much of the standard library works. Conform to `Sequence` by providing **one** method (`makeIterator()`), and you get `map`, `filter`, `contains`, `first(where:)`, and dozens more from protocol extensions.

You can limit a protocol extension with `where`:

```swift
extension Collection where Element: Numeric {
    var total: Element { reduce(0, +) }
}

[1, 2, 3].total       // 6
[1.5, 2.5].total      // 4.0
// ["a"].total        // ❌ not available: String is not Numeric
```

(Careful with methods that are **not** requirements. Their behavior can surprise you; see 7.12.)

---

## 7.6 Conditional Conformance 🟡

**Conditional conformance** means a generic type conforms to a protocol **only when** its type parameter meets a condition. Write the condition with `where` on the extension:

```swift
protocol Describable {
    var summary: String { get }
}

extension Int: Describable {
    var summary: String { "#\(self)" }
}

// An array is Describable only if its elements are Describable
extension Array: Describable where Element: Describable {
    var summary: String {
        map(\.summary).joined(separator: ", ")
    }
}

print([1, 2, 3].summary)    // "#1, #2, #3"
// ["a", "b"].summary       // ❌ String is not Describable, so [String] isn't either
```

The standard library uses this everywhere. For example, an `Array` is `Equatable` **only if** its elements are `Equatable`:

```swift
// This works because Int: Equatable
let a = [1, 2, 3]
let b = [1, 2, 3]
print(a == b)   // true — Array<Int> gets == because Int is Equatable

struct NotEquatable { }
let c = [NotEquatable(), NotEquatable()]
// c == c   // ❌ error: NotEquatable doesn't conform to Equatable, so [NotEquatable] doesn't either
```

The same goes for `Optional`, `Dictionary`, and `Set` with `Equatable`, `Hashable`, `Codable`, and more. That's why an array of `Codable` structs is itself `Codable`.

---

## 7.7 `Equatable` and Custom Equality 🟢

**`Equatable`** lets you compare values with `==` and `!=`. Many APIs need it, like `Array.contains(_:)` and `firstIndex(of:)`.

For structs and enums whose properties are **all** `Equatable`, Swift **writes `==` for you** (it **synthesizes** it). Just add the conformance:

```swift
struct Point: Equatable {
    var x: Int
    var y: Int
}

let p1 = Point(x: 1, y: 2)
let p2 = Point(x: 1, y: 2)
print(p1 == p2)   // true — synthesized automatically
```

When you need **custom** rules (compare only some properties, ignore case, ...), write `==` yourself:

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

**Be careful with custom `==`.** SwiftUI uses `Equatable` to decide whether a view needs to update. If `==` ignores `name`, a name change may not be noticed. Only customize when you're sure what "equal" should mean.

Equatable unlocks many helpers:

```swift
let users = [u1, User(id: 2, name: "Bob")]
users.contains(u2)               // true
users.firstIndex(of: u2)         // Optional(0)
```

---

## 7.8 `Hashable` and Custom Hashing 🟡

**`Hashable`** is needed to use a type as a **`Dictionary` key** or in a **`Set`** (see 3.4 and 3.6). It builds on `Equatable`. Again, Swift **synthesizes** it when all properties are `Hashable`:

```swift
struct Point: Hashable {
    var x: Int
    var y: Int
}

let points: Set<Point> = [Point(x: 1, y: 2), Point(x: 1, y: 2), Point(x: 3, y: 4)]
print(points.count)   // 2 — duplicates collapse, since Point is Hashable
```

A **hash** is a number computed from a value. Sets and dictionaries use it to **find items fast**.

If you write a **custom `==`**, you must write a **matching `hash(into:)`**. Hash **exactly the properties that `==` compares**:

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

**The critical rule: if two values are `==`, they must have the same hash.**

What happens if you break it? Imagine `==` compares only `id`, but the hash also uses `name`:

```plaintext
u1 = User(id: 1, name: "Alice")   hash → bucket 7
u2 = User(id: 1, name: "Alicia")  hash → bucket 3

u1 == u2 is true, but the Set looks in bucket 3 and never finds u1.
→ set.contains(u2) can be false, and "duplicates" stay in the Set.
```

These bugs are silent and very hard to find. Keep `==` and `hash(into:)` in sync. (Two **different** values may share a hash; that's fine.)

---

## 7.9 `Comparable` and Sortable Types 🟢

**`Comparable`** enables `<`, `>`, `<=`, `>=`, and lets you call `sorted()` **without a closure** (see 3.8). It builds on `Equatable`. You write **only `<`**; Swift provides the rest:

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

Comparing tuples makes `<` shorter:

```swift
static func < (lhs: Version, rhs: Version) -> Bool {
    (lhs.major, lhs.minor) < (rhs.major, rhs.minor)
}
```

Comparable also gives you `min()`, `max()`, and ranges:

```swift
versions.max()                                           // the 2.1 version
let supported = Version(major: 1, minor: 0)...Version(major: 2, minor: 0)
supported.contains(Version(major: 1, minor: 5))          // true
```

Swift **synthesizes** `Comparable` only for **enums** (without associated values, or with `Comparable` ones). The order is the **order of the cases**:

```swift
enum Size: Comparable { case small, medium, large }

Size.small < Size.large   // true
[Size.large, .small].sorted()   // [.small, .large]
```

For structs, you always write `<` yourself.

---

## 7.10 `Identifiable` and Stable IDs 🟢

**`Identifiable`** requires one property, **`id`**: a **stable identity** for a value. SwiftUI's `List` and `ForEach` (section 26) need it, to know **which item is which**, even when the item's other data changes.

```swift
struct TodoItem: Identifiable {
    let id = UUID()
    var title: String
    var isDone: Bool
}

let task1 = TodoItem(title: "Write code", isDone: false)
let task2 = TodoItem(title: "Write code", isDone: false)
print(task1.id == task2.id)   // false — distinct identities, even with identical other properties
```

**Identity vs equality:**

| | `Identifiable` (`id`) | `Equatable` (`==`) |
|---|---|---|
| Question | "Is this the **same thing**?" | "Do they have the **same values right now**?" |
| After `isDone` flips | Same `id`, same item | No longer `==` to the old value |

So when a todo is checked off, SwiftUI knows it's the **same row** (same `id`), and just updates it, with a nice animation instead of a delete and insert.

```swift
List(todos) { todo in            // no `id:` needed, because TodoItem is Identifiable
    Text(todo.title)
}
```

**Use a real, stable ID**, like the server's ID. If you create a new `UUID()` every time you decode data, every refresh looks like all-new items.

```swift
struct Recipe: Identifiable, Decodable {
    let id: Int            // from the server: stays the same across refreshes
    let title: String
}
```

---

## 7.11 `CustomStringConvertible` for Better Printing 🟢

Make a type conform to **`CustomStringConvertible`** and implement **`description`**, to control what `print()` shows:

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

String interpolation (1.6) uses the same `description`:

```swift
let p = BetterPoint(x: 1, y: 2)
let message = "Tapped at \(p)"   // "Tapped at (1, 2)"
```

A related protocol, **`CustomDebugStringConvertible`** (with `debugDescription`), controls the output of `debugPrint()` and the debugger's `po` command. Use it for **developer** details:

```swift
extension BetterPoint: CustomDebugStringConvertible {
    var debugDescription: String { "BetterPoint(x: \(x), y: \(y))" }
}
```

(Don't use `description` as text for **users**. It isn't localized. Build user-facing text separately.)

---

## 7.12 Protocol Witness Dispatch vs Extension Static Dispatch 🔴

This is subtle, but important. It is about **which version** of a method runs:

- A method that is a protocol **requirement** uses **dynamic dispatch** (through a "witness table"). At **runtime**, Swift looks up the **real type's** version.
- A method that exists **only in a protocol extension** (not a requirement) uses **static dispatch**. The **compiler** picks the version based on the **declared type** of the variable.

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

| Call | `greet()` (requirement) | `farewell()` (extension only) |
|---|---|---|
| On `FriendlyGreeter` | Its own | Its own |
| On `Greeter` | **Its own** (looked up at runtime) | **The default** (chosen at compile time) |

The surprise: `abstracted` **is** a `FriendlyGreeter` at runtime, but `farewell()` still runs the default. Swift only knows `abstracted` as a `Greeter`, and `Greeter` has no `farewell` **requirement** to look up.

**The fix**, if you want the real type's version: make `farewell()` a **requirement**:

```swift
protocol Greeter {
    func greet() -> String
    func farewell() -> String    // now a requirement → dynamic dispatch
}
// abstracted.farewell() now prints "See you soon!"
```

**Rule of thumb:** if conforming types are expected to **customize** a method, declare it in the protocol. Extension-only methods are for helpers that should behave the **same for everyone**.

---

## 7.13 `@retroactive` Conformance 🔴

Adding a protocol conformance to a type you **don't own** (from Apple or a third-party library), using a protocol you also don't own, is a **retroactive conformance**. Since Swift 6, this gives a **warning** unless you mark it with **`@retroactive`**.

**Why the warning?** If two modules each add the same conformance in different ways, the app can behave **unpredictably**: which `<` wins? `@retroactive` says: "I know the risk, and I'm doing this on purpose."

```swift
// Suppose SomeThirdPartyType doesn't conform to Comparable, and you want to sort an array of them.
extension SomeThirdPartyType: @retroactive Comparable {
    static func < (lhs: SomeThirdPartyType, rhs: SomeThirdPartyType) -> Bool {
        lhs.someProperty < rhs.someProperty
    }
}
```

A real example: `CLLocationCoordinate2D` (from Core Location) is not `Equatable`:

```swift
import CoreLocation

extension CLLocationCoordinate2D: @retroactive Equatable {
    public static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.latitude == rhs.latitude && lhs.longitude == rhs.longitude
    }
}
```

| You own the type? | You own the protocol? | Needs `@retroactive`? |
|---|---|---|
| Yes | Any | No |
| No | Yes | No |
| No | No | **Yes** |

`@retroactive` **changes nothing at runtime**. It's a clear signal to the compiler and to readers.

**Often a safer alternative:** don't add the conformance. Wrap the type, or pass a closure:

```swift
let sorted = items.sorted { $0.someProperty < $1.someProperty }   // no conformance needed
```

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Protocol basics | A contract of requirements; structs, classes, and enums can conform |
| Property/method requirements | `{ get }` vs `{ get set }`; the protocol must mark `mutating` methods |
| Protocol inheritance/composition | Protocols inherit from others; `&` combines them where needed |
| Extensions | Add methods, computed properties, inits, and conformances; no stored properties |
| Protocol extensions | Default implementations and free helper methods for every conformer |
| Conditional conformance | Conform only when the type parameter meets a condition |
| `Equatable` | Enables `==`; synthesized for simple types |
| `Hashable` | For Set and Dictionary keys; equal values must have equal hashes |
| `Comparable` | Write `<`, get sorting and the other operators |
| `Identifiable` | A stable `id`, separate from equality; key for SwiftUI lists |
| `CustomStringConvertible` | Controls what `print()` and interpolation show |
| Witness vs static dispatch | Requirements are looked up at runtime; extension-only methods are not |
| `@retroactive` | Marks a conformance of a type and protocol you don't own |
