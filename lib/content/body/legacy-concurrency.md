*Estimated read time: ~30 minutes*

---

## 22.1 GCD: Queues and `DispatchQueue.async`

Grand Central Dispatch (GCD) is Apple's original, lower-level concurrency system, built around **queues** — you submit closures (work items) to a queue, and the system manages a pool of threads to actually execute them. `DispatchQueue.async` submits work without waiting for it to finish, returning immediately, much like `Task { }` (recall section 17.5) does for Swift Concurrency.

```swift
DispatchQueue.global().async {
    let result = performExpensiveComputation()
    DispatchQueue.main.async {
        updateUI(with: result)   // classic GCD pattern: background work, then hop back to main for UI
    }
}
```

Queues are either **serial** (one work item at a time, in order — useful for protecting shared state, similar in spirit to an actor) or **concurrent** (multiple work items may run simultaneously). `DispatchQueue.main` is a serial queue tied to the main thread — this "do work in the background, then dispatch back to `.main` for UI updates" pattern is exactly what `@MainActor` (section 19.5) now handles at the type-system level instead of through manual, easy-to-forget queue hops.

---

## 22.2 GCD: Quality of Service Classes

GCD queues carry a **quality of service (QoS)** class, hinting to the system how to prioritize the work relative to other queued work — conceptually similar to Swift Concurrency's task priority (recall section 17.10), but predating it.

```swift
DispatchQueue.global(qos: .userInitiated).async {
    // work the user is actively waiting on — high priority
}

DispatchQueue.global(qos: .background).async {
    // low-priority maintenance work, like cleaning up a cache
}
```

The standard QoS levels, roughly highest to lowest priority: `.userInteractive` (UI-blocking work, like animations), `.userInitiated` (work the user is actively waiting for a result from), `.utility` (longer-running work with a visible progress indicator), and `.background` (invisible maintenance work with no urgency). Choosing the right QoS helps the system make good scheduling trade-offs, especially around power/thermal management on battery-powered devices.

---

## 22.3 `DispatchGroup` and Barriers

`DispatchGroup` lets you track the completion of multiple independent, asynchronously-dispatched work items and be notified once *all* of them finish — conceptually similar to what `withTaskGroup` (section 18.3) provides in structured concurrency, but manual and unstructured.

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

A **barrier** (`DispatchQueue.async(flags: .barrier)`) is a special work item on a *concurrent* queue that waits for all previously-submitted work to finish, runs exclusively (no other work runs alongside it), and blocks subsequent work until it completes — a common, manual pattern for implementing a thread-safe "readers-writers" data structure, where reads can happen concurrently but a write needs exclusive access (a pattern actors now handle automatically and more safely).

---

## 22.4 `OperationQueue` and Dependencies

`OperationQueue` is a higher-level abstraction over GCD, built around `Operation` objects (rather than bare closures) that can express explicit **dependencies** between units of work — "don't start Operation B until Operation A has finished" — something GCD's queues don't directly support without manual `DispatchGroup` choreography.

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

`OperationQueue` also supports cancellation (`operation.cancel()`, checked cooperatively via `isCancelled` inside the operation's own code — directly analogous to Swift Concurrency's cooperative cancellation from section 18.7), priority levels, and limiting `maxConcurrentOperationCount` to cap how many operations run simultaneously.

---

## 22.5 Locks: `NSLock` and `os_unfair_lock`

Before actors, protecting shared mutable state accessed from multiple threads required manual locking — `NSLock` is Foundation's general-purpose mutual-exclusion lock; `os_unfair_lock` is a lower-level, lighter-weight primitive from the OS itself, generally faster but with a stricter, less forgiving usage contract.

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

This is exactly the manual synchronization technique underlying the `@unchecked Sendable` example from section 20.4 — every access to the protected state must consistently go through the lock, with no exceptions, or the protection is silently incomplete. Modern Swift code increasingly reaches for actors (which provide equivalent protection, enforced by the compiler rather than developer discipline) or the `Mutex` type from section 14.21 instead of raw `NSLock`/`os_unfair_lock`, reserving manual locks primarily for legacy code or very specific low-level performance needs.

---

## 22.6 Recognizing Deadlock and Priority Inversion

A **deadlock** occurs when two or more threads each wait on a resource the other holds, with neither able to proceed — a classic case is a thread synchronously waiting on `.main` while already running on `.main` itself (`DispatchQueue.main.sync { }` called from the main thread deadlocks immediately, since the main queue is serial and the calling thread is already occupying it).

```swift
// Calling this from the main thread deadlocks the app immediately:
DispatchQueue.main.sync {
    print("This will never print")
}
```

**Priority inversion** is a subtler problem: a high-priority thread ends up waiting on a lock held by a lower-priority thread, which itself gets starved of CPU time by other, unrelated medium-priority work — effectively "inverting" the intended priority ordering. Recognizing these patterns in stack traces (a thread waiting on a lock or a `.sync` call that never returns) is a key debugging skill for legacy GCD-based code, and both largely motivated Swift Concurrency's structured, compiler-enforced approach — actors and structured task hierarchies make many classes of deadlock structurally much harder to write by accident.

---

## 22.7 Combine: Publishers and Subscribers

