**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

An app doesn't live alone. The system **launches**, **backgrounds**, and **terminates** it. Other apps and websites **link** into it. The user moves between **devices**, searches with **Spotlight**, and shares activities over **FaceTime**. This section covers how your app fits into the system: lifecycle, configuration, deep links, Handoff, state restoration, background work, Spotlight, and SharePlay.

---

## 49.1 The SwiftUI App Protocol and Scene Phases 🟢

In SwiftUI, the **`App`** protocol is the app's **entry point** (marked `@main`). **`@Environment(\.scenePhase)`** tells you where the app is in its lifecycle:

```swift
@main
struct RecipeApp: App {
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .onChange(of: scenePhase) { oldPhase, newPhase in
            switch newPhase {
            case .active: print("In the foreground, receiving touches")
            case .inactive: print("Visible, but not receiving events (app switcher, Control Center)")
            case .background: print("Not visible")
            @unknown default: break
            }
        }
    }
}
```

| Phase | Meaning | Example |
|---|---|---|
| `.active` | On screen and **interactive** | The user is using the app |
| `.inactive` | On screen, but **not** receiving events | Pulling down Control Center, the app switcher, an incoming call banner |
| `.background` | **Not visible** | The user went to the Home Screen or another app |

This replaces the older **`UIApplicationDelegate`** callbacks (`applicationDidBecomeActive`, `applicationDidEnterBackground`, …): instead of delegate methods, it's a **value** you watch with `.onChange(of:)` (25).

Read at the **`App`** level, `scenePhase` combines **all** windows (the app is `.active` if **any** window is). Read inside a **view**, it describes **that view's window**, which matters on iPad and Mac with several windows.

You can still have an app delegate for things that need one (push notification registration, 50.3), with **`@UIApplicationDelegateAdaptor`**:

```swift
@main
struct RecipeApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    var body: some Scene { WindowGroup { ContentView() } }
}
```

---

## 49.2 Responding to Background and Foreground 🟢

**Going to the background** is the moment to **save** and **stop** things. **Coming back** is the moment to **refresh**:

```swift
struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.modelContext) private var modelContext

    var body: some View {
        RecipeListView()
            .onChange(of: scenePhase) { _, newPhase in
                switch newPhase {
                case .background:
                    try? modelContext.save()          // write now (41.5)
                    stopLocationUpdates()             // don't drain the battery
                case .active:
                    Task { await refreshIfStale() }   // data may be old after hours away
                default:
                    break
                }
            }
    }
}
```

Why save **explicitly** when SwiftData autosaves? Because after going to the background, the app may be **suspended** and then **terminated** by the system to free memory, **without any further warning**. Saving now guarantees nothing is lost; autosave **timing** isn't guaranteed.

What to do on each transition:

| Going to `.background` | Coming back to `.active` |
|---|---|
| Save unsaved changes and drafts | Refresh data that may be stale |
| Stop location, timers, animations | Restart what you stopped |
| Pause media (unless it's an audio app) | Check if the user's login is still valid |
| Hide sensitive content (banking apps blur the screen) | |

You get only a **few seconds** after backgrounding. For longer work, use a background task (49.10–49.12).

---

## 49.3 Info.plist and Capabilities 🟢

**`Info.plist`** is the app's main **configuration** file: its name, version, supported orientations, required device features, and more. In Xcode you edit it in the target's **Info** tab. **Capabilities** (Push Notifications, iCloud, HealthKit…) are added in **Signing & Capabilities**.

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>
<key>NSLocationWhenInUseUsageDescription</key>
<string>We use your location to find recipes with ingredients from nearby stores.</string>
<key>NSCameraUsageDescription</key>
<string>Take photos of your dishes to add them to your recipes.</string>
```

The **`NS…UsageDescription`** keys are the **explanations** shown in the system **permission prompt** ("RecipeApp would like to access your camera. *Take photos of your dishes…*").

⚠️ If your app asks for a protected resource (camera, location, contacts, photos, microphone…) **without** the matching usage description, the app **crashes immediately**. It's not just a missing message.

Write descriptions that say **why** the user benefits. "Needed for the app" is vague, and App Review may reject it.

Since 2024, apps also need a **privacy manifest** (`PrivacyInfo.xcprivacy`): a file that lists the data you collect and the reasons you use certain **"required reason" APIs** (like `UserDefaults` or file timestamps). Third-party SDKs ship their own.

---

## 49.4 Entitlements Explained 🟡

**Entitlements** are **permissions** built into the app's **code signature**. They unlock **sensitive** system features: App Groups, push notifications, iCloud, Keychain sharing, Associated Domains, HealthKit, and others. Xcode keeps them in a **`.entitlements`** file, and adds entries when you add a capability:

```xml
<!-- RecipeApp.entitlements -->
<key>com.apple.security.application-groups</key>
<array>
    <string>group.com.example.myapp</string>
</array>
<key>aps-environment</key>
<string>development</string>
<key>com.apple.developer.associated-domains</key>
<array>
    <string>applinks:example.com</string>
</array>
```

| | `Info.plist` | Entitlements |
|---|---|---|
| What | General **configuration** | **Permission** to use protected features |
| Protected by | Nothing special | The **code signature** + the **provisioning profile** |
| Examples | App name, orientations, usage descriptions | App Groups, push, iCloud, Associated Domains |

Entitlements are much **stronger** than a config value. They're **signed** into the app, and each must also be **allowed** by your **provisioning profile** (from your Apple Developer account, 77). Someone can't just edit the file to give an app new powers: changing an entitlement breaks the **signature**, and the app won't run.

The **App Group** entitlement above is what makes the shared stores from 41.20 and 43.2 work. Without it, `UserDefaults(suiteName:)` and the group container just don't work.

---

## 49.5 Custom URL Schemes 🟢

A **custom URL scheme** like `myapp://` lets other apps, websites, or the system **open your app** with a URL. Register it in `Info.plist` (or the Info tab's **URL Types**), and handle it with **`.onOpenURL`**:

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array><string>myapp</string></array>
    </dict>
</array>
```

```swift
WindowGroup {
    ContentView()
}
.onOpenURL { url in
    // myapp://recipe/42
    guard url.scheme == "myapp", url.host == "recipe",
          let recipeID = url.pathComponents.dropFirst().first else { return }
    router.showRecipe(id: recipeID)
}
```

URL schemes are **easy**, but have real **weaknesses**:

- **No ownership.** Any app can register `myapp://`. If two do, which one opens is **unpredictable**. A malicious app could even **pretend** to be yours to catch links meant for you.
- **Nothing happens** if the app isn't installed: the link just fails.
- They don't work as **normal web links** in messages and emails.

That's why **universal links** (49.6) are the recommended way to deep link. Custom schemes are still fine for narrow uses: an OAuth callback (40.16), or links between your **own** apps.

⚠️ **Any** app or web page can open your URL, with **any** content. Treat URL input as **untrusted**: validate it, and never let a link perform a destructive action (like "delete account") without the user confirming.

---

## 49.6 Universal Links and apple-app-site-association 🟡

A **universal link** is a **normal `https://` URL** that opens **your app** (if installed) instead of the browser. If the app **isn't** installed, the same link opens the **website**.

Two pieces prove that your app **owns** the domain:

**1. The app** lists the domain in the **Associated Domains** entitlement (49.4): `applinks:example.com`.

**2. The website** hosts a JSON file at **`https://example.com/.well-known/apple-app-site-association`**:

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["TEAMID.com.example.myapp"],
        "components": [
          { "/": "/recipes/*", "comment": "Recipe pages open in the app" },
          { "/": "/account/*", "exclude": true, "comment": "These stay on the web" }
        ]
      }
    ]
  }
}
```

The system downloads this file (through Apple's CDN) when the app is **installed** or **updated**, and checks that the domain **agrees** with the app.

Why this fixes the URL-scheme problems:

| | Custom scheme | Universal link |
|---|---|---|
| Who can claim it | **Any** app | Only an app the **domain owner** lists |
| App not installed | Link **fails** | Opens the **website** |
| Works as a normal web link (Messages, Mail, Safari) | ❌ | ✅ |
| Setup | Info.plist only | Entitlement + a file on your server |

Another app **can't** claim your links, because it would need to control **your domain** to put itself in that file.

Common setup problems: the file must be served over **HTTPS**, **without redirects**, as `application/json`, with the **exact** Team ID and bundle ID. Apple's CDN caches it, so changes can take time to apply.

---

## 49.7 Handling Incoming Links and Routing 🟡

Both custom schemes and universal links arrive in SwiftUI through **`.onOpenURL`**. The clean way to handle them: **parse** the URL into a **route**, and push it onto the **same** navigation path that normal taps use (27.3, 27.4):

```swift
enum RecipeRoute: Hashable {
    case detail(UUID)
    case category(String)
}

