**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 1.1 Variables and Constants: `var` vs `let` 🟢

Swift has two ways to give a name to a value:

- **`var`**: a **variable**. The value can change.
- **`let`**: a **constant**. The value is set once and never changes.

```swift
var score = 0
score = 10        // fine — score is mutable
score += 5        // fine

let maxAttempts = 3
maxAttempts = 4   // ❌ compile error: cannot assign to value: 'maxAttempts' is a 'let' constant
```

**Use `let` by default.** If you write `var` but never change the value, the compiler warns you:

```swift
var name = "Alex"   // ⚠️ warning: variable 'name' was never mutated; consider changing to 'let'
```

This is not just style. A `let` tells the next reader: **this value never changes**. That removes a whole group of bugs where a value changes somewhere you did not expect.

A constant must get a value **exactly once**, but not always on the same line. The compiler checks **every branch**:

```swift
let temperature: Double
if isCelsius {
    temperature = 22.0
} else {
    temperature = 71.6
}
// temperature is now set, and can never change again
```

This is called **deferred initialization** (setting the value later). If one branch forgets to set it, the code does not compile:

```swift
let label: String
if isAdmin {
    label = "Admin"
}
print(label)   // ❌ error: constant 'label' used before being initialized
```

With **structs** (value types, section 6), `let` freezes the **whole value**, including its properties:

```swift
struct Point { var x: Int; var y: Int }

let p = Point(x: 0, y: 0)
p.x = 5   // ❌ error: cannot assign to property: 'p' is a 'let' constant

var q = Point(x: 0, y: 0)
q.x = 5   // ✅ fine: q is a var
```

**Key takeaway:** start with `let`. Change to `var` only when you really need to change the value.

---

## 1.2 Type Inference vs Explicit Type Annotation 🟢

Swift is **statically typed**: every value has a fixed type, known when the code compiles. But you rarely write the type yourself. The compiler **infers** (works out) the type from the value on the right side:

```swift
let age = 30            // inferred as Int
let price = 19.99       // inferred as Double
let name = "Swift"      // inferred as String
let isReady = true      // inferred as Bool
```

Write a **type annotation** (`: Type`) when you want a different type than the default, or when there is no starting value:

```swift
let temperature: Float = 98.6     // without annotation this would be Double
let discount: Double = 10         // without annotation this integer literal would be Int
var buffer: [UInt8]               // no initial value — annotation is required
```

Inference also works through function results:

```swift
func square(_ n: Int) -> Int { n * n }
let result = square(4)   // result inferred as Int
```

Inference happens **only at compile time**. It costs nothing when the app runs, and the type **never changes** later. This is different from languages like JavaScript or Python:

```swift
var age = 30
age = "thirty"   // ❌ error: cannot assign value of type 'String' to type 'Int'
```

Want to see what type the compiler picked? **Option-click** the name in Xcode, or print it:

```swift
let ratio = 3 / 4.0
print(type(of: ratio))   // Double
```

**When to write the type even though inference works:**

| Situation | Example |
|---|---|
| Public API, so callers see it clearly | `public var timeout: TimeInterval` |
| You need a non-default number type | `let opacity: CGFloat = 0.5` |
| An empty collection | `var names: [String] = []` |

---

## 1.3 Integers: `Int`, Overflow, and Integer Division 🟢

`Int` is Swift's default whole-number type. On all modern Apple devices it is **64-bit**. There are also fixed sizes, and **unsigned** versions (no negative numbers) that start with `U`:

| Signed | Unsigned | Range example |
|---|---|---|
| `Int8` | `UInt8` | `Int8`: −128 to 127, `UInt8`: 0 to 255 |
| `Int16` | `UInt16` | |
| `Int32` | `UInt32` | |
| `Int64` / `Int` | `UInt64` / `UInt` | `Int`: about ±9.2 quintillion |

```swift
let a: Int = 42
let b: Int8 = 127        // max value for Int8
let c: UInt8 = 255       // max value for UInt8

Int.max      // 9223372036854775807
Int.min      // -9223372036854775808
UInt8.max    // 255
```

