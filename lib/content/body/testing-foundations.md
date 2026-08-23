## 65.1 Why Tests Exist — The Actual Argument

Tests exist to make change safe — the real value of a test suite isn't verifying code works today, but providing confidence that a future change (a refactor, a new feature, a dependency upgrade) hasn't silently broken something that used to work, catching regressions automatically rather than relying on manual re-verification or, worse, discovering breakage in production.

```swift
// The actual argument for tests isn't "prove this works right now" —
// it's "let me change this code later with confidence,"
// making tests an investment in the codebase's future changeability,
// not just a checkbox for the current state of the code.
```

This framing matters because it clarifies what makes a test genuinely valuable versus merely present — a test that would never actually catch a real regression (one asserting something trivially true, or one so brittle it breaks on any unrelated change) provides little of this actual change-safety value, meaning the quality bar for a useful test is whether it would genuinely fail if the behavior it's protecting were actually broken, not simply whether a test technically exists for a given piece of code.

---

## 65.2 Swift Testing: @Test and #expect

Swift Testing, the modern testing framework, marks test functions with the `@Test` macro and uses `#expect` for assertions — `#expect` records a failure but continues executing the test if the expectation fails, letting a single test surface multiple independent problems rather than stopping at the first failure.

```swift
import Testing

@Test func additionIsCorrect() {
    let result = 2 + 2
    #expect(result == 4)
}

@Test func multipleExpectationsInOneTest() {
    let user = User(name: "Ada", age: 30)
    #expect(user.name == "Ada")
    #expect(user.age == 30)  // still evaluated even if the name expectation above failed
}
```

`#expect`'s continue-on-failure behavior is a deliberate design choice distinguishing it from `#require` (65.3) — for independent assertions within one logical test (checking several unrelated properties of a decoded object, say), continuing execution after a failed expectation surfaces the complete picture of what's actually wrong in one test run, rather than requiring several separate test-run cycles to discover each failing assertion one at a time.

---

## 65.3 #require and Stopping on Failure

`#require` behaves like `#expect` but stops the test's execution immediately if the requirement isn't met — appropriate when a subsequent line of test code genuinely cannot proceed meaningfully without the requirement holding true, such as unwrapping an optional that later code depends on.

```swift
@Test func decodingProducesValidUser() throws {
    let data = try loadTestFixture("user.json")
    let user = try #require(try? JSONDecoder().decode(User.self, from: data))
    // subsequent lines can safely assume `user` is valid, since #require would have stopped otherwise
    #expect(user.name == "Ada")
}
```

The choice between `#expect` and `#require` should reflect the actual logical dependency between assertions — `#require` is the right tool when continuing execution after a failure would be meaningless or would produce a confusing crash (like force-unwrapping a `nil` optional in subsequent code), while `#expect` is appropriate when assertions are genuinely independent and each provides useful information on its own even if an earlier one fails.

---

## 65.4 @Suite for Grouping Tests

`@Suite` groups related tests together, providing a shared name, optional shared setup/teardown via `init`/`deinit`, and a natural home for tests belonging to the same feature or type, replacing the class-based grouping XCTest previously required.

```swift
@Suite("User validation tests")
struct UserValidationTests {
    let validator = UserValidator()

    @Test func rejectsEmptyName() {
        #expect(!validator.isValid(User(name: "", age: 30)))
    }

    @Test func acceptsValidUser() {
        #expect(validator.isValid(User(name: "Ada", age: 30)))
    }
}
```

