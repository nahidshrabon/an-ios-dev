**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Not everything needs a database. A **setting** fits in `UserDefaults`. A **settings object** fits in a JSON file. A **login token** must go in the **Keychain**. **Downloaded images** belong in the **caches** folder. This section covers these lighter tools, file **security**, and when a raw **SQLite** database is the right call.

| Data | Where |
|---|---|
| Small preferences (theme, "seen onboarding") | `UserDefaults` / `@AppStorage` |
| A settings object, a small list | A `Codable` JSON file |
| Structured, queryable, related data | SwiftData (41) or Core Data (42) |
| Passwords, tokens, keys | **Keychain** |
| Re-downloadable files (images, thumbnails) | **Caches** directory |
| Complex SQL, full-text search | GRDB / SQLite |

---

## 43.1 UserDefaults and What Belongs in It 🟢

**`UserDefaults`** is a simple **key-value** store, saved as a small property list file. It's for **small preferences**:

```swift
let defaults = UserDefaults.standard

defaults.set(true, forKey: "hasCompletedOnboarding")
defaults.set("dark", forKey: "colorSchemePreference")
defaults.set(3, forKey: "launchCount")

let hasOnboarded = defaults.bool(forKey: "hasCompletedOnboarding")   // false if never set
let launches = defaults.integer(forKey: "launchCount")               // 0 if never set
let theme = defaults.string(forKey: "colorSchemePreference")         // nil if never set
```

Set **default values** once at launch, so "never set" gives a sensible value:

```swift
UserDefaults.standard.register(defaults: [
    "colorSchemePreference": "system",
    "autoplayVideos": true
])
```

In SwiftUI, **`@AppStorage`** (25.9) reads and writes the same store, and updates the view when the value changes.

| ✅ Good for | ❌ Not for |
|---|---|
| Feature flags, theme, sort order | Lists of user content (hundreds of notes) |
| "Has seen onboarding", last opened tab | Anything you'd filter, sort, or relate |
| Small numbers, strings, dates | **Secrets**: tokens, passwords (use the Keychain, 43.6) |
| | Big data: images, files |

Why not more? The **whole** file is loaded into **memory** and rewritten on changes, so it gets **slow** with lots of data. It has **no queries**, **no relationships**, **no migrations**. And it's **not encrypted** for secrets: it's readable in **backups** and by anyone with access to the app's files.

Rule of thumb: if you'd ever want to **filter**, **sort**, or **relate** the data, it belongs in a real database.

---

## 43.2 App Groups and Shared Defaults 🟢

Each target (the app, a widget, a share extension) has its **own sandbox**. A widget **can't** read the app's `UserDefaults.standard`. An **App Group** creates a **shared** space that all your targets can use:

```swift
// Main app
let shared = UserDefaults(suiteName: "group.com.example.myapp")
shared?.set(3, forKey: "unreadCount")

// Widget extension (same App Group)
let count = UserDefaults(suiteName: "group.com.example.myapp")?.integer(forKey: "unreadCount") ?? 0
```

Setup:

1. In **each** target: **Signing & Capabilities → + Capability → App Groups**.
2. Add the **same** group ID (it starts with `group.`) in every target.
3. Use **`UserDefaults(suiteName:)`** with that ID, not `.standard`.

`@AppStorage` works too: `@AppStorage("unreadCount", store: UserDefaults(suiteName: "group.com.example.myapp"))`.

The group also has a **shared folder** for files and databases:

```swift
let groupFolder = FileManager.default
    .containerURL(forSecurityApplicationGroupIdentifier: "group.com.example.myapp")!
```

That's how a widget shares a SwiftData store with the app (41.20).

---

## 43.3 Saving Codable to JSON Files 🟢

For **structured** data that's too big or complex for `UserDefaults`, but doesn't need **queries**, encode a **`Codable`** value to a **JSON file**:

```swift
struct AppSettings: Codable {
    var theme: String = "system"
    var notificationsEnabled: Bool = true
    var favoriteCategories: [String] = []
}

let settingsURL = URL.applicationSupportDirectory.appending(path: "settings.json")

func saveSettings(_ settings: AppSettings) throws {
    try FileManager.default.createDirectory(at: .applicationSupportDirectory,
                                            withIntermediateDirectories: true)
    let data = try JSONEncoder().encode(settings)
    try data.write(to: settingsURL, options: .atomic)     // .atomic: never a half-written file
}

func loadSettings() -> AppSettings {
    guard let data = try? Data(contentsOf: settingsURL),
          let settings = try? JSONDecoder().decode(AppSettings.self, from: data) else {
        return AppSettings()                                // first launch, or a bad file: defaults
    }
    return settings
}
```

It's the same `Codable` you used for networking (39.5, 39.8); the only new parts are **`write(to:)`** and **`Data(contentsOf:)`**.

**`.atomic`** writes to a temporary file first, then **swaps** it in. If the app crashes mid-write, you keep the **old** file, never a **corrupted** half-file.

Good for:

- One settings object, a small list of recent searches, a draft, cached API responses.

Not good for:

- Data that changes **often** in **small** pieces (you rewrite the **whole** file each time).
- Large lists you need to **search** or **sort** (load everything to find one item).

---

## 43.4 The Documents, Caches, and Temp Directories 🟢

Each app has a **sandbox** with several standard folders. They differ in **backup** and **cleanup**:

```swift
let documents = URL.documentsDirectory            // iOS 16+ shortcuts
let appSupport = URL.applicationSupportDirectory
let caches = URL.cachesDirectory
let temp = URL.temporaryDirectory

// Older style, common in existing code:
let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
```

| Folder | Backed up? | Can the system delete it? | Use for |
|---|---|---|---|
| **Documents** | ✅ Yes | ❌ No | Files the **user** created and cares about; can be shown in the Files app |
| **Application Support** | ✅ Yes | ❌ No | **App** data the user doesn't see directly: databases, settings files |
| **Caches** | ❌ No | ✅ Yes, when storage is low | Data you can **re-download** or **recompute**: images, thumbnails |
| **tmp** | ❌ No | ✅ Yes, often | **Short-lived** files: downloads in progress (39.12), export staging |

- **Documents**: user content, like exported PDFs or a drawing app's drawings. If you turn on file sharing, users **see** this folder in the Files app, so don't put internal files here.
- **Application Support**: the right home for your **database** and **internal** files.
- **Caches**: may **disappear** at any time when the device is low on space. Your app must cope (re-download). Never put the **only copy** of anything here.
- **tmp**: clean up after yourself; the system may also clear it.

Big files that **can** be re-downloaded but must stay (for example, offline maps) can live in Application Support but be **excluded from backup**:

```swift
var url = URL.applicationSupportDirectory.appending(path: "OfflineMaps")
var values = URLResourceValues()
values.isExcludedFromBackup = true
try url.setResourceValues(values)
```

Backing up gigabytes of re-downloadable data fills users' iCloud storage, and App Review can reject apps that do it.

---

## 43.5 FileManager Common Operations 🟢

**`FileManager`** does the everyday file work: check, create, copy, move, delete, and read **attributes**:

```swift
let fileManager = FileManager.default
let folder = URL.applicationSupportDirectory.appending(path: "Exports")

// Create a folder, including any missing parents. No error if it already exists.
try fileManager.createDirectory(at: folder, withIntermediateDirectories: true)

// Check
if fileManager.fileExists(atPath: fileURL.path()) { /* ... */ }

// Copy, move, delete
try fileManager.copyItem(at: sourceURL, to: destinationURL)    // fails if destination exists
try fileManager.moveItem(at: oldURL, to: newURL)
try fileManager.removeItem(at: fileURL)

// List a folder
let files = try fileManager.contentsOfDirectory(at: folder,
                                                includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey])

// Read attributes: size and dates
let values = try fileURL.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
let size = values.fileSize ?? 0
let modified = values.contentModificationDate
```

