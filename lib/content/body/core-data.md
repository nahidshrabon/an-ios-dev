**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**Core Data** is Apple's original persistence framework, around since 2005 (macOS) and 2009 (iOS). SwiftData (41) is built **on top of** its engine. Core Data is more **verbose** and less Swift-like, but it's **mature**, very **capable**, and used in a huge number of existing apps. This section teaches you to **read**, **maintain**, and **extend** Core Data code, and shows how each piece maps to SwiftData.

---

## 42.1 When You'll Still Meet Core Data 🟢

For a **new** app in 2026, SwiftData is the usual starting point. You'll still work with Core Data when:

1. **Maintaining an existing app.** Many production apps have years of Core Data code and data. Rewriting the whole data layer is **risky** and rarely worth it just to switch frameworks.
2. **You need something SwiftData doesn't offer (yet).** For example: `NSFetchedResultsController` for UIKit lists, very fine control over contexts and merging, batch operations, or support for **older OS versions** (SwiftData needs iOS 17).
3. **The codebase predates SwiftData**, and the team keeps a consistent stack.

| Concept | Core Data | SwiftData |
|---|---|---|
| Model definition | `.xcdatamodeld` + `NSManagedObject` | `@Model` class |
| Storage setup | `NSPersistentContainer` | `ModelContainer` |
| Working area | `NSManagedObjectContext` | `ModelContext` |
| Query | `NSFetchRequest` + `NSPredicate` | `FetchDescriptor` + `#Predicate` |
| Live list in SwiftUI | `@FetchRequest` | `@Query` |
| iCloud sync | `NSPersistentCloudKitContainer` | `ModelConfiguration(cloudKitDatabase:)` |

It's the same reasoning as UIKit's continued relevance (35.1): not "the recommended start", but a **practical** skill for real codebases.

---

## 42.2 The Managed Object Model and Entities 🟢

Core Data's schema is the **managed object model**, usually designed **visually** in a **`.xcdatamodeld`** file. It contains **entities** (like tables, or `@Model` types), each with **attributes** (stored values) and **relationships**.

Xcode then **generates** a Swift class for each entity (or you write them by hand):

```swift
// Generated (Editor → Create NSManagedObject Subclass), or set "Codegen: Class Definition"
@objc(Recipe)
public class Recipe: NSManagedObject {
    @NSManaged public var title: String?
    @NSManaged public var minutesToCook: Int32
    @NSManaged public var createdAt: Date?
    @NSManaged public var ingredients: NSSet?          // a to-many relationship
}

extension Recipe {
    @nonobjc public class func fetchRequest() -> NSFetchRequest<Recipe> {
        NSFetchRequest<Recipe>(entityName: "Recipe")
    }
}
```

Things that look strange if you're used to SwiftData:

- **`@NSManaged`** means "Core Data provides this property's storage at run time". It's not a normal stored property.
- **String attributes are often optional** (`String?`) in generated code, even when the model marks them required. Many teams add **computed wrappers** for cleaner use:

```swift
extension Recipe {
    var wrappedTitle: String { title ?? "Untitled" }
    var ingredientsArray: [Ingredient] {
        (ingredients as? Set<Ingredient> ?? []).sorted { ($0.name ?? "") < ($1.name ?? "") }
    }
}
```

- **To-many relationships** are **`NSSet`** (untyped), not Swift arrays.
- Integer attributes have explicit sizes: `Int16`, `Int32`, `Int64`.

The model **file** is the source of truth for the schema; the classes just mirror it. SwiftData flips this: the **Swift code** is the source of truth.

---

## 42.3 NSPersistentContainer Setup 🟢

**`NSPersistentContainer`** sets up the Core Data **stack**: the **model**, the **store coordinator** (which talks to the SQLite file), and a **main-queue context** for the UI. It's the Core Data version of `ModelContainer`:

```swift
final class CoreDataStack {
    static let shared = CoreDataStack()
    let container: NSPersistentContainer

    init(inMemory: Bool = false) {
        container = NSPersistentContainer(name: "RecipeModel")    // matches RecipeModel.xcdatamodeld

        if inMemory {                                             // for tests and previews
            container.persistentStoreDescriptions.first?.url = URL(fileURLWithPath: "/dev/null")
        }

        container.loadPersistentStores { description, error in
            if let error {
                fatalError("Failed to load Core Data stack: \(error)")   // see note below
            }
        }

        container.viewContext.automaticallyMergesChangesFromParent = true   // see background saves (42.4)
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy   // 42.7
    }

    var viewContext: NSManagedObjectContext {
        container.viewContext
    }
}
```

- **`loadPersistentStores`** opens (or creates) the SQLite file. The store must be loaded **before** you use any context: until then, there's **no store** to read from or save to.
- **`viewContext`** is the context bound to the **main queue**: use it for **UI** work.
- **`automaticallyMergesChangesFromParent = true`** makes the view context **pick up** changes saved by **background** contexts. Almost every app wants this.

In SwiftUI, put the context in the environment, and use **`@FetchRequest`** (the ancestor of `@Query`):

```swift
@main
struct RecipeApp: App {
    var body: some Scene {
        WindowGroup {
            RecipeListView()
                .environment(\.managedObjectContext, CoreDataStack.shared.viewContext)
        }
    }
}

struct RecipeListView: View {
    @FetchRequest(sortDescriptors: [SortDescriptor(\.title)]) private var recipes: FetchedResults<Recipe>

    var body: some View {
        List(recipes) { Text($0.wrappedTitle) }
    }
}
```

⚠️ `fatalError` on a store error is common in templates, but in a shipping app a failed load (for example, a broken migration) should be **reported** and handled, not just crash on every launch.

---

## 42.4 Contexts and perform / performAndWait 🟡

An **`NSManagedObjectContext`** belongs to **one queue**: the **main** queue (`viewContext`), or its **own private** queue (background contexts). **All** access to a context and its objects must happen **on that queue**. You get onto the right queue with **`perform`**:

```swift
let backgroundContext = container.newBackgroundContext()

// Older closure style
backgroundContext.perform {
    let recipe = Recipe(context: backgroundContext)
    recipe.title = "Pasta"
    try? backgroundContext.save()
}

// Modern async style (iOS 15)
try await backgroundContext.perform {
    let recipe = Recipe(context: backgroundContext)
    recipe.title = "Pasta"
    try backgroundContext.save()
}
```

| Method | Behavior |
|---|---|
| `perform { }` | **Schedules** the work on the context's queue and returns **right away** |
| `performAndWait { }` | Runs the work on the context's queue and **waits** for it (blocks the caller) |
| `try await perform { }` | Runs it, and lets you **await** the result without blocking a thread |

This is like **actor isolation** (19): one queue owns the data. The difference: actors are **checked by the compiler**; Core Data's rule is only a **convention**. Break it, and you get **random crashes** and **corrupted** data, often much later. Turn on this **launch argument** while developing to catch mistakes immediately:

```
-com.apple.CoreData.ConcurrencyDebug 1
```

Managed objects **belong** to their context. To use an object in another context, pass its **`objectID`** (which **is** safe to pass) and look it up there:

```swift
let id = recipe.objectID                              // safe to send anywhere
try await backgroundContext.perform {
    let sameRecipe = try backgroundContext.existingObject(with: id) as! Recipe
    sameRecipe.isFavorite = true
    try backgroundContext.save()
}
```

It's the same rule as SwiftData's `persistentModelID` (41.15).

---

## 42.5 Fetch Requests and Predicates 🟢

An **`NSFetchRequest`** describes a **query**. An **`NSPredicate`** is its **filter**, written as a **format string**:

```swift
func fetchQuickRecipes(context: NSManagedObjectContext) throws -> [Recipe] {
    let request: NSFetchRequest<Recipe> = Recipe.fetchRequest()     // typed request
    request.predicate = NSPredicate(format: "minutesToCook <= %d", 20)
    request.sortDescriptors = [NSSortDescriptor(key: "title", ascending: true)]
    request.fetchLimit = 50
    return try context.fetch(request)                               // [Recipe]
}
```

Format string basics:

```swift
NSPredicate(format: "title == %@", "Pasta")                     // %@ for objects (String, Date…)
NSPredicate(format: "minutesToCook < %d", 30)                   // %d for integers
NSPredicate(format: "title CONTAINS[cd] %@", search)            // [c] case- and [d] accent-insensitive
NSPredicate(format: "%K == %@", #keyPath(Recipe.title), "Pasta") // %K + #keyPath: checked key names
NSPredicate(format: "isFavorite == YES AND minutesToCook < 30")
NSPredicate(format: "ANY ingredients.name == %@", "Garlic")      // through a to-many relationship
```

The big difference from SwiftData's **`#Predicate`** (41.9): a format string is **just a string**. The compiler can't check that `minutesToCook` **exists**, or that the **types** match:

```swift
NSPredicate(format: "minutesToCok <= %d", 20)    // typo: compiles fine, CRASHES at run time
#Predicate<Recipe> { $0.minutesToCok <= 20 }     // typo: compile error
```

Never build predicates by **gluing** user input into the format string itself: always pass values as **arguments** (`%@`), like the URL query rule in 39.4.

**`#keyPath(Recipe.title)`** with `%K` gives **some** compile-time checking of key names. It's a good habit in Core Data code.

---

## 42.6 NSFetchedResultsController 🟡

**`NSFetchedResultsController`** (FRC) connects a **fetch request** to a **UIKit** table or collection view (37). It **watches** the context and tells you **what changed** (inserts, deletes, moves, updates), so the list can **animate** correctly.

The **modern** way (iOS 13+) gives you a ready-made **diffable snapshot** (37.9):

```swift
final class RecipeListViewController: UITableViewController, NSFetchedResultsControllerDelegate {
    private let context: NSManagedObjectContext
    private var dataSource: UITableViewDiffableDataSource<String, NSManagedObjectID>!

    private lazy var fetchedResultsController: NSFetchedResultsController<Recipe> = {
        let request: NSFetchRequest<Recipe> = Recipe.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(key: "title", ascending: true)]
        let controller = NSFetchedResultsController(
            fetchRequest: request,
            managedObjectContext: context,
            sectionNameKeyPath: nil,           // a key path here groups rows into sections
            cacheName: nil
        )
        controller.delegate = self
        return controller
    }()

    init(context: NSManagedObjectContext) {
        self.context = context
        super.init(style: .plain)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "Cell")
        dataSource = UITableViewDiffableDataSource(tableView: tableView) { [weak self] tableView, indexPath, objectID in
            let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
            let recipe = self?.context.object(with: objectID) as? Recipe
            var content = cell.defaultContentConfiguration()
            content.text = recipe?.wrappedTitle
            cell.contentConfiguration = content
            return cell
        }
        try? fetchedResultsController.performFetch()
    }

    // The FRC hands us a snapshot of the current results whenever they change
    func controller(_ controller: NSFetchedResultsController<NSFetchRequestResult>,
                    didChangeContentWith snapshot: NSDiffableDataSourceSnapshotReference) {
        let snapshot = snapshot as NSDiffableDataSourceSnapshot<String, NSManagedObjectID>
        dataSource.apply(snapshot, animatingDifferences: true)
    }
}
```

Before diffable data sources, FRC's **older** delegate methods (`controller(_:didChange:at:for:newIndexPath:)`, between `controllerWillChangeContent` and `controllerDidChangeContent`) were the standard way to call `insertRows`/`deleteRows` by hand. You'll see that style in older code.

In **SwiftUI**, you don't need FRC: **`@FetchRequest`** (42.3) does the same job. FRC remains the go-to for **Core Data + UIKit** lists.

---

## 42.7 Parent/Child Contexts and Merge Policies 🟡

A context's **parent** can be **another context**, not the store. Saving a **child** pushes its changes **up to the parent** only, **not** to disk. That's perfect for **"scratchpad"** edits that the user might **cancel**:

```swift
// An "Edit Recipe" sheet works in a child context
let editContext = NSManagedObjectContext(concurrencyType: .mainQueueConcurrencyType)
editContext.parent = container.viewContext

let draft = editContext.object(with: recipe.objectID) as! Recipe
draft.title = "New Title"                // the main UI doesn't see this yet

// Cancel: throw the changes away
editContext.rollback()

// Save: push to the parent, then save the parent to disk
try editContext.save()                   // → viewContext now has the changes (still in memory)
try container.viewContext.save()         // → written to disk
```

