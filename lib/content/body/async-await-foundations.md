**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 17.1 The Callback Problem Async/Await Solves 🟢

Before async/await, asynchronous work in Swift used **completion handlers**: a function didn't return its result. Instead, it called a **closure later**, when the work was done:

```swift
func fetchUser(id: Int, completion: @escaping (User?, Error?) -> Void) {
    URLSession.shared.dataTask(with: userURL(for: id)) { data, response, error in
        // ... parse data, call completion(user, nil) or completion(nil, error) ...
    }.resume()
}

func fetchUserProfile(id: Int, completion: @escaping (Profile?, Error?) -> Void) {
    fetchUser(id: id) { user, error in
        guard let user else { completion(nil, error); return }
        fetchProfile(for: user) { profile, error in
            completion(profile, error)
        }
    }
}
```

The problems:

- **The "pyramid":** every extra step nests one level deeper.
- **Error handling repeats** on every level, and is easy to get wrong.
- **No guarantee** the completion is called: forget it on one path, and the caller waits **forever**. Call it twice, and you get odd bugs.

**Async/await** (Swift 5.5) replaces this with code that **reads top to bottom**, but is still truly asynchronous:

```swift
func fetchUserProfile(id: Int) async throws -> Profile {
    let user = try await fetchUser(id: id)
    let profile = try await fetchProfile(for: user)
    return profile
}
```

Errors use normal `throw`/`catch`, and the compiler **guarantees** a value is returned (or an error thrown) on every path.

Many Apple APIs have async versions already:

```swift
let (data, response) = try await URLSession.shared.data(from: url)
let image = await UIImage(data: data)?.byPreparingForDisplay()
```

---

## 17.2 Writing and Calling an `async` Function 🟢

Mark a function **`async`** when it can **pause** while waiting, **without blocking** a thread. Every call to it needs **`await`**, just like `throws` needs `try` (9.2):

```swift
func fetchWeather(for city: String) async -> String {
    // pretend this does real asynchronous network work
    "Sunny in \(city)"
}

func showWeather() async {
    let weather = await fetchWeather(for: "London")
    print(weather)   // "Sunny in London"
}
```

**`await` marks a possible pause.** It doesn't promise the function **will** pause, only that it **might**. That's useful when reading code: **other code can run during the pause**, so state may have changed when you continue:

```swift
@MainActor
class CartViewModel {
    var items: [String] = []

    func addAfterCheck(_ item: String) async {
        let isAvailable = await inventory.check(item)   // a pause: other code may change `items` here
        if isAvailable {
            items.append(item)                          // `items` may be different from before the await
        }
    }
}
```

Properties can be async too, with an `async` getter:

```swift
struct RemoteImage {
    let url: URL
    var data: Data {
        get async throws {
            try await URLSession.shared.data(from: url).0
        }
    }
}

let bytes = try await RemoteImage(url: url).data
```

You can only call `async` functions from an **async context**: another `async` function, a `Task` (17.5), or SwiftUI's `.task` modifier.

---

## 17.3 What `await` Actually Does at a Suspension Point 🟡

`await` is **not** "block and wait". It's a **suspension point**. If the called function really has to wait (for the network, a timer, another task), the calling function is **suspended**, and its **thread is freed** to do other work in the meantime.

```swift
func slowOperation() async -> Int {
    try? await Task.sleep(for: .seconds(2))   // suspension point: thread is freed during this wait
    return 42
}

func caller() async {
    print("Before")
    let result = await slowOperation()   // this line suspends caller(), doesn't block a thread
    print("After: \(result)")
}
```

```plaintext
Thread A:  caller() starts → reaches await → suspends → [Thread A runs other tasks...]
                                                    ... 2 seconds later ...
Thread A or B:                            caller() resumes → prints "After: 42"
```

When `caller()` continues, it may run on a **different thread** than before, unless it's tied to an actor. Code on the **main actor** always resumes on the **main thread**:

```swift
@MainActor
func refresh() async {
    let items = await api.loadItems()   // may wait on the network...
    self.items = items                  // ...but this line is back on the main thread
}
```

**The key difference from old blocking I/O:** a suspended function **doesn't hold a thread** while it waits. So thousands of waiting tasks are cheap, while thousands of blocked threads are not.

---

## 17.4 `async` + `throws` Together 🟢

A function can be **both** `async` and `throws`. Then the call needs **both** keywords, written **`try await`**:

```swift
enum NetworkError: Error {
    case notFound
}

func fetchUser(id: Int) async throws -> String {
    guard id == 1 else { throw NetworkError.notFound }
    return "Alice"
}

func loadUser() async {
    do {
        let user = try await fetchUser(id: 2)
        print(user)
    } catch {
        print("Failed: \(error)")   // "Failed: notFound"
    }
}
```

The order in the **declaration** is `async throws`; at the **call** it's `try await`.

```swift
func load() async throws -> Data          // declaration: async, then throws
let data = try await load()               // call: try, then await
```

This pair is **very common**: real async work (network, disk, database) can also **fail**. A typical view model method looks like this:

