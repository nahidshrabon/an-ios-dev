**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 6.1 Defining a Struct with Stored Properties 🟢

A **`struct`** groups related values into **one named type**. Each value is a **stored property**:

```swift
struct Point {
    var x: Double
    var y: Double
}

let origin = Point(x: 0, y: 0)
print(origin.x, origin.y)   // 0.0 0.0
```

A property can have a **default value**. Then you can leave it out when you create the struct:

```swift
struct Circle {
    var center: Point = Point(x: 0, y: 0)
    var radius: Double
}

let unitCircle = Circle(radius: 1.0)   // center uses its default
```

A typical app model is a struct:

```swift
struct Recipe {
    let id: UUID
    var title: String
    var minutes: Int
    var isFavorite = false
}

var pancakes = Recipe(id: UUID(), title: "Pancakes", minutes: 20)
pancakes.isFavorite = true
```

Use `let` for properties that should **never change** after creation (like `id`), and `var` for the rest.

---

## 6.2 Memberwise Initializers 🟢

If a struct has **no initializer of its own**, Swift generates a **memberwise initializer** for free: one parameter per stored property, in the order they are declared:

```swift
struct Point {
    var x: Double
    var y: Double
}

let p = Point(x: 3, y: 4)   // free memberwise init, generated automatically
```

Properties with defaults become **optional parameters** in it:

```swift
struct Settings {
    var volume = 5
    var isMuted = false
}

Settings()                 // both defaults
Settings(volume: 8)        // only volume
Settings(isMuted: true)    // only isMuted
```

**Careful:** as soon as you write **your own `init`** inside the struct, the free memberwise one **disappears**. You must write it yourself if you still need it:

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

**Tip:** put your custom `init` in an **extension**. Then you **keep** the free memberwise initializer too:

```swift
struct Size {
    var width: Double
    var height: Double
}

extension Size {
    init(square side: Double) {
        self.init(width: side, height: side)
    }
}

Size(width: 2, height: 3)   // memberwise init still exists
Size(square: 4)             // plus your own
```

---

## 6.3 Methods on Structs and `mutating` 🟢

Struct methods can **read** properties, but **not change** them by default. A method that changes `self` must be marked **`mutating`**:

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

**Why?** A struct is a **value**. `mutating` tells the compiler (and readers) that calling this method **changes the value**. So you can't call it on a `let` struct, just like you can't assign a property (see 1.1):

```swift
let frozenCounter = Counter()
frozenCounter.increment()   // ❌ error: cannot use mutating member on immutable value: 'frozenCounter' is a 'let' constant
```

A `mutating` method can even **replace `self` completely**:

```swift
mutating func reset() {
    self = Counter()
}
```

A non-mutating method that returns a **new copy** is often nicer. The standard library uses this naming pattern:

```swift
extension Counter {
    func incremented() -> Counter {    // returns a new value, doesn't change self
        var copy = self
        copy.count += 1
        return copy
    }
}

let a = Counter()
let b = a.incremented()   // a.count == 0, b.count == 1
```

| Changes `self` (`mutating`) | Returns a new value |
|---|---|
| `array.sort()` | `array.sorted()` |
| `array.reverse()` | `array.reversed()` |
| `counter.increment()` | `counter.incremented()` |

---

## 6.4 Defining a Class and Inheritance 🟢

A **`class`** is a **reference type** (6.9) that supports **inheritance**: a class can build on another class, its **superclass**. Write the superclass after `:`.

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

`Dog` **inherits** everything from `Animal` (`name`, `init`, `makeSound()`) and adds `fetch()`.

A subclass can be used wherever the superclass is expected:

```swift
let animals: [Animal] = [Animal(name: "Generic"), Dog(name: "Rex")]
for animal in animals {
    print(animal.name)
}

if let dog = animals[1] as? Dog {    // check and cast to the subclass
    print(dog.fetch())
}
```

Unlike structs, **classes get no free memberwise initializer**. You write `init` yourself (rules in 6.6 and 6.7).

---

## 6.5 `override`, `super`, and `final` 🟢

