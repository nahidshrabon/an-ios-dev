# Part 1, Section 6 — Structs, Classes, and Enums 🟢

*Estimated read time: ~30 minutes*

---

## 6.1 Defining a Struct with Stored Properties

A `struct` bundles related stored properties into a single named type:

```swift
struct Point {
    var x: Double
    var y: Double
}

let origin = Point(x: 0, y: 0)
print(origin.x, origin.y)   // 0.0 0.0
```

Properties can have default values, making them optional to specify at initialization:

```swift
struct Circle {
    var center: Point = Point(x: 0, y: 0)
    var radius: Double
}

let unitCircle = Circle(radius: 1.0)   // center uses its default
```

---

## 6.2 Memberwise Initializers

Swift automatically generates a **memberwise initializer** for any struct that doesn't define its own custom initializer — one parameter per stored property, in declaration order:

```swift
struct Point {
    var x: Double
    var y: Double
}

let p = Point(x: 3, y: 4)   // free memberwise init, generated automatically
```

The moment you add a custom initializer, the automatic memberwise one disappears — you must reintroduce equivalent parameters yourself if you still want that convenience:

```swift
struct Point {
    var x: Double
    var y: Double

    init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }

    init(equalTo value: Double) {
        self.x = value
        self.y = value
    }
}

let a = Point(x: 1, y: 2)        // still works — matches the custom init
let b = Point(equalTo: 5)         // new convenience initializer
```

---

## 6.3 Methods on Structs and `mutating`

Struct methods are non-mutating by default — they can read properties but not write them, since structs are value types passed around by copy. Any method that changes `self` must be marked `mutating`:

```swift
struct Counter {
    var count = 0

    mutating func increment() {
        count += 1
    }

    func isPositive() -> Bool {
        count > 0   // read-only, no mutating needed
    }
}

var counter = Counter()
counter.increment()
print(counter.count)   // 1
```

Calling a `mutating` method on a `let`-declared struct is a compile-time error, exactly like directly assigning a property (recall 1.1):

```swift
let frozenCounter = Counter()
frozenCounter.increment()   // ❌ error: cannot use mutating member on immutable value
```

A `mutating` method can also replace `self` wholesale:

```swift
mutating func reset() {
    self = Counter()
}
```

---

## 6.4 Defining a Class and Inheritance

`class` declares a reference type that supports inheritance, using `:` to specify a superclass:

```swift
class Animal {
    var name: String
    init(name: String) {
        self.name = name
    }
    func makeSound() -> String {
        "..."
    }
}

class Dog: Animal {
    func fetch() -> String {
        "\(name) fetches the ball!"
    }
}

let dog = Dog(name: "Rex")
print(dog.makeSound())   // "..." — inherited from Animal
print(dog.fetch())        // "Rex fetches the ball!"
```

Unlike structs, classes don't get a free memberwise initializer — you must define `init` explicitly (see 6.6–6.7 for the full initializer rules).

---

## 6.5 `override`, `super`, and `final`

Subclasses override inherited methods or properties with the `override` keyword, which is mandatory — Swift refuses to let you silently shadow a superclass member without declaring intent:

```swift
class Dog: Animal {
    override func makeSound() -> String {
        "Woof!"
    }
}

let dog = Dog(name: "Rex")
print(dog.makeSound())   // "Woof!"
```

`super` calls the superclass's own implementation from within an override — common when you want to extend behavior rather than fully replace it:

```swift
class Puppy: Dog {
    override func makeSound() -> String {
        super.makeSound() + " (but cuter)"
    }
}

print(Puppy(name: "Buddy").makeSound())   // "Woof! (but cuter)"
```

`final` prevents further overriding (on a method/property) or subclassing (on a class) entirely, which both documents intent and lets the compiler apply optimizations it couldn't otherwise make (since it no longer needs to consider overrides at the call site):

```swift
final class Robot { }   // cannot be subclassed at all

class Vehicle {
    final func vin() -> String { "1234" }   // cannot be overridden by subclasses
}
```

---

## 6.6 Designated vs Convenience Initializers

A **designated initializer** is a class's primary initializer, responsible for ensuring all stored properties are set and for calling up to a superclass's own designated initializer. A **convenience initializer** (marked `convenience`) is a secondary, simplified entry point that must delegate to another initializer in the same class rather than initializing properties directly.

