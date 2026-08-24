Every section before this one has been about code: language features, frameworks, architecture, testing, tooling, deployment. This final section is about everything that surrounds the code — the judgment, communication, and career practices that determine whether all that technical skill actually turns into shipped software, a healthy team, and a sustainable career. None of this is optional polish. A brilliant architecture that nobody can review, an incident nobody knows how to respond to, or a career that stalls because nobody ever learns how to communicate their work — each of these squanders the technical depth built across the previous 81 sections. Engineering craft is what makes that depth actually count.

## 82.1 Writing a technical design document

A technical design document (sometimes called an RFC or a design doc) exists to move a decision from someone's head into a form other people can actually critique before code gets written, when changes are cheap. A good design doc typically covers, in some order: the problem being solved and why it matters now, the constraints (existing architecture, deadlines, team size), two or three genuinely considered alternatives with honest trade-offs, the recommended approach, and what's explicitly out of scope.

The discipline that separates a useful design doc from a rubber-stamp formality is the honest treatment of alternatives. A doc that presents one option and calls the other two straw men isn't inviting real feedback — it's performing due diligence after the decision was already made. A design doc worth writing should make a reader capable of disagreeing with the conclusion from the document alone, without needing a hallway conversation to understand what was actually considered. This connects directly back to the architecture pattern trade-offs discussed across section 46 — MVVM versus MVC versus TCA-style unidirectional flow were each presented there with genuine costs and benefits rather than a single "correct" answer, and a design doc proposing an architectural choice within a specific codebase should apply that same honest, comparative treatment to the concrete decision at hand.

## 82.2 Architecture decision records

An architecture decision record (ADR) is a lightweight, permanent record of a single significant decision, written at the time it's made and never edited afterward — only superseded by a new ADR if the decision changes. A typical ADR is short: context, the decision, and consequences (including trade-offs accepted knowingly).

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

The value of an ADR is almost entirely in its permanence and its dating: a design doc from 82.1 is a proposal debated before a decision, while an ADR is the settled record of what was actually decided and why, left untouched so a developer six months later can understand not just what the code does but why it looks the way it does, without archaeology through old pull request threads or chat history. This is the same "make prior reasoning legible to a future reader" instinct behind the commit message discipline covered in section 74 — a good commit message explains why a specific change was made; an ADR does the same thing at the scale of an architectural decision rather than a single diff.

## 82.3 Code review: what to block on vs comment on

Every code review comment implicitly falls into one of two categories, and conflating them is one of the most common sources of review friction: things that must change before merge (a genuine bug, a security issue, a violation of an established convention or ADR), and things worth mentioning but not worth blocking on (a stylistic preference, a "have you considered," a nice-to-have refactor for later).

```plaintext
// Blocking: genuine correctness issue
"This force-unwrap will crash if the network request fails before
this view appears — see section 4's optional-handling guidance."

// Non-blocking: worth raising, not worth blocking
"Nit: I'd probably extract this into a computed property, but not
blocking — up to you."
```

The practical skill is signaling which category a comment falls into explicitly, rather than leaving the author to guess whether "nit:" is being used generously or a seemingly minor comment is secretly a hard blocker. Reviewers who block on stylistic preference dressed up as a correctness concern erode trust and slow every future review from that reviewer; reviewers who never signal severity at all force authors to either over-address every comment or under-address a genuine blocker. This connects to the merge queue and CI-gating discipline from section 76: an efficient review process treats automated tooling (linters, formatters from section 75, tests) as the arbiter of objectively-checkable concerns, freeing human review time to focus on the genuinely subjective judgment calls — architecture fit, correctness under edge cases, and whether the change actually solves the stated problem — where a human reviewer's judgment is irreplaceable.

## 82.4 Estimation and breaking down epics

Large, vaguely-scoped work ("redesign the settings screen," "migrate to SwiftData") resists useful estimation precisely because its size is unknown, and the fix is breaking it into pieces small enough that each one can be estimated with real confidence — typically pieces small enough to land within a day or two of focused work.

