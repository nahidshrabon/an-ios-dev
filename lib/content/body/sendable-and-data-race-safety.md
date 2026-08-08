*Estimated read time: ~30 minutes*

---

## 20.1 What `Sendable` Means

`Sendable` is a marker protocol (like `Error` from section 9.1) indicating that a type is safe to share across concurrency isolation boundaries — passed into a `Task`, sent to an actor, or captured by a `@Sendable` closure — without risking a data race. It's the compiler's way of answering "is it safe to hand this value to a different isolation domain?"

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

Value types (structs, enums) whose members are all themselves `Sendable` are naturally safe to share, since each copy is fully independent (recall section 6.9's value semantics) — there's no shared mutable storage for two isolation domains to race over. Reference types (classes) are the more interesting case, covered in 20.2.

---

## 20.2 Automatic `Sendable` Conformance Rules

Swift automatically synthesizes `Sendable` conformance for simple structs/enums whose stored properties/associated values are all themselves `Sendable` — mirroring exactly how `Equatable`/`Hashable` synthesis works (recall sections 7.7–7.8).

```swift
struct User: Sendable {   // synthesized automatically, since String and Int are both Sendable
    var name: String
    var age: Int
}

struct Container {
    var items: [User]   // Array<User> is Sendable, since User is Sendable and Array conditionally conforms
}
```

Classes, by contrast, are **not** automatically `Sendable` in most cases — a class instance is a shared reference, so even if all its stored properties are individually `Sendable` types, two isolation domains could still hold the same reference and mutate it concurrently, an inherent hazard structs don't have. The narrow exception: a `final class` with only immutable (`let`) `Sendable` properties can be automatically `Sendable`, since it's genuinely immutable after construction and therefore safe to share.

```swift
final class ImmutablePoint: Sendable {   // synthesized — final class, all properties are immutable
    let x: Double
    let y: Double
    init(x: Double, y: Double) { self.x = x; self.y = y }
}
```

---

## 20.3 `@Sendable` Closures

A `@Sendable` closure is one that's safe to pass across isolation boundaries — it can only capture `Sendable` values, and (critically) it cannot capture a mutable variable (`var`) by reference in a way that would let two isolation domains mutate the same captured variable concurrently.

```swift
func runConcurrently(_ work: @Sendable @escaping () -> Void) {
    Task {
        work()
    }
}

var counter = 0
runConcurrently {
    // ❌ error: mutation of captured var 'counter' in a Sendable closure
    counter += 1
}

let readOnlyValue = 42
runConcurrently {
    print(readOnlyValue)   // ✅ fine — capturing an immutable Sendable value is safe
}
```

Most closures passed to Swift Concurrency APIs (`Task { }`, task group `addTask`, actor method arguments crossing isolation) are implicitly required to be `@Sendable` — this is precisely the mechanism that catches, at compile time, the kind of unsynchronized shared-mutable-capture bug that used to only surface as a runtime data race.

---

## 20.4 `@unchecked Sendable` and Your Obligations

`@unchecked Sendable` is an escape hatch: it tells the compiler "trust me, this type is actually safe to share across isolation domains, even though you can't verify that yourself" — appropriate specifically for types using their own internal synchronization (a lock, a `Mutex` from section 14.21) that the compiler has no way to reason about.

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

Using `@unchecked Sendable` is a genuine promise you're making to the compiler, not a way to silence an inconvenient error — every access to the type's mutable state must actually be protected by the synchronization mechanism you're relying on (here, consistently locking around every read/write of `_value`), or you've reintroduced the exact data race `Sendable` checking exists to prevent, just with the compiler no longer able to catch it.

---

## 20.5 `sending` Parameters and Results

`sending` marks a parameter or return value as being fully, uniquely transferred to the receiving context — after passing a `sending` value, the caller can no longer use it, which lets the compiler permit transferring a *non*-`Sendable` value safely, since it can prove there's no longer any other reference to it that could race.

```swift
class NonSendableBox {
    var value = 0
}

func consume(_ box: sending NonSendableBox) {
    // safe to use box freely here — the compiler guarantees no other
    // code retains simultaneous access to it after the transfer
}

func useBox() {
    let box = NonSendableBox()
    consume(box)
    // box.value = 5   // ❌ error: 'box' was consumed by the sending parameter and can no longer be used here
}
```

This is closely related to the `consuming` ownership modifier from section 11.8, and to region-based isolation (20.6) — `sending` lets the compiler prove a specific transfer is safe on a case-by-case basis, without requiring the transferred type to be blanket `Sendable`, which is often more precise and less restrictive than requiring full `Sendable` conformance for a type that's only ever used this "hand off and never touch again" way.

---

## 20.6 Region-Based Isolation: How the Compiler Proves Safety

Region-based isolation (introduced conceptually in Swift 6.0, strengthened in Swift 6.3 per section 16.6) is the broader analysis technique underlying `sending`'s safety guarantee — the compiler tracks which values are provably isolated to a single "region" (with no other live references anywhere else in the program), allowing safe transfer of non-`Sendable` values whenever it can prove that isolation, rather than requiring `Sendable` conformance as the only path to safety.

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

The practical benefit: not every genuinely safe transfer requires a type to be marked `Sendable` — if the compiler's region analysis can independently prove no concurrent aliasing exists for a *specific* value at a *specific* point in the code, it can permit the transfer without that blanket type-level guarantee, which is exactly what reduced false-positive Swift 6 mode errors between the 6.0 and 6.3 releases.

---

## 20.7 Reading and Fixing Common Swift 6 Concurrency Errors

A handful of error patterns account for the large majority of Swift 6 migration friction. Recognizing them (and their typical fixes) makes migration substantially less painful than treating each error as a novel puzzle:

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

The unifying theme across nearly all of these errors: the compiler has found a genuine potential data race that Swift 5 mode would have silently allowed (or only warned about) — the "fix" is rarely to silence the error, but to actually restructure the code (using actors, `Sendable` conformance, or `sending`) to eliminate the race the compiler correctly identified.

---

## 20.8 Migrating a Module to Swift 6 Language Mode

Migrating an existing codebase to Swift 6 mode is best done incrementally, module by module (recall section 16.3's note that Swift 6 mode is opt-in per module), rather than attempting a single, disruptive whole-project flip:

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

```swift
@preconcurrency import SomeLegacyFramework
```

`@preconcurrency import` is specifically useful mid-migration: it tells the compiler "treat this specific import's types as if they predate strict concurrency checking," suppressing false-positive-feeling errors that stem purely from a dependency not having migrated yet, without weakening the concurrency checking applied to your *own* module's code.

---

## 20.9 Strict Concurrency Settings Per Target

Before fully committing to Swift 6 language mode, a target can enable **strict concurrency checking** at varying levels under Swift 5 mode itself — `minimal`, `targeted`, or `complete` — letting a codebase preview and incrementally address Swift 6-style errors as warnings first, without yet making the full jump to Swift 6 mode's hard-error enforcement.

```swift
// In Package.swift:
.target(
    name: "MyTarget",
    swiftSettings: [
        .swiftLanguageMode(.v5),
        .enableExperimentalFeature("StrictConcurrency=complete")   // full checking, as warnings under Swift 5 mode
    ]
)
```

`.complete` applies the same checking rigor Swift 6 mode would enforce as hard errors, but surfaces it as warnings instead — letting a team fix issues at their own pace under Swift 5 mode, then flip the target to full Swift 6 language mode once those warnings are cleared, turning what would otherwise be a single disruptive migration event into a gradual, warning-driven cleanup process.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `Sendable` | Marks a type safe to share across isolation boundaries without risking a data race |
| Automatic conformance | Synthesized for simple structs/enums with all-`Sendable` members; classes need extra care |
| `@Sendable` closures | Can't capture mutable `var`s by reference or non-`Sendable` values — caught at compile time |
| `@unchecked Sendable` | An unverified developer promise, appropriate only with genuine internal synchronization |
| `sending` | Proves a specific one-time transfer safe without requiring blanket `Sendable` conformance |
| Region-based isolation | The compiler analysis proving no concurrent aliasing exists for a specific value transfer |
| Common Swift 6 errors | A handful of recurring patterns — usually fixed by `Sendable`, `sending`, actors, or `async`/`await` |
| Module migration | Incremental, module-by-module, leaf-first, using `@preconcurrency import` for unmigrated dependencies |
| Strict concurrency settings | `minimal`/`targeted`/`complete` preview Swift 6-style checking as warnings before the full language mode jump |

**This concludes Part 2 — Concurrency (Sections 17–22 cover the full part; Sections 17–20 completed here).** Next up: Section 21 — AsyncSequence and Streams.
