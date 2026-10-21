**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 61.1 Xcode 27 Coding Intelligence Overview 🟢

Xcode 27 has **AI help built into the editor**. It uses the same on-device and cloud models as in Part 8 (Foundation Models in section 58, and cloud routing in 58.15).

```swift
// Xcode's coding intelligence surfaces through several distinct interaction modes:
// - Inline completion: suggests code as you type, similar to earlier predictive completion but more context-aware
// - Chat: a conversational panel for asking questions or requesting changes
// - Agentic editing: multi-file changes planned and executed with review before applying
```

| Mode | What it does |
|---|---|
| **Inline completion** | Suggests code as you type |
| **Chat** | A panel where you ask questions or request changes |
| **Agentic editing** | Plans and makes changes in several files, and you review them first |

The big difference from a separate chat window or a browser tab: **Xcode knows your project**. The assistant can see your files, your types, and your build state.

---

## 61.2 Choosing a Model: On-Device vs Claude vs Gemini 🟢

Like Foundation Models (58.15), Xcode can use the **on-device model** or a **cloud model** (Claude or Gemini). The right choice depends on three things: how hard the task is, how private the code is, and whether you have a network.

```swift
// Model selection considerations for development tasks:
// - On-device: fast, private, works offline — appropriate for simple completions,
//   small refactors, or working with genuinely sensitive/proprietary code
// - Cloud (Claude/Gemini): more capable for complex, multi-file reasoning,
//   architectural suggestions, or generating substantial new functionality
```

| | On-device | Cloud (Claude, Gemini) |
|---|---|---|
| Speed | Fast | Needs network |
| Privacy | Code stays on your Mac | Code is sent to a server |
| Offline | Works | Does not work |
| Good for | A rename, a small completion, sensitive code | A big multi-file refactor, a new feature design |

It is the same trade-off as for in-app AI. It is **a choice for each task**, not a fixed setting.

---

## 61.3 Agentic Workflows: Planning and Multi-File Edits 🟡

An **agent** can do more than complete one line. You give a **goal** ("add a dark mode toggle to settings and save it"), and it **plans and changes several files**. You review the result before it is applied.

```swift
// A typical agentic workflow for a stated goal proceeds through phases:
// 1. Planning: the agent identifies which files need to change and how
// 2. Execution: changes are made across the identified files
// 3. Review: the developer reviews a diff before changes are committed/applied
// 4. Iteration: feedback on the review can trigger further refinement
```

For the dark mode goal, the changes could be small edits in two files:

```swift
// SettingsView.swift: a toggle that saves the choice
struct SettingsView: View {
    @AppStorage("isDarkMode") private var isDarkMode = false

    var body: some View {
        Form {
            Toggle("Dark mode", isOn: $isDarkMode)
        }
    }
}

// RootView.swift: apply the choice to the whole app
struct RootView: View {
    @AppStorage("isDarkMode") private var isDarkMode = false

    var body: some View {
        ContentView()
            .preferredColorScheme(isDarkMode ? .dark : nil)
    }
}
```

**Planning** is what makes an agent different from autocomplete. It thinks about the whole goal (a view, a saved setting, and where it is used) and proposes **changes that fit together**. The **review step** is still yours. Read the diff before you accept it.

---

## 61.4 Generating SwiftUI Views with the Agent 🟡

A common use: **describe a screen in words**, and the agent writes the SwiftUI view. It tries to follow your project's style and your design components.

```swift
// Example prompt: "Create a card view showing a recipe's photo, title, and cook time"
// The agent generates something like:
struct RecipeCardView: View {
    let recipe: Recipe

    var body: some View {
        VStack(alignment: .leading) {
            AsyncImage(url: recipe.imageURL) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                ProgressView()
            }
            .frame(height: 160)
            .clipped()

            Text(recipe.title).font(.headline)
            Label("\(recipe.cookTimeMinutes) min", systemImage: "clock")
                .font(.caption)
        }
    }
}
```

It compiles and looks right, but **review it** like any AI code (61.10, 61.11). Things to check:

```swift
// A reviewed version: one accessibility description and a clear shape
VStack(alignment: .leading) {
    // ... image, title, time ...
}
.accessibilityElement(children: .combine)             // read as one item
.accessibilityLabel("\(recipe.title), \(recipe.cookTimeMinutes) minutes")
.clipShape(RoundedRectangle(cornerRadius: 12))
```

- **Does it match the app?** For example, the state management should follow the architecture from section 45.
- **Accessibility:** labels, and text that grows with Dynamic Type.
- **Details:** a wrong aspect ratio, a missing placeholder, or a hardcoded size.

Treat the result as a **good first draft**, not a finished view.

---

## 61.5 Localizing String Catalogs with AI 🟡

AI can **draft translations** for your **String Catalog** (more in section 71). It speeds up the first pass, but a **person who knows the language should review** the result before you ship.

```swift
// String Catalog entries can be AI-drafted, e.g. for a new string:
// "Add to Favorites" → suggested translations across configured locales,
// populated as a starting point within Xcode's String Catalog editor,
// pending human review before being considered final.
```