To replace an inherited method in a subclass, write **`override`**. It is **required**: Swift won't let you replace a superclass method by accident.

```swift
class Dog: Animal {
    override func makeSound() -> String {
        "Woof!"
    }
}

let dog = Dog(name: "Rex")
print(dog.makeSound())   // "Woof!"
```

**`super`** calls the **superclass's version**. Use it to **extend** the behavior instead of fully replacing it:

```swift
class Puppy: Dog {
    override func makeSound() -> String {
        super.makeSound() + " (but cuter)"
    }
}

print(Puppy(name: "Buddy").makeSound())   // "Woof! (but cuter)"
```

You know this from UIKit, where you call `super` in lifecycle methods:

```swift
class ProfileViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()        // let UIKit do its own setup first
        title = "Profile"
    }
}
```

**`final`** stops further changes:

- `final class`: nobody can **subclass** it.
- `final func`: no subclass can **override** it.

```swift
final class Robot { }   // cannot be subclassed at all

class Vehicle {
    final func vin() -> String { "1234" }   // cannot be overridden by subclasses
}
```

`final` also **documents your intent**, and makes calls **faster**: the compiler knows no subclass can replace the method, so it can call it directly. Many teams mark classes `final` by default, and remove it only when they really need subclassing.

---

## 6.6 Designated vs Convenience Initializers 🟡

Classes have two kinds of initializers:

- A **designated initializer** is the **main** one. It must set **every stored property**, and then call the superclass's designated initializer (if there is a superclass).
- A **convenience initializer** (marked `convenience`) is a **shortcut**. It can't set properties itself. It must call **another initializer of the same class**.

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

```plaintext
convenience init(color:) ──calls──► init(wheels:color:) (designated) ──► super.init (if any)
```

Convenience initializers remove **duplicated setup code**: all paths go through one designated initializer.

A UIKit example: a convenience initializer for a styled button:

```swift
class RoundedButton: UIButton {
    convenience init(title: String) {
        self.init(type: .system)
        setTitle(title, for: .normal)
        layer.cornerRadius = 8
    }
}
```

---

## 6.7 Initializer Inheritance and `required init` 🔴

If a subclass adds **new stored properties without defaults**, it must write its **own designated initializer**. It sets its own properties **first**, and **then** calls `super.init`:

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

The order matters. This is called **two-phase initialization**:

```plaintext
Phase 1: every class sets its own stored properties, from subclass up to the root
Phase 2: now `self` is fully ready; methods can be called and properties changed
```

```swift
class Dog: Animal {
    var breed: String
    init(name: String, breed: String) {
        super.init(name: name)     // ❌ error: property 'self.breed' not initialized at super.init call
        self.breed = breed
    }
}
```

If a subclass adds **no** designated initializers (and its new properties have defaults), it **inherits** the superclass's initializers automatically:

```swift
class GuideDog: Dog {
    var isWorking = true     // has a default, no init needed
}

let guide = GuideDog(name: "Max", breed: "Labrador")   // inherited from Dog
```

**`required`** forces **every subclass** to have that initializer. This is needed when code creates an instance of a subclass it doesn't know in advance:

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

You meet this in UIKit: subclass a `UIView`, add an `init`, and Xcode asks for `required init?(coder:)`, because storyboards create views that way:

```swift
class BadgeView: UIView {
    init(text: String) {
        super.init(frame: .zero)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}
```

---

## 6.8 `deinit` and Object Teardown 🟢

**`deinit`** runs **automatically, right before a class instance is freed** from memory. Structs and enums have **no** `deinit`: they are values, with no separate identity to clean up.

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

Rules:

- `deinit` has **no parameters** and no `()`.
- You **never call it yourself**.
- A subclass's `deinit` runs first, then the superclass's, automatically.

Use it to **release resources** tied to the object's life: stop timers, remove observers, close files.

```swift
final class ClockViewModel {
    private var timer: Timer?

    func start() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            print("tick")
        }
    }

    deinit {
        timer?.invalidate()     // stop the timer when this object goes away
        print("ClockViewModel freed")
    }
}
```

