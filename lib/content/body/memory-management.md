## 10.1 What ARC Is and What It Counts

ARC (Automatic Reference Counting) manages the memory of **class instances** automatically by tracking how many *strong references* point to each one. When that count reaches zero, the instance is deallocated (`deinit` runs, recall 6.8) and its memory is reclaimed — no manual `retain`/`release` calls, and no garbage collector pausing your app to scan memory.

```swift
class Person {
    let name: String
    init(name: String) {
        self.name = name
        print("\(name) is being initialized")
    }
    deinit {
        print("\(name) is being deallocated")
    }
}

var person1: Person? = Person(name: "Alice")   // reference count: 1
var person2 = person1                          // reference count: 2 (same instance)
person1 = nil                                    // reference count: 1
person2 = nil                                    // reference count: 0 -> deinit runs
// Alice is being initialized
// Alice is being deallocated
```

Crucially, ARC only counts references to **class instances** — structs, enums, and other value types aren't reference-counted at all, since they don't have shared identity to track (recall 6.9).

---

## 10.2 Strong References and Object Lifetime

By default, every reference to a class instance — a variable, a property, a captured value in a closure — is a **strong** reference, meaning it keeps that instance alive as long as the reference itself exists.

```swift
class Engine {
    init() { print("Engine created") }
    deinit { print("Engine destroyed") }
}

class Car {
    var engine: Engine?
}

var car: Car? = Car()
car?.engine = Engine()   // Car strongly holds its Engine
car = nil                 // Car is deallocated, which drops its strong reference to Engine too
// Engine created
// Engine destroyed
```

An object stays alive exactly as long as at least one strong reference to it exists, anywhere in the program. Once the last strong reference disappears, deallocation happens immediately and deterministically (unlike a garbage-collected language, where cleanup timing is less predictable).

---

## 10.3 Retain Cycles Between Two Objects

A **retain cycle** happens when two (or more) objects hold strong references to each other, so neither's reference count ever reaches zero — even after every *external* reference to both is gone, they keep each other alive forever, leaking memory.

```swift
class Person {
    let name: String
    var apartment: Apartment?
    init(name: String) { self.name = name }
    deinit { print("\(name) is being deallocated") }
}

class Apartment {
    let unit: String
    var tenant: Person?
    init(unit: String) { self.unit = unit }
    deinit { print("Apartment \(unit) is being deallocated") }
}

var john: Person? = Person(name: "John")
var unit4A: Apartment? = Apartment(unit: "4A")

john?.apartment = unit4A
unit4A?.tenant = john   // now John and the apartment strongly reference each other

john = nil
unit4A = nil
// Neither deinit ever prints! Both objects leak, kept alive by each other's strong reference.
```

Even though the local variables `john` and `unit4A` are set to `nil`, the two objects still hold strong references to *each other*, so their reference counts never drop to zero — a classic, easy-to-miss memory leak.

---

## 10.4 `weak` References

A `weak` reference doesn't keep its target alive — it doesn't count toward the strong reference count at all. Because the referenced object could be deallocated at any time (via its other strong references), a `weak` reference must always be an **optional**, and Swift automatically sets it to `nil` the instant its target is deallocated.

```swift
class Person {
    let name: String
    var apartment: Apartment?
    init(name: String) { self.name = name }
    deinit { print("\(name) is being deallocated") }
}

class Apartment {
    let unit: String
    weak var tenant: Person?   // weak breaks the cycle
    init(unit: String) { self.unit = unit }
    deinit { print("Apartment \(unit) is being deallocated") }
}

var john: Person? = Person(name: "John")
var unit4A: Apartment? = Apartment(unit: "4A")

john?.apartment = unit4A
unit4A?.tenant = john

john = nil        // Person's only remaining strong ref is gone -> deinit runs immediately
// "John is being deallocated"

unit4A = nil       // Apartment's only remaining strong ref is gone -> deinit runs
// "Apartment 4A is being deallocated"
```

`weak` is the right choice whenever the relationship is genuinely optional and the referenced object might legitimately be deallocated while the reference still exists — like a `tenant` who could move out.

---

## 10.5 `unowned` References and When They Crash

`unowned` is like `weak` — it doesn't keep its target alive and doesn't count toward the strong reference count — but it's declared as **non-optional**, asserting that the reference will *always* have a valid value for as long as the `unowned` reference itself is used.

