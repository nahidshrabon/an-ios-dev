*Estimated read time: ~30 minutes*

---

## 17.1 The Callback Problem Async/Await Solves

Before async/await, asynchronous work in Swift (and most C-family languages) was expressed with completion-handler closures — functions that don't return a value directly, but instead call a closure later when the work finishes:

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

This "callback pyramid" gets deeper and harder to read with every additional sequential asynchronous step, makes error handling repetitive and easy to get subtly wrong (forgetting to call `completion` on one path, or calling it twice), and provides no compile-time guarantee the completion handler is ever actually called. Async/await (Swift 5.5+) replaces this entirely with code that *reads* sequentially, while still genuinely being asynchronous underneath:

```swift
func fetchUserProfile(id: Int) async throws -> Profile {
    let user = try await fetchUser(id: id)
    let profile = try await fetchProfile(for: user)
    return profile
}
```

---

## 17.2 Writing and Calling an `async` Function

A function marked `async` can suspend during its execution — pausing without blocking the underlying thread — and must be called with `await` at every call site, exactly parallel to how `throws` functions require `try` (recall section 9.2):

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

`await` marks every point where the function *might* suspend — it doesn't guarantee suspension will actually happen for a given call, but it marks every place where it's *possible*, which is valuable information for reasoning about a function's behavior (state could have changed by the time execution resumes after an `await`, exactly as with any concurrent code).

---

## 17.3 What `await` Actually Does at a Suspension Point

`await` is not "block and wait" — it's a genuine **suspension point**: when an `async` function calls another `async` function, if that call needs to actually wait (for I/O, a timer, or another task), the calling function's execution is suspended, and the underlying thread is released to do other work in the meantime, rather than sitting idle.

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

When `slowOperation()` suspends at `Task.sleep`, the thread that was running `caller()` is released back to the cooperative thread pool (see 17.7) to do other useful work — once the sleep completes, `caller()` resumes, potentially on a *different* thread than it started on. This is the fundamental difference from traditional blocking I/O: a suspended `async` function doesn't tie up a thread doing nothing while it waits.

---

## 17.4 `async` + `throws` Together

A function can be both `async` and `throws` simultaneously, requiring both `await` and `try` at the call site — conventionally written `try await` (recall the ordering matches how they compose: `try await someCall()`):

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

This combination is extremely common in real code — almost anything doing genuine asynchronous work (networking, disk I/O, database access) can also fail, so `async throws` together, handled with `do { try await ... } catch { ... }` (recall section 9.3), is one of the most frequently-seen function signatures in modern Swift.

---

## 17.5 `Task { }` — Entering Async from Sync Code

Since ordinary synchronous code (like a button's tap handler, or a type's `init`) can't use `await` directly, `Task { }` provides the bridge — it creates a new, independently-running asynchronous context, letting synchronous code kick off async work without itself becoming `async`.

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

