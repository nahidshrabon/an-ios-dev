**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 2.1 `if` / `else if` / `else` 🟢

The basic way to make a decision. Unlike C, the condition needs **no parentheses**. But the **braces are always required**, even for a one-line body. This prevents the classic "dangling `if`" bug.

```swift
let temperature = 15

if temperature > 30 {
    print("Hot")
} else if temperature > 15 {
    print("Mild")
} else {
    print("Cold")
}
```

Since Swift 5.9, `if` can also be an **expression**: it produces a value you can assign directly.

```swift
let description = if temperature > 30 {
    "Hot"
} else if temperature > 15 {
    "Mild"
} else {
    "Cold"
}
```

Rules for this form:

- Every branch must give the **same type**.
- Each branch must be **one expression** (no extra statements).
- An `else` is required, so there is always a value.

The condition must be a real `Bool`. There is no "truthy" number (see 1.5):

```swift
if temperature {   // ❌ error: type 'Int' cannot be used as a boolean; test for '!= 0' instead
}
```

You can check several conditions with commas. All of them must be true:

```swift
let isLoggedIn = true

if isLoggedIn, temperature > 10 {
    print("Show the outdoor offers")   // runs: both conditions are true
}
```

---

## 2.2 `switch` Basics and Exhaustiveness 🟢

A Swift `switch` **must be exhaustive**: it must handle **every possible value**, or have a `default` case. The compiler checks this. It is especially powerful with enums (section 6):

```swift
let httpStatus = 404

switch httpStatus {
case 200:
    print("OK")
case 404:
    print("Not Found")
case 500:
    print("Server Error")
default:
    print("Unknown status")
}
```

Unlike C and Java, Swift cases **don't fall through** to the next case. You don't write `break`, and you can't fall through by accident:

```swift
switch httpStatus {
case 200:
    print("OK")
case 404:
    print("Not Found")
    // implicit break — execution stops here, doesn't fall into 500
case 500:
    print("Server Error")
default:
    break   // "break" as a deliberate no-op case
}
```

If you really want to fall through, say so with the `fallthrough` keyword:

```swift
switch httpStatus {
case 404:
    print("Not Found")
    fallthrough
case 500:
    print("(treating as an error)")
default:
    break
}
// prints "Not Found" and then "(treating as an error)"
```

Several values can share one case:

```swift
switch httpStatus {
case 200, 201, 204:
    print("Success")
case 400, 404, 401:
    print("Client error")
default:
    print("Other")
}
```

Like `if`, `switch` can be an **expression** that returns a value:

```swift
let message = switch httpStatus {
case 200..<300: "Success"
case 400..<500: "Check your request"
case 500..<600: "Server problem, try again"
default:        "Unexpected status"
}
```

With an enum, you don't need `default`, because the compiler knows every case. If you later **add a case**, every `switch` that misses it becomes a compile error. That is a big safety win:

```swift
enum Theme { case light, dark, system }

func label(for theme: Theme) -> String {
    switch theme {
    case .light:  "Light"
    case .dark:   "Dark"
    case .system: "Match device"
    }   // no default needed: all cases are handled
}
```

---

## 2.3 `switch` with Ranges and Tuples 🟢

A case can match a **range** of numbers, with `...` (closed, includes the end) or `..<` (half-open, excludes the end):

```swift
let score = 82

switch score {
case 90...100:
    print("A")
case 80..<90:
    print("B")
case 70..<80:
    print("C")
default:
    print("F")
}
```

A **tuple** lets you match several values at once. `_` is a **wildcard** that means "any value, I don't care":

```swift
let point = (3, 0)

switch point {
case (0, 0):
    print("Origin")
case (_, 0):
    print("On the x-axis")
case (0, _):
    print("On the y-axis")
case (-10...10, -10...10):
    print("Near the origin")
default:
    print("Somewhere else")
}
// prints "On the x-axis"
```

Cases are checked **from top to bottom**, and the **first match wins**. `(3, 0)` also fits `(-10...10, -10...10)`, but `(_, 0)` comes first.

A real use: deciding what a screen shows from two states at once:

```swift
let isLoading = false
let itemCount = 0

switch (isLoading, itemCount) {
case (true, _):
    print("Show a spinner")
case (false, 0):
    print("Show the empty state")
case (false, _):
    print("Show the list")
}
```

---

## 2.4 `switch` with `where` Clauses 🟡

A **`where` clause** adds an extra condition to a case. The case matches only if the **pattern** matches **and** the `where` condition is true:

