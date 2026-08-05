# Part 1, Section 11 — Advanced Type System 🟠

*Estimated read time: ~30 minutes*

This section covers Swift's more specialized type-system features: key paths, dynamic member/callable lookup, operator overloading, ownership and noncopyable types, access control, and the compiler annotations that matter for library authors (`@inlinable`, `@frozen`, ABI stability).

---

## 11.1 Key Paths: `KeyPath` and `WritableKeyPath`

A key path is a first-class, reusable reference to a property — not the property's *value*, but a pointer-like handle to "the `.name` property" itself, which can be stored, passed around, and applied to different instances later.

```swift
struct Person {
    let name: String
    var age: Int
}

let nameKeyPath: KeyPath<Person, String> = \Person.name
let ageKeyPath: WritableKeyPath<Person, Int> = \Person.age

let person = Person(name: "Ada", age: 30)
print(person[keyPath: nameKeyPath])   // "Ada"

var mutablePerson = person
mutablePerson[keyPath: ageKeyPath] = 31
print(mutablePerson.age)   // 31
```

`KeyPath` is read-only (works for `let` or computed get-only properties); `WritableKeyPath` supports both reading and writing (requires a `var` property). Key paths are especially useful for generic code that needs to operate on "some property, to be specified later" without knowing which one in advance.

---

## 11.2 Key Paths as Functions

Since Swift 5.2, a key path literal can be used directly wherever a function of the matching shape (`(Root) -> Value`) is expected — most commonly with `map`:

```swift
struct Person {
    let name: String
    var age: Int
}

let people = [Person(name: "Ada", age: 30), Person(name: "Alan", age: 25)]

let names = people.map(\.name)          // equivalent to people.map { $0.name }
let ages = people.map(\.age)

print(names)   // ["Ada", "Alan"]
print(ages)    // [30, 25]
```

This works because Swift automatically bridges a key path to a closure of the appropriate type at the call site — `\.name` behaves exactly like `{ $0.name }`, just more concisely, and it composes well with `sorted(by:)` when paired with a comparator too.

---

## 11.3 `@dynamicMemberLookup`

`@dynamicMemberLookup` lets a type support dot-syntax access to properties that aren't declared at compile time — the compiler rewrites `instance.someUndeclaredProperty` into a call to a special `subscript(dynamicMember:)` method you implement, commonly used for flexible wrappers around loosely-typed data like JSON.

```swift
@dynamicMemberLookup
struct JSON {
    private var storage: [String: Any]

    subscript(dynamicMember member: String) -> Any? {
        storage[member]
    }
}

let json = JSON(storage: ["name": "Nahidul", "age": 28])
print(json.name as Any)   // Optional("Nahidul") — "name" was never declared as a real property
print(json.age as Any)    // Optional(28)
```

This is powerful but should be used sparingly in application code — it trades compile-time safety (typos in property names become runtime `nil`s instead of compile errors) for flexibility, so it's best reserved for genuinely dynamic data sources where a fixed property list isn't feasible.

---

## 11.4 `@dynamicCallable`

`@dynamicCallable` lets an instance of a type be **called** directly like a function, `instance(...)`, by implementing a `dynamicallyCall` method — a rarer, more specialized feature typically used for building embedded DSLs or scripting-language bridges.

```swift
@dynamicCallable
struct Multiplier {
    func dynamicallyCall(withArguments args: [Int]) -> Int {
        args.reduce(1, *)
    }
}

let multiply = Multiplier()
print(multiply(2, 3, 4))   // 24 — calls dynamicallyCall(withArguments: [2, 3, 4])
```

There's also a keyword-argument variant, `dynamicallyCall(withKeywordArguments:)`, accepting labeled arguments. In practice, `@dynamicCallable` is one of Swift's least commonly used features in everyday app code — worth recognizing if you encounter it, but rarely something you'll reach for yourself.

---

## 11.5 Operator Overloading and Custom Operators

