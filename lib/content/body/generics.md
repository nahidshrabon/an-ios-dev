**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 8.1 Why Generics: The Duplicate-Code Problem 🟢

Without generics, supporting several types means writing **almost the same function** again and again:

```swift
func swapInts(_ a: inout Int, _ b: inout Int) {
    let temp = a; a = b; b = temp
}

func swapStrings(_ a: inout String, _ b: inout String) {
    let temp = a; a = b; b = temp
}

func swapDoubles(_ a: inout Double, _ b: inout Double) {
    let temp = a; a = b; b = temp
}
```

The three functions are **identical except for the type**. **Generics** remove this duplication: you write the logic **once**, and it works for **any type**.

You already use generics every day. `Array`, `Dictionary`, `Optional`, and `Result` are all generic:

```swift
let names: Array<String> = ["Alex"]          // usually written [String]
let ages: Dictionary<String, Int> = [:]      // usually written [String: Int]
let maybe: Optional<Int> = nil               // usually written Int?
```

---

## 8.2 Generic Functions and Type Parameters 🟢

A **generic function** declares a **type parameter** in angle brackets, like `<T>`. `T` is a **placeholder** for a real type, chosen by the **caller**:

```swift
func swapValues<T>(_ a: inout T, _ b: inout T) {
    let temp = a
    a = b
    b = temp
}

var x = 1, y = 2
swapValues(&x, &y)
print(x, y)   // 2 1

var s1 = "hello", s2 = "world"
swapValues(&s1, &s2)
print(s1, s2)   // "world" "hello"
```

At each call, Swift **infers** `T` from the arguments: `Int` in the first call, `String` in the second. Both arguments must have the **same** `T`:

```swift
var n = 1
var text = "a"
swapValues(&n, &text)   // ❌ error: conflicting arguments to generic parameter 'T' ('Int' vs. 'String')
```

The type check is still **fully static**: you get the safety of separate functions, but write the logic once. (The optimizer often creates specialized fast versions for the types you actually use.)

You can have **several** type parameters:

```swift
func makePair<A, B>(_ first: A, _ second: B) -> (A, B) {
    (first, second)
}

let pair = makePair(1, "one")   // (Int, String)
```

**Naming:** `T` is fine for short, general functions. For clearer code, use a **descriptive name**, like the standard library does: `Element`, `Key`, `Value`, `Wrapped`.

---

## 8.3 Generic Types 🟢

Types (structs, classes, enums) can be generic too. The type parameter says **what they hold**:

```swift
struct Stack<Element> {
    private var items: [Element] = []

    mutating func push(_ item: Element) {
        items.append(item)
    }

    mutating func pop() -> Element? {
        items.popLast()
    }

    var isEmpty: Bool { items.isEmpty }
}

var intStack = Stack<Int>()
intStack.push(1)
intStack.push(2)
print(intStack.pop())   // Optional(2)

var stringStack = Stack<String>()
stringStack.push("a")
stringStack.push("b")
```

`Stack<Int>` and `Stack<String>` are **different types**. You can't push a `String` onto a `Stack<Int>`:

```swift
intStack.push("three")   // ❌ error: cannot convert value of type 'String' to expected argument type 'Int'
```

`Optional<Wrapped>` and `Array<Element>` (sections 3–4) are written **exactly this way** in the standard library. Nothing about them is special.

A real app example: a generic loading state you can reuse for every screen:

```swift
enum Loadable<Value> {
    case idle
    case loading
    case loaded(Value)
    case failed(Error)
}

var recipes: Loadable<[Recipe]> = .loading
var profile: Loadable<User> = .idle
```

---

## 8.4 Type Constraints with `where` 🟡

A plain `T` can be **any** type. So you can't use `<` or `==` on it: not every type supports them. A **constraint** limits `T` to types that conform to a protocol, and that **unlocks** the protocol's operations:

```swift
func findLargest<T: Comparable>(_ items: [T]) -> T? {
    guard var largest = items.first else { return nil }
    for item in items.dropFirst() where item > largest {
        largest = item
    }
    return largest
}

print(findLargest([3, 7, 2, 9, 4]))         // Optional(9)
print(findLargest(["banana", "apple", "cherry"]))   // Optional("cherry")
```

Without `: Comparable`, the `>` line doesn't compile:

```swift
func findLargestBroken<T>(_ items: [T]) -> T? {
    // item > largest   ❌ error: binary operator '>' cannot be applied to two 'T' operands
    nil
}
```

For more complex rules (several type parameters, or associated types from 8.5), use a **`where` clause** after the signature:

```swift
func allEqual<T: Sequence>(_ sequence: T) -> Bool where T.Element: Equatable {
    var iterator = sequence.makeIterator()
    guard let first = iterator.next() else { return true }
    while let next = iterator.next() {
        if next != first { return false }
    }
    return true
}

print(allEqual([1, 1, 1]))   // true
print(allEqual([1, 2, 1]))   // false
```

