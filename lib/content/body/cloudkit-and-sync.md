**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**CloudKit** is Apple's cloud database. It stores app data in **iCloud**, free for the developer within generous limits, with the user's **Apple Account** as the login. SwiftData (41.18) and Core Data (42.12) can sync through it **automatically**. This section goes **underneath**: the raw CloudKit API, how **incremental sync** works, **push** updates, **sharing**, `CKSyncEngine`, **conflicts**, **offline-first** design, debugging, and **CRDTs**.

---

## 44.1 CloudKit Concepts: Containers, Databases, Records 🟢

CloudKit has a simple structure:

- A **container** is your app's own space in iCloud (`iCloud.com.example.myapp`). Not related to `ModelContainer`, despite the name.
- Each container has **databases**:
  - **Private**: each user's **own** data. Only they can see it, and it counts against **their** iCloud storage.
  - **Public**: data **every** user of the app can read (like a shared catalog). Counts against the **app's** quota.
  - **Shared**: data **other users shared** with this user (44.5).
- Databases hold **records** (`CKRecord`): flexible key-value objects with a **record type** (like "Recipe").

```swift
import CloudKit

let container = CKContainer(identifier: "iCloud.com.example.myapp")
let privateDatabase = container.privateCloudDatabase
let publicDatabase = container.publicCloudDatabase

let record = CKRecord(recordType: "Recipe")
record["title"] = "Pasta Carbonara"            // fields are set by STRING key
record["minutesToCook"] = 25
record["tags"] = ["italian", "quick"]
```

| | `CKRecord` | `@Model` / `NSManagedObject` |
|---|---|---|
| Fields | A **dictionary** by string key | Typed **properties** |
| Typos in field names | Found at **run time** | Found at **compile time** |
| Types allowed | Strings, numbers, dates, data, locations, references, assets (files), arrays of these | Any Swift types the framework supports |

A `CKRecord` is a **general cloud record**, not a Swift model. That's the layer SwiftData and `NSPersistentCloudKitContainer` **translate to and from** for you. When you use CloudKit directly, you usually write small conversions between your models and records:

```swift
extension Recipe {
    func toRecord(in zoneID: CKRecordZone.ID) -> CKRecord {
        let record = CKRecord(recordType: "Recipe", recordID: CKRecord.ID(recordName: id.uuidString, zoneID: zoneID))
        record["title"] = title
        record["minutesToCook"] = minutesToCook
        return record
    }
}
```

Setup: add the **iCloud** capability, check **CloudKit**, and choose a **container**.

---

## 44.2 Saving and Fetching Records 🟢

`CKDatabase` has **async** methods, like `URLSession` (39.2):

```swift
func saveRecipe(_ record: CKRecord, to database: CKDatabase) async throws -> CKRecord {
    try await database.save(record)
}

func fetchRecipe(recordID: CKRecord.ID, from database: CKDatabase) async throws -> CKRecord {
    try await database.record(for: recordID)
}

func fetchQuickRecipes(from database: CKDatabase) async throws -> [CKRecord] {
    let query = CKQuery(recordType: "Recipe",
                        predicate: NSPredicate(format: "minutesToCook <= %d", 20))
    query.sortDescriptors = [NSSortDescriptor(key: "title", ascending: true)]

    let (results, _) = try await database.records(matching: query)   // (_, cursor for more pages)
    return results.compactMap { _, result in try? result.get() }
}
```

**`CKQuery`** filters on the **server**, with an **`NSPredicate`** (the string-based kind from Core Data, 42.5; CloudKit is older than `#Predicate`).

Why does `records(matching:)` give a **`Result` per record**? Because CloudKit operations can **partly succeed**: in one batch, most records may load fine while a few **fail** (deleted meanwhile, no permission). You handle each one, instead of the whole call failing.

⚠️ To **query** or **sort** by a field, that field needs an **index** in the CloudKit schema (set in the CloudKit Console, 44.9). A missing index gives an error like "*Field 'title' is not marked queryable*". Queries are for **looking things up**; for **keeping a device in sync**, use change tokens (44.3).

Before using the private database, check that the user is **signed in** to iCloud:

```swift
switch try await container.accountStatus() {
case .available: break                              // good to go
case .noAccount: showSignInToICloudMessage()
case .restricted, .couldNotDetermine, .temporarilyUnavailable: showRetryLater()
@unknown default: break
}
```

---

## 44.3 Record Zones and Change Tokens 🟡

To **sync**, you don't want to download **everything** each time. You want "**what changed since last time?**". CloudKit answers that with two things:

