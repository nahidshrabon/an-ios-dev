## 75.1 SwiftLint Setup and Rules

SwiftLint statically analyzes Swift source code against a configurable set of style and best-practice rules — from simple formatting conventions to genuinely substantive checks (force-unwrap usage, recall section 68.9's force-unwrap crash discussion; excessive function complexity) — configured via a `.swiftlint.yml` file and typically integrated as a Run Script build phase (recall section 72.5) or Git pre-commit hook (section 74.8).

```plaintext
# .swiftlint.yml
disabled_rules:
  - trailing_whitespace
opt_in_rules:
  - force_unwrapping
  - empty_count
line_length: 120
```

SwiftLint's rule configurability is a genuine strength worth using deliberately rather than accepting defaults uncritically — a rule set that's too permissive misses genuinely valuable checks (like flagging force-unwraps, directly relevant to the crash class discussed in section 68.9), while a rule set that's too strict or pedantic (flagging purely stylistic preferences a team doesn't actually care about) trains developers to routinely ignore or disable lint warnings entirely, undermining the tool's value for the genuinely important checks it could otherwise be catching.

---

## 75.2 SwiftFormat and swift-format

SwiftFormat (a popular third-party tool) and `swift-format` (Apple's own official formatter) both automatically reformat Swift source code to a consistent style — distinct from SwiftLint's detect-and-report approach, formatters directly rewrite code to conform, eliminating entire categories of style debate and manual formatting effort.

```bash
swift-format format --in-place MyFile.swift
# or, via SwiftFormat:
swiftformat MyFile.swift
```

The distinction between a linter (SwiftLint, detecting issues) and a formatter (SwiftFormat/`swift-format`, automatically fixing style) matters for how each tool is best integrated into a workflow — automatic formatting is well suited to running unconditionally on every save or commit (since there's no judgment call involved, just consistent style application), while linting's more substantive checks (like flagging a genuinely risky force-unwrap) benefit from being surfaced for actual developer review and judgment rather than being silently auto-fixed, since not every lint violation has one unambiguous, automatically-correct resolution.

---

## 75.3 Writing Custom Lint Rules 🟠

Beyond SwiftLint's substantial built-in rule set, custom rules (configured via regex-based custom rule definitions, or genuinely more sophisticated rules written as a SwiftLint plugin) let a team encode project-specific conventions that no general-purpose linter would know to check — enforcing a team's own particular architectural patterns or naming conventions automatically.

```yaml
custom_rules:
  no_direct_network_calls_in_views:
    regex: 'struct \w+View.*URLSession'
    message: "Views should not make direct network calls; use a view model (see section 45)"
    severity: warning
```

Custom rules genuinely extend a linter's value beyond generic Swift style concerns into a team's own specific, agreed-upon architectural discipline — a rule flagging direct `URLSession` usage within a `View` type, for instance, encodes and automatically enforces the same view/view-model separation principle discussed throughout this curriculum's architecture material (recall section 45-46), turning what would otherwise be a purely manual code review concern (something a reviewer has to remember to check for every single PR) into an automatically, consistently enforced project convention.

---

## 75.4 Periphery for Dead Code Detection 🟠

Periphery statically analyzes a Swift project to identify genuinely unused code — declarations (functions, properties, types) that are never actually referenced anywhere in the codebase — a distinct concern from SwiftLint's style/convention focus, specifically targeting code that could be safely removed entirely.

```bash
periphery scan --project MyApp.xcodeproj --schemes MyApp
# Output identifies genuinely unreferenced declarations, e.g.:
# "Function 'calculateLegacyDiscount()' is unused"
```

Dead code accumulates in most real, actively-developed codebases over time — a feature gets removed but a helper function it once used gets accidentally left behind, or an experiment gets abandoned leaving orphaned code — and beyond simple codebase tidiness, genuinely unused code carries real, ongoing costs: it adds unnecessary compile time, creates confusion for developers wondering whether a still-present function is actually still relevant, and occasionally represents a genuine, unnoticed security or correctness liability if it's dead precisely because it was quietly broken and nobody noticed since nothing actually calls it.

---

## 75.5 Danger-Swift for PR Automation 🟠

Danger-Swift automates common, repetitive pull request review tasks — checking that a PR includes an updated changelog entry, warning if a PR is unusually large (making it genuinely harder to review thoroughly), or flagging when source changes lack corresponding test changes — running as part of CI and posting its findings as automated PR comments.

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

Automating these specific checks via Danger-Swift frees human reviewers to focus their genuinely limited review time and attention on the things automation fundamentally can't evaluate — actual code correctness, architectural fit, and design quality — rather than spending that same limited attention manually verifying purely mechanical, rule-based concerns (did the changelog get updated, is this PR suspiciously large) that a script can check faster, more consistently, and without the risk of a human reviewer simply forgetting to check for a specific, easily-overlooked concern.

---

## 75.6 Warnings-as-Errors Policy

A warnings-as-errors policy (`SWIFT_TREAT_WARNINGS_AS_ERRORS` build setting) converts compiler warnings into build-breaking errors, forcing warnings to be addressed immediately rather than accumulating silently and indefinitely in a codebase, though this policy carries a genuine trade-off worth considering deliberately rather than adopting reflexively.

```plaintext
// Build setting: SWIFT_TREAT_WARNINGS_AS_ERRORS = YES
// Any compiler warning (deprecated API usage, unused variable, etc.)
// now fails the build entirely rather than merely being noted
```

The genuine trade-off here is real and worth weighing deliberately — warnings-as-errors keeps a codebase genuinely warning-free (since warnings can't be silently ignored and accumulate the way they otherwise tend to), but it can also block a build entirely due to a warning from a third-party dependency that's genuinely outside the team's own control to fix, meaning teams adopting this policy typically need a clear, explicit mechanism (like a targeted, well-documented `@available`-based suppression or a specific, scoped compiler flag exception) for handling exactly this kind of externally-sourced, unfixable-by-the-team warning without either abandoning the policy entirely or being permanently blocked by it.

---

## 75.7 Sourcery for Code Generation 🟠

Sourcery generates Swift source code automatically from templates applied against a project's existing code (using Swift's own reflection-like metadata, examining actual types, protocols, and their members) — appropriate for eliminating genuinely repetitive, mechanically-derivable boilerplate that would otherwise need to be manually written and kept in sync by hand for every relevant type.

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

Sourcery's genuine value is specifically for boilerplate that's mechanically derivable from a type's own existing structure (like automatically generating a mock conforming to any protocol tagged for mocking, directly connecting to the mock/test-double material from sections 65.14 and 66.1) — rather than a developer manually writing and then remembering to keep a hand-written mock synchronized with a protocol's actual method signatures every time the protocol changes, Sourcery regenerates that mechanically-derivable boilerplate automatically and consistently from the protocol's current, actual definition, eliminating an entire class of "the mock is now out of sync with the real protocol" bugs.

---

## Summary

| Concept | Key Tool | Purpose |
|---|---|---|
| Style/convention detection | SwiftLint | Configurable static analysis, from style to substantive checks |
| Automatic reformatting | SwiftFormat, `swift-format` | Eliminates style debate via direct code rewriting |
| Project-specific rules | Custom SwiftLint rules | Automated enforcement of a team's own architectural conventions |
| Unused code detection | Periphery | Surfaces genuinely dead code and its ongoing costs |
| PR automation | Danger-Swift | Frees human review time for judgment-requiring concerns |
| Warning discipline | Warnings-as-errors | Prevents silent warning accumulation, with a real trade-off |
| Boilerplate elimination | Sourcery | Mechanically-derived code generation, kept in sync automatically |