Combine protocols with `&`:

```swift
func uniqueCount<T: Hashable & CustomStringConvertible>(_ values: [T]) -> String {
    "\(Set(values).count) unique: \(values.map(\.description))"
}
```

Or require two type parameters to match:

```swift
func haveSameItems<A: Sequence, B: Sequence>(_ a: A, _ b: B) -> Bool
    where A.Element == B.Element, A.Element: Hashable {
    Set(a) == Set(b)
}

haveSameItems([1, 2, 3], Set([3, 2, 1]))   // true — an Array and a Set
```

---

## 8.5 Associated Types in Protocols 🟡

A protocol can declare its own **placeholder type** with **`associatedtype`**. Each **conforming type** fills it in. This is how `Sequence` and `Collection` (section 14) work with any element type:

```swift
protocol Container {
    associatedtype Item
    mutating func add(_ item: Item)
    var count: Int { get }
}

struct IntContainer: Container {
    var items: [Int] = []
    mutating func add(_ item: Int) {   // Item is inferred as Int here
        items.append(item)
    }
    var count: Int { items.count }
}
```

| | Generic type parameter (`<T>`) | Associated type |
|---|---|---|
| Declared on | A function or type | A protocol |
| Chosen by | The **caller** | The **conforming type** |
| Example | `swapValues(&a, &b)` picks `T` | `IntContainer` picks `Item = Int` |

`IntContainer` never writes `Item = Int`. Swift **infers** it from `add(_ item: Int)`. You can also write it explicitly:

```swift
struct StringContainer: Container {
    typealias Item = String          // optional: explicit, instead of inferred
    var items: [String] = []
    mutating func add(_ item: String) {
        items.append(item)
    }
    var count: Int { items.count }
}
```

A **generic** type can conform too, passing its own parameter through:

```swift
struct Box<T>: Container {
    var items: [T] = []
    mutating func add(_ item: T) { items.append(item) }   // Item = T
    var count: Int { items.count }
}
```

Associated types can have **constraints**:

```swift
protocol Repository {
    associatedtype Model: Identifiable & Codable
    func fetchAll() async throws -> [Model]
}
```

---

## 8.6 Generic Constraints on Extensions 🟡

You can extend a generic type with methods that exist **only when** its type parameter meets a condition. You saw this for conformances in 7.6; it works for plain methods too:

```swift
extension Stack where Element: Equatable {
    func contains(_ item: Element) -> Bool {
        items.contains(item)
    }
}
```

(For this to compile, `items` must be visible to the extension. Make it `private(set) var items` or move the extension into the same file.)

Now `contains` exists **only** on stacks whose elements are `Equatable`. The compiler checks this at every call:

```swift
var numberStack = Stack<Int>()
numberStack.push(5)
print(numberStack.contains(5))   // true — Int is Equatable, so this compiles

struct NotEquatable { }
var weirdStack = Stack<NotEquatable>()
// weirdStack.contains(...)   // ❌ error: this method doesn't exist for this Stack specialization
```

You can also target **one specific type**:

```swift
extension Stack where Element == String {
    func joined() -> String {
        items.joined(separator: " ")
    }
}

var words = Stack<String>()
words.push("hello"); words.push("world")
words.joined()   // "hello world"
```

The standard library does this a lot. For example, `joined()` exists only on sequences of strings, and `sum`-like helpers only on numeric collections.

---

## 8.7 `some` — Opaque Return Types 🟡

**`some Protocol`** as a return type means: "this returns **one specific concrete type** that conforms to `Protocol`. The caller doesn't know **which** type, only that it is always the same one."

You use this all the time in SwiftUI (`some View`), but it works everywhere:

```swift
protocol Shape {
    func area() -> Double
}

struct Circle: Shape {
    var radius: Double
    func area() -> Double { .pi * radius * radius }
}

func makeShape() -> some Shape {
    Circle(radius: 2)   // the caller knows it's "some Shape," not specifically that it's a Circle
}

let shape = makeShape()
print(shape.area())   // 12.566...
```

**The benefits:**

- The **compiler** knows the real type (`Circle`), so calls are fast and fully optimized.
- The **caller** only sees `some Shape`, so you can change the real type later without breaking callers.
- It works for protocols with **associated types**, like `View`. Its real type is often huge and unreadable:

```swift
var body: some View {
    VStack {
        Text("Hi")
        Image(systemName: "star")
    }
}
// The real type is something like VStack<TupleView<(Text, Image)>>.
// `some View` hides that.
```

`some` also works for **parameters**. It's a short way to write a generic function:

