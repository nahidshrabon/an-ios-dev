## 40.1 Designing a Reusable API Client Layer

Rather than scattering `URLSession` calls, header configuration, and error handling throughout view code, a dedicated API client layer centralizes networking concerns behind a small, testable interface.

```swift
protocol APIClient {
    func send<T: Decodable>(_ endpoint: Endpoint) async throws -> T
}

struct Endpoint {
    let path: String
    let method: String
    let queryItems: [URLQueryItem]
    let body: Data?
}

final class DefaultAPIClient: APIClient {
    private let session: URLSession
    private let baseURL: URL

    init(session: URLSession = .shared, baseURL: URL) {
        self.session = session
        self.baseURL = baseURL
    }

    func send<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        var components = URLComponents(url: baseURL.appendingPathComponent(endpoint.path), resolvingAgainstBaseURL: false)!
        components.queryItems = endpoint.queryItems.isEmpty ? nil : endpoint.queryItems

        var request = URLRequest(url: components.url!)
        request.httpMethod = endpoint.method
        request.httpBody = endpoint.body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw APIError.httpError(statusCode: (response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
```

Defining `APIClient` as a protocol (rather than calling `DefaultAPIClient` directly everywhere) is what makes this layer testable — a test can substitute a fake conforming implementation returning canned data, without any real network calls. Injecting the `URLSession` instance via the initializer (rather than always using `.shared`) similarly supports substituting a test-configured session (with a custom `URLProtocol`, for instance) in unit tests. This single `send<T: Decodable>()` method, combined with the `Endpoint` value type describing *what* to request, is the foundation the remaining advanced networking patterns in this section build on top of.

---

## 40.2 Generic Request/Response Abstraction

Generics let one `send()` method (as in 40.1) handle every distinct response type in the app — the caller specifies the expected `Decodable` type via type inference or explicit annotation, and the client layer handles decoding generically without per-endpoint boilerplate.

```swift
extension APIClient {
    func getUser(id: Int) async throws -> User {
        try await send(Endpoint(path: "users/\(id)", method: "GET", queryItems: [], body: nil))
    }

    func createPost(_ post: NewPost) async throws -> Post {
        let body = try JSONEncoder().encode(post)
        return try await send(Endpoint(path: "posts", method: "POST", queryItems: [], body: body))
    }
}
```

Because `send<T: Decodable>()` is generic over its return type, the compiler infers `T` from each call site's context (the declared return type of `getUser`/`createPost`) — this is the same generics mechanism from section 8, applied here to eliminate what would otherwise be a separate, near-identical networking method manually written for every single endpoint and response type in the app.

---

## 40.3 Retry with Exponential Backoff and Jitter

Transient network failures (a momentary connectivity blip, a server briefly overloaded) often succeed on retry — exponential backoff retries with increasing delay between attempts, and jitter (randomized variation) prevents many clients from retrying in lockstep and overwhelming a recovering server simultaneously.

```swift
func withRetry<T>(
    maxAttempts: Int = 3,
    operation: () async throws -> T
) async throws -> T {
    var lastError: Error?
    for attempt in 0..<maxAttempts {
        do {
            return try await operation()
        } catch {
            lastError = error
            let baseDelay = pow(2.0, Double(attempt))
            let jitter = Double.random(in: 0...0.5)
            let delay = baseDelay + jitter
            try await Task.sleep(for: .seconds(delay))
        }
    }
    throw lastError!
}
```

Each retry attempt waits roughly double the previous delay (`2^attempt` seconds — 1s, 2s, 4s...) — the "exponential" part — plus a small random amount (`jitter`) added on top, so that if many clients failed simultaneously (say, due to a brief server outage), they don't all retry at exactly the same synchronized moments, which would just recreate the overload that caused the original failures. `Task.sleep(for:)` (structured concurrency, Part 2) provides the cancellable delay between attempts, and wrapping any `async throws` operation in `withRetry { }` applies this resilience pattern generically to any network call.

---

## 40.4 Request Cancellation on View Disappearance

SwiftUI's `.task { }` modifier automatically cancels its underlying `Task` when the attached view disappears from the hierarchy — and because `URLSession`'s `async` methods respect Swift's cooperative cancellation, an in-flight network request started inside `.task { }` is automatically aborted if the user navigates away before it completes.

