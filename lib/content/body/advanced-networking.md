**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Section 39 covered single requests. Real apps need more: one **API client** for the whole app, **retries**, **cancellation**, avoiding **duplicate** requests, **caching**, **background** transfers, **real-time** connections, extra **security**, and **sign-in** with other services. This section builds those pieces, one at a time.

---

## 40.1 Designing a Reusable API Client Layer 🟡

Instead of writing `URLSession` code, headers, and error checks in **every** view, put them in **one** place: an **API client**. Views ask the client for data; the client handles the details.

```swift
enum NetworkError: Error {
    case invalidResponse
    case httpError(statusCode: Int, body: Data)
}

struct Endpoint {
    var path: String
    var method: String = "GET"
    var queryItems: [URLQueryItem] = []
    var body: Data? = nil
}

protocol APIClient {
    func send<T: Decodable>(_ endpoint: Endpoint) async throws -> T
}

final class DefaultAPIClient: APIClient {
    private let session: URLSession
    private let baseURL: URL
    private let decoder: JSONDecoder

    init(session: URLSession = .shared, baseURL: URL) {
        self.session = session
        self.baseURL = baseURL
        self.decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase      // set ONCE for the whole app
        decoder.dateDecodingStrategy = .iso8601
    }

    func send<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        var url = baseURL.appending(path: endpoint.path)
        if !endpoint.queryItems.isEmpty {
            url.append(queryItems: endpoint.queryItems)
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body = endpoint.body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw NetworkError.invalidResponse }
        guard (200...299).contains(http.statusCode) else {
            throw NetworkError.httpError(statusCode: http.statusCode, body: data)
        }
        return try decoder.decode(T.self, from: data)
    }
}
```

What one client gives you:

- **One** place for the base URL, headers, auth (39.6), decoding settings, logging, and error handling.
- Views stay **simple**: `try await client.send(...)`.
- Changes (a new header, a new error rule) happen **once**.

Two design choices make it **testable** (65):

1. **`APIClient` is a protocol.** Tests and previews can use a **fake** client that returns sample data, with no real network:

```swift
struct MockAPIClient: APIClient {
    var result: Any
    func send<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        result as! T                       // return canned data
    }
}
```

2. **The `URLSession` is injected** (passed into `init`), not hard-coded as `.shared`. Tests can pass a session with a custom **`URLProtocol`** that intercepts requests and returns fake responses, testing the **real** client code end to end.

---

## 40.2 Generic Request/Response Abstraction 🟡

Thanks to **generics** (8), the **one** `send<T>()` method works for **every** response type. The caller's expected type decides `T`:

```swift
extension APIClient {
    func getUser(id: Int) async throws -> User {
        try await send(Endpoint(path: "users/\(id)"))             // T = User (from the return type)
    }

    func createPost(_ post: NewPost) async throws -> Post {
        let body = try JSONEncoder().encode(post)
        return try await send(Endpoint(path: "posts", method: "POST", body: body))   // T = Post
    }
}

let user = try await client.getUser(id: 42)
```

The compiler **infers** `T` from the context: `getUser` returns `User`, so `send` decodes a `User`. Without generics, you'd write a nearly identical method **for every endpoint**.

You can go one step further: make the **endpoint** carry its **response type**. Then call sites need no type annotations at all, and you **can't** decode the wrong type by mistake:

```swift
struct TypedEndpoint<Response: Decodable> {
    var path: String
    var method: String = "GET"
    var body: Data? = nil
}

extension APIClient {
    func send<R>(_ endpoint: TypedEndpoint<R>) async throws -> R {
        try await send(Endpoint(path: endpoint.path, method: endpoint.method, body: endpoint.body))
    }
}

// Define endpoints once, in one place:
enum API {
    static func user(_ id: Int) -> TypedEndpoint<User> { .init(path: "users/\(id)") }
    static var feed: TypedEndpoint<[Post]> { .init(path: "feed") }
}

let user = try await client.send(API.user(42))   // the type comes from the endpoint
let posts = try await client.send(API.feed)
```

`Response` is never stored; it only **labels** the endpoint for the compiler. This is called a **phantom type**.

---

## 40.3 Retry with Exponential Backoff and Jitter 🟡

Some failures are **temporary**: a network blip, an overloaded server (503), a rate limit (429). Trying **again** often works. But retry **carefully**:

- **Exponential backoff**: wait **longer** each time (1 s, 2 s, 4 s…), to give the server time to recover.
- **Jitter**: add a **random** part to each wait. If 100,000 phones failed at the same moment, they shouldn't all retry at the **same** moment again; that would just overload the server again (a "thundering herd").

```swift
func withRetry<T>(
    maxAttempts: Int = 3,
    baseDelay: Duration = .seconds(1),
    operation: () async throws -> T
) async throws -> T {
    var attempt = 0
    while true {
        do {
            return try await operation()
        } catch {
            attempt += 1
            // Give up if: out of attempts, or the error isn't worth retrying
            guard attempt < maxAttempts, isRetryable(error) else { throw error }

            let exponential = baseDelay * Int(pow(2.0, Double(attempt - 1)))    // 1 s, 2 s, 4 s…
            let jitter = Duration.milliseconds(Int.random(in: 0...500))          // + up to 0.5 s
            try await Task.sleep(for: exponential + jitter)                      // throws if cancelled
        }
    }
}

func isRetryable(_ error: Error) -> Bool {
    if let urlError = error as? URLError {
        return [.timedOut, .networkConnectionLost, .notConnectedToInternet].contains(urlError.code)
    }
    if case NetworkError.httpError(let status, _) = error {
        return status == 429 || (500...599).contains(status)   // rate limit, or server trouble
    }
    return false                                               // 4xx, decoding errors: retrying won't help
}

// Usage
let user = try await withRetry { try await client.getUser(id: 42) }
```

Important details:

- **Don't retry everything.** A `400 Bad Request`, `401`, `404`, or a **decoding** error will fail the **same** way again.
- **Don't sleep after the last attempt**; just throw.
- **`Task.sleep`** respects **cancellation**: if the user leaves the screen, the retry loop stops right away.
- Only retry **safe** requests automatically. A `GET` can be repeated; a `POST` that **charges a card** might charge **twice** if the first one actually reached the server. (Servers solve this with **idempotency keys**: a unique ID sent with the request, so a repeat is recognized.)
- If the server sends a **`Retry-After`** header (common with 429), wait **that** long instead.

---

## 40.4 Request Cancellation on View Disappearance 🟢

SwiftUI's **`.task { }`** **cancels** its task when the view **disappears**. And `URLSession`'s async methods **respect cancellation**: a running request is **stopped**. So a request started in `.task` is cancelled **automatically** when the user leaves:

```swift
struct UserDetailView: View {
    let userID: Int
    let apiClient: APIClient
    @State private var user: User?
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if let user { Text(user.name) } else { ProgressView() }
        }
        .task(id: userID) {                     // re-runs when userID changes
            do {
                user = try await apiClient.getUser(id: userID)
            } catch is CancellationError {
                // the task was cancelled: not a real error
            } catch let error as URLError where error.code == .cancelled {
                // URLSession reports its cancellation as URLError.cancelled: also ignore
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}
```

No manual bookkeeping: no stored task to cancel in `onDisappear`, no "is this view still here?" checks. That's **structured concurrency** (17) paying off.