A `deinit` with a `print` is also a simple **memory leak check**: if the message never appears when you leave a screen, something still holds the object. Section 10 (Memory Management, ARC) explains exactly **when** objects are freed.

---

## 6.9 Value vs Reference Semantics — The Core Difference 🟢

This is the **most important difference** in Swift's type system:

- Assigning or passing a **struct** (or enum) **copies the value**. The two variables are fully **independent**.
- Assigning or passing a **class** instance copies a **reference**. Both variables point to the **same object**. A change through one is visible through the other.

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

```plaintext
Struct:   s1 ──► [x: 0]        s2 ──► [x: 100]      two separate values

Class:    c1 ──┐
               ├──► [x: 100]                         one shared object
          c2 ──┘
```

Notice: `c1` and `c2` are both `let`, but `c2.x = 100` still compiles. For a class, **`let` only fixes which object the name points to**. It does not freeze the object's properties. This surprises many people:

```swift
let c3 = PointClass()
c3 = PointClass()   // ❌ error: cannot assign to value: 'c3' is a 'let' constant
c3.x = 50            // ✅ fine — this mutates the object, not the reference itself
```

Check whether two references point to the **same object** with `===`:

```swift
print(c1 === c2)              // true — same instance
print(c1 === PointClass())    // false — a different instance
```

---

## 6.10 Choosing Struct vs Class in Practice 🟡

Apple's guidance, and the rule most Swift code follows: **use a `struct` by default**. Use a `class` only for a **specific reason**.

| Choose a `class` when you need... | Example |
|---|---|
| **Identity**: two objects with equal values are still "different things" | `UIViewController`, a network connection |
| **Shared mutable state**: many parts of the app change and observe the **same** object | A session manager, an `@Observable` model |
| **Inheritance** | Subclassing `UIView` |
| **Objective-C / UIKit** APIs that require a class | `NSObject` subclasses, delegates |

| Choose a `struct` (the default) for... | Example |
|---|---|
| **Data** models | `User`, `Coordinate`, `Order` |
| Values you pass around and want **safely copied** | Settings, filters, form input |
| Values compared by **content** | Two equal addresses are "the same" |

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

**Why structs by default?** A struct can't be changed by some other part of the app behind your back. That removes a whole class of bugs, and it's much easier to make thread-safe (Part 2).

A bug that classes allow, and structs prevent:

```swift
class FilterClass { var maxPrice = 100 }

let defaults = FilterClass()
let userFilter = defaults          // meant to be a copy...
userFilter.maxPrice = 20           // ...but this also changes `defaults`!
print(defaults.maxPrice)           // 20 😬

struct FilterStruct { var maxPrice = 100 }
let defaults2 = FilterStruct()
var userFilter2 = defaults2
userFilter2.maxPrice = 20
print(defaults2.maxPrice)          // 100 ✅
```

---

## 6.11 Computed Properties 🟢

A **computed property** has **no storage**. It **calculates** its value from other properties **every time** you read it, with a `get` block (and optionally a `set` block):

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

For a **read-only** property with one expression, drop `get { }`:

```swift
var area: Double {
    width * height
}
```

Add a **`set`** block to make it **writable**. Setting it changes the stored properties behind it. The new value is called `newValue`:

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

**Why use them?** The value can **never get out of sync**. If you stored `area` separately, you'd have to remember to update it every time `width` changes.

Computed properties are great for **display text** in apps:

```swift
struct Recipe {
    var title: String
    var minutes: Int

    var durationText: String {
        minutes < 60 ? "\(minutes) min" : "\(minutes / 60) h \(minutes % 60) min"
    }
}

Recipe(title: "Stew", minutes: 95).durationText   // "1 h 35 min"
```

Keep them **cheap**. A computed property looks like a simple read, so readers don't expect slow work. For expensive work, use a method.

---

## 6.12 Property Observers: `willSet` and `didSet` 🟢

**Property observers** run code **just before** (`willSet`) or **just after** (`didSet`) a **stored** property changes. The property stays a normal stored property.

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

