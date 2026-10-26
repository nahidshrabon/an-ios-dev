**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Until now, Swift was the language for apps on Apple devices. But Swift is a **general-purpose language**. It also runs on **servers**, on **Linux**, in the **browser** (WebAssembly), and on tiny **microcontrollers** (Embedded Swift).

This section is a short tour. The language, the type system, `async`/`await`, and error handling stay the same. What changes is the **environment**: often there is no UIKit, no SwiftUI, and sometimes not even the Foundation you know.

## 81.1 Server-side Swift with Vapor: your first route 🟢

**Vapor** is the most popular web framework for Swift. With it, you can write a **backend in Swift** instead of learning another language. A small Vapor app starts an HTTP server and registers **routes** (a URL path plus the code that answers it):

```swift
import Vapor

let app = try await Application.make(.detect())

app.get("hello") { req async throws -> String in
    "Hello, world!"
}

app.get("users", ":id") { req async throws -> User in
    guard let id = req.parameters.get("id", as: UUID.self) else {
        throw Abort(.badRequest)                       // 400
    }
    guard let user = try await User.find(id, on: req.db) else {
        throw Abort(.notFound)                         // 404
    }
    return user
}

try await app.execute()
```

Try it from the terminal:

```bash
curl http://localhost:8080/hello
# Hello, world!

curl http://localhost:8080/users/not-a-uuid
# {"error":true,"reason":"Bad Request"}
```

What feels **familiar**:

- Route closures are `async throws`, the same concurrency you learned in sections 17 and 18.
- `Abort` is just an error you `throw`, like in section 9. Vapor turns it into an HTTP status code.

What is **new**: `req` (the request) is how you reach **everything**: the database (`req.db`), the body, the route parameters, and the logger.

**The big mental shift:** an iOS app's `App` struct lives for the whole process and keeps singletons and caches. On a server, **each request is a fresh, separate unit of work**. Hundreds of requests run **at the same time**. So a handler should not depend on shared mutable state, except what comes through `req` or a properly protected service (like an actor).

```swift
// ❌ Shared mutable state: many requests change it at once
var visitCount = 0
app.get("visits") { req async -> String in
    visitCount += 1            // a data race (Swift 6 reports an error here)
    return "\(visitCount)"
}

// ✅ Protect shared state with an actor
actor VisitCounter {
    private var count = 0
    func next() -> Int { count += 1; return count }
}
let counter = VisitCounter()
app.get("visits") { req async -> String in
    "\(await counter.next())"
}
```

---

## 81.2 Vapor: routing, middleware, and Fluent 🟡

**Route groups** share a path prefix and the same **middleware**:

```swift
let api = app.grouped("api", "v1")                  // /api/v1/...
let protected = api.grouped(UserAuthenticator(), User.guardMiddleware())

protected.get("profile") { req async throws -> ProfileResponse in
    let user = try req.auth.require(User.self)
    return ProfileResponse(from: user)
}

protected.post("posts") { req async throws -> Post in
    let input = try req.content.decode(CreatePostRequest.self)   // JSON body → Swift type
    let user = try req.auth.require(User.self)
    let post = Post(title: input.title, body: input.body, authorID: try user.requireID())
    try await post.save(on: req.db)
    return post
}
```

**Middleware** is code that **wraps every request** in a group. It is used for things like login checks, logging, and rate limits. It is the same idea as the request interceptors in section 40: keep cross-cutting work out of the route code.

A simple logging middleware:

```swift
struct TimingMiddleware: AsyncMiddleware {
    func respond(to request: Request, chainingTo next: AsyncResponder) async throws -> Response {
        let start = ContinuousClock.now
        let response = try await next.respond(to: request)      // run the route
        let time = ContinuousClock.now - start
        request.logger.info("\(request.method) \(request.url.path) took \(time)")
        return response
    }
}

app.middleware.use(TimingMiddleware())       // for every route
```

**Fluent** is Vapor's **ORM** (Object-Relational Mapper: it maps Swift types to database tables). It looks a lot like SwiftData (section 41): a model is a Swift class, and fields use property wrappers.

```swift
final class Post: Model, Content, @unchecked Sendable {
    static let schema = "posts"                // the table name

    @ID(key: .id) var id: UUID?
    @Field(key: "title") var title: String
    @Field(key: "body") var body: String
    @Parent(key: "author_id") var author: User  // many posts → one user

    init() {}

    init(title: String, body: String, authorID: User.IDValue) {
        self.title = title
        self.body = body
        self.$author.id = authorID
    }
}

let recentPosts = try await Post.query(on: req.db)
    .filter(\.$title != "")
    .sort(\.$id, .descending)
    .limit(20)
    .all()
```

