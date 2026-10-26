**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Notifications reach users when the app **isn't open**. There are two kinds:

- **Local** notifications: scheduled **by the app itself**, on the device (reminders, timers).
- **Remote** (push) notifications: sent **from your server**, through **Apple's push service** (APNs).

This section covers asking permission, scheduling, interactive actions, push setup, handling taps, silent pushes, extensions that change or redesign notifications, grouping, urgency levels, and how to debug delivery.

---

## 50.1 Requesting Notification Permission 🟢

Before showing **any** notification, the app must ask the user's **permission**, saying **what** it wants to use (alerts, sounds, badges):

```swift
import UserNotifications

func requestNotificationPermission() async -> Bool {
    let center = UNUserNotificationCenter.current()
    do {
        return try await center.requestAuthorization(options: [.alert, .sound, .badge])
    } catch {
        return false
    }
}
```

It's **async**, and returns `true` if the user allowed it.

⚠️ The system shows this prompt **only once**. If the user taps **Don't Allow**, calling it again does **nothing**. The only way back is the **Settings** app. So **when** you ask matters a lot:

- ❌ Asking at **first launch**, before the user knows the app: many people say no.
- ✅ Asking when the **benefit is clear**: right after they set their first cooking reminder ("Get notified when it's time to cook?").

Check the **current** status any time, and send people to Settings if needed:

```swift
let settings = await UNUserNotificationCenter.current().notificationSettings()
switch settings.authorizationStatus {
case .authorized, .provisional, .ephemeral: break            // can notify
case .denied:
    // explain why notifications help, with a button:
    if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
        await UIApplication.shared.open(url)                  // opens THIS app's notification settings
    }
case .notDetermined:
    _ = await requestNotificationPermission()
@unknown default: break
}
```

A gentler option is **provisional** authorization (`options: [.provisional, …]`): **no prompt** at all; notifications are delivered **quietly** to Notification Center, with buttons for the user to **keep** or **turn off** them. Good for apps where notifications are nice-to-have.

---

## 50.2 Local Notifications and Triggers 🟢

A **local** notification is scheduled **on the device**: no server needed. It fires on a **trigger**: a time, a delay, or a place. Perfect for things the app **already knows**: reminders, timers, daily habits.

```swift
func scheduleReminderNotification(recipe: Recipe, at date: Date) async throws {
    let content = UNMutableNotificationContent()
    content.title = "Time to cook!"
    content.body = "\(recipe.title): don't forget the timer"
    content.sound = .default
    content.userInfo = ["recipeID": recipe.id.uuidString]       // data for when it's tapped (50.6)

    let trigger = UNCalendarNotificationTrigger(
        dateMatching: Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date),
        repeats: false
    )
    let request = UNNotificationRequest(identifier: recipe.id.uuidString,   // a STABLE id
                                        content: content,
                                        trigger: trigger)
    try await UNUserNotificationCenter.current().add(request)
}
```

| Trigger | Fires | Example |
|---|---|---|
| `UNCalendarNotificationTrigger` | At a **date/time** (can repeat, e.g. daily at 7:00) | "Remind me at 6 pm" |
| `UNTimeIntervalNotificationTrigger` | After a **delay** | "Remind me in 30 minutes" (repeating needs ≥ 60 s) |
| `UNLocationNotificationTrigger` | On **entering or leaving** a region | "Remind me when I get to the store" |

```swift
// Every day at 7:00
var morning = DateComponents()
morning.hour = 7
let daily = UNCalendarNotificationTrigger(dateMatching: morning, repeats: true)

// In 30 minutes
let soon = UNTimeIntervalNotificationTrigger(timeInterval: 30 * 60, repeats: false)
```

