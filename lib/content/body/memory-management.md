**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 10.1 What ARC Is and What It Counts 🟢

**ARC** (Automatic Reference Counting) manages the memory of **class instances** for you. It counts how many **strong references** point to each object. When the count reaches **zero**, the object is freed: its `deinit` runs (6.8) and its memory is reclaimed.

There are no manual `retain`/`release` calls, and no garbage collector that pauses your app to scan memory.

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

ARC counts **only class instances** (and closures, which are reference types too). Structs and enums are **values**: they have no shared identity, so there is nothing to count (6.9).

| | Counted by ARC? |
|---|---|
| Class instances | ✅ Yes |
| Closures | ✅ Yes |
| Actors | ✅ Yes (they are reference types) |
| Structs, enums, tuples | ❌ No (but a class **inside** a struct is counted) |

---

## 10.2 Strong References and Object Lifetime 🟢

By default, **every** reference to an object is **strong**: a variable, a property, an array element, a value captured by a closure. A strong reference **keeps the object alive**.

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

**The rule:** an object lives **exactly as long as at least one strong reference** to it exists, anywhere in the app. When the last one goes away, the object is freed **immediately** and **predictably**. (With a garbage collector, cleanup happens "some time later".)

```plaintext
car ──strong──► Car ──strong──► Engine

car = nil   →   Car has 0 refs → freed → its engine property goes away
                Engine now has 0 refs → freed
```

This predictability is why `deinit` is a reliable place for cleanup in Swift.

---

## 10.3 Retain Cycles Between Two Objects 🟢

A **retain cycle** happens when two (or more) objects hold **strong references to each other**. Their counts **never reach zero**. Even after all **outside** references are gone, they keep each other alive **forever**. This is a **memory leak**.

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

```plaintext
john   ──X                     (set to nil)
unit4A ──X                     (set to nil)

Person ──strong──► Apartment
   ▲                   │
   └──────strong───────┘       ← each has 1 reference left: the other one
```

Nothing crashes and nothing warns you. The memory is just **never freed**. In an app, a leaked view model can keep **network calls, timers, and images** alive too.

---

## 10.4 `weak` References 🟢

A **`weak`** reference **doesn't keep** its object alive. It doesn't add to the strong count.

Because the object can be freed at any time, a `weak` reference is **always optional**. When the object is freed, Swift sets the reference to **`nil` automatically**.

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

After John is freed, the apartment's `tenant` is `nil` automatically:

```swift
var anotherUnit: Apartment? = Apartment(unit: "5B")
var sam: Person? = Person(name: "Sam")
anotherUnit?.tenant = sam
sam = nil
print(anotherUnit?.tenant as Any)   // nil — the weak reference was cleared
```

A `weak` reference must be optional, because Swift may set it to `nil`:

```swift
weak var owner: Person      // ❌ error: 'weak' variable should have optional type 'Person?'
```

**When to use it:** when the relationship is **optional**, and the other object may **legitimately go away** first, like a tenant who moves out.

---

## 10.5 `unowned` References and When They Crash 🟡

**`unowned`** is like `weak`: it doesn't keep the object alive. But it is **not optional**. It **promises** that the object will **always exist** while this reference is used.

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

**The risk:** if you use an `unowned` reference **after** its object was freed, the app **crashes**. There is no `nil` safety net:

```swift
var card: CreditCard?
do {
    let temp = Customer(name: "Bob")
    card = CreditCard(number: "5678", customer: temp)
}   // temp is freed here, but the card still exists

print(card!.customer.name)   // 💥 crash: attempted to read an unowned reference but object was already deallocated
```

| | `weak` | `unowned` |
|---|---|---|
| Keeps the object alive | No | No |
| Type | Optional (`T?`) | Non-optional (`T`) |
| After the object is freed | Becomes `nil` | **Crash** if used |
| Use when | The other object **may** go away first | The other object **always** lives at least as long |

Use `unowned` **only** when the other object is **guaranteed** to live as long as (or longer than) this one. A credit card can't exist without its customer, so it's a fit there. When in doubt, use `weak`.

---

## 10.6 Retain Cycles in Closures 🟢