A String Catalog file (`.xcstrings`) is JSON. An AI draft can be marked as **needing review**:

```json
{
  "sourceLanguage": "en",
  "strings": {
    "Add to Favorites": {
      "localizations": {
        "fr": {
          "stringUnit": { "state": "needs_review", "value": "Ajouter aux favoris" }
        },
        "es": {
          "stringUnit": { "state": "needs_review", "value": "Añadir a favoritos" }
        }
      }
    }
  },
  "version": "1.0"
}
```

Why a person still checks: a machine translation can miss **culture** (a joke or a symbol), use the wrong **tone** (too formal or too casual), or be correct but **sound unnatural**. Mark AI drafts as needs review, and change them to translated only after a human checks them.

---

## 61.6 Xcode Tool Plugins 🔴

**Tool plugins** let the AI assistant **call outside tools** during a session: run a linter, ask a database about its schema, or fetch documentation. The assistant then knows more than your project files alone can tell it.

```swift
// Conceptually similar to how Foundation Models' Tool protocol (section 58.10)
// lets a language model call app-defined functions, Xcode tool plugins let
// the coding assistant call developer-defined tools during a session —
// e.g., a plugin that runs `swiftlint` and feeds results back into the conversation.
```

It is the same idea as the **`Tool` protocol** in Foundation Models (58.10):

| | Foundation Models `Tool` | Xcode tool plugin |
|---|---|---|
| Who calls it | The language model in your app | The coding assistant in Xcode |
| Example | Get live weather | Run `swiftlint` |
| Why | The model lacks live data | The assistant should run the linter, not guess |

---

## 61.7 Using Claude Code in an iOS Repo 🟡

**Claude Code** is an AI coding agent that runs in the **terminal**. In an iOS repo, it can read your Swift files, make edits across the project, and **run real commands** like `xcodebuild` and `swift test` to check its own work. You can use it next to Xcode's own AI, or instead of it.

```bash
# Claude Code can invoke standard iOS tooling directly from the terminal:
xcodebuild -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16' test
swift build
swift test
```

Start it in your project folder:

```bash
cd MyApp
claude                                     # start an interactive session
claude -p "Run the tests and fix any failing ones"    # one task, then exit
```

An example prompt:

> Add a favorites toggle to `RecipeDetailView`. Follow the existing MVVM style. Then run `swift test` and fix any failures.

Because it works through **normal command-line tools**, it can **make a change, then run the tests** to see if the change really works, instead of only guessing that the code is correct.

---

## 61.8 Writing a CLAUDE.md for Your Project 🟡

A **`CLAUDE.md`** file in your repository's root gives Claude Code **lasting facts about your project**: how to build and test, your architecture, and your style. Without it, you would repeat them at the start of every session.

```plaintext
# CLAUDE.md example structure for an iOS project

## Build & Test
- Build: `xcodebuild -scheme MyApp -destination 'generic/platform=iOS Simulator'`
- Test: `swift test` (unit tests use Swift Testing, see section 65)

## Architecture
- MVVM with `@Observable` view models (see section 45.3)
- Dependency injection via a shared `Dependencies` container (section 47)

## Conventions
- Prefer `async`/`await` over completion handlers
- New views go in `Sources/Views/`, grouped by feature
```

Tips:

- **Create a first draft** with the `/init` command inside Claude Code, then edit it.
- **Import other files** with `@path`. For example, a line `@AGENTS.md` pulls that file in, so you keep one source of truth.
- **Keep it short and specific.** Commands, rules, and where things live. Not long essays.

It works like the **instructions** of a Foundation Models session (58.4): you set stable rules once, so each session can focus on the task.

---

## 61.9 MCP Servers for iOS Workflows 🔴

**MCP** (Model Context Protocol) is a **standard way to connect an AI assistant to outside systems**. An **MCP server** can give the assistant things like App Store Connect data, a design tool's components, or your issue tracker. These are things the local files do not have.

```swift
// Conceptually: an MCP server for iOS workflows might expose tools like:
// - fetch_crash_reports(build: String) -> [CrashReport]
// - get_design_component(name: String) -> ComponentSpec
// - list_open_issues(label: String) -> [Issue]
// The coding assistant can call these tools mid-session, integrating
// external context directly into its reasoning and code generation.
```

In Claude Code, you add a server with one command:

```bash
claude mcp add --transport http crash-reports https://example.com/mcp
```

Or you list it in a `.mcp.json` file at the repo root, so the whole team shares it:

```json
{
  "mcpServers": {
    "crash-reports": {
      "type": "http",
      "url": "https://example.com/mcp"
    }
  }
}
```