`Task { }` returns immediately (it doesn't block the calling synchronous code waiting for the async work to finish) — the closure passed to it runs concurrently, picking up `await`s and suspension exactly like any other async context, inheriting the priority and (in most contexts) the actor isolation of wherever it was created.

---

## 17.6 `Task.sleep` and `Clock`-Based Waiting

`Task.sleep(for:)` (using the `Duration` type from section 14.18) suspends the current task for a specified span of time — it's the async-native replacement for older blocking sleep functions, and critically, it's genuinely non-blocking: the underlying thread is released during the sleep, exactly like any other suspension point.

```swift
func delayedGreeting() async {
    print("Waiting...")
    try? await Task.sleep(for: .seconds(2))
    print("Hello, after a 2-second delay!")
}
```

`Task.sleep` is cancellable — if the enclosing task is cancelled during the sleep, it throws a `CancellationError` rather than completing the full duration, which ties directly into cooperative cancellation (fully covered in section 18.7–18.8). You can also sleep relative to a specific `Clock` (recall 14.18–14.19) for more precise timing control: `try await Task.sleep(until: someClock.now + .seconds(5), clock: someClock)`.

---

## 17.7 The Cooperative Thread Pool Explained

Swift Concurrency runs `async` code on a **cooperative thread pool** — a fixed, relatively small pool of threads (roughly matching the number of CPU cores), fundamentally different from GCD's older model of potentially spawning many more threads than cores under heavy load.

```swift
// Conceptually: with a cooperative thread pool sized to, say, 8 threads on an 8-core device,
// Swift Concurrency can efficiently run many more than 8 *tasks* concurrently — because tasks
// suspend and release their thread during any await, rather than each task permanently
// occupying its own dedicated thread for its entire lifetime, the way a traditional
// thread-per-task model would.
```

The word "cooperative" is key: each thread in the pool is shared cooperatively among many suspended/resumed tasks, which only works correctly if tasks actually *do* suspend properly at their `await` points rather than performing long synchronous blocking work — which is exactly the danger covered next in 17.8.

---

## 17.8 Why Blocking the Pool Is Dangerous

Because the cooperative thread pool is deliberately small (sized to the CPU core count), any code that **blocks** a pool thread synchronously — a blocking file read, a `sleep()` call (as opposed to `Task.sleep`), a busy-wait loop, or a traditional lock held for a long time — can starve the entire pool, since there aren't extra threads sitting around to pick up the slack the way there might be under GCD's older model.

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

With only a handful of pool threads available, even a few tasks calling something like `badAsyncFunction()` concurrently can genuinely deadlock or severely stall an entire app — every pool thread ends up blocked waiting on synchronous work, leaving no thread available to run *any* other task, including ones that would otherwise finish instantly. The rule: never perform genuinely blocking work (synchronous I/O, `Thread.sleep`, long-held locks) directly inside `async` code — use the `async`-native equivalents, or explicitly move blocking work off the cooperative pool (e.g. via `Task.detached` with a dedicated queue, discussed next, used sparingly).

---

## 17.9 `Task.detached` and When Not to Use It

`Task.detached { }` creates a new task that, unlike a plain `Task { }`, does **not** inherit the current task's priority, actor isolation, or task-local values (recall section 18.10) from its creation context — it starts a genuinely independent, isolated unit of work.

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

**Guidance:** `Task.detached` is rarely the right choice in typical app code — its lack of inherited context (especially actor isolation) is easy to misuse, and it can make code harder to reason about, since it deliberately severs the structured relationship a plain `Task { }` maintains with its creation context. Prefer plain `Task { }` (or, better still, proper structured concurrency via `async let`/task groups, covered in section 18) in the vast majority of cases; reserve `Task.detached` for the rare, deliberate case where you specifically need a task with no inherited context at all.

---

## 17.10 Task Priority and Inheritance

Tasks carry a **priority** (`.high`, `.medium`, `.low`, `.background`, and similar levels), influencing how the cooperative thread pool schedules them relative to each other under contention — by default, a `Task { }` inherits the priority of its creating context, while `Task.detached` requires you to specify it explicitly (or accepts a default).

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

Priority is a *hint* to the scheduler, not an absolute guarantee of execution order — the cooperative pool uses it to prefer running higher-priority tasks sooner when multiple tasks are ready to run and threads are contended, but a low-priority task will still eventually run to completion; it's not starved indefinitely (barring the pathological pool-exhaustion scenario from 17.8).

---

## Summary

| Topic | One-line takeaway |
|---|---|
| The callback problem | Completion-handler pyramids are hard to read, error-prone, and offer no compile-time call guarantee |
| `async` functions | Declared with `async`; every call site requires `await`, exactly parallel to `throws`/`try` |
| Suspension points | `await` suspends and releases the thread rather than blocking it — genuine non-blocking waiting |
| `async throws` | Common combination; called with `try await`, handled with `do`/`catch` |
| `Task { }` | Bridges synchronous code into async execution; inherits priority and actor isolation by default |
| `Task.sleep`/`Clock` | Non-blocking, cancellable waiting — the async-native replacement for blocking sleep calls |
| Cooperative thread pool | A small, core-count-sized pool; many tasks share it by suspending properly at `await` points |
| Blocking the pool | Genuinely blocking calls inside `async` code can starve the whole pool — always suspend, never block |
| `Task.detached` | Doesn't inherit context (priority/isolation/task-locals) — rarely the right default choice |
| Task priority | A scheduling hint inherited by default; influences ordering under contention, doesn't guarantee it |

**Next up:** Section 18 — Structured Concurrency.