```swift
@MainActor
@Observable
final class ProfileViewModel {
    var profile: Profile?
    var errorMessage: String?

    func load(id: Int) async {
        do {
            profile = try await fetchUserProfile(id: id)
        } catch {
            errorMessage = "Couldn't load the profile."
        }
    }
}
```

---

## 17.5 `Task { }` — Entering Async from Sync Code 🟢

Normal **synchronous** code (a button action, an `init`, a delegate method) **can't use `await`**. **`Task { }`** is the bridge: it starts a **new asynchronous task**, so sync code can kick off async work without becoming `async` itself.

```swift
struct ContentView: View {
    var body: some View {
        Button("Load") {
            // this closure is NOT async, but Task { } lets it start async work
            Task {
                let profile = try? await fetchUserProfile(id: 1)
                print(profile as Any)
            }
        }
    }
}
```

`Task { }` **returns right away**. It doesn't wait for the work to finish. The code inside runs **concurrently**, and inherits the **priority** and (usually) the **actor** of the place that created it.

```swift
Button("Save") {
    print("1")
    Task {
        await save()
        print("3")      // later, after saving
    }
    print("2")          // right away
}
// prints 1, 2, then 3
```

You can keep the task to **cancel** it, or to **wait for its result** from async code:

```swift
let task = Task { try await fetchUserProfile(id: 1) }
// ...
task.cancel()                          // ask it to stop (section 18.7)
let profile = try await task.value     // or wait for the result
```

In SwiftUI, prefer the **`.task` modifier** for work tied to a view. It starts when the view appears, and is **cancelled automatically** when the view goes away:

```swift
struct ProfileView: View {
    @State private var viewModel = ProfileViewModel()

    var body: some View {
        Text(viewModel.profile?.name ?? "Loading…")
            .task {
                await viewModel.load(id: 1)
            }
    }
}
```

---

## 17.6 `Task.sleep` and `Clock`-Based Waiting 🟢

**`Task.sleep(for:)`** pauses the current task for a while, using the `Duration` type (14.18). It's the async replacement for old blocking sleeps, and it's **non-blocking**: the thread is freed during the sleep.

```swift
func delayedGreeting() async {
    print("Waiting...")
    try? await Task.sleep(for: .seconds(2))
    print("Hello, after a 2-second delay!")
}
```

`Task.sleep` is **cancellable**. If the task is cancelled during the sleep, it stops early and **throws `CancellationError`** (more in 18.7–18.8). That's why it needs `try`.

A common real use: **debouncing** a search field, so you search only after the user stops typing:

```swift
.task(id: query) {                         // restarts whenever `query` changes
    try? await Task.sleep(for: .milliseconds(300))
    guard !Task.isCancelled else { return } // the user typed again: this task was cancelled
    await viewModel.search(query)
}
```

Each new keystroke **cancels** the previous task (and its sleep), so only the last one actually searches.

You can also sleep **until** a moment on a specific clock (14.18–14.19):

```swift
let clock = ContinuousClock()
let deadline = clock.now + .seconds(5)
try await Task.sleep(until: deadline, clock: clock)
```

---

## 17.7 The Cooperative Thread Pool Explained 🟡

Swift concurrency runs `async` code on a **cooperative thread pool**: a **small, fixed** set of threads, about **one per CPU core**. This is very different from GCD, which could create **many more threads** than cores under load ("thread explosion").

```swift
// Conceptually: with a cooperative thread pool sized to, say, 8 threads on an 8-core device,
// Swift Concurrency can efficiently run many more than 8 *tasks* concurrently — because tasks
// suspend and release their thread during any await, rather than each task permanently
// occupying its own dedicated thread for its entire lifetime, the way a traditional
// thread-per-task model would.
```

```plaintext
6 CPU cores → about 6 pool threads
1,000 tasks waiting on the network → still about 6 threads
(each waiting task holds no thread; it's just a small object in memory)
```

**"Cooperative"** is the key word. Many tasks **share** the few threads, and that only works if every task **gives its thread back** at each `await`. A task that does long **blocking** work keeps its thread, and the others can't use it. That's the danger in 17.8.

(The **main actor** is separate: it runs on the main thread, not on the pool.)

---

## 17.8 Why Blocking the Pool Is Dangerous 🔴

The pool is **small on purpose**. So code that **blocks** a pool thread (a blocking file read, `sleep()` or `Thread.sleep`, a busy loop, a lock held for a long time) can **starve the whole pool**. There are no spare threads to take over.

```swift
func badAsyncFunction() async {
    Thread.sleep(forTimeInterval: 5)   // ❌ BLOCKS a pool thread for 5 real seconds —
                                          // does NOT suspend; the thread is unavailable
                                          // to run any other task during this entire time
}

func goodAsyncFunction() async {
    try? await Task.sleep(for: .seconds(5))   // ✅ suspends properly, thread is released
}
```

With only a few pool threads, a few tasks running `badAsyncFunction()` at once can **freeze or even deadlock** the app: every pool thread is stuck, so **no** other task can run, not even ones that would finish instantly.