**`.task(id:)`** adds one more thing: when the **`id`** value **changes**, SwiftUI **cancels** the old task and **starts** a new one. Here, if `userID` changes while the view stays on screen (say, a split view's detail), the old request is cancelled and the new user is loaded. No race where a **slow old** response overwrites the **new** one.

Note the **two** cancellation errors: Swift's **`CancellationError`** (from `Task.sleep`, `Task.checkCancellation()`) and **`URLError(.cancelled)`** (from `URLSession`). Neither should show an error message to the user.

---

## 40.5 Request Deduplication and Coalescing 🔴

Sometimes **several** parts of the app ask for the **same** thing at the **same** time: a header, a sidebar, and a profile screen all load the current user at launch. Without care, that's **three** identical requests. **Coalescing** (deduplication) makes it **one** request, with **all** callers sharing the result.

```swift
actor RequestCoalescer<Key: Hashable & Sendable, Value: Sendable> {
    private var inFlightTasks: [Key: Task<Value, Error>] = [:]

    func value(for key: Key, operation: @escaping @Sendable () async throws -> Value) async throws -> Value {
        // Someone is already loading this? Wait for THEIR result.
        if let existing = inFlightTasks[key] {
            return try await existing.value
        }

        // Otherwise start it, and let others find it while it runs.
        let task = Task { try await operation() }
        inFlightTasks[key] = task
        defer { inFlightTasks[key] = nil }       // remove when finished (success or failure)
        return try await task.value
    }
}

// Usage
let coalescer = RequestCoalescer<Int, User>()

async let a = coalescer.value(for: 42) { try await client.getUser(id: 42) }
async let b = coalescer.value(for: 42) { try await client.getUser(id: 42) }
let (userA, userB) = try await (a, b)            // ONE network request, two results
```

Why an **`actor`** (19)? Several callers may run **at the same time**. The steps "check the dictionary, and if empty, add a task" must happen **without** another caller sneaking in **between**; otherwise two callers both see "nothing in flight" and both start a request. The actor runs its code **one caller at a time**, so the check-and-add is safe.

Note the order inside `value(for:operation:)`: the task is put in the dictionary **before** the first `await`. Actors are **reentrant** (19): while one caller awaits, others can enter. Because the task is already stored by then, the next caller **finds** it and joins.

Each entry is removed when its request **finishes**, so a later call starts a **fresh** request. Coalescing removes **simultaneous** duplicates; for **reuse over time**, add a cache (40.6).

---

## 40.6 URLCache and HTTP Caching Headers 🟡

Servers can tell clients how long a response stays **fresh**, with headers like **`Cache-Control: max-age=3600`** ("reuse this for 1 hour"). **`URLCache`** follows these rules **automatically**: a fresh cached response is returned **without any network request**.

```swift
let cache = URLCache(memoryCapacity: 20 * 1024 * 1024,     // 20 MB in memory
                     diskCapacity: 100 * 1024 * 1024)       // 100 MB on disk
let configuration = URLSessionConfiguration.default
configuration.urlCache = cache
configuration.requestCachePolicy = .useProtocolCachePolicy  // follow the server's headers (the default)

let session = URLSession(configuration: configuration)
```

| Response header | Meaning |
|---|---|
| `Cache-Control: max-age=3600` | Fresh for 3600 seconds; reuse without asking |
| `Cache-Control: no-cache` | You may store it, but **check with the server** before reusing |
| `Cache-Control: no-store` | **Never** store it (e.g., private data) |
| `ETag: "abc123"` | A version ID, for cheap checks later (40.7) |

**`.useProtocolCachePolicy`** means "do what HTTP says". You can also **override** it per request:

| Policy | Behavior |
|---|---|
| `.useProtocolCachePolicy` | Follow the server's caching headers (default) |
| `.reloadIgnoringLocalCacheData` | Always ask the network (for pull to refresh) |
| `.returnCacheDataElseLoad` | Use the cache even if old; network only if nothing cached (offline-friendly) |
| `.returnCacheDataDontLoad` | Cache only; never the network (pure offline mode) |

This happens **inside** `URLSession`. Your client code (40.1) doesn't change: a response may come from the cache or the network, and the code doesn't need to know.

Caching only works for **`GET`**-style requests that the server **marks** as cacheable. If responses never seem cached, check the server's headers first. Also note that the default `URLCache.shared` is fairly **small**; set a bigger one at launch if you rely on caching.

---

## 40.7 ETags and Conditional Requests 🟡

An **ETag** is a **version tag** the server gives a response, like a fingerprint. Next time, the client can ask: "I have version `abc123`; has it **changed**?" If not, the server answers **`304 Not Modified`** with **no body**: a tiny, fast response.

```swift
func fetchWithETag(url: URL, previousETag: String?) async throws -> (data: Data?, newETag: String?) {
    var request = URLRequest(url: url)
    request.cachePolicy = .reloadIgnoringLocalCacheData          // we manage the cache ourselves here
    if let previousETag {
        request.setValue(previousETag, forHTTPHeaderField: "If-None-Match")   // "only if NOT this version"
    }

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse else { throw NetworkError.invalidResponse }

    if http.statusCode == 304 {
        return (nil, previousETag)        // unchanged: keep using your saved copy
    }
    guard (200...299).contains(http.statusCode) else {
        throw NetworkError.httpError(statusCode: http.statusCode, body: data)
    }
    return (data, http.value(forHTTPHeaderField: "ETag"))        // new data, and its new tag
}
```

The flow:

```
1st request:   GET /feed                         → 200 OK, ETag: "v7", <50 KB of JSON>
later:         GET /feed  If-None-Match: "v7"    → 304 Not Modified, <no body>   (nothing changed)
later still:   GET /feed  If-None-Match: "v7"    → 200 OK, ETag: "v8", <new JSON> (it changed)
```

How it complements **`max-age`** (40.6):

- `max-age` says "fresh for **N seconds**". Good when you can **predict** how long data stays valid.
- ETags say "**ask me**, and I'll quickly tell you if it changed". Good when changes are **unpredictable**: you always get fresh data, but only pay for the **download** when something actually changed.

Good news: when you use **`URLCache`** with the default policy, **`URLSession` does this for you**. When a cached response with an ETag goes stale, it sends `If-None-Match` itself, and on a `304` it hands you the **cached** data with a `200`. Write the manual version above only when you **store responses yourself** (for example, in a database for offline use).

---

## 40.8 Background URLSession for Long Transfers 🔴

A normal session's transfers **stop** when the app is **suspended**. A **background session** hands the transfer to a **system process**, so a big upload or download **keeps going** even if the user switches apps, or the system **terminates** your app.

```swift
final class BackgroundTransferManager: NSObject, URLSessionDownloadDelegate {
    static let shared = BackgroundTransferManager()

    lazy var session: URLSession = {
        let configuration = URLSessionConfiguration.background(withIdentifier: "com.example.myapp.transfers")
        configuration.isDiscretionary = true            // let the system pick a good time (Wi-Fi, charging)
        configuration.sessionSendsLaunchEvents = true   // relaunch the app in the background when done
        return URLSession(configuration: configuration, delegate: self, delegateQueue: nil)
    }()

    var backgroundCompletionHandler: (() -> Void)?

    func download(_ url: URL) {
        session.downloadTask(with: url).resume()        // background sessions use tasks + a delegate
    }

    // The file is ready: move it NOW (the temp file is deleted when this method returns)
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask,
                    didFinishDownloadingTo location: URL) {
        let destination = URL.documentsDirectory.appending(path: downloadTask.originalRequest?.url?.lastPathComponent ?? "file")
        try? FileManager.default.removeItem(at: destination)
        try? FileManager.default.moveItem(at: location, to: destination)
    }

    // Progress, if you want to show it
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask,
                    didWriteData bytesWritten: Int64, totalBytesWritten: Int64,
                    totalBytesExpectedToWrite: Int64) {
        let progress = Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
        // publish progress to the UI (on the main actor)
    }

    // All events delivered: tell the system we're done
    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async {
            self.backgroundCompletionHandler?()
            self.backgroundCompletionHandler = nil
        }
    }
}
```

When a transfer finishes while your app isn't running, the system **relaunches** it in the background and calls the app delegate:

```swift
func application(_ application: UIApplication,
                 handleEventsForBackgroundURLSession identifier: String,
                 completionHandler: @escaping () -> Void) {
    BackgroundTransferManager.shared.backgroundCompletionHandler = completionHandler
    _ = BackgroundTransferManager.shared.session     // recreate the session with the SAME identifier
}
```

Rules for background sessions:

- Use **download** and **upload tasks** with a **delegate**. The `async` convenience methods (`data(for:)`) **aren't supported** in background sessions.
- **Uploads** must come from a **file** (`uploadTask(with:fromFile:)`), not from `Data` in memory.
- Use a **stable identifier**, and create the session **once**.
- **`isDiscretionary = true`**: "this isn't urgent". The system may **wait** for Wi-Fi and charging, saving the user's battery and data. Use it for things like pre-downloading content; leave it `false` for a transfer the user is waiting for.

---

## 40.9 URLSessionWebSocketTask 🟡

A **WebSocket** is a connection that **stays open**, where **both** sides can send messages **at any time**. Great for **chat**, **multiplayer**, and **live** data, where asking the server again and again ("anything new?") would be slow and wasteful.

```swift
final class ChatConnection {
    private let task: URLSessionWebSocketTask

    init(url: URL) {
        task = URLSession.shared.webSocketTask(with: url)       // wss:// = WebSocket over TLS
        task.resume()                                            // open the connection
    }

    func send(_ text: String) async throws {
        try await task.send(.string(text))
    }

    // Read messages until the connection closes or the task is cancelled
    func messages() -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            let reader = Task {
                do {
                    while !Task.isCancelled {
                        switch try await task.receive() {        // waits for the NEXT message
                        case .string(let text):
                            continuation.yield(text)
                        case .data(let data):
                            continuation.yield(String(decoding: data, as: UTF8.self))
                        @unknown default:
                            break
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)         // closed or failed
                }
            }
            continuation.onTermination = { _ in reader.cancel() }
        }
    }

    func close() {
        task.cancel(with: .goingAway, reason: nil)
    }
}

// Usage in a view model
for try await message in connection.messages() {
    messages.append(message)
}
```

| Request/response | WebSocket |
|---|---|
| Client asks, server answers, done | Connection **stays open** |
| Only the **client** starts | **Either side** can send anytime |
| New connection per request (or reused, but still one answer each) | One connection for many messages |

`receive()` returns **one** message, so you call it in a **loop**. The loop ends when the connection **closes** (it throws) or the task is **cancelled**.

Real apps also need: **reconnecting** after network drops (with backoff, 40.3), sending **pings** (`task.sendPing`) to keep the connection alive, and closing it when the screen goes away.

---

## 40.10 Server-Sent Events and Streaming Responses 🟡

**Server-Sent Events** (**SSE**) are a simpler alternative when only the **server** needs to push updates. It's **one long HTTP response** that the server keeps open, sending **text events** as they happen. It's used for live scores, notifications, and **streaming AI text** (words appearing one by one).

```swift
func streamEvents(from url: URL) -> AsyncThrowingStream<String, Error> {
    AsyncThrowingStream { continuation in
        let task = Task {
            do {
                var request = URLRequest(url: url)
                request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                let (bytes, _) = try await URLSession.shared.bytes(for: request)

                for try await line in bytes.lines {               // each line as soon as it arrives
                    if line.hasPrefix("data: ") {
                        continuation.yield(String(line.dropFirst("data: ".count)))
                    }
                }
                continuation.finish()
            } catch {
                continuation.finish(throwing: error)
            }
        }
        continuation.onTermination = { _ in task.cancel() }
    }
}

// Usage: show AI text as it streams in
for try await chunk in streamEvents(from: chatURL) {
    responseText += chunk
}
```

The SSE **format** is plain text, line by line:

```
event: message
data: Hello

data: , world
```

Each event has `data:` lines (and optionally `event:` and `id:` lines), and a **blank line** ends an event. The simple parser above handles the common **one-line `data:`** case; a full parser also joins multi-line data and tracks `id` for reconnecting.

| | SSE | WebSocket |
|---|---|---|
| Direction | Server → client **only** | **Both** ways |
| Protocol | Plain **HTTP** | A separate WebSocket protocol |
| Data | Text | Text or binary |
| Works through proxies, uses normal auth headers | ✅ Easily | Sometimes tricky |

**`bytes.lines`** (an `AsyncSequence` of lines, built on the streaming API from 39.12) is a natural fit: SSE **is** a stream of lines, so you can read events **as they arrive** with a simple `for try await` loop. No special library needed.

---

## 40.11 URLSession.bytes for Incremental Parsing 🟡

**`bytes(for:)`** is the general tool for handling a response **while it downloads**, instead of waiting for the **whole** body. It powers download progress (39.12) and SSE (40.10), and works for any **large** or **streaming** data.

A common format is **NDJSON** (newline-delimited JSON): **one JSON object per line**. You can decode and use each record **as soon as its line arrives**:

```swift
func records(from url: URL) -> AsyncThrowingStream<Record, Error> {
    AsyncThrowingStream { continuation in
        let task = Task {
            do {
                let (bytes, _) = try await URLSession.shared.bytes(from: url)
                let decoder = JSONDecoder()
                for try await line in bytes.lines {
                    guard !line.isEmpty else { continue }
                    let record = try decoder.decode(Record.self, from: Data(line.utf8))
                    continuation.yield(record)                 // hand it out right away
                }
                continuation.finish()
            } catch {
                continuation.finish(throwing: error)
            }
        }
        continuation.onTermination = { _ in task.cancel() }
    }
}

// The UI can show the first records while the rest are still downloading
for try await record in records(from: exportURL) {
    importer.save(record)
}
```

Benefits:

- **Faster first results**: the first record can be shown after a few **milliseconds**, not after the whole 50 MB download.
- **Low memory**: only **one line** is in memory at a time, not the whole response.
- **Cancellable**: stop reading, and the download stops.

Returning an **`AsyncThrowingStream`** (21) keeps the streaming nature all the way to the caller. If you collected everything into an array and returned it at the end, you'd lose most of these benefits.

---

## 40.12 Certificate Pinning 🔴

Normally, a TLS connection is trusted if the server's certificate is signed by **any** certificate authority (CA) the device trusts: **over a hundred** of them. **Certificate pinning** narrows this: the app only accepts a **specific** certificate or **public key** that it knows in advance.

It protects against **man-in-the-middle** (MITM) attacks where an attacker has a **valid-looking** certificate: from a **compromised** CA, or a **custom root** certificate installed on the device (by malware, a corporate proxy, or someone debugging the app).

The **easiest** way (iOS 14+) is **declarative**, in Info.plist, with no code:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSPinnedDomains</key>
    <dict>
        <key>api.example.com</key>
        <dict>
            <key>NSIncludesSubdomains</key>
            <true/>
            <key>NSPinnedLeafIdentities</key>
            <array>
                <dict>
                    <key>SPKI-SHA256-BASE64</key>
                    <string>r/mIkG3eEpVdm+u/ko/cwxzOMo1bk4TyHIlByibiA5E=</string>   <!-- current key -->
                </dict>
                <dict>
                    <key>SPKI-SHA256-BASE64</key>
                    <string>YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2Fuihg=</string>   <!-- BACKUP key -->
                </dict>
            </array>
        </dict>
    </dict>
</dict>
```

You can also pin **in code**, with a session **delegate**. ⚠️ Always run the **normal** trust check **first**; pinning is an **extra** check, not a replacement:

```swift
import CryptoKit

final class PinningSessionDelegate: NSObject, URLSessionDelegate {
    private let pinnedKeyHashes: Set<String>     // include a BACKUP key

    init(pinnedKeyHashes: Set<String>) {
        self.pinnedKeyHashes = pinnedKeyHashes
    }

    func urlSession(_ session: URLSession,
                    didReceive challenge: URLAuthenticationChallenge) async
        -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              let trust = challenge.protectionSpace.serverTrust,
              SecTrustEvaluateWithError(trust, nil),                        // 1. normal validation
              let leaf = (SecTrustCopyCertificateChain(trust) as? [SecCertificate])?.first,
              let key = SecCertificateCopyKey(leaf),
              let keyData = SecKeyCopyExternalRepresentation(key, nil) as Data?
        else {
            return (.cancelAuthenticationChallenge, nil)
        }

        let hash = Data(SHA256.hash(data: keyData)).base64EncodedString()
        guard pinnedKeyHashes.contains(hash) else {                         // 2. the extra pin check
            return (.cancelAuthenticationChallenge, nil)
        }
        return (.useCredential, URLCredential(trust: trust))
    }
}
```

(This hashes the raw key bytes. The `SPKI-SHA256-BASE64` format in Info.plist hashes the full "SubjectPublicKeyInfo" structure instead, so the two hash values differ; don't mix them.)

**The big risk**: if the server's key **changes** and the app doesn't know the new one, **every installed copy stops working** until users update. Certificates are renewed regularly, so this is a real danger. To reduce it:

- Pin the **public key** (which can stay the same across renewals), not the whole certificate.
- Always ship a **backup** pin for the next key.
- Coordinate key changes with the **backend team**, and have a plan for old app versions.

Because of this cost, pinning is usually for **high-security** apps (banking, health), not every app.

---

## 40.13 App Transport Security and Exceptions 🟢

**App Transport Security** (**ATS**) is iOS's **default rule**: network connections must use **HTTPS** with modern **TLS** (1.2 or later) and strong encryption. A plain **`http://`** connection **fails** by default.

