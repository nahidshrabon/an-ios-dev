**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 75.1 SwiftLint Setup and Rules 🟢

**SwiftLint** checks your Swift code against **rules**: style rules, and also real safety checks like force-unwraps (section 68.9) or functions that are too complex. You configure it in a **`.swiftlint.yml`** file.

```plaintext
# .swiftlint.yml
disabled_rules:
  - trailing_whitespace
opt_in_rules:
  - force_unwrapping
  - empty_count
line_length: 120
```

Install and run it:

```bash
brew install swiftlint
swiftlint                  # report problems
swiftlint --fix            # fix the ones that can be fixed automatically
```

Choose which folders it checks:

```plaintext
# .swiftlint.yml
included:
  - Sources
excluded:
  - Sources/Generated
```

Turn a rule off for **one line** when you have a good reason:

```swift
// swiftlint:disable:next force_unwrapping
let url = URL(string: "https://example.com")!     // a constant we know is valid
```

Run it on every build with a Run Script phase (section 72.5), or before each commit with a Git hook (section 74.8).

**Choose your rules on purpose.** Too few, and you miss real problems like force-unwraps. Too many picky style rules, and people start **ignoring all warnings**, including the important ones.

---

## 75.2 SwiftFormat and swift-format 🟢

A **formatter rewrites your code** into one consistent style. There are two common ones:

- **SwiftFormat:** a popular third-party tool.
- **swift-format:** Apple's official formatter. It comes with the Swift 6 toolchain.

```bash
swift-format format --in-place MyFile.swift
# or, via SwiftFormat:
swiftformat MyFile.swift
```

Format a whole folder, or only check without changing anything:

```bash
swift format --in-place --recursive Sources      # swift-format, via the swift command
swiftformat .                                    # SwiftFormat, the whole project
swiftformat . --lint                             # only report, change nothing (good for CI)
```

Each tool reads a config file in your project:

```plaintext
# .swiftformat  (SwiftFormat)
--indent 4
--maxwidth 120
```

```bash
swift format dump-configuration > .swift-format    # swift-format: create a config file to edit
```

**Linter vs. formatter:**

| | Linter (SwiftLint) | Formatter |
|---|---|---|
| What it does | Finds and reports problems | Rewrites the code |
| Needs judgment? | Often (is this force-unwrap safe?) | No, it only applies a style |
| When to run | Show the problems to a developer | Automatically, on save or commit |

A formatter ends **style debates**: nobody argues about spaces when a tool decides.

---

## 75.3 Writing Custom Lint Rules 🟡

**Custom rules** check your **own team's conventions**, which no general tool knows about. The simplest kind is a **regex** in `.swiftlint.yml`.

```yaml
custom_rules:
  no_direct_network_calls_in_views:
    regex: 'struct \w+View.*URLSession'
    message: "Views should not make direct network calls; use a view model (see section 45)"
    severity: warning
```

Another example: block `print` in app code, so logs go through your logger:

```yaml
custom_rules:
  no_print:
    regex: '\bprint\('
    message: "Use Logger instead of print (see section 80)"
    severity: warning
    included: "Sources/.*\\.swift"
```

When it matches, SwiftLint shows the message like any other warning:

```plaintext
RecipeListView.swift:42:9: warning: Views should not make direct network calls; use a view model (see section 45)
```

The benefit: a rule from your architecture (like "views do not call the network", sections 45 and 46) is **checked automatically on every change**. Reviewers no longer have to remember it for every pull request.

---

## 75.4 Periphery for Dead Code Detection 🟡

**Periphery** finds **unused code**: functions, properties, and types that nothing uses. SwiftLint checks style. Periphery finds code you can **delete**.

```bash
periphery scan --project MyApp.xcodeproj --schemes MyApp
# Output identifies genuinely unreferenced declarations, e.g.:
# "Function 'calculateLegacyDiscount()' is unused"
```

The first time, let it ask you questions and save the answers:

```bash
brew install periphery
periphery scan --setup          # asks for the project and schemes, then saves .periphery.yml
periphery scan                  # later runs use the saved settings
```

Keep code that only other modules use, or mark one declaration on purpose:

```bash
periphery scan --retain-public   # do not report public code (useful for packages)
```

```swift
// periphery:ignore
func debugOnlyHelper() { }       // kept on purpose
```