@Observable
final class AppRouter {
    var path = NavigationPath()

    func handle(url: URL) {
        // https://example.com/recipes/<uuid>   or   myapp://recipes/<uuid>
        let parts = url.pathComponents.filter { $0 != "/" }
        guard let route = route(from: parts) else { return }
        path = NavigationPath()          // start from the root, so "back" makes sense
        path.append(route)
    }

    private func route(from parts: [String]) -> RecipeRoute? {
        switch parts.first {
        case "recipes":
            guard parts.count >= 2, let id = UUID(uuidString: parts[1]) else { return nil }
            return .detail(id)
        case "categories":
            return parts.count >= 2 ? .category(parts[1]) : nil
        default:
            return nil
        }
    }
}

// In the app:
// NavigationStack(path: $router.path) { ... }
//     .onOpenURL { router.handle(url: $0) }
```

Why share **one** navigation system?

- The detail screen **doesn't care** how it was reached: a tap, a link, a notification (50), or Spotlight (49.14). Each just **appends a route**.
- There's **one** place to fix navigation bugs, not two.
- Parsing can be **unit tested** (65): "this URL gives this route".

---

## 49.8 NSUserActivity and Handoff 🟡

**`NSUserActivity`** describes "**what the user is doing right now**". With **Handoff**, the user can start something on one device and **continue** on another: view a recipe on iPhone, then open the **same** recipe on the Mac.

**Publish** the activity from the view that represents it:

```swift
struct RecipeDetailView: View {
    let recipe: Recipe

    var body: some View {
        RecipeContent(recipe: recipe)
            .userActivity("com.example.myapp.viewing-recipe") { activity in
                activity.title = "Viewing \(recipe.title)"
                activity.userInfo = ["recipeID": recipe.id.uuidString]
                activity.isEligibleForHandoff = true
            }
    }
}
```

**Receive** it on the other device:

```swift
ContentView()
    .onContinueUserActivity("com.example.myapp.viewing-recipe") { activity in
        if let idString = activity.userInfo?["recipeID"] as? String,
           let id = UUID(uuidString: idString) {
            router.path.append(RecipeRoute.detail(id))     // the same routing as deep links (49.7)
        }
    }
```

Also list the activity type in **Info.plist** under **`NSUserActivityTypes`**.

How it feels to the user: while the recipe is open on the iPhone, a **Handoff icon** of your app appears on the Mac's Dock (or the iPad's app switcher). Clicking it opens your app **at that recipe**.

Requirements: the same **Apple Account** on both devices, Bluetooth and Wi-Fi on, Handoff enabled, and your app installed on both. Keep `userInfo` **small** (IDs, not whole objects); the receiving device loads the data itself.

`NSUserActivity` also powers **Spotlight** results (49.14) and **Siri suggestions**, so publishing activities pays off in several places.

---

## 49.9 State Restoration 🟡

When the system **terminates** a backgrounded app (to free memory) and the user returns later, the app **relaunches**. Without **state restoration**, it starts at the **root** screen, and the user loses their place. With it, the app **reopens where they left off**.

This is **different** from data persistence (41): SwiftData saves the **data** (the recipes); state restoration saves the **UI state** (which recipe was open, which tab, the scroll position, a half-typed search).

**`@SceneStorage`** (25.10) is the tool. A navigation path can be saved thanks to **`NavigationPath.CodableRepresentation`**:

```swift
struct RootView: View {
    @SceneStorage("navigationPath") private var pathData: Data?
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            RecipeListView()
                .navigationDestination(for: RecipeRoute.self) { route in RouteView(route: route) }
        }
        .task {
            // Restore once, when the scene appears
            if let pathData,
               let representation = try? JSONDecoder().decode(NavigationPath.CodableRepresentation.self, from: pathData) {
                path = NavigationPath(representation)
            }
        }
        .onChange(of: path) { _, newPath in
            // Save on every change (only works if every value in the path is Codable)
            if let representation = newPath.codable {
                pathData = try? JSONEncoder().encode(representation)
            }
        }
    }
}
```

Notes:

- `@SceneStorage` must be used inside a **`View`** (not the `App` struct), because it's tied to **one scene** (window).
- **`NavigationPath.codable`** is **optional**: it's `nil` if any value in the path isn't `Codable`. Make your route types `Codable` (another reason to use small route enums with IDs, 27.4).
- Scene storage is **discarded** when the user **closes** the scene on purpose (swiping the app away in the app switcher). It's for **system**-caused relaunches, which is exactly when restoring makes sense.

---

## 49.10 BGAppRefreshTask 🟡

**`BGAppRefreshTask`** asks the system for **short** chances to run in the **background**, to **refresh content** (fetch the latest recipes) so the app is up to date when the user opens it.

Setup:

1. **Signing & Capabilities → Background Modes → Background fetch**.
2. Add your task ID to **Info.plist** under **`BGTaskSchedulerPermittedIdentifiers`**.
3. **Handle** the task and **schedule** it.

The SwiftUI way (iOS 16+):

```swift
@main
struct RecipeApp: App {
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup { ContentView() }
            .onChange(of: scenePhase) { _, phase in
                if phase == .background { scheduleAppRefresh() }
            }
            .backgroundTask(.appRefresh("com.example.myapp.refresh")) {
                scheduleAppRefresh()                 // ask for the NEXT refresh first
                await refreshRecipeData()            // the task is cancelled if time runs out
            }
    }
}

func scheduleAppRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.example.myapp.refresh")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)   // "not before 15 minutes from now"
    try? BGTaskScheduler.shared.submit(request)
}
```

The classic UIKit way registers a handler at launch and uses an **`expirationHandler`**:

```swift
BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.example.myapp.refresh", using: nil) { task in
    let work = Task {
        await refreshRecipeData()
        task.setTaskCompleted(success: !Task.isCancelled)
    }
    task.expirationHandler = { work.cancel() }     // time's up: stop NOW
    scheduleAppRefresh()
}
```

Important facts:

- **`earliestBeginDate`** is only "**not before**". The **system** decides **when** (and **whether**) it runs, based on battery, network, and **how often the user opens the app**. It may be hours later, or never.
- The time budget is **short** (around 30 seconds). When it runs out, the **expiration handler** fires. If you don't stop and call `setTaskCompleted`, the system **kills** the app and gives it **fewer** chances in the future.
- Test with the debugger: pause, then `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.example.myapp.refresh"]`.

---

## 49.11 BGProcessingTask 🟡

**`BGProcessingTask`** is for **longer**, **heavier** background work that **isn't urgent**: rebuilding a search index, cleaning up a database, training an on-device model, uploading analytics in bulk.

```swift
func scheduleProcessingTask() {
    let request = BGProcessingTaskRequest(identifier: "com.example.myapp.cleanup")
    request.requiresNetworkConnectivity = true     // only when online
    request.requiresExternalPower = true           // only while charging
    try? BGTaskScheduler.shared.submit(request)
}

// Register the handler at launch, as in 49.10
BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.example.myapp.cleanup", using: nil) { task in
    let work = Task {
        await rebuildSearchIndex()
        task.setTaskCompleted(success: !Task.isCancelled)
    }
    task.expirationHandler = { work.cancel() }
}
```

SwiftUI's `.backgroundTask` modifier covers **app refresh** and **background URL session** events; processing tasks are registered with `BGTaskScheduler` directly, as above.

Setup: **Background Modes → Background processing**, and the ID in `BGTaskSchedulerPermittedIdentifiers`.

| | `BGAppRefreshTask` | `BGProcessingTask` |
|---|---|---|
| Length | Seconds | **Minutes** |
| When | Through the day | Usually when the device is **idle**, often **overnight while charging** |
| Conditions you can require | — | Network, external power |
| Use for | Fresh content | Heavy maintenance |

Setting **`requiresExternalPower`** makes the system much more willing to give you **long** run time, because it won't drain the user's battery. Always handle **expiration** (cancel cleanly) and make the work **resumable**: if it's stopped halfway, the next run should continue, not start over.

---

## 49.12 BGContinuedProcessingTask 🔴

**`BGContinuedProcessingTask`** (iOS 26) is for work the user **just started**, that should **keep going** if they **leave the app**: exporting a long video, uploading a big photo album, processing a large file.

