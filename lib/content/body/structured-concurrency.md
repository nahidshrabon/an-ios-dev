*Estimated read time: ~30 minutes*

---

## 18.1 What "Structured" Means and Why It Matters

"Structured" concurrency means a child task's lifetime is strictly bounded by the scope that created it — a parent function cannot return (or otherwise complete) until all the child tasks it spawned have either finished or been cancelled and unwound. This is a deliberate contrast to `Task.detached` (recall 17.9) or older, unstructured mechanisms like a bare `DispatchQueue.async` call, where a spawned unit of work has no enforced relationship to its creator's lifetime at all.

```swift
func loadDashboard() async {
    async let user = fetchUser()          // child task begins
    async let posts = fetchPosts()         // child task begins
    let (loadedUser, loadedPosts) = await (user, posts)
    // loadDashboard() cannot return before both child tasks have completed —
    // their lifetimes are strictly *structured* within this function's scope
    print(loadedUser, loadedPosts)
}
```

This structural guarantee is what makes error propagation, cancellation, and reasoning about a task's lifetime tractable — a parent's cancellation automatically propagates down to every structured child, and there's never a "leaked," orphaned task with no relationship to anything that spawned it, unlike careless use of manually-managed threads or dispatch queues.

---

## 18.2 `async let` for Parallel Work

`async let` starts a child task immediately, running concurrently with the rest of the function, and lets you `await` its result later — ideal for a small, fixed number of independent async operations you want to run in parallel rather than sequentially.

```swift
func fetchUserData() async throws -> String { "User data" }
func fetchSettingsData() async throws -> String { "Settings data" }

func loadEverything() async throws {
    async let user = fetchUserData()        // starts running immediately, concurrently
    async let settings = fetchSettingsData() // also starts running immediately, concurrently

    let (userResult, settingsResult) = try await (user, settings)
    print(userResult, settingsResult)
}
```

Compare this to sequential `await`s, which would run one after the other, taking the *sum* of both durations rather than roughly the *maximum* of the two:

```swift
// Sequential — slower: total time ≈ fetchUserData's time + fetchSettingsData's time
let user = try await fetchUserData()
let settings = try await fetchSettingsData()

// Parallel via async let — faster: total time ≈ max(fetchUserData's time, fetchSettingsData's time)
async let userP = fetchUserData()
async let settingsP = fetchSettingsData()
let (u, s) = try await (userP, settingsP)
```

---

## 18.3 `withTaskGroup` Basics