| Blocking (❌ in async code) | Async-friendly (✅) |
|---|---|
| `Thread.sleep(...)`, `sleep(...)` | `try await Task.sleep(for:)` |
| `Data(contentsOf: remoteURL)` | `try await URLSession.shared.data(from:)` |
| `semaphore.wait()` / `group.wait()` | `await` the work directly |
| A long-held lock | An actor (section 19) |

**The rule: never block inside `async` code.** If you **must** call a blocking API (an old C library, a slow synchronous file API), run it **off the pool**, on a GCD queue, and bridge back with a **continuation**:

```swift
private let fileQueue = DispatchQueue(label: "file-io")

func readHugeFile(at url: URL) async throws -> Data {
    try await withCheckedThrowingContinuation { continuation in
        fileQueue.async {
            do {
                let data = try Data(contentsOf: url)   // blocking, but on our own queue
                continuation.resume(returning: data)
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }
}
```

(Note: `Task.detached` does **not** help here. Detached tasks run on the **same** cooperative pool.)

---

## 17.9 `Task.detached` and When Not to Use It 🟡

**`Task.detached { }`** creates a task that does **not** inherit anything from where it was created: not the **priority**, not the **actor**, not **task-local values** (18.10). It's fully independent.

```swift
// Plain Task {} inherits context (priority, actor isolation) from where it's created:
@MainActor
func onButtonTap() {
    Task {
        // inherits @MainActor isolation from the calling context by default
        await updateUI()
    }
}

// Task.detached explicitly does NOT inherit that context:
func startBackgroundWork() {
    Task.detached(priority: .background) {
        // runs with no inherited actor isolation or priority — genuinely independent
        await performHeavyComputation()
    }
}
```

| | `Task { }` | `Task.detached { }` |
|---|---|---|
| Actor | Inherited (e.g. stays on `@MainActor`) | None |
| Priority | Inherited | Set explicitly or default |
| Task-local values | Inherited | Not inherited |
| Cancelled with its creator? | No | No |

**Guidance:** `Task.detached` is **rarely** right in app code. Losing the actor is easy to misuse, and code gets harder to reason about.

- To run **heavy work off the main actor**, a **`@concurrent`** or `nonisolated` async function (Swift 6.2, section 16.5) is usually clearer:

```swift
@concurrent
func makeThumbnail(from data: Data) async -> Data {
    // runs on the cooperative pool, not the main thread
    resize(data)
}

@MainActor
func onPhotoPicked(_ data: Data) async {
    thumbnail = await makeThumbnail(from: data)   // UI stays responsive
}
```

- For several child tasks, use **structured concurrency** (`async let`, task groups, section 18).

Use `Task.detached` only when you **deliberately** want a task with **no** inherited context.

---

## 17.10 Task Priority and Inheritance 🟡

Every task has a **priority**: `.high`, `.userInitiated`, `.medium`, `.utility`, `.low`, `.background`. When many tasks compete for the pool, the scheduler **prefers** higher priorities.

By default, a `Task { }` **inherits** its creator's priority. `Task.detached` uses the priority you give it.

```swift
Task(priority: .high) {
    await doImportantWork()
}

Task(priority: .background) {
    await doLowPriorityCleanup()
}

// A plain, unspecified Task {} inherits priority from its creation context:
@MainActor
func handleUserAction() {
    // this context typically has a priority appropriate to user-interactive work
    Task {
        await respondToUser()   // inherits that priority automatically
    }
}
```

| Priority | Use for |
|---|---|
| `.userInitiated` / `.high` | Work the user is **waiting for** right now |
| `.medium` | The default |
| `.utility` / `.low` | Longer work the user knows about (a download) |
| `.background` | Work the user doesn't see (cleanup, prefetching) |

Check the current priority inside a task:

```swift
Task(priority: .utility) {
    print(Task.currentPriority)   // .utility
}
```

Priority is a **hint**, not a strict order. A low-priority task still runs to completion eventually; it just goes later when threads are busy. Swift can also **raise** a task's priority automatically, for example when a high-priority task is **waiting** on it (priority escalation).

---

## Summary

| Topic | One-line takeaway |
|---|---|
| The callback problem | Nested completion handlers are hard to read and easy to get wrong |
| `async` functions | Can pause without blocking; every call needs `await` |
| Suspension points | `await` frees the thread while waiting; state may change during the pause |
| `async throws` | Declared `async throws`, called with `try await` |
| `Task { }` | Starts async work from sync code; inherits actor and priority; `.task` in SwiftUI |
| `Task.sleep`/`Clock` | Non-blocking, cancellable waiting; great for debouncing |
| Cooperative thread pool | About one thread per core, shared by tasks that suspend |
| Blocking the pool | Never block in async code; move blocking APIs to a queue with a continuation |
| `Task.detached` | Inherits nothing; rarely needed; prefer `@concurrent` or structured concurrency |
| Task priority | A scheduling hint, inherited by default |
