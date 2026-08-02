*Estimated read time: ~30 minutes*

This section covers the twelve foundational topics every Swift developer needs before touching control flow or collections: declaring values, Swift's type system, the core scalar types (`Int`, `Double`, `Bool`), strings and their quirks, tuples, type conversion, and documentation conventions.

---

## 1.1 Variables and Constants: `var` vs `let`

Swift has exactly two ways to bind a name to a value: `var` for something that can change, `let` for something that can't.

```swift
var score = 0
score = 10        // fine — score is mutable
score += 5        // fine

let maxAttempts = 3
maxAttempts = 4   // ❌ compile error: cannot assign to value: 'maxAttempts' is a 'let' constant
```

**Default to `let`.** The Swift compiler will warn you if you declare something with `var` but never mutate it:

```swift
var name = "Nahidul"   // ⚠️ warning: variable 'name' was never mutated; consider changing to 'let'
```

This isn't stylistic pickiness — it's a correctness signal. A `let` constant tells the next reader (often future-you) that this value is fixed for its entire lifetime, which eliminates a whole category of bugs where something changes unexpectedly deep in a function.

Constants must be assigned exactly once, but that assignment doesn't have to happen at the declaration site:

```swift
let temperature: Double
if isCelsius {
    temperature = 22.0
} else {
    temperature = 71.6
}
// temperature is now set, and can never change again
```

This is called **deferred initialization** — the compiler tracks every branch to guarantee `temperature` is set before first use, on every code path.

A subtlety with `var` and value types (structs, enums, tuples — covered in section 6): mutability is a property of the *binding*, not just the value. A `let` struct is fully frozen, including its properties:

```swift
struct Point { var x: Int; var y: Int }

let p = Point(x: 0, y: 0)
p.x = 5   // ❌ error: cannot assign to property: 'p' is a 'let' constant
```

**Key takeaway:** reach for `let` first; only switch to `var` when the compiler (or your logic) proves you need mutation.

---

## 1.2 Type Inference vs Explicit Type Annotation

Swift is statically typed — every value has a fixed type known at compile time — but you rarely have to write the type out. The compiler infers it from the literal or expression on the right-hand side.

```swift
let age = 30            // inferred as Int
let price = 19.99       // inferred as Double
let name = "Swift"      // inferred as String
let isReady = true      // inferred as Bool
```

You add an explicit **type annotation** with a colon when you want a different type than the inferred default, or when there's no initial value to infer from:

```swift
let temperature: Float = 98.6     // without annotation this would be Double
let discount: Double = 10         // without annotation this integer literal would be Int
var buffer: [UInt8]               // no initial value — annotation is required
```

Type inference also flows through function return types and generic parameters:

```swift
func square(_ n: Int) -> Int { n * n }
let result = square(4)   // result inferred as Int
```

Inference is a compile-time-only feature — it costs nothing at runtime, and the type is fully locked in once inferred. This is different from dynamically typed languages: `let age = 30` can never later hold a `String`.

```swift
var age = 30
age = "thirty"   // ❌ error: cannot assign value of type 'String' to type 'Int'
```

**When to annotate explicitly even though inference would work:** public API signatures (for clarity to callers), numeric types where the default (`Int`/`Double`) isn't what you want, and empty collection literals (`let names: [String] = []`).

---

## 1.3 Integers: `Int`, Overflow, and Integer Division

Swift's default integer type is `Int`, which is 64-bit on all modern Apple platforms (its size matches the platform's native word size). There are also fixed-width variants — `Int8`, `Int16`, `Int32`, `Int64` — and unsigned counterparts prefixed `U`: `UInt8`, `UInt16`, `UInt32`, `UInt64`.

```swift
let a: Int = 42
let b: Int8 = 127        // max value for Int8
let c: UInt8 = 255       // max value for UInt8

Int.max      // 9223372036854775807
Int.min      // -9223372036854775808
UInt8.max    // 255
```

Unlike C, Swift integers **trap on overflow** by default rather than silently wrapping — a deliberate safety decision:

```swift
let max = UInt8.max        // 255
let boom = max + 1         // 💥 runtime crash: "Arithmetic overflow"
```

If you genuinely want wraparound behavior, use the overflow-reporting or wrapping operators:

```swift
let wrapped = max &+ 1          // 0 — wraps around using &+
let (sum, overflowed) = max.addingReportingOverflow(1)
// sum == 0, overflowed == true
```

Integer division truncates toward zero — there's no automatic promotion to floating point:

```swift
let result = 7 / 2          // 3, not 3.5
let negative = -7 / 2       // -3, truncates toward zero (not -4)
let remainder = 7 % 2       // 1
```

To get a fractional result you must convert to a floating-point type first:

```swift
let precise = Double(7) / Double(2)   // 3.5
```

Dividing by zero also has different behavior depending on type: integer division by zero traps immediately, while floating-point division by zero produces `inf` or `nan` (see 1.4).

```swift
let crash = 7 / 0            // 💥 runtime crash
let notCrash = 7.0 / 0.0     // inf — no crash
```

**Key takeaway:** `Int` overflow and division-by-zero are runtime traps, not silent bugs — Swift wants you to catch them in testing, not production.

---

## 1.4 Floating Point: `Double` vs `Float` and Precision Traps

Swift has two standard floating-point types: `Double` (64-bit, ~15-17 significant decimal digits) and `Float` (32-bit, ~6-9 significant decimal digits). **`Double` is the default** for any floating-point literal unless you annotate otherwise.

```swift
let pi = 3.14159265358979    // Double
let piFloat: Float = 3.14159265358979   // Float — will lose precision
```

Both types follow the IEEE 754 standard, which means they cannot represent most decimal fractions exactly in binary — the classic gotcha:

```swift
let x = 0.1 + 0.2
print(x)              // 0.30000000000000004
print(x == 0.3)        // false!
```

This isn't a Swift bug; it's fundamental to binary floating-point representation. **Never compare floating-point values with `==`** — compare within a tolerance instead:

```swift
func isApproximatelyEqual(_ a: Double, _ b: Double, tolerance: Double = 1e-9) -> Bool {
    abs(a - b) < tolerance
}

isApproximatelyEqual(0.1 + 0.2, 0.3)   // true
```

For money or anything requiring exact decimal arithmetic, don't use `Double`/`Float` at all — use integer cents, or `Decimal`:

```swift
let price = Decimal(string: "19.99")!
let tax = Decimal(string: "1.62")!
let total = price + tax   // exact decimal arithmetic, no binary rounding error
```

Special floating-point values worth knowing:

```swift
let infinity = Double.infinity
let notANumber = Double.nan

print(1.0 / 0.0)          // inf
print(notANumber == notANumber)   // false — NaN is never equal to itself
print(notANumber.isNaN)           // true — the correct way to check
```

**Key takeaway:** use `Double` unless you have a specific reason for `Float` (e.g. interop with a 32-bit API), never `==` compare floats, and reach for `Decimal` when exactness matters.

---

## 1.5 Booleans and Logical Operators

`Bool` has exactly two values, `true` and `false` — and unlike C, no other type implicitly converts to it.

```swift
let isLoggedIn = true
let hasPermission = false

if 1 {   // ❌ error: type 'Int' cannot be used as a boolean
    // ...
}
```

The standard logical operators are `&&` (and), `||` (or), and `!` (not):

```swift
let canEdit = isLoggedIn && hasPermission
let canView = isLoggedIn || hasPermission
let isLoggedOut = !isLoggedIn
```

`&&` and `||` are **short-circuiting**: the right-hand side isn't evaluated if the left side already determines the result. This matters when the right side has side effects or could crash:

```swift
func expensiveCheck() -> Bool {
    print("expensiveCheck ran")
    return true
}

if false && expensiveCheck() {
    // expensiveCheck() never runs — && short-circuits on the first false
}

var array: [Int] = []
if !array.isEmpty && array[0] == 5 {
    // safe: array[0] is only evaluated if array.isEmpty is false
}
```

