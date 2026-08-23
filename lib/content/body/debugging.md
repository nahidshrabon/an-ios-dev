## 68.1 Breakpoints: Line, Conditional, and Symbolic

A line breakpoint pauses execution at a specific source line; a conditional breakpoint only pauses when a specified expression evaluates true, avoiding manually stepping through many irrelevant iterations to reach a specific problematic case; a symbolic breakpoint pauses whenever a named function is called, regardless of where in source that call originates — useful for breaking on system or framework functions without a specific call site in mind.

```swift
// Conditional breakpoint example: right-click a line breakpoint in Xcode,
// add condition: index == 47
for (index, item) in items.enumerated() {
    process(item)  // breakpoint only pauses when index == 47, skipping the other 46 iterations
}
```

Conditional breakpoints are particularly valuable for debugging a bug that only manifests on a specific iteration or specific data value buried within a loop processing many items — rather than manually stepping through (or repeatedly hitting continue on) dozens of irrelevant iterations to reach the one that actually triggers the bug, a condition like `index == 47` or `item.id == "problematic-id"` lets execution pause exactly once, precisely at the iteration that actually matters.

---

## 68.2 Breakpoint Actions and Logging Without Rebuilds

Breakpoint actions (log messages, sound, running a debugger command, executing a shell script) attach behavior to a breakpoint without requiring it to actually stop execution — an "automatically continue" log breakpoint effectively inserts a `print` statement at that line without editing and rebuilding source code, letting a developer add or adjust diagnostic output between debugging runs instantly.

```plaintext
// A breakpoint action configured as: Log Message "Processing item: @item.name@", Automatically continue: checked
// behaves like inserting print("Processing item: \(item.name)") at that line,
// but requires no source edit or rebuild — just adjusting the breakpoint's configuration
```

This capability is genuinely valuable specifically because it decouples adding diagnostic output from the edit-compile-run cycle — for a slow-building project, needing to add a `print` statement, rebuild, observe output, then remove the `print` and rebuild again is meaningfully more time-consuming than simply configuring a log breakpoint's message and toggling it on or off, particularly useful for exploratory debugging sessions where the exact diagnostic information needed isn't known upfront.

---

## 68.3 The Variables View and Stepping Controls

Xcode's variables view (visible when execution is paused at a breakpoint) shows the current scope's local variables and their values, while stepping controls (step over, step into, step out) let a developer advance execution one statement at a time, choosing whether to enter a called function's own implementation or treat it as a single opaque step.

```swift
// At a paused breakpoint, the variables view shows current local state, e.g.:
// items: [Item] (3 elements)
// index: 1
// currentItem: Item { name: "Widget", price: 9.99 }
```

Choosing correctly between "step over" (execute the current line's function call without entering it) and "step into" (descend into the called function's own implementation) is a genuinely practical skill — stepping into every single function call while debugging, including trivial standard library calls or functions already known to be correct, wastes significant time navigating through irrelevant code, while judiciously stepping over well-understood code and stepping into only the specific function actually suspected of containing the bug keeps a debugging session efficiently focused.

---

## 68.4 LLDB po, p, and v Compared

LLDB's three primary value-inspection commands serve related but distinct purposes: `po` ("print object") evaluates an expression and calls its `description`/`debugDescription`, `p` ("print") evaluates an expression and prints its raw value using LLDB's type formatters, and `v` ("variable") looks up a variable by name directly without full expression evaluation, making it meaningfully faster.

```plaintext
(lldb) po user
User(name: "Ada", age: 30)
(lldb) p user.age
(Int) $0 = 30
(lldb) v user
(User) user = (name = "Ada", age = 30)
```

The performance distinction between `v` and `p`/`po` matters in practice — `v` looks up a known variable directly from the current frame without going through LLDB's full expression evaluator, making it noticeably faster for simple variable inspection, while `p` and `po` invoke the complete expression evaluation machinery (necessary for evaluating actual expressions like `user.age` or calling methods, but genuine overhead for the simple case of "just show me this variable's current value").

---

## 68.5 expression for Changing State at Runtime

LLDB's `expression` command (often abbreviated `e` or invoked implicitly by typing an assignment directly) doesn't just inspect state — it can genuinely execute arbitrary code within the paused process's context, including reassigning variables, calling methods, or triggering side effects, letting a developer test a hypothesis or work around a bug interactively without restarting the app.

