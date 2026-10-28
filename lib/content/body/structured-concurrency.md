**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 18.1 What "Structured" Means and Why It Matters 🟢

**Structured concurrency** means a **child task** can't live longer than the **scope that created it**. A parent function **can't return** until all its child tasks have **finished** (or were cancelled and cleaned up).

Compare with **unstructured** work: `Task.detached` (17.9), or an old `DispatchQueue.async` call. That work has **no link** to whoever started it.

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

```plaintext
loadDashboard()  ─────────────────────────────────┐
   ├─ child: fetchUser()   ───────┐                │
   └─ child: fetchPosts()  ──────────────┐         │
                                  done   done   returns
```

**Why this matters:**

- **Cancellation flows down.** Cancel the parent, and all its children are cancelled too.
- **Errors flow up.** A child's error reaches the parent, like a normal function call.
- **No leaks.** A child task can never be "forgotten" and keep running after its parent is gone.

It's the same idea as structured code with `if` and `for`: a block finishes before the code after it runs. Here it applies to concurrent work.

---

## 18.2 `async let` for Parallel Work 🟢

**`async let`** starts a **child task right away**. It runs **at the same time** as the rest of your function, and you `await` its result **later**. It's ideal for a **small, fixed** number of independent operations:

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

Compare with plain `await`s **one after another**. The total time is the **sum**, instead of about the **longest one**:

```swift
// Sequential — slower: total time ≈ fetchUserData's time + fetchSettingsData's time
let user = try await fetchUserData()
let settings = try await fetchSettingsData()

// Parallel via async let — faster: total time ≈ max(fetchUserData's time, fetchSettingsData's time)
async let userP = fetchUserData()
async let settingsP = fetchSettingsData()
let (u, s) = try await (userP, settingsP)
```

```plaintext
Sequential:  [ user: 1s ][ settings: 1s ]           = 2s
async let:   [ user: 1s ]
             [ settings: 1s ]                        = 1s
```

Rules to know:

- Use `async let` only when the operations are **independent**. If B needs A's result, they must run in order.
- If you **never await** an `async let`, Swift **cancels** it and waits for it when the scope ends. So it can't leak.
- The `try` goes at the **`await`**, not at the `async let` line.

A real screen that needs three things at once:

```swift
@MainActor
func loadProfileScreen(id: Int) async throws {
    async let profile = api.profile(id: id)
    async let posts = api.posts(userID: id)
    async let followers = api.followerCount(userID: id)

    self.screen = try await ProfileScreen(profile: profile, posts: posts, followers: followers)
}
```

---

## 18.3 `withTaskGroup` Basics 🟡

`async let` is for a **fixed** number of tasks, known when you write the code. For a **dynamic** number (one per item in an array whose size you only know at runtime), use **`withTaskGroup`**. Inside it, you add any number of child tasks, then read their results as they finish:

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

The same **structured** rule applies: `withTaskGroup` doesn't return until **every** child task has finished. Children can't escape the closure.

| | `async let` | Task group |
|---|---|---|
| Number of tasks | Fixed, written in code | Any number, decided at runtime |
| Result types | Each can differ | All the same type |
| Best for | "Load these 3 things" | "Load one thing per item" |

**Limit how many run at once** when the list is big, so you don't start 1,000 downloads together:

```swift
func downloadAll(_ urls: [URL], maxConcurrent: Int = 4) async -> [Data] {
    await withTaskGroup(of: Data?.self) { group in
        var results: [Data] = []
        var iterator = urls.makeIterator()

        for _ in 0..<maxConcurrent {                     // start the first few
            if let url = iterator.next() {
                group.addTask { try? await URLSession.shared.data(from: url).0 }
            }
        }
        for await data in group {                        // each time one finishes...
            if let data { results.append(data) }
            if let url = iterator.next() {               // ...start the next one
                group.addTask { try? await URLSession.shared.data(from: url).0 }
            }
        }
        return results
    }
}
```

---

## 18.4 `withThrowingTaskGroup` and Error Propagation 🟡

**`withThrowingTaskGroup`** is the version for child tasks that can **fail**:

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

How the error travels:

1. A child throws. Its error waits in the group.
2. `for try await` receives it and **rethrows** it.
3. The error leaves the group's closure, so the group **cancels all remaining children**, waits for them to stop, and then rethrows the error to the caller.

**"First error cancels the rest."** `async let` works the same way: when an error leaves the scope, unfinished siblings are cancelled. A failure never leaves orphaned work running.

If you'd rather **keep going** when one item fails, catch errors **inside** each child:

```swift
let titles = await withTaskGroup(of: String?.self) { group in
    for id in ids {
        group.addTask { try? await fetchTitleOrThrow(for: id) }   // a failure becomes nil
    }
    var results: [String] = []
    for await title in group {
        if let title { results.append(title) }
    }
    return results          // all the titles that worked
}
```

---

## 18.5 Collecting Task Group Results in Order 🟡

