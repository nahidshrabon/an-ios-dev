**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

All the sections before this one were about **code**. This last section is about everything **around** the code: judgment, communication, and career habits. They decide whether your technical skill turns into **shipped software**, a **healthy team**, and a **good career**.

This is not optional polish. A great architecture that nobody can review, or an incident nobody knows how to handle, wastes everything you learned in the previous 81 sections.

## 82.1 Writing a technical design document 🟡

A **technical design document** (also called a **design doc** or **RFC**, "Request for Comments") moves a decision **out of your head** and onto paper, so others can **critique it before you write code**. That is when changes are still cheap.

A good design doc covers:

```markdown
# Design: Offline support for the recipe list

## Problem
Users on the subway see an empty list. 18% of sessions start offline.

## Constraints
- Must ship in 6 weeks with 2 iOS engineers.
- Existing networking layer stays (section 39).

## Alternatives
1. Cache JSON responses on disk
   + Small change, 1 week
   – No offline edits; cache can go stale
2. SwiftData as the local source of truth (section 41)
   + Offline reads and edits, fast UI
   – Needs a sync layer, 4 weeks
3. Third-party sync SDK
   + Sync is done for us
   – New dependency, vendor lock-in, cost

## Recommendation
Option 2. Offline edits are the top user request, and it fits in 6 weeks.

## Out of scope
Conflict resolution UI. We use "last write wins" for now.
```

**The part that matters most is honest alternatives.** If a doc shows one real option and two weak "straw men" (options made weak on purpose so they lose), it is not asking for feedback. The decision was already made.

**A test for a good doc:** a reader can **disagree with the conclusion using only the doc**, without a hallway chat to learn what was considered. This is the same honest comparison as the architecture patterns in section 46 (MVVM vs MVC vs TCA), where each option had real costs and benefits.

---

## 82.2 Architecture decision records 🟢

An **architecture decision record (ADR)** is a **short, permanent note** about **one important decision**. You write it **when the decision is made**, and you **never edit it**. If the decision changes later, you write a **new ADR** that replaces the old one.

```markdown
# ADR-014: Adopt async/await for new networking code

## Context
New networking code has been split between completion-handler and Combine-based
APIs (see section 39-40), creating inconsistent call-site patterns and testing
difficulty.

## Decision
All new networking code will use async/await (section 17-18). Existing
completion-handler APIs will be wrapped via withCheckedThrowingContinuation
rather than rewritten immediately.

## Consequences
- New code is more testable and readable.
- A transition period with mixed styles is accepted as a known cost.
- Existing Combine publishers exposed to SwiftUI (section 25) are not
  migrated in this pass.
```

The code that this ADR asks for, wrapping an old API instead of rewriting it:

```swift
// Old API, kept as is for now
func fetchRecipes(completion: @escaping (Result<[Recipe], Error>) -> Void) { /* ... */ }

// New async wrapper, as decided in ADR-014
func fetchRecipes() async throws -> [Recipe] {
    try await withCheckedThrowingContinuation { continuation in
        fetchRecipes { result in
            continuation.resume(with: result)
        }
    }
}
```

Keep ADRs **in the repository**, numbered, next to the code:

```plaintext
docs/adr/
├── 0013-use-swiftdata-for-local-storage.md
├── 0014-adopt-async-await-for-networking.md
└── 0015-replace-0009-analytics-vendor.md     ← supersedes ADR-0009
```

| | Design doc (82.1) | ADR |
|---|---|---|
| When | **Before** a decision | **When** it is decided |
| Purpose | Debate the options | Record what was decided and why |
| Changes | Edited during review | Never edited, only replaced |

**Why it helps:** six months later, someone can understand **why the code looks this way**, without digging through old pull requests and chat. It is the same idea as a good commit message (section 74), but for a whole architecture decision.

---

## 82.3 Code review: what to block on vs comment on 🟢

Every review comment is one of two kinds. Mixing them up causes a lot of friction.

