## 37.1 UITableView Data Source and Delegate Patterns

`UITableView` is driven by two primary protocols: `UITableViewDataSource` (providing the data to display) and `UITableViewDelegate` (handling user interaction and visual customization).

```swift
class FeedViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
    private let tableView = UITableView()
    private var items: [FeedItem] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        tableView.dataSource = self
        tableView.delegate = self
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        items.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "FeedCell", for: indexPath)
        let item = items[indexPath.row]
        // configure cell with item
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let item = items[indexPath.row]
        // handle selection
    }
}
```

`numberOfRowsInSection` tells the table how many rows to display; `cellForRowAt` requests the cell to display at a specific index path (row and section); `didSelectRowAt` is called when the user taps a row. This data source/delegate split is foundational to UIKit's list UI, allowing the table view itself to remain generic while code provides the specific data and behavior.

---

## 37.2 Cell Reuse and UITableViewCell

To efficiently handle large lists, `UITableView` reuses cells — instead of creating a new cell for every visible row, a fixed pool of cells is recycled and their content is updated. Cell classes are registered with the table and dequeued by identifier.

```swift
class FeedCell: UITableViewCell {
    static let reuseIdentifier = "FeedCell"

    @IBOutlet weak var titleLabel: UILabel!
    @IBOutlet weak var bodyLabel: UILabel!
    @IBOutlet weak var avatarImageView: UIImageView!

    override func awakeFromNib() {
        super.awakeFromNib()
        // one-time setup (runs once per cell instance)
        avatarImageView.layer.cornerRadius = avatarImageView.bounds.width / 2
    }

    func configure(with item: FeedItem) {
        titleLabel.text = item.title
        bodyLabel.text = item.body
        avatarImageView.image = item.avatar
    }
}

// In view controller:
tableView.register(FeedCell.self, forCellReuseIdentifier: FeedCell.reuseIdentifier)
// or, if using XIB: tableView.register(UINib(nibName: "FeedCell", bundle: nil), forCellReuseIdentifier: FeedCell.reuseIdentifier)
```

A cell's `awakeFromNib()` (or `init(style:reuseIdentifier:)` for programmatic cells) is the place for one-time setup like corner radius or event handler attachment — it runs only once when the cell is first created, not on every reuse. The `configure(with:)` method is called every time the cell is reused to update its content to match the current data — this separation keeps setup logic separate from data-driven updates, preventing stale state from prior reuses.

---

## 37.3 Self-Sizing and Dynamic Cell Heights

Rather than manually calculating cell heights, `UITableView` can ask each cell to compute its own ideal height based on its content — the self-sizing mechanism using Auto Layout's `systemLayoutSizeFitting` (section 36.9).

```swift
class DynamicHeightCell: UITableViewCell {
    @IBOutlet weak var titleLabel: UILabel!
    @IBOutlet weak var descriptionLabel: UILabel!

    func configure(with item: Article) {
        titleLabel.text = item.title
        descriptionLabel.text = item.description
        descriptionLabel.numberOfLines = 0 // allow wrapping
    }
}

// In view controller:
override func viewDidLoad() {
    super.viewDidLoad()
    tableView.rowHeight = UITableView.automaticDimension
    tableView.estimatedRowHeight = 100 // provide a rough estimate for scrollbar/offset calculations
}
```

Setting `rowHeight = UITableView.automaticDimension` tells the table to compute each cell's height by running Auto Layout — the table calls `systemLayoutSizeFitting` internally, pinning the cell's width to the table's width and asking "what height does this content need?" The `estimatedRowHeight` is a performance hint; providing a reasonable estimate (not necessarily exact) lets the table calculate its scrollable content height and scroll bar size without laying out every cell upfront. Without self-sizing, you'd manually set `rowHeight` to a fixed value or implement `heightForRowAt` to calculate heights by hand, both more error-prone and less maintainable than letting Auto Layout do the work.

