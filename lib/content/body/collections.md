*Estimated read time: ~30 minutes*

This section covers Swift's three core collection types — `Array`, `Dictionary`, `Set` — and the functional operations (`map`, `filter`, `reduce`, and friends) that let you transform them without hand-written loops.

---

## 3.1 Array: Creation, Indexing, and Count

`Array` is an ordered, random-access collection. Like all Swift collections, it's a **value type** — assigning or passing it copies the reference cheaply and only duplicates storage on write (copy-on-write, covered in section 10).

```swift
var numbers: [Int] = [1, 2, 3, 4, 5]
var empty: [String] = []
var empty2 = [String]()               // equivalent, explicit initializer form
var repeated = Array(repeating: 0, count: 5)   // [0, 0, 0, 0, 0]

print(numbers[0])      // 1
print(numbers.count)   // 5
print(numbers.isEmpty) // false
```

Arrays are strongly typed — you cannot mix types in a plain `[Int]` (an array of mixed types would need `[Any]`, which loses type safety):

```swift
var mixed: [Any] = [1, "two", 3.0]   // legal but loses compile-time type checking
```

Out-of-bounds indexing traps at runtime rather than returning `nil` or garbage:

```swift
let arr = [1, 2, 3]
print(arr[5])   // 💥 crash: Index out of range
```

---

## 3.2 Array Mutation: Append, Insert, Remove

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

Mutating an array declared with `let` is a compile error — mutability lives on the binding (recall 1.1):

```swift
let frozen = [1, 2, 3]
frozen.append(4)   // ❌ error: cannot use mutating member on immutable value
```

---

## 3.3 Safe Array Access and Avoiding Index-Out-of-Range

Since direct subscripting crashes on invalid indices, defensive code checks bounds first or uses a safe accessor:

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

`first` and `last` are always safe — they return an optional instead of crashing on an empty array:

```swift
let empty: [Int] = []
print(empty.first)   // nil
print(empty.last)    // nil

let nonEmpty = [1, 2, 3]
print(nonEmpty.first)   // Optional(1)
```

`randomElement()` is similarly safe, returning `nil` for an empty collection instead of crashing.

---

## 3.4 Dictionary Basics and Why Subscripting Returns an Optional

`Dictionary` stores unordered key-value pairs, with unique keys that must conform to `Hashable` (see 7.8).

```swift
var ages: [String: Int] = ["Alice": 30, "Bob": 25]
var empty: [String: String] = [:]

ages["Charlie"] = 35            // add a new entry
ages["Alice"] = 31              // update an existing entry
```

Subscripting a dictionary **always returns an optional**, because the key might not exist:

```swift
let aliceAge = ages["Alice"]     // Int? → Optional(31)
let daveAge = ages["Dave"]       // Int? → nil, not a crash

if let age = ages["Alice"] {
    print("Alice is \(age)")
}
```

This is a deliberate contrast with `Array`, which crashes on invalid access — dictionaries treat a missing key as an expected, normal outcome rather than a programmer error.

```swift
ages["Bob"] = nil       // this is how you remove a key
ages.removeValue(forKey: "Charlie")   // equivalent, and returns the removed value
```

---

## 3.5 Dictionary Iteration and Default Values

Iterating yields `(key, value)` tuples, in no guaranteed order:

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

`default:` on the subscript avoids repetitive `if let`/`??` boilerplate when you want a fallback value instead of an optional:

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

`updateValue(_:forKey:)` sets a value and returns the *previous* value, if any — handy when you need both in one step:

```swift
let previous = wordCounts.updateValue(10, forKey: "swift")
print(previous)   // Optional(2)
```

---

## 3.6 Set: Uniqueness and Membership Testing

`Set` stores unordered, unique values — like a dictionary with only keys and no values. Elements must be `Hashable`.

