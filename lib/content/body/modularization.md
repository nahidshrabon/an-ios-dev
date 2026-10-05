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

**Why use one?** A local package is the **simplest way to create a real module**, and you need modules to get the benefits from 48.1.

1. **A real boundary.** Code in other targets can only see its `public` types (48.3). Folders cannot give you this.
2. **Written, checked dependencies.** `Package.swift` lists what the package needs. If the code imports something that is not listed, the build fails. So the dependency graph (48.5 to 48.7) stays visible and cannot grow by accident.
3. **It builds and tests on its own.** You can build and test one package without building the whole app. This gives faster feedback, and it is how modularization helps build times.
4. **A plain text file.** The other way, adding framework targets to the `.xcodeproj`, changes a hard-to-read project file that causes merge conflicts (see 48.10). `Package.swift` is a small Swift file you can read, compare, and merge.
5. **Light to create and move.** There are no framework settings, signing, or embedding steps. You can reuse the package in another app later.

| Way to make a module | Good | Not so good |
|---|---|---|
| Folders in one target | No setup | No boundary, no separate builds |
| Framework target in the `.xcodeproj` | Works in older projects | More settings, hard-to-merge project file |
| **Local Swift package** | Simple, readable, enforced boundaries | One small extra file per module |

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

**Package, target, and product.** These three words are easy to mix up. A **package** is a container, and a **target** is a unit of code inside it. One package has one or more targets.

```plaintext
RecipeFeature (package)               ← the container, with one Package.swift
 ├─ target: RecipeFeature             ← a module: Sources/RecipeFeature/
 ├─ target: RecipeFeatureTests        ← a test target: Tests/RecipeFeatureTests/
 └─ product: library "RecipeFeature"  ← what the package offers to others
```

| Term | What it is | In the code above |
|---|---|---|
| **Package** | The container: one folder with one `Package.swift` | `name: "RecipeFeature"` |
| **Target** | A unit of code that is built. A target that compiles Swift code becomes a **module**. | `.target(name: "RecipeFeature", ...)` |
| **Product** | What the package **shows to the outside**. Others can only use targets that are in a product. | `.library(name: "RecipeFeature", targets: ["RecipeFeature"])` |

You write `import RecipeFeature`. The name after `import` is the **target (module) name**, not the package name. They are often the same, as here, but they don't have to be. A package can hold several targets, and each one is its own module. For example, one package could have a `NetworkingInterface` target and a `NetworkingImplementation` target (the split from 48.4).

What each part means:

- **`name`:** the name of the package.
- **`platforms`:** which systems it supports (here iOS 18 and later).
- **`products`:** what this package **offers to others**. Here it is one library that other modules can import.
- **`dependencies`:** other packages this one needs. `.package(path: "../SharedModels")` points to a local package by a relative path.
- **`targets`:** the code inside the package, and which dependencies each target uses.

For Xcode, a local package works almost the same as a package from a Git URL. The difference is that its source is in your repository, and you edit it together with the app. This makes local packages a good fit for splitting up one app, not for publishing separate, versioned code.

**How one target uses another.** Say your app is target A, and you have two library targets, B and C. Code in A cannot see B or C automatically, because each target is built separately. You need three steps:

1. **Add the dependency.** In Xcode, select target A → General → *Frameworks, Libraries, and Embedded Content*, and add B and C. Inside a Swift package, add them to the target's `dependencies` in `Package.swift`, as `RecipeFeature` does above with `SharedModels`.
2. **Import the module** in the files that need it:

```swift
import B
import C
```

3. **Make the types `public`** in B and C. After `import B`, A can only see B's `public` types (or `package` types, see 48.6). Internal types stay hidden.

```plaintext
A (app)  ──depends on──►  B (library)
   │
   └──────depends on──►  C (library)
```

Two rules to remember:

- **The direction matters.** If A depends on B, then B must not depend on A, or you get a circular dependency (48.7).
- **Only libraries and frameworks can be imported.** You cannot import an app, an app extension (like a widget), or a test target from another target.

