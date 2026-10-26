**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**`UITableView`** (a vertical list) and **`UICollectionView`** (lists, grids, and any custom layout) are the workhorses of UIKit apps. Both work the same way: they **ask your code** for the number of items and for each **cell**, and they **reuse** a small set of cells while the user scrolls. This section covers the classic data source pattern, cell reuse and sizing, layouts, prefetching, and updating content with animations, plus the modern APIs that make all of it safer.

---

## 37.1 UITableView Data Source and Delegate Patterns 🟢

A table view is driven by **two** protocols (the delegate pattern from 35.7):

- **`UITableViewDataSource`**: **what** to show. How many rows? Which cell for each row?
- **`UITableViewDelegate`**: **behavior and look**. What happens on tap? Swipe actions? Headers?

```swift
class FeedViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
    private let tableView = UITableView()
    private var items: [FeedItem] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        view.addSubview(tableView)
        tableView.frame = view.bounds
        tableView.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "FeedCell")
        tableView.dataSource = self
        tableView.delegate = self
    }

    // DATA SOURCE: how many rows?
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        items.count
    }

    // DATA SOURCE: the cell for one row
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "FeedCell", for: indexPath)
        let item = items[indexPath.row]

        var content = cell.defaultContentConfiguration()   // the standard cell layout (iOS 14)
        content.text = item.title
        content.secondaryText = item.subtitle
        content.image = UIImage(systemName: "doc.text")
        cell.contentConfiguration = content
        return cell
    }

    // DELEGATE: the user tapped a row
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let item = items[indexPath.row]
        navigationController?.pushViewController(DetailViewController(item: item), animated: true)
    }
}
```

The table view itself knows **nothing** about your data. It just **asks**, and your code answers. That keeps `UITableView` **generic**: the same class shows contacts, messages, or settings.

When the data changes, tell the table to **ask again**:

```swift
items = newItems
tableView.reloadData()     // re-asks everything; no animation (see 37.9 for animated updates)
```

| SwiftUI | UIKit |
|---|---|
| `List(items) { ... }` | Data source: `numberOfRows` + `cellForRowAt` |
| A tap on a `NavigationLink` | Delegate: `didSelectRowAt` |
| `.swipeActions` | Delegate: `trailingSwipeActionsConfigurationForRowAt` |

---

## 37.2 Cell Reuse and UITableViewCell 🟢

A table with **10,000** rows doesn't create 10,000 cells. It creates only enough to **fill the screen** (plus a few). When a cell **scrolls off** the top, it's put in a **reuse queue**, and **reused** for a row coming in at the bottom, with new content.

This keeps **memory** low and scrolling **fast**: creating views is expensive; updating a label's text is cheap.

```swift
class FeedCell: UITableViewCell {
    static let reuseIdentifier = "FeedCell"

    private let titleLabel = UILabel()
    private let bodyLabel = UILabel()
    private let avatarImageView = UIImageView()

    // ONE-TIME setup: runs once per cell object
    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        avatarImageView.layer.cornerRadius = 20
        avatarImageView.clipsToBounds = true
        titleLabel.font = .preferredFont(forTextStyle: .headline)
        bodyLabel.numberOfLines = 0
        // add subviews and constraints to contentView here
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // EVERY reuse: show this row's data
    func configure(with item: FeedItem) {
        titleLabel.text = item.title
        bodyLabel.text = item.body
        avatarImageView.image = item.avatar
    }
}

// Register once, then dequeue in cellForRowAt:
tableView.register(FeedCell.self, forCellReuseIdentifier: FeedCell.reuseIdentifier)

let cell = tableView.dequeueReusableCell(withIdentifier: FeedCell.reuseIdentifier, for: indexPath) as! FeedCell
cell.configure(with: items[indexPath.row])
```

| Method | When it runs | Use for |
|---|---|---|
| `init(style:reuseIdentifier:)` or `awakeFromNib()` | **Once**, when the cell is created | Fonts, colors, subviews, constraints |
| `configure(with:)` (your own) | **Every** time the cell shows a row | Text, images, state for **this** row |
| `prepareForReuse()` | Just **before** reuse (37.5) | Reset leftover state |

Keeping **setup** and **configure** separate is important. Setup that runs on every reuse wastes time (or adds a subview **again and again**). Data that's set only once shows the **wrong** row's content after reuse.

