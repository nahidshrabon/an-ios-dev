## 80.1 Designing an Event Taxonomy

An event taxonomy is the deliberate, upfront design of what analytics events an app emits, their naming conventions, and what properties each event carries — designed thoughtfully before implementation begins, since a haphazard, ad hoc approach (events named inconsistently by whichever developer happened to add them) produces analytics data that's genuinely difficult to actually analyze later.

```plaintext
// A deliberate, consistent naming convention (verb_noun, snake_case):
// recipe_viewed(recipe_id, source: "search" | "browse" | "favorites")
// recipe_saved(recipe_id)
// checkout_completed(order_id, total_amount, item_count)
// — versus an inconsistent, ad hoc mix: "ViewedRecipe", "recipe-save-event", "CheckoutDone"
```

Investing in a genuinely thoughtful, consistent taxonomy upfront pays off considerably down the line — an analyst or product manager trying to answer a real business question ("what fraction of users who view a recipe actually save it") depends entirely on events being named and structured consistently enough to actually reliably query and join together, and retrofitting a consistent taxonomy onto years of inconsistently-named, ad hoc events after the fact is considerably more painful than establishing good conventions from an app's early analytics implementation.

---

## 80.2 Type-Safe Analytics Events in Swift

Rather than emitting analytics events as loosely-typed dictionaries or raw strings (prone to typos in event names or property keys that fail silently, never actually being caught until an analyst notices missing or malformed data), a type-safe event modeling approach (an enum or struct per event type) lets the compiler catch structural mistakes at build time.

```swift
enum AnalyticsEvent {
    case recipeViewed(recipeID: String, source: RecipeViewSource)
    case recipeSaved(recipeID: String)
    case checkoutCompleted(orderID: String, totalAmount: Decimal, itemCount: Int)
}

enum RecipeViewSource: String {
    case search, browse, favorites
}

func track(_ event: AnalyticsEvent) {
    // exhaustive switch ensures every event case is handled correctly and consistently
}
```