- `willSet` gives you **`newValue`** (the value about to be set).
- `didSet` gives you **`oldValue`** (the value before the change).

A common use: run a **side effect** (save, refresh the UI) every time the property changes, so the caller can't forget:

```swift
var username: String = "" {
    didSet {
        guard username != oldValue else { return }   // avoid redundant work
        print("Persisting username: \(username)")
    }
}
```

`didSet` can also **fix up** a value, like clamping it into a range:

```swift
struct Volume {
    var level = 5 {
        didSet { level = min(max(level, 0), 10) }   // keep it between 0 and 10
    }
}

var v = Volume()
v.level = 42
print(v.level)   // 10
```

(Setting the property inside its own `didSet` does **not** trigger the observers again.)

**Note:** observers **don't run** when the property is set inside the type's own `init`. Only later changes trigger them.

---

## 6.13 `lazy` Properties 🟡

A **`lazy`** property is **not created until the first time you read it**. After that, the value is **saved** and reused. This is useful for:

- **Expensive setup** that may never be needed.
- Values that need **other properties** that aren't ready during `init`.

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

A `lazy` property can use `self`, because it runs **after** `init` is done:

```swift
class ProfileViewController: UIViewController {
    let userName = "Alex"

    lazy var titleLabel: UILabel = {
        let label = UILabel()
        label.text = userName              // uses self — fine in a lazy property
        label.font = .preferredFont(forTextStyle: .title1)
        return label
    }()
}
```

Rules and warnings:

- A `lazy` property must be **`var`**: its value changes from "not created yet" to "created".
- It is **not thread-safe**. If two threads read it for the first time **at the same time**, it may be created **twice**. Part 2 (Concurrency) shows safe ways with actors.
- On a **struct**, reading a `lazy` property **changes** the struct, so you can't read it on a `let` struct.

---

## 6.14 Static Properties and Methods 🟢

**`static`** properties and methods belong to the **type itself**, not to one instance. There is **one shared copy**, and you use it through the **type name**:

```swift
struct MathConstants {
    static let pi = 3.14159
    static func square(_ n: Double) -> Double { n * n }
}

print(MathConstants.pi)              // 3.14159
print(MathConstants.square(4))       // 16.0
```

A common pattern: a **shared single instance** (a **singleton**) as a `static` property:

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

(`static let` is created **lazily and thread-safely** on first use. Section 47 explains why singletons make testing harder.)

`static` is also great for **sample data** and **factory methods**:

```swift
struct Recipe {
    var title: String
    var minutes: Int

    static let sample = Recipe(title: "Pancakes", minutes: 20)

    static func quick(_ title: String) -> Recipe {
        Recipe(title: title, minutes: 10)
    }
}

let preview = Recipe.sample          // handy in SwiftUI previews and tests
let toast = Recipe.quick("Toast")
```

In a **class**, you can write `class` instead of `static` for methods and computed properties. Then **subclasses can override** them. `static` members can't be overridden (they are implicitly `final`).

```swift
class Shape {
    class func describe() -> String { "A shape" }
}
class Circle: Shape {
    override class func describe() -> String { "A circle" }
}
```

---

## 6.15 Subscripts 🟡

A **subscript** lets your own type use the `instance[index]` syntax. Declare it with `subscript`, and a `get` (and optional `set`), like a computed property **with parameters**:

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

Subscripts can:

- be **read-only** (no `set`)
- be **overloaded** (several subscripts with different parameter types)
- have **argument labels**, like `numbers[safe: 5]` from 3.3
- be **`static`**

```swift
struct Playlist {
    private var songs: [String]
    init(_ songs: [String]) { self.songs = songs }

    subscript(index: Int) -> String { songs[index] }                       // by position
    subscript(title title: String) -> String? { songs.first { $0 == title } } // by name
}

let list = Playlist(["Intro", "Theme", "Outro"])
list[1]                 // "Theme"
list[title: "Outro"]    // Optional("Outro")
```