⚠️ Register the right thing: a **class** for a code-only cell, or a **`UINib`** for a cell designed in a XIB (35.6). Registering the class of a XIB-based cell skips the XIB, so all its `@IBOutlet`s are `nil`, and it crashes.

You can also put a **SwiftUI** view inside a UIKit cell, with **`UIHostingConfiguration`** (iOS 16):

```swift
cell.contentConfiguration = UIHostingConfiguration {
    HStack {
        Image(systemName: "star.fill").foregroundStyle(.yellow)
        Text(item.title)
    }
}
```

---

## 37.3 Self-Sizing and Dynamic Cell Heights 🟢

Rows with different amounts of text need **different heights**. Instead of computing heights by hand, let each cell **size itself** with Auto Layout (36.9):

```swift
class DynamicHeightCell: UITableViewCell {
    private let titleLabel = UILabel()
    private let descriptionLabel = UILabel()

    override init(style: UITableViewCell.CellStyle, reuseIdentifier: String?) {
        super.init(style: style, reuseIdentifier: reuseIdentifier)
        descriptionLabel.numberOfLines = 0                 // allow wrapping
        [titleLabel, descriptionLabel].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            contentView.addSubview($0)
        }
        let margins = contentView.layoutMarginsGuide
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: margins.topAnchor),
            titleLabel.leadingAnchor.constraint(equalTo: margins.leadingAnchor),
            titleLabel.trailingAnchor.constraint(equalTo: margins.trailingAnchor),
            descriptionLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            descriptionLabel.leadingAnchor.constraint(equalTo: margins.leadingAnchor),
            descriptionLabel.trailingAnchor.constraint(equalTo: margins.trailingAnchor),
            descriptionLabel.bottomAnchor.constraint(equalTo: margins.bottomAnchor)   // closes the chain
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func configure(with item: Article) {
        titleLabel.text = item.title
        descriptionLabel.text = item.description
    }
}

// In the view controller:
override func viewDidLoad() {
    super.viewDidLoad()
    tableView.rowHeight = UITableView.automaticDimension   // the default since iOS 11
    tableView.estimatedRowHeight = 100                     // a rough guess
}
```

**`rowHeight = UITableView.automaticDimension`** tells the table: "ask each cell's **constraints** how tall it needs to be". The table fixes the cell's **width** to its own width and asks for the **height** (that's `systemLayoutSizeFitting`, 36.9).

**`estimatedRowHeight`** is a **guess** used **before** a row is actually measured. The table uses it to compute the **total content height** (and the scroll bar size) **without** laying out thousands of cells up front. It doesn't need to be exact, but a **closer** guess means less **jumping** of the scroll bar and content.

For self-sizing to work, the constraints must form a **complete chain** from the **top** of `contentView` to its **bottom**. If the bottom one is missing, every row collapses to the estimated height.

The old way was a **fixed** `rowHeight`, or computing each height in `heightForRowAt` by **measuring text yourself**: slower to write and easy to get wrong (especially with Dynamic Type).

---

## 37.4 UICollectionView and Flow Layout 🟡

A **`UICollectionView`** is the more **flexible** cousin of the table view. The data source pattern is the same (with `item` instead of `row`), but **where** cells go is decided by a separate **layout** object. The classic one is **`UICollectionViewFlowLayout`**: items flow along a line and **wrap**, like text.

```swift
class GridViewController: UIViewController, UICollectionViewDataSource, UICollectionViewDelegateFlowLayout {
    private var items: [Photo] = []

    private let collectionView: UICollectionView = {
        let layout = UICollectionViewFlowLayout()
        layout.itemSize = CGSize(width: 100, height: 100)
        layout.minimumInteritemSpacing = 10      // between items in the SAME row
        layout.minimumLineSpacing = 10           // between ROWS
        layout.sectionInset = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        return UICollectionView(frame: .zero, collectionViewLayout: layout)
    }()

    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        items.count
    }

    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "GridCell", for: indexPath) as! GridCell
        cell.configure(with: items[indexPath.item])
        return cell
    }

    // A different size per item, if needed
    func collectionView(_ collectionView: UICollectionView,
                        layout collectionViewLayout: UICollectionViewLayout,
                        sizeForItemAt indexPath: IndexPath) -> CGSize {
        let columns: CGFloat = 3
        let spacing: CGFloat = 10 * (columns - 1) + 32          // gaps + section insets
        let side = (collectionView.bounds.width - spacing) / columns
        return CGSize(width: side, height: side)                 // 3 square columns at any width
    }
}
```

