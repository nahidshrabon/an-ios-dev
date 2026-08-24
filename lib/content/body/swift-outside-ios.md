Everything up to this point has treated Swift as the language you use to build an app that runs on Apple hardware. That framing was never the whole truth. Swift was designed from the start as a general-purpose systems language, and its story since roughly 2017 has been one of steady expansion beyond Apple's platforms: a real server-side ecosystem, first-class Linux support, a toolchain that targets WebAssembly, and a subset — Embedded Swift — that runs without a heap on microcontrollers. This section is a tour of that wider world. It won't make you a backend engineer or an embedded systems expert in one sitting, but it will give you enough working vocabulary and hands-on familiarity to know when reaching for Swift outside the app makes sense, and when it doesn't.

The throughline across this section is one you've seen before, recast in a new setting: the same language, the same type system, the same discipline around concurrency and error handling, applied to environments that don't have UIKit, SwiftUI, or even Foundation as you know it. Recognizing what's the same and what's genuinely different is the skill this section builds.

## 81.1 Server-side Swift with Vapor: your first route

Vapor is the most established web framework in the Swift server ecosystem, and it's the natural on-ramp if you already think in Swift and want to write a backend without switching languages. A minimal Vapor application starts an HTTP server and registers routes:

```swift
import Vapor

let app = try await Application.make(.detect())

app.get("hello") { req async throws -> String in
    "Hello, world!"
}

app.get("users", ":id") { req async throws -> User in
    guard let id = req.parameters.get("id", as: Int.self) else {
        throw Abort(.badRequest)
    }
    return try await User.find(id, on: req.db)
        .flatMap { user in
            guard let user else { throw Abort(.notFound) }
            return user
        }
}

try await app.execute()
```

Two things should feel immediately familiar and one thing should feel new. Familiar: the route closures are `async throws`, using exactly the structured concurrency you learned in section 17 and section 18 — there's no callback-based networking API to relearn. Familiar: `Abort` is just a typed error you throw, following the same error-handling model from section 9. New: the request (`req`) is your window into everything ambient that a web framework provides — the database connection, the incoming HTTP body, route parameters, logging — because unlike an iOS app, a server has no persistent UI-driven object graph; every request is a fresh, isolated unit of work that must fetch or construct whatever context it needs.

That "everything starts fresh per request" model is the single biggest mental shift moving from app development to server development. An iOS app's `AppDelegate` or `App` struct lives for the lifetime of the process, holding onto singletons and caches you set up once. A Vapor route handler runs concurrently with dozens or hundreds of other invocations of itself, on a per-request basis, and should not assume any shared mutable state beyond what's explicitly passed through `req` or held in a properly synchronized service.

## 81.2 Vapor: routing, middleware, and Fluent

Vapor's routing system supports grouping, parameters, and route-specific middleware:

```swift
let api = app.grouped("api", "v1")
let protected = api.grouped(UserAuthenticator())

protected.get("profile") { req async throws -> ProfileResponse in
    let user = try req.auth.require(User.self)
    return ProfileResponse(from: user)
}

protected.post("posts") { req async throws -> Post in
    let input = try req.content.decode(CreatePostRequest.self)
    let post = Post(title: input.title, body: input.body, authorID: try req.auth.require(User.self).requireID())
    try await post.save(on: req.db)
    return post
}
```

Middleware in Vapor plays the same role interceptors or decorators play in other server frameworks: a piece of logic that wraps every request passing through a route group, commonly used for authentication, logging, or rate limiting. This is conceptually the same "wrap behavior around a boundary without touching the business logic" pattern you saw with URLSession's `URLProtocol` or interceptors in section 40's advanced networking material — different layer, same idea of cross-cutting concerns kept separate from route logic.

Fluent is Vapor's ORM, and it should feel like a distant cousin of SwiftData from section 41: models are Swift types conforming to a protocol (`Model`), fields are declared with property wrappers (`@Field`, `@Parent`, `@Children`), and queries are built with a fluent (no pun intended, mostly) API:

```swift
final class Post: Model, Content {
    static let schema = "posts"

    @ID(key: .id) var id: UUID?
    @Field(key: "title") var title: String
    @Field(key: "body") var body: String
    @Parent(key: "author_id") var author: User

    init() {}
}

let recentPosts = try await Post.query(on: req.db)
    .filter(\.$title != "")
    .sort(\.$id, .descending)
    .limit(20)
    .all()
```

The relationship property wrappers (`@Parent`, `@Children`, `@Siblings`) map directly onto the same conceptual relationships (`@Relationship` in SwiftData, or `NSManagedObject` relationships in Core Data from section 42) — a one-to-many or many-to-many association expressed declaratively rather than through manually managed foreign keys. If you're comfortable with SwiftData's model layer, Fluent's vocabulary will not feel foreign, even though the underlying database is a real Postgres or MySQL instance rather than an on-device SQLite file.

