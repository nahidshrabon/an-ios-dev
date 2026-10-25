**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 76.1 Why CI Matters for Mobile 🟢

**Continuous Integration (CI)** builds and tests **every change automatically**, usually on every pull request, before it is merged. iOS builds have many moving parts (signing, simulators, long build times), so automatic checks are worth even more than on a server project.

```yaml
# Conceptual CI trigger: run build + full test suite (recall Part 10) on every PR
on: pull_request
jobs:
  build-and-test:
    steps:
      - run: xcodebuild build -scheme MyApp
      - run: xcodebuild test -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16'
```

**Tests only protect you if they run.** A great test suite (Part 10) is useless if people forget to run it before merging. CI makes sure it runs **every time**, without depending on anyone's memory.

---

## 76.2 xcodebuild for Building 🟢

**`xcodebuild`** is Xcode's build system on the **command line**. CI machines have no screen, so they build with commands.

```bash
xcodebuild build \
  -project MyApp.xcodeproj \
  -scheme MyApp \
  -configuration Release \
  -destination 'generic/platform=iOS'
```

Useful extra options:

```bash
xcodebuild -list                                   # see schemes and configurations
xcodebuild build -scheme MyApp \
  -destination 'generic/platform=iOS' \
  -quiet \                                          # show only warnings and errors
  CODE_SIGNING_ALLOWED=NO                           # just check that it compiles, no signing
```

Use a project with `-project`, or a workspace with `-workspace MyApp.xcworkspace`.

**`generic/platform=iOS`** means "for any iOS device", not one specific simulator. Use it for builds you will **archive and ship** (76.10). Tests (76.3) need a **real simulator or device** to run on.

---

## 76.3 xcodebuild for Testing 🟢

**`xcodebuild test`** runs your tests (Swift Testing and XCTest, section 65.16) on a **specific simulator or device**, and can save the results in a result bundle (76.4).

```bash
xcodebuild test \
  -project MyApp.xcodeproj \
  -scheme MyApp \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=latest' \
  -resultBundlePath TestResults.xcresult
```

The simulator name must **exist on that machine**. Check which ones are there:

```bash
xcrun simctl list devices available
```

Run only some tests, or run them in parallel:

```bash
xcodebuild test -scheme MyApp -destination '...' \
  -only-testing:MyAppTests/RecipeTests          # one test class or suite
xcodebuild test -scheme MyApp -destination '...' \
  -parallel-testing-enabled YES                 # spread tests over several simulator clones
```

Building for shipping needs no device (76.2). Testing **runs code**, so it needs a real place to run it: a named simulator or a connected device.

---

## 76.4 Result Bundles and xcresulttool 🟡

A **`.xcresult` bundle** holds everything about a test run: each test's result, screenshots (section 67.10), code coverage, and logs. **`xcresulttool`** reads it from the command line.

```bash
xcresulttool get --format json --path TestResults.xcresult > results.json
# Extracts structured test result data, including individual test outcomes,
# failure messages, and attached screenshots, for programmatic CI processing
```

In Xcode 16 and later, there are clearer commands for test results:

```bash
xcrun xcresulttool get test-results summary --path TestResults.xcresult   # totals and failures
xcrun xcresulttool get test-results tests --path TestResults.xcresult     # every test
```

Code coverage:

```bash
xcrun xccov view --report TestResults.xcresult      # coverage per file and target
```

The exit code of `xcodebuild test` only says **pass or fail**. The result bundle tells you **which** test failed, **why**, and shows the **screenshot**. CI can post that on the pull request, and track coverage over time.

---

## 76.5 GitHub Actions for iOS 🟢

**GitHub Actions** can run iOS CI, but it needs a **macOS runner**, because Xcode only runs on macOS.

```yaml
name: iOS CI
on: [pull_request]
jobs:
  test:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4
      - run: xcodebuild test -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16'
```

A fuller workflow that also picks the Xcode version and keeps the results:

```yaml
name: iOS CI
on: [pull_request]
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: latest-stable
      - name: Test
        run: |
          xcodebuild test -scheme MyApp \
            -destination 'platform=iOS Simulator,name=iPhone 16' \
            -resultBundlePath TestResults.xcresult
      - uses: actions/upload-artifact@v4
        if: always()                       # keep results even when tests fail
        with:
          name: test-results
          path: TestResults.xcresult
```