```plaintext
(lldb) expression user.age = 31
(lldb) po user.age
31
(lldb) expression viewModel.reload()
```

This runtime state manipulation capability is genuinely powerful for hypothesis testing during a debugging session — rather than editing source code, rebuilding, and re-running to test "what happens if this value were different at this point," `expression` lets a developer directly modify a variable's value or trigger a method call in the currently paused, live process, immediately observing the actual effect without the overhead of a full edit-compile-run cycle.

---

## 68.6 Stepping Through Async Code in LLDB 🟠

Debugging `async` code introduces genuine complexity beyond synchronous stepping — because an `await` point can suspend execution and potentially resume on a different thread, naive step-based debugging can behave unexpectedly, and LLDB's async-aware stepping (along with `swift concurrency` LLDB commands) helps navigate suspension points more coherently than raw thread-level stepping would.

```plaintext
(lldb) thread step-in
# stepping through an async function may cross a suspension point;
# LLDB's Swift concurrency support helps present this coherently
# rather than as a confusing jump to a seemingly unrelated thread
```

This complexity is a direct consequence of structured concurrency's execution model (recall Part 2) — an `async` function's execution isn't guaranteed to stay on one OS thread across an `await` suspension point, meaning naive thread-based stepping (which assumes sequential, single-thread execution) can produce a genuinely confusing debugging experience without LLDB's specific async-aware support helping present the logical flow of an async function coherently despite its potential thread-hopping.

---

## 68.7 Task Backtraces and Concurrency Debugging 🟠

Beyond stepping through a single async function, LLDB (and Xcode's debug navigator) can show task backtraces — the chain of `Task` creation and structured concurrency parent/child relationships (recall `TaskGroup` and task trees from Part 2) — helping understand which task a given piece of suspended code actually belongs to and what spawned it.

```plaintext
(lldb) swift concurrency task backtrace <task-id>
# Shows the task's creation point and its position within the broader
# structured concurrency task tree, not just its own current suspension point
```

Task backtraces address a genuine debugging need specific to structured concurrency — a deadlock or unexpected behavior involving several concurrently running, hierarchically related tasks (a parent task and several child tasks in a `TaskGroup`) is considerably harder to diagnose from a single task's isolated stack trace alone, and understanding the full task hierarchy (which task spawned which, and where) is often essential to actually understanding a concurrency bug's root cause rather than just its symptom.

---

## 68.8 Reading a Crash: Index Out of Range

An "index out of range" crash (typically `Fatal error: Index out of range`) occurs when array (or other collection) subscript access uses an index outside the collection's valid bounds — the crash report/console output identifies the specific line, and the fix requires validating the index (or using a safer access pattern) before subscripting.

```swift
let items = ["a", "b", "c"]
let item = items[5]  // crashes: Fatal error: Index out of range

// Safer pattern: validate bounds, or use a safe subscript extension
if items.indices.contains(5) {
    let item = items[5]
}
```

This crash class is a direct, practical consequence of Swift's deliberate design choice to trap on invalid array access rather than silently returning an undefined or garbage value (a design differing from some other languages) — while this crash is disruptive when it occurs, it reflects Swift's broader safety philosophy of failing loudly and immediately at the actual point of an invalid operation, rather than allowing a memory-safety violation to silently corrupt program state and manifest as a much more confusing bug somewhere else entirely, later.

---

## 68.9 Reading a Crash: Force-Unwrapped Nil

A force-unwrap crash (`Fatal error: Unexpectedly found nil while unwrapping an Optional value`) occurs when the `!` operator is applied to an `Optional` that's actually `nil` at that point — the crash report identifies the exact force-unwrap site, and the fix typically involves using `if let`/`guard let` or `#require` (recall section 65.3's testing use of `#require`) instead of an unconditional force-unwrap.

```swift
let user: User? = fetchUser(id: "unknown")
print(user!.name)  // crashes if fetchUser returned nil

// Safer: handle the nil case explicitly
guard let user else {
    print("User not found")
    return
}
print(user.name)
```

Force-unwrap crashes are frequently the single most common crash type in a codebase that uses `!` liberally, and diagnosing one is usually a matter of examining what could have caused the specific optional at that exact line to actually be `nil` — was an assumption about a value always being present after some prior check actually incorrect, or was there a code path (an error case, a genuinely absent value) that the force-unwrap simply didn't account for at all.

