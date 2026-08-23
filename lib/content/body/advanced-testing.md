## 66.1 Test Doubles: Stub, Mock, Spy, Fake

"Test double" is the umbrella term for any stand-in used in place of a real dependency, with several distinct flavors: a stub returns canned responses with no verification of how it was called, a mock additionally verifies specific interactions occurred, a spy wraps a real object while recording calls made to it, and a fake provides a genuinely working (but simplified) implementation, like an in-memory database standing in for a real one.

```swift
// Stub: just returns a canned value
struct StubUserService: UserServicing {
    func fetchUser(id: String) async throws -> User { User(name: "Ada", age: 30) }
}

// Fake: a genuinely working, simplified implementation
actor FakeUserStore: UserServicing {
    private var users: [String: User] = [:]
    func fetchUser(id: String) async throws -> User {
        guard let user = users[id] else { throw TestError.notFound }
        return user
    }
    func insert(_ user: User, id: String) { users[id] = user }
}
```

Recognizing which specific flavor a given test double actually needs to be avoids over- or under-engineering test infrastructure — the simple `MockUserService` from section 65.14 is really a stub (it returns a canned response with no call verification), and reaching for a genuinely more complex fake (like `FakeUserStore` above, supporting insertion and realistic lookup failure) is worth the extra effort specifically when a test's logic depends on that more realistic, stateful behavior rather than a single, fixed return value.

---

## 66.2 Testing Actors and Isolated Code