Closures capture objects **strongly** by default (5.12–5.13). So a class that **stores a closure** that **uses `self`** creates the same cycle as two objects pointing at each other:

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

```plaintext
ViewModel ──strong (onUpdate)──► closure
    ▲                               │
    └──────strong (captures self)───┘
```

This is **very common** in real apps: storing a callback or completion handler as a property is routine. That's exactly why `[weak self]` exists (10.7).

**Not every closure with `self` is a cycle.** A closure that is **not stored** by `self` (or by something `self` owns) is fine:

```swift
func load() {
    // Runs once and is then released; self isn't storing it. No cycle.
    DispatchQueue.main.async {
        self.data = "Loaded"
    }

    // Non-escaping closures (map, filter, forEach) can't cause cycles at all.
    let upper = ["a", "b"].map { _ in self.data.uppercased() }
}
```

A cycle needs a **loop of strong references**. Ask: "does `self` (directly or indirectly) **own** this closure?"

---

## 10.7 `[weak self]` vs `[unowned self]` 🟡

Both break a closure cycle by capturing `self` **without** a strong reference. They differ like `weak` and `unowned` properties do:

- **`[weak self]`**: `self` becomes **optional**. It may be `nil` when the closure runs.
- **`[unowned self]`**: promises `self` **still exists** when the closure runs, and **crashes** if not.

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

For one-line uses, optional chaining is shorter:

```swift
onUpdate = { [weak self] in
    self?.refresh()          // does nothing if self is gone
}
```

**Guidance:**

- **Default to `[weak self]`** for closures that might run **after** their owner is gone: network callbacks, timers, notification observers.
- Use `[unowned self]` **only** when you're certain the closure can never run after `self` is freed. The small convenience is rarely worth the crash risk.

```swift
// Typical: a timer owned by the view model
timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
    self?.tick()
}
```

---

## 10.8 Retain Cycles in Delegates 🟢

The **delegate pattern** (very common in UIKit, section 35) is a classic cycle risk. A parent **owns** a child strongly, and the child's `delegate` points **back** at the parent. If that back-reference is strong, you get the two-object cycle from 10.3.

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

```plaintext
ViewController ──strong──► Downloader
       ▲                        │
       └────────weak────────────┘    ← no cycle
```

Two rules go together:

1. The `delegate` property is **`weak`**.
2. The delegate protocol is limited to classes with **`: AnyObject`**. `weak` only works with reference types, so without it, `weak var delegate` doesn't compile:

```swift
protocol PlainDelegate { }
class Thing {
    weak var delegate: PlainDelegate?
    // ❌ error: 'weak' must not be applied to non-class-bound 'any PlainDelegate'
}
```

UIKit follows this everywhere: `tableView.delegate`, `scrollView.delegate`, and `textField.delegate` are all `weak`.

---

## 10.9 Retain Cycles with `Task` and Async Closures 🔴

A `Task { }` closure (Part 2) also captures **strongly** by default. Usually that's fine: the task finishes, and releases `self`. The problem is a task that is **stored** and **never finishes**, like a polling loop:

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

The task holds `self` strongly and **never ends**, so `DataLoader` **lives forever**, and keeps polling the network even after its screen is closed.

**The fix:** capture `self` weakly, and stop when it's gone or the task is cancelled:

```swift
task = Task { [weak self] in
    while !Task.isCancelled {
        guard let self else { return }      // the owner is gone: stop
        await self.poll()
        try? await Task.sleep(for: .seconds(5))
    }
}
```

And cancel the task when the owner goes away:

```swift
deinit {
    task?.cancel()
}
```

