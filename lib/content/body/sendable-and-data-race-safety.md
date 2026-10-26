**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 20.1 What `Sendable` Means 🟢

**`Sendable`** is a **marker protocol** (like `Error`, 9.1). It means: "values of this type are **safe to share across isolation boundaries**". That includes passing them into a `Task`, sending them to an actor, or capturing them in a `@Sendable` closure, **without** risking a data race.

It's how the compiler answers: "**Is it safe to hand this value to another isolation domain?**"

```swift
struct Point: Sendable {
    var x: Double
    var y: Double
}

actor Store {
    func save(_ point: Point) {
        // safe — Point is Sendable, so passing it into this actor's isolation is provably fine
    }
}
```

**Value types** (structs, enums) whose properties are all `Sendable` are naturally safe: each copy is **independent** (6.9), so two domains never share the same storage.

A **class** is the tricky case: two domains could hold the **same object** and change it at once (20.2).

What's already `Sendable`:

| Sendable | Not Sendable (by default) |
|---|---|
| `Int`, `String`, `Bool`, `Double`, `Date`, `URL`, `UUID`, `Data` | Most classes |
| Arrays, dictionaries, optionals **of** Sendable types | Closures that capture mutable state |
| Actors | `NSMutableArray`, `NSAttributedString`, many Objective-C types |
| `@MainActor` classes | |

---

## 20.2 Automatic `Sendable` Conformance Rules 🟡

For **structs and enums** whose stored properties (or associated values) are **all `Sendable`**, Swift handles `Sendable` for you. That works like `Equatable`/`Hashable` synthesis (7.7–7.8):

```swift
struct User: Sendable {   // synthesized automatically, since String and Int are both Sendable
    var name: String
    var age: Int
}

struct Container {
    var items: [User]   // Array<User> is Sendable, since User is Sendable and Array conditionally conforms
}
```

For **non-public** structs and enums, Swift even **infers** `Sendable` without you writing it (like `Container` above). For **public** types, write `: Sendable` explicitly, because it becomes part of your public API.

**Classes are not automatically `Sendable`.** A class instance is a **shared reference**. Even if each property is a `Sendable` type, two domains could hold the same object and change its `var`s at the same time.

A class **can** declare `Sendable` itself, and the compiler **checks** it, if:

- it's **`final`** (no subclass could add mutable state), and
- all stored properties are **`let`** and **`Sendable`**.

```swift
final class ImmutablePoint: Sendable {   // allowed and checked: final, only immutable Sendable properties
    let x: Double
    let y: Double
    init(x: Double, y: Double) { self.x = x; self.y = y }
}

final class MutablePoint: Sendable {
    var x = 0.0      // ❌ error: stored property 'x' of 'Sendable'-conforming class 'MutablePoint' is mutable
}
```

Two kinds of classes **are** safe to share automatically:

```swift
actor Cache { }                 // actors are always Sendable

@MainActor
final class ViewModel { }       // global-actor-isolated classes are Sendable:
                                // all access goes through the main actor
```

---

## 20.3 `@Sendable` Closures 🟡

A **`@Sendable` closure** is safe to pass across isolation boundaries. It may only capture **`Sendable`** values, and it **can't change** a captured `var`, because two domains could then change the same variable at once.

```swift
func runConcurrently(_ work: @Sendable @escaping () -> Void) {
    Task {
        work()
    }
}

var counter = 0
runConcurrently {
    // ❌ error: mutation of captured var 'counter' in concurrently-executing code
    counter += 1
}

let readOnlyValue = 42
runConcurrently {
    print(readOnlyValue)   // ✅ fine — capturing an immutable Sendable value is safe
}
```

Most closures you pass to concurrency APIs **must** be `@Sendable` (or `sending`): `Task { }`, task group `addTask`, `Task.detached`. That's exactly what catches, **at compile time**, the shared-mutable-capture bugs that used to show up only as random runtime crashes.

How to fix the `counter` case, depending on what you need:

```swift
// 1. You only need the value: capture a copy
let snapshot = counter
runConcurrently { print(snapshot) }

// 2. You really need shared mutable state: use an actor
actor Tally { var value = 0; func increment() { value += 1 } }
let tally = Tally()
runConcurrently { Task { await tally.increment() } }

// 3. Or a Sendable class that protects its state with a Mutex (14.21, see SafeCounter in 20.4)
let safeCounter = SafeCounter()
runConcurrently { safeCounter.increment() }
```

Function **types** can be marked too, when you store them:

```swift
struct Job: Sendable {
    let run: @Sendable () async -> Void    // a Sendable struct needs Sendable stored closures
}
```

---

## 20.4 `@unchecked Sendable` and Your Obligations 🔴

**`@unchecked Sendable`** is an **escape hatch**. It tells the compiler: "**trust me**, this type is safe to share, even though you can't check it." It's meant for types that protect their state **themselves**, with a lock or similar tool the compiler can't reason about:

```swift
final class ThreadSafeCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var _value = 0

    var value: Int {
        lock.lock()
        defer { lock.unlock() }
        return _value
    }

    func increment() {
        lock.lock()
        defer { lock.unlock() }
        _value += 1
    }
}
```

**It's a real promise, not a way to silence errors.** **Every** access to the mutable state must go through the lock. Miss **one** path, and you've brought back exactly the data race `Sendable` is supposed to prevent, but now the compiler **can't** warn you.

A common mistake:

```swift
final class Settings: @unchecked Sendable {
    var theme = "light"          // ⚠️ no lock at all — @unchecked just hides the race
}
```

**Prefer checked alternatives** when you can. A `Mutex` (14.21) gives the same result, **checked** by the compiler, with no `@unchecked`:

```swift
import Synchronization

final class SafeCounter: Sendable {
    private let state = Mutex(0)

    var value: Int { state.withLock { $0 } }
    func increment() { state.withLock { $0 += 1 } }
}
```

| Option | Checked by the compiler? |
|---|---|
| Struct of Sendable values | ✅ |
| `final class` with only `let` | ✅ |
| Actor / `@MainActor` class | ✅ |
| Class with a `Mutex` | ✅ |
| `@unchecked Sendable` | ❌ Your promise only |

---

## 20.5 `sending` Parameters and Results 🔴

**`sending`** marks a parameter (or result) whose value is **handed over completely** to the receiver. After passing it, the **caller can't use it anymore**. Because nobody else can still touch it, the compiler allows passing even a **non-`Sendable`** value safely.

```swift
class NonSendableBox {
    var value = 0
}

func takeOwnership(_ box: sending NonSendableBox) {
    // safe to use box freely here — the compiler guarantees no other
    // code retains simultaneous access to it after the transfer
}

func useBox() {
    let box = NonSendableBox()
    takeOwnership(box)
    // box.value = 5   // ❌ error: sending 'box' risks causing data races (it's used after being sent)
}
```

`Task { }` uses this. Its closure is a `sending` parameter, so a fresh non-`Sendable` value can move into a task, as long as you don't use it afterwards:

```swift
func startWork() {
    let box = NonSendableBox()          // created here, used nowhere else
    Task {
        box.value += 1                  // ✅ fine: `box` was sent into the task
    }
}
```

A `sending` **result** promises the caller gets a value **nobody else** holds:

```swift
func makeBox() -> sending NonSendableBox {
    NonSendableBox()                    // a fresh object: safe to hand to any isolation domain
}
```

`sending` is related to the `consuming` ownership modifier (11.8) and to region-based isolation (20.6). It proves **one specific handoff** is safe, which is more precise than requiring the whole type to be `Sendable`, when you only ever "hand it off and never touch it again".

---

## 20.6 Region-Based Isolation: How the Compiler Proves Safety 🔴

**Region-based isolation** (from Swift 6.0, improved since; see 16.6) is the analysis behind `sending`. The compiler groups values into **regions**: values that may refer to each other. If it can prove a region has **no other live references**, it allows moving that region to another isolation domain, even if the types aren't `Sendable`.

```swift
func processData() async {
    let data = NonSendableBox()   // not Sendable
    await Task {
        // region-based isolation can prove this specific transfer is safe here,
        // since "data" isn't used anywhere else in processData() after this point —
        // no other code could possibly race against this task's use of it
        print(data.value)
    }.value
}
```

What makes values join a region:

```swift
func example() async {
    let a = NonSendableBox()
    let b = NonSendableBox()
    let list = [a]              // `list` and `a` are now in the same region (list refers to a)

    Task { print(list.count) }  // sends the region {list, a}
    // a.value = 1              // ❌ error: `a` was sent along with `list`
    b.value = 1                 // ✅ fine: `b` is in a different region
}
```

**The practical benefit:** not every safe handoff needs a `Sendable` type. If the compiler can prove there's no shared reference **at that point in the code**, it allows it. That removed many confusing Swift 6 errors for code that was actually safe.

---

## 20.7 Reading and Fixing Common Swift 6 Concurrency Errors 🟡

A few error patterns cause most Swift 6 migration pain. Learn to recognize them, and they stop feeling like puzzles:

```swift
// Error: "Non-sendable type 'X' passed across actor boundary"
// Typical fix: make X conform to Sendable (if it's genuinely safe to share),
// or use `sending` if it's only ever transferred once and never touched again.

// Error: "Call to main actor-isolated instance method in a synchronous nonisolated context"
// Typical fix: mark the calling function `async` and add `await` at the call site,
// or mark the calling context @MainActor if it should always run there.

// Error: "Capture of 'var' with non-sendable type in a `@Sendable` closure"
// Typical fix: change the captured var to a `let`, restructure to avoid needing
// mutable shared state, or protect it with an actor/Mutex if mutation is genuinely required.
```

