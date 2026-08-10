*Estimated read time: ~30 minutes*

---

## 15.1 `UnsafePointer` Family Overview

Swift's `Unsafe*Pointer` types provide direct, unchecked memory access — bypassing ARC, bounds checking, and type safety entirely, in exchange for C-level control and performance. The family covers read-only vs. mutable, and typed vs. raw:

```swift
var value = 42
withUnsafePointer(to: &value) { pointer in
    print(pointer.pointee)   // 42 — reading through an UnsafePointer<Int>
}

withUnsafeMutablePointer(to: &value) { pointer in
    pointer.pointee = 100   // writing through an UnsafeMutablePointer<Int>
}
print(value)   // 100
```

`UnsafePointer<T>`/`UnsafeMutablePointer<T>` are typed (they know they point at a `T`); `UnsafeRawPointer`/`UnsafeMutableRawPointer` are untyped (raw bytes, requiring explicit reinterpretation to use). "Unsafe" here is a precise technical term: the compiler provides zero safety net — dangling pointers, out-of-bounds access, and use-after-free are all possible and entirely your responsibility to avoid.

---

## 15.2 `withUnsafeBufferPointer` and Safe Scoping

Rather than manually managing raw pointer lifetimes, Swift's collections expose their contiguous storage through **scoped** closures — the pointer is only valid for the duration of the closure, which is what makes this pattern much safer than manually-created unsafe pointers:

```swift
let numbers = [1, 2, 3, 4, 5]

numbers.withUnsafeBufferPointer { buffer in
    // buffer is a valid, contiguous view into the array's storage,
    // guaranteed valid only within this closure
    var sum = 0
    for value in buffer {
        sum += value
    }
    print(sum)   // 15
}
// using "buffer" outside this closure would be a use-after-free bug — the compiler
// doesn't prevent this at the type level, but the API's design strongly discourages it
```

This pattern is commonly used to interoperate with C APIs expecting a raw pointer and length, or for performance-critical code avoiding the small overhead of `Array`'s normal bounds-checked subscripting — while keeping the *unsafe* part narrowly scoped to one closure rather than a long-lived, manually-managed pointer.

---

## 15.3 `Span` and `RawSpan`

`Span<Element>` (introduced alongside Swift's ownership features, section 11.9) is a modern, memory-safe alternative to `UnsafeBufferPointer` — a non-owning, bounds-checked view into contiguous memory that uses `~Escapable` (recall 11.9) to guarantee, at compile time, that it can never outlive the memory it points into.

```swift
func sum(of span: Span<Int>) -> Int {
    var total = 0
    for i in 0..<span.count {
        total += span[i]   // bounds-checked, unlike raw pointer access
    }
    return total
}

let numbers = [1, 2, 3, 4, 5]
print(sum(of: numbers.span))   // 15 — safe, bounds-checked, and cannot escape numbers' lifetime
```

`RawSpan` is the untyped counterpart, analogous to how `UnsafeRawPointer` relates to `UnsafePointer<T>`. The key advantage over `UnsafeBufferPointer`: the compiler's lifetime-dependency checking (via `~Escapable`) statically prevents the use-after-free bug that `withUnsafeBufferPointer`'s closure-scoping pattern only discourages by convention — `Span` makes that safety guarantee enforced, not just suggested.

---

## 15.4 `InlineArray` and Stack Allocation

`InlineArray<N, Element>` (a newer Swift feature) is a fixed-size array whose elements are stored directly inline — typically on the stack — rather than in a separately heap-allocated buffer the way `Array` normally works, eliminating heap allocation overhead entirely for small, fixed-size collections known at compile time.

```swift
let fixed: InlineArray<3, Int> = [1, 2, 3]
print(fixed[0])   // 1
print(fixed.count)   // 3
```

Because its size (`3` here) is part of the type itself, an `InlineArray<3, Int>` can never grow or shrink — this rigidity is exactly the tradeoff that enables it to avoid `Array`'s heap-allocated backing storage, making it attractive for performance-critical code working with small, fixed-count data (like a 3D vector's components, or a fixed-size lookup table) where `Array`'s flexibility isn't needed and its allocation overhead isn't wanted.