- **Blocking:** must change before merge. A real bug, a security problem, or breaking an agreed convention or ADR.
- **Non-blocking:** worth saying, but not required. A style preference, a "have you considered...?", or a refactor for later.

```plaintext
// Blocking: genuine correctness issue
"This force-unwrap will crash if the network request fails before
this view appears — see section 4's optional-handling guidance."

// Non-blocking: worth raising, not worth blocking
"Nit: I'd probably extract this into a computed property, but not
blocking — up to you."
```

**Say clearly which kind each comment is.** Many teams use simple prefixes:

```plaintext
blocking:   This deletes the user's drafts when sync fails. Please keep them.
question:   Why a class here instead of a struct? (Not blocking, just curious.)
nit:        Typo in the doc comment: "recieve".
suggestion: We could reuse `RecipeFormatter` here. Fine as a follow-up.
praise:     Nice test for the empty state!
```

A blocking comment should show the problem and a fix:

```swift
// blocking: crashes when `recipes` is empty
let first = recipes.first!

// suggestion:
guard let first = recipes.first else { return .empty }
```

**Let tools handle the objective things.** Formatting, lint rules (section 75), and tests in CI (section 76) should catch these automatically. Then human reviewers can spend their time on what only humans can judge: **does the design fit, is it correct in edge cases, and does it really solve the problem?**

---

## 82.4 Estimation and breaking down epics 🟡

A big, vague task (an **epic**), like "redesign settings" or "migrate to SwiftData", is **hard to estimate** because its size is unknown. The fix: **split it** into pieces small enough to estimate with confidence, usually **one or two days** each.

```plaintext
Epic: Migrate recipes from Core Data to SwiftData

  ✅ Known work (can estimate):
     1. Define @Model types for Recipe and Ingredient          1 day
     2. Replace the list screen's fetch with @Query             1 day
     3. Replace the detail screen's save logic                  2 days
     4. Tests for the new model layer                           1 day

  ❓ Unknown (can't estimate yet):
     5. SPIKE: how do we move existing users' Core Data store?  max 2 days
        Deliverable: a short write-up + a prototype, not shipped code
     6. Data migration (estimate AFTER the spike)               ?
```

There are two kinds of uncertainty:

- **Known unknowns:** clear tasks. You know what to do, you just estimate the time.
- **Unknown unknowns:** the scope depends on something you **have not investigated yet**, like how an unfamiliar API really behaves.

**For an unknown, don't guess a confident number.** Create a small, **time-boxed spike** (a short research task). Its result is **knowledge**, not a shipped feature (for example, how to move a Core Data store, section 42). After the spike, you can estimate the rest.

**The most common reason estimates are very wrong:** an unknown was treated as if it were a known, well-defined task.

---

## 82.5 Managing tech debt and negotiating time for it 🟡

**Technical debt** is not always a mistake. Often it is a **deliberate trade-off**: ship now with a known shortcut, fix it later. It becomes a problem when it is **hidden** and grows silently.

Treat it like **real debt**:

1. **Name it when you take it on**, ideally in an ADR (82.2).
2. **Track it** where the team plans work.
3. **Show its cost** regularly to whoever decides priorities.

Mark the shortcut in code, and link it to a ticket:

```swift
// TECH-DEBT(#412): no retry on network errors; shipped this way for the
// March launch. Fix: add RetryPolicy (section 40). Owner: iOS team.
func loadFeed() async throws -> Feed {
    try await api.get("/feed")
}
```

A simple **debt register** the team can review:

| Item | Cost today | Fix effort | Priority |
|---|---|---|---|
| No retry in networking | 3 of the last 5 incidents | 1 sprint | High |
| Old image cache | ~200 MB memory spikes | 3 days | Medium |
| Two date formatters | Small bugs in some locales | 1 day | Low |

**The key skill: describe debt in terms a non-engineer can act on.**

```plaintext
❌ "We have tech debt in the networking layer."

✅ "The networking layer has no retry logic. That caused 3 of our last 5
    production incidents. Fixing it takes about one sprint."
```