Using a `struct` (rather than XCTest's required `class` inheriting from `XCTestCase`) for a test suite is possible because Swift Testing doesn't rely on the same inheritance-based test discovery mechanism XCTest used — each test method gets a fresh instance of the suite type, meaning shared `let` properties like `validator` above are naturally re-initialized for every individual test, providing clean test isolation without needing explicit `setUp`/`tearDown` boilerplate for simple cases.

---

## 65.5 Parameterized Tests with arguments:

`@Test(arguments:)` runs the same test function body once for each value in a provided collection, avoiding the repetition of writing nearly-identical test functions that differ only in their input value.

```swift
@Test("Validates various ages", arguments: [-5, 0, 17, 18, 65, 150])
func ageValidation(age: Int) {
    let isValid = (0...120).contains(age)
    #expect(User.isValidAge(age) == isValid)
}
```

Parameterized testing genuinely improves test coverage's cost-to-benefit ratio — rather than writing six separate, nearly identical test functions (`testAgeNegative5`, `testAgeZero`, `testAge17`, and so on) that would need to be kept in sync with each other as the test logic evolves, one parameterized test covers all six cases with a single, maintained test body, and each parameter value is reported as its own independent pass/fail result in the test output.

---

## 65.6 Zipped and Cross-Product Test Cases

Beyond a single argument collection, `@Test(arguments:)` supports zipped pairs (iterating two collections together, element by element) and cross-product combinations (testing every combination of values from two or more collections) for tests genuinely needing to exercise multiple input dimensions.

```swift
@Test(arguments: zip(["Ada", "", "Bob"], [true, false, true]))
func nameValidation(name: String, expectedValid: Bool) {
    #expect(User.isValidName(name) == expectedValid)
}

@Test(arguments: [true, false], ["light", "dark"])
func themeRendering(highContrast: Bool, colorScheme: String) {
    // runs once for every combination: 2 × 2 = 4 total test invocations
}
```

Choosing between zipped and cross-product parameterization reflects a genuine difference in test intent — zipping is appropriate when specific input pairs are meaningfully related (this particular name should produce this particular validity result), while cross-product testing is appropriate when every combination of independent dimensions genuinely needs coverage (does a given rendering behave correctly under every combination of contrast setting and color scheme), and choosing the wrong one either under-tests real combinations or creates meaningless, unrelated pairings.

---

## 65.7 Test Traits: .enabled(if:), .disabled, .bug()

Test traits attach metadata and conditional behavior to a `@Test` — `.enabled(if:)` conditionally runs a test based on a runtime condition, `.disabled` skips a test entirely (with an optional reason), and `.bug()` links a test to a known issue tracker entry, documenting why a test might currently be expected to fail.

```swift
@Test(.enabled(if: ProcessInfo.processInfo.environment["RUN_SLOW_TESTS"] != nil))
func expensiveIntegrationTest() { /* ... */ }

@Test(.disabled("Flaky pending investigation, see JIRA-1234"))
func occasionallyFailingTest() { /* ... */ }

@Test(.bug("https://github.com/example/repo/issues/456"))
func knownRegressionTest() { /* ... */ }
```

These traits provide structured, machine-readable metadata about a test's status rather than relying on ad hoc comments or manually commenting out failing test code — a `.disabled` test with a documented reason remains visible in test output (as skipped, not silently absent), and `.bug()` creates a traceable link between a specific test and the issue explaining its current state, both meaningfully more maintainable than the equivalent informal conventions.

---

## 65.8 Test Tags and Filtering

Tags (custom `Tag` values applied via the `.tags()` trait) let tests be categorized along dimensions independent of their suite structure — marking tests as `.slow`, `.networking`, or `.flaky`, for instance — enabling selective test runs that include or exclude tests matching specific tags.

```swift
extension Tag {
    @Tag static var networking: Self
    @Tag static var slow: Self
}

@Test(.tags(.networking, .slow))
func fetchesRemoteUserProfile() async throws { /* ... */ }
```

Tags provide a genuinely useful orthogonal categorization to suite-based grouping — a CI pipeline might run the full test suite on every commit but explicitly exclude `.slow`-tagged tests for fast feedback, running the complete set (including slow tests) only on a nightly build or before a release, a filtering capability that would be considerably more awkward to achieve through suite structure alone, since a single test's suite membership and its tags represent genuinely independent classification dimensions.

---

## 65.9 .serialized and .timeLimit

By default, Swift Testing runs tests in parallel for speed; the `.serialized` trait forces a suite's tests to run sequentially instead, appropriate when tests share mutable state or a resource that isn't safe for concurrent access, while `.timeLimit` fails a test automatically if it runs longer than a specified duration.

```swift
@Suite(.serialized)
struct DatabaseTests {
    // tests here run one at a time, avoiding concurrent access to a shared test database
}

@Test(.timeLimit(.minutes(1)))
func mustCompleteWithinOneMinute() async throws { /* ... */ }
```

`.serialized`'s existence reflects a genuine tension in Swift Testing's parallel-by-default design — parallel execution provides real speed benefits for the common case of independent tests, but tests that share genuinely stateful resources (a shared database connection, a singleton with mutable state) need serialization to avoid the same class of data races (recall Part 2's concurrency material) that any concurrently-accessed mutable state would otherwise produce, making `.serialized` a deliberate, explicit opt-out from the default parallel behavior for exactly the cases that need it.

---

## 65.10 Testing Async Code

Swift Testing's `@Test` functions can themselves be `async`, letting test code directly `await` asynchronous operations under test using the same `async`/`await` syntax as the code being tested, without needing separate expectation/waiting infrastructure for the common case of a single awaited operation.

```swift
@Test func fetchesUserSuccessfully() async throws {
    let service = UserService()
    let user = try await service.fetchUser(id: "123")
    #expect(user.name == "Ada")
}
```

This is a meaningful simplification compared to XCTest's older pattern of `XCTestExpectation` and `wait(for:timeout:)` for testing asynchronous code — because the test function itself can be `async`, testing an `async` function under test is as direct as simply `await`-ing it and making assertions afterward, with the test runner itself handling suspension and resumption exactly as any other `async` calling context would, consistent with the broader async/await model from Part 2.

---

## 65.11 confirmation() for Callback-Based APIs

For code that isn't `async`/`await`-based but instead uses completion handlers or delegate callbacks, `confirmation()` provides a way to assert that a callback was actually invoked (and optionally, how many times), bridging older callback-based APIs into Swift Testing's assertion model.

```swift
@Test func notifiesObserverOnUpdate() async {
    await confirmation() { confirm in
        let service = LegacyNotificationService()
        service.onUpdate = { confirm() }
        service.triggerUpdate()
    }
}
```

`confirmation()` addresses a genuine gap for codebases that haven't (or can't yet) migrate every callback-based API to `async`/`await` — much like `withCheckedContinuation` bridges a callback-based API into `async`/`await` for production code (recall the PhotoKit example in section 55.2), `confirmation()` provides the equivalent bridge specifically for verifying callback invocation within a test, without requiring the API under test to itself be rewritten as `async` first.

---

## 65.12 Writing Testable Code: Pure Functions

Code structured as pure functions — output determined entirely by input, with no hidden dependencies on external state and no side effects — is inherently easier to test than code entangled with global state, singletons, or hidden I/O, since a pure function's test simply calls it with known inputs and asserts on the returned output.

```swift
// Hard to test: depends on hidden global/singleton state
func calculateDiscount() -> Decimal {
    return CartManager.shared.total * 0.1  // implicit dependency on global state
}

// Easy to test: pure function, explicit inputs, no hidden dependencies
func calculateDiscount(cartTotal: Decimal) -> Decimal {
    return cartTotal * 0.1
}
```

This isn't merely a testing-convenience concern — favoring pure functions where reasonably possible is a genuine design principle with benefits extending well beyond testability (easier reasoning about correctness, safer use in concurrent contexts since there's no shared mutable state to race on, recall Part 2), with improved testability serving as one clear, concrete signal that a piece of code's design is already reasonably well-structured along other dimensions too.