```swift
struct UserDetailView: View {
    let userID: Int
    @State private var user: User?

    var body: some View {
        Group {
            if let user { Text(user.name) } else { ProgressView() }
        }
        .task(id: userID) {
            do {
                user = try await apiClient.getUser(id: userID)
            } catch is CancellationError {
                // expected when the view disappears before the fetch completes
            } catch {
                // handle genuine failure
            }
        }
    }
}
```

This automatic cancellation is a direct, practical benefit of structured concurrency (Part 2): because `.task { }` ties the request's lifetime to the view's lifetime, there's no manual bookkeeping required to cancel an in-flight `URLSessionDataTask` when a user quickly navigates away — Swift's cooperative cancellation propagates the cancellation signal into the awaited `URLSession` call automatically, which throws a `CancellationError` that's usually safe to silently ignore, as shown. `.task(id:)` additionally re-runs (canceling any prior in-flight task first) whenever the `id:` value changes, useful here for correctly refetching if `userID` changes while the view remains on screen.

---

## 40.5 Request Deduplication and Coalescing

When multiple parts of an app might independently request the same data at nearly the same moment (e.g., several views all needing the same user profile), request deduplication ensures only one actual network call is made, with all callers sharing the result — avoiding redundant, wasteful duplicate requests.

```swift
actor RequestCoalescer<Key: Hashable, Value> {
    private var inFlightTasks: [Key: Task<Value, Error>] = [:]

    func value(for key: Key, operation: @escaping () async throws -> Value) async throws -> Value {
        if let existing = inFlightTasks[key] {
            return try await existing.value
        }
        let task = Task { try await operation() }
        inFlightTasks[key] = task
        defer { inFlightTasks[key] = nil }
        return try await task.value
    }
}
```

This directly applies actor isolation (section 19) to solve a genuine concurrency problem: multiple callers racing to check "is there already an in-flight request for this key" and start a new one need that check-and-set to be atomic, which the actor's serialized access naturally guarantees. If a second caller arrives while a request for the same `key` is already in flight, it simply awaits the *same* underlying `Task`'s `.value` rather than starting a redundant duplicate request — both callers receive the identical result once the single shared request completes.

---

## 40.6 URLCache and HTTP Caching Headers

`URLCache` provides automatic, transparent HTTP response caching, respecting standard caching-related headers (`Cache-Control`, `Expires`) that a server includes in its responses to indicate how long a given response may be reused without a fresh network request.

```swift
let cache = URLCache(memoryCapacity: 20 * 1024 * 1024, diskCapacity: 100 * 1024 * 1024)
let configuration = URLSessionConfiguration.default
configuration.urlCache = cache
configuration.requestCachePolicy = .useProtocolCachePolicy

let session = URLSession(configuration: configuration)
```

`.useProtocolCachePolicy` (the default) tells `URLSession` to respect the server's caching headers exactly as HTTP specifies — a response with `Cache-Control: max-age=3600` can be reused directly from `URLCache` for up to an hour without a network round trip at all, which can meaningfully reduce both latency and network/battery usage for data that doesn't change often. This caching behavior happens transparently at the `URLSession` layer — the calling code (like the `send()` method from 40.1) doesn't need any special awareness that a given response came from cache versus the network.

---

## 40.7 ETags and Conditional Requests

An `ETag` is a server-provided identifier (essentially a fingerprint) for a specific version of a resource — conditional requests use it to ask the server "has this resource changed since I last saw ETag X," letting the server respond with a cheap `304 Not Modified` (no body at all) if nothing has changed, rather than re-sending the full, unchanged response.

```swift
func fetchWithETag(url: URL, previousETag: String?) async throws -> (data: Data?, newETag: String?) {
    var request = URLRequest(url: url)
    if let previousETag {
        request.setValue(previousETag, forHTTPHeaderField: "If-None-Match")
    }

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }

    if http.statusCode == 304 {
        return (nil, previousETag) // unchanged; caller should keep using its existing cached copy
    }
    let newETag = http.value(forHTTPHeaderField: "ETag")
    return (data, newETag)
}
```

`If-None-Match` is the request header carrying the previously-seen `ETag` value — if the server's current version of the resource still matches that ETag, it responds with `304 Not Modified` and an empty body, letting the client know its existing cached copy is still valid without re-transferring the (potentially large) unchanged data. This is a complementary mechanism to `URLCache`'s time-based expiration (40.6): ETags handle the case where a resource's actual freshness can't be predicted by a fixed time window, but the server can still cheaply confirm "nothing has changed" on each request.

