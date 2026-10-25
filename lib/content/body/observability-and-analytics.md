**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 80.1 Designing an Event Taxonomy 🟢

An **event taxonomy** is your **plan for analytics events**: which events the app sends, how they are named, and what data each one carries. Design it **before** you write the code. Events added randomly, each named differently, are very hard to analyze later.

```plaintext
// A deliberate, consistent naming convention (verb_noun, snake_case):
// recipe_viewed(recipe_id, source: "search" | "browse" | "favorites")
// recipe_saved(recipe_id)
// checkout_completed(order_id, total_amount, item_count)
// — versus an inconsistent, ad hoc mix: "ViewedRecipe", "recipe-save-event", "CheckoutDone"
```

Write the plan down as a table that the whole team uses:

| Event | When | Properties |
|---|---|---|
| `recipe_viewed` | The detail screen appears | `recipe_id`, `source` |
| `recipe_saved` | The user taps Save | `recipe_id` |
| `checkout_completed` | The order succeeds | `order_id`, `total_amount`, `item_count` |

**Why it pays off:** a question like "how many people who view a recipe also save it?" only works if `recipe_viewed` and `recipe_saved` are named and shaped consistently. Fixing years of messy event names later is much harder than starting clean.

---

## 80.2 Type-Safe Analytics Events in Swift 🟢

Do not send events as loose strings and dictionaries. A typo in a name fails **silently**, and you find out weeks later. Model each event as a **Swift type**, so the **compiler** catches mistakes.

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

Turn each case into the **name and properties** from your taxonomy (80.1), in **one place**:

```swift
extension AnalyticsEvent {
    var name: String {
        switch self {
        case .recipeViewed:      "recipe_viewed"
        case .recipeSaved:       "recipe_saved"
        case .checkoutCompleted: "checkout_completed"
        }
    }

    var properties: [String: String] {
        switch self {
        case let .recipeViewed(id, source):
            ["recipe_id": id, "source": source.rawValue]
        case let .recipeSaved(id):
            ["recipe_id": id]
        case let .checkoutCompleted(orderID, total, count):
            ["order_id": orderID, "total_amount": "\(total)", "item_count": "\(count)"]
        }
    }
}

// At the call site, a typo is now a compile error:
track(.recipeViewed(recipeID: recipe.id, source: .search))
```

This is the same idea as generated asset symbols (section 72.7) and Core ML's generated classes (section 59.2): turn a fragile string into a **checked Swift type**.

---

## 80.3 Batching and Offline Event Queueing 🟡

- **Batch:** collect events and send them **in groups**, not one network request per event.
- **Queue offline:** save events on the device, and send them **when the network is back**.

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

A fuller version that **saves events to a file**, so they survive the app being closed:

```swift
struct LoggedEvent: Codable {
    let name: String
    let properties: [String: String]
    let timestamp: Date
}

actor PersistentAnalyticsQueue {
    private var pending: [LoggedEvent] = []
    private let fileURL = URL.documentsDirectory.appending(path: "pending-events.json")

    init() {
        if let data = try? Data(contentsOf: fileURL),
           let saved = try? JSONDecoder().decode([LoggedEvent].self, from: data) {
            pending = saved                                  // events from the last session
        }
    }

    func enqueue(_ event: AnalyticsEvent) async {
        pending.append(LoggedEvent(name: event.name, properties: event.properties, timestamp: .now))
        save()
        if pending.count >= 20 { await flush() }
    }

    func flush() async {
        guard !pending.isEmpty else { return }
        let batch = pending
        do {
            try await upload(batch)                          // one request for the whole batch
            pending.removeFirst(batch.count)
            save()
        } catch {
            // offline or server error: keep the events and try again later
        }
    }

    private func save() {
        try? JSONEncoder().encode(pending).write(to: fileURL)
    }
}
```

Also send what is left when the app goes to the background:

```swift
.onChange(of: scenePhase) { _, phase in
    if phase == .background { Task { await analyticsQueue.flush() } }
}
```

**Why:** fewer, bigger requests use **less network and battery** (each time the radio wakes up costs energy, section 69.18). Saving events offline means **no data is lost** when there is no connection.

---

## 80.4 Crash Reporting Setup and Symbolication 🟢