For a **vertical** flow layout:

| Property | Space |
|---|---|
| `minimumInteritemSpacing` | Between items **in the same row** (side by side) |
| `minimumLineSpacing` | Between **rows** (one line and the next) |
| `sectionInset` | Around the **whole section** |

They're **minimums**: flow layout may add **more** space between items to fill a row evenly.

For most **new** code, Apple recommends **`UICollectionViewCompositionalLayout`** (iOS 13). You build layouts from **items**, **groups**, and **sections**, and you can mix lists, grids, and carousels in one screen:

```swift
let layout = UICollectionViewCompositionalLayout { sectionIndex, environment in
    let item = NSCollectionLayoutItem(layoutSize: .init(widthDimension: .fractionalWidth(1/3),
                                                       heightDimension: .fractionalWidth(1/3)))
    item.contentInsets = NSDirectionalEdgeInsets(top: 2, leading: 2, bottom: 2, trailing: 2)
    let group = NSCollectionLayoutGroup.horizontal(layoutSize: .init(widthDimension: .fractionalWidth(1),
                                                                     heightDimension: .fractionalWidth(1/3)),
                                                   subitems: [item])
    let section = NSCollectionLayoutSection(group: group)
    // section.orthogonalScrollingBehavior = .groupPaging   // turns this section into a carousel
    return section
}

// A list that looks like a table view, with swipe actions:
let listLayout = UICollectionViewCompositionalLayout.list(using: .init(appearance: .insetGrouped))
```

---

## 37.5 Collection View Cells and Supplementary Views 🟡

Collection view cells are **reused** like table cells. Collection views also have **supplementary views**: extra views placed by the layout, like **section headers** and **footers**. Both cells and supplementary views are subclasses of **`UICollectionReusableView`**, so both can be reused.

```swift
class ProductGridCell: UICollectionViewCell {
    static let reuseIdentifier = "ProductGridCell"

    let imageView = UIImageView()
    let priceLabel = UILabel()
    var imageTask: Task<Void, Never>?

    override func prepareForReuse() {
        super.prepareForReuse()
        imageTask?.cancel()          // stop loading the OLD row's image
        imageView.image = nil        // don't show the old image for a moment
        priceLabel.text = nil
    }

    func configure(with product: Product) {
        priceLabel.text = product.price.formatted(.currency(code: "USD"))
    }
}

class SectionHeaderView: UICollectionReusableView {
    static let reuseIdentifier = "SectionHeader"
    let titleLabel = UILabel()
}

// Registration:
collectionView.register(ProductGridCell.self, forCellWithReuseIdentifier: ProductGridCell.reuseIdentifier)
collectionView.register(SectionHeaderView.self,
                        forSupplementaryViewOfKind: UICollectionView.elementKindSectionHeader,
                        withReuseIdentifier: SectionHeaderView.reuseIdentifier)

// Providing the supplementary view:
func collectionView(_ collectionView: UICollectionView,
                    viewForSupplementaryElementOfKind kind: String,
                    at indexPath: IndexPath) -> UICollectionReusableView {
    let header = collectionView.dequeueReusableSupplementaryView(
        ofKind: kind, withReuseIdentifier: SectionHeaderView.reuseIdentifier, for: indexPath
    ) as! SectionHeaderView
    header.titleLabel.text = sections[indexPath.section].title
    return header
}
```

**`prepareForReuse()`** runs right **before** a cell is reused. Use it to **reset** state from the **previous** row: clear images, cancel image downloads, reset selection styles. Without it, fast scrolling can briefly show the **old** row's picture, or worse, an old download **finishes late** and puts the **wrong** image in the cell.

A supplementary view is **registered** with a **kind** (like `elementKindSectionHeader`) and an identifier. The **layout** decides its size and position (for flow layout, set `headerReferenceSize`). The **data source** fills in its content, in `viewForSupplementaryElementOfKind`.

Since iOS 14, **registrations** make this type-safe, with no string identifiers or `as!` casts:

```swift
let cellRegistration = UICollectionView.CellRegistration<ProductGridCell, Product> { cell, indexPath, product in
    cell.configure(with: product)
}

// in cellForItemAt:
collectionView.dequeueConfiguredReusableCell(using: cellRegistration, for: indexPath, item: products[indexPath.item])
```

---

## 37.6 Scroll View Performance and Prefetching 🔴

