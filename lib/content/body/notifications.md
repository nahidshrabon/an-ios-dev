## 50.1 Requesting Notification Permission

Before an app can schedule local notifications or receive remote push, it must request explicit user permission via `UNUserNotificationCenter`, specifying exactly which notification capabilities (alerts, sounds, badges) it's asking to use.

```swift
import UserNotifications

func requestNotificationPermission() async throws -> Bool {
    let center = UNUserNotificationCenter.current()
    return try await center.requestAuthorization(options: [.alert, .sound, .badge])
}
```

This is an `async` API (directly applying structured concurrency, Part 2), returning a `Bool` indicating whether the user granted permission — critically, this prompt can only be shown to the user once per app installation; if denied, the app cannot re-prompt programmatically and must instead direct the user to the Settings app to manually re-enable permission, making the timing and framing of this first request (asking at a moment when the value is genuinely clear to the user, rather than immediately at first launch) a meaningful UX decision.

---

## 50.2 Local Notifications and Triggers

A local notification is scheduled entirely on-device (no server or push infrastructure involved) and fires based on a trigger — a specific time, a time interval, or a location — making it well suited for reminders, timers, and other content the app itself already knows about in advance.

```swift
func scheduleReminderNotification(recipe: Recipe, at date: Date) {
    let content = UNMutableNotificationContent()
    content.title = "Time to cook!"
    content.body = "\(recipe.title) — don't forget the timer"
    content.sound = .default

    let trigger = UNCalendarNotificationTrigger(
        dateMatching: Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date),
        repeats: false
    )
    let request = UNNotificationRequest(identifier: recipe.id.uuidString, content: content, trigger: trigger)
    UNUserNotificationCenter.current().add(request)
}
```