---

## 40.8 Background URLSession for Long Transfers

A background `URLSessionConfiguration` lets a large upload or download continue even if the app is suspended or terminated by the system, with the OS itself managing the transfer and relaunching/notifying the app (via `application(_:handleEventsForBackgroundURLSession:completionHandler:)`) when it completes.

```swift
let configuration = URLSessionConfiguration.background(withIdentifier: "com.example.myapp.background-transfer")
configuration.isDiscretionary = true
configuration.sessionSendsLaunchEvents = true

let backgroundSession = URLSession(configuration: configuration, delegate: BackgroundSessionDelegate(), delegateQueue: nil)
```

Unlike a standard `URLSession`, a background session's transfers are handled by a separate system daemon, entirely independent of your app's process — meaning a large video upload can genuinely continue even if the user backgrounds or force-quits the app mid-transfer, something a standard in-process session cannot do. `isDiscretionary` lets the system decide the optimal time to actually perform the transfer (e.g., waiting for Wi-Fi or a charging state) when timing isn't user-critical, trading punctuality for better system resource behavior.

---

## 40.9 URLSessionWebSocketTask

`URLSessionWebSocketTask` provides native WebSocket support — a persistent, full-duplex connection allowing both client and server to send messages at any time, appropriate for real-time features like chat or live updates where repeated request/response polling would be inefficient.

```swift
let webSocketTask = URLSession.shared.webSocketTask(with: URL(string: "wss://example.com/chat")!)
webSocketTask.resume()

func receiveMessages() async {
    while true {
        do {
            let message = try await webSocketTask.receive()
            switch message {
            case .string(let text):
                print("Received: \(text)")
            case .data(let data):
                print("Received binary: \(data.count) bytes")
            @unknown default:
                break
            }
        } catch {
            break // connection closed or errored
        }
    }
}

func send(_ text: String) async throws {
    try await webSocketTask.send(.string(text))
}
```

Unlike the request/response model covered throughout this section, a WebSocket connection stays open indefinitely, with `receive()` awaited in a loop to continuously process incoming messages as they arrive — the `while true` receive loop pattern shown is the standard way to structure a WebSocket's inbound message handling, running for as long as the connection remains open, naturally terminating (via the `catch` and `break`) once the connection closes or errors.

---

## 40.10 Server-Sent Events and Streaming Responses

Server-Sent Events (SSE) is a simpler, one-directional alternative to WebSockets — the server streams a sequence of text-formatted events over a single long-lived HTTP response, well suited to server-to-client-only real-time updates (like live notifications or streaming AI-generated text) without needing full bidirectional WebSocket infrastructure.

```swift
func streamEvents(from url: URL) async throws {
    let (bytes, _) = try await URLSession.shared.bytes(from: url)

    for try await line in bytes.lines {
        if line.hasPrefix("data: ") {
            let eventData = line.dropFirst("data: ".count)
            print("Event: \(eventData)")
        }
    }
}
```

SSE's wire format is simple, line-based text (`data: <payload>`, with blank lines separating events), which is exactly why `URLSession.shared.bytes(from:)`'s `.lines` async sequence (built on the incremental byte-streaming API from section 39.12) is a natural fit for consuming it directly — no specialized SSE library is strictly required for basic cases, since the format is simple enough to parse with straightforward line-by-line iteration over the streaming response body.

---

## 40.11 URLSession.bytes for Incremental Parsing

Beyond SSE specifically, `URLSession.shared.bytes(for:)` is the general-purpose tool for incrementally processing any streaming or very large response body without buffering the entire thing in memory at once — the same underlying API referenced in 39.12's download-progress example and 40.10's SSE consumption.

```swift
func parseNewlineDelimitedJSON(from url: URL) async throws -> [Record] {
    let (bytes, _) = try await URLSession.shared.bytes(from: url)
    var records: [Record] = []

    for try await line in bytes.lines {
        guard !line.isEmpty else { continue }
        let record = try JSONDecoder().decode(Record.self, from: Data(line.utf8))
        records.append(record)
    }
    return records
}
```

