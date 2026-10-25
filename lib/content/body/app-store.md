**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 78.1 App Store Connect: Creating an App Record 🟢

Before you can upload any build, create an **app record** in App Store Connect. It connects your App ID (section 77.1) to a real App Store presence.

```plaintext
// App Store Connect app record setup requires:
// - Bundle ID (matching the App ID configured in the Developer portal, section 77.1)
// - Primary language (the default locale for metadata, section 78.2)
// - SKU (an internal, developer-chosen identifier, not shown to users)
// - App name (subject to App Store-wide uniqueness and character limits)
```

In App Store Connect: **Apps → + → New App**, then fill in the fields above. Fastlane can also create it:

```bash
fastlane produce \
  --app_identifier com.example.recipeshare \
  --app_name "RecipeShare" \
  --sku recipeshare-001
```

**Do this first.** TestFlight (78.7), metadata (78.2), and privacy labels (78.6) all attach to this record.

---

## 78.2 Metadata, Keywords, and ASO Basics 🟢

**App Store Optimization (ASO)** means making your app **easy to find** and **tempting to download**. It depends a lot on your metadata:

| Field | Limit | Search weight | Users see it? |
|---|---|---|---|
| App name | 30 characters | High | Yes |
| Subtitle | 30 characters | High | Yes |
| Keywords | 100 characters | Indexed | **No** |
| Description | 4,000 characters | Low | Yes |

```plaintext
// Representative ASO-relevant metadata fields:
// App Name: "RecipeShare" (character-limited, search-weighted)
// Subtitle: "Share & Discover Recipes" (search-weighted, visible in search results)
// Keywords: "recipe,cooking,meal plan,food" (search-indexed, NOT visible to users)
// Description: longer-form, less search-weighted, but conversion-critical
```

Keep metadata in text files, and upload it with Fastlane's `deliver`:

```plaintext
fastlane/metadata/en-US/name.txt          RecipeShare
fastlane/metadata/en-US/subtitle.txt      Share & Discover Recipes
fastlane/metadata/en-US/keywords.txt      recipe,cooking,meal plan,food
fastlane/metadata/en-US/description.txt   (the long text)
```

```bash
fastlane deliver --skip_binary_upload --skip_screenshots
```

**Name and subtitle help people find you.** Choose them with keyword research. **The description helps people decide** once they see your page, so that is where you persuade.

---

## 78.3 Screenshots and App Previews 🟢

**Screenshots** (images) and **app previews** (short videos) are often the **first real thing** people see. Show your **real app**, not only marketing art.

```plaintext
// Screenshot best practices:
// - Show genuine, actual app content/functionality, not just marketing copy
// - Consider localizing screenshots to show localized in-app content (recall section 71.14)
//   for markets where the app's actual UI would appear in that language
// - Order matters: the first 2-3 screenshots receive disproportionate attention
```

Generate screenshots automatically from a UI test, with Fastlane's `snapshot`:

```swift
// In a UI test (see section 67)
func testScreenshots() {
    let app = XCUIApplication()
    setupSnapshot(app)
    app.launch()

    snapshot("01-RecipeList")
    app.buttons["Pasta"].tap()
    snapshot("02-RecipeDetail")
}
```

```bash
fastlane snapshot      # runs the test in every language and device you set up
```

This also makes **localized screenshots** easy (section 71.14). A Spanish user should see the app **in Spanish**, not English UI with a translated caption.

---

## 78.4 Privacy Manifest (PrivacyInfo.xcprivacy) 🟡

The **privacy manifest** (`PrivacyInfo.xcprivacy`) declares **what data your app collects**, and which **"required reason" APIs** it uses (78.5). Apple **combines** the manifests from your app and **all its dependencies**. Missing or wrong declarations **block submission**.

```xml
<!-- PrivacyInfo.xcprivacy (simplified) -->
<key>NSPrivacyCollectedDataTypes</key>
<array>
    <dict>
        <key>NSPrivacyCollectedDataType</key>
        <string>NSPrivacyCollectedDataTypeEmailAddress</string>
        <key>NSPrivacyCollectedDataTypeLinked</key>
        <true/>
    </dict>
</array>
```

A fuller entry says whether you track, and **why** you collect the data:

```xml
<key>NSPrivacyTracking</key>
<false/>
<key>NSPrivacyCollectedDataTypes</key>
<array>
    <dict>
        <key>NSPrivacyCollectedDataType</key>
        <string>NSPrivacyCollectedDataTypeEmailAddress</string>
        <key>NSPrivacyCollectedDataTypeLinked</key>
        <true/>
        <key>NSPrivacyCollectedDataTypeTracking</key>
        <false/>
        <key>NSPrivacyCollectedDataTypePurposes</key>
        <array>
            <string>NSPrivacyCollectedDataTypePurposeAppFunctionality</string>
        </array>
    </dict>
</array>
```

To see the **combined result** for your app and its packages: in Xcode's Organizer, right-click an archive and choose **Generate Privacy Report**.

**Why dependencies matter:** a third-party package (section 73.7) may collect data you do not know about. Because Apple combines all manifests, you now have to **know what your dependencies do** with data, not only your own code.

---

## 78.5 Required Reason APIs 🟡

Some APIs were used in the past to **fingerprint** devices (identify them without permission). Apple now requires an **approved reason** for using them, in the privacy manifest (78.4). Without one, **the submission is rejected**.

```xml
<key>NSPrivacyAccessedAPITypes</key>
<array>
    <dict>
        <key>NSPrivacyAccessedAPIType</key>
        <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
        <key>NSPrivacyAccessedAPITypeReasons</key>
        <array><string>C617.1</string></array>  <!-- a specific, Apple-defined approved reason code -->
    </dict>
</array>
```

The categories include:

| Category | Example APIs |
|---|---|
| File timestamp | A file's creation or modification date |
| System boot time | `ProcessInfo.processInfo.systemUptime` |
| Disk space | Free space on the device |
| Active keyboards | The list of installed keyboards |
| User defaults | `UserDefaults` |

**Almost every app uses `UserDefaults`**, so most apps need this entry:

```xml
<dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array><string>CA92.1</string></array>   <!-- reading and writing your own app's data -->
</dict>
```

**Why:** these APIs could identify a device **without any permission prompt**. A prompt (like for the camera) cannot catch that, so Apple asks for a valid reason instead.

---

## 78.6 Privacy Nutrition Labels 🟢

**Privacy nutrition labels** show, on your App Store page, **what data you collect and how you use it**. You fill them in App Store Connect. (They are different from Accessibility Nutrition Labels, section 70.18.)

```plaintext
// Privacy label categories developers declare accuracy for:
// - Data Used to Track You (shared with data brokers/other companies for tracking)
// - Data Linked to You (associated with the user's identity)
// - Data Not Linked to You (collected but not tied to identity)
```

| Category | Meaning | Example |
|---|---|---|
| Data Used to Track You | Shared with other companies to track the user | An ad network's identifier |
| Data Linked to You | Connected to the user's identity | The email address of an account |
| Data Not Linked to You | Collected, but not tied to the user | Anonymous crash counts |

Make the labels **match your privacy manifest** (78.4) and what your app really does.

Users read these labels **before they download**. Wrong labels break their trust, and Apple has taken action against apps with knowingly false labels.

---

## 78.7 TestFlight Internal and External Testing 🟢

**TestFlight** has two kinds of testing:

| | Internal | External |
|---|---|---|
| Who | Your team (up to 100 people) | Anyone you invite (up to 10,000) |
| Apple review | None, builds are available right away | A short Beta App Review first |
| Invite | Team members in App Store Connect | Email, or a public link |
| Good for | Fast daily testing | Wider testing before release |

```plaintext
// Internal testing: immediate availability, team members only, no Apple review required
// External testing: requires Beta App Review (typically fast, but not instant),
//                    supports much larger tester groups, including public link-based enrollment
```

With Fastlane, upload and send to an external group:

```ruby
upload_to_testflight(
  groups: ["Beta Testers"],
  distribute_external: true,
  changelog: "New: save recipes offline. Please test the Favorites screen."
)
```

The `changelog` becomes **"What to Test"**, so testers know what to look at.

**Speed vs. reach:** use internal testing for quick checks while you work. Use external testing for **bigger, more realistic** testing before the App Store release. Beta App Review is usually faster and lighter than the full review (78.9).

---

## 78.8 Submitting for Review 🟢