Comparison operators (`==`, `!=`, `<`, `>`, `<=`, `>=`) all produce `Bool`:

```swift
let a = 5
let b = 10
let comparison = a < b        // true
let notEqual = a != b         // true
```

You can combine comparisons and logic freely, and use parentheses for clarity even when not strictly required:

```swift
let age = 25
let hasLicense = true
let canDrive = (age >= 18) && hasLicense
```

**Key takeaway:** Swift's `Bool` is strict — no truthy/falsy coercion from other types — which removes an entire class of "if (x)" bugs common in C-family languages.

---

## 1.6 Strings: Creation and Interpolation

`String` in Swift is a first-class, Unicode-correct value type (not a pointer to characters, unlike Objective-C's `NSString` or C's `char*`).

```swift
let greeting = "Hello, world!"
let empty = ""
let empty2 = String()   // equivalent to ""
```

Concatenation works with `+` or `+=`:

```swift
let first = "Swift"
let second = "Basics"
let combined = first + " " + second   // "Swift Basics"

var message = "Hello"
message += ", " + "world"
```

**String interpolation** is the idiomatic way to build strings from mixed content, using `\(...)`:

```swift
let name = "Nahidul"
let age = 28
let bio = "\(name) is \(age) years old."
// "Nahidul is 28 years old."
```

Interpolation accepts any expression, not just simple variables:

```swift
let a = 4
let b = 7
print("Sum: \(a + b), product: \(a * b)")   // "Sum: 11, product: 28"

let items = ["apple", "banana"]
print("You have \(items.count) items")       // "You have 2 items"
```

You can interpolate custom types too, as long as they conform to `CustomStringConvertible` (covered in section 7) — otherwise Swift falls back to a default, often unhelpful, description.

Useful string properties and methods:

```swift
let s = "Swift Basics"
s.count                 // 12 — number of Characters (not bytes! see 1.9)
s.isEmpty                // false
s.uppercased()            // "SWIFT BASICS"
s.lowercased()            // "swift basics"
s.hasPrefix("Swift")      // true
s.hasSuffix("Basics")     // true
s.contains("Bas")         // true
s.replacingOccurrences(of: "Basics", with: "Rocks")  // "Swift Rocks"
s.split(separator: " ")   // ["Swift", "Basics"]
s.trimmingCharacters(in: .whitespacesAndNewlines)
```

**Key takeaway:** always prefer interpolation (`\(...)`) over manual concatenation — it's more readable and works with any expression.

---

## 1.7 String Indices and Why You Can't Use `Int` Subscripts

Here's the thing that trips up almost every developer coming from another language: you cannot index into a Swift `String` with an integer.

```swift
let word = "Hello"
let letter = word[0]   // ❌ error: 'subscript(_:)' is unavailable
```

Why? Swift strings are collections of `Character` values representing **extended grapheme clusters** — user-perceived characters, which can be composed of multiple Unicode scalars (see 1.9). Because characters can have variable byte-width, there's no way to jump to "the 5th character" in constant time the way you can with a fixed-width array. Allowing `Int` subscripting would silently create an O(n) operation disguised as an O(1) one — Swift's design philosophy refuses to hide that cost.

Instead, `String` uses `String.Index`, which you navigate relative to the string itself:

```swift
let word = "Hello"

let firstIndex = word.startIndex
let firstLetter = word[firstIndex]              // "H"

let secondIndex = word.index(after: firstIndex)
let secondLetter = word[secondIndex]             // "e"

let lastIndex = word.index(before: word.endIndex)
let lastLetter = word[lastIndex]                 // "o"

// jump multiple positions
let thirdIndex = word.index(word.startIndex, offsetBy: 2)
word[thirdIndex]   // "l"
```

Note `word.endIndex` is a "one past the end" sentinel — like C++ iterators — and subscripting it directly crashes:

```swift
word[word.endIndex]   // 💥 crash: String index is out of bounds
```

Ranges of indices give you substrings, which are of type `Substring` (a lightweight view sharing storage with the original string):