- A **record zone** (`CKRecordZone`): a group of records in a database. The private database has a **default** zone, but **sync** (and sharing, 44.5) needs a **custom** zone that you create.
- A **change token** (`CKServerChangeToken`): an opaque bookmark meaning "**I've seen everything up to here**".

```swift
let zoneID = CKRecordZone.ID(zoneName: "Recipes")

// Create the zone once
try await database.save(CKRecordZone(zoneID: zoneID))

// Fetch only what changed since the last token
func fetchChanges(since token: CKServerChangeToken?, database: CKDatabase) async throws -> CKServerChangeToken? {
    var currentToken = token
    var moreComing = true

    while moreComing {
        let changes = try await database.recordZoneChanges(inZoneWith: zoneID, since: currentToken)

        for (_, result) in changes.modificationResultsByID {
            if let modification = try? result.get() {
                applyToLocalStore(modification.record)        // new or updated
            }
        }
        for deletion in changes.deletions {
            deleteFromLocalStore(deletion.recordID)           // removed on another device
        }

        currentToken = changes.changeToken
        moreComing = changes.moreComing                       // big changes come in pages
    }
    return currentToken                                       // SAVE this for next time
}
```

Without tokens, you'd have to download **all** records and **compare** them with the local copy: slow, and impossible for big data. With a token, the server sends **only** the changes. It's the cloud version of Core Data's persistent history (42.11).

**Save the new token** after each successful fetch (it supports `NSSecureCoding`, so you can archive it to `Data` and store it in a file or `UserDefaults`). If you lose it, the next sync starts **from the beginning**. If you save it **before** applying the changes and then crash, you'd **skip** those changes, so apply first, then save.

---

## 44.4 Subscriptions and Push-Driven Sync 🟡

How does a device know **when** to fetch? Instead of **polling** ("anything new?" every minute), ask CloudKit to **tell you**, with a **subscription**. When a matching change happens, CloudKit sends a **silent push notification** to the device.

```swift
// For a custom zone in the private database (the usual sync setup)
func subscribeToChanges(database: CKDatabase) async throws {
    let subscription = CKDatabaseSubscription(subscriptionID: "private-changes")

    let notificationInfo = CKSubscription.NotificationInfo()
    notificationInfo.shouldSendContentAvailable = true      // SILENT push: no banner, wakes the app
    subscription.notificationInfo = notificationInfo

    try await database.save(subscription)
}

// For specific records, e.g. in the public database
let querySubscription = CKQuerySubscription(
    recordType: "Announcement",
    predicate: NSPredicate(value: true),
    options: [.firesOnRecordCreation, .firesOnRecordUpdate, .firesOnRecordDeletion]
)
```

**`shouldSendContentAvailable = true`** makes it a **silent push**: no banner or sound. iOS **wakes your app** briefly in the background, and you fetch the changes (with your change token, 44.3):

```swift
// AppDelegate
func application(_ application: UIApplication,
                 didReceiveRemoteNotification userInfo: [AnyHashable: Any]) async -> UIBackgroundFetchResult {
    guard CKNotification(fromRemoteNotificationDictionary: userInfo) != nil else { return .noData }
    do {
        try await syncManager.fetchLatestChanges()
        return .newData
    } catch {
        return .failed
    }
}
```

Setup: the **Push Notifications** capability, and **Background Modes → Remote notifications**. Also call `application.registerForRemoteNotifications()` at launch (no user permission is needed for silent pushes).

| Polling | Push-driven |
|---|---|
| Asks every N minutes, even when nothing changed | Fetches **only** when something changed |
| Wastes battery and data | Efficient |
| Up to N minutes late | Usually **seconds** |

Silent pushes are **not guaranteed**: the system may **delay** or **drop** them (for example, in Low Power Mode). So also fetch changes when the app **launches** and when it comes to the **foreground**.

---

## 44.5 CKShare and Collaborative Data 🟡

**`CKShare`** lets a user **share** some of their private data with **specific people**: a family recipe collection, a shared shopping list, a trip plan. Invited people can **view** or **edit** it, depending on their **permission**.

```swift
func shareRecipeCollection(rootRecord: CKRecord, database: CKDatabase) async throws -> CKShare {
    let share = CKShare(rootRecord: rootRecord)              // share this record AND its children
    share[CKShare.SystemFieldKey.title] = "Family Recipe Collection"
    share.publicPermission = .none                           // invite-only, not "anyone with the link"

    // The root record and the share must be saved TOGETHER
    let (saveResults, _) = try await database.modifyRecords(saving: [rootRecord, share], deleting: [])
    guard case .success(let saved as CKShare)? = saveResults[share.recordID] else {
        throw CKError(.internalError)
    }
    return saved
}
```

