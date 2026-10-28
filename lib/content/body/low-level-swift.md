**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

This section is about **low-level memory** and **talking to C, C++, and Objective-C**. Most app developers rarely need it day to day. But it explains what happens under Swift's safe surface, and you'll meet it when you use C libraries or tune hot code.

## 15.1 `UnsafePointer` Family Overview 🔴

Swift's **`Unsafe…Pointer`** types give **direct, unchecked** access to memory. They skip ARC, bounds checks, and type safety, in exchange for **C-level control and speed**.

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

The family has four main members:

| | Typed (knows it points to a `T`) | Raw (just bytes) |
|---|---|---|
| Read-only | `UnsafePointer<T>` | `UnsafeRawPointer` |
| Read and write | `UnsafeMutablePointer<T>` | `UnsafeMutableRawPointer` |

There are **buffer** versions too (`UnsafeBufferPointer<T>`, etc.): a pointer **plus a count**.

**"Unsafe" has an exact meaning:** the compiler gives **no safety net**. These bugs are all possible, and are **your** job to avoid:

```swift
let pointer = UnsafeMutablePointer<Int>.allocate(capacity: 3)
pointer.initialize(repeating: 0, count: 3)

pointer[5] = 1            // ⚠️ out of bounds: no check, may corrupt other memory
pointer.deinitialize(count: 3)
pointer.deallocate()
print(pointer[0])         // ⚠️ use after free: reading memory you no longer own
```

Every manual `allocate` needs a matching `deallocate`, and initialized memory must be **deinitialized**. Forget, and you leak; do it twice, and you crash.

---

## 15.2 `withUnsafeBufferPointer` and Safe Scoping 🟡

Instead of managing pointer lifetimes by hand, Swift collections offer their memory through **scoped closures**. The pointer is **valid only inside the closure**. That makes this much safer than a pointer you keep around:

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

The **mutable** version lets you write directly into an array's storage:

```swift
var pixels = [UInt8](repeating: 0, count: 4)
pixels.withUnsafeMutableBufferPointer { buffer in
    for i in buffer.indices {
        buffer[i] = 255                  // write straight into the array's memory
    }
}
print(pixels)   // [255, 255, 255, 255]
```

The **wrong** way, for comparison:

```swift
// ❌ Never return or store the pointer — it's only valid inside the closure
let escaped = numbers.withUnsafeBufferPointer { $0 }
print(escaped[0])   // undefined behavior: the array may have moved or been freed
```

Common uses: passing data to **C APIs** that want a pointer and a length (15.8), and **hot loops** where you've measured that bounds checks matter.

---

## 15.3 `Span` and `RawSpan` 🔴

**`Span<Element>`** (Swift 6.2) is the modern, **memory-safe** alternative to `UnsafeBufferPointer`. It's a **non-owning view** into contiguous memory that is:

- **bounds-checked**: a bad index traps instead of corrupting memory;
- **`~Escapable`** (11.9): the compiler **proves** it can't outlive the memory it points into.

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

The `withUnsafeBufferPointer` bug from 15.2 becomes a **compile error** with `Span`:

```swift
func keep() -> Span<Int> {
    let local = [1, 2, 3]
    return local.span        // ❌ error: the span would outlive `local`
}
```

**`RawSpan`** is the **untyped** version (bytes), like `UnsafeRawPointer` vs `UnsafePointer<T>`. It's handy for parsing binary data:

```swift
let data: [UInt8] = [0x2A, 0x00, 0x00, 0x00]
let bytes = data.span.bytes                              // RawSpan
let number = bytes.unsafeLoad(fromByteOffset: 0, as: UInt32.self)
print(number)   // 42 on little-endian devices (all current Apple hardware)
```

| | `UnsafeBufferPointer` | `Span` |
|---|---|---|
| Speed | Fast | Fast |
| Bounds checks | No | Yes |
| Can outlive the memory | Yes (a bug) | No (compile error) |
| Safety | By convention | **Enforced** by the compiler |

(`Span` needs Swift 6.2, and some APIs may need a recent OS version.)

---

## 15.4 `InlineArray` and Stack Allocation 🔴

**`InlineArray<N, Element>`** (Swift 6.2) is a **fixed-size** array. Its elements are stored **inline**, right inside the value (often on the stack), instead of in a separate **heap** buffer like `Array`. So there is **no heap allocation** at all.

```swift
let fixed: InlineArray<3, Int> = [1, 2, 3]
print(fixed[0])   // 1
print(fixed.count)   // 3
```

The size (`3`) is **part of the type**. It can **never grow or shrink**:

```swift
var rgb: InlineArray<3, UInt8> = [255, 128, 0]
rgb[1] = 64                 // ✅ change an element
// rgb.append(10)           // ❌ no append: the size is fixed
```