Use underscores to make big numbers easier to read. They are ignored by the compiler:

```swift
let population = 8_100_000_000
let timeoutNanoseconds = 1_500_000_000
```

**Swift does not silently wrap on overflow** like C does. If a result does not fit, the app **stops with a crash** (a **trap**). This is a safety feature:

```swift
func nextLevel(_ level: UInt8) -> UInt8 {
    level + 1
}

nextLevel(254)   // 255
nextLevel(255)   // 💥 runtime crash: "Arithmetic overflow"
```

(If both values are constants, the compiler is even faster: it reports the overflow as a **compile error**.)

If you really **want** wrap-around, use the `&` operators, or ask for a report:

```swift
let max = UInt8.max                        // 255
let wrapped = max &+ 1                     // 0 — wraps around using &+
let (sum, overflowed) = max.addingReportingOverflow(1)
// sum == 0, overflowed == true
```

**Integer division drops the fraction** (it truncates toward zero). It never gives a decimal result by itself:

```swift
let result = 7 / 2          // 3, not 3.5
let negative = -7 / 2       // -3, truncates toward zero (not -4)
let remainder = 7 % 2       // 1
```

For a fractional result, convert to a floating-point type **first**:

```swift
let precise = Double(7) / Double(2)   // 3.5
```

Dividing by zero behaves differently for integers and floating point:

```swift
func average(total: Int, count: Int) -> Int {
    total / count
}
average(total: 7, count: 0)   // 💥 runtime crash: division by zero

let notCrash = 7.0 / 0.0      // inf — no crash (see 1.4)
```

**Key takeaway:** integer overflow and division by zero **crash**. They are not silent bugs. Swift wants you to find them while testing, not in production.

---

## 1.4 Floating Point: `Double` vs `Float` and Precision Traps 🟢

Swift has two common types for numbers with a fraction:

| Type | Size | Precision | Default? |
|---|---|---|---|
| `Double` | 64-bit | about 15–17 digits | **Yes** |
| `Float` | 32-bit | about 6–9 digits | No |

```swift
let pi = 3.14159265358979    // Double
let piFloat: Float = 3.14159265358979   // Float — will lose precision
```

Both store numbers **in binary** (the IEEE 754 standard). Most decimal fractions, like `0.1`, **cannot be stored exactly** in binary. This gives the classic surprise:

```swift
let x = 0.1 + 0.2
print(x)              // 0.30000000000000004
print(x == 0.3)        // false!
```

This is not a Swift bug. Every language with binary floating point does this. So **never compare floating-point values with `==`**. Compare with a small **tolerance** instead:

```swift
func isApproximatelyEqual(_ a: Double, _ b: Double, tolerance: Double = 1e-9) -> Bool {
    abs(a - b) < tolerance
}

isApproximatelyEqual(0.1 + 0.2, 0.3)   // true
```

**For money, don't use `Double` or `Float`.** Use whole **cents** as an `Int`, or use `Decimal`, which works in base 10:

```swift
let price = Decimal(string: "19.99")!
let tax = Decimal(string: "1.62")!
let total = price + tax   // exact decimal arithmetic, no binary rounding error

// Or keep cents as an Int:
let priceInCents = 1999
let taxInCents = 162
let totalInCents = priceInCents + taxInCents   // 2161 → show as "$21.61"
```

Special values you should know:

```swift
let infinity = Double.infinity
let notANumber = Double.nan

print(1.0 / 0.0)          // inf
print(notANumber == notANumber)   // false — NaN is never equal to itself
print(notANumber.isNaN)           // true — the correct way to check
```

Rounding is explicit, and you choose the rule:

```swift
let value = 2.5
value.rounded()                     // 3.0 (halves go away from zero)
value.rounded(.down)                // 2.0
value.rounded(.toNearestOrEven)     // 2.0 ("banker's rounding")
```

**Key takeaway:** use `Double` unless an API needs `Float`. Never use `==` on floating point. Use `Decimal` (or integer cents) when the value must be exact.

---

## 1.5 Booleans and Logical Operators 🟢

