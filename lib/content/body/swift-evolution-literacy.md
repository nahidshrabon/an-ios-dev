**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 16.1 How Swift Evolution Works and Reading a Proposal 🟢

**Swift Evolution** is the **open, public process** for changing the Swift language. Anyone can propose a feature. Every accepted change goes through a numbered **SE proposal** (like "SE-0401"). Proposals are reviewed in public, on GitHub (`swiftlang/swift-evolution`) and the Swift Forums, and then **accepted**, **revised**, or **rejected**.

```plaintext
Pitch on the forums  →  Proposal (SE-XXXX)  →  Public review (~2 weeks)
       →  Accepted / Returned for revision / Rejected  →  Implemented in a Swift release
```

Every proposal has the same structure. Reading one is the **best way** to understand **why** a feature works the way it does:

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

**"Alternatives considered"** is often the **most useful** part. It explains why the feature looks like **this**, and not like the other designs people tried. Docs and blog posts usually skip that.

An example: why is it `if let name { }` and not something else? SE-0345 lists the alternatives (`if unwrap name`, `if let name?`, ...) and why they lost.

Each proposal header shows its **status** and the **Swift version** that includes it:

```plaintext
* Proposal: SE-0345
* Status: Implemented (Swift 5.7)
```

---

## 16.2 Upcoming Feature Flags and Staged Adoption 🟡

Big changes often **break existing code**. So Swift usually ships them first as **upcoming feature flags**: **opt-in** switches a target can turn on **early**, before the behavior becomes the default in a future **language mode**.

```swift
// In Package.swift, enabling a specific upcoming feature ahead of time:
.target(
    name: "MyTarget",
    swiftSettings: [
        .enableUpcomingFeature("ExistentialAny")   // opt in to requiring `any` explicitly, early
    ]
)
```

In an Xcode project, the same switches live in **Build Settings** → **Swift Compiler – Upcoming Features**.

What a flag does, with `ExistentialAny` as the example:

```swift
protocol Shape { }

let a: Shape = Circle()       // fine today
let b: any Shape = Circle()   // with ExistentialAny ON: you must write `any`
// With the flag on, the first line becomes an error until you add `any`.
```

**Why stage changes?** You can adopt **one change at a time**, **one target at a time**, and fix problems in small steps. Without flags, switching to a new language mode (like Swift 6, 16.3) would hit you with **every** breaking change **at once**.

You can also check the compiler version in code, for code shared between projects:

```swift
#if swift(>=6.0)
// code that needs Swift 6 features
#else
// fallback for older compilers
#endif

#if hasFeature(ExistentialAny)
// only compiled when the upcoming feature is on
#endif
```

---

## 16.3 What Changed in Swift 6.0: Strict Concurrency 🟡

Swift 6.0 introduced the **Swift 6 language mode**. In it, **strict concurrency checking** (only warnings in Swift 5 mode) becomes **compile errors**. Possible **data races** that were just warned about now **stop the build**.

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

**Important:** the Swift 6 **compiler** is not the same as the Swift 6 **language mode**. You can use the newest compiler with your code still in **Swift 5 mode**. You switch modes **per module**, when you're ready:

```swift
// Package.swift
let package = Package(
    name: "MyApp",
    targets: [
        .target(name: "Core"),                                        // uses the package default
        .target(name: "Legacy", swiftSettings: [.swiftLanguageMode(.v5)])   // stays on Swift 5 for now
    ],
    swiftLanguageModes: [.v6]                                          // default for this package
)
```

In Xcode: **Build Settings** → **Swift Language Version**.

A common migration path:

```plaintext
1. Swift 5 mode + "Strict Concurrency Checking: Complete"   → see all warnings
2. Fix the warnings, module by module
3. Switch that module to Swift 6 mode                       → warnings are now errors
```

Part 2 (sections 17–20) explains `Sendable`, actors, and the rules behind these errors in depth.

---

## 16.4 What Changed in Swift 6.1: Package Traits and `nonisolated` 🟡

Swift 6.1 added two things worth knowing.

**1. Package traits.** A package can declare **optional features** that users **turn on** if they want them, like "features" in Rust's Cargo:

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

Inside the library, code can depend on the trait:

```swift
#if Logging
logger.debug("Cache miss for \(key)")
#endif
```

**The problem traits solve:** shipping **optional** extras (an extra dependency, debug logging, platform-specific helpers) **without** forcing every user to pay for them, and **without** splitting one library into several packages.

**2. A `nonisolated` refinement.** `nonisolated` (section 19.9) can now be used in more places, for example on a whole **type or extension**, to stop it from **inheriting** a global actor like `@MainActor`:

```swift
@MainActor
class ProfileViewModel {
    var name = ""
}

nonisolated extension ProfileViewModel {
    static func formatted(_ name: String) -> String {   // not on the main actor
        name.trimmingCharacters(in: .whitespaces)
    }
}
```

---

## 16.5 What Changed in Swift 6.2: Approachable Concurrency 🟡

