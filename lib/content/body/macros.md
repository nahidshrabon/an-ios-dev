## 13.1 What Macros Are and Why They Replaced Codegen

A macro is code that runs **at compile time**, inspecting and generating Swift source code as part of the build itself — introduced in Swift 5.9 to replace a common older pattern: external scripts (often Python or a tool like Sourcery, covered in section 75.7) that scanned your source files and generated additional `.swift` files before the real build started.

```swift
@Observable
class UserSettings {
    var username: String = ""
    var isDarkMode: Bool = false
}
```

That `@Observable` annotation is a macro — at compile time, it expands to generate all the observation-tracking boilerplate (storage, change notification plumbing) that would otherwise need to be hand-written or produced by an external code generator. The key advantage over external codegen scripts: macros run *inside* the normal Swift compilation pipeline, are type-checked as real Swift code, show up correctly in Xcode's autocomplete and "Expand Macro" inspector, and don't require a separate build phase or external tool to keep in sync.

---

## 13.2 Freestanding Expression Macros `#macro`

A **freestanding** macro is invoked directly in code with a `#` prefix, standing on its own (not attached to a declaration) — it expands into an expression or a series of statements at that exact call site.

```swift
let value = #stringify(1 + 2)
print(value.0)   // 3   (the computed result)
print(value.1)   // "1 + 2"   (the original source text, captured automatically)
```

`#stringify` (a real example macro from Apple's own macro sample package) expands at compile time into code that evaluates the expression *and* captures its literal source text as a string — something no ordinary function could do, since a function only ever sees the already-evaluated `3`, never the original `"1 + 2"` source text that produced it. Other common freestanding macros include `#warning`/`#error`-style diagnostics and `#Preview` (used constantly in SwiftUI development, covered in section 23.14).

---

## 13.3 Attached Member Macros

An **attached** macro is applied to an existing declaration (a type, property, or function) using `@` syntax, and a **member macro** specifically adds new members (properties, methods) to the type it's attached to:

```swift
@AddCompletionHandler
func fetchUser(id: Int) async -> String {
    "User \(id)"
}

// after macro expansion, roughly:
func fetchUser(id: Int) async -> String {
    "User \(id)"
}
func fetchUser(id: Int, completion: @escaping (String) -> Void) {
    Task {
        let result = await fetchUser(id: id)
        completion(result)
    }
}
```

A member macro like this can generate an entire additional function (here, a completion-handler-based bridging function for a modern `async` function) alongside the original, letting you write only the modern version by hand while the macro produces the legacy-compatible overload automatically — a genuinely common real need when a library must support both async/await callers and older completion-handler-based callers.

---

## 13.4 Attached Peer and Accessor Macros

A **peer macro** adds new declarations *alongside* the one it's attached to (similar to a member macro, but for declarations outside a type body — like a standalone function generating a companion function next to it). An **accessor macro** adds `get`/`set`/`willSet`/`didSet` logic to an existing stored property, without changing its declared type or requiring a separate wrapper type:

```swift
@Clamped(0...100)
var volume: Int = 150

// after accessor-macro expansion, roughly:
var volume: Int = 150 {
    get { min(max(_volume, 0), 100) }
    set { _volume = min(max(newValue, 0), 100) }
}
```

Notice this achieves conceptually the same clamping behavior as the `@Clamped` property wrapper from section 12.5 — but as an accessor macro, it can generate accessor logic directly on the *original* property, without introducing an actual separate wrapper struct and its associated indirection. Macros and property wrappers often solve overlapping problems; macros tend to produce more direct, less indirect generated code, at the cost of needing an actual macro implementation (Swift code, via SwiftSyntax) rather than a reusable generic struct.

---

## 13.5 Attached Extension and Conformance Macros

An **extension macro** generates an entire `extension` block for the type it's attached to — commonly used to add protocol conformances (a **conformance macro** is a specific case of this) that require generated implementation code, exactly like `@Observable` generating the machinery needed for a type to work with SwiftUI's observation system:

```swift
@Observable
class UserSettings {
    var username: String = ""
}

// after expansion, roughly (heavily simplified):
class UserSettings: Observable {
    @ObservationTracked
    var username: String = ""
    // plus generated storage/tracking machinery inside an extension
}
```

Extension macros are what let `@Observable` (and similarly, `@Model` for SwiftData in section 41.1) add both new members *and* a protocol conformance in one annotation, entirely generated at compile time — this is precisely why applying `@Observable` to a class is enough to make it work seamlessly with SwiftUI's `@Bindable` and automatic view-update tracking, without you writing any of that plumbing by hand.

---

## 13.6 SwiftSyntax Basics: Nodes and Trivia

Macros are implemented using **SwiftSyntax**, Apple's library for parsing and manipulating Swift source code as a structured tree — every piece of your source code (a function, an expression, even whitespace) becomes a typed **node** in this tree that a macro's implementation code can inspect and transform.

```swift
// Simplified conceptual illustration of what a macro implementation examines:
// For `#stringify(1 + 2)`, SwiftSyntax parses the argument into a tree roughly like:
//
// FunctionCallExprSyntax
//   argument: InfixOperatorExprSyntax
//     leftOperand: IntegerLiteralExprSyntax("1")
//     operator: BinaryOperatorExprSyntax("+")
//     rightOperand: IntegerLiteralExprSyntax("2")
```

**Trivia** refers to the "non-meaningful" parts of source code — whitespace, comments, line breaks — which SwiftSyntax preserves and tracks separately from the meaningful syntax nodes themselves, so a macro can generate output that preserves sensible formatting rather than collapsing everything onto one line. Understanding that macros operate on this structured tree (not on raw text with string manipulation) is the key mental model shift from thinking of macros as "fancy text templates."

---

## 13.7 Writing Your First Macro Package

A macro has two distinct halves that live in separate targets: the **declaration** (what callers actually import and use, marked with `@attached`/`@freestanding`) and the **implementation** (a separate compiler-plugin target containing the actual SwiftSyntax-based expansion logic, which never ships inside the app itself — it only runs during compilation):

```swift
// Declaration (in the main library target, what consumers import):
@freestanding(expression)
public macro stringify<T>(_ value: T) -> (T, String) = #externalMacro(
    module: "MyMacrosImplementation",
    type: "StringifyMacro"
)