```swift
let range = word.startIndex..<word.index(word.startIndex, offsetBy: 3)
let sub = word[range]           // "Hel" — this is a Substring, not a String
let asString = String(sub)      // convert back to String for long-term storage
```

For simple "does this exist" checks, you usually don't need indices at all — use higher-level APIs:

```swift
word.first                     // Optional("H")
word.last                      // Optional("o")
word.dropFirst()                // "ello"
word.dropLast(2)                // "Hel"
Array(word)[2]                  // "l" — convert to [Character] if you truly need random access
```

**Key takeaway:** reach for `String.Index` methods or convert to `[Character]` — never expect `string[i]` with an `Int` to compile.

---

## 1.8 Multiline Strings and Raw Strings

For strings spanning multiple lines, use triple double-quotes. The opening and closing `"""` must each be on their own line, and the *indentation of the closing `"""`* determines how much leading whitespace is stripped from every line:

```swift
let poem = """
    Roses are red,
    Violets are blue,
    Swift is elegant,
    And so are you.
    """
print(poem)
// Roses are red,
// Violets are blue,
// Swift is elegant,
// And so are you.
```

Multiline strings preserve internal formatting and let you embed quotes without escaping:

```swift
let dialogue = """
She said, "Swift makes strings easy."
No backslashes needed here.
"""
```

If you need a literal line break inside the source that shouldn't appear in the output, end the line with a backslash:

```swift
let longLine = """
    This is one continuous line \
    even though it's written across two.
    """
// "This is one continuous line even though it's written across two."
```

**Raw strings** (prefixed with `#"..."#`) turn off escape sequence processing and interpolation, which is invaluable for regular expressions, file paths, or any text full of backslashes and quotes:

```swift
let regularString = "Line 1\nLine 2"       // \n is a real newline
let rawString = #"Line 1\nLine 2"#          // \n stays literal text: "Line 1\nLine 2"

let path = #"C:\Users\Nahidul\Documents"#   // no need to escape every backslash

let pattern = #"\d{3}-\d{4}"#               // a regex pattern, backslashes untouched
```

To interpolate inside a raw string, add matching `#` characters around the parentheses:

```swift
let value = 42
let raw = #"The value is \#(value), not \(value)"#
// "The value is 42, not \(value)"
```

You can stack multiple `#` (`##"..."##`) if your raw content itself contains a `"#` sequence.

**Key takeaway:** use `"""` for readable multi-line text, and `#"..."#` any time backslashes or quotes would otherwise force awkward escaping.

---

## 1.9 Character, Unicode, and Grapheme Clusters

A Swift `Character` represents a single **extended grapheme cluster** — what a human reads as "one character" on screen, regardless of how many underlying Unicode scalars it takes to encode it.

```swift
let simple: Character = "A"
let emoji: Character = "🇧🇩"       // a flag — actually two Unicode scalars combined
let accented: Character = "é"      // could be 1 scalar (precomposed) or 2 (e + combining accent)
```

This composed view is why `"Café".count` gives the intuitive answer regardless of how the accented character was encoded:

```swift
let cafe1 = "Café"                       // é as a single precomposed scalar
let cafe2 = "Cafe\u{0301}"               // e + combining acute accent (U+0301)

print(cafe1.count)   // 4
print(cafe2.count)   // 4 — same visual result, same Character count
print(cafe1 == cafe2) // true — Swift compares grapheme clusters, not raw bytes
```

Family emoji are a dramatic example — a single `Character` built from many scalars joined with zero-width joiners:

```swift
let family: Character = "👨‍👩‍👧‍👦"
print(family)          // renders as one emoji
// under the hood: man + ZWJ + woman + ZWJ + girl + ZWJ + boy — 4 people, 1 Character
```

Because of this, `String.count` is **not** the same as byte length or UTF-16 length — an important distinction when interfacing with C or Objective-C APIs that count UTF-16 code units:

```swift
let s = "👨‍👩‍👧‍👦"
s.count                       // 1 (Character count — grapheme clusters)
s.unicodeScalars.count         // 7 (Unicode scalar count)
s.utf16.count                  // 11 (UTF-16 code units — what NSString.length would report)
s.utf8.count                   // 25 (UTF-8 bytes)
```

