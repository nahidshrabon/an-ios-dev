*Estimated read time: ~30 minutes*

This section covers how Swift makes decisions and repeats work: `if`/`switch` branching, every loop form, early-exit tools (`guard`, `break`, `continue`), and `defer` for guaranteed cleanup.

---

## 2.1 `if` / `else if` / `else`

The basic conditional. Unlike C, the condition does **not** need parentheses, but the braces are mandatory even for one-line bodies (no dangling-`if` bugs):

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

`if` is also an **expression** when used with the newer single-expression form (Swift 5.9+), letting you assign its result directly:

```swift
let description = if temperature > 30 {
    "Hot"
} else if temperature > 15 {
    "Mild"
} else {
    "Cold"
}
```

Every branch must produce the same type for this form to compile. Conditions must be `Bool` — there's no implicit truthiness (see 1.5):

```swift
if temperature {   // ❌ error: 'Int' is not 'Bool'
}
```

---

## 2.2 `switch` Basics and Exhaustiveness

`switch` in Swift **must be exhaustive** — every possible value of the type being switched on must be handled, or you need a `default` case. This is enforced at compile time, especially powerful with enums (section 6):

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

Unlike C/Java, Swift cases **do not fall through** by default — no `break` needed, and no accidental fallthrough bugs:

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

If you genuinely want fallthrough, it's an opt-in keyword:

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
```

Multiple values can share one case body:

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

---

## 2.3 `switch` with Ranges and Tuples

Cases can match numeric ranges using `...` (closed) or `..<` (half-open):

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

Tuples let you match on multiple values at once, with `_` as a wildcard for "don't care":

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

---

## 2.4 `switch` with `where` Clauses

`where` adds an extra runtime condition on top of a pattern match — the case only fires if both the pattern *and* the `where` condition are true:

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

`where` is commonly combined with type-checking patterns (`case let value as SomeType where ...`) when switching over a protocol or `Any`:

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
```

---

## 2.5 Value Binding in `switch` Cases

`case let x` (or `case var x`) binds the matched value to a local name for use inside that case's body — this is how you extract data out of tuples, enum associated values (section 6), or optional patterns (section 4):

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

You can bind only part of a tuple and leave the rest as literal matches:

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

---

## 2.6 `for-in` Loops over Ranges and Collections

`for-in` is Swift's universal iteration loop — it works over ranges, arrays, dictionaries, sets, and any type conforming to `Sequence` (section 14).

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

If you don't need the loop variable, use `_`:

```swift
var greeting = "Hi"
for _ in 1...3 {
    greeting += "!"
}
print(greeting)   // "Hi!!!"
```

`stride` gives you custom step sizes without needing a `Range` (more in 2.9):

```swift
for i in stride(from: 0, to: 10, by: 2) {
    print(i)   // 0, 2, 4, 6, 8
}
```

---

## 2.7 `while` and `repeat-while`

`while` checks its condition **before** each iteration — the body might run zero times:

```swift
var countdown = 3
while countdown > 0 {
    print(countdown)
    countdown -= 1
}
print("Liftoff!")
```

