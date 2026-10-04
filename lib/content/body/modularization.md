**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 48.1 When to Split an App into Modules 🟢

Two words first:

- **Target:** a set of source files plus build settings that Xcode builds into **one product**. The product can be an app, a framework, a library, an app extension (like a widget), or a test bundle. One Xcode project can have several targets, for example the app, its unit tests, and a widget.
- **Module:** a group of Swift code with its own boundary and name. **A target that compiles Swift code produces one module.** Other targets can `import` it if it builds a **library or framework**. App, extension, and test targets also produce modules, but they are not meant to be imported by other targets.

By default, all your app's code is in **one target**, so it is one big module. **Modularization** means splitting it into several separate modules, usually as separate Swift packages.

```plaintext
Before: one target          After: several modules
App                         App
 ├─ Recipes/                 ├─ RecipeFeature   (its own package)
 ├─ Profile/                 ├─ ProfileFeature  (its own package)
 └─ Shared/                  └─ SharedModels    (its own package)
```

It is **an investment with real costs**: more setup and more indirection. So do it on purpose, not by habit. These are the signs that it is time:

```plaintext
- Builds are painfully slow, and Xcode's incremental builds don't help
  because everything is in one target
- Several teams work in the same code and keep getting in each other's way
  (merge conflicts, build breaks caused by someone else's code)
- You want the compiler, not just habit, to protect the boundaries
  between features
```

The "by feature" folders from 45.9 are the natural first step. They already group code the way modules will, so you can later move a well-organized feature folder into its own package. Splitting a messy codebase is much harder.

**For a small app or a solo developer, one well-organized target is usually enough.** Splitting too early adds work with no benefit.

---

## 48.2 Creating a Local Swift Package 🟡

A **local Swift package** lives inside your app's repository (not published anywhere else). You add it in Xcode with File → Add Package Dependencies → Add Local. It has its own `Package.swift` file that describes it.

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

What each part means:

- **`name`:** the name of the package.
- **`platforms`:** which systems it supports (here iOS 18 and later).
- **`products`:** what this package **offers to others**. Here it is one library that other modules can import.
- **`dependencies`:** other packages this one needs. `.package(path: "../SharedModels")` points to a local package by a relative path.
- **`targets`:** the code inside the package, and which dependencies each target uses.

For Xcode, a local package works almost the same as a package from a Git URL. The difference is that its source is in your repository, and you edit it together with the app. This makes local packages a good fit for splitting up one app, not for publishing separate, versioned code.

The `dependencies` lists form the **module dependency graph**: who depends on whom. More on this in 48.5 to 48.7.

---

## 48.3 Feature Modules and Their Boundaries 🟡

A **feature module** is one piece of app functionality (recipes, profile, settings) as its own Swift package. The module boundary is what makes the "by feature" idea from 45.9 real, with the compiler checking it instead of only a folder habit.

```swift
// RecipeFeature module's public API:
public struct RecipeListView: View {
    public init(viewModel: RecipeListViewModel) { self.viewModel = viewModel }
    // ...
}

// Not marked `public` = invisible outside this module.
// Internal helpers stay hidden:
struct RecipeRowFormatter { /* internal, not exposed */ }
```

From another module, you see only what is `public`:

```swift
import RecipeFeature

RecipeListView(viewModel: viewModel)   // OK: it is public
RecipeRowFormatter()                    // ERROR: it is internal to RecipeFeature
```

This is **stronger than folders**. In one target, code in a different folder can still use any other type, and only habit stops you. In a separate module, only `public` types (or `package` types, see 48.6) are visible at all, so **details cannot leak across the boundary by accident**.

---

## 48.4 Interface and Implementation Modules 🔴

A more advanced technique splits one feature into two modules:

- an **interface module**: only protocols and public types, with no real code
- an **implementation module**: the real code

Other modules depend only on the interface.

```swift
// RecipeFeatureInterface: tiny, stable, few dependencies
public protocol RecipeService {
    func getRecipes() async throws -> [Recipe]
}
public struct Recipe: Identifiable, Codable, Sendable {
    public let id: UUID
    public var title: String
    public init(id: UUID, title: String) { self.id = id; self.title = title }
}

// RecipeFeatureImplementation: depends on the interface,
// plus networking, persistence, and anything else it needs
public struct DefaultRecipeService: RecipeService {
    // real code, with real networking and persistence dependencies
}
```

Who depends on whom:

```plaintext
ProfileFeature ──────────► RecipeFeatureInterface ◄────────── RecipeFeatureImplementation
 (needs recipes)            (small, stable)                    (networking, database...)
```

`ProfileFeature` needs recipes, but it only knows the small interface. This gives two benefits:

- **Faster builds.** If the implementation changes but the interface does not, modules like `ProfileFeature` don't need to be rebuilt.
- **Easy swapping.** You can use a different implementation, like a test-only one, without changing the code that uses it.

