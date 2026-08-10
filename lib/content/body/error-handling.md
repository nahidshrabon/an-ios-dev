*Estimated read time: ~30 minutes*

---

## 9.1 The `Error` Protocol and Custom Error Enums

Any type can represent an error by conforming to the empty `Error` protocol — in practice, this is almost always an enum, since errors naturally form a finite, related set of cases, optionally carrying associated data (recall 6.17):

```swift
enum NetworkError: Error {
    case invalidURL
    case noConnection
    case serverError(statusCode: Int)
    case decodingFailed(underlying: Swift.Error)
}
```

`Error` itself declares no requirements — conforming is purely a marker that lets a type participate in Swift's `throw`/`try`/`catch` machinery. Associated values let each error case carry exactly the context relevant to diagnosing it, like the `statusCode` above.

---

## 9.2 `throws` and `throw`

A function that can fail is marked `throws` in its signature, right before the return arrow, and uses `throw` to actually raise an error at the point of failure:

```swift
enum ValidationError: Error {
    case tooShort
    case tooLong
}

func validate(username: String) throws -> String {
    if username.count < 3 {
        throw ValidationError.tooShort
    }
    if username.count > 20 {
        throw ValidationError.tooLong
    }
    return username
}
```

A `throws` function *must* be called with `try` (see 9.4) — the compiler enforces this at every call site, making error-producing calls visible wherever they occur, unlike exceptions in some other languages that can silently propagate unnoticed.

---

## 9.3 `do` / `catch` and Catch Patterns

`do`/`catch` is how you actually handle a thrown error — code that might throw goes in the `do` block, prefixed with `try`, and `catch` blocks handle specific errors (or all errors, as a fallback):

```swift
do {
    let name = try validate(username: "ab")
    print("Valid: \(name)")
} catch ValidationError.tooShort {
    print("Username is too short")
} catch ValidationError.tooLong {
    print("Username is too long")
} catch {
    print("Unexpected error: \(error)")
}
// "Username is too short"
```

`catch` patterns work just like `switch` case patterns (recall section 2) — you can match specific cases, bind associated values, or fall back to a catch-all `catch { }` block, which implicitly binds the thrown value to a local constant named `error`.

```swift
do {
    // ...
} catch let error as ValidationError {
    print("Validation failed: \(error)")
} catch {
    print("Some other error: \(error)")
}
```

---

## 9.4 `try`, `try?`, and `try!`

`try` is the standard form — it propagates the error upward if the call throws, requiring the surrounding context to either be inside a `do`/`catch` or itself be a `throws` function:

```swift
func loadUser() throws -> String {
    try validate(username: "ab")   // propagates the error further up if this throws
}
```

`try?` converts the result into an **optional** — `nil` if the call threw, or the successful value wrapped in `Optional` otherwise, discarding the specific error entirely:

```swift
let result = try? validate(username: "ab")
print(result)   // nil — the error is swallowed, only success/failure survives
```

`try!` force-unwraps the result, asserting the call will **never** throw — if it does anyway, the app crashes immediately, exactly like force-unwrapping a `nil` optional (recall 4.7):

```swift
let name = try! validate(username: "alice")   // fine here, but crashes if validation ever fails
```

**Guidance:** use `try` with `do`/`catch` (or propagate further with `throws`) as the default; reserve `try?` for cases where you genuinely don't care *why* something failed, only *whether* it did; treat `try!` with the same caution as `!` on optionals — only for cases with a genuine, structural guarantee of success.

---

## 9.5 `rethrows`

`rethrows` marks a function that **itself doesn't throw directly**, but calls a closure parameter that might throw — the function only throws if that closure actually does. This precisely describes many higher-order functions, like a custom `map` that accepts a throwing transform:

```swift
func customMap<T, U>(_ items: [T], _ transform: (T) throws -> U) rethrows -> [U] {
    var result: [U] = []
    for item in items {
        result.append(try transform(item))
    }
    return result
}

// calling with a non-throwing closure — no try needed at the call site
let doubled = customMap([1, 2, 3]) { $0 * 2 }

// calling with a throwing closure — try IS needed here
let converted = try customMap(["1", "2", "abc"]) { (str) -> Int in
    guard let value = Int(str) else { throw ValidationError.tooShort }
    return value
}
```

`rethrows` is more precise than plain `throws` for this exact pattern — it tells callers "I only throw if you gave me a closure that throws," letting them skip `try` entirely when they pass a non-throwing closure, which a plain `throws` function wouldn't allow.

---

## 9.6 Typed Throws: `throws(MyError)` 🔵

Since Swift 6, a function can declare **exactly which error type** it throws, rather than the implicit `any Error` that ordinary `throws` uses — written `throws(SpecificErrorType)`:

```swift
enum ParsingError: Error {
    case emptyInput
    case invalidFormat
}

func parse(_ input: String) throws(ParsingError) -> Int {
    guard !input.isEmpty else { throw ParsingError.emptyInput }
    guard let value = Int(input) else { throw ParsingError.invalidFormat }
    return value
}

do {
    let value = try parse("abc")
} catch {
    // "error" here is statically known to be of type ParsingError, not "any Error"
    switch error {
    case .emptyInput: print("empty!")
    case .invalidFormat: print("bad format!")
    }
}
```

