**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Swift is not only for Apple devices. It also runs on **servers**, on **Linux**, in the **browser** (WebAssembly), and on tiny **microcontrollers**. The language stays the same: types, `async`/`await`, and error handling. What changes is the **environment**: no UIKit, no SwiftUI, and sometimes not even Foundation.

This is a 10-minute tour. Each part ends with **More** links for when you want the details.

## 81.1 Server-side Swift with Vapor: your first route 🟢

**Vapor** is the most popular Swift web framework. A **route** is a URL path plus the code that answers it:

```swift
import Vapor

let app = try await Application.make(.detect())

app.get("hello") { req async throws -> String in
    "Hello, world!"
}

app.get("users", ":id") { req async throws -> User in
    guard let id = req.parameters.get("id", as: UUID.self),
          let user = try await User.find(id, on: req.db) else {
        throw Abort(.notFound)                      // becomes a 404 response
    }
    return user
}

try await app.execute()
```

- Routes are `async throws`, the same concurrency as sections 17 and 18.
- `Abort` is a normal Swift error. Vapor turns it into an HTTP status code.
- `req` is how you reach everything: the database (`req.db`), the body, the parameters, and the logger.

**The big shift:** an iOS app lives a long time and keeps singletons and caches. On a server, **hundreds of requests run at the same time**, and each one is a fresh unit of work. So don't share mutable state between requests. If you must, put it in an actor.

