**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 73.1 Adding a Package Dependency 🟢

**Swift Package Manager (SPM)** is built into Xcode and Swift. To add a library, give its **URL** and a **version rule**. SPM downloads it and adds it to the build. There is no separate install step.

```swift
// In Package.swift, or via Xcode's Add Package Dependencies dialog:
dependencies: [
    .package(url: "https://github.com/apple/swift-collections.git", from: "1.0.0")
]
```

In Xcode: **File → Add Package Dependencies**, paste the URL, choose a version rule, and pick your target.

In a `Package.swift`, also tell the target **which product** it uses:

```swift
.target(
    name: "RecipeFeature",
    dependencies: [
        .product(name: "Collections", package: "swift-collections")
    ]
)
```

```swift
import Collections

var recent = Deque<String>()      // now you can use the library's types
```

Compared with CocoaPods (73.13): no `pod install`, no extra `.xcworkspace`, and no Ruby. SPM uses the same `Package.swift` format that packages themselves use.

---

## 73.2 Version Rules and Package.resolved 🟢

A **version rule** says which versions you accept. **`Package.resolved`** records the **exact version** that was really used, so every machine builds the same thing.

```swift
.package(url: "https://github.com/apple/swift-collections.git", from: "1.0.0")
// Version requirement: "1.0.0 or any later version up to (but not including) 2.0.0"
// Package.resolved records the ACTUAL specific version resolved, e.g., "1.1.4",
// ensuring every build/checkout uses that exact version until Package.resolved is updated
```

All the version rules:

```swift
.package(url: url, from: "1.2.0")                        // 1.2.0 up to, not including, 2.0.0
.package(url: url, .upToNextMinor(from: "1.2.0"))        // 1.2.0 up to, not including, 1.3.0
.package(url: url, exact: "1.2.3")                       // only 1.2.3
.package(url: url, "1.2.0"..<"1.5.0")                    // a custom range
.package(url: url, branch: "main")                       // a branch (avoid in apps)
```

Useful commands:

```bash
swift package resolve         # resolve versions, using Package.resolved if it exists
swift package update          # move to the newest versions the rules allow
swift package show-dependencies
```

**Commit `Package.resolved` for an app.** Otherwise two developers, or a developer and CI, could get **different versions** if a new release came out in between. That is the classic "works on my machine" problem. (A library meant for others usually does not commit it.)

---

## 73.3 Creating Your Own Package 🟢

`swift package init` (or **File → New → Package** in Xcode) creates a package with the standard folders:

```bash
mkdir MyFeaturePackage && cd MyFeaturePackage
swift package init --type library
```

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

Build and test it on its own:

```bash
swift build
swift test
```

A package is good for **code you share** between apps, and also for **splitting up one app** into modules (section 48). A package gives a **real boundary**: other code only sees what you mark `public`. Folders inside one target cannot give you that.

---

## 73.4 Package.swift Anatomy: Targets and Products 🟡

A `Package.swift` has:

- **Targets:** groups of source files that are compiled together. Test targets are targets too.
- **Products:** what the package **shows to the outside**, for example a library made of one or more targets.

Not every target has to be a product.

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

```plaintext
Outside users can import:   MyFeaturePackage        (it is a product)
Outside users cannot see:   MyFeatureCore           (only used inside the package)
```

Why it matters: you can **split or rename internal targets** later, and it is **not a breaking change** for people who use your package. They only depend on the products. (Section 48.2 explains package, target, and product in more detail.)

---

## 73.5 Package Resources and Bundles 🟡

A package target can include **resources**: images, JSON files, String Catalogs (section 71.1). SPM generates **`Bundle.module`**, so the target's code can always find its own files.

```swift
.target(
    name: "MyFeaturePackage",
    resources: [.process("Resources/")]
)

// In the target's own source code:
let image = UIImage(named: "icon", in: .module, compatibleWith: nil)
```

Two ways to add resources:

```swift
resources: [
    .process("Resources/"),           // Xcode may optimize them (images, catalogs)
    .copy("Data/seed.json"),          // copied exactly as they are
]
```

Load them with `Bundle.module`:

```swift
// SwiftUI image from the package
Image("icon", bundle: .module)

// A JSON file from the package
let url = Bundle.module.url(forResource: "seed", withExtension: "json")!
let data = try Data(contentsOf: url)
```

