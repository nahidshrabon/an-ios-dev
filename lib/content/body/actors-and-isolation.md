## 19.1 The Data Race Problem Actors Solve

A data race occurs when two threads access the same mutable memory concurrently, with at least one of them writing, and no synchronization coordinating the two — a notoriously difficult class of bug, since the outcome is nondeterministic and often doesn't reproduce reliably.

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

Before Swift Concurrency, avoiding this required manual discipline — locks (`NSLock`, recall section 10.5), serial dispatch queues, or careful, error-prone reasoning about which thread touches what. **Actors** move this responsibility into the type system itself: an actor's mutable state can only be accessed through the actor, one operation at a time, with the compiler enforcing this at compile time rather than trusting a developer to remember to lock correctly every single time.

---

## 19.2 Declaring and Using an Actor

An actor looks almost identical to a class — properties, methods, initializers — but the compiler automatically serializes access to its mutable state, and any access from *outside* the actor must go through `await`, since it might need to wait its turn:

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

Internally, an actor processes one call at a time — if two callers both call `await counter.increment()` concurrently, the actor runs them one after another (never simultaneously), which is precisely what eliminates the data race from 19.1: there's no way for two `+= 1` operations to interleave, because the actor itself guarantees mutual exclusion automatically.

---

## 19.3 Actor Reentrancy and the Interleaving Surprise

A subtlety that catches many developers off guard: actors are **reentrant** — while an actor method is suspended at an `await` point (waiting on some other async call), the actor is free to process *other* incoming calls in the meantime, rather than blocking everything else until the original call fully finishes.

```swift
actor BankAccount {
    var balance = 100

    func withdraw(_ amount: Int) async {
        guard balance >= amount else { return }
        await Task.sleep(for: .seconds(1))   // suspension point — actor is free to interleave other work here!
        balance -= amount   // by the time we resume, balance might have changed due to another call
    }
}
```

If two concurrent calls to `withdraw(100)` both check `balance >= amount` before either has suspended at the `sleep`, both could pass the guard, then both proceed to subtract — potentially overdrawing the account, *despite* being inside an actor. This is not a bug in actors; it's a fundamental consequence of `await` being a genuine suspension point (recall 17.3) — the fix is to avoid awaiting in the middle of a critical, state-dependent sequence, or to re-validate state immediately after resuming from any `await`.

---

## 19.4 `isolated` Parameters

An `isolated` parameter lets a plain (non-actor) function explicitly declare that it runs *within* a specific actor's isolation, without needing to be a method defined directly on that actor — useful for writing free functions or extension methods that still need guaranteed access to actor-protected state.

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

Notice that inside `addItem` itself, no `await` is needed to touch `store.items` — the `isolated` parameter tells the compiler this function's body already runs on that actor's isolation domain, exactly as if it were a method defined directly on `DataStore`. The `await` only appears at the call site, where control actually transfers into that isolation.

---

## 19.5 Global Actors and `@MainActor`

A **global actor** is a singleton actor-like isolation domain shared across an entire app, rather than a per-instance actor you create yourself — `@MainActor`, tied to the main thread, is by far the most commonly used one, since UIKit and SwiftUI both require UI updates to happen on the main thread.

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

`@MainActor` can annotate an entire type (isolating every member), an individual method/property, or a function — it's the standard, enforced replacement for the old convention of remembering to dispatch UI updates back to the main thread manually (`DispatchQueue.main.async { ... }`), now checked by the compiler instead of trusted to developer discipline.

---

## 19.6 `@MainActor` Inference Rules