Real products run on Vapor: Apple moved its [Password Monitoring service](https://www.swift.org/blog/swift-at-apple-migrating-the-password-monitoring-service-from-java/) from Java to Swift and Vapor, and Cultured Code rebuilt [Things Cloud](https://www.swift.org/blog/how-swifts-server-support-powers-things-cloud/) on it.

**More:** [Vapor docs](https://docs.vapor.codes) · [Hello, world tutorial](https://docs.vapor.codes/getting-started/hello-world/)

---

## 81.2 Vapor: routing, middleware, and Fluent 🟡

Three tools you use in almost every Vapor app:

- **Route groups** share a path prefix: `app.grouped("api", "v1")` gives `/api/v1/...`.
- **Middleware** wraps every request in a group, for login checks, logging, or rate limits. Same idea as request interceptors on the client (section 40).
- **Fluent** is Vapor's **ORM**: it maps Swift classes to database tables. It feels like SwiftData (section 41), but talks to a server database like Postgres or MySQL.

```swift
let protected = app.grouped("api", "v1").grouped(UserAuthenticator())   // middleware

protected.post("posts") { req async throws -> Post in
    let input = try req.content.decode(CreatePostRequest.self)   // JSON body → Swift type
    let post = Post(title: input.title, body: input.body)
    try await post.save(on: req.db)                               // Fluent inserts a row
    return post
}
```

**More:** [Routing](https://docs.vapor.codes/basics/routing/) · [Middleware](https://docs.vapor.codes/advanced/middleware/) · [Fluent](https://docs.vapor.codes/fluent/overview/)

---

## 81.3 Hummingbird as a lighter alternative 🟡

**Hummingbird** is a smaller Swift server framework. Vapor includes a lot (an ORM, templates, many plugins). Hummingbird keeps a **small core**, and you add only what you need.

```swift
import Hummingbird

let router = Router()
router.get("/hello") { request, context in
    "Hello, world!"
}

let app = Application(router: router, configuration: .init(address: .hostname("127.0.0.1", port: 8080)))
try await app.runService()
```

Neither is better. Pick **Vapor** for a full stack fast, and **Hummingbird** for control over every dependency.

**More:** [Hummingbird docs](https://docs.hummingbird.codes) · [Hummingbird on GitHub](https://github.com/hummingbird-project/hummingbird)

---

## 81.4 SwiftNIO event loops vs async/await 🔴

**SwiftNIO** is the networking engine under both Vapor and Hummingbird. It is built on **event loops**: **one thread** handles **many connections**, one small piece of work at a time. Its old API used futures. Today you write `async`/`await` on top of it.

**The one rule: never block an event loop.** If one request does slow, synchronous work, every other connection on that thread waits. It is the server version of "never block the main thread".

```swift
// ❌ Blocks the thread: other requests wait 2 seconds
Thread.sleep(forTimeInterval: 2)

// ✅ Suspends: the thread serves other requests in the meantime
try await Task.sleep(for: .seconds(2))
```

**More:** [SwiftNIO on GitHub](https://github.com/apple/swift-nio) · [SwiftNIO docs](https://swiftpackageindex.com/apple/swift-nio/documentation/nio)

---

## 81.5 Sharing model code between app and server 🟢

With Swift on both sides, put the shared `Codable` types in **one Swift package** that the app and the server both import:

```plaintext
MyProject/
├── SharedModels/   ← Codable types + validation (no UIKit, SwiftUI, or Vapor)
├── iOSApp/         ← depends on SharedModels
└── Server/         ← depends on SharedModels + Vapor
```

```swift
// In SharedModels
public struct CreatePostRequest: Codable, Sendable {
    public let title: String
    public let body: String

    public init(title: String, body: String) {
        self.title = title
        self.body = body
    }
}
```

Now the app's idea of the JSON **can't drift** from the server's. Shared validation rules can live here too, but the server still runs them, because it **can't trust what clients send**.

Another way: describe the API once in an OpenAPI file, and generate the Swift code for both sides.

**More:** [Swift OpenAPI Generator](https://github.com/apple/swift-openapi-generator) · [Swift on Server guides](https://www.swift.org/documentation/server/)

---

## 81.6 Swift on Linux and Foundation differences 🟡

Swift runs on Linux, and so does Foundation. Since Swift 6, Apple platforms and Linux share **one Swift implementation** of Foundation, so most APIs match. A few details still differ, such as some date and locale formatting and some `FileManager` behavior. On older toolchains, `URLSession` also needs an extra import:

```swift
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
```

**The lesson:** don't assume, **run your tests on Linux too**. Docker makes it one command:

```bash
docker run --rm -v "$PWD":/code -w /code swift:latest swift test
```

**More:** [Install Swift on Linux](https://www.swift.org/install/linux/) · [swift-foundation](https://github.com/swiftlang/swift-foundation) · [Swift Docker images](https://hub.docker.com/_/swift)

---

## 81.7 The static Linux SDK 🔴

The **static Linux SDK** builds **one binary with the Swift runtime inside it**. You can build it on your Mac:

```bash
swift build --swift-sdk x86_64-swift-linux-musl -c release
```

The binary needs nothing else installed, so it runs even in an empty (`FROM scratch`) container: small images, less to attack, and no version mismatches. The trade-off is the usual static linking one (section 72): a **bigger binary**, but **no runtime dependencies**.

**More:** [Getting started with the static Linux SDK](https://www.swift.org/documentation/articles/static-linux-getting-started.html)

---

## 81.8 Swift for WebAssembly 🔴

**WebAssembly (Wasm)** is a bytecode that runs in web browsers. Swift can compile to it, and **JavaScriptKit** lets Swift talk to the page:

```swift
import JavaScriptKit

let document = JSObject.global.document
var div = document.createElement("div")
div.innerText = "Hello from Swift!"
_ = document.body.appendChild(div)
```

It is good for reusing Swift logic on the web (like the shared models from 81.5) and for small in-browser tools. **Be honest about maturity:** tooling, debugging, and binary size are still rougher than for iOS or server Swift.

**More:** [Getting started with Swift and Wasm](https://www.swift.org/documentation/articles/wasm-getting-started.html) · [JavaScriptKit](https://github.com/swiftwasm/JavaScriptKit)

---

## 81.9 Embedded Swift 🔴

**Embedded Swift** is a **compilation mode** (not a new language) for **microcontrollers**: tiny chips with kilobytes of memory. It makes very small binaries by removing the features that need a runtime:

| Feature | In Embedded Swift |
|---|---|
| Generics | Yes, but always specialized at compile time |
| `any Protocol` | Limited |
| Reflection (`Mirror`), Objective-C interop, Foundation | Not available |

**Why?** Those features need runtime metadata and a heap, and a microcontroller has almost no room for them. So Embedded Swift pays the cost **once, at compile time**, instead of **again and again at runtime**. It is the static-vs-dynamic idea from section 15, taken to the extreme.

```swift
// Blink an LED (gpioSet and delay come from the board's support library)
@main
struct Blink {
    static func main() {
        while true {
            gpioSet(pin: 13, high: true);  delay(milliseconds: 500)
            gpioSet(pin: 13, high: false); delay(milliseconds: 500)
        }
    }
}
```

**More:** [Get started with Embedded Swift](https://www.swift.org/get-started/embedded/) · [Embedded Swift examples](https://github.com/swiftlang/swift-embedded-examples)

---

## 81.10 `swift-log`, `swift-metrics`, `swift-service-lifecycle` 🟡

These packages define a **shared API without a backend**. You write against the API everywhere, and choose the real backend **once, at startup**, like a composition root (section 47.6):

```swift
import Logging

LoggingSystem.bootstrap(StreamLogHandler.standardOutput)   // pick the backend once

let logger = Logger(label: "com.example.api")
logger.info("Request received", metadata: ["path": "/hello"])
```

- **`swift-log`:** logging.
- **`swift-metrics`:** counters, gauges, and timers.
- **`swift-service-lifecycle`:** starts your services and **shuts them down cleanly** when the server gets `SIGTERM` (the "please stop" signal). iOS apps don't need this, because the OS manages their process.

**More:** [swift-log](https://github.com/apple/swift-log) · [swift-metrics](https://github.com/apple/swift-metrics) · [swift-service-lifecycle](https://github.com/swift-server/swift-service-lifecycle)

---

## 81.11 Cross-platform UI options and honest trade-offs 🟡

SwiftUI covers Apple platforms (section 33). For **Android** and the **web**, you have three real options:

| Option | Trade-off |
|---|---|
| **Skip:** write SwiftUI, get native Android (Jetpack Compose) UI | Young; not every SwiftUI API works |
| **Swift + Wasm** (81.8) for web UI | Tooling is still immature |
| **Shared logic, native UI:** share a Swift package, build each UI natively | Two or three UI codebases |

The last one is the safe default. A small team with one app may save a lot of time with Skip. A big team with a flagship app on each platform often goes fully native. Decide by team size and how native each platform must feel.

**More:** [Skip](https://skip.dev) · [Swift SDK for Android](https://www.swift.org/documentation/articles/swift-sdk-for-android-getting-started.html)

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