`repeat-while` (Swift's version of `do-while`) checks the condition **after** each iteration, guaranteeing the body runs at least once:

```swift
var attempts = 0
repeat {
    attempts += 1
    print("Attempt \(attempts)")
} while attempts < 3
```

Use `while` when the loop might not need to run at all; use `repeat-while` when the logic naturally needs "do the thing, then check if we should do it again" — for example, retry loops or game loops that always render at least one frame.

---

## 2.8 `break`, `continue`, and Labeled Statements

`break` exits a loop (or a `switch` case) immediately. `continue` skips to the next iteration without exiting the loop:

```swift
for i in 1...10 {
    if i % 2 == 0 { continue }   // skip even numbers
    if i > 7 { break }            // stop entirely once i exceeds 7
    print(i)                     // 1, 3, 5, 7
}
```

When loops are nested, a bare `break`/`continue` only affects the *innermost* loop. **Labeled statements** let you target an outer loop directly:

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

Labels also work on `while` and `switch` inside loops, which is the common case for breaking out of a loop from within a nested `switch`.

---

## 2.9 `stride(from:to:by:)` for Custom Steps

`stride` generates a sequence with a custom increment, which ranges alone can't express (ranges only step by 1).

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

`stride` also works with `Double`, useful for animations or sampling a continuous range at fixed intervals:

```swift
for value in stride(from: 0.0, through: 1.0, by: 0.25) {
    print(value)   // 0.0, 0.25, 0.5, 0.75, 1.0
}
```

---

## 2.10 The Ternary Operator and When It Hurts Readability

The ternary conditional (`condition ? a : b`) is a compact single-expression `if`/`else`:

```swift
let age = 20
let category = age >= 18 ? "Adult" : "Minor"
```

It composes well for simple, single-purpose choices, especially inline in a larger expression:

```swift
let count = 3
let label = "\(count) item\(count == 1 ? "" : "s")"   // "3 items"
```

It becomes a readability problem once nested or combined with complex conditions:

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

**Rule of thumb:** one ternary, one condition, one line — anything more nested should become an `if`/`else`, a `switch`, or a small helper function.

---

## 2.11 `guard` for Early Exit

`guard` is the inverse of `if`: it states the condition that **must** be true to continue, and the `else` branch is mandatory and must exit the current scope (`return`, `break`, `continue`, or `throw`).

```swift
func greet(_ name: String?) {
    guard let name = name, !name.isEmpty else {
        print("No name provided")
        return
    }
    print("Hello, \(name)!")
}
```

The key structural benefit over `if let`: any variables bound in a `guard let` are available for the **rest of the enclosing scope**, not just an indented block — this keeps functions flat instead of nesting deeper with every additional check:

```swift
func processOrder(id: Int?, quantity: Int?) -> String {
    guard let id = id else { return "Missing order ID" }
    guard let quantity = quantity, quantity > 0 else { return "Invalid quantity" }

    // id and quantity are both unwrapped and usable here, no nesting
    return "Processing order \(id) for \(quantity) items"
}
```

Compare to the same logic with nested `if let` — functionally equivalent, but the "happy path" logic ends up buried three levels deep:

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

`guard` also works with plain boolean conditions, not just optionals:

```swift
func withdraw(amount: Double, from balance: Double) -> Double {
    guard amount > 0, amount <= balance else {
        print("Invalid withdrawal")
        return balance
    }
    return balance - amount
}
```

**Key takeaway:** use `guard` for precondition checks at the top of a function or loop iteration — it keeps the "happy path" unindented and makes failure cases explicit and impossible to forget.

---

## 2.12 `defer` and Its Execution Order

`defer` schedules a block of code to run when the current scope exits — whether that's normal completion, an early `return`, a thrown error, or a `break`. It's Swift's mechanism for guaranteed cleanup, similar to `finally` in other languages.

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

Multiple `defer` blocks in the same scope run in **reverse order** (last-in-first-out), like a stack:

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

This ordering matters when deferred blocks depend on each other or must undo setup steps in the exact reverse order they were performed — for example, releasing a lock that was acquired after opening a resource:

```swift
func criticalSection() {
    lock.acquire()
    defer { lock.release() }        // runs second (LIFO)

    resource.open()
    defer { resource.close() }      // runs first (LIFO), while lock is still held

    // ... work that might throw or return early ...
}
```

`defer` runs even when an error is thrown, making it the standard pattern for guaranteeing paired setup/teardown (opening/closing files, starting/stopping timers, acquiring/releasing locks) regardless of how many exit points a function has.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `if`/`else` | No implicit truthiness; braces always required; usable as an expression |
| `switch` basics | Must be exhaustive; no fallthrough by default |
| Ranges/tuples in `switch` | `...`/`..<` for ranges, `_` as wildcard in tuple patterns |
| `where` clauses | Add a runtime condition on top of a pattern match |
| Value binding | `case let x` extracts matched values for use in the case body |
| `for-in` | Universal iteration over ranges, arrays, dictionaries, sets |
| `while`/`repeat-while` | `while` checks first (0+ runs); `repeat-while` checks after (1+ runs) |
| `break`/`continue`/labels | Labels target a specific outer loop in nested loops |
| `stride` | Custom step sizes, including negative and floating-point steps |
| Ternary operator | Fine for one simple condition; nest it and reach for `if`/`switch` instead |
| `guard` | States required conditions; keeps the happy path unindented; bindings escape the scope |
| `defer` | Guaranteed cleanup on any exit path; multiple `defer`s run LIFO |

**Next up:** Section 3 — Collections (`Array`, `Dictionary`, `Set`, and the `map`/`filter`/`reduce` family).
