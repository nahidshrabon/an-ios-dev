**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

These are the concurrency tools that came **before** Swift concurrency: GCD, OperationQueue, locks, and Combine. You'll still meet them **all the time**, in existing apps, third-party libraries, and Apple's documentation. This section helps you **read** that code, and **move it** to async/await step by step.

## 22.1 GCD: Queues and `DispatchQueue.async` 🟢

**Grand Central Dispatch (GCD)** is Apple's older, lower-level concurrency system. It's built on **queues**: you put closures (**work items**) on a queue, and the system runs them on a pool of threads. **`async`** adds work **without waiting** for it, much like `Task { }` (17.5):

```swift
DispatchQueue.global().async {
    let result = performExpensiveComputation()
    DispatchQueue.main.async {
        updateUI(with: result)   // classic GCD pattern: background work, then hop back to main for UI
    }
}
```

Two kinds of queues:

| Queue | Runs | Like |
|---|---|---|
| **Serial** | One work item at a time, in order | An actor (protects shared state) |
| **Concurrent** | Several work items at once | The cooperative pool |

```swift
let serial = DispatchQueue(label: "com.example.cache")                         // serial by default
let concurrent = DispatchQueue(label: "com.example.io", attributes: .concurrent)
```

**`DispatchQueue.main`** is a **serial** queue on the **main thread**. The pattern "work in the background, then `DispatchQueue.main.async` for the UI" is exactly what **`@MainActor`** (19.5) now does **in the type system**, so you can't forget the hop.

`sync` vs `async`:

```swift
queue.async { print("A") }   // adds the work and returns right away
queue.sync  { print("B") }   // adds the work and WAITS until it's done (blocks the caller)
```

`sync` **blocks** the calling thread. Use it rarely, and never on the main thread with a slow queue (see deadlocks, 22.6).

---

## 22.2 GCD: Quality of Service Classes 🟢

GCD work has a **quality of service (QoS)** class. It tells the system **how important** the work is. It's the older version of task priority (17.10):

```swift
DispatchQueue.global(qos: .userInitiated).async {
    // work the user is actively waiting on — high priority
}

DispatchQueue.global(qos: .background).async {
    // low-priority maintenance work, like cleaning up a cache
}
```

| QoS | Use for | Task priority equivalent |
|---|---|---|
| `.userInteractive` | UI work: animations, scrolling | `.high` (and the main actor) |
| `.userInitiated` | A result the user is **waiting** for | `.userInitiated` |
| `.utility` | Longer work with a progress bar | `.utility` |
| `.background` | Invisible maintenance (cleanup, prefetch) | `.background` |

The right QoS helps the system balance **speed, battery, and heat**. `.background` work may run much later, or slower, when the device is busy or in Low Power Mode.

---

## 22.3 `DispatchGroup` and Barriers 🟡

**`DispatchGroup`** tracks several async work items, and tells you when **all** of them are done. It's like `withTaskGroup` (18.3), but **manual** and **unstructured**:

```swift
let group = DispatchGroup()

group.enter()
fetchUser { _ in group.leave() }

group.enter()
fetchSettings { _ in group.leave() }

group.notify(queue: .main) {
    print("Both fetches complete")   // fires only after both enter/leave pairs balance out
}
```