A useful breakdown separates "known unknowns" (a clearly-scoped task whose size you can estimate confidently) from genuine "unknown unknowns" (a task whose scope depends on something not yet investigated, like an unfamiliar third-party API's actual behavior). The honest response to a genuine unknown unknown is not a confident-sounding estimate — it's a small, explicitly-scoped investigation task ("spike: determine SwiftData migration path for existing Core Data store, per section 42's coexistence strategies") whose deliverable is knowledge, not a shipped feature, after which the remaining work can actually be estimated. Treating a genuine unknown as if it were a known-scope task is the single most common cause of estimates that turn out to be wrong by a wide margin — not because estimation itself is unreliable, but because the thing being estimated was never actually a well-defined task in the first place.

## 82.5 Managing tech debt and negotiating time for it

Technical debt is not inherently a mistake — it's often a legitimate, deliberate trade-off (ship now with a known shortcut, pay down the shortcut later) as long as it's tracked and its cost is made visible, rather than accumulating silently until it becomes a crisis. The practical discipline is treating debt like actual debt: name it explicitly when it's incurred (ideally in an ADR per 82.2, so the trade-off is on the record), and periodically make its ongoing cost visible to whoever prioritizes work.

The negotiation skill that matters most here is translating debt into terms a non-engineering stakeholder can act on. "We have tech debt in the networking layer" is not actionable; "the current networking layer's lack of proper retry logic (see section 40's resilience patterns) caused three of the last five production incidents, and fixing it is roughly one sprint" gives a concrete cost and a concrete ask. This mirrors the performance-regression-budget framing from section 69.19 and the CI/CD risk-management theme from section 76.15 — debt, like performance or deployment risk, is far easier to negotiate time for when its cost is expressed in measurable, concrete terms (incidents, hours, user-facing failures) rather than as an abstract engineering complaint about code quality.

## 82.6 Incident response for mobile

Mobile incident response differs meaningfully from server incident response in one crucial way: you usually cannot instantly roll back a client binary the way you can revert a server deployment. A crash spike or data-corruption bug already shipped to users sitting on an old binary requires a different toolkit — feature flags to disable a broken code path remotely (extending the remote-configuration patterns from section 56's monetization material and section 49's system integration), server-side mitigations that reduce a client bug's blast radius without a new build, and, in the worst case, an expedited app review submission.

A mobile incident response process typically follows: detect (via crash reporting and analytics from section 80's observability material — this is precisely why that instrumentation exists), assess actual severity and affected user percentage (aided by the phased-release rollout from section 78.11, which by design limits exposure before a full rollout completes), decide on the fastest safe mitigation (flag flip, server-side change, or hotfix build), and communicate status to stakeholders throughout. The core discipline is recognizing, before an incident happens, which category of fix is even available for a given code path — a client bug behind a remote feature flag is fixable in minutes; the same bug with no flag protection might take days to reach affected users through App Review, a genuinely different risk profile that should inform which code paths get flag protection in the first place.

## 82.7 Rollback vs hotfix vs server-side mitigation

Given an active incident, three genuinely different remediation paths exist, each with a different speed-versus-completeness trade-off. A server-side mitigation (disabling a feature flag, adjusting a backend response, throttling a problematic endpoint) is typically fastest — often minutes — but only works if the client's broken behavior is actually controllable from the server side. A hotfix build is a new app version with a minimal, targeted fix, submitted through expedited review; it's slower (hours to a day or more, even expedited) but can fix bugs no server-side lever can reach. A full rollback, in the mobile context, most often means halting a phased rollout (per 78.11) rather than truly "reverting" a released version, since Apple doesn't support un-releasing a build that users have already downloaded — halting further rollout limits additional exposure but doesn't retroactively fix devices that already updated.

The judgment call is choosing the fastest path that actually addresses the severity of what's happening: a genuinely severe, widely-affecting bug justifies reaching for whatever lever is fastest even if it's a partial mitigation, while a narrower issue affecting a small percentage might reasonably wait for a proper hotfix rather than reaching for a riskier, rushed server-side workaround. This decision-making structure extends the same fastest-safe-mitigation instinct from 82.6, made concrete across the three specific tools actually available for a shipped mobile app.

## 82.8 Writing a blameless postmortem

A blameless postmortem examines what happened during an incident and why the systems and processes allowed it to happen, deliberately without assigning individual fault — the premise being that a competent, well-intentioned engineer following the process as understood at the time made the choices they made, and the useful question is what about the process, tooling, or system design allowed the outcome, not who to blame.

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

Blamelessness isn't a soft, feel-good gesture — it's what makes the postmortem process actually produce honest information. An engineer who fears individual blame has every incentive to omit details, hedge timelines, or downplay their own role in the sequence of events, all of which make the resulting action items worse. A genuinely blameless process, consistently applied, gets the full honest timeline on the table, which is the only way the actual systemic gap (missing automated alerting, in the example above) gets identified and fixed rather than papered over with an individual reprimand that does nothing to prevent the next occurrence.

## 82.9 Mentoring junior developers

Effective mentoring is less about transferring specific facts (which a junior developer can often look up faster than a mentor can explain) and more about transferring judgment — the pattern-matching that lets a senior developer recognize, within seconds, that a particular approach will cause problems three steps down the line, before those problems actually manifest.

The practical mechanism that transfers this judgment is not primarily direct instruction — it's asking questions that make a junior developer articulate their own reasoning, surfacing gaps in that reasoning without simply handing over the answer. "What happens if this network call fails partway through?" prompts the junior developer to actually reason through the error-handling gap themselves (connecting back to section 9's error-handling foundations), producing understanding that sticks in a way a direct "you forgot error handling" correction often doesn't. Code review (82.3) is one of the highest-leverage mentoring surfaces precisely because it happens on real code the junior developer already cares about and understands the context for — a review comment that explains the "why" behind a suggested change, not just the "what," compounds over time into genuine judgment transfer, while a review that only ever says "change this" without explaining the underlying reasoning trains compliance rather than understanding.

## 82.10 Designing an iOS interview loop

Designing a good iOS interview loop starts from a clear-eyed view of what the role actually requires day to day, and works backward to interview formats that genuinely predict success in that role, rather than defaulting to whatever format is easiest to run or most common in the industry. A loop assessing a senior iOS role building consumer apps might reasonably include: a practical coding exercise using real Swift and SwiftUI (not abstract algorithm puzzles disconnected from the actual work), a system design conversation scaled to mobile-specific concerns (offline-first data sync per section 41 and 44, not generic distributed-systems whiteboarding), and a code review exercise where the candidate reviews a deliberately flawed pull request — directly testing the judgment from 82.3 rather than just raw coding speed.

The honest failure mode worth naming is a loop that's easy to run and easy to score but doesn't actually predict on-the-job success — a pure algorithmic-puzzle round, for instance, correlates weakly with the day-to-day skill of navigating an existing large codebase, working through ambiguous requirements, or making the pragmatic architecture trade-offs covered throughout section 46. A well-designed loop is willing to accept a format that's harder to score consistently (like a realistic take-home project, evaluated against a rubric grounded in genuine production concerns) if that format actually correlates with the skills the role requires.

## 82.11 Preparing for an iOS technical interview

From the candidate's side, the highest-leverage preparation mirrors the loop design in 82.10: practicing the kind of realistic, applied problems the role actually involves, not generic algorithm-puzzle drilling disconnected from iOS work. Concretely, this means being able to fluently discuss trade-offs across the material this curriculum has covered — why a given concurrency approach fits a scenario (sections 17–22), how to reason about a SwiftUI performance problem (section 29, section 69), what an appropriate architecture looks like for a given app's complexity (section 45–46) — rather than memorizing a fixed answer to a fixed question.

A genuinely strong interview answer to an open-ended design question rarely lands on a single "correct" architecture; it demonstrates the same alternatives-with-trade-offs reasoning covered in 82.1's design doc discipline, applied out loud, in real time, to a novel problem. Practicing this — verbalizing trade-offs clearly and concisely under time pressure, rather than silently arriving at an answer — is a distinct skill from simply knowing the material, and is worth deliberately rehearsing, ideally with a real practice partner who can push back the way an actual interviewer would.

## 82.12 Building a portfolio that gets callbacks

A portfolio that actually generates interview callbacks demonstrates depth on a small number of genuinely substantial projects rather than breadth across many shallow ones — a single app with real architecture decisions, tests, and a clear README explaining the trade-offs made (echoing 82.1's honest-alternatives discipline) tells a hiring manager far more than ten tutorial-following clones with no distinguishing decisions of their own.

The detail that separates a compelling portfolio entry from a forgettable one is showing the reasoning, not just the result — a project README or accompanying write-up that explains why SwiftData was chosen over Core Data for a given project (per section 41–42's trade-offs), or why a particular concurrency model fit a specific app's needs, demonstrates exactly the judgment a hiring loop (82.10) is trying to assess, visible before the interview even starts. A portfolio project that includes tests (section 65–67), reasonable accessibility support (section 70), and a clear description of what was deliberately left out and why signals a level of engineering maturity that a purely feature-complete but undocumented project does not, regardless of how polished the UI looks.

## 82.13 Staying current: Swift Evolution, WWDC, forums

Swift and its platforms move quickly enough that staying current is itself a skill worth being deliberate about, rather than something that happens automatically by osmosis. The Swift Evolution process (first introduced in section 16) is the highest-signal source for understanding not just what's changing but why — proposal documents include the motivation and rejected alternatives, giving the same honest-trade-off reasoning as a design doc (82.1) but for the language itself. WWDC session videos remain the primary channel for platform-level announcements, and the Swift Forums are where in-progress proposals get debated before being finalized, offering visibility into reasoning that a finished proposal document alone doesn't fully capture.

The practical discipline here is triage, not exhaustive consumption — very few developers need to read every Evolution proposal or watch every WWDC session in full; the skill is recognizing which changes are relevant to your actual work (a proposal affecting concurrency semantics matters if you write concurrent code; a proposal affecting an embedded-only feature likely doesn't) and going deep only there, while maintaining lighter situational awareness of everything else through summaries and community discussion.

## 82.14 Contributing to Swift open source

Contributing to Swift itself, or to major packages in its ecosystem (Vapor, swift-log, and the other packages covered in section 81), is a genuinely accessible path to deeper language and ecosystem understanding, not a preserve of a small elite. The realistic on-ramp is rarely "implement a major language feature" — it's smaller, still-valuable contributions: fixing a documentation gap, triaging and reproducing an existing bug report with a clear minimal reproduction case, or implementing a well-scoped, already-discussed enhancement that a maintainer has explicitly marked as good for a new contributor.

The genuine payoff of open-source contribution isn't primarily resume material — it's that reading and modifying real, production-grade code written by the people who designed the language forces a depth of understanding that reading documentation alone rarely produces. Understanding why the standard library implements a given protocol requirement a specific way, or why a package's public API is shaped the way it is, often reveals design reasoning (trade-offs, historical constraints, prior mistakes being corrected) that no single WWDC session or blog post fully captures.

## 82.15 Technical writing and conference speaking

Writing and speaking about technical work is a distinct skill from doing the work itself, and one that compounds unusually well over a career: an engineer who can clearly explain a hard problem and its solution — whether in a blog post, an internal design doc (82.1), or a conference talk — creates value for people who never directly worked with them, and builds a reputation that opens opportunities direct engineering output alone often doesn't.

The single highest-leverage habit here is writing about problems you just solved, while the reasoning is still fresh — the same instinct behind a good postmortem (82.8) or ADR (82.2), but aimed outward rather than only at your own team. A blog post or talk that walks through a genuinely hard debugging session (drawing on the systematic techniques from section 68), a non-obvious performance fix (section 69), or an architecture decision that didn't work out as expected and what was learned from it, tends to resonate far more than a purely triumphant "here's how we built X perfectly" narrative — audiences learn more, and trust more, from genuine trade-offs and honest failure modes than from a polished success story with the hard parts edited out.

## Summary

| Subtopic | Core idea |
|---|---|
| 82.1 Technical design docs | Honest, comparative treatment of alternatives makes a decision genuinely critiquable |
| 82.2 Architecture decision records | Permanent, dated record of a settled decision and its accepted trade-offs |
| 82.3 Code review: block vs comment | Explicitly signal blocking correctness issues versus non-blocking preferences |
| 82.4 Estimation and epics | Separate known-scope work from genuine unknowns; scope unknowns as investigation tasks |
| 82.5 Managing tech debt | Name debt explicitly and translate its cost into concrete, actionable terms |
| 82.6 Incident response for mobile | Client binaries can't be instantly rolled back; flags and server-side levers matter |
| 82.7 Rollback vs hotfix vs server mitigation | Choose the fastest path that actually matches the severity of the incident |
| 82.8 Blameless postmortems | Blamelessness produces the honest detail needed to fix systemic gaps |
| 82.9 Mentoring juniors | Transfer judgment via questions, not just answers; code review is high-leverage |
| 82.10 Designing an interview loop | Work backward from actual job requirements, not convenient interview formats |
| 82.11 Interview preparation | Practice verbalizing trade-offs on realistic problems, not puzzle memorization |
| 82.12 Portfolio that gets callbacks | Depth and documented reasoning on few projects beats breadth on many |
| 82.13 Staying current | Triage Evolution/WWDC/forums by relevance rather than consuming everything |
| 82.14 Contributing to Swift OSS | Small, well-scoped contributions build genuine language and ecosystem depth |
| 82.15 Technical writing and speaking | Write about hard problems while fresh; honest trade-offs resonate more than polish |

This closes the curriculum. Sections 1 through 82 have moved from Swift's basic syntax through concurrency, SwiftUI and UIKit, data and architecture, the full platform surface, on-device AI, graphics, quality practices, tooling and shipping, and finally the engineering craft that surrounds all of it. There's no next section — the material from here is applying all of it, in a real codebase, over a real career.