---

## 68.10 Reading a Crash: EXC_BAD_ACCESS

`EXC_BAD_ACCESS` indicates memory access to invalid or deallocated memory — a considerably harder crash to diagnose than the previous two, since the crash's actual symptom (accessing bad memory) often occurs at a point in code far removed from the actual root cause (an object being deallocated prematurely, or corrupted memory from an earlier unsafe operation).

```swift
// A common cause: accessing an object through a dangling unowned reference
// after the referenced object has already been deallocated
class Parent {
    unowned let child: Child  // if child is deallocated while parent still exists, EXC_BAD_ACCESS on access
}
```

Because `EXC_BAD_ACCESS` frequently reflects a use-after-free or dangling-reference bug rather than an error localized to the crashing line itself, diagnosing it often requires tools beyond simply reading the crash's immediate stack trace — the Memory Graph Debugger (68.13) and Address Sanitizer (68.16) specifically exist to help surface the actual root cause of this crash class, since the crash location and the actual bug's location are frequently two genuinely different places in the code.

---

## 68.11 Watchdog Terminations and Their Codes 🟠

Watchdog terminations occur when the system forcibly kills an app for taking too long during a specific lifecycle phase (launch, resume, background task completion) — distinct exit codes (like `0x8badf00d`, informally read as "ate bad food") identify which specific watchdog timeout was exceeded, pointing toward the general category of the underlying performance problem.

```swift
// 0x8badf00d specifically indicates a watchdog timeout — the app took too long
// during a lifecycle transition (e.g., blocking the main thread during launch
// or backgrounding), and the system terminated it for being unresponsive
```

Recognizing these specific termination codes is a genuinely practical diagnostic skill, since a watchdog termination's crash report looks meaningfully different from a typical crash (there's no specific crashing line of code — the app was simply too slow) — understanding that `0x8badf00d` points toward a lifecycle-phase performance problem (recall app launch time discussion in section 69.8-69.9) directs debugging effort toward profiling that specific lifecycle phase's performance rather than searching for a conventional logic bug.

---

## 68.12 The View Hierarchy Debugger

Xcode's View Hierarchy Debugger captures a running app's actual current view hierarchy as an interactive, inspectable 3D visualization — letting a developer see the real layered structure of views on screen, inspect individual views' actual frame/constraint/property values, and diagnose layout issues that are difficult to understand purely from reading source code.

```swift
// Not a Swift API — accessed via Xcode's "Debug View Hierarchy" button
// while the app is running and paused, revealing the actual runtime
// layer structure of visible (and hidden/overlapping) views
```

This tool is particularly valuable for diagnosing exactly the kind of subtle layout bug that's genuinely hard to spot purely by reading Auto Layout constraint code (recall section 36) — an unexpectedly hidden view sitting behind another, a view with an unexpectedly zero-sized frame, or an unintended overlap only becomes obvious once actually visualized in the View Hierarchy Debugger's interactive 3D view, which reveals the *actual* runtime layout rather than requiring a developer to mentally simulate what a set of constraints should theoretically produce.

---

## 68.13 The Memory Graph Debugger

The Memory Graph Debugger visualizes an app's actual live object graph at a given moment — every currently allocated object and the reference relationships connecting them — surfacing objects that remain unexpectedly alive (suggesting a retain cycle or leak, recall ARC concepts from section 10) directly as a visual graph rather than requiring inference from indirect symptoms.

```swift
// Accessed via Xcode's Memory Graph button (the small graph icon) during a debug session;
// Xcode specifically flags objects it suspects are involved in a retain cycle
// with a purple exclamation mark warning icon
```

Xcode's automatic flagging of suspected retain cycles (the purple warning icon) is a genuinely significant time-saver over manually reasoning through an object graph's reference relationships — rather than needing to trace through code by hand looking for a strong reference cycle (exactly the kind of bug discussed for AI-generated closures in section 61.11), the Memory Graph Debugger can directly point to the specific objects involved, considerably narrowing the search for the actual strong reference that's incorrectly keeping a cycle of objects alive.

---

## 68.14 Finding Retain Cycles in the Memory Graph