The second version has a **concrete cost** and a **concrete ask**. It is the same idea as performance budgets (section 69.19): numbers like incidents, hours, and failed requests are much easier to get time for than "the code is messy".

---

## 82.6 Incident response for mobile 🟡

Mobile incidents have one big difference from server incidents: **you can't instantly roll back an app** that users already installed. A server can go back to the old version in minutes. A bad app version stays on users' phones.

So mobile teams need other tools:

- **Feature flags / kill switches** to turn off a broken feature remotely (section 80.10 and 80.11).
- **Server-side fixes** that limit the damage without a new build.
- In the worst case, an **expedited App Review** for a fixed build (section 78).

A feature flag is what makes the fast fix possible:

```swift
if featureFlags.isEnabled(.newSyncEngine) {
    try await NewSyncEngine().sync()     // the new, risky code path
} else {
    try await LegacySync().sync()        // the old, known-good path
}
// Incident? Turn off "newSyncEngine" on the server. Fixed in minutes, no new build.
```

The usual steps:

```plaintext
1. Detect       Crash reports, analytics, alerts (section 80)
2. Assess       How bad? What % of users? (phased release limits this, 78.11)
3. Mitigate     The fastest safe fix: flag off, server change, or hotfix build
4. Communicate  Post status updates to stakeholders the whole time
5. Learn        Write a blameless postmortem (82.8)
```

**Plan before the incident happens.** A bug behind a remote flag is fixed **in minutes**. The same bug with no flag can take **days** to reach users through App Review. So decide **in advance** which risky code paths need a flag.

---

## 82.7 Rollback vs hotfix vs server-side mitigation 🔴

During an incident you have **three different tools**. Each trades **speed** against **completeness**.

| Tool | Speed | What it can fix | Limit |
|---|---|---|---|
| **Server-side mitigation** (flag off, change a response, throttle an endpoint) | Minutes | Only behavior the server controls | Can't fix pure client bugs |
| **Hotfix build** (a new version with a small fix, expedited review) | Hours to a day or more | Any client bug | Slow; users must update |
| **"Rollback"** (pause the phased release, 78.11) | Minutes | Stops **more** users from getting the bad version | Doesn't fix users who already updated |

On mobile, **"rollback" usually means pausing the rollout**. Apple can't "un-release" a version that users already downloaded.

A server-side mitigation example: the app crashes on a new field in the JSON, so the server stops sending it to old app versions:

```swift
// Server (Vapor): only send the new field to app versions that understand it
app.get("recipes") { req async throws -> [RecipeDTO] in
    let version = req.headers.first(name: "X-App-Version") ?? "0"
    let includeNutrition = version.compare("5.2.1", options: .numeric) != .orderedAscending
    return try await recipes(includeNutrition: includeNutrition)
}
```

**The judgment call:** pick the **fastest path that matches how bad it is**.

- **Severe and widespread:** use the fastest tool you have, even if it only partly fixes it. Then follow with a proper hotfix.
- **Small and narrow:** it can be fine to wait for a proper hotfix, instead of a rushed, risky server workaround.

---

## 82.8 Writing a blameless postmortem 🟢

A **postmortem** looks at an incident after it is over: what happened, and **why the system and process allowed it**. A **blameless** postmortem does this **without blaming a person**. The idea: a good engineer, following the process as they understood it, made reasonable choices. The useful question is **what in the process, tools, or system** let this happen.

```markdown
# Postmortem: Push notification delivery failure, 2026-08-15

## Timeline
14:02 - Deploy of notification service v2.3
14:15 - Delivery success rate drops from 98% to 12%
14:40 - Alert threshold triggered, on-call engineer paged
15:10 - Root cause identified: expired push certificate not rotated
15:25 - Certificate rotated, delivery restored

## Root cause
Certificate expiration was not tracked in the deployment checklist,
and no automated expiration alert existed (contrast with the code
signing lifecycle discussion in section 77.7).

## What went well
Alerting caught the issue within 25 minutes of the drop.

## What didn't go well
No automated pre-expiration warning existed; the checklist gap had
existed for over a year without causing an incident.

## Action items
- Add automated certificate-expiration alerting (owner: X, due: date)
- Add certificate status to the pre-release checklist from section 78.8
```

