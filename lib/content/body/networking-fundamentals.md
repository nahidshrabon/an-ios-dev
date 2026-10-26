**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Most apps talk to a **server**: they load a feed, log in, upload a photo. On Apple platforms, you do this with **`URLSession`**, which has a clean **async/await** API. This section covers the basics: HTTP, making requests, sending and decoding JSON, handling **errors** correctly, showing loading states, images, uploads and downloads, and why you can't hide secrets in an app.

---

## 39.1 HTTP Methods, Status Codes, and Headers 🟢

Every HTTP exchange is a **request** and a **response**. Three ideas matter most:

- The **method** says what you **want** to do.
- The **status code** says what **happened**.
- **Headers** carry **extra information** (metadata) about the request or response.

```
Request:   GET /users/42 HTTP/1.1
           Authorization: Bearer <token>
           Accept: application/json

Response:  HTTP/1.1 200 OK
           Content-Type: application/json

           { "id": 42, "name": "Ada" }
```

| Method | Meaning | Example |
|---|---|---|
| `GET` | **Read** something | Load a user's profile |
| `POST` | **Create** something | Post a new comment |
| `PUT` | **Replace** something | Save a whole settings object |
| `PATCH` | **Change part** of something | Rename a playlist |
| `DELETE` | **Remove** something | Delete a photo |

| Status range | Meaning | Common codes |
|---|---|---|
| **2xx** | Success | 200 OK, 201 Created, 204 No Content |
| **3xx** | Redirect | 301 Moved, 304 Not Modified (40.7) |
| **4xx** | **Client** error: the request was wrong | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests |
| **5xx** | **Server** error: the server failed | 500 Internal Server Error, 503 Unavailable |

A **4xx** means "**you** (the app) asked for something wrong": bad data, not logged in, no permission, or it doesn't exist. Retrying the **same** request usually won't help. A **5xx** means "**the server** had a problem"; trying again **later** might work (40.3).

These map straight to Swift: **`URLRequest.httpMethod`** is the method, **`HTTPURLResponse.statusCode`** is the status, and both have **header** dictionaries.

---

## 39.2 URLSession.shared.data(from:) with Async/Await 🟢

The simplest request: **`URLSession.shared.data(from:)`**. It's **`async`**, and returns the response **body** (`Data`) and the **response** info together:

```swift
func fetchUserData() async throws -> Data {
    let url = URL(string: "https://api.example.com/users/42")!
    let (data, response) = try await URLSession.shared.data(from: url)
    return data
}
```

Compare with the **old** completion-handler style:

```swift
// Old: a callback, optional values, and an error you can forget to check
URLSession.shared.dataTask(with: url) { data, response, error in
    if let error { /* … */ return }
    guard let data else { return }
    DispatchQueue.main.async { /* update UI */ }
}.resume()                                  // forget this, and nothing happens
```

The async version is **structured concurrency** (17): no callbacks, no `resume()`, errors are **thrown**, and if the calling **task** is **cancelled** (for example, the view disappears), the request is **cancelled** too.

`URLSession.shared` is a ready-made session with **default** settings. It's fine for most simple requests. For custom settings (timeouts, caching, headers for every request), create your **own** session (40.1).

`data(from:)` takes a plain **`URL`**, so it's for simple **`GET`** requests. For anything more, build a **`URLRequest`** (39.3).

---

## 39.3 Building a URLRequest 🟢

A **`URLRequest`** holds **everything** about a request: the URL, **method**, **headers**, **body**, **timeout**, and cache policy. Pass it to **`data(for:)`** (note: **`for:`**, not `from:`):

```swift
func fetchUserData(id: Int) async throws -> Data {
    var request = URLRequest(url: URL(string: "https://api.example.com/users/\(id)")!)
    request.httpMethod = "GET"                                          // the default, shown for clarity
    request.setValue("application/json", forHTTPHeaderField: "Accept")  // "please answer in JSON"
    request.timeoutInterval = 15                                        // give up after 15 s (default: 60)

    let (data, _) = try await URLSession.shared.data(for: request)
    return data
}
```

| API | Takes | Use for |
|---|---|---|
| `data(from: URL)` | A URL | Simple GET requests |
| `data(for: URLRequest)` | A full request | Custom methods, headers, bodies, timeouts |

**`setValue(_:forHTTPHeaderField:)`** **sets** (or replaces) one header. `addValue` **adds** another value to an existing header; you rarely need it.

⚠️ `URL(string:)!` is fine for **fixed** strings you wrote yourself. For URLs built from **user input** or server data, handle `nil` instead of force-unwrapping, or use `URLComponents` (39.4).