**Merge policies** decide what happens when two contexts changed the **same object** in **different** ways, and one of them saves:

| Policy | On a conflict |
|---|---|
| `NSErrorMergePolicy` (the default) | The save **fails** with an error |
| `NSMergeByPropertyObjectTrumpMergePolicy` | **This context's** changed properties win |
| `NSMergeByPropertyStoreTrumpMergePolicy` | The **store's** (other context's) values win |
| `NSOverwriteMergePolicy` | This context's **whole object** overwrites |

With **several** contexts (the UI, background imports, a child editor), conflicts **will** happen sometimes. Without a merge policy, saves just **fail**. Most apps set `NSMergeByPropertyObjectTrumpMergePolicy` on the view context (as in 42.3), so the user's edits win.

---

## 42.8 Batch Insert, Update, and Delete 🔴

Normal Core Data work loads each object into memory, changes it, and saves it. For **thousands** of objects, that's **slow** and uses lots of memory. **Batch requests** run **directly in the database** (as SQL), without loading objects:

```swift
// Update many rows at once
func bulkMarkArchived(before cutoff: Date, in context: NSManagedObjectContext) throws {
    let batchUpdate = NSBatchUpdateRequest(entityName: "Recipe")
    batchUpdate.predicate = NSPredicate(format: "lastViewed < %@", cutoff as NSDate)
    batchUpdate.propertiesToUpdate = ["isArchived": true]
    batchUpdate.resultType = .updatedObjectIDsResultType          // ask for the changed IDs

    let result = try context.execute(batchUpdate) as? NSBatchUpdateResult
    let changedIDs = result?.result as? [NSManagedObjectID] ?? []

    // Batch requests skip the contexts, so TELL them what changed
    NSManagedObjectContext.mergeChanges(
        fromRemoteContextSave: [NSUpdatedObjectsKey: changedIDs],
        into: [container.viewContext]
    )
}

// Insert many rows at once (iOS 13+)
func importRecipes(_ dtos: [RecipeDTO], in context: NSManagedObjectContext) throws {
    let insert = NSBatchInsertRequest(entityName: "Recipe",
                                      objects: dtos.map { ["title": $0.title, "minutesToCook": $0.minutes] })
    try context.execute(insert)
}

// Delete many rows at once
let delete = NSBatchDeleteRequest(fetchRequest: NSFetchRequest<NSFetchRequestResult>(entityName: "Recipe"))
delete.resultType = .resultTypeObjectIDs
```

Why they're **fast**: one SQL statement updates 10,000 rows, instead of creating 10,000 objects, changing each, and saving them one by one.

The **catch**: batch requests **bypass** the contexts. Objects already **in memory** don't know the database changed, so the UI can show **stale** data. Ask for the changed **object IDs** (`resultType`), and **merge** them into your contexts, as above. (If persistent history tracking is on, 42.11, contexts can also pick up these changes from the history.)

Batch requests also skip **validation** rules and **relationship** delete rules, so use them for **simple**, bulk changes.

---

## 42.9 Faulting and Prefetching 🟡

Core Data loads data **lazily**. A fetched object is often a **fault**: a **placeholder** that knows **which** object it is, but hasn't loaded its **data** yet. The first time you read a property, the fault **fires**: Core Data loads the data from the store.

This saves memory: a list of 10,000 recipes doesn't load 10,000 full objects up front. But it can cause the **N+1 query problem**:

```swift
let recipes = try context.fetch(Recipe.fetchRequest())        // 1 query

for recipe in recipes {
    print(recipe.ingredientsArray.count)                       // +1 query PER recipe!
}
// 100 recipes → 101 queries
```

Each `recipe.ingredients` is a fault, so each one fires **its own** query. The fix is **prefetching**: load the relationship **with** the first fetch:

```swift
let request: NSFetchRequest<Recipe> = Recipe.fetchRequest()
request.relationshipKeyPathsForPrefetching = ["ingredients"]    // fetch ingredients in the same go
let recipes = try context.fetch(request)                        // now just a couple of queries total
```

