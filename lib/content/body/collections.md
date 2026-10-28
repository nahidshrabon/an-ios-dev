**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 3.1 Array: Creation, Indexing, and Count 🟢

An **`Array`** is an **ordered** list. You can read any element by its position (index), starting at **0**.

Like all Swift collections, an array is a **value type**. Assigning it to another variable looks like a copy. Swift only really copies the storage **when one of them changes** (this is called **copy-on-write**, section 10), so passing arrays around is cheap.

```swift
var numbers: [Int] = [1, 2, 3, 4, 5]
var empty: [String] = []
var empty2 = [String]()               // equivalent, explicit initializer form
var repeated = Array(repeating: 0, count: 5)   // [0, 0, 0, 0, 0]

print(numbers[0])      // 1
print(numbers.count)   // 5
print(numbers.isEmpty) // false
```

Copies are independent:

```swift
var a = [1, 2, 3]
var b = a          // looks like a copy
b.append(4)
print(a)           // [1, 2, 3] — a did not change
print(b)           // [1, 2, 3, 4]
```

Arrays are **strongly typed**: an `[Int]` holds only `Int` values. `[Any]` can mix types, but you lose the compiler's type checks:

```swift
var mixed: [Any] = [1, "two", 3.0]   // legal but loses compile-time type checking
```

Reading an index that does not exist **crashes**. It never returns `nil` or garbage:

```swift
let arr = [1, 2, 3]
print(arr[5])   // 💥 crash: Index out of range
```

A few helpful read-only properties and methods:

```swift
let scores = [70, 95, 82]
scores.min()                  // Optional(70)
scores.max()                  // Optional(95)
scores.firstIndex(of: 82)     // Optional(2)
scores.indices                // 0..<3
```

---

## 3.2 Array Mutation: Append, Insert, Remove 🟢

```swift
var fruits = ["apple", "banana"]

fruits.append("cherry")                     // ["apple", "banana", "cherry"]
fruits.append(contentsOf: ["date", "fig"])  // add multiple at once
fruits.insert("apricot", at: 0)             // insert at a specific index

fruits.remove(at: 1)                        // removes and returns the element
fruits.removeLast()                         // removes final element
fruits.removeFirst()                        // removes first element
fruits.removeAll()                          // empties the array

var numbers = [3, 1, 4, 1, 5]
numbers.removeAll(where: { $0 == 1 })       // [3, 4, 5]
numbers.sort()                              // mutates in place: [3, 4, 5]
numbers.reverse()                           // mutates in place: [5, 4, 3]
```

You can also replace elements, or a whole range:

```swift
var letters = ["a", "b", "c", "d"]
letters[0] = "A"                            // ["A", "b", "c", "d"]
letters[1...2] = ["x"]                      // ["A", "x", "d"] — 2 items replaced by 1
letters.swapAt(0, 2)                        // ["d", "x", "A"]
```

`removeLast()` **crashes on an empty array**. `popLast()` is the safe version; it returns an optional:

```swift
var stack: [Int] = []
stack.popLast()      // nil — no crash
stack.removeLast()   // 💥 crash: can't remove last element from an empty collection
```

Changing an array declared with `let` is a compile error. Mutability belongs to the **name** (see 1.1):

```swift
let frozen = [1, 2, 3]
frozen.append(4)   // ❌ error: cannot use mutating member on immutable value
```

---

## 3.3 Safe Array Access and Avoiding Index-Out-of-Range 🟢

A bad index crashes. So when an index **might** be invalid, check first, or use a safe helper:

```swift
let numbers = [10, 20, 30]

// manual bounds check
if numbers.indices.contains(5) {
    print(numbers[5])
} else {
    print("Index out of range")
}

// idiomatic: a custom safe-subscript extension
extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

print(numbers[safe: 5])   // nil — no crash
print(numbers[safe: 1])   // Optional(20)
```

`first` and `last` are always safe. They return an **optional**, and `nil` for an empty array:

```swift
let empty: [Int] = []
print(empty.first)   // nil
print(empty.last)    // nil

let nonEmpty = [1, 2, 3]
print(nonEmpty.first)   // Optional(1)
```

