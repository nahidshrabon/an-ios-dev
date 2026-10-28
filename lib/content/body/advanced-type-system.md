**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 11.1 Key Paths: `KeyPath` and `WritableKeyPath` 🟡

A **key path** is a **reference to a property itself**, not to its value. `\Person.name` means "the `name` property of a `Person`". You can store it, pass it around, and use it on **any** `Person` later.

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

| Type | Can read | Can write | For |
|---|---|---|---|
| `KeyPath<Root, Value>` | ✅ | ❌ | `let` and get-only properties |
| `WritableKeyPath<Root, Value>` | ✅ | ✅ | `var` properties of a value type |
| `ReferenceWritableKeyPath` | ✅ | ✅ | `var` properties of a class |

Key paths shine in **generic code** that works on "some property, chosen later":

```swift
func sorted<T, V: Comparable>(_ items: [T], by keyPath: KeyPath<T, V>) -> [T] {
    items.sorted { $0[keyPath: keyPath] < $1[keyPath: keyPath] }
}

let people = [Person(name: "Ada", age: 30), Person(name: "Alan", age: 25)]
sorted(people, by: \.age)    // Alan first
sorted(people, by: \.name)   // Ada first
```

You already use key paths in SwiftUI: `ForEach(items, id: \.self)`, `List(users, id: \.email)`, and `@Environment(\.dismiss)`.

Key paths can go **deeper**, through several properties:

```swift
struct Address { var city: String }
struct Customer { var address: Address }

let cityPath = \Customer.address.city      // KeyPath<Customer, String>
```

---

## 11.2 Key Paths as Functions 🟢

Since Swift 5.2, a key path can be used **wherever a function** like `(Root) -> Value` is expected. The most common case is `map`:

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

`\.name` works exactly like `{ $0.name }`, just shorter. It works with any function-style parameter:

```swift
struct Todo { let title: String; let isDone: Bool }
let tasks = [Todo(title: "Code", isDone: true), Todo(title: "Test", isDone: false)]

let done = tasks.filter(\.isDone)              // a Bool key path works as a filter
let total = people.map(\.age).reduce(0, +)     // 55
let allAdults = people.allSatisfy { $0.age >= 18 }   // a closure is still needed for comparisons
```

A key path only reads **one property**. For any extra logic (comparisons, math), use a normal closure.

---

## 11.3 `@dynamicMemberLookup` 🔴

**`@dynamicMemberLookup`** lets a type support **dot syntax for properties that don't exist** at compile time. The compiler turns `instance.something` into a call to a special `subscript(dynamicMember:)` that you write. It's often used for wrappers around loosely-typed data, like JSON.

```swift
@dynamicMemberLookup
struct JSON {
    private var storage: [String: Any]

    subscript(dynamicMember member: String) -> Any? {
        storage[member]
    }
}

let json = JSON(storage: ["name": "Alex", "age": 28])
print(json.name as Any)   // Optional("Alex") — "name" was never declared as a real property
print(json.age as Any)    // Optional(28)
```

**The trade-off:** you lose compile-time safety. A **typo** like `json.nmae` compiles fine, and just returns `nil` at runtime.

There is a **type-safe** form too: take a **key path** instead of a string. Then only real properties are allowed. This is great for **wrapper types** that forward properties:

```swift
struct User {
    var name: String
    var email: String
}

@dynamicMemberLookup
struct Tracked<Value> {
    private(set) var value: Value
    private(set) var changeCount = 0

    subscript<T>(dynamicMember keyPath: WritableKeyPath<Value, T>) -> T {
        get { value[keyPath: keyPath] }
        set {
            value[keyPath: keyPath] = newValue
            changeCount += 1
        }
    }

    init(_ value: Value) { self.value = value }
}

var user = Tracked(User(name: "Alex", email: "a@x.com"))
user.name = "Sam"          // forwarded to User.name, and counted
print(user.changeCount)    // 1
// user.nmae = "x"         // ❌ compile error: no such property — still type-safe
```

SwiftUI's `Binding` uses this: `$user.name` works because `Binding` has key-path dynamic member lookup.

---

## 11.4 `@dynamicCallable` 🔴

**`@dynamicCallable`** lets you **call an instance like a function**: `instance(...)`. You implement a `dynamicallyCall` method. It's rare; it's mostly used for small DSLs (domain-specific languages) and bridges to scripting languages like Python.

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

