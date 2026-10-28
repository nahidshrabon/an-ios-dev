**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

This section teaches **Swift Testing**, Apple's modern test framework: `@Test`, `#expect`, `#require`, suites, parameterized tests, traits, tags, async tests, and callbacks. Then it covers how to **design code** that's easy to test, how to build **mocks**, how to read old **XCTest** code, and how to **migrate** step by step.

---

## 65.1 Why Tests Exist — The Actual Argument 🟢

**Short answer:** tests make **change safe**.

Checking that code works **today** is easy: you run the app and try it. The hard part is **next month**: after a refactor, a new feature, or a library update, does everything **still** work? A good test suite answers that in seconds, every time, without you clicking through the app.

```
Without tests:  change code → hope → manual checks → bug found by users
With tests:     change code → run tests (seconds) → the broken behavior is named → fix → ship
```

So a test is an **investment in future changes**. That also tells you what a **good** test is:

| Valuable test | Low-value test |
|---|---|
| **Fails** when the behavior it protects really breaks | Asserts something that can never fail |
| Tests **behavior** ("an expired coupon gives no discount") | Tests **implementation details** (which private method was called) |
| **Stable**: passes until the behavior changes | **Brittle**: breaks on every harmless refactor |
| Fast and **deterministic** | Slow or **flaky** (sometimes passes, sometimes fails) |

A quick check for any test: "**If I broke this feature, would this test fail?**" If not, the test isn't protecting anything.

---

## 65.2 Swift Testing: @Test and #expect 🟢

In Swift Testing, a test is a function marked **`@Test`**, and checks use **`#expect`**:

```swift
import Testing
@testable import RecipeApp

@Test func scalingDoublesIngredients() {
    let recipe = Recipe(servings: 2, ingredients: [Ingredient(name: "Flour", grams: 200)])

    let scaled = recipe.scaled(toServings: 4)

    #expect(scaled.servings == 4)
    #expect(scaled.ingredients[0].grams == 400)
}

@Test("Empty title is invalid")                    // optional display name
func emptyTitleIsInvalid() {
    #expect(!Recipe(title: "").isValid)
}
```

`#expect` takes a **normal Swift expression**. When it fails, the report shows the **values** inside it:

```
Expectation failed: (scaled.ingredients[0].grams → 300) == 400
```

No need for many assertion functions (`assertEqual`, `assertTrue`, `assertNil`…): `==`, `!`, `<`, `.contains(...)` all work.

**`#expect` doesn't stop the test.** If the first check fails, the second one **still runs**. One test run shows **every** problem, not just the first one. To check that code **throws**:

```swift
@Test func negativeServingsThrow() {
    #expect(throws: RecipeError.invalidServings) {
        try Recipe(servings: -1)
    }
}
```

---

## 65.3 #require and Stopping on Failure 🟢

**`#require`** is like `#expect`, but if it fails, the test **stops** right there (it **throws**, so the test must be `throws`). Use it when the **next lines make no sense** without it, most often to **unwrap an optional**:

```swift
@Test func firstStepIsPreheat() throws {
    let recipe = try loadFixture("lasagna.json")            // a helper that throws

    let firstStep = try #require(recipe.steps.first)       // nil? stop here, clearly
    #expect(firstStep.text.contains("Preheat"))

    try #require(recipe.ingredients.count >= 3)            // also works with a Bool
    #expect(recipe.ingredients[2].name == "Mozzarella")    // safe: we know there are 3
}
```

Without `#require`, you'd write `recipe.steps.first!`, and a missing step would **crash** the whole test run instead of failing **one** test with a clear message.

| Use | When |
|---|---|
| `#expect` | Checks are **independent**: each one tells you something on its own |
| `#require` | Later code **depends** on it: an unwrap, a count, a precondition |

Most checks should be `#expect`. Reach for `#require` at the **points of dependency**.

---

## 65.4 @Suite for Grouping Tests 🟢

A **suite** groups related tests in a type. Any type containing `@Test` functions is a suite; **`@Suite`** adds a name and traits (65.7):