Swift lets you overload existing operators for your own types (matching what you saw partially in section 7's `Equatable`/`Comparable` conformances) and even define entirely new operators:

```swift
struct Vector2D {
    var x: Double
    var y: Double

    static func + (lhs: Vector2D, rhs: Vector2D) -> Vector2D {
        Vector2D(x: lhs.x + rhs.x, y: lhs.y + rhs.y)
    }

    static prefix func - (vector: Vector2D) -> Vector2D {
        Vector2D(x: -vector.x, y: -vector.y)
    }
}

let a = Vector2D(x: 1, y: 2)
let b = Vector2D(x: 3, y: 4)
print(a + b)    // Vector2D(x: 4.0, y: 6.0)
print(-a)        // Vector2D(x: -1.0, y: -2.0)
```

Entirely new custom operators must be declared with `prefix`, `infix`, or `postfix` before being defined, and (for infix operators) usually need an associated precedence group (see 11.6):

```swift
infix operator **: MultiplicationPrecedence

func ** (base: Double, exponent: Double) -> Double {
    pow(base, exponent)
}

print(2.0 ** 10.0)   // 1024.0
```

Custom operators can improve readability for domain-specific math or DSL-like code, but overuse (especially of obscure symbols) tends to hurt readability for anyone unfamiliar with the specific operator — use sparingly and only where the notation genuinely matches domain convention.

---

## 11.6 Precedence Groups

A precedence group defines how a custom infix operator interacts with others in the same expression — specifically, its relative precedence (which operators bind tighter) and associativity (how a chain of the same operator groups, left-to-right or right-to-left).

```swift
precedencegroup ExponentiationPrecedence {
    higherThan: MultiplicationPrecedence
    associativity: right   // 2 ** 3 ** 2 groups as 2 ** (3 ** 2), not (2 ** 3) ** 2
}

infix operator **: ExponentiationPrecedence

func ** (base: Double, exponent: Double) -> Double {
    pow(base, exponent)
}

print(2.0 * 3.0 ** 2.0)   // 18.0 — ** binds tighter than *, so this is 2.0 * (3.0 ** 2.0)
```

Getting precedence and associativity right matters for making a custom operator behave the way users would intuitively expect (matching, where possible, well-established mathematical convention) rather than surprising them with unexpected grouping.

---

## 11.7 Noncopyable Types with `~Copyable` 🔴

By default, every Swift type is implicitly copyable — assigning a struct's value creates an independent copy (recall section 6.9). `~Copyable` (introduced in Swift 5.9) opts a type *out* of that default, producing a type that can only ever be **moved**, never duplicated — useful for modeling unique resources (a file handle, a lock) where having two independent copies would be semantically wrong.

```swift
struct UniqueToken: ~Copyable {
    let id: Int
}

func consume(_ token: consuming UniqueToken) {
    print("Consuming token \(token.id)")
}

let token = UniqueToken(id: 1)
consume(token)
// consume(token)   // ❌ error: 'token' used after being consumed — it was moved, not copied
```

Once a noncopyable value is passed to a `consuming` function (or otherwise moved), the original binding becomes unusable — the compiler enforces, at compile time, that there's never more than one "owner" of the value at once, which is a strong, zero-runtime-cost guarantee against use-after-free-style logic bugs for unique resources.

---

## 11.8 Ownership: `consuming`, `borrowing`, `inout` 🔴

These three parameter modifiers describe exactly how a function intends to interact with an argument's ownership — most relevant (though not exclusively) for noncopyable types from 11.7, since ownership becomes an explicit, enforced concern once copying isn't automatically available as a fallback.

```swift
struct Resource: ~Copyable {
    let name: String
}

func inspect(_ resource: borrowing Resource) {
    print("Just looking at \(resource.name)")   // temporary read access, caller keeps ownership
}

func destroy(_ resource: consuming Resource) {
    print("Destroying \(resource.name)")   // takes ownership; caller can no longer use it afterward
}

func rename(_ resource: inout Resource) {
    // could reassign resource = Resource(name: "new name") here
}
```

`borrowing` requests temporary, read-only access without taking ownership (the caller retains it); `consuming` takes full ownership, ending the caller's ability to use the value afterward; `inout` (already familiar from section 5.5) allows temporary exclusive mutable access, with ownership returning to the caller once the function returns. For ordinary copyable types, these annotations are optional, fine-grained performance hints; for noncopyable types, they become load-bearing — the compiler actively enforces the described ownership transfer.

---

## 11.9 `~Escapable` and Lifetime Dependencies 🔴

`~Escapable` (introduced alongside Swift's ownership features) marks a type whose values are tied to a specific, bounded lifetime — they cannot "escape" beyond the scope that guarantees the data they depend on remains valid, similar in spirit to Rust's borrow-checked references, but far less commonly encountered in everyday Swift code.

```swift
struct DataView: ~Escapable {
    let pointer: UnsafeBufferPointer<UInt8>

    // a lifetime dependency ties this value's validity to the buffer's own lifetime
    init(scanning buffer: borrowing [UInt8]) {
        // conceptual illustration — real usage requires explicit lifetime annotations
        self.pointer = buffer.withUnsafeBufferPointer { $0 }
    }
}
```

The practical motivation: some low-level APIs (like `Span`, covered in section 15.3) want to hand out a lightweight, non-owning view into existing memory without allowing that view to be stored or used after the underlying memory it points to might no longer be valid — `~Escapable` gives the compiler the tools to enforce that boundary statically, at the cost of real added complexity in the type's usage rules.

---

## 11.10 Access Control Levels Including `package`

Swift's access control levels, from most to least restrictive: `private` (visible only within the enclosing declaration, and extensions in the same file), `fileprivate` (visible anywhere in the same source file), `internal` (the default — visible anywhere within the same module), `package` (visible anywhere within the same package, across multiple modules — introduced in Swift 5.9), and `public`/`open` (visible outside the module; `open` additionally allows subclassing/overriding from outside).

```swift
private var secretCache: [String: Any] = [:]        // only visible in this file/scope
internal struct Config { }                            // default — visible throughout this module
public struct APIClient {                              // visible to modules that import this one
    public init() { }
    public func request() { }
}

open class BaseViewModel {   // can be subclassed even from outside this module
    open func setup() { }     // can be overridden even from outside this module
}
```

`package` fills a real gap that existed before Swift 5.9: previously, sharing code between multiple related modules *within the same app or package* (but not exposing it publicly to external consumers) required either making everything `public` (over-exposing your API) or duplicating code. `package` lets multiple modules that are part of the same package collaborate freely, while still keeping that code invisible to genuinely external consumers of the package.

---

## 11.11 `@inlinable` and `@usableFromInline` 🔴

These attributes matter specifically for **library authors** using resilient (ABI-stable) modules — they let the compiler inline a function's body directly into the *caller's* compiled code, even across module boundaries, for performance-critical code paths that would otherwise pay a cross-module call overhead.

```swift
public struct Vector {
    @usableFromInline internal var x: Double
    @usableFromInline internal var y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }

    @inlinable
    public func magnitude() -> Double {
        (x * x + y * y).squareRoot()   // the body is exposed for inlining into callers
    }
}
```

`@inlinable` exposes a function's actual implementation as part of the module's public interface (so callers in other modules can inline it), which requires any `internal` members it touches (like `x`/`y` here) to be marked `@usableFromInline` — explicitly opting them into being visible to that inlined code, without making them fully `public`. This is a narrow, advanced optimization tool, primarily relevant when authoring performance-sensitive public frameworks, not everyday application code.

---

## 11.12 `@frozen` and Library Evolution 🔴

By default, a `public` struct or enum in a **resilient** library (one built with library evolution support, like the ones shipped in the OS itself) is treated as an opaque, potentially-changing-shape type from the outside — callers can't assume its exact memory layout, since the library author might add stored properties or enum cases in a future version without breaking already-compiled client binaries.

```swift
@frozen public struct Point {
    public var x: Double
    public var y: Double
}
```

`@frozen` is a library author's promise: "this type's layout (its stored properties, in this exact order) is fixed forever — I will never add, remove, or reorder them in a future version." This unlocks performance optimizations for callers (no indirection needed to account for a potentially-different future layout), at the cost of permanently giving up the ability to evolve that type's stored properties later. This attribute is essentially irrelevant for regular app code (which isn't a resilient library) and matters almost exclusively for framework/library authors, especially Apple's own system frameworks.

---

## 11.13 ABI Stability vs Module Stability 🔴

**ABI (Application Binary Interface) stability** means compiled binaries built against one version of a library continue working correctly against a *newer* version of that library's compiled binary, without recompilation — this is exactly what lets Apple ship the Swift standard library and system frameworks baked into the OS itself, rather than bundled inside every single app.

**Module stability** is a related but distinct guarantee: a library's public interface (via its compiled `.swiftinterface` file) can be reliably consumed by a *different, potentially newer, version of the Swift compiler* than the one that originally built the library — this is what allows a binary framework compiled with an older Swift compiler to still be usable from a project built with a newer one.

```swift
// A resilient, ABI-stable library's public struct — expanded conceptually
// (not literal syntax, just illustrating the guarantee):
//
// v1.0 of the OS-shipped library:
//   public struct URL { /* internal layout A */ }
//
// v2.0 of the OS-shipped library (a later OS release):
//   public struct URL { /* internal layout B, possibly different */ }
//
// An app compiled against v1.0's URL still runs correctly against v2.0's URL at runtime,
// because ABI stability guarantees binary compatibility despite the layout potentially changing.
```

These two guarantees, together, are what make it possible for the Swift runtime and standard library to live inside the OS itself (rather than every app statically linking and shipping its own copy), and for third-party binary frameworks (like ones distributed via Swift Package Manager binary targets, or XCFrameworks) to remain usable across Swift compiler version upgrades. Like `@frozen` and `@inlinable`, this is a topic that matters primarily to platform/framework engineers rather than typical app developers.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Key paths | First-class, reusable references to a property, usable via `instance[keyPath:]` |
| Key paths as functions | `\.property` can be passed directly wherever a `(Root) -> Value` closure is expected |
| `@dynamicMemberLookup` | Enables dot-syntax access to properties not known at compile time — use sparingly |
| `@dynamicCallable` | Lets an instance be called like a function; rare, mostly for DSLs |
| Operator overloading | Define `+`, `-`, etc. for custom types, or introduce entirely new operators |
| Precedence groups | Control how a custom operator's precedence and associativity interact with others |
| `~Copyable` | Opts a type out of default copyability — can only be moved, never duplicated |
| `consuming`/`borrowing`/`inout` | Explicit ownership transfer modes, load-bearing for noncopyable types |
| `~Escapable` | Ties a value's validity to a bounded lifetime it can't outlive |
| Access control + `package` | `private` < `fileprivate` < `internal` < `package` < `public`/`open`; `package` shares code across modules in one package without exposing it externally |
| `@inlinable`/`@usableFromInline` | Expose a function's body for cross-module inlining in performance-critical library code |
| `@frozen` | A library author's promise to never change a public type's layout again |
| ABI/module stability | Let compiled binaries and frameworks remain compatible across library/compiler version changes |

**Next up:** [Section 12 — Result Builders and Property Wrappers](/articles/result-builders-and-property-wrappers).