---

## 65.13 Writing Testable Code: Injected Dependencies

Beyond pure functions, code that genuinely needs external dependencies (a network service, a database, the current date) becomes testable when those dependencies are injected (passed in explicitly, typically via an abstraction like a protocol) rather than being hardcoded or accessed through global singletons — directly building on dependency injection principles from section 47.

```swift
protocol UserServicing {
    func fetchUser(id: String) async throws -> User
}

struct ProfileViewModel {
    let userService: UserServicing  // injected, not a hardcoded concrete singleton

    func loadProfile(id: String) async throws -> User {
        try await userService.fetchUser(id: id)
    }
}
```

This is the direct, practical payoff of the dependency injection principles introduced in section 47 — because `ProfileViewModel` depends on the `UserServicing` protocol rather than a concrete, hardcoded network-calling implementation, a test can substitute a fast, deterministic mock implementation (65.14) in place of the real network-dependent service, making the view model's logic testable in isolation without needing genuine network access or dealing with real network latency and flakiness during test runs.

---

## 65.14 Building a Mock Service with a Protocol

A mock service conforms to the same protocol the production code depends on, but returns pre-configured, deterministic responses (or records what was called with what arguments) instead of performing real work — letting tests exercise code depending on that protocol without any real, external dependency.

```swift
struct MockUserService: UserServicing {
    var userToReturn: User
    var shouldThrow: Bool = false

    func fetchUser(id: String) async throws -> User {
        if shouldThrow { throw TestError.simulatedFailure }
        return userToReturn
    }
}

@Test func loadProfileReturnsExpectedUser() async throws {
    let mock = MockUserService(userToReturn: User(name: "Ada", age: 30))
    let viewModel = ProfileViewModel(userService: mock)
    let user = try await viewModel.loadProfile(id: "123")
    #expect(user.name == "Ada")
}
```

Building a mock this way directly exercises the dependency injection pattern from 65.13 in practice — because `ProfileViewModel` only knows about the `UserServicing` protocol, it has no way to distinguish the mock from a real network-backed implementation, letting the test deterministically control exactly what the "service" returns (including simulating specific error conditions via `shouldThrow`) without any of the flakiness or slowness genuine network calls would introduce into the test suite.

---

## 65.15 XCTest Basics for Legacy Code Literacy