| Relationship | Fluent | SwiftData |
|---|---|---|
| Many → one | `@Parent` | a plain property with `@Relationship` |
| One → many | `@Children` | an array with `@Relationship` |
| Many ↔ many | `@Siblings` | arrays on both sides |

The ideas are the same. The difference: Fluent talks to a **real server database** (Postgres, MySQL), not an SQLite file on the device.

---

## 81.3 Hummingbird as a lighter alternative 🟡

**Hummingbird** is a smaller server framework, also built on SwiftNIO (81.4). Vapor comes with **many features included** (an ORM, templates, a big plugin ecosystem). Hummingbird keeps a **small core**, and you add only what you need.

```swift
import Hummingbird

let router = Router()
router.get("/hello") { request, context in
    "Hello, world!"
}

let app = Application(
    router: router,
    configuration: .init(address: .hostname("127.0.0.1", port: 8080))
)
try await app.runService()
```

Returning JSON is just as simple. Make the type `ResponseCodable`:

```swift
struct Recipe: ResponseCodable {
    let id: Int
    let title: String
}

router.get("/recipes/:id") { request, context -> Recipe in
    let id = try context.parameters.require("id", as: Int.self)
    return Recipe(id: id, title: "Pancakes")
}
```

| | Vapor | Hummingbird |
|---|---|---|
| Size | Large, many features included | Small core, add pieces yourself |
| Good when | You want a full stack fast | You want control over every dependency |
| ORM | Fluent included | Choose your own |

Neither is "better". It is the same choice as in any language: **full-featured framework** vs **small, minimal framework**.

---

## 81.4 SwiftNIO event loops vs async/await 🔴

**SwiftNIO** is the low-level networking engine under both Vapor and Hummingbird. It is **older than `async`/`await`**, so its original API uses **futures and callbacks**.

- An **event loop** is **one thread** that handles I/O events for **many connections**, one small piece of work at a time.
- An **event loop group** is a pool of these loops. Connections are spread across them.

```swift
// SwiftNIO's native, pre-async/await style
let promise = eventLoop.makePromise(of: String.self)
someAsyncOperation { result in
    promise.succeed(result)
}
let future: EventLoopFuture<String> = promise.futureResult
future.whenSuccess { value in print(value) }
```

Today you almost always write `async`/`await`. You can turn a future into an async value with `.get()`:

```swift
let value: String = try await future.get()     // bridge: future → async/await
```

**The rule that still matters: never block an event loop.** One loop serves many connections. If one handler does slow, synchronous work, **every other connection on that loop waits**. It is the server version of "never block the main thread".

```swift
// ❌ Blocks the loop: every other request on this thread waits 2 seconds
app.get("slow") { req -> String in
    Thread.sleep(forTimeInterval: 2)
    return "done"
}

// ✅ Suspends instead of blocking: the thread is free for other requests
app.get("slow") { req async throws -> String in
    try await Task.sleep(for: .seconds(2))
    return "done"
}
```

This is the same idea as Swift's **cooperative thread pool** (section 18): threads are shared, so work must **suspend**, not block.

---

## 81.5 Sharing model code between app and server 🟢

A big win of Swift on **both** sides: **share the model code** in a Swift package. The same `Codable` types are used by the iOS app and by the server.

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

Shared **validation** rules can live there too, so the app and the server always agree:

```swift
public enum PostRules {
    public static let maxTitleLength = 120

    public static func validate(_ request: CreatePostRequest) throws {
        guard !request.title.isEmpty else { throw PostError.emptyTitle }
        guard request.title.count <= maxTitleLength else { throw PostError.titleTooLong }
    }
}
```

```swift
// iOS app: check before sending
try PostRules.validate(draft)

// Vapor server: check again, because clients can't be trusted
let input = try req.content.decode(CreatePostRequest.self)
try PostRules.validate(input)
```

The folder layout:

```plaintext
MyProject/
├── SharedModels/       ← Swift package: Codable types + validation (no UIKit, no Vapor)
├── iOSApp/             ← depends on SharedModels
└── Server/             ← depends on SharedModels + Vapor
```

This prevents a whole class of bugs: the app's idea of the JSON shape **slowly drifting** from the server's. It follows the modularization rules from section 48: the shared package must **not import** UIKit, SwiftUI, or Vapor, and must avoid Foundation APIs that differ on Linux (81.6).

---

## 81.6 Swift on Linux and Foundation differences 🟡

Swift has run on **Linux** since it became open source in 2015. But **Foundation on Linux is not exactly the same** as on Apple platforms. Apple's old Foundation used Objective-C and Core Foundation, which do not exist on Linux.

