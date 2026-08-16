## 42.1 When You'll Still Meet Core Data

Despite SwiftData's emergence, Core Data remains directly relevant in several concrete scenarios: maintaining or extending an existing Core Data-based production app (a full migration to SwiftData is a significant undertaking rarely justified purely for its own sake), needing a capability SwiftData doesn't yet expose (certain fine-grained fetch/merge control, `NSFetchedResultsController`'s diffing for UIKit table/collection views), or working within a codebase that predates SwiftData's introduction entirely.

```swift
// A Core Data stack can coexist in an otherwise-modern Swift/SwiftUI app —
// understanding it isn't purely historical, it's a practical
// requirement for a meaningful fraction of real-world iOS codebases.
```

This mirrors the same practical reasoning laid out for UIKit's continued relevance in section 35.1 — legacy prevalence and specific capability gaps are the concrete reasons Core Data knowledge remains valuable, not because it represents the recommended starting point for a brand-new app in 2026.

---

## 42.2 The Managed Object Model and Entities

Core Data's schema — the "managed object model" — is defined visually in a `.xcdatamodeld` file as a set of entities (roughly analogous to SwiftData's `@Model` types), each with attributes and relationships, from which Xcode can generate corresponding `NSManagedObject` subclasses.

```swift
// Generated from the .xcdatamodeld editor (Editor > Create NSManagedObject Subclass):
@objc(Recipe)
public class Recipe: NSManagedObject {
    @NSManaged public var title: String
    @NSManaged public var minutesToCook: Int32
    @NSManaged public var ingredients: NSSet?
}
```

Unlike SwiftData's `@Model` macro (which derives everything from ordinary Swift code), Core Data's schema is authored separately in a visual editor and then code-generated (or manually declared) into Swift classes — this separation is the source of much of Core Data's additional ceremony compared to SwiftData, but also gives the visual model editor a role as an unambiguous, tooling-friendly source of truth for the schema, independent of any particular Swift class implementation.

---

## 42.3 NSPersistentContainer Setup

`NSPersistentContainer` bundles together the managed object model, the persistent store coordinator, and a main-queue managed object context — Core Data's equivalent of SwiftData's `ModelContainer`, though requiring more explicit setup.

```swift
class CoreDataStack {
    let container: NSPersistentContainer

    init() {
        container = NSPersistentContainer(name: "RecipeModel")
        container.loadPersistentStores { description, error in
            if let error {
                fatalError("Failed to load Core Data stack: \(error)")
            }
        }
    }

    var viewContext: NSManagedObjectContext {
        container.viewContext
    }
}
```

`loadPersistentStores` performs the actual disk I/O of opening (or creating) the underlying SQLite store, and must complete before the container's `viewContext` is usable — the closure-based completion handler here predates `async`/`await`'s widespread adoption in Core Data's own APIs, reflecting the framework's older API design compared to SwiftData's more modern, concurrency-native shape.

---

## 42.4 Contexts and perform / performAndWait

An `NSManagedObjectContext` is tied to a specific queue (main-queue or private-queue), and all access to it must happen via that queue — `perform`/`performAndWait` are the required mechanisms for safely executing work on a context's associated queue, roughly analogous to actor isolation (section 19) but predating Swift's actor system.

```swift
let backgroundContext = container.newBackgroundContext()

backgroundContext.perform {
    let recipe = Recipe(context: backgroundContext)
    recipe.title = "Pasta"
    try? backgroundContext.save()
}
```

`perform` asynchronously schedules the closure onto the context's own private queue and returns immediately, while `performAndWait` blocks the calling thread until the closure completes — directly accessing a context's managed objects from a queue other than its own associated one is a data race, precisely the same category of bug actor isolation was designed to prevent at the language level, except here it's an API convention that must be manually followed rather than something the compiler enforces.

---

## 42.5 Fetch Requests and Predicates

`NSFetchRequest` describes a query against the store, and `NSPredicate` (Core Data's older, string-based filtering mechanism, contrasted with SwiftData's compile-checked `#Predicate` from section 41.9) expresses the filter condition.

```swift
func fetchQuickRecipes(context: NSManagedObjectContext) throws -> [Recipe] {
    let request = Recipe.fetchRequest()
    request.predicate = NSPredicate(format: "minutesToCook <= %d", 20)
    request.sortDescriptors = [NSSortDescriptor(key: "title", ascending: true)]
    return try context.fetch(request) as! [Recipe]
}
```

`NSPredicate(format:)` uses a printf-style format string with placeholder substitution (`%d`, `%@`, etc.) — functional, but stringly-typed in a way that offers no compile-time verification that the property name (`"minutesToCook"`) actually exists or that the types line up, unlike `#Predicate`'s genuine Swift closure syntax. This is one of the most concrete, tangible ergonomic differences a developer moving between the two frameworks will notice immediately.

---

## 42.6 NSFetchedResultsController