Swift 6.2 focused on making strict concurrency **easier for normal app code**. The big change: **main actor by default** (`defaultIsolation`, section 19.13). It's an **opt-in** setting. When it's on, code is **`@MainActor` unless you say otherwise**, which matches how most UI code really behaves.

```swift
// With defaultIsolation set to MainActor in a target's settings,
// this class is implicitly @MainActor without writing the attribute explicitly:
class ViewModel {
    var items: [String] = []   // implicitly main-actor-isolated
}
```

Turning it on:

```swift
// Package.swift
.target(
    name: "MyAppUI",
    swiftSettings: [.defaultIsolation(MainActor.self)]
)
```

In Xcode 26 and later, new app projects turn this on for you: **Build Settings** → **Default Actor Isolation** → **MainActor**.

When you **do** want work off the main actor, say so with **`@concurrent`**:

```swift
class ImageProcessor {
    @concurrent
    func resize(_ data: Data) async -> Data {   // runs on the background thread pool
        // heavy work here
        data
    }
}
```

Swift 6.2 also changed how plain `nonisolated async` functions run: by default they now run **on the caller's actor** (`nonisolated(nonsending)`), instead of always jumping to a background thread. That removes many surprising "sending non-Sendable value" errors.

**The theme of "approachable concurrency":** far fewer `@MainActor`, `Sendable`, and `await` annotations to satisfy the checker in a typical SwiftUI app. The **default** matches reality: most app code runs on the main actor, and only clearly marked work runs in the background.

---

## 16.6 What Changed in Swift 6.3: Region-Based Isolation 🔴

**Region-based isolation** is how the compiler proves that **sending** a value to another isolation domain (into a `Task`, or across an actor boundary) is **safe**, even if the value's type is **not `Sendable`**. The idea: if **nothing else** can still access the value after it's sent, there can't be a race.

The technique arrived with Swift 6.0, and was **strengthened** in later releases, including 6.3:

```swift
func processData() async {
    let data = NonSendableData()   // doesn't conform to Sendable
    await Task {
        use(data)   // region-based isolation can prove this specific transfer is safe,
                      // since "data" isn't used anywhere else afterward — no actual race is possible
    }.value
}
```

Compare with a case that **really is** unsafe, which the compiler still rejects:

```swift
func processDataTwice() async {
    let data = NonSendableData()
    Task {
        use(data)            // ❌ error: sending 'data' risks causing data races
    }
    use(data)                // ...because it's still used here, at the same time
}
```

**The frustration this fixes:** code that was **actually safe** (the value was only used by the receiver) used to be rejected, just because the type wasn't `Sendable`. Better region analysis means the compiler **accepts more safe code**, and you add fewer `Sendable` conformances just to quiet it.

The keyword **`sending`** (section 20) marks parameters and results that move into a new region:

```swift
func store(_ value: sending NonSendableData) async { /* ... */ }
```

---

## 16.7 What Changed in Swift 6.4: `anyAppleOS` and Isolation Ergonomics 🟡

Swift 6.4 added **`anyAppleOS`**: one platform condition for **all** of Apple's operating systems (iOS, macOS, watchOS, tvOS, visionOS). Before, you had to list each platform. It also continued the isolation improvements started in 6.2.

```swift
#if os(iOS) || os(macOS) || os(watchOS) || os(tvOS) || os(visionOS)
// old way: had to list every Apple platform explicitly
#endif

#if anyAppleOS
// new way: one condition covers all current and future Apple platforms
#endif
```

A real use: code shared between your app and a **Linux server** (section 81.5):

```swift
#if anyAppleOS
import CoreGraphics         // available on every Apple platform
typealias PlatformImage = CGImage
#else
// Linux: no UIKit; use raw image data instead
typealias PlatformImage = Data
#endif
```

It's small, but handy in any codebase shared across Apple platforms (section 33). It also covers **future** Apple platforms automatically. A hand-written list would need updating each time a new platform appears.

**How to keep up** with releases like these (see 82.13):

```plaintext
swift.org/blog            release announcements ("What's new in Swift 6.x")
github.com/swiftlang/swift-evolution    proposal status by version
forums.swift.org          pitches and reviews, before features are final
```

Check your own toolchain:

```bash
swift --version
# Apple Swift version 6.x ...
```

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Swift Evolution process | Public, numbered SE proposals; "Alternatives considered" explains the design |
| Upcoming feature flags | Turn on future behavior early, one target at a time |
| Swift 6.0 | Swift 6 language mode: concurrency warnings become errors; opt in per module |
| Swift 6.1 | Package traits (optional features) and more flexible `nonisolated` |
| Swift 6.2 | Approachable concurrency: main actor by default, `@concurrent` for background work |
| Swift 6.3 | Stronger region-based isolation: more safe code accepted without `Sendable` |
| Swift 6.4 | `anyAppleOS` for all Apple platforms, plus more isolation improvements |

**This concludes Part 1 — Swift Language (Sections 1–16).**