To allow an insecure connection, you must add an **exception** in Info.plist, and keep it as **narrow** as possible:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>legacy-internal-api.example.com</key>      <!-- ONE domain only -->
        <dict>
            <key>NSExceptionAllowsInsecureHTTPConnections</key>
            <true/>
        </dict>
    </dict>
</dict>
```

| Setting | Effect | Review risk |
|---|---|---|
| No exceptions | HTTPS everywhere | ✅ None |
| `NSExceptionDomains` for one domain | HTTP allowed **only there** | Low, with a reason |
| `NSAllowsLocalNetworking` | HTTP to local devices / `localhost` | Low (handy during development) |
| `NSAllowsArbitraryLoads` | ATS **off** for everything | ❌ High: App Review asks for a justification |

Why "secure by **default**" matters: you don't have to **remember** to use HTTPS; you have to **explicitly** opt **out**, and that opt-out is **visible** in Info.plist for reviewers and auditors. Without HTTPS, anyone on the same Wi-Fi can **read** and **change** traffic, including login tokens (39.6).

The best fix is almost always to **move the server to HTTPS**, not to add an exception.

---

## 40.14 NWPathMonitor for Connectivity 🟢

**`NWPathMonitor`** (from the **Network** framework) tells you about the device's **network**: is it **connected**? Over **Wi-Fi** or **cellular**? Is the connection **expensive** or in **Low Data Mode**?

```swift
import Network
import Observation