`randomElement()` is safe in the same way: `nil` for an empty collection.

A real example: showing the "next" item, if there is one:

```swift
let steps = ["Mix", "Bake", "Serve"]
let current = 2

if let next = steps[safe: current + 1] {
    print("Next: \(next)")
} else {
    print("Done!")      // prints this: there is no index 3
}
```

**When to use which:** if a bad index means a **bug** in your code, a crash is fine (it shows you the bug). If a bad index is **normal** (user input, data from a server), use a safe check.

---

## 3.4 Dictionary Basics and Why Subscripting Returns an Optional 🟢

A **`Dictionary`** stores **key–value pairs**. Keys are **unique**, have **no fixed order**, and must be `Hashable` (see 7.8).

```swift
var ages: [String: Int] = ["Alice": 30, "Bob": 25]
var empty: [String: String] = [:]

ages["Charlie"] = 35            // add a new entry
ages["Alice"] = 31              // update an existing entry
```

Reading with a key **always gives an optional**, because the key might be missing:

```swift
let aliceAge = ages["Alice"]     // Int? → Optional(31)
let daveAge = ages["Dave"]       // Int? → nil, not a crash

if let age = ages["Alice"] {
    print("Alice is \(age)")
}
```

This is a deliberate difference from `Array`:

| | Array | Dictionary |
|---|---|---|
| Missing index/key | Crash | `nil` |
| Why | A bad index is usually a bug | A missing key is a normal situation |

Remove a key by setting it to `nil`:

```swift
ages["Bob"] = nil       // this is how you remove a key
ages.removeValue(forKey: "Charlie")   // equivalent, and returns the removed value
```

Build a dictionary from an array:

```swift
struct User { let id: Int; let name: String }
let users = [User(id: 1, name: "Alex"), User(id: 2, name: "Sam")]

let byID = Dictionary(uniqueKeysWithValues: users.map { ($0.id, $0) })
byID[2]?.name   // Optional("Sam")
```

(`uniqueKeysWithValues` crashes if two items have the same key. Use `Dictionary(_:uniquingKeysWith:)` when duplicates are possible.)

---

## 3.5 Dictionary Iteration and Default Values 🟢

Looping over a dictionary gives `(key, value)` pairs, in **no guaranteed order**:

```swift
let scores = ["Math": 90, "Science": 85, "Art": 95]

for (subject, score) in scores {
    print("\(subject): \(score)")
}

for subject in scores.keys {
    print(subject)
}

for score in scores.values {
    print(score)
}
```

Need a stable order? Sort first:

```swift
for (subject, score) in scores.sorted(by: { $0.key < $1.key }) {
    print("\(subject): \(score)")   // Art, Math, Science
}
```

A **`default:` value** on the subscript gives a fallback instead of an optional. No `if let` or `??` needed:

```swift
let visitCounts = ["home": 12, "about": 3]

let profileVisits = visitCounts["profile", default: 0]   // 0, no key exists
print(profileVisits)

// classic use: building a tally without checking existence first
var wordCounts: [String: Int] = [:]
let words = ["swift", "is", "swift", "fun", "is"]
for word in words {
    wordCounts[word, default: 0] += 1
}
print(wordCounts)   // ["swift": 2, "is": 2, "fun": 1]
```

`updateValue(_:forKey:)` sets a new value and returns the **old** one, if there was one:

```swift
let previous = wordCounts.updateValue(10, forKey: "swift")
print(previous)   // Optional(2)
```

**Group** items into a dictionary in one line:

```swift
let names = ["Alice", "Adam", "Bob", "Bella", "Chris"]
let byLetter = Dictionary(grouping: names, by: { $0.first! })
// ["A": ["Alice", "Adam"], "B": ["Bob", "Bella"], "C": ["Chris"]]
```

---

## 3.6 Set: Uniqueness and Membership Testing 🟢

A **`Set`** stores **unique** values with **no order**. Think of a dictionary with only keys. Elements must be `Hashable`.