There's also a version with **labeled** arguments:

```swift
@dynamicCallable
struct URLBuilder {
    let base: String

    func dynamicallyCall(withKeywordArguments args: KeyValuePairs<String, String>) -> String {
        let query = args.map { "\($0.key)=\($0.value)" }.joined(separator: "&")
        return "\(base)?\(query)"
    }
}

let search = URLBuilder(base: "https://example.com/search")
print(search(q: "swift", page: "2"))   // "https://example.com/search?q=swift&page=2"
```

In everyday app code, you'll rarely write this. It's worth **recognizing** if you meet it.

(If you just want a type to be "callable", a plain method named **`callAsFunction`** is simpler and type-safe:)

```swift
struct Greeter {
    func callAsFunction(_ name: String) -> String { "Hello, \(name)" }
}
let greet = Greeter()
greet("Ada")   // "Hello, Ada"
```

---

## 11.5 Operator Overloading and Custom Operators 🟡

You can **overload** existing operators for your own types (you saw `==` and `<` in section 7), and even create **new** operators:

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

Operators come in three positions:

| Keyword | Position | Example |
|---|---|---|
| `prefix` | Before the value | `-a`, `!flag` |
| `infix` | Between two values | `a + b` |
| `postfix` | After the value | `value!` |

Compound assignment like `+=` is a separate operator, with an `inout` left side:

```swift
extension Vector2D {
    static func += (lhs: inout Vector2D, rhs: Vector2D) {
        lhs = lhs + rhs
    }
}

var position = Vector2D(x: 0, y: 0)
position += Vector2D(x: 1, y: 1)
```

A **brand-new** operator must first be **declared** (`prefix`, `infix`, or `postfix`). Infix operators usually also get a **precedence group** (11.6):

```swift
infix operator **: MultiplicationPrecedence

func ** (base: Double, exponent: Double) -> Double {
    pow(base, exponent)
}

print(2.0 ** 10.0)   // 1024.0
```

**Use custom operators sparingly.** They help for math-like code where the symbol is well known. Strange symbols that only your team knows make code **harder** to read. A named method is often clearer.

---

## 11.6 Precedence Groups 🔴

A **precedence group** decides how a custom infix operator **combines** with others in one expression:

- **Precedence:** which operator **binds tighter**, like `*` before `+`.
- **Associativity:** how a **chain** of the same operator groups: from the left `(a ∘ b) ∘ c`, or from the right `a ∘ (b ∘ c)`.

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

Why it matters, with numbers:

```plaintext
2 ** 3 ** 2
  right-associative:  2 ** (3 ** 2) = 2 ** 9 = 512    ← math convention
  left-associative:   (2 ** 3) ** 2 = 8 ** 2 = 64     ← surprising
```

Get these right so your operator behaves the way readers **expect** from normal math.

The standard groups, from loosest to tightest (a few of them):

```plaintext
AssignmentPrecedence  (=, +=)
TernaryPrecedence     (? :)
LogicalDisjunction    (||)
LogicalConjunction    (&&)
ComparisonPrecedence  (==, <)
AdditionPrecedence    (+, -)
MultiplicationPrecedence (*, /)
```

---

## 11.7 Noncopyable Types with `~Copyable` 🔴

Normally, **every** Swift type can be copied: assigning a struct makes an independent copy (6.9). **`~Copyable`** (Swift 5.9) **removes** that ability. A noncopyable value can only be **moved**, never duplicated.

This fits **unique resources**: a file handle, a lock, a one-time token. Having **two copies** of those would be a bug.

```swift
struct UniqueToken: ~Copyable {
    let id: Int
}

func spend(_ token: consuming UniqueToken) {
    print("Spending token \(token.id)")
}

let token = UniqueToken(id: 1)
spend(token)
// spend(token)   // ❌ error: 'token' used after consume — it was moved, not copied
```

After the value is **moved** (here, into a `consuming` parameter), the original name **can't be used** anymore. The compiler checks this **at compile time**, at **zero runtime cost**. You can never use a resource after giving it away.

Noncopyable **structs** can even have a **`deinit`**, like classes. It runs when the value's single owner is done with it:

```swift
struct FileDescriptor: ~Copyable {
    let fd: Int32

    consuming func close() {
        print("closing \(fd)")
        discard self                 // we closed it ourselves: skip deinit
    }

    deinit {
        print("auto-closing \(fd)")  // runs if nobody called close()
    }
}

do {
    let file = FileDescriptor(fd: 3)
    // let copy = file   → moves `file` into `copy`; `file` is no longer usable
}   // prints "auto-closing 3"
```

This gives **automatic cleanup** without a class, and without the risk of two copies closing the same file twice.

---

## 11.8 Ownership: `consuming`, `borrowing`, `inout` 🔴

These three parameter modifiers say **how a function uses the argument's ownership**. They matter most for noncopyable types (11.7): without copying as a fallback, ownership must be **explicit**.

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

| Modifier | Access | After the call, the caller... |
|---|---|---|
| `borrowing` | Temporary, **read-only** | Still owns the value |
| `consuming` | Takes **full ownership** | Can't use the value anymore |
| `inout` | Temporary, **read and write** (5.5) | Owns it again, possibly changed |

Using them together:

```swift
var resource = Resource(name: "cache")
inspect(resource)      // borrowed: still usable
rename(&resource)      // changed in place: still usable
destroy(resource)      // moved: `resource` is gone now
// inspect(resource)   // ❌ error: 'resource' used after consume
```

For **normal, copyable types**, these modifiers are optional **performance hints**. For **noncopyable types**, they are **required and enforced**.

There's also a **`consume` operator** to end a value's life early, even for copyable types:

```swift
let bigArray = Array(repeating: 0, count: 1_000_000)
let moved = consume bigArray   // no copy; `bigArray` can't be used after this line
```

---

## 11.9 `~Escapable` and Lifetime Dependencies 🔴

**`~Escapable`** marks a type whose values are **tied to a limited lifetime**. They can't **escape** the scope where the data they point to is guaranteed to be valid. The idea is similar to Rust's borrowed references, but you'll meet it much less often in everyday Swift.

The main example is **`Span`** (section 15.3), a safe, **non-owning view** into existing memory. Since Swift 6.2, collections like `Array` have a `span` property (it may need a recent OS version):

```swift
let numbers = [10, 20, 30]
let view = numbers.span        // Span<Int>: a view into the array's memory, no copy
print(view[1])                 // 20
print(view.count)              // 3
```

`Span` is `~Escapable`. The compiler **won't let it outlive** the array it points to:

```swift
func makeView() -> Span<Int> {
    let local = [1, 2, 3]
    return local.span   // ❌ error: the span would outlive `local`
}
```

**Why it exists:** low-level code wants a **fast, lightweight view** into memory, like an `UnsafeBufferPointer`, but **without** the danger of using it after the memory is gone. `~Escapable` lets the compiler **prove** that at compile time.

| | `UnsafeBufferPointer` | `Span` |
|---|---|---|
| Speed | Fast | Fast |
| Bounds checked | ❌ No | ✅ Yes |
| Can outlive the memory | ⚠️ Yes (a bug) | ❌ No (compile error) |

Declaring **your own** `~Escapable` types needs lifetime annotations that are still evolving. For most developers, **using** `Span` is what matters.

---

## 11.10 Access Control Levels Including `package` 🟢

Swift's **access levels**, from most hidden to most open:

| Level | Visible in |
|---|---|
| `private` | The enclosing declaration (and its extensions in the same file) |
| `fileprivate` | The same source file |
| `internal` (default) | The same **module** |
| `package` (Swift 5.9) | Any module in the same **package** |
| `public` | Any module that imports it |
| `open` | Like `public`, **plus** subclassing and overriding from other modules |

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

Two useful details:

```swift
public struct Counter {
    public private(set) var value = 0       // anyone can READ it; only this type can WRITE it
    public init() { }
    public mutating func increment() { value += 1 }
}
```

```swift
public struct Point {
    public var x: Double
    public var y: Double
    // ⚠️ The memberwise init is internal, even for a public struct.
    // Other modules can't call Point(x:y:) unless you write a public init:
    public init(x: Double, y: Double) { self.x = x; self.y = y }
}
```

**What `package` solves:** before Swift 5.9, code shared between **your own modules** had to be `public`, which also exposed it to **everyone** who used your package. `package` lets your modules share details **with each other** only (see 48.6 for more).

**Rule:** start with the most hidden level that works. Make things more visible only when needed.

---

