**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 5.1 Declaring Functions, Parameters, and Return Values 🟢

Declare a **function** with `func`, a name, the **parameters** in parentheses, and the **return type** after `->`:

```swift
func greet(name: String) -> String {
    return "Hello, \(name)!"
}

print(greet(name: "Alex"))   // "Hello, Alex!"
```

Two shortcuts:

- A function that returns nothing can leave out `-> Void`.
- A body with **one expression** can leave out `return` (implicit return).

```swift
func logMessage(_ message: String) {
    print("[LOG] \(message)")
}

func square(_ n: Int) -> Int {
    n * n   // implicit return — no "return" keyword needed for single-expression bodies
}
```

A function can take several parameters, and return several values with a **tuple** (see 1.10):

```swift
func divide(_ dividend: Int, by divisor: Int) -> (quotient: Int, remainder: Int) {
    (dividend / divisor, dividend % divisor)
}

let result = divide(17, by: 5)
print("\(result.quotient) remainder \(result.remainder)")   // "3 remainder 2"
```

A function that can fail can **throw** an error (section 9) or return an optional:

```swift
func parseAge(_ text: String) -> Int? {
    guard let age = Int(text), (0...150).contains(age) else { return nil }
    return age
}

parseAge("42")    // Optional(42)
parseAge("-5")    // nil
```

---

## 5.2 Argument Labels and External Parameter Names 🟢

Each parameter has **two names**:

- an **argument label**, used by the **caller**
- a **parameter name**, used **inside** the function

By default, one word is used for both:

```swift
func greet(name: String) { print("Hi \(name)") }
greet(name: "Ada")   // external label "name:" required at the call site
```

Write `_` to **remove the label**, when it would only repeat the function name:

```swift
func square(_ number: Int) -> Int { number * number }
square(5)   // no label needed — "square(number: 5)" would be redundant
```

Or use **two different words**. Apple's own APIs do this all the time, so calls read like English:

```swift
func move(from start: Int, to end: Int) {
    print("Moving from \(start) to \(end)")
}
move(from: 0, to: 10)   // "from:"/"to:" externally, "start"/"end" internally
```

```plaintext
func move(from start: Int, to end: Int)
          ────  ─────
          label  name used inside the body
```

You know this style from UIKit and Foundation:

```swift
view.addSubview(label)
array.insert(5, at: 0)
string.replacingOccurrences(of: "a", with: "b")
```

**Why it matters:** the caller sees **clear, readable calls**, and the code inside keeps **short, clear names**.

---

## 5.3 Default Parameter Values 🟢

A parameter can have a **default value**. Then the caller can leave it out:

```swift
func greet(name: String, greeting: String = "Hello") -> String {
    "\(greeting), \(name)!"
}

print(greet(name: "Alex"))                    // "Hello, Alex!"
print(greet(name: "Alex", greeting: "Hey"))    // "Hey, Alex!"
```

Put parameters **with** defaults **after** the required ones. Swift doesn't force this, but calls read better.

A default can be any expression, even a function call. It runs **each time** the default is used:

```swift
func createUser(name: String, id: Int = Int.random(in: 1000...9999)) -> String {
    "\(name)#\(id)"
}

createUser(name: "Sam")   // e.g. "Sam#4821" — a new random id each call
```