@MainActor @Observable
final class ConnectivityMonitor {
    private(set) var isConnected = true
    private(set) var isExpensive = false
    private(set) var isConstrained = false

    private let monitor = NWPathMonitor()

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            // called on a background queue: hop to the main actor before touching state
            Task { @MainActor in
                self?.isConnected = path.status == .satisfied
                self?.isExpensive = path.isExpensive       // cellular, or a phone's hotspot
                self?.isConstrained = path.isConstrained   // the user turned on Low Data Mode
            }
        }
        monitor.start(queue: DispatchQueue(label: "ConnectivityMonitor"))
    }

    func stop() {
        monitor.cancel()
    }
}
```

| Property | Meaning | What an app might do |
|---|---|---|
| `status == .satisfied` | There's a usable connection | Show or hide an "Offline" banner |
| `isExpensive` | Cellular or a hotspot: data may cost money | Pause big downloads; lower video quality |
| `isConstrained` | **Low Data Mode** is on | Skip prefetching and autoplay |

Using these makes the app **friendlier**: an "You're offline" banner is better than a spinner that times out after 60 seconds.

⚠️ Don't use the monitor to **block** requests ("only send if connected"). The status can be **wrong** for a moment, and some networks only work after a request (captive Wi-Fi portals). **Just try the request**, and handle the error. To make requests **wait** for a connection instead of failing at once, set **`configuration.waitsForConnectivity = true`** on the session.

---

## 40.15 Network.framework and NWConnection Basics 🔴

Under `URLSession`'s **HTTP** world, the **Network** framework gives you **raw** connections: **TCP** (reliable, ordered bytes) and **UDP** (fast, no guarantees). Use it for protocols that **aren't HTTP**: a custom binary protocol, a game server, talking to a device on the local network.

```swift
import Network