**macOS runners cost more**, and are often slower, than Linux runners. So caching (76.7) and build speed (76.14) matter more for iOS than for many other projects.

---

## 76.6 Xcode Cloud Workflows 🟢

**Xcode Cloud** is **Apple's own CI/CD service**, built into Xcode and App Store Connect. You set up workflows in Xcode's UI. There is no YAML to write and no Mac runners to manage.

```plaintext
// Xcode Cloud workflows are configured via Xcode's own UI/Cloud tab, defining:
// - Start conditions: which branch/tag triggers this workflow
// - Actions: build, test (specific test plans, recall section 66.14), archive
// - Post-actions: TestFlight distribution, notification on completion/failure
```

You can still run your own steps with **custom scripts** in a `ci_scripts` folder next to your project:

```bash
#!/bin/sh
# ci_scripts/ci_post_clone.sh — runs after Xcode Cloud clones your repo
brew install swiftlint
```

```bash
#!/bin/sh
# ci_scripts/ci_pre_xcodebuild.sh — runs before each build
echo "Build number: $CI_BUILD_NUMBER"
```

| | Xcode Cloud | GitHub Actions |
|---|---|---|
| Setup | In Xcode, little to configure | YAML files you write |
| Knows Apple tools | Schemes, test plans, TestFlight built in | You script them |
| Flexibility | Less | More |

Xcode Cloud is a good fit for teams that **live in Apple's tools** and want **low setup and maintenance**.

---

## 76.7 Caching DerivedData and SPM Checkouts 🟡

CI gets faster if you **cache** things between runs:

- **DerivedData:** Xcode's build output (section 69.8).
- **SPM checkouts:** the downloaded packages.

```yaml
# Conceptual caching configuration:
- uses: actions/cache@v4
  with:
    path: |
      ~/Library/Developer/Xcode/DerivedData
      .build
    key: ${{ hashFiles('**/Package.resolved') }}-${{ hashFiles('**/*.swift') }}
```

Keep the packages in a known folder, so they are easy to cache:

```yaml
- uses: actions/cache@v4
  with:
    path: SourcePackages
    key: spm-${{ hashFiles('**/Package.resolved') }}      # changes only when versions change
- run: |
    xcodebuild test -scheme MyApp \
      -destination 'platform=iOS Simulator,name=iPhone 16' \
      -clonedSourcePackagesDirPath SourcePackages
```

With a good cache, CI can rebuild **only what changed** (incremental compilation, section 72.13) instead of everything. On expensive macOS runners (76.5), that saves real time and money.

---

## 76.8 Fastlane: Lanes and Actions 🟡

**Fastlane** is a popular tool that automates iOS release work. You write **lanes** (named sequences of steps) in a **`Fastfile`**. Each step is an **action**: a ready-made task like running tests, building, or uploading to TestFlight.

```ruby
# Fastfile
lane :beta do
  run_tests(scheme: "MyApp")
  build_app(scheme: "MyApp", export_method: "app-store")
  upload_to_testflight
end
```

Run a lane from the terminal:

```bash
brew install fastlane
fastlane init          # creates the fastlane folder with Fastfile and Appfile
fastlane beta          # runs the "beta" lane
```

Shared settings live in the **`Appfile`**:

```ruby
# fastlane/Appfile
app_identifier("com.example.myapp")
team_id("ABCDE12345")
```

**Why:** releasing an app has many small, easy-to-break steps: signing (76.9), version numbers (76.12), uploading (76.10). Fastlane's actions are **tested building blocks** for each one, so you do not write and maintain all those scripts yourself.

---

## 76.9 Fastlane match for Code Signing 🟡

**Code signing** (section 77.1) is one of the most painful parts of iOS CI. **`fastlane match`** keeps the team's **certificates and profiles encrypted in one shared Git repository**. Every developer and every CI machine gets the **same** signing setup from there.

```bash
fastlane match appstore  # fetches and installs the shared App Store distribution certificate/profile
```

Set it up once, then use it in lanes:

```bash
fastlane match init                  # choose where to store them (for example a private Git repo)
fastlane match development           # create or fetch development signing
```

```ruby
lane :beta do
  setup_ci                                   # a temporary keychain on the CI machine
  match(type: "appstore", readonly: true)    # CI only reads, never creates new certificates
  build_app(scheme: "MyApp")
  upload_to_testflight
end
```

The repository is encrypted. CI gets the password from a secret environment variable, `MATCH_PASSWORD`.

Most signing failures on CI come from **each machine having its own, slightly different setup** (section 77.4). One shared source fixes the cause.

---

## 76.10 Automating TestFlight Uploads 🟡

Build, archive, export, and upload to TestFlight **with one command**, using Fastlane's `upload_to_testflight` or the App Store Connect API (76.11). By hand, it is a slow, error-prone job through Xcode's Organizer or Transporter.

```ruby
lane :release_beta do
  increment_build_number  # automated version/build numbering, recall 76.12
  build_app(scheme: "MyApp")
  upload_to_testflight(skip_waiting_for_build_processing: true)
end
```

Run it automatically, for example on every push to a `release` branch:

```yaml
on:
  push:
    branches: [release]
jobs:
  beta:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: fastlane release_beta
        env:
          MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
```

Beta builds happen **often**. A 15-minute manual job, repeated for every beta, adds up. Automated, it costs **almost nothing**.

---

## 76.11 The App Store Connect API 🔴

The **App Store Connect API** lets code do almost everything the App Store Connect website does: manage TestFlight builds, app details, and submissions. It uses **JWT** authentication with an **API key** you create in App Store Connect.

```swift
// Conceptual API interaction (JWT auth against App Store Connect API):
// POST /v1/builds/{id}/appStoreVersionSubmissions — programmatically submit a build for review
// GET /v1/apps/{id}/builds — query current build/processing status
```

A request with a JWT (signed with your private `.p8` key, valid for at most 20 minutes):

```bash
curl -H "Authorization: Bearer $JWT" \
  https://api.appstoreconnect.apple.com/v1/apps
```

The JWT contains:

```json
{ "alg": "ES256", "kid": "YOUR_KEY_ID", "typ": "JWT" }
{ "iss": "YOUR_ISSUER_ID", "iat": 1760000000, "exp": 1760001200, "aud": "appstoreconnect-v1" }
```

Fastlane can use the same key, instead of an Apple ID login:

```ruby
api_key = app_store_connect_api_key(
  key_id: "YOUR_KEY_ID",
  issuer_id: "YOUR_ISSUER_ID",
  key_filepath: "AuthKey_YOUR_KEY_ID.p8"
)
upload_to_testflight(api_key: api_key)
```

Fastlane's actions use this API underneath, and cover most needs. Use the **API directly** only for **custom** needs, like showing submission status in your own dashboard.

---

## 76.12 Automated Version and Build Numbering 🟢

An app has two numbers:

- **Version** (`CFBundleShortVersionString`): what users see, like `2.3.0`.
- **Build number** (`CFBundleVersion`): must **go up for every upload**.

Let CI set them, so nobody forgets.

```ruby
lane :bump_and_build do
  increment_build_number(build_number: latest_testflight_build_number + 1)
  build_app(scheme: "MyApp")
end
```

Without Fastlane, set the build number from the CI run number:

```bash
xcodebuild archive -scheme MyApp \
  -archivePath MyApp.xcarchive \
  CURRENT_PROJECT_VERSION=$GITHUB_RUN_NUMBER        # the build number
```

Or with Apple's `agvtool`:

```bash
agvtool new-version -all 42            # set the build number to 42
agvtool new-marketing-version 2.3.0    # set the version
```

**App Store Connect rejects an upload** whose build number is not higher than the last one. Automating it removes this common, avoidable failure.

---

## 76.13 Uploading dSYMs Automatically 🟡

A **dSYM** file turns crash addresses back into function names and line numbers (symbolication, section 68.22). Upload dSYMs **in every release pipeline**, to Apple and to your crash reporting service (section 80.4).