---

## 37.4 UICollectionView and Flow Layout

`UICollectionView` is a more flexible grid-based cousin of `UITableView`, typically arranged by a `UICollectionViewLayout` subclass — most commonly `UICollectionViewFlowLayout`, which arranges items in rows or columns with configurable spacing.

```swift
class GridViewController: UIViewController, UICollectionViewDataSource, UICollectionViewDelegateFlowLayout {
    private let collectionView: UICollectionView = {
        let layout = UICollectionViewFlowLayout()
        layout.itemSize = CGSize(width: 100, height: 100)
        layout.minimumInteritemSpacing = 10
        layout.minimumLineSpacing = 10
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

    func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, sizeForItemAt indexPath: IndexPath) -> CGSize {
        // dynamically compute size if needed
        CGSize(width: 100, height: 100)
    }
}
```

`UICollectionViewFlowLayout` arranges items linearly along an axis (horizontal or vertical) with configurable spacing — `minimumInteritemSpacing` controls spacing between items on the same line, `minimumLineSpacing` controls spacing between lines, and `sectionInset` adds margins around the entire section. `UICollectionViewDelegateFlowLayout` provides hooks like `sizeForItemAt` to customize individual item sizes, and `referenceSizeForHeader/Footer` for supplementary views.

---

## 37.5 Collection View Cells and Supplementary Views

Like table views, collection views use cell reuse — cells are registered, dequeued by identifier, and their content updated each time they're reused. Collection views additionally support "supplementary views" like headers and footers.

```swift
class ProductGridCell: UICollectionViewCell {
    static let reuseIdentifier = "ProductGridCell"

    @IBOutlet weak var imageView: UIImageView!
    @IBOutlet weak var priceLabel: UILabel!

    override func prepareForReuse() {
        super.prepareForReuse()
        imageView.image = nil
        priceLabel.text = nil
    }

    func configure(with product: Product) {
        imageView.image = product.image
        priceLabel.text = "$\(product.price)"
    }
}

class SectionHeaderView: UICollectionReusableView {
    static let reuseIdentifier = "SectionHeader"
    @IBOutlet weak var titleLabel: UILabel!
}

// Registration:
collectionView.register(ProductGridCell.self, forCellWithReuseIdentifier: ProductGridCell.reuseIdentifier)
collectionView.register(SectionHeaderView.self, forSupplementaryViewOfKind: UICollectionView.elementKindSectionHeader, withReuseIdentifier: SectionHeaderView.reuseIdentifier)

// Providing the supplementary view:
func collectionView(_ collectionView: UICollectionView, viewForSupplementaryElementOfKind kind: String, at indexPath: IndexPath) -> UICollectionReusableView {
    if kind == UICollectionView.elementKindSectionHeader {
        let header = collectionView.dequeueReusableSupplementaryView(ofKind: kind, withReuseIdentifier: SectionHeaderView.reuseIdentifier, for: indexPath) as! SectionHeaderView
        header.titleLabel.text = "Section \(indexPath.section)"
        return header
    }
    return UICollectionReusableView()
}
```

`prepareForReuse()` is called on a cell just before it's reused — the right place to clear image views, text, and any other state that might linger from the prior display, preventing the new content briefly showing old data during fast scrolling. Supplementary views like headers and footers are sized and positioned by the layout itself, but their content is still configured via data source methods.

---

## 37.6 Scroll View Performance and Prefetching 🟠

For smooth scrolling with large datasets, especially with network images or async operations, `UICollectionViewDataSourcePrefetching` allows the view to signal upcoming index paths so data can be loaded before the cells are actually needed.