```swift
@Suite("Coupon rules")
struct CouponTests {
    let calculator = DiscountCalculator()                  // fresh for EVERY test
    let today = Date(timeIntervalSince1970: 1_767_225_600) // a fixed date: deterministic

    @Test func expiredCouponGivesNoDiscount() {
        let coupon = Coupon(percent: 10, expires: today.addingTimeInterval(-86_400))
        #expect(calculator.discount(for: 50, coupon: coupon, now: today) == 0)
    }

    @Test func validCouponGivesDiscount() {
        let coupon = Coupon(percent: 10, expires: today.addingTimeInterval(86_400))
        #expect(calculator.discount(for: 50, coupon: coupon, now: today) == 5)
    }
}
```

Each test gets a **new instance** of the suite. So stored properties work as **setup**, and tests can't leak state into each other.

| XCTest | Swift Testing |
|---|---|
| `class MyTests: XCTestCase` (must subclass) | `struct MyTests` (or a class or actor) |
| `override func setUp()` | `init()` (can be `async throws`) |
| `override func tearDown()` | `deinit` (needs a **class** or **actor**) |
| Methods must start with `test` | Any name, marked `@Test` |

Suites can be **nested** to build a tree (`struct RecipeTests { struct Scaling { ... } }`), which shows up the same way in Xcode's test navigator.

---

## 65.5 Parameterized Tests with arguments: 🟢

Many tests are the **same check** with **different inputs**. Instead of copying the test, give `@Test` a list of **arguments**:

```swift
@Test("Cook time formatting", arguments: [
    (minutes: 5,   expected: "5 min"),
    (minutes: 60,  expected: "1 h"),
    (minutes: 90,  expected: "1 h 30 min"),
    (minutes: 0,   expected: "No cooking"),
])
func formatsCookTime(minutes: Int, expected: String) {
    #expect(CookTimeFormatter.string(minutes: minutes) == expected)
}

// Enums work great: test EVERY case automatically
@Test(arguments: MealType.allCases)
func everyMealTypeHasAnIcon(mealType: MealType) {
    #expect(!mealType.iconName.isEmpty)
}
```

Benefits:

- **One** test body to maintain, instead of four copies drifting apart.
- Each argument is reported **separately**: "fails for `minutes: 90`", not just "failed".
- In Xcode you can **re-run just one** failing argument.
- Arguments run **in parallel** by default.
- Add a new enum case, and it's **tested automatically**.

Arguments must be **`Sendable`**. For nicer names in the report, make your types conform to `CustomTestStringConvertible`.

---

## 65.6 Zipped and Cross-Product Test Cases 🟡

With **two** argument collections, Swift Testing tests **every combination** (a cross product):

```swift
@Test(arguments: [ColorScheme.light, .dark], [DynamicTypeSize.large, .accessibility3])
func recipeCardRenders(scheme: ColorScheme, size: DynamicTypeSize) {
    // runs 2 × 2 = 4 times: light+large, light+a11y3, dark+large, dark+a11y3
    let card = RecipeCard(recipe: .sample)
    #expect(card.fitsInWidth(375, scheme: scheme, typeSize: size))
}
```

When the inputs come in **matched pairs** (this input → that result), use **`zip`** so they're tested **side by side**, not mixed:

```swift
@Test(arguments: zip(
    ["Pasta", "", "  ", "A very long title that goes on"],
    [true,    false, false, true]
))
func titleValidation(title: String, isValid: Bool) {
    // runs 4 times: ("Pasta", true), ("", false), ...
    #expect(Recipe(title: title).isValid == isValid)
}
```

| Form | Runs | Use when |
|---|---|---|
| `arguments: a, b` | **Every** combination (a.count × b.count) | Inputs are **independent** dimensions |
| `arguments: zip(a, b)` | **Pairs** (a[0], b[0]), (a[1], b[1])… | Each input has **its own** expected result |

Choosing wrong hurts either way: a cross product of matched pairs tests **meaningless** combinations ("Pasta" expecting `false`), and zipping independent dimensions **misses** combinations. (At most **two** collections are allowed; for more, zip them into tuples.)

---

## 65.7 Test Traits: .enabled(if:), .disabled, .bug() 🟢

**Traits** add conditions and information to a test or suite:

```swift
@Test(.enabled(if: ProcessInfo.processInfo.environment["RUN_NETWORK_TESTS"] == "1"))
func liveAPIReturnsRecipes() async throws { /* ... */ }

@Test(.disabled("Fails on CI runners without a GPU"), .bug("https://github.com/acme/recipes/issues/456"))
func thumbnailRenderingMatchesReference() { /* ... */ }
```