Despite Swift Testing being the modern framework, XCTest remains genuinely important to understand — a great deal of existing Swift codebases (and UI testing specifically, section 67) still use `XCTestCase` subclasses with `test`-prefixed methods and `XCTAssert`-family assertions, making basic XCTest literacy a practical necessity for working in and around legacy test code.

```swift
import XCTest

final class UserTests: XCTestCase {
    func testAdditionIsCorrect() {
        let result = 2 + 2
        XCTAssertEqual(result, 4)
    }
}
```

Recognizing XCTest's core patterns — class-based test cases inheriting from `XCTestCase`, `test`-prefixed method naming as the discovery convention, and the `XCTAssert*` assertion family — remains a genuinely practical skill even for a developer primarily writing new tests in Swift Testing, since existing test suites, especially UI test targets which haven't fully migrated (section 67), still commonly rely on this older, class-inheritance-based pattern.

---

## 65.16 XCTest and Swift Testing Interoperability (iOS 27)

iOS 27 tooling supports running XCTest-based and Swift Testing-based tests within the same test target and test run, letting a project incrementally adopt Swift Testing for new tests without requiring an immediate, disruptive full migration of existing XCTest-based test code.

```swift
// Both test styles can coexist in the same target and run together:
import XCTest
final class LegacyTests: XCTestCase {
    func testSomething() { XCTAssertTrue(true) }
}

import Testing
@Test func newTest() {
    #expect(true)
}
```

This interoperability is what makes gradual, low-risk migration (65.17) actually practical rather than merely theoretical — without it, adopting Swift Testing would effectively require a disruptive, all-at-once rewrite of an entire existing test suite before gaining any benefit, whereas interoperability lets new tests be written in Swift Testing immediately while existing XCTest-based tests continue running unmodified, side by side, within the same project.

---

## 65.17 Migrating from XCTest Incrementally

Given interoperability (65.16), a practical migration strategy writes all new tests in Swift Testing going forward, while converting existing XCTest tests opportunistically — when a test needs modification anyway, or during a broader refactor of the code it covers — rather than undertaking a dedicated, all-at-once conversion effort disconnected from other work.

```plaintext
// A practical incremental migration priority order:
// 1. All new tests: written in Swift Testing from this point forward
// 2. Existing tests being modified for unrelated reasons: convert while already touching the file
// 3. Existing, stable, passing tests: leave as XCTest indefinitely unless there's a specific reason to convert
// 4. High-value targets for deliberate conversion: tests that would meaningfully benefit
//    from parameterization (65.5) or clearer failure reporting (#expect's continue-on-failure, 65.2)
```

This opportunistic strategy reflects a sensible general principle for technical migrations of this kind — a stable, currently-passing XCTest test provides essentially the same regression-catching value (recall 65.1's actual argument for why tests exist) whether it's written in XCTest or Swift Testing, meaning the migration effort is better spent on new test-writing and on the genuinely high-value conversion cases (tests that would meaningfully benefit from parameterization or improved failure reporting) than on converting stable, working tests purely for the sake of framework consistency.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Core motivation | Regression-catching, change safety | The actual value proposition tests provide |
| Basic assertion | `@Test`, `#expect` | Continue-on-failure, multi-issue-surfacing assertions |
| Halting assertion | `#require` | Stops execution when continuing would be meaningless |
| Grouping | `@Suite` | Struct-based, per-test fresh-instance test grouping |
| Reducing repetition | `@Test(arguments:)` | One test body covering many input values |
| Multi-dimensional cases | Zipped vs. cross-product arguments | Related pairs vs. full combination coverage |
| Conditional/status metadata | `.enabled(if:)`, `.disabled`, `.bug()` | Structured, traceable test status |
| Selective execution | Tags, `.tags()` | Orthogonal categorization for filtered test runs |
| Execution control | `.serialized`, `.timeLimit` | Opt-out from parallelism; enforced time bounds |
| Async testing | `async` `@Test` functions | Direct `await` of async code under test |
| Callback bridging | `confirmation()` | Verifying callback invocation without full async migration |
| Testable design | Pure functions | Output determined by input, no hidden dependencies |
| Testable design | Injected dependencies (protocols) | Swappable real vs. mock implementations |
| Test doubles | Mock services | Deterministic, controllable stand-ins for real dependencies |
| Legacy literacy | `XCTestCase`, `XCTAssert*` | Understanding still-common existing test code |
| Coexistence | XCTest/Swift Testing interop (iOS 27) | Both frameworks runnable in the same target |
| Migration strategy | Opportunistic, prioritized conversion | New tests in Swift Testing; convert high-value cases |