```swift
func printArea(of shape: some Shape) {      // same as: func printArea<S: Shape>(of shape: S)
    print(shape.area())
}
```

---

## 8.8 `any` — Existential Types 🟡

**`any Protocol`** is different. It is a **box** that can hold **any** conforming type, and the type inside can **change at runtime**. Different values in the same array can have different concrete types:

```swift
struct Square: Shape {
    var side: Double
    func area() -> Double { side * side }
}

let shapes: [any Shape] = [Circle(radius: 2), Square(side: 3)]
for shape in shapes {
    print(shape.area())   // 12.566..., then 9.0 — different concrete types, same array
}
```

This is **impossible with `some`**. `some` means **one** fixed type, so a `[some Shape]` can't mix circles and squares.

A variable of type `any` can also be **reassigned** to a different concrete type:

```swift
var current: any Shape = Circle(radius: 1)
current = Square(side: 4)       // ✅ fine — the box now holds a Square
```

To get the concrete type back, cast it:

```swift
if let circle = current as? Circle {
    print("radius: \(circle.radius)")
}
```

---

## 8.9 `some` vs `any`: Performance and Legality 🟡

| | `some Shape` | `any Shape` |
|---|---|---|
| Concrete type | **One**, fixed, known to the compiler | **Any**, can change at runtime |
| Calls | Direct (static dispatch), fast | Through a lookup table (dynamic dispatch) |
| Storage | Stored directly | In a box; large values may need a heap allocation |
| Mixed array | ❌ No | ✅ Yes |

```swift
// some: one concrete type, resolved and optimized at compile time
func makeCircleShape() -> some Shape {
    Circle(radius: 5)
}

// any: a runtime box that could hold literally any Shape-conforming type
func makeSomeShape(random: Bool) -> any Shape {
    random ? Circle(radius: 5) : Square(side: 3)
}
```

Notice the **legality** difference: `makeSomeShape` **can't** return `some Shape`, because it returns **two different** types depending on the branch. `some` needs exactly **one** type per function:

```swift
func broken(random: Bool) -> some Shape {
    if random { return Circle(radius: 5) }
    return Square(side: 3)
    // ❌ error: function declares an opaque return type 'some Shape', but the return
    //    statements in its body do not have matching underlying types
}
```

**Rule:** use **`some` by default**. Use **`any`** only when you really need **different types together** (a mixed array, a property that can change type, a dependency you swap in tests).

---

## 8.10 Primary Associated Types: `Collection<Int>` 🟡

Since Swift 5.7, protocols can declare **primary associated types**. You write them in angle brackets **where you use the protocol**. This is much easier to read than a `where` clause:

```swift
// Older style, still valid
func sumAll<C: Collection>(_ collection: C) -> Int where C.Element == Int {
    collection.reduce(0, +)
}

// Modern style using a primary associated type constraint directly
func sumAllModern(_ collection: some Collection<Int>) -> Int {
    collection.reduce(0, +)
}

print(sumAllModern([1, 2, 3]))   // 6
print(sumAllModern(Set([4, 5])))  // 9 — any collection of Int works
```

`Collection<Int>` looks like a generic type, but `Collection` is a protocol. `<Int>` sets its **primary associated type**, `Element`. Both versions above mean **exactly the same thing**.

Your own protocols can declare one, in angle brackets after the name:

```swift
protocol Repository<Model> {
    associatedtype Model
    func fetchAll() async throws -> [Model]
}

func showCount(from repo: some Repository<Recipe>) async throws {
    print(try await repo.fetchAll().count)
}

let repos: [any Repository<Recipe>] = []   // works with `any` too
```

---

## 8.11 Type Erasure: Writing an `AnyX` Wrapper 🔴

**Type erasure** hides a concrete type behind a **wrapper type**. The standard library has several: `AnySequence`, `AnyHashable`, `AnyPublisher` (Combine). You'll see the pattern in older code, and it's still useful in some cases.

Take a protocol with an associated type:

```swift
protocol Animal {
    associatedtype Food
    func eat(_ food: Food)
}

struct Cat: Animal { func eat(_ food: String) { print("Cat eats \(food)") } }
struct Dog: Animal { func eat(_ food: String) { print("Dog eats \(food)") } }
```

Since Swift 5.7, you **can** write `[any Animal]`. But you **can't call** `eat(_:)` on it: Swift doesn't know **which `Food`** each animal takes.

A **type-erased wrapper** fixes this. It stores the real animal's behavior **in a closure**, and exposes a known `Food` type:

```swift
struct AnyAnimal<Food>: Animal {
    private let _eat: (Food) -> Void

    init<A: Animal>(_ animal: A) where A.Food == Food {
        _eat = animal.eat           // capture the real animal's method
    }

    func eat(_ food: Food) {
        _eat(food)                  // forward the call
    }
}

let pets: [AnyAnimal<String>] = [AnyAnimal(Cat()), AnyAnimal(Dog())]
for pet in pets {
    pet.eat("fish")
}
// Cat eats fish
// Dog eats fish
```