| Trait | Effect |
|---|---|
| `.enabled(if:)` | Runs only when the condition is true |
| `.disabled("reason")` | Skips the test, and **shows** it as skipped with the reason |
| `.bug("url")` / `.bug(id:)` | Links the test to an **issue** |
| `.timeLimit`, `.serialized` | See 65.9 |
| `.tags(...)` | See 65.8 |

Why not just **comment out** a broken test? Commented-out code is **invisible**: nobody sees it in reports, and it's easily forgotten forever. A disabled test stays **listed** as skipped, with a **reason** and a **link**.

For a test that **runs** but has a **known** failure, use **`withKnownIssue`**. The test still runs; the failure is expected and recorded, and you're told when it **starts passing** (so you can remove the wrapper):

```swift
@Test func importsLegacyRecipeFormat() throws {
    withKnownIssue("Old .rcp files lose their photos (issue #789)") {
        let recipe = try LegacyImporter.import(fixture("old.rcp"))
        #expect(recipe.photo != nil)
    }
}
```

---

## 65.8 Test Tags and Filtering 🟡

**Suites** group tests by **feature**. **Tags** group them by **kind**, across features:

```swift
extension Tag {
    @Tag static var networking: Self
    @Tag static var slow: Self
    @Tag static var parsing: Self
}

@Suite(.tags(.parsing))                           // every test inside gets .parsing
struct RecipeImportTests {
    @Test(.tags(.slow))                           // plus .slow, for this one
    func importsHugeCookbook() throws { /* ... */ }
}

@Test(.tags(.networking, .slow))
func syncsWithServer() async throws { /* ... */ }
```

| Grouping | Answers |
|---|---|
| Suite | "Which **feature**?" (coupons, importing, sync) |
| Tag | "What **kind** of test?" (slow, networking, flaky, parsing) |

A test belongs to **one** suite but can have **many** tags. With tags you can:

- run only `.parsing` tests while working on the importer,
- **exclude** `.slow` and `.networking` on every pull request for fast feedback, and run them nightly,
- see results **grouped by tag** in Xcode's test report.

In Xcode, **test plans** (66.14) can include or exclude tags.

---

## 65.9 .serialized and .timeLimit 🟡

