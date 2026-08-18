## 48.1 When to Split an App into Modules

Modularization — splitting one large app target into multiple separate Swift packages/modules — is a genuine investment with real costs (more setup, more indirection, longer initial build configuration), so it's worth being deliberate about exactly when it starts paying for itself rather than adopting it reflexively.

```plaintext
Signals it's genuinely time to modularize:
- Build times have become painfully slow, and Xcode's incremental
  builds aren't helping because everything lives in one target
- Multiple teams are working in the same codebase and stepping on
  each other constantly (merge conflicts, unrelated build breaks)
- You want to enforce architectural boundaries (section 45.9's "by
  feature" folders) with actual compiler enforcement, not just convention
```

The folder-based "by feature" organization from section 45.9 is the natural precursor to modularization — it's already grouping code the way modules eventually will, so the practical migration path is typically extracting an already-well-organized feature folder into its own Swift package, rather than modularizing from a disorganized starting point. For a small app or solo developer, a single well-organized target is often entirely sufficient, and premature modularization can add real overhead (48.12's build graph complexity, in miniature) without a corresponding benefit.

---

## 48.2 Creating a Local Swift Package

A local Swift package lives directly inside the app's repository (rather than being published externally) and is added to Xcode via File > Add Package Dependencies > Add Local, giving it its own `Package.swift` manifest describing its own dependencies and products.

```swift
// Packages/RecipeFeature/Package.swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "RecipeFeature",
    platforms: [.iOS(.v18)],
    products: [
        .library(name: "RecipeFeature", targets: ["RecipeFeature"])
    ],
    dependencies: [
        .package(path: "../SharedModels")
    ],
    targets: [
        .target(name: "RecipeFeature", dependencies: ["SharedModels"])
    ]
)
```

A local package behaves, from Xcode's perspective, almost identically to an externally-hosted Swift package dependency (like the kind added via a Git URL) — the key difference is simply that its source lives inside the same repository and is edited directly alongside the main app, making it well suited for internal modularization rather than genuinely independent, externally-versioned distribution. The `dependencies:` array (referencing `../SharedModels` via a relative path) is where a package declares which other local (or remote) packages it depends on, forming the module dependency graph discussed further in 48.5–48.7.

---

## 48.3 Feature Modules and Their Boundaries

A feature module packages one cohesive piece of app functionality (recipes, profile, settings) as its own Swift package — the module boundary itself is what enforces the "by feature" organizational discipline from section 45.9, now with actual compiler-checked isolation rather than mere folder convention.

```swift
// RecipeFeature module's public API surface:
public struct RecipeListView: View {
    public init(viewModel: RecipeListViewModel) { self.viewModel = viewModel }
    // ...
}

// Anything NOT marked `public` is invisible outside this module entirely —
// internal helper views, private formatting logic, etc. stay genuinely hidden
struct RecipeRowFormatter { /* internal, not exposed */ }
```

This is a meaningfully stronger boundary than folder organization alone provides: within a single target, even code in a different "folder" can freely reference any other internal type in the same target, with nothing but convention discouraging it — once code lives in a genuinely separate module, only types explicitly marked `public` (or `package`, 48.6) are even visible to other modules at all, meaning implementation details truly cannot leak across the boundary by accident, a guarantee folder organization alone can never provide.

---

## 48.4 Interface vs. Implementation Module Split

A more advanced modularization technique splits a single feature into two separate modules: a small "interface" module (protocols and public types only, no implementation) and a larger "implementation" module (the actual concrete logic) — letting other modules depend on just the interface, without pulling in the implementation's own dependencies.

```swift
// RecipeFeatureInterface module — tiny, stable, few dependencies
public protocol RecipeService {
    func getRecipes() async throws -> [Recipe]
}
public struct Recipe: Identifiable, Codable, Sendable {
    public let id: UUID
    public var title: String
}

// RecipeFeatureImplementation module — depends on RecipeFeatureInterface,
// plus networking, persistence, and whatever else it actually needs
public struct DefaultRecipeService: RecipeService {
    // concrete implementation, pulling in real networking/persistence dependencies
}
```