`Bool` has only two values: `true` and `false`. Unlike C, **no other type turns into a `Bool` by itself**. There is no "truthy" `1` or "falsy" `0`:

```swift
let isLoggedIn = true
let hasPermission = false

if 1 {   // ❌ error: type 'Int' cannot be used as a boolean
    // ...
}

let count = 3
if count != 0 { /* ✅ say exactly what you mean */ }
```

The logical operators are `&&` (and), `||` (or), and `!` (not):

```swift
let canEdit = isLoggedIn && hasPermission
let canView = isLoggedIn || hasPermission
let isLoggedOut = !isLoggedIn
```

`&&` and `||` **short-circuit**: if the left side already decides the answer, the right side **does not run**. This matters when the right side is slow or could crash:

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

The order matters. Swap the two checks, and the code crashes on an empty array:

```swift
if array[0] == 5 && !array.isEmpty { }   // 💥 crash: index out of range
```

Comparison operators (`==`, `!=`, `<`, `>`, `<=`, `>=`) all return a `Bool`:

```swift
let a = 5
let b = 10
let comparison = a < b        // true
let notEqual = a != b         // true
```

Use parentheses when they make the logic clearer, even if they are not required:

```swift
let age = 25
let hasLicense = true
let canDrive = (age >= 18) && hasLicense
```

`Bool` also has a handy `toggle()` method:

```swift
var isMuted = false
isMuted.toggle()   // true
```

**Key takeaway:** Swift's `Bool` is strict. No hidden conversions means no `if (x)` surprises from C-style languages.

---

## 1.6 Strings: Creation and Interpolation 🟢

`String` is a **value type** that handles **Unicode correctly**. It is not a pointer to bytes like C's `char*`.

```swift
let greeting = "Hello, world!"
let empty = ""
let empty2 = String()   // equivalent to ""
```

Join strings with `+` or `+=`:

```swift
let first = "Swift"
let second = "Basics"
let combined = first + " " + second   // "Swift Basics"

var message = "Hello"
message += ", " + "world"
```

**String interpolation** is the usual way to build a string from values. Put the value inside `\(...)`:

```swift
let name = "Alex"
let age = 28
let bio = "\(name) is \(age) years old."
// "Alex is 28 years old."
```

Any expression works inside `\(...)`, not only variable names:

```swift
let a = 4
let b = 7
print("Sum: \(a + b), product: \(a * b)")   // "Sum: 11, product: 28"

let items = ["apple", "banana"]
print("You have \(items.count) items")       // "You have 2 items"
```

Format numbers right inside the interpolation:

```swift
let total = 21.6149
print("Total: \(total.formatted(.number.precision(.fractionLength(2))))")
// "Total: 21.61"
```

Your own types can control how they print by adopting `CustomStringConvertible` (section 7):

```swift
struct User: CustomStringConvertible {
    let name: String
    var description: String { "User(\(name))" }
}

print("Signed in: \(User(name: "Alex"))")   // "Signed in: User(Alex)"
```

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

**Key takeaway:** use interpolation (`\(...)`) instead of joining many pieces with `+`. It is easier to read and works with any expression.

---

## 1.7 String Indices and Why You Can't Use `Int` Subscripts 🟡

This surprises almost everyone who comes from another language: **you can't get a character with an integer index**.

```swift
let word = "Hello"
let letter = word[0]   // ❌ error: 'subscript(_:)' is unavailable
```

**Why?** A Swift `Character` is what a person sees as **one character** (1.9). Some characters take 1 byte, some take many. So Swift can't jump straight to "the 5th character". It has to **walk from the start**, which is slow (O(n)). An `Int` subscript would **hide that cost** and look fast (O(1)). Swift refuses to hide it.

Instead, `String` uses its own index type, **`String.Index`**. You move it relative to the string:

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

`endIndex` is **one past the last character**. Using it directly crashes:

```swift
word[word.endIndex]   // 💥 crash: String index is out of bounds
```

A range of indices gives you a **`Substring`**. It is a light **view** that shares memory with the original string:

```swift
let range = word.startIndex..<word.index(word.startIndex, offsetBy: 3)
let sub = word[range]           // "Hel" — this is a Substring, not a String
let asString = String(sub)      // convert back to String for long-term storage
```

**Why convert to `String`?** A `Substring` keeps the **whole original string** in memory. Keep it only for short work, then convert.

Most of the time you don't need indices at all. Higher-level APIs are simpler:

```swift
word.first                     // Optional("H")
word.last                      // Optional("o")
word.dropFirst()                // "ello"
word.dropLast(2)                // "Hel"
word.prefix(3)                  // "Hel"
word.suffix(2)                  // "lo"
Array(word)[2]                  // "l" — convert to [Character] if you truly need random access
```

Find a position, then use it:

```swift
let email = "alex@example.com"
if let at = email.firstIndex(of: "@") {
    let user = email[..<at]                          // "alex"
    let domain = email[email.index(after: at)...]    // "example.com"
}
```

**Key takeaway:** use `String.Index` methods, or helpers like `prefix` and `firstIndex(of:)`. `string[i]` with an `Int` never compiles.

---

## 1.8 Multiline Strings and Raw Strings 🟢

For text over several lines, use **three double quotes** (`"""`). The opening and closing `"""` each go on their **own line**. The **indentation of the closing `"""`** decides how much leading space is removed from every line:

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

Indent a line **more** than the closing `"""`, and the extra space stays:

```swift
let list = """
    Groceries:
      - milk
      - eggs
    """
// "Groceries:\n  - milk\n  - eggs"
```

Inside a multiline string, quotes need **no escaping**:

```swift
let dialogue = """
She said, "Swift makes strings easy."
No backslashes needed here.
"""
```

To split one long line in the **source** without a line break in the **output**, end the line with a backslash:

```swift
let longLine = """
    This is one continuous line \
    even though it's written across two.
    """
// "This is one continuous line even though it's written across two."
```

**Raw strings** (`#"..."#`) turn off escape sequences like `\n`. This is very useful for regular expressions, file paths, and JSON:

```swift
let regularString = "Line 1\nLine 2"       // \n is a real newline
let rawString = #"Line 1\nLine 2"#          // \n stays literal text: "Line 1\nLine 2"

let path = #"C:\Users\Alex\Documents"#      // no need to escape every backslash

let pattern = #"\d{3}-\d{4}"#               // a regex pattern, backslashes untouched
```

To interpolate inside a raw string, use `\#(...)`, with the same number of `#`:

```swift
let value = 42
let raw = #"The value is \#(value), not \(value)"#
// "The value is 42, not \(value)"
```

If your text itself contains `"#`, use more hashes: `##"..."##`.

Raw and multiline together are great for JSON in tests:

```swift
let json = #"""
    {"name": "Alex", "path": "C:\\Users\\Alex"}
    """#
```

**Key takeaway:** use `"""` for readable multi-line text, and `#"..."#` whenever backslashes or quotes would need ugly escaping.

---

## 1.9 Character, Unicode, and Grapheme Clusters 🟡

A Swift **`Character`** is **one extended grapheme cluster**: what a person sees as **one character** on screen, no matter how many Unicode **scalars** (code points) build it.

```swift
let simple: Character = "A"
let emoji: Character = "🇧🇩"       // a flag — actually two Unicode scalars combined
let accented: Character = "é"      // could be 1 scalar (precomposed) or 2 (e + combining accent)
```

This is why `count` gives the answer a person expects, however the text was encoded:

```swift
let cafe1 = "Café"                       // é as a single precomposed scalar
let cafe2 = "Cafe\u{0301}"               // e + combining acute accent (U+0301)

print(cafe1.count)   // 4
print(cafe2.count)   // 4 — same visual result, same Character count
print(cafe1 == cafe2) // true — Swift compares grapheme clusters, not raw bytes
```

A family emoji is an extreme example: **one** `Character`, built from **seven** scalars:

```swift
let family: Character = "👨‍👩‍👧‍👦"
print(family)          // renders as one emoji
// under the hood: man + ZWJ + woman + ZWJ + girl + ZWJ + boy — 4 people, 1 Character
```