The concrete type (`Cat`, `Dog`) is **erased**, but the **behavior** is kept.

**Today there's often a simpler way:** give the protocol a **primary associated type** (8.10), and use `any Animal<String>`:

```swift
protocol Pet<Food> {
    associatedtype Food
    func eat(_ food: Food)
}
// (with Cat and Dog conforming to Pet instead)
let pets2: [any Pet<String>] = [Cat(), Dog()]
pets2.forEach { $0.eat("fish") }   // works — Food is known to be String
```

---

## 8.12 Variadic Generics and Parameter Packs 🔴

Swift 5.9 added **parameter packs**. A generic function can now take **any number** of values, each with a **different type**. Before, variadic parameters (`Int...`, 5.4) had to share **one** type.

```swift
func makeTuple<each T>(_ value: repeat each T) -> (repeat each T) {
    (repeat each value)
}

let result = makeTuple(1, "two", 3.0)   // (Int, String, Double)
```

- **`each T`** declares a **pack** of types, not just one.
- **`repeat each value`** **expands** the pack: "do this for every value".

**Why it matters:** before packs, libraries had to write **separate overloads** for 2, 3, 4, ... values. SwiftUI did this for its `ViewBuilder` (only up to 10 views!). Packs remove that limit.

A practical example: check that **all** of several optional values are present, whatever their types:

```swift
func allPresent<each T>(_ value: repeat (each T)?) -> Bool {
    for v in repeat each value {
        if v == nil { return false }
    }
    return true
}

let name: String? = "Alex"
let age: Int? = nil
allPresent(name, age)          // false
allPresent(name, 42 as Int?)   // true
```

(`for ... in repeat each` needs Swift 6.0 or later.)

---

## 8.13 Phantom Types for Compile-Time Safety 🔴

A **phantom type** is a generic type parameter that **no property actually uses**. It exists only so the **compiler can tell values apart**, and catch mix-ups at compile time.

```swift
struct Distance<Unit> {
    var value: Double
}

enum Meters { }
enum Feet { }

func addMeters(_ a: Distance<Meters>, _ b: Distance<Meters>) -> Distance<Meters> {
    Distance(value: a.value + b.value)
}

let distanceInMeters = Distance<Meters>(value: 100)
let distanceInFeet = Distance<Feet>(value: 328)

addMeters(distanceInMeters, distanceInMeters)   // ✅ fine — both are Distance<Meters>
addMeters(distanceInMeters, distanceInFeet)      // ❌ compile-time error — mismatched phantom types!
```

`Meters` and `Feet` are **never stored** in `Distance`. They are only **tags** for the compiler. An empty `enum` is perfect for this: nobody can create a value of it.

Now a conversion must be **explicit**:

```swift
extension Distance where Unit == Feet {
    var inMeters: Distance<Meters> {
        Distance<Meters>(value: value * 0.3048)
    }
}

addMeters(distanceInMeters, distanceInFeet.inMeters)   // ✅ converted on purpose
```

A common app use: typed IDs, so you can't pass a recipe ID where a user ID is expected:

```swift
struct ID<Owner>: Hashable {
    let raw: String
}

struct User { let id: ID<User> }
struct Recipe { let id: ID<Recipe> }

func loadUser(_ id: ID<User>) { /* ... */ }

let recipe = Recipe(id: ID(raw: "r-42"))
// loadUser(recipe.id)   // ❌ error: cannot convert value of type 'ID<Recipe>' to 'ID<User>'
```

**The cost at runtime is zero.** The phantom parameter exists only at compile time. `Distance<Meters>` takes exactly as much memory as a plain `Double`.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| The duplication problem | Write the logic once instead of a copy per type |
| Generic functions | `<T>` is a placeholder type, chosen at each call |
| Generic types | Structs, classes, and enums can have type parameters, like `Array` |
| Type constraints (`where`) | Limit `T` to a protocol to unlock its operations |
| Associated types | A protocol's own placeholder, filled in by each conforming type |
| Constrained extensions | Methods that exist only when the type parameter fits |
| `some` (opaque types) | One hidden, fixed concrete type; fast |
| `any` (existential types) | A box for any conforming type; mixed collections; slower |
| `some` vs `any` | `some` by default; `any` only when types must vary |
| Primary associated types | `some Collection<Int>`: short form of a `where` clause |
| Type erasure (`AnyX`) | Wraps a concrete type in closures; often replaced by `any P<T>` today |
| Parameter packs | `each T` / `repeat each`: any number of differently-typed values |
| Phantom types | Unused type parameters as compile-time tags; zero runtime cost |