```swift
var uniqueNumbers: Set<Int> = [1, 2, 3, 2, 1]
print(uniqueNumbers)          // {1, 2, 3} (order may vary) — duplicates collapse automatically
print(uniqueNumbers.count)    // 3

uniqueNumbers.insert(4)
uniqueNumbers.remove(1)

print(uniqueNumbers.contains(2))   // true — O(1) average, unlike Array's O(n) contains
```

**The main reason to use a `Set`: fast `contains`.**

| | `Array.contains` | `Set.contains` |
|---|---|---|
| How it works | Checks each element, one by one | Jumps straight to the item using its hash |
| Speed | O(n): slower as the array grows | O(1) on average: about the same speed at any size |

```swift
let names: Set<String> = ["Alice", "Bob", "Charlie"]
if names.contains("Bob") {
    print("Bob is in the set")
}
```

A real example: remember which items the user already saw:

```swift
var seenIDs: Set<Int> = []

func show(_ postID: Int) {
    guard !seenIDs.contains(postID) else { return }   // fast, even with 100,000 IDs
    seenIDs.insert(postID)
    print("Showing post \(postID)")
}
```

Remove duplicates from an array (the order is lost):

```swift
let tags = ["swift", "ios", "swift", "ui"]
let uniqueTags = Array(Set(tags))   // ["ios", "ui", "swift"] in some order
```

---

## 3.7 Set Operations: Union, Intersection, Subtracting 🟢

Sets support the classic math **set operations**:

```swift
let a: Set = [1, 2, 3, 4]
let b: Set = [3, 4, 5, 6]

a.union(b)             // {1, 2, 3, 4, 5, 6}
a.intersection(b)      // {3, 4}
a.subtracting(b)       // {1, 2} — elements in a, not in b
a.symmetricDifference(b) // {1, 2, 5, 6} — in either, but not both

a.isSubset(of: [1, 2, 3, 4, 5])   // true
a.isSuperset(of: [1, 2])          // true
a.isDisjoint(with: [10, 20])      // true — no elements in common
```

| Operation | Keeps |
|---|---|
| `union` | Everything in either set |
| `intersection` | Only what is in **both** |
| `subtracting` | What is in the first, but **not** the second |
| `symmetricDifference` | What is in **one** set, but not both |

The `form...` versions change the set **in place**:

```swift
var mutableA: Set = [1, 2, 3]
mutableA.formUnion([3, 4, 5])       // mutableA is now {1, 2, 3, 4, 5}
mutableA.formIntersection([1, 2])   // mutableA is now {1, 2}
```

A real use: find the tags two posts have in common:

```swift
let postA: Set = ["swift", "ios", "concurrency"]
let postB: Set = ["swift", "android", "concurrency"]

let shared = postA.intersection(postB)   // {"swift", "concurrency"}
let onlyInA = postA.subtracting(postB)   // {"ios"}
```

---

## 3.8 Sorting with `sorted()` and `sorted(by:)` 🟢

`sorted()` returns a **new**, sorted array. The original does not change. The elements must be `Comparable` (see 7.9):

```swift
let numbers = [5, 3, 8, 1, 9]
let ascending = numbers.sorted()          // [1, 3, 5, 8, 9]
let descending = numbers.sorted(by: >)    // [9, 8, 5, 3, 1]
```

For your own order, or types that are not `Comparable`, pass a closure that answers "**should the first one come before the second?**":

```swift
struct Person {
    let name: String
    let age: Int
}

let people = [
    Person(name: "Charlie", age: 35),
    Person(name: "Alice", age: 30),
    Person(name: "Bob", age: 25)
]

let byAge = people.sorted(by: { $0.age < $1.age })
let byName = people.sorted { $0.name < $1.name }   // trailing closure syntax (see 5.10)

for p in byAge {
    print("\(p.name): \(p.age)")
}
// Bob: 25
// Alice: 30
// Charlie: 35
```

Sort by **two keys** (age first, then name for equal ages) by comparing tuples:

```swift
let sorted = people.sorted { ($0.age, $0.name) < ($1.age, $1.name) }
```

