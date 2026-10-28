**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Debugging is a **skill**, not luck. This section covers the tools in order of daily use: **breakpoints** and **LLDB**, debugging **async** code, reading the most common **crashes** and **watchdog** kills, the **view** and **memory** debuggers, the **sanitizers** and checkers, **logging** with `Logger`, **symbolication**, **sysdiagnose**, and debugging **extensions**.

---

## 68.1 Breakpoints: Line, Conditional, and Symbolic 🟢

A **line breakpoint** pauses when execution reaches a line (click the line number gutter). Two variations make breakpoints much more useful:

**Conditional**: pause only when a condition is true. Right-click the breakpoint ▸ **Edit Breakpoint** ▸ Condition:

```swift
for recipe in recipes {
    let scaled = recipe.scaled(toServings: servings)   // condition: recipe.id == "pasta-42"
    results.append(scaled)                             // or: scaled.totalGrams < 0
}
```

Instead of pressing Continue 300 times to reach the **one** bad recipe, it stops exactly **there**. ("**Ignore N times**" in the same dialog skips the first N hits.)

**Symbolic**: pause whenever a **function** is called, wherever the call comes from (Breakpoint navigator ▸ **+** ▸ Symbolic Breakpoint). Very useful for **framework** code you can't put a line breakpoint in:

| Symbol / breakpoint type | Stops when |
|---|---|
| `UIViewAlertForUnsatisfiableConstraints` | Auto Layout breaks a constraint (36.8) |
| **Swift Error Breakpoint** (from the **+** menu) | Any Swift `throw` happens |
| **Exception Breakpoint** | An Objective-C exception is raised: you see the **cause**, not just the crash |
| `-[UIViewController viewDidLoad]` | Any view controller loads |

Turn on the **Exception** and **Swift Error** breakpoints when hunting a crash: you stop at the **throw site**, with all the local state still there.

A cost to know: a condition is evaluated on **every** hit. In a loop that runs millions of times, it can make the app **very** slow.

---

## 68.2 Breakpoint Actions and Logging Without Rebuilds 🟢

A breakpoint can **do something** when hit, and then **continue** automatically. That gives you a `print` **without editing code or rebuilding**:

```
Edit Breakpoint:
  Action: Log Message   →  "Scaling @recipe.title@ to @servings@ servings"
  ☑ Automatically continue after evaluating actions
```

Text between `@…@` is an **expression** evaluated each time. The console then shows a line every time that code runs, like a `print`, but:

- no rebuild (great for slow projects),
- nothing to **forget** to remove before committing,
- turn it on and off with one click.

Other actions:

| Action | Example use |
|---|---|
| **Debugger Command** | `po items.count` or `bt 5` (the first 5 frames of the call stack) |
| **Sound** | Hear when a rarely-called path runs, without stopping |
| **Shell Command** | Run a script with information from the app |

Breakpoints are stored per user by default. Right-click ▸ **Share Breakpoint** to commit a useful one (like the Exception breakpoint) for the whole team.

---

## 68.3 The Variables View and Stepping Controls 🟢

When the app is **paused**, the debug area shows the **variables view**: local variables, `self`, and their current values (expand to look inside). Hover over a variable in the editor to see its value too.

Then **step** through the code:

| Control | Shortcut | Does |
|---|---|---|
| **Continue** | ⌃⌘Y | Run until the next breakpoint |
| **Step Over** | F6 | Run the current line; don't go **into** the functions it calls |
| **Step Into** | F7 | Go **inside** the function called on this line |
| **Step Out** | F8 | Finish the current function; stop in its caller |

```swift
func checkout() {
    let total = cart.total()                  // Step Over: you trust total(); just see the result
    let discount = pricing.discount(for: total) // Step Into: the bug might be in here
    charge(total - discount)
}
```

The skill is choosing **where** to step into. Stepping into **everything** (standard library calls, code you trust) wastes time; step **over** the trusted code and **into** the suspicious function.

Two more helpers:

- **Continue to Here**: right-click a line ▸ run until that line (like a temporary breakpoint).
- The **call stack** in the Debug navigator: click any frame to see **that** function's variables. It answers "**how did we get here**?"

---

## 68.4 LLDB po, p, and v Compared 🟡

The **LLDB console** (bottom right, `(lldb)` prompt) lets you inspect anything while paused. Three commands show values:

```
(lldb) v recipe                        // frame variable: reads memory, runs NO code
(Recipe) recipe = {
  title = "Pasta"
  servings = 2
}
(lldb) v recipe.servings
(Int) recipe.servings = 2

(lldb) p recipe.scaled(toServings: 4).servings   // can evaluate expressions and call methods
(Int) 4

(lldb) po recipe                       // "print object": uses description / debugDescription
Recipe(title: "Pasta", servings: 2)
```