The open-source Foundation, and the newer **Swift-native Foundation** (the rewrite that ships with Swift 6), closed most gaps. Some differences remain, for example:

- some **date and locale** formatting details
- parts of **`NSAttributedString`** that depend on text layout
- some **`FileManager`** behavior around permissions and extended attributes

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

A real example: `URLSession` exists on Linux, but on older toolchains you need the extra import above.

```swift
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import Foundation

let (data, _) = try await URLSession.shared.data(from: URL(string: "https://example.com")!)
```

The best protection is to **run your tests on Linux too**. Docker makes this easy:

```bash
docker run --rm -v "$PWD":/code -w /code swift:latest swift test
```

**The lesson:** do not avoid Foundation on Linux. **Test the Foundation APIs you actually use, on both platforms.** `#if os(Linux)` is the same tool as `#if os(iOS)` in multiplatform SwiftUI (section 33), only used for a different kind of difference.

---

## 81.7 The static Linux SDK 🔴

Shipping a Swift server binary used to be painful. You had to build on the **same Linux version** as your server, or ship the **Swift runtime** next to your binary.

The **static Linux SDK** fixes this. It builds a **fully static binary**: the Swift runtime and standard library are **inside** the binary. You can build it **on your Mac**, for Linux.

```bash
# Install the SDK once (get the exact URL and checksum from swift.org):
swift sdk install <static-linux-sdk-url> --checksum <checksum>

# Build a static Linux binary from macOS:
swift build --swift-sdk x86_64-swift-linux-musl \
  -c release
```

The binary runs with **nothing else installed**, even in an empty (`scratch`) container image:

```dockerfile
FROM scratch
COPY .build/x86_64-swift-linux-musl/release/MyServer /MyServer
EXPOSE 8080
ENTRYPOINT ["/MyServer"]
```

Benefits:

- **Tiny images** that start fast.
- **Less to attack**: no shell, no extra libraries.
- **No version mismatch**: no "works on my machine, fails in the container".

The trade-off is the usual **static vs dynamic linking** one (section 72): a **bigger binary**, but **no runtime dependencies**.

---

## 81.8 Swift for WebAssembly 🔴

**WebAssembly (WASM)** is a portable bytecode that runs in **web browsers** and other WASM runtimes. Swift can compile to WASM, so Swift code can run **inside a web page**.