You can inspect a string at each of these levels directly:

```swift
for scalar in "café".unicodeScalars {
    print(scalar, scalar.value)
}
// c 99
// a 97
// f 102
// é 233   (if precomposed)
```

**Key takeaway:** `Character` and `.count` operate at the human-perceived level, which is almost always what you want for display logic — but be aware other views (`.utf8`, `.utf16`, `.unicodeScalars`) exist and report different lengths, which matters when talking to non-Swift APIs.

---

## 1.10 Tuples: Grouping Values Without a Type

A tuple bundles multiple values into a single compound value without needing to declare a named type. It's the lightest-weight way to return or pass around a handful of related values.

```swift
let coordinate = (2, 3)                       // type: (Int, Int)
let httpResponse = (200, "OK")                 // type: (Int, String)
```

You can access elements positionally:

```swift
print(coordinate.0)     // 2
print(coordinate.1)     // 3
```

Or, more readably, give the elements names:

```swift
let person = (name: "Nahidul", age: 28)
print(person.name)      // "Nahidul"
print(person.age)       // 28
```

Tuples shine for **decomposition** via pattern matching:

```swift
let (x, y) = coordinate
print(x, y)              // 2 3

// ignore parts you don't need with _
let (_, statusMessage) = httpResponse
print(statusMessage)      // "OK"
```

The most common real-world use is returning multiple values from a function without defining a dedicated struct:

```swift
func minMax(of numbers: [Int]) -> (min: Int, max: Int)? {
    guard let first = numbers.first else { return nil }
    var currentMin = first
    var currentMax = first
    for n in numbers.dropFirst() {
        if n < currentMin { currentMin = n }
        if n > currentMax { currentMax = n }
    }
    return (currentMin, currentMax)
}

if let bounds = minMax(of: [4, 9, 1, 7, 3]) {
    print("min: \(bounds.min), max: \(bounds.max)")   // "min: 1, max: 9"
}
```

Tuples also work directly in `switch` statements, which is heavily used in later sections:

```swift
let point = (0, 0)
switch point {
case (0, 0):
    print("At the origin")
case (_, 0):
    print("On the x-axis")
case (0, _):
    print("On the y-axis")
default:
    print("Somewhere else")
}
```

**Limitation to remember:** tuples are meant for small, temporary groupings. If a tuple grows past two or three elements, or you find yourself passing it between many functions, that's a signal to define a proper `struct` instead — tuples have no methods, no computed properties, and no `Codable` conformance out of the box.

**Key takeaway:** use tuples for quick, local grouping (especially multiple return values); graduate to a `struct` once the grouping becomes a real "thing" in your domain.

---

## 1.11 Type Conversion and Initializer Syntax

Swift never converts types implicitly — every conversion is explicit, done through an initializer call that looks like a function call.

```swift
let intValue = 42
let doubleValue = Double(intValue)     // 42.0 — explicit widening
let stringValue = String(intValue)     // "42"

let piString = "3.14"
let piDouble = Double(piString)        // Optional(3.14) — this can fail!
```

Notice that converting *from* a `String` returns an **optional** (`Double?`, `Int?`, etc.), because the string might not represent a valid number:

```swift
let valid = Int("42")          // Optional(42)
let invalid = Int("abc")       // nil
let overflow = Int8("999")     // nil — 999 doesn't fit in Int8

if let number = Int("42") {
    print(number * 2)          // 84
}
```

Converting between numeric types can lose information, so Swift makes you opt in explicitly rather than silently truncating:

```swift
let large: Int = 1000
let small = Int8(large)     // 💥 crash: 1000 doesn't fit in Int8's range (-128...127)

// safer: use the failable initializer
let safeSmall = Int8(exactly: large)   // nil, no crash
```

Going from floating-point to integer truncates the fractional part (it does not round):

```swift
let pi = 3.99
let truncated = Int(pi)     // 3, not 4

let rounded = Int(pi.rounded())   // 4 — round explicitly first if that's what you want
```