**`withIntermediateDirectories: true`** creates **every** missing folder along the path in **one** call (`a/b/c` even if `a` doesn't exist yet), and doesn't fail if the folder is already there.

⚠️ `copyItem` and `moveItem` **fail** if the destination **already exists**. Remove the old file first, or use `replaceItemAt(_:withItemAt:)`.

⚠️ Checking `fileExists` and **then** acting can race with other code. Often it's simpler to just **try** the operation and handle the error.

File **sizes** and **dates** are what a cache cleaner (43.12) uses to decide what to delete.

---

## 43.6 Keychain: Storing a Token Securely 🟡

The **Keychain** is the system's **encrypted** store for **secrets**: login tokens, passwords, API credentials, private keys. Unlike `UserDefaults`, items are **encrypted** with keys tied to the device, can be protected while the device is **locked** (43.7), and can even require **Face ID** (43.8).

The API is an old, low-level **C** API, with dictionaries of `kSec…` keys. Most apps wrap it in a small helper:

```swift
import Security

enum KeychainError: Error {
    case unexpectedStatus(OSStatus)
}

struct KeychainStore {
    let service: String     // e.g. your bundle ID: groups the items

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }

    func save(_ value: String, account: String) throws {
        let data = Data(value.utf8)
        // Try to UPDATE an existing item first…
        let updateStatus = SecItemUpdate(baseQuery(account: account) as CFDictionary,
                                         [kSecValueData as String: data] as CFDictionary)
        if updateStatus == errSecItemNotFound {
            // …or ADD a new one
            var query = baseQuery(account: account)
            query[kSecValueData as String] = data
            query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly   // 43.7
            let addStatus = SecItemAdd(query as CFDictionary, nil)
            guard addStatus == errSecSuccess else { throw KeychainError.unexpectedStatus(addStatus) }
        } else if updateStatus != errSecSuccess {
            throw KeychainError.unexpectedStatus(updateStatus)
        }
    }

    func load(account: String) throws -> String? {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else {
            throw KeychainError.unexpectedStatus(status)
        }
        return String(decoding: data, as: UTF8.self)
    }

    func delete(account: String) throws {
        let status = SecItemDelete(baseQuery(account: account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unexpectedStatus(status)
        }
    }
}

// Usage
let keychain = KeychainStore(service: "com.example.myapp")
try keychain.save(token, account: "authToken")
let token = try keychain.load(account: "authToken")
try keychain.delete(account: "authToken")        // on logout
```

Things to know:

- Every call returns an **`OSStatus`**. **Check it**: silent failures are the most common Keychain bug.
- An item is identified by its **class** + **service** + **account**. Use the **same** values to save, load, and delete.
- Keychain items **survive app deletion** on iOS. If the user reinstalls, old items may still be there; clear them on first launch if that matters to you.
- To share items with your **extensions** or other apps from your team, add a **Keychain Sharing** access group.

A login token (39.6) is exactly the kind of value that must **never** sit in `UserDefaults`.

---

## 43.7 Keychain Accessibility Classes 🟡

Each Keychain item has an **accessibility** value. It decides **when** the item can be read (depending on the lock state), and whether it can move to **another device** in a backup:

```swift
var query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.example.myapp",
    kSecAttrAccount as String: "authToken",
    kSecValueData as String: tokenData,
    kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
]
```

| Value | Readable when | Moves to a new device? |
|---|---|---|
| `kSecAttrAccessibleWhenUnlocked` (default) | Only while **unlocked** | ✅ Yes (in encrypted backups) |
| `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` | Only while **unlocked** | ❌ No |
| `kSecAttrAccessibleAfterFirstUnlock` | After the **first unlock** since restart, even if locked again | ✅ Yes |
| `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` | After the first unlock | ❌ No |
| `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` | Only while unlocked, and **only if a passcode is set** | ❌ No |

How to choose:

- **"After first unlock"**: the item works in the **background** (silent pushes, background refresh) even when the phone is locked in a pocket. A good default for **session tokens** the app needs in the background.
- **"When unlocked"**: stricter. Use for values only needed while the user is **actively** using the app.
- **"ThisDeviceOnly"**: the item **never** leaves this device, not even through a backup restore. Right for tokens that identify **this device**: a restored new phone should log in again.

---

## 43.8 Biometric-Gated Keychain Items 🔴

For **very** sensitive values, you can make **every** read require **Face ID**, **Touch ID**, or the **passcode**, with **`SecAccessControl`**:

```swift
import LocalAuthentication

var error: Unmanaged<CFError>?
guard let access = SecAccessControlCreateWithFlags(
    nil,
    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,   // the accessibility class (43.7)
    .biometryCurrentSet,                            // require Face ID / Touch ID, current enrollment
    &error
) else { throw error!.takeRetainedValue() as Error }

let addQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.example.myapp",
    kSecAttrAccount as String: "paymentKey",
    kSecValueData as String: secretData,
    kSecAttrAccessControl as String: access
]
SecItemAdd(addQuery as CFDictionary, nil)

// Reading shows the Face ID prompt automatically
let context = LAContext()
context.localizedReason = "Unlock your payment details"
let readQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.example.myapp",
    kSecAttrAccount as String: "paymentKey",
    kSecReturnData as String: true,
    kSecUseAuthenticationContext as String: context
]
var result: AnyObject?
let status = SecItemCopyMatching(readQuery as CFDictionary, &result)   // blocks until the user responds; call off the main thread
```

| Flag | Requires | If fingers/faces change |
|---|---|---|
| `.userPresence` | Biometrics **or** the passcode | Still works |
| `.biometryAny` | Biometrics, any enrolled | Still works |
| `.biometryCurrentSet` | Biometrics, **as enrolled now** | Item becomes **unreadable** |

**`.biometryCurrentSet`** protects against a sneaky attack: someone who learns your **passcode** could **add their own face or fingerprint**, then use it to unlock your secrets. With `currentSet`, adding a new biometric **invalidates** the item, so your app must handle "item can't be read" (for example, by asking the user to log in again).

Why use the Keychain for this, rather than just calling **`LAContext.evaluatePolicy`** and then reading a normal value? Because then the **check** and the **data** are separate: on a compromised device, the check can be skipped. With access control, the **system** won't **decrypt** the item without a successful authentication.

Add **`NSFaceIDUsageDescription`** to Info.plist. Use this for things like **payment credentials** or a **password vault**, not for a routine session token (a Face ID prompt on every API call would be awful).

---

## 43.9 Data Protection Classes 🟡

**Data Protection** encrypts **ordinary files** on disk, with keys linked to the device passcode. Like Keychain accessibility (43.7), each file has a **protection class** that decides **when** it can be read:

```swift
// Write a file with the strongest protection
try fileData.write(to: fileURL, options: .completeFileProtection)

// Or change an existing file
try FileManager.default.setAttributes(
    [.protectionKey: FileProtectionType.complete],
    ofItemAtPath: fileURL.path()
)
```

| Class | Readable | Use for |
|---|---|---|
| `.complete` | Only while **unlocked** (about 10 s after locking, it's sealed) | Sensitive files: medical records, private journals |
| `.completeUnlessOpen` | A file **already open** can be finished while locked; new opens need unlock | Writing a sensitive file in the background, like a download |
| `.completeUntilFirstUserAuthentication` (**default**) | After the first unlock since restart | Most app files |
| `.none` | Always | Rarely needed |

Why is the **default** not the strongest? Because many apps **work in the background** while the phone is locked: syncing, handling a push, updating a widget. With `.complete`, those tasks would **fail** to read the app's own files. The default protects data when the phone is **off or just restarted** (the most common theft scenario), while still allowing background work.

If you use `.complete`, your background code must **cope** with files being unavailable. The Keychain (43.6) is for small **secrets**; data protection is for **files** of any size.

---

## 43.10 GRDB and Direct SQLite 🟡

Sometimes you want a **real SQL database** with full control: complex **joins**, hand-tuned **indexes**, an **existing** SQLite file from another platform, or **full-text search** (43.11). **GRDB** is a popular, well-maintained Swift library on top of **SQLite**:

```swift
import GRDB

struct Recipe: Codable, FetchableRecord, PersistableRecord {
    var id: Int64?
    var title: String
    var minutesToCook: Int
}

let dbQueue = try DatabaseQueue(path: URL.applicationSupportDirectory.appending(path: "db.sqlite").path())

// Schema, with migrations
var migrator = DatabaseMigrator()
migrator.registerMigration("v1") { db in
    try db.create(table: "recipe") { t in
        t.autoIncrementedPrimaryKey("id")
        t.column("title", .text).notNull()
        t.column("minutesToCook", .integer).notNull()
    }
}
try migrator.migrate(dbQueue)

// Write
try dbQueue.write { db in
    let recipe = Recipe(id: nil, title: "Pasta", minutesToCook: 15)
    try recipe.insert(db)
}

// Read: with Codable records…
let quick = try dbQueue.read { db in
    try Recipe.filter(Column("minutesToCook") <= 20).order(Column("title")).fetchAll(db)
}

// …or with any SQL you like
let rows = try dbQueue.read { db in
    try Row.fetchAll(db, sql: "SELECT title FROM recipe WHERE minutesToCook <= ?", arguments: [20])
}
```

GRDB gives you **`Codable`** record mapping, **migrations**, **thread safety**, and **observation** (live queries for SwiftUI), while still letting you write **plain SQL** when you need it. Always pass values as **`arguments`** (the `?`), never by building SQL strings yourself: that's how **SQL injection** happens.

| Choose | When |
|---|---|
| SwiftData | Most new apps; you want Swift models and SwiftUI integration |
| Core Data | Existing apps; UIKit `NSFetchedResultsController` |
| GRDB / SQLite | You think in SQL, need joins/indexes/FTS, or share a SQLite schema with other platforms |

You can also call SQLite's **C API** directly (`sqlite3_open`, `sqlite3_prepare_v2`…), but it's verbose and easy to misuse. A wrapper like GRDB is almost always the better choice.

---

## 43.11 Full-Text Search with SQLite FTS5 🔴

Searching for **words** inside **lots of text** (notes, articles, recipes) with `LIKE '%pasta%'` is **slow**: the database must **scan every row** and every character, because a normal index can't help with a "contains" search. **FTS5** is SQLite's **full-text search** engine. It builds a **special index** for words:

```sql
-- A virtual table with its own full-text index
CREATE VIRTUAL TABLE recipe_search USING fts5(title, instructions, tokenize = 'porter');

INSERT INTO recipe_search(title, instructions)
VALUES ('Pasta Carbonara', 'Boil the pasta, whisk the eggs with cheese...');

-- MATCH uses the index; LIKE would not
SELECT title FROM recipe_search WHERE recipe_search MATCH 'pasta AND egg*';

-- Best matches first, with the matching words highlighted
SELECT title, highlight(recipe_search, 1, '<b>', '</b>') AS snippet
FROM recipe_search
WHERE recipe_search MATCH 'carbonara OR cheese'
ORDER BY bm25(recipe_search);
```

How it works: FTS5 keeps an **inverted index**, like the index at the back of a book: for each **word**, a list of the rows that contain it. Finding "pasta" is then a quick **lookup**, not a scan.

| | `LIKE '%term%'` | FTS5 `MATCH` |
|---|---|---|
| Speed on big text | Scans every row | Index lookup |
| `AND`, `OR`, `NOT`, phrases (`"olive oil"`) | ❌ | ✅ |
| Prefixes (`egg*`) | Partly | ✅ |
| Ranking by relevance (`bm25`) | ❌ | ✅ |
| Word forms (`cooking` ↔ `cook`, with `porter`) | ❌ | ✅ |

You must use **`MATCH`** to use the index. A `LIKE` on an FTS table **doesn't** use it.

Neither `#Predicate` nor `NSPredicate` can use FTS5, so this is a reason to reach for **GRDB** (43.10), which has built-in FTS5 support. For smaller data, SwiftData's `localizedStandardContains` (41.9) is often good enough; FTS5 is for **real** search over **a lot** of text.

---

## 43.12 Designing a Cache Eviction Policy 🟡

A **cache** (downloaded images, thumbnails, API responses) in the **caches** folder (43.4) needs **rules** for what to **delete**, or it grows **forever** and eats the user's storage. That's an **eviction policy**.

The most common rule is **LRU** (**Least Recently Used**): when the cache is too big, delete the items **not used for the longest time**.

```swift
struct CacheEntry {
    let url: URL
    let sizeBytes: Int
    let lastAccessed: Date
}

func evictIfNeeded(entries: [CacheEntry], maxTotalBytes: Int, maxAge: TimeInterval) {
    var remaining = entries

    // 1. Remove anything too OLD, whatever the size
    let cutoff = Date.now.addingTimeInterval(-maxAge)
    for entry in remaining where entry.lastAccessed < cutoff {
        try? FileManager.default.removeItem(at: entry.url)
    }
    remaining.removeAll { $0.lastAccessed < cutoff }

    // 2. Still too BIG? Remove least-recently-used first
    var totalBytes = remaining.reduce(0) { $0 + $1.sizeBytes }
    guard totalBytes > maxTotalBytes else { return }

    for entry in remaining.sorted(by: { $0.lastAccessed < $1.lastAccessed }) {
        guard totalBytes > maxTotalBytes else { break }
        try? FileManager.default.removeItem(at: entry.url)
        totalBytes -= entry.sizeBytes
    }
}
```

Why **LRU** is a good default: something you used **recently** is likely to be used **again soon** (the avatar of a friend you chat with daily), while something untouched for weeks probably isn't.

A good policy has **several** rules:

| Rule | Example |
|---|---|
| **Max size** | At most 200 MB on disk |
| **Max age** | Nothing older than 30 days, even if there's room (data goes **stale**) |
| **When to clean** | At launch, when going to the background, or when crossing the size limit |

Don't run the clean-up on **every** cache write: listing and sorting all files each time is **wasteful**. Run it **now and then**, on a background task.

Practical tips:

- **Track "last used" yourself** (in a small index, or by updating the file's modification date when you read it). File systems often **don't** update access dates reliably.
- For an **in-memory** cache, use **`NSCache`**: it's thread-safe and **automatically** drops items when the system is low on memory.
- Remember the system can **purge** the caches folder anyway (43.4), so the app must always handle a **missing** cache file.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Simple key-value storage | `UserDefaults`, `register(defaults:)` | Small preferences only; no secrets, no big data |
| Cross-target sharing | App Groups, `UserDefaults(suiteName:)` | Share settings and files with widgets and extensions |
| Structured file persistence | `Codable` + `write(to:options: .atomic)` | One object or a small list, saved safely |
| Standard directories | Documents, Application Support, Caches, tmp | Different backup and cleanup rules |
| File operations | `FileManager`, resource values | Create, copy, move, delete; sizes and dates |
| Secure credential storage | Keychain (`SecItemAdd`, `SecItemCopyMatching`) | Encrypted secrets; always check `OSStatus` |
| Access timing control | `kSecAttrAccessible*` | When items can be read; whether they leave the device |
| Per-access authentication | `SecAccessControl`, `.biometryCurrentSet` | Face ID / Touch ID for every read |
| File-level encryption | `FileProtectionType` | Lock-state-dependent encryption for files |
| Full relational control | GRDB, SQLite | SQL, joins, indexes, migrations, observation |
| Efficient text search | SQLite FTS5, `MATCH`, `bm25` | Indexed word search at scale |
| Bounded cache growth | LRU + max age + periodic cleanup | Keep caches useful and small |