Other fetch settings that help:

```swift
request.fetchBatchSize = 20            // load full data 20 rows at a time, as the list scrolls
request.returnsObjectsAsFaults = false // load data now, if you KNOW you'll use all of it
request.propertiesToFetch = ["title"]  // only the columns you need
```

You can **see** faults firing with the SQL debug launch argument (`-com.apple.CoreData.SQLDebug 1`, 41.21): many tiny repeated `SELECT`s are the sign of an N+1 problem.

---

## 42.10 Lightweight Migration 🟡

When you change the model (add an attribute, rename an entity), existing users' data must be **migrated**. Core Data, like SwiftData (41.17), can do **simple** changes **automatically**. This is **lightweight migration**:

```swift
let description = container.persistentStoreDescriptions.first!
description.shouldMigrateStoreAutomatically = true        // migrate when the model changed
description.shouldInferMappingModelAutomatically = true   // figure out HOW by comparing the models
```

Together they mean: "if the store on disk uses an **older** model, work out the **differences** and **migrate** automatically". (Both are **already `true`** by default for `NSPersistentContainer`; setting them makes the intent clear.)

The workflow in Xcode:

1. Select the `.xcdatamodeld`, choose **Editor → Add Model Version**. Never edit the **shipped** version in place.
2. Make your changes in the **new** version, and set it as **current**.
3. For a **rename**, set the attribute's **Renaming ID** to the old name, so Core Data knows it's the same data.

| Lightweight can handle | Needs more |
|---|---|
| Adding attributes (optional or with a default) | Splitting one attribute into two |
| Removing attributes | Changing values in a custom way |
| Renaming (with a Renaming ID) | Big restructuring of relationships |
| Making a required attribute optional | |

For "needs more", the old way is a **mapping model** with custom code (heavyweight migration). Since iOS 17, **staged migrations** (`NSStagedMigrationManager`) let you combine lightweight steps with **custom code** between versions, much like SwiftData's `.custom` stages.

SwiftData's migrations run on this **same** Core Data machinery underneath.

---

## 42.11 Persistent History Tracking 🔴

**Persistent history tracking** keeps a **log** of every change saved to the store: **what** was inserted, updated, or deleted, **when**, and by **whom** (which process or context).

Why you'd want it: when **several processes** write to the **same** store (the app **and** a widget or share extension, with a shared App Group store, 41.20), each needs to know what the **others** changed. Without a log, you'd have to **compare everything**. With it, you just ask: "**what changed since I last looked?**"

**Turn it on**, before loading the stores:

```swift
let description = container.persistentStoreDescriptions.first!
description.setOption(true as NSNumber, forKey: NSPersistentHistoryTrackingKey)
// Also post a notification when ANOTHER process changes the store:
description.setOption(true as NSNumber, forKey: NSPersistentStoreRemoteChangeNotificationPostOptionKey)
```

**Read** new changes and **merge** them into the UI's context:

```swift
var lastToken: NSPersistentHistoryToken?        // persist this (e.g., in UserDefaults as Data)

func mergeNewHistory(in context: NSManagedObjectContext) throws {
    let request = NSPersistentHistoryChangeRequest.fetchHistory(after: lastToken)
    guard let result = try context.execute(request) as? NSPersistentHistoryResult,
          let transactions = result.result as? [NSPersistentHistoryTransaction] else { return }

    for transaction in transactions {
        context.mergeChanges(fromContextDidSave: transaction.objectIDNotification())
        lastToken = transaction.token
    }
}

// Call it when another process changes the store
NotificationCenter.default.addObserver(forName: .NSPersistentStoreRemoteChange,
                                       object: container.persistentStoreCoordinator,
                                       queue: nil) { _ in
    // hop to the context's queue, then mergeNewHistory(in:)
}
```

Remember to **delete old history** now and then (`NSPersistentHistoryChangeRequest.deleteHistory(before:)`), or the log grows forever.

This log is also what **CloudKit sync** (42.12) uses to know what to upload, which is why `NSPersistentCloudKitContainer` turns it on for you.

---