Loading an image **when the cell appears** is often **too late**: the user sees an empty placeholder, then the image pops in. **Prefetching** tells you which rows are **coming soon**, so you can start loading **before** they're on screen.

```swift
final class PhotoGridViewController: UIViewController,
                                     UICollectionViewDataSource,
                                     UICollectionViewDataSourcePrefetching {
    private var items: [Photo] = []
    private var images: [Photo.ID: UIImage] = [:]                // loaded images (main actor only)
    private var loadTasks: [Photo.ID: Task<Void, Never>] = [:]   // downloads in progress
    private var collectionView: UICollectionView!

    override func viewDidLoad() {
        super.viewDidLoad()
        collectionView.prefetchDataSource = self
    }

    // Rows that will appear SOON: start loading
    func collectionView(_ collectionView: UICollectionView, prefetchItemsAt indexPaths: [IndexPath]) {
        for indexPath in indexPaths {
            startLoading(items[indexPath.item])
        }
    }

    // Rows that are no longer coming (the user scrolled back): stop loading
    func collectionView(_ collectionView: UICollectionView, cancelPrefetchingForItemsAt indexPaths: [IndexPath]) {
        for indexPath in indexPaths {
            let id = items[indexPath.item].id
            loadTasks[id]?.cancel()
            loadTasks[id] = nil
        }
    }

    private func startLoading(_ photo: Photo) {
        guard images[photo.id] == nil, loadTasks[photo.id] == nil else { return }   // done or in progress
        loadTasks[photo.id] = Task { [weak self] in
            guard let data = try? await URLSession.shared.data(from: photo.thumbnailURL).0,
                  let image = await UIImage(data: data)?.byPreparingForDisplay()   // decode off the main thread
            else { return }
            guard let self, !Task.isCancelled else { return }
            images[photo.id] = image
            loadTasks[photo.id] = nil

            // Update the cell for THIS photo, wherever it is now
            if let index = items.firstIndex(where: { $0.id == photo.id }) {
                collectionView.reconfigureItems(at: [IndexPath(item: index, section: 0)])
            }
        }
    }

    // cellForItemAt shows images[photo.id] if it's there, or a placeholder and startLoading(photo)
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int { items.count }
    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        let photo = items[indexPath.item]
        let cell = collectionView.dequeueReusableCell(withReuseIdentifier: "Photo", for: indexPath) as! PhotoCell
        if let image = images[photo.id] {
            cell.imageView.image = image
        } else {
            cell.imageView.image = nil
            startLoading(photo)
        }
        return cell
    }
}
```

Things this code gets **right** (and common bugs it avoids):

- **Find the cell by the photo's ID**, not by an old index path. The data may have **changed** while the image downloaded.
- **Keep state on the main actor.** The view controller is `@MainActor`, so `images` and `loadTasks` are only touched there. Changing a dictionary from a background `URLSession` callback would be a **data race** (20).
- **Cancel** work that's no longer needed, to save network and battery.
- **`byPreparingForDisplay()`** (iOS 15) **decodes** the image in the background. Otherwise, decoding happens on the main thread the first time the image is drawn, which causes **stutter**.
- **`reconfigureItems`** (iOS 15) updates the **existing** cell's content, which is cheaper than `reloadItems` (which creates a new cell).

Prefetching is a **hint**: it isn't called for every row (for example, on very fast scrolls). So `cellForItemAt` must **also** be able to start loading.

---

## 37.7 Custom Collection View Layouts 🔴

When built-in layouts can't do it, subclass **`UICollectionViewLayout`** and compute **every** frame yourself. A classic example is a **waterfall** (Pinterest-style) layout: equal-width columns, with items of **different heights**, each placed in the **shortest** column.