MCP **generalizes tool calling** (Foundation Models' `Tool` in 58.10 and Xcode tool plugins in 61.6) into one **common protocol**. You do not need a custom link for each tool. One assistant can work with any MCP service, from crash reports to project management.

---

## 61.10 Reviewing AI-Generated Swift for Concurrency Bugs 🟡

AI code can look right and compile, but still have **concurrency bugs** (Part 2): data races, wrong actor assumptions, or unsafe `@unchecked Sendable`. The bug only appears when the code really runs on several threads.

```swift
// AI-generated code that compiles but may hide a concurrency bug:
class Cache {
    private var storage: [String: Data] = [:]  // not actor-isolated, not Sendable-safe

    func store(_ data: Data, for key: String) {
        storage[key] = data  // if called from multiple concurrent contexts, a data race
    }
}
// A careful reviewer would ask: should this be an actor? Is `storage` genuinely
// only ever mutated from one isolation context, or does that assumption not hold?
```

A safer version makes it an **actor**, so only one task touches the data at a time:

```swift
actor Cache {
    private var storage: [String: Data] = [:]

    func store(_ data: Data, for key: String) {
        storage[key] = data              // safe: the actor allows one caller at a time
    }

    func data(for key: String) -> Data? {
        storage[key]
    }
}

// Callers use await:
await cache.store(data, for: "recipe-1")
```

The compiler catches many concurrency bugs, but **not all**. A generated `class` that should be an `actor` can compile with no warning and still have a real race. Ask about **actor isolation**, **`Sendable`**, and **thread safety**, as you would for any code.

---

## 61.11 Reviewing AI-Generated Swift for Retain Cycles 🟡

A closure that captures `self` can **keep the object alive** and leak memory. This is common in callbacks, `Timer`, and observers. AI code does not avoid it unless it thinks about how long each object lives.

```swift
// AI-generated code that compiles fine but introduces a retain cycle:
class ViewModel {
    var onUpdate: (() -> Void)?

    func startObserving() {
        NotificationCenter.default.addObserver(forName: .someEvent, object: nil, queue: .main) { _ in
            self.onUpdate?()  // strong capture of self — a retain cycle if self holds this observer token
        }
    }
}
// A reviewer should ask: does self's lifetime genuinely need to extend for
// this closure's entire lifetime, or should this capture be [weak self]?
```

The fix: capture `self` **weakly**, and keep the observer token so you can remove it:

```swift
class ViewModel {
    var onUpdate: (() -> Void)?
    private var observer: NSObjectProtocol?

    func startObserving() {
        observer = NotificationCenter.default.addObserver(
            forName: .someEvent, object: nil, queue: .main
        ) { [weak self] _ in            // weak: the closure does not keep self alive
            self?.onUpdate?()
        }
    }

    deinit {
        if let observer { NotificationCenter.default.removeObserver(observer) }
    }
}
```

This bug is easy to miss. A strong `self` **compiles with no warning** and often "works" in a quick test, while it quietly leaks memory. **Always review the captures** in generated closures.

---

## 61.12 Keeping Secrets and Proprietary Code Out of AI Tools 🟡

When you use AI tools, especially cloud ones, ask: **what code and data is sent, and what happens to it?** (How long is it kept? Is it used for training?) This matters most for **API keys, passwords, and private source code**.

```swift
// Practical mitigations:
// - Keep credentials out of source entirely (environment variables, secrets managers,
//   not hardcoded strings a cloud-routed assistant might read as part of file context)
// - Prefer on-device model routing (61.2) for genuinely sensitive files/modules
// - Understand and configure your organization's actual data retention policy
//   for whichever AI tools are in use, rather than assuming a default is safe
```

**1. Keep secrets out of source.** Put them in a file that is not committed (and not read by the AI):

```plaintext
# Secrets.xcconfig  (listed in .gitignore)
API_KEY = your-key-here
```

```swift
// Read it at runtime, from Info.plist (which gets the value from the xcconfig)
let apiKey = Bundle.main.object(forInfoDictionaryKey: "API_KEY") as? String
```

**2. Tell the AI tool not to read them.** In Claude Code, a `.claude/settings.json` file can block files:

```json
{
  "permissions": {
    "deny": ["Read(./.env)", "Read(./Secrets.xcconfig)"]
  }
}
```

**3. Choose on-device routing** (61.2) for very sensitive modules.

This is the **opposite direction** of the risks in section 58 (guardrails in 58.17 and prompt injection in 58.18). There, untrusted content influenced the model. Here, your **sensitive content is sent to** a cloud model in the first place. So choose on-device, or exclude files from the AI's context.

---

## Summary

| Concept | Key Idea | Purpose |
|---|---|---|
| Xcode intelligence | AI in the IDE, aware of your project | Completion, chat, and agentic editing |
| Model choice | On-device vs. Claude vs. Gemini | Match power and privacy to the task |
| Agents | Plan, edit several files, you review | Coordinated changes with a human check |
| Generated views | SwiftUI from a description | A first draft that you review |
| Localization | AI-drafted String Catalog entries | A fast first pass, human review |
| Tool plugins | The assistant calls outside tools | Run a linter, not guess |
| Claude Code | A terminal agent | Runs real build and test commands |
| `CLAUDE.md` | Project facts, written once | Less repeating in each session |
| MCP servers | A standard link to outside systems | Crash reports, designs, issues |
| Concurrency review | Actors and `Sendable` | Compiling code can still race |
| Retain cycle review | `[weak self]` in closures | Compiling code can still leak |
| Secrets | Keep keys out of source and out of the AI's reach | Protect keys and private code |