You can also sort with **key paths**:

```swift
let byAgeDescending = people.sorted(using: KeyPathComparator(\.age, order: .reverse))
```

| Method | Returns | Changes the original? |
|---|---|---|
| `sorted()` / `sorted(by:)` | A new array | No |
| `sort()` / `sort(by:)` | Nothing | Yes, needs `var` |

For text shown to people, use a **locale-aware** comparison, so "é" and "e" sort the way users expect:

```swift
let cities = ["Zürich", "zebra", "Ägypten", "apple"]
let forDisplay = cities.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
```

---

## 3.9 `map` — Transforming Every Element 🟢

**`map`** runs a closure on **every element** and returns a **new array** of the results. It is the most used collection operation in Swift.

```swift
let numbers = [1, 2, 3, 4, 5]

let doubled = numbers.map { $0 * 2 }               // [2, 4, 6, 8, 10]
let strings = numbers.map { "Number \($0)" }        // ["Number 1", "Number 2", ...]
let squares = numbers.map { $0 * $0 }               // [1, 4, 9, 16, 25]
```

`$0` means "the current element". The long form looks like this:

```swift
let doubledLong = numbers.map { (number: Int) -> Int in
    return number * 2
}
```

**`map` always keeps the same count**: 5 elements in, 5 out. It transforms; it never removes items.

A common use: turn model objects into what the UI needs:

```swift
struct Recipe { let title: String; let minutes: Int }
let recipes = [Recipe(title: "Pancakes", minutes: 20), Recipe(title: "Soup", minutes: 45)]

let titles = recipes.map { $0.title }          // ["Pancakes", "Soup"]
let titles2 = recipes.map(\.title)              // same, using a key path
```

For a dictionary, **`mapValues`** changes the values and **keeps** it a dictionary:

```swift
let prices = ["apple": 1.5, "banana": 0.5]
let withTax = prices.mapValues { $0 * 1.08 }   // ["apple": ≈1.62, "banana": ≈0.54] — stays a Dictionary
```

---

## 3.10 `filter` — Keeping What Matches 🟢

**`filter`** returns a new collection with **only the elements** where the closure returns `true`:

```swift
let numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

let evens = numbers.filter { $0 % 2 == 0 }         // [2, 4, 6, 8, 10]
let bigOnes = numbers.filter { $0 > 5 }             // [6, 7, 8, 9, 10]

struct Task { let title: String; let isDone: Bool }
let tasks = [
    Task(title: "Write code", isDone: true),
    Task(title: "Test code", isDone: false),
    Task(title: "Ship code", isDone: false)
]
let pending = tasks.filter { !$0.isDone }
print(pending.map { $0.title })   // ["Test code", "Ship code"]
```

`filter` and `map` chain nicely. **Filter first** to make the list smaller, then map (see 3.17):

```swift
let titles = tasks.filter { !$0.isDone }.map { $0.title }
```

A search box is a typical real use:

```swift
let query = "co"
let results = tasks.filter { $0.title.localizedCaseInsensitiveContains(query) }
// all three titles contain "co"
```

Need only the **count**? Don't build a new array; use `count(where:)` (Swift 6):

```swift
let doneCount = tasks.count(where: { $0.isDone })   // 1
```

---

## 3.11 `reduce` — Collapsing to a Single Value 🟡

**`reduce`** combines **all elements into one result**. You give a **starting value**, and a closure that adds one element at a time:

```swift
let numbers = [1, 2, 3, 4, 5]

let sum = numbers.reduce(0) { partialResult, next in
    partialResult + next
}
print(sum)   // 15

// shorthand with $0, $1
let product = numbers.reduce(1, { $0 * $1 })
print(product)   // 120

let longestWord = ["swift", "is", "concise"].reduce("") { longest, word in
    word.count > longest.count ? word : longest
}
print(longestWord)   // "concise"
```

Step by step, the sum works like this:

```plaintext
start: 0
0 + 1 = 1
1 + 2 = 3
3 + 3 = 6
6 + 4 = 10
10 + 5 = 15   ← result
```