Compare the wording:

```plaintext
❌ Blame:     "Sam forgot to renew the certificate."
✅ Blameless: "Certificate renewal depended on someone remembering.
               Nothing reminded us, and nothing alerted before it expired."
```

The first one ends with "Sam should be more careful", and the same thing happens again next year. The second one leads to a **real fix**: an automatic alert.

**Blameless is not about being nice.** It is what makes people **tell the full truth**. If people fear blame, they hide details and blur the timeline, and the action items get worse. Honest details are the only way to find the **real system gap** (here: no automatic expiry alert).

---

## 82.9 Mentoring junior developers 🟡

Good mentoring is less about **facts** (a junior can often look them up faster than you can explain) and more about **judgment**: seeing early that an approach will cause trouble three steps later.

**The best tool is questions, not answers.** A question makes the junior **reason it through themselves**, and that understanding sticks.

```plaintext
❌ Answer:   "You forgot error handling."

✅ Question: "What happens if this network call fails halfway through?
              What does the user see?"
```

The question leads them to find the error-handling gap themselves (section 9).

**Code review (82.3) is one of the best places to mentor**, because it is about **real code** they care about. Explain the **why**, not only the **what**:

```swift
// Review comment that only says WHAT:
// "Use [weak self] here."

// Review comment that explains WHY:
// "This closure is stored by `timer`, and `timer` is owned by self.
//  self → timer → closure → self is a retain cycle (section 10),
//  so this view model is never freed. [weak self] breaks the cycle."
timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
    self?.tick()
}
```

Comments that only say "change this" teach people to **obey**. Comments that explain why build **real judgment** over time.

---

## 82.10 Designing an iOS interview loop 🔴

An **interview loop** is the set of interviews a candidate goes through. Design it by starting from **what the job really needs every day**, then choose interview formats that **predict success in that job**. Don't just use the format that is easiest to run.

For a senior iOS role on a consumer app, a good loop might be:

| Interview | What it tests | Instead of |
|---|---|---|
| Practical coding in Swift and SwiftUI | Building a real feature | Abstract algorithm puzzles |
| Mobile system design | Offline sync, caching, data flow (sections 41, 44) | Generic distributed-systems whiteboarding |
| Code review exercise | Judgment (82.3) | Raw coding speed |
| Past project deep dive | Trade-offs they really made | Memorized answers |

For the code review round, give the candidate a pull request with **planted problems**:

```swift
// Planted issues for the candidate to find:
final class FeedViewModel: ObservableObject {
    @Published var items: [Item] = []

    func load() {
        URLSession.shared.dataTask(with: feedURL) { data, _, _ in
            self.items = try! JSONDecoder().decode([Item].self, from: data!)  // 1. force-unwrap + try!
        }.resume()                                                             // 2. UI update off the main thread
    }                                                                          // 3. no error state for the user
}
```

Score answers with a **rubric**, so different interviewers grade the same way:

```plaintext
Code review round
  Strong:  finds the crash risks, the threading bug, and the missing error state;
           explains the user impact; suggests async/await + @MainActor
  OK:      finds the crash risks; misses the threading bug
  Weak:    only comments on naming and style
```

**The failure to avoid:** a loop that is easy to run and score, but **does not predict job success**. Pure algorithm puzzles say little about working in a big existing codebase, handling unclear requirements, or making architecture trade-offs (section 46). A format that is harder to score, like a realistic take-home with a clear rubric, is worth it **if it measures the real job**.

---

## 82.11 Preparing for an iOS technical interview 🟢

As a **candidate**, prepare like the loop in 82.10: practice **realistic iOS problems**, not only algorithm puzzles.

Be ready to talk about **trade-offs** across this curriculum:

- Which concurrency approach fits a situation, and why (sections 17 to 22)
- How to find and fix a SwiftUI performance problem (sections 29 and 69)
- Which architecture fits an app of a given size (sections 45 and 46)

