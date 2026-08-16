## 39.1 HTTP Methods, Status Codes, and Headers

HTTP methods express the *intent* of a request (`GET` to retrieve, `POST` to create, `PUT`/`PATCH` to update, `DELETE` to remove), status codes communicate the *outcome* (2xx success, 3xx redirection, 4xx client error, 5xx server error), and headers carry metadata about the request or response (content type, authentication, caching directives).

```swift
// Conceptual anatomy of an HTTP exchange:
// Request:  GET /users/42 HTTP/1.1
//           Authorization: Bearer <token>
//           Accept: application/json
//
// Response: HTTP/1.1 200 OK
//           Content-Type: application/json
//           { "id": 42, "name": "Ada" }
```

Understanding this vocabulary precisely matters because it maps directly onto Swift API shapes: `URLRequest.httpMethod` sets the method string, `HTTPURLResponse.statusCode` exposes the numeric status, and `URLRequest`/`HTTPURLResponse`'s header dictionaries carry the metadata — every subsequent topic in this section builds on these three fundamental HTTP concepts.

---

## 39.2 URLSession.shared.data(from:) with Async/Await

The simplest way to fetch data is `URLSession.shared.data(from:)`, an `async` method returning both the raw `Data` and the `URLResponse` in one call — a direct, modern replacement for the older completion-handler-based API.

```swift
func fetchUserData() async throws -> Data {
    let url = URL(string: "https://api.example.com/users/42")!
    let (data, response) = try await URLSession.shared.data(from: url)
    return data
}
```

This `async`/`await`-based API is a direct application of structured concurrency (Part 2) to networking — no completion handlers, no manual dispatch queue hopping, and errors propagate naturally via Swift's `throws` mechanism rather than an `Error?` parameter that's easy to forget to check. `data(from:)` is appropriate for simple `GET` requests where a plain `URL` is sufficient; more complex requests (custom headers, methods, bodies) require building a full `URLRequest`, covered next.

---

## 39.3 Building a URLRequest

`URLRequest` bundles a URL together with everything else that defines an HTTP request — method, headers, body, caching policy, and timeout — and is passed to `URLSession.shared.data(for:)` (note: `for:`, not `from:`) instead of a bare `URL`.

```swift
func fetchUserData(id: Int) async throws -> Data {
    var request = URLRequest(url: URL(string: "https://api.example.com/users/\(id)")!)
    request.httpMethod = "GET"
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.timeoutInterval = 15

    let (data, _) = try await URLSession.shared.data(for: request)
    return data
}
```

`URLSession.shared.data(for:)` is the `URLRequest`-accepting overload, used whenever a request needs more configuration than a bare URL can express — essentially any request beyond the simplest unauthenticated `GET`. `setValue(_:forHTTPHeaderField:)` is the standard way to add or replace a single header value on the request, and `timeoutInterval` overrides the default timeout for this specific request when the default (60 seconds) isn't appropriate.

---

## 39.4 URLComponents and Query Items

`URLComponents` provides structured, correctly-escaped construction of URLs with query parameters, avoiding the error-prone and unsafe practice of manually concatenating strings to build a query string.

```swift
func searchURL(query: String, page: Int) -> URL? {
    var components = URLComponents(string: "https://api.example.com/search")!
    components.queryItems = [
        URLQueryItem(name: "q", value: query),
        URLQueryItem(name: "page", value: String(page))
    ]
    return components.url
}
```

Building query strings via manual string interpolation (`"?q=\(query)&page=\(page)"`) is fragile and unsafe — a query value containing an `&`, a space, or other reserved URL characters would corrupt the resulting URL or silently produce wrong query parameters. `URLComponents`'s `queryItems` array handles proper percent-encoding of each value automatically, making it the correct, robust tool any time a URL needs dynamic query parameters rather than a fixed path.

---

## 39.5 POST Requests with a JSON Body

