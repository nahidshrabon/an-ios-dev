*Estimated read time: ~30 minutes*

This section covers declaring and calling functions with Swift's label system, the full spectrum of parameter behaviors (default values, variadics, `inout`), and closures — from their long-form syntax down to the shorthand you'll see everywhere in real code, including capture semantics and escaping.

---

## 5.1 Declaring Functions, Parameters, and Return Values

A function is declared with `func`, a name, a parenthesized parameter list, and an optional return type after `->`:

```swift
func greet(name: String) -> String {
    return "Hello, \(name)!"
}

print(greet(name: "Nahidul"))   // "Hello, Nahidul!"
```

A function with no return value can omit `-> Void` entirely (it's implicit), and a single-expression body can omit `return` (implicit return, Swift 5.1+):

```swift
func logMessage(_ message: String) {
    print("[LOG] \(message)")
}

func square(_ n: Int) -> Int {
    n * n   // implicit return — no "return" keyword needed for single-expression bodies
}
```

Functions can have multiple parameters and multiple return values (via a tuple, recalling 1.10):

```swift
func divide(_ dividend: Int, by divisor: Int) -> (quotient: Int, remainder: Int) {
    (dividend / divisor, dividend % divisor)
}

let result = divide(17, by: 5)
print("\(result.quotient) remainder \(result.remainder)")   // "3 remainder 2"
```

---

## 5.2 Argument Labels and External Parameter Names

Swift functions have two names per parameter: an **external label** used at the call site, and an **internal name** used inside the function body. By default, the same word serves both:

```swift
func greet(name: String) { print("Hi \(name)") }
greet(name: "Ada")   // external label "name:" required at the call site
```

Use `_` to suppress the external label entirely, useful when the label would be redundant with the function's own name:

```swift
func square(_ number: Int) -> Int { number * number }
square(5)   // no label needed — "square(number: 5)" would be redundant
```

Or give each side a different word — this is extremely common in Swift's own APIs, producing call sites that read like natural English:

```swift
func move(from start: Int, to end: Int) {
    print("Moving from \(start) to \(end)")
}
move(from: 0, to: 10)   // "from:"/"to:" externally, "start"/"end" internally
```

This dual-naming system is one of Swift's most distinctive design choices — it lets APIs read fluently at the call site while keeping short, clear names inside the implementation.

---

## 5.3 Default Parameter Values

Any parameter can have a default, letting callers omit it entirely:

```swift
func greet(name: String, greeting: String = "Hello") -> String {
    "\(greeting), \(name)!"
}

print(greet(name: "Nahidul"))                    // "Hello, Nahidul!"
print(greet(name: "Nahidul", greeting: "Hey"))    // "Hey, Nahidul!"
```

Parameters with defaults are conventionally placed after required parameters (though Swift doesn't strictly enforce this, it keeps call sites readable). Defaults can reference other parameters or even call functions:

```swift
func createUser(name: String, id: Int = Int.random(in: 1000...9999)) -> String {
    "\(name)#\(id)"
}
```

---

## 5.4 Variadic Parameters

A variadic parameter accepts zero or more values of the same type, written with `...` after the type, and is exposed inside the function as a plain array:

```swift
func sum(_ numbers: Int...) -> Int {
    numbers.reduce(0, +)
}

print(sum(1, 2, 3))         // 6
print(sum())                 // 0 — zero arguments is legal
print(sum(1, 2, 3, 4, 5))    // 15
```

A function can have at most one variadic parameter, and any parameters after it require labels (since there'd otherwise be no way to tell where the variadic list ends):

```swift
func describe(_ items: String..., separator: String = ", ") -> String {
    items.joined(separator: separator)
}

print(describe("apple", "banana", "cherry"))                 // "apple, banana, cherry"
print(describe("apple", "banana", separator: " and "))        // "apple and banana"
```

---

## 5.5 `inout` Parameters

By default, function parameters are constants (copies) — you can't reassign them inside the function, and changes never propagate back to the caller. `inout` changes that: the parameter is passed by reference, and mutations are visible to the caller after the function returns.

```swift
func increment(_ value: inout Int) {
    value += 1
}

var counter = 5
increment(&counter)      // must pass with & to make the by-reference intent explicit
print(counter)           // 6
```

A classic use is swapping two values without a tuple return:

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

`inout` requires the argument to be a mutable variable (`var`), not a literal or `let` constant, and the explicit `&` at the call site is a deliberate design choice — it makes potential mutation visible right where the call happens, unlike languages where reference semantics are invisible at the call site.

```swift
let frozen = 10
increment(&frozen)   // ❌ error: cannot pass immutable value as inout argument
```

---

## 5.6 Returning Tuples and Multiple Values

Already previewed in 5.1 and 1.10 — tuples are the standard way to return more than one related value without defining a dedicated type:

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

Named tuple elements (`min`/`max` above) make the call site self-documenting compared to positional access (`.0`/`.1`), and you can decompose the result directly with pattern matching if you don't need the tuple as a whole:

```swift
func statistics(of numbers: [Double]) -> (average: Double, total: Double) {
    let total = numbers.reduce(0, +)
    return (total / Double(numbers.count), total)
}

let (avg, sum) = statistics(of: [1.0, 2.0, 3.0, 4.0])
print("Average: \(avg), Sum: \(sum)")
```

---

## 5.7 `@discardableResult`

By default, Swift warns you if you ignore a function's non-`Void` return value — a useful nudge, since an unused result is often a bug. `@discardableResult` opts a specific function out of that warning, for cases where the return value is genuinely optional to use.

```swift
func logAndReturn(_ message: String) -> String {
    print(message)
    return message
}

logAndReturn("Hello")   // ⚠️ warning: result of call is unused
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

A very common real-world case: array mutation methods that return the removed element, like `removeLast()` — you usually don't care about the return value, but sometimes you do:

```swift
var stack = [1, 2, 3]
stack.removeLast()                    // fine, no warning — removeLast() is @discardableResult
let popped = stack.removeLast()       // also fine, capturing it when needed
```

---

## 5.8 Nested Functions and Scope

Swift allows functions to be defined *inside* other functions — nested functions are only visible within their enclosing function, which is useful for breaking apart a complex algorithm into named steps without polluting the surrounding namespace.

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

Nested functions capture variables from their enclosing scope automatically, exactly like closures (which they effectively are):

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

---

## 5.9 Closure Syntax from Long Form to Shorthand

A closure is a self-contained block of functionality that can be passed around like a value — functions themselves are just closures with a name. The full syntax mirrors a function's parameter list and return type, wrapped in braces with `in` separating the signature from the body:

```swift
let fullForm: (Int, Int) -> Int = { (a: Int, b: Int) -> Int in
    return a + b
}
print(fullForm(3, 4))   // 7
```

Swift progressively lets you drop redundant parts, since types are usually inferable from context (e.g. the parameter type of `sorted(by:)`):

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

All five produce the identical result; which one reads best depends on how self-explanatory the closure body is on its own.

---

## 5.10 Trailing Closure Syntax and Multiple Trailing Closures

When a closure is a function's last (or only) argument, Swift lets you move it outside the parentheses — the standard, idiomatic way closures appear in real Swift code:

```swift
let numbers = [5, 2, 8, 1]

// closure inside parentheses
let sorted1 = numbers.sorted(by: { $0 < $1 })

// trailing closure syntax — the label is dropped, closure moves outside ()
let sorted2 = numbers.sorted { $0 < $1 }
```

If a closure is the *only* argument, the parentheses can be omitted entirely, as just shown. Since Swift 5.3, functions can accept **multiple** trailing closures, each labeled at the closure boundary:

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

This pattern shows up constantly in SwiftUI (section 23 onward), where views like animations or alerts take several closures — one unlabeled trailing, the rest labeled.

---

## 5.11 Shorthand Argument Names `$0`, `$1`

Already used above — `$0`, `$1`, `$2`, etc. refer to a closure's parameters positionally, letting you skip declaring names entirely for short, obvious closures:

```swift
let numbers = [1, 2, 3, 4, 5]

let doubled = numbers.map { $0 * 2 }                 // $0 is each element
let sums = zip(numbers, [10, 20, 30, 40, 50]).map { $0 + $1 }   // $0, $1 for a two-parameter closure

print(sums)   // [11, 22, 33, 44, 55]
```

Shorthand names are best reserved for closures short enough that the reader can hold the whole body in their head at once — once a closure spans several lines or has non-obvious logic, naming the parameters explicitly (`{ price, quantity in ... }`) makes the code meaningfully easier to read:

```swift
// fine — trivially obvious
let squared = numbers.map { $0 * $0 }

// better with real names — the meaning of $0/$1 isn't obvious at a glance
let discountedTotal = zip(prices, quantities).map { price, quantity in
    price * Double(quantity) * 0.9
}
```

---

## 5.12 Capturing Values in Closures

Closures **capture** variables and constants from their surrounding context, keeping a live reference to them rather than a frozen snapshot — this is what makes the counter example in 5.8 work.

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

Because captures are references, not copies, multiple closures sharing the same captured variable observe each other's mutations:

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

---

## 5.13 Capture Lists and `[weak self]`

By default, a closure captures reference types (like `self` in a class) **strongly** — it keeps the object alive for as long as the closure itself exists. This is frequently the source of retain cycles (fully explored in section 10), especially when a class stores a closure that itself captures that same class via `self`.

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

A **capture list** — square brackets right after the opening `{` — lets you control exactly how each captured value is held. `[weak self]` captures `self` as a weak (optional) reference, breaking the strong reference cycle:

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

Capture lists can also snapshot a value **at closure-creation time** rather than capturing a live reference, using regular `let`/`var` syntax inside the brackets:

```swift
var counter = 0
let snapshot = { [counter] in
    print(counter)   // captures the value of counter *now*, frozen at 0
}
counter = 100
snapshot()   // prints 0, not 100 — because [counter] captured a copy, not a reference
```

This section only introduces the mechanics; the full rationale for `weak` versus `unowned` and the deeper retain-cycle story is covered in section 10 (Memory Management).

---

## 5.14 Escaping vs Non-Escaping Closures

By default, a closure parameter is **non-escaping**: Swift guarantees it will be called (or simply discarded) before the function it was passed to returns. This lets the compiler make optimizations and skip certain reference-counting overhead.

An **escaping** closure is one that might be called *after* the function returns — the classic case being a closure stored for later, such as a network completion handler. These must be marked explicitly with `@escaping`:

```swift
var savedCompletion: (() -> Void)?

func performLater(action: @escaping () -> Void) {
    savedCompletion = action   // storing the closure beyond this function's lifetime
}

func performNow(action: () -> Void) {
    action()   // called immediately, before performNow returns — no @escaping needed
}
```

If you try to store or otherwise let a non-escaping closure outlive the function call, the compiler rejects it:

```swift
func performNow(action: () -> Void) {
    savedCompletion = action   // ❌ error: escaping closure captures non-escaping parameter
}
```

`@escaping` closures capture `self` and other reference types strongly by default, which is exactly why `[weak self]` (5.13) matters most for escaping closures stored as properties or passed to asynchronous APIs like `URLSession` completion handlers.

```swift
class ImageLoader {
    func loadImage(completion: @escaping (String) -> Void) {
        DispatchQueue.global().async {
            // simulate work, then call back later — after loadImage has already returned
            completion("image data")
        }
    }
}
```

---

## 5.15 Autoclosures

`@autoclosure` automatically wraps an *expression* passed as an argument into a closure, without the caller needing to write `{ }` explicitly. It exists to let an argument's evaluation be deferred, while keeping the call site looking like a plain expression.

```swift
func logIfTrue(_ condition: Bool, _ message: @autoclosure () -> String) {
    if condition {
        print(message())
    }
}

logIfTrue(true, "This message was lazily created")   // no {} needed at the call site
```

The standard library's own `??` and `assert` rely on this exact mechanism — the right-hand side of `??` (recall 4.6) is an autoclosure, which is precisely why it's only evaluated when actually needed:

```swift
func expensiveDefault() -> Int {
    print("computing...")
    return 42
}

let value: Int? = 10
let result = value ?? expensiveDefault()   // "computing..." never prints, because value wasn't nil
```

You can see the deferred-evaluation effect directly by writing your own:

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

**Use sparingly** — autoclosures make it non-obvious at the call site that an expression's evaluation is being deferred, which can surprise readers. They're best reserved for small, well-established patterns like lazy defaults or assertion messages, not general-purpose APIs.

---

## 5.16 Functions as First-Class Values

Because closures are values, and named functions are just closures with a name attached, functions themselves can be assigned to constants, passed as arguments, stored in arrays, and returned from other functions — the same "first-class" treatment as an `Int` or `String`.

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

A function's own name, with no call parentheses, refers to the function itself as a value — this is exactly what made `numbers.sorted(by: <)` work back in 5.9, since `<` is itself a function taking two arguments and returning a `Bool`.

```swift
func applyOperation(_ operation: (Int, Int) -> Int, to a: Int, and b: Int) -> Int {
    operation(a, b)
}

print(applyOperation(add, to: 5, and: 3))         // 8
print(applyOperation(multiply, to: 5, and: 3))    // 15
```

---

## 5.17 Higher-Order Functions You Write Yourself

A higher-order function is simply one that takes a function/closure as a parameter, or returns one — you've already been using the standard library's versions all through section 3 (`map`, `filter`, `reduce`). Writing your own follows exactly the same shape.

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

A custom `map`-like function, built from scratch, makes the underlying mechanism explicit:

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

Functions that **return** other functions are equally common — this is how you build configurable behavior, like a family of related validators generated from one general-purpose factory function:

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

(Generics, seen above as `<T, U>`, are covered in full in section 8 — for now, read them simply as "this works for any type.")

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Function basics | `func`, implicit `Void` return, implicit `return` for single-expression bodies |
| Argument labels | External label at call site, internal name inside the body; `_` suppresses the label |
| Default values | Callers can omit parameters that have a default |
| Variadic parameters | `Type...` accepts zero or more values, exposed as an array |
| `inout` | Pass by reference with explicit `&`; requires a mutable `var` argument |
| Tuple returns | Standard way to return multiple named values without a dedicated type |
| `@discardableResult` | Silences the "unused result" warning for functions whose return value is optional to use |
| Nested functions | Scoped to their enclosing function; capture the enclosing scope like closures |
| Closure syntax | Full form down to `$0` shorthand — all equivalent, pick based on clarity |
| Trailing closures | Move a final closure argument outside `()`; multiple trailing closures since Swift 5.3 |
| `$0`, `$1` | Positional shorthand — great for short, obvious closures; name params otherwise |
| Capturing | Closures hold live references to captured variables, not frozen snapshots |
| `[weak self]` | Breaks strong capture of `self`, preventing retain cycles (full story in section 10) |
| Escaping closures | `@escaping` marks closures that may run after the function returns; needed to store them |
| Autoclosures | `@autoclosure` defers an expression's evaluation without `{}` at the call site — use sparingly |
| Functions as values | Named functions are closures with a name — assignable, passable, storable |
| Higher-order functions | Any function taking or returning another function/closure — you can write your own `map` |

**Next up:** Section 6 — Structs, Classes, and Enums.