```swift
var uniqueNumbers: Set<Int> = [1, 2, 3, 2, 1]
print(uniqueNumbers)          // {1, 2, 3} — duplicates collapse automatically
print(uniqueNumbers.count)    // 3

uniqueNumbers.insert(4)
uniqueNumbers.remove(1)

print(uniqueNumbers.contains(2))   // true — O(1) average, unlike Array's O(n) contains
```

The performance difference is the main reason to reach for `Set` over `Array`: membership testing (`contains`) is average O(1) for a set versus O(n) for an array, which matters a lot once a collection grows large.

```swift
let names: Set<String> = ["Alice", "Bob", "Charlie"]
if names.contains("Bob") {
    print("Bob is in the set")
}
```

---

## 3.7 Set Operations: Union, Intersection, Subtracting

Sets support classic mathematical set operations directly:

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

Mutating variants modify the set in place:

```swift
var mutableA: Set = [1, 2, 3]
mutableA.formUnion([3, 4, 5])       // mutableA is now {1, 2, 3, 4, 5}
mutableA.formIntersection([1, 2])   // mutableA is now {1, 2}
```

A common real use: de-duplicating an array while checking overlap with another collection, e.g. finding common tags between two posts.

---

## 3.8 Sorting with `sorted()` and `sorted(by:)`

`sorted()` returns a new sorted array without mutating the original, and requires elements to be `Comparable` (see 7.9):

```swift
let numbers = [5, 3, 8, 1, 9]
let ascending = numbers.sorted()          // [1, 3, 5, 8, 9]
let descending = numbers.sorted(by: >)    // [9, 8, 5, 3, 1]
```

For custom orderings — or types without a natural `Comparable` conformance — pass a closure:

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

The in-place variant `sort()`/`sort(by:)` mutates the array directly instead of returning a copy — useful when you don't need the original order preserved.

---

## 3.9 `map` — Transforming Every Element

`map` applies a closure to every element and returns a new array of the (possibly different) results — the workhorse of Swift's functional collection style.

```swift
let numbers = [1, 2, 3, 4, 5]

let doubled = numbers.map { $0 * 2 }               // [2, 4, 6, 8, 10]
let strings = numbers.map { "Number \($0)" }        // ["Number 1", "Number 2", ...]
let squares = numbers.map { $0 * $0 }               // [1, 4, 9, 16, 25]
```