Sending data to a server (creating or updating a resource) typically means a `POST`/`PUT`/`PATCH` request with a JSON-encoded body, built by combining `URLRequest` configuration with `JSONEncoder` (recall `Codable`, section 9 and beyond).

```swift
struct NewPost: Encodable {
    let title: String
    let body: String
}

func createPost(_ post: NewPost) async throws -> Data {
    var request = URLRequest(url: URL(string: "https://api.example.com/posts")!)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(post)

    let (data, _) = try await URLSession.shared.data(for: request)
    return data
}
```

`Content-Type: application/json` tells the server how to interpret the request body's bytes, and `request.httpBody` carries those actual encoded bytes — `JSONEncoder().encode(post)` produces exactly the `Data` needed here, directly reusing the same `Encodable` conformance mechanism from earlier `Codable` material rather than requiring any networking-specific serialization code.

---

## 39.6 Authentication Headers and Bearer Tokens

Most authenticated APIs expect credentials passed via the `Authorization` header, most commonly as a "Bearer token" — a string (often a JWT or opaque session token) proving the request is made on behalf of an authenticated user.

```swift
func authorizedRequest(url: URL, token: String) -> URLRequest {
    var request = URLRequest(url: url)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    return request
}
```

The `Bearer <token>` format is a widely-adopted convention (part of the OAuth 2.0 specification, previewed further in section 40.16) — the server validates the token and, if valid, treats the request as authenticated on behalf of whichever user or client that token represents. Centralizing this header-attaching logic (rather than repeating it at every call site) is one of the first steps toward the reusable API client layer covered in section 40.1.

---

## 39.7 Handling HTTP Errors vs. Transport Errors

Networking has two fundamentally distinct failure categories: *transport errors* (the request never successfully completed — no connectivity, DNS failure, timeout, thrown as Swift `Error`s from `URLSession` itself) and *HTTP errors* (the request completed successfully at the network level, but the server responded with an error status code like 404 or 500 — which `URLSession` does *not* automatically throw as a Swift error).

```swift
enum APIError: Error {
    case invalidResponse
    case httpError(statusCode: Int)
}

func fetchUser(id: Int) async throws -> Data {
    let url = URL(string: "https://api.example.com/users/\(id)")!
    let (data, response) = try await URLSession.shared.data(from: url)

    guard let httpResponse = response as? HTTPURLResponse else {
        throw APIError.invalidResponse
    }
    guard (200...299).contains(httpResponse.statusCode) else {
        throw APIError.httpError(statusCode: httpResponse.statusCode)
    }
    return data
}
```

This is one of the most common correctness bugs in beginner networking code: a `404 Not Found` response is, from `URLSession`'s perspective, a perfectly successful network transaction — the bytes came back fine, they just represent an error payload. Explicitly checking `httpResponse.statusCode` (as shown, via a `(200...299).contains()` range check) and throwing a custom error for anything outside the success range is necessary to correctly surface HTTP-level failures through Swift's `throws` mechanism, since `URLSession` won't do this distinction for you automatically.

---

## 39.8 Decoding a Response into Codable Models

Once response data and a success status are confirmed, `JSONDecoder` converts the raw JSON bytes into strongly-typed Swift model types conforming to `Decodable` — the mirror image of the `JSONEncoder` usage from 39.5.

```swift
struct User: Decodable {
    let id: Int
    let name: String
    let email: String
}

func fetchUser(id: Int) async throws -> User {
    let url = URL(string: "https://api.example.com/users/\(id)")!
    let (data, response) = try await URLSession.shared.data(from: url)

    guard let httpResponse = response as? HTTPURLResponse,
          (200...299).contains(httpResponse.statusCode) else {
        throw APIError.invalidResponse
    }

    return try JSONDecoder().decode(User.self, from: data)
}
```