---

## 15.5 `ContiguousArray` vs `Array`

`ContiguousArray<Element>` guarantees its elements are always stored in a single, contiguous block of native Swift memory — unlike plain `Array`, which can (for `Element` types that are classes or `@objc` protocols) sometimes be backed by an `NSArray` bridged from Objective-C, adding a small amount of bridging overhead for certain operations.

```swift
let regularArray: Array<Int> = [1, 2, 3]
let contiguousArray: ContiguousArray<Int> = [1, 2, 3]

// For value types like Int, there's effectively no difference between them.
// The distinction matters specifically for class/@objc-protocol element types,
// where Array might bridge to/from NSArray, while ContiguousArray never does.
```

For everyday Swift code — especially anything using purely native value types like `Int`, `String`, or your own structs — `Array` and `ContiguousArray` perform identically, and `Array` remains the correct default choice for its broader interoperability. `ContiguousArray` is a narrow optimization reserved for performance-critical code specifically storing class instances, where avoiding potential Objective-C bridging overhead has been measured to matter.

---

## 15.6 `ManagedBuffer` and Tail Allocation

`ManagedBuffer` is the low-level mechanism the standard library itself uses to implement types like `Array`'s storage — it lets you allocate a single heap block containing both a fixed header (arbitrary stored properties) and a variable-length "tail" of elements immediately following it in memory, avoiding a separate allocation and pointer indirection for the elements.

```swift
final class MyBuffer<Element>: ManagedBuffer<Int, Element> {
    static func create(minimumCapacity: Int) -> MyBuffer<Element> {
        let buffer = MyBuffer<Element>.create(minimumCapacity: minimumCapacity) { _ in 0 }
        return unsafeDowncast(buffer, to: MyBuffer<Element>.self)
    }
}
```

This is precisely the technique behind the copy-on-write storage mechanism discussed in section 10.11 — `Array`'s actual backing storage is a `ManagedBuffer`-style allocation combining its header (like `count`/`capacity` bookkeeping) with its element storage in one contiguous heap block. Writing your own `ManagedBuffer` subclass is a genuinely rare, expert-level undertaking, reserved for building custom high-performance collection types.

---

## 15.7 Memory Rebinding and Layout Rules

"Rebinding" memory means telling the compiler to reinterpret an existing block of memory as holding a different type than it was originally allocated for — an inherently unsafe operation, since Swift's normal type system assumes memory holds exactly the type it was allocated as.

```swift
let rawPointer = UnsafeMutableRawPointer.allocate(byteCount: 4, alignment: 4)
defer { rawPointer.deallocate() }

rawPointer.storeBytes(of: Int32(42), as: Int32.self)

// rebind the same memory temporarily, to reinterpret its bytes as a different type
rawPointer.withMemoryRebound(to: UInt8.self, capacity: 4) { bytes in
    print(bytes[0], bytes[1], bytes[2], bytes[3])   // the raw bytes making up the Int32(42)
}
```