An operator can be the closure, so a sum is very short:

```swift
let total = numbers.reduce(0, +)   // 15
```

**`reduce(into:)`** changes **one** accumulator in place, instead of making a new copy at every step. Use it when you build a collection:

```swift
let words = ["swift", "is", "swift", "fun"]
let counts = words.reduce(into: [String: Int]()) { counts, word in
    counts[word, default: 0] += 1
}
print(counts)   // ["swift": 2, "is": 1, "fun": 1]
```

`reduce` is the most general operation: `map` and `filter` could both be written with it. But use the **specific** one when it fits. `map` and `filter` say what you mean more clearly.

---

## 3.12 `compactMap` — Mapping and Dropping Nils 🟢

**`compactMap`** is `map`, plus **removing every `nil`**. It is perfect when the transform **can fail** for some elements:

```swift
let strings = ["1", "2", "abc", "4", "xyz"]

let numbers = strings.compactMap { Int($0) }
print(numbers)   // [1, 2, 4] — "abc" and "xyz" silently dropped, no crash

// compare to plain map, which would give you an array of optionals
let optionals = strings.map { Int($0) }
print(optionals)   // [Optional(1), Optional(2), nil, Optional(4), nil]
```

It also strips `nil`s from an array of optionals:

```swift
let mixedOptionals: [Int?] = [1, nil, 3, nil, 5]
let onlyValues = mixedOptionals.compactMap { $0 }
print(onlyValues)   // [1, 3, 5]
```

A real example: turn strings from a server into valid URLs, and skip broken ones:

```swift
let links = ["https://apple.com", "not a url", "https://swift.org"]
let urls = links.compactMap { URL(string: $0) }
// only the valid URLs are kept
```

---

## 3.13 `flatMap` — Flattening Nested Collections 🟡

**`flatMap`** maps each element to a **list**, then **joins all the lists** into one:

```swift
let nested = [[1, 2, 3], [4, 5], [6, 7, 8, 9]]

let flat = nested.flatMap { $0 }
print(flat)   // [1, 2, 3, 4, 5, 6, 7, 8, 9]

let words = ["Hello", "Swift"]
let letters = words.flatMap { Array($0) }
print(letters)   // ["H", "e", "l", "l", "o", "S", "w", "i", "f", "t"]
```

Compare with `map`, which keeps the nesting:

```swift
nested.map { $0 }       // [[1, 2, 3], [4, 5], [6, 7, 8, 9]] — still nested
nested.flatMap { $0 }   // [1, 2, 3, 4, 5, 6, 7, 8, 9]     — flat
```

A common pattern: each item has a small list, and you want **one big list**:

```swift
struct Team { let name: String; let members: [String] }
let teams = [
    Team(name: "Red", members: ["Alice", "Bob"]),
    Team(name: "Blue", members: ["Charlie"])
]
let allMembers = teams.flatMap { $0.members }
print(allMembers)   // ["Alice", "Bob", "Charlie"]
```

If you only need to join nested arrays, `joined()` does the same:

```swift
let flat2 = Array(nested.joined())
```

Note: on `Optional`, `flatMap` means something different but related: flattening **nested optionals** (see 4.10).

---

## 3.14 `first(where:)`, `contains`, `allSatisfy` 🟢

These helpers answer common questions **without a hand-written loop**:

```swift
let numbers = [3, 7, 12, 18, 25]

let firstEven = numbers.first(where: { $0 % 2 == 0 })   // Optional(12)
let hasNegative = numbers.contains(where: { $0 < 0 })     // false
let allPositive = numbers.allSatisfy { $0 > 0 }           // true

// contains has a simple overload for Equatable elements too
let letters = ["a", "b", "c"]
letters.contains("b")   // true — no closure needed for direct equality
```

| Question | Method |
|---|---|
| "Which is the first one that...?" | `first(where:)` |
| "Is there **any** that...?" | `contains(where:)` |
| "Do **all** of them...?" | `allSatisfy` |
| "Where is the first one that...?" | `firstIndex(where:)` |
| "Which is the last one that...?" | `last(where:)` |