---

## 39.4 URLComponents and Query Items 🟢

**Query parameters** go after the `?` in a URL: `/search?q=coffee&page=2`. Don't build them by **gluing strings**. Use **`URLComponents`**:

```swift
func searchURL(query: String, page: Int) -> URL? {
    var components = URLComponents(string: "https://api.example.com/search")!
    components.queryItems = [
        URLQueryItem(name: "q", value: query),
        URLQueryItem(name: "page", value: String(page))
    ]
    return components.url
}

searchURL(query: "fish & chips", page: 1)
// https://api.example.com/search?q=fish%20%26%20chips&page=1
```

Why string gluing is **broken**:

```swift
let url = "https://api.example.com/search?q=\(query)&page=\(page)"
// query = "fish & chips"
// → ...?q=fish & chips&page=1
//   the SPACE makes URL(string:) fail, and the "&" starts a NEW parameter: "chips"
```

Characters like **`&`**, **`=`**, **`?`**, **`#`**, and **spaces** have **special meaning** in URLs. **`URLComponents`** **percent-encodes** each value (turns `&` into `%26`, a space into `%20`), so the server gets **exactly** the text the user typed. String gluing can **break** the URL or, worse, **silently** send different parameters (and is a classic source of injection bugs).

Since iOS 16, `URL` has a shorter API too:

```swift
let url = URL(string: "https://api.example.com/search")!
    .appending(queryItems: [
        URLQueryItem(name: "q", value: query),
        URLQueryItem(name: "page", value: String(page))
    ])
```

---

## 39.5 POST Requests with a JSON Body 🟢

To **send** data (create or update something), use **`POST`**, `PUT`, or `PATCH` with a **JSON body**. **`JSONEncoder`** turns any **`Encodable`** value into JSON `Data` (14.6):

```swift
struct NewPost: Encodable {
    let title: String
    let body: String
}

func createPost(_ post: NewPost) async throws -> Data {
    var request = URLRequest(url: URL(string: "https://api.example.com/posts")!)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")   // "the body is JSON"
    request.httpBody = try JSONEncoder().encode(post)                           // the actual bytes

    let (data, _) = try await URLSession.shared.data(for: request)
    return data
}

// Sends: {"title":"Hello","body":"First post!"}
```

Two headers that are easy to mix up:

| Header | Says |
|---|---|
| `Content-Type: application/json` | "The body **I'm sending** is JSON" |
| `Accept: application/json` | "Please **send back** JSON" |

**`httpBody`** holds the encoded bytes. You reuse the **same** `Codable` types from 14 for networking: no special code needed.

Many APIs use **snake_case** keys (`created_at`) while Swift uses **camelCase** (`createdAt`). Set a key strategy once instead of writing `CodingKeys` (14.11):

```swift
let encoder = JSONEncoder()
encoder.keyEncodingStrategy = .convertToSnakeCase
encoder.dateEncodingStrategy = .iso8601
```

---

## 39.6 Authentication Headers and Bearer Tokens 🟢

Most APIs need to know **who** is asking. The common way is a **token** in the **`Authorization`** header, with the word **`Bearer`** in front:

```swift
func authorizedRequest(url: URL, token: String) -> URLRequest {
    var request = URLRequest(url: url)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    return request
}

// Sends:  Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

"**Bearer**" means "whoever **bears** (holds) this token is allowed in". The format comes from **OAuth 2.0** (40.16). The token is usually a **JWT** or a random session string that the server gives you when the user **logs in**. The server checks it on every request.

Good habits:

- **Store** tokens in the **Keychain** (43), never in `UserDefaults` or plain files.
- **Add the header in one place** (a small API client, 40.1), not at every call site. Then there's one place to handle **expired** tokens (a `401`): refresh the token and retry once.
- Use **HTTPS** only. A token sent over plain HTTP can be read by anyone on the network (40.13).

---

## 39.7 Handling HTTP Errors vs. Transport Errors 🟡

Networking can fail in **two** very different ways:

| | **Transport error** | **HTTP error** |
|---|---|---|
| What happened | The request **didn't complete**: no internet, DNS failed, timed out, cancelled | The server **answered**, with an error status (404, 500…) |
| How you see it | `URLSession` **throws** a `URLError` | **No throw!** You get data and a response, as if all went well |
| Example | `URLError(.notConnectedToInternet)` | `statusCode == 404` |

That second row is the classic **bug**: `URLSession` treats a `404` or `500` as a **successful** network exchange (bytes came back), so it **doesn't throw**. You must **check the status yourself**:

```swift
enum APIError: Error {
    case invalidResponse
    case httpError(statusCode: Int, body: Data)
}