```swift
class ScrollPerformanceViewController: UIViewController, UICollectionViewDataSourcePrefetching {
    private var imageCache: [Int: UIImage] = [:]

    override func viewDidLoad() {
        super.viewDidLoad()
        collectionView.prefetchDataSource = self
    }

    func collectionView(_ collectionView: UICollectionView, prefetchItemsAt indexPaths: [IndexPath]) {
        for indexPath in indexPaths {
            let item = items[indexPath.item]
            if imageCache[item.id] == nil {
                loadImage(for: item) // async load in background
            }
        }
    }

    func collectionView(_ collectionView: UICollectionView, cancelPrefetchingForItemsAt indexPaths: [IndexPath]) {
        // optionally cancel pending loads for items no longer needed
    }

    private func loadImage(for item: Item) {
        URLSession.shared.dataTask(with: item.imageURL) { data, _, _ in
            if let data = data, let image = UIImage(data: data) {
                self.imageCache[item.id] = image
                DispatchQueue.main.async {
                    self.collectionView.reloadItems(at: [IndexPath(item: item.id, section: 0)])
                }
            }
        }.resume()
    }
}
```

Prefetching signals let you start async work (like downloading images) before the cells are visible, significantly improving perceived scrolling performance — without it, the scroll view would arrive at a cell whose image hasn't loaded yet, causing visible flickering or empty placeholders. `cancelPrefetchingForItemsAt` lets you cancel pending work for items that scrolled off-screen before they were needed, avoiding wasted network/CPU.

---

## 37.7 Custom Collection View Layouts 🟠

Beyond `UICollectionViewFlowLayout`, subclassing `UICollectionViewLayout` allows fully custom, complex arrangements — waterfalls, radials, or any imaginable spatial arrangement.

```swift
class WaterfallLayout: UICollectionViewLayout {
    var itemSize = CGSize(width: 100, height: 100)
    var minimumSpacing: CGFloat = 10
    private var layoutAttributes: [UICollectionViewLayoutAttributes] = []

    override func prepare() {
        super.prepare()
        layoutAttributes.removeAll()
        
        guard let collectionView = collectionView else { return }
        let width = collectionView.bounds.width
        let columns = Int(width / (itemSize.width + minimumSpacing))
        var columnHeights = Array(repeating: CGFloat(0), count: columns)

        for item in 0..<collectionView.numberOfItems(inSection: 0) {
            let column = columnHeights.firstIndex(of: columnHeights.min()!) ?? 0
            let x = CGFloat(column) * (itemSize.width + minimumSpacing) + minimumSpacing
            let y = columnHeights[column]

            let attributes = UICollectionViewLayoutAttributes(forCellWith: IndexPath(item: item, section: 0))
            attributes.frame = CGRect(x: x, y: y, width: itemSize.width, height: itemSize.height)
            layoutAttributes.append(attributes)

            columnHeights[column] = y + itemSize.height + minimumSpacing
        }
    }

    override var collectionViewContentSize: CGSize {
        let maxHeight = layoutAttributes.map { $0.frame.maxY }.max() ?? 0
        return CGSize(width: collectionView?.bounds.width ?? 0, height: maxHeight)
    }

    override func layoutAttributesForElements(in rect: CGRect) -> [UICollectionViewLayoutAttributes]? {
        layoutAttributes.filter { $0.frame.intersects(rect) }
    }

    override func layoutAttributesForItem(at indexPath: IndexPath) -> UICollectionViewLayoutAttributes? {
        layoutAttributes[indexPath.item]
    }
}
```

A custom layout overrides `prepare()` to compute the position and size of every item, `collectionViewContentSize` to report the total scrollable area, and `layoutAttributesForElements(in:)` to return only the attributes for items in the current visible rect (for performance). The layout is purely geometric — it calculates positions without caring about the actual cell content, making layouts reusable across different data or cell types.

---

## 37.8 Index Paths and Section Organization

Tables and collections organize content into sections (like an alphabet index or date grouping), each with its own rows/items, accessed via `IndexPath(item/row:section:)`.