The `dependencies` lists form the **module dependency graph**: who depends on whom. More on this in 48.5 to 48.7.

---

## 48.3 Feature Modules and Their Boundaries 🟡

A **feature module** is one piece of app functionality (recipes, profile, settings) as its own Swift package. The module boundary is what makes the "by feature" idea from 45.9 real, with the compiler checking it instead of only a folder habit.

Inside, a feature module holds everything for that feature. But from outside, **it shows only a small part**:

```plaintext
RecipeFeature (module)
 ├─ RecipeListView.swift       ← public: the screen other modules can use
 ├─ RecipeListViewModel.swift  ← internal: hidden
 ├─ RecipeRowView.swift        ← internal: hidden
 └─ RecipeRowFormatter.swift   ← internal: hidden
```

The visible part is the module's **public API**: what other modules are allowed to use. Everything else is a private detail that you can change freely.

```swift
// RecipeFeature module
public struct RecipeListView: View {
    @State private var viewModel: RecipeListViewModel     // internal: hidden

    // The dependencies come in through the public init (see 47.2)
    public init(recipeService: RecipeService) {
        _viewModel = State(initialValue: RecipeListViewModel(recipeService: recipeService))
    }

    public var body: some View {
        // ...
    }
}

// Not marked `public` = invisible outside this module.
// Internal helpers stay hidden:
struct RecipeRowFormatter { /* internal, not exposed */ }
```

Two things to notice:

- **You must write `public` yourself.** Inside a module, everything is `internal` by default. Even a `public` struct needs a `public init` and `public var body`. Without them, other modules can't create the view.
- **The view model is hidden.** The public init takes the service, not the view model. So `RecipeListViewModel` can change or be renamed without breaking any other module.

From another module, you see only what is `public`:

```swift
import RecipeFeature

RecipeListView(recipeService: service)   // OK: it is public
RecipeRowFormatter()                      // ERROR: it is internal to RecipeFeature
```

This is **stronger than folders**. In one target, code in a different folder can still use any other type, and only habit stops you. In a separate module, only `public` types (or `package` types, see 48.6) are visible at all, so **details cannot leak across the boundary by accident**.

**Keep the public API small.** Everything you make `public` is a promise: other modules may depend on it, so changing it can break them. Make `public` only what other modules really need, and keep the rest hidden.

---

## 48.4 Interface and Implementation Modules 🔴

**The problem.** Say `ProfileFeature` needs to show recipes. If it depends on the whole `RecipeFeature` module, it also gets everything that module depends on (networking, database), and it must be rebuilt every time anything in `RecipeFeature` changes.

```plaintext
ProfileFeature ──► RecipeFeature ──► Networking, Database, ...
```

**The solution.** A more advanced technique splits one feature into two modules:

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
                  RecipeFeatureInterface        (protocols and public types)
                   ▲                  ▲
                   │                  │
        ProfileFeature      RecipeFeatureImplementation   (networking, database...)
                   ▲                  ▲
                   └───────  App  ────┘
          (creates the real service and passes it in)
```

`ProfileFeature` knows only the interface. The app is the only place that knows both sides:

```swift
// ProfileFeature: imports only the interface
import RecipeFeatureInterface

public struct ProfileView: View {
    public init(recipeService: RecipeService) { /* ... */ }
}

// App (the composition root, see 47.6): the only place that knows both
import RecipeFeatureImplementation