This type-safe approach directly parallels the broader "convert a string-based, runtime-only-discoverable pattern into a compile-time-checked one" theme recurring throughout this curriculum (recall generated asset catalog symbols, section 72.7, and Core ML's generated interfaces, section 59.2) — a typo in an event name or a missing required property becomes an immediate compile error rather than a silent analytics data quality problem discovered weeks later when a report's numbers mysteriously don't add up.

---

## 80.3 Batching and Offline Event Queueing

Analytics events should generally be batched (accumulated locally and sent in periodic groups rather than one network request per individual event) and queued for later delivery when offline — directly connecting to the background task budget concerns from section 49.5 and the general network efficiency principles from Part 5's networking material.

```swift
actor AnalyticsQueue {
    private var pendingEvents: [AnalyticsEvent] = []

    func enqueue(_ event: AnalyticsEvent) {
        pendingEvents.append(event)
        if pendingEvents.count >= 20 {
            Task { await flush() }
        }
    }

    func flush() async {
        // send accumulated events in one batched network request,
        // persisting them locally first so they survive an app termination
        // before successful delivery, then retrying later if offline
    }
}
```

Batching's genuine value is reducing both network overhead (many small individual requests are meaningfully less efficient than fewer, larger batched requests) and battery/energy impact (recall the network radio wake-up energy cost discussed in section 69.18) — while offline queueing (persisting events locally until they can actually be delivered) ensures analytics data isn't simply lost when a user's device lacks connectivity at the moment an event occurs, both genuinely important considerations for building an analytics system that provides complete, accurate data without being needlessly wasteful of network and battery resources.

---

## 80.4 Crash Reporting Setup and Symbolication

Crash reporting services (whether Apple's own, via App Store Connect, or a third-party service) automatically capture crash details (stack trace, device/OS info, breadcrumb context leading up to the crash) and require properly configured, matching dSYM upload (recall the strict dSYM-matching requirement from section 68.22, and its CI automation in section 76.13) to actually produce readable, symbolicated crash reports rather than raw, unreadable memory addresses.

```swift
// Crash reporting SDK integration typically requires:
// - SDK initialization early in app launch (to capture crashes as early as possible)
// - Automatic or CI-integrated dSYM upload matching each specific build (recall 76.13)
// - Optional custom breadcrumb logging for additional context leading up to a crash
```

Without correctly configured dSYM upload specifically matching the exact build that crashed, even a crash reporting service with perfect crash capture provides essentially no actionable diagnostic value — this is precisely the symbolication requirement discussed in section 68.22 applied here to a production crash reporting pipeline specifically, reinforcing why the automated dSYM upload discipline established in the CI/CD material (76.13) is genuinely load-bearing infrastructure for the entire crash reporting system to actually function usefully in practice.

---

## 80.5 Reading Crash Reports in Organizer

Xcode's Organizer window (already introduced for performance metrics in section 69.17) also surfaces crash reports collected from real users — grouped by crash signature (similar crashes clustered together), showing affected device/OS version distribution, and providing symbolicated stack traces directly correlatable with source code.

```plaintext
// Organizer's crash report view surfaces:
// - Crash signature grouping (similar crashes clustered as one issue, not counted individually)
// - Affected version/device/OS distribution (is this crash isolated to one specific configuration?)
// - Symbolicated stack trace, directly linkable back to the actual source code line
```

Crash signature grouping is a genuinely important organizational feature worth understanding — rather than presenting a thousand individual crash reports as a thousand separate, undifferentiated problems, Organizer clusters crashes sharing the same underlying signature (likely the same root cause) together as one aggregated issue, letting a developer prioritize fixes based on genuine aggregate impact (how many distinct users are affected by this one specific crash signature) rather than being overwhelmed by an undifferentiated flood of individually-reported crash instances.

---

## 80.6 Crash-Free Session Rate as an SLO

Crash-free session rate (the percentage of app sessions that complete without a crash) is a commonly-used Service Level Objective (SLO) for app stability — a single, trackable metric a team can set an explicit target for (like "99.5% crash-free sessions") and monitor over time via Organizer (80.5) or a crash reporting service, directly connecting to the regression-detection material from section 69.17.

```plaintext
// A representative SLO commitment:
// "Maintain crash-free session rate above 99.5%, monitored per release,
//  with any release dropping below this threshold treated as a genuine regression
//  requiring investigation, not just background noise to accept"
```

Establishing crash-free session rate as an explicit, tracked SLO (rather than simply "try not to crash too much" as a vague, informal aspiration) provides the same kind of proactive, measurable discipline discussed for performance regression budgets in section 69.19 — a specific, numeric threshold gives a team a clear, objective signal for when a release's stability has genuinely regressed and requires investigation, rather than relying on subjective impressions or waiting for user complaints to reveal that stability has quietly degraded.

---

## 80.7 Hang Rate and ANR Monitoring

Beyond crash-free session rate (80.6), hang rate (the frequency of main thread hangs, recall section 69.13) is an equally important stability metric — measurable via `MetricKit`'s hang rate reporting (recall section 69.16) or a third-party crash/performance reporting service, since a severely unresponsive app that never technically crashes can still represent a genuinely serious quality problem from a real user's actual perspective.

```plaintext
// A hang, unlike a crash, produces no traditional crash report at all —
// MetricKit's aggregated hang rate data (from real user devices) is often
// the only production-visible signal that hangs are occurring at a meaningful rate
```

The distinct value of tracking hang rate alongside crash-free session rate reflects a genuine, important insight — a user experiencing a severe, sustained hang has arguably just as bad (or worse) an experience as one experiencing an outright crash, yet a hang produces no traditional crash report at all, meaning a team monitoring *only* crash-free session rate could have a completely blind spot around a genuinely serious hang-related quality problem that `MetricKit`'s specific hang rate reporting (section 69.16) exists precisely to surface.

---

## 80.8 Ingesting MetricKit into Your Own Stack 🔴

Beyond viewing `MetricKit` data through Xcode Organizer (80.5, 69.17), an app can implement `MXMetricManagerSubscriber` (recall section 69.16) directly to receive and forward `MetricKit` payloads into a team's own analytics/observability backend, enabling custom dashboards, alerting, and correlation with other application-specific metrics beyond what Organizer's built-in views provide.

```swift
import MetricKit

class MetricsForwarder: NSObject, MXMetricManagerSubscriber {
    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            // Forward relevant metrics (launch time, hang rate, memory) to a
            // custom backend/dashboard, correlating with other app-specific
            // observability data beyond what Organizer's built-in views show
        }
    }
}
```

Ingesting `MetricKit` data into a team's own custom observability stack is appropriate specifically when Organizer's built-in presentation isn't sufficient for a team's actual needs — perhaps needing custom alerting thresholds, correlation with backend service metrics for genuinely full-stack observability (80.9), or integration with an existing internal dashboard/monitoring tool already used for other parts of a team's infrastructure, letting `MetricKit`'s real-device performance data become one integrated input among a team's broader observability tooling rather than existing purely within Xcode's own, separate Organizer interface.

---

## 80.9 Distributed Tracing from App to Backend 🔴

Distributed tracing propagates a unique trace identifier from a client app request through every backend service that request subsequently touches — letting a single, specific user-facing operation (like "load the recommendations feed") be traced end-to-end across the app, any intermediate services, and the actual backend, rather than each layer's logging/monitoring existing in complete isolation from every other layer.

```swift
// Conceptual: attaching a trace ID to an outgoing network request,
// which the backend then propagates through its own internal service calls
var request = URLRequest(url: url)
request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Trace-ID")
// The backend logs this same trace ID through every downstream service call,
// letting the full request path be reconstructed and analyzed as one unified trace
```

Distributed tracing addresses a genuine observability gap that exists when client-side and backend-side monitoring remain completely separate, disconnected systems — without a shared trace identifier connecting them, diagnosing why a specific user's specific request was slow requires manually correlating timestamps and context across entirely separate app-side and backend-side logging systems, while a properly propagated trace ID lets that same investigation follow one single, coherent trace directly across the entire request's actual full path, considerably simplifying diagnosis of genuinely cross-system, end-to-end performance or correctness issues.

---

## 80.10 Feature Flags and Remote Config

Feature flags (remotely-configurable boolean or more complex values controlling whether specific functionality is active) let a team change an app's behavior without requiring an actual App Store release — enabling gradual feature rollout, targeting specific user segments, or (critically) providing kill switches (80.11) for disabling problematic functionality without waiting for App Review.

```swift
protocol FeatureFlagProviding {
    func isEnabled(_ flag: FeatureFlag) -> Bool
}

enum FeatureFlag: String {
    case newCheckoutFlow
    case aiRecipeSuggestions
}

if featureFlags.isEnabled(.newCheckoutFlow) {
    // conditionally show new functionality, controllable remotely without an App Store release
}
```

Feature flags provide a genuinely significant decoupling between *deploying* code (getting a feature's implementation into a shipped app binary) and *releasing* it (actually making that feature active and visible to users) — a feature can be fully implemented, tested, and shipped within an app binary while remaining flagged off, then activated remotely for specific user segments or a gradual rollout percentage entirely independent of the App Store's own release and review timeline, a meaningfully faster and more controllable activation mechanism than App Review's inherent latency (recall section 78.8) would otherwise allow.

---

## 80.11 Kill Switches for Broken Features

A kill switch is a specific, critical application of feature flags (80.10) — a remotely-controllable flag specifically maintained for the purpose of instantly disabling a feature discovered to be broken or harmful in production, without needing to wait for an emergency App Store review and release cycle.

```swift
if featureFlags.isEnabled(.newCheckoutFlow) {
    // If newCheckoutFlow is later discovered to have a critical bug affecting real orders,
    // flipping this remote flag off instantly disables it for all users,
    // falling back to the previous, known-working checkout flow —
    // no emergency App Store submission or review wait required
}
```

The genuine, practical value of maintaining kill switches for meaningfully risky new features connects directly to the phased release risk-management principle from section 78.11 — while phased release limits a bad release's *initial* blast radius by gradually increasing rollout percentage, a kill switch provides an even faster, more immediate mitigation once a genuine problem is actually discovered (instantly disabling the specific problematic feature for all users, rather than needing to wait even for a paused phased rollout's already-affected users to naturally age out), making kill switches a meaningfully complementary, faster-acting safety mechanism specifically for a feature's worst-case, discovered-to-be-broken scenario.

---

## 80.12 A/B Testing: Assignment and Exposure Logging 🔴

Rigorous A/B testing requires two genuinely distinct logging concerns — assignment logging (recording which experimental variant a user was actually assigned to) and exposure logging (recording when a user actually experienced/saw that variant's effect) — since these two events don't always coincide, and conflating them produces genuinely misleading experimental results.

```swift
// Assignment: recorded once when a user is bucketed into an experiment variant
analytics.track(.experimentAssigned(experimentID: "checkout_v2", variant: "treatment"))

// Exposure: recorded only when the user actually encounters/experiences the variant's effect
// (e.g., only when they actually reach the checkout screen where the variant applies)
analytics.track(.experimentExposed(experimentID: "checkout_v2", variant: "treatment"))
```

The distinction between assignment and exposure matters genuinely, not just as a pedantic technicality — a user could be assigned to a treatment variant but never actually reach the screen where that variant's effect would apply (perhaps abandoning their session before reaching checkout at all), and counting that user's eventual behavior toward the experiment's results based purely on assignment (rather than genuine exposure) would incorrectly dilute the experiment's actual measured effect with users who were technically assigned but never truly exposed to the variant being tested, undermining the statistical validity of the entire experiment's conclusions.

---

## 80.13 Feature Flag Debt and Cleanup Discipline

Feature flags accumulate genuine technical debt over time if not actively, deliberately cleaned up — a flag whose experiment concluded months ago, or whose feature has long since fully rolled out to 100% of users, still adds real conditional complexity to the codebase for every day it remains un-removed, directly connecting to the dead code concerns raised for Periphery in section 75.4.

```swift
// A stale flag check remaining in code long after its rollout concluded,
// still adding unnecessary branching complexity to every code path that checks it:
if featureFlags.isEnabled(.newCheckoutFlowLaunchedSixMonthsAgo) {
    // this branch has effectively been "always true" for six months —
    // the flag check itself is now pure, unnecessary accumulated complexity
}
```

This connects directly to the dead/stale code concerns raised for Periphery in section 75.4, but specifically for feature flags rather than genuinely unused code — a flag that's effectively always true (or always false) in practice represents unnecessary, accumulated conditional complexity that a periodic, deliberate flag audit (removing flags whose rollout has fully concluded, or whose associated experiment has already reached its conclusion) can genuinely simplify away, making feature flag cleanup discipline a real, ongoing maintenance practice rather than a one-time setup concern, much like the broader dead code hygiene discussed throughout Part 11's tooling material.

---

## Summary

| Concept | Key Idea | Purpose |
|---|---|---|
| Upfront design | Event taxonomy | Consistent naming enables reliable analysis later |
| Compile-time safety | Type-safe analytics events | Catches naming/property mistakes at build time |
| Efficiency | Batching, offline queueing | Reduces network/battery cost, preserves data during outages |
| Diagnostic foundation | Crash reporting + dSYM matching | Symbolication requires exact build-matched dSYMs |
| Aggregated triage | Crash signature grouping (Organizer) | Prioritizes fixes by genuine aggregate impact |
| Stability commitment | Crash-free session rate (SLO) | Objective, measurable stability regression signal |
| Blind-spot coverage | Hang rate / ANR monitoring | Catches severe unresponsiveness crashes alone would miss |
| Custom observability | `MXMetricManagerSubscriber` ingestion | Integrates MetricKit into a team's own stack |
| End-to-end diagnosis | Distributed tracing | Unifies app-side and backend-side request visibility |
| Deployment/release decoupling | Feature flags, remote config | Activation independent of App Store release timing |
| Fast incident response | Kill switches | Immediate mitigation faster than phased rollout alone |
| Experimental rigor | Assignment vs. exposure logging | Prevents diluted, statistically invalid A/B results |
| Ongoing hygiene | Feature flag cleanup discipline | Prevents accumulated, stale conditional complexity |