A useful shape for answering an open design question out loud:

```plaintext
1. Clarify      "Should it work offline? How many items? Which iOS versions?"
2. Options      "Two approaches: A ... and B ..."
3. Trade-offs   "A is simpler but ...; B handles offline but costs ..."
4. Choose       "I'd pick B, because offline is a must here."
5. Risks        "The hard part is sync conflicts. I'd start with last-write-wins."
```

A strong answer rarely has **one "correct" architecture**. It shows the **options-and-trade-offs reasoning** of a design doc (82.1), spoken out loud, in real time.

**Practice speaking, not just knowing.** Explaining trade-offs clearly under time pressure is a **separate skill** from knowing the material. Rehearse it, ideally with a partner who pushes back like a real interviewer.

---

## 82.12 Building a portfolio that gets callbacks 🟢

A portfolio that gets **interview callbacks** shows **depth on a few real projects**, not many shallow ones. One app with real architecture decisions, tests, and a clear README tells a hiring manager much more than ten copies of tutorials.

**Show your reasoning, not only the result.** A good README explains the **decisions**:

```markdown
# RecipeBox

A recipe app with offline editing and iCloud sync.

## Architecture
MVVM with a repository layer. SwiftData for local storage.

## Decisions
- **SwiftData over Core Data** (section 41/42): iOS 17+ only, and the models
  are simple. I accept less control over migrations.
- **async/await everywhere** (section 17): no Combine, easier tests.

## Testing
48 unit tests (Swift Testing), 6 UI tests for the main flows.

## Accessibility
Full VoiceOver labels and Dynamic Type support (section 70).

## Deliberately left out
- Sharing between users: needs CloudKit sharing; out of scope.
- iPad layout: planned next.
```

This shows the same **judgment** an interview loop (82.10) tries to measure, **before the interview even starts**.

Signals of maturity that a polished-looking but undocumented app does not show:

- **Tests** (sections 65 to 67)
- **Accessibility** support (section 70)
- A clear note on **what you left out, and why**

---

## 82.13 Staying current: Swift Evolution, WWDC, forums 🟢

Swift and Apple's platforms change fast. Staying current is **a skill to practice on purpose**.

| Source | What you get |
|---|---|
| **Swift Evolution** proposals (section 16) | **What** changes and **why**, including rejected alternatives |
| **WWDC** sessions | New platform features and APIs |
| **Swift Forums** | Debates on proposals **before** they are final |

**Triage, don't consume everything.** You don't need every proposal or every WWDC video. Go **deep** on what affects your work, and stay **lightly aware** of the rest.

```plaintext
My triage after WWDC:
  Deep (watch fully, try in code):
    - What's new in Swift            → we use strict concurrency
    - What's new in SwiftUI          → our whole UI
  Skim (read a summary):
    - What's new in RealityKit       → not in our app
  Skip for now:
    - Embedded Swift on new boards   → not our platform
```

A small habit helps: try each important change in a **playground** right away:

```swift
// Trying SE-0453 (InlineArray, Swift 6.2) in a playground before using it in the app
var scores: InlineArray<3, Int> = [90, 75, 82]   // fixed size, stored inline, no heap
scores[1] = 80
print(scores.count)   // 3 — check the behavior yourself, instead of trusting a summary
```

---

## 82.14 Contributing to Swift open source 🟡

Contributing to **Swift itself**, or to big packages like Vapor or swift-log (section 81), is **open to everyone**, not only experts.

You don't start by building a big language feature. Good first contributions are small:

- Fix a **documentation** gap.
- **Reproduce** an existing bug report with a small, clear example.
- Implement a small change that a maintainer marked **"good first issue"**.

A great bug reproduction is short and complete:

```swift
// Minimal reproduction for issue #1234 (the format to copy; this bug is made up)
// Swift 6.2, Ubuntu 24.04
import Foundation

let formatter = DateFormatter()
formatter.dateFormat = "yyyy-MM-dd"
formatter.locale = Locale(identifier: "en_US_POSIX")
print(formatter.date(from: "2026-02-30") as Any)
// Expected: nil (February 30 does not exist)
// Actual:   Optional(2026-03-02 00:00:00 +0000)
```

It has the **versions**, the **smallest code** that shows the problem, and **expected vs actual** output.

The usual workflow:

```bash
git clone https://github.com/apple/swift-log.git
cd swift-log
swift build && swift test           # make sure everything passes first
git switch -c fix-docs-typo
# ...make the change...
swift test
git commit -m "Fix typo in Logger documentation"
# push to your fork and open a pull request
```

**The real benefit is not your résumé.** Reading and changing **production-quality code** written by the people who designed the language teaches you **why** things are built the way they are: trade-offs, history, and old mistakes being fixed. No blog post gives you that.

---

## 82.15 Technical writing and conference speaking 🟢

**Writing and speaking** about your work is a separate skill from doing the work, and it **pays off over a whole career**. When you explain a hard problem clearly (in a blog post, a design doc, or a talk), you help people who never worked with you, and you build a reputation that opens doors.

**The best habit: write about a problem right after you solve it**, while the reasoning is fresh. It is the same instinct as a postmortem (82.8) or an ADR (82.2), but for people **outside** your team.

A simple structure for a technical post:

```markdown
# Why our list stuttered on scroll (and the fix)

1. The symptom   — what users saw, with a number (e.g. 30 fps on iPhone 12)
2. The search    — what I tried; what didn't work (section 68)
3. The cause     — the real reason, with a small code example
4. The fix       — the change, and the before/after numbers (section 69)
5. The lesson    — what I'd do differently next time
```

Include **real code** and **real numbers**:

```swift
// Before: a new DateFormatter for every row (slow)
func dateText(for item: Item) -> String {
    let formatter = DateFormatter()          // created again for every row
    formatter.dateStyle = .medium
    return formatter.string(from: item.date)
}

// After: one shared formatter, created once (scrolling went from ~30 to 60 fps)
private static let formatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateStyle = .medium
    return formatter
}()

func dateText(for item: Item) -> String {
    Self.formatter.string(from: item.date)
}
```

**Honest stories work best.** A post about a hard debugging session, a surprising performance fix, or a decision that **did not work** teaches more, and earns more trust, than a perfect "how we built X" story with the hard parts removed.

---

## Summary

| Subtopic | Core idea |
|---|---|
| 82.1 Technical design docs | Honest alternatives, so readers can really disagree |
| 82.2 Architecture decision records | A short, permanent, dated record of one decision |
| 82.3 Code review: block vs comment | Say clearly what blocks and what is optional |
| 82.4 Estimation and epics | Split work small; turn unknowns into time-boxed spikes |
| 82.5 Managing tech debt | Name debt, track it, and show its cost in numbers |
| 82.6 Incident response for mobile | Apps can't be rolled back; flags and server fixes matter |
| 82.7 Rollback vs hotfix vs server mitigation | Pick the fastest fix that matches the severity |
| 82.8 Blameless postmortems | No blame, so people share the full truth |
| 82.9 Mentoring juniors | Ask questions; explain the why in reviews |
| 82.10 Designing an interview loop | Test the real job, not easy-to-score puzzles |
| 82.11 Interview preparation | Practice explaining trade-offs out loud |
| 82.12 Portfolio that gets callbacks | A few deep projects with documented decisions |
| 82.13 Staying current | Triage Evolution, WWDC, and forums by relevance |
| 82.14 Contributing to Swift OSS | Start small; learn from production code |
| 82.15 Technical writing and speaking | Write while it's fresh; share honest trade-offs |

This is the end of the curriculum. Sections 1 to 82 went from Swift basics through concurrency, SwiftUI and UIKit, data and architecture, platform frameworks, on-device AI, graphics, quality, tooling and shipping, and finally the craft around all of it. There is no next section. From here, you **use all of it**, in real codebases, over a real career.