Talking to the browser uses **JavaScriptKit**, a bridge to JavaScript and the DOM (the page's elements):

```swift
import JavaScriptKit

let document = JSObject.global.document
var div = document.createElement("div")
div.innerText = "Hello from Swift, compiled to WebAssembly!"
_ = document.body.appendChild(div)
```

A button that runs Swift code when clicked:

```swift
var button = document.createElement("button")
button.innerText = "Count"
var count = 0
button.onclick = .object(JSClosure { _ in
    count += 1
    div.innerText = "Clicked \(count) times".jsValue
    return .undefined
})
_ = document.body.appendChild(button)
```

Build it with a Swift SDK for WebAssembly:

```bash
swift build --swift-sdk wasm32-unknown-wasi -c release
```

Good uses today:

1. Run **existing Swift logic** (validation, calculations, the shared models from 81.5) in a web app, without rewriting it.
2. Small **in-browser tools and demos** that need no server.
3. Full Swift web UI frameworks, which are **still young**.

**Be honest about maturity:** debugging, tooling, and binary size are **much rougher** than for iOS or server Swift. Choosing WASM today is a bet on a growing platform, not a mature, drop-in option.

---

## 81.9 Embedded Swift 🔴

**Embedded Swift** is a **compilation mode**, not a new language. It makes **very small binaries** with no runtime dependencies, for **microcontrollers** (tiny chips with kilobytes of memory).

To fit there, it **removes features that need a runtime**:

| Feature | Normal Swift | Embedded Swift |
|---|---|---|
| Generics | Can use runtime metadata | Always **specialized** at compile time |
| `any Protocol` (existentials) | Allowed | Limited |
| Full reflection (`Mirror`) | Available | Not available |
| Objective-C interop | On Apple platforms | Not available |
| Foundation | Available | Not available |

```swift
// A representative Embedded Swift snippet: no Foundation, minimal runtime
// (gpioSet and delay are functions from the board's own support library)
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

You turn it on with a compiler flag:

```bash
swiftc -enable-experimental-feature Embedded -wmo -parse-as-library -Osize \
  -target armv7em-none-none-eabi \
  -c Blink.swift -o blink.o
```

Generics still work. The compiler makes a **separate copy for each concrete type** (this is called **monomorphization**):

```swift
func largest<T: Comparable>(_ a: T, _ b: T) -> T { a > b ? a : b }

largest(3, 7)        // compiler generates largest(Int, Int)
largest(2.5, 1.0)    // compiler generates largest(Double, Double)
```

**Why the limits?** Runtime generics and existentials need **metadata and a heap**. A microcontroller with kilobytes of RAM has almost no room for that. So Embedded Swift pays the cost **once, at compile time**, instead of **again and again at runtime**. This is the static-vs-dynamic trade-off from low-level Swift (section 15), taken to the extreme.

---

## 81.10 `swift-log`, `swift-metrics`, `swift-service-lifecycle` 🟡

The Swift server world uses a few shared **API-only packages**. Each one defines a **common interface**, but **not the backend** that does the real work:

- **`swift-log`:** logging
- **`swift-metrics`:** counters, gauges, and timers
- **`swift-service-lifecycle`:** starting and **gracefully stopping** many services in one process

```swift
import Logging
import Metrics

let logger = Logger(label: "com.example.api")
logger.info("Request received", metadata: ["path": "\(req.url.path)", "method": "\(req.method)"])

let requestCounter = Counter(label: "http_requests_total")
requestCounter.increment()
```

You choose the **backend once**, at startup. Call sites never change:

```swift
// Development: print to the console
LoggingSystem.bootstrap(StreamLogHandler.standardOutput)

// Production: swap in a backend package, e.g. one that sends JSON logs
// LoggingSystem.bootstrap(MyJSONLogHandler.init)
```

This is the same idea as programming to a protocol and wiring the real type in the **composition root** (section 47.6).

**`swift-service-lifecycle`** solves a problem iOS apps don't have. On iOS, **the OS** manages your process. On a server, **your code** must start services in order and shut them down **cleanly** when the server receives `SIGTERM` (the "please stop" signal):

```swift
import ServiceLifecycle

struct CleanupJob: Service {
    func run() async throws {
        // when a graceful shutdown starts, cancel the loop below
        try await cancelWhenGracefulShutdown {
            while !Task.isCancelled {
                try await Task.sleep(for: .seconds(60))
                // delete old sessions...
            }
        }
    }
}

let group = ServiceGroup(
    services: [app, CleanupJob()],              // e.g. the Hummingbird app + a job
    gracefulShutdownSignals: [.sigterm],
    logger: logger
)
try await group.run()                            // stops all services in the right order
```

---

## 81.11 Cross-platform UI options and honest trade-offs 🟡

SwiftUI already runs on iPhone, iPad, Mac, Apple Watch, Apple TV, and Vision Pro (section 33). But what about **Android** or the **web**? There are a few real paths:

| Option | How it works | Trade-off |
|---|---|---|
| **Skip** | Write SwiftUI; it runs on Android with native Jetpack Compose UI | Young toolchain; not every SwiftUI API is supported |
| **Swift + WASM** (81.8) | Render UI in the browser from Swift | Tooling is still immature |
| **Shared logic, native UI** | Share models and logic as a Swift package; build each UI natively | Two or three UI codebases |

The conservative, widely used option is the last one:

```plaintext
SharedCore (Swift package)       models, networking, validation, business rules
   ├── iOS / macOS app           SwiftUI
   ├── Android app               Jetpack Compose (calls SharedCore, or Kotlin code)
   └── Web app                   a web framework (or SharedCore via WASM)
```

**There is no single right answer.**

- A **small team** with one focused app may save a lot of time with a shared-UI tool like Skip.
- A **larger team** building a flagship app on each platform may choose **fully native UI** everywhere, and accept the extra work to get the best result on each platform.

Decide based on **team size**, **which platforms matter most**, and **how native** the UI must feel on each one.

---

## Summary

| Subtopic | Core idea |
|---|---|
| 81.1 Vapor first route | `async` route handlers; each request is fresh, no shared mutable state |
| 81.2 Vapor routing/middleware/Fluent | Middleware wraps requests; Fluent models look like SwiftData |
| 81.3 Hummingbird | A small, minimal alternative to Vapor |
| 81.4 SwiftNIO event loops | One loop serves many connections; never block it |
| 81.5 Sharing model code | One Swift package for app and server; no JSON drift |
| 81.6 Swift on Linux | Foundation mostly matches; test on Linux, don't assume |
| 81.7 Static Linux SDK | One static binary, runs even in an empty container |
| 81.8 Swift for WebAssembly | Swift in the browser; real, but still young |
| 81.9 Embedded Swift | A compile-time-only subset of Swift for microcontrollers |
| 81.10 swift-log/metrics/service-lifecycle | Shared APIs, backend chosen at startup; clean shutdown |
| 81.11 Cross-platform UI trade-offs | Shared logic plus native UI is the safe default |