```swift
final class WaterfallLayout: UICollectionViewLayout {
    var columns = 2
    var spacing: CGFloat = 10
    var heightForItem: (IndexPath, CGFloat) -> CGFloat = { _, width in width }   // ask for each item's height

    private var cache: [UICollectionViewLayoutAttributes] = []
    private var contentHeight: CGFloat = 0

    // 1. Compute every item's frame, once per layout pass
    override func prepare() {
        super.prepare()
        guard let collectionView, columns > 0 else { return }
        cache.removeAll()

        let width = collectionView.bounds.width
        let columnWidth = (width - spacing * CGFloat(columns + 1)) / CGFloat(columns)
        var columnHeights = Array(repeating: spacing, count: columns)

        for item in 0..<collectionView.numberOfItems(inSection: 0) {
            let indexPath = IndexPath(item: item, section: 0)
            let column = columnHeights.indices.min { columnHeights[$0] < columnHeights[$1] }!  // shortest column
            let height = heightForItem(indexPath, columnWidth)
            let x = spacing + CGFloat(column) * (columnWidth + spacing)

            let attributes = UICollectionViewLayoutAttributes(forCellWith: indexPath)
            attributes.frame = CGRect(x: x, y: columnHeights[column], width: columnWidth, height: height)
            cache.append(attributes)

            columnHeights[column] += height + spacing
        }
        contentHeight = columnHeights.max() ?? 0
    }

    // 2. The total scrollable size
    override var collectionViewContentSize: CGSize {
        CGSize(width: collectionView?.bounds.width ?? 0, height: contentHeight)
    }

    // 3. Only the items inside a given rectangle (what's on or near the screen)
    override func layoutAttributesForElements(in rect: CGRect) -> [UICollectionViewLayoutAttributes]? {
        cache.filter { $0.frame.intersects(rect) }
    }

    override func layoutAttributesForItem(at indexPath: IndexPath) -> UICollectionViewLayoutAttributes? {
        cache[indexPath.item]
    }

    // Re-layout when the width changes (rotation, window resize)
    override func shouldInvalidateLayout(forBoundsChange newBounds: CGRect) -> Bool {
        newBounds.width != collectionView?.bounds.width
    }
}
```

The required pieces:

| Override | Job |
|---|---|
| `prepare()` | Compute and **cache** all frames |
| `collectionViewContentSize` | Report the total scrollable size |
| `layoutAttributesForElements(in:)` | Return attributes only for items in a **rect** |
| `layoutAttributesForItem(at:)` | Return one item's attributes |

Why return only the items **in the rect**? The collection view asks for the **visible area** (plus a little), many times while scrolling. With 10,000 items, it needs maybe **20**. Returning all 10,000 every time would waste work and make scrolling slow. (For huge layouts, a **binary search** on the sorted cache is faster than `filter`.)

The layout is **purely geometric**: it only computes **frames**. It never looks at **cells** or their content; it just gets heights through `heightForItem`. So the same layout works for **any** data and cell type.

Before writing one, check if a **compositional layout** (37.4) can do it: it covers most grids, lists, and carousels, with less code and fewer bugs.

---

## 37.8 Index Paths and Section Organization 🟢

Content can be split into **sections** (by letter, by date, by category). An **`IndexPath`** says **where** an item is: **which section**, and **which position** in that section.

```swift
class SectionedTableViewController: UIViewController, UITableViewDataSource {
    private var sections: [(title: String, fruits: [String])] = [
        ("A", ["Apple", "Apricot"]),           // section 0
        ("B", ["Banana", "Blackberry"]),       // section 1
        ("C", ["Cherry", "Clementine"])        // section 2
    ]

    func numberOfSections(in tableView: UITableView) -> Int {
        sections.count                         // how many sections
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        sections[section].fruits.count         // how many rows IN that section
    }

    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        sections[section].title
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        var content = cell.defaultContentConfiguration()
        content.text = sections[indexPath.section].fruits[indexPath.row]   // section first, then row
        cell.contentConfiguration = content
        return cell
    }
}
```

| Property | Meaning |
|---|---|
| `indexPath.section` | Which section |
| `indexPath.row` | Position in the section (**table** views) |
| `indexPath.item` | Position in the section (**collection** views) |

`row` and `item` hold the **same** number; they're just named for each view. Use `row` with tables and `item` with collections, to keep code readable.

**`numberOfSections(in:)`** says how many sections there are (the default is **1**). Then **`numberOfRowsInSection`** is called **once per section**.

Model your data the **same shape** as the table: an array of sections, each with an array of items. Then `sections[indexPath.section].items[indexPath.row]` maps directly, and there's little room for index bugs.

---

## 37.9 Editing and Updating Table/Collection Content 🟡

Tables and collections can **insert**, **delete**, and **move** rows **with animation**. The one rule that matters most:

**Update your data FIRST, then tell the view what changed. The two must always agree.**