## 42.12 NSPersistentCloudKitContainer 🟡

**`NSPersistentCloudKitContainer`** is a **drop-in replacement** for `NSPersistentContainer` that **syncs** the store with **iCloud** (CloudKit, 44) across the user's devices:

```swift
final class CloudSyncedCoreDataStack {
    let container: NSPersistentCloudKitContainer

    init() {
        container = NSPersistentCloudKitContainer(name: "RecipeModel")    // just a different class
        container.loadPersistentStores { description, error in
            if let error { fatalError("Failed to load: \(error)") }
        }
        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }
}
```

Plus the same Xcode setup as SwiftData: the **iCloud** capability with **CloudKit** and a container, and **Background Modes → Remote notifications**.

It's the **predecessor** of SwiftData's `cloudKitDatabase: .automatic` (41.18). In fact, SwiftData's CloudKit sync is **built on** this same mechanism. That's why the **model rules** are the same (41.19):

- Attributes must be **optional** or have **defaults**.
- **No unique constraints**.
- **Relationships** must be **optional** (and have inverses).

The reason is the same too: CloudKit is a record store that syncs **eventually**, between devices that may be **offline** and on **different app versions**. It can't enforce SQL-style guarantees.

During development, call **`try container.initializeCloudKitSchema()`** once to create the CloudKit record types from your model. Then **deploy** the schema to **production** in the CloudKit Console before shipping.

---

## 42.13 Coexisting Core Data and SwiftData 🔴

SwiftData uses Core Data's storage engine, so **both** frameworks can work with the **same** store file. Apple supports this for **gradual** migration: an existing Core Data app can build **new** features with SwiftData, without rewriting the old data layer all at once.

```swift
// SwiftData side: point at the SAME store file the Core Data stack uses
let storeURL = URL.applicationSupportDirectory.appending(path: "RecipeModel.sqlite")
let configuration = ModelConfiguration(url: storeURL)
let container = try ModelContainer(for: Recipe.self, configurations: configuration)
```

What must line up:

- **Entity names** in the `.xcdatamodeld` must match the SwiftData **class names**, and the **attributes** must match in name and type.
- **Class names can't clash**: if both frameworks define a Swift class called `Recipe`, rename the Core Data one (for example, `CDRecipe`, by setting the entity's **Class** name in the model editor).
- Turn on **persistent history tracking** (42.11) in the Core Data stack, so changes made by one side are seen by the other.
- **Both schemas must stay in sync** whenever the model changes. Every model change now has to be made **twice**.

It's the persistence version of the step-by-step UIKit → SwiftUI strategy (38): new parts in the new framework, old parts left alone until it's worth moving them.

This is **advanced** territory with real costs. Use it as a **temporary bridge** during a migration. For a **new** app, pick **one** framework.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Continued relevance | Legacy codebases, capability gaps | Read, maintain, and extend existing apps |
| Schema definition | `.xcdatamodeld`, `NSManagedObject`, `@NSManaged` | A visual model; Swift classes mirror it |
| Stack setup | `NSPersistentContainer`, `viewContext` | Load stores first; merge background changes |
| Thread-safe access | `perform`/`performAndWait`, `objectID` | Each context has its own queue; pass IDs between them |
| Filtering | `NSFetchRequest`, `NSPredicate` | String-based filters; use arguments and `#keyPath` |
| UIKit list integration | `NSFetchedResultsController` | Live, animated lists; diffable snapshots |
| Multi-context architecture | Parent/child contexts, `mergePolicy` | Cancellable edits; decide who wins conflicts |
| Bulk operations | `NSBatch*Request`, `mergeChanges` | SQL-level speed; then tell contexts what changed |
| Lazy loading | Faults, `relationshipKeyPathsForPrefetching` | Avoid N+1 queries |
| Schema evolution | Model versions, lightweight/staged migration | Automatic for simple changes; code for the rest |
| Change tracking | Persistent history tracking | "What changed since I last looked?" across processes |
| Multi-device sync | `NSPersistentCloudKitContainer` | iCloud sync; same model rules as SwiftData |
| Migration bridge | Shared store URL | A temporary bridge from Core Data to SwiftData |