```swift
class CreditCard {
    let number: String
    unowned let customer: Customer   // a card always belongs to exactly one customer
    init(number: String, customer: Customer) {
        self.number = number
        self.customer = customer
    }
}

class Customer {
    let name: String
    var card: CreditCard?
    init(name: String) { self.name = name }
}

var customer: Customer? = Customer(name: "Alice")
customer?.card = CreditCard(number: "1234", customer: customer!)

customer = nil   // both Customer and CreditCard deallocate cleanly together
```

The risk: if you access an `unowned` reference *after* its target has already been deallocated, the app crashes immediately with a memory access violation — there's no `nil`-check safety net like `weak` provides. Only use `unowned` when the referenced object is guaranteed to outlive (or have an identical lifetime to) the reference holding it — as with a `CreditCard` that logically cannot exist without its `customer`.

---

## 10.6 Retain Cycles in Closures

Closures capture reference types **strongly** by default (recall 5.12–5.13) — which means a class that stores a closure as a property, where that closure itself captures `self`, creates the exact same retain-cycle problem as two objects referencing each other directly.

```swift
class ViewModel {
    var onUpdate: (() -> Void)?
    var data = "Initial"

    func setup() {
        onUpdate = {
            print("Data changed to: \(self.data)")   // strongly captures self!
        }
    }

    deinit {
        print("ViewModel deallocated")
    }
}

var viewModel: ViewModel? = ViewModel()
viewModel?.setup()
viewModel = nil
// deinit never runs — viewModel's onUpdate closure keeps it alive,
// and viewModel keeps the closure alive via onUpdate, forming a cycle
```

This pattern is extremely common in real apps, since storing a completion handler or callback closure as a property is routine — and it's exactly why `[weak self]` (recall 5.13, and see 10.7 next) exists.

---

## 10.7 `[weak self]` vs `[unowned self]`

Both break closure retain cycles by capturing `self` without a strong reference, but they differ exactly like `weak` vs `unowned` do for object properties: `[weak self]` produces an optional `self` that must be unwrapped (and might legitimately be `nil` by the time the closure runs), while `[unowned self]` asserts `self` will always still exist when the closure runs — crashing if that assumption is wrong.

```swift
class ViewModel {
    var onUpdate: (() -> Void)?
    var data = "Initial"

    func setup() {
        onUpdate = { [weak self] in
            guard let self else { return }   // safely handle the case where self is already gone
            print("Data changed to: \(self.data)")
        }
    }

    deinit {
        print("ViewModel deallocated")
    }
}

var viewModel: ViewModel? = ViewModel()
viewModel?.setup()
viewModel = nil
// "ViewModel deallocated" now prints correctly — the cycle is broken
```

**Guidance:** default to `[weak self]` for closures that might genuinely outlive their owner (network callbacks, timers, notification handlers) — it's the safer choice. Reach for `[unowned self]` only when you can guarantee the closure will never be called after `self` is deallocated (e.g. a closure that's guaranteed to run synchronously, or is torn down alongside `self` in lockstep).

---

## 10.8 Retain Cycles in Delegates

The classic delegate pattern (heavily used in UIKit, and still relevant when interoperating with it — see section 35) is a textbook retain-cycle risk: if a parent object strongly holds a child, and the child's `delegate` property strongly points back at the parent, you get the same two-object cycle as 10.3.

```swift
protocol DownloadDelegate: AnyObject {
    func downloadDidFinish()
}

class Downloader {
    weak var delegate: DownloadDelegate?   // weak breaks the potential cycle

    func startDownload() {
        // ... after finishing:
        delegate?.downloadDidFinish()
    }
}

class ViewController: DownloadDelegate {
    let downloader = Downloader()

    func setup() {
        downloader.delegate = self   // ViewController strongly owns downloader;
                                       // downloader only weakly references ViewController back
    }

    func downloadDidFinish() {
        print("Download complete!")
    }
}
```

This is why delegate protocols are conventionally constrained to `AnyObject` (class-only) — it's what makes `weak var delegate` legal at all, since `weak` only applies to reference types. Making `delegate` `weak` is the standard, expected convention for this pattern precisely to avoid the parent/child retain cycle.

---

## 10.9 Retain Cycles with `Task` and Async Closures

Swift Concurrency's `Task { }` closures (fully covered in Part 2) capture their surrounding context strongly by default too, exactly like ordinary closures — a class storing a `Task` that captures `self`, especially one performing long-running or repeating work, is a modern variant of the same retain-cycle problem.

