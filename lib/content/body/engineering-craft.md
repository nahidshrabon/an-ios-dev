**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

All the sections before this one were about **code**. This last one is about everything **around** the code: judgment, communication, and career habits. They decide whether your skill turns into **shipped software**, a **healthy team**, and a **good career**.

This is a 10-minute tour. Each part ends with **More** links for when you want the details.

## 82.1 Writing a technical design document 🟡

A **design doc** (or **RFC**, "Request for Comments") puts a decision on paper so others can **critique it before you write code**, while changes are still cheap.

```markdown
# Design: Offline support for the recipe list
## Problem         18% of sessions start offline and see an empty list.
## Constraints     6 weeks, 2 iOS engineers.
## Alternatives    1. Cache JSON  2. SwiftData + sync  3. A sync SDK
                   (each with honest pros and cons)
## Recommendation  Option 2, and why.
## Out of scope    Conflict resolution UI.
```

**What matters most is honest alternatives.** One real option plus two weak "straw men" means the decision was already made. A good test: a reader can **disagree with the conclusion using only the doc**. It is the same honest comparison as MVVM vs MVC vs TCA in section 46.

**More:** [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/)

---

## 82.2 Architecture decision records 🟢

An **ADR** is a **short, permanent note** about **one decision**: the context, the decision, and its consequences. You write it **when the decision is made** and **never edit it**. If the decision changes, a **new ADR replaces** the old one.

```plaintext
docs/adr/
├── 0014-adopt-async-await-for-networking.md
└── 0015-replace-0009-analytics-vendor.md     ← supersedes ADR-0009
```

| | Design doc (82.1) | ADR |
|---|---|---|
| When | **Before** a decision | **When** it is decided |
| Changes | Edited during review | Never edited, only replaced |

Six months later, anyone can see **why the code looks this way**. It is a good commit message (section 74) for a whole architecture decision.