```swift
let point = (4, 4)

switch point {
case let (x, y) where x == y:
    print("On the diagonal")
case let (x, y) where x == -y:
    print("On the anti-diagonal")
case let (x, y):
    print("Just a point at (\(x), \(y))")
}
// prints "On the diagonal"
```

`where` is often used with **type-casting patterns** (`case let value as Type`) when you switch over `Any` or a protocol:

```swift
let values: [Any] = [1, "two", 3.0, -4]

for value in values {
    switch value {
    case let n as Int where n < 0:
        print("Negative int: \(n)")
    case let n as Int:
        print("Int: \(n)")
    case let s as String:
        print("String: \(s)")
    default:
        print("Something else: \(value)")
    }
}
// Int: 1
// String: two
// Something else: 3.0
// Negative int: -4
```

`case let n as Int where n < 0` needs **both**: the value must be an `Int`, **and** it must be negative.

---

## 2.5 Value Binding in `switch` Cases 🟢

`case let x` **binds** the matched value to a new name, so you can use it inside that case. This is how you get data out of tuples, enum associated values (section 6), and optionals (section 4):

```swift
let coordinate = (x: 5, y: -3)

switch coordinate {
case let (x, y) where x > 0 && y > 0:
    print("Quadrant I: \(x), \(y)")
case let (x, y) where x < 0 && y > 0:
    print("Quadrant II: \(x), \(y)")
case let (x, y) where x < 0 && y < 0:
    print("Quadrant III: \(x), \(y)")
case let (x, y):
    print("Quadrant IV (or on an axis): \(x), \(y)")
}
// prints "Quadrant IV (or on an axis): 5, -3"
```

You can bind **part** of a tuple, and match the rest against fixed values:

```swift
switch coordinate {
case (0, let y):
    print("On y-axis at \(y)")
case (let x, 0):
    print("On x-axis at \(x)")
default:
    print("Elsewhere")
}
```

The most common real use is reading an enum's **associated values**:

```swift
enum LoadState {
    case loading
    case loaded(items: [String])
    case failed(message: String)
}

let state = LoadState.loaded(items: ["Pancakes", "Waffles"])

switch state {
case .loading:
    print("Loading…")
case .loaded(let items):
    print("Got \(items.count) items")
case .failed(let message):
    print("Error: \(message)")
}
// prints "Got 2 items"
```

---

## 2.6 `for-in` Loops over Ranges and Collections 🟢

`for-in` is Swift's main loop. It works with ranges, arrays, dictionaries, sets, and anything that conforms to `Sequence` (section 14).

```swift
for i in 1...5 {
    print(i)   // 1, 2, 3, 4, 5
}

for i in 0..<5 {
    print(i)   // 0, 1, 2, 3, 4 (half-open — 5 excluded)
}

let fruits = ["apple", "banana", "cherry"]
for fruit in fruits {
    print(fruit)
}

let scores = ["Alice": 90, "Bob": 85]
for (name, score) in scores {
    print("\(name): \(score)")
}
```

(A dictionary has **no fixed order**, so the names may print in any order.)

If you don't need the loop variable, use `_`:

```swift
var greeting = "Hi"
for _ in 1...3 {
    greeting += "!"
}
print(greeting)   // "Hi!!!"
```

Need the **position** too? Use `enumerated()`:

```swift
for (index, fruit) in fruits.enumerated() {
    print("\(index + 1). \(fruit)")
}
// 1. apple
// 2. banana
// 3. cherry
```

Filter inside the loop with `where`:

```swift
for number in 1...10 where number % 3 == 0 {
    print(number)   // 3, 6, 9
}
```

Loop over two arrays side by side with `zip`:

```swift
let names = ["Alice", "Bob"]
let ages = [30, 25]
for (name, age) in zip(names, ages) {
    print("\(name) is \(age)")
}
```

`stride` gives a custom step size (more in 2.9):

```swift
for i in stride(from: 0, to: 10, by: 2) {
    print(i)   // 0, 2, 4, 6, 8
}
```

---

## 2.7 `while` and `repeat-while` 🟢

`while` checks its condition **before** each loop. The body can run **zero times**:

```swift
var countdown = 3
while countdown > 0 {
    print(countdown)
    countdown -= 1
}
print("Liftoff!")
```