This is **exactly** how `array[index]` and `dict[key]` work (section 3). They are normal subscripts in the standard library, not special syntax.

---

## 6.16 Enums with Raw Values 🟢

An **`enum`** defines a type with a **fixed list of possible values**, called **cases**. A **raw value** gives each case a fixed, underlying value of one type (`String`, `Int`, ...). This is useful for saving data and talking to APIs:

```swift
enum Direction: String {
    case north, south, east, west
}

let heading = Direction.north
print(heading.rawValue)   // "north"

let parsed = Direction(rawValue: "south")   // Direction? — failable, since not every string matches
print(parsed as Any)   // Optional(Direction.south)
```

For `String` raw values, the default is the **case name**. You can set your own:

```swift
enum Endpoint: String {
    case recipes = "/api/v1/recipes"
    case profile = "/api/v1/me"
}
```

`Int` raw values **count up** from 0, or from the first value you set:

```swift
enum Priority: Int {
    case low = 1, medium, high   // medium = 2, high = 3, auto-incremented
}
print(Priority.high.rawValue)   // 3
```

Raw-value enums work with **`Codable`** directly, which is great for JSON:

```swift
enum Status: String, Codable { case active, banned }
struct Account: Codable { let name: String; let status: Status }

let json = #"{"name": "Alex", "status": "active"}"#
let account = try JSONDecoder().decode(Account.self, from: Data(json.utf8))
print(account.status)   // active
```

---

## 6.17 Enums with Associated Values 🟢

**Associated values** let **each case carry its own data**. This makes Swift enums much more powerful than C enums, and it's the key to modeling **state** cleanly (6.22).

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

Each case can have a **different shape** of data: one has a `String`, another an `Int` and a `String`, another nothing at all.

| | Raw values | Associated values |
|---|---|---|
| Data per case | One fixed value, same type for all | Any data, different for each case |
| Set when | Declared once | Each time you create a value |
| Example | `Direction.north.rawValue` | `.failure(code: 404, ...)` |

