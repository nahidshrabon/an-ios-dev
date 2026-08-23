## 73.1 Adding a Package Dependency

Adding a Swift package dependency (via Xcode's File > Add Package Dependencies, or directly in `Package.swift` for a package target) requires specifying the package's source URL and a version requirement — SPM then resolves, downloads, and integrates the package's products directly into the build, with no separate installation step or workspace file management required.

```swift
// In Package.swift, or via Xcode's Add Package Dependencies dialog:
dependencies: [
    .package(url: "https://github.com/apple/swift-collections.git", from: "1.0.0")
]
```

SPM's tight, native integration into both Xcode and the Swift toolchain directly is a meaningful contrast to the separate-tool model of dependency managers like CocoaPods (73.13) — there's no separate `pod install` step generating a distinct `.xcworkspace`, no Ruby toolchain dependency, and no separately-maintained Podfile syntax to learn, since SPM dependency resolution and integration is simply part of Xcode's own normal build process, using the same `Package.swift` manifest format used for building actual Swift packages themselves.

---

## 73.2 Version Rules and Package.resolved

SPM supports several version requirement styles (`.exact`, `.upToNextMajor` via `from:`, `.upToNextMinor`, a specific range) expressing how strictly a dependency's version should be pinned, while `Package.resolved` records the *exact* specific versions actually resolved and used for a given build — ensuring reproducible builds across different machines and CI runs rather than each build potentially resolving to different compatible versions.

```swift
.package(url: "https://github.com/apple/swift-collections.git", from: "1.0.0")
// Version requirement: "1.0.0 or any later version up to (but not including) 2.0.0"
// Package.resolved records the ACTUAL specific version resolved, e.g., "1.1.4",
// ensuring every build/checkout uses that exact version until Package.resolved is updated
```

`Package.resolved` should genuinely be committed to version control for an application project (though this guidance differs for a library package meant to be consumed by others, which typically shouldn't commit it) — without it, two different developers (or a developer and CI) resolving the same flexible version requirement (`from: "1.0.0"`) at different points in time could genuinely resolve to different actual versions if a new compatible release was published in between, producing exactly the kind of "works on my machine" inconsistency that `Package.resolved`'s exact-version pinning specifically exists to prevent.

---

## 73.3 Creating Your Own Package

Creating a new Swift package (`swift package init`, or via Xcode's File > New > Package) scaffolds a standard package directory structure — a `Package.swift` manifest, `Sources/` containing the actual code organized by target, and `Tests/` for the package's own test suite — appropriate both for genuinely reusable, shareable code and for internal modularization within a larger app project (recall the modularization principles from section 48).

```plaintext
MyFeaturePackage/
├── Package.swift
├── Sources/
│   └── MyFeaturePackage/
│       └── MyFeaturePackage.swift
└── Tests/
    └── MyFeaturePackageTests/
        └── MyFeaturePackageTests.swift
```

Creating internal packages purely for a single app's own modularization (rather than genuine external sharing) is a legitimate, increasingly common practice directly connecting back to section 48's modularization discussion — a local Swift package enforces genuinely clean module boundaries and explicit public API surfaces between an app's own internal features in a way that simply organizing code into folders within one large app target cannot enforce nearly as strictly, since folder organization provides no actual compiler-enforced separation the way distinct package targets genuinely do.

---

## 73.4 Package.swift Anatomy: Targets and Products

A `Package.swift` manifest defines targets (units of source code compiled together, potentially including test targets) and products (what a package actually exposes for consumption — a library bundling one or more targets, or an executable) — with a package's internal target structure not necessarily identical to what it publicly exposes as products.

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MyFeaturePackage",
    products: [
        .library(name: "MyFeaturePackage", targets: ["MyFeaturePackage"])
    ],
    targets: [
        .target(name: "MyFeaturePackage", dependencies: ["MyFeatureCore"]),
        .target(name: "MyFeatureCore"),  // internal target, not directly exposed as a product
        .testTarget(name: "MyFeaturePackageTests", dependencies: ["MyFeaturePackage"])
    ]
)
```

The distinction between targets and products matters for genuine API surface control — a package can have several internal targets (like `MyFeatureCore` above) that other targets within the same package depend on, without those internal targets ever being exposed as a consumable product to external package consumers, letting a package author freely refactor internal target organization without that internal restructuring becoming a breaking change for anyone actually depending on the package's public products.

---

## 73.5 Package Resources and Bundles

Beyond Swift source code, package targets can include resources (images, JSON data files, `.xcstrings` String Catalogs, recall section 71.1) via the `resources:` parameter, with SPM generating a `Bundle.module` accessor letting a target's own code load its bundled resources correctly regardless of how the package is ultimately consumed.

```swift
.target(
    name: "MyFeaturePackage",
    resources: [.process("Resources/")]
)

// In the target's own source code:
let image = UIImage(named: "icon", in: .module, compatibleWith: nil)
```

`Bundle.module`'s genuine value is providing a reliable, consistent way to locate a package's own bundled resources regardless of the specific, sometimes complex ways a package might ultimately be integrated into a consuming app (statically linked, dynamically linked, as part of an XCFramework) — without this generated accessor, correctly locating a package's bundled resources at runtime across all these different possible integration scenarios would otherwise require considerably more manual, error-prone bundle-path logic within the package's own code.

---

## 73.6 Local Package Development

For actively developing a package alongside the app that consumes it, Xcode supports adding a local package dependency by path (rather than a remote URL) — letting changes made to the package's source be immediately reflected in the consuming app's build without needing to publish a new version, push to a remote repository, or update any version requirement.

```swift
// Adding a local, in-development package as a dependency:
dependencies: [
    .package(path: "../MyFeaturePackage")
]
```

This local-path dependency pattern is genuinely essential for the internal-modularization use case described in 73.3 — an app actively developing a feature within its own local package needs to see source changes reflected immediately during normal development iteration, and only once that package's API is genuinely stable would a team typically switch the dependency to a proper versioned, remote reference (appropriate for genuine external sharing or when the package's own release cadence should be decoupled from the consuming app's own development cycle).

---

## 73.7 Evaluating a Dependency Before Adding It

Before adding a third-party package dependency, worthwhile evaluation criteria include the package's actual maintenance activity (recent commits, responsive issue handling), its own dependency footprint (does it pull in a large, potentially conflicting dependency tree of its own), license compatibility, and genuine necessity (could the needed functionality reasonably be implemented directly rather than taking on an external dependency at all).

```plaintext
// Practical evaluation checklist before adding a dependency:
// - Is it actively maintained, or effectively abandoned?
// - What license does it use, and is that compatible with the project's own licensing?
// - How large is its own transitive dependency tree?
// - Does the functionality genuinely warrant an external dependency,
//   or would implementing the specific needed functionality directly be simpler and safer?
```

Every dependency added represents a genuine, ongoing maintenance liability, not merely a one-time convenience — an unmaintained dependency can eventually become a genuine security or compatibility risk (failing to support a new Swift language mode, or containing an unpatched vulnerability with no active maintainer to address it), meaning the evaluation discipline described here is a legitimate, worthwhile investment of time before adding a dependency, not merely bureaucratic caution, since removing an already-deeply-integrated dependency later is considerably more costly than carefully evaluating it before initial adoption.

---

## 73.8 Binary Targets and XCFrameworks 🟠

Binary targets let a package distribute pre-compiled binary code (an `.xcframework`, bundling compiled code for multiple platforms/architectures into one distributable unit) rather than Swift source, appropriate for distributing closed-source SDKs or for packages wanting to avoid exposing their own source code while still integrating cleanly through SPM's standard dependency mechanism.

```swift
.binaryTarget(
    name: "MySDK",
    url: "https://example.com/MySDK.xcframework.zip",
    checksum: "abc123..."
)
```

The required `checksum` parameter is a genuinely important security measure specific to binary targets — because a binary target's actual compiled code can't be reviewed the way source code can (there's no source to actually read and audit), the checksum ensures the downloaded binary hasn't been tampered with or corrupted since the package manifest was published, providing at least a baseline integrity guarantee for exactly the kind of dependency (closed-source, unreviewable binary code) that otherwise carries meaningfully less transparency than a typical open-source SPM dependency.

---

## 73.9 SPM Build Plugins 🟠

Build plugins extend SPM's own build process — running custom code generation, linting, or other build-time tooling automatically as an integrated part of a package's build, conceptually similar to Xcode's Run Script build phases (section 72.5) but expressed as a proper, distributable Swift package plugin rather than an ad hoc shell script.

```swift
// Package.swift plugin declaration (conceptual):
.plugin(name: "MyCodeGenPlugin", capability: .buildTool())
// The plugin's own executable target runs during the build,
// generating source files consumed by the rest of the package's build
```

Build plugins provide a meaningfully more portable, versioned, and shareable alternative to a project-specific Run Script phase — rather than every project needing to independently write and maintain its own linting or code-generation shell script (as with a Run Script phase), a build plugin can be published and versioned as its own proper SPM package, letting multiple projects share genuinely identical, versioned build tooling rather than each maintaining its own slightly-divergent copy of similar shell script logic.

---

## 73.10 SPM Command Plugins 🟠

Command plugins provide custom, user-invoked commands (rather than build plugins' automatic, every-build execution) — run explicitly via `swift package <plugin-command>` or from within Xcode's own package plugin menu, appropriate for tooling a developer wants to run on demand (generating a report, formatting code, running a one-off migration) rather than automatically on every build.

```bash
# Invoking a command plugin explicitly, on demand:
swift package generate-documentation
swift package format-source-code
```

The distinction between build plugins (73.9) and command plugins reflects a genuine difference in intended invocation frequency and purpose — a build plugin's automatic, every-build execution is appropriate for tooling that genuinely must run continuously to keep the build correct (like ongoing code generation a build depends on), while a command plugin's on-demand invocation suits tooling a developer wants to run deliberately and occasionally (like generating documentation or applying a one-time formatting pass) rather than paying that tooling's execution cost on every single build.

---

## 73.11 Package Traits 🟠

Package traits let a package define optional, consumer-selectable feature flags that conditionally include additional dependencies or source code — letting a consuming project opt into (or out of) specific optional functionality and its associated dependency footprint, rather than a package being forced to either always include or never include a given optional capability.

```swift
// Conceptual trait declaration, letting a consumer opt into optional functionality:
.target(
    name: "MyPackage",
    dependencies: [
        .target(name: "OptionalLoggingSupport", condition: .when(traits: ["EnableLogging"]))
    ]
)
```

Traits address a genuine tension in package design between functionality breadth and dependency minimalism — without traits, a package author faces an awkward choice between omitting a genuinely useful but not universally-needed capability entirely, or including it (and its own dependencies) unconditionally for every consumer regardless of whether they actually need it, while traits let a package offer that optional capability without forcing its dependency footprint onto consumers who have no actual need for it.

---

## 73.12 Private Registries and Mirrors 🔴

Beyond public packages hosted on GitHub or similar, organizations can run private package registries (hosting internal, proprietary packages not meant for public distribution) or configure dependency mirrors (redirecting a public package's resolution to an internal, cached copy) — appropriate for organizations needing to distribute genuinely internal code via the same standard SPM mechanism, or wanting resilience against a public package source becoming temporarily unavailable.

```swift
// A registry-based dependency, resolved against a configured private registry
// rather than a direct git URL, appropriate for internal, proprietary packages:
.package(id: "my-org.internal-package", from: "1.0.0")
```

Private registries let an organization apply the exact same dependency management discipline (versioning, `Package.resolved` pinning, section 73.2) to genuinely internal, proprietary code that it would apply to any public open-source dependency — rather than internal shared code needing some entirely separate, ad hoc distribution mechanism, it can be consumed through the identical, standard SPM dependency workflow already used throughout the rest of a project, just pointed at an internal registry instead of a public one.

---

## 73.13 Migrating Off CocoaPods 🟠

For projects still using CocoaPods (an older, widely-used third-party dependency manager predating SPM's maturity), migrating to SPM is typically an incremental process — replacing CocoaPods-managed dependencies with their SPM equivalents one at a time where available, removing the corresponding `Podfile` entries and generated `.xcworkspace` dependency, until CocoaPods can eventually be removed from the project entirely.

```plaintext
// Incremental migration approach:
// 1. Identify which CocoaPods dependencies have SPM equivalents available
// 2. Migrate them one at a time: add via SPM, remove the corresponding Podfile entry, verify the build
// 3. Repeat until either all pods are migrated, or only genuinely SPM-unavailable pods remain
// 4. For remaining SPM-unavailable pods, evaluate alternatives or continue CocoaPods usage for just those
```

This incremental, one-dependency-at-a-time approach reflects the same opportunistic migration philosophy already established for XCTest-to-Swift-Testing (section 65.17) — rather than a disruptive, all-at-once migration attempting to replace every CocoaPods dependency simultaneously (a genuinely risky, hard-to-verify undertaking for a project with many dependencies), migrating incrementally lets each individual replacement be verified working correctly before moving to the next, meaningfully reducing the risk of a broad, hard-to-diagnose regression introduced by attempting the entire migration in one large, unverified step.

---

## Summary

| Concept | Key Mechanism | Purpose |
|---|---|---|
| Native integration | Xcode's Add Package Dependencies | No separate tool, workspace, or toolchain needed |
| Reproducible builds | Version rules, `Package.resolved` | Exact, pinned versions across machines and CI |
| Package scaffolding | `swift package init` | Standard structure for reusable or internal modules |
| API surface control | Targets vs. products | Internal restructuring without breaking consumers |
| Bundled resources | `resources:`, `Bundle.module` | Reliable resource loading across integration scenarios |
| Iterative development | Local path dependencies | Immediate source-change reflection without publishing |
| Dependency discipline | Maintenance/license/necessity evaluation | Avoids long-term liability from careless adoption |
| Closed-source distribution | Binary targets, checksums | Integrity guarantee for unreviewable compiled code |
| Automatic tooling | Build plugins | Portable, versioned, shareable build-time automation |
| On-demand tooling | Command plugins | Deliberate, occasional invocation vs. every-build cost |
| Optional functionality | Package traits | Opt-in capability without forcing dependency footprint |
| Internal distribution | Private registries, mirrors | Standard SPM workflow for proprietary/internal code |
| Legacy migration | Incremental CocoaPods replacement | Risk-managed, one-dependency-at-a-time transition |