`JSONDecoder().decode(User.self, from: data)` performs the full parse in one call, throwing a `DecodingError` if the JSON's shape doesn't match `User`'s expected structure (a missing required field, a type mismatch, and so on) — this is exactly the same `Codable` machinery from earlier in the curriculum, applied to network response data rather than local file or `UserDefaults` persistence. Combining the status-code check (39.7) with decoding in one function, as shown, produces a single `async throws` function with a clean, strongly-typed return value and no ambiguity about what failure means at each stage.

---

## 39.9 Loading, Empty, Error, and Success UI States

A screen displaying network-fetched data needs to represent (and correctly render) more than just "the data" — it needs a full state machine covering the request's lifecycle: loading, empty (successfully loaded but no results), error, and success.

```swift
enum LoadState<Value> {
    case loading
    case empty
    case error(Error)
    case loaded(Value)
}

struct UserProfileView: View {
    @State private var state: LoadState<User> = .loading

    var body: some View {
        Group {
            switch state {
            case .loading:
                ProgressView()
            case .empty:
                ContentUnavailableView("No Data", systemImage: "tray")
            case .error(let error):
                ContentUnavailableView("Something Went Wrong", systemImage: "exclamationmark.triangle", description: Text(error.localizedDescription))
            case .loaded(let user):
                Text(user.name)
            }
        }
        .task {
            do {
                state = .loading
                let user = try await fetchUser(id: 42)
                state = .loaded(user)
            } catch {
                state = .error(error)
            }
        }
    }
}
```

Modeling this explicitly as an `enum` (rather than juggling several independent `Bool`/optional flags like `isLoading`, `hasError`, `data: User?`) guarantees the UI can only ever be in exactly one well-defined state at a time — recall the general enum-modeling principle from earlier Swift material (section 6): making invalid states genuinely unrepresentable is far more robust than a handful of independently-mutable flags that could theoretically combine into a nonsensical or contradictory combination. `.task { }` (section 17+) is the natural place to trigger the async fetch and drive this state machine as the view appears.

---

## 39.10 AsyncImage for Remote Images

`AsyncImage` is SwiftUI's built-in view for loading and displaying a remote image from a URL, handling the download, decoding, and loading/failure states declaratively without manual `URLSession` code.

```swift
struct AvatarView: View {
    let url: URL

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .empty:
                ProgressView()
            case .success(let image):
                image.resizable().scaledToFill()
            case .failure:
                Image(systemName: "person.crop.circle.badge.exclamationmark")
            @unknown default:
                EmptyView()
            }
        }
        .frame(width: 60, height: 60)
        .clipShape(Circle())
    }
}
```