```swift
class SectionedTableViewController: UIViewController, UITableViewDataSource {
    private var sections: [[String]] = [
        ["Apple", "Apricot"], // Section 0
        ["Banana", "Blackberry"], // Section 1
        ["Cherry", "Clementine"] // Section 2
    ]

    func numberOfSections(in tableView: UITableView) -> Int {
        sections.count
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        sections[section].count
    }

    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        ["Apples", "Bananas", "Cherries"][section]
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        cell.textLabel?.text = sections[indexPath.section][indexPath.row]
        return cell
    }
}
```

`indexPath.section` identifies the section, `indexPath.row` (for tables) or `indexPath.item` (for collections) identifies the row/item within that section — respecting this hierarchy is essential for all data source and delegate methods. The section-based organization is also the basis for batch operations like `beginUpdates`/`endUpdates`, or `performBatchUpdates` in collections, which let you modify multiple sections/index paths atomically with coordinated animations.

---

## 37.9 Editing and Updating Table/Collection Content

Tables and collections support dynamic insertion, deletion, and reordering of cells via data source methods and batch update APIs, with automatic animations.

```swift
class EditableTableViewController: UITableViewController {
    private var items: [String] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        tableView.isEditing = false
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        items.count
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        cell.textLabel?.text = items[indexPath.row]
        return cell
    }

    // Enable editing UI (swipe-to-delete, reorder handles):
    override func tableView(_ tableView: UITableView, canEditRowAt indexPath: IndexPath) -> Bool {
        true
    }

    override func tableView(_ tableView: UITableView, commit editingStyle: UITableViewCell.EditingStyle, forRowAt indexPath: IndexPath) {
        if editingStyle == .delete {
            items.remove(at: indexPath.row)
            tableView.deleteRows(at: [indexPath], with: .fade)
        }
    }

    override func tableView(_ tableView: UITableView, moveRowAt sourceIndexPath: IndexPath, to destinationIndexPath: IndexPath) {
        let item = items.remove(at: sourceIndexPath.row)
        items.insert(item, at: destinationIndexPath.row)
    }

    override func tableView(_ tableView: UITableView, canMoveRowAt indexPath: IndexPath) -> Bool {
        true
    }

    func insertNewItem() {
        items.append("New Item")
        let indexPath = IndexPath(row: items.count - 1, section: 0)
        tableView.insertRows(at: [indexPath], with: .automatic)
    }
}
```

`canEditRowAt` and `canMoveRowAt` enable swipe-to-delete and drag-to-reorder UI; `commit editingStyle` handles the actual deletion; `moveRowAt` updates the backing data on reorder. The table's `deleteRows(at:with:)`, `insertRows(at:with:)`, and `moveRow` methods update the display with automatic animations (fade, automatic, etc.) — the key rule is that the backing data and the table's state must always stay in sync, or the table's internal indexing breaks.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| List data provision | `UITableViewDataSource` | `numberOfRowsInSection`, `cellForRowAt` |
| List interaction | `UITableViewDelegate` | `didSelectRowAt`, `heightForRowAt`, etc. |
| Cell reuse | `dequeueReusableCell`, `reuseIdentifier` | Efficient memory use for large lists |
| Cell lifecycle | `awakeFromNib`, `prepareForReuse`, `configure` | One-time setup, reuse reset, data update |
| Dynamic sizing | `UITableView.automaticDimension` | Self-sizing cells via Auto Layout |
| Grid layout | `UICollectionViewFlowLayout` | Row/column arrangement with spacing |
| Grid data | `UICollectionViewDataSource` | Provide items and supplementary views |
| Prefetching | `UICollectionViewDataSourcePrefetching` | Load data before cells become visible |
| Custom layouts | `UICollectionViewLayout` subclass | Arbitrary spatial arrangements |
| Organization | `IndexPath(section:row/item:)` | Multi-section hierarchical structure |
| Content updates | `insertRows`, `deleteRows`, `moveRow` | Animate inserts/deletes/reorders |
