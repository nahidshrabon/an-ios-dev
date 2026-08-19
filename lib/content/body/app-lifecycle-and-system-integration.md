## 49.1 The SwiftUI App Protocol and Scene Phases

The `App` protocol is the modern, SwiftUI-native entry point (replacing `UIApplicationDelegate`/`UISceneDelegate` as the primary structure for simple apps), and `@Environment(\.scenePhase)` exposes the app's current lifecycle phase — `.active`, `.inactive`, or `.background`.

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
            case .active: print("App became active")
            case .inactive: print("App became inactive (e.g., transitioning, or Control Center open)")
            case .background: print("App entered background")
            @unknown default: break
            }
        }
    }
}
```

`.active` means the app is in the foreground and receiving events normally; `.inactive` is a brief transitional state (also entered when the app is technically visible but not receiving events, like when Control Center is pulled down over it); `.background` means the app is no longer visible at all. This three-phase model is the SwiftUI-native equivalent of the older `UIApplicationDelegate` lifecycle methods (`applicationDidBecomeActive`, `applicationDidEnterBackground`, etc.), expressed as observable state rather than delegate callbacks — directly usable with `.onChange(of:)` (section 25) rather than requiring a separate delegate object.

---

## 49.2 Responding to Background and Foreground

Transitioning to `.background` is the natural point to save any pending state and release resources that shouldn't remain active while the app isn't visible; transitioning back to `.active` is the natural point to refresh potentially-stale data.

```swift
.onChange(of: scenePhase) { _, newPhase in
    switch newPhase {
    case .background:
        try? modelContext.save() // recall modelContext.save(), section 41.5
        stopLocationUpdates()
    case .active:
        Task { await refreshIfStale() }
    default:
        break
    }
}
```

This pairs naturally with earlier persistence material — explicitly saving pending SwiftData changes (section 41.5) on backgrounding provides a stronger guarantee than relying purely on autosave timing, since the app could be terminated by the system shortly after backgrounding with no further warning. Stopping expensive ongoing work (location updates, active network connections) on backgrounding, and refreshing potentially-stale data on returning to `.active`, are both standard, expected behaviors for a well-behaved app that respects the system's resource constraints on background apps.

---

## 49.3 Info.plist and Capabilities

`Info.plist` is the app's central configuration file, declaring metadata (display name, supported orientations, required device capabilities) and, in Xcode's Signing & Capabilities tab, enabling specific system capabilities (Push Notifications, HealthKit, CloudKit, and dozens more) that the app is permitted to use.

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
</array>
<key>NSLocationWhenInUseUsageDescription</key>
<string>We use your location to find nearby recipe ingredients.</string>
```

Beyond simple configuration values, `Info.plist` is also where usage description strings (`NSLocationWhenInUseUsageDescription` and similar `NS*UsageDescription` keys) live — these are the human-readable explanations shown to the user in the system permission prompt when the app first requests access to a protected resource (location, camera, contacts, and so on), and omitting a required usage description string for a capability the app actually uses causes an immediate crash the moment that capability is requested, rather than merely a missing prompt.

---

## 49.4 Entitlements Explained

Entitlements are a separate, cryptographically-signed configuration file (`.entitlements`) declaring which special system capabilities an app's code-signed binary is authorized to use — distinct from `Info.plist`'s more general configuration, entitlements specifically gate access to sensitive system capabilities like App Groups, Push Notifications, and CloudKit.

```xml
<!-- RecipeApp.entitlements -->
<key>com.apple.security.application-groups</key>
<array>
    <string>group.com.example.myapp</string>
</array>
<key>aps-environment</key>
<string>development</string>
```

Entitlements are checked and enforced at a deeper system level than `Info.plist` configuration — they're embedded into the app's code signature itself, meaning tampering with an entitlement without proper re-signing (by someone without the appropriate developer credentials) would invalidate the app's signature entirely, a meaningfully stronger security boundary than a plain configuration file provides. The App Group entitlement shown here is exactly the mechanism underlying the shared storage scenarios covered in sections 41.20 and 43.2 — declaring the entitlement is the prerequisite step that makes those shared-container APIs actually usable.

---

## 49.5 Custom URL Schemes

A custom URL scheme (`myapp://`) lets other apps (or the system) open your app directly via a specially-crafted URL, registered in `Info.plist`'s `CFBundleURLTypes` and handled via `.onOpenURL()`.

```swift
WindowGroup {
    ContentView()
}
.onOpenURL { url in
    // url might be: myapp://recipe/42
    guard url.scheme == "myapp", url.host == "recipe" else { return }
    let recipeID = url.pathComponents.dropFirst().first
    // navigate to the specific recipe
}
```