This is the same idea as dependency inversion in Clean Architecture (46.4), applied to whole modules.

---

## 48.5 Dependency Inversion Between Modules 🔴

At module level, **dependency inversion** means the more basic module defines the protocols (the abstractions), and the other modules depend on those, instead of a high-level module depending directly on a low-level implementation module.

```plaintext
WITHOUT inversion:
  AppFeature ──► NetworkingImplementation
  (AppFeature is tied to how networking is built)

WITH inversion:
  AppFeature ──► NetworkingInterface ◄── NetworkingImplementation
  (AppFeature knows only the protocol. The real implementation is
   connected in the composition root, 47.6, without AppFeature knowing.)
```

This is the same principle you already saw for single types (protocols in 47.4) and for layers (Clean Architecture in 46.4). Here it works on **whole modules**.

The result is the same too: a module that depends only on an interface can be built, tested, and understood without knowing which real implementation will be used later.

---

## 48.6 The package Access Level 🟡

Swift has an access level called **`package`**. It sits between `internal` and `public`. A `package` symbol is visible to **other modules in the same package or repository**, but not to outside users.

```swift
// Visible to any module in the same package collection,
// but not part of the package's public API
package struct InternalRecipeCache {
    package func store(_ recipe: Recipe) { /* ... */ }
}
```

Here are all the access levels, from most hidden to most open:

| Level | Who can see it |
|---|---|
| `private` | Only inside the same declaration (and its extensions in the same file) |
| `fileprivate` | Only in the same file |
| `internal` (default) | Only in the same module |
| `package` | Any module in the same package or repository |
| `public` | Everyone, including outside code |

Before `package` existed, modularizing an app had an awkward choice. `internal` hid something from other modules in your own app too. `public` showed it to everyone, including outside users if you ever published the package.

`package` fills the gap: your own modules can share details with each other, while those details stay hidden from outside users. This matters more as the number of modules grows.

---

## 48.7 Detecting and Breaking Circular Dependencies 🟡

A **circular dependency** is when Module A depends on Module B, and Module B depends on Module A (directly or through other modules). Swift's build system **refuses to build it**: it has no valid order, because each module needs the other to exist first.

```plaintext
The problem:  FeatureA ◄──► FeatureB     (FeatureA imports FeatureB, and FeatureB
                                         imports FeatureA: the build fails with
                                         a dependency cycle error)

The fix:      FeatureA ──► SharedModule ◄── FeatureB
              (the shared part both need moves into a new, lower-level module;
               neither feature depends on the other anymore)
```

Cycles usually appear slowly, not on purpose. Feature A first has no need for Feature B. Later, a small and reasonable change adds a dependency one way. Later still, the other way is added too, and now there is a cycle.

The usual fix is always the same: **find the exact piece that causes the cycle and move it into a new, lower-level shared module.** This is the same rule as 45.10: shared code gets its own place.

---

## 48.8 Static vs. Dynamic Linking Trade-offs 🟡

**Linking** means joining compiled code into your app. A module can be linked in two ways:

- **Static library:** its compiled code is **copied into the app** when you build.
- **Dynamic library (framework):** its code stays in a **separate file** that loads when the app runs.

```swift
// In Package.swift, choose the type:
.library(name: "RecipeFeature", type: .static, targets: ["RecipeFeature"])
// or
.library(name: "RecipeFeature", type: .dynamic, targets: ["RecipeFeature"])
```

| | Static | Dynamic |
|---|---|---|
| App launch | Faster (nothing extra to load) | A little slower (each framework is loaded) |
| App size | Can be bigger, if several modules copy the same code | Smaller (one shared copy) |
| Incremental builds | Slower (more to relink) | Faster (only the changed framework) |

For most apps with a moderate number of modules, **static linking** is a sensible default, and it is what Swift Package Manager usually uses when you don't choose. Dynamic linking matters more for very large module counts (48.12), where static linking's build time and size costs start to add up.

---

## 48.9 Mergeable Libraries 🔴

**Mergeable libraries** are a newer Xcode feature. They let dynamic frameworks be **merged into the main app** for release builds. The goal is to get the best of both linking types: the fast incremental builds of dynamic linking while you develop, and the speed of a single binary (like static linking) for the app you ship.

```plaintext
Development builds: modules are linked dynamically
                     → fast rebuilds when only one module changes
Release builds:      mergeable libraries are merged into one binary
                     → the same launch speed as static linking
```

48.8 looked like a choice between two things: static (better at runtime, slower to build) or dynamic (faster to build, slower at runtime). Mergeable libraries say you don't have to pick one for the whole project. You use dynamic while developing, and static-like for what users get.

This is useful for large apps with many modules, where both build time and launch time matter a lot.

---

## 48.10 Tuist: Swift-Defined Projects 🟡

