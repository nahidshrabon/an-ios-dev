**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Section 65 covered the basics. This section goes further: the **kinds of test doubles**, testing **actors** and **time**, **snapshot** tests, testing SwiftUI state and App Intents, testing against a **backend**, reading **code coverage** honestly, **property-based** and **mutation** testing, and running big suites with **test plans** and **sharding**.

---

## 66.1 Test Doubles: Stub, Mock, Spy, Fake 🟢

A **test double** is anything that stands in for a real dependency in a test. The names mean different things:

| Double | What it does | Example |
|---|---|---|
| **Stub** | Returns **canned** answers. Checks nothing | Always returns two recipes |
| **Spy** | Like a stub, but **records** calls so the test can check them afterwards | Records every `track(event)` call |
| **Mock** | Is set up with **expectations** and **verifies** them itself | "Expect `save` exactly once, with this recipe" |
| **Fake** | A **working**, simplified implementation | An in-memory database instead of SQLite |

```swift
// Stub: canned data
struct StubRecipeService: RecipeServicing {
    var recipes: [Recipe]
    func fetchRecipes() async throws -> [Recipe] { recipes }
}

// Spy: records how it was called
actor SpyAnalytics: AnalyticsTracking {
    private(set) var events: [String] = []
    func track(_ event: String) { events.append(event) }
}

// Fake: really works, just simpler (and in memory)
actor InMemoryRecipeStore: RecipeStoring {
    private var recipes: [Recipe.ID: Recipe] = [:]
    func save(_ recipe: Recipe) { recipes[recipe.id] = recipe }
    func recipe(id: Recipe.ID) throws -> Recipe {
        guard let recipe = recipes[id] else { throw StoreError.notFound }
        return recipe
    }
}
```

Use the **simplest** double that works:

- The test only needs **data** → a **stub**.
- The test checks a **side effect** ("did we log the purchase?") → a **spy**.
- The code does **real work** with the dependency (save, then load, then update) → a **fake**.

People often say "mock" for all of them. That's fine in conversation, but knowing the difference helps you avoid building a complex mock when a 3-line stub would do.

---

## 66.2 Testing Actors and Isolated Code 🟡

An `async` test can `await` an actor's methods, just like production code. The compiler checks **isolation** in tests too, so you can't accidentally read actor state without `await`:

```swift
actor ShoppingList {
    private var items: [String: Int] = [:]
    func add(_ item: String, quantity: Int = 1) { items[item, default: 0] += quantity }
    func quantity(of item: String) -> Int { items[item] ?? 0 }
}

@Test func addingTwiceSumsQuantities() async {
    let list = ShoppingList()
    await list.add("Eggs", quantity: 6)
    await list.add("Eggs", quantity: 6)
    #expect(await list.quantity(of: "Eggs") == 12)
}
```

The actor's real job is staying correct under **concurrent** access, so test **that** too:

```swift
@Test func concurrentAddsAreNotLost() async {
    let list = ShoppingList()

    await withTaskGroup(of: Void.self) { group in
        for _ in 0..<1_000 {
            group.addTask { await list.add("Flour") }      // 1,000 tasks at once
        }
    }

    #expect(await list.quantity(of: "Flour") == 1_000)   // a data race would lose some
}
```

For **`@MainActor`** code (view models), mark the test or suite `@MainActor` (65.10).

One thing to watch: actor methods with an `await` **inside** can interleave (**reentrancy**, Part 2). If a method checks state, awaits, then changes state, write a test that runs two calls **concurrently** and checks the result is still right.

---

## 66.3 Deterministic Time with TestClock 🟡

Code that **waits** (debounce, timeouts, retry delays) is slow and flaky to test with real time. The fix: inject a **clock** (47.8). Swift's standard library has the **`Clock`** protocol; production uses `ContinuousClock`, and tests use a controllable clock.

The production code takes **any clock**:

```swift
@MainActor
@Observable
final class RecipeSearchModel {
    private let clock: any Clock<Duration>
    private let service: RecipeSearching
    private(set) var results: [Recipe] = []
    private(set) var searchTask: Task<Void, Never>?

    init(clock: any Clock<Duration> = ContinuousClock(), service: RecipeSearching) {
        self.clock = clock
        self.service = service
    }

    func queryChanged(_ text: String) {
        searchTask?.cancel()                                   // restart on every keystroke
        searchTask = Task {
            try? await clock.sleep(for: .milliseconds(300))    // debounce
            guard !Task.isCancelled else { return }
            results = (try? await service.search(text)) ?? []
        }
    }
}
```