**Always use `Bundle.module`**, not `Bundle.main`. A package can be linked in different ways (static, dynamic, inside an XCFramework), and `Bundle.module` finds the files in every case.

---

## 73.6 Local Package Development 🟢

While you build a package together with your app, add it **by path**, not by URL. Changes show up **immediately** in the app. You do not publish a version or push anything.

```swift
// Adding a local, in-development package as a dependency:
dependencies: [
    .package(path: "../MyFeaturePackage")
]
```

In Xcode: **File → Add Package Dependencies → Add Local**, then choose the folder.

This is how the app modules in section 48 work. Switch to a **versioned URL** only when the package is stable and should have its own release schedule, for example when other apps use it too.

---

## 73.7 Evaluating a Dependency Before Adding It 🟢

**Every dependency is a long-term cost**, not just a quick win. Check it before you add it.

```plaintext
// Practical evaluation checklist before adding a dependency:
// - Is it actively maintained, or effectively abandoned?
// - What license does it use, and is that compatible with the project's own licensing?
// - How large is its own transitive dependency tree?
// - Does the functionality genuinely warrant an external dependency,
//   or would implementing the specific needed functionality directly be simpler and safer?
```

See what it would pull in:

```bash
swift package show-dependencies --format json     # the whole tree, including its dependencies
```

Why it matters: an abandoned dependency can become a **security or compatibility risk**. It might never support a new Swift version, or keep a bug with no one to fix it. Removing a dependency that is used everywhere is **much harder** than checking it first.

---

## 73.8 Binary Targets and XCFrameworks 🟡

A **binary target** ships **compiled code** instead of source code, as an **`.xcframework`**. An XCFramework holds builds for several platforms and chip types in one bundle. It is common for **closed-source SDKs**.

```swift
.binaryTarget(
    name: "MySDK",
    url: "https://example.com/MySDK.xcframework.zip",
    checksum: "abc123..."
)
```

Create the checksum for the zip file:

```bash
swift package compute-checksum MySDK.xcframework.zip
```

During development, you can also point to a local file:

```swift
.binaryTarget(name: "MySDK", path: "Frameworks/MySDK.xcframework")
```

**Why the checksum is required:** you cannot read compiled code, so you cannot review it. The checksum makes sure the downloaded file was **not changed or damaged** since the manifest was published.

---

## 73.9 SPM Build Plugins 🔴

A **build plugin** runs **during every build**, for example to generate code or run a linter. It is like Xcode's Run Script phase (section 72.5), but it is a real, versioned Swift package that many projects can share.

```swift
// Package.swift plugin declaration (conceptual):
.plugin(name: "MyCodeGenPlugin", capability: .buildTool())
// The plugin's own executable target runs during the build,
// generating source files consumed by the rest of the package's build
```

A target turns the plugin on:

```swift
.target(
    name: "RecipeFeature",
    plugins: [.plugin(name: "MyCodeGenPlugin")]
)
```

The plugin itself returns the commands to run:

```swift
import PackagePlugin

@main
struct MyCodeGenPlugin: BuildToolPlugin {
    func createBuildCommands(context: PluginContext, target: Target) async throws -> [Command] {
        let output = context.pluginWorkDirectoryURL.appending(path: "Generated.swift")
        return [
            .buildCommand(
                displayName: "Generate code",
                executable: try context.tool(named: "CodeGenerator").url,
                arguments: [output.path()],
                outputFiles: [output]          // the build compiles this generated file
            )
        ]
    }
}
```

**Plugin vs. Run Script:** a Run Script is a shell script copied into each project, and the copies slowly drift apart. A plugin is **published and versioned once**, and every project uses the same version.

---

## 73.10 SPM Command Plugins 🟡

A **command plugin** runs **only when you ask**, not on every build. Use it for things like formatting code, generating documentation, or a one-time migration.

```bash
# Invoking a command plugin explicitly, on demand:
swift package generate-documentation
swift package format-source-code
```

List the commands you can run:

```bash
swift package plugin --list
```

Declaring one, with permission to change files:

```swift
.plugin(
    name: "FormatPlugin",
    capability: .command(
        intent: .custom(verb: "format-source-code", description: "Format all Swift files"),
        permissions: [.writeToPackageDirectory(reason: "Rewrites source files")]
    )
)
```