## 81.3 Hummingbird as a lighter alternative

Hummingbird is a newer, more minimal server framework built directly on SwiftNIO, positioning itself as a lighter-weight alternative to Vapor's more batteries-included approach. Where Vapor bundles routing, an ORM, templating, and a broad plugin ecosystem, Hummingbird deliberately keeps its core small and composable:

```swift
import Hummingbird

let router = Router()
router.get("/hello") { request, context in
    "Hello, world!"
}

let app = Application(router: router, configuration: .init(address: .hostname("127.0.0.1", port: 8080)))
try await app.runService()
```

The trade-off is genuinely about scope, not quality: Vapor gives you Fluent, Leaf templating, and a large existing ecosystem of third-party packages out of the box, which is valuable if you want a complete, opinionated stack quickly. Hummingbird gives you a smaller core with fewer built-in opinions, which is valuable if you want tight control over exactly which dependencies end up in your binary, or if you're building something latency-sensitive where every layer of abstraction has a measurable cost. Neither is strictly "better" — the choice mirrors the same batteries-included-versus-minimal-core trade-off you've seen in other ecosystems (think of it as roughly analogous to choosing a full-featured framework versus a lean one in any other server language).

## 81.4 SwiftNIO event loops vs async/await

SwiftNIO is the low-level networking engine that both Vapor and Hummingbird are built on, and understanding its event-loop model clarifies a lot about how Swift's structured concurrency maps onto server workloads. SwiftNIO predates Swift's native `async`/`await` (introduced in section 17), and it's built around an explicitly callback- and future-based model: an `EventLoop` is a single thread running a run loop that processes I/O events and scheduled work, and a `EventLoopGroup` is a pool of such loops that connections get distributed across.

```swift
// SwiftNIO's native, pre-async/await style
let promise = eventLoop.makePromise(of: String.self)
someAsyncOperation { result in
    promise.succeed(result)
}
let future: EventLoopFuture<String> = promise.futureResult
future.whenSuccess { value in print(value) }
```

Modern Vapor and Hummingbird code, as seen in the earlier subtopics, is almost entirely `async`/`await` on the surface — Swift's concurrency runtime bridges to SwiftNIO's event loops underneath, so you rarely write `EventLoopFuture` code directly anymore. But the event loop model still matters conceptually: an event loop is deliberately a single thread handling many connections cooperatively, which is the same core insight as the cooperative thread pool behind Swift's structured concurrency task system from section 18 — never block the loop with synchronous, long-running work, because doing so starves every other connection sharing that loop. This is the server-side equivalent of the "never block the main thread" rule from UI development, just applied to whichever loop is currently serving a given connection rather than to the one thread responsible for rendering.

## 81.5 Sharing model code between app and server

One of the most concrete practical wins from using Swift on both ends of a client-server system is sharing model and validation code through a Swift package. A `Codable` struct representing an API request or response can live in a shared package, imported by both the Vapor server target and the iOS app target:

```swift
// SharedModels package, used by both server and iOS app
public struct CreatePostRequest: Codable, Sendable {
    public let title: String
    public let body: String

    public init(title: String, body: String) {
        self.title = title
        self.body = body
    }
}

public struct PostResponse: Codable, Sendable, Identifiable {
    public let id: UUID
    public let title: String
    public let body: String
    public let createdAt: Date
}
```

This directly extends the modularization discipline from section 48: a shared package with no platform-specific dependencies (no UIKit, no Vapor-specific imports) compiles cleanly for both an iOS target and a Linux server target, eliminating an entire category of bugs where the client's understanding of a JSON shape silently drifts from the server's. Validation logic — a password strength check, a date range validator — can live in this shared package too, guaranteeing the client and server enforce identical rules rather than maintaining two hand-synchronized implementations. The practical constraint is that the shared package must avoid Foundation APIs that behave differently or are unavailable on Linux (a concern the next subtopic addresses directly), and must avoid any Apple-platform-only import.

## 81.6 Swift on Linux and Foundation differences

Swift has been open source and Linux-supported since 2015, and the toolchain runs natively there — but Foundation on Linux is not byte-for-byte identical to Foundation on Apple platforms, because large parts of Apple's Foundation historically bridged to Objective-C runtime features and Core Foundation internals that don't exist on Linux. The open-source `swift-corelibs-foundation` project has closed most of these gaps over time, and Swift 6's Foundation rewrite (a pure-Swift implementation) has closed many more, but differences still surface in practice: certain `DateFormatter` locale behaviors, some `NSAttributedString` functionality tied to text layout, and select `FileManager` behaviors around extended attributes and permissions can differ subtly between platforms.