A task group gives results in **completion order**: whichever finishes **first** comes first. That's usually **not** the order you added them. If order matters, **tag** each result with its index and **sort** at the end:

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

```plaintext
Added:     id 1 (slow)   id 2 (fast)   id 3 (medium)
Finished:  id 2   →   id 3   →   id 1        ← the order `for await` gives you
Sorted:    id 1,  id 2,  id 3                ← after sorting by index
```

A dictionary works too, when items have IDs:

```swift
var byID: [Int: String] = [:]
for await (id, title) in group {
    byID[id] = title
}
let ordered = ids.compactMap { byID[$0] }
```

This is an easy bug to miss: in testing, tasks often finish in order **by chance**, and the bug only appears with real network delays. `async let` doesn't have this problem, because each result has its **own name**.

---

## 18.6 `DiscardingTaskGroup` 🔴

**`withDiscardingTaskGroup`** (and the throwing version, `withThrowingDiscardingTaskGroup`) is for running many child tasks **only for their side effects**, with **no results** to collect. It **frees each child as soon as it finishes**, instead of keeping results you'll never read.

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

It shines for **long-running** loops that keep adding tasks, like a server handling connections forever. A normal task group would keep a record of every finished child until you read it; that memory would grow and grow.

```swift
func runServer(listener: Listener) async throws {
    try await withThrowingDiscardingTaskGroup { group in
        for try await connection in listener.connections {
            group.addTask {
                try await handle(connection)    // each finished connection is freed right away
            }
        }
    }
}
```

In the **throwing** discarding group, if any child throws, the group **cancels the others** and rethrows, even though you never iterate results.

---

## 18.7 Cancellation Is Cooperative 🟢

Cancellation in Swift concurrency is **cooperative**. Calling `task.cancel()` (or cancelling a parent, which reaches its children) only **marks** the task as cancelled. It does **not** stop the task by force. The task's own code must **check** and **choose** to stop.

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

**Why not stop tasks by force?** Killing a task in the middle of its work could leave data **half-updated** and broken. Cooperative cancellation lets the task stop at a **safe point**, and clean up properly.

The flip side: cancellation **only works if your code checks for it** (18.8).

What cancels a task:

```swift
let task = Task { await longRunningWork() }
task.cancel()                       // 1. you call cancel()

// 2. the parent is cancelled → all its structured children are cancelled
// 3. SwiftUI's .task modifier cancels when the view disappears
// 4. A throwing task group cancels the rest when one child fails (18.4)
```

---

## 18.8 `Task.isCancelled` and `checkCancellation()` 🟢

Two ways for a task to **react** to cancellation:

- **`Task.isCancelled`**: a `Bool`. Check it anywhere, and stop in your own way (return early, return partial results).
- **`try Task.checkCancellation()`**: **throws** `CancellationError` if cancelled. Natural in `throws` functions: the error flows up like any other.

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

Many system async APIs **already check** for you, and throw when cancelled: `Task.sleep` (17.6), `URLSession`'s async methods, and more. But your **own** long-running work needs these checks, in loops and between big steps.

**Don't show cancellation as an error** to the user. The user (or the system) asked to stop; that's not a failure:

```swift
do {
    results = try await search(query)
} catch is CancellationError {
    // the user typed again or left the screen: do nothing
} catch {
    errorMessage = "Search failed."
}
```

(`URLSession` reports cancellation as `URLError(.cancelled)`. Handle that too.)

---

## 18.9 `withTaskCancellationHandler` 🔴

**`withTaskCancellationHandler`** registers an `onCancel` closure that runs **immediately** when the task is cancelled. That's useful for work that **doesn't check** `Task.isCancelled` itself, like an old callback-based API with its own `cancel()` method.

```swift
final class LegacyRequestBox: Sendable {
    let request = Mutex<LegacyRequest?>(nil)     // onCancel runs on another thread, so protect it
}

func download(_ url: URL) async throws -> Data {
    let box = LegacyRequestBox()

    return try await withTaskCancellationHandler {
        try await withCheckedThrowingContinuation { continuation in
            let request = LegacyDownloader.start(url) { result in
                continuation.resume(with: result)        // the legacy API reports success or failure
            }
            box.request.withLock { $0 = request }
        }
    } onCancel: {
        // runs right away when the task is cancelled, even mid-download
        box.request.withLock { $0?.cancel() }            // the legacy request then fails with an error
    }
}
```

Notes:

- `onCancel` can run **at the same time** as your other code, on another thread. Anything it touches must be **thread-safe** (here, a `Mutex`, 14.21).
- If the task was **already** cancelled, `onCancel` runs **immediately**, before the main closure even starts.
- `onCancel` should be **quick**: just tell the underlying work to stop.

This is the bridge between Swift's cancellation and **whatever cancellation the old API has** (its `.cancel()` method). Together with continuations (18.11), you can wrap old APIs into **fully cancellable** async functions.

---