Then show the system **sharing UI**, where the user picks people and permissions. In UIKit, that's **`UICloudSharingController`**; in SwiftUI, wrap it (38.2), or use `ShareLink` with a `CKShare` transfer representation.

Key ideas:

| Database | Who can see the data |
|---|---|
| Private | Only the **owner** |
| Public | **Everyone** who uses the app |
| **Shared** (via `CKShare`) | The owner and **invited** participants, with **read-only** or **read-write** permission |

- A share starts at a **root record**. Everything **under** it (records whose **`parent`** points to it, directly or indirectly) is shared too. Set `childRecord.setParent(rootRecord)` to build that tree.
- Shared records must live in a **custom zone** (44.3), not the default zone. Since iOS 15 you can also share a **whole zone**: `CKShare(recordZoneID:)`.
- The owner's data stays in the **owner's** private database; participants see it in **their shared** database.

That's real **multi-user collaboration**, built on CloudKit, with **no server** of your own.

---

## 44.6 CKSyncEngine Overview 🔴

Writing sync by hand (44.2–44.4) means managing: change tokens, zones, subscriptions, push handling, batching, retries, rate limits, account changes… **`CKSyncEngine`** (iOS 17) does most of this **for you**. You tell it **what changed locally**, and it tells you **what changed remotely**.

```swift
final class RecipeSyncManager: CKSyncEngineDelegate {
    private var engine: CKSyncEngine!

    init(database: CKDatabase, savedState: CKSyncEngine.State.Serialization?) {
        let configuration = CKSyncEngine.Configuration(
            database: database,
            stateSerialization: savedState,          // where we left off last time
            delegate: self
        )
        engine = CKSyncEngine(configuration)
    }

    // 1. Tell the engine about LOCAL changes
    func recipeChanged(id: UUID, zoneID: CKRecordZone.ID) {
        let recordID = CKRecord.ID(recordName: id.uuidString, zoneID: zoneID)
        engine.state.add(pendingRecordZoneChanges: [.saveRecord(recordID)])
    }

    // 2. The engine reports events, including REMOTE changes
    func handleEvent(_ event: CKSyncEngine.Event, syncEngine: CKSyncEngine) async {
        switch event {
        case .stateUpdate(let update):
            saveState(update.stateSerialization)     // persist, like a change token
        case .fetchedRecordZoneChanges(let changes):
            for modification in changes.modifications {
                applyToLocalStore(modification.record)
            }
            for deletion in changes.deletions {
                deleteFromLocalStore(deletion.recordID)
            }
        case .sentRecordZoneChanges(let sent):
            for failure in sent.failedRecordSaves {
                handleSaveFailure(failure)           // e.g. a conflict (44.7)
            }
        case .accountChange:
            resetLocalDataIfNeeded()                 // the user signed out or switched accounts
        default:
            break
        }
    }

    // 3. When it's time to upload, the engine asks for the records
    func nextRecordZoneChangeBatch(_ context: CKSyncEngine.SendChangesContext,
                                   syncEngine: CKSyncEngine) async -> CKSyncEngine.RecordZoneChangeBatch? {
        let pending = syncEngine.state.pendingRecordZoneChanges
        return await CKSyncEngine.RecordZoneChangeBatch(pendingChanges: pending) { recordID in
            localRecord(for: recordID)               // build the CKRecord from your local data
        }
    }
}
```

The engine runs the **sync loop** itself: it fetches when pushes arrive, sends pending changes when the network allows, batches, retries, and respects rate limits. Your delegate only answers **two** questions:

1. **"Here's what changed on the server: apply it."** (`handleEvent` with fetched changes)
2. **"What changed locally that I should send?"** (`nextRecordZoneChangeBatch`)