The rule: every `enter()` needs **exactly one** `leave()`. Too few, and `notify` **never** fires. Too many, and the app **crashes**. (Sound familiar? It's the same problem as continuations in 18.12.)

A **barrier** is a special work item on a **concurrent** queue. It **waits** for earlier work to finish, then runs **alone**, and later work waits for it. This was the classic way to build a **readers–writer** cache: many reads at once, but writes alone:

```swift
final class LegacyCache {
    private let queue = DispatchQueue(label: "cache", attributes: .concurrent)
    private var storage: [String: Data] = [:]

    func value(for key: String) -> Data? {
        queue.sync { storage[key] }                       // reads can run in parallel
    }

    func store(_ data: Data, for key: String) {
        queue.async(flags: .barrier) { self.storage[key] = data }   // writes run alone
    }
}
```

Today, an **actor** does the same job, with safety **checked by the compiler**:

```swift
actor Cache {
    private var storage: [String: Data] = [:]
    func value(for key: String) -> Data? { storage[key] }
    func store(_ data: Data, for key: String) { storage[key] = data }
}
```

---

## 22.4 `OperationQueue` and Dependencies 🟡

**`OperationQueue`** is a higher-level layer on top of GCD. It works with **`Operation`** objects instead of plain closures, and supports **dependencies**: "don't start B until A is done". Plain GCD queues can't do that without manual `DispatchGroup` work.

```swift
let queue = OperationQueue()

let downloadOperation = BlockOperation {
    print("Downloading...")
}

let processOperation = BlockOperation {
    print("Processing downloaded data...")
}

processOperation.addDependency(downloadOperation)   // won't start until downloadOperation finishes

queue.addOperations([downloadOperation, processOperation], waitUntilFinished: false)
```

Other features:

```swift
queue.maxConcurrentOperationCount = 2      // at most 2 operations at once
downloadOperation.queuePriority = .high
downloadOperation.cancel()                 // marks it cancelled
```

Cancellation is **cooperative**, just like in Swift concurrency (18.7): the operation's code must check `isCancelled` and stop itself.

The modern equivalent is usually plain **sequential `await`s** (dependencies), and a **task group** with a limit (18.3):

```swift
let data = try await download()       // "B depends on A" is just: await A, then do B
let result = process(data)
```

---

## 22.5 Locks: `NSLock` and `os_unfair_lock` 🟡

Before actors, protecting shared mutable state meant **manual locking**:

- **`NSLock`**: Foundation's general-purpose lock.
- **`os_unfair_lock`**: a lower-level, faster lock from the OS, with stricter rules. In Swift, use it through **`OSAllocatedUnfairLock`** (iOS 16+), which handles its memory safely.

```swift
final class ThreadSafeCounter {
    private let lock = NSLock()
    private var _value = 0

    func increment() {
        lock.lock()
        defer { lock.unlock() }   // always paired with lock(), even if an error occurs mid-critical-section
        _value += 1
    }
}
```

```swift
import os

final class Stats {
    private let state = OSAllocatedUnfairLock(initialState: [String: Int]())

    func record(_ event: String) {
        state.withLock { $0[event, default: 0] += 1 }   // the lock owns the state
    }
}
```

This is the same technique as the `@unchecked Sendable` example in 20.4. **Every** access must go through the lock, or the protection silently fails.

| Tool | Checked by the compiler? | Use today |
|---|---|---|
| `NSLock`, `os_unfair_lock` | ❌ | Legacy code, very specific needs |
| `OSAllocatedUnfairLock`, `Mutex` (14.21) | ✅ The state lives inside the lock | Small, fast synchronous protection |
| Actors | ✅ | The default for shared mutable state |

**Never hold a lock across an `await`.** The task may resume on a different thread, and the lock may never be released correctly.

---

## 22.6 Recognizing Deadlock and Priority Inversion 🔴

A **deadlock** happens when threads **wait on each other forever**. The classic GCD case: calling **`DispatchQueue.main.sync`** while **already on the main thread**. The main queue is serial and busy running **your** code, so the new work can never start, and your code waits for it forever:

```swift
// Calling this from the main thread deadlocks the app immediately:
DispatchQueue.main.sync {
    print("This will never print")
}
```

The same happens with **any serial queue** that calls `sync` on **itself**:

```swift
let queue = DispatchQueue(label: "com.example.data")
queue.async {
    queue.sync {          // 💥 deadlock (often a crash: "dispatch_sync called on queue already owned by current thread")
        print("never")
    }
}
```

**Priority inversion** is subtler: a **high-priority** thread waits for a lock held by a **low-priority** thread, and that low-priority thread can't run because **medium-priority** work keeps taking the CPU. The priorities end up **upside down**.

```plaintext
High:    waiting for lock ......................... (stuck)
Medium:  ████████████████████████████████          (keeps the CPU busy)
Low:     holds the lock, but never gets to run to release it
```

How they show up in practice:

- The app **freezes** (often reported as a **hang**, 80.7).
- In the debugger, a thread's stack shows it **waiting** in `lock`, `sync`, or `semaphore.wait` that never returns.
- Xcode's **Thread Performance Checker** warns about priority inversions.

These problems are a big reason for Swift concurrency's design. Actors and structured tasks **don't block threads**, which makes many deadlocks **much harder** to write by accident.

---

## 22.7 Combine: Publishers and Subscribers 🟡

**Combine** (2019, before async/await) is Apple's **reactive** framework. It's built on:

- **Publishers**: emit a stream of values over time.
- **Subscribers**: receive the values and react.

It's related to `AsyncSequence` (21.1), but **push-based** (you register a callback), instead of pulled with `for await`.

```swift
import Combine

let publisher = Just(42)   // a publisher that emits exactly one value, then finishes

let cancellable = publisher.sink { value in
    print("Received: \(value)")
}
```

`@Published` turns a class property into a publisher, reachable with `$`:

```swift
final class Settings {
    @Published var count = 0   // a property whose changes can be observed as a publisher (see 22.9)
}

let settings = Settings()
let subscription = settings.$count.sink { newValue in
    print("count changed to \(newValue)")
}
settings.count = 5             // prints "count changed to 5"
```

The **cancellable** keeps the subscription alive. When it's released, the subscription **stops**. That's why you see a `Set<AnyCancellable>` in so many classes:

```swift
final class ProfileViewModel {
    private var cancellables = Set<AnyCancellable>()

    init(settings: Settings) {
        settings.$count
            .sink { print("count: \($0)") }
            .store(in: &cancellables)      // lives as long as the view model
    }
}
```

Combine is everywhere in code written from about **2019 to 2023**, and in parts of Apple's frameworks. Know its vocabulary: **publisher, subscriber, `sink`, cancellable**.

---

## 22.8 Combine: Common Operators 🟡

Combine has many **operators** that transform a publisher's values. They're very similar to the swift-async-algorithms operators (21.7–21.9); Combine came first and partly inspired that package.

```swift
import Combine

let numbers = [1, 2, 3, 4, 5].publisher

let cancellable = numbers
    .map { $0 * 2 }              // transform each emitted value — like Sequence's map (3.9)
    .filter { $0 > 4 }            // keep only matching values — like Sequence's filter (3.10)
    .sink { print($0) }           // 6, 8, 10

let searchPublisher = searchTextSubject
    .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)   // same concept as 21.7's debounce
    .removeDuplicates()
    .sink { query in performSearch(query) }
```

A typical "search as you type" pipeline, with networking:

```swift
$query
    .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
    .removeDuplicates()
    .map { query in
        URLSession.shared.dataTaskPublisher(for: searchURL(query))
            .map(\.data)
            .decode(type: [Recipe].self, decoder: JSONDecoder())
            .replaceError(with: [])
    }
    .switchToLatest()                     // cancel the old request when a new query arrives
    .receive(on: DispatchQueue.main)      // deliver results on the main thread
    .assign(to: &$results)
```

| Combine | Sequence (3) | async-algorithms (21) |
|---|---|---|
| `map`, `filter` | `map`, `filter` | `map`, `filter` |
| `debounce` | — | `debounce` |
| `merge`, `zip`, `combineLatest` | `zip` | `merge`, `zip`, `combineLatest` |
| `receive(on:)` | — | (use actors instead) |

The shared names aren't a coincidence: Combine set much of the vocabulary that later async tools reused.

---

## 22.9 Combine: `@Published` and `ObservableObject` 🟢

Before `@Observable` (13.5, 25.4), SwiftUI's data binding was built on Combine: **`ObservableObject`** plus **`@Published`** properties. Each `@Published` change fires the object's **`objectWillChange`** publisher.

```swift
class OldStyleViewModel: ObservableObject {
    @Published var username: String = ""
    @Published var isLoggedIn: Bool = false
}
```

SwiftUI listens to `objectWillChange` (through `@StateObject` or `@ObservedObject`) to know when to **re-render**:

```swift
struct OldStyleView: View {
    @StateObject private var viewModel = OldStyleViewModel()

    var body: some View {
        TextField("Name", text: $viewModel.username)
    }
}
```

| | `ObservableObject` + `@Published` | `@Observable` |
|---|---|---|
| Notifies | On **any** `@Published` change | Only for properties a view **read** |
| View wrappers | `@StateObject`, `@ObservedObject`, `@EnvironmentObject` | `@State`, plain property, `@Environment` |
| Based on | Combine | The Observation module |

This is covered in depth in 25.12, because it's still **very common** in existing SwiftUI apps. The key difference: `objectWillChange` is **coarse** (any change re-renders every observing view), while `@Observable` tracks **per property** (14.20, 25.13).

---

## 22.10 Migrating Combine Code to Async/Await 🟡

A Combine publisher can be read as an **`AsyncSequence`** through its **`values`** property. That lets you move code to `for await` **step by step**, without rewriting the publisher chain at once:

```swift
import Combine

let publisher = URLSession.shared.dataTaskPublisher(for: url)

func fetchData() async throws -> Data {
    for try await (data, _) in publisher.values {
        return data   // consume the first emitted value, then return
    }
    throw URLError(.badServerResponse)
}
```

The same works for a `@Published` property:

```swift
for await name in viewModel.$username.values {
    print("username is now \(name)")
}
```

Common one-to-one replacements:

| Combine | Modern Swift |
|---|---|
| `dataTaskPublisher(for:)` | `try await URLSession.shared.data(from:)` |
| `ObservableObject` + `@Published` | `@Observable` |
| `$property.sink { }` | `Observations { model.property }` (21.10) |
| `.debounce(...)` | `.debounce(for:)` (async-algorithms) or `.task(id:)` + `Task.sleep` |
| `.receive(on: DispatchQueue.main)` | `@MainActor` |
| `Future { promise in ... }` | `withCheckedThrowingContinuation` (18.11) |

The search pipeline from 22.8, in modern form:

```swift
@MainActor
@Observable
final class SearchModel {
    var query = ""
    var results: [Recipe] = []

    func search() async {
        try? await Task.sleep(for: .milliseconds(300))      // debounce
        guard !Task.isCancelled else { return }               // a newer query replaced this one
        results = (try? await api.search(query)) ?? []
    }
}

// In the view:
.task(id: model.query) { await model.search() }               // restarts (and cancels) on each change
```

---

## 22.11 Migrating GCD Code to Structured Concurrency 🟡

Moving GCD code to Swift concurrency is mostly a **direct mapping**:

```swift
// GCD: background work, then hop back to main
DispatchQueue.global().async {
    let result = performExpensiveComputation()
    DispatchQueue.main.async {
        updateUI(with: result)
    }
}

// Swift concurrency equivalent:
@concurrent
func compute() async -> ComputationResult {
    performExpensiveComputation()            // runs off the main actor (17.9, 19.12)
}

@MainActor
func refresh() async {
    let result = await compute()
    updateUI(with: result)                   // back on the main actor automatically
}
```

```swift
// GCD: waiting for multiple independent operations
let group = DispatchGroup()
group.enter(); fetchUser { _ in group.leave() }
group.enter(); fetchSettings { _ in group.leave() }
group.notify(queue: .main) { /* both done */ }

// Structured concurrency equivalent — async let (section 18.2):
async let user = fetchUser()
async let settings = fetchSettings()
let (loadedUser, loadedSettings) = await (user, settings)
```

| GCD / old tool | Swift concurrency |
|---|---|
| `DispatchQueue.global().async` | `Task { }`, or a `@concurrent` function |
| `DispatchQueue.main.async` | `@MainActor` / `await MainActor.run { }` |
| Serial queue protecting state | An `actor` |
| `DispatchGroup` | `async let` or a task group |
| `asyncAfter(deadline:)` | `try await Task.sleep(for:)` |
| Completion handler | `async` function (wrap old ones with continuations, 18.11) |
| `DispatchSemaphore` to limit work | A task group that adds tasks as others finish (18.3) |

**The big picture:** GCD's manual queue management and `DispatchGroup` bookkeeping become unnecessary. You reach the **same goals** (background work, waiting for several things, protecting state) with **compiler-checked structure** instead of discipline. That's the thread connecting this whole Part, sections 17 to 22.

**Migrate gradually.** Start at the **edges** (wrap old callback APIs with continuations), then move inward. Old and new code can live side by side for a long time.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| GCD queues | Serial vs concurrent; `.main` is the main-thread queue, now mostly `@MainActor` |
| QoS classes | GCD's priority hints; the older version of task priority |
| `DispatchGroup`/barriers | Manual "wait for all" and exclusive writes; task groups and actors replace them |
| `OperationQueue` | Operations with dependencies, limits, and cooperative cancellation |
| `NSLock`/`os_unfair_lock` | Manual locks; prefer actors, `Mutex`, or `OSAllocatedUnfairLock` |
| Deadlock/priority inversion | `sync` on your own serial queue freezes; async/await avoids blocking |
| Combine publishers/subscribers | Push-based streams; keep cancellables alive |
| Combine operators | `map`, `filter`, `debounce`, `switchToLatest`: the vocabulary async tools reuse |
| `@Published`/`ObservableObject` | The old SwiftUI observation; coarser than `@Observable` |
| Migrating Combine | `.values` bridges publishers to `for await`; replace piece by piece |
| Migrating GCD | `Task`, `async let`, task groups, actors, and `@MainActor` replace queues |

**This concludes Part 2 — Concurrency (Sections 17–22).**