## 18.10 Task-Local Values with `@TaskLocal` 🔴

**`@TaskLocal`** gives a value that is **automatically available** to a task and **all its child tasks**, without passing it through every function's parameters. It's like thread-local storage, but follows the **task tree** instead of an OS thread.

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

The value is set **only inside** `withValue { }`. Outside, it goes back to the old value:

```swift
await handleRequest()     // logs "[abc-123] Processing"
logMessage("After")       // logs "[no-id] After"
```

Who sees the value:

| | Inherits task-local values? |
|---|---|
| Child tasks (`async let`, task groups) | ✅ Yes |
| `Task { }` | ✅ Yes (copied when created) |
| `Task.detached { }` | ❌ No (17.9) |

A typical use: a **request ID** or **trace ID** for logs, through a deep chain of async calls (see distributed tracing, 80.9), without adding a parameter to every function.

**Don't overuse it.** Hidden inputs make code harder to follow. For normal dependencies, pass them explicitly (section 47).

---

## 18.11 Bridging Callbacks with `withCheckedContinuation` 🟡

Not every API is async. Many older APIs use **completion handlers**. A **continuation** turns **one callback** into **one `await`**:

- **`withCheckedContinuation`**: for callbacks that **can't fail**.
- **`withCheckedThrowingContinuation`**: for callbacks that can return an **error**.

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

```plaintext
fetchUser(id:)  →  suspends at withChecked...Continuation
                     legacyFetchUser runs, calls back later
                   continuation.resume(...)  →  fetchUser continues with the value or error
```

If the API already uses `Result`, it's one line:

```swift
continuation.resume(with: result)    // Result<Value, Error> → value or thrown error
```

**"Checked"** means Swift checks **at runtime** that you call `resume` **exactly once** (18.12). The `withUnsafeContinuation` versions skip that check for a tiny speed gain. Use the **checked** ones unless you've measured a real need.

A continuation fits **one-time** callbacks. For callbacks that fire **many times** (location updates, progress), use an `AsyncStream` instead (section 21).

---

## 18.12 Continuation Misuse: Double Resume and Leaks 🔴

A continuation has a strict rule: call **`resume` exactly once**. Never zero times, never twice.

**Twice** is a crash. The checked continuation stops the app with a clear message:

```swift
func brokenDoubleResume(completion: @escaping (Int?, Error?) -> Void) {
    completion(1, nil)
    completion(2, nil)   // called the completion handler twice — a bug in the *underlying* callback API
}

func fetchValue() async -> Int? {
    await withCheckedContinuation { continuation in
        brokenDoubleResume { value, _ in
            continuation.resume(returning: value)   // 💥 crash on the 2nd call:
                                                    // "SWIFT TASK CONTINUATION MISUSE ... tried to resume its continuation more than once"
        }
    }
}
```

**Zero times** is just as bad, but quieter. The waiting task **hangs forever**: it's suspended, waiting for a `resume` that never comes. This is a **task leak**. A checked continuation prints a warning (`"... leaked its continuation"`) when it's thrown away without being resumed, but nothing crashes, and the screen just keeps spinning.

The usual cause is a **forgotten path**:

```swift
legacyFetchUser(id: id) { user, error in
    if let user {
        continuation.resume(returning: user)
    } else if let error {
        continuation.resume(throwing: error)
    }
    // ❌ user == nil && error == nil → no resume → the task hangs forever
}
```

**How to stay safe:**

1. Trace **every** path of the callback: success, failure, "neither", cancellation.
2. End with an `else` that **always** resumes (as in 18.11).
3. If the API might call back **more than once**, guard against it, or use `AsyncStream`.

```swift
// Guard for APIs that may call back more than once
var didResume = false
legacyAPI { value in
    guard !didResume else { return }
    didResume = true
    continuation.resume(returning: value)
}
```

(That simple flag is only safe if the API always calls back on the **same** thread or queue. Otherwise, protect it with a lock.)

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Structured concurrency | Children can't outlive their parent; cancellation flows down, errors flow up |
| `async let` | A few independent tasks in parallel; total time ≈ the slowest one |
| `withTaskGroup` | Any number of child tasks; limit how many run at once for big lists |
| `withThrowingTaskGroup` | A rethrown child error cancels the rest; catch inside a child to keep going |
| Ordering task group results | Results come in finish order; tag with an index to restore order |
| `DiscardingTaskGroup` | For side-effect-only children; frees each one as it finishes |
| Cooperative cancellation | `cancel()` only marks the task; your code must check and stop |
| `Task.isCancelled`/`checkCancellation()` | Check with a `Bool`, or throw `CancellationError` |
| `withTaskCancellationHandler` | Runs `onCancel` right away; connect it to an old API's `cancel()` |
| `@TaskLocal` | Values inherited by child tasks, like a request ID for logs |
| `withCheckedContinuation` | Turn one callback into one `await` |
| Continuation misuse | Resume exactly once: twice crashes, zero times hangs forever |