```swift
class Vehicle {
    var wheels: Int
    var color: String

    // designated initializer
    init(wheels: Int, color: String) {
        self.wheels = wheels
        self.color = color
    }

    // convenience initializer — must call another init in this same class
    convenience init(color: String) {
        self.init(wheels: 4, color: color)
    }
}

let car = Vehicle(color: "Red")   // uses the convenience init, defaults wheels to 4
```

Convenience initializers exist to reduce duplicate setup logic — they can't set stored properties directly; they must funnel through a designated initializer that does.

---

## 6.7 Initializer Inheritance and `required init`

By default, a subclass does **not** automatically inherit its superclass's designated initializers if it adds any new stored properties or defines its own designated initializers — it must define its own to satisfy Swift's "every stored property must be initialized" rule.

```swift
class Animal {
    var name: String
    init(name: String) { self.name = name }
}

class Dog: Animal {
    var breed: String
    init(name: String, breed: String) {
        self.breed = breed
        super.init(name: name)   // must call super's designated init before finishing
    }
}
```

`required` forces every subclass to provide its own implementation of a particular initializer, which is essential when code needs to construct an instance of an unknown, dynamically-determined subclass (a common need in frameworks):

```swift
class Shape {
    required init() { }   // every subclass must implement this
}

class Square: Shape {
    required init() {
        super.init()
    }
}

func makeShape<T: Shape>(_ type: T.Type) -> T {
    T()   // only legal because init() is guaranteed to exist via `required`
}
```

---

## 6.8 `deinit` and Object Teardown

`deinit` is a special method that runs automatically right before a class instance is deallocated — structs and enums don't have (or need) a `deinit`, since they have no separate identity to tear down.

```swift
class FileHandle {
    let filename: String
    init(filename: String) {
        self.filename = filename
        print("Opening \(filename)")
    }
    deinit {
        print("Closing \(filename)")
    }
}

func processFile() {
    let handle = FileHandle(filename: "data.txt")
    // ... use handle ...
}   // handle goes out of scope here, deinit runs immediately (assuming no other references)

processFile()
// Opening data.txt
// Closing data.txt
```

`deinit` takes no parameters and is called automatically — you never call it yourself. It's the standard place to release manually-managed resources (closing file handles, invalidating timers, removing observers) tied to an object's lifetime. The full mechanics of *when* deallocation actually happens are covered in section 10 (Memory Management, via ARC).

---

## 6.9 Value vs Reference Semantics — The Core Difference

This is the single most important distinction in Swift's type system. Assigning or passing a **struct** (or enum) copies its value — the two variables become entirely independent afterward. Assigning or passing a **class** instance copies a *reference* — both variables point at the same underlying object, and mutating through one is visible through the other.

```swift
struct PointStruct { var x = 0 }
class PointClass { var x = 0 }

var s1 = PointStruct()
var s2 = s1          // s2 is an independent copy
s2.x = 100
print(s1.x, s2.x)    // 0 100 — s1 is unaffected

let c1 = PointClass()
let c2 = c1          // c2 refers to the same object as c1
c2.x = 100
print(c1.x, c2.x)    // 100 100 — both see the change, since they're the same instance
```

Note that `c1` and `c2` above are both declared `let`, yet `c2.x = 100` still compiles — because `let` on a class reference only prevents reassigning *which object* the constant points to, not mutating the object's own properties. This is a common surprise coming from value-type thinking.

```swift
let c3 = PointClass()
c3 = PointClass()   // ❌ error: cannot assign to value: 'c3' is a 'let' constant
c3.x = 50            // ✅ fine — this mutates the object, not the reference itself
```

---

## 6.10 Choosing Struct vs Class in Practice

Apple's own guidance, and the practical rule most Swift codebases follow: **default to `struct`**, and reach for `class` only when you have a specific, deliberate reason.

Choose `class` when you need: identity that matters (two instances with identical property values should still be considered "different things" — e.g. `UIViewController`, `NSObject`-based APIs), reference semantics for shared mutable state (multiple parts of your app need to observe and mutate the *same* underlying object), inheritance (an actual "is-a" hierarchy with shared behavior extended via subclassing), or interoperability with Objective-C/UIKit APIs that require a class.

Choose `struct` (the default) for: models representing data (a `User`, a `Coordinate`, an `Order`), anything you'll pass around and want automatic, safe copy-on-write behavior for, and anything you want compared with pure value equality rather than identity.