This split directly mirrors the dependency-inversion principle from Clean Architecture (section 46.4) — a consuming module can depend on `RecipeFeatureInterface` alone (a small, stable module with minimal transitive dependencies) without needing the full `RecipeFeatureImplementation` module and everything *it* depends on, which both keeps build graphs leaner (a change to the implementation doesn't necessarily require rebuilding every consumer, since the interface itself hasn't changed) and makes it straightforward to swap in an entirely different implementation module (e.g., a test-only one) without touching any consuming code at all.

---

## 48.5 Dependency Inversion Between Modules

At the module level, dependency inversion means a lower-level, more foundational module defines the protocols/abstractions, and a higher-level module (closer to the app's specific business logic) implements or depends on them — rather than the more "natural"-seeming but less flexible arrangement of high-level modules directly depending on low-level concrete implementation modules.

```plaintext
WITHOUT inversion: AppFeature → depends directly on → NetworkingImplementation
   (AppFeature is now coupled to networking's specific implementation choices)

WITH inversion:    AppFeature → depends on → NetworkingInterface
                    NetworkingImplementation → depends on/implements → NetworkingInterface
   (AppFeature only knows about the abstraction; the concrete implementation
    is wired in at the composition root, section 47.6, without AppFeature's involvement)
```

This is exactly the same dependency inversion principle from Clean Architecture (46.4) and protocol-based DI (47.4), now applied at the coarser granularity of entire modules rather than individual types — the practical payoff is the same too: a module depending only on an interface module can be built, tested, and reasoned about without needing to know or care about the specific concrete implementation module that will eventually satisfy that interface at the composition root.

---

## 48.6 The package Access Level

Swift's `package` access level (distinct from `public`, `internal`, `private`, and `fileprivate`) makes a symbol visible to any other module within the same package/repository, but not to genuinely external consumers — a middle ground specifically useful for internal modularization.

```swift
// Visible to any module WITHIN the same package collection,
// but not exposed as part of the package's genuinely public API
// (relevant if this package is ever published externally)
package struct InternalRecipeCache {
    package func store(_ recipe: Recipe) { /* ... */ }
}
```

Before `package` was introduced, internal modularization faced an awkward choice: mark something `internal` (invisible to *any* other module, even ones in the same app) or `public` (visible to literally anyone, including genuinely external consumers if the package were ever published) — `package` fills exactly the gap between these two, letting multiple modules within the same app share implementation details freely with each other while still keeping those same details hidden from any truly external consumer of a published package, a distinction that matters increasingly as an app's module count grows.

---

## 48.7 Detecting and Breaking Circular Dependencies

A circular dependency — Module A depends on Module B, which depends (directly or transitively) back on Module A — is something Swift's build system flatly refuses to compile, since there's no valid order in which to build two modules that each require the other to already exist.

```plaintext
Symptom: FeatureA imports FeatureB, and FeatureB imports FeatureA
         → build fails with a dependency cycle error

Fix: extract the shared functionality both features actually need
     into a new, lower-level SharedModule that both FeatureA and
     FeatureB depend on — neither depends on the other anymore
```

Circular dependencies typically emerge gradually, not by deliberate design — Feature A originally has no need for anything in Feature B, then some later change introduces a seemingly-small, reasonable-looking dependency in that direction, and only later does a symmetric dependency get added the other way, only now producing a genuine cycle. The standard fix (illustrated above) is almost always the same: identify the specific piece of functionality actually causing the cycle and extract it into a new, genuinely lower-level shared module both features can depend on without needing to depend on each other — directly connecting back to the "where does shared logic go" discipline from section 45.10.

---

## 48.8 Static vs. Dynamic Linking Trade-offs

A module can be built and linked as either a static library (its compiled code is copied directly into whatever consumes it, at build time) or a dynamic library/framework (its code stays in a separate binary, loaded at runtime) — the choice affects app launch time, binary size, and incremental build behavior.

```swift
// In Package.swift, controlling linking type:
.library(name: "RecipeFeature", type: .static, targets: ["RecipeFeature"])
// vs.
.library(name: "RecipeFeature", type: .dynamic, targets: ["RecipeFeature"])
```

Static linking generally produces faster app launch times (no separate binary needs to be loaded and dynamically linked at process startup) but can increase overall app binary size if the same static code ends up duplicated across multiple consumers; dynamic linking shares one copy of the code across everything that uses it (potentially reducing total size) at the cost of a small amount of additional launch-time overhead to load and link each dynamic framework. For most apps with a moderate number of modules, static linking (Swift Package Manager's default for local packages) is the sensible default, with dynamic linking becoming more relevant specifically for very large module counts (48.12) where static linking's build-time and binary-size costs start to dominate.

---

## 48.9 Mergeable Libraries 🔴

Mergeable libraries are a newer Xcode/linker capability that lets dynamically-linked frameworks be selectively merged back into the main app binary at build time for release builds, aiming to combine dynamic linking's development-time benefits (faster incremental builds, since only the changed framework needs relinking) with static linking's runtime benefits (a single binary, no dynamic loading overhead) for the final shipped product.

```plaintext
Development builds: modules link dynamically → fast incremental
                     rebuilds when only one module changes
Release builds:      mergeable libraries get merged into a single
                     binary → same launch-time performance as static linking
```

This directly addresses the 48.8 trade-off by refusing to accept it as fixed — rather than choosing once between static (better runtime, worse incremental build times) and dynamic (better incremental build times, worse runtime) for the entire development lifecycle, mergeable libraries let a project get dynamic linking's fast local iteration during active development while still shipping something with static linking's runtime characteristics to actual users, a genuinely valuable capability for large, heavily-modularized codebases where both concerns matter substantially.

---

## 48.10 Tuist: Swift-Defined Projects

Tuist is a popular third-party tool that generates an Xcode project (and its module graph) from a Swift-based project description, rather than maintaining a hand-edited `.xcodeproj`/`.xcworkspace` directly — aiming to make large, heavily-modularized project configurations more maintainable and less prone to the notoriously painful merge conflicts `.xcodeproj` files produce.

```swift
// Project.swift (Tuist's project description, itself just Swift code)
import ProjectDescription

let project = Project(
    name: "RecipeApp",
    targets: [
        .target(name: "RecipeFeature", destinations: .iOS, product: .framework, sources: ["Sources/**"])
    ]
)
```

Because a raw `.xcodeproj` file is a complex, semi-opaque XML-like format (echoing exactly the Interface Builder merge-conflict problem from section 35.4, but for project configuration rather than UI layout), teams working on large, actively-modularized codebases with many contributors often find hand-editing and merging `.xcodeproj` changes directly to be a genuine source of friction — Tuist's Swift-based project description is fully diffable and mergeable like ordinary source code, with the actual `.xcodeproj` generated fresh from that description as a build step rather than being the source of truth developers directly edit and merge.

---

## 48.11 Tuist: Caching and Graph Analysis

Beyond project generation, Tuist provides binary caching (pre-building and caching individual modules so unchanged modules don't need to be rebuilt from source on every clean build) and graph analysis tooling (visualizing and querying the actual module dependency graph) — both aimed squarely at the practical pain points of very large module counts.

```plaintext
tuist graph          — visualize the entire module dependency graph
tuist cache warm      — pre-build and cache all modules' binaries
tuist build           — build using cached binaries for unchanged modules,
                        only compiling from source what's actually changed
```

Binary caching directly attacks the build-time cost that motivates 48.8's static-linking trade-off discussion — if an unchanged module's compiled binary can simply be reused from a cache rather than recompiled from source on every build, much of static linking's build-time downside disappears in practice. Graph analysis tooling, meanwhile, helps directly with 48.7's circular dependency detection and general module-graph hygiene, letting a team visualize and audit their actual dependency structure rather than having to mentally track an increasingly complex web of module relationships as the codebase grows.

---

## 48.12 Managing a 50+ Module Build Graph 🔴

At genuinely large scale (an app with 50 or more internal modules, common at larger organizations), module graph management becomes a discipline in its own right — requiring active investment in tooling (Tuist or similar), enforced architectural rules (which module layers may depend on which others), and ongoing graph hygiene to prevent the dependency graph from degrading into an unmanageable tangle over time.

```plaintext
At this scale, teams typically need:
- Automated architectural rule enforcement (e.g., a linting step
  verifying "UI-layer modules may never directly depend on
  networking-layer modules," failing CI if violated)
- Regular dependency graph audits to catch circular dependencies
  (48.7) and unnecessary/accidental cross-module coupling early
- Binary caching (48.11) as a near-necessity rather than a nice-to-have,
  since building 50+ modules from scratch on every change is
  impractically slow without it
```

The core challenge at this scale isn't any single technique from earlier in this section — it's that without deliberate, ongoing investment in enforcing the architectural rules those techniques establish, a large module graph naturally tends to accumulate exactly the kind of accidental coupling and circular dependencies (48.7) that modularization was originally meant to prevent, just at a scale where manually noticing and fixing each individual violation becomes impractical without automated tooling actively watching for it.

---

## 48.13 Bazel for Very Large iOS Codebases 🔴

Bazel is Google's open-source build system, used by some of the very largest iOS codebases (often multi-platform monorepos shared across iOS, Android, web, and backend) in place of Xcode's native build system entirely — trading Xcode-native simplicity for build reproducibility and caching capabilities that scale to codebases far larger than Swift Package Manager or even Tuist-assisted Xcode projects are typically designed to comfortably handle.

```python
# BUILD.bazel (Bazel's project description format, Starlark-based, not Swift)
swift_library(
    name = "RecipeFeature",
    srcs = glob(["Sources/**/*.swift"]),
    deps = ["//SharedModels"],
)
```

Bazel's genuinely distinguishing capability is fully hermetic, reproducible builds with extremely aggressive, fine-grained caching (down to the level of individual compilation units, shared across an entire organization's build infrastructure, not just one developer's local machine) — valuable specifically for organizations with truly massive, multi-team, multi-platform codebases where even Tuist-assisted native Xcode tooling starts to strain, but representing real added complexity and departure from Apple's native tooling that's only justified at that genuinely large scale, not something a typical app (even a fairly large one) needs to reach for.

---

## Summary

| Concept | Key Idea | Purpose |
|---|---|---|
| Adoption threshold | Build times, team friction, boundary enforcement | Modularize deliberately, not reflexively |
| Local package basics | `Package.swift`, File > Add Local Package | In-repo, Xcode-integrated module creation |
| Feature module boundaries | `public` visibility only | Compiler-enforced isolation beyond folder convention |
| Interface/implementation split | Small stable interface + larger implementation module | Lean dependency graphs, swappable implementations |
| Module-level dependency inversion | Low-level modules define abstractions | Same principle as 46.4/47.4, at module granularity |
| `package` access level | Visible within package, hidden externally | Middle ground between `internal` and `public` |
| Circular dependencies | Compile-time cycle failure | Extract shared functionality into a lower-level module |
| Linking trade-offs | Static (launch speed) vs. dynamic (incremental builds) | Choose based on module count and priorities |
| Mergeable libraries | Dynamic in development, static-like in release | Best of both linking strategies |
| Tuist project generation | Swift-defined, diffable project description | Avoids `.xcodeproj` merge conflict pain |
| Tuist caching/graph tools | Binary caching, graph visualization | Practical tooling for large module counts |
| 50+ module discipline | Automated rule enforcement, graph audits | Prevent accidental coupling at scale |
| Bazel | Hermetic, org-wide-cached builds | Justified only for truly massive multi-platform codebases |
