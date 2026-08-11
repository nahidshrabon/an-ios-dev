*Estimated read time: ~30 minutes*

---

## 8.1 Why Generics: The Duplicate-Code Problem

Without generics, supporting multiple types means writing near-identical functions repeatedly:

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

All three functions are identical except for the type — exactly the kind of duplication generics eliminate, letting you write the logic once and have the compiler generate type-specific versions as needed.

---

## 8.2 Generic Functions and Type Parameters

A generic function introduces a **type parameter** (conventionally named `T`, or something descriptive) in angle brackets, standing in for a type the caller determines:

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

`T` is a placeholder Swift resolves at each call site based on the actual argument types — the compiler generates specialized code as if you'd written `swapInts`/`swapStrings` by hand, but you only wrote the logic once. Multiple type parameters are just as easy:

```swift
func makePair<A, B>(_ first: A, _ second: B) -> (A, B) {
    (first, second)
}

let pair = makePair(1, "one")   // (Int, String)
```

---

## 8.3 Generic Types

Types themselves — structs, classes, enums — can be generic too, parameterized over the type(s) they hold:

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

`Optional<Wrapped>` and `Array<Element>` (which you've been using since sections 3–4) are themselves generic types defined exactly this way in the standard library — there's nothing special-cased about them.

---

## 8.4 Type Constraints with `where`

An unconstrained type parameter `T` can be *anything*, which means you can't call any type-specific operations on it (like `<` or `==`) unless you constrain it. A constraint restricts `T` to types conforming to a specific protocol:

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

For more complex constraints — especially involving multiple type parameters or associated types (8.5) — a `where` clause after the parameter list is more flexible than inline constraints:

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

You can also stack multiple constraints with `&`, requiring conformance to several protocols at once: `func process<T: Equatable & Hashable>(_ value: T)`.

---

## 8.5 Associated Types in Protocols

A protocol can declare a **placeholder type** — an associated type — that conforming types fill in with a concrete type, using `associatedtype`. This is how protocols like `Sequence` and `Collection` (fully explored in section 14) stay generic over their element type:

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

Unlike a generic function's type parameter (which the *caller* specifies), an associated type is determined by the *conforming type* itself, inferred from how it implements the protocol's requirements — `IntContainer` never explicitly writes `Item = Int`; Swift infers it from the `add(_ item: Int)` signature.

```swift
struct StringContainer: Container {
    var items: [String] = []
    mutating func add(_ item: String) {
        items.append(item)
    }
    var count: Int { items.count }
}
```

---

## 8.6 Generic Constraints on Extensions

You can extend a generic type with functionality that only applies when its type parameter meets a certain constraint — this was already seen conceptually in 7.6 (conditional conformance), but it applies just as well to plain methods, not just protocol conformances:

```swift
extension Stack where Element: Equatable {
    func contains(_ item: Element) -> Bool {
        items.contains(item)
    }
}
```

This `contains` method only exists on `Stack<Element>` when `Element` is `Equatable` — `Stack<SomeNonEquatableType>` simply won't have this method available at all, and the compiler enforces that at the call site.

```swift
var numberStack = Stack<Int>()
numberStack.push(5)
print(numberStack.contains(5))   // true — Int is Equatable, so this compiles

struct NotEquatable { }
var weirdStack = Stack<NotEquatable>()
// weirdStack.contains(...)   // ❌ error: this method doesn't exist for this Stack specialization
```

---

## 8.7 `some` — Opaque Return Types

`some Protocol` as a return type means "this function returns *some specific, concrete type* conforming to `Protocol`, but the caller doesn't get to know exactly which one — only that it's consistent across all calls to this specific function." This is heavily used in SwiftUI (`some View`), but applies generally:

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

The key benefit: the compiler knows the *real*, concrete underlying type at compile time (enabling full static dispatch and optimization), while the function's public signature hides that detail from callers — useful for encapsulation, and required for protocols with associated types (like `some View`), which can't otherwise be used as a plain return type at all.

---

## 8.8 `any` — Existential Types

`any Protocol` is different: it's a **boxed container** that can hold *any* type conforming to `Protocol`, and the specific concrete type can vary at runtime, even across multiple values stored in the same collection:

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

This is impossible with `some Shape` — `some` fixes one specific type per function/context, so you couldn't declare `[some Shape]` mixing genuinely different concrete types. `any Shape` gives up that compile-time specificity in exchange for genuine runtime heterogeneity.

---

## 8.9 `some` vs `any`: Performance and Legality

`some` (opaque types) preserve full static type information at compile time, enabling the compiler to use direct, non-boxed static dispatch — generally faster, with no extra runtime indirection. `any` (existential types) erase the concrete type into a runtime-checked box, which typically involves heap allocation and dynamic (witness table) dispatch — generally slower, though flexible.

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

Notice the legality difference too: `makeSomeShape` above *couldn't* be written with `some Shape`, because it might return two genuinely different concrete types depending on the branch — `some` requires exactly one fixed underlying type per function. **Default to `some`** wherever a single concrete type is guaranteed; reach for `any` only when you specifically need heterogeneous storage or truly dynamic type selection.

---

## 8.10 Primary Associated Types: `Collection<Int>`

Since Swift 5.7, protocols can expose their associated types directly in angle-bracket syntax at the use site — called **primary associated types** — making constraints far more readable than the older, more verbose `where` clause spelling:

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
```

`Collection<Int>` here reads almost like a generic type instantiation, even though `Collection` is a protocol with `Element` declared as its primary associated type — this syntax is purely a readability improvement over the equivalent `where` clause; both compile to the same constraint.

---

## 8.11 Type Erasure: Writing an `AnyX` Wrapper

Before opaque types (`some`) existed, and still in cases requiring genuine heterogeneous storage, **type erasure** is the classic technique for hiding a generic type's concrete parameter behind a concrete wrapper type — the standard library's own `AnySequence`, `AnyHashable`, and similar types all use this pattern.

```swift
protocol Animal {
    associatedtype Food
    func eat(_ food: Food)
}

// Animal has an associated type, so you can't write `[any Animal]` directly —
// existentials can't be formed from protocols with associated type requirements
// (without primary associated types constraining them). A type-erased wrapper solves this:

struct AnyAnimal<Food>: Animal {
    private let _eat: (Food) -> Void

    init<A: Animal>(_ animal: A) where A.Food == Food {
        var animal = animal
        _eat = { food in animal.eat(food) }
    }

    func eat(_ food: Food) {
        _eat(food)
    }
}
```

The wrapper stores the underlying logic as a closure captured at initialization time, forwarding calls to the original concrete instance — this "erases" the specific concrete type (`A`) while preserving behavior, letting you store a homogeneous array of erased wrappers (`[AnyAnimal<String>]`) even though the original types were all different.

---

## 8.12 Variadic Generics and Parameter Packs

Introduced in Swift 5.9, **parameter packs** let a generic function or type accept a variable number of *differently-typed* generic parameters — something previously only possible for same-typed variadics (recall `Int...` from 5.4).

```swift
func makeTuple<each T>(_ value: repeat each T) -> (repeat each T) {
    (repeat each value)
}

let result = makeTuple(1, "two", 3.0)   // (Int, String, Double)
```

`each T` declares a *pack* of type parameters (rather than a single type), and `repeat each value` expands the pack at both the parameter list and the return type — this is what allows the function to accept and return an arbitrary-length, arbitrarily-typed tuple, something that previously required hand-writing separate overloads for 2-tuples, 3-tuples, 4-tuples, and so on.

---

## 8.13 Phantom Types for Compile-Time Safety

A phantom type is a generic type parameter that appears in a type's declaration but is never actually *used* by any of its stored properties — it exists purely to let the compiler distinguish between otherwise-identical values at compile time, catching category errors that would otherwise only surface at runtime.

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

`Meters` and `Feet` here are never actually stored anywhere inside `Distance` — they exist purely as compile-time tags. This pattern catches unit-mismatch bugs (adding meters to feet without conversion) as a compile error rather than a runtime bug, at zero runtime cost, since the phantom type parameter disappears entirely after compilation.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| The duplication problem | Generics let you write logic once instead of near-identical per-type copies |
| Generic functions | `<T>` introduces a placeholder type resolved per call site |
| Generic types | Structs/classes/enums can be parameterized too — `Array` and `Optional` are built this way |
| Type constraints (`where`) | Restrict a type parameter to conform to specific protocols, unlocking type-specific operations |
| Associated types | A protocol's own placeholder type, filled in by each conforming type, not the caller |
| Constrained extensions | Add methods to a generic type only when its parameter meets a condition |
| `some` (opaque types) | One specific, compiler-known concrete type per context — fast, static dispatch |
| `any` (existential types) | A runtime box holding any conforming type — enables heterogeneous storage, costs more |
| `some` vs `any` | Default to `some` for a single guaranteed type; use `any` only for genuine runtime variety |
| Primary associated types | `Collection<Int>` syntax as sugar over the equivalent `where` clause |
| Type erasure (`AnyX`) | Wraps a concrete generic type behind closures to hide its specific type parameter |
| Parameter packs | `each T` / `repeat each` enable variadic generics over differently-typed parameters |
| Phantom types | Unused generic parameters that exist purely to enforce compile-time category safety |

**Next up:** [Section 9 — Error Handling](/articles/error-handling).