`NSFetchedResultsController` is a specialized helper for driving a `UITableView`/`UICollectionView` (section 37) from a Core Data fetch, automatically computing and reporting the specific inserted/deleted/moved rows needed to animate table updates correctly as the underlying data changes.

```swift
class RecipeListViewController: UITableViewController, NSFetchedResultsControllerDelegate {
    lazy var fetchedResultsController: NSFetchedResultsController<Recipe> = {
        let request = Recipe.fetchRequest()
        request.sortDescriptors = [NSSortDescriptor(key: "title", ascending: true)]
        let controller = NSFetchedResultsController(
            fetchRequest: request,
            managedObjectContext: context,
            sectionNameKeyPath: nil,
            cacheName: nil
        )
        controller.delegate = self
        return controller
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        try? fetchedResultsController.performFetch()
    }
}
```

This is conceptually the direct predecessor to diffable data sources (section 37.5) — before `NSDiffableDataSourceSnapshot` existed, `NSFetchedResultsControllerDelegate`'s callbacks (`controller(_:didChange:at:for:newIndexPath:)`) were the standard way to translate underlying Core Data changes into the specific `insertRows(at:)`/`deleteRows(at:)` calls a table view needs, and it remains a commonly-used, well-integrated tool specifically for Core Data-backed UIKit list screens.

---

## 42.7 Parent/Child Contexts and Merge Policies

Core Data supports a hierarchy of contexts, where a "child" context's parent is another context (rather than the persistent store directly) — changes saved in a child context are pushed up to its parent, not directly to disk, which is useful for scoping temporary or speculative edits (like an editable form) that might be discarded.

```swift
let childContext = NSManagedObjectContext(concurrencyType: .mainQueueConcurrencyType)
childContext.parent = container.viewContext

// Edits made in childContext can be discarded (childContext.rollback())
// or pushed up to the parent via childContext.save() — which itself
// doesn't touch disk until the parent context is also saved.
```

`mergePolicy` (set on a context, e.g., `NSMergeByPropertyObjectTrumpMergePolicy`) determines how conflicting changes are resolved when saving would otherwise conflict with the current state of the store — necessary because Core Data's multi-context model creates genuine opportunities for two different contexts to have diverging, conflicting edits to the same underlying object that need a defined resolution strategy when reconciled.

---

## 42.8 Batch Insert, Update, and Delete

For operations touching a large number of objects at once (importing thousands of records, bulk-updating a flag), `NSBatchInsertRequest`/`NSBatchUpdateRequest`/`NSBatchDeleteRequest` operate directly at the persistent store level, bypassing the overhead of loading each individual `NSManagedObject` into memory.

```swift
func bulkMarkArchived(in context: NSManagedObjectContext) throws {
    let batchUpdate = NSBatchUpdateRequest(entityName: "Recipe")
    batchUpdate.predicate = NSPredicate(format: "lastViewed < %@", oldDate as NSDate)
    batchUpdate.propertiesToUpdate = ["isArchived": true]
    batchUpdate.resultType = .updatedObjectsCountResultType

    try context.execute(batchUpdate)
}
```

Because these batch requests operate at the SQL level directly against the store (rather than fetching, modifying, and re-saving each individual `NSManagedObject`), they're dramatically more efficient for large-scale operations — the trade-off is that in-memory objects already loaded into a context aren't automatically updated to reflect the batch change, typically requiring an explicit `context.refreshAllObjects()` or similar step afterward to bring already-fetched objects back in sync with the batch-modified store state.

---

## 42.9 Faulting and Prefetching

A "fault" is Core Data's lazy-loading placeholder for a managed object (or relationship) that hasn't yet had its actual data pulled from the store — accessing a faulted property transparently triggers a fetch to "fire" the fault, but this can produce a subtle performance problem (the "N+1 query problem") if not managed carefully.

```swift
let request = Recipe.fetchRequest()
request.relationshipKeyPathsForPrefetching = ["ingredients"]
let recipes = try context.fetch(request)
// Without prefetching, accessing recipe.ingredients for EACH recipe in a loop
// would trigger a separate fault-firing fetch per recipe — a classic N+1 problem.
```

Without `relationshipKeyPathsForPrefetching`, iterating over a list of recipes and accessing each one's `ingredients` relationship would fire a separate fault (and separate SQL query) for every single recipe — a performance trap sometimes called the N+1 problem, since one initial query for recipes is followed by N additional queries, one per recipe, to fetch each one's relationship data. Explicitly prefetching relationships known to be needed avoids this by batching the relationship data into the original fetch.

---

## 42.10 Lightweight Migration

Like SwiftData's migration system (section 41.16–41.17), Core Data distinguishes lightweight migrations (simple, automatically-inferable schema changes) from more complex ones — enabled via `NSPersistentStoreDescription`'s automatic migration options.

```swift
let description = container.persistentStoreDescriptions.first!
description.shouldMigrateStoreAutomatically = true
description.shouldInferMappingModelAutomatically = true
```