This example shows incrementally parsing a newline-delimited JSON (NDJSON) response — a common format for large datasets or log streams — decoding and processing each record as its line arrives rather than waiting for the entire (potentially huge) response body to download before any processing can begin. This pattern generalizes the streaming principle across this section: whether it's download progress (39.12), SSE (40.10), or arbitrary large structured data (this example), `bytes(for:)`'s `AsyncSequence`-based design is the consistent underlying tool for processing network data incrementally as it arrives.

---

## 40.12 Certificate Pinning

Certificate pinning hardens an app's network security by validating that the server's TLS certificate (or public key) matches a specific, pre-known value embedded in the app, rather than merely trusting any certificate signed by a certificate authority the device trusts — defending specifically against sophisticated man-in-the-middle attacks involving a compromised or rogue CA.

```swift
class PinningSessionDelegate: NSObject, URLSessionDelegate {
    private let pinnedPublicKeyHash: String

    init(pinnedPublicKeyHash: String) {
        self.pinnedPublicKeyHash = pinnedPublicKeyHash
    }

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard let serverTrust = challenge.protectionSpace.serverTrust,
              let actualHash = publicKeyHash(from: serverTrust),
              actualHash == pinnedPublicKeyHash else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        completionHandler(.useCredential, URLCredential(trust: serverTrust))
    }

    private func publicKeyHash(from trust: SecTrust) -> String? {
        // extract and hash the server's public key for comparison
        nil
    }
}
```

Standard TLS validation trusts *any* certificate issued by *any* certificate authority the operating system trusts — pinning narrows this considerably, only accepting a connection if the server's actual certificate/public key matches a specific, expected value baked into the app, implemented via `URLSessionDelegate`'s `didReceive challenge:` callback. Pinning is a genuine security hardening measure but comes with an operational cost: if the server's certificate needs to be rotated/renewed (a routine, expected event), a pinned app needs to be updated and released with the new pinned value *before* the old certificate expires, or existing app installations will be unable to connect at all — this operational fragility is why pinning is deployed thoughtfully, typically for especially high-security use cases, rather than universally.

---

## 40.13 App Transport Security and Exceptions

App Transport Security (ATS) is iOS's default policy requiring all network connections to use HTTPS with modern TLS and strong ciphers — connecting to a plain HTTP or otherwise non-compliant endpoint fails by default unless an explicit exception is declared in the app's Info.plist.

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>legacy-internal-api.example.com</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPConnections</key>
            <true/>
        </dict>
    </dict>
</dict>
```

ATS's default-secure posture is a deliberate, meaningful security baseline — rather than requiring developers to opt into HTTPS, it requires an explicit, auditable opt-out (an ATS exception in Info.plist) to connect insecurely, and App Store review scrutinizes broad exceptions closely. The idiomatic approach is scoping any necessary exception as narrowly as possible (as shown, to one specific legacy internal domain) rather than a blanket exception disabling ATS app-wide, which review is unlikely to approve without strong justification, and which would meaningfully weaken the app's overall network security posture.

---

## 40.14 NWPathMonitor for Connectivity

`NWPathMonitor` (from the `Network` framework) provides real-time monitoring of the device's network connectivity status and characteristics — whether the device is currently connected, and via what interface type (Wi-Fi, cellular, wired) — letting an app react appropriately to connectivity changes.

```swift
import Network

final class ConnectivityMonitor {
    private let monitor = NWPathMonitor()
    private(set) var isConnected = false
    private(set) var isExpensive = false

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            self?.isConnected = path.status == .satisfied
            self?.isExpensive = path.isExpensive
        }
        monitor.start(queue: DispatchQueue(label: "ConnectivityMonitor"))
    }
}
```

`path.status == .satisfied` indicates genuine connectivity, while `path.isExpensive` flags interfaces like cellular data (as opposed to Wi-Fi) where an app might reasonably want to defer non-essential large downloads or reduce data usage — using this information to adapt behavior (like pausing large background transfers on expensive connections, or showing an offline banner when `isConnected` is false) is a meaningfully better user experience than simply letting every network call fail with a generic timeout error when connectivity is genuinely absent.

---

## 40.15 Network.framework and NWConnection Basics 🔴

Below `URLSession`'s HTTP-focused abstraction, the `Network` framework's `NWConnection` provides lower-level access to raw TCP/UDP socket connections — necessary for protocols that aren't HTTP-based at all, like custom binary protocols or certain real-time/low-latency use cases.

```swift
import Network