Building on 68.13, actually diagnosing a specific retain cycle in the Memory Graph Debugger involves selecting a flagged object and examining its "Object Reference" panel, which lists exactly what's holding a strong reference to it — tracing that chain of strong references back typically reveals the specific cycle (often a closure capturing `self` strongly, recall section 61.11, or two objects each holding a strong reference to the other).

```swift
// Common retain cycle pattern the Memory Graph Debugger would surface:
class ViewModel {
    var onUpdate: (() -> Void)?
}
class ViewController {
    let viewModel = ViewModel()
    func setup() {
        viewModel.onUpdate = { self.refreshUI() }  // strong capture of self — cycle
    }
}
```

The specific diagnostic workflow — select a suspiciously-still-alive object, inspect what's holding a strong reference to it, and trace that chain back to its actual source — is a genuinely systematic, repeatable approach to retain cycle diagnosis, considerably more reliable than attempting to spot a cycle purely by reading source code, especially in a codebase where the cycle spans several files or involves a somewhat indirect chain of ownership that isn't obvious from any single file's code alone.

---

## 68.15 Zombie Objects

Enabling "Zombie Objects" (a diagnostic scheme setting) replaces a deallocated object's memory with a special "zombie" marker instead of genuinely freeing it, causing any subsequent message sent to that deallocated object to produce a clear, immediate crash with a descriptive error rather than silently corrupting memory or crashing mysteriously somewhere unrelated later.

```plaintext
# With Zombie Objects enabled, accessing a deallocated object produces:
# *** -[ViewModel refreshUI]: message sent to deallocated instance 0x600002a1b2c0
# — a clear, actionable error identifying exactly which deallocated object was accessed
```

This diagnostic setting directly addresses the difficulty described for `EXC_BAD_ACCESS` (68.10) — because a use-after-free bug's actual crash location is often disconnected from its root cause, Zombie Objects trades some runtime performance (deallocated objects aren't actually freed, so memory usage grows during a debug session) for a dramatically clearer, more immediately actionable error message identifying precisely which already-deallocated object was accessed and how, turning a confusing `EXC_BAD_ACCESS` into a specific, readable diagnostic.

---

## 68.16 Address Sanitizer

Address Sanitizer (ASan) instruments a debug build to detect memory errors — buffer overflows, use-after-free, use of uninitialized memory — at the exact moment they occur, providing a detailed report including the specific memory error type and both the current and the original allocation's stack traces.

```swift
// Enabled via the scheme's Diagnostics tab: "Address Sanitizer"
// ASan catches errors like buffer overflows or use-after-free the instant
// they occur, rather than allowing them to silently corrupt memory
// and potentially crash somewhere unrelated much later
```

ASan's core value is catching memory errors at their actual point of occurrence rather than allowing them to silently corrupt memory that might not visibly manifest as a crash until some later, unrelated point in execution — this "catch it immediately, with full context" approach is meaningfully more diagnostically useful than debugging a crash whose stack trace reflects only where a corrupted memory access finally, visibly failed, rather than where the actual corruption first occurred.

---

## 68.17 Thread Sanitizer

Thread Sanitizer (TSan) instruments a debug build specifically to detect data races — concurrent, unsynchronized access to the same memory from multiple threads, at least one of which is a write — directly complementing Swift's compile-time concurrency checking (recall Part 2, and the concurrency review concerns raised for AI-generated code in section 61.10) by catching races that occur at runtime, including ones the compiler's static checking might not catch.

```swift
// Enabled via the scheme's Diagnostics tab: "Thread Sanitizer"
// TSan detects genuine data races at runtime, providing both threads'
// stack traces at the moment of the conflicting, unsynchronized access
```

TSan is a genuinely important complement to Swift's compile-time strict concurrency checking, not a redundant tool — certain data races can still occur despite the compiler's static analysis (particularly around `@unchecked Sendable` usage, or interop with non-Swift, non-checked code), and TSan catches these at actual runtime by observing genuine concurrent memory access patterns, providing a dynamic safety net for exactly the class of bug that compile-time checking, however sophisticated, cannot guarantee to catch in every case.

---

## 68.18 Main Thread Checker

The Main Thread Checker automatically detects and reports UI API calls made from a background thread — a common and often subtle bug, since UIKit and AppKit APIs are generally required to be used only from the main thread, and violating this requirement can produce anything from a silent visual glitch to an outright crash, depending on the specific API misused.