```swift
// At launch: register the handler (the ID uses your bundle ID as a prefix)
BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.example.myapp.export.recipes",
                                using: nil) { task in
    guard let task = task as? BGContinuedProcessingTask else { return }
    let work = Task {
        task.progress.totalUnitCount = 100
        for step in 1...100 {
            guard !Task.isCancelled else { break }
            await exportChunk(step)
            task.progress.completedUnitCount = Int64(step)    // shown in the system UI
        }
        task.setTaskCompleted(success: !Task.isCancelled)
    }
    task.expirationHandler = { work.cancel() }
}

// When the user taps "Export"
func startLongRunningExport() {
    let request = BGContinuedProcessingTaskRequest(
        identifier: "com.example.myapp.export.recipes",
        title: "Exporting Recipes",
        subtitle: "Preparing your recipe book"
    )
    try? BGTaskScheduler.shared.submit(request)               // starts right away
}
```

| Task type | Starts | Typical use |
|---|---|---|
| `BGAppRefreshTask` | Later, when the **system** chooses | Fetch new content |
| `BGProcessingTask` | Later, often overnight while charging | Heavy maintenance |
| `BGContinuedProcessingTask` | **Now**, because the **user** asked | Finish an export or upload the user started |

The key difference: it's **user-initiated** and **immediate**. The system shows its **progress** in system UI while your app is in the background, and the user can **cancel** it there. That's why it needs a **title** and a real **progress** value: the user should always know what's running.

⚠️ This is a **new** API; check the current documentation for exact requirements (like the task ID format and Info.plist entries).

---

## 49.13 Background Execution Budgets and Throttling 🔴

All background time is **limited** and **controlled by the system**. There's no fixed, guaranteed amount. The system decides, based on things like:

- **How often the user opens your app.** An app used daily gets more chances than one opened once a month.
- **How your app behaved before.** Apps that finish quickly and call `setTaskCompleted` are treated better than apps that run out of time.
- **Device state**: battery level, Low Power Mode, network, temperature.
- **User settings**: Background App Refresh can be turned **off** (globally or per app).

Apple doesn't publish an exact formula, and it changes. So **design for little and unpredictable time**:

```swift
// Do the work in small, independent pieces, and stop as soon as you're told
task.expirationHandler = {
    currentWork?.cancel()            // nothing extra will be granted: stop NOW
}

for chunk in pendingChunks {
    if Task.isCancelled { break }    // check between pieces
    try await process(chunk)
    markDone(chunk)                  // progress is saved, so the next run continues from here
}
```

Rules for **good background citizens**:

1. **Never assume** a background task will run, or run at a certain time. The app must work **without** it.
2. Work in **small, resumable** pieces, saving progress as you go.
3. **Stop immediately** on expiration, and always call **`setTaskCompleted`**.
4. Prefer **silent pushes** (44.4) when the **server** knows something changed: more timely than guessing with refresh tasks.
5. For **big transfers**, use a **background `URLSession`** (40.8): the **system** does the transfer, without needing your app to run.

You can check whether the user allows it: `UIApplication.shared.backgroundRefreshStatus` (`.available`, `.denied`, `.restricted`).

---

## 49.14 Core Spotlight Indexing 🟡

**Core Spotlight** lets you add your app's **content** to the system **search**. Users swipe down on the Home Screen, type "carbonara", and see **your** recipe, even if they didn't open your app first.

```swift
import CoreSpotlight
import UniformTypeIdentifiers

func indexRecipe(_ recipe: Recipe) async throws {
    let attributes = CSSearchableItemAttributeSet(contentType: .content)
    attributes.title = recipe.title
    attributes.contentDescription = "Ready in \(recipe.minutesToCook) minutes"
    attributes.keywords = recipe.tags                       // extra search terms
    attributes.thumbnailData = recipe.thumbnailData

    let item = CSSearchableItem(
        uniqueIdentifier: recipe.id.uuidString,             // how you find it again
        domainIdentifier: "recipes",                        // a group, for bulk deletes
        attributeSet: attributes
    )
    try await CSSearchableIndex.default().indexSearchableItems([item])
}

// When a recipe is deleted, remove it from search too
func removeFromIndex(_ id: UUID) async throws {
    try await CSSearchableIndex.default().deleteSearchableItems(withIdentifiers: [id.uuidString])
}
```

When the user **taps** a result, your app opens with an **`NSUserActivity`** of type **`CSSearchableItemActionType`**: the same "continue an activity" mechanism as Handoff (49.8):