**Why dead code matters:** a feature is removed but its helper is left behind, or an experiment is abandoned. Unused code costs **build time**, **confuses** people ("is this still used?"), and can hide **bugs** nobody notices because nothing calls it.

---

## 75.5 Danger-Swift for PR Automation 🟡

**Danger-Swift** runs in CI and checks **simple pull request rules** automatically, then posts **comments on the PR**. For example: is the PR too big? Did the changelog change? Did code change without tests?

```swift
// Dangerfile.swift
import Danger

let danger = Danger()

if danger.git.linesOfCode > 500 {
    warn("This PR is quite large (\(danger.git.linesOfCode) lines) — consider splitting it up.")
}

if !danger.git.modifiedFiles.contains("CHANGELOG.md") {
    warn("This PR doesn't update CHANGELOG.md — is that intentional?")
}
```

Check that code changes come with tests:

```swift
let changedSource = danger.git.modifiedFiles.contains { $0.hasPrefix("Sources/") }
let changedTests = danger.git.modifiedFiles.contains { $0.hasPrefix("Tests/") }

if changedSource && !changedTests {
    warn("Source changed, but no tests changed. Should there be a test?")
}
```

`warn` only comments. `fail` blocks the PR:

```swift
fail("Please add a description to this PR.")
```

In CI, run it with `danger-swift ci`.

**Why:** reviewers have limited time. Let a script check the **mechanical** things, so people can focus on what only people can judge: correctness, design, and fit.

---

## 75.6 Warnings-as-Errors Policy 🟢

With **warnings-as-errors**, every compiler warning **fails the build**. Warnings can no longer pile up and be ignored.

```plaintext
// Build setting: SWIFT_TREAT_WARNINGS_AS_ERRORS = YES
// Any compiler warning (deprecated API usage, unused variable, etc.)
// now fails the build entirely rather than merely being noted
```

A common setup: keep warnings normal on your Mac, but **fail in CI**:

```bash
xcodebuild -scheme MyApp build SWIFT_TREAT_WARNINGS_AS_ERRORS=YES
```

Or set it only for **your own targets** in an `.xcconfig` file (section 72.4):

```plaintext
// App.xcconfig
SWIFT_TREAT_WARNINGS_AS_ERRORS = YES
```

**The trade-off:**

- **Good:** the codebase stays free of warnings.
- **Risk:** a warning in a **third-party dependency** that you cannot fix could block your build.

So plan for it: apply the rule to **your targets only**, and decide in advance how to handle a warning that is outside your control.

---

## 75.7 Sourcery for Code Generation 🟡

**Sourcery** generates Swift code from **templates**, based on the types already in your project. Use it for **repetitive code that follows directly from a type**, like mocks for tests.

```swift
// Sourcery template (simplified concept): generate a mock conforming to any protocol
// tagged with a marker comment, automatically producing boilerplate like:
// sourcery: AutoMockable
protocol UserServicing {
    func fetchUser(id: String) async throws -> User
}
// Sourcery generates a corresponding MockUserServicing conforming to the protocol,
// with recording/stubbing support, without a developer manually writing that mock (recall 65.14/66.1)
```

Run it from the command line, or as a build step:

```bash
sourcery --sources Sources --templates Templates --output Sources/Generated
```

The generated mock could look like this:

```swift
// Sources/Generated/AutoMockable.generated.swift
final class MockUserServicing: UserServicing {
    var fetchUserCallCount = 0
    var fetchUserReturnValue: User!

    func fetchUser(id: String) async throws -> User {
        fetchUserCallCount += 1
        return fetchUserReturnValue
    }
}
```

**Why:** a hand-written mock (sections 65.14 and 66.1) goes **out of sync** when the protocol changes. Sourcery **regenerates it** from the current protocol, so they always match.

Today, **Swift macros** (section 13) can also generate some of this code, directly in the compiler, without a separate tool.

---

## Summary

| Concept | Key Tool | Purpose |
|---|---|---|
| Linting | SwiftLint | Find style problems and real risks |
| Formatting | SwiftFormat, `swift-format` | Rewrite code into one style |
| Team rules | Custom SwiftLint rules | Check your own conventions automatically |
| Dead code | Periphery | Find code you can delete |
| PR automation | Danger-Swift | Let a script check the simple PR rules |
| Warnings | Warnings-as-errors | No pile of ignored warnings |
| Code generation | Sourcery | Generated code that stays in sync |
