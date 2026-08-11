## 16.1 How Swift Evolution Works and Reading a Proposal

Swift Evolution is the open, public process by which the Swift language itself changes — anyone can propose a new feature, and every accepted change goes through a documented, numbered **SE proposal** (e.g. "SE-0401"), reviewed publicly on the swift-evolution GitHub repository and forums before being accepted, revised, or rejected.

```swift
// A proposal's structure is standardized, and reading one directly is the most
// reliable way to understand *why* a feature works the way it does, not just *that* it does:
//
// - Introduction: a one-paragraph summary of the problem and proposed solution
// - Motivation: the actual pain point being solved, often with real code examples
// - Proposed solution: the feature itself, in outline
// - Detailed design: the precise grammar/semantics/type-checking rules
// - Source compatibility / Effect on ABI stability: what breaks, what doesn't
// - Alternatives considered: designs that were rejected, and why
```

Reading the "Alternatives considered" section is often the most illuminating part — it explains why a feature looks the way it does, rather than one of the other approaches that were considered and rejected, which is context you won't get just from reading documentation or a blog post about the final feature.

---

## 16.2 Upcoming Feature Flags and Staged Adoption

Rather than shipping every new language behavior as an immediate, all-at-once breaking change, Swift often introduces significant changes as **upcoming feature flags** first — opt-in flags a package or target can enable individually, ahead of that behavior becoming the default in a future language mode.

```swift
// In Package.swift, enabling a specific upcoming feature ahead of time:
.target(
    name: "MyTarget",
    swiftSettings: [
        .enableUpcomingFeature("ExistentialAny")   // opt in to requiring `any` explicitly, early
    ]
)
```

This staged approach lets a codebase adopt a breaking behavioral change incrementally, one feature flag and one target at a time, testing and fixing issues in isolation — rather than being forced to deal with every accumulated breaking change simultaneously the moment a new Swift language mode (like Swift 6 mode, see 16.3) is adopted.

---

## 16.3 What Changed in Swift 6.0: Strict Concurrency

Swift 6.0 introduced the **Swift 6 language mode**, which makes strict concurrency checking (previously opt-in warnings) into enforced compile-time errors — data races that were merely flagged as warnings under Swift 5 become hard errors once a module fully adopts Swift 6 mode.

```swift
// Under Swift 5 mode: this might only produce a warning
// Under Swift 6 mode: this is a compile-time error
class Counter {
    var value = 0
}

func increment(_ counter: Counter) async {
    Task {
        counter.value += 1   // potential data race — Swift 6 mode rejects this at compile time
    }
}
```