```swift
class DataLoader {
    var task: Task<Void, Never>?

    func startPolling() {
        task = Task {
            while true {
                // strongly captures self implicitly, and this Task never finishes on its own
                await self.poll()
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }

    func poll() async {
        print("Polling...")
    }

    deinit {
        print("DataLoader deallocated")
    }
}
```

Without `[weak self]`, a never-ending `Task` like this keeps `DataLoader` alive forever, since the task's closure holds a strong reference to `self` and the task itself never completes. The fix mirrors ordinary closures — capture weakly and check cancellation:

```swift
task = Task { [weak self] in
    while let self, !Task.isCancelled {
        await self.poll()
        try? await Task.sleep(for: .seconds(5))
    }
}
```

---

## 10.10 Verifying Deallocation with `deinit` Logging

Since retain cycles fail silently (no crash, no warning — just a quiet memory leak), a simple but effective debugging technique is adding a `print` statement (or a breakpoint) inside `deinit` during development, to confirm an object is actually being deallocated when you expect it to be.

```swift
class ProfileViewModel {
    init() {
        print("ProfileViewModel created")
    }
    deinit {
        print("ProfileViewModel deallocated")
    }
}
```

If you navigate away from a screen backed by `ProfileViewModel` and never see "ProfileViewModel deallocated" printed, that's a strong signal something — an unbroken closure capture, a delegate that should be `weak`, a retained `Task` — is holding onto it longer than intended. Xcode's Memory Graph Debugger (covered in section 68) is the more thorough tool for tracking down exactly *what* is holding the unwanted reference once you've confirmed a leak this way.

---

## 10.11 Copy-on-Write and `isKnownUniquelyReferenced`

Swift's value types (`Array`, `Dictionary`, `Set`, and your own structs containing them) achieve efficient copy semantics through **copy-on-write (COW)**: assigning or passing a value type doesn't actually duplicate its underlying storage immediately — it shares the same storage buffer until one of the copies is actually *mutated*, at which point a real copy is made just before that mutation.

```swift
var array1 = [1, 2, 3, 4, 5]
var array2 = array1   // no copy yet — both share the same underlying storage buffer

array2.append(6)      // NOW a real copy happens, right before this mutation
print(array1)          // [1, 2, 3, 4, 5] — unaffected
print(array2)          // [1, 2, 3, 4, 5, 6]
```

This is why value types can be "cheap to copy" despite conceptually being fully independent — the actual expensive copy only happens on the *first write* after a share, not on every assignment. You can build this behavior into your own types using `isKnownUniquelyReferenced`, which checks whether a reference-counted storage object currently has exactly one owner:

```swift
final class Storage {
    var values: [Int]
    init(values: [Int]) { self.values = values }
}

struct MyArray {
    private var storage: Storage

    init(_ values: [Int]) {
        storage = Storage(values: values)
    }

    mutating func append(_ value: Int) {
        if !isKnownUniquelyReferenced(&storage) {
            storage = Storage(values: storage.values)   // make a real copy — someone else shares this storage
        }
        storage.values.append(value)
    }
}
```

---

## 10.12 Stack vs Heap Allocation in Swift

Value types (structs, enums, tuples) are generally allocated on the **stack** — fast, automatically reclaimed when a scope exits, with no reference counting overhead — while class instances are allocated on the **heap**, managed by ARC, and require pointer indirection to access.

```swift
struct Point {   // typically stack-allocated: fast, no ARC overhead
    var x: Double
    var y: Double
}

class PointBox {   // heap-allocated: requires ARC, pointer indirection
    var x: Double
    var y: Double
    init(x: Double, y: Double) { self.x = x; self.y = y }
}
```

This is one of the practical performance reasons Swift favors `struct` by default (recall 6.10): stack allocation avoids heap allocation overhead and ARC's retain/release traffic entirely for simple, self-contained data. Note this is a simplification — a struct *containing* a class property, or one captured by an escaping closure, may still end up requiring heap allocation indirectly, since the compiler's actual allocation strategy involves more nuance than a strict stack/heap split by type kind alone.

---

## 10.13 Existential Boxing Cost

Recall from section 8.9 that `any Protocol` (an existential type) erases a value's concrete type into a runtime container. For value types larger than a small fixed buffer (typically 3 machine words), this existential container must allocate additional storage on the **heap** to hold the value — an extra allocation and indirection cost that `some`/generic code avoids entirely.