Swift Testing runs tests **in parallel** by default: fast, and it **finds hidden shared state** (if tests pass alone but fail together, they share something they shouldn't).

When tests **really** must share a resource (one test database file, a global setting), make **that suite** run one test at a time:

```swift
@Suite(.serialized)
struct LegacyDatabaseTests {
    // These tests run one after another.
    // (Other suites still run in parallel with this one.)
    @Test func insertsRecipe() throws { /* ... */ }
    @Test func deletesRecipe() throws { /* ... */ }
}
```

`.serialized` is an **escape hatch**, not a fix. The better fix is usually to give each test its **own** resource: an in-memory store, a temp folder with a UUID name. Then the tests can run in parallel again.

**`.timeLimit`** fails a test that runs too long, for example one that **hangs** waiting for something that never comes:

```swift
@Test(.timeLimit(.minutes(1)))
func fullSyncFinishes() async throws { /* ... */ }
```

(The limit is set in **minutes**. Tests should normally take **milliseconds**; this guards against hangs, not slowness.)

---

## 65.10 Testing Async Code 🟢

A test can simply be **`async`**. Then you `await` the code under test like anywhere else:

```swift
@Test func loadsRecipesFromService() async throws {
    let service = StubRecipeService(recipes: [.sample, .sample2])
    let store = RecipeStore(service: service)

    try await store.load()

    #expect(store.recipes.count == 2)
}
```

For code that must run on the **main actor** (view models, UI state), mark the test **`@MainActor`**:

```swift
@MainActor
@Test func searchFiltersRecipes() async {
    let model = RecipeListModel(recipes: [.pasta, .salad])
    model.searchText = "pas"
    #expect(model.visibleRecipes == [.pasta])
}
```

Compare with the older XCTest way:

```swift
// XCTest, before async/await
func testLoadsRecipes() {
    let expectation = expectation(description: "loaded")
    store.load { result in
        XCTAssertEqual(store.recipes.count, 2)
        expectation.fulfill()
    }
    wait(for: [expectation], timeout: 5)
}
```

The async version reads **top to bottom**, like normal code: no expectations, no timeouts, no callbacks.

---

## 65.11 confirmation() for Callback-Based APIs 🟡

Some code still reports events with **callbacks** or **closures**. **`confirmation()`** checks that a callback is called, and **how many times**:

```swift
@Test func timerNotifiesWhenDone() async {
    await confirmation("onFinish is called once") { finished in
        let timer = CookTimer(seconds: 0)
        timer.onFinish = { finished() }        // call the confirmation
        timer.fire()                           // calls onFinish synchronously
    }
}

@Test func savingTwiceNotifiesTwice() async {
    await confirmation(expectedCount: 2) { saved in
        let store = DraftStore()
        store.onSave = { saved() }
        store.save(.sample)
        store.save(.sample2)
    }
}

@Test func cancelledTimerNeverFires() async {
    await confirmation(expectedCount: 0) { finished in   // assert it's NOT called
        let timer = CookTimer(seconds: 0)
        timer.onFinish = { finished() }
        timer.cancel()
        timer.fire()
    }
}
```

⚠️ `confirmation` **doesn't wait**. The count is checked when the closure **returns**. If the callback happens **later** (on another queue, after a delay), it's too late. In that case, `await` the event **inside** the closure, for example by wrapping the callback in a continuation (18.11) or an `AsyncStream`.

It's the test-side version of what `withCheckedContinuation` does for production code: a **bridge** from callbacks to the async world, without rewriting the code under test first.

---

## 65.12 Writing Testable Code: Pure Functions 🟢

A **pure function**'s result depends **only on its inputs**, and it changes **nothing** outside itself. Testing it is trivial: call it, check the result.

```swift
// ❌ Hard to test: hidden inputs (a singleton, the current date)
func discountForCart() -> Decimal {
    let total = CartManager.shared.total                  // hidden input 1
    let isWeekend = Calendar.current.isDateInWeekend(.now)   // hidden input 2: changes daily!
    return isWeekend ? total * 0.1 : 0
}

// ✅ Easy to test: everything comes in through parameters
func discount(total: Decimal, on date: Date, calendar: Calendar = .current) -> Decimal {
    calendar.isDateInWeekend(date) ? total * 0.1 : 0
}

@Test func weekendGivesTenPercent() {
    let saturday = Date(timeIntervalSince1970: 1_767_441_600)   // Sat 3 Jan 2026, noon UTC
    #expect(discount(total: 50, on: saturday) == 5)
}
```

The first version's test would pass on **weekends** and fail on **weekdays**: a flaky test caused by **hidden input**. Passing `date` in fixes it.

A good structure: keep the **logic** in pure functions (calculations, validation, formatting, parsing), and keep the **side effects** (network, disk, UI) in a thin outer layer. Most of your tests then target the pure core.

Bonus: pure functions are also easier to **reason** about, and safe to call from **any thread**: there's no shared mutable state to race on (Part 2).

---

## 65.13 Writing Testable Code: Injected Dependencies 🟡

Not everything can be pure: a view model **needs** the network. The fix is **dependency injection** (47.2, 47.4): the object **receives** its dependencies, behind a **protocol**, instead of creating or reaching for them itself.

```swift
protocol RecipeServicing: Sendable {
    func fetchRecipes() async throws -> [Recipe]
}

// The real one: talks to the server
struct RecipeAPI: RecipeServicing {
    func fetchRecipes() async throws -> [Recipe] { /* URLSession call */ }
}

@MainActor
@Observable
final class RecipeListModel {
    private let service: RecipeServicing          // injected
    private(set) var recipes: [Recipe] = []
    private(set) var errorMessage: String?

    init(service: RecipeServicing) {
        self.service = service
    }

    func load() async {
        do {
            recipes = try await service.fetchRecipes()
            errorMessage = nil
        } catch {
            errorMessage = "Couldn't load recipes."
        }
    }
}

// App: RecipeListModel(service: RecipeAPI())
// Test: RecipeListModel(service: StubRecipeService(...))   (65.14)
```

| Hard-coded dependency | Injected dependency |
|---|---|
| `let api = RecipeAPI()` inside the class | `init(service: RecipeServicing)` |
| `NetworkManager.shared.fetch(...)` | `service.fetchRecipes()` |
| Tests need a **real server** (slow, flaky) | Tests use a **stub** (fast, exact) |
| Can't test the **error** path easily | Make the stub **throw** |

This is the practical payoff of section 47: the class doesn't know (or care) whether the service is real or fake.

---

## 65.14 Building a Mock Service with a Protocol 🟡

A **test double** conforms to the **same protocol** as the real dependency, but returns **controlled** results. Two common kinds (more in 66.1):

- a **stub** returns canned data (or a canned error),
- a **spy** also **records** how it was called, so the test can check it.

```swift
struct StubRecipeService: RecipeServicing {
    var result: Result<[Recipe], Error>

    func fetchRecipes() async throws -> [Recipe] {
        try result.get()
    }
}

actor SpyAnalytics: AnalyticsTracking {           // an actor: safe to record from any task
    private(set) var events: [String] = []
    func track(_ event: String) { events.append(event) }
}
```

Now test **both** paths, success and failure, with no network:

```swift
@MainActor
@Suite struct RecipeListModelTests {
    @Test func loadShowsRecipes() async {
        let model = RecipeListModel(service: StubRecipeService(result: .success([.pasta, .salad])))
        await model.load()
        #expect(model.recipes.count == 2)
        #expect(model.errorMessage == nil)
    }

    @Test func loadFailureShowsMessage() async {
        struct Offline: Error {}
        let model = RecipeListModel(service: StubRecipeService(result: .failure(Offline())))
        await model.load()
        #expect(model.recipes.isEmpty)
        #expect(model.errorMessage == "Couldn't load recipes.")
    }
}
```

The error test is the **valuable** one: real servers rarely fail **on demand**, so without a stub, the error path is often **never** tested until a user hits it.

Keep doubles **simple**. If a mock needs lots of logic, the protocol is probably too big; split it into smaller ones.

---

## 65.15 XCTest Basics for Legacy Code Literacy 🟢

Many existing projects still use **XCTest**, and some things still **need** it: **UI tests** (67) and **performance tests** (`measure`). So you should be able to **read** it:

```swift
import XCTest
@testable import RecipeApp

final class RecipeScalingTests: XCTestCase {            // must subclass XCTestCase
    var recipe: Recipe!

    override func setUp() {                             // runs before EACH test
        super.setUp()
        recipe = Recipe(servings: 2, ingredients: [Ingredient(name: "Flour", grams: 200)])
    }

    override func tearDown() {                          // runs after EACH test
        recipe = nil
        super.tearDown()
    }

    func testScalingDoublesIngredients() {              // name must start with "test"
        let scaled = recipe.scaled(toServings: 4)
        XCTAssertEqual(scaled.ingredients[0].grams, 400)
    }

    func testFirstStepExists() throws {
        let step = try XCTUnwrap(recipe.steps.first)    // like #require
        XCTAssertTrue(step.text.contains("Preheat"))
    }

    func testLoadsAsync() async throws {                // async tests work in XCTest too
        let recipes = try await StubRecipeService(result: .success([.pasta])).fetchRecipes()
        XCTAssertEqual(recipes.count, 1)
    }

    func testScalingPerformance() {
        measure { _ = Recipe.huge.scaled(toServings: 100) }   // no Swift Testing equivalent yet
    }
}
```

| XCTest | Swift Testing |
|---|---|
| `XCTAssertEqual(a, b)` | `#expect(a == b)` |
| `XCTAssertTrue(x)` / `XCTAssertFalse(x)` | `#expect(x)` / `#expect(!x)` |
| `XCTAssertNil(x)` | `#expect(x == nil)` |
| `try XCTUnwrap(x)` | `try #require(x)` |
| `XCTAssertThrowsError(try f())` | `#expect(throws: (any Error).self) { try f() }` |
| `throw XCTSkip("…")` | `.enabled(if:)` / `.disabled` |
| `expectation` + `wait(for:)` | `async` tests, `confirmation()` |

---

## 65.16 XCTest and Swift Testing Interoperability (iOS 27) 🟡

**Coexistence** has worked since Xcode 16: one test target can hold **both** XCTest classes and Swift Testing `@Test` functions, and they all run together.

```swift
import XCTest
import Testing

final class LegacyImporterTests: XCTestCase {           // old tests keep running
    func testImportsCSV() { XCTAssertEqual(try? CSVImporter.count("a,b\nc,d"), 2) }
}

@Test func importsJSON() throws {                       // new tests, same target
    #expect(try JSONImporter.count(fixture("two.json")) == 2)
}
```

The gap was **mixing inside one test**. Real projects have shared **helper functions** full of `XCTAssert…` calls. Called from an `@Test` function, those assertions **didn't report failures** at all: the test **passed** even when a check failed, which is dangerous. (The reverse, `#expect` inside an XCTest method, had the same problem.)

The newer **interoperability** support (in the iOS 27 tooling, per the title) closes this gap: assertions from either framework **report their failures** to whichever framework is running the test. So old helpers keep working while you migrate.

⚠️ Check the current Xcode and Swift Testing documentation for the exact behavior and any settings it needs. Until you've confirmed it in your toolchain, don't call `XCTAssert` helpers from `@Test` functions: convert those helpers to `#expect` first.

This is what makes gradual migration (65.17) **safe**: no big rewrite before you get any benefit.

---

## 65.17 Migrating from XCTest Incrementally 🟡

Don't stop feature work to convert a whole test suite. Migrate **as you go**:

```
1. NEW tests       → always Swift Testing, starting today
2. Tests you EDIT  → convert that file while you're in it
3. High-value      → convert on purpose: tests that would gain from
                     arguments (65.5) or clearer failures (#expect)
4. Stable tests    → leave them in XCTest; they still catch regressions
5. Stay in XCTest  → UI tests (XCUIApplication), performance tests (measure),
                     Objective-C tests
```

A typical conversion:

```swift
// Before: XCTest, four nearly identical tests
func testFormatsFiveMinutes() { XCTAssertEqual(CookTimeFormatter.string(minutes: 5), "5 min") }
func testFormatsOneHour()     { XCTAssertEqual(CookTimeFormatter.string(minutes: 60), "1 h") }
// ... two more

// After: Swift Testing, one parameterized test (65.5)
@Test(arguments: zip([5, 60, 90, 0], ["5 min", "1 h", "1 h 30 min", "No cooking"]))
func formatsCookTime(minutes: Int, expected: String) {
    #expect(CookTimeFormatter.string(minutes: minutes) == expected)
}
```

Watch out while converting:

- `setUp` state becomes **stored properties** or `init()`: each test gets a fresh suite instance (65.4).
- Swift Testing runs tests **in parallel**. Old XCTest tests that secretly shared state may start **failing**. That's a real bug surfacing: fix the sharing (or use `.serialized` as a stopgap, 65.9).
- Don't mix `XCTAssert` and `#expect` in one test unless your toolchain supports interoperability (65.16).

Remember the goal from 65.1: a stable XCTest test protects your code **just as well** as a Swift Testing one. Spend migration effort where it **adds** value, not on renaming for its own sake.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Why test | Regression protection | Make future changes safe |
| Basic checks | `@Test`, `#expect`, `#expect(throws:)` | Plain Swift expressions; failures show values |
| Stopping checks | `#require` | Unwrap or stop when later lines depend on it |
| Grouping | `@Suite`, `init`, nested types | A fresh suite instance per test |
| Many inputs | `@Test(arguments:)` | One body, each input reported separately |
| Combinations | Two collections vs. `zip` | All combinations vs. matched pairs |
| Traits | `.enabled(if:)`, `.disabled`, `.bug`, `withKnownIssue` | Visible, documented test status |
| Tags | `@Tag`, `.tags(...)` | Run or skip tests by kind |
| Execution | `.serialized`, `.timeLimit` | Opt out of parallelism; catch hangs |
| Async | `async` and `@MainActor` tests | Await code directly |
| Callbacks | `confirmation(expectedCount:)` | Count callback calls (it doesn't wait) |
| Testable design | Pure functions | No hidden inputs like singletons or the date |
| Testable design | Injected protocols | Swap real services for test doubles |
| Test doubles | Stubs and spies | Control results; test the error paths |
| Legacy | `XCTestCase`, `XCTAssert*`, `measure` | Read old tests; UI and performance tests |
| Interoperability | Shared targets; cross-framework assertions (iOS 27) | Both frameworks side by side |
| Migration | New tests first, convert as you edit | Value over uniformity |