Rebinding is governed by strict rules (Swift's memory model requires the types involved to have compatible layout/size for this to be well-defined behavior) — violating them produces undefined behavior that might work by coincidence on one platform/compiler version and silently break on another. This is squarely expert-level territory, typically only encountered when implementing very low-level data structures or C interop shims.

---

## 15.8 C Interop: Calling C Functions from Swift

Swift has first-class, near-seamless interop with C: importing a C header (via a bridging header in an app target, or a module map in a package) makes C functions, structs, and types directly callable from Swift, with automatic translation of most C conventions into their Swift equivalents.

```swift
// Given a C function: int add(int a, int b);
// after importing the C header, it's callable directly:
let result = add(3, 4)   // calls straight into the C function
print(result)   // 7

// C strings (char*) bridge to/from Swift String via specific conversion APIs:
let cString = strdup("hello")
let swiftString = String(cString: cString!)
free(cString)
```

C's pointer-heavy APIs typically surface in Swift as `UnsafePointer`/`UnsafeMutablePointer` types (tying directly back to 15.1), and C `struct`s import as Swift structs with equivalent memory layout — this interop is what allows Swift to sit directly on top of decades of existing C libraries and system APIs without requiring a wrapper layer written in Objective-C first.

---

## 15.9 C++ Interoperability Mode

Beyond plain C, Swift has a dedicated (and still evolving) C++ interoperability mode, enabling direct, bidirectional use of C++ types and functions from Swift (and Swift types from C++) — substantially more involved than C interop, since C++'s richer type system (templates, references, destructors, inheritance) doesn't map onto Swift's model as directly as C's simpler one does.

```swift
// Given a C++ class:
// class Vector3 {
// public:
//     double x, y, z;
//     double length() const;
// };
//
// With C++ interop enabled, Swift can use it nearly as if it were a native Swift type:
// let v = Vector3(x: 1, y: 2, z: 3)
// print(v.length())
```

C++ interop is enabled per-target via build settings (`interoperabilityMode: .Cxx` in a Swift package's target configuration) and remains an actively developing area of the language — genuinely useful for gradually adopting Swift inside a large, established C++ codebase (a common scenario in games, or long-lived cross-platform libraries) without a full rewrite, but a substantially more complex undertaking than straightforward C interop.

---

## 15.10 Objective-C Bridging Cost

Many Foundation/UIKit APIs still ultimately trace back to Objective-C, and moving values across that Swift/Objective-C boundary isn't always free — certain Swift types (`String`, `Array`, `Dictionary` of compatible element types) can bridge to their Objective-C counterparts (`NSString`, `NSArray`, `NSDictionary`) transparently, but that bridging can involve actual conversion work, not just a type-level relabeling.

```swift
let swiftArray: [String] = ["a", "b", "c"]

// Passing this to an API expecting NSArray typically bridges automatically,
// but for large collections or hot code paths, this bridging has a real,
// measurable cost — not free, even though it's syntactically invisible.
func processObjC(_ array: NSArray) {
    print(array.count)
}
processObjC(swiftArray as NSArray)
```

`String`-to-`NSString` bridging, in particular, can be more expensive than it appears, since Swift's `String` and `NSString`'s internal representations aren't always identical — the bridging layer sometimes has to do real work to reconcile them. This cost is usually invisible and irrelevant in typical app code, but becomes a real, measurable factor in tight loops or performance-critical code repeatedly crossing the Swift/Objective-C boundary, particularly with large strings or collections.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `UnsafePointer` family | Direct, unchecked memory access — typed vs. raw, mutable vs. read-only, zero safety net |
| `withUnsafeBufferPointer` | Scopes unsafe pointer validity to a closure — safer by convention, not by compiler enforcement |
| `Span`/`RawSpan` | A modern, bounds-checked, `~Escapable`-backed alternative that statically prevents use-after-free |
| `InlineArray` | Fixed-size, stack-allocated array — avoids heap allocation entirely for small, known-size data |
| `ContiguousArray` vs `Array` | Identical for value types; matters only for class/`@objc` elements to avoid `NSArray` bridging |
| `ManagedBuffer` | The low-level mechanism behind `Array`'s own COW storage — header + inline tail allocation |
| Memory rebinding | Reinterpreting existing memory as a different type — strict rules, undefined behavior if violated |
| C interop | Near-seamless — C functions/structs/pointers import directly and predictably into Swift |
| C++ interop | More involved than C interop, due to C++'s richer type system; useful for gradual adoption |
| Objective-C bridging cost | Bridging Swift/Objective-C types (`String`/`NSString`, etc.) isn't always free — real, measurable cost in hot paths |

**Next up:** [Section 16 — Swift Evolution Literacy](/dashboard/roadmap) — the final section of Part 1 (Swift Language), before moving on to Part 2 (Concurrency). Not published yet — check the roadmap for progress.
