**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 13.1 What Macros Are and Why They Replaced Codegen 🟢

A **macro** is code that runs **at compile time**. It looks at your Swift code and **generates more Swift code**, as part of the normal build.

Macros came in Swift 5.9. Before them, teams often used **external scripts** (Python, or tools like Sourcery, section 75.7) that scanned the source and wrote extra `.swift` files **before** the real build.

You already use macros:

```swift
@Observable
class UserSettings {
    var username: String = ""
    var isDarkMode: Bool = false
}
```

`@Observable` is a macro. At compile time it writes all the **observation code** (storage, change tracking) that you'd otherwise write by hand.

| | External codegen script | Macro |
|---|---|---|
| Runs | In a separate build step | Inside the normal compiler |
| Output checked by the compiler | Only after it's generated | Yes, as real Swift |
| Xcode support | Weak | Autocomplete, errors, **Expand Macro** |
| Gets out of sync | Easily | Never; it runs every build |

Other macros you may know:

```swift
#Preview { ContentView() }               // SwiftUI previews
@Model class Recipe { var title = "" }   // SwiftData (section 41)
#expect(total == 42)                     // Swift Testing (section 65)
```

---

## 13.2 Freestanding Expression Macros `#macro` 🟢

A **freestanding** macro is used with a **`#`** prefix, on its own (not attached to a declaration). It expands **right where you write it**.

```swift
let value = #stringify(1 + 2)
print(value.0)   // 3   (the computed result)
print(value.1)   // "1 + 2"   (the original source text, captured automatically)
```

