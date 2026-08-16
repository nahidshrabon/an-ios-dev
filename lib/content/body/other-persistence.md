## 43.1 UserDefaults and What Belongs in It

`UserDefaults` is a simple, key-value persistent store backed by a property list file, appropriate for small amounts of lightweight data like user preferences and settings — not a general-purpose database.

```swift
UserDefaults.standard.set(true, forKey: "hasCompletedOnboarding")
UserDefaults.standard.set("dark", forKey: "colorSchemePreference")

let hasOnboarded = UserDefaults.standard.bool(forKey: "hasCompletedOnboarding")
```

`UserDefaults` is genuinely appropriate for small, simple values — feature flags, a selected theme, a "last opened tab" index — but is a poor fit for anything resembling structured, queryable, or sizable data (a list of hundreds of user-created items, for instance), both because it loads its entire contents into memory as a single property list and because it offers none of the querying, relationship, or migration capabilities SwiftData/Core Data provide. A useful rule of thumb: if you'd ever want to filter, sort, or relate the data to other data, it belongs in a real persistence layer, not `UserDefaults`.

---

## 43.2 App Groups and Shared Defaults

An App Group is a shared container identifier that multiple targets (the main app, a widget, a share extension) can all opt into, enabling shared `UserDefaults` (and shared file storage, as referenced in section 41.20) across otherwise-sandboxed targets.

```swift
let sharedDefaults = UserDefaults(suiteName: "group.com.example.myapp")
sharedDefaults?.set(3, forKey: "unreadCount")

// A widget extension, configured with the same App Group, reads the same value:
let count = UserDefaults(suiteName: "group.com.example.myapp")?.integer(forKey: "unreadCount") ?? 0
```

Without an App Group, each target's `UserDefaults.standard` is entirely separate and sandboxed — a widget has no way to read data the main app saved to its own `UserDefaults.standard`. Configuring a shared App Group identifier (in each target's Signing & Capabilities settings) and using `UserDefaults(suiteName:)` instead of `.standard` is what enables this cross-target data sharing, the same underlying mechanism referenced for sharing a SwiftData store with a widget in section 41.20.

---

## 43.3 Saving Codable to JSON Files

For structured data that doesn't need a full database's querying capabilities but is too large or complex for `UserDefaults`, encoding a `Codable` model directly to a JSON file is a simple, effective middle ground.

```swift
struct AppSettings: Codable {
    var theme: String
    var notificationsEnabled: Bool
}

func saveSettings(_ settings: AppSettings, to url: URL) throws {
    let data = try JSONEncoder().encode(settings)
    try data.write(to: url)
}

func loadSettings(from url: URL) throws -> AppSettings {
    let data = try Data(contentsOf: url)
    return try JSONDecoder().decode(AppSettings.self, from: data)
}
```