func fetchUser(id: Int) async throws -> Data {
    let url = URL(string: "https://api.example.com/users/\(id)")!
    let (data, response) = try await URLSession.shared.data(from: url)   // throws on TRANSPORT errors

    guard let httpResponse = response as? HTTPURLResponse else {
        throw APIError.invalidResponse
    }
    guard (200...299).contains(httpResponse.statusCode) else {
        throw APIError.httpError(statusCode: httpResponse.statusCode, body: data)   // HTTP errors
    }
    return data
}
```

Keep the error **body**: many APIs send a JSON message explaining **why** (`{"error": "Email already taken"}`).

Handle the cases **differently** in the UI:

```swift
do {
    user = try await fetchUser(id: 42)
} catch let error as URLError where error.code == .notConnectedToInternet {
    message = "You're offline. Check your connection."
} catch is CancellationError {
    // the view went away: do nothing
} catch let error as URLError where error.code == .cancelled {
    // URLSession's own cancellation: also ignore
} catch APIError.httpError(let status, _) where status == 401 {
    showLogin = true                       // token expired
} catch APIError.httpError(let status, _) where status == 404 {
    message = "This profile doesn't exist."
} catch {
    message = "Something went wrong. Please try again."
}
```

---

## 39.8 Decoding a Response into Codable Models 🟢

After checking the status, turn the JSON into **Swift types** with **`JSONDecoder`**, the mirror of `JSONEncoder` (39.5):

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

    return try JSONDecoder().decode(User.self, from: data)   // JSON → User
}
```

If the JSON **doesn't match** `User` (a **missing** key, a **wrong type** like `"id": "42"` instead of `42`, or **invalid** JSON), `decode` **throws** a **`DecodingError`**. It does **not** give you a half-filled `User`. The error says **exactly** what went wrong:

```swift
do {
    let user = try JSONDecoder().decode(User.self, from: data)
} catch DecodingError.keyNotFound(let key, let context) {
    print("Missing key '\(key.stringValue)' at \(context.codingPath.map(\.stringValue))")
} catch DecodingError.typeMismatch(let type, let context) {
    print("Expected \(type) at \(context.codingPath.map(\.stringValue))")
} catch {
    print(error)
}
// "Missing key 'email' at []"
```

Make the model **tolerant** where the server may leave things out: use **optionals** for fields that can be missing or `null`:

```swift
struct User: Decodable {
    let id: Int
    let name: String
    let email: String?        // may be missing: decodes as nil instead of failing
    let avatarURL: URL?       // URLs decode straight from strings
}
```

This function now does it all: **status check** + **decoding**, with one clear `async throws` signature that returns a **typed** model.

---

## 39.9 Loading, Empty, Error, and Success UI States 🟢

A screen that loads data can be in **several** states: **loading**, **loaded**, **empty** (loaded, but nothing to show), or **failed**. Model them with **one enum**:

```swift
enum LoadState<Value> {
    case loading
    case empty
    case error(Error)
    case loaded(Value)
}

struct OrdersView: View {
    @State private var state: LoadState<[Order]> = .loading

    var body: some View {
        Group {
            switch state {
            case .loading:
                ProgressView()
            case .empty:
                ContentUnavailableView("No Orders Yet", systemImage: "bag",
                                       description: Text("Your orders will show up here."))
            case .error(let error):
                ContentUnavailableView {
                    Label("Something Went Wrong", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error.localizedDescription)
                } actions: {
                    Button("Try Again") { Task { await load() } }
                }
            case .loaded(let orders):
                List(orders) { OrderRow(order: $0) }
                    .refreshable { await load() }
            }
        }
        .task { await load() }               // starts when the view appears; cancelled when it goes
    }

    private func load() async {
        do {
            let orders = try await fetchOrders()
            state = orders.isEmpty ? .empty : .loaded(orders)
        } catch is CancellationError {
            // the view went away: not a real error
        } catch {
            state = .error(error)
        }
    }
}
```

Why an **enum** and not separate flags?

```swift
// ❌ Flags: 2 × 2 × 2 = 8 combinations, most of them nonsense
@State var isLoading = false
@State var error: Error?
@State var orders: [Order]?
// isLoading == true AND error != nil AND orders != nil? What should the screen show?

// ✅ An enum: exactly ONE state at a time
@State var state: LoadState<[Order]> = .loading
```

With flags, it's easy to forget to reset one, and the screen shows a **spinner over an error**. The enum makes those **impossible** states **impossible to write** (6.22), and the `switch` makes you handle **every** case.