```plaintext
# Main Thread Checker output example:
# "UIApplication.shared.keyWindow" must be used from main thread only
# — reported immediately, with a stack trace showing exactly where the
# background-thread UI access occurred
```

This checker addresses a genuinely common category of bug arising directly from the async/concurrency patterns covered throughout Part 2 — a background `Task` or completion handler that inadvertently updates UI state without first hopping back to the main actor (recall `@MainActor`, section 19) is an easy mistake to make, and the Main Thread Checker catches it immediately and specifically, rather than leaving a developer to debug an intermittent, hard-to-reproduce visual glitch or crash whose actual root cause (a background-thread UI update) might otherwise not be obvious at all.

---

## 68.19 Logger and os_log with Privacy Annotations

`Logger` (the modern Swift wrapper around `os_log`) provides structured, performant logging with built-in privacy annotation — string interpolations are redacted (`<private>`) by default in released logs unless explicitly marked `.public`, protecting potentially sensitive user data from ending up in logs collected from real devices.

```swift
import os

let logger = Logger(subsystem: "com.example.app", category: "networking")

func logRequest(url: URL, userID: String) {
    logger.info("Fetching \(url, privacy: .public) for user \(userID, privacy: .private)")
    // in a collected log, this renders as:
    // "Fetching https://api.example.com/data for user <private>"
}
```

This privacy-by-default design reflects a deliberate, meaningful choice — unlike a plain `print` statement (which has no concept of privacy and would include everything verbatim in any captured log), `Logger`'s default redaction of interpolated values means a developer must explicitly opt in to exposing specific values (like a URL, generally safe) while genuinely sensitive data (like a user identifier or personal content) remains redacted by default, protecting user privacy even in diagnostic logs collected from real users' devices without requiring careful, error-prone manual redaction at every individual log call site.

---

## 68.20 Log Levels and Subsystems

`Logger` supports distinct log levels (`.debug`, `.info`, `.notice`, `.error`, `.fault`) reflecting increasing severity/persistence, and `subsystem`/`category` parameters let logs be organized and filtered — by convention, `subsystem` is typically the app's bundle identifier and `category` identifies a specific feature area or module.

```swift
let networkLogger = Logger(subsystem: "com.example.app", category: "networking")
let uiLogger = Logger(subsystem: "com.example.app", category: "ui")

networkLogger.debug("Request started")  // low severity, may not persist to disk
networkLogger.fault("Unrecoverable networking state")  // highest severity, always persisted
```

Choosing the right log level genuinely matters for logs to remain useful at scale — `.debug`-level logs are appropriately verbose for active development but would be excessive noise (and unnecessary storage/performance overhead) if left at that verbosity in a shipped app's production logging, while reserving `.error`/`.fault` for genuinely actionable, higher-severity conditions keeps production log output focused on information actually worth a developer's attention when reviewing logs collected from real usage.

---

## 68.21 Console.app and log stream

Console.app provides a GUI for viewing both a connected device's live logs and previously collected log archives, with powerful filtering by subsystem, category, process, or free-text search, while `log stream` provides the equivalent live log streaming capability directly from the terminal, useful for scripting or when a GUI tool isn't convenient.

```bash
# Terminal equivalent of Console.app's live streaming, filtered to a specific subsystem:
log stream --predicate 'subsystem == "com.example.app"' --level debug
```

Both tools consume the same underlying unified logging system that `Logger`/`os_log` calls write into — Console.app's filtering capability is particularly valuable for isolating relevant log output from an otherwise extremely high-volume system-wide log stream (which includes logs from every running process and the system itself, not just one specific app), letting a developer focus specifically on their own app's `subsystem`-scoped output amid what would otherwise be an overwhelming amount of unrelated log noise.

---

## 68.22 Symbolication and dSYMs 🟠

A crash report captured from a release build initially contains raw memory addresses rather than readable function names and line numbers — symbolication is the process of translating those addresses back into human-readable symbols using a dSYM (debug symbol) file, which must correspond to the *exact* build that actually produced the crash.