```swift
class EditableTableViewController: UITableViewController {
    private var items: [String] = []

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        items.count
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        var content = cell.defaultContentConfiguration()
        content.text = items[indexPath.row]
        cell.contentConfiguration = content
        return cell
    }

    // Allow editing (swipe to delete, edit mode)
    override func tableView(_ tableView: UITableView, canEditRowAt indexPath: IndexPath) -> Bool {
        true
    }

    // The user confirmed a delete
    override func tableView(_ tableView: UITableView, commit editingStyle: UITableViewCell.EditingStyle,
                            forRowAt indexPath: IndexPath) {
        if editingStyle == .delete {
            items.remove(at: indexPath.row)                       // 1. data
            tableView.deleteRows(at: [indexPath], with: .fade)    // 2. view
        }
    }

    // Allow reordering, and apply it to the data
    override func tableView(_ tableView: UITableView, canMoveRowAt indexPath: IndexPath) -> Bool {
        true
    }

    override func tableView(_ tableView: UITableView, moveRowAt sourceIndexPath: IndexPath,
                            to destinationIndexPath: IndexPath) {
        let item = items.remove(at: sourceIndexPath.row)
        items.insert(item, at: destinationIndexPath.row)          // the view already moved the row
    }

    func insertNewItem() {
        items.append("New Item")                                  // 1. data
        let indexPath = IndexPath(row: items.count - 1, section: 0)
        tableView.insertRows(at: [indexPath], with: .automatic)   // 2. view
    }
}
```

- **`canEditRowAt`** turns on editing for a row (swipe to delete; delete buttons in edit mode).
- **`commit editingStyle`** is called when the user **confirms**: do the delete there.
- **`canMoveRowAt`** + **`moveRowAt`** enable drag to reorder; you update the data.

If the data and the view **disagree**, UIKit **crashes** with a message like: "*Invalid update: invalid number of rows in section 0. The number of rows contained in an existing section after the update (5) must be equal to …*". It recounts your data after each update, and checks the math.

For **several** changes at once, group them in **`performBatchUpdates`**, so they animate **together** and are checked **as one**:

```swift
tableView.performBatchUpdates {
    items.remove(at: 2)
    items.insert("Fresh", at: 0)
    tableView.deleteRows(at: [IndexPath(row: 2, section: 0)], with: .fade)
    tableView.insertRows(at: [IndexPath(row: 0, section: 0)], with: .automatic)
}
// (older code: tableView.beginUpdates() … tableView.endUpdates())
```

Getting every index right by hand is **error-prone**. The modern answer is a **diffable data source** (iOS 13): you describe **what** the data is now, and UIKit **computes** the inserts, deletes, and moves for you:

```swift
enum Section { case main }

var dataSource: UITableViewDiffableDataSource<Section, Item.ID>!

dataSource = UITableViewDiffableDataSource(tableView: tableView) { tableView, indexPath, itemID in
    let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
    // look up the item by ID and configure the cell
    return cell
}

func apply(_ items: [Item], animated: Bool = true) {
    var snapshot = NSDiffableDataSourceSnapshot<Section, Item.ID>()
    snapshot.appendSections([.main])
    snapshot.appendItems(items.map(\.id))
    dataSource.apply(snapshot, animatingDifferences: animated)   // animated, never out of sync
}
```

Use **IDs** (not whole models) as the item type, and call **`reconfigureItems`** on the snapshot when an item's **content** changes. It's the UIKit version of SwiftUI's `ForEach` with stable IDs (26.3).

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| List data provision | `UITableViewDataSource` | How many rows, and the cell for each |
| List interaction | `UITableViewDelegate` | Taps, swipe actions, headers |
| Cell reuse | `dequeueReusableCell`, `reuseIdentifier` | A few cells recycled for many rows |
| Cell lifecycle | `init`/`awakeFromNib`, `configure`, `prepareForReuse` | Setup once, fill per row, reset before reuse |
| Dynamic sizing | `UITableView.automaticDimension` | Heights from constraints; a full top-to-bottom chain |
| Grid layout | `UICollectionViewFlowLayout`, compositional layout | Wrapping grids; compositional for new code |
| Grid data | Data source, registrations, supplementary views | Cells plus headers and footers |
| Prefetching | `UICollectionViewDataSourcePrefetching` | Start loading before cells appear; cancel when not needed |
| Custom layouts | `UICollectionViewLayout` subclass | Cache frames in `prepare`; return only items in the rect |
| Organization | `IndexPath` `section` + `row`/`item` | Data shaped like the sections |
| Content updates | `insertRows`, `deleteRows`, `performBatchUpdates`, diffable data source | Data first, then the view; or let diffing do it |