## 11.11 `@inlinable` and `@usableFromInline` 🔴

These attributes matter for **library authors**. Normally, a call into another module can't be **inlined** (the compiler can't copy the function's body into the caller), so there's a small cross-module call cost. **`@inlinable`** makes the function's **body** part of the module's public interface, so callers in other modules **can** inline it.

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

An inlinable body is compiled **into the caller**, so everything it touches must be visible there. **`@usableFromInline`** makes an `internal` member usable **from inlined code**, without making it fully `public`.

```plaintext
Without @usableFromInline on x and y:
  error: property 'x' is internal and cannot be referenced from an '@inlinable' function
```

**A warning:** an `@inlinable` body becomes **part of your public contract**. Apps compiled against version 1 keep **version 1's body** inlined in their binary, even after the library updates. So only inline small, stable code.

This is a **narrow, advanced** tool for performance-sensitive public frameworks. In normal app code, the compiler already optimizes across files in your module.

---

## 11.12 `@frozen` and Library Evolution 🔴

Some libraries are built with **library evolution** turned on, like Apple's system frameworks. In such a **resilient** library, a `public` struct or enum is treated as having an **unknown layout** from the outside. The author may **add stored properties or enum cases** in a later version without breaking apps that are already compiled.

That flexibility has a cost: code outside the library must reach the type's fields **indirectly**.

```swift
@frozen public struct Point {
    public var x: Double
    public var y: Double
}
```

**`@frozen`** is the author's **promise**: "this type's stored properties (in this exact order) will **never change**." Callers can then use the layout **directly**, which is faster. But the author can **never** add, remove, or reorder its stored properties again.

For **enums**, `@frozen` means "no new cases, ever". That's why you can `switch` over a frozen enum with no `default`, but for non-frozen system enums Swift asks for **`@unknown default`**:

```swift
switch UIDevice.current.userInterfaceIdiom {
case .phone: print("iPhone")
case .pad:   print("iPad")
@unknown default:
    print("A new kind of device")   // future OS versions may add cases
}
```

For **regular app code** (not a resilient library), `@frozen` has no effect. It matters mainly to **framework authors**, especially Apple.

---

## 11.13 ABI Stability vs Module Stability 🔴

**ABI stability** (ABI = Application Binary Interface): an app **compiled** against one version of a library keeps **working** with a **newer compiled version** of that library, **without recompiling**.

This is what lets Apple ship the **Swift runtime and standard library inside iOS** itself, instead of inside every app.

**Module stability**: a library's public interface (its **`.swiftinterface`** file) can be used by a **newer Swift compiler** than the one that built it. This is what lets you use a **binary framework** built with an older Xcode in a project built with a newer one.

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

| | ABI stability | Module stability |
|---|---|---|
| Question | Does my **compiled app** still run with a **newer library binary**? | Can a **newer compiler** use this **compiled framework**? |
| Enabled by | Library evolution / resilience | The `.swiftinterface` file |
| Example | Your app runs on next year's iOS | An XCFramework still works after you update Xcode |

If you **ship a binary framework** (for example, an XCFramework for other teams), turn on this build setting. It enables both:

```plaintext
BUILD_LIBRARY_FOR_DISTRIBUTION = YES
```

Like `@frozen` and `@inlinable`, this matters mostly to **framework and platform engineers**, not typical app developers.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Key paths | A reusable reference to a property; use with `instance[keyPath:]` |
| Key paths as functions | `\.name` works where `{ $0.name }` would |
| `@dynamicMemberLookup` | Dot syntax for unknown members; prefer the key-path (type-safe) form |
| `@dynamicCallable` | Call an instance like a function; rare; `callAsFunction` is simpler |
| Operator overloading | Define `+`, `-`, `+=` for your types; new operators sparingly |
| Precedence groups | Control binding strength and grouping of custom operators |
| `~Copyable` | Values that can be moved but never copied; can have `deinit` |
| `consuming`/`borrowing`/`inout` | Say how a function uses ownership; enforced for noncopyable types |
| `~Escapable` | Values that can't outlive their data, like `Span` |
| Access control + `package` | `private` → `open`; `package` shares between your own modules |
| `@inlinable`/`@usableFromInline` | Let other modules inline a library function's body |
| `@frozen` | A promise that a public type's layout or cases never change |
| ABI/module stability | Compiled apps and frameworks keep working across versions |