```swift
ContentView()
    .onContinueUserActivity(CSSearchableItemActionType) { activity in
        if let id = activity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
           let uuid = UUID(uuidString: id) {
            router.path.append(RecipeRoute.detail(uuid))     // same routing again (49.7)
        }
    }
```

Tips:

- **Keep the index in sync**: index on create and update, delete on delete. Stale results that open "not found" screens annoy users.
- Use a **`domainIdentifier`** so you can clear a whole group (for example, all items of a logged-out account).
- Don't index **private** content that shouldn't show up when someone else glances at the device's search.

It's a **discoverability** win for content-heavy apps: users jump **straight** to the item they want.

---

## 49.15 SharePlay and GroupActivities 🔴

**SharePlay** lets people do something **together, in real time**, during a **FaceTime** call (or other supported sessions): watch a video in sync, play a game, or **cook along** step by step. The **`GroupActivities`** framework powers it.

**1. Describe the activity.** It must be **`Codable`**, so keep it small (IDs, not big models):

```swift
import GroupActivities

struct CookAlongActivity: GroupActivity {
    static let activityIdentifier = "com.example.myapp.cook-along"
    let recipeID: UUID
    let recipeTitle: String

    var metadata: GroupActivityMetadata {
        var metadata = GroupActivityMetadata()
        metadata.title = "Cook \(recipeTitle) Together"
        metadata.type = .generic
        return metadata
    }
}
```

**2. Start it** (for example, from a "Cook Together" button during a call):

```swift
func startSharedCooking(recipe: Recipe) async {
    let activity = CookAlongActivity(recipeID: recipe.id, recipeTitle: recipe.title)
    if case .activationPreferred = await activity.prepareForActivation() {
        _ = try? await activity.activate()        // invites everyone on the call
    }
}
```

**3. Join sessions and keep everyone in sync**, by sending small **messages**:

```swift
struct StepChanged: Codable { let step: Int }

func observeSessions() async {
    for await session in CookAlongActivity.sessions() {      // each time a session starts
        let messenger = GroupSessionMessenger(session: session)
        session.join()

        Task {
            for await (message, _) in messenger.messages(of: StepChanged.self) {
                currentStep = message.step                    // someone moved to the next step
            }
        }
        // When THIS user advances: try await messenger.send(StepChanged(step: currentStep))
    }
}
```

| | SharePlay (`GroupActivities`) | CloudKit sharing (`CKShare`, 44.5) |
|---|---|---|
| Timing | **Live**, during a call | **Any time**, long-lived |
| Data | Small, temporary **messages** | **Stored** records |
| Example | Everyone sees step 4 **right now** | A shared recipe collection the family edits over weeks |

SharePlay is a **specialized** feature: great when an activity is naturally **shared in the moment**, not needed for most apps.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| App lifecycle | `App` protocol, `@Environment(\.scenePhase)` | Active, inactive, background as a value |
| Background/foreground response | `.onChange(of: scenePhase)` | Save and stop when leaving; refresh when back |
| App configuration | `Info.plist`, `NS…UsageDescription`, privacy manifest | Settings, permission texts (or a crash), data use |
| Signed capability grants | Entitlements | Signed permissions for protected features |
| Simple deep linking | Custom URL schemes, `.onOpenURL()` | Easy, but anyone can claim them; validate input |
| Robust deep linking | Universal links, `apple-app-site-association` | Domain-verified links with a web fallback |
| Unified link handling | Parse URLs into routes on `NavigationPath` | One navigation system for everything |
| Cross-device continuity | `.userActivity()`, `.onContinueUserActivity()` | Handoff between the user's devices |
| UI state persistence | `@SceneStorage`, `NavigationPath.CodableRepresentation` | Reopen where the user left off |
| Periodic background refresh | `BGAppRefreshTask`, `.backgroundTask` | Short, system-timed refreshes |
| Long-running background work | `BGProcessingTask` | Heavy work, often while charging |
| User-initiated continuity | `BGContinuedProcessingTask` | Finish what the user started, with visible progress |
| Resource discipline | Background budgets | Small, resumable work; stop on expiration |
| System-wide search | Core Spotlight, `CSSearchableItem` | Your content in Spotlight; keep the index in sync |
| Real-time shared experiences | `GroupActivities`, SharePlay | Live shared activities during FaceTime |