Custom types get the same call-like initializer syntax by defining an `init`:

```swift
struct Temperature {
    let celsius: Double

    init(fahrenheit: Double) {
        self.celsius = (fahrenheit - 32) / 1.8
    }
}

let boiling = Temperature(fahrenheit: 212)
print(boiling.celsius)   // 100.0
```

This uniform syntax — `TypeName(...)` — is one of Swift's consistency wins: built-in conversions (`Double(someInt)`) and user-defined initializers look and behave the same way.

**Key takeaway:** every type conversion in Swift is explicit and spelled as an initializer call; conversions that can fail return an optional (or crash if you use a non-failable initializer with out-of-range input) — check with `if let` rather than assuming success.

---

## 1.12 Comments, Documentation Comments, and `// MARK:`

Regular comments use `//` for a single line or `/* ... */` for a block (which, unlike C, can be nested in Swift):

```swift
// This is a single-line comment

/*
 This is a block comment.
 /* Nested block comments work fine in Swift. */
 */
```

**Documentation comments** use `///` (triple slash) or `/** ... */`, and Xcode renders them as rich Quick Help when you option-click a symbol or hover over it in an autocomplete list:

```swift
/// Calculates the area of a rectangle.
/// - Parameters:
///   - width: The rectangle's width, in points.
///   - height: The rectangle's height, in points.
/// - Returns: The area, in square points.
func area(width: Double, height: Double) -> Double {
    width * height
}
```

Common documentation fields include `- Parameters:`, `- Returns:`, `- Throws:`, and you can embed code samples with triple backticks:

```swift
/// Doubles the given value.
///
/// ```
/// double(21) // 42
/// ```
///
/// - Parameter value: The number to double.
/// - Returns: `value` multiplied by two.
func double(_ value: Int) -> Int {
    value * 2
}
```

`// MARK:` comments don't affect compilation at all — they're a signal to Xcode's jump bar (the dropdown at the top of the editor) to organize your file into navigable sections:

```swift
// MARK: - Properties

var username: String = ""
var isActive = false

// MARK: - Lifecycle

func viewDidLoad() {
    // ...
}

// MARK: - Actions

@objc func buttonTapped() {
    // ...
}
```

The leading `-` after `MARK:` adds a visual divider line in the jump bar; without it, you get a plain section label. Two close cousins:

```swift
// TODO: Replace this with a real network call
// FIXME: This crashes when the array is empty
```

Xcode surfaces `TODO:` and `FIXME:` comments in the jump bar too, with distinct icons, making them useful as lightweight, in-code task tracking that never needs an external tool.

**Key takeaway:** use `///` for anything another developer (or Quick Help) needs to understand *what* a symbol does and *how* to call it; use `// MARK:` purely for navigation within a file — both cost nothing at runtime.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `var` vs `let` | Default to `let`; only use `var` when mutation is proven necessary |
| Type inference | The compiler infers types from literals; annotate when you need a non-default type |
| Integers | `Int` is 64-bit and traps on overflow; division truncates, doesn't promote to floating point |
| Floating point | `Double` is the default; never compare with `==`; use `Decimal` for money |
| Booleans | No truthy/falsy coercion; `&&`/`\|\|` short-circuit |
| Strings | Prefer interpolation `\(...)` over concatenation |
| String indices | No `Int` subscripting — use `String.Index` or convert to `[Character]` |
| Multiline/raw strings | `"""..."""` for readable multi-line text; `#"..."#` to disable escaping |
| Character/Unicode | `Character` = grapheme cluster; `.count` differs from `.utf8.count`/`.utf16.count` |
| Tuples | Lightweight grouping for local use and multiple return values; graduate to `struct` when it grows |
| Type conversion | Always explicit, always initializer syntax; string-to-number conversions are optional |
| Comments | `///` for documentation Xcode renders; `// MARK:` for jump-bar navigation only |

**Next up:** [Section 2 — Control Flow](/articles/control-flow) (`if`, `switch`, loops, `guard`, `defer`).