**`.task { }`** is the right place to start loading: it runs when the view **appears**, and its task is **cancelled** when the view **disappears** (17), which also cancels the request.

---

## 39.10 AsyncImage for Remote Images 🟢

**`AsyncImage`** downloads and shows an image from a **URL**, with no `URLSession` code:

```swift
struct AvatarView: View {
    let url: URL?

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .empty:
                ProgressView()                                    // still loading
            case .success(let image):
                image.resizable().scaledToFill()                  // loaded
            case .failure:
                Image(systemName: "person.crop.circle.badge.exclamationmark")   // failed
                    .foregroundStyle(.secondary)
            @unknown default:
                EmptyView()
            }
        }
        .frame(width: 60, height: 60)
        .clipShape(.circle)
    }
}
```

There are two forms:

```swift
// Simple: content + placeholder. A failure just shows the placeholder forever.
AsyncImage(url: url) { image in
    image.resizable().scaledToFit()
} placeholder: {
    ProgressView()
}

// Phases: you handle loading, success, AND failure separately (above)
```

The **phase** form lets you show a **proper fallback** on **failure**, instead of a spinner that never ends. Use it for anything important.

Know its **limits**:

- It has **no in-memory cache** of its own. It relies on the shared **`URLCache`** (40.6), so images may reload when cells are reused or views are recreated.
- No control over **downsampling** (shrinking big images to the display size), **priority**, or **prefetching**.

For **avatars** and the occasional image, `AsyncImage` is perfect. For **image-heavy** lists and grids, use a small image loader with a cache (or an image library), with downsampling (69.12).

---

## 39.11 Uploading Files and Multipart Form Data 🟡

To upload a **file** (like a photo) together with normal **form fields**, many APIs use **`multipart/form-data`**. The body is split into **parts**, separated by a **boundary** string:

```swift
func uploadPhoto(_ imageData: Data, filename: String, caption: String) async throws {
    let boundary = "Boundary-\(UUID().uuidString)"
    var request = URLRequest(url: URL(string: "https://api.example.com/upload")!)
    request.httpMethod = "POST"
    request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

    var body = Data()

    // Part 1: a normal text field
    body.append("--\(boundary)\r\n")
    body.append("Content-Disposition: form-data; name=\"caption\"\r\n\r\n")
    body.append("\(caption)\r\n")

    // Part 2: the file
    body.append("--\(boundary)\r\n")
    body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n")
    body.append("Content-Type: image/jpeg\r\n\r\n")
    body.append(imageData)
    body.append("\r\n")

    // The end
    body.append("--\(boundary)--\r\n")

    let (_, response) = try await URLSession.shared.upload(for: request, from: body)
    guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
        throw APIError.invalidResponse
    }
}

extension Data {
    mutating func append(_ string: String) {
        append(Data(string.utf8))
    }
}
```

The body looks like this:

```
--Boundary-1234
Content-Disposition: form-data; name="caption"

Sunset at the beach
--Boundary-1234
Content-Disposition: form-data; name="file"; filename="photo.jpg"
Content-Type: image/jpeg

<binary JPEG bytes>
--Boundary-1234--
```

- The **boundary** is a unique string that **won't** appear inside the content. It marks where each part **starts**, and `--boundary--` marks the **end**.
- Each part has its own small **headers**: its field **name**, and for files, a **filename** and **content type**.
- Lines end with **`\r\n`** (carriage return + line feed), as the format requires.

**`upload(for:from:)`** is the upload-specific API. For **large** files, use **`upload(for:fromFile:)`**, which streams from disk instead of loading the whole file into memory. Shrink photos **before** uploading (55): a full-size camera image is many megabytes.

---

## 39.12 Downloading Files with Progress 🟡

For a **file download**, the simplest API is **`download(from:)`**. It saves the file to a **temporary location** and gives you its URL:

```swift
func downloadFile(from url: URL) async throws -> URL {
    let (tempURL, response) = try await URLSession.shared.download(from: url)
    guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
        throw APIError.invalidResponse
    }
    // Move it right away: the temp file can be deleted soon after this returns
    let destination = URL.documentsDirectory.appending(path: url.lastPathComponent)
    try? FileManager.default.removeItem(at: destination)
    try FileManager.default.moveItem(at: tempURL, to: destination)
    return destination
}
```

To show **progress**, you need data **as it arrives**. **`bytes(from:)`** returns an **`AsyncSequence`** of bytes (21), so you can count them in a loop:

```swift
func downloadFile(from url: URL, progressHandler: @escaping (Double) -> Void) async throws -> URL {
    let (asyncBytes, response) = try await URLSession.shared.bytes(from: url)
    let expectedLength = response.expectedContentLength          // -1 if the server didn't say

    let fileURL = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
    FileManager.default.createFile(atPath: fileURL.path(), contents: nil)
    let handle = try FileHandle(forWritingTo: fileURL)
    defer { try? handle.close() }

    var buffer = Data()
    buffer.reserveCapacity(64 * 1024)
    var received: Int64 = 0

    for try await byte in asyncBytes {
        buffer.append(byte)
        if buffer.count == 64 * 1024 {                           // write in 64 KB chunks,
            try handle.write(contentsOf: buffer)                 // not the whole file in memory
            received += Int64(buffer.count)
            buffer.removeAll(keepingCapacity: true)
            if expectedLength > 0 {
                progressHandler(Double(received) / Double(expectedLength))
            }
        }
    }
    try handle.write(contentsOf: buffer)                         // the last bit
    progressHandler(1)
    return fileURL
}
```

**Progress** = **bytes received** ÷ **expected total** (`expectedContentLength`, from the `Content-Length` header). If the server doesn't send a length, it's `-1`, and you can only show an **indeterminate** spinner.

Write to the file in **chunks**. Keeping the whole download in one `Data` would use as much **memory** as the file is big.

For **big** or **long** downloads that should keep going when the user **leaves the app**, use a **background** `URLSession` (40.8): the system does the transfer for you, even if your app is suspended.

---

## 39.13 API Keys and Why Client Secrets Aren't Secret 🟡

An important truth: **anything inside your app can be extracted.** API keys, "secret" tokens, passwords: if they're in the **app binary**, a motivated person can get them, with free tools, in minutes.

```swift
// ❌ INSECURE, however it's hidden:
let apiKey = "sk_live_abc123..."                     // plain: visible with `strings` on the binary
let hidden = Data(base64Encoded: "c2tfbGl2ZV9...")   // Base64: decoded in one line
let xored = obfuscate(bytes, with: 0x5A)             // XOR: the key to undo it is in the app too
```

Why no trick can fix this: to **use** the secret, the app must be able to **read** it. So everything needed to recover it (the scrambled value **and** the code to unscramble it) ships **inside** the app. Obfuscation only adds **friction**; it never makes it **secret**. An attacker can also just **watch** the app's network traffic, or read the value from memory while the app runs.

The **real** fix is architecture: **genuinely secret keys never reach the app**.

```
❌  App ──(secret key)──────────────────────► Payment provider

✅  App ──(user's login token)──► YOUR server ──(secret key)──► Payment provider
                                  (the secret lives here; users can't inspect it)
```

1. The app **logs in** to **your** backend and gets a **user token** (39.6).
2. The app asks **your** server to do the sensitive action ("charge $5").
3. Your server checks the user, **then** calls the third party with the **real** secret.

What can **ship** in the app, and what **can't**:

| ✅ OK in the app | ❌ Must stay on a server |
|---|---|
| **Publishable** / public keys meant for clients (e.g., a payment provider's publishable key) | **Secret** keys (e.g., a payment provider's secret key) |
| Keys **restricted** by bundle ID, domain, or scope, with **rate limits** | Admin or full-access API credentials |
| The user's **own** session token (stored in the Keychain) | Database passwords, signing keys |

The question to ask: "**If a stranger had this value, what could they do?**" If the answer is "spend our money" or "read other users' data", it doesn't belong in the app.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| HTTP vocabulary | Methods, status codes, headers | 4xx = the request was wrong; 5xx = the server failed |
| Simple fetch | `URLSession.shared.data(from:)` | Async/await GET; cancelled with its task |
| Configurable requests | `URLRequest`, `.data(for:)` | Methods, headers, bodies, timeouts |
| Query strings | `URLComponents`, `URLQueryItem` | Correct percent-encoding; never glue strings |
| Sending JSON | `JSONEncoder`, `httpBody`, `Content-Type` | Encode `Codable` models as the body |
| Authentication | `Authorization: Bearer <token>` | Token from login; Keychain; one place to add it |
| Error categories | `URLError` vs. status code checks | 404 and 500 don't throw; check the status yourself |
| Response parsing | `JSONDecoder`, `Decodable` | Typed models; `DecodingError` says what didn't match |
| UI state modeling | `enum LoadState` | One state at a time; handle every case |
| Remote images | `AsyncImage` with phases | Easy images; no own cache; handle failure |
| File uploads | `multipart/form-data`, `upload(for:from:)` | Fields and files, separated by a boundary |
| Download progress | `download(from:)`, `bytes(from:)` | Save to a file; count bytes for progress |
| Client-side security | Backend-held secrets | Anything in the app can be extracted |