// Implementation (in a separate compiler-plugin target):
import SwiftSyntax
import SwiftSyntaxMacros

public struct StringifyMacro: ExpressionMacro {
    public static func expansion(
        of node: some FreestandingMacroExpansionSyntax,
        in context: some MacroExpansionContext
    ) throws -> ExprSyntax {
        guard let argument = node.arguments.first?.expression else {
            fatalError("compiler bug: the macro does not have any arguments")
        }
        return "(\(argument), \(literal: argument.description))"
    }
}
```

This split exists because macro *implementations* need to run as compiler plugins during the build, using the full SwiftSyntax parsing/compiler-plugin infrastructure — but the declaration your app code actually imports and calls is a lightweight, ordinary-looking function/type signature, letting consumers use the macro without needing SwiftSyntax as a dependency of their own app code at all.

---

## 13.8 Testing Macros with `assertMacroExpansion`

SwiftSyntax provides a dedicated testing utility, `assertMacroExpansion`, that lets you verify a macro produces exactly the expected expanded source code, given some input — treating macro expansion as a testable transformation from input source to output source:

```swift
import SwiftSyntaxMacrosTestSupport
import XCTest

final class StringifyMacroTests: XCTestCase {
    func testStringify() {
        assertMacroExpansion(
            """
            #stringify(1 + 2)
            """,
            expandedSource: """
            (1 + 2, "1 + 2")
            """,
            macros: ["stringify": StringifyMacro.self]
        )
    }
}
```

This lets you write ordinary unit tests (using either XCTest, as shown, or Swift Testing's `@Test`, covered in section 65) that pin down exactly what source code your macro should generate for a given input — catching regressions in the macro's expansion logic the same way you'd catch a regression in any other piece of tested code, rather than only discovering an incorrect expansion by manually inspecting generated code later.

---

## 13.9 Expanding Macros in Xcode to Debug Them

Xcode provides a built-in way to *see* exactly what a macro expands to in your actual code, without needing to run a separate test: right-click (or use the contextual menu indicator) on a macro usage in the editor and choose "Expand Macro," which reveals the generated code inline, nested underneath the macro call.

```swift
@Observable
class UserSettings {
    var username: String = ""
}
// Right-clicking "@Observable" above and choosing "Expand Macro" in Xcode
// reveals the actual generated extension, storage, and tracking code inline —
// invaluable for understanding what a third-party or system macro is actually doing,
// or for diagnosing why a macro-generated symbol conflicts with something you wrote.
```

This is the practical, everyday debugging workflow for macros — rather than reading the macro's *implementation* source code to guess at its output, you can directly inspect the actual generated code for your specific usage, which is especially useful when diagnosing a confusing compiler error that originates from macro-expanded code (Xcode's error messages will point at the expansion, which "Expand Macro" lets you inspect directly).

---

## 13.10 Macro Build-Time Cost and When to Avoid Them

Because macros execute as separate compiler-plugin processes during every build, and their SwiftSyntax-based parsing/expansion work isn't free, heavy macro usage across a large codebase can measurably slow down build times — every file using a given macro requires invoking that macro's plugin process and running its (potentially nontrivial) expansion logic during compilation.

```swift
// Consider carefully before reaching for a macro when a simpler alternative exists:
//
// - A protocol extension with a default implementation (section 7.5) is often simpler
//   and has zero build-time cost, if the goal is just providing shared default behavior.
// - A property wrapper (section 12.5-12.7) is often simpler for wrapping a single
//   property's get/set behavior, without needing SwiftSyntax at all.
// - Reach for a genuine macro specifically when you need compile-time source
//   inspection/generation that neither protocols nor property wrappers can achieve —
//   like #stringify capturing literal source text, or @Observable generating an
//   entire tracking implementation across a type's stored properties.
```

The practical guidance: macros are a powerful, precise tool for compile-time code generation, but they're not a free abstraction — reach for a protocol extension or property wrapper first if either would solve the problem just as well, and reserve custom macros for cases genuinely requiring inspection or generation of source structure that those simpler mechanisms can't express, being mindful of the cumulative build-time cost across a large codebase using many macro-annotated declarations.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| What macros are | Compile-time code generation, replacing external codegen scripts, fully type-checked and IDE-integrated |
| Freestanding macros (`#macro`) | Stand alone at a call site, expanding into an expression or statements — e.g. `#stringify` |
| Member macros | Attached to a type, adding new members like generated companion functions |
| Peer/accessor macros | Peer macros add sibling declarations; accessor macros add get/set logic directly to a property |
| Extension/conformance macros | Generate an entire extension, often adding a protocol conformance plus its implementation |
| SwiftSyntax | The structured-tree representation of source code macros inspect and generate — not string templating |
| Macro packages | Split into a lightweight declaration (what consumers import) and a separate compiler-plugin implementation |
| Testing macros | `assertMacroExpansion` verifies exact expected output source for given input source |
| Debugging macros | Xcode's "Expand Macro" reveals the actual generated code inline, for any macro usage |
| Build-time cost | Macros aren't free — prefer protocol extensions or property wrappers when they'd suffice |

**Next up:** [Section 14 — Standard Library Deep Dive](/articles/standard-library-deep-dive).