let connection = NWConnection(host: "example.com", port: 8080, using: .tcp)

connection.stateUpdateHandler = { state in
    switch state {
    case .ready:
        print("Connection established")
    case .failed(let error):
        print("Connection failed: \(error)")
    default:
        break
    }
}

connection.start(queue: .main)

let message = "PING\n".data(using: .utf8)!
connection.send(content: message, completion: .contentProcessed { error in
    if let error { print("Send failed: \(error)") }
})
```

`NWConnection` operates at a genuinely lower level than `URLSession` — there's no built-in concept of HTTP requests, headers, or status codes here, just raw bytes sent and received over a TCP or UDP socket, with the app entirely responsible for defining and parsing its own wire protocol. This is appropriately reserved for scenarios where HTTP genuinely isn't the right fit (a custom game networking protocol over UDP, for instance) — for the vast majority of app networking needs, including the WebSocket and streaming scenarios covered earlier in this section, `URLSession`'s higher-level APIs remain the correct, far less effortful choice.

---

## 40.16 OAuth 2.0 with PKCE

OAuth 2.0 is the standard protocol for delegated authorization — letting a user grant an app limited access to their account on another service (like "Sign in with Google") without ever sharing their actual password with the app. PKCE (Proof Key for Code Exchange) is a security extension to OAuth's authorization code flow specifically designed for public clients like mobile apps, which can't securely store a traditional client secret.

```swift
import CryptoKit

func generatePKCEPair() -> (verifier: String, challenge: String) {
    let verifier = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
        .base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: "=", with: "")

    let challengeData = SHA256.hash(data: Data(verifier.utf8))
    let challenge = Data(challengeData)
        .base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: "=", with: "")

    return (verifier, challenge)
}
// 1. Generate (verifier, challenge); send `challenge` in the initial authorization request
// 2. User authenticates in a system browser/ASWebAuthenticationSession
// 3. Redirect back to the app with an authorization code
// 4. Exchange the code for tokens, sending the original `verifier` — the
//    server confirms it hashes to the earlier `challenge`, proving this
//    exchange request came from the same client that started the flow
```

PKCE directly addresses the "client secrets aren't secret" reality from section 39.13: since a mobile app can't safely hold a traditional confidential OAuth client secret (it would be extractable from the binary), PKCE instead uses a dynamically-generated, single-use `verifier`/`challenge` pair — the app sends a hashed `challenge` upfront, and later proves it was the legitimate originator of the flow by presenting the original `verifier`, which the server can hash and compare, all without ever requiring a long-lived embedded secret. This makes PKCE the current standard, recommended approach for implementing "Sign in with X"-style OAuth flows in native mobile apps, typically combined with `ASWebAuthenticationSession` to handle the browser-based authentication step securely.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Reusable client | `APIClient` protocol, `Endpoint` | Centralized, testable networking layer |
| Generic responses | `send<T: Decodable>()` | One method handling every response type |
| Resilience | Exponential backoff + jitter | Retry transient failures without overload |
| Lifecycle-tied requests | `.task(id:)`, cooperative cancellation | Auto-cancel requests when views disappear |
| Avoiding duplicate work | Actor-based request coalescing | One network call shared across simultaneous callers |
| Transparent caching | `URLCache`, `Cache-Control` | Reuse recent responses without a network round trip |
| Conditional requests | `ETag`, `If-None-Match`, 304 | Cheaply confirm "nothing changed" |
| Long-running transfers | Background `URLSessionConfiguration` | Uploads/downloads that survive backgrounding |
| Real-time bidirectional | `URLSessionWebSocketTask` | Persistent, full-duplex connections |
| Real-time one-directional | Server-Sent Events, `.lines` | Simple server-to-client streaming |
| Incremental large data | `URLSession.bytes(for:)` | Process streaming/huge responses without full buffering |
| Enhanced TLS security | Certificate pinning | Defend against rogue-CA man-in-the-middle attacks |
| Transport security policy | App Transport Security | Default-secure HTTPS-only connections |
| Connectivity awareness | `NWPathMonitor` | React to online/offline and expensive-connection states |
| Low-level sockets | `NWConnection` | Raw TCP/UDP for non-HTTP protocols |
| Secure mobile OAuth | OAuth 2.0 + PKCE | Delegated auth without an embeddable client secret |