`first(where:)` **stops at the first match**. `filter(...).first` builds the **whole** filtered array first, and then takes one item:

```swift
// less efficient: builds a full intermediate array
let inefficient = numbers.filter { $0 % 2 == 0 }.first

// more efficient: stops at the first match
let efficient = numbers.first(where: { $0 % 2 == 0 })
```

A form-validation example:

```swift
let fields = ["Alex", "alex@example.com", ""]
let isComplete = fields.allSatisfy { !$0.isEmpty }   // false: the last field is empty
```

---

## 3.15 `enumerated()` and `zip()` 🟢

**`enumerated()`** pairs each element with its **position**. Use it instead of keeping an index variable yourself:

```swift
let fruits = ["apple", "banana", "cherry"]

for (index, fruit) in fruits.enumerated() {
    print("\(index): \(fruit)")
}
// 0: apple
// 1: banana
// 2: cherry
```

(Strictly, the number is an **offset** from the start, always 0, 1, 2... That is not always a valid index for slices; see 3.16.)

**`zip()`** pairs elements of **two sequences** by position. It **stops at the shorter one**:

```swift
let names = ["Alice", "Bob", "Charlie"]
let scores = [90, 85, 78]

for (name, score) in zip(names, scores) {
    print("\(name): \(score)")
}

let ages = [30, 25]   // shorter than names
for pair in zip(names, ages) {
    print(pair)   // only 2 pairs produced, "Charlie" is dropped
}
```

`zip` is great for **combining two parallel arrays** into one list of structs:

```swift
struct Player { let name: String; let score: Int }
let players = zip(names, scores).map { Player(name: $0, score: $1) }
```

Or for comparing each element with the **next** one:

```swift
let temps = [18, 21, 19, 24]
let changes = zip(temps, temps.dropFirst()).map { $1 - $0 }   // [3, -2, 5]
```

---

## 3.16 Slices and `ArraySlice` Index Gotchas 🟡

Taking a range of an array does **not** give an `Array`. It gives an **`ArraySlice`**: a **view** that shares memory with the original array, so no copy is made.

```swift
let numbers = [10, 20, 30, 40, 50]
let slice = numbers[1...3]     // ArraySlice([20, 30, 40])

print(slice)   // [20, 30, 40]
```

**The gotcha:** a slice **keeps the original indices**. It does **not** start again at 0:

```swift
print(slice.startIndex)   // 1, not 0
print(slice[1])           // 20 — index 1 of the ORIGINAL array
print(slice[2])           // 30
print(slice[0])           // 💥 crash: index 0 is outside the slice (valid: 1...3)
```

```plaintext
original indices:   0    1    2    3    4
numbers:           10   20   30   40   50
slice:                  20   30   40
slice indices:          1    2    3       ← not 0, 1, 2
```

Use `startIndex` (or `first`) instead of assuming 0:

```swift
let firstOfSlice = slice[slice.startIndex]   // 20
let alsoFirst = slice.first                  // Optional(20)
```

For zero-based indices, convert the slice to an `Array`:

```swift
let reindexed = Array(slice)
print(reindexed[0])   // 20 — now zero-based
print(reindexed[1])   // 30
```

`prefix`, `suffix`, `dropFirst`, and `dropLast` also return slices:

```swift
let lastTwo = numbers.suffix(2)        // ArraySlice: [40, 50], indices 3...4
let saved: [Int] = Array(lastTwo)       // convert before you store it
```

Use slices for **short-lived** work, like passing part of an array to a function. Convert to `Array` before **storing** one, because a slice keeps the **whole original array** alive in memory.

---

## 3.17 Chaining Collection Operations Readably 🟢

Collection operations **chain** nicely. But a long chain on one line is hard to read and hard to debug:

```swift
let orders = [
    (item: "Book", price: 15.0, quantity: 2),
    (item: "Pen", price: 1.5, quantity: 10),
    (item: "Laptop", price: 999.0, quantity: 1)
]

// one dense line — works, but hard to scan
let total = orders.filter { $0.price > 5 }.map { $0.price * Double($0.quantity) }.reduce(0, +)
```