`UNCalendarNotificationTrigger` fires at a specific calendar date/time (useful for "remind me at 6pm"); `UNTimeIntervalNotificationTrigger` fires after a relative delay from now (useful for "remind me in 30 minutes"); `UNLocationNotificationTrigger` fires based on entering/leaving a geographic region. Using a stable, meaningful `identifier` (like the recipe's own ID, as shown) rather than a random one makes it possible to later find and cancel a specific pending notification (via `removePendingNotificationRequests(withIdentifiers:)`) if, for instance, the user deletes the recipe the reminder was for.

---

## 50.3 Notification Categories and Actions

A notification category groups related notifications and defines a set of interactive actions (buttons) the user can trigger directly from the notification itself, without needing to fully open the app.

```swift
let markCookedAction = UNNotificationAction(
    identifier: "MARK_COOKED",
    title: "Mark as Cooked",
    options: []
)
let snoozeAction = UNNotificationAction(
    identifier: "SNOOZE",
    title: "Snooze 10 min",
    options: []
)
let category = UNNotificationCategory(
    identifier: "RECIPE_REMINDER",
    actions: [markCookedAction, snoozeAction],
    intentIdentifiers: [],
    options: []
)
UNUserNotificationCenter.current().setNotificationCategories([category])

// Content must reference the category for its actions to appear:
content.categoryIdentifier = "RECIPE_REMINDER"
```

Registered categories must be set once (typically at app launch) via `setNotificationCategories()`, and any notification content wanting to display that category's actions sets its own `categoryIdentifier` to match — tapping an action (handled in the delegate, covered in 50.6) lets the user take a meaningful action (like marking a recipe cooked, or snoozing the reminder) directly from the notification banner or lock screen, without the friction of fully launching and navigating the app first.

---

## 50.4 APNs Overview and Token vs. Certificate Auth

Apple Push Notification service (APNs) is the infrastructure that delivers remote (server-sent) push notifications to devices — a server wanting to send a push must authenticate to APNs using either token-based auth (a signed JWT, generated from a private key) or the older, largely-deprecated certificate-based auth (a per-app SSL certificate).

```plaintext
Token-based auth (modern, recommended):
- One private key (a .p8 file) can authenticate pushes for ALL of a
  developer's apps, and never expires — generate a fresh signed JWT
  per request using this key

Certificate-based auth (legacy):
- A separate certificate per app, per environment (dev/production),
  that expires annually and must be manually renewed and re-uploaded
```

Token-based authentication is the clearly preferred modern approach — a single `.p8` private key works across every app a developer has, never itself expires (unlike a certificate, which must be renewed roughly annually or push delivery silently breaks), and is simpler to manage in automated server infrastructure since generating a fresh signed JWT per request is a standard, well-supported cryptographic operation across most server-side platforms and languages, without any per-app or per-environment certificate management overhead.

---

## 50.5 Registering for Remote Notifications

Before a device can receive remote push, the app must register with APNs (via `UIApplication.shared.registerForRemoteNotifications()`) and relay the resulting device token to your own backend server, which uses that token to actually address push requests to this specific device.

```swift
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UIApplication.shared.registerForRemoteNotifications()
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        Task { try? await uploadDeviceToken(tokenString) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("Push registration failed: \(error)")
    }
}
```

The device token is not a permanent, unchanging identifier — it can change (app reinstall, device restore, and occasionally without any obvious trigger at all), meaning a well-behaved app re-registers and re-uploads the current token on every launch rather than assuming a previously-stored token remains valid indefinitely, and the backend needs to gracefully handle receiving an updated token for what it previously knew as a different token value for the same logical user/device.

---

## 50.6 Handling Notification Taps and Deep Links

`UNUserNotificationCenterDelegate` receives callbacks both when a notification arrives while the app is in the foreground, and when the user taps a notification (or one of its actions) — routing that interaction into the app's navigation, echoing the deep link handling pattern from section 49.7.

```swift
final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    let router: AppRouter

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let recipeID = response.notification.request.identifier
        switch response.actionIdentifier {
        case "MARK_COOKED":
            await markRecipeCooked(recipeID)
        case UNNotificationDefaultActionIdentifier: // user tapped the notification itself
            router.navigateToRecipe(recipeID)
        default:
            break
        }
    }
}
```

`UNNotificationDefaultActionIdentifier` specifically represents the user tapping the notification body itself (as opposed to a specific custom action button like `"MARK_COOKED"`), and routing that tap into the same `AppRouter`/`NavigationPath`-based navigation system used for deep links (section 49.7) keeps notification-triggered navigation consistent with every other way a user might reach a given screen — the recipe detail screen, once again, doesn't need any awareness of whether it was reached via a notification tap, a universal link, or ordinary in-app navigation.

---

## 50.7 Silent Push Notifications

A silent (content-available) push notification wakes the app briefly in the background with no visible user-facing alert, giving it an opportunity to fetch fresh data before the user next opens it — the same mechanism referenced for CloudKit subscription-driven sync in section 44.4, generalized here as a standalone technique usable for any server-driven background refresh need.

```json
{
    "aps": {
        "content-available": 1
    },
    "recipeUpdateID": "42"
}
```

```swift
func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any]) async -> UIBackgroundFetchResult {
    guard let recipeID = userInfo["recipeUpdateID"] as? String else { return .noData }
    do {
        try await refreshRecipe(recipeID)
        return .newData
    } catch {
        return .failed
    }
}
```

Silent pushes are subject to the same kind of system-managed throttling discussed for background tasks generally (section 49.13) — the system may limit how often silent pushes actually wake the app if it determines the app is abusing this mechanism (waking too frequently relative to actual user engagement), so silent push should be reserved for genuinely meaningful data changes rather than used as a general-purpose, high-frequency polling substitute.

---

## 50.8 UNNotificationServiceExtension for Modifying Payloads

A notification service extension intercepts a remote push *before* it's displayed, letting the app modify its content (like downloading and attaching an image, or decrypting an encrypted payload) within a strict, short time budget before the notification is actually shown to the user.

```swift
class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest, withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent, let imageURLString = request.content.userInfo["imageURL"] as? String,
              let imageURL = URL(string: imageURLString) else {
            contentHandler(request.content)
            return
        }

        Task {
            if let attachment = try? await downloadImageAttachment(from: imageURL) {
                bestAttemptContent.attachments = [attachment]
            }
            contentHandler(bestAttemptContent)
        }
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler, let bestAttemptContent { contentHandler(bestAttemptContent) }
    }
}
```

This is precisely how apps display rich media (a downloaded image, for instance) attached to a push notification, even though the raw push payload typically only contains a URL reference rather than the actual media itself — `serviceExtensionTimeWillExpire()` is the required fallback, ensuring that if the download/processing doesn't finish within the strict time budget, the notification still displays with whatever content has been prepared so far (`bestAttemptContent`) rather than failing to display at all.

---

## 50.9 UNNotificationContentExtension for Custom UI

A notification content extension replaces the default notification banner's appearance entirely with fully custom SwiftUI/UIKit content, shown when the user long-presses (or 3D Touches, on older devices) a notification to expand it.

```swift
class RecipeNotificationViewController: UIViewController, UNNotificationContentExtension {
    func didReceive(_ notification: UNNotification) {
        let recipeTitle = notification.request.content.title
        // configure a fully custom view — an image carousel, a mini
        // interactive control, or any other bespoke expanded presentation
    }
}
```

Where a service extension (50.8) modifies a notification's *content* before display, a content extension changes how that content is *presented* — appropriate for apps wanting a genuinely distinctive, branded expanded notification experience (like an interactive rating control, a richer image gallery, or embedded live data) beyond what the standard system notification banner template supports, at the cost of the additional implementation effort a fully custom UI requires.

---

## 50.10 Notification Grouping and Threading

`threadIdentifier` groups related notifications together into a single collapsed thread in Notification Center, preventing a burst of related notifications (several updates about the same recipe collection, for instance) from cluttering the notification list as separate, ungrouped entries.

```swift
content.threadIdentifier = "recipe-collection-\(collectionID)"
content.summaryArgument = recipe.title // used in the collapsed summary text
```

Without a shared `threadIdentifier`, every notification appears as its own separate entry regardless of how related its content actually is — setting a consistent identifier for logically-related notifications (like all updates concerning the same shared recipe collection) causes the system to visually group them together, showing a collapsed summary (customizable via `summaryArgument` and the app's `Info.plist`-declared summary format string) that expands to show the individual notifications only when the user taps into it, meaningfully reducing visual clutter for apps that might otherwise send several related notifications in quick succession.

---

## 50.11 Time-Sensitive and Critical Alerts 🟠

Beyond standard notification priority, `UNNotificationInterruptionLevel` lets specific notifications break through Focus modes and Do Not Disturb — `.timeSensitive` for genuinely urgent, actionable content, and `.critical` (requiring special Apple approval) for the most extreme cases like safety alerts.

```swift
content.interruptionLevel = .timeSensitive
content.relevanceScore = 0.8 // hints at relative importance among simultaneous notifications
```

`.timeSensitive` notifications can break through most Focus mode configurations (though users retain ultimate control and can still block even time-sensitive notifications from a specific app if desired), appropriate for content like an urgent, actionable alert that would genuinely lose its value if delayed until the user next checks their phone. `.critical` is reserved for the most extreme category (things like medical or safety alerts) and requires a special, Apple-granted entitlement to use at all — deliberately gatekept given the potential for misuse of an interruption level capable of overriding even a silenced device's mute switch.

---

## 50.12 Debugging Push Notifications 🟠

Push notification delivery failures span the entire chain from server to APNs to device, making systematic debugging (isolating exactly which link in that chain is failing) essential — Apple's Push Notification Console and structured local logging are the primary tools.

```plaintext
Common failure points to check, roughly in order:
1. Is the device token current and correctly uploaded to your server?
   (Tokens can silently change — 50.5)
2. Is your server's APNs auth (token or certificate, 50.4) still valid
   and not expired?
3. Is the payload correctly formatted JSON, within APNs' size limits?
4. Is the app's aps-environment entitlement (development vs. production,
   49.4) correctly matched to which APNs environment you're actually
   sending through?
5. Has the notification service extension (50.8), if present, exceeded
   its time budget or thrown an error silently?
```

A frequent, easy-to-overlook failure mode is an `aps-environment` mismatch — a development-signed build can only receive pushes sent through APNs' sandbox/development environment, and a production (App Store or TestFlight) build only receives pushes through the production environment, so sending a "development" push to a device running a production build (or vice versa) fails silently with no notification appearing and often no obvious error surfaced to the sender, making this specific check (environment matching between build and push request) one of the first things worth verifying when push delivery mysteriously isn't working.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Permission | `UNUserNotificationCenter.requestAuthorization()` | One-time-only user consent for notifications |
| On-device scheduling | `UNNotificationRequest`, trigger types | Time/interval/location-based local reminders |
| Interactive actions | `UNNotificationCategory`, `UNNotificationAction` | Act on a notification without opening the app |
| Push infrastructure | APNs, token vs. certificate auth | How remote push is authenticated and delivered |
| Device registration | `registerForRemoteNotifications()`, device token | Prerequisite for receiving remote push |
| Tap handling | `UNUserNotificationCenterDelegate` | Route notification interaction into app navigation |
| Background refresh via push | Silent (content-available) push | Server-driven data refresh without a visible alert |
| Payload modification | `UNNotificationServiceExtension` | Attach rich media before display, within a time budget |
| Custom presentation | `UNNotificationContentExtension` | Fully custom expanded notification UI |
| Reducing clutter | `threadIdentifier`, `summaryArgument` | Group related notifications into collapsed threads |
| Breaking through Focus | `UNNotificationInterruptionLevel` | Time-sensitive and (gatekept) critical alerts |
| Systematic diagnosis | Push Notification Console, environment matching | Isolate failures across the server-APNs-device chain |