(**ZWJ** is the "zero-width joiner", an invisible scalar that glues emoji together.)

So **`count` is not the byte length**, and not the UTF-16 length. Each view of the string counts differently:

```swift
let s = "👨‍👩‍👧‍👦"
s.count                       // 1 (Character count — grapheme clusters)
s.unicodeScalars.count         // 7 (Unicode scalar count)
s.utf16.count                  // 11 (UTF-16 code units — what NSString.length would report)
s.utf8.count                   // 25 (UTF-8 bytes)
```

| View | Counts | Use it for |
|---|---|---|
| `count` | What people see | UI, text limits for users |
| `unicodeScalars` | Unicode code points | Text processing |
| `utf16` | 16-bit units | `NSString`, `NSRange`, UIKit text APIs |
| `utf8` | Bytes | Files, network, C APIs |

This matters in real code. A 10-"character" limit can mean different things:

```swift
let name = "Zoë 👨‍👩‍👧‍👦"
name.count          // 5 — what the user sees
name.utf16.count    // 15 — what an NSString-based limit would count
```

You can look at each scalar directly:

```swift
for scalar in "café".unicodeScalars {
    print(scalar, scalar.value)
}
// c 99
// a 97
// f 102
// é 233   (if precomposed)
```

`Character` also has handy checks:

```swift
let ch: Character = "7"
ch.isNumber        // true
ch.isLetter        // false
ch.wholeNumberValue // Optional(7)
```

**Key takeaway:** `Character` and `count` work at the level a person sees. That is right for UI. But `utf8`, `utf16`, and `unicodeScalars` report **different lengths**, which matters when you talk to non-Swift APIs.

---

## 1.10 Tuples: Grouping Values Without a Type 🟢

A **tuple** groups a few values into one value, **without declaring a new type**. It is the lightest way to pass a few related values around.

```swift
let coordinate = (2, 3)                       // type: (Int, Int)
let httpResponse = (200, "OK")                 // type: (Int, String)
```

Read elements by **position**:

```swift
print(coordinate.0)     // 2
print(coordinate.1)     // 3
```

Or, more readable, by **name**:

```swift
let person = (name: "Alex", age: 28)
print(person.name)      // "Alex"
print(person.age)       // 28
```

**Decompose** a tuple into separate constants:

```swift
let (x, y) = coordinate
print(x, y)              // 2 3

// ignore parts you don't need with _
let (_, statusMessage) = httpResponse
print(statusMessage)      // "OK"
```

The most common real use: **return several values** from a function, without making a struct:

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

A neat trick: **swap two values** in one line:

```swift
var a = 1
var b = 2
(a, b) = (b, a)   // a == 2, b == 1
```

Tuples work in `switch` too. You will see this a lot later:

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

**Know the limits.** Tuples are for **small, short-lived** groups. They have no methods, no computed properties, and no `Codable` support. If a tuple grows past two or three values, or travels through many functions, make a `struct`:

```swift
// Tuple: fine inside one function
let result = (title: "Pancakes", minutes: 20)

// Struct: better when it becomes a real "thing" in your app
struct Recipe: Codable {
    let title: String
    let minutes: Int
    var isQuick: Bool { minutes < 30 }
}
```

**Key takeaway:** use tuples for quick, local groups (especially multiple return values). Switch to a `struct` when the group becomes a real concept.

---

## 1.11 Type Conversion and Initializer Syntax 🟢

Swift **never converts types by itself**. Every conversion is written out, as an **initializer** that looks like a function call: `TypeName(value)`.

```swift
let intValue = 42
let doubleValue = Double(intValue)     // 42.0 — explicit widening
let stringValue = String(intValue)     // "42"

let piString = "3.14"
let piDouble = Double(piString)        // Optional(3.14) — this can fail!
```

Even mixing `Int` and `Double` in math needs a conversion:

```swift
let count = 3
let price = 2.5
let total = price * count          // ❌ error: binary operator '*' cannot be applied to operands of type 'Double' and 'Int'
let fixed = price * Double(count)  // ✅ 7.5
```

Converting **from a `String`** gives an **optional** (`Int?`, `Double?`), because the text might not be a valid number:

```swift
let valid = Int("42")          // Optional(42)
let invalid = Int("abc")       // nil
let overflow = Int8("999")     // nil — 999 doesn't fit in Int8

if let number = Int("42") {
    print(number * 2)          // 84
}
```

A typical use: reading a number from a text field.

```swift
let input = "  12 "
if let quantity = Int(input.trimmingCharacters(in: .whitespaces)), quantity > 0 {
    print("Ordering \(quantity)")
} else {
    print("Please enter a valid number")
}
```

Converting between **number types** can lose data. If the value doesn't fit, a normal conversion **crashes**. Use `exactly:` to get `nil` instead:

```swift
let large: Int = 1000
let small = Int8(large)     // 💥 crash: 1000 doesn't fit in Int8's range (-128...127)

// safer: use the failable initializer
let safeSmall = Int8(exactly: large)   // nil, no crash
let clamped = Int8(clamping: large)    // 127 — the closest value that fits
```

From floating point to integer, the fraction is **cut off**, not rounded:

```swift
let pi = 3.99
let truncated = Int(pi)     // 3, not 4

let rounded = Int(pi.rounded())   // 4 — round explicitly first if that's what you want
```

Your own types use the **same syntax**, by writing an `init`:

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

Built-in conversions (`Double(someInt)`) and your own initializers **look and work the same way**. That consistency makes Swift code easy to read.

**Key takeaway:** every conversion is explicit, written as `Type(value)`. Conversions that can fail return an optional, so check them with `if let` instead of assuming success.

---

## 1.12 Comments, Documentation Comments, and `// MARK:` 🟢

Normal comments use `//` for one line, or `/* ... */` for a block. Unlike C, block comments **can be nested** in Swift:

```swift
// This is a single-line comment

/*
 This is a block comment.
 /* Nested block comments work fine in Swift. */
 */
```

**Documentation comments** use `///` (three slashes). Xcode shows them as **Quick Help** when you Option-click a name, and in autocomplete:

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

Common fields are `- Parameters:`, `- Returns:`, and `- Throws:`. You can include a code sample, too:

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

A documented throwing function:

```swift
/// Loads the saved settings from disk.
/// - Throws: `SettingsError.missingFile` if nothing was saved yet.
/// - Returns: The decoded settings.
func loadSettings() throws -> Settings { /* ... */ }
```

Tip: put the cursor on a function and press **Option+Cmd+/** in Xcode. It writes the doc comment skeleton for you.

**`// MARK:`** comments do nothing for the compiler. They only organize your file in Xcode's **jump bar** (the menu at the top of the editor):

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

The `-` after `MARK:` adds a **divider line** in the jump bar. Two close relatives:

```swift
// TODO: Replace this with a real network call
// FIXME: This crashes when the array is empty
```

Xcode shows `TODO:` and `FIXME:` in the jump bar too, with their own icons. They are simple task notes right inside the code.

**Key takeaway:** use `///` to explain **what** a function does and **how** to call it. Use `// MARK:` only to organize a file. Neither costs anything at runtime.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `var` vs `let` | Use `let` by default; `var` only when the value must change |
| Type inference | The compiler works out types; annotate when you need a non-default type |
| Integers | `Int` is 64-bit and crashes on overflow; integer division drops the fraction |
| Floating point | `Double` is the default; never compare with `==`; use `Decimal` for money |
| Booleans | No truthy/falsy conversion; `&&` and `\|\|` short-circuit |
| Strings | Use interpolation `\(...)` instead of many `+` |
| String indices | No `Int` subscripts; use `String.Index` or helpers like `prefix` |
| Multiline/raw strings | `"""..."""` for many lines; `#"..."#` to turn off escapes |
| Character/Unicode | `Character` = what a person sees; `count` differs from `utf8`/`utf16` counts |
| Tuples | Small, local groups and multiple return values; use a `struct` when it grows |
| Type conversion | Always explicit, as `Type(value)`; string-to-number gives an optional |
| Comments | `///` for docs in Quick Help; `// MARK:` for jump-bar navigation |