ProfileView(recipeService: DefaultRecipeService())
```

This gives two benefits:

- **Faster builds.** If the implementation changes but the interface does not, modules like `ProfileFeature` don't need to be rebuilt.
- **Easy swapping.** You can use a different implementation, like a test-only one, without changing the code that uses it.

**The cost:** every feature now needs two modules and more wiring. So use this only when the faster builds and the freedom to swap are worth it, usually on large teams. That is why this lesson is marked 🔴.

This is the same idea as dependency inversion in Clean Architecture (46.4), applied to whole modules.

---

## 48.5 Dependency Inversion Between Modules 🔴

48.4 showed **how** to split a feature into an interface and an implementation. This lesson explains the **rule behind it**, which has a name: dependency inversion.

Start with two kinds of modules:

- **High-level module:** your app's own logic, like `AppFeature`. It decides what should happen.
- **Low-level module:** a technical detail, like `NetworkingImplementation`. It does the work (HTTP, JSON, database).

**Normally**, the high-level module depends directly on the low-level one. The arrow points from the logic down to the detail:

```plaintext
WITHOUT inversion:
  AppFeature ──► NetworkingImplementation
  (AppFeature is tied to how networking is built)
```

**With inversion**, you add a small interface module. `AppFeature` depends on the **interface**, and the **implementation also depends on the interface**:

```plaintext
WITH inversion:
  AppFeature ──► NetworkingInterface ◄── NetworkingImplementation
  (AppFeature knows only the protocol. The real implementation is
   connected in the composition root, 47.6, without AppFeature knowing.)
```

**Why "inversion"?** Look at the arrow from `NetworkingImplementation`. Before, the detail was something the logic pointed *to*. Now the detail points *up* to the interface, so **the arrow is flipped**. The low-level module now follows the rules that the high-level side needs, instead of the other way around.

In `Package.swift`, the arrows are just dependency lists:

```swift
// AppFeature depends only on the interface
.target(name: "AppFeature", dependencies: ["NetworkingInterface"]),

// The implementation also depends on the interface (and its own tools)
.target(name: "NetworkingImplementation", dependencies: ["NetworkingInterface"]),

// The app depends on both, and connects them (the composition root)
.target(name: "App", dependencies: ["AppFeature", "NetworkingImplementation"]),
```

This is the same principle you already saw for single types (protocols in 47.4) and for layers (Clean Architecture in 46.4). Here it works on **whole modules**.

The result is the same too: a module that depends only on an interface can be built, tested, and understood without knowing which real implementation will be used later. For example, you can test `AppFeature` with a fake networking object, without building any real networking code.

---

## 48.6 The package Access Level 🟡

Swift (5.9 and later) has an access level called **`package`**. It sits between `internal` and `public`. A `package` symbol is visible to **other targets in the same Swift package** (the same `Package.swift`), but not to anything outside that package.

Say one package has two targets: `RecipeStorage` and `RecipeFeature`.

```swift
// In target RecipeStorage
package struct RecipeCache {
    package func store(_ recipe: Recipe) { /* ... */ }
}

// In target RecipeFeature (same package): OK
import RecipeStorage
let cache = RecipeCache()

// In the app (outside the package): ERROR, it cannot see RecipeCache
```

`RecipeCache` is shared inside the package, but it is **not part of the package's public API**.

Here are all the access levels, from most hidden to most open:

| Level | Who can see it |
|---|---|
| `private` | Only inside the same declaration (and its extensions in the same file) |
| `fileprivate` | Only in the same file |
| `internal` (default) | Only in the same module |
| `package` | Any target in the same Swift package |
| `public` | Everyone, including outside code |

Before `package` existed, splitting code into several targets had an awkward choice. `internal` hid something from the other targets in your own package. `public` showed it to everyone, including outside users if you ever published the package.

`package` fills the gap: targets in one package can share details with each other, while those details stay hidden from outside users. This matters more as the number of targets grows.

**One thing to know:** `package` works **inside one package only**. If each feature is its own separate local package (as in 48.2), they do not share `package` symbols. To use `package` across features, put those targets in the **same** package.

---

## 48.7 Detecting and Breaking Circular Dependencies 🟡

A **circular dependency** is when Module A depends on Module B, and Module B depends on Module A (directly or through other modules). Swift's build system **refuses to build it**: it has no valid order, because each module needs the other to exist first.

**How it happens, step by step.** Say your app has two features:

1. `ProfileFeature` shows a user. It needs nothing from `RecipeFeature`.
2. Later, the profile screen should list the user's recipes. So `ProfileFeature` adds `RecipeFeature` as a dependency. This is reasonable.
3. Later still, a recipe screen should show its author with a link to the profile. So `RecipeFeature` adds `ProfileFeature` as a dependency. This also looks reasonable.

Now each one depends on the other:

```swift
// ProfileFeature/Package.swift
.target(name: "ProfileFeature", dependencies: ["RecipeFeature"])