Testing code that involves actor isolation (recall Part 2's concurrency material) requires the test itself to properly cross isolation boundaries — an `async` test function can `await` a call into an actor's isolated methods just like any other async calling context, with Swift's compiler-enforced isolation checking applying to test code exactly as it would to production code.

```swift
actor Counter {
    private var value = 0
    func increment() { value += 1 }
    func current() -> Int { value }
}

@Test func counterIncrementsCorrectly() async {
    let counter = Counter()
    await counter.increment()
    await counter.increment()
    #expect(await counter.current() == 2)
}
```

Because actor isolation is enforced by the compiler rather than being a purely runtime convention, tests exercising actor-isolated code get the same correctness guarantees the production code itself benefits from — there's no way to accidentally write a test that reads an actor's state without properly `await`-ing across the isolation boundary, since the compiler would reject such code the same way it would reject the equivalent mistake in non-test code.

---

## 66.3 Deterministic Time with TestClock

For code depending on the passage of time (a debounced search, a timeout, a retry-with-backoff policy), `TestClock` (part of Swift's `Clock` protocol abstraction) lets a test advance simulated time explicitly and instantly, rather than the test actually waiting for real wall-clock time to pass.

```swift
@Test func debouncedSearchFiresAfterDelay() async throws {
    let clock = TestClock()
    let debouncer = SearchDebouncer(clock: clock, delay: .seconds(1))

    async let result = debouncer.search(for: "swift")
    await clock.advance(by: .seconds(1))

    #expect(try await result == "results for swift")
}
```

This depends on production code itself being written against the generic `Clock` protocol (rather than hardcoding calls to `Task.sleep` with the system's real clock) — directly extending the dependency injection principle from section 65.13, but applied specifically to time as a dependency, letting a test complete in milliseconds by instantly advancing simulated time rather than genuinely waiting a full real second (or longer) for a time-dependent behavior to actually occur.

---

## 66.4 Snapshot Testing Setup

Snapshot testing captures a rendered view's actual visual output (an image) and compares it against a previously approved "reference" snapshot on subsequent test runs, failing the test if the rendered output has changed unexpectedly — a fundamentally different verification approach than assertion-based testing, checking visual appearance directly rather than checking individual property values.

```swift
import SnapshotTesting

@Test func profileViewMatchesSnapshot() {
    let view = ProfileView(user: User(name: "Ada", age: 30))
    assertSnapshot(of: view, as: .image)
}
```

Snapshot testing is particularly valuable for catching visual regressions that assertion-based tests would completely miss — a test asserting individual `@State` values or view model properties provides no protection against, say, an accidental layout change that visually breaks a view while leaving all the underlying data values technically correct, which is precisely the class of bug snapshot testing is designed to catch by comparing actual rendered pixels rather than individual data properties.

---

## 66.5 Snapshot Testing Across Devices and OS Versions

Because rendering can genuinely differ across device sizes, OS versions, and appearance settings (Dynamic Type, dark mode), a snapshot testing setup needs deliberate configuration for which specific devices/OS versions/configurations snapshots are captured and compared against, since an unconfigured, ad hoc setup risks false failures purely from environmental differences rather than genuine regressions.

```swift
@Test func profileViewAcrossConfigurations() {
    let view = ProfileView(user: User(name: "Ada", age: 30))
    assertSnapshot(of: view, as: .image(layout: .device(config: .iPhone13)))
    assertSnapshot(of: view, as: .image(traits: .init(userInterfaceStyle: .dark)))
    assertSnapshot(of: view, as: .image(traits: .init(preferredContentSizeCategory: .accessibilityExtraLarge)))
}
```

This deliberate configuration matters because snapshot tests are notoriously prone to environmental flakiness if run carelessly — a snapshot captured on one Xcode/simulator OS version can differ subtly (font rendering, minor layout metrics) from the same view rendered under a different OS version, meaning a well-run snapshot testing setup typically pins snapshot generation and comparison to a specific, consistent simulator/OS configuration (often enforced via CI configuration) rather than allowing snapshots to be captured inconsistently across different developers' local environments.

---

## 66.6 Testing SwiftUI Views

Beyond snapshot testing's visual comparison approach, SwiftUI views can also be tested more directly by inspecting their structure or behavior — using view inspection libraries to assert that specific content is present, or (more commonly and more robustly) testing the underlying `@Observable` view model or state logic directly rather than the view's rendering specifics.

```swift
// Testing the underlying logic directly is often more robust than inspecting view structure:
@Test func viewModelReflectsLoadedUser() async throws {
    let viewModel = ProfileViewModel(userService: MockUserService(userToReturn: User(name: "Ada", age: 30)))
    try await viewModel.load(id: "123")
    #expect(viewModel.displayName == "Ada")
}
```

This preference for testing underlying logic over view structure directly reflects a genuine testing design principle — a view's actual rendering is often better verified via snapshot testing (66.4), since view structure inspection tends to be brittle and tightly coupled to SwiftUI's internal view representation, while the *logic* driving what a view displays (computed from an `@Observable` view model, section 66.7) is both more stable to test against and where the actual business logic genuinely worth verifying tends to live.

---

## 66.7 Testing @Observable State Changes

Testing `@Observable` view models (recall the `@Observable` macro's role in modern SwiftUI state management from Part 3) is comparatively direct — because `@Observable` types are plain Swift objects with normal properties, a test can simply create an instance, call methods or mutate state, and assert on the resulting property values, without needing any SwiftUI-specific testing infrastructure.

```swift
@Observable
class CartViewModel {
    private(set) var itemCount = 0
    func addItem() { itemCount += 1 }
}

@Test func addingItemIncrementsCount() {
    let viewModel = CartViewModel()
    viewModel.addItem()
    #expect(viewModel.itemCount == 1)
}
```

This straightforwardness is a genuine advantage of `@Observable`'s design over the SwiftUI-specific machinery it's built on — testing an `@Observable` object requires no special SwiftUI test harness or view-hosting infrastructure at all, since from a test's perspective it's simply a plain Swift object being exercised through its normal public interface, with the `@Observable` macro's actual observation-tracking machinery being entirely orthogonal to whether the object's own logic is correct.

---

## 66.8 Testing App Intents with AppIntentsTesting

`AppIntentsTesting` (already referenced in section 51.13) provides infrastructure specifically for testing `AppIntent` implementations without requiring an actual Siri invocation or Shortcuts app interaction — directly instantiating an intent, providing parameter values, and calling `perform()` to verify the resulting `IntentResult`.

```swift
import AppIntentsTesting

@Test func addTaskIntentCreatesTask() async throws {
    let intent = AddTaskIntent()
    intent.title = "Buy milk"
    let result = try await intent.perform()
    #expect(result.value?.title == "Buy milk")
}
```

Being able to test an `AppIntent` this directly is a meaningful testability advantage rooted in `AppIntent`'s own design — because an intent's actual logic lives in an ordinary, directly callable `perform()` method (rather than being entangled with Siri's own invocation machinery), testing it requires no more special infrastructure than testing any other Swift type's method, letting an app's Shortcuts/Siri integration logic (section 51) be verified with the same ordinary testing approach used for the rest of the app's logic.

---

## 66.9 Contract Testing Against a Backend

Contract testing verifies that an app's networking layer correctly handles the *actual* shape of a backend API's responses — distinct from simply mocking expected responses, contract tests run against a real (or realistically simulated) backend, or against a formally shared API contract/schema, specifically to catch cases where the backend's actual behavior has drifted from what the client code assumes.

```swift
// A contract test verifies decoding against a schema/contract the backend team also validates against,
// catching drift between what the client assumes and what the backend actually returns:
@Test func decodesActualBackendUserResponse() async throws {
    let contractFixture = try loadContractFixture("user_response_v2.json")  // maintained jointly with backend team
    let user = try JSONDecoder().decode(User.self, from: contractFixture)
    #expect(user.name.isEmpty == false)
}
```

Contract testing addresses a genuine gap that purely mock-based unit testing (like the `MockUserService` from section 65.14) cannot catch — a unit test using a hand-written mock only verifies that the client code behaves correctly given the shape the developer *assumed* the backend returns, while a real backend could have silently changed its actual response shape, a mismatch a mock-based test would never detect but a contract test, validated against the backend's actual current behavior or a jointly-maintained schema, specifically exists to catch.

---

## 66.10 Recorded Fixtures vs Live Integration Tests

Recorded fixtures (captured real responses, replayed deterministically in tests) provide fast, reliable, offline-capable tests at the cost of potentially growing stale relative to the real backend, while live integration tests (making genuine network calls against a real or staging backend) provide maximum realism at the cost of speed, reliability, and requiring actual network/backend availability during test runs.

```swift
// Recorded fixture approach: fast, deterministic, but can go stale
@Test func decodesRecordedUserFixture() throws {
    let data = try loadFixture("recorded_user_response.json")
    let user = try JSONDecoder().decode(User.self, from: data)
    #expect(user.name == "Ada")
}
// Live integration approach: genuinely current, but slower and network-dependent
@Test(.tags(.integration, .slow)) func fetchesRealUserFromStaging() async throws {
    let user = try await liveAPIClient.fetchUser(id: "test-user-1")
    #expect(user.name.isEmpty == false)
}
```

This is a genuine trade-off rather than a strictly-better-or-worse choice between the two approaches, and most well-tested projects use both deliberately — recorded fixtures for the bulk of fast, frequently-run unit tests (tagged and filtered per section 65.8's tagging discussion), with a smaller number of live integration tests (perhaps run less frequently, like nightly, given their cost) specifically to catch the staleness that recorded fixtures alone would eventually accumulate relative to the real, evolving backend.

---

## 66.11 Code Coverage: Reading It Honestly

Code coverage measures which lines/branches of code were actually executed during a test run, but a high coverage percentage is a meaningfully weaker signal than it might first appear — code being *executed* during a test says nothing about whether that execution was actually *verified* by a meaningful assertion, meaning coverage is better understood as identifying untested code (a genuinely useful signal) than as certifying tested code's actual quality.

```swift
// This test achieves 100% "coverage" of calculateTotal, but verifies nothing meaningful:
@Test func coverageWithoutVerification() {
    let total = calculateTotal(items: [Item(price: 10), Item(price: 20)])
    // no assertion at all — the line executed, so coverage tools count it as "covered,"
    // but the test provides zero actual verification of correctness
}
```

This distinction matters because treating coverage percentage as a direct proxy for test suite quality can produce genuinely misleading incentives — a team optimizing purely for a coverage number can end up with tests that execute code without meaningfully asserting on its behavior (exactly like the example above), meaning coverage is best used the way the section frames it: as a tool for finding code with *no* test coverage at all (a real gap worth investigating), rather than as a quality score for code that already has some coverage.

---

## 66.12 Property-Based Testing 🔴

Rather than a test author choosing specific example inputs (as in parameterized testing, section 65.5), property-based testing generates many random inputs automatically and asserts that a general property holds across all of them — appropriate for verifying invariants (like "decoding then re-encoding produces the original value" or "sorting a list is idempotent") that should hold for essentially any valid input, not just a few hand-picked examples.

```swift
// Conceptual property-based test: for ANY array of integers,
// sorting twice should produce the same result as sorting once
@Test func sortingIsIdempotent() {
    for _ in 0..<100 {
        let randomArray = (0..<20).map { _ in Int.random(in: -1000...1000) }
        let sortedOnce = randomArray.sorted()
        let sortedTwice = sortedOnce.sorted()
        #expect(sortedOnce == sortedTwice)
    }
}
```

Property-based testing's genuine value is in surfacing edge cases a human test author simply wouldn't have thought to write by hand — random input generation can stumble onto boundary conditions (empty collections, extreme values, unusual character combinations) that hand-picked example-based tests systematically miss, precisely because those edge cases weren't things the test author happened to think of when writing example-based parameterized tests.

---

## 66.13 Mutation Testing for Suite Quality 🔴

Mutation testing addresses the exact gap identified in 66.11 (coverage measuring execution, not verification) directly — a mutation testing tool automatically introduces small, deliberate bugs ("mutants") into the production code, then re-runs the test suite against each mutant; a genuinely strong test suite should catch (fail against) most mutants, while a weak suite that merely achieves high coverage without meaningful assertions will let many mutants survive undetected.

```swift
// A mutation testing tool might automatically generate mutants like:
// original:  return items.reduce(0) { $0 + $1.price }
// mutant 1:  return items.reduce(0) { $0 - $1.price }   // + changed to -
// mutant 2:  return items.reduce(1) { $0 + $1.price }   // 0 changed to 1
// A strong test suite should fail against both mutants; a suite that
// passes against a surviving mutant reveals a genuine gap in verification.
```

Mutation testing directly measures what code coverage alone cannot — whether the test suite would actually *notice* if the production code's behavior were subtly wrong, providing a genuinely more rigorous signal of test suite quality than coverage percentage alone, though at real cost, since mutation testing requires running the entire test suite once per generated mutant, making it meaningfully more expensive to run than a single standard test pass.

---

## 66.14 Test Plans and Configurations

Xcode test plans bundle a specific configuration of which tests to run, environment variables, code coverage settings, and other run-time options into a reusable, shareable `.xctestplan` file — letting different testing scenarios (a fast pre-commit check, a full nightly run, a specific device/locale configuration) be defined once and selected explicitly rather than manually reconfigured each time.

```plaintext
// A test plan configuration might define separate plans like:
// "Fast-PreCommit.xctestplan": excludes .slow-tagged tests, runs on one simulator
// "Full-Nightly.xctestplan": includes all tests, runs across multiple device/OS configurations
// "Localization-Sweep.xctestplan": runs UI tests across every supported locale
```

Test plans provide a genuinely useful separation between *what tests exist* and *how a given testing scenario should run them* — the same underlying test suite can be run under multiple different plans (a fast subset for quick local iteration, the complete suite with full device coverage for a release candidate), consistent with the tag-based filtering discussed in section 65.8, but formalized into a reusable, version-controlled configuration file rather than requiring the filtering criteria to be manually specified for each individual test run.

---

## 66.15 Test Parallelization and Sharding 🔴

Beyond Swift Testing's own default parallel execution *within* a single test run (section 65.9), test parallelization and sharding at the CI level splits an entire test suite across multiple separate machines or processes running concurrently, meaningfully reducing total wall-clock time for a large test suite that would otherwise run sequentially on a single machine.

```plaintext
// Conceptually, a CI configuration might shard a large suite across 4 parallel runners:
// Runner 1: runs tests A-F alphabetically
// Runner 2: runs tests G-M alphabetically
// Runner 3: runs tests N-S alphabetically
// Runner 4: runs tests T-Z alphabetically
// Total wall-clock time approaches (total test time / 4), rather than the full sequential duration.
```

This is a genuinely distinct concern from Swift Testing's built-in parallel execution within a single process (which parallelizes across CPU cores on one machine) — sharding operates at a coarser level, distributing entire chunks of the test suite across *separate* machines or CI runners entirely, and the two techniques compose naturally: each shard's own subset of tests can still run with Swift Testing's internal parallelism, providing two independent, complementary layers of parallelization for a genuinely large test suite.

---

## Summary

| Concept | Key Idea | Purpose |
|---|---|---|
| Test double taxonomy | Stub, mock, spy, fake | Matching double complexity to actual test needs |
| Actor testing | `await` across isolation boundaries | Compiler-enforced correctness extends to test code |
| Time control | `TestClock`, `Clock` protocol | Instant, deterministic simulated time advancement |
| Visual regression | Snapshot testing, `assertSnapshot` | Catches rendering bugs assertions alone would miss |
| Environmental consistency | Pinned device/OS snapshot configuration | Avoids false failures from environmental drift |
| View testing strategy | Logic-first, snapshot for rendering | Testing stable logic over brittle view structure |
| `@Observable` testing | Direct property/method assertions | No special SwiftUI test harness required |
| Intent testing | `AppIntentsTesting`, direct `perform()` | No Siri/Shortcuts invocation needed |
| Backend drift detection | Contract testing | Catches real API shape changes mocks would miss |
| Fixture strategy | Recorded fixtures vs. live integration | Speed/reliability vs. realism trade-off, used together |
| Coverage's real meaning | Execution ≠ verification | Best used to find untested code, not to score quality |
| Edge case discovery | Property-based testing | Random inputs surface cases humans wouldn't think of |
| Suite quality measurement | Mutation testing | Measures whether tests would catch actual bugs |
| Configuration management | `.xctestplan` | Reusable, shareable test run configurations |
| CI-level scaling | Test sharding | Distributes suite across machines, complementing in-process parallelism |