This pattern directly reuses the same `Codable`/`JSONEncoder`/`JSONDecoder` machinery seen throughout the curriculum (`Codable` fundamentals, and networking's request/response encoding in section 39.5/39.8) — the only new element is `Data.write(to:)`/`Data(contentsOf:)` for the actual file I/O. This approach is well suited to a moderate amount of structured data (a single settings object, a small list of recently-viewed items) that doesn't need SwiftData's querying, relationships, or fine-grained change tracking.

---

## 43.4 The Documents, Caches, and Temp Directories

Every app has several standard sandboxed directories, each with different semantics around backup and system-managed cleanup — choosing the correct one for a given file matters for both correctness and respecting user storage.

```swift
let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
let cachesURL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
let tempURL = FileManager.default.temporaryDirectory
```

The **documents directory** is for user-generated or user-important content that should be backed up (via iCloud/iTunes backup) and persist indefinitely — genuinely important data the user created or would be upset to lose. The **caches directory** is for regenerable data (downloaded images, computed thumbnails) that the system may purge under storage pressure and that is *not* backed up — appropriate for exactly the kind of data a cache eviction policy (43.12) would manage. The **temporary directory** is for short-lived files needed only for the current session (like the download example from section 39.12), which the system may clear even more aggressively and which the app itself should proactively clean up when no longer needed.

---

## 43.5 FileManager Common Operations

`FileManager` provides the general file-system operations apps commonly need: checking existence, creating directories, copying, moving, and deleting files.

```swift
let fileManager = FileManager.default

if !fileManager.fileExists(atPath: someDirectoryURL.path) {
    try fileManager.createDirectory(at: someDirectoryURL, withIntermediateDirectories: true)
}

try fileManager.copyItem(at: sourceURL, to: destinationURL)
try fileManager.moveItem(at: oldURL, to: newURL)
try fileManager.removeItem(at: fileURL)

let attributes = try fileManager.attributesOfItem(atPath: fileURL.path)
let fileSize = attributes[.size] as? Int
```

`withIntermediateDirectories: true` on `createDirectory` creates any missing parent directories along the path in one call, rather than requiring each level to be created individually — a small but frequently useful convenience. `attributesOfItem(atPath:)` exposes file metadata (size, modification date, and more) useful for tasks like the cache eviction policy design covered later in this section, which typically needs to know both a file's size and its last-accessed time to make sensible eviction decisions.

---

## 43.6 Keychain: Storing a Token Securely

The Keychain is the system-provided, encrypted storage specifically designed for sensitive data like authentication tokens, passwords, and credentials — genuinely different from `UserDefaults`, which stores its property list file in plain, unencrypted form.

```swift
import Security

func saveToken(_ token: String, account: String) {
    let data = Data(token.utf8)
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: account,
        kSecValueData as String: data
    ]
    SecItemDelete(query as CFDictionary) // remove any existing item first
    SecItemAdd(query as CFDictionary, nil)
}

func loadToken(account: String) -> String? {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: account,
        kSecReturnData as String: true
    ]
    var result: AnyObject?
    SecItemCopyMatching(query as CFDictionary, &result)
    guard let data = result as? Data else { return nil }
    return String(data: data, encoding: .utf8)
}
```

The Keychain API (`Security` framework, `SecItemAdd`/`SecItemCopyMatching`/etc.) is notoriously more verbose and lower-level than `UserDefaults`, reflecting its C-based Objective-C heritage rather than a modern Swift-native design — this exact bearer-token storage scenario (recall section 39.6's authentication headers) is precisely the kind of sensitive value that must never be stored in plain `UserDefaults`, where it would sit unencrypted and readable by anything with file-system access to the app's sandbox.

---

## 43.7 Keychain Accessibility Classes

Keychain items carry an accessibility attribute controlling *when* the item can actually be read — for instance, whether it's accessible while the device is locked, and whether it survives being restored to a new device.

```swift
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrAccount as String: "authToken",
    kSecValueData as String: tokenData,
    kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
]
```

`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` is a common, sensible default for most tokens — accessible to the app after the device has been unlocked at least once since boot (appropriate for background operations that might need the token without the user actively unlocking the device at that exact moment), and explicitly *not* migrated to a new device during a backup restore, since a token that authenticates this specific device shouldn't silently carry over to a different physical device. Other accessibility values trade off differently between availability and security — `kSecAttrAccessibleWhenUnlocked` is more restrictive (only accessible while actively unlocked), appropriate for especially sensitive values that shouldn't be accessible even during background execution.

---

## 43.8 Biometric-Gated Keychain Items 🟠

Beyond basic accessibility classes, a Keychain item can require explicit biometric (Face ID/Touch ID) or passcode authentication at the moment of access, via `SecAccessControl` — appropriate for especially sensitive values where every single access should require active user re-authentication.

```swift
import LocalAuthentication

let access = SecAccessControlCreateWithFlags(
    nil,
    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    .biometryCurrentSet,
    nil
)

let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrAccount as String: "highSecurityToken",
    kSecValueData as String: tokenData,
    kSecAttrAccessControl as String: access as Any
]
```

`.biometryCurrentSet` specifically ties the protection to the biometric data *currently* enrolled on the device — if the user adds or removes a fingerprint/face, previously-stored items protected this way become inaccessible, a deliberate security property preventing someone who's added their own biometric data to a stolen, unlocked device from accessing previously-protected secrets. This is meaningfully stronger protection than the accessibility classes from 43.7 alone, at the cost of requiring an explicit authentication prompt on every access — appropriate for something like a payment credential rather than a routine session token.

---

## 43.9 Data Protection Classes 🟠

Beyond the Keychain specifically, iOS's broader Data Protection system (`NSFileProtectionType`) lets ordinary files on disk carry similar encryption-at-rest and lock-state-dependent accessibility guarantees.

```swift
try (fileData as NSData).write(
    to: fileURL,
    options: .completeFileProtection
)

// Or set on an existing file:
try FileManager.default.setAttributes(
    [.protectionKey: FileProtectionType.complete],
    ofItemAtPath: fileURL.path
)
```

`.completeFileProtection` (`FileProtectionType.complete`) encrypts the file such that it's entirely inaccessible while the device is locked, even to the app itself if it happened to be running in the background — the strongest protection level, appropriate for files containing genuinely sensitive content beyond what belongs specifically in the Keychain (which is really designed for smaller credential-like values, not arbitrary larger files). Weaker levels like `.completeUntilFirstUserAuthentication` (the iOS default for most files) balance security against the practical need for some background processing to access files even before the user has unlocked the device since boot.

---

## 43.10 GRDB and Direct SQLite 🟠

For cases needing full relational database control beyond what SwiftData/Core Data's object-graph abstraction provides — complex custom queries, very fine-grained performance tuning, or working with an existing SQLite schema — GRDB (a popular third-party Swift SQLite wrapper) or direct SQLite C API usage remain viable, lower-level options.

```swift
import GRDB

let dbQueue = try DatabaseQueue(path: dbURL.path)

try dbQueue.write { db in
    try db.execute(sql: """
        CREATE TABLE IF NOT EXISTS recipe (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            minutesToCook INTEGER NOT NULL
        )
        """)
}

let recipes = try dbQueue.read { db in
    try Row.fetchAll(db, sql: "SELECT * FROM recipe WHERE minutesToCook <= ?", arguments: [20])
}
```

GRDB provides a Swift-idiomatic layer over raw SQLite (connection pooling, `Codable` record mapping, observation of query results) while still allowing genuinely arbitrary, hand-written SQL when needed — appropriate for scenarios where SwiftData/Core Data's higher-level abstractions become limiting, such as needing a complex multi-table join query, full control over indexing strategy, or working with a pre-existing SQLite database format the app doesn't own the schema design of.

---

## 43.11 Full-Text Search with SQLite FTS5 🔴

SQLite's FTS5 extension provides efficient full-text search (searching for words/phrases within large text content) directly at the database level — something neither SwiftData's `#Predicate` nor Core Data's `NSPredicate` can efficiently express for large text corpora, since a naive `LIKE '%term%'` style search scales poorly.

```sql
CREATE VIRTUAL TABLE recipe_search USING fts5(title, instructions);

INSERT INTO recipe_search(title, instructions) VALUES ('Pasta Carbonara', 'Boil pasta, whisk eggs...');

SELECT * FROM recipe_search WHERE recipe_search MATCH 'pasta AND eggs';
```

An FTS5 virtual table maintains its own specialized index structure (an inverted index, conceptually similar to how a search engine indexes web pages) purpose-built for efficient text search — the `MATCH` operator, rather than `LIKE`, is what actually leverages this index, supporting features like phrase matching, boolean operators (`AND`/`OR`/`NOT`), and relevance ranking that a naive substring search simply cannot provide efficiently at scale. This is a genuinely advanced tool reserved for apps with real full-text search requirements over substantial text content (like a notes app or a recipe search feature), typically accessed via GRDB (43.10) or direct SQLite usage rather than through SwiftData/Core Data's higher-level query APIs.

---

## 43.12 Designing a Cache Eviction Policy 🟠

A well-designed cache (for downloaded images, computed thumbnails, or any regenerable data stored in the caches directory from 43.4) needs an explicit eviction policy — a strategy for deciding what to remove when the cache grows too large, since unbounded growth would eventually consume excessive device storage.

```swift
struct CacheEntry {
    let url: URL
    let sizeBytes: Int
    let lastAccessed: Date
}

func evictIfNeeded(entries: [CacheEntry], maxTotalBytes: Int) {
    var totalBytes = entries.reduce(0) { $0 + $1.sizeBytes }
    guard totalBytes > maxTotalBytes else { return }

    // Least-Recently-Used (LRU): evict oldest-accessed entries first
    let sortedByAge = entries.sorted { $0.lastAccessed < $1.lastAccessed }
    for entry in sortedByAge {
        guard totalBytes > maxTotalBytes else { break }
        try? FileManager.default.removeItem(at: entry.url)
        totalBytes -= entry.sizeBytes
    }
}
```

Least-Recently-Used (LRU) — evicting the entries that haven't been accessed in the longest time first — is the most common and generally sensible default eviction strategy, based on the reasonable assumption that recently-accessed data is more likely to be needed again soon than data untouched for a long time. Beyond total size, a real cache policy typically also considers a maximum age per entry (evicting stale data outright regardless of size pressure) and should generally run its eviction check periodically (e.g., on app launch, or when a size threshold is crossed) rather than checking on every single cache write, to avoid the overhead of constant policy evaluation.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Simple key-value storage | `UserDefaults` | Small settings/preferences, not general data |
| Cross-target sharing | App Groups, `UserDefaults(suiteName:)` | Shared storage across app/widget/extension |
| Structured file persistence | `Codable` + `Data.write(to:)` | Moderate structured data without a full database |
| Standard directories | Documents, Caches, temp | Backup and cleanup semantics per file purpose |
| File operations | `FileManager` | Existence checks, create/copy/move/delete |
| Secure credential storage | Keychain (`SecItemAdd`, etc.) | Encrypted storage for tokens and passwords |
| Access timing control | `kSecAttrAccessible*` | When a Keychain item can be read |
| Per-access authentication | `SecAccessControl`, `.biometryCurrentSet` | Biometric-gated Keychain items |
| File-level encryption | `NSFileProtectionType` | Lock-state-dependent file encryption at rest |
| Full relational control | GRDB, direct SQLite | Beyond object-graph abstraction limitations |
| Efficient text search | SQLite FTS5, `MATCH` | Indexed full-text search at scale |
| Bounded cache growth | LRU eviction policy | Sensible strategy for regenerable cached data |