Put **each step on its own line**, with a short comment about its purpose:

```swift
let total = orders
    .filter { $0.price > 5 }                      // ignore cheap incidentals
    .map { $0.price * Double($0.quantity) }        // line total per order
    .reduce(0, +)                                  // grand total

print(total)   // 1029.0
```

Or use **named steps**. Each name explains itself, and you can set a breakpoint on each line:

```swift
let realOrders = orders.filter { $0.price > 5 }
let lineTotals = realOrders.map { $0.price * Double($0.quantity) }
let grandTotal = lineTotals.reduce(0, +)
```

**Rule of thumb:** two or three operations read fine on one line. More than that: one operation per line, or named steps.

---

## 3.18 Lazy Sequences and When Laziness Pays Off 🔴

Normally, `map`, `filter`, and friends are **eager**: each one processes the **whole collection** and builds a **new array** before the next step starts.

**`.lazy`** changes this. Nothing is computed until a value is **actually needed**, and then only as much as needed.

```swift
let numbers = Array(1...1_000_000)

// eager: builds two full 1,000,000-element intermediate arrays
let eagerResult = numbers.map { $0 * 2 }.filter { $0 % 3 == 0 }.first

// lazy: computes just enough elements to find the first match, no intermediate arrays
let lazyResult = numbers.lazy.map { $0 * 2 }.filter { $0 % 3 == 0 }.first
```

Both give the same answer (6). The lazy one stops after **3 elements**. The eager one processes **a million** elements twice.

You can see the difference with a `print`:

```swift
func expensiveTransform(_ n: Int) -> Int {
    print("processing \(n)")
    return n * n
}

let smallSet = [1, 2, 3, 4, 5]

// eager: prints "processing" 5 times, even though we only need 2 results
let eagerFirstTwo = Array(smallSet.map(expensiveTransform).prefix(2))

// lazy: prints "processing" only twice — computation stops once satisfied
let lazyFirstTwo = Array(smallSet.lazy.map(expensiveTransform).prefix(2))
```

**Laziness has a cost too.** A lazy sequence **does not save its results**. If you loop over it twice, the work runs twice:

```swift
let lazySquares = smallSet.lazy.map(expensiveTransform)
for _ in lazySquares { }   // prints "processing" 5 times
for _ in lazySquares { }   // prints "processing" 5 MORE times

let saved = Array(lazySquares)   // compute once, then reuse `saved`
```

| Use `.lazy` when | Avoid it when |
|---|---|
| The source is **huge** (or expensive) | The collection is small |
| You need only a **few** results (`first`, `prefix`) | You use **every** result |
| | You will loop over the result **many times** |

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Array basics | Ordered, indexed from 0, value type; a bad index crashes |
| Array mutation | `append`, `insert`, `remove...`; needs `var`; `popLast()` is the safe remove |
| Safe access | `indices.contains`, `first`/`last`, or a `[safe:]` extension |
| Dictionary basics | Reading a key gives an optional; a missing key is normal |
| Dictionary iteration | No guaranteed order; `default:` and `grouping:` save code |
| Set uniqueness | No duplicates; `contains` is O(1) on average |
| Set operations | `union`, `intersection`, `subtracting`, and `form...` versions |
| Sorting | `sorted` returns a copy; `sort` changes in place |
| `map` | Transforms every element; same count in and out |
| `filter` | Keeps only matching elements |
| `reduce` | Combines everything into one value; `reduce(into:)` for collections |
| `compactMap` | `map` plus dropping `nil`s |
| `flatMap` | Maps to lists, then joins them into one |
| `first(where:)`/`contains`/`allSatisfy` | Questions without loops; they stop early |
| `enumerated()`/`zip()` | Add positions, or pair two sequences |
| Slices | `ArraySlice` keeps the original indices; convert with `Array(...)` |
| Chaining | One step per line once a chain gets long |
| `.lazy` | Computes only what is used; great for big data and early exits |