| Command | How it works | Use for |
|---|---|---|
| **`v`** | Reads variables straight from memory; **runs no code** | Locals and **stored** properties: fast and safe |
| **`p`** | Tries `v` first; if needed, **compiles and runs** an expression | Computed properties, method calls, math |
| **`po`** | Runs code to get the object's **description** | Objects with a nice `description` (and Objective-C objects) |

Since Xcode 15, `p` is smart ("do what I mean"): it uses the fast `v` path when it can. Prefer **`v`** when you only want to **see** a value: it can't trigger side effects, and it works even when expression evaluation fails (which happens in some optimized or complex code).

Make your own types print nicely in the debugger and the variables view with the **`@DebugDescription`** macro:

```swift
@DebugDescription
struct Recipe {
    var title: String
    var servings: Int
    var debugDescription: String { "\(title) (\(servings) servings)" }
}
```

---

## 68.5 expression for Changing State at Runtime 🟡

**`expression`** (short: `e`) doesn't just read: it **runs code** inside the paused app. You can **change** state and test a theory **without** restarting:

```
(lldb) e servings = 0                       // what if servings were 0 here?
(lldb) c                                    // continue and watch what happens

(lldb) e viewModel.reload()                 // call a method
(lldb) e self.view.backgroundColor = .red   // change UI...
(lldb) e CATransaction.flush()              // ...and push it to the screen while paused (62.6)
```

Typical uses:

- "**Does the crash go away** if this value is valid?" Set it, continue, see.
- **Skip** a broken step: `thread return` returns from the current function early (with a value if needed).
- **Trigger** a hard-to-reach state: call the method that shows an error alert.

It saves full edit → build → run → navigate cycles, which can take minutes each in a big app.

Be careful: changes affect **only this run**, and odd changes can put the app in a state that **can't happen** in real use. Use it to **learn** about the bug, then fix the code.

---

## 68.6 Stepping Through Async Code in LLDB 🔴

Async code makes stepping harder. An `await` can **suspend** the function, and it may **resume on a different thread** (Part 2). A debugger that only thinks in **threads** would jump around confusingly.

```swift
func loadRecipe(id: Recipe.ID) async throws -> Recipe {
    let data = try await api.data(for: id)      // suspends here; resumes later, maybe on another thread
    let recipe = try decoder.decode(Recipe.self, from: data)
    return recipe
}
```

Modern LLDB is **async-aware**:

- **Step Over** on an `await` line waits for the function to **resume** and stops on the **next line** of the **same** function, even if it resumed on another thread.
- **Step Into** on an `await` call goes into the async function being awaited.
- The **call stack** shows async frames: the **logical** chain of callers ("loadRecipe ← RecipeView.task"), not just the current thread's raw frames.

Tips:

- Put a breakpoint **after** an `await` instead of stepping across long suspensions (a network call can take seconds).
- If a step seems to "**jump**", look at the stack: you may now be in a **different task** that hit the same code.
- Recent LLDB versions add **`language swift task …`** commands to inspect the current task (see `help language swift task` in your Xcode's LLDB).

---

## 68.7 Task Backtraces and Concurrency Debugging 🔴

Concurrency bugs often involve **several** tasks: a parent and its children (18.3), tasks waiting on an actor, a task that **never finishes**. One stack trace shows only **one** task's current position.

The best tool is **Instruments ▸ Swift Concurrency** template (Product ▸ Profile). It shows:

| Track | Shows |
|---|---|
| **Swift Tasks** | How many tasks are **running**, **suspended**, or **waiting**, over time |
| **Task Forest** | The **tree** of tasks: who created whom (parents and children) |
| **Swift Actors** | Each actor's **queue**: tasks waiting to run on it (contention) |
| Task details | A task's **creation backtrace**: where it was started |

Common concurrency bugs and how they look:

| Bug | Symptom |
|---|---|
| A **continuation never resumed** (18.11) | The task waits forever. The runtime prints `SWIFT TASK CONTINUATION MISUSE: … leaked its continuation` |
| **Actor contention** | Many tasks queued on one actor; work happens one at a time |
| **Main actor overloaded** | UI hangs while `@MainActor` work piles up (69.13) |
| **Unstructured task leak** | `Task {}` objects pile up and never end (e.g. a `for await` loop with no cancellation) |

In the debugger, the Debug navigator's stack also includes the **async** parent frames (68.6), which tells you **which** task you're in and how it was started.

---

## 68.8 Reading a Crash: Index Out of Range 🟢

```
Fatal error: Index out of range
```

Swift **checks** every array subscript. A bad index **stops the app** at once, instead of reading random memory:

```swift
let steps = recipe.steps          // 3 steps: indices 0, 1, 2
let step = steps[currentStep]     // 💥 if currentStep == 3
```

In a crash report, Swift runtime traps like this (and force-unwraps, `fatalError`, integer overflow) appear as **`EXC_BREAKPOINT (SIGTRAP)`**, with the crashing line in the top frames of the crashed thread.

The **line** is easy to find. The **reason** the index was wrong takes more thought. Common causes:

| Cause | Example |
|---|---|
| **Off by one** | `for i in 0...items.count` (should be `..<`) |
| **Stale index** | An index saved **before** the array changed (an item was deleted) |
| **Two sources of truth** | A table view's row count from one array, cells from another |
| **Data race** | Another thread removed items while you were reading (68.17) |

Fixes, depending on the cause:

```swift
// Iterate safely: no manual indices
for (index, step) in steps.enumerated() { /* ... */ }

// When an index may be invalid, check first
guard steps.indices.contains(currentStep) else { return }
let step = steps[currentStep]

// Or a safe subscript that returns an optional
extension Collection {
    subscript(safe index: Index) -> Element? { indices.contains(index) ? self[index] : nil }
}
let step = steps[safe: currentStep]
```

Don't hide **every** index with `[safe:]`: if an index "can't" be wrong, a crash in testing is **useful** information. Use safe access where an invalid index is a **normal** possibility.

---

## 68.9 Reading a Crash: Force-Unwrapped Nil 🟢

```
Fatal error: Unexpectedly found nil while unwrapping an Optional value
```

A **`!`** was used on an optional that was **`nil`**:

```swift
let recipe = store.recipe(id: id)!       // 💥 if the recipe was deleted
let url = URL(string: userInput)!        // 💥 if the text isn't a valid URL
let cell = tableView.dequeueReusableCell(withIdentifier: "Cell") as! RecipeCell   // 💥 wrong type: as! crashes too
```

The crash points to the exact line. The real question: **why** did I believe this could never be `nil`? Usually one of these was wrong:

- "This always exists" → it was **deleted**, not loaded yet, or the server **didn't send** it.
- "The user always types a valid value" → they **didn't**.
- "This outlet is always connected" → it was used **before** `viewDidLoad` (implicitly unwrapped `@IBOutlet`s are `nil` until then).

The fix is to **handle** the nil case, not to hide it:

```swift
guard let recipe = store.recipe(id: id) else {
    showMessage("This recipe is no longer available.")
    return
}

guard let url = URL(string: userInput) else {
    throw ImportError.invalidURL(userInput)
}
```

`!` is fine when `nil` **really** means a programmer error that should be caught in testing (for example, a URL written as a constant in your code). For anything that comes from **data**, the **network**, or the **user**, unwrap safely.

---

## 68.10 Reading a Crash: EXC_BAD_ACCESS 🟡

```
Thread 1: EXC_BAD_ACCESS (code=1, address=0x10)
```

The app tried to use **memory it may not touch**: freed, never allocated, or protected. It's harder than the previous two crashes because the crashing line is often **not** where the bug **is**: the damage happened **earlier**, somewhere else.

In Swift code, the common causes are:

| Cause | Example |
|---|---|
| **Infinite recursion** (stack overflow) | A function or getter that calls **itself** forever |
| **Unsafe pointers** used after they're valid | A pointer from `withUnsafeBytes` kept and used **outside** the closure |
| **`unowned(unsafe)`** / `Unmanaged` misuse | Using an object after it was freed, with checks turned off |
| **Objective-C / C interop** | An `assign` delegate or KVO observer pointing to a freed object |
| **Data races** corrupting memory | Two threads mutating the same value (68.17) |

The recursion case is surprisingly common:

```swift
struct Recipe {
    var title: String
    var displayTitle: String {
        displayTitle.capitalized       // 💥 calls itself forever → stack overflow → EXC_BAD_ACCESS
    }                                  // (meant: title.capitalized)
}
```

In the crash's stack, recursion shows as the **same function** repeated hundreds of times. That's the giveaway.

(Note: plain Swift **`unowned`** is checked: using it after the object is gone gives a clear **fatal error**, not `EXC_BAD_ACCESS`, see 10.5.)

For the other causes, use the tools made for this: **Address Sanitizer** (68.16) catches the bad access at the **moment** it happens, **Zombie Objects** (68.15) names the freed Objective-C object, and **Thread Sanitizer** (68.17) finds races.

---

## 68.11 Watchdog Terminations and Their Codes 🟡

Sometimes the system **kills** an app that isn't crashing at all, because it broke a **rule**: it was too slow, or held something it shouldn't. The crash report then has **no** crashing line in your code. Instead, look at the **termination reason** code:

| Code | Read as | Meaning | Typical cause |
|---|---|---|---|
| **`0x8badf00d`** | "ate bad food" | **Watchdog timeout**: unresponsive too long | Main thread **blocked** during launch, resume, or a long hang (69.13) |
| **`0xdead10cc`** | "deadlock" | Held a **file lock** while being suspended | A SQLite / SwiftData / Core Data file in an **App Group** still busy when the app was suspended |
| **`0xc00010ff`** | "cool off" | Killed for **heat** | The device was too hot; heavy CPU/GPU work |
| **`0xbaadca11`** | "bad call" | VoIP push without reporting a call | A PushKit VoIP push not reported to **CallKit** |

For **`0x8badf00d`**, the crash report's main-thread stack shows **what** the main thread was doing when it was killed:

```
Termination Reason: FRONTBOARD 0x8badf00d
Thread 0 (main):
  ...
  RecipeStore.loadAll()            ← synchronous disk read of a big file during launch
  RecipeApp.init()
```

So the fix is **performance** work, not a logic fix: move the blocking work **off** the main thread, make launch do **less** (69.9), or load lazily.

For **`0xdead10cc`**: finish or pause database work before the app is suspended (49.2), or ask for a little extra background time to complete it.

---

## 68.12 The View Hierarchy Debugger 🟢

**Debug View Hierarchy** (the button with stacked rectangles in the debug bar) pauses the app and captures its **real** view tree as a **3D** model you can rotate:

```
What you can see:
- every view and layer, in 3D layers: what's ON TOP of what
- hidden views, views with alpha 0, views outside their parent (Editor ▸ Show Clipped Content)
- each view's frame, constraints, and properties (Size inspector, Object inspector)
- SwiftUI content, shown inside its hosting views
- purple runtime warnings: ambiguous or broken Auto Layout
```

It answers layout questions that are hard to solve by **reading** code:

| Symptom | Often found in the debugger |
|---|---|
| "My button doesn't respond to taps" | An **invisible view** on top of it eats the touches |
| "My label doesn't show" | Its frame is **zero-sized**, or it's behind another view |
| "The layout is different every time" | **Ambiguous** constraints (purple warning) |
| "Content is cut off" | A parent with `clipsToBounds`, or a too-small frame |

Select a view, then use the **Size inspector** to see the constraints that position it, and jump to their source. In the LLDB console, `po someView` prints its frame and address, and `e someView.isHidden = true` + `e CATransaction.flush()` lets you test changes live (68.5).

For **SwiftUI** "why does this re-render?" questions, add `let _ = Self._printChanges()` inside a view's `body`: the console then prints **which** property caused each body update.

---

## 68.13 The Memory Graph Debugger 🟡

**Debug Memory Graph** (the button with three connected circles) pauses the app and shows **every live object** and the **references** between them.

Use it when memory keeps growing, or when a screen's objects **stay alive** after you close it:

```
1. Open a screen, then close it (do this 2–3 times)
2. Click "Debug Memory Graph"
3. In the left list, search for the screen's types: ProfileViewModel (3)
   → 3 instances alive after closing it 3 times = a LEAK
4. Purple "!" icons mark objects Xcode has detected as leaked
```

| Panel | Shows |
|---|---|
| Left list | All types with **instance counts** (filter by your app's types) |
| Center graph | The selected object and **who references it** (arrows) |
| Memory inspector (right) | Size, and with **Malloc Stack Logging** on, **where** it was allocated |

Turn on **Malloc Stack Logging** ("Live Allocations Only") in the scheme's **Diagnostics** tab: then the inspector shows the **stack trace** of each object's creation, which points to the code that made it.

You can also **export** the graph (File ▸ Export Memory Graph) and inspect it on the command line, for example on CI:

```bash
leaks RecipeApp.memgraph          # lists leaked objects and cycles
```

---

## 68.14 Finding Retain Cycles in the Memory Graph 🟡

A **retain cycle** (10.3): objects hold **strong** references to each other in a loop, so ARC never frees them. The classic case is a **closure** capturing `self`:

```swift
@MainActor
final class RecipeViewModel {
    private let timer = CookTimer()
    var remainingText = ""

    init() {
        timer.onTick = { seconds in
            self.remainingText = "\(seconds)s"       // ❌ the timer (owned by self) → closure → self
        }
    }
}
```

How to find it in the memory graph:

```
1. Select the object that should be gone (RecipeViewModel)
2. Look at the arrows pointing TO it: who keeps it alive?
   RecipeViewModel ◄── closure context ◄── CookTimer.onTick ◄── RecipeViewModel.timer
3. Follow the arrows until you're back at the start: that's the cycle
4. Bold arrows = strong references. One of them must become weak.
```

The fix: break **one** strong link:

```swift
timer.onTick = { [weak self] seconds in
    self?.remainingText = "\(seconds)s"              // ✅ the closure no longer owns the view model
}
```

Two things to know:

- Xcode's purple **"!"** only marks cycles that are **unreachable** from the rest of the app. An object kept alive by a **singleton** or a long-lived cache isn't "leaked" in that sense ("**abandoned memory**"), but it's still wasted. The **instance count** (68.13) finds those.
- Confirm the fix with a **`deinit`** log (10.10): open and close the screen, and the log should print **every** time.

Other usual suspects: delegates declared without `weak` (10.8), and `Task { }` closures that loop forever while capturing `self` (10.9).

---

## 68.15 Zombie Objects 🟡

**Zombie Objects** (scheme ▸ Run ▸ **Diagnostics** ▸ Zombie Objects) changes what happens when an **Objective-C** object is freed: instead of really freeing it, the runtime turns it into a "**zombie**". If anything sends it a message later, you get a **clear** error instead of a random `EXC_BAD_ACCESS`:

```
*** -[RecipeCellModel respondsToSelector:]: message sent to deallocated instance 0x600002a1b2c0
```

Now you know **which** class was used after being freed, and the stack shows **who** used it. Combine with Malloc Stack Logging (68.13) to see where it was **created**.

Limits:

| | |
|---|---|
| Works for | **Objective-C** objects (`NSObject` subclasses, UIKit and Foundation objects) |
| Doesn't cover | Pure **Swift** classes, which have their own runtime (use Address Sanitizer, 68.16) |
| Cost | Freed objects are **never** released: memory grows. Debug sessions only |

In modern Swift apps, zombies usually appear around **UIKit** and **Objective-C** interop: a delegate or data source declared `assign`/`unsafe_unretained` in older code, a KVO observer that outlived its object, or a notification observer that was never removed. Instruments also has a **Zombies** template that shows the object's full retain/release history.

---

## 68.16 Address Sanitizer 🟡

**Address Sanitizer** (ASan; scheme ▸ Diagnostics ▸ Address Sanitizer) adds checks around **every memory access**. When code touches memory it shouldn't, the app stops **at that moment**, with a detailed report:

```
ERROR: AddressSanitizer: heap-use-after-free on address 0x6020000efb18
READ of size 8 at 0x6020000efb18 thread T0
    #0 ImageBuffer.pixel(at:) ImageBuffer.swift:42      ← where the bad READ happened
freed by thread T0 here:
    #0 ImageBuffer.deinit ImageBuffer.swift:18           ← where the memory was FREED
previously allocated by thread T0 here:
    #0 ImageBuffer.init(width:height:) ImageBuffer.swift:9   ← where it was CREATED
```

Three stacks: **where** it went wrong, **when** the memory was freed, and **where** it came from. Without ASan, the same bug might crash **minutes later** in unrelated code, or silently corrupt data.

It finds:

| Error | Typical Swift source |
|---|---|
| **Heap buffer overflow** | Writing past the end of an `UnsafeMutablePointer` buffer |
| **Use after free** | Using an unsafe pointer after its memory was released |
| **Stack use after return** | A pointer to a local variable escaping the function |
| Errors in **C / C++ / Objective-C** code in your app | Any of the above, in mixed-language projects |

Pure, safe Swift rarely has these bugs: they come from **`Unsafe…`** APIs, `Unmanaged`, and other languages. If your app uses those (image processing, audio buffers, C libraries), run your test suite with ASan **regularly**.

Costs: about **2–3× slower**, and more memory. It can't be combined with Thread Sanitizer; turn on **one** at a time. Never ship it.

---

## 68.17 Thread Sanitizer 🟡

**Thread Sanitizer** (TSan; scheme ▸ Diagnostics ▸ Thread Sanitizer) detects **data races** at runtime: two threads accessing the **same memory** at the same time, without synchronization, and at least one **writing**:

```
WARNING: ThreadSanitizer: Swift access race
  Modifying access of Swift variable at 0x7b0800012345 by thread T3:
    #0 ImageCache.store(_:for:) ImageCache.swift:21
  Previous read of size 8 by thread T5:
    #0 ImageCache.image(for:) ImageCache.swift:14
```

Both threads, both stacks, the exact lines.

Doesn't Swift 6's **strict concurrency** already prevent races? For checked code, **at compile time**, yes. But races still slip in through the **escape hatches** and **unchecked** code:

| Where races hide | Example |
|---|---|
| `@unchecked Sendable` types | "I promise this class is thread-safe" (and it isn't) |
| `nonisolated(unsafe)` | A global or static var marked unsafe |
| **Legacy** code | GCD-based code, Swift 5 mode modules |
| Objective-C / C code | Mixed-language parts of the app |

So TSan is the **runtime** safety net for exactly what the compiler can't see.

Practical notes:

- TSan runs in the **Simulator** (and on the Mac), not on iOS devices.
- It's **slow** (often 5–15×): run it on the **test suite**, for example in a nightly test plan (66.14).
- Races only show up if the racing code **actually runs concurrently** during the test, so tests that exercise **concurrent** paths (66.2) make TSan far more useful.

---

## 68.18 Main Thread Checker 🟢

UIKit and AppKit must be used **only on the main thread**. Calling them from a background thread can cause anything from a **glitch** (a label that updates seconds later) to a random **crash**.

The **Main Thread Checker** is **on by default** in debug runs (scheme ▸ Diagnostics). It catches violations as they happen:

```
Main Thread Checker: UI API called on a background thread: -[UILabel setText:]
PID: 4120, TID: 51234, Thread name: (none), Queue name: com.apple.NSURLSession-delegate
Backtrace:
4  RecipeApp  RecipeCell.update(with:) + 112
5  RecipeApp  closure #1 in ImageLoader.load(_:) + 88
```

The usual cause: a **completion handler** or **background task** updating the UI directly:

```swift
// ❌ URLSession calls this on a background queue
URLSession.shared.dataTask(with: url) { data, _, _ in
    self.titleLabel.text = "Loaded"                  // UI off the main thread
}.resume()

// ✅ Swift concurrency: isolate UI code to the main actor
@MainActor
func refresh() async {
    let data = try? await URLSession.shared.data(from: url).0
    titleLabel.text = data == nil ? "Failed" : "Loaded"   // guaranteed main thread
}
```

With Swift 6, marking UI types **`@MainActor`** turns most of these mistakes into **compile errors**. The checker still catches the rest: older code, completion handlers, and C/Objective-C callbacks. SwiftUI shows a related purple warning: "*Publishing changes from background threads is not allowed*".

Its cost is tiny, so leave it **on**.

---

## 68.19 Logger and os_log with Privacy Annotations 🟢

**`Logger`** (from the `os` framework) writes to Apple's **unified logging system**. It's fast, structured, filterable, and **private by default**. Prefer it over `print`:

```swift
import os

extension Logger {
    static let sync = Logger(subsystem: "com.example.recipes", category: "sync")
}

func syncRecipes(for user: User) async {
    Logger.sync.info("Sync started for user \(user.id, privacy: .private(mask: .hash))")

    do {
        let count = try await engine.sync()
        Logger.sync.notice("Sync finished: \(count) recipes")                // numbers: public by default
    } catch {
        Logger.sync.error("Sync failed: \(error.localizedDescription, privacy: .public)")
    }
}
```

Privacy rules:

| Interpolated value | Default in collected logs |
|---|---|
| **Strings**, objects, most custom values | **Redacted**: shown as `<private>` |
| Numbers, `Bool` | Shown (public) |
| `privacy: .public` | Always shown: use only for **non-sensitive** values (error codes, screen names) |
| `privacy: .private(mask: .hash)` | A **hash**: lets you see "same user as before" without revealing who |

So **personal data** (names, emails, IDs, recipe notes) stays private in logs collected from real devices, unless you deliberately mark it public.

(While your app runs **attached to Xcode's debugger**, private values are shown in full, so you see everything during development.)

Compared with `print`:

| `print` | `Logger` |
|---|---|
| Only visible in Xcode's console | Collected in the **system log**: Console.app, sysdiagnose (68.23) |
| No levels, no filtering | Levels, subsystems, categories |
| Everything visible | **Private by default** |
| Builds the string every time | Very cheap; skipped work when the level is off |

---

## 68.20 Log Levels and Subsystems 🟢

Every log message has a **level**. The level decides **whether** the message is **kept**, and how important it looks:

| Level | Use for | Stored? |
|---|---|---|
| **`.debug`** | Very detailed developer info | Memory only; usually **not** kept |
| **`.info`** | Helpful, but not essential | Memory; kept only around errors |
| **`.notice`** (default) | Important normal events | **Persisted** to disk |
| **`.error`** | Something failed | **Persisted** |
| **`.fault`** | A bug: "this should never happen" | **Persisted**, with extra process info |

```swift
Logger.sync.debug("Request body: \(body, privacy: .private)")     // dev details
Logger.sync.info("Fetched page \(page)")                           // context
Logger.sync.notice("Sync finished: \(count) recipes")              // key events
Logger.sync.error("Server returned \(statusCode)")                 // failures
Logger.sync.fault("Recipe with nil ID reached the database layer") // bugs
```

Because `.debug` and `.info` cost almost nothing when they're not being collected, you can leave them in **release** builds: they're there when you need them (for example, in a sysdiagnose).

**Subsystem** and **category** organize the logs:

- **Subsystem**: usually your **bundle ID** (`com.example.recipes`). Extensions can use their own.
- **Category**: a feature area: `sync`, `network`, `purchases`, `ui`.

Define loggers in **one place** (like the `extension Logger` in 68.19), so names stay consistent. Then you can filter to "only `com.example.recipes`, only `sync`, only errors": in Xcode 15+'s console, in Console.app, and in `log` commands (68.21).

---

## 68.21 Console.app and log stream 🟢

The unified log contains messages from **every** process on the device. Your app's lines are lost in thousands of system messages unless you **filter**.

**In Xcode** (15+): the debug console shows `Logger` messages with their level and category. Filter by **subsystem**, **category**, or **level**, and click a message to jump to the **source line** that logged it.

**Console.app** (on the Mac): select your **device** (or the Mac) in the sidebar, press **Start**, and filter:

```
subsystem:com.example.recipes  category:sync
```

Turn on **Action ▸ Include Info Messages / Include Debug Messages** to see the lower levels. Console.app also opens **log archives** (`.logarchive`), for example from a sysdiagnose (68.23).

**Terminal**, for live streaming or scripts:

```bash
# Live logs from your app on the Mac (or the booted Simulator via simctl)
log stream --predicate 'subsystem == "com.example.recipes"' --level debug

xcrun simctl spawn booted log stream --predicate 'subsystem == "com.example.recipes" AND category == "sync"'

# Search what was logged in the last hour
log show --last 1h --predicate 'subsystem == "com.example.recipes" AND messageType == error'
```

Your app can also **read its own logs** with `OSLogStore`, for example to attach them to a "Send feedback" email:

```swift
let store = try OSLogStore(scope: .currentProcessIdentifier)
let lastHour = store.position(date: .now.addingTimeInterval(-3600))
let lines = try store.getEntries(at: lastHour)
    .compactMap { $0 as? OSLogEntryLog }
    .filter { $0.subsystem == "com.example.recipes" }
    .map { "\($0.date) [\($0.category)] \($0.composedMessage)" }
```

(Private values stay redacted there too, 68.19.)

---

## 68.22 Symbolication and dSYMs 🟡

A crash from a **release** build contains raw **addresses**, not function names:

```
Before:  3  RecipeApp   0x0000000100a2f34c  0x1009e8000 + 290636
After:   3  RecipeApp   RecipeListModel.load() (in RecipeApp) (RecipeListModel.swift:58)
```

**Symbolication** turns addresses back into **names and lines**, using the build's **dSYM**: a file of debug symbols created when you build (in the Xcode **archive**).

The strict rule: the dSYM must come from the **exact same build** that crashed. Every build gets a unique **UUID**; even a tiny code change produces a different binary. A dSYM from another build either **fails** to symbolicate or, worse, points to the **wrong** lines.

```bash
# Check that a dSYM matches a crashed binary: the UUIDs must be equal
dwarfdump --uuid RecipeApp.app.dSYM
# The crash report's "Binary Images" section lists the app's UUID too

# Symbolicate one address by hand
atos -arch arm64 -o RecipeApp.app.dSYM/Contents/Resources/DWARF/RecipeApp \
     -l 0x1009e8000 0x0000000100a2f34c
```

In practice:

- **Archive** every build you ship, and **keep** the archives (they contain the dSYMs).
- Apple's **Xcode Organizer ▸ Crashes** symbolicates automatically when the dSYM is available (uploaded with the App Store build).
- Third-party crash reporters (Crashlytics, Sentry, …) need the dSYMs **uploaded**: add their upload step to your build or CI.
- Build setting **Debug Information Format** must be **"DWARF with dSYM File"** for release builds.

---

## 68.23 Reading a Sysdiagnose 🔴

A **sysdiagnose** is a big **system-wide** snapshot of a device: the full unified **log**, running processes, memory and power state, network, crash and jetsam reports, and more. Use it when the problem may be **outside** your app's code, or impossible to reproduce on your desk:

- "The app gets killed in the background" (a memory **jetsam**, 69.14, or a **watchdog**, 68.11),
- "Sync never runs on this user's phone" (background task budgets, 49.13),
- "It only happens on cellular" or "after the phone was locked overnight".

**Capture** (iPhone): press **both volume buttons + the side button** together for about a second; the phone **vibrates**. Wait about **10 minutes**, then find it in **Settings ▸ Privacy & Security ▸ Analytics & Improvements ▸ Analytics Data** (`sysdiagnose_…tar.gz`). Users can share it with you from there (AirDrop, Mail).

**Read** it on a Mac:

```
sysdiagnose_2026.01.12_09-41-03_iPhone/
├── system_logs.logarchive        ← open in Console.app: the full unified log
├── crashes_and_spins/            ← crash, jetsam, and hang reports
├── logs/                         ← per-subsystem logs (power, network, …)
└── ps.txt, top.txt, …            ← processes and resource use at capture time
```

1. Ask the user for the **time** the problem happened (as exact as possible).
2. Open `system_logs.logarchive` in Console.app, jump to that time.
3. Filter by your **subsystem** (68.20) to see what your app logged, then **widen** the filter to the system around it (`runningboardd` for app lifecycle, `dasd` for background tasks, `nsurlsessiond` for background transfers).

This is where good `Logger` usage pays off: your `.info` and `.debug` lines are **in there**, right next to the system's view of events. For some subsystems, Apple's bug-reporting site offers **logging profiles** that turn on extra logs before capturing.

---

## 68.24 Debugging Widgets and Extensions 🟡

Widgets and other extensions run in their **own process** (52.1, 53.1). Breakpoints set while running the **app's** scheme never hit in extension code, because the debugger is attached to the **app**, not the extension.

Ways to attach to the **extension**:

```
1. Run the EXTENSION's scheme
   - Share / action extension: Xcode asks which HOST app to launch (Photos, Safari).
     Share something to your extension: breakpoints in it now work.
   - Widget: the scheme's settings pick the widget kind and family to show.

2. Debug ▸ Attach to Process by PID or Name…
   - Enter the extension's process name, check "Wait for launch"
   - Then trigger the extension (open the share sheet, add the widget)
```

Then the usual tools work: breakpoints, LLDB, the memory graph (watch the extension's **much smaller** memory limit, 53.11).

Logging is especially useful here, because extensions start and stop **on their own**:

```swift
extension Logger {
    static let shareExtension = Logger(subsystem: "com.example.recipes.share", category: "import")
}
```

Give each extension its own **subsystem** or **category**, and filter for it in Console.app (68.21). Crashes and memory kills of extensions appear in **crash reports** and the **Organizer** under the extension's name, so check there too: an extension killed for **memory** shows a **jetsam** event, not a normal crash.

---

## Summary

| Concept | Key tool | Purpose |
|---|---|---|
| Breakpoints | Conditional, symbolic, Exception, Swift Error | Stop exactly where it matters |
| Breakpoint actions | Log messages, auto-continue | `print` without rebuilding |
| Stepping | Variables view, step over/into/out, call stack | Follow the code efficiently |
| Inspecting values | `v`, `p`, `po`, `@DebugDescription` | Fast reads vs. expressions vs. descriptions |
| Changing state | `expression`, `thread return`, `CATransaction.flush()` | Test theories without restarting |
| Async debugging | Async-aware stepping, async call stacks | Follow a function across `await` |
| Concurrency | Instruments Swift Concurrency (tasks, actors) | See task trees, waits, and contention |
| Index crashes | Bounds checks, safe access where valid | Find why the index was wrong |
| Nil crashes | `guard let` instead of `!` for real data | Handle the case you assumed away |
| Bad access | Recursion stacks, ASan, Zombies, TSan | The crash site isn't the bug site |
| Watchdog kills | `0x8badf00d`, `0xdead10cc`, … | Performance and lifecycle fixes, not logic fixes |
| Layout bugs | View Hierarchy Debugger, `_printChanges()` | See the real view tree |
| Memory leaks | Memory Graph, Malloc Stack Logging, `leaks` | Find objects that should be gone |
| Retain cycles | Follow strong references, `[weak self]` | Break one link in the loop |
| Freed ObjC objects | Zombie Objects | Name the object used after free |
| Memory errors | Address Sanitizer | Catch unsafe memory access instantly |
| Data races | Thread Sanitizer | Runtime net under strict concurrency |
| UI threading | Main Thread Checker, `@MainActor` | UI calls only on the main thread |
| Logging | `Logger`, privacy, levels, subsystems | Private, filterable, cheap logs |
| Reading logs | Xcode console, Console.app, `log`, `OSLogStore` | Find your lines in the system log |
| Symbolication | Matching dSYM (UUID), Organizer, `atos` | Turn addresses into code lines |
| System-level issues | Sysdiagnose + Console.app | The whole device's story around a bug |
| Extensions | Extension scheme, attach to process | Debug the right process |