let connection = NWConnection(host: "example.com", port: 8080, using: .tcp)

connection.stateUpdateHandler = { state in
    switch state {
    case .ready:
        print("Connection established")
    case .waiting(let error):
        print("Waiting for a network: \(error)")    // e.g. offline; it will retry by itself
    case .failed(let error):
        print("Connection failed: \(error)")
    default:
        break
    }
}

connection.start(queue: .main)

// Send bytes
let message = Data("PING\n".utf8)
connection.send(content: message, completion: .contentProcessed { error in
    if let error { print("Send failed: \(error)") }
})

// Receive bytes (you decide what they mean)
connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { data, _, isComplete, error in
    if let data { print("Got \(data.count) bytes") }
}
```

There are **no** HTTP requests, headers, or status codes here: just **bytes** in and out. **You** define the protocol: how messages start and end, what each byte means. That's a lot more work, so only use `NWConnection` when HTTP really doesn't fit.

| Need | Use |
|---|---|
| REST APIs, downloads, uploads | `URLSession` |
| Real-time two-way messages | `URLSessionWebSocketTask` (40.9) |
| Server push | SSE over `URLSession` (40.10) |
| A custom TCP/UDP protocol, local devices | `NWConnection` |

On iOS 26, the Network framework also adds newer **Swift-concurrency-based** connection types (async/await instead of handlers). Check the current documentation if you start a new low-level networking project.

---

## 40.16 OAuth 2.0 with PKCE 🔴

**OAuth 2.0** is the standard for "**Sign in with X**" and for letting an app access a user's account on **another** service (calendar, cloud storage), **without** the app ever seeing the user's **password**. The user logs in on the **service's own** page, and the app gets a **token**.

Old OAuth flows used a **client secret** to prove the app's identity. But a mobile app **can't keep a secret** (39.13). **PKCE** ("pixie", Proof Key for Code Exchange) solves this with a **fresh, one-time** secret for **each** login:

```swift
import CryptoKit