```ruby
lane :release do
  build_app(scheme: "MyApp")
  upload_to_testflight
  upload_symbols_to_crashlytics(dsym_path: "MyApp.app.dSYM.zip")  # example third-party integration
end
```

Make sure Release builds create dSYMs:

```plaintext
// Release.xcconfig
DEBUG_INFORMATION_FORMAT = dwarf-with-dsym
```

An archive keeps them in its `dSYMs` folder:

```bash
ls MyApp.xcarchive/dSYMs/          # MyApp.app.dSYM, plus one per framework
```

A dSYM must match **the exact build** that crashed. If the upload is a separate, manual step, someone will forget, and then a real user's crash **cannot be read**. Make it part of every release.

---

## 76.14 Build Time Optimization in CI 🔴

Besides the general tips for slow builds (section 72.11), CI has its own:

- **Run independent jobs in parallel:** linting, unit tests, and UI tests at the same time.
- **Use ready-made runner images** with the tools already installed.
- **Cache aggressively** (76.7), because macOS runners are expensive (76.5).

```yaml
# Parallelizing independent CI concerns as separate, concurrent jobs:
jobs:
  lint:       { runs-on: macos-14, steps: [swiftlint --strict] }
  unit-tests: { runs-on: macos-14, steps: [xcodebuild test -scheme MyApp -only-testing:UnitTests] }
  ui-tests:   { runs-on: macos-14, steps: [xcodebuild test -scheme MyApp -only-testing:UITests] }
```

The same in full GitHub Actions syntax. The three jobs start **at the same time**, and a deploy job waits for all of them:

```yaml
jobs:
  lint:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: swiftlint --strict
  unit-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: xcodebuild test -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:UnitTests
  ui-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: xcodebuild test -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:UITests
  deploy:
    needs: [lint, unit-tests, ui-tests]      # runs only after all three pass
    runs-on: macos-latest
    steps:
      - run: echo "deploy"
```

This is test sharding (section 66.15) applied to the **whole pipeline**. Developers wait less for CI, which makes the whole team faster.

---

## 76.15 Merge Queues and Build Sharding 🔴

Two pull requests can **each pass CI**, and still **break `main` together**. A **merge queue** prevents this: it tests each PR **together with the PRs ahead of it** in the queue, and only then merges.

```plaintext
// The problem merge queues solve:
// PR A passes CI against current main
// PR B passes CI against current main
// PR A merges; PR B merges next — but PR A+B combined might break something
// neither PR individually would have revealed, since neither was tested against the OTHER's changes
```

On GitHub, turn on the merge queue in the branch rules, and let CI run for queued changes too:

```yaml
on:
  pull_request:
  merge_group:          # runs CI for each change in the merge queue
```

**Build sharding** is a different tool: it splits **one** PR's tests across **several runners** in parallel (like test sharding in section 66.15).

| | Merge queue | Build sharding |
|---|---|---|
| Problem | Two good PRs break `main` together | One PR's checks are slow |
| Solution | Test each PR with the ones ahead of it | Split the work across runners |

A rule like "CI must pass before merge" **does not catch** the combined problem. A merge queue does.

---

## Summary

| Concept | Key Tool/Mechanism | Purpose |
|---|---|---|
| Why CI | Build and test every PR | Tests only help if they run |
| Building | `xcodebuild build` | Builds without Xcode's UI |
| Testing | `xcodebuild test` | Runs tests on a real simulator |
| Test results | `.xcresult`, `xcresulttool`, `xccov` | Which test failed, and coverage |
| GitHub Actions | macOS runners, YAML workflows | Flexible CI |
| Xcode Cloud | Apple's built-in CI, `ci_scripts` | Low setup inside Apple's tools |
| Caching | DerivedData and packages | Rebuild only what changed |
| Fastlane | Lanes and actions | Ready-made release steps |
| Signing | `fastlane match` | One shared signing setup |
| TestFlight | Automated uploads | No manual upload steps |
| App Store Connect API | JWT and an API key | Custom automation |
| Numbering | Automatic build numbers | No rejected uploads |
| dSYMs | Upload in every release | Crashes can always be read |
| Pipeline speed | Parallel jobs | Less waiting for CI |
| Merge queues | Test PRs together before merging | Catch combined breakages |