To submit, you need **complete metadata** (78.2), **screenshots** (78.3), **privacy declarations** (78.4 to 78.6), and a **processed build**. Then the app goes into Apple's review queue. Review often takes about **24 to 48 hours**, but it varies.

```plaintext
// Pre-submission checklist:
// - Build fully processed (uploaded and finished App Store Connect processing)
// - All required metadata fields completed for every localization the app supports
// - Privacy manifest, required reason declarations, and privacy labels all accurate and complete
// - Export compliance information provided (if the app uses encryption)
```

**Export compliance:** if your app only uses standard encryption like HTTPS, add this key to `Info.plist`, so you are not asked on every upload:

```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

Submit with Fastlane:

```ruby
deliver(
  submit_for_review: true,
  automatic_release: false,          # you choose when it goes live after approval
  force: true                         # skip the HTML preview
)
```

Many rejections are **not about the app itself**. They come from missing metadata, missing privacy details, or export compliance. A careful checklist means **fewer review rounds**.

---

## 78.9 App Review Guidelines: The Parts That Matter 🟢

Apple's App Review Guidelines are long, but **most rejections come from a few areas**. Check these carefully before every submission:

```plaintext
// Disproportionately common rejection categories worth extra pre-submission scrutiny:
// - Crashes/bugs during review (directly connects to the debugging/testing discipline from Parts 9-10)
// - Broken or incomplete functionality (placeholder content, non-functional links)
// - Metadata/screenshots not accurately representing actual app functionality
// - Privacy declaration inaccuracy or incompleteness (78.4-78.6)
```

Two more that catch many teams:

- **Login required, but no demo account.** If reviewers must sign in, give a working demo account in **App Review Information**.
- **Digital goods without in-app purchase.** Selling digital content usually requires Apple's in-app purchase (section 56).

```plaintext
App Review Information
  Sign-in required:  Yes
  User name:         review@example.com
  Password:          (a working demo password)
  Notes:             Tap "Pantry" to see the barcode scanner. It needs a product barcode.
```

The rest of the guidelines still matter. But your review time is best spent on **where most real rejections happen**.

---

## 78.10 Handling a Rejection 🟢

A rejection names a **guideline** and includes the **reviewer's notes**. Decide which case it is:

- **A real problem** (a bug, missing functionality): **fix it and resubmit**.
- **A misunderstanding** (the reviewer misread how a feature works): **reply in the Resolution Center** with more context, or **appeal**.

```plaintext
// Rejection response decision:
// - Genuine issue (an actual bug, missing required functionality) → fix and resubmit
// - Misunderstanding (reviewer misunderstood a feature's actual purpose/behavior)
//   → respond via Resolution Center with clarifying context, or request an appeal
```

A clear, polite reply for a misunderstanding:

```plaintext
Hello, thank you for the review.

The location permission is used only for the "Nearby Stores" feature (Pantry tab →
"Find nearby"). It is requested when the user taps that button, not at launch.
A short screen recording is attached showing the flow.

Thank you!
```

**Not every rejection needs a code change.** Reviewers see many apps and have little time. Good context can solve a misunderstanding much faster than an unnecessary code change.

---

## 78.11 Phased Release and Staged Rollout 🟢

**Phased release** gives a new version to **more and more existing users over 7 days**, instead of everyone at once. If a serious bug appears, only a **small group** is affected, and you can **pause**.

```plaintext
// Phased release schedule (approximate, automatic):
// Day 1: 1% of users
// Day 2: 2%
// Day 3: 5%
// Day 4: 10%
// Day 5: 20%
// Day 6: 50%
// Day 7: 100%
// (Rollout can be paused at any point if a serious issue is discovered)
```

Turn it on with Fastlane when you submit:

```ruby
deliver(submit_for_review: true, phased_release: true)
```

New users and people who update by hand can still get the version right away. The phases only apply to **automatic updates**.

This is the same idea as performance budgets (section 69.19) and merge queues (section 76.15): **limit the damage** before you fully commit.

---

## 78.12 Responding to Reviews and Ratings Prompts 🟢

Two different things:

- **Replying to reviews:** you can reply publicly to App Store reviews, in App Store Connect.
- **Asking for a rating:** the `requestReview` API shows Apple's rating prompt inside your app.

```swift
import StoreKit