(A default **can't** use another parameter, like `end: Int = start + 1`. Use an optional and compute it inside instead.)

Defaults are great for **configuration** with sensible values:

```swift
func fetchRecipes(page: Int = 1, pageSize: Int = 20, includeDrafts: Bool = false) { /* ... */ }

fetchRecipes()                       // all defaults
fetchRecipes(page: 3)                // only change what you need
fetchRecipes(includeDrafts: true)    // skip the middle ones
```

---

## 5.4 Variadic Parameters 🟢

A **variadic parameter** accepts **zero or more** values of one type. Write `...` after the type. Inside the function, it is a normal **array**:

```swift
func sum(_ numbers: Int...) -> Int {
    numbers.reduce(0, +)
}

print(sum(1, 2, 3))         // 6
print(sum())                 // 0 — zero arguments is legal
print(sum(1, 2, 3, 4, 5))    // 15
```

The parameter **after** a variadic one needs a **label**, so Swift knows where the list ends:

```swift
func describe(_ items: String..., separator: String = ", ") -> String {
    items.joined(separator: separator)
}

print(describe("apple", "banana", "cherry"))                 // "apple, banana, cherry"
print(describe("apple", "banana", separator: " and "))        // "apple and banana"
```

`print` itself is variadic. That's why it takes any number of values:

```swift
print("a", "b", "c", separator: "-")   // "a-b-c"
```

Note: you **can't** pass an existing array to a variadic parameter. If you already have an array, write the function to take `[Int]` instead.

---

## 5.5 `inout` Parameters 🟡

Normally, parameters are **constants** (copies). You can't change them inside the function, and the caller's value never changes.

**`inout`** changes this. The function can **change the caller's variable**:

```swift
func increment(_ value: inout Int) {
    value += 1
}

var counter = 5
increment(&counter)      // must pass with & to make the by-reference intent explicit
print(counter)           // 6
```

A classic example: swapping two values:

```swift
func swapValues(_ a: inout Int, _ b: inout Int) {
    let temp = a
    a = b
    b = temp
}

var x = 1
var y = 2
swapValues(&x, &y)
print(x, y)   // 2 1
```

(The standard library already has `swap(&x, &y)`.)

Rules:

- The argument must be a **`var`**. Not a `let`, and not a literal.
- You must write **`&`** at the call. This is on purpose: anyone reading the call **sees** that the value may change.

```swift
let frozen = 10
increment(&frozen)   // ❌ error: cannot pass immutable value as inout argument: 'frozen' is a 'let' constant
```

How it works: Swift **copies the value in**, the function changes the copy, and Swift **copies it back out** when the function returns ("copy-in, copy-out").

`inout` is useful for helpers that update a struct:

```swift
struct Player { var health = 100 }

func applyDamage(_ amount: Int, to player: inout Player) {
    player.health = max(0, player.health - amount)
}

var hero = Player()
applyDamage(30, to: &hero)
print(hero.health)   // 70
```

---

## 5.6 Returning Tuples and Multiple Values 🟢

You saw this in 5.1 and 1.10. A **tuple** is the normal way to return a few related values without making a new type:

```swift
func minMax(of array: [Int]) -> (min: Int, max: Int)? {
    guard let first = array.first else { return nil }
    var currentMin = first
    var currentMax = first
    for value in array {
        currentMin = min(currentMin, value)
        currentMax = max(currentMax, value)
    }
    return (currentMin, currentMax)
}

if let bounds = minMax(of: [8, 3, 12, 1, 9]) {
    print("min: \(bounds.min), max: \(bounds.max)")   // "min: 1, max: 9"
}
```

**Name the elements** (`min`, `max`). `bounds.min` explains itself; `bounds.0` doesn't.

You can also **decompose** the result straight into constants:

```swift
func statistics(of numbers: [Double]) -> (average: Double, total: Double) {
    let total = numbers.reduce(0, +)
    return (total / Double(numbers.count), total)
}

let (avg, sum) = statistics(of: [1.0, 2.0, 3.0, 4.0])
print("Average: \(avg), Sum: \(sum)")
```

If the result is used in many places, or grows past 2–3 values, use a **struct** instead:

```swift
struct OrderSummary {
    let itemCount: Int
    let subtotal: Double
    let tax: Double
    var total: Double { subtotal + tax }
}
```

---

## 5.7 `@discardableResult` 🟢

If you **ignore** a function's return value, Swift **warns** you. This is helpful, because an unused result is often a bug. **`@discardableResult`** turns off that warning for one function, when using the result is truly optional:

```swift
func logAndReturn(_ message: String) -> String {
    print(message)
    return message
}

logAndReturn("Hello")   // ⚠️ warning: result of call to 'logAndReturn' is unused
```

```swift
@discardableResult
func logAndReturn(_ message: String) -> String {
    print(message)
    return message
}

logAndReturn("Hello")            // no warning now
let saved = logAndReturn("Hi")   // still perfectly fine to capture the result when you want it
```

A familiar example: `removeLast()` returns the removed element. Usually you don't need it, sometimes you do:

```swift
var stack = [1, 2, 3]
stack.removeLast()                    // fine, no warning — removeLast() is @discardableResult
let popped = stack.removeLast()       // also fine, capturing it when needed
```

If you want to ignore a result **without** this attribute, assign it to `_`:

```swift
_ = someFunctionThatReturnsAValue()
```

---

## 5.8 Nested Functions and Scope 🟢

You can write a function **inside** another function. A **nested function** is only visible inside its outer function. It's a good way to split a complex task into **named steps** without adding more names to the rest of your code.

```swift
func processOrder(items: [Double], taxRate: Double) -> Double {
    func subtotal() -> Double {
        items.reduce(0, +)
    }

    func applyTax(to amount: Double) -> Double {
        amount * (1 + taxRate)
    }

    return applyTax(to: subtotal())
}

print(processOrder(items: [10.0, 20.0], taxRate: 0.08))   // 32.4
```

Nested functions can use the outer function's variables (here `items` and `taxRate`) without passing them in. They **capture** them, just like closures. In fact, they are closures with a name:

```swift
func makeCounter() -> () -> Int {
    var count = 0
    func increment() -> Int {
        count += 1
        return count
    }
    return increment
}

let counter = makeCounter()
print(counter())   // 1
print(counter())   // 2
print(counter())   // 3 — count persists across calls, captured by the returned function
```

`count` lives on after `makeCounter` returns, because the returned function **keeps it alive**.

---

## 5.9 Closure Syntax from Long Form to Shorthand 🟢

A **closure** is a block of code you can **pass around like a value**. A named function is just a closure with a name.

The full form looks like a function without a name. `in` separates the signature from the body:

```swift
let fullForm: (Int, Int) -> Int = { (a: Int, b: Int) -> Int in
    return a + b
}
print(fullForm(3, 4))   // 7
```

Swift lets you **drop the parts it can infer** from the context. Here, `sorted(by:)` already says the closure takes two `Int`s and returns a `Bool`:

```swift
let numbers = [5, 2, 8, 1]

// full form
let sorted1 = numbers.sorted(by: { (a: Int, b: Int) -> Bool in return a < b })

// types inferred from context — drop them
let sorted2 = numbers.sorted(by: { a, b in return a < b })

// single-expression body — drop "return"
let sorted3 = numbers.sorted(by: { a, b in a < b })

// shorthand argument names — drop the parameter list and "in" entirely
let sorted4 = numbers.sorted(by: { $0 < $1 })

// operators are functions too — the most compact form
let sorted5 = numbers.sorted(by: <)
```

All five give the **same result**: `[1, 2, 5, 8]`. Pick the one that is **clearest** for that code.

A **closure type** is written `(Input) -> Output`. A `typealias` makes long ones easier to read:

```swift
typealias CompletionHandler = (Result<Data, Error>) -> Void

func download(from url: URL, completion: @escaping CompletionHandler) { /* ... */ }
```

---

## 5.10 Trailing Closure Syntax and Multiple Trailing Closures 🟢

When a closure is the **last** argument, you can write it **after the parentheses**. This is the normal way closures appear in Swift code:

```swift
let numbers = [5, 2, 8, 1]

// closure inside parentheses
let sorted1 = numbers.sorted(by: { $0 < $1 })

// trailing closure syntax — the label is dropped, closure moves outside ()
let sorted2 = numbers.sorted { $0 < $1 }
```

If the closure is the **only** argument, you can drop the `()` too, as above.

Since Swift 5.3, a call can have **several trailing closures**. The first has no label; the others keep their labels:

```swift
func fetchData(
    onSuccess: (String) -> Void,
    onFailure: (Error) -> Void
) {
    // pretend this succeeds
    onSuccess("Loaded data")
}

fetchData { data in
    print("Success: \(data)")
} onFailure: { error in
    print("Failure: \(error)")
}
```

You'll see this a lot in SwiftUI (section 23 on). A `Button` takes an action closure and a label closure:

```swift
Button {
    save()
} label: {
    Label("Save", systemImage: "square.and.arrow.down")
}
```

---

## 5.11 Shorthand Argument Names `$0`, `$1` 🟢

`$0`, `$1`, `$2`... are **automatic names** for a closure's parameters, by position. You don't need to declare names at all:

```swift
let numbers = [1, 2, 3, 4, 5]

let doubled = numbers.map { $0 * 2 }                 // $0 is each element
let sums = zip(numbers, [10, 20, 30, 40, 50]).map { $0 + $1 }   // $0, $1 for a two-parameter closure

print(sums)   // [11, 22, 33, 44, 55]
```

Use them for **short, obvious** closures. When a closure is longer, or the meaning isn't clear, **name the parameters**:

```swift
// fine — trivially obvious
let squared = numbers.map { $0 * $0 }

// better with real names — the meaning of $0/$1 isn't obvious at a glance
let discountedTotal = zip(prices, quantities).map { price, quantity in
    price * Double(quantity) * 0.9
}
```

For reading one property, a **key path** is often even clearer than `$0`:

```swift
let names = users.map(\.name)          // same as users.map { $0.name }
let active = users.filter(\.isActive)  // same as users.filter { $0.isActive }
```

---

## 5.12 Capturing Values in Closures 🟡

A closure **captures** the variables it uses from around it. It keeps a **live reference** to them, not a frozen copy. That's why the counter in 5.8 works.

```swift
func makeMultiplier(factor: Int) -> (Int) -> Int {
    return { value in
        value * factor   // "factor" is captured from the enclosing function's scope
    }
}

let triple = makeMultiplier(factor: 3)
print(triple(5))   // 15
print(triple(10))  // 30
```

Because it's a reference, closures that capture the **same variable** see each other's changes:

```swift
func makeIncrementers() -> (increment: () -> Void, current: () -> Int) {
    var total = 0
    let increment = { total += 1 }
    let current = { total }
    return (increment, current)
}

let counters = makeIncrementers()
counters.increment()
counters.increment()
print(counters.current())   // 2 — both closures share the same captured "total"
```

The "live" capture can surprise you. The closure reads the variable **when it runs**, not when it was created:

```swift
var message = "Hello"
let printMessage = { print(message) }
message = "Goodbye"
printMessage()   // "Goodbye" — not "Hello"
```

To capture the value **as it is now**, use a capture list (5.13).

---

## 5.13 Capture Lists and `[weak self]` 🟡

By default, a closure captures objects (class instances, like `self`) **strongly**. It keeps the object **alive** as long as the closure exists.

This easily creates a **retain cycle** (section 10): the object stores the closure, and the closure holds the object. Neither is ever freed.

```swift
class DataLoader {
    var onComplete: (() -> Void)?

    func load() {
        onComplete = {
            print("Loaded, self: \(self)")   // strongly captures self — potential retain cycle
        }
    }
}
```

```plaintext
DataLoader ──strong──► onComplete closure
     ▲                       │
     └────────strong─────────┘     ← a cycle: neither is ever freed
```

A **capture list** (square brackets right after `{`) controls **how** each value is captured. `[weak self]` captures `self` **weakly**, as an optional, and breaks the cycle:

```swift
class DataLoader {
    var onComplete: (() -> Void)?

    func load() {
        onComplete = { [weak self] in
            guard let self else { return }   // safely unwrap the now-optional self
            print("Loaded, self: \(self)")
        }
    }
}
```

A capture list can also take a **snapshot** of a value **when the closure is created**:

```swift
var counter = 0
let snapshot = { [counter] in
    print(counter)   // captures the value of counter *now*, frozen at 0
}
counter = 100
snapshot()   // prints 0, not 100 — because [counter] captured a copy, not a reference
```

| Capture | What the closure holds |
|---|---|
| (default) | A live reference; objects are kept alive |
| `[weak self]` | An optional, weak reference; doesn't keep `self` alive |
| `[unowned self]` | A non-optional reference that crashes if `self` is gone (section 10) |
| `[x]` | A copy of `x`'s value at creation time |

This lesson covers only the mechanics. Section 10 (Memory Management) explains `weak` vs `unowned` and retain cycles in depth.

---

## 5.14 Escaping vs Non-Escaping Closures 🟡

By default, a closure parameter is **non-escaping**: Swift knows it will be used (or dropped) **before the function returns**. This lets the compiler optimize, and you don't need `self.` inside it.

An **escaping** closure may run **after** the function returns. The classic case is a closure you **store** for later, like a network completion handler. It must be marked **`@escaping`**:

```swift
var savedCompletion: (() -> Void)?

func performLater(action: @escaping () -> Void) {
    savedCompletion = action   // storing the closure beyond this function's lifetime
}

func performNow(action: () -> Void) {
    action()   // called immediately, before performNow returns — no @escaping needed
}
```

If you try to store a non-escaping closure, the compiler stops you:

```swift
func performNow(action: () -> Void) {
    savedCompletion = action   // ❌ error: assigning non-escaping parameter 'action' to an @escaping closure
}
```

Escaping closures are where retain cycles happen, so this is where `[weak self]` (5.13) matters most:

```swift
class ImageLoader {
    var image: String?

    func loadImage(completion: @escaping (String) -> Void) {
        DispatchQueue.global().async {
            // simulate work, then call back later — after loadImage has already returned
            completion("image data")
        }
    }

    func start() {
        loadImage { [weak self] data in
            self?.image = data      // doesn't keep the loader alive just for this callback
        }
    }
}
```

| | Non-escaping (default) | `@escaping` |
|---|---|---|
| Runs | Before the function returns | Possibly later |
| Can be stored | No | Yes |
| Typical use | `map`, `filter`, `sorted(by:)` | Completion handlers, stored callbacks |

(With `async`/`await` (section 17), you need far fewer escaping completion handlers.)

---

## 5.15 Autoclosures 🔴

**`@autoclosure`** automatically **wraps an expression** in a closure. The caller writes a normal expression (no `{ }`), but it is **not evaluated right away**. It runs only if and when the function calls it.

```swift
func logIfTrue(_ condition: Bool, _ message: @autoclosure () -> String) {
    if condition {
        print(message())
    }
}

logIfTrue(true, "This message was lazily created")   // no {} needed at the call site
```

The standard library uses this for `??` and `assert`. The right side of `??` (4.6) is an autoclosure. That's why it only runs when needed:

```swift
func expensiveDefault() -> Int {
    print("computing...")
    return 42
}

let value: Int? = 10
let result = value ?? expensiveDefault()   // "computing..." never prints, because value wasn't nil
```

You can see the delayed evaluation yourself:

```swift
func evaluate(_ expression: @autoclosure () -> Int) -> Int {
    print("about to evaluate")
    let result = expression()
    print("evaluated")
    return result
}

_ = evaluate(5 + 5)
// "about to evaluate" prints first, then the addition happens, then "evaluated"
```

A practical example: a debug log that doesn't build its message in release builds:

```swift
func debugLog(_ message: @autoclosure () -> String) {
    #if DEBUG
    print(message())
    #endif
}

debugLog("Loaded \(items.count) items: \(items)")   // string never built in Release
```

**Use it rarely.** At the call site, nothing shows that the expression is delayed, which can surprise readers. Keep it for small, well-known patterns like defaults, assertions, and logging.

---

## 5.16 Functions as First-Class Values 🟢

Functions are **values**, like an `Int` or a `String`. You can store them in constants, pass them as arguments, put them in arrays, and return them from other functions. This is what "**first-class**" means.

```swift
func add(_ a: Int, _ b: Int) -> Int { a + b }
func multiply(_ a: Int, _ b: Int) -> Int { a * b }

let operation: (Int, Int) -> Int = add
print(operation(3, 4))   // 7

let operations: [(Int, Int) -> Int] = [add, multiply]
for op in operations {
    print(op(2, 5))   // 7, then 10
}
```

A function's name **without `()`** is the function itself, as a value. That's why `numbers.sorted(by: <)` works in 5.9: `<` is a function that takes two values and returns a `Bool`.

```swift
func applyOperation(_ operation: (Int, Int) -> Int, to a: Int, and b: Int) -> Int {
    operation(a, b)
}

print(applyOperation(add, to: 5, and: 3))         // 8
print(applyOperation(multiply, to: 5, and: 3))    // 15
```

You can pass a named function wherever a closure is expected:

```swift
func isEven(_ n: Int) -> Bool { n % 2 == 0 }

let evens = [1, 2, 3, 4].filter(isEven)   // [2, 4]
```

A dictionary of functions works like a simple lookup table:

```swift
let calculator: [String: (Int, Int) -> Int] = ["+": add, "*": multiply]
calculator["*"]?(6, 7)   // Optional(42)
```

---

## 5.17 Higher-Order Functions You Write Yourself 🟡

A **higher-order function** is a function that **takes** a function as a parameter, or **returns** one. You've used the standard ones in section 3 (`map`, `filter`, `reduce`). Writing your own looks the same.

```swift
func repeatAction(times: Int, action: () -> Void) {
    for _ in 0..<times {
        action()
    }
}

repeatAction(times: 3) {
    print("Hello!")
}
// Hello!
// Hello!
// Hello!
```

Your own `map`, built from scratch, shows how it works inside:

```swift
func transform<T, U>(_ array: [T], using transformer: (T) -> U) -> [U] {
    var result: [U] = []
    for element in array {
        result.append(transformer(element))
    }
    return result
}

let numbers = [1, 2, 3]
let strings = transform(numbers) { "Value: \($0)" }
print(strings)   // ["Value: 1", "Value: 2", "Value: 3"]
```

Functions that **return** functions are useful to build **configurable behavior**. One factory makes many related validators:

```swift
func makeValidator(minimumLength: Int) -> (String) -> Bool {
    return { input in input.count >= minimumLength }
}

let isValidPassword = makeValidator(minimumLength: 8)
let isValidUsername = makeValidator(minimumLength: 3)

print(isValidPassword("short"))       // false
print(isValidUsername("ab"))          // false
print(isValidUsername("abc"))         // true
```

A real helper: measure how long any piece of work takes:

```swift
func measure<T>(_ label: String, _ work: () -> T) -> T {
    let start = Date()
    let result = work()
    print("\(label) took \(Date().timeIntervalSince(start))s")
    return result
}

let sorted = measure("Sorting") { (1...100_000).shuffled().sorted() }
```

(The `<T, U>` and `<T>` are **generics**, covered in section 8. For now, read them as "works with any type".)

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Function basics | `func`, no `-> Void` needed, implicit `return` for one expression |
| Argument labels | A label for the caller, a name inside; `_` removes the label |
| Default values | Callers can leave out parameters that have defaults |
| Variadic parameters | `Type...` takes zero or more values, as an array |
| `inout` | The function changes the caller's `var`; call with `&` |
| Tuple returns | Return a few named values; use a struct when it grows |
| `@discardableResult` | Turns off the "unused result" warning |
| Nested functions | Visible only inside the outer function; capture its variables |
| Closure syntax | From the full form to `$0` and `<`; pick the clearest |
| Trailing closures | Move the last closure outside `()`; several are allowed since Swift 5.3 |
| `$0`, `$1` | For short, obvious closures; name parameters otherwise |
| Capturing | Closures hold live references to captured variables |
| `[weak self]` | Avoids a strong capture of `self` and retain cycles (section 10) |
| Escaping closures | `@escaping` for closures that run later or are stored |
| Autoclosures | Delays an expression without `{}`; use rarely |
| Functions as values | Store, pass, and return functions like any value |
| Higher-order functions | Functions that take or return functions; you can write your own |
