**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 9.1 The `Error` Protocol and Custom Error Enums 🟢

In Swift, any type can be an **error** by conforming to the **`Error`** protocol. In practice, errors are almost always **enums**: there is a fixed list of things that can go wrong, and each case can carry extra data (see 6.17):

```swift
enum NetworkError: Error {
    case invalidURL
    case noConnection
    case serverError(statusCode: Int)
    case decodingFailed(underlying: Swift.Error)
}
```

`Error` has **no requirements** at all. Conforming just **marks** the type as something you can `throw`.

**Associated values** carry the details you need to understand the problem, like the `statusCode` above:

```swift
let error = NetworkError.serverError(statusCode: 503)

if case .serverError(let code) = error, code >= 500 {
    print("The server is having trouble (\(code))")
}
```

Structs can be errors too. This is useful when every error needs the same extra details:

```swift
struct APIError: Error {
    let statusCode: Int
    let path: String
}
```

---

## 9.2 `throws` and `throw` 🟢

A function that **can fail** is marked **`throws`**, before the `->`. Inside, **`throw`** raises an error at the point where things go wrong:

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

`throw` **ends the function immediately**, like `return`. Code after it doesn't run.

Every call to a `throws` function **must** be marked with **`try`** (see 9.4). The compiler checks this at every call:

```swift
let name = validate(username: "ab")
// ❌ error: call can throw but is not marked with 'try'
```

**Why this is good:** you can **see** every line that might fail. In some other languages, exceptions can jump out of any line with no visible sign.

Initializers can throw too:

```swift
struct Email {
    let value: String

    init(_ value: String) throws {
        guard value.contains("@") else { throw ValidationError.tooShort }
        self.value = value
    }
}

let email = try Email("alex@example.com")
```

---

## 9.3 `do` / `catch` and Catch Patterns 🟢

**`do`/`catch`** is how you **handle** a thrown error. Put the risky calls (with `try`) in the `do` block. The `catch` blocks handle specific errors, or all of them:

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

When an error is thrown, the rest of the `do` block is **skipped**, and Swift jumps to the **first matching** `catch`.

`catch` patterns work like `switch` patterns (section 2). You can match cases, bind associated values, and add `where`:

```swift
do {
    try fetchProfile()
} catch NetworkError.serverError(let code) where code >= 500 {
    print("Server down (\(code)), retry later")
} catch let error as NetworkError {
    print("Other network problem: \(error)")
} catch {
    print("Some other error: \(error)")
}
```

A plain **`catch { }`** catches **everything**. Inside it, the error is automatically named **`error`**.

You can catch several cases in one clause:

```swift
do {
    try validate(username: input)
} catch ValidationError.tooShort, ValidationError.tooLong {
    print("Please choose a username with 3 to 20 characters")
} catch {
    print(error)
}
```

---

## 9.4 `try`, `try?`, and `try!` 🟢

There are three ways to call a throwing function:

**`try`** is the normal form. If the call throws, the error **moves up** to the caller. So the code must be inside a `do`/`catch`, or inside a function that is itself `throws`:

```swift
func loadUser() throws -> String {
    try validate(username: "ab")   // propagates the error further up if this throws
}
```

**`try?`** turns the result into an **optional**: the value if it worked, **`nil`** if it threw. The **specific error is thrown away**:

```swift
let result = try? validate(username: "ab")
print(result)   // nil — the error is swallowed, only success/failure survives
```

It pairs nicely with `if let`, `guard let`, and `??`:

```swift
let data = (try? Data(contentsOf: cacheURL)) ?? Data()      // empty if the file is missing
guard let user = try? decoder.decode(User.self, from: data) else { return }
```

**`try!`** says: "this **will never** throw." If it does, the app **crashes**, just like force-unwrapping `nil` (4.7):

```swift
let name = try! validate(username: "alice")   // fine here, but crashes if validation ever fails
```

| Form | On success | On error | Use when |
|---|---|---|---|
| `try` | The value | Error goes up / to `catch` | **Default.** You want to handle or pass on the error |
| `try?` | `Optional(value)` | `nil` | You only care **whether** it failed, not **why** |
| `try!` | The value | **Crash** | Failure is truly impossible (e.g. a bundled resource) |

**Be careful with `try?`.** It hides **why** something failed. If users report "it just doesn't work", a silent `try?` is a common cause. When in doubt, use `do`/`catch` and log the error.

---

## 9.5 `rethrows` 🟡

**`rethrows`** marks a function that **doesn't throw by itself**, but calls a **closure parameter** that might. It throws **only if that closure throws**.

This fits higher-order functions, like your own `map` with a transform that may fail:

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

`rethrows` is more precise than `throws`. It tells callers: "**I only throw if your closure throws.**" So with a non-throwing closure, the caller needs **no `try`**. With plain `throws`, every call would need `try`, even `customMap([1, 2, 3]) { $0 * 2 }`.

The standard library's `map`, `filter`, `sorted(by:)`, and `first(where:)` all use `rethrows`. That's why this works:

```swift
let numbers = try ["1", "2"].map { text -> Int in
    guard let n = Int(text) else { throw ValidationError.tooShort }
    return n
}
```

---

## 9.6 Typed Throws: `throws(MyError)` 🔴