(A case can't have both.)

Use `if case` to check for **one** case without a full `switch`:

```swift
if case .failure(let code, _) = result, code == 404 {
    print("Show the 'not found' screen")
}
```

The standard library's **`Result`** type is an enum with associated values:

```swift
enum Result<Success, Failure: Error> {
    case success(Success)
    case failure(Failure)
}
```

---

## 6.18 Methods and Computed Properties on Enums 🟢

Enums can have **methods** and **computed properties**, just like structs and classes. Put the behavior **on the type**, instead of writing the same `switch` all over your app:

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

A method that changes `self` to **another case** must be **`mutating`**, like on a struct:

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

In an app, enums often provide **UI details** for each case:

```swift
enum Tab: CaseIterable {
    case home, search, profile

    var title: String {
        switch self {
        case .home: "Home"
        case .search: "Search"
        case .profile: "Profile"
        }
    }

    var icon: String {
        switch self {
        case .home: "house"
        case .search: "magnifyingglass"
        case .profile: "person"
        }
    }
}
```

---

## 6.19 `CaseIterable` and Iterating Cases 🟢

Make an enum conform to **`CaseIterable`**, and Swift creates a static **`allCases`** list for you, in declaration order. No hand-written array to keep up to date:

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

This is perfect for **pickers** and **tab bars** in SwiftUI:

```swift
enum SortOrder: String, CaseIterable, Identifiable {
    case newest, oldest, popular
    var id: Self { self }
}

Picker("Sort", selection: $sortOrder) {
    ForEach(SortOrder.allCases) { order in
        Text(order.rawValue.capitalized)
    }
}
```

`CaseIterable` is generated **automatically only for enums without associated values**. A case like `.success(data: String)` has **endless** possible values, so there is no fixed list of "all cases".

---

## 6.20 Indirect Enums and Recursive Data 🔴

Normally, an enum case **can't contain its own enum type**. Swift must know the enum's **size** at compile time, and a value that contains itself would need **infinite** space.

**`indirect`** fixes this. Swift stores that case **behind a pointer** (in a separate box), so the size stays fixed:

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

The value above is a **tree**:

```plaintext
        addition
        /      \
   number(3)  multiplication
               /         \
         number(4)    number(5)
```

You can mark the **whole enum** `indirect` (as above), or only the cases that are recursive:

```swift
enum Tree {
    case leaf(Int)
    indirect case node(Tree, Tree)
}
```

Without `indirect`, the compiler stops you:

```swift
enum List {
    case end
    case item(Int, List)   // ❌ error: recursive enum 'List' is not marked 'indirect'
}
```

---

## 6.21 Nested Types 🟢

You can define a struct, class, or enum **inside** another type. This keeps a helper type **close to where it belongs**, and avoids name clashes:

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

Nesting **shows ownership**: `Card.Suit` only makes sense with a `Card`.

A very common app pattern: errors and constants nested in the type that uses them:

```swift
struct LoginService {
    enum LoginError: Error {
        case wrongPassword
        case accountLocked
    }

    enum Constants {
        static let maxAttempts = 5
    }

    func login(password: String) throws {
        throw LoginError.wrongPassword
    }
}

// Outside: LoginService.LoginError.wrongPassword, LoginService.Constants.maxAttempts
```

(An `enum` with **no cases** is a nice "namespace" for constants: nobody can create an instance of it.)

---

## 6.22 Modeling State with Enums Instead of Booleans 🟡

A common beginner pattern: describe a screen's state with **several separate properties**, like `isLoading`, `hasError`, `errorMessage`, and `items`. The problem: these allow **impossible combinations** that the compiler can't stop. For example, `isLoading` **and** `hasError` **and** items, all at once.

```swift
// Problematic: booleans allow impossible states
struct ScreenStateBooleans {
    var isLoading = false
    var hasError = false
    var errorMessage: String?
    var items: [String]?
}
```

Count them: 2 × 2 × (nil or text) × (nil or list) = **16 combinations**, but only **4 make sense**.

An **enum with associated values** lists **exactly the valid states**. You can only be in **one case at a time**, so impossible combinations **can't even be written**:

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

In SwiftUI, the view becomes a simple `switch`:

```swift
struct RecipeListView: View {
    let state: ScreenState

    var body: some View {
        switch state {
        case .idle, .loading:
            ProgressView()
        case .loaded(let items):
            List(items, id: \.self) { Text($0) }
        case .failed(let message):
            ContentUnavailableView("Couldn't load", systemImage: "wifi.slash", description: Text(message))
        }
    }
}
```

And if you add a new state later, the compiler shows you **every `switch`** that needs updating.

This idea, "**make impossible states impossible**", is one of the most useful things enums do in real apps. Section 45 (Architecture Foundations) goes deeper.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Struct basics | Groups stored properties; gets a free memberwise initializer |
| Struct mutation | Methods that change `self` must be `mutating` |
| Class + inheritance | Reference type; subclasses use `override` and `super` |
| `final` | No more subclassing or overriding; also faster calls |
| Designated vs convenience init | Designated sets everything; convenience calls another init |
| `required init` | Every subclass must provide this initializer |
| `deinit` | Runs just before a class instance is freed; classes only |
| Value vs reference semantics | Structs are copied; class instances are shared |
| Struct vs class | Struct by default; class for identity, shared state, or inheritance |
| Computed properties | No storage; calculated on every read |
| `willSet`/`didSet` | React to changes of a stored property |
| `lazy` | Created on first use, then saved; not thread-safe |
| `static`/`class` members | Belong to the type; only `class` members can be overridden |
| Subscripts | Give your type `[ ]` syntax, like Array and Dictionary |
| Enums with raw values | A fixed value per case; `init?(rawValue:)` can fail |
| Enums with associated values | Each case carries its own data |
| Enum methods/properties | Put behavior on the enum; `mutating` to change the case |
| `CaseIterable` | Free `allCases`; only without associated values |
| `indirect` enums | Allow recursive cases, like trees |
| Nested types | Keep helper types inside the type that owns them |
| Enums over booleans | Make impossible states impossible to write |