(While the loop body runs, `self` is held strongly for that pass. So the object is freed at the latest after the current sleep ends. That's fine for a polling loop.)

In SwiftUI, the **`.task { }` modifier** is often the simplest answer. SwiftUI **cancels it automatically** when the view disappears:

```swift
.task {
    while !Task.isCancelled {
        await viewModel.poll()
        try? await Task.sleep(for: .seconds(5))
    }
}
```

---

## 10.10 Verifying Deallocation with `deinit` Logging 🟢

Retain cycles fail **silently**: no crash, no warning, just memory that is never freed. A simple check during development: **print in `deinit`** (or set a breakpoint there), and confirm the object is freed when you expect.

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

**The test:** open the screen, then leave it. If you never see "ProfileViewModel deallocated", something still holds it: a closure without `[weak self]`, a strong delegate, or a stored `Task`.

You can turn this into a **unit test**, so leaks are caught automatically:

```swift
import Testing

@Test func viewModelIsReleased() {
    weak var weakViewModel: ProfileViewModel?
    do {
        let viewModel = ProfileViewModel()
        viewModel.setup()                 // the code that might create a cycle
        weakViewModel = viewModel
    }                                     // the last strong reference ends here
    #expect(weakViewModel == nil, "ProfileViewModel leaked")
}
```

Once you know **that** something leaks, Xcode's **Memory Graph Debugger** (section 68) shows **what** is holding it.

---

## 10.11 Copy-on-Write and `isKnownUniquelyReferenced` 🔴

`Array`, `Dictionary`, `Set`, and `String` use **copy-on-write (COW)**. Assigning one to another variable **doesn't copy** the storage right away. Both **share** the same buffer, until one of them is **changed**. Only then is a real copy made, just before the change:

```swift
var array1 = [1, 2, 3, 4, 5]
var array2 = array1   // no copy yet — both share the same underlying storage buffer

array2.append(6)      // NOW a real copy happens, right before this mutation
print(array1)          // [1, 2, 3, 4, 5] — unaffected
print(array2)          // [1, 2, 3, 4, 5, 6]
```

```plaintext
After  array2 = array1:    array1 ──┐
                                    ├──► [1, 2, 3, 4, 5]     (shared)
                           array2 ──┘

After  array2.append(6):   array1 ──► [1, 2, 3, 4, 5]
                           array2 ──► [1, 2, 3, 4, 5, 6]     (copied on first write)
```

That's how value types are **cheap to pass around** but still **fully independent**: the expensive copy happens only on the **first write** after sharing.

Your **own** structs don't get COW automatically for their class-based storage. You can build it with **`isKnownUniquelyReferenced`**, which checks whether a storage object has **exactly one owner**:

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

Without that check, two copies of `MyArray` would share one `Storage`, and appending to one would **change the other**: class reference behavior hiding inside a struct.

**Tip:** to keep COW cheap, avoid making extra copies of a big array right before you change it. For example, change it **in place** (`items[i].title = ...`) instead of copying an element out and back in a loop.

---

## 10.12 Stack vs Heap Allocation in Swift 🟡

As a **simple model**:

- **Value types** (structs, enums, tuples) usually live on the **stack**: very fast, freed automatically when the scope ends, and **no reference counting**.
- **Class instances** live on the **heap**: allocation is slower, ARC must count references, and every access goes **through a pointer**.

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

This is one **performance** reason Swift prefers `struct` by default (6.10).

**But it's a simplification.** A value can still end up using the heap:

```swift
struct Profile {
    var name: String          // String's characters may live in a heap buffer
    var tags: [String]        // the array's elements are in a heap buffer
    var avatar: UIImage?      // a class instance: heap + ARC
}
```

Copying this `Profile` does **ARC work** for `tags` and `avatar`. Also, values captured by an escaping closure, or stored in an `any` box (10.13), may move to the heap.

**In practice:** don't guess. If memory or speed matters, **measure** with Instruments (section 69).

---

## 10.13 Existential Boxing Cost 🔴

From 8.9: `any Protocol` (an **existential**) stores a value in a **runtime box**. The box has a small **inline buffer**, about **3 machine words** (24 bytes on 64-bit devices). A value **bigger** than that must be stored **on the heap**, with an extra allocation and an extra pointer hop. `some` and generic code don't need this.

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

```plaintext
BigShape: 5 × 8 bytes = 40 bytes  >  24-byte inline buffer  →  stored in a heap box
SmallShape: 2 × 8 bytes = 16 bytes ≤ 24-byte inline buffer  →  stored inline
```

Compare with a generic version: no box, no extra allocation:

```swift
func totalArea<S: Shape>(_ shapes: [S]) -> Double {      // or: [some Shape]
    shapes.reduce(0) { $0 + $1.area() }
}

totalArea([BigShape(a: 1, b: 2, c: 3, d: 4, e: 5)])
```

This is a concrete reason `some` and generics are usually **faster** than `any`, besides dynamic dispatch (8.9). It matters most in **hot loops** with many values. For normal app code, choose based on clarity first.

---

## 10.14 Autorelease Pools and When You Still Need Them 🔴

**Autorelease pools** come from Objective-C's memory model. Some Objective-C and Cocoa APIs return **"autoreleased"** objects: they're freed later, when the current pool is **drained** (usually at the end of the run loop iteration).

In a tight loop that creates many such objects, they **pile up** until the loop ends. **`autoreleasepool { }`** frees them **after each pass**:

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

A real case: processing many images from disk in one loop:

```swift
for url in imageURLs {
    autoreleasepool {
        guard let image = UIImage(contentsOfFile: url.path) else { return }
        let thumbnail = image.preparingThumbnail(of: CGSize(width: 200, height: 200))
        save(thumbnail)
    }   // temporary image memory is released here, every pass
}
```

Without the pool, memory can climb to hundreds of MB during the loop, and the app may be **terminated**.

In **pure Swift** code with Swift types, you **rarely** need this: ARC frees Swift objects right away. It matters mainly in **tight loops** using **Objective-C-based APIs** (UIKit, Foundation, Core Graphics).

---

## 10.15 The Law of Exclusivity 🔴

Swift enforces **exclusive access** to memory: two accesses to the **same variable** may **not overlap** if at least one of them **changes** it. Swift checks this mostly **at compile time**, and sometimes **at runtime**.

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

The fix: use the value the closure receives, instead of reading the variable again:

```swift
modify(&counter) { input in input + 1 }   // ✅ counter == 2
```

Passing the **same variable** to two `inout` parameters is also an overlap. For a local variable, the compiler catches it:

```swift
func swapValues(_ a: inout Int, _ b: inout Int) {
    let temp = a; a = b; b = temp
}

var x = 5
swapValues(&x, &x)   // ❌ error: overlapping accesses to 'x', but modification requires exclusive access
```

When the compiler **can't see** the overlap (class properties, globals, escaping closures), Swift checks **at runtime** and **crashes**:

```swift
final class Settings { var step = 1 }

func demo() {
    let settings = Settings()

    func increment(_ number: inout Int) {
        number += settings.step     // reads settings.step...
    }

    increment(&settings.step)       // ...while settings.step is being modified
    // 💥 runtime crash: Simultaneous accesses to 0x..., but modification requires exclusive access
}
```

**Why this rule exists:** the optimizer may assume that two mutable accesses **never point to the same memory**. Breaking that (even if it "seems to work") could give **wrong results** after optimization. So Swift **rejects** these cases, or crashes, instead of silently computing garbage.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| ARC | Counts strong references to objects; frees them at zero, right away |
| Strong references | The default; keeps the object alive |
| Retain cycles | Objects that hold each other strongly leak, silently |
| `weak` | Doesn't keep alive; optional; becomes `nil` when the object is freed |
| `unowned` | Doesn't keep alive; non-optional; crashes if used after the object is freed |
| Closure retain cycles | A stored closure that captures `self` strongly is a cycle |
| `[weak self]` vs `[unowned self]` | `weak` by default; `unowned` only with a guaranteed lifetime |
| Delegate retain cycles | `weak var delegate`, with an `AnyObject` protocol |
| `Task` retain cycles | Stored, endless tasks leak; use `[weak self]` and cancel |
| `deinit` logging | Print in `deinit`, or test with a `weak` reference, to catch leaks |
| Copy-on-write | Shared storage until the first write; build your own with `isKnownUniquelyReferenced` |
| Stack vs heap | Values are usually cheap; classes need the heap and ARC; measure to be sure |
| Existential boxing | `any` may heap-allocate values bigger than ~3 words |
| Autorelease pools | Free Objective-C temporaries in tight loops |
| Law of Exclusivity | No overlapping access when one of them writes |