**Tuist** is a popular third-party tool. It **generates your Xcode project** from a description written in Swift, so you don't edit the `.xcodeproj` file by hand. This makes large projects with many modules easier to maintain.

```swift
// Project.swift (Tuist's project description, written in Swift)
import ProjectDescription

let project = Project(
    name: "RecipeApp",
    targets: [
        .target(name: "RecipeFeature", destinations: .iOS, product: .framework, sources: ["Sources/**"])
    ]
)
```

**Why?** A `.xcodeproj` file is a complex, hard-to-read format. Merging changes to it is painful when many people edit it. It is the same kind of problem as the Interface Builder merge conflicts in 35.4, but for project settings instead of screens.

With Tuist, the description is normal Swift code. You can read it, compare it, and merge it like any other source file. The real `.xcodeproj` is **generated** from it as a build step, so it is no longer the source of truth that people edit and merge.

---

## 48.11 Tuist: Caching and Graph Analysis 🟡

Besides generating projects, Tuist has two more tools for very large module counts:

- **Binary caching:** modules are built once and the result is saved. An unchanged module is reused from the cache instead of being rebuilt from source.
- **Graph analysis:** you can look at your real module dependency graph.

```plaintext
tuist graph          — draw the whole module dependency graph
tuist cache warm     — build and save the binaries of all modules
tuist build          — build using saved binaries for unchanged modules,
                       and compile only what changed
```

**Caching** cuts the build time that made the linking trade-offs in 48.8 matter. If an unchanged module can be reused from the cache, much of static linking's slow-build downside goes away in practice.

**Graph analysis** helps you find circular dependencies (48.7) and unwanted coupling. You can see and check the real structure, instead of keeping a growing web of modules in your head.

---

## 48.12 Managing a 50+ Module Build Graph 🔴

With 50 or more modules (common at large companies), managing the module graph becomes **its own job**. You need good tools (like Tuist), rules about which layers may depend on which, and regular cleanup so the graph does not turn into a tangle.

```plaintext
At this size, teams usually need:
- Automatic rule checks (for example, a lint step that fails the build
  if a UI module depends directly on a networking module)
- Regular checks of the dependency graph to catch circular dependencies
  (48.7) and accidental coupling early
- Binary caching (48.11) as a must-have, because building 50+ modules
  from scratch on every change is far too slow
```

The hard part is not one technique from this section. It is that **without constant work to enforce the rules, a big module graph slowly collects the coupling and cycles that modularization was meant to prevent.** At this size, fixing each problem by hand is not realistic, so you need automatic tools that watch for it.

---

## 48.13 Bazel for Very Large iOS Codebases 🔴

**Bazel** is Google's open-source build system. Some of the largest iOS codebases (often one repository shared by iOS, Android, web, and backend) use it **instead of Xcode's own build system**. It gives up Xcode's simplicity in return for reliable, repeatable builds and caching that scale far beyond what Swift Package Manager or Tuist handle comfortably.

```python
# BUILD.bazel (Bazel's project format, written in Starlark, not Swift)
swift_library(
    name = "RecipeFeature",
    srcs = glob(["Sources/**/*.swift"]),
    deps = ["//SharedModels"],
)
```

What makes Bazel special is **hermetic, reproducible builds** with very fine-grained caching, down to single compilation units. The cache can be shared across a whole company's build servers, not just one developer's laptop.

It helps companies with huge, multi-team, multi-platform codebases, where even Tuist with Xcode starts to struggle. **It adds real complexity and moves you away from Apple's tools.** So it is only worth it at that scale. A typical app, even a fairly large one, does not need it.

---

## Summary

| Concept | Key Idea | Purpose |
|---|---|---|
| When to modularize | Slow builds, team friction, boundary checks | Do it on purpose, not by habit |
| Local package | `Package.swift`, Add Local in Xcode | Create modules inside your repository |
| Feature module | Only `public` is visible outside | The compiler protects boundaries, not just folders |
| Interface and implementation | A small interface module and a larger real one | Lean graphs and swappable implementations |
| Module dependency inversion | Basic modules define the protocols | The same idea as 46.4 and 47.4, for modules |
| `package` access | Visible in the package, hidden outside | A middle level between `internal` and `public` |
| Circular dependencies | The build fails with a cycle | Move shared code into a lower-level module |
| Linking | Static (faster launch) vs. dynamic (faster rebuilds) | Choose by module count and goals |
| Mergeable libraries | Dynamic for development, merged for release | The best of both linking types |
| Tuist projects | A project described in Swift | Avoid `.xcodeproj` merge pain |
| Tuist caching and graph | Binary cache, graph view | Tools for many modules |
| 50+ modules | Automatic rule checks, graph audits | Stop accidental coupling at scale |
| Bazel | Reproducible builds, shared caches | Only for huge multi-platform codebases |