```swift
// Good struct candidate — pure data, no shared mutable identity needed
struct User {
    var name: String
    var email: String
}

// Good class candidate — shared, observed state, has identity
class SessionManager {
    var isLoggedIn: Bool = false
    var currentUser: User?
}
```

---

## 6.11 Computed Properties

A computed property has no storage of its own — it computes its value from other properties every time it's accessed, using a `get` (and optionally `set`) block:

```swift
struct Rectangle {
    var width: Double
    var height: Double

    var area: Double {
        get { width * height }
    }
}

let rect = Rectangle(width: 4, height: 5)
print(rect.area)   // 20.0
```

A read-only computed property (only `get`) can drop the `get { }` wrapper entirely for a single-expression body:

```swift
var area: Double {
    width * height
}
```

Adding `set` makes it a full read-write computed property, letting assignment drive changes to the underlying stored properties:

```swift
struct Temperature {
    var celsius: Double

    var fahrenheit: Double {
        get { celsius * 9 / 5 + 32 }
        set { celsius = (newValue - 32) * 5 / 9 }
    }
}

var temp = Temperature(celsius: 20)
print(temp.fahrenheit)   // 68.0
temp.fahrenheit = 100
print(temp.celsius)      // 37.77...
```

---

## 6.12 Property Observers: `willSet` and `didSet`

Property observers let a *stored* property run code immediately before (`willSet`) or after (`didSet`) its value changes — without turning it into a computed property.

```swift
class ScoreTracker {
    var score: Int = 0 {
        willSet {
            print("About to change from \(score) to \(newValue)")
        }
        didSet {
            print("Changed from \(oldValue) to \(score)")
        }
    }
}

let tracker = ScoreTracker()
tracker.score = 10
// About to change from 0 to 10
// Changed from 0 to 10
```

`willSet` implicitly provides `newValue`; `didSet` implicitly provides `oldValue`. A common real use is triggering a side effect (like a UI refresh or a network sync) any time a property changes, without the caller having to remember to do it manually:

```swift
var username: String = "" {
    didSet {
        guard username != oldValue else { return }   // avoid redundant work
        print("Persisting username: \(username)")
    }
}
```

Note: observers don't fire when a property is set within its own `init` — only on subsequent assignments.

---

## 6.13 `lazy` Properties

A `lazy` stored property isn't computed until the *first time* it's accessed, and its computed value is cached from then on — useful for expensive setup that might never be needed, or that depends on other properties not yet available at `init` time.

```swift
class DataImporter {
    init() {
        print("DataImporter initialized — this is expensive!")
    }
}

class DataManager {
    lazy var importer = DataImporter()   // not created yet
    var data: [String] = []
}

let manager = DataManager()
print("Manager created")
print(manager.importer)   // "DataImporter initialized..." prints only now, on first access
```

`lazy` properties must be declared `var` (their value changes from "not yet computed" to "computed" internally) and cannot easily be used with property observers in the same declaration. They're also not automatically thread-safe — concurrent first-access from multiple threads is a real hazard, addressed properly with actors in Part 2 (Concurrency).

---

## 6.14 Static Properties and Methods

`static` properties and methods belong to the type itself, not to any instance — shared across every use of the type, accessed via the type's name rather than a variable.

```swift
struct MathConstants {
    static let pi = 3.14159
    static func square(_ n: Double) -> Double { n * n }
}

print(MathConstants.pi)              // 3.14159
print(MathConstants.square(4))       // 16.0
```

A common pattern is a shared singleton instance exposed as a `static` property:

```swift
class Logger {
    static let shared = Logger()
    private init() { }   // prevents creating additional instances from outside

    func log(_ message: String) {
        print("[LOG] \(message)")
    }
}

Logger.shared.log("App started")
```

Classes can use `class` instead of `static` for methods/computed properties specifically to allow subclasses to override them — `static` members are implicitly `final` and cannot be overridden.

```swift
class Shape {
    class func describe() -> String { "A shape" }
}
class Circle: Shape {
    override class func describe() -> String { "A circle" }
}
```

---

## 6.15 Subscripts

Subscripts let a custom type support the familiar `instance[index]` syntax, defined with the `subscript` keyword and a `get`/`set` (like a computed property, but parameterized):