Worked example for the **second** error, which is very common in UIKit code:

```swift
class ImageLoader {                     // not on the main actor
    func didFinish(_ image: UIImage, imageView: UIImageView) {
        imageView.image = image
        // ❌ error: main actor-isolated property 'image' can not be mutated
        //    from a nonisolated context
    }
}

// Fix A: this code is UI code → put it on the main actor
@MainActor
class ImageLoader2 {
    func didFinish(_ image: UIImage, imageView: UIImageView) {
        imageView.image = image         // ✅
    }
}

// Fix B: the class must stay off main → hop over for the UI part
class ImageLoader3 {
    func didFinish(_ image: UIImage, imageView: UIImageView) async {
        await MainActor.run { imageView.image = image }   // ✅
    }
}
```

And one for **global variables**:

```swift
var cache: [String: Data] = [:]
// ❌ error: var 'cache' is not concurrency-safe because it is nonisolated global shared mutable state

// Fixes: make it a `let`, isolate it to an actor, or put it on @MainActor
@MainActor var cache2: [String: Data] = [:]
```

**The common thread:** each error points to a **real possible data race** that Swift 5 allowed silently. The fix is almost never to hide the error, but to **change the code**: an actor, a `Sendable` type, `sending`, or `async`/`await`.

---

## 20.8 Migrating a Module to Swift 6 Language Mode 🟡

Migrate **step by step, one module at a time** (Swift 6 mode is chosen **per module**, 16.3), not the whole project at once:

```swift
// A practical migration sequence:
// 1. Enable Swift 6 mode's individual upcoming feature flags one at a time (recall 16.2),
//    fixing the resulting warnings/errors in isolation before enabling the next flag.
// 2. Start with your "leaf" modules (ones with the fewest internal dependencies)
//    and work inward toward modules with more dependents, so each migrated module's
//    newly-enforced Sendable boundaries are already settled before its dependents migrate.
// 3. Use `@preconcurrency import` on dependencies that haven't migrated yet, to
//    suppress concurrency-checking noise specifically from those still-Swift-5-mode imports.
```

```plaintext
Migration order (leaf modules first):

   Models  →  Networking  →  Persistence  →  Features  →  App
   (no deps)                                              (depends on everything)
```

For dependencies that **haven't migrated yet**:

```swift
@preconcurrency import SomeLegacyFramework
```

**`@preconcurrency import`** tells the compiler: "treat this module's types as **older than** strict concurrency checking." It hides errors that come **only** from that dependency not being updated yet. Your **own** code is still checked fully.

You can also mark your **own** older protocol this way, so conformers don't break:

```swift
@preconcurrency
protocol LegacyDelegate: AnyObject {
    func didUpdate()
}
```

Remove `@preconcurrency` once the dependency is updated. Otherwise it may hide real problems later.

---

## 20.9 Strict Concurrency Settings Per Target 🟡

Before switching to Swift 6 mode, a target can turn on **strict concurrency checking** while still in **Swift 5 mode**. There are three levels:

| Level | Checks |
|---|---|
| `minimal` | Only code that already uses concurrency features (the old default) |
| `targeted` | Also code that adopted `Sendable` or actors |
| `complete` | **Everything**, exactly like Swift 6 mode, but as **warnings** |

```swift
// In Package.swift:
.target(
    name: "MyTarget",
    swiftSettings: [
        .swiftLanguageMode(.v5),
        .enableUpcomingFeature("StrictConcurrency")   // = complete checking, as warnings under Swift 5 mode
    ]
)
```

In Xcode: **Build Settings** → **Strict Concurrency Checking** → **Complete**.

`complete` finds **the same problems** Swift 6 mode would, but as **warnings**, not errors. So the build still works, and your team fixes them **at its own pace**. When the warnings are gone, switch the target to Swift 6 mode. The switch is then a **non-event**.

```plaintext
1. Swift 5 mode + Strict Concurrency: Complete   → 47 warnings
2. Fix warnings over a few weeks                 → 0 warnings
3. Swift Language Version: 6                     → builds cleanly, now enforced as errors
```

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `Sendable` | A type that's safe to share across isolation domains |
| Automatic conformance | Free for structs/enums of Sendable values; classes need `final` + `let`, or an actor |
| `@Sendable` closures | Can't change captured `var`s or capture non-Sendable values |
| `@unchecked Sendable` | Your unchecked promise; prefer a `Mutex` or an actor |
| `sending` | A one-time handoff of a value the caller never touches again |
| Region-based isolation | The compiler proves no one else holds the value, so it can move |
| Common Swift 6 errors | Each points to a real race; fix with actors, `Sendable`, `sending`, or `await` |
| Module migration | Leaf modules first; `@preconcurrency import` for unmigrated dependencies |
| Strict concurrency settings | `complete` in Swift 5 mode shows Swift 6 problems as warnings first |