The test uses **`TestClock`** from the open-source **swift-clocks** package (Point-Free). Time only moves when the test **says so**:

```swift
import Clocks

@MainActor
@Test func searchWaitsUntilTypingStops() async {
    let clock = TestClock()
    let model = RecipeSearchModel(clock: clock, service: StubSearch(results: [.pasta]))

    model.queryChanged("pa")
    model.queryChanged("pas")                                 // cancels the first search

    await clock.advance(by: .milliseconds(299))
    #expect(model.results.isEmpty)                            // not yet

    await clock.advance(by: .milliseconds(1))                 // now 300 ms passed
    await model.searchTask?.value                             // let the search finish
    #expect(model.results == [.pasta])
}
```

The test runs in **milliseconds**, not seconds, and gives the **same** result every time. (swift-clocks also has `ImmediateClock`, which skips all waiting: handy when a test doesn't care about timing at all.)

The rule: **never** hard-code `Task.sleep` or `Date()` in logic you want to test. Pass the clock (and "now") in.

---

## 66.4 Snapshot Testing Setup 🟡

**Snapshot testing** renders a view to an **image** and compares it with an approved **reference image**. If even a few pixels change, the test fails and shows the **difference**.

The most used library is the open-source **swift-snapshot-testing** (Point-Free):

```swift
import Testing
import SnapshotTesting
import SwiftUI
@testable import RecipeApp

@MainActor
@Test func recipeCardLooksRight() {
    let card = RecipeCard(recipe: .sample)
        .frame(width: 375)

    assertSnapshot(of: card, as: .image(layout: .sizeThatFits))
}
```

How it works:

```
First run:   no reference yet → the image is SAVED next to the test (a __Snapshots__ folder)
             → the test fails once, so you look at it and approve it
Later runs:  render again → compare with the saved image → pass, or fail with a diff image
Intended UI change: re-record (record mode), review the new image, commit it
```

What it catches that `#expect` can't: **visual** bugs. A padding change that pushes the price off the card, a wrong color in dark mode, text cut off at large font sizes. All the **data** is still correct, so value-based tests pass, but the screen is **broken**.

Treat reference images like code: **commit** them, and **review** changes to them in pull requests.

---

## 66.5 Snapshot Testing Across Devices and OS Versions 🟡

Rendering depends on the **environment**: screen size, OS version, dark mode, Dynamic Type, language. So snapshot tests need a **fixed**, deliberate setup:

```swift
enum SnapshotConfig: String, CaseIterable, Sendable {      // test arguments must be Sendable
    case light, dark, largeText, smallScreen

    var device: ViewImageConfig { self == .smallScreen ? .iPhoneSe : .iPhone13 }

    var traits: UITraitCollection {
        switch self {
        case .dark:      UITraitCollection(userInterfaceStyle: .dark)
        case .largeText: UITraitCollection(preferredContentSizeCategory: .accessibilityExtraLarge)
        default:         UITraitCollection(userInterfaceStyle: .light)
        }
    }
}

@MainActor
@Test(arguments: SnapshotConfig.allCases)
func recipeDetailSnapshots(config: SnapshotConfig) {
    let view = RecipeDetailView(recipe: .sample)
    assertSnapshot(of: view,
                   as: .image(layout: .device(config: config.device), traits: config.traits),
                   named: config.rawValue)                 // one reference image per config
}
```

Rules to avoid **false** failures:

| Problem | Fix |
|---|---|
| Fonts render slightly differently on another **OS version** | **Pin** one simulator model + OS version for recording and CI |
| Teammates record on **different** Macs or Xcode versions | Record **only** in the pinned setup (often: only on CI) |
| Tiny anti-aliasing differences | A small tolerance: `.image(precision: 0.99, perceptualPrecision: 0.98)` |
| **Dates**, random IDs, animations in the view | Use **fixed** sample data; turn off animations |

Pick configurations that **matter**: dark mode, the largest text size, the smallest screen, and a right-to-left language catch most layout bugs. Snapshotting **every** combination makes a huge, slow suite that nobody reviews.

---

## 66.6 Testing SwiftUI Views 🟢

What should you test for a SwiftUI view?

| Layer | Test with | Why |
|---|---|---|
| **Logic** (what to show, when) | Unit tests on the **view model** / pure functions | Stable, fast, where bugs live |
| **Look** (layout, colors, fonts) | **Snapshot** tests (66.4) | Catches visual breakage |
| **Flows** (tap → navigate → save) | **UI tests** (67) | Proves the screens work together |

The most valuable step is to **move logic out of `body`**:

```swift
// ❌ Logic hidden in the view: only testable by rendering it
struct CookTimeLabel: View {
    let minutes: Int
    var body: some View {
        Text(minutes == 0 ? "No cooking" : minutes < 60 ? "\(minutes) min" : "\(minutes / 60) h \(minutes % 60) min")
    }
}

// ✅ Logic in a pure function: trivially testable (65.12)
enum CookTimeFormatter {
    static func string(minutes: Int) -> String {
        switch minutes {
        case 0:       "No cooking"
        case ..<60:   "\(minutes) min"
        case let m where m % 60 == 0: "\(m / 60) h"
        default:      "\(minutes / 60) h \(minutes % 60) min"
        }
    }
}

struct CookTimeLabel: View {
    let minutes: Int
    var body: some View { Text(CookTimeFormatter.string(minutes: minutes)) }   // nothing to test here
}
```

Libraries like **ViewInspector** can look **inside** a SwiftUI view's structure. They work, but such tests break easily, because they depend on how SwiftUI builds views **internally**. Prefer logic tests plus snapshots, and keep the view **thin**.

---

## 66.7 Testing @Observable State Changes 🟡

An **`@Observable`** class is a normal Swift class. Testing it is direct: create it, call methods, check properties. No SwiftUI needed:

```swift
@MainActor
@Observable
final class CartModel {
    private(set) var items: [CartItem] = []
    var total: Decimal { items.reduce(0) { $0 + $1.price * Decimal($1.quantity) } }

    func add(_ product: Product) {
        if let index = items.firstIndex(where: { $0.product == product }) {
            items[index].quantity += 1
        } else {
            items.append(CartItem(product: product, quantity: 1))
        }
    }
}

@MainActor
@Test func addingSameProductTwiceIncreasesQuantity() {
    let cart = CartModel()
    cart.add(.eggs)
    cart.add(.eggs)

    #expect(cart.items.count == 1)
    #expect(cart.items[0].quantity == 2)
    #expect(cart.total == Product.eggs.price * 2)
}
```

Sometimes you also want to check that a change is **observable**: that SwiftUI would actually **notice** it. Use **`withObservationTracking`**:

```swift
@MainActor
@Test func addingAnItemNotifiesObservers() {
    let cart = CartModel()
    let changed = LockIsolated(false)            // a small thread-safe box (or any Sendable flag)

    withObservationTracking {
        _ = cart.items                           // "this view reads items"
    } onChange: {
        changed.setValue(true)                   // called when items will change
    }

    cart.add(.eggs)
    #expect(changed.value)
}
```

This catches a subtle bug: state stored somewhere **outside** the observable class (a plain static, a non-observed object), which updates correctly but **never** refreshes the UI. (`LockIsolated` comes from Point-Free's concurrency-extras package; a tiny `Mutex`-based class of your own works too.)

---

## 66.8 Testing App Intents with AppIntentsTesting 🟡

An App Intent's logic lives in **`perform()`**, a normal async method (51.2). So you can test it **today** by creating the intent, setting its parameters, and calling `perform()` (51.14):

```swift
@Test func markCookedIntentUpdatesStore() async throws {
    let store = InMemoryRecipeStore()                         // a fake (66.1)
    await store.save(.pasta)
    AppDependencyManager.shared.add(dependency: store as RecipeStoring)

    var intent = MarkRecipeCookedIntent()                     // a struct: use var to set parameters
    intent.recipe = RecipeEntity(id: Recipe.pasta.id, title: Recipe.pasta.title)

    _ = try await intent.perform()

    #expect(try await store.recipe(id: Recipe.pasta.id).isCooked)
}
```

The iOS 27 SDK adds the **`AppIntentsTesting`** framework (title, and 51.14). It aims to run intents more like the **system** does: resolving parameters, and letting you check the **dialog**, **snippet**, or returned **value** of the result.

⚠️ It's new: check the documentation for its exact API.

Either way, you test your Siri and Shortcuts integration with **normal** unit tests, no voice or Shortcuts app needed. Also test the **entity queries** (51.4): unknown IDs should return **fewer** results, not crash.

---

## 66.9 Contract Testing Against a Backend 🟡

Unit tests with stubs (65.14) check that the app handles the data you **assume** the server sends. But what if the server **changes**? A renamed field, a number that became a string, a new required value. Your stubs still return the **old** shape, so every test **passes**, and the app breaks in production.

**Contract testing** checks the app's assumptions against the server's **real** behavior. Common approaches:

| Approach | How |
|---|---|
| **Shared schema** | Client and server both follow an **OpenAPI** file; tests (or code generation) use it |
| **Generated client** | Generate the Swift networking code from the OpenAPI spec (e.g. swift-openapi-generator): a schema change shows up as a **compile error** |
| **Contract fixtures** | Example responses kept **with the backend**, checked by **both** teams' CI |
| **Consumer-driven contracts** | The app publishes "what I need" (e.g. with Pact); the **server's** CI verifies it can provide it |

A simple contract test with shared fixtures:

```swift
@Suite(.tags(.contract))
struct RecipeAPIContractTests {
    // These JSON files live in the backend repo too; its CI checks real responses still match them
    @Test(arguments: ["recipe_v2_minimal.json", "recipe_v2_full.json", "recipe_v2_no_photo.json"])
    func decodesContractExamples(file: String) throws {
        let data = try ContractFixtures.load(file)
        let recipe = try JSONDecoder.api.decode(RecipeDTO.self, from: data)
        #expect(!recipe.title.isEmpty)
    }
}
```

The value is in the **shared** part: if a backend change would break these examples, the **backend's** CI fails **before** the change ships, not your users' apps.

---

## 66.10 Recorded Fixtures vs Live Integration Tests 🟡

| | Recorded fixtures | Live integration tests |
|---|---|---|
| What | Saved real responses, **replayed** | Real calls to a **staging** server |
| Speed | Milliseconds | Seconds |
| Reliability | **Deterministic** | Can fail from network or server issues |
| Works offline | Yes | No |
| Risk | Fixtures go **stale** as the server changes | Flaky; needs test accounts and data |

To replay fixtures through your **real** networking code, plug a custom **`URLProtocol`** into the `URLSession`:

```swift
final class FixtureURLProtocol: URLProtocol {
    nonisolated(unsafe) static var fixtures: [String: (status: Int, file: String)] = [:]   // path → response

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url,
              let fixture = Self.fixtures[url.path],
              let data = try? Fixtures.load(fixture.file) else {
            client?.urlProtocol(self, didFailWithError: URLError(.resourceUnavailable))
            return
        }
        let response = HTTPURLResponse(url: url, statusCode: fixture.status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

@Suite(.serialized)                                    // the fixtures table is shared state
struct RecipeAPIClientTests {
    let client: RecipeAPIClient

    init() {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FixtureURLProtocol.self]
        client = RecipeAPIClient(session: URLSession(configuration: configuration))
    }

    @Test func parsesRecipeList() async throws {
        FixtureURLProtocol.fixtures = ["/v2/recipes": (200, "recipes_page1.json")]
        let recipes = try await client.recipes()
        #expect(recipes.count == 20)
    }

    @Test func serverErrorBecomesFriendlyError() async {
        FixtureURLProtocol.fixtures = ["/v2/recipes": (503, "error_maintenance.json")]
        await #expect(throws: APIError.serviceUnavailable) { try await client.recipes() }
    }
}
```

This tests your **whole** client (URL building, decoding, error mapping) with **no** network.

Most good projects use **both**: fixtures for the **many** fast tests that run on every change, and a **few** live tests (tagged `.integration`, 65.8) that run **nightly** to notice when fixtures go stale. **Re-record** fixtures when the API changes.

---

## 66.11 Code Coverage: Reading It Honestly 🟢

**Code coverage** shows which lines **ran** during the tests. Turn it on in the scheme or test plan ("Gather coverage"), and Xcode shows a percentage per file, and red/green markers next to each line.

The trap: coverage measures **execution**, not **checking**:

```swift
// 100% coverage of calculateTotal, and it verifies NOTHING
@Test func calculateTotalRuns() {
    _ = calculateTotal(items: [Item(price: 10), Item(price: 20)])
    // no #expect: if calculateTotal returned 0, this test would still pass
}
```

So read coverage the **right way round**:

| Coverage tells you | It does NOT tell you |
|---|---|
| ✅ This code **never runs** in any test: a real gap | ❌ This code is **correctly** tested |
| ✅ Which **branches** (an `else`, an error path) are never taken | ❌ The tests have **good** assertions |

Good uses:

- Look for **important** code with **0%**: payment logic, data migrations, error handling.
- Check that a new feature's **error paths** are covered, not just the happy path.
- Watch for big **drops** in a pull request.

Bad use: a **target number** ("we must reach 90%"). Teams then write tests like the one above, which raise the number and protect nothing. To measure test **quality**, see mutation testing (66.13).

---

## 66.12 Property-Based Testing 🔴

In example-based tests, **you** pick the inputs (65.5). In **property-based testing**, the test **generates** many random inputs and checks a **property**: something that must be true for **every** valid input.

Good properties:

| Property | Example |
|---|---|
| **Round trip** | `decode(encode(x)) == x` |
| **Invariant** | Scaling a recipe never makes an amount **negative** |
| **Idempotence** | `normalize(normalize(s)) == normalize(s)` |
| **Equivalence** | A fast algorithm gives the **same** result as a simple, slow one |

```swift
// A seeded random generator: the SAME seed gives the SAME inputs, so failures can be reproduced
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed }
    mutating func next() -> UInt64 {                  // SplitMix64
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }
}

@Test(arguments: 0..<200)                             // 200 seeds = 200 random recipes
func recipeSurvivesJSONRoundTrip(seed: UInt64) throws {
    var rng = SeededGenerator(seed: seed)
    let recipe = Recipe.random(using: &rng)           // random title (emoji, empty, very long…),
                                                      // random amounts, random step counts
    let data = try JSONEncoder().encode(recipe)
    let decoded = try JSONDecoder().decode(Recipe.self, from: data)

    #expect(decoded == recipe, "Failed for seed \(seed)")   // the seed lets you replay it
}
```

Its strength: it finds the cases **you didn't think of**. An empty string, an emoji with a skin-tone modifier, `Decimal` values with many digits, a recipe with zero steps. Hand-picked examples **systematically** miss these, because you only write the cases that come to **mind**.

Full property-testing libraries also **shrink** failures: they turn a failing 300-character random string into the **smallest** input that still fails, like `"é"`. Use a **seed** so every failure can be **reproduced**.

---

## 66.13 Mutation Testing for Suite Quality 🔴

Coverage (66.11) says which code **ran**. **Mutation testing** asks the real question: **would the tests notice a bug?**

A mutation tool (for Swift, for example **Muter**) changes your code in small ways (**mutants**), and runs the tests against **each** one:

```swift
// Original
func total(_ items: [Item]) -> Decimal {
    items.reduce(0) { $0 + $1.price }
}

// Mutant 1: + becomes -
items.reduce(0) { $0 - $1.price }

// Mutant 2: start value 0 becomes 1
items.reduce(1) { $0 + $1.price }

// Mutant 3: a condition is flipped, e.g. `if isExpired` → `if !isExpired`
```

| Result | Meaning |
|---|---|
| A test **fails** → mutant **killed** ✅ | Your tests **notice** this kind of bug |
| All tests **pass** → mutant **survived** ❌ | A real gap: this bug would ship unnoticed |

The **mutation score** (killed ÷ total) measures test **quality**, not just coverage. The no-assertion test from 66.11 has 100% coverage but kills **zero** mutants.

The cost: the whole relevant test suite runs **once per mutant**, and a module can have thousands. So:

- run it on **core** modules only (pricing, sync, parsing), not the whole app,
- run it **nightly** or before releases, not on every commit,
- look at **surviving** mutants one by one: each points to a missing or weak `#expect`.

---

## 66.14 Test Plans and Configurations 🟡

A **test plan** (`.xctestplan` file) describes **how** to run tests: which targets, which tests to **skip**, environment variables, language and region, sanitizers (68.16, 68.17), code coverage, and **repetition**. You can have several plans for the **same** tests:

```
Fast.xctestplan        → unit tests only, skip .slow and .networking tags, no coverage
Full.xctestplan        → everything, with code coverage
Locales.xctestplan     → 3 configurations: English, German (long words), Arabic (right-to-left)
Sanitizers.xctestplan  → Address and Thread Sanitizer on (slower; nightly)
```

Each plan can have **configurations**: the same tests run once per configuration (for example once per language). A simplified look at the file (it's JSON, edited through Xcode's UI):

```json
{
  "configurations": [
    { "name": "English", "options": { "language": "en", "region": "US" } },
    { "name": "Arabic",  "options": { "language": "ar", "region": "SA" } }
  ],
  "defaultOptions": {
    "codeCoverage": true,
    "environmentVariableEntries": [{ "key": "USE_FIXTURES", "value": "1" }]
  },
  "testTargets": [{ "target": { "name": "RecipeAppTests" } }]
}
```

Run a plan from the command line (CI):

```bash
xcodebuild test -scheme RecipeApp -testPlan Fast \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

Useful options:

- **Test repetition** ("run until failure", "retry on failure"): great for **finding** flaky tests (67.8). Don't use automatic retries to **hide** them.
- **Execution order: random**: finds tests that secretly depend on each other.

Plans separate **what** the tests are from **how** a run uses them. The settings live in **git**, so local runs and CI behave the same.

---

## 66.15 Test Parallelization and Sharding 🔴

There are **two** levels of parallel testing:

| Level | Where | How |
|---|---|---|
| **In-process** parallelism | One machine, one test process | Swift Testing runs tests on many threads (65.9) |
| **Parallel test workers** | One machine, several simulator **clones** | `-parallel-testing-enabled YES` |
| **Sharding** | **Several** machines (CI runners) | Each runner runs **part** of the suite |

On one machine, Xcode can clone the simulator and split test **classes/suites** across the clones:

```bash
xcodebuild test -scheme RecipeApp -testPlan Full \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -parallel-testing-enabled YES -parallel-testing-worker-count 4
```

**Sharding** across machines: build **once**, then let each runner test a **subset**:

```bash
# 1. Build once (one runner), keep the products as a CI artifact
xcodebuild build-for-testing -scheme RecipeApp -destination '...' -derivedDataPath build

# 2. On each of 4 runners, test only that shard's suites
xcodebuild test-without-building -xctestrun build/Build/Products/RecipeApp_*.xctestrun \
  -destination '...' \
  -only-testing:RecipeAppTests/CartTests -only-testing:RecipeAppTests/SyncTests   # shard 1's list
```

Split shards by **measured duration**, not alphabetically: one shard with all the slow sync tests finishes last and decides the total time. Many CI systems can rebalance shards from previous run times automatically.

The levels **stack**: each shard runs on its own machine, and inside it, tests still run in parallel. A 40-minute suite can drop to under 10 minutes.

Parallelism also **exposes** hidden coupling: tests that pass alone but fail when run alongside others share state they shouldn't. Fix the sharing; don't just turn parallelism off.

---

## Summary

| Concept | Key idea | Purpose |
|---|---|---|
| Test doubles | Stub, spy, mock, fake | Use the simplest double the test needs |
| Actors | `await` + concurrent task groups | Test correctness under concurrency |
| Time | Inject `any Clock`; `TestClock` (swift-clocks) | Fast, deterministic time-based tests |
| Snapshots | swift-snapshot-testing, reference images | Catch visual bugs that values can't show |
| Snapshot setup | Pinned simulator/OS, chosen configurations | No false failures from the environment |
| SwiftUI views | Logic in pure functions/view models; thin views | Test logic directly, look via snapshots |
| `@Observable` | Plain property checks; `withObservationTracking` | Check results and that changes are observable |
| App Intents | Call `perform()`; `AppIntentsTesting` (iOS 27) | Siri and Shortcuts logic as normal unit tests |
| Contracts | Shared schema, fixtures, consumer-driven contracts | Catch backend changes before users do |
| Fixtures vs. live | `URLProtocol` replay + a few nightly live tests | Fast by default, real-world checks regularly |
| Coverage | Finds untested code | Not a quality score |
| Property-based | Random inputs, seeded, checked properties | Find the cases nobody thought of |
| Mutation testing | Mutants killed vs. survived | Measures whether tests notice bugs |
| Test plans | `.xctestplan`, configurations, `-testPlan` | Reusable, versioned ways to run tests |
| Sharding | Build once, split by duration across machines | Big suites in a fraction of the time |