```swift
struct Grid {
    var values: [[Int]]

    subscript(row: Int, column: Int) -> Int {
        get { values[row][column] }
        set { values[row][column] = newValue }
    }
}

var grid = Grid(values: [[1, 2], [3, 4]])
print(grid[0, 1])   // 2
grid[0, 1] = 99
print(grid.values)  // [[1, 99], [3, 4]]
```

Subscripts can be overloaded (multiple subscripts with different parameter types), can be read-only (omit `set`), and can even be `static` for type-level lookups. This is exactly the mechanism behind `Array`'s `arr[index]` and `Dictionary`'s `dict[key]` from section 3 — they're just subscripts defined in the standard library, not special-cased syntax.

---

## 6.16 Enums with Raw Values

An `enum` groups a fixed, finite set of related cases under one type. Raw values give each case an underlying literal value of a specific type (`String`, `Int`, etc.), useful for serialization or interop:

```swift
enum Direction: String {
    case north, south, east, west
}

let heading = Direction.north
print(heading.rawValue)   // "north"

let parsed = Direction(rawValue: "south")   // Direction? — failable, since not every string matches
print(parsed as Any)   // Optional(Direction.south)
```

`Int`-backed raw values auto-increment from `0` by default, or from wherever you start explicitly:

```swift
enum Priority: Int {
    case low = 1, medium, high   // medium = 2, high = 3, auto-incremented
}
print(Priority.high.rawValue)   // 3
```

---

## 6.17 Enums with Associated Values

Associated values let each case carry its *own* distinct data, not just a single shared raw value — this is what makes Swift enums far more powerful than a simple C-style enum, and central to modeling state cleanly (see 6.22).

```swift
enum NetworkResult {
    case success(data: String)
    case failure(code: Int, message: String)
    case loading
}

let result = NetworkResult.failure(code: 404, message: "Not Found")

switch result {
case .success(let data):
    print("Got data: \(data)")
case .failure(let code, let message):
    print("Error \(code): \(message)")
case .loading:
    print("Still loading...")
}
// "Error 404: Not Found"
```

Unlike raw values, a case with associated values cannot also have a raw value, and each case can carry a completely different shape of data — one case might carry a `String`, another a tuple of `(Int, String)`, another nothing at all.

---

## 6.18 Methods and Computed Properties on Enums

Enums support methods and computed properties exactly like structs and classes do, letting you attach behavior directly to the type rather than switching over it externally every time:

```swift
enum Direction: String {
    case north, south, east, west

    func opposite() -> Direction {
        switch self {
        case .north: return .south
        case .south: return .north
        case .east: return .west
        case .west: return .east
        }
    }

    var isVertical: Bool {
        self == .north || self == .south
    }
}

print(Direction.north.opposite())   // south
print(Direction.east.isVertical)     // false
```

Methods that need to change `self` to a different case must be marked `mutating`, exactly like a struct's mutating methods:

```swift
enum TrafficLight {
    case red, yellow, green

    mutating func next() {
        switch self {
        case .red: self = .green
        case .green: self = .yellow
        case .yellow: self = .red
        }
    }
}

var light = TrafficLight.red
light.next()
print(light)   // green
```

---

## 6.19 `CaseIterable` and Iterating Cases

Conforming an enum to `CaseIterable` automatically synthesizes an `allCases` static property listing every case, in declaration order — no manual array to keep in sync:

```swift
enum Direction: String, CaseIterable {
    case north, south, east, west
}

for direction in Direction.allCases {
    print(direction.rawValue)
}
// north
// south
// east
// west

print(Direction.allCases.count)   // 4
```

`CaseIterable` only works automatically for enums **without** associated values — a case like `.success(data: String)` has infinitely many possible instances, so there's no fixed list of "all cases" the compiler could synthesize.

---

## 6.20 Indirect Enums and Recursive Data

An enum case can't normally hold a value of its own enum type directly — that would require infinite storage size, since the compiler needs to know a fixed size for the enum at compile time. `indirect` solves this by storing that particular case (or the whole enum) behind a pointer instead of inline:

```swift
indirect enum Expression {
    case number(Double)
    case addition(Expression, Expression)
    case multiplication(Expression, Expression)
}

let expr = Expression.addition(
    .number(3),
    .multiplication(.number(4), .number(5))
)

func evaluate(_ expr: Expression) -> Double {
    switch expr {
    case .number(let value):
        return value
    case .addition(let lhs, let rhs):
        return evaluate(lhs) + evaluate(rhs)
    case .multiplication(let lhs, let rhs):
        return evaluate(lhs) * evaluate(rhs)
    }
}

print(evaluate(expr))   // 23.0 (3 + (4 * 5))
```