```swift
#if canImport(FoundationNetworking)
import FoundationNetworking  // URLSession lived here on older Linux toolchains
#endif

// A defensive pattern: know which platform-specific gaps you're guarding against
#if os(Linux)
// Linux-specific fallback or adjustment
#else
// Apple-platform behavior
#endif
```

The practical lesson is not "avoid Foundation on Linux" — it's "test the specific Foundation APIs your shared code actually uses on both platforms before assuming parity," particularly anything touching dates, locales, or file attributes. This is a direct extension of the platform-availability discipline from section 33's multiplatform SwiftUI material: there, `#if os(iOS)` guarded UI-layer differences between iPhone and Mac; here, the same conditional-compilation tool guards standard-library and Foundation-layer differences between Apple platforms and Linux.

## 81.7 The static Linux SDK

Deploying a Swift server binary historically meant either building on the exact same Linux distribution and version as your deployment target, or shipping a full Swift runtime alongside your binary — both of which added real friction to the "build once, deploy anywhere" story that's second nature in many other server ecosystems. The static Linux SDK addresses this directly: it lets you cross-compile a fully statically linked binary, with the Swift runtime and standard library baked in, from macOS (or another Linux host) targeting Linux, with no dependency on the runtime library versions installed on the deployment machine.

```bash
swift build --swift-sdk x86_64-swift-linux-musl \
  -c release
```

The resulting binary can be dropped into a minimal container image (even a `scratch`-based one, with nothing else installed) and will run without needing a matching Swift installation on the host. This matters enormously for deployment simplicity and container image size: a statically linked binary in a minimal base image starts faster, has a dramatically smaller attack surface, and sidesteps an entire class of "works on my machine, fails in the container" version-mismatch bugs. It's the server-side analog of static linking trade-offs you first encountered with library linking choices in section 72's build system material — trading a larger binary for fewer runtime dependencies, except here the "runtime environment" is an entire Linux distribution rather than a single app sandbox.

## 81.8 Swift for WebAssembly

Swift's WebAssembly (WASM) support lets Swift code run inside a browser or any WASM runtime, compiled to a portable bytecode format rather than native machine code. The primary framework here is SwiftWasm alongside the increasingly official `swift-sdk`-based WASM toolchain, and one common use case is rendering a full Swift UI layer in the browser via a bridging layer to the DOM:

```swift
import JavaScriptKit

let document = JSObject.global.document
var div = document.createElement("div")
div.innerText = "Hello from Swift, compiled to WebAssembly!"
_ = document.body.appendChild(div)
```

The realistic use cases today cluster around three areas: running existing Swift business logic (validation, calculations, a shared model layer from 81.5) inside a web frontend without a rewrite; building small interactive demos or tools that need to run in-browser without a server round-trip; and, more speculatively, full Swift-based web UI frameworks that are still maturing relative to the JavaScript ecosystem's incumbents. It's worth being honest about where this sits on the maturity curve: WASM toolchain support, debugging experience, and binary size are all considerably rougher than the native iOS or server toolchains covered earlier in this section, and choosing Swift-to-WASM today is a deliberate bet on an actively-developing target rather than a drop-in mature option.

## 81.9 Embedded Swift

Embedded Swift is a distinct compilation mode — not a separate language — that produces small, dependency-free binaries suitable for microcontrollers and other resource-constrained environments, by disabling or restricting features that require a full runtime: no heap-allocated existentials by default, no full reflection metadata, no Objective-C interop, and a compiled-away, statically-resolved generics model rather than one relying on runtime metadata.

```swift
// A representative Embedded Swift snippet: no Foundation, minimal runtime
@main
struct BlinkProgram {
    static func main() {
        while true {
            gpioSet(pin: 13, high: true)
            delay(milliseconds: 500)
            gpioSet(pin: 13, high: false)
            delay(milliseconds: 500)
        }
    }
}
```

The restrictions read as limitations, but each maps to a concrete reason: full generics and existentials in ordinary Swift lean on runtime metadata and dynamic dispatch machinery that assumes a heap and a reasonably capable OS underneath — none of which exists on a microcontroller running at kilohertz-to-megahertz clock speeds with kilobytes of RAM. Embedded Swift's response is to push as much resolution as possible to compile time: generics get fully specialized (monomorphized) rather than dispatched dynamically, and language features with an unavoidable runtime cost are simply unavailable in this mode. This is the same "static, ahead-of-time cost paid once at compile time, versus dynamic, ahead-of-time cost paid repeatedly at runtime" trade-off that runs through section 15's low-level Swift material, just pushed to its logical extreme in service of running on hardware with almost no room for any runtime cost at all.