`repeat-while` (Swift's `do-while`) checks the condition **after** each loop. The body always runs **at least once**:

```swift
var attempts = 0
repeat {
    attempts += 1
    print("Attempt \(attempts)")
} while attempts < 3
```

| Loop | Checks | Runs at least |
|---|---|---|
| `while` | Before each pass | 0 times |
| `repeat-while` | After each pass | 1 time |

Use `repeat-while` when the logic is "**do it, then check if we need to do it again**". A retry loop is a good example:

```swift
var attempt = 0
var succeeded = false

repeat {
    attempt += 1
    succeeded = tryToConnect()   // always try at least once
} while !succeeded && attempt < 3
```

`while let` keeps looping as long as an optional has a value:

```swift
var stack = [1, 2, 3]
while let top = stack.popLast() {
    print(top)   // 3, 2, 1
}
```

---

## 2.8 `break`, `continue`, and Labeled Statements 🟡

- **`break`** leaves the loop (or the `switch`) **right away**.
- **`continue`** skips the rest of **this pass** and goes to the next one.

```swift
for i in 1...10 {
    if i % 2 == 0 { continue }   // skip even numbers
    if i > 7 { break }            // stop entirely once i exceeds 7
    print(i)                     // 1, 3, 5, 7
}
```

In **nested loops**, a plain `break` or `continue` only affects the **innermost** loop. A **label** lets you target an **outer** loop:

```swift
outerLoop: for i in 1...3 {
    for j in 1...3 {
        if j == 2 {
            continue outerLoop   // skip to the next i, abandoning the inner loop
        }
        print("i: \(i), j: \(j)")
    }
}
// i: 1, j: 1
// i: 2, j: 1
// i: 3, j: 1
```

```swift
search: for row in 0..<3 {
    for col in 0..<3 {
        if row == 1 && col == 1 {
            print("Found target at (\(row), \(col))")
            break search   // exits both loops at once
        }
    }
}
```

Labels are also needed when a `switch` is **inside** a loop. A plain `break` inside the `switch` only leaves the `switch`, not the loop:

```swift
let commands = ["move", "jump", "quit", "move"]

gameLoop: for command in commands {
    switch command {
    case "quit":
        break gameLoop          // leaves the for loop, not just the switch
    default:
        print("Doing \(command)")
    }
}
// Doing move
// Doing jump
```

---

## 2.9 `stride(from:to:by:)` for Custom Steps 🟢

A range always steps by 1. **`stride`** lets you choose **any step size**.

```swift
// half-open: excludes the "to" value
for i in stride(from: 0, to: 20, by: 5) {
    print(i)   // 0, 5, 10, 15
}

// closed: includes the "through" value
for i in stride(from: 0, through: 20, by: 5) {
    print(i)   // 0, 5, 10, 15, 20
}

// negative steps work too, counting down
for i in stride(from: 10, through: 0, by: -2) {
    print(i)   // 10, 8, 6, 4, 2, 0
}
```

| Form | Includes the end? |
|---|---|
| `stride(from:to:by:)` | No (like `..<`) |
| `stride(from:through:by:)` | Yes (like `...`) |

`stride` also works with `Double`. This is handy for animation steps or sampling values:

```swift
for value in stride(from: 0.0, through: 1.0, by: 0.25) {
    print(value)   // 0.0, 0.25, 0.5, 0.75, 1.0
}
```

To count down **by 1**, you can also reverse a range:

```swift
for i in (1...3).reversed() {
    print(i)   // 3, 2, 1
}
```

---

## 2.10 The Ternary Operator and When It Hurts Readability 🟢

The **ternary operator** (`condition ? a : b`) is a short `if`/`else` that gives a value:

```swift
let age = 20
let category = age >= 18 ? "Adult" : "Minor"
```

It works well for **small, simple choices**, even inside a bigger expression:

```swift
let count = 3
let label = "\(count) item\(count == 1 ? "" : "s")"   // "3 items"
```

In SwiftUI it is common for small style changes:

```swift
Text("Saved")
    .foregroundStyle(isError ? .red : .green)
```

It gets **hard to read** when nested:

```swift
// Hard to read at a glance — avoid this
let result = a > b ? (a > c ? a : c) : (b > c ? b : c)

// Clearer as a plain if/else or a small function
func max(_ a: Int, _ b: Int, _ c: Int) -> Int {
    if a >= b && a >= c { return a }
    if b >= c { return b }
    return c
}
```

(The standard library already has `max(a, b, c)`. Use it in real code.)

**Rule of thumb:** one ternary, one condition, one line. Anything more complex should be an `if` expression, a `switch`, or a small function.

---

## 2.11 `guard` for Early Exit 🟢

`guard` is the opposite of `if`. It says what **must be true to continue**. Its `else` branch is **required**, and it **must leave** the current scope (`return`, `break`, `continue`, or `throw`):

```swift
func greet(_ name: String?) {
    guard let name = name, !name.isEmpty else {
        print("No name provided")
        return
    }
    print("Hello, \(name)!")
}
```

The big advantage over `if let`: names unwrapped by `guard let` are available for the **rest of the function**, not only inside a nested block. So the function stays **flat** instead of getting deeper with each check:

```swift
func processOrder(id: Int?, quantity: Int?) -> String {
    guard let id = id else { return "Missing order ID" }
    guard let quantity = quantity, quantity > 0 else { return "Invalid quantity" }

    // id and quantity are both unwrapped and usable here, no nesting
    return "Processing order \(id) for \(quantity) items"
}
```

The same logic with nested `if let` works, but the main ("happy path") code is buried deep inside:

```swift
func processOrderNested(id: Int?, quantity: Int?) -> String {
    if let id = id {
        if let quantity = quantity, quantity > 0 {
            return "Processing order \(id) for \(quantity) items"
        } else {
            return "Invalid quantity"
        }
    } else {
        return "Missing order ID"
    }
}
```

`guard` works with plain `Bool` conditions too:

```swift
func withdraw(amount: Double, from balance: Double) -> Double {
    guard amount > 0, amount <= balance else {
        print("Invalid withdrawal")
        return balance
    }
    return balance - amount
}
```

Inside a loop, `guard` with `continue` skips bad items:

```swift
let inputs = ["3", "abc", "7"]
var total = 0

for text in inputs {
    guard let number = Int(text) else { continue }   // skip "abc"
    total += number
}
print(total)   // 10
```

If the `else` branch forgets to leave the scope, the compiler stops you:

```swift
guard let name = name else {
    print("missing")
}   // ❌ error: 'guard' body must not fall through
```

**Key takeaway:** use `guard` to check requirements at the top of a function or loop. The main path stays unindented, and failure cases are impossible to forget.

---

## 2.12 `defer` and Its Execution Order 🟡

`defer` schedules code to run **when the current scope ends**, no matter how it ends: normal finish, early `return`, a thrown error, or `break`. It is Swift's tool for **guaranteed cleanup**, like `finally` in other languages.

```swift
func processFile() {
    print("Opening file")
    defer {
        print("Closing file")   // always runs, no matter how this function exits
    }

    print("Reading data")
    // ... imagine an early return or thrown error could happen here
    print("Done")
}
// Opening file
// Reading data
// Done
// Closing file
```

Several `defer` blocks in the same scope run in **reverse order** (last in, first out), like a stack:

```swift
func demo() {
    defer { print("First deferred") }
    defer { print("Second deferred") }
    defer { print("Third deferred") }
    print("Function body")
}
demo()
// Function body
// Third deferred
// Second deferred
// First deferred
```

The reverse order is useful: cleanup happens in the **opposite order of setup**, which is usually exactly right:

```swift
func criticalSection() {
    lock.acquire()
    defer { lock.release() }        // runs second (LIFO)

    resource.open()
    defer { resource.close() }      // runs first (LIFO), while lock is still held

    // ... work that might throw or return early ...
}
```

A common iOS example: always turn off a loading flag, whether the request works or fails:

```swift
@MainActor
func refresh() async {
    isLoading = true
    defer { isLoading = false }     // runs on success, on error, and on early return

    do {
        items = try await api.fetchItems()
    } catch {
        errorMessage = error.localizedDescription
    }
}
```

One rule to know: a `defer` only runs if the code **reached it**. A `defer` written after an early `return` never runs:

```swift
func example(_ flag: Bool) {
    if flag { return }
    defer { print("cleanup") }   // only registered when flag is false
    print("work")
}
example(true)    // prints nothing
example(false)   // prints "work", then "cleanup"
```

**Key takeaway:** use `defer` for paired setup and cleanup (open/close, lock/unlock, start/stop loading). It runs on **every** exit path, so you can't forget it.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `if`/`else` | No truthy values; braces always required; can be an expression |
| `switch` basics | Must be exhaustive; no fallthrough by default |
| Ranges/tuples in `switch` | `...`/`..<` for ranges; `_` is a wildcard; first match wins |
| `where` clauses | Add an extra condition on top of a pattern |
| Value binding | `case let x` pulls matched values out for the case body |
| `for-in` | One loop for ranges, arrays, dictionaries, sets; `enumerated()` for positions |
| `while`/`repeat-while` | `while` checks first (0+ runs); `repeat-while` checks after (1+ runs) |
| `break`/`continue`/labels | Labels target an outer loop, or a loop around a `switch` |
| `stride` | Any step size, including negative and `Double` steps |
| Ternary operator | Fine for one simple condition; otherwise use `if` or `switch` |
| `guard` | Check requirements early; unwrapped names stay available; code stays flat |
| `defer` | Cleanup on every exit path; several `defer`s run in reverse order |