You can mark the whole enum `indirect` (as above) or just the specific recursive cases (`indirect case addition(...)`), which is more precise if only some cases are actually recursive.

---

## 6.21 Nested Types

Structs, classes, and enums can all be defined *inside* another type, scoping a helper type to only where it's relevant and avoiding naming collisions or polluting the top-level namespace:

```swift
struct Card {
    enum Suit: String {
        case hearts, diamonds, clubs, spades
    }
    enum Rank: Int {
        case two = 2, three, four, five, six, seven, eight, nine, ten, jack, queen, king, ace
    }

    var suit: Suit
    var rank: Rank
}

let card = Card(suit: .hearts, rank: .ace)
print(card.suit.rawValue, card.rank.rawValue)   // "hearts" 14

// referenced from outside using the full qualified name
let anotherSuit: Card.Suit = .spades
```

Nesting communicates a clear ownership relationship — `Card.Suit` only really makes sense in the context of a `Card`, so keeping it nested rather than a free-floating top-level `Suit` type documents that intent directly in the code's structure.

---

## 6.22 Modeling State with Enums Instead of Booleans

A common beginner pattern is representing screen or process state with a pile of independent booleans — `isLoading`, `hasError`, `errorMessage: String?`, `data: [Item]?` — which allows **illegal combinations** the compiler can't prevent (e.g. `isLoading == true` *and* `hasError == true` *and* `data` non-nil, all at once, which shouldn't make sense together).

```swift
// Problematic: booleans allow impossible states
struct ScreenStateBooleans {
    var isLoading = false
    var hasError = false
    var errorMessage: String?
    var items: [String]?
}
```

An enum with associated values makes the valid states explicit and mutually exclusive — illegal combinations simply become unrepresentable, because you can only ever be in exactly one case at a time:

```swift
enum ScreenState {
    case idle
    case loading
    case loaded(items: [String])
    case failed(message: String)
}

func render(_ state: ScreenState) {
    switch state {
    case .idle:
        print("Nothing yet")
    case .loading:
        print("Spinner...")
    case .loaded(let items):
        print("Showing \(items.count) items")
    case .failed(let message):
        print("Error: \(message)")
    }
}
```

This pattern — "make illegal states unrepresentable" — is one of the most valuable applications of enums with associated values in real app architecture, and it's revisited in depth in section 45 (Architecture Foundations).

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Struct basics | Bundles stored properties; gets a free memberwise initializer unless you define your own |
| Struct mutation | Methods that change `self` must be marked `mutating` |
| Class + inheritance | Reference type; subclasses extend behavior with `override`, call up with `super` |
| `final` | Prevents further overriding/subclassing; also enables compiler optimizations |
| Designated vs convenience init | Designated inits set all properties and call `super.init`; convenience inits delegate within the same class |
| `required init` | Forces every subclass to provide its own implementation |
| `deinit` | Runs automatically right before a class instance deallocates; classes only |
| Value vs reference semantics | Structs copy on assignment; classes share the same underlying instance |
| Struct vs class | Default to struct; use class for identity, shared mutable state, or inheritance |
| Computed properties | No storage; recompute via `get`/`set` on every access |
| `willSet`/`didSet` | Observe changes to a stored property without making it computed |
| `lazy` | Deferred, cached computation on first access |
| `static`/`class` members | Belong to the type itself; `class` allows subclass overriding, `static` doesn't |
| Subscripts | Enable `instance[index]` syntax via `get`/`set`, the same mechanism behind Array/Dictionary |
| Enums with raw values | Fixed underlying literal per case; `init?(rawValue:)` is failable |
| Enums with associated values | Each case can carry its own distinct data shape |
| Enum methods/properties | Work like structs; state-changing methods need `mutating` |
| `CaseIterable` | Synthesizes `allCases`; only for enums without associated values |
| `indirect` enums | Enables recursive enum cases by boxing them behind a pointer |
| Nested types | Scope helper types to their owning type, documenting the relationship |
| Enums over booleans | Make illegal state combinations unrepresentable by construction |

**Next up:** [Section 7 — Protocols and Extensions](/articles/protocols-and-extensions).