@Environment(\.requestReview) var requestReview

// Called at an appropriate moment, e.g., after a genuinely positive user interaction:
requestReview()
// The system decides whether to actually show the prompt, respecting Apple's own
// frequency limits — an app cannot force the prompt to appear on every single call
```

A good pattern: ask **after a happy moment**, and **not too often**:

```swift
struct RecipeSavedView: View {
    @Environment(\.requestReview) private var requestReview
    @AppStorage("savedRecipeCount") private var savedCount = 0
    @AppStorage("lastReviewRequestVersion") private var lastVersion = ""

    func recipeSaved() {
        savedCount += 1
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        if savedCount >= 3 && lastVersion != version {   // after 3 saves, once per version
            requestReview()
            lastVersion = version
        }
    }

    var body: some View {
        Button("Save Recipe") { recipeSaved() }
    }
}
```

**The system decides** if the prompt really appears. It is shown at most a few times a year, so a call does not guarantee a prompt. Never show your own fake rating dialog instead.

---

## 78.13 Custom Product Pages and A/B Testing Listings 🟡

Two tools to improve your store page with **real data**:

- **Custom product pages:** extra versions of your page (different screenshots, videos, or promotional text), each with **its own link**, for example for one ad campaign.
- **Product page optimization:** an **A/B test** that shows different versions to different people, and measures which one **gets more downloads**.

```plaintext
// Custom product page use case: a specific marketing campaign links to a
// product page variant emphasizing a particular feature relevant to that campaign's audience,
// rather than sending all traffic to one single, generic default listing
```

Each custom product page has its own link, with a `ppid` parameter:

```plaintext
https://apps.apple.com/app/id1234567890?ppid=45812c9b-c296-43d3-9e0e-0a1b2c3d4e5f
```

For example, a campaign for vegetarians links to a page whose screenshots show vegetarian recipes first.

This takes ASO (78.2) **beyond guessing**. Instead of choosing your page once and hoping, you **test and measure** which version really works, and keep improving.

---

## 78.14 App Size Limits and On-Demand Resources 🟡

**Download size matters.** Above **200 MB**, iOS asks users before downloading over cellular, by default. (Users can change this setting.) Some people then **give up** on the download.

**On-demand resources** keep extra content **out of the first download**. The app fetches it **later, when needed**. (Section 69.15 covers other ways to make your app smaller.)

```plaintext
// On-demand resource tagging (declaring content NOT needed at initial install):
// resources marked with an NSAssetTagIdentifier are fetched later, on-demand,
// rather than bundled into the initial app download — keeping initial download size smaller
```

In Xcode, give resources a **tag** (like `level2`). Then download them when needed:

```swift
let request = NSBundleResourceRequest(tags: ["level2"])

try await request.beginAccessingResources()   // downloads if not already there
let image = UIImage(named: "level2-background") // now available from the bundle
// ... use the resources ...
request.endAccessingResources()                 // the system may remove them later
```

For new apps, also look at Apple's **Background Assets** framework, which downloads large content in the background.

A smaller first download is **not just a technical detail**. Users who see a cellular warning, or wait a long time, may **never install** the app. That is a real business cost.

---

## Summary

| Concept | Key Mechanism | Purpose |
|---|---|---|
| App record | App Store Connect, `fastlane produce` | The first step for everything else |
| ASO | Name, subtitle, keywords, description | Be found, then be chosen |
| Screenshots | `fastlane snapshot`, localized images | The first thing people see |
| Privacy manifest | `PrivacyInfo.xcprivacy` | Declare data for your app and its packages |
| Required reason APIs | Approved reason codes | Stop silent fingerprinting |
| Privacy labels | Tracking, linked, not linked | Users decide before downloading |
| TestFlight | Internal and external testing | Fast checks vs. wide testing |
| Submitting | Checklist, export compliance | Fewer rejections |
| Guidelines | Crashes, broken features, demo accounts | Check where rejections happen |
| Rejections | Fix, or explain in the Resolution Center | Not every rejection needs code |
| Phased release | 1% to 100% over 7 days | Limit the damage of a bad release |
| Ratings | `requestReview`, after happy moments | Ask at the right time |
| Product pages | Custom pages, A/B tests | Improve the listing with data |
| App size | On-demand resources | A smaller first download |