**More:** [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) · [adr.github.io](https://adr.github.io/)

---

## 82.3 Code review: what to block on vs comment on 🟢

Every review comment is either **blocking** (a real bug, a security problem, breaking an agreed rule) or **non-blocking** (a preference or an idea). **Say clearly which one it is.** Prefixes help:

```plaintext
blocking:   This deletes the user's drafts when sync fails. Please keep them.
question:   Why a class here instead of a struct? (Just curious.)
nit:        Typo in the doc comment: "recieve".
suggestion: We could reuse `RecipeFormatter` here. Fine as a follow-up.
```

**Let tools check the objective things:** formatting, lint rules (section 75), and tests in CI (section 76). Humans then focus on what only humans can judge: does the design fit, are the edge cases right, and does it solve the real problem?

**More:** [Google's code review guide](https://google.github.io/eng-practices/review/) · [Conventional Comments](https://conventionalcomments.org/)

---

## 82.4 Estimation and breaking down epics 🟡

A big, vague task (an **epic**) is hard to estimate. **Split it** into pieces of about **one or two days** each.

```plaintext
Epic: Migrate recipes from Core Data to SwiftData
  1. Define @Model types                                  1 day
  2. Replace the list fetch with @Query                   1 day
  3. SPIKE: how do we move existing users' data?          max 2 days  (output: a write-up, not code)
  4. Data migration                                       estimate AFTER the spike
```

**For an unknown, don't guess a confident number.** Add a **time-boxed spike** (a short research task) first. The most common reason estimates go badly wrong: **an unknown was treated as a well-defined task**.

**More:** [What are agile spikes?](https://www.mountaingoatsoftware.com/agile/what-are-agile-spikes)

---

## 82.5 Managing tech debt and negotiating time for it 🟡

**Tech debt** is often a **deliberate trade-off**: ship now, fix later. It becomes a problem when it's **hidden**. So **name it** when you take it on, **track it**, and **show its cost**. Describe it in terms a non-engineer can act on:

```plaintext
❌ "We have tech debt in the networking layer."
✅ "The networking layer has no retry logic. That caused 3 of our last 5
    incidents. Fixing it takes about one sprint."
```

A **concrete cost** and a **concrete ask** get time; "the code is messy" doesn't.

**More:** [Technical Debt Quadrant](https://martinfowler.com/bliki/TechnicalDebtQuadrant.html)

---

## 82.6 Incident response for mobile 🟡

The big difference from servers: **you can't instantly roll back an app** that users already installed. So mobile teams rely on:

- **Feature flags and kill switches** to turn a broken feature off remotely (section 80).
- **Server-side fixes** that limit the damage without a new build.
- **Phased release** (section 78.11), which limits how many users got the bad version.
- In the worst case, an **expedited App Review** for a fixed build.

```swift
if featureFlags.isEnabled(.newSyncEngine) {
    try await NewSyncEngine().sync()     // new, risky path
} else {
    try await LegacySync().sync()        // old, known-good path
}
// Incident? Turn the flag off on the server. Fixed in minutes, no new build.
```

The steps: **detect, assess, mitigate, communicate, learn** (with a postmortem, 82.8). Decide **in advance** which risky code needs a flag.

**More:** [Managing incidents (Google SRE)](https://sre.google/sre-book/managing-incidents/) · [Phased release](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases/)

---

## 82.7 Rollback vs hotfix vs server-side mitigation 🔴

| Tool | Speed | Limit |
|---|---|---|
| **Server-side mitigation** (flag off, change a response) | Minutes | Can't fix pure client bugs |
| **Hotfix build** (expedited review) | Hours to days | Users must update |
| **"Rollback"** | Minutes | Only stops **more** users from getting it |

On iOS, **"rollback" means pausing the phased release**. Apple can't remove a version from phones that already have it.

**The judgment:** pick the **fastest fix that matches how bad it is**. Severe and widespread: use the fastest tool now, then follow with a proper hotfix. Small and narrow: a careful hotfix can be better than a rushed workaround.

**More:** [App Review and expedited reviews](https://developer.apple.com/distribute/app-review/)

---

## 82.8 Writing a blameless postmortem 🟢

A **postmortem** asks, after an incident, **why the system allowed it**. **Blameless** means you look for gaps in the process and tools, not a person to blame:

```plaintext
❌ Blame:     "Sam forgot to renew the push certificate."
✅ Blameless: "Renewal depended on someone remembering. Nothing alerted before it expired."
```

The first leads to "be more careful" and the same incident next year. The second leads to a **real fix**: an automatic expiry alert. Blameless is not about being nice. It's what makes people **share the full, honest details**, and you need those to find the real gap.

A good postmortem has a **timeline**, the **root cause**, **what went well and what didn't**, and **action items with owners**.

**More:** [Postmortem culture (Google SRE)](https://sre.google/sre-book/postmortem-culture/)

---

## 82.9 Mentoring junior developers 🟡

Mentoring is less about **facts** (juniors can look those up) and more about **judgment**. **Ask questions instead of giving answers**, so they reason it out:

```plaintext
❌ "You forgot error handling."
✅ "What happens if this network call fails halfway? What does the user see?"
```

Code review (82.3) is a great place for this. Explain the **why**, not only the **what**: "use `[weak self]`" teaches obedience, but "self → timer → closure → self is a retain cycle" teaches judgment.

**More:** [How to write code review comments](https://google.github.io/eng-practices/review/reviewer/comments.html) · [Asking good questions](https://jvns.ca/blog/good-questions/)

---

## 82.10 Designing an iOS interview loop 🔴

Start from **what the job needs every day**, and pick formats that **predict success in it**:

| Interview | Tests | Instead of |
|---|---|---|
| Practical Swift and SwiftUI coding | Building a real feature | Algorithm puzzles |
| Mobile system design | Offline sync, caching, data flow | Generic whiteboarding |
| Code review of a PR with planted bugs | Judgment (82.3) | Raw coding speed |
| Past project deep dive | Real trade-offs | Memorized answers |

Score with a **rubric** so interviewers grade the same way. **The failure to avoid:** a loop that's easy to run but **doesn't predict the real job**, like puzzles only.

---

## 82.11 Preparing for an iOS technical interview 🟢

Practice **realistic iOS problems** and **trade-offs**: which concurrency approach, how to fix a slow SwiftUI list, which architecture for which app size. For open design questions, think out loud in this shape:

```plaintext
1. Clarify     "Offline? How many items? Which iOS versions?"
2. Options     "Two approaches: A and B."
3. Trade-offs  "A is simpler; B handles offline but costs more."
4. Choose      "I'd pick B, because offline is a must."
5. Risks       "The hard part is sync conflicts."
```

**Practice speaking, not just knowing.** Explaining trade-offs under time pressure is its own skill. Rehearse it with a partner.

**More:** [iOS interview questions (Hacking with Swift)](https://www.hackingwithswift.com/interview-questions)

---

## 82.12 Building a portfolio that gets callbacks 🟢

**A few deep projects beat many shallow ones.** One app with real architecture, tests, and a README that explains **decisions** says more than ten tutorial copies:

```markdown
## Decisions
- SwiftData over Core Data: iOS 17+ only, simple models. I accept less control over migrations.
- async/await everywhere: no Combine, easier tests.
## Deliberately left out
- iPad layout: planned next.
```

Show the signals of maturity: **tests**, **accessibility**, and **what you left out, and why**.

---

## 82.13 Staying current: Swift Evolution, WWDC, forums 🟢

| Source | What you get |
|---|---|
| **Swift Evolution** (section 16) | **What** changes in Swift and **why** |
| **WWDC** sessions | New platform features and APIs |
| **Swift Forums** | Debates **before** decisions are final |

**Triage, don't consume everything.** Go **deep** on what affects your app, **skim** the rest, and skip what isn't your platform. Try each important change in a **playground** yourself.

**More:** [Swift Evolution](https://www.swift.org/swift-evolution/) · [WWDC videos](https://developer.apple.com/videos/) · [Swift Forums](https://forums.swift.org/)

---

## 82.14 Contributing to Swift open source 🟡

Contributing to **Swift**, or to packages like Vapor and swift-log (section 81), is **open to everyone**. Start small:

- Fix a **documentation** gap.
- **Reproduce** a bug report with a tiny, complete example (versions, smallest code, expected vs actual).
- Take an issue marked **"good first issue"**.

The real benefit isn't your résumé. Reading **production code** by the people who designed the language teaches you **why** things are built the way they are.

**More:** [Contributing to Swift](https://www.swift.org/contributing/) · [Swift's CONTRIBUTING guide](https://github.com/swiftlang/swift/blob/main/CONTRIBUTING.md)

---

## 82.15 Technical writing and conference speaking 🟢

Explaining your work clearly helps people who never worked with you, and **builds a reputation that opens doors**. **Write about a problem right after you solve it**, while the reasoning is fresh:

```markdown
# Why our list stuttered on scroll (and the fix)
1. The symptom   30 fps on iPhone 12
2. The search    what I tried; what didn't work
3. The cause     a new DateFormatter for every row
4. The fix       one shared formatter: 60 fps
5. The lesson    what I'd do differently
```

Use **real code and real numbers**. **Honest stories**, including decisions that didn't work, teach more and earn more trust than polished success stories.

**More:** [Google's technical writing courses](https://developers.google.com/tech-writing)

---

## Summary

| Subtopic | Core idea |
|---|---|
| 82.1 Technical design docs | Honest alternatives, so readers can really disagree |
| 82.2 Architecture decision records | A short, permanent record of one decision |
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

This is the end of the curriculum. From here, you **use all of it**, in real codebases, over a real career.