## 81.10 `swift-log`, `swift-metrics`, `swift-service-lifecycle`

The Swift server ecosystem has converged on a small set of API-only packages that define common cross-cutting interfaces without dictating a specific backend implementation — `swift-log` for structured logging, `swift-metrics` for counters and gauges, and `swift-service-lifecycle` for coordinated startup and graceful shutdown across multiple long-running services in one process.

```swift
import Logging
import Metrics

let logger = Logger(label: "com.example.api")
logger.info("Request received", metadata: ["path": "\(req.url.path)", "method": "\(req.method)"])

let requestCounter = Counter(label: "http_requests_total")
requestCounter.increment()
```

The deliberate design choice — an API package separate from any specific backend — mirrors `URLSession`'s protocol-oriented design from section 39, or `os.Logger`'s structured logging model from section 68.19: you write against a stable interface (`Logger`, `Counter`), and a separate backend package (say, one that ships logs to a specific aggregation service, or exports metrics in Prometheus format) is swapped in at the composition root without touching any call site. `swift-service-lifecycle` extends this same separation-of-concerns instinct to process orchestration: instead of each service managing its own signal handling and shutdown ordering ad hoc, services conform to a common protocol and a shared lifecycle coordinator handles startup ordering, graceful shutdown on `SIGTERM`, and ensuring dependent services shut down in the right sequence — a genuinely different problem from anything an iOS app faces, since an app's process lifecycle is managed entirely by the OS rather than something your code orchestrates directly.

## 81.11 Cross-platform UI options and honest trade-offs

Given a Swift codebase and a desire to reach beyond iOS, there's a real, honest question of how to build the actual user interface. SwiftUI itself already runs on macOS, watchOS, tvOS, and visionOS with the platform-adaptive discipline from section 33 — but the question here is broader: what if the target is a genuinely non-Apple platform, like Android or the web?

A few real paths exist, each with real trade-offs worth naming plainly. Skip (from the SwiftUI-adjacent open-source ecosystem) compiles a SwiftUI-like syntax to native Android views via a Kotlin interop layer, letting a mostly-shared Swift codebase target Android with genuinely native rendering rather than a webview — but it requires buying into a specific, still-young toolchain and accepting that not every SwiftUI API has a Skip equivalent. Swift-to-WASM (from 81.8) can render UI in a browser, but with the mobile-versus-web maturity gap already noted. And a more conservative, widely-used pattern sidesteps the "one UI toolkit everywhere" question entirely: share the model layer, networking, and business logic (per 81.5) as a Swift package, while building genuinely separate, platform-native UI layers — SwiftUI for Apple platforms, Jetpack Compose for Android, a web framework for browsers — accepting three UI codebases in exchange for each one being fully idiomatic and fully supported on its platform.

There's no universally correct answer here, and being honest about that is the point of this subtopic. A small team building a single, tightly-scoped app might genuinely benefit from a shared-UI framework like Skip to avoid tripling UI work. A larger team building a flagship product on each platform might reasonably conclude that fully native, per-platform UI — accepting the duplication in exchange for zero compromise on any single platform's idioms and performance — is worth the extra work. Both are legitimate engineering decisions, and the right call depends on team size, target platform priorities, and how much the product's UI needs to feel truly native on each surface versus merely functional.

## Summary

| Subtopic | Core idea |
|---|---|
| 81.1 Vapor first route | Async route handlers per request; no persistent app-lifetime state by default |
| 81.2 Vapor routing/middleware/Fluent | Middleware wraps cross-cutting concerns; Fluent mirrors SwiftData's declarative model layer |
| 81.3 Hummingbird | Minimal, composable alternative to Vapor's batteries-included approach |
| 81.4 SwiftNIO event loops | Cooperative single-threaded loops underneath async/await; never block a loop |
| 81.5 Sharing model code | Shared Swift package eliminates client/server model drift |
| 81.6 Swift on Linux | Foundation has narrowing but real platform differences; test, don't assume parity |
| 81.7 Static Linux SDK | Fully static cross-compiled binaries simplify container deployment |
| 81.8 Swift for WebAssembly | Real but immature toolchain for running Swift logic or UI in-browser |
| 81.9 Embedded Swift | Compile-time-resolved subset of Swift for heapless, runtime-free microcontroller targets |
| 81.10 swift-log/metrics/service-lifecycle | API-only packages decoupling interface from backend implementation |
| 81.11 Cross-platform UI trade-offs | Shared logic plus native-per-platform UI is the conservative, often-correct default |