`shouldMigrateStoreAutomatically` and `shouldInferMappingModelAutomatically` together enable Core Data to detect a schema mismatch between the store on disk and the current managed object model, and automatically infer and apply a lightweight migration for structurally simple changes (like adding a new optional attribute) — conceptually the direct predecessor to SwiftData's own lightweight migration behavior, since SwiftData's underlying migration machinery, in most configurations, is built on this same Core Data migration infrastructure.

---

## 42.11 Persistent History Tracking

Persistent history tracking records a durable, queryable log of every change (insert, update, delete) made to the store, enabling scenarios like efficiently syncing only what's changed since a given point, or correctly merging changes across multiple contexts/processes (like an app and its extension) accessing the same store.

```swift
let description = container.persistentStoreDescriptions.first!
description.setOption(true as NSNumber, forKey: NSPersistentHistoryTrackingKey)
description.setOption(true as NSNumber, forKey: NSPersistentStoreRemoteChangeNotificationPostOptionKey)
```

Enabling history tracking is essential infrastructure for scenarios involving multiple processes or contexts writing to the same store (like a widget extension and the main app both persisting to a shared App Group store, section 41.20) — rather than needing to compare entire datasets to figure out what changed, each process can query the persistent history log for exactly the transactions that occurred since it last checked, an approach that scales far better than full-dataset comparison as data grows.

---

## 42.12 NSPersistentCloudKitContainer

`NSPersistentCloudKitContainer` is a drop-in replacement for `NSPersistentContainer` that adds automatic CloudKit-backed multi-device sync to a Core Data stack — the direct historical predecessor to SwiftData's `cloudKitDatabase: .automatic` configuration (section 41.18).

```swift
class CloudSyncedCoreDataStack {
    let container: NSPersistentCloudKitContainer

    init() {
        container = NSPersistentCloudKitContainer(name: "RecipeModel")
        container.loadPersistentStores { description, error in
            if let error { fatalError("Failed to load: \(error)") }
        }
    }
}
```

Much like SwiftData's CloudKit integration, `NSPersistentCloudKitContainer` imposes analogous schema constraints (attributes generally must be optional or have defaults, no unique constraints) since it's ultimately mapping the same Core Data model onto the same underlying CloudKit record system — understanding this container is genuinely useful context for understanding *why* SwiftData's own CloudKit constraints (41.19) exist the way they do, since SwiftData's CloudKit sync behavior in many configurations is built directly on top of this same underlying mechanism.

---

## 42.13 Coexisting Core Data and SwiftData 🔴

Because SwiftData is built on Core Data's storage engine in most configurations, it's technically possible for a Core Data-based `.xcdatamodeld` schema and SwiftData `@Model` types to coexist and even share the same underlying SQLite store, though doing so requires careful, explicit configuration and is generally reserved for incremental migration scenarios rather than new development.

```swift
// Conceptual approach: point a SwiftData ModelConfiguration at the SAME
// store URL an existing Core Data NSPersistentContainer already uses,
// with entity/attribute names carefully aligned between the two schemas.
let configuration = ModelConfiguration(url: existingCoreDataStoreURL)
```

This coexistence pattern exists primarily to support gradual migration of an existing Core Data app toward SwiftData — similar in spirit to the incremental UIKit-to-SwiftUI migration strategy from section 38.9, but at the persistence layer: rather than a risky, all-at-once rewrite of an app's entire data layer, specific new features can be built against SwiftData `@Model` types pointed at the same store an existing Core Data stack continues to manage, with both frameworks' schemas kept carefully in sync. This is genuinely advanced, edge-case territory — most apps should choose one framework or the other rather than deliberately architecting for this kind of coexistence.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Continued relevance | Legacy codebases, capability gaps | Core Data remains practically necessary knowledge |
| Schema definition | `.xcdatamodeld`, `NSManagedObject` | Visually-authored model, code-generated classes |
| Stack setup | `NSPersistentContainer` | Model + store coordinator + main context |
| Thread-safe access | `perform`/`performAndWait` | Manually-enforced, queue-bound context access |
| Filtering | `NSFetchRequest`, `NSPredicate` | Stringly-typed query construction |
| UIKit list integration | `NSFetchedResultsController` | Predecessor to diffable data sources |
| Multi-context architecture | Parent/child contexts, `mergePolicy` | Scoped/discardable edits, conflict resolution |
| Bulk operations | `NSBatch*Request` | Store-level operations bypassing object loading |
| Lazy loading | Faults, `relationshipKeyPathsForPrefetching` | Avoid the N+1 query problem |
| Schema evolution | Lightweight migration options | Automatic inference for simple schema changes |
| Change tracking | Persistent history tracking | Durable, queryable change log for multi-process sync |
| Multi-device sync | `NSPersistentCloudKitContainer` | Predecessor to SwiftData's CloudKit integration |
| Migration bridge | Shared store URL | Careful, edge-case Core Data/SwiftData coexistence |