Custom URL schemes are simple to set up but have a real weakness: scheme names aren't globally unique or reserved in any enforced way, meaning two different apps could both register the same `myapp://` scheme, leading to unpredictable behavior about which app actually opens when a link is tapped — this exact limitation is what universal links (49.6) were introduced to solve, and is why universal links are generally the recommended, more robust approach for genuine deep linking in modern apps, with custom schemes better reserved for narrower, less collision-prone use cases like inter-app communication between an organization's own suite of apps.

---

## 49.6 Universal Links and apple-app-site-association

A universal link is an ordinary `https://` URL that, when tapped, opens directly in your app (if installed) instead of a web browser — verified via a JSON file (`apple-app-site-association`) hosted at your domain's root, cryptographically proving your app is authorized to handle links for that specific domain.

```json
// Hosted at: https://example.com/.well-known/apple-app-site-association
{
    "applinks": {
        "details": [
            {
                "appID": "TEAMID.com.example.myapp",
                "paths": ["/recipes/*"]
            }
        ]
    }
}
```

Because the association file must be hosted at the actual domain being claimed (and iOS verifies it directly against that domain at install time), universal links avoid the scheme-collision problem entirely — no other app can claim to handle links for `example.com` without actually controlling that domain, a meaningfully stronger guarantee than a custom URL scheme provides. This is also why universal links work seamlessly as a fallback: the exact same URL works whether or not the app is installed (opening the app if it is, falling back to the actual website if it isn't), unlike a custom scheme URL, which simply fails to do anything if the target app isn't present.

---

## 49.7 Handling Incoming Links and Routing

Both custom URL schemes and universal links are received through the same `.onOpenURL()` modifier, and a well-designed app routes the parsed URL into its existing navigation system (recall value-based navigation, section 27.2, and `NavigationPath`, section 27.3) rather than treating link handling as an entirely separate code path.

```swift
@Observable
final class AppRouter {
    var path = NavigationPath()

    func handle(url: URL) {
        guard url.pathComponents.count >= 3, url.pathComponents[1] == "recipes" else { return }
        if let recipeID = UUID(uuidString: url.pathComponents[2]) {
            path.append(RecipeRoute.detail(recipeID))
        }
    }
}

// .onOpenURL { router.handle(url: $0) }
```

Feeding parsed deep link destinations directly into the same `NavigationPath`-based routing infrastructure used for ordinary in-app navigation (rather than maintaining separate logic for "how a user gets to the recipe detail screen via tapping" versus "how a user gets there via a deep link") keeps the app's navigation genuinely unified — the recipe detail screen doesn't need to know or care whether it was reached through normal navigation or an incoming link, since both paths ultimately just append the same value to the same `NavigationPath`.

---

## 49.8 NSUserActivity and Handoff

`NSUserActivity` represents "what the user is currently doing" in a way the system can track and hand off between the user's devices — Handoff lets a user start viewing a recipe on their iPhone and seamlessly continue on their Mac or iPad, picking up in the same context.

```swift
struct RecipeDetailView: View {
    let recipe: Recipe

    var body: some View {
        Text(recipe.title)
            .userActivity("com.example.myapp.viewing-recipe") { activity in
                activity.title = "Viewing \(recipe.title)"
                activity.userInfo = ["recipeID": recipe.id.uuidString]
                activity.isEligibleForHandoff = true
            }
    }
}
```

`.userActivity()` (a SwiftUI modifier) automatically creates and updates an `NSUserActivity` reflecting whatever this view currently represents, publishing it as the "current activity" while the view is active — a second device signed into the same Apple ID that sees this published activity can display a Handoff prompt (typically an icon near the Home Screen/Dock), and tapping it launches (or activates) the app on that device with the activity's `userInfo` available to restore the exact same context, effectively continuing the same task across devices.

---

## 49.9 State Restoration

State restoration lets an app recreate its exact UI state (which screens were open, scroll position, form field contents) after being terminated by the system and later relaunched — distinct from ordinary data persistence (SwiftData, section 41), which preserves the underlying *data* but not necessarily the specific *navigation/UI state* the user was in.

```swift
@main
struct RecipeApp: App {
    @SceneStorage("navigationPath") private var pathData: Data?
    @State private var path = NavigationPath()

    var body: some Scene {
        WindowGroup {
            NavigationStack(path: $path) {
                RecipeListView()
            }
            .onChange(of: path) { _, newPath in
                pathData = try? JSONEncoder().encode(newPath.codable)
            }
            .task {
                if let pathData, let codable = try? JSONDecoder().decode(NavigationPath.CodableRepresentation.self, from: pathData) {
                    path = NavigationPath(codable)
                }
            }
        }
    }
}
```

`@SceneStorage` persists small amounts of UI-specific state tied to a specific scene, surviving app termination and relaunch (though not a full device restart in all configurations) — `NavigationPath.CodableRepresentation` specifically exists to make a navigation path itself serializable (since the path may contain arbitrary navigable values), letting an app restore not just its data but the user's exact place within the navigation hierarchy, producing the polished, expected experience of the app reopening exactly where the user left off rather than always restarting at the root screen.

---

## 49.10 BGAppRefreshTask

`BGAppRefreshTask` schedules brief, periodic background execution opportunities for refreshing app content (like fetching new data) even when the app isn't actively running — the system decides the actual timing based on device conditions (battery, usage patterns), treating the requested time as a preference rather than a guarantee.

```swift
func scheduleAppRefresh() {
    let request = BGAppRefreshTaskRequest(identifier: "com.example.myapp.refresh")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
    try? BGTaskScheduler.shared.submit(request)
}

func handleAppRefresh(task: BGAppRefreshTask) {
    task.expirationHandler = { /* clean up if running out of time */ }
    Task {
        await refreshRecipeData()
        task.setTaskCompleted(success: true)
        scheduleAppRefresh() // reschedule the next refresh opportunity
    }
}
```

`earliestBeginDate` communicates the earliest the app would like this refresh to run, but the actual scheduling decision is entirely up to the system, which balances the request against battery level, network conditions, and the user's actual app usage patterns — an app that's rarely opened gets background refresh opportunities far less frequently than one used constantly, and the `expirationHandler` closure is essential since the system imposes a strict, short time budget on this kind of task and will terminate it abruptly if it runs over, making cleanup-on-expiration a genuine requirement rather than an edge case.

---

## 49.11 BGProcessingTask

`BGProcessingTask` is the counterpart for longer-running, more resource-intensive background work (like a large database migration or extensive data cleanup) that doesn't need to complete quickly, but can require more time and system resources than `BGAppRefreshTask`'s brief refresh window allows.

```swift
func scheduleProcessingTask() {
    let request = BGProcessingTaskRequest(identifier: "com.example.myapp.processing")
    request.requiresNetworkConnectivity = true
    request.requiresExternalPower = true
    try? BGTaskScheduler.shared.submit(request)
}
```

`requiresExternalPower` and `requiresNetworkConnectivity` let the app express real resource requirements the system will actually honor when deciding when to grant this task execution time — the system is considerably more willing to allocate a longer processing window when the device is plugged in and idle (like overnight while charging) than during active, battery-powered use, which is precisely the scenario `BGProcessingTask` is designed for: work that's genuinely more resource-hungry than a quick refresh, but not urgent enough to need to happen immediately or during active app use.

---

## 49.12 BGContinuedProcessingTask 🟠

`BGContinuedProcessingTask` (a more recent addition) is designed for background work that begins while the app is actively in use and needs to continue running to completion even after the user backgrounds the app — bridging the gap between purely foreground work and the scheduled, system-timed work of `BGAppRefreshTask`/`BGProcessingTask`.

```swift
func startLongRunningExport() {
    let request = BGContinuedProcessingTaskRequest(
        identifier: "com.example.myapp.export",
        title: "Exporting Recipes"
    )
    // Unlike scheduled tasks, this begins essentially immediately upon
    // submission, continuing even if the user backgrounds the app mid-export
    try? BGTaskScheduler.shared.submit(request)
}
```

The key distinguishing use case is a task the user has *just now* explicitly initiated (like exporting a large recipe collection) that shouldn't be interrupted just because the user happens to switch to another app while it's running — unlike `BGAppRefreshTask`/`BGProcessingTask`, which are scheduled for some future, system-determined time, `BGContinuedProcessingTask` begins immediately and simply ensures continuity of already-started work across a foreground-to-background transition, complete with system UI (a progress indicator) showing the task's ongoing status even while the initiating app isn't in the foreground.

---

## 49.13 Background Execution Budgets and Throttling 🟠

All forms of background execution are subject to strict, system-enforced time and resource budgets — an app that consistently requests more background time than it's granted, or that's used infrequently by the user, gets progressively throttled, receiving fewer and shorter background execution opportunities over time.

```swift
// Defensive practice: always check remaining time and respond
// gracefully to the expiration handler, rather than assuming
// a fixed, guaranteed amount of execution time
task.expirationHandler = {
    // Cancel in-flight work cleanly; anything not completed
    // by this point will simply not run — no guaranteed extension
    currentWorkTask?.cancel()
}
```

The system's throttling behavior is deliberately opaque and adaptive — Apple doesn't publish an exact formula, but the practical, well-established guidance is that background execution is a privilege the system grants based on factors like how often the user actually opens the app, how much background time has been requested and used historically, and overall device conditions, not an unconditional right an app can rely on for consistent background work. Designing background tasks to be resilient to unpredictable, sometimes minimal execution time (always handling `expirationHandler`, always checking whether there's genuinely enough time left before starting a new unit of work) is essential for building features that degrade gracefully rather than failing unpredictably when the system grants less time than hoped for.

---

## 49.14 Core Spotlight Indexing

Core Spotlight lets an app index its own content (individual recipes, for instance) so that content becomes searchable directly from the system-wide Spotlight search, without the user needing to open the app first.

```swift
import CoreSpotlight

func indexRecipe(_ recipe: Recipe) {
    let attributeSet = CSSearchableItemAttributeSet(contentType: .text)
    attributeSet.title = recipe.title
    attributeSet.contentDescription = "Cook time: \(recipe.minutesToCook) minutes"

    let item = CSSearchableItem(
        uniqueIdentifier: recipe.id.uuidString,
        domainIdentifier: "recipes",
        attributeSet: attributeSet
    )
    CSSearchableIndex.default().indexSearchableItems([item])
}
```

Indexed items appear directly in system-wide Spotlight search results (accessed via a swipe-down gesture on the Home Screen), and tapping a matching result launches the app with that specific item's `uniqueIdentifier` available (typically via `NSUserActivity`, connecting back to 49.8's Handoff mechanism, since Spotlight results actually use the same underlying continuation infrastructure) — letting users search for and jump directly into specific app content without first navigating the app's own internal search or browsing UI, a meaningful discoverability win for content-heavy apps.

---

## 49.15 SharePlay and GroupActivities 🟠

`GroupActivities` powers SharePlay — a framework for building genuinely synchronized, shared experiences (watching content together, playing a game together, cooking along together) across multiple people's devices during a FaceTime call or other supported session.

```swift
import GroupActivities

struct CookAlongActivity: GroupActivity {
    let recipe: Recipe

    var metadata: GroupActivityMetadata {
        var metadata = GroupActivityMetadata()
        metadata.title = "Cooking \(recipe.title) Together"
        metadata.type = .generic
        return metadata
    }
}

func startSharedCooking(recipe: Recipe) async {
    let activity = CookAlongActivity(recipe: recipe)
    do {
        _ = try await activity.activate()
    } catch { /* handle failure to activate */ }
}
```

Activating a `GroupActivity` during an active FaceTime call prompts other participants to join the same shared session, after which the app can use a `GroupSession` to keep all participants' state synchronized (e.g., everyone's recipe view automatically advancing to the same step together) — this is a genuinely specialized, collaborative real-time framework, distinct from CloudKit's `CKShare` (section 44.5), which handles asynchronous, longer-lived data sharing rather than SharePlay's synchronous, session-based, in-the-moment shared activity model.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| App lifecycle | `App` protocol, `@Environment(\.scenePhase)` | Modern, observable lifecycle state |
| Background/foreground response | `.onChange(of: scenePhase)` | Save state, release resources, refresh data |
| App configuration | `Info.plist`, usage description strings | Metadata and permission prompt text |
| Signed capability grants | Entitlements (`.entitlements`) | Cryptographically-enforced access to sensitive capabilities |
| Simple deep linking | Custom URL schemes, `.onOpenURL()` | Collision-prone but simple app-to-app links |
| Robust deep linking | Universal links, `apple-app-site-association` | Domain-verified, browser-fallback-capable links |
| Unified link handling | Route parsed URLs into `NavigationPath` | One navigation system for taps and links alike |
| Cross-device continuity | `NSUserActivity`, `.userActivity()` | Handoff between a user's devices |
| UI state persistence | `@SceneStorage`, `NavigationPath.CodableRepresentation` | Restore exact navigation state after relaunch |
| Periodic background refresh | `BGAppRefreshTask` | Brief, system-timed content refresh |
| Long-running background work | `BGProcessingTask` | Resource-intensive work under favorable conditions |
| User-initiated continuity | `BGContinuedProcessingTask` | Continue already-started work across backgrounding |
| Resource discipline | Background execution budgets | Design for unpredictable, throttled execution time |
| System-wide search | Core Spotlight, `CSSearchableItem` | Index app content into Spotlight search |
| Real-time shared experiences | `GroupActivities`, SharePlay | Synchronized multi-device sessions during FaceTime |
