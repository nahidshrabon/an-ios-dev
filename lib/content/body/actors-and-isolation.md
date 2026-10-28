**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 19.1 The Data Race Problem Actors Solve 🟢

A **data race** happens when two threads use the **same memory at the same time**, at least one of them **writes**, and **nothing coordinates** them. The result is unpredictable, and the bug often **won't reproduce** when you try to debug it.

```swift
class Counter {
    var value = 0
    func increment() { value += 1 }
}

let counter = Counter()

// If multiple threads call counter.increment() concurrently with no synchronization,
// the += operation (read, add one, write back) can interleave between threads,
// silently losing increments — a classic, hard-to-reproduce data race.
```

Why `+= 1` isn't safe:

```plaintext
value = 5
Thread A: read 5 ...............  write 6
Thread B:        read 5 .................. write 6
Result: 6, but two increments happened. One was lost.
```

Before Swift concurrency, you avoided this by **discipline**: locks (`NSLock`, section 22), serial dispatch queues, and careful thinking about which thread touches what. One forgotten lock was enough for a bug.

**Actors** move this job into the **type system**. An actor's mutable state can only be used **through the actor**, **one operation at a time**, and the **compiler checks** this. You can't forget to lock.

---

## 19.2 Declaring and Using an Actor 🟢

An **actor** looks almost like a class: properties, methods, initializers. The difference: Swift makes sure only **one** piece of code uses its mutable state **at a time**. From **outside**, you must use **`await`**, because you might have to **wait your turn**:

```swift
actor Counter {
    var value = 0
    func increment() {
        value += 1
    }
}

func useCounter() async {
    let counter = Counter()
    await counter.increment()   // await required — this call might need to wait its turn
    print(await counter.value)   // await required even for property access from outside the actor
}
```

If two callers call `await counter.increment()` at once, the actor runs them **one after the other**, never together. So two `+= 1` operations can **never interleave**: the data race from 19.1 is gone.

**Inside** the actor, no `await` is needed. You're already "inside the room":

```swift
actor Counter {
    var value = 0
    func increment() { value += 1 }
    func incrementTwice() {
        increment()      // no await: same actor
        increment()
    }
}
```

The compiler **stops** unsafe access from outside:

```swift
let counter = Counter()
counter.value = 10      // ❌ error: actor-isolated property 'value' can not be mutated from outside the actor
```

Actors are **reference types**, like classes, but they **can't be subclassed**.

A realistic example: a cache that many tasks can use safely:

```swift
actor ImageCache {
    private var images: [URL: Data] = [:]

    func image(for url: URL) -> Data? { images[url] }
    func store(_ data: Data, for url: URL) { images[url] = data }
}
```

---

## 19.3 Actor Reentrancy and the Interleaving Surprise 🔴

This surprises many developers: actors are **reentrant**. While an actor method is **paused at an `await`**, the actor can **run other calls** in the meantime. It doesn't block everything until the first call is completely done.

```swift
actor BankAccount {
    var balance = 100

    func withdraw(_ amount: Int) async {
        guard balance >= amount else { return }
        try? await Task.sleep(for: .seconds(1))   // suspension point — actor is free to interleave other work here!
        balance -= amount   // by the time we resume, balance might have changed due to another call
    }
}
```

What can happen with two calls to `withdraw(100)`:

```plaintext
Call 1: guard 100 >= 100 ✓  → await (paused)
Call 2:                         guard 100 >= 100 ✓  → await (paused)
Call 1:                                                resumes → balance = 0
Call 2:                                                resumes → balance = -100   😱
```

Both passed the check **before** either subtracted. This isn't a bug in actors. It comes from `await` being a **real pause point** (17.3).

**Fix 1:** change state **before** any `await`, so the check and the change happen together:

```swift
func withdraw(_ amount: Int) async throws {
    guard balance >= amount else { throw BankError.insufficientFunds }
    balance -= amount                         // reserve the money first, no await in between
    do {
        try await bankServer.confirm(amount)  // now it's safe to wait
    } catch {
        balance += amount                     // undo if the server says no
        throw error
    }
}
```

**Fix 2:** **check again** after every `await`, because the state may have changed:

```swift
try await Task.sleep(for: .seconds(1))
guard balance >= amount else { return }      // re-check after resuming
balance -= amount
```

**Rule:** inside an actor, treat every `await` as a place where **other code may change your state**.

---

## 19.4 `isolated` Parameters 🔴

An **`isolated` parameter** lets a normal function (not a method of the actor) run **inside a specific actor's isolation**. That's handy for free functions or helpers that need direct access to an actor's state:

```swift
actor DataStore {
    var items: [String] = []
}

func addItem(_ item: String, to store: isolated DataStore) {
    store.items.append(item)   // no "await" needed here — this function IS running on store's isolation
}

func useStore() async {
    let store = DataStore()
    await addItem("first", to: store)   // the await happens at the call site, entering the isolation
}
```

Inside `addItem`, there's **no `await`** to touch `store.items`: the function body already runs **on that actor**, just like a method of `DataStore`. The `await` is at the **call site**, where control **enters** the actor.

This is useful to do **several steps** on an actor **without** a pause between them (avoiding the reentrancy problem from 19.3):

```swift
func moveFirstItem(in store: isolated DataStore) {
    guard !store.items.isEmpty else { return }
    let item = store.items.removeFirst()
    store.items.append(item)         // both steps run together, no other call can sneak in
}
```

---

## 19.5 Global Actors and `@MainActor` 🟢

A **global actor** is **one shared isolation domain for the whole app**, instead of an actor instance you create. The most important one is **`@MainActor`**, which runs on the **main thread**. UIKit and SwiftUI require UI updates on the main thread.

```swift
@MainActor
class ViewModel {
    var items: [String] = []   // implicitly isolated to the main actor

    func refresh() {
        items = ["a", "b", "c"]   // safe — this method is guaranteed to run on the main actor
    }
}

func loadData() async {
    let viewModel = await ViewModel()   // await needed to enter the main actor's isolation from outside
    await viewModel.refresh()
}
```

You can put `@MainActor` on:

```swift
@MainActor class ScreenModel { }            // a whole type: every member
class Mixed {
    @MainActor var title = ""               // one property
    @MainActor func updateUI() { }          // one method
}
@MainActor func showAlert() { }             // a free function
Task { @MainActor in /* ... */ }            // one closure
```

It replaces the old habit of **remembering** to write `DispatchQueue.main.async { ... }`. Now the **compiler checks** it:

```swift
// Before: easy to forget, and nothing warned you
URLSession.shared.dataTask(with: url) { data, _, _ in
    DispatchQueue.main.async { self.label.text = "Done" }
}.resume()

// Now: the compiler knows `label` is main-actor state
@MainActor
func load() async throws {
    let (data, _) = try await URLSession.shared.data(from: url)
    label.text = "Loaded \(data.count) bytes"   // guaranteed to be on the main thread
}
```

To jump onto the main actor briefly from other code, use `MainActor.run`:

```swift
await MainActor.run {
    viewModel.isLoading = false
}
```

---

## 19.6 `@MainActor` Inference Rules 🟡

Swift **infers** `@MainActor` in many common cases, so you don't write it everywhere:

- A type that conforms to a **`@MainActor` protocol** becomes `@MainActor`.
- A **subclass** of a `@MainActor` class is `@MainActor`.
- Most UIKit and SwiftUI types and protocols (`UIViewController`, `UIView`, SwiftUI's `View`) **are** `@MainActor`.

```swift
// UIViewController itself is @MainActor-isolated in modern SwiftUI/UIKit,
// so a subclass automatically inherits that isolation without writing @MainActor explicitly:
class MyViewController: UIViewController {
    func updateLabel() {
        // implicitly @MainActor-isolated, inherited from UIViewController
    }
}
```

```swift
struct ProfileView: View {          // View is @MainActor, so this struct is too
    @State private var name = ""

    var body: some View { Text(name) }

    func reset() { name = "" }      // main actor, no annotation needed
}
```

Inference has **limits**. A plain class that a view **uses** is not main-actor automatically:

```swift
class ProfileModel {                 // ⚠️ not inferred: nothing makes it @MainActor
    var name = ""
}

@MainActor                           // ✅ say it explicitly (or use defaultIsolation, 19.13)
@Observable
final class ProfileModel2 {
    var name = ""
}
```

These rules are the base of "approachable concurrency" (16.5). Most UI code **should** be on the main actor, so letting the compiler infer it removes many annotations.

---

## 19.7 `MainActor.assumeIsolated` 🔴

Sometimes code **really is** on the main thread, but the **compiler can't know it**. A typical case: a callback from an older API that **always** calls back on the main thread, but has no way to say so in its types.

**`MainActor.assumeIsolated`** bridges this. It **checks at runtime** that you're on the main actor, and lets you use main-actor state inside:

```swift
func legacyMainThreadCallback(completion: @escaping () -> Void) {
    // pretend this always calls "completion" on the main thread, but has no type-level way to prove it
    DispatchQueue.main.async {
        completion()
    }
}

@MainActor
class ViewModel {
    var count = 0

    func observe() {
        legacyMainThreadCallback {
            MainActor.assumeIsolated {
                self.count += 1   // safe, because we've asserted this closure genuinely runs on the main actor
            }
        }
    }
}
```

**It's an escape hatch, not a normal tool.** If you're wrong and the code runs on another thread, the app **crashes**, like force-unwrapping a `nil`. Use it only when you **know for sure** the code runs on the main thread (often documented by the old API).

| | `await MainActor.run { }` | `MainActor.assumeIsolated { }` |
|---|---|---|
| Needs `async` | Yes | No (synchronous) |
| If not on the main thread | Hops to it (waits) | **Crashes** |
| Use when | You might be elsewhere | You're certain you're on main |

---

## 19.8 Writing a Custom Global Actor 🔴

Besides `@MainActor`, you can define **your own** global actor. Use it for shared state that **isn't UI**, but needs **one isolation domain for the whole app**. Mark an actor with **`@globalActor`** and give it a `shared` instance:

```swift
@globalActor
actor DatabaseActor {
    static let shared = DatabaseActor()
}

@DatabaseActor
class DatabaseManager {
    var connection: String = "connected"

    func query(_ sql: String) -> [String] {
        // implicitly isolated to DatabaseActor — safe from concurrent access, without being tied to the main thread
        []
    }
}
```

Now **any** type or function in the app can join that same domain:

```swift
@DatabaseActor
final class MigrationRunner {
    func run(using db: DatabaseManager) {
        _ = db.query("ALTER TABLE ...")    // same actor: no await needed
    }
}

@MainActor
func refreshScreen(db: DatabaseManager) async {
    let rows = await db.query("SELECT * FROM recipes")   // from another actor: await
}
```

| | A normal actor | A global actor |
|---|---|---|
| Isolation | One per **instance** | One for the **whole app** |
| Shared by | Only that object | Any type marked with it |
| Example | `ImageCache` | All database access in the app |

Use a custom global actor when **several unrelated types** must all be serialized **against each other**, like all database access. For one self-contained piece of state, a normal actor is simpler.

---

## 19.9 `nonisolated` Members 🟡

**`nonisolated`** takes one member **out** of the actor's isolation (or out of a `@MainActor` type). Use it for members that **don't touch mutable state**: a `let` constant, or a pure function that only uses its parameters.

```swift
actor Temperature {
    var celsius: Double

    init(celsius: Double) {
        self.celsius = celsius
    }

    nonisolated func describe(_ value: Double) -> String {
        // doesn't touch "celsius" at all — safe to call without await, from anywhere
        "\(value)°"
    }
}

func useTemperature() {
    let temp = Temperature(celsius: 20)
    print(temp.describe(100))   // no "await" needed — describe() is nonisolated
}
```

A `nonisolated` member **can't** read mutable state. The compiler checks:

```swift
nonisolated func current() -> Double {
    celsius            // ❌ error: actor-isolated property 'celsius' can not be referenced from a nonisolated context
}
```

`let` constants of `Sendable` type can be read **without `await`**, since they never change:

```swift
actor Session {
    let id = UUID()              // immutable and Sendable
}

let session = Session()
print(session.id)                // no await needed
```

A common use: conforming to protocols with **synchronous** requirements, like `CustomStringConvertible` or `Hashable`, using only immutable data:

```swift
extension Session: CustomStringConvertible {
    nonisolated var description: String { "Session \(id)" }
}
```

---

## 19.10 `nonisolated(unsafe)` and Its Contract 🔴

**`nonisolated(unsafe)`** is a **stronger and riskier** version. It takes a **mutable stored property** out of isolation completely, and the compiler **can't check** that it's safe. It's **your promise** that access is safe anyway, usually because something else (like a `Mutex`, 14.21) protects it.

```swift
actor Logger {
    nonisolated(unsafe) var logCount = 0   // the compiler will NOT protect this property at all

    nonisolated func incrementUnsafely() {
        logCount += 1   // ⚠️ genuinely unsafe unless externally synchronized somehow
    }
}
```

Treat it like **`@unchecked Sendable`** (20.4): a deliberate opt-out of compiler-checked safety. Use it **only** with a specific, verified reason, never just to **silence** an error.

Often there's a **safe** alternative:

```swift
import Synchronization

final class Logger: Sendable {
    private let count = Mutex(0)                    // protected, and the compiler knows it

    func log(_ message: String) {
        count.withLock { $0 += 1 }
        print(message)
    }
}
```

A legitimate use is a global that is set **once** at startup, before any concurrency begins, and only **read** after that:

```swift
nonisolated(unsafe) var apiBaseURL = URL(string: "https://api.example.com")!
// Set in main() before any tasks start; only read afterwards.
```

Even here, a `let` (if possible) is better.

---

## 19.11 `nonisolated(nonsending)` Explained 🔴

**`nonisolated(nonsending)`** (Swift 6.2) is for **async** functions. It makes the function `nonisolated` (it doesn't belong to any actor), but it **runs on the caller's actor**. So there's **no hop** to another thread, and the caller's non-`Sendable` values can be passed in **without** errors.

Without it, a plain `nonisolated async` function (in Swift 6.0/6.1) **always hops** to the cooperative pool, even if the caller was on the main actor:

```swift
class Formatter {                                  // not Sendable
    func format(_ value: Int) -> String { "\(value)" }
}

// Swift 6.0 behavior: hops off the caller's actor
nonisolated func render(_ formatter: Formatter) async -> String {
    formatter.format(42)
}

@MainActor
func show(formatter: Formatter) async {
    let text = await render(formatter)
    // ❌ (6.0) error: sending 'formatter' risks causing data races —
    //    it would cross from the main actor to the pool
}
```

With `nonisolated(nonsending)`, the function stays on the caller's actor, so nothing crosses a boundary:

```swift
nonisolated(nonsending) func render(_ formatter: Formatter) async -> String {
    formatter.format(42)        // runs on the main actor when called from there
}
```

```plaintext
plain nonisolated async (6.0):    caller's actor ──hop──► cooperative pool ──hop back──►
nonisolated(nonsending) async:    stays on the caller's actor the whole time
```

With Swift 6.2's **approachable concurrency** settings, this becomes the **default** for `nonisolated async` functions. You'll mostly see the explicit keyword in libraries that must support both behaviors.

---

## 19.12 `@concurrent` — Opting Out of Caller Isolation 🟡

**`@concurrent`** (Swift 6.2) says the opposite: "**always** run this async function on the **cooperative pool**, off **any** actor, including the caller's."

```swift
@MainActor
class ViewModel {
    @concurrent
    func performHeavyComputation() async -> Int {
        // explicitly runs off the main actor, on the general cooperative pool,
        // even though this method is declared inside a @MainActor-isolated class
        (0..<1_000_000).reduce(0, +)
    }
}
```

Use it to move **CPU-heavy** work off the main actor, so the **UI stays smooth**, without creating a separate type:

```swift
@MainActor
@Observable
final class PhotoEditorModel {
    var preview: CGImage?

    func applyFilter(to image: CGImage) async {
        preview = await Self.render(image)        // main actor waits; UI stays responsive
    }

    @concurrent
    private static func render(_ image: CGImage) async -> CGImage {
        // heavy pixel work on the pool
        image
    }
}
```

A `@concurrent` function **can't** touch the main actor's state directly. Pass in what it needs, and return a result:

| Keyword | Where the async function runs |
|---|---|
| `nonisolated(nonsending)` | On the **caller's** actor (stays put) |
| `@concurrent` | On the **cooperative pool** (always leaves) |

---

## 19.13 Main-Actor-by-Default (`defaultIsolation`) Mode 🟡

As introduced in 16.5, **`defaultIsolation`** is a **per-target** setting that makes **`@MainActor` the default** for all code in that target, unless you say otherwise. Before, code had **no** isolation unless you wrote `@MainActor`.

```swift
// With defaultIsolation set to MainActor for this target's build settings:
class ViewModel {
    var items: [String] = []   // implicitly @MainActor-isolated, with no attribute written at all
}

// To explicitly opt OUT of the default and run off the main actor instead:
@concurrent
func backgroundWork() async {
    // explicitly not main-actor-isolated, despite the target's main-actor-by-default setting
}
```

Turning it on:

```swift
// Package.swift
.target(name: "AppUI", swiftSettings: [.defaultIsolation(MainActor.self)])

// Xcode: Build Settings → Default Actor Isolation → MainActor (the default for new apps in Xcode 26+)
```

Ways to **opt out**, for the code that shouldn't be on the main actor:

```swift
nonisolated struct Parser {           // a whole type, off the main actor
    func parse(_ data: Data) -> [Item] { [] }
}

@concurrent func compress(_ data: Data) async -> Data { data }   // one async function, on the pool

actor DownloadQueue { }               // actors are always their own isolation
```

**Why it fits most apps:** almost all SwiftUI code is **UI code** and belongs on the main actor anyway. Instead of writing `@MainActor` nearly everywhere, you mark only the **small** part that should run elsewhere.

A good split: turn it on for **app/UI** targets, and leave it off for **library** targets (networking, parsing), which should not assume the main actor.

---

## 19.14 Custom Actor Executors 🔴

By default, Swift's runtime decides **where** an actor's work runs. An actor can instead provide a **custom executor**, to run its work on a **specific queue or thread**. That matters when you connect to an **existing** system that already uses its own **serial `DispatchQueue`**.

```swift
actor LegacySystemBridge {
    // Conceptual illustration — actual custom executor conformance
    // requires implementing the `Executor` protocol and providing
    // an `unownedExecutor` property pointing at your custom executor:
    //
    // nonisolated var unownedExecutor: UnownedSerialExecutor {
    //     myLegacyDispatchQueue.asUnownedSerialExecutor()
    // }
}
```

A working version, using a `DispatchSerialQueue` (iOS 17+), which can act as an executor directly:

```swift
actor DatabaseBridge {
    private let queue = DispatchSerialQueue(label: "com.example.database")

    nonisolated var unownedExecutor: UnownedSerialExecutor {
        queue.asUnownedSerialExecutor()          // all of this actor's work runs on `queue`
    }

    func save(_ row: String) {
        // runs on "com.example.database", the same queue the old code already uses
        dispatchPrecondition(condition: .onQueue(queue))
    }
}
```

Now old code that does `queue.async { ... }` and new actor code are serialized **on the same queue**, so they can't race with each other.

This is an **advanced, narrow** tool, mainly for **gradually** moving a big queue-based codebase to actors, without having **two** competing ways of serializing the same data.

---

## 19.15 Isolated Conformances and Isolated `deinit` 🔴

Two newer refinements fix awkward gaps in the isolation model.

**Isolated conformances** (Swift 6.2): a `@MainActor` type can conform to a **normal** protocol **while staying main-actor isolated**. Before, the protocol's methods had to be `nonisolated`, which often meant they couldn't touch the type's state:

```swift
@MainActor
final class Person {
    var name = ""
}

// Before: the requirement had to be nonisolated, so it couldn't read `name`.
// Now: conform as @MainActor; the conformance is only usable on the main actor.
extension Person: @MainActor Equatable {
    static func == (lhs: Person, rhs: Person) -> Bool {
        lhs.name == rhs.name          // ✅ reads main-actor state
    }
}
```

The compiler makes sure the conformance is only **used** on the main actor.

**Isolated `deinit`**: normally, a `deinit` runs **nonisolated**, on whatever thread drops the last reference. So it can't safely touch the actor's state. An **`isolated deinit`** runs **on the actor's own isolation**:

```swift
actor DataCache {
    var cache: [String: String] = [:]

    // an isolated deinit can safely access "cache" directly during teardown,
    // rather than needing cache to be nonisolated(unsafe) or handled some other awkward way
    isolated deinit {
        print("Cache had \(cache.count) entries at deallocation")
    }
}
```

It works for `@MainActor` classes too, which helps when cleanup must touch UI state:

```swift
@MainActor
final class PlayerController {
    let view = UIView()

    isolated deinit {
        view.removeFromSuperview()     // safe: runs on the main actor
    }
}
```

Both features let code **honestly** state its isolation, instead of using unsafe workarounds like `nonisolated(unsafe)`.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| The data race problem | Unsynchronized shared mutable state gives random, hard-to-reproduce bugs |
| Actors | One operation at a time on their state; `await` from outside |
| Reentrancy | Other calls can run during an `await`; change state before awaiting, or re-check after |
| `isolated` parameters | A free function that runs inside a given actor |
| `@MainActor` | The main-thread global actor; replaces `DispatchQueue.main.async` |
| `@MainActor` inference | Inherited from `UIViewController`, `View`, and `@MainActor` protocols |
| `MainActor.assumeIsolated` | A runtime-checked "I know I'm on main"; crashes if wrong |
| Custom global actors | One shared isolation domain for several types, like all database access |
| `nonisolated` | Members that don't touch mutable state; no `await` needed |
| `nonisolated(unsafe)` | An unchecked promise; prefer `Mutex` or `let` |
| `nonisolated(nonsending)` | An async function that stays on the caller's actor |
| `@concurrent` | An async function that always runs on the cooperative pool |
| `defaultIsolation` | Main actor by default for a target; opt out with `nonisolated`, `@concurrent`, actors |
| Custom actor executors | Run an actor on an existing serial queue |
| Isolated conformances/deinit | Conformances and `deinit` that stay on the actor's isolation |