```plaintext
# Before symbolication: 0x1000a2f34 (unreadable address)
# After symbolication with the matching dSYM: MyApp`ProfileViewModel.loadProfile() + 124
```

The requirement that a dSYM correspond to the exact build that crashed is a genuinely strict, easy-to-violate constraint — because addresses in a compiled binary shift between even minor rebuilds (different compiler optimizations, different code changes), a dSYM from a slightly different build than the one that actually crashed will produce either failed symbolication or, worse, subtly *incorrect* symbolication pointing to the wrong function or line entirely, making disciplined dSYM archival (keeping the exact dSYM for every shipped build) a genuine operational requirement for reliably debugging crashes reported from production.

---

## 68.23 Reading a Sysdiagnose 🔴

A sysdiagnose is a comprehensive, system-wide diagnostic archive (logs, process information, system state) collected from a physical device, appropriate for diagnosing system-level or hard-to-reproduce issues that a simple crash report or app-level log alone doesn't provide enough context to understand — genuinely more heavyweight than app-specific logging, encompassing the device's broader system state at the time of the issue.

```plaintext
# A sysdiagnose is triggered via a specific hardware button combination
# (varies by device) and produces a large archive containing system logs,
# process states, and diagnostic data far beyond just one app's own logging
```

Reaching for a sysdiagnose is appropriate specifically when an issue's root cause plausibly lies outside the app's own code entirely — a system-level resource contention issue, an interaction with another app or system service, or a hard-to-reproduce environmental condition — situations where even comprehensive app-level `Logger` output (68.19) wouldn't capture the necessary broader system context, making a sysdiagnose the appropriate, if heavyweight, escalation for genuinely system-level diagnostic needs.

---

## 68.24 Debugging Widgets and Extensions 🟠

Debugging widgets and other app extensions (recall sections 52-53) requires attaching the debugger to the *extension's* own separate process specifically, not the main app's process — Xcode's scheme selector lets a developer choose to run and debug a widget extension target directly, since a widget crash or bug exists within its own distinct process, consistent with the extension sandboxing model discussed in section 53.1.

```swift
// In Xcode: select the widget extension's own scheme (not the main app's scheme)
// from the scheme selector, then Run — this launches and attaches the debugger
// directly to the widget extension's own separate process
```

This requirement directly follows from the extension architecture covered in section 53.1 — because an extension runs as a genuinely separate process from its host app, breakpoints set while debugging only the main app's scheme will never be hit by code running inside a widget or other extension, meaning correctly debugging extension-specific code requires deliberately selecting and running that extension's own scheme, attaching the debugger to the actual process where that code is executing.

---

## Summary

| Concept | Key Tool | Purpose |
|---|---|---|
| Targeted pausing | Conditional/symbolic breakpoints | Pause exactly when/where relevant, not every iteration |
| Rebuild-free diagnostics | Breakpoint actions (log messages) | Adjust diagnostic output without edit-compile-run |
| State inspection | Variables view, stepping controls | Focused, efficient step-through debugging |
| Value inspection | `po`, `p`, `v` | Object description vs. raw value vs. fast variable lookup |
| Live state modification | `expression` | Test hypotheses without restarting the app |
| Concurrency-aware stepping | Async LLDB support, task backtraces | Coherent navigation despite thread-hopping suspension |
| Common crash literacy | Index/nil/`EXC_BAD_ACCESS` reading | Diagnosing the platform's most frequent crash types |
| Lifecycle timeouts | Watchdog codes (e.g., `0x8badf00d`) | Identifying performance problems, not logic bugs |
| Layout diagnosis | View Hierarchy Debugger | Visualizing actual runtime view structure |
| Leak diagnosis | Memory Graph Debugger | Visualizing the live object graph and flagged cycles |
| Cycle tracing | Object Reference panel | Systematic strong-reference chain tracing |
| Use-after-free clarity | Zombie Objects | Immediate, descriptive errors instead of silent corruption |
| Memory error detection | Address Sanitizer | Catches corruption at its actual point of occurrence |
| Data race detection | Thread Sanitizer | Runtime complement to compile-time concurrency checking |
| UI-thread violations | Main Thread Checker | Catches background-thread UI API misuse immediately |
| Privacy-aware logging | `Logger`, `os_log` | Redacted-by-default structured logging |
| Log organization | Subsystems, categories, levels | Filterable, appropriately-verbose production logging |
| Log viewing | Console.app, `log stream` | GUI and terminal access to the unified logging system |
| Crash readability | dSYMs, symbolication | Translating addresses into readable function/line info |
| System-level diagnosis | Sysdiagnose | Broader-than-app-level diagnostic context |
| Extension debugging | Extension-specific schemes | Attaching to the correct, separate extension process |
