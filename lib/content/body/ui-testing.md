**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**UI tests** drive your app the way a **user** does: they launch it, tap, type, and swipe, then check what's on screen. They're slower and more fragile than unit tests, so you write **fewer** of them, for the **most important flows**. This section covers XCUITest setup, finding elements, stable identifiers, waiting, system alerts, test-only launch state, page objects, flaky tests, accessibility audits, and screenshots.

---

## 67.1 XCUITest Setup and Recording 🟢

Add a **UI Testing Bundle** target to your project. UI tests use **XCTest** (Swift Testing doesn't drive UI yet). A basic test:

```swift
import XCTest

@MainActor
final class LoginUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() async throws {
        continueAfterFailure = false                 // stop at the first failure: later steps depend on it
        app = XCUIApplication()
        app.launchArguments = ["-ui-testing"]        // test-only setup (67.6)
        app.launch()
    }

    func testSuccessfulLogin() {
        let email = app.textFields["login.email"]
        email.tap()
        email.typeText("ada@example.com")

        let password = app.secureTextFields["login.password"]
        password.tap()
        password.typeText("correct-horse")

        app.buttons["login.submit"].tap()

        XCTAssertTrue(app.staticTexts["home.welcome"].waitForExistence(timeout: 5))
    }
}
```

The key idea: the test runs in a **separate process** (a test runner app). It **can't** see your code or call your functions (no `@testable import`). It only sees the screen through the **accessibility** layer, the same way **VoiceOver** does (70).

| | Unit tests (65) | UI tests |
|---|---|---|
| Runs | Inside your app's process | In a **separate** runner process |
| Sees | Your types and functions | Only what's on **screen** (accessibility tree) |
| Speed | Milliseconds | **Seconds** per test |
| Catches | Logic bugs | Broken **flows**: navigation, wiring, real taps |
| Fragility | Low | Higher: timing, animations, system state |

**Recording**: put the cursor in a test method and press the **Record** button. Xcode writes code as you use the app in the Simulator. It's a good way to **discover** element queries, but the generated code is long and brittle: rewrite it with identifiers (67.3), waits (67.4), and page objects (67.7).

---

## 67.2 Element Queries and Predicates 🟢

You find elements with **queries** on the accessibility tree:

```swift
app.buttons["login.submit"]                         // by identifier (or label)
app.textFields.firstMatch                           // the first text field (fast)
app.cells.element(boundBy: 2)                       // the third cell
app.navigationBars["Recipes"].buttons["Add"]        // a button inside a navigation bar

// Containment: the cell that contains a specific text
app.cells.containing(.staticText, identifier: "Pasta Carbonara").firstMatch

// Predicates: flexible matching
app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Total:")).firstMatch
app.buttons.matching(NSPredicate(format: "identifier CONTAINS 'delete'")).count
```

A query is a **description** of how to find an element, not the element itself. It's **evaluated** only when you **use** it: `.tap()`, `.exists`, `.label`, a wait. So:

- you can create a query **before** the element appears on screen,
- a wait (67.4) re-runs the **same** query until it matches,
- each use searches **again**, reflecting the current screen.

| Query | Use |
|---|---|
| `app.buttons["id"]` | The usual, exact way |
| `.firstMatch` | Stops at the first match: **faster** in big screens |
| `.element(boundBy: n)` | By position (fragile if order changes) |
| `.matching(NSPredicate)` | Partial text, combined conditions |
| `.containing(...)` | "The cell with **this** text in it" |

⚠️ If a query matches **several** elements and you tap it, the test **fails** ("multiple matching elements"). Make identifiers **unique**, or use `.firstMatch` on purpose.

---

## 67.3 Accessibility Identifiers for Stable Selectors 🟢

An **`accessibilityIdentifier`** is a **name for tests**. Users never see it, and VoiceOver never reads it:

```swift
struct LoginView: View {
    @State private var email = ""

    var body: some View {
        Form {
            TextField("Email", text: $email)
                .accessibilityIdentifier("login.email")
            Button("Sign In") { signIn() }
                .accessibilityIdentifier("login.submit")
        }
    }
}

// UIKit
submitButton.accessibilityIdentifier = "login.submit"
```

Why not match the **visible text** (`app.buttons["Sign In"]`)?

| Visible text changes when… | Identifier changes when… |
|---|---|
| Marketing renames "Sign In" to "Log In" | Only when **you** change it on purpose |
| The app runs in **German** ("Anmelden") | Never by language |
| A designer adds an emoji or a period | Never by copy edits |

The test checks the **login flow**, not the button's wording. Identifiers make tests survive **cosmetic** changes.

Rules:

- Use a **naming scheme**: `screen.element` (`login.submit`, `cart.total`). Keep them in a shared enum if you like.
- ⚠️ **Never** change `accessibilityLabel` just to make tests easier. Labels are for **VoiceOver users** (70); test names go in the **identifier**.
- In SwiftUI, an identifier on a **container** can spread to its children. Put identifiers on the **specific** element, or use `.accessibilityElement(children: .contain)` on the container.

---

## 67.4 Waiting Strategies and Avoiding Sleeps 🟢

The UI changes **asynchronously**: data loads, animations run, screens push. A UI test must **wait** for things, but **how** matters:

```swift
// ❌ Fixed sleep: guesses how long things take
sleep(2)
XCTAssertTrue(app.staticTexts["home.welcome"].exists)

// ✅ Wait for the condition, up to a limit
XCTAssertTrue(app.staticTexts["home.welcome"].waitForExistence(timeout: 5))

// ✅ Wait for something to disappear (Xcode 16+)
XCTAssertTrue(app.activityIndicators["loading"].waitForNonExistence(timeout: 10))

// ✅ Wait for any property value (Xcode 15+)
let saveButton = app.buttons["editor.save"]
XCTAssertTrue(saveButton.wait(for: \.isEnabled, toEqual: true, timeout: 5))
```

Why fixed sleeps are **bad** both ways:

| Situation | `sleep(2)` | `waitForExistence(timeout: 5)` |
|---|---|---|
| Fast Mac: ready after 0.3 s | Wastes **1.7 s**, every run | Continues after **0.3 s** |
| Slow CI machine: ready after 3 s | **Fails** (flaky) | Passes after **3 s** |
| Really broken: never appears | Fails after 2 s | Fails after 5 s, with a clear message |

Across hundreds of tests, sleeps make the suite both **slower** and **flakier**.

XCUITest also waits **automatically** for the app to be **idle** (no animations running) before most actions. That's why you rarely need waits between simple taps; you need them for **async work**: network, timers, delayed UI.

---

## 67.5 Handling System Permission Dialogs 🟡

Permission alerts (location, camera, notifications: 54.1, 55.4, 50.1) come from **iOS**, not from your app. They're not in your app's element tree, and they **block** the screen until answered.

**Option 1: an interruption monitor** handles an unexpected alert when it gets in the way:

```swift
func testFindNearbyRecipes() {
    let monitor = addUIInterruptionMonitor(withDescription: "Location permission") { alert in
        let allow = alert.buttons["Allow While Using App"]
        if allow.exists {
            allow.tap()
            return true                              // handled
        }
        return false                                 // not ours: let other monitors try
    }
    defer { removeUIInterruptionMonitor(monitor) }

    app.buttons["home.nearby"].tap()                 // this triggers the system alert
    app.swipeUp()                                    // the NEXT interaction lets the monitor run

    XCTAssertTrue(app.cells.firstMatch.waitForExistence(timeout: 5))
}
```

The monitor only runs when the test tries to **interact** and finds the screen **blocked**. That's why a harmless interaction after the alert appears is often needed.

**Option 2: tap the alert directly** through the system's **SpringBoard** app. More explicit, and easier to follow:

```swift
let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
let allow = springboard.buttons["Allow While Using App"]
if allow.waitForExistence(timeout: 3) { allow.tap() }
```

**Option 3: avoid the dialog.** Often the best choice when the test isn't **about** permissions:

```bash
# Grant permission before the tests run (CI script)
xcrun simctl privacy booted grant location com.example.recipes
```

And to test the **first-time** prompt again, reset it from the test: `app.resetAuthorizationStatus(for: .location)`.

⚠️ Alert button titles are **localized** and can change between iOS versions. Keep system-alert handling in **one** helper, so you fix it in one place.

---

## 67.6 Launch Arguments for Test-Only State 🟡

Walking through onboarding, login, and three screens just to test the **cart** is slow and fragile. Instead, launch the app **directly** into the state you need:

```swift
// In the UI test
func testCartShowsThreeItems() {
    app.launchArguments = ["-ui-testing"]
    app.launchEnvironment = ["UITEST_SCENARIO": "cart-with-3-items"]
    app.launch()

    app.tabBars.buttons["Cart"].tap()
    XCTAssertEqual(app.cells.count, 3)
}
```

The **app** must cooperate: it reads the arguments at launch and sets itself up:

```swift
enum LaunchConfiguration {
    static let isUITesting = ProcessInfo.processInfo.arguments.contains("-ui-testing")
    static let scenario = ProcessInfo.processInfo.environment["UITEST_SCENARIO"]
}

@main
struct RecipeApp: App {
    private let services: AppServices                   // an @Observable container of dependencies

    init() {
        #if DEBUG
        if LaunchConfiguration.isUITesting {
            UIView.setAnimationsEnabled(false)              // faster, less flaky
            services = .uiTesting(scenario: LaunchConfiguration.scenario)
            // e.g. an in-memory store (66.1) seeded with 3 cart items,
            // fixture networking (66.10), onboarding marked as done
        } else {
            services = .live()
        }
        #else
        services = .live()
        #endif
    }

    var body: some Scene {
        WindowGroup { RootView().environment(services) }
    }
}
```

What test-only setup typically does:

| Setting | Why |
|---|---|
| **Fresh, in-memory data** | Each test starts **clean**: no leftovers from the last run |
| **Seeded scenarios** ("cart with 3 items") | Jump straight to the screen under test |
| **Fixture networking** | No real server: fast and deterministic |
| **Skip onboarding**, fake login | Don't repeat the same flow in every test |
| **Animations off** | Removes a big source of timing flakiness |

Wrap all of this in **`#if DEBUG`**, so these hooks **never** ship in the App Store build: a release app shouldn't accept a "skip login" switch.

---

## 67.7 Page Object Pattern for UI Tests 🟡

Without structure, UI tests repeat raw queries everywhere: `app.textFields["login.email"]` in 40 tests. When the screen changes, you fix 40 places. A **page object** wraps one **screen** in a type with **meaningful** methods:

```swift
@MainActor
struct LoginScreen {
    let app: XCUIApplication

    private var emailField: XCUIElement { app.textFields["login.email"] }
    private var passwordField: XCUIElement { app.secureTextFields["login.password"] }
    private var submitButton: XCUIElement { app.buttons["login.submit"] }
    var errorMessage: XCUIElement { app.staticTexts["login.error"] }

    @discardableResult
    func logIn(email: String, password: String) -> HomeScreen {
        emailField.tap()
        emailField.typeText(email)
        passwordField.tap()
        passwordField.typeText(password)
        submitButton.tap()
        return HomeScreen(app: app)                     // the next screen
    }
}

@MainActor
struct HomeScreen {
    let app: XCUIApplication
    var welcome: XCUIElement { app.staticTexts["home.welcome"] }

    func openRecipe(named name: String) -> RecipeScreen {
        app.cells.containing(.staticText, identifier: name).firstMatch.tap()
        return RecipeScreen(app: app)
    }
}
```

Tests now read like a **user story**:

```swift
func testLoggedInUserCanOpenARecipe() {
    let recipe = LoginScreen(app: app)
        .logIn(email: "ada@example.com", password: "correct-horse")
        .openRecipe(named: "Pasta Carbonara")

    XCTAssertTrue(recipe.title.waitForExistence(timeout: 5))
}

func testWrongPasswordShowsError() {
    let login = LoginScreen(app: app)
    login.logIn(email: "ada@example.com", password: "wrong")
    XCTAssertTrue(login.errorMessage.waitForExistence(timeout: 5))
}
```

The payoff: when the login screen **changes** (new identifier, an extra "Continue" step), you update **`LoginScreen`** only. Every test keeps working unchanged.

---

## 67.8 Diagnosing Flaky UI Tests 🟡

A **flaky** test sometimes passes and sometimes fails, **without** any code change. UI tests are especially prone to it. And flakiness is **dangerous**: once people learn that "red sometimes means nothing", they **re-run** and **ignore** failures, including **real** ones. The suite stops protecting you (65.1).

**Step 1: reproduce it.** Run the test **many times**:

- In Xcode: right-click the test ▸ **Run Repeatedly…** ▸ "until failure".
- On the command line:

```bash
xcodebuild test -scheme RecipeApp -only-testing:RecipeAppUITests/CartUITests/testCheckout \
  -test-iterations 50 -run-tests-until-failure \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

**Step 2: look at the evidence.** Xcode's test report has a **screen recording** and screenshots of UI test runs (67.10). Watch what was on screen when it failed.

**Step 3: check the usual causes:**

| Cause | Fix |
|---|---|
| A fixed `sleep`, or no wait for async work | `waitForExistence` and friends (67.4) |
| State **left over** from a previous test (logged in, data saved) | Fresh, in-memory data per launch (67.6) |
| **Animations** still running | Turn them off in UI-test mode |
| A **system alert** appearing sometimes (permissions, "Save password?") | Handle or avoid it (67.5) |
| **Real network** calls | Fixtures (66.10) |
| Assumes a screen **size**, language, or keyboard | Pin the simulator; use identifiers; check `typeText` with the hardware keyboard off |
| Elements off screen, or not yet **hittable** | Scroll first; wait for `isHittable` |

**Step 4: fix the cause**, then run it 50 times again. Don't just add **automatic retries**: they hide flakiness instead of fixing it. If you must quarantine a test temporarily, do it **visibly** (a skip with a linked issue), and fix it soon.

---

## 67.9 performAccessibilityAudit() 🟢

**`performAccessibilityAudit()`** (Xcode 15+) checks the **current screen** for common accessibility problems, inside a normal UI test:

```swift
func testRecipeDetailIsAccessible() throws {
    HomeScreen(app: app).openRecipe(named: "Pasta Carbonara")     // go to the screen to audit

    try app.performAccessibilityAudit()                          // fails the test on issues
}
```

It finds issues such as:

| Audit type | Finds |
|---|---|
| `.sufficientElementDescription` | Buttons and images with **no label** (VoiceOver says "button") |
| `.contrast` | Text with too little **contrast** |
| `.hitRegion` | Tap targets that are too **small** |
| `.dynamicType` | Text that doesn't scale with the user's **text size** |
| `.textClipped` | Text that's **cut off** |
| `.elementDetection`, `.trait` | Elements VoiceOver can't reach, or with wrong roles |

Choose audit types, and **ignore** known, accepted issues (with a reason):

```swift
try app.performAccessibilityAudit(for: [.contrast, .sufficientElementDescription, .dynamicType]) { issue in
    // Return true to ignore this issue
    if issue.auditType == .contrast, issue.element?.identifier == "brand.logo" {
        return true                                   // the logo's colors are fixed by brand rules
    }
    return false
}
```

Like snapshot tests catch **visual** regressions (66.4), audits catch **accessibility** regressions: a new icon button without a label, a color change that ruins contrast. Run them on your **main** screens in every CI run.

An audit doesn't replace **real** testing with VoiceOver and Dynamic Type (70): it catches the **common, mechanical** problems automatically, so humans can focus on the experience.

---

## 67.10 Screenshots and Attachments in Test Reports 🟢

When a UI test fails on CI, "element not found" alone rarely explains **why**. Was an alert in the way? A spinner stuck? A different screen? **Pictures** answer that.

By default, Xcode **records** UI test runs in the **test report**: screenshots of steps and a **video**, especially on failure. (Test plans can change this: "Automatic Screenshots and Video", e.g. keep them only for failures.)

Add your **own** screenshots at important moments, and group steps so the report reads like a story:

```swift
func testCheckoutFlow() {
    XCTContext.runActivity(named: "Add two items to the cart") { _ in
        // ... taps ...
    }

    XCTContext.runActivity(named: "Review order") { activity in
        app.tabBars.buttons["Cart"].tap()

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "Order summary"
        attachment.lifetime = .keepAlways          // keep it even if the test PASSES
        activity.add(attachment)
    }

    // ... pay and check the confirmation ...
}
```

| Setting | Effect |
|---|---|
| `lifetime = .deleteOnSuccess` (default) | Kept only when the test **fails**: saves space |
| `lifetime = .keepAlways` | Always kept: useful for reviews, docs, or App Store screenshot pipelines |

You can attach **other** data too: the app's log, a JSON response, a text dump of `app.debugDescription` (the full accessibility tree, which shows exactly what the test **could** see).

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| UI test basics | `XCUIApplication`, `launch()`, recording | Drive the real app from a separate process |
| Finding elements | Queries, `.firstMatch`, `containing`, `NSPredicate` | Lazy searches of the accessibility tree |
| Stable selectors | `accessibilityIdentifier` | Survive copy changes and localization |
| Waiting | `waitForExistence`, `waitForNonExistence`, `wait(for:toEqual:)` | Fast when ready, patient when slow |
| System alerts | Interruption monitors, SpringBoard, `simctl privacy` | Handle or avoid permission dialogs |
| Test-only state | `launchArguments`, `launchEnvironment`, `#if DEBUG` | Start directly in a known, clean state |
| Page objects | One type per screen, chained methods | Change a screen in one place |
| Flaky tests | Run repeatedly, recordings, fix causes | Keep failures meaningful |
| Accessibility audits | `performAccessibilityAudit(for:)` | Catch common a11y regressions in CI |
| Reports | `XCTAttachment`, `runActivity`, videos | See what happened, not just that it failed |