`async let` works well for a small, fixed number of parallel operations known at compile time, but for a **dynamic** number of parallel operations (e.g. one per item in an array whose size isn't known until runtime), `withTaskGroup` is the tool — it creates a scope in which you can add any number of child tasks, then iterate over their results as they complete.

```swift
func fetchTitles(for ids: [Int]) async -> [String] {
    await withTaskGroup(of: String.self) { group in
        for id in ids {
            group.addTask {
                await fetchTitle(for: id)   // one child task per id, all running concurrently
            }
        }

        var titles: [String] = []
        for await title in group {          // collect results as each task completes
            titles.append(title)
        }
        return titles
    }
}

func fetchTitle(for id: Int) async -> String { "Title \(id)" }
```

`withTaskGroup` follows the same structured concurrency rule as `async let`: the function doesn't return until every child task added to the group has completed — you can't "leak" a task group child outside the closure's scope.

---

## 18.4 `withThrowingTaskGroup` and Error Propagation

`withThrowingTaskGroup` is the throwing variant, used when child tasks might fail — if any child task throws, that error propagates out of the group (and the remaining, still-running child tasks are automatically cancelled):

```swift
func fetchAllTitles(for ids: [Int]) async throws -> [String] {
    try await withThrowingTaskGroup(of: String.self) { group in
        for id in ids {
            group.addTask {
                try await fetchTitleOrThrow(for: id)
            }
        }

        var titles: [String] = []
        for try await title in group {
            titles.append(title)
        }
        return titles
    }
}

func fetchTitleOrThrow(for id: Int) async throws -> String {
    guard id > 0 else { throw NetworkError.notFound }
    return "Title \(id)"
}
```

This "first error cancels the rest" behavior mirrors `async let`'s own error propagation: if either concurrent operation in an `async let` pair throws, awaiting the pair propagates that error and implicitly cancels whichever sibling hadn't finished yet — structured concurrency ensures a failure doesn't leave orphaned, still-running work behind.

---

## 18.5 Collecting Task Group Results in Order

A task group's `for await`/`for try await` loop yields results in **completion order**, not the order tasks were added — if preserving the original order matters, you need to explicitly track and re-sort by an index or identifier:

```swift
func fetchTitlesInOrder(for ids: [Int]) async -> [String] {
    await withTaskGroup(of: (Int, String).self) { group in
        for (index, id) in ids.enumerated() {
            group.addTask {
                (index, await fetchTitle(for: id))   // tag each result with its original index
            }
        }

        var results: [(Int, String)] = []
        for await result in group {
            results.append(result)
        }

        return results.sorted { $0.0 < $1.0 }.map { $0.1 }   // re-sort by original index
    }
}
```

This is a common, easy-to-miss gotcha: unlike `async let`'s tuple-based `await (user, settings)`, which preserves each binding's own identity, a task group's completions arrive in whatever order the underlying work actually finishes — usually *not* the order you added them, especially when individual tasks take varying amounts of time.

---

## 18.6 `DiscardingTaskGroup`

`DiscardingTaskGroup` (and its throwing counterpart, `ThrowingDiscardingTaskGroup`) is a variant for when you need to run many child tasks concurrently purely for their **side effects**, with no results to actually collect — it avoids the memory overhead of buffering child task results you'd never consume anyway.

```swift
func processAllItems(_ items: [Item]) async {
    await withDiscardingTaskGroup { group in
        for item in items {
            group.addTask {
                await process(item)   // side effect only — no meaningful return value to collect
            }
        }
        // no need to iterate results; the group simply waits for all tasks to finish
    }
}
```

A regular `withTaskGroup` still technically supports `Void`-returning tasks, but `DiscardingTaskGroup` is specifically optimized for exactly this pattern — many fire-and-forget-style concurrent operations — discarding each task's completion immediately rather than retaining any bookkeeping for a result that will never be read.

---

## 18.7 Cancellation Is Cooperative

Task cancellation in Swift Concurrency is **cooperative**, not preemptive — calling `task.cancel()` (or a parent task being cancelled, which propagates to its structured children) merely *marks* the task as cancelled; it does not forcibly stop its execution. The task itself must actively check for cancellation and choose to stop.

```swift
func longRunningWork() async {
    for i in 0..<1_000_000 {
        // without an explicit check, this loop simply ignores cancellation entirely
        // and keeps running to completion regardless of any cancel() call
        performStep(i)
    }
}

func performStep(_ i: Int) { }
```

This is a deliberate design choice: forcibly, preemptively terminating a task mid-execution (as some other cancellation models do) risks leaving shared state in a corrupted, half-updated condition. Cooperative cancellation instead trusts the task's own code to notice the cancellation flag and unwind cleanly at a safe point — which means cancellation only actually *works* if code is written to check for it (see 18.8).

---

## 18.8 `Task.isCancelled` and `checkCancellation()`

Two APIs let a task's own code respond to cancellation: `Task.isCancelled` is a simple boolean check you can inspect at any convenient point (useful inside a loop, to break out gracefully); `Task.checkCancellation()` throws a `CancellationError` immediately if the task has been cancelled, useful in `throws` contexts where propagating that error upward is the natural response.

```swift
func longRunningWork() async {
    for i in 0..<1_000_000 {
        if Task.isCancelled {
            print("Cancelled — stopping early at step \(i)")
            return
        }
        performStep(i)
    }
}

func longRunningThrowingWork() async throws {
    for i in 0..<1_000_000 {
        try Task.checkCancellation()   // throws CancellationError if cancelled, propagating naturally
        performStep(i)
    }
}
```

Many standard-library async APIs (like `Task.sleep`, recall 17.6) already check cancellation internally and throw automatically — but any custom long-running work you write yourself needs one of these two checks sprinkled at reasonable intervals (inside loops, between major steps) to actually honor cancellation requests rather than silently ignoring them.

---

## 18.9 `withTaskCancellationHandler`

`withTaskCancellationHandler` lets you register a synchronous closure that runs **immediately** the moment cancellation occurs — useful for wrapping non-async, non-cancellation-aware work (like a callback-based API) with cleanup logic that fires right away, rather than waiting for the wrapped operation's own code to eventually notice `Task.isCancelled`.

```swift
func fetchWithCancellationSupport() async throws -> String {
    try await withTaskCancellationHandler {
        try await withCheckedThrowingContinuation { continuation in
            let request = startLegacyNetworkRequest { result in
                continuation.resume(with: result)
            }
            // if cancellation happens, onCancel fires immediately, even while
            // the legacy request is still technically in flight
        }
    } onCancel: {
        // runs synchronously and immediately upon cancellation — cancel the underlying legacy request here
        print("Cancelling the underlying legacy request")
    }
}
```

This is especially valuable when bridging to callback-based APIs (see 18.11) that have no native concept of Swift Concurrency's cancellation at all — `onCancel` gives you a reliable hook to translate a `Task`'s cancellation into whatever cancellation mechanism the underlying legacy API actually provides (like calling its own `.cancel()` method).

---

## 18.10 Task-Local Values with `@TaskLocal`

`@TaskLocal` provides values that are implicitly available to a task and all of its structured children, without needing to be threaded explicitly through every function's parameter list — conceptually similar to thread-local storage, but scoped to Swift Concurrency's task hierarchy instead of an OS thread.

```swift
enum RequestContext {
    @TaskLocal static var requestID: String?
}

func logMessage(_ message: String) {
    print("[\(RequestContext.requestID ?? "no-id")] \(message)")
}

func handleRequest() async {
    await RequestContext.$requestID.withValue("abc-123") {
        await processRequest()   // requestID is implicitly available here and in any child tasks
    }
}

func processRequest() async {
    logMessage("Processing")   // "[abc-123] Processing" — reads the task-local value implicitly
}
```

A common real use is threading a request ID or trace identifier through a deeply-nested chain of async calls (for logging or diagnostics) without needing to add an explicit parameter to every single function signature along the way — the value is automatically inherited by structured child tasks created within the `withValue` scope (recall this contrasts with `Task.detached`, which does *not* inherit task-local values, as noted in section 17.9).

---

## 18.11 Bridging Callbacks with `withCheckedContinuation`

Not all APIs are async-native — many older, completion-handler-based APIs (especially from Objective-C-based frameworks) need to be bridged into async/await. `withCheckedContinuation` (for non-throwing callbacks) and `withCheckedThrowingContinuation` (for callbacks that can produce an error) wrap exactly one callback invocation into a single `await`-able call.

```swift
func legacyFetchUser(id: Int, completion: @escaping (String?, Error?) -> Void) {
    // an older, completion-handler-based API you don't control
}

func fetchUser(id: Int) async throws -> String {
    try await withCheckedThrowingContinuation { continuation in
        legacyFetchUser(id: id) { user, error in
            if let error {
                continuation.resume(throwing: error)
            } else if let user {
                continuation.resume(returning: user)
            } else {
                continuation.resume(throwing: NetworkError.notFound)
            }
        }
    }
}
```

The "checked" in the name means Swift performs a runtime check ensuring `resume` is called *exactly once* — this is precisely the safety net protecting against the misuse patterns covered next in 18.12, at a small runtime cost; `withUnsafeContinuation`/`withUnsafeThrowingContinuation` skip that check entirely for a small performance gain, at the cost of losing that safety net.

---

## 18.12 Continuation Misuse: Double Resume and Leaks

A continuation's contract is strict: `resume` must be called **exactly once** — never zero times, never more than once. Violating this produces one of two failure modes, both of which the "checked" continuation variants actively detect and report (typically as a runtime warning or crash, rather than silent corruption).

```swift
func brokenDoubleResume(completion: @escaping (Int?, Error?) -> Void) {
    completion(1, nil)
    completion(2, nil)   // called the completion handler twice — a bug in the *underlying* callback API
}

func fetchValue() async -> Int? {
    await withCheckedContinuation { continuation in
        brokenDoubleResume { value, _ in
            continuation.resume(returning: value)   // 💥 runtime warning: "SWIFT TASK CONTINUATION MISUSE" —
                                                        // resume() called more than once
        }
    }
}
```

Calling `resume` **zero times** is just as serious a bug, though less immediately obvious: the awaiting task simply hangs forever, suspended indefinitely, waiting for a resume that will never come — a **task leak** with no crash or warning to signal it, only a silently stuck task. This is exactly why `withCheckedContinuation`'s runtime double-resume detection is valuable during development: it's one of the few safety nets available for a fundamentally manual, easy-to-get-wrong bridging pattern, making it critical to trace every possible completion path of the wrapped legacy API (success, failure, and any early-return/cancellation paths) to guarantee `resume` fires exactly once on all of them.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Structured concurrency | A child task's lifetime is strictly bounded by its creating scope — no orphaned, unstructured work |
| `async let` | Starts a fixed, small number of child tasks immediately, running in parallel rather than sequentially |
| `withTaskGroup` | Dynamic-count parallel child tasks; the function can't return until all group children finish |
| `withThrowingTaskGroup` | Throwing variant — one child's error propagates out and cancels the remaining siblings |
| Ordering task group results | Completions arrive in finish order, not add order — tag with an index to preserve original order |
| `DiscardingTaskGroup` | Optimized for many fire-and-forget child tasks whose results are never actually read |
| Cooperative cancellation | `cancel()` only marks a task — it doesn't forcibly stop it; the task must check and respond itself |
| `Task.isCancelled`/`checkCancellation()` | The two APIs for responding to cancellation — boolean check vs. throwing check |
| `withTaskCancellationHandler` | Registers an immediate, synchronous callback that fires the instant cancellation occurs |
| `@TaskLocal` | Implicitly-inherited values across a task's structured children, without explicit parameter threading |
| `withCheckedContinuation` | Bridges a single legacy callback invocation into one `await`-able call, with runtime misuse detection |
| Continuation misuse | `resume` must fire exactly once — zero times leaks a hung task, more than once triggers a runtime warning |

**Next up:** Section 19 — Actors and Isolation.