This is the single biggest change covered across sections 16.3–16.7: Swift 6 mode is opt-in per module (you're not forced to adopt it just by using a newer compiler), letting teams migrate deliberately rather than having existing Swift 5-mode code suddenly break — the full mechanics of `Sendable`, actors, and the concurrency checking this enables are covered in depth throughout Part 2 (sections 17–20).

---

## 16.4 What Changed in Swift 6.1: Package Traits and `nonisolated`

Swift 6.1 introduced **package traits** — a Swift Package Manager feature letting a package define optional, conditionally-compiled feature sets consumers can opt into, similar in spirit to Cargo's "features" in the Rust ecosystem — plus ergonomic refinements to `nonisolated` (covered fully in section 19.9) making it easier to opt specific members out of an actor's isolation without excessive boilerplate.

```swift
// Package.swift: defining an optional trait
let package = Package(
    name: "MyLibrary",
    traits: [
        .trait(name: "Logging", description: "Enables verbose internal logging")
    ]
)

// Consumers opt in explicitly:
// .package(url: "...", traits: ["Logging"])
```

Package traits solve a real, previously awkward problem: shipping optional functionality (extra dependencies, debug-only logging, platform-specific extras) without forcing every consumer to pay for it, and without needing to split a single logical library into multiple separate packages just to make a feature optional.

---

## 16.5 What Changed in Swift 6.2: Approachable Concurrency

Swift 6.2 focused heavily on making Swift 6 mode's strict concurrency checking less painful to adopt for typical app code — introducing **main-actor-by-default** inference (`defaultIsolation`, fully covered in section 19.13) as an opt-in mode where code is implicitly `@MainActor`-isolated unless stated otherwise, which matches how the vast majority of UI-facing app code actually behaves anyway.

```swift
// With defaultIsolation set to MainActor in a target's settings,
// this class is implicitly @MainActor without writing the attribute explicitly:
class ViewModel {
    var items: [String] = []   // implicitly main-actor-isolated
}
```

The broader theme of "approachable concurrency" across Swift 6.2 was reducing the sheer number of explicit `@MainActor`/`Sendable`/`await` annotations a typical SwiftUI-style app needed to write to satisfy strict checking — acknowledging that the *default* assumption for most app code (everything runs on the main actor unless it's explicitly doing background work) should require less annotation ceremony than Swift 6.0's initial, stricter defaults demanded.

---

## 16.6 What Changed in Swift 6.3: Region-Based Isolation

Swift 6.3 refined **region-based isolation** — the compiler's underlying technique (introduced conceptually in Swift 6.0, but meaningfully strengthened here) for proving that a value transferred between isolation domains (e.g. passed into a `Task` or across an actor boundary) is provably safe to move, *without* requiring it to be fully `Sendable`, as long as the compiler can prove no other code retains simultaneous access to it.

```swift
func processData() async {
    let data = NonSendableData()   // doesn't conform to Sendable
    await Task {
        use(data)   // region-based isolation can prove this specific transfer is safe,
                      // since "data" isn't used anywhere else afterward — no actual race is possible
    }.value
}
```

This refinement reduced a common source of frustration under earlier Swift 6 mode: code that was *actually* safe (because a value's only use was the transfer itself, with no lingering aliases) but got rejected anyway because the value's type wasn't marked `Sendable`. Sharper region analysis in 6.3 allows the compiler to prove more of these genuinely-safe cases correct, rather than requiring blanket `Sendable` conformance for every transferred value.

---

## 16.7 What Changed in Swift 6.4: `anyAppleOS` and Isolation Ergonomics

Swift 6.4 introduced `anyAppleOS` as a platform-condition shorthand covering all of Apple's operating systems (iOS, macOS, watchOS, tvOS, visionOS) in one check, replacing the previous need to enumerate each platform individually in cross-platform conditional code — alongside further ergonomic refinements to isolation inference building on 6.2's approachable-concurrency direction.

```swift
#if os(iOS) || os(macOS) || os(watchOS) || os(tvOS) || os(visionOS)
// old way: had to list every Apple platform explicitly
#endif

#if anyAppleOS
// new way: one condition covers all current and future Apple platforms
#endif
```

`anyAppleOS` is a small but genuinely convenient addition for any codebase sharing logic across multiple Apple platforms (recall section 33's multiplatform SwiftUI coverage) — it also automatically covers any *future* Apple platform Apple might introduce, unlike an explicit enumeration that would need updating each time a new platform target appears.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Swift Evolution process | Public, numbered SE proposals; the "Alternatives considered" section often explains a feature's design best |
| Upcoming feature flags | Opt-in, per-target flags let codebases adopt breaking changes incrementally, ahead of a new language mode |
| Swift 6.0 | Introduced Swift 6 language mode — strict concurrency warnings become compile-time errors, opt-in per module |
| Swift 6.1 | Package traits (optional, consumer-opt-in feature sets) plus refined `nonisolated` ergonomics |
| Swift 6.2 | "Approachable concurrency" — main-actor-by-default inference reduces required annotation ceremony |
| Swift 6.3 | Strengthened region-based isolation proves more transfers safe without requiring full `Sendable` conformance |
| Swift 6.4 | `anyAppleOS` platform-condition shorthand, plus further isolation-inference ergonomics |

**This concludes Part 1 — Swift Language (Sections 1–16).** Next up: Part 2 — Concurrency, starting with Section 17, Async/Await Foundations.