| | `Array<Int>` | `InlineArray<3, Int>` |
|---|---|---|
| Size | Can change | Fixed, in the type |
| Storage | Heap buffer + ARC | Inline, no heap |
| Copying | Copy-on-write | Copies all elements |

It fits **small, fixed-size** data in **hot code**: a 3D vector's components, a color, a small lookup table.

```swift
struct Vector3 {
    var components: InlineArray<3, Float>     // no heap allocation per vector

    var length: Float {
        var sum: Float = 0
        for i in components.indices { sum += components[i] * components[i] }
        return sum.squareRoot()
    }
}
```

For anything that grows, or for normal app code, `Array` is still the right choice.

---

## 15.5 `ContiguousArray` vs `Array` 🔴

**`ContiguousArray<Element>`** **always** stores its elements in **one block of native Swift memory**. A plain `Array` of **class** or `@objc` protocol elements can sometimes be backed by an **`NSArray`** from Objective-C, which adds a small bridging cost.

```swift
let regularArray: Array<Int> = [1, 2, 3]
let contiguousArray: ContiguousArray<Int> = [1, 2, 3]

// For value types like Int, there's effectively no difference between them.
// The distinction matters specifically for class/@objc-protocol element types,
// where Array might bridge to/from NSArray, while ContiguousArray never does.
```

| Element type | `Array` vs `ContiguousArray` |
|---|---|
| Structs, enums, `Int`, `String` | **No difference** |
| Classes, `@objc` protocols | `ContiguousArray` never bridges to `NSArray` |

(On Linux there's no Objective-C, so they're always the same.)

**Use `Array` by default.** It works everywhere and bridges smoothly to Objective-C APIs. `ContiguousArray` is a narrow optimization: for hot code that stores **class instances**, **after** you've measured that bridging matters.

---

## 15.6 `ManagedBuffer` and Tail Allocation 🔴

**`ManagedBuffer`** is a low-level tool the standard library itself uses for `Array`'s storage. It allocates **one heap block** that holds:

- a fixed **header** (any values you like, such as a count), and
- a **variable-length tail** of elements, right after the header.

```plaintext
One heap allocation:
┌──────────────┬────┬────┬────┬────┬───────────┐
│ header       │ e0 │ e1 │ e2 │ e3 │ (spare)   │
│ count = 4    │    │    │    │    │           │
└──────────────┴────┴────┴────┴────┴───────────┘
```

Everything in **one** allocation: no separate buffer, no extra pointer hop.

```swift
final class IntStorage: ManagedBuffer<Int, Int> {      // header: count; elements: Int
    static func make(capacity: Int) -> IntStorage {
        let buffer = IntStorage.create(minimumCapacity: capacity) { _ in 0 }   // count starts at 0
        return unsafeDowncast(buffer, to: IntStorage.self)
    }

    func append(_ value: Int) {
        withUnsafeMutablePointers { count, elements in
            precondition(count.pointee < capacity, "storage is full")
            (elements + count.pointee).initialize(to: value)
            count.pointee += 1
        }
    }

    func element(at index: Int) -> Int {
        withUnsafeMutablePointers { count, elements in
            precondition(index < count.pointee, "index out of range")
            return elements[index]
        }
    }

    deinit {
        withUnsafeMutablePointers { count, elements in
            _ = elements.deinitialize(count: count.pointee)   // clean up the elements we created
        }
    }
}

let storage = IntStorage.make(capacity: 8)
storage.append(10)
storage.append(20)
print(storage.element(at: 1))   // 20
```

This is the storage behind **copy-on-write** (10.11): `Array`'s buffer keeps its `count` and `capacity` in the header, and the elements in the tail. Wrap a `ManagedBuffer` in a struct, check `isKnownUniquelyReferenced`, and you have your own COW collection.

Writing your own is **rare, expert-level** work, for custom high-performance collections only.

---

## 15.7 Memory Rebinding and Layout Rules 🔴

**Rebinding** memory tells the compiler: "treat this memory, which holds type A, as type B for a while". It's inherently **unsafe**: Swift normally assumes memory holds exactly the type it was created for.

```swift
let rawPointer = UnsafeMutableRawPointer.allocate(byteCount: 4, alignment: 4)
defer { rawPointer.deallocate() }

rawPointer.storeBytes(of: Int32(42), as: Int32.self)

// rebind the same memory temporarily, to reinterpret its bytes as a different type
rawPointer.withMemoryRebound(to: UInt8.self, capacity: 4) { bytes in
    print(bytes[0], bytes[1], bytes[2], bytes[3])   // the raw bytes making up the Int32(42)
}
// prints "42 0 0 0" on little-endian devices
```

The rules are **strict**. The types must have **compatible size, stride, and alignment** for the memory you touch. Break them, and you get **undefined behavior**: code that seems to work on one device or compiler version, and silently breaks on another.

**Often there's a safer way.** To read a value out of raw bytes, use `load` instead of rebinding:

```swift
let bytes: [UInt8] = [0x2A, 0, 0, 0]
let value = bytes.withUnsafeBytes { raw in
    raw.loadUnaligned(as: Int32.self)        // reads 4 bytes as an Int32, no rebinding
}
print(value)   // 42
```

| Need | Prefer |
|---|---|
| Read a number out of bytes | `load` / `loadUnaligned` |
| Read typed values from a `Data` or `[UInt8]` | `withUnsafeBytes` + `load` |
| A C API needs `T*` but you have bytes | `withMemoryRebound`, carefully |

Rebinding is **expert territory**: low-level data structures and C interop shims.

---

## 15.8 C Interop: Calling C Functions from Swift 🟡

Swift talks to **C** almost seamlessly. Import a C header (a **bridging header** in an app, or a **module map** in a package), and C functions, structs, and types become **directly callable** from Swift:

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

How C types appear in Swift:

| C | Swift |
|---|---|
| `int`, `double` | `Int32`, `Double` (also `CInt`, `CDouble`) |
| `const char *` | `UnsafePointer<CChar>` (you can pass a `String` directly) |
| `int *` | `UnsafeMutablePointer<Int32>` |
| `struct Point { int x; int y; }` | `struct Point { var x: Int32; var y: Int32 }` |
| Function pointer | `@convention(c)` closure |

Passing Swift data **into** C:

```swift
// C: void process(const uint8_t *bytes, size_t count);
let payload: [UInt8] = [1, 2, 3]
payload.withUnsafeBufferPointer { buffer in
    process(buffer.baseAddress, buffer.count)
}

// C: int strlen(const char *s);
let length = "hello".withCString { strlen($0) }   // 5
```

Swift structs and functions from C **libraries** (like `sqlite3`, `zlib`, or system APIs) work the same way. This is how Swift sits on top of decades of C code **without** an Objective-C wrapper.

A bridging header in an app target is just a file listing C headers:

```c
// MyApp-Bridging-Header.h
#include "fast_math.h"
```

---

## 15.9 C++ Interoperability Mode 🔴

Swift can also work **directly with C++**, in both directions: C++ types from Swift, and Swift types from C++. It's **more complex** than C interop, because C++ has templates, references, destructors, and inheritance, which don't map 1:1 to Swift.

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

Turn it on **per target**. In a Swift package:

```swift
.target(
    name: "Engine",
    dependencies: ["CppCore"],
    swiftSettings: [.interoperabilityMode(.Cxx)]
)
```

In an Xcode project, set **C++ and Objective-C Interoperability** to **C++ / Objective-C++** in the target's build settings.

Some C++ standard types become usable in Swift:

```swift
import CxxStdlib

let cppString = std.string("hello")
let swiftString = String(cppString)        // convert std::string to String
```

**Where it helps:** adopting Swift **gradually** inside a big existing C++ codebase (common in games and cross-platform libraries), without a full rewrite. It's still evolving, so check the current documentation for what's supported.

---

## 15.10 Objective-C Bridging Cost 🟡

Many Foundation and UIKit APIs still come from **Objective-C**. Swift types like `String`, `Array`, and `Dictionary` **bridge** to `NSString`, `NSArray`, and `NSDictionary` automatically. It **looks** free, but it isn't always: sometimes Swift must **convert** the data.

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

**`String` ↔ `NSString`** can cost more than you'd expect. Swift's `String` stores UTF-8; `NSString` works in UTF-16. Some operations make the bridge **convert or copy**.

A common hidden case is using `NSString` APIs on a Swift `String` in a loop:

```swift
// Each `as NSString` may bridge; in a hot loop this adds up
for line in lines {
    let ext = (line as NSString).pathExtension
    // ...
}

// Better: stay in Swift types
for line in lines {
    let ext = URL(filePath: line).pathExtension
    // ...
}
```

**In normal app code, this cost is invisible and doesn't matter.** It becomes real in **tight loops** that cross the Swift/Objective-C boundary many times with big strings or collections. If Instruments (section 69) shows bridging in a hot path, keep the data in **Swift types** on one side of the boundary.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `UnsafePointer` family | Direct memory access: typed or raw, read-only or mutable, no safety net |
| `withUnsafeBufferPointer` | The pointer is valid only inside the closure; safe by convention |
| `Span`/`RawSpan` | Bounds-checked, non-owning views the compiler won't let escape |
| `InlineArray` | Fixed size in the type; stored inline, no heap allocation |
| `ContiguousArray` vs `Array` | Same for value types; matters only for class elements and bridging |
| `ManagedBuffer` | One heap block: header plus elements; the basis of `Array`'s storage |
| Memory rebinding | Reinterpret memory as another type; strict rules; prefer `load` |
| C interop | C headers import directly; pointers become `Unsafe…Pointer` |
| C++ interop | Per-target mode; more complex; good for gradual adoption |
| Objective-C bridging cost | Usually invisible; can matter in hot loops with big data |