// RecipeFeature/Package.swift
.target(name: "RecipeFeature", dependencies: ["ProfileFeature"])   // cycle!
```

The build fails with an error about a cyclic dependency.

Each change looked fine on its own. **Cycles usually appear slowly, not on purpose.**

**The fix:** find the exact piece that causes the cycle, and move it into a new, lower-level shared module. Here, both features only need a small `UserSummary` model (a name and an id):

```plaintext
The problem:  FeatureA ◄──► FeatureB     (FeatureA imports FeatureB, and FeatureB
                                         imports FeatureA: the build fails with
                                         a dependency cycle error)

The fix:      FeatureA ──► SharedModule ◄── FeatureB
              (the shared part both need moves into a new, lower-level module;
               neither feature depends on the other anymore)
```

```swift
// New module: SharedModels
public struct UserSummary: Identifiable, Sendable {
    public let id: UUID
    public var name: String
    public init(id: UUID, name: String) { self.id = id; self.name = name }
}

// Both features now depend on SharedModels, and not on each other
.target(name: "ProfileFeature", dependencies: ["SharedModels"]),
.target(name: "RecipeFeature", dependencies: ["SharedModels"]),
```

**If one feature really needs to open the other's screen**, use the interface idea from 48.4 and 48.5: depend on a protocol or a closure in the shared module, and let the app connect the two. For example, `RecipeFeature` can call an `onAuthorTapped` closure, and the app decides to open the profile.

**How to spot cycles early:** the build error tells you there is a cycle. A graph view of your modules (for example `tuist graph`, 48.11) shows them before they cause trouble.

This is the same rule as 45.10: shared code gets its own place.

---

## 48.8 Static vs. Dynamic Linking Trade-offs 🟡

**Linking** means joining the compiled code of your modules into one app. A module can be linked in two ways:

- **Static library:** its compiled code is **copied into the app** when you build. Think of ingredients cooked into the dish.
- **Dynamic library (framework):** its code stays in a **separate file** inside the app, and it is loaded when the app starts. Think of an ingredient served on the side.

```swift
// In Package.swift, choose the type:
.library(name: "RecipeFeature", type: .static, targets: ["RecipeFeature"])
// or
.library(name: "RecipeFeature", type: .dynamic, targets: ["RecipeFeature"])
```

| | Static | Dynamic |
|---|---|---|
| App launch | Faster (nothing extra to load) | A little slower (each framework is loaded) |
| App size | Can be bigger, if several parts copy the same code | Smaller (one shared copy) |
| Incremental builds | Slower (more to relink) | Faster (only the changed framework) |

**When dynamic helps:** if the app and another product, like a widget, both use the same module, static linking can put a copy in each. A dynamic framework gives one shared copy.

For most apps with a moderate number of modules, **static linking** is a sensible default, and it is what Swift Package Manager usually uses when you don't choose. Dynamic linking matters more for very large module counts (48.12), where static linking's build time and size costs start to add up.

---

## 48.9 Mergeable Libraries 🔴

48.8 looks like a choice between two things:

- **Static:** better at runtime, but slower to build while you develop.
- **Dynamic:** faster to build, but slower at runtime.

**Mergeable libraries** are a newer Xcode feature (Xcode 15 and later) that lets you **skip that choice**. Dynamic frameworks can be **merged into the main app** for release builds.

```plaintext
Development builds: modules are linked dynamically
                     → fast rebuilds when only one module changes
Release builds:      mergeable libraries are merged into one binary
                     → the same launch speed as static linking