Combine (introduced in 2019, predating async/await) is Apple's reactive-programming framework, built around **publishers** (types that emit a stream of values over time) and **subscribers** (types that receive and react to those emitted values) — conceptually related to `AsyncSequence` (section 21.1), but using a push-based, callback-registration model rather than `for await`'s pull-based consumption.

```swift
import Combine

let publisher = Just(42)   // a publisher that emits exactly one value, then finishes

let cancellable = publisher.sink { value in
    print("Received: \(value)")
}

@Published var count = 0   // a property whose changes can be observed as a publisher (see 22.9)

let subscription = $count.sink { newValue in
    print("count changed to \(newValue)")
}
```

Combine remains heavily present in existing codebases (especially ones built between 2019 and the widespread adoption of async/await and `@Observable`), and in Apple's own frameworks in places predating full Swift Concurrency adoption — recognizing its core vocabulary (publisher, subscriber, `sink`, cancellable) is valuable for reading and maintaining that code, even in new projects favoring async/await.

---

## 22.8 Combine: Common Operators

Combine provides a large library of operators transforming a publisher's emitted values — directly parallel in spirit to swift-async-algorithms' operators from section 21.7–21.9, since Combine predates and partly inspired that package's design.

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

The naming and conceptual overlap between Combine's operators and both `Sequence`'s operators (section 3) and swift-async-algorithms' operators (section 21) isn't a coincidence — Combine established much of the reactive-operator vocabulary (`map`, `filter`, `debounce`, `merge`, `zip`, `combineLatest`) that later async-native tools adopted directly.

---

## 22.9 Combine: `@Published` and `ObservableObject`

Before `@Observable` (section 13.5/25.4), SwiftUI's original data-binding mechanism was Combine-based: `ObservableObject` plus `@Published` properties, which automatically emit through a synthesized `objectWillChange` publisher whenever a `@Published` property changes.

```swift
class OldStyleViewModel: ObservableObject {
    @Published var username: String = ""
    @Published var isLoggedIn: Bool = false
}
```

This pairing is covered in depth for legacy literacy in section 25.12, since it remains extremely common in existing SwiftUI codebases — every `@Published` property change triggers `objectWillChange` to fire, which SwiftUI observes (via `@StateObject`/`@ObservedObject`) to know when to re-render a view, a coarser-grained mechanism than `@Observable`'s per-property tracking (recall the comparison in section 14.20/25.13).

---

## 22.10 Migrating Combine Code to Async/Await

Combine publishers can be bridged into async/await using the `values` property, which exposes a publisher as an `AsyncSequence` — letting you gradually migrate Combine-based code to `for await` without rewriting the underlying publisher chain all at once.

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

For simpler cases — a single `@Published` property you want to observe with `for await` rather than `.sink` — the same `.values` bridge applies directly: `for await value in viewModel.$username.values { ... }`. This bridging is a common, practical stepping stone during incremental migration away from Combine, letting new code consume existing Combine publishers idiomatically without a disruptive, all-at-once rewrite.

---

## 22.11 Migrating GCD Code to Structured Concurrency

Migrating GCD-based code follows a fairly direct mapping onto Swift Concurrency's equivalents, letting you replace manual, unstructured patterns with their structured counterparts largely one-to-one:

```swift
// GCD: background work, then hop back to main
DispatchQueue.global().async {
    let result = performExpensiveComputation()
    DispatchQueue.main.async {
        updateUI(with: result)
    }
}

// Structured concurrency equivalent:
Task {
    let result = await Task.detached {
        performExpensiveComputation()
    }.value
    await MainActor.run {
        updateUI(with: result)
    }
}

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

The broader pattern across this whole migration: GCD's manual thread/queue management and `DispatchGroup`'s manual enter/leave bookkeeping become largely unnecessary once replaced with `Task`, `async let`, task groups, and actors — the same underlying goals (background work, coordinated waiting, mutual exclusion) are achieved with compiler-enforced structure instead of manual discipline, which is precisely the throughline connecting this entire section back to sections 17–20.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| GCD queues | Serial vs. concurrent; `.main` is the serial queue tied to the main thread, now largely superseded by `@MainActor` |
| QoS classes | GCD's priority hint system, conceptually predating Swift Concurrency's task priority |
| `DispatchGroup`/barriers | Manual multi-task completion tracking and exclusive-access work items — `withTaskGroup`/actors now do this more safely |
| `OperationQueue` | Higher-level GCD abstraction supporting explicit dependencies between units of work |
| `NSLock`/`os_unfair_lock` | Manual mutual exclusion — actors and `Mutex` are the modern, safer replacements |
| Deadlock/priority inversion | Classic GCD failure modes; structured concurrency makes many of them structurally harder to write |
| Combine publishers/subscribers | Push-based reactive streams predating `AsyncSequence`; `sink` receives emitted values |
| Combine operators | `map`/`filter`/`debounce` and more — the vocabulary async-algorithms later adopted directly |
| `@Published`/`ObservableObject` | SwiftUI's original Combine-based observation mechanism, predating `@Observable` |
| Migrating Combine | `.values` bridges a publisher into an `AsyncSequence`, enabling gradual, incremental migration |
| Migrating GCD | `Task`/`async let`/task groups/actors largely replace manual queue and `DispatchGroup` choreography |

**This concludes Part 2 — Concurrency (Sections 17–22).** Next up: Part 3 — SwiftUI, starting with Section 23, SwiftUI Fundamentals.