Why a **stable identifier** (the recipe's ID) instead of a random one? So you can **find** it again:

- **Cancel** it when the user deletes the recipe: `removePendingNotificationRequests(withIdentifiers: [id])`.
- **Replace** it: adding a request with the **same** identifier **replaces** the old one, so re-scheduling never creates duplicates.

An app can have at most **64** pending local notifications; the system keeps the soonest ones.

---

## 50.3 Notification Categories and Actions 🟢

A **category** adds **buttons** (actions) to notifications, so the user can act **without opening the app**:

```swift
let markCookedAction = UNNotificationAction(
    identifier: "MARK_COOKED",
    title: "Mark as Cooked",
    options: []                                   // runs in the background
)
let snoozeAction = UNNotificationAction(
    identifier: "SNOOZE",
    title: "Snooze 10 min",
    options: []
)
let replyAction = UNTextInputNotificationAction(  // a text field in the notification
    identifier: "ADD_NOTE",
    title: "Add a Note",
    options: [],
    textInputButtonTitle: "Save",
    textInputPlaceholder: "e.g. less salt next time"
)
let category = UNNotificationCategory(
    identifier: "RECIPE_REMINDER",
    actions: [markCookedAction, snoozeAction, replyAction],
    intentIdentifiers: [],
    options: []
)

// Register categories ONCE, early (at launch)
UNUserNotificationCenter.current().setNotificationCategories([category])

// A notification shows those actions only if it names the category
content.categoryIdentifier = "RECIPE_REMINDER"
```

Two things must match: the **registered** category's identifier, and the notification's **`categoryIdentifier`**. If they don't, the notification appears **without** buttons.

Action **options**:

| Option | Effect |
|---|---|
| `[]` | Runs in the **background**; the app doesn't open |
| `.foreground` | **Opens** the app |
| `.destructive` | Shown in **red** |
| `.authenticationRequired` | The device must be **unlocked** first |

The user sees the buttons by **long-pressing** (or pulling down) the notification. You handle the tap in the delegate (50.6).

---

## 50.4 APNs Overview and Token vs. Certificate Auth 🟡

**APNs** (Apple Push Notification service) delivers **remote** notifications. The flow:

```
Your server  ──(push request + auth)──►  APNs  ──►  the user's device
```

Your server must **prove** to APNs that it's allowed to send pushes for your app. There are two ways:

| | **Token-based** (recommended) | **Certificate-based** (legacy) |
|---|---|---|
| What you get from Apple | One **`.p8` signing key** | A **certificate** per app |
| Covers | **All** your apps, both environments | **One** app (and often one environment) |
| Expires | No (unless you revoke it) | **Every year**: renew and re-upload |
| How it's used | Your server signs a **JWT** with the key | TLS client certificate |

With token auth, the server creates a short **JWT** (signed with the `.p8` key, with your **Team ID** and **Key ID**) and sends it in each request's header. ⚠️ **Reuse** the same JWT for a while: APNs wants a new one **at most every 20 minutes** and **at least every 60 minutes**. Making a new one for **every** request gets you rejected (`TooManyProviderTokenUpdates`).

Why token auth wins: **one** key for everything, and **no yearly expiry**. With certificates, if someone forgets to renew, **all** pushes **silently stop** on the expiry date: a classic production incident.

Keep the `.p8` key **secret**, on the **server** only (39.13). Never put it in the app.

---

## 50.5 Registering for Remote Notifications 🟡

To receive pushes, the app **registers** with APNs and gets a **device token**: an address for **this app on this device**. You send that token to **your server**, which uses it to address pushes.

Add the **Push Notifications** capability first (it adds the `aps-environment` entitlement, 49.4).

```swift
class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared   // 50.6: set EARLY
        UIApplication.shared.registerForRemoteNotifications()                         // on EVERY launch
        return true
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02x", $0) }.joined()   // bytes → hex
        Task { try? await uploadDeviceToken(tokenString) }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("Push registration failed: \(error)")      // e.g. missing entitlement, Simulator issues
    }
}

// In the SwiftUI App:  @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
```

Notes:

- **Registering** doesn't show a prompt and doesn't need permission. **Visible** pushes still need the user's permission (50.1); **silent** pushes (50.7) don't.
- The token **can change**: after a reinstall, a restore to a new device, or sometimes for no visible reason. So **register on every launch**, and send the token to the server **if it changed**. The server should **replace** the old token for that user/device.
- When APNs says a token is **invalid** (HTTP 410 / `Unregistered`), the server should **stop** using it.
- Tokens are **different** in the development and production environments (50.12).

---

## 50.6 Handling Notification Taps and Deep Links 🟡

**`UNUserNotificationCenterDelegate`** tells you about two events:

1. A notification arrives **while the app is in the foreground**: should it be shown?
2. The user **taps** a notification or one of its **actions**.

```swift
@MainActor
final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationDelegate()
    var router: AppRouter?

    // 1. Foreground: by default NOTHING is shown. Choose how to present it.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    // 2. The user tapped the notification or an action
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse) async {
        let userInfo = response.notification.request.content.userInfo
        guard let recipeID = userInfo["recipeID"] as? String else { return }

        switch response.actionIdentifier {
        case "MARK_COOKED":
            await markRecipeCooked(recipeID)
        case "ADD_NOTE":
            if let text = (response as? UNTextInputNotificationResponse)?.userText {
                await addNote(text, to: recipeID)
            }
        case UNNotificationDefaultActionIdentifier:       // tapped the notification ITSELF
            router?.navigateToRecipe(recipeID)
        case UNNotificationDismissActionIdentifier:        // swiped away (only if the category asks for it)
            break
        default:
            break
        }
    }
}
```

- **`UNNotificationDefaultActionIdentifier`**: the user tapped the **notification body**, not a button. Usually: **open** the related screen.
- A custom identifier (`"MARK_COOKED"`): the user tapped **that button**.

Set the delegate **early** (in `didFinishLaunching`, 50.5). If the app was **closed** and a tap **launched** it, the response arrives right at startup, and a late delegate would **miss** it.

Route taps into the **same** router as deep links (49.7). The recipe screen doesn't need to know if it was opened by a tap, a link, Spotlight, or normal navigation.

---

## 50.7 Silent Push Notifications 🟡

A **silent push** has **no alert, sound, or badge**. Instead, it **wakes the app** in the background for a short time (about 30 seconds) to **fetch new data**, so the content is fresh when the user opens the app. CloudKit sync uses exactly this (44.4).

The payload sets **`content-available: 1`** and nothing visible:

```json
{
  "aps": { "content-available": 1 },
  "recipeUpdateID": "42"
}
```

The server must also send the headers **`apns-push-type: background`** and **`apns-priority: 5`**.

In the app, enable **Background Modes → Remote notifications**, and handle it:

```swift
func application(_ application: UIApplication,
                 didReceiveRemoteNotification userInfo: [AnyHashable: Any]) async -> UIBackgroundFetchResult {
    guard let recipeID = userInfo["recipeUpdateID"] as? String else { return .noData }
    do {
        try await refreshRecipe(recipeID)
        return .newData
    } catch {
        return .failed
    }
}
```

⚠️ Silent pushes are **not guaranteed**:

- The system **throttles** them (a few per hour is a safe expectation), depending on battery, Low Power Mode, and how much the user uses the app (49.13).
- If the user **force-quit** the app (swiped it away in the app switcher), silent pushes **don't wake it** until the user opens it again.

So use them for **real changes** ("this recipe was updated"), not as a **timer** to poll the server. And always **also** refresh when the app opens.

---

## 50.8 UNNotificationServiceExtension for Modifying Payloads 🔴

A **notification service extension** runs **before** a push is shown, and can **change** it: download and attach an **image**, **decrypt** an end-to-end encrypted message, or fix up the text. It's a separate **app extension** target (53).

The push must allow changes with **`mutable-content: 1`**, and have a visible alert:

```json
{
  "aps": {
    "alert": { "title": "New photo", "body": "Ana shared a dish" },
    "mutable-content": 1
  },
  "imageURL": "https://example.com/photos/123.jpg"
}
```

```swift
import UserNotifications

class NotificationService: UNNotificationServiceExtension {
    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(_ request: UNNotificationRequest,
                             withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void) {
        self.contentHandler = contentHandler
        bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

        guard let bestAttemptContent,
              let imageURLString = request.content.userInfo["imageURL"] as? String,
              let imageURL = URL(string: imageURLString) else {
            contentHandler(request.content)          // nothing to change: show it as it is
            return
        }

        Task {
            if let attachment = try? await downloadImageAttachment(from: imageURL) {
                bestAttemptContent.attachments = [attachment]
            }
            contentHandler(bestAttemptContent)       // show the improved notification
        }
    }

    // Called just before the time limit (about 30 s) runs out
    override func serviceExtensionTimeWillExpire() {
        if let contentHandler, let bestAttemptContent {
            contentHandler(bestAttemptContent)       // show what we have so far
        }
    }
}

func downloadImageAttachment(from url: URL) async throws -> UNNotificationAttachment {
    let (tempURL, _) = try await URLSession.shared.download(from: url)
    let fileURL = tempURL.deletingPathExtension().appendingPathExtension("jpg")   // needs an extension
    try FileManager.default.moveItem(at: tempURL, to: fileURL)
    return try UNNotificationAttachment(identifier: "image", url: fileURL)
}
```

Why the extension is needed: push payloads are **small** (max 4 KB), so they carry a **URL**, not the image. The extension downloads it **on the device**, before the user sees the notification.

**`serviceExtensionTimeWillExpire()`** is the **safety net**: if the download is slow, you must still deliver **something** (the original text) before time's up. Otherwise the system shows the **unmodified** notification anyway, and your work is lost.

---

## 50.9 UNNotificationContentExtension for Custom UI 🟡

A **notification content extension** gives a notification a **fully custom expanded view**, shown when the user **long-presses** it: an image gallery, a map, a mini player, a rating control.

```swift
import UIKit
import UserNotifications
import UserNotificationsUI
import SwiftUI

class RecipeNotificationViewController: UIViewController, UNNotificationContentExtension {
    func didReceive(_ notification: UNNotification) {
        let content = notification.request.content
        let host = UIHostingController(rootView: RecipePreviewCard(
            title: content.title,
            recipeID: content.userInfo["recipeID"] as? String
        ))
        addChild(host)                                    // containment (35.12)
        view.addSubview(host.view)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.didMove(toParent: self)
    }
}
```

In the extension's **Info.plist**, **`UNNotificationExtensionCategory`** says which **category** (50.3) uses this custom view. Only notifications with that `categoryIdentifier` get it.

| | Service extension (50.8) | Content extension (50.9) |
|---|---|---|
| Changes | The **content** (text, attachments) | How it **looks** when expanded |
| Runs | **Before** the notification is shown | When the user **expands** it |
| For | Remote pushes only | Local **and** remote |
| Typical use | Attach images, decrypt messages | Rich previews, maps, interactive controls |

A content extension is more work (a whole custom UI), so use it when a **distinctive**, **interactive** preview really helps users.

---

## 50.10 Notification Grouping and Threading 🟢

Without grouping, ten related notifications show as ten **separate** entries and clutter Notification Center. **`threadIdentifier`** groups them into **one stack**:

```swift
content.threadIdentifier = "recipe-collection-\(collectionID)"    // same id = same group
```

For pushes, put it in the payload:

```json
{ "aps": { "alert": "Ana added Tiramisu", "thread-id": "recipe-collection-family" } }
```

Notifications with the **same** thread identifier are **stacked** together; the user taps the stack to **expand** it. Notifications **without** one are grouped by **app**.

Good thread identifiers follow the user's **mental model**:

- A chat app: one thread per **conversation**.
- A recipe app: one per **shared collection**.
- A shop: one per **order**.

(Older code may also set `summaryArgument` to customize the collapsed summary text. Since iOS 15 the system writes summaries itself, and that property is deprecated.)

The user can also choose **Notification Summary** in Settings, to get non-urgent notifications in a scheduled **digest** instead of one by one. That's another reason to set **interruption levels** honestly (50.11).

---

## 50.11 Time-Sensitive and Critical Alerts 🟡

Not all notifications are equally **urgent**. **`interruptionLevel`** (iOS 15) tells the system how much a notification may **interrupt** the user, especially during **Focus** modes:

```swift
content.interruptionLevel = .timeSensitive
content.relevanceScore = 0.8      // 0...1: which notification to feature in a summary
```

| Level | Behavior | Use for |
|---|---|---|
| `.passive` | Added silently; no sound, no screen wake | Nice-to-know updates |
| `.active` (default) | Normal notification | Most notifications |
| `.timeSensitive` | Can **break through Focus** and summaries (the user can turn this off per app) | Urgent and **actionable**: "Your order is at the door", "Your timer is done" |
| `.critical` | Plays a sound **even when muted** or in Do Not Disturb | **Safety**: medical, public safety, home security alarms |

**`.timeSensitive`** needs the **Time Sensitive Notifications** capability. Use it **honestly**: promotions marked time-sensitive teach users to turn it off for your app, and App Review may object.

**`.critical`** needs a **special entitlement** that you must **request from Apple**, with a justification. It's gatekept because it can **override** the mute switch and Do Not Disturb. Imagine every app able to make your phone ring loudly at 3 a.m.: only truly important, safety-related apps get it.

---

## 50.12 Debugging Push Notifications 🟡

A push goes through **many** steps: your server → APNs → the device → (maybe) your service extension → the screen. When nothing shows up, check **each** step in order:

```
1. Device token: current? correctly uploaded to the server? (50.5)
2. Server auth: is the .p8 key / certificate valid? Is the JWT fresh? (50.4)
3. Environment: development token → development APNs; production token → production APNs
4. Payload: valid JSON? Under 4 KB? Correct headers (apns-push-type, apns-topic = bundle ID)?
5. APNs response: read the status and reason (BadDeviceToken, Unregistered, TopicDisallowed…)
6. Device: permission granted? Focus mode? App force-quit (silent pushes)?
7. Service extension: crashed or ran out of time? (50.8)
```

The most common **hidden** problem is an **environment mismatch**:

| Build | APNs environment | Token works with |
|---|---|---|
| Run from **Xcode** (development signing) | **Sandbox** (`api.sandbox.push.apple.com`) | Development only |
| **TestFlight** and **App Store** | **Production** (`api.push.apple.com`) | Production only |

Sending to the **wrong** environment fails with `BadDeviceToken`, and the user sees **nothing**. "It worked in Xcode but not in TestFlight" is almost always this.

Useful tools:

- **Push Notifications Console** (in your Apple Developer account): send a test push to a device token, and see **delivery logs** for it.
- **Simulator**: `xcrun simctl push booted com.example.myapp payload.apns`, or **drag** a `.apns` JSON file onto the Simulator window. Good for testing **handling** code without a server.
- **Console.app** on the Mac, with the device connected: filter for `apsd` (the push daemon) and your extension's process to see what happened on the device.
- **Log** the APNs **response** on your server for every push: the **reason** string usually tells you exactly what's wrong.

Check **one link at a time**, starting from the server. Guessing at the whole chain wastes hours.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Permission | `requestAuthorization()`, provisional, settings URL | Ask once, at the right moment |
| On-device scheduling | `UNNotificationRequest`, calendar/interval/location triggers | Local reminders; stable IDs to cancel or replace |
| Interactive actions | `UNNotificationCategory`, `UNNotificationAction` | Buttons and text input on notifications |
| Push infrastructure | APNs, token (`.p8`) vs. certificate auth | One non-expiring key; reuse JWTs 20–60 min |
| Device registration | `registerForRemoteNotifications()`, device token | Register every launch; upload changed tokens |
| Tap handling | `UNUserNotificationCenterDelegate` | Foreground presentation; route taps like deep links |
| Background refresh via push | Silent push (`content-available`) | Fetch fresh data; throttled, not guaranteed |
| Payload modification | `UNNotificationServiceExtension`, `mutable-content` | Attach images or decrypt before display |
| Custom presentation | `UNNotificationContentExtension` | A custom expanded view per category |
| Reducing clutter | `threadIdentifier` / `thread-id` | Stack related notifications |
| Breaking through Focus | `interruptionLevel` | Passive to critical; time-sensitive needs a capability |
| Systematic diagnosis | Push console, `simctl push`, environment matching | Check each link of the chain in order |