```

You get the best of both:

- **While you develop:** only the module you changed needs to be relinked, so builds are fast.
- **For the app you ship:** everything is merged into one binary, so users get fast launch times.

This is useful for large apps with many modules, where both build time and launch time matter a lot. You turn it on in Xcode's build settings, not in your Swift code.

---

## 48.10 Tuist: Swift-Defined Projects 🟡

**Tuist** is a popular **third-party** tool. It **generates your Xcode project** from a description written in Swift, so you don't edit the `.xcodeproj` file by hand. This makes large projects with many modules easier to maintain.

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

The workflow:

1. You describe targets and dependencies in `Project.swift` (plain Swift).
2. You run `tuist generate`.
3. Tuist creates the `.xcodeproj` for you, and you open it in Xcode as usual.

**Why?** A `.xcodeproj` file is a complex, hard-to-read format. Merging changes to it is painful when many people edit it. It is the same kind of problem as the Interface Builder merge conflicts in 35.4, but for project settings instead of screens.

With Tuist, the description is normal Swift code. You can read it, compare it, and merge it like any other source file. The `.xcodeproj` is **generated** from it, so it is no longer the source of truth that people edit and merge.

**The cost:** it is one more tool for your team to learn and keep working. It pays off mostly on large projects with many modules and many contributors.

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

An example: you change one line in `RecipeFeature`. Without caching, the build may recompile many modules. With caching, only `RecipeFeature` (and the modules that depend on it) are compiled, and the rest come from the cache.

**Caching** cuts the build time that made the linking trade-offs in 48.8 matter. If an unchanged module can be reused from the cache, much of static linking's slow-build downside goes away in practice.

**Graph analysis** helps you find circular dependencies (48.7) and unwanted coupling. You can see and check the real structure, instead of keeping a growing web of modules in your head.

---

## 48.12 Managing a 50+ Module Build Graph 🔴

With 50 or more modules (common at large companies), managing the module graph becomes **its own job**. You need good tools (like Tuist), rules about which layers may depend on which, and regular cleanup so the graph does not turn into a tangle.

A typical **layer rule** looks like this (an arrow means "may depend on"):

```plaintext
Feature modules  ──►  Domain modules  ──►  Shared / Core modules
(screens)             (business logic)      (models, utilities)

Not allowed:  a Feature module depending on another Feature module,
              or any module depending on a layer above it.
```

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

**Bazel** is Google's open-source build system. Some of the largest iOS codebases use it **instead of Xcode's own build system**. They are often a **monorepo**: one repository shared by iOS, Android, web, and backend code. Bazel gives up Xcode's simplicity in return for reliable, repeatable builds and caching that scale far beyond what Swift Package Manager or Tuist handle comfortably.

```python
# BUILD.bazel (Bazel's project format, written in Starlark, not Swift)
swift_library(
    name = "RecipeFeature",
    srcs = glob(["Sources/**/*.swift"]),
    deps = ["//SharedModels"],
)
```

What makes Bazel special is **hermetic, reproducible builds**. *Hermetic* means a build depends only on its declared inputs, so the same inputs always give the same result, on any machine. This allows very fine-grained caching, down to single compilation units. The cache can be shared across a whole company's build servers, not just one developer's laptop.

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
| `package` access | Visible in the same package, hidden outside | A middle level between `internal` and `public` |
| Circular dependencies | The build fails with a cycle | Move shared code into a lower-level module |
| Linking | Static (faster launch) vs. dynamic (faster rebuilds) | Choose by module count and goals |
| Mergeable libraries | Dynamic for development, merged for release | The best of both linking types |
| Tuist projects | A project described in Swift | Avoid `.xcodeproj` merge pain |
| Tuist caching and graph | Binary cache, graph view | Tools for many modules |
| 50+ modules | Automatic rule checks, graph audits | Stop accidental coupling at scale |
| Bazel | Reproducible builds, shared caches | Only for huge multi-platform codebases |