A **crash reporting service** (Apple's own in App Store Connect, or a third-party one) collects crashes from real users: the stack trace, the device and iOS version, and **breadcrumbs** (what happened just before). To turn raw memory addresses into **readable function names**, it needs the **matching dSYM** for that exact build (section 68.22, uploaded automatically by CI in section 76.13).

```swift
// Crash reporting SDK integration typically requires:
// - SDK initialization early in app launch (to capture crashes as early as possible)
// - Automatic or CI-integrated dSYM upload matching each specific build (recall 76.13)
// - Optional custom breadcrumb logging for additional context leading up to a crash
```

Apple's **MetricKit** also delivers crash diagnostics from real devices to your app, with no third-party SDK:

```swift
import MetricKit

final class CrashCollector: NSObject, MXMetricManagerSubscriber {
    override init() {
        super.init()
        MXMetricManager.shared.add(self)                  // start receiving reports
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            for crash in payload.crashDiagnostics ?? [] {
                let report = crash.jsonRepresentation()    // the call stack and details
                // send `report` to your server
            }
        }
    }
}
```

**Without the matching dSYM, a perfect crash report is useless.** You only see addresses. That is why automatic dSYM upload (76.13) is essential, not optional.

---

## 80.5 Reading Crash Reports in Organizer 🟢

Xcode's **Organizer** (**Window → Organizer → Crashes**) shows crashes from real users. It is the same window as the performance metrics in section 69.17.

```plaintext
// Organizer's crash report view surfaces:
// - Crash signature grouping (similar crashes clustered as one issue, not counted individually)
// - Affected version/device/OS distribution (is this crash isolated to one specific configuration?)
// - Symbolicated stack trace, directly linkable back to the actual source code line
```

How to use it:

1. Choose your app and a version.
2. Sort the crashes by **how many users** they affect.
3. Open the top one, and look at the **stack trace**.
4. Click **Open in Project** to jump to the exact line in your code.

If you have a raw address and the dSYM, you can symbolicate one line by hand:

```bash
atos -arch arm64 \
  -o MyApp.app.dSYM/Contents/Resources/DWARF/MyApp \
  -l 0x100000000 0x0000000100a1b2c4
# prints something like: RecipeDetailView.body.getter (RecipeDetailView.swift:42)
```

**Grouping matters.** A thousand reports of the **same crash** are shown as **one issue**, with a count. So you can fix the crash that hurts the most users first, instead of drowning in single reports.

---

## 80.6 Crash-Free Session Rate as an SLO 🟢

The **crash-free session rate** is the percentage of app sessions that end **without a crash**. Many teams set it as an **SLO** (Service Level Objective): a clear target to meet, like **99.5%**.

```plaintext
// A representative SLO commitment:
// "Maintain crash-free session rate above 99.5%, monitored per release,
//  with any release dropping below this threshold treated as a genuine regression
//  requiring investigation, not just background noise to accept"
```

How it is calculated:

```plaintext
crash-free session rate = (sessions without a crash ÷ all sessions) × 100

Example:  200,000 sessions, 600 crashed
          (199,400 ÷ 200,000) × 100 = 99.7%   ✓ above the 99.5% target
```

A number turns "try not to crash too much" into a **clear signal**. If a release drops below 99.5%, it is a **regression to investigate**, the same idea as performance budgets (section 69.19). You do not have to wait for angry reviews to notice.

---

## 80.7 Hang Rate and ANR Monitoring 🟡

A **hang** is when the app **freezes** because the main thread is blocked (section 69.13). On Android it is called an **ANR** ("Application Not Responding"). A frozen app can be **as bad as a crash** for the user, but it produces **no crash report**. So track the **hang rate** too.

```plaintext
// A hang, unlike a crash, produces no traditional crash report at all —
// MetricKit's aggregated hang rate data (from real user devices) is often
// the only production-visible signal that hangs are occurring at a meaningful rate
```

MetricKit (section 69.16) reports hangs from real devices, with the stack that was blocked:

```swift
func didReceive(_ payloads: [MXDiagnosticPayload]) {
    for payload in payloads {
        for hang in payload.hangDiagnostics ?? [] {
            print("Hang for \(hang.hangDuration)")          // how long the app was frozen
            let stack = hang.callStackTree.jsonRepresentation() // what the main thread was doing
            // send `stack` to your server
        }
    }
}
```

| Metric | Catches |
|---|---|
| Crash-free session rate (80.6) | The app quits suddenly |
| Hang rate | The app freezes, but does not quit |

**If you only watch crashes, you miss hangs completely.** Track both.

---

## 80.8 Ingesting MetricKit into Your Own Stack 🔴

Organizer (80.5) shows MetricKit data inside Xcode. You can also **receive the data in your app** with `MXMetricManagerSubscriber` (section 69.16), and **send it to your own backend**. Then you can build your own dashboards and alerts, and combine it with your other metrics.

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

A working version: subscribe once at launch, and send the payload as JSON:

```swift
final class MetricsForwarder: NSObject, MXMetricManagerSubscriber {
    override init() {
        super.init()
        MXMetricManager.shared.add(self)
    }

    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            let json = payload.jsonRepresentation()        // launch time, hangs, memory, battery
            Task { try? await uploadMetrics(json) }        // your own backend
        }
    }
}

// Keep one instance alive for the whole app, for example in your App type:
// let metrics = MetricsForwarder()
```

Do this when Organizer is **not enough**: you want your **own alert limits**, want to **combine app and backend data** (80.9), or already use an internal dashboard for everything else.

---

## 80.9 Distributed Tracing from App to Backend 🔴

**Distributed tracing** gives one user action (like "load the recipe feed") a **trace ID**. The ID travels from the app through **every backend service** that the request touches. Then you can follow that **one request end to end**, instead of looking at separate logs.

```swift
// Conceptual: attaching a trace ID to an outgoing network request,
// which the backend then propagates through its own internal service calls
var request = URLRequest(url: url)
request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Trace-ID")
// The backend logs this same trace ID through every downstream service call,
// letting the full request path be reconstructed and analyzed as one unified trace
```

Many backends understand the standard **W3C `traceparent`** header:

```swift
func traceparentHeader() -> String {
    func hex() -> String { UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased() }
    let traceID = hex()                      // 32 hex characters: the whole request
    let spanID = String(hex().prefix(16))    // 16 hex characters: this one call
    return "00-\(traceID)-\(spanID)-01"     // version - trace id - span id - flags
}

var request = URLRequest(url: url)
request.setValue(traceparentHeader(), forHTTPHeaderField: "traceparent")
```

Log the same trace ID in the app too, so app logs and server logs can be **joined**.

**Without it**, finding out why one user's request was slow means matching timestamps across **separate** app and server logs by hand. **With it**, you follow **one trace** across the whole path.

---

## 80.10 Feature Flags and Remote Config 🟢

A **feature flag** is a setting you can change **from your server**, that turns a feature **on or off** in the app. You can then change behavior **without an App Store release**: roll out slowly, target some users, or switch a broken feature off (80.11).

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

A simple **remote config** provider: download the flags as JSON, and keep **safe defaults**:

```swift
@Observable
final class RemoteFeatureFlags: FeatureFlagProviding {
    private var values: [String: Bool] = [:]
    private let defaults: [FeatureFlag: Bool] = [
        .newCheckoutFlow: false,          // off unless the server says otherwise
        .aiRecipeSuggestions: false,
    ]

    func refresh() async {
        let url = URL(string: "https://config.example.com/flags.json")!
        if let (data, _) = try? await URLSession.shared.data(from: url),
           let decoded = try? JSONDecoder().decode([String: Bool].self, from: data) {
            values = decoded               // e.g. {"newCheckoutFlow": true}
        }
    }

    func isEnabled(_ flag: FeatureFlag) -> Bool {
        values[flag.rawValue] ?? defaults[flag] ?? false
    }
}
```

The big idea: **deploying** code (shipping it in the app) and **releasing** a feature (turning it on for users) become **two separate steps**. You can ship a finished feature turned off, then turn it on whenever you want, without waiting for App Review (section 78.8).

---

## 80.11 Kill Switches for Broken Features 🟢

A **kill switch** is a feature flag (80.10) kept for one job: **turning off a broken feature instantly**, for everyone, without an emergency App Store release.

```swift
if featureFlags.isEnabled(.newCheckoutFlow) {
    // If newCheckoutFlow is later discovered to have a critical bug affecting real orders,
    // flipping this remote flag off instantly disables it for all users,
    // falling back to the previous, known-working checkout flow —
    // no emergency App Store submission or review wait required
}
```

Always keep the **old, working path** behind the switch:

```swift
var body: some View {
    if featureFlags.isEnabled(.newCheckoutFlow) {
        NewCheckoutView()          // the risky new feature
    } else {
        CheckoutView()             // the known-working fallback
    }
}
```

Two rules:

- **Choose the default carefully.** If the flags cannot be loaded, the app should fall back to the **safe** path.
- **Test the "off" path.** A kill switch is useless if the fallback no longer works.

| | Phased release (section 78.11) | Kill switch |
|---|---|---|
| Limits | How many users get a new version | Whether one feature is on |
| Speed | Pause, but users who already updated keep it | Off for everyone, right away |

They work **together**: phased release limits the first damage, and a kill switch stops a discovered problem **immediately**.

---

## 80.12 A/B Testing: Assignment and Exposure Logging 🔴

A good **A/B test** logs **two different events**:

- **Assignment:** which variant a user was **put into**.
- **Exposure:** when the user **actually saw** that variant.

They are not always the same moment, and mixing them up gives **wrong results**.

```swift
// Assignment: recorded once when a user is bucketed into an experiment variant
analytics.track(.experimentAssigned(experimentID: "checkout_v2", variant: "treatment"))

// Exposure: recorded only when the user actually encounters/experiences the variant's effect
// (e.g., only when they actually reach the checkout screen where the variant applies)
analytics.track(.experimentExposed(experimentID: "checkout_v2", variant: "treatment"))
```

Put each user into the **same variant every time**, based on a hash of their ID:

```swift
import CryptoKit

func variant(for userID: String, experiment: String) -> String {
    let hash = SHA256.hash(data: Data("\(experiment):\(userID)".utf8))
    let firstByte = Array(hash)[0]                            // a number from 0 to 255
    return firstByte < 128 ? "control" : "treatment"            // about 50% each
}
```

Log the exposure **only on the screen where the variant matters**:

```swift
struct CheckoutScreen: View {
    let variant: String

    var body: some View {
        CheckoutContent(variant: variant)
            .onAppear {
                analytics.track(.experimentExposed(experimentID: "checkout_v2", variant: variant))
            }
    }
}
```

**Why it matters:** a user can be **assigned** to the new checkout but **never reach** checkout. If you count them anyway, they **dilute** the result, and the test may say the change does nothing when it really works.

---

## 80.13 Feature Flag Debt and Cleanup Discipline 🟡

Feature flags become **technical debt** if you never remove them. A flag whose feature has been at 100% for months still adds an extra `if` to the code, like the dead code that Periphery finds (section 75.4).

```swift
// A stale flag check remaining in code long after its rollout concluded,
// still adding unnecessary branching complexity to every code path that checks it:
if featureFlags.isEnabled(.newCheckoutFlowLaunchedSixMonthsAgo) {
    // this branch has effectively been "always true" for six months —
    // the flag check itself is now pure, unnecessary accumulated complexity
}
```

Give every flag a **removal date** when you create it, and let a **test** remind you:

```swift
enum FeatureFlag: String, CaseIterable {
    case newCheckoutFlow
    case aiRecipeSuggestions

    var removeBy: Date {
        switch self {
        case .newCheckoutFlow:     DateComponents(calendar: .current, year: 2026, month: 12, day: 1).date!
        case .aiRecipeSuggestions: DateComponents(calendar: .current, year: 2027, month: 3, day: 1).date!
        }
    }
}
```

```swift
import Testing

@Test func noFlagIsPastItsRemovalDate() {
    for flag in FeatureFlag.allCases {
        #expect(flag.removeBy > .now, "\(flag) should be removed by now")
    }
}
```

When the test fails, **remove the flag and its old branch**. Cleaning up flags is **ongoing work**, not a one-time setup.

---

## Summary

| Concept | Key Idea | Purpose |
|---|---|---|
| Event taxonomy | A naming plan, written first | Data you can analyze later |
| Type-safe events | An enum for events | Typos become compile errors |
| Batching and queueing | Send in groups, save offline | Less battery, no lost events |
| Crash reporting | Reports plus matching dSYMs | Readable crashes |
| Organizer | Crashes grouped by signature | Fix the biggest problem first |
| Crash-free sessions | A clear SLO, like 99.5% | Notice stability regressions |
| Hang rate | MetricKit hang diagnostics | Catch freezes that are not crashes |
| Own MetricKit stack | `MXMetricManagerSubscriber` | Your own dashboards and alerts |
| Distributed tracing | A trace ID across app and backend | Follow one request end to end |
| Feature flags | Remote on and off switches | Release without App Review |
| Kill switches | Turn a broken feature off now | Faster than any release |
| A/B testing | Separate assignment and exposure | Correct experiment results |
| Flag cleanup | Removal dates and a test | No pile of stale flags |