Normally, `throws` can throw **any** error (the error type is `any Error`). Since Swift 6, a function can say **exactly which error type** it throws: **`throws(SomeError)`**.

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
    print(value)
} catch {
    // "error" here is statically known to be of type ParsingError, not "any Error"
    switch error {
    case .emptyInput: print("empty!")
    case .invalidFormat: print("bad format!")
    }
}
```

**Benefits:**

- In `catch`, `error` has the **exact type**. The `switch` is **checked for completeness**: add a case to `ParsingError`, and the compiler shows every place to update.
- No boxing into `any Error`, which helps in **performance-sensitive** code and **Embedded Swift**.

**Costs:** the function can **never throw any other error** type without changing its signature. That makes APIs harder to change later.

```swift
func parseAll(_ inputs: [String]) throws(ParsingError) -> [Int] {
    try inputs.map { try parse($0) }    // OK: only ParsingError can come out
}
```

**Rule:** plain `throws` is still the right **default** for most app code. Use typed throws for small, closed modules (like a parser), or where performance really matters.

---

## 9.7 `Result` Type and Converting To/From `throws` 🟡

**`Result<Success, Failure>`** is an enum with two cases, **`.success(value)`** and **`.failure(error)`**. It stores the outcome of an operation as a **value**, instead of using `throw`.

That's useful when you need to **store** an outcome, or **pass** it somewhere, for example to a completion handler:

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

`Result` converts **to and from** throwing code easily:

- **`get()`** returns the value, or **throws** the error.
- **`Result { ... }`** (`Result(catching:)`) runs throwing code and stores the outcome.

```swift
// throws -> Result
let captured = Result { try validate(username: "ab") }
// captured is .failure(ValidationError.tooShort)

// Result -> throws
func useResult() throws -> String {
    try captured.get()   // throws ValidationError.tooShort if captured is a failure
}
```

`Result` also has `map`, `flatMap`, and `mapError` (to change the error type), like optionals and collections (sections 3–4):

```swift
let upper = fetchUser(id: 1).map { $0.uppercased() }   // .success("ALICE")
let missing = fetchUser(id: 2).map { $0.uppercased() } // .failure(.notFound) — map is skipped
```

The classic use is a **completion handler**:

```swift
func loadAvatar(completion: @escaping (Result<Data, NetworkError>) -> Void) {
    // ... later:
    completion(.failure(.notFound))
}

loadAvatar { result in
    switch result {
    case .success(let data): print("Got \(data.count) bytes")
    case .failure(let error): print("Failed: \(error)")
    }
}
```

With `async`/`await` (section 17), you usually just write `async throws` instead. `Result` is still handy for **storing** an outcome, like the last load attempt in a view model.

---

## 9.8 Designing an Error Taxonomy for an App 🟡

As an app grows, **one big error enum** with dozens of unrelated cases gets messy. A cleaner pattern is **layered error types**: one error enum **per part** of the app (networking, storage, validation), combined at the top:

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

```plaintext
              AppError                ← the UI only needs to know this one
          ┌──────┴───────┐
   NetworkError    PersistenceError   ← each layer has its own focused errors
```

**Benefits:**

- Each layer's errors stay **small and focused**, and easy to test.
- The **UI layer** handles **one type**, `AppError`, in one place. It doesn't need to know every low-level error.

A small helper converts any error into an `AppError`:

```swift
extension AppError {
    init(_ error: Error) {
        switch error {
        case let error as AppError:         self = error
        case let error as NetworkError:     self = .network(error)
        case let error as PersistenceError: self = .persistence(error)
        default:                            self = .unknown(underlying: error)
        }
    }
}

// In a view model:
do {
    try await repository.refresh()
} catch {
    self.error = AppError(error)
}
```

---

## 9.9 Surfacing Errors in the UI Without Leaking Internals 🟢

An important rule: the **internal** error (a raw server message, a SQL error, a file path) is usually **not fit for users**. It confuses them, doesn't help them, and can be a **security or privacy risk** (it may reveal server details or your database structure).

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

**The pattern:**

| For | What to use |
|---|---|
| **Users** | A short, friendly, **localized** message, with a next step ("try again") |
| **Developers** | The **full** error, sent to logs or crash reporting (section 80) |

Apple's **`LocalizedError`** protocol is the standard way to attach the user message. Many APIs, like SwiftUI alerts, read its `errorDescription`:

```swift
extension AppError: LocalizedError {
    var errorDescription: String? { userFacingMessage }
}
```

Showing it in SwiftUI:

```swift
struct ProfileView: View {
    @State private var error: AppError?

    var body: some View {
        Button("Save") { save() }
            .alert(isPresented: showingError, error: error) {
                Button("OK") { }
            }
    }

    private var showingError: Binding<Bool> {
        Binding(get: { error != nil }, set: { if !$0 { error = nil } })
    }
}
```

**Never** put a raw caught `error` straight into UI text, like `Text("\(error)")`. Always map it to a safe message first.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `Error` protocol | An empty marker; custom errors are usually enums with associated data |
| `throws`/`throw` | Mark a function that can fail; `throw` stops it with an error |
| `do`/`catch` | Handle errors with switch-like patterns; a plain `catch` names it `error` |
| `try` / `try?` / `try!` | Pass it on / turn it into `nil` / crash on failure |
| `rethrows` | Throws only if the passed-in closure throws |
| Typed throws | `throws(SpecificError)`: an exact error type; use for small, closed modules |
| `Result` | An outcome as a value; convert with `get()` and `Result { }` |
| Error taxonomy | One error enum per layer, wrapped in one app-level error |
| User-facing errors | Show a friendly message; log the full details separately |