```swift
protocol Shape {
    func area() -> Double
}

struct BigShape: Shape {   // larger than the existential's inline buffer
    var a, b, c, d, e: Double
    func area() -> Double { a + b + c + d + e }
}

let shapes: [any Shape] = [BigShape(a: 1, b: 2, c: 3, d: 4, e: 5)]
// storing BigShape inside "any Shape" here requires a heap allocation for the existential box,
// on top of whatever allocation BigShape itself would otherwise need
```

This is a concrete, measurable reason `some`/generics generally outperform `any` (beyond the dynamic dispatch difference discussed in 8.9) — the existential's boxing behavior can introduce heap traffic that a statically-typed generic parameter never incurs, especially for larger value types.

---

## 10.14 Autorelease Pools and When You Still Need Them

Autorelease pools are a holdover mechanism from Objective-C's memory model, still occasionally relevant in Swift when interoperating with Objective-C/Cocoa APIs (or writing tight loops that create many temporary Objective-C objects) — `autoreleasepool { }` forces temporary objects to be released promptly rather than accumulating until the end of the current run loop iteration.

```swift
for i in 0..<100_000 {
    autoreleasepool {
        // if this loop body creates temporary Objective-C-bridged objects
        // (e.g. via certain Foundation/UIKit APIs), wrapping it in autoreleasepool
        // prevents them all from accumulating in memory until the loop fully finishes
        let data = "\(i)".data(using: .utf8)
    }
}
```

In pure Swift code using only native Swift types, you'll rarely need this explicitly — ARC handles Swift object lifetimes deterministically without needing a pool. It remains relevant mainly in tight loops that heavily exercise Objective-C-bridged APIs, where without it, memory usage can spike noticeably during the loop before being reclaimed.

---

## 10.15 The Law of Exclusivity

Swift enforces **exclusive access** to memory: you cannot have two overlapping accesses to the same variable where at least one of them is a mutation — this rule is checked (mostly at compile time, sometimes at runtime) to prevent subtle bugs and to enable certain compiler optimizations that assume no aliasing.

```swift
func modify(_ value: inout Int, using closure: (Int) -> Int) {
    value = closure(value)
}

var counter = 1
modify(&counter) { input in
    // ❌ error: overlapping access to 'counter' -- accessing counter again here,
    // while it's already being mutated via the inout parameter, violates exclusivity
    counter + 1
}
```

A more classic runtime example: passing the same variable as two different `inout` arguments to one function call is flagged as an exclusivity violation, since the function body might read/write both "at once":

```swift
func swapValues(_ a: inout Int, _ b: inout Int) {
    let temp = a; a = b; b = temp
}

var x = 5
swapValues(&x, &x)   // 💥 runtime crash: simultaneous accesses to the same variable
```

This rule exists because Swift's optimizer is allowed to assume no two mutable references alias the same memory unless explicitly proven otherwise — violating exclusivity (even if it "seems to work") can lead to undefined, unpredictable behavior once optimizations are applied, which is why Swift actively detects and rejects (or crashes on) these violations rather than allowing silently incorrect results.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| ARC | Automatically tracks strong references to class instances; deallocates at zero, deterministically |
| Strong references | Default reference kind; keeps the referenced instance alive |
| Retain cycles | Two objects strongly referencing each other keep both alive forever, silently leaking |
| `weak` | Doesn't keep the target alive; must be optional; auto-`nil`s when the target deallocates |
| `unowned` | Like `weak` but non-optional; crashes if accessed after its target is deallocated |
| Closure retain cycles | A stored closure strongly capturing `self` creates the same cycle as two objects |
| `[weak self]` vs `[unowned self]` | Default to `weak` for safety; `unowned` only with a guaranteed matching lifetime |
| Delegate retain cycles | `weak var delegate` is the standard convention, requiring `AnyObject`-constrained protocols |
| `Task` retain cycles | Async closures capture strongly too; `[weak self]` + cancellation checks prevent leaks |
| `deinit` logging | A simple, practical way to confirm expected deallocation during development |
| Copy-on-write | Value types share storage until first mutation, then copy — cheap assignment, safe mutation |
| Stack vs heap | Value types typically stack-allocate (fast, no ARC); classes heap-allocate (ARC-managed) |
| Existential boxing | `any` can require extra heap allocation for values larger than its inline buffer |
| Autorelease pools | A rarely-needed Objective-C interop tool for releasing temporary objects promptly in tight loops |
| Law of Exclusivity | Overlapping mutable access to the same memory is forbidden, enabling safe compiler optimizations |

**Next up:** [Section 11 — Advanced Type System](/articles/advanced-type-system).