Swift infers `@MainActor` isolation automatically in several common situations, reducing the need to annotate every single member explicitly: any type conforming to a `@MainActor`-isolated protocol becomes `@MainActor` itself, and (notably) most UIKit/SwiftUI base classes and protocols (like `UIViewController`, or SwiftUI's `View`) are themselves `@MainActor`-isolated, so subclasses and conformers inherit that isolation automatically without needing the attribute written out.

```swift
// UIViewController itself is @MainActor-isolated in modern SwiftUI/UIKit,
// so a subclass automatically inherits that isolation without writing @MainActor explicitly:
class MyViewController: UIViewController {
    func updateLabel() {
        // implicitly @MainActor-isolated, inherited from UIViewController
    }
}
```

This inference is exactly what section 16.5's "approachable concurrency" effort built on — since the overwhelming majority of UI-related code genuinely *should* be main-actor-isolated, having the compiler infer it automatically in these common cases substantially reduces the sheer number of `@MainActor` annotations a typical SwiftUI-based app needs to write out by hand.

---

## 19.7 `MainActor.assumeIsolated`

Occasionally, code that's *actually* running on the main thread doesn't statically type-check as being `@MainActor`-isolated — for example, inside a callback from an older, non-Swift-Concurrency-aware API that happens to always invoke its callback on the main thread, but has no way to express that guarantee to the type system. `MainActor.assumeIsolated` bridges this gap by asserting (with a runtime check) that the current context genuinely is the main actor.

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

This is explicitly an escape hatch, not a routine tool — if the assertion turns out to be wrong (the closure actually runs on some other thread), the runtime check traps, similar in spirit to force-unwrapping an optional you were wrong about. Use it only when you have a genuine, verified guarantee the surrounding code really does run on the main thread, typically when bridging older APIs that predate Swift Concurrency's isolation model.

---

## 19.8 Writing a Custom Global Actor

Beyond `@MainActor`, you can define your own global actor for isolating a specific category of shared state that isn't UI-related but still needs the same "one shared isolation domain across the whole app" treatment — declared with `@globalActor` on a type conforming to the `GlobalActor` protocol.

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

A custom global actor is appropriate when several otherwise-unrelated types across a codebase all need to share *one single* isolation domain (rather than each having their own separate, independent actor instance) — for example, isolating all database access across an app to a single dedicated actor, ensuring database operations from anywhere in the codebase are automatically serialized against each other.

---

## 19.9 `nonisolated` Members

`nonisolated` explicitly opts a specific member of an actor (or `@MainActor`-isolated type) *out* of that isolation — appropriate for members that don't touch the actor's mutable state at all, like a `let` constant or a pure function that only depends on its own parameters.

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

A common, specific use is exposing a `nonisolated` computed property for a `let` constant an actor stores (like an identifier that never changes after initialization) — since it never touches genuinely mutable, isolation-requiring state, marking it `nonisolated` lets external code read it without needing `await` at all, which can meaningfully simplify calling code.

---

## 19.10 `nonisolated(unsafe)` and Its Contract

`nonisolated(unsafe)` is a stronger, riskier variant — it opts a *stored, mutable* property out of actor isolation entirely, which the compiler cannot verify is actually safe. It's an assertion, backed by the developer's own manual guarantee (often via some other synchronization mechanism, like a `Mutex` from section 14.21), that concurrent access to this specific property is safe despite bypassing the compiler's normal checking.

```swift
actor Logger {
    nonisolated(unsafe) var logCount = 0   // the compiler will NOT protect this property at all

    nonisolated func incrementUnsafely() {
        logCount += 1   // ⚠️ genuinely unsafe unless externally synchronized somehow
    }
}
```

This should be treated with the same level of caution as `@unchecked Sendable` (covered in section 20.4) — it's a deliberate opt-out of compiler-verified safety, appropriate only when you have a specific, verified reason the compiler's default checking is too conservative for your actual situation (e.g. the property is only ever mutated via a lock-protected path elsewhere), not a general-purpose way to silence inconvenient compiler errors.

---

## 19.11 `nonisolated(nonsending)` Explained

`nonisolated(nonsending)` (a newer, more refined isolation-control tool) marks a function as `nonisolated` while still preserving the **calling context's** isolation for its execution, rather than hopping onto a separate, actor-agnostic execution context the way plain `nonisolated` normally would. In practice, this lets a function stay flexible about which isolation domain calls it from, without introducing an actual context switch (and its associated overhead) for the common case where the caller and the function's execution can simply share the same isolation.

```swift
actor Worker {
    nonisolated(nonsending) func logAction(_ message: String) {
        // runs using whatever isolation context the caller already has,
        // rather than switching to a separate, isolated-from-everything execution context
        print(message)
    }
}
```

This is a subtler, more specialized tool than plain `nonisolated` — it exists specifically to avoid unnecessary actor-hopping overhead for functions that genuinely don't need dedicated isolation of their own, but would otherwise force a context switch under the older, simpler `nonisolated` semantics.

---

## 19.12 `@concurrent` — Opting Out of Caller Isolation

`@concurrent` (introduced as part of the broader isolation-ergonomics refinements alongside `nonisolated(nonsending)`) explicitly marks a function as running on the general cooperative thread pool, deliberately opting *out* of whatever isolation its caller happens to have — the inverse intent of `nonisolated(nonsending)`'s "stay with the caller's context" behavior.

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

This is useful for explicitly carving out genuinely CPU-heavy work from an otherwise `@MainActor`-isolated type, ensuring it doesn't tie up the main actor (and, by extension, the UI) while it runs — without needing to move that method into an entirely separate, non-isolated type just to escape the enclosing class's default isolation.

---

## 19.13 Main-Actor-by-Default (`defaultIsolation`) Mode

Building on section 16.5's introduction, `defaultIsolation` is a target-level setting that makes `@MainActor` the *implicit* isolation for all code in that target unless explicitly stated otherwise — inverting Swift's earlier default (where code was `nonisolated`/unspecified unless explicitly marked `@MainActor`).

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

This mode directly addresses the reality that most SwiftUI-based app code is inherently UI-adjacent and main-actor-isolated anyway — rather than requiring `@MainActor` written on nearly every type, `defaultIsolation` flips the default, requiring explicit opt-out (via `@concurrent`, or a custom global actor) only for the smaller subset of code that genuinely needs to run off the main actor.

---

## 19.14 Custom Actor Executors

By default, every actor (and the main actor) is scheduled by Swift Concurrency's own built-in executor — but actors can specify a **custom executor**, letting you control precisely which underlying thread/queue an actor's work actually runs on, which matters for interoperating with existing serial-queue-based subsystems that predate Swift Concurrency.

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

Custom executors are a genuinely advanced, narrow tool — primarily useful when migrating a large, existing codebase built around a specific serial `DispatchQueue` (or similar existing serialization mechanism) into actors gradually, letting the actor's isolation guarantee line up with an already-established queue, rather than introducing an entirely separate, competing serialization mechanism during the transition.

---

## 19.15 Isolated Conformances and Isolated `deinit`

Two more specialized isolation refinements: an **isolated conformance** lets a type satisfy a protocol requirement specifically *while remaining actor-isolated*, rather than being forced to implement that requirement as `nonisolated` (which was previously often required for protocol conformance, even when it didn't make logical sense for the isolated type). An **isolated `deinit`** similarly allows a `deinit` (recall section 6.8) to run on the actor's own isolation domain rather than always running in a `nonisolated` context, letting cleanup code safely touch the actor's isolated state directly during teardown.

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

Both refinements exist to close awkward gaps in the actor isolation model where correctness previously required either genuinely unsafe workarounds (`nonisolated(unsafe)`) or restructuring code specifically to avoid touching isolated state in contexts that were forced to be `nonisolated` — letting more code honestly reflect its true isolation requirements without fighting the type system.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| The data race problem | Concurrent, unsynchronized access to shared mutable state produces nondeterministic, hard-to-reproduce bugs |
| Actors | Automatically serialize access to their mutable state; external access requires `await` |
| Reentrancy | An actor can interleave other calls during a suspended method's `await` — state can change mid-method |
| `isolated` parameters | Let a plain function run within a specific actor's isolation without being one of its own methods |
| `@MainActor` | The most common global actor, tied to the main thread, replacing manual `DispatchQueue.main.async` |
| `@MainActor` inference | Automatically inherited from `@MainActor`-isolated base classes/protocols like `UIViewController`/`View` |
| `MainActor.assumeIsolated` | A runtime-checked escape hatch asserting code genuinely runs on the main actor already |
| Custom global actors | Share one isolation domain across otherwise-unrelated types, for a specific shared concern |
| `nonisolated` | Opts a specific member out of actor isolation, for members that don't touch mutable actor state |
| `nonisolated(unsafe)` | Opts a mutable property out of isolation entirely — an unverified safety assertion, used sparingly |
| `nonisolated(nonsending)` | Stays nonisolated while preserving the caller's isolation context, avoiding unnecessary context switches |
| `@concurrent` | Explicitly opts a function out of its enclosing type's isolation, running on the general cooperative pool |
| `defaultIsolation` | Target-level setting making `@MainActor` the implicit default, requiring explicit opt-out instead of opt-in |
| Custom actor executors | Let an actor run on a specific existing queue/thread, useful for gradual legacy-system migration |
| Isolated conformances/deinit | Let protocol conformance and `deinit` safely run on an actor's own isolation instead of forced `nonisolated` |