The phase-based initializer (as opposed to `AsyncImage`'s simpler `content`/`placeholder` closure variant) gives explicit control over all three possible states — `.empty` (still loading), `.success` (image ready to display), and `.failure` (the load failed) — letting the UI handle failure gracefully (like the fallback person icon shown) rather than silently showing nothing. `AsyncImage` was seen briefly used within `UIHostingConfiguration` cell content in section 38.6; this is its full, dedicated treatment.

---

## 39.11 Uploading Files and Multipart Form Data

Uploading a file (like a photo) typically uses `multipart/form-data` encoding, a format that lets a single request body carry both regular form fields and raw binary file data together, each clearly delimited by a boundary string.

```swift
func uploadPhoto(_ imageData: Data, filename: String) async throws {
    let boundary = UUID().uuidString
    var request = URLRequest(url: URL(string: "https://api.example.com/upload")!)
    request.httpMethod = "POST"
    request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

    var body = Data()
    body.append("--\(boundary)\r\n".data(using: .utf8)!)
    body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
    body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
    body.append(imageData)
    body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

    request.httpBody = body
    _ = try await URLSession.shared.data(for: request)
}
```

The `boundary` string (a unique value not expected to appear in the actual file content) delimits each part of the multipart body, and each part carries its own small header block (`Content-Disposition`, optionally `Content-Type`) describing what that part represents — this hand-assembled structure is precisely what the `multipart/form-data` MIME type specifies, and while libraries can abstract this construction, understanding the raw format is valuable for debugging upload issues or working with APIs that have specific multipart requirements.

---

## 39.12 Downloading Files with Progress

For large file downloads where progress reporting matters (rather than just awaiting a final result), `URLSession.shared.download(for:)`'s delegate-based variant, or the `bytes(for:)` async sequence (previewed further in section 40.11), lets the app track download progress incrementally.

```swift
func downloadFile(from url: URL, progressHandler: @escaping (Double) -> Void) async throws -> URL {
    let (asyncBytes, response) = try await URLSession.shared.bytes(from: url)
    let expectedLength = response.expectedContentLength
    var receivedData = Data()

    for try await byte in asyncBytes {
        receivedData.append(byte)
        if expectedLength > 0 {
            progressHandler(Double(receivedData.count) / Double(expectedLength))
        }
    }

    let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try receivedData.write(to: tempURL)
    return tempURL
}
```

`URLSession.shared.bytes(from:)` returns an `AsyncSequence` of individual bytes (or, more efficiently in practice, larger chunks) rather than waiting for the entire download to complete before returning anything — this directly applies `AsyncSequence` iteration (section 21) to incremental network data, letting the app compute and report progress as bytes actually arrive, based on the ratio of `receivedData.count` to the response's `expectedContentLength`. For genuinely large or long-running downloads that should survive the app being backgrounded, a background `URLSession` (covered in section 40.8) is the more robust tool.

---

## 39.13 API Keys and Why Client Secrets Aren't Secret

A practical, important reality check: any value embedded in an app's compiled binary — API keys, "secret" tokens, hardcoded credentials — can be extracted by a sufficiently motivated party through binary inspection, regardless of how it's obscured (Base64 encoding, XOR "encryption," string splitting) in source code.

```swift
// INSECURE (regardless of "obfuscation" applied):
let apiKey = "sk_live_abc123..." // extractable from the compiled binary

// BETTER: the client never holds the actual secret at all —
// it authenticates to YOUR backend, which holds the real secret
// and makes the sensitive API call server-side on the client's behalf
```

The fundamental issue: a value baked into a shipped app binary is, cryptographically speaking, available to anyone who has the app installed — there is no client-side technique (obfuscation, encryption with a key that must itself also ship in the binary, and so on) that changes this fundamental fact, only techniques that add friction to extraction. The robust architectural fix is to never let genuinely sensitive secrets (payment provider secret keys, admin-level API credentials) reach the client at all — instead, the client authenticates to your own backend server (via the bearer-token pattern from 39.6), and that backend, which the attacker cannot inspect, holds and uses the real secret on the client's behalf. This distinction — what's acceptable to ship client-side (a rate-limited, scoped public API key) versus what genuinely must stay server-side — is a foundational security judgment call for any app design involving third-party services.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| HTTP vocabulary | Methods, status codes, headers | Foundation for every networking API shape |
| Simple fetch | `URLSession.shared.data(from:)` | Async/await GET requests |
| Configurable requests | `URLRequest`, `.data(for:)` | Custom method, headers, body, timeout |
| Query strings | `URLComponents`, `URLQueryItem` | Safe, correctly-escaped URL construction |
| Sending JSON | `JSONEncoder`, `httpBody` | POST/PUT/PATCH with encoded request bodies |
| Authentication | `Authorization: Bearer <token>` | Standard credential-passing convention |
| Error categories | Transport errors vs. HTTP status checks | Distinguish connectivity failure from server error responses |
| Response parsing | `JSONDecoder`, `Decodable` | Convert JSON bytes into strongly-typed models |
| UI state modeling | `enum LoadState` | Represent loading/empty/error/success exhaustively |
| Remote images | `AsyncImage` | Declarative image loading with phase handling |
| File uploads | `multipart/form-data` | Combined form fields and binary file data |
| Download progress | `URLSession.shared.bytes(from:)` | Incremental, progress-reportable downloads |
| Client-side security | Backend-mediated secrets | Never ship genuinely sensitive secrets in the app binary |