func base64URL(_ data: Data) -> String {
    data.base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: "=", with: "")
}

func generatePKCEPair() -> (verifier: String, challenge: String) {
    let randomBytes = Data((0..<32).map { _ in UInt8.random(in: 0...255) })   // secure random
    let verifier = base64URL(randomBytes)                                     // keep this private
    let challenge = base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))   // send this
    return (verifier, challenge)
}
```

The flow:

```
1. App makes a random VERIFIER, and its hash: the CHALLENGE.
2. App opens the login page with the CHALLENGE (and a random `state`).
3. User logs in on the service's page (not inside your app's UI).
4. The service redirects back to the app with a one-time CODE.
5. App exchanges CODE + VERIFIER for tokens.
6. Server hashes the VERIFIER; if it matches the CHALLENGE from step 2, it sends the tokens.
```

Why it's safe: an attacker who **steals the code** in step 4 can't use it, because they don't have the **verifier**. It never left the app until step 5, and it's **different for every login**. No long-lived secret is ever stored in the app.

The login page is shown with **`ASWebAuthenticationSession`**: a secure system browser sheet. Your app **can't** read what the user types there, and it can share the browser's existing login cookies. In SwiftUI:

```swift
import AuthenticationServices

struct SignInButton: View {
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession

    var body: some View {
        Button("Sign in with Example") {
            Task {
                let (verifier, challenge) = generatePKCEPair()
                let state = UUID().uuidString                    // protects against forged redirects
                var url = URL(string: "https://auth.example.com/authorize")!
                url.append(queryItems: [
                    URLQueryItem(name: "client_id", value: "my-ios-app"),
                    URLQueryItem(name: "response_type", value: "code"),
                    URLQueryItem(name: "redirect_uri", value: "myapp://callback"),
                    URLQueryItem(name: "code_challenge", value: challenge),
                    URLQueryItem(name: "code_challenge_method", value: "S256"),
                    URLQueryItem(name: "state", value: state)
                ])

                let callback = try await webAuthenticationSession.authenticate(
                    using: url, callbackURLScheme: "myapp")
                let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems
                guard items?.first(where: { $0.name == "state" })?.value == state,
                      let code = items?.first(where: { $0.name == "code" })?.value else { return }

                // 5. exchange code + verifier for tokens, then store them in the Keychain
                try await exchangeCodeForTokens(code: code, verifier: verifier)
            }
        }
    }
}
```

PKCE with `ASWebAuthenticationSession` is the **recommended** way to do OAuth in native apps today. In real projects, a well-tested **library** (like AppAuth) often handles the details; understanding the flow helps you debug it.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Reusable client | `APIClient` protocol, `Endpoint`, injected `URLSession` | One place for networking; easy to fake in tests |
| Generic responses | `send<T: Decodable>()`, typed endpoints | One method for every response type |
| Resilience | Backoff + jitter, retryable errors only | Retry blips without overloading the server |
| Lifecycle-tied requests | `.task(id:)`, cooperative cancellation | Requests stop when views go; ignore cancellation errors |
| Avoiding duplicate work | Actor-based request coalescing | One request shared by simultaneous callers |
| Transparent caching | `URLCache`, `Cache-Control`, cache policies | Reuse fresh responses with no network call |
| Conditional requests | `ETag`, `If-None-Match`, 304 | Cheap "did it change?" checks |
| Long-running transfers | Background `URLSessionConfiguration` | Transfers that continue while the app is suspended |
| Real-time bidirectional | `URLSessionWebSocketTask` | An open connection; both sides send anytime |
| Real-time one-directional | Server-Sent Events, `bytes.lines` | Server pushes text events over HTTP |
| Incremental large data | `URLSession.bytes(for:)`, `AsyncThrowingStream` | Process data as it arrives, with low memory |
| Enhanced TLS security | Certificate pinning (`NSPinnedDomains`) | Block MITM with fake certificates; ship backup pins |
| Transport security policy | App Transport Security | HTTPS by default; narrow exceptions only |
| Connectivity awareness | `NWPathMonitor` | Offline banners, data-saving; still just try requests |
| Low-level sockets | `NWConnection` | Raw TCP/UDP for non-HTTP protocols |
| Secure mobile OAuth | OAuth 2.0 + PKCE, `ASWebAuthenticationSession` | Sign in with other services without a stored secret |