`map` always produces a result with the same element count as the input — it transforms, it never filters. It works on dictionaries and sets too, though the result type changes (mapping a dictionary's values, for instance, typically produces an array):

```swift
let prices = ["apple": 1.5, "banana": 0.5]
let withTax = prices.mapValues { $0 * 1.08 }   // ["apple": 1.62, "banana": 0.54] — stays a Dictionary
```

---

## 3.10 `filter` — Keeping What Matches

`filter` returns a new collection containing only the elements for which the closure returns `true`:

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

`filter` and `map` chain naturally — filter first to shrink the set, then map to transform (see 3.17):

```swift
let titles = tasks.filter { !$0.isDone }.map { $0.title }
```

---

## 3.11 `reduce` — Collapsing to a Single Value

`reduce` combines every element into one accumulated result, starting from an initial value:

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

`reduce(into:)` avoids creating a new copy of the accumulator on every step, which matters for building up collections efficiently:

```swift
let words = ["swift", "is", "swift", "fun"]
let counts = words.reduce(into: [String: Int]()) { counts, word in
    counts[word, default: 0] += 1
}
print(counts)   // ["swift": 2, "is": 1, "fun": 1]
```

`reduce` is the most general of the collection operations — `map` and `filter` can both be implemented in terms of it, though you should use the more specific operation when it fits, for clarity.

---

## 3.12 `compactMap` — Mapping and Dropping Nils

`compactMap` is `map` followed by an automatic unwrap-and-discard-nils step — perfect for transforming a collection where some transformations might fail:

```swift
let strings = ["1", "2", "abc", "4", "xyz"]

let numbers = strings.compactMap { Int($0) }
print(numbers)   // [1, 2, 4] — "abc" and "xyz" silently dropped, no crash

// compare to plain map, which would give you an array of optionals
let optionals = strings.map { Int($0) }
print(optionals)   // [Optional(1), Optional(2), nil, Optional(4), nil]
```

`compactMap` also works directly on an array of optionals to strip out the `nil`s:

```swift
let mixedOptionals: [Int?] = [1, nil, 3, nil, 5]
let onlyValues = mixedOptionals.compactMap { $0 }
print(onlyValues)   // [1, 3, 5]
```

---

## 3.13 `flatMap` — Flattening Nested Collections

`flatMap` maps each element to a *sequence*, then flattens all those sequences into one:

```swift
let nested = [[1, 2, 3], [4, 5], [6, 7, 8, 9]]

let flat = nested.flatMap { $0 }
print(flat)   // [1, 2, 3, 4, 5, 6, 7, 8, 9]

let words = ["Hello", "Swift"]
let letters = words.flatMap { Array($0) }
print(letters)   // ["H", "e", "l", "l", "o", "S", "w", "i", "f", "t"]
```

A common pattern: generate a small array per element, then flatten the whole thing into one list:

```swift
struct Team { let name: String; let members: [String] }
let teams = [
    Team(name: "Red", members: ["Alice", "Bob"]),
    Team(name: "Blue", members: ["Charlie"])
]
let allMembers = teams.flatMap { $0.members }
print(allMembers)   // ["Alice", "Bob", "Charlie"]
```

Note: on `Optional` specifically, `flatMap` has a different but related meaning — flattening nested optionals (covered in 4.10).

---

## 3.14 `first(where:)`, `contains`, `allSatisfy`

These are search/predicate helpers that avoid writing manual loops for common questions:

```swift
let numbers = [3, 7, 12, 18, 25]

let firstEven = numbers.first(where: { $0 % 2 == 0 })   // Optional(12)
let hasNegative = numbers.contains(where: { $0 < 0 })     // false
let allPositive = numbers.allSatisfy { $0 > 0 }           // true

// contains has a simple overload for Equatable elements too
let letters = ["a", "b", "c"]
letters.contains("b")   // true — no closure needed for direct equality
```

`first(where:)` short-circuits — it stops scanning as soon as it finds a match, unlike `filter(...).first` which would build the entire filtered array first:

```swift
// less efficient: builds a full intermediate array
let inefficient = numbers.filter { $0 % 2 == 0 }.first

// more efficient: stops at the first match
let efficient = numbers.first(where: { $0 % 2 == 0 })
```

---

## 3.15 `enumerated()` and `zip()`

`enumerated()` pairs each element with its integer offset, which is the idiomatic replacement for manual index-tracking loops:

```swift
let fruits = ["apple", "banana", "cherry"]

for (index, fruit) in fruits.enumerated() {
    print("\(index): \(fruit)")
}
// 0: apple
// 1: banana
// 2: cherry
```

`zip()` pairs up elements from two sequences positionally, stopping at the shorter one:

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

`zip` is especially handy for combining two parallel arrays into one array of tuples or structs in a single pass.

---

## 3.16 Slices and `ArraySlice` Index Gotchas

Slicing an array with a range doesn't return an `Array` — it returns an `ArraySlice`, a view sharing storage with the original for efficiency:

```swift
let numbers = [10, 20, 30, 40, 50]
let slice = numbers[1...3]     // ArraySlice([20, 30, 40])

print(slice)   // [20, 30, 40]
```

The gotcha: **`ArraySlice` preserves the original array's indices**, it doesn't renumber from zero:

```swift
print(slice[1])   // 💥 crash: index 1 is out of the slice's valid range!
print(slice[2])   // 30 — correct: this is the original index of value 30
```

If you need zero-based indexing, convert the slice back to a full `Array`:

```swift
let reindexed = Array(slice)
print(reindexed[1])   // 20 — now zero-based
```

`ArraySlice` is meant for short-lived, read-mostly views (e.g. passing a subrange to a function); convert to `Array` before storing it long-term, since a slice keeps the entire original array's storage alive in memory.

---

## 3.17 Chaining Collection Operations Readably

Swift's collection operations chain fluently, but long chains can become hard to read or debug if crammed onto one line:

```swift
let orders = [
    (item: "Book", price: 15.0, quantity: 2),
    (item: "Pen", price: 1.5, quantity: 10),
    (item: "Laptop", price: 999.0, quantity: 1)
]

// one dense line — works, but hard to scan
let total = orders.filter { $0.price > 5 }.map { $0.price * Double($0.quantity) }.reduce(0, +)
```

Breaking each stage onto its own line, with the intent commented, keeps the pipeline scannable without sacrificing the functional style:

```swift
let total = orders
    .filter { $0.price > 5 }                      // ignore cheap incidentals
    .map { $0.price * Double($0.quantity) }        // line total per order
    .reduce(0, +)                                  // grand total

print(total)   // 1029.0
```

**Rule of thumb:** two or three chained operations read fine inline; beyond that, one operation per line (or breaking into named intermediate variables) keeps intent clear and makes each stage easy to breakpoint individually while debugging.

---

## 3.18 Lazy Sequences and When Laziness Pays Off

By default, `map`/`filter`/etc. are **eager** — each call fully processes the entire collection and allocates a new intermediate array before the next operation runs. `.lazy` defers all of that: elements are only computed as they're actually consumed.

```swift
let numbers = Array(1...1_000_000)

// eager: builds two full 1,000,000-element intermediate arrays
let eagerResult = numbers.map { $0 * 2 }.filter { $0 % 3 == 0 }.first

// lazy: computes just enough elements to find the first match, no intermediate arrays
let lazyResult = numbers.lazy.map { $0 * 2 }.filter { $0 % 3 == 0 }.first
```

Both produce the same answer, but the lazy version does dramatically less work when you only need a handful of results (like `.first` or `.prefix(3)`) from a huge or expensive-to-transform source:

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

Laziness has a cost too — a lazy sequence re-runs its transforms every time you iterate it again, since it doesn't cache results. Use `.lazy` when working with very large sequences and only consuming a small prefix or an early match; convert back with `Array(...)` once you need the result stored and reused.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| Array basics | Ordered, random-access, value type; out-of-bounds access crashes |
| Array mutation | `append`/`insert`/`remove` family; mutability requires `var` |
| Safe access | `indices.contains`, `first`/`last`, or a custom `[safe:]` extension |
| Dictionary basics | Subscripting returns an optional — missing keys are normal, not crashes |
| Dictionary iteration | `(key, value)` tuples in no guaranteed order; `default:` avoids boilerplate |
| Set uniqueness | Auto-deduplicates; O(1) average `contains` vs Array's O(n) |
| Set operations | `union`, `intersection`, `subtracting`, and their `form...` mutating variants |
| Sorting | `sorted()`/`sorted(by:)` return copies; `sort()`/`sort(by:)` mutate in place |
| `map` | Transforms every element 1:1, same count in and out |
| `filter` | Keeps only elements matching a predicate |
| `reduce` | Collapses a collection to one accumulated value |
| `compactMap` | `map` + automatic nil-dropping |
| `flatMap` | Maps to sequences, then flattens them into one |
| `first(where:)`/`contains`/`allSatisfy` | Short-circuiting predicate helpers |
| `enumerated()`/`zip()` | Pair elements with indices, or pair two sequences together |
| Slices | `ArraySlice` shares the original array's indices — convert to `Array` to reindex |
| Chaining | Two or three ops read fine inline; more than that, one per line |
| `.lazy` | Defers computation until consumed — pays off on large sequences with early exits |

**Next up:** [Section 4 — Optionals](/articles/optionals) (`nil`, unwrapping, chaining, nil-coalescing).