Plus: **persist** its **state** whenever it gives you a `.stateUpdate` (the engine's version of a change token).

Use `CKSyncEngine` when SwiftData's or Core Data's **automatic** CloudKit sync doesn't fit: your own storage (SQLite, files), custom conflict rules, or sync of only part of the data.

---

## 44.7 Conflict Resolution Strategies 🟡

Two devices can edit the **same record** before either sees the other's change: your phone (offline on a plane) and your iPad both rename the same recipe. When the second one saves, CloudKit notices the record **changed on the server** since that device last fetched it, and returns **`CKError.serverRecordChanged`**.

```swift
func saveWithConflictResolution(_ local: CKRecord, database: CKDatabase) async throws {
    do {
        try await database.save(local)
    } catch let error as CKError where error.code == .serverRecordChanged {
        // The server's current version is included in the error
        guard let server = error.serverRecord else { throw error }

        // Strategy: field-level merge
        server["title"] = local["title"]                              // our title wins
        let localTags = local["tags"] as? [String] ?? []
        let serverTags = server["tags"] as? [String] ?? []
        server["tags"] = Array(Set(localTags).union(serverTags))      // keep BOTH devices' tags

        try await database.save(server)       // save onto the SERVER version (it has the right change tag)
    }
}
```

Note the last step: you **modify the server's record** and save **that**. It carries the **latest version tag**, so the save is accepted. Saving your old local record again would just fail again.

| Strategy | How | Downside |
|---|---|---|
| **Last writer wins** | The newest save overwrites | Silently **loses** the other edit |
| **Server wins** | Keep the server version, drop yours | Loses **your** edit |
| **Field-level merge** | Combine fields that don't clash (as above) | Needs per-field rules |
| **Ask the user** | Show both versions | Interrupts the user; only for important data |
| **CRDTs** (44.10) | Data types that **always** merge correctly | More complex data design |

The right choice depends on the **data**. A "favorite" flag? Last writer wins is fine. A long note edited on two devices? Losing one version would upset the user, so merge, or keep both.

---

## 44.8 Offline-First Architecture and Optimistic Updates 🟡

An **offline-first** app treats the **local store** as the source of truth for the **UI**. Every change is applied **locally first**, so the UI responds **instantly**, then synced in the **background**. That first local change is called an **optimistic update**: you **assume** the sync will work.

```swift
@MainActor
final class RecipeStore {
    private(set) var recipes: [Recipe] = []
    private var pendingSync: Set<Recipe.ID> = []         // saved locally, not yet in the cloud

    func toggleFavorite(_ recipe: Recipe) {
        recipe.isFavorite.toggle()                       // 1. update locally: the UI changes NOW
        saveLocally(recipe)
        pendingSync.insert(recipe.id)

        Task {
            do {
                try await syncToCloudKit(recipe)         // 2. sync in the background
                pendingSync.remove(recipe.id)
            } catch let error as CKError where error.code == .networkUnavailable
                                            || error.code == .networkFailure {
                // 3a. offline: KEEP the change; it stays in pendingSync and is retried later
            } catch {
                recipe.isFavorite.toggle()               // 3b. truly rejected: roll back
                saveLocally(recipe)
                pendingSync.remove(recipe.id)
            }
        }
    }

    func retryPendingChanges() async {                   // call when the network comes back (40.14)
        for id in pendingSync { /* sync again */ }
    }
}
```

Two kinds of failure need **different** handling:

- **Offline** or a temporary network error: **don't undo** the user's change. Keep it **queued**, and send it when the connection returns (`NWPathMonitor`, 40.14, or `CKSyncEngine`, which handles this for you).
- **Rejected** by the server (for example, no permission): **roll back**, and maybe tell the user.

| Online-only | Offline-first |
|---|---|
| Every action waits for the network | Every action is **instant** |
| No connection = the app is stuck | Works fully **offline** (a plane, a subway) |
| Simple | Needs a **queue** of pending changes, and **conflict** handling (44.7) |

Users expect apps like Notes and Reminders to **just work** anywhere. Offline-first is how.

---

## 44.9 Debugging CloudKit Sync Failures 🔴

Sync bugs are **hard**: they depend on **timing** between devices, **accounts**, network conditions, and server state. Two tools matter most: **good logging** and the **CloudKit Console**.

**1. Log every CloudKit error with details:**

```swift
func loggedSave(_ record: CKRecord, database: CKDatabase) async throws {
    do {
        let saved = try await database.save(record)
        logger.info("Saved \(saved.recordID.recordName)")
    } catch let error as CKError {
        logger.error("CKError \(error.code.rawValue): \(error.localizedDescription)")

        if let retryAfter = error.retryAfterSeconds {
            logger.info("Server asks to retry after \(retryAfter)s")       // rate limited or busy
        }
        if error.code == .partialFailure,
           let perItem = error.partialErrorsByItemID {
            for (id, itemError) in perItem {
                logger.error("  item \(String(describing: id)): \(itemError.localizedDescription)")
            }
        }
        throw error
    }
}
```

**`retryAfterSeconds`** is CloudKit **telling you** how long to wait (on errors like `.requestRateLimited`, `.zoneBusy`, `.serviceUnavailable`). Use it instead of your own backoff delay (40.3). **`.partialFailure`** means some items in a batch failed: the details are **per item**.

**2. Use the CloudKit Console** (icloud.developer.apple.com). It shows what's **really on the server**:

- Browse and edit **records** in each database and zone.
- Check the **schema**: record types, fields, and **indexes** (44.2).
- See **logs** of recent operations and errors.
- **Deploy** the development schema to **production**.

That answers the key question: is the **server data wrong** (a sync **logic** bug), or is the server right and **one device's local copy** has drifted? Client logs alone usually can't tell you.

**Common causes of "sync doesn't work":**

| Symptom | Likely cause |
|---|---|
| Works in Xcode, fails in TestFlight/App Store | The schema was **never deployed** to **production** |
| Nothing syncs for one user | Not signed in to iCloud, or iCloud Drive off (`accountStatus`, 44.2) |
| Changes only appear after relaunch | Silent pushes not set up, or not fetching on push (44.4) |
| "Not marked queryable" error | Missing **index** on a queried field |
| Old changes come back | Change token saved before applying changes, or lost (44.3) |

Test with **two real devices** signed into the **same** test account, and try **offline** edits on both.

---

## 44.10 CRDTs: A Practical Introduction 🔴

A **CRDT** (**Conflict-free Replicated Data Type**) is a data structure designed so that **independent** edits on different devices can **always** be **merged automatically**, and every device ends up with the **same** result, no matter the **order** in which changes arrive. No conflict-resolution rules (44.7) needed.

The simplest one is a **grow-only counter**, for something like "total likes" or "times played" across devices:

```swift
struct GrowOnlyCounter: Codable, Equatable {
    private var countsByDevice: [String: Int] = [:]

    mutating func increment(deviceID: String) {
        countsByDevice[deviceID, default: 0] += 1
    }

    var total: Int {
        countsByDevice.values.reduce(0, +)
    }

    mutating func merge(with other: GrowOnlyCounter) {
        for (device, count) in other.countsByDevice {
            countsByDevice[device] = max(countsByDevice[device] ?? 0, count)
        }
    }
}
```

Why **one count per device**? Look at what goes wrong with a single shared number:

```
Shared total (❌):
  Start: 5.  Phone (offline) adds 1 → 6.  iPad (offline) adds 1 → 6.
  Merge: which 6 wins? Either way the result is 6. One increment is LOST (should be 7).

Per-device counts (✅):
  Start: {phone: 3, ipad: 2} = 5
  Phone adds 1 → {phone: 4, ipad: 2}
  iPad adds 1  → {phone: 3, ipad: 3}
  Merge (max per device) → {phone: 4, ipad: 3} = 7  ✓
```

Each device only ever **increases its own** entry, so taking the **max per device** never loses anything. The merge is:

- **Commutative**: merging A into B gives the same as B into A.
- **Associative**: the grouping of merges doesn't matter.
- **Idempotent**: merging the same data twice changes nothing.

Those three properties are what make CRDTs safe with **messy** networks, where changes can arrive **late**, **out of order**, or **twice**.

Other CRDTs exist for richer data: **sets** where items can be added and removed, **last-writer-wins registers** for single values, ordered **lists**, and even **collaborative text** (the technique behind some real-time editors).

How far to go? For most apps, **don't** build a CRDT sync system from scratch: it's serious engineering. Use the **idea** where it fits: design **specific** pieces of data (counters, tag sets, checklists) so that they **merge** naturally, and use simpler strategies (44.7) for the rest. For heavy collaborative editing, look at existing, tested CRDT libraries.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Core structure | `CKContainer`, `CKDatabase`, `CKRecord` | Your iCloud space; private, public, and shared data in records |
| Async operations | `database.save()`, `.record(for:)`, `.records(matching:)` | Async calls; per-record results; check `accountStatus` |
| Incremental sync | Custom `CKRecordZone`, `CKServerChangeToken` | Fetch only changes; apply, then save the token |
| Real-time updates | `CKDatabaseSubscription`, silent push | Fetch when something changed, not by polling |
| Collaboration | `CKShare` | Share a record tree or zone with chosen people |
| Higher-level orchestration | `CKSyncEngine` | The sync loop done for you; you apply and provide changes |
| Handling conflicts | `CKError.serverRecordChanged`, `serverRecord` | Merge onto the server record, by your rules |
| Resilient UX | Optimistic updates, pending queue | Instant UI; keep offline changes; roll back real rejections |
| Diagnosis | CloudKit Console, `CKError` details | Server truth vs. device state; deployed schema |
| Automatic merge correctness | CRDTs (e.g., grow-only counter) | Data that always merges the same way |