| | Build plugin (73.9) | Command plugin |
|---|---|---|
| When it runs | Every build, automatically | Only when you run it |
| Good for | Code the build needs | Formatting, docs, one-off jobs |
| Cost | Adds time to every build | Only when used |

---

## 73.11 Package Traits 🔴

**Traits** are **optional features** of a package. The user of the package can turn a feature on, and only then get its extra code and dependencies.

```swift
// Conceptual trait declaration, letting a consumer opt into optional functionality:
.target(
    name: "MyPackage",
    dependencies: [
        .target(name: "OptionalLoggingSupport", condition: .when(traits: ["EnableLogging"]))
    ]
)
```

The package declares its traits:

```swift
let package = Package(
    name: "MyPackage",
    traits: [
        .trait(name: "EnableLogging", description: "Adds detailed logging"),
    ],
    // ...
)
```

The code can check if the trait is on:

```swift
#if EnableLogging
logger.debug("Loaded \(items.count) items")
#endif
```

The user of the package turns it on:

```swift
.package(url: "https://github.com/example/MyPackage.git", from: "1.0.0", traits: ["EnableLogging"])
```

Without traits, a package author must choose: **leave a useful feature out**, or **force its dependencies on everyone**. Traits avoid both.

---

## 73.12 Private Registries and Mirrors 🔴

Two tools for companies:

- **Private registry:** a server that hosts **your company's internal packages**, which are not public.
- **Mirror:** sends a public package's download to **your own copy**, so builds still work if the public source is down.

```swift
// A registry-based dependency, resolved against a configured private registry
// rather than a direct git URL, appropriate for internal, proprietary packages:
.package(id: "my-org.internal-package", from: "1.0.0")
```

Set them up from the terminal:

```bash
# Use a private registry, and log in to it
swift package-registry set https://packages.example.com
swift package-registry login https://packages.example.com

# Download swift-collections from an internal mirror instead of GitHub
swift package config set-mirror \
    --original https://github.com/apple/swift-collections.git \
    --mirror https://git.example.com/mirrors/swift-collections.git
```

With a registry, internal code gets the **same workflow** as any public package: versions, `Package.resolved` (73.2), and the normal SPM commands. You do not need a separate, custom way to share it.

---

## 73.13 Migrating Off CocoaPods 🟡

**CocoaPods** is an older, third-party dependency manager. Move to SPM **one dependency at a time**:

```plaintext
// Incremental migration approach:
// 1. Identify which CocoaPods dependencies have SPM equivalents available
// 2. Migrate them one at a time: add via SPM, remove the corresponding Podfile entry, verify the build
// 3. Repeat until either all pods are migrated, or only genuinely SPM-unavailable pods remain
// 4. For remaining SPM-unavailable pods, evaluate alternatives or continue CocoaPods usage for just those
```

One step looks like this:

```ruby
# Podfile: remove the line for the library you moved
# pod 'Alamofire', '~> 5.9'
```

```bash
pod install                 # update the workspace without that pod
# Then add the same library with File → Add Package Dependencies, and build
```

When no pods are left, remove CocoaPods completely:

```bash
pod deintegrate             # removes CocoaPods from the Xcode project
rm Podfile Podfile.lock
rm -rf Pods MyApp.xcworkspace
```

Moving **one at a time** means you can check that each change works before the next. Changing everything at once makes a problem very hard to find. It is the same idea as moving from XCTest to Swift Testing bit by bit (section 65.17).

---

## Summary

| Concept | Key Mechanism | Purpose |
|---|---|---|
| Adding a dependency | URL and version rule | Built into Xcode and Swift |
| Exact versions | Version rules, `Package.resolved` | Same versions on every machine and in CI |
| A new package | `swift package init` | Shared code or app modules |
| Targets vs. products | Products are the public part | Change internals without breaking users |
| Resources | `resources:`, `Bundle.module` | Find package files in every setup |
| Local packages | `.package(path:)` | See changes right away |
| Choosing dependencies | Maintenance, license, size, need | Avoid long-term risk |
| Binary targets | `.xcframework` and a checksum | Ship compiled code safely |
| Build plugins | Run on every build | Shared, versioned build tools |
| Command plugins | Run when you ask | Formatting, docs, one-off jobs |
| Traits | Optional features | Extra code only for those who want it |
| Registries and mirrors | Internal packages, own copies | Company code with the normal workflow |
| Leaving CocoaPods | One dependency at a time | Safe, step-by-step migration |