`#stringify` (from Apple's macro example package) gives you **both** the result **and** the original **source text**. A normal function **can't** do that: it only receives the already-computed `3`, never the text `"1 + 2"`.

That's why Swift Testing's `#expect` is a macro. When a test fails, it can show you the **whole expression** and the values inside it:

```swift
let price = 10
let quantity = 3
#expect(price * quantity == 40)
// Expectation failed: (price * quantity → 30) == 40
```

Freestanding macros come in two kinds:

| Kind | Expands into | Example |
|---|---|---|
| Expression | A value | `#stringify(x)`, `#expect(...)` |
| Declaration | New declarations | `#Preview { ... }` |

---

## 13.3 Attached Member Macros 🟡

An **attached** macro is written with **`@`** on a declaration (a type, property, or function). A **member macro** adds **new members** (properties, methods, initializers) **inside** the type it's attached to.

A typical example: an enum macro that adds an `isX` property for each case:

```swift
@CaseChecks
enum LoadState {
    case idle
    case loading
    case failed(Error)
}

// after macro expansion, roughly:
enum LoadState {
    case idle
    case loading
    case failed(Error)

    var isIdle: Bool { if case .idle = self { true } else { false } }
    var isLoading: Bool { if case .loading = self { true } else { false } }
    var isFailed: Bool { if case .failed = self { true } else { false } }
}

let state = LoadState.loading
state.isLoading   // true
```

Without the macro, you'd write (and keep updating) one property per case by hand. Add a case, and the macro adds its property automatically.

The member macro **can read** the type it's attached to (here, the list of cases), and generate code **from** it. That is something a protocol extension can't do.

Other real member macros: `@Observable` adds its tracking storage this way, and libraries offer things like a public memberwise `init` for public structs.

---

## 13.4 Attached Peer and Accessor Macros 🔴

A **peer macro** adds new declarations **next to** the one it's attached to, at the same level. For example, it can add a completion-handler version of an `async` function:

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

You write only the **modern** `async` version. The macro writes the **older** callback version, for callers that still need it.

An **accessor macro** adds `get`/`set` (or `willSet`/`didSet`) to an existing **stored property**:

```swift
@Clamped(0...100)
var volume: Int = 150

// after accessor-macro expansion, roughly:
var volume: Int = 150 {
    get { min(max(_volume, 0), 100) }
    set { _volume = min(max(newValue, 0), 100) }
}
```

(An accessor macro can't create storage itself. In practice it's paired with a **peer** macro that adds the hidden `_volume` property. `@Observable` uses exactly this combination on each property.)

This does the same job as the `@Clamped` **property wrapper** in 12.5, but **without** a separate wrapper struct.

| | Property wrapper | Accessor macro |
|---|---|---|
| How | A reusable generic struct | Code generated by a compiler plugin |
| Extra indirection | Yes (`_volume` is a wrapper) | No (plain code on the property) |
| Effort to write | Low | High (SwiftSyntax, 13.6) |

---

## 13.5 Attached Extension and Conformance Macros 🟡

An **extension macro** generates a whole **`extension`** for the type it's attached to. It's most often used to add a **protocol conformance** with the code needed to satisfy it.

`@Observable` uses this. It adds an extension that makes your class conform to `Observable`:

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

One `@Observable` actually uses **several** macro roles at once:

```plaintext
@Observable
  ├─ member macro          → adds the observation registrar storage
  ├─ member-attribute macro → puts @ObservationTracked on each stored property
  │     └─ accessor + peer  → each property gets tracking get/set and hidden storage
  └─ extension macro       → adds `extension UserSettings: Observable {}`
```

That's why **one word** is enough for SwiftUI to track your class:

```swift
struct SettingsView: View {
    @Bindable var settings: UserSettings

    var body: some View {
        TextField("Name", text: $settings.username)   // works thanks to the generated code
    }
}
```

SwiftData's **`@Model`** (section 41.1) works the same way: members, accessors, and conformances, all generated.

---

## 13.6 SwiftSyntax Basics: Nodes and Trivia 🔴

Macros are written with **SwiftSyntax**, Apple's library that turns Swift source code into a **tree**. Every part of your code (a function, an expression, even spaces and comments) becomes a typed **node** that a macro can read and create.

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

**Trivia** means the parts of code with **no meaning** for the compiler: spaces, line breaks, and comments. SwiftSyntax keeps them **attached to nodes**, so generated code can keep sensible formatting.

```plaintext
"  let x = 1 // count"
   ^^                    leading trivia of `let`: two spaces
              ^^^^^^^^   trailing trivia of `1`: a space and a comment
```

Reading an enum's cases in a macro looks like this:

```swift
import SwiftSyntax

func caseNames(in enumDecl: EnumDeclSyntax) -> [String] {
    enumDecl.memberBlock.members
        .compactMap { $0.decl.as(EnumCaseDeclSyntax.self) }   // only `case` lines
        .flatMap { $0.elements }                               // `case a, b` has two
        .map { $0.name.text }                                  // "idle", "loading", ...
}
```

**The key mental model:** a macro works on a **structured tree**, not on raw text. It's not a "fancy text template". That's why macro output is real, checked Swift code.

You can explore any code's tree at **swift-ast-explorer.com**: paste code, and see its nodes.

---

## 13.7 Writing Your First Macro Package 🔴

A macro has **two halves**, in separate targets:

- The **declaration**: what users import and call. It's marked `@freestanding` or `@attached`.
- The **implementation**: a **compiler plugin** with the SwiftSyntax code. It runs **only during the build**, and **never ships** inside the app.

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

`expansion(of:in:)` receives the **macro call as a syntax node**, and **returns new syntax**. The string literal is turned into `ExprSyntax` for you.

Create the package from Xcode (**File → New → Package → Swift Macro**), or the terminal:

```bash
swift package init --type macro --name MyMacros
```

```plaintext
MyMacros/
├── Package.swift
├── Sources/
│   ├── MyMacros/            ← declarations (users import this)
│   ├── MyMacrosMacros/      ← implementation (compiler plugin, uses SwiftSyntax)
│   └── MyMacrosClient/      ← a small example that uses the macro
└── Tests/
    └── MyMacrosTests/       ← assertMacroExpansion tests (13.8)
```

**Why the split?** The implementation needs the large SwiftSyntax library and runs inside the compiler. Your **app** only needs the small declaration, so it doesn't depend on SwiftSyntax at runtime.

Report problems as **real compiler errors**, instead of crashing:

```swift
guard let enumDecl = declaration.as(EnumDeclSyntax.self) else {
    throw MacroError("@CaseChecks can only be applied to an enum")   // MacroError: your own small Error type
    // shows up in Xcode as a normal red error on the @CaseChecks line
}
```

The first time you use a third-party macro package, Xcode asks you to **Trust & Enable** it, because its plugin runs code on your machine during the build.

---

## 13.8 Testing Macros with `assertMacroExpansion` 🟡

SwiftSyntax includes **`assertMacroExpansion`**. It checks that your macro turns a given **input** into **exactly** the expected **output** source:

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

You can also test that **misuse** gives the right **error**:

```swift
func testCaseChecksRejectsStructs() {
    assertMacroExpansion(
        """
        @CaseChecks
        struct NotAnEnum {}
        """,
        expandedSource: """
        struct NotAnEnum {}
        """,
        diagnostics: [
            DiagnosticSpec(message: "@CaseChecks can only be applied to an enum", line: 1, column: 1)
        ],
        macros: ["CaseChecks": CaseChecksMacro.self]
    )
}
```

These are normal unit tests (XCTest, or Swift Testing from section 65). They catch **regressions** in your macro's output, just like tests for any other code. Test edge cases: empty input, odd formatting, wrong declaration kinds.

---

## 13.9 Expanding Macros in Xcode to Debug Them 🟢

Xcode can **show** exactly what a macro generates in **your** code. **Right-click** the macro and choose **Expand Macro**. The generated code appears **inline**, under the macro:

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

This is the **everyday** way to debug macros. Instead of reading the macro's implementation and guessing, you see the **real output** for your case.

It helps most with **confusing errors**. For example:

```swift
@Observable
class Profile {
    var _name = ""        // ❌ error: invalid redeclaration of '_name'
    var name = ""
}
```

The error points into generated code. **Expand Macro** shows that `@Observable` itself creates a hidden `_name` for the `name` property, so your own `_name` clashes with it. Rename yours, and the error is gone.

You can also expand macros from the terminal, when building a package:

```bash
swift build -Xswiftc -Xfrontend -Xswiftc -dump-macro-expansions
```

---

## 13.10 Macro Build-Time Cost and When to Avoid Them 🟡

Macros are **not free**:

- Each macro runs as a **compiler plugin** process during the build, for every file that uses it.
- The macro package depends on **SwiftSyntax**, which is a **large** library to compile. (Newer Xcode and SwiftPM versions can use a **prebuilt** SwiftSyntax, which helps a lot.)

In a big codebase with many macros, this can **slow builds** noticeably.

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

| Goal | Simplest tool |
|---|---|
| Shared default behavior for many types | Protocol extension (7.5) |
| Custom get/set logic for one property | Property wrapper (12.5) |
| Read the **source** (case names, property list, expression text) | **Macro** |
| Generate code **from a type's structure** | **Macro** |

**Rule:** try a protocol extension or a property wrapper **first**. Write a custom macro only when you truly need to **read or generate code structure**. And **use** Apple's macros (`@Observable`, `@Model`, `#Preview`, `#expect`) freely: that's what they're for.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| What macros are | Code that writes code at compile time; checked by the compiler; replaces codegen scripts |
| Freestanding macros (`#macro`) | Expand where written; can see the source text, like `#stringify` and `#expect` |
| Member macros | Add members inside a type, based on its structure |
| Peer/accessor macros | Peers add sibling declarations; accessors add get/set to a property |
| Extension/conformance macros | Add an extension, often a protocol conformance, like `@Observable` |
| SwiftSyntax | Source code as a tree of nodes, plus trivia; not text templates |
| Macro packages | A small declaration target plus a compiler-plugin implementation |
| Testing macros | `assertMacroExpansion` checks the exact output and the errors |
| Debugging macros | Right-click → Expand Macro shows the generated code |
| Build-time cost | Plugins and SwiftSyntax slow builds; prefer simpler tools when they work |