The benefit is precision: callers of a typed-throws function get compile-time exhaustiveness checking on the specific error type in their `catch` block, and don't pay the (small) overhead of boxing an arbitrary `any Error` existential. Plain `throws` remains the right default for most code — typed throws is most valuable in performance-sensitive contexts or libraries wanting to expose a precise, closed error contract.

---

## 9.7 `Result` Type and Converting To/From `throws`

`Result<Success, Failure: Error>` is an enum with two cases, `.success(Success)` and `.failure(Failure)` — a way to represent the outcome of an operation as a plain **value** rather than via the `throws`/`try`/`catch` control-flow mechanism, useful for storing an outcome, passing it across an async boundary, or returning it from a completion handler.

```swift
enum NetworkError: Error {
    case notFound
}

func fetchUser(id: Int) -> Result<String, NetworkError> {
    if id == 1 {
        return .success("Alice")
    } else {
        return .failure(.notFound)
    }
}

let result = fetchUser(id: 2)
switch result {
case .success(let name):
    print("Found: \(name)")
case .failure(let error):
    print("Error: \(error)")
}
// "Error: notFound"
```

`Result` converts to and from `throws` code directly: `Result`'s `get()` method throws its wrapped error (or returns its success value), and `Result(catching:)` builds a `Result` from a throwing closure:

```swift
// throws -> Result
let captured = Result { try validate(username: "ab") }
// captured is .failure(ValidationError.tooShort)

// Result -> throws
func useResult() throws -> String {
    try captured.get()   // throws ValidationError.tooShort if captured is a failure
}
```

`Result` also supports `map`/`flatMap`/`mapError`, mirroring the optional/collection transformation APIs from sections 3–4, for composing operations without unwrapping early.

---

## 9.8 Designing an Error Taxonomy for an App 🔵

As an app grows, a single flat error enum with dozens of unrelated cases becomes unwieldy. A common, more maintainable pattern is **layered error types** — one error enum per subsystem (networking, persistence, validation), often composed together at a higher level:

```swift
enum NetworkError: Error {
    case timeout
    case invalidResponse
}

enum PersistenceError: Error {
    case diskFull
    case corruptData
}

enum AppError: Error {
    case network(NetworkError)
    case persistence(PersistenceError)
    case unknown(underlying: Error)
}

func loadData() throws {
    do {
        // pretend this calls into a networking layer
        throw NetworkError.timeout
    } catch let error as NetworkError {
        throw AppError.network(error)
    }
}
```

This layering keeps each subsystem's errors focused and independently testable, while still letting the top level of the app handle a single, unified `AppError` type in one place — e.g. a single `catch` block at the UI layer that maps every case to a user-facing message, without needing to know about every low-level error type each subsystem might produce.

---

## 9.9 Surfacing Errors in the UI Without Leaking Internals 🔵

A critical, easy-to-miss principle: the *internal* error a function throws (a stack trace, a raw server error string, a SQL error message) is rarely appropriate to show directly to an end user — it can be confusing, unhelpful, or even a security/privacy concern (e.g. leaking internal server details, file paths, or database schema).

```swift
enum AppError: Error {
    case network(NetworkError)
    case persistence(PersistenceError)
    case unknown(underlying: Error)
}

extension AppError {
    var userFacingMessage: String {
        switch self {
        case .network(.timeout):
            return "The connection timed out. Please try again."
        case .network(.invalidResponse):
            return "Something went wrong. Please try again later."
        case .persistence:
            return "We couldn't save your data. Please try again."
        case .unknown:
            return "An unexpected error occurred."
        }
    }
}

func handle(_ error: AppError) {
    // show error.userFacingMessage in the UI
    // log the full, detailed error (including any underlying/associated data) separately, for debugging
    print("User sees: \(error.userFacingMessage)")
    print("Developer logs: \(error)")
}
```

The pattern: maintain a clear separation between the **detailed internal error** (logged for debugging, crash reporting, or analytics — see section 80) and a **curated, safe, user-facing message** derived from it. Never string-interpolate a raw caught `error` directly into UI text without first mapping it through something like `userFacingMessage`.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `Error` protocol | An empty marker protocol; custom errors are almost always enums with associated data |
| `throws`/`throw` | Marks a function that can fail; `throw` raises a specific error value |
| `do`/`catch` | Handles thrown errors with switch-like patterns; a bare `catch` binds the error as `error` |
| `try` / `try?` / `try!` | Propagate normally / convert to optional, discarding the error / force-unwrap and crash on failure |
| `rethrows` | Marks a function that only throws because a passed-in closure might throw |
| Typed throws | `throws(SpecificError)` gives callers a precise, exhaustive error type instead of `any Error` |
| `Result` | A value-based alternative to `throws`; converts via `get()` and `Result(catching:)` |
| Error taxonomy | Layer per-subsystem error enums, composed into one top-level app error type |
| User-facing errors | Never show raw internal errors to users — map to a curated message, log the details separately |

**Next up:** [Section 10 — Memory Management](/articles/memory-management).
