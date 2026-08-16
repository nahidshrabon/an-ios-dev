## 36.1 Constraints and the Layout Equation

Every Auto Layout constraint is fundamentally a linear equation of the form `item1.attribute1 = multiplier × item2.attribute2 + constant`, relating one view's geometric attribute (like its leading edge or width) to another's.

```swift
// Conceptually: button.leadingAnchor = container.leadingAnchor * 1.0 + 16
```

This equation-based foundation is what makes Auto Layout fundamentally different from SwiftUI's layout negotiation (sizeThatFits/placeSubviews, section 31.8–31.9) — rather than a top-down "propose a size, get back a size" negotiation between parent and child, Auto Layout solves a whole system of simultaneous equations across the entire constrained view hierarchy at once, arriving at a single consistent solution (or failing with ambiguity/conflict if no solution exists, or more than one does). Understanding constraints as literal equations — not just "rules" — is the conceptual key to reasoning about priorities, conflicts, and ambiguity later in this section.

---

## 36.2 NSLayoutConstraint in Code

`NSLayoutConstraint` is the class representing one such equation, constructible directly and activated via `NSLayoutConstraint.activate()`.

```swift
class ProfileCardView: UIView {
    private let avatarImageView = UIImageView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        avatarImageView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(avatarImageView)

        NSLayoutConstraint.activate([
            avatarImageView.widthAnchor.constraint(equalToConstant: 60),
            avatarImageView.heightAnchor.constraint(equalTo: avatarImageView.widthAnchor),
            avatarImageView.topAnchor.constraint(equalTo: topAnchor, constant: 16),
            avatarImageView.centerXAnchor.constraint(equalTo: centerXAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError() }
}
```

`translatesAutoresizingMaskIntoConstraints = false` is required on any view being manually constrained — without it, UIKit auto-generates constraints from the view's legacy `autoresizingMask` and `frame`, which conflicts with explicit Auto Layout constraints. `NSLayoutConstraint.activate()` is the preferred way to enable a batch of constraints at once, more efficient than setting `.isActive = true` individually on each, since it lets Auto Layout batch its internal solving work.

---

## 36.3 Layout Anchors

Layout anchors (`.leadingAnchor`, `.topAnchor`, `.widthAnchor`, and so on) provide a type-safe, more concise API for building constraints compared to the older `NSLayoutConstraint(item:attribute:relatedBy:toItem:attribute:multiplier:constant:)` initializer.

```swift
let card = UIView()
let title = UILabel()
card.addSubview(title)
title.translatesAutoresizingMaskIntoConstraints = false

NSLayoutConstraint.activate([
    title.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
    title.trailingAnchor.constraint(lessThanOrEqualTo: card.trailingAnchor, constant: -12),
    title.centerYAnchor.constraint(equalTo: card.centerYAnchor)
])
```

Anchors are strongly typed by dimension — `NSLayoutXAxisAnchor`, `NSLayoutYAxisAnchor`, `NSLayoutDimension` — which prevents nonsensical constraints like relating a horizontal anchor to a vertical one at compile time, a category of bug the older, untyped attribute-based API couldn't catch until runtime. Anchor-based constraints also support inequality relations (`.constraint(lessThanOrEqualTo:)`, `.constraint(greaterThanOrEqualTo:)`) directly, useful for flexible min/max sizing rather than a single fixed equality.

---

## 36.4 Constraint Priorities

Every constraint carries a `priority` (from 1 to 1000, `UILayoutPriority.required` being 1000), and when the full system of active constraints is over-determined (more equations than can all be simultaneously satisfied), Auto Layout satisfies higher-priority constraints first and may "break" (ignore) lower-priority ones as needed to reach a solution.

```swift
let widthConstraint = view.widthAnchor.constraint(equalToConstant: 300)
widthConstraint.priority = UILayoutPriority(750)

let minWidthConstraint = view.widthAnchor.constraint(greaterThanOrEqualToConstant: 100)
minWidthConstraint.priority = .required

NSLayoutConstraint.activate([widthConstraint, minWidthConstraint])
```

A `.required` (1000) constraint must always be satisfied, or Auto Layout reports a conflict; anything lower is a "soft" preference that can be broken if satisfying it would be impossible alongside higher-priority (or other required) constraints. This is the mechanism that enables graceful, flexible layouts — for example, a "preferred width" constraint set below 1000 lets a view shrink below that preferred size when space is tight, rather than producing an unsatisfiable, broken layout.

---

## 36.5 Content Hugging and Compression Resistance

Content hugging priority controls how strongly a view resists growing beyond its intrinsic content size; compression resistance priority controls how strongly it resists shrinking below that size — both are per-view, per-axis priorities that resolve ambiguity when multiple views compete for the same available space.

```swift
let titleLabel = UILabel()
let subtitleLabel = UILabel()

titleLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)
subtitleLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
```

When two labels sit side by side in a row that's wider than both labels' combined intrinsic content sizes, something has to stretch to fill the extra space — the view with *lower* content hugging priority is the one that stretches, since it "hugs" its content less tightly. Conversely, when space is tight and something must shrink, the view with *lower* compression resistance priority is the one that shrinks first, since it resists compression less. These two independent priorities are what let UIKit make sensible automatic decisions about which sibling view absorbs slack or gets squeezed, without every layout needing an explicit fixed-size constraint on every view.

---

## 36.6 UIStackView

`UIStackView` is UIKit's higher-level, `HStack`/`VStack`-like container — it automatically manages the constraints between its arranged subviews based on `axis`, `spacing`, `distribution`, and `alignment` properties, sparing you from manually writing individual constraints between siblings.

```swift
let stackView = UIStackView(arrangedSubviews: [avatarImageView, nameLabel, followButton])
stackView.axis = .horizontal
stackView.spacing = 12
stackView.alignment = .center
stackView.distribution = .fill
```

`UIStackView` is the closest UIKit analog to `HStack`/`VStack`, and internally it still generates real `NSLayoutConstraint`s to arrange its children — it's essentially a convenience layer over manually-written sibling constraints, not a fundamentally different layout mechanism. `distribution` (`.fill`, `.fillEqually`, `.fillProportionally`, `.equalSpacing`, `.equalCentering`) controls how the stack allocates space along its axis, closely paralleling how SwiftUI's `Spacer()` and frame modifiers control space distribution within `HStack`/`VStack`.

---

## 36.7 Layout Guides and Safe Area

`UILayoutGuide` represents a rectangular region participating in Auto Layout without being an actual rendered view — the safe area (`view.safeAreaLayoutGuide`) is the most commonly used built-in example, representing the region not obscured by system chrome like the notch, Dynamic Island, or home indicator.

```swift
NSLayoutConstraint.activate([
    contentView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
    contentView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
    contentView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
    contentView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
])
```

Constraining to `safeAreaLayoutGuide` (rather than the view's own edges directly) ensures content doesn't render underneath system chrome — this is the UIKit equivalent of SwiftUI's automatic safe-area-respecting default layout behavior, but requiring explicit opt-in via constraints rather than being the automatic default. Custom `UILayoutGuide`s can also be created and added via `addLayoutGuide()` for cases needing an invisible, constraint-participating rectangle that isn't tied to any actual rendered view — like reserving space for content that will be added dynamically later.

---

## 36.8 Debugging Ambiguous and Conflicting Constraints

Auto Layout distinguishes between two distinct failure modes: a *conflict* (too many required constraints, no valid solution exists) and *ambiguity* (not enough constraints, multiple valid solutions exist) — each with different debugging tools and console output.

```swift
// Xcode console output on conflict looks roughly like:
// "Unable to simultaneously satisfy constraints... Will attempt to recover by breaking constraint..."
// followed by a list of the specific conflicting NSLayoutConstraint objects

// Programmatic ambiguity check:
if view.hasAmbiguousLayout {
    print(view.constraintsAffectingLayout(for: .horizontal))
}
```

A conflict produces a clear runtime console log identifying exactly which constraints couldn't be simultaneously satisfied, along with which one Auto Layout automatically broke to recover (typically the lowest-priority one among the conflicting set) — reading this list carefully, constraint by constraint, is usually enough to identify the offending pair. Ambiguity is subtler and doesn't always produce an obvious crash or log — a view might simply render at an unexpected size or position because insufficient constraints left more than one mathematically valid layout, silently resolved to whichever one Auto Layout's solver happened to pick; `hasAmbiguousLayout` and Xcode's View Debugger (which can highlight ambiguous views directly) are the primary tools for catching this less obvious failure mode.

---

## 36.9 systemLayoutSizeFitting and Self-Sizing 🟠

`systemLayoutSizeFitting(_:)` asks a view to compute its own ideal size given a target size, by actually running Auto Layout's constraint-solving machinery against that view's constraint subtree — the mechanism underlying self-sizing table view cells (covered further in section 37.3).

```swift
let targetSize = CGSize(width: tableView.bounds.width, height: UIView.layoutFittingCompressedSize.height)
let fittingSize = cellContentView.systemLayoutSizeFitting(
    targetSize,
    withHorizontalFittingPriority: .required,
    verticalFittingPriority: .fittingSizeLevel
)
```

Passing `.required` for the horizontal fitting priority pins the width to exactly the target width, while `.fittingSizeLevel` for the vertical priority tells the solver "compute whatever height this content actually needs" rather than forcing a fixed height — this asymmetric priority combination is precisely how self-sizing cells compute "the right height for this width" without the developer needing to manually calculate text/content heights by hand. This directly parallels `sizeThatFits` from SwiftUI's `Layout` protocol (section 31.8): both are mechanisms for asking a piece of UI "given this much space, what size do you actually need," just implemented through Auto Layout's constraint solver rather than SwiftUI's proposal-based negotiation.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Layout foundation | Linear constraint equations | `item1.attr1 = multiplier × item2.attr2 + constant` |
| Building constraints | `NSLayoutConstraint`, `.activate()` | Create and enable layout equations in code |
| Type-safe constraints | Layout anchors (`.leadingAnchor`, etc.) | Compile-time-checked, concise constraint API |
| Resolving over-determination | Constraint `priority` | Higher-priority constraints win when conflicts arise |
| Sibling space allocation | Content hugging / compression resistance | Decide which view stretches or shrinks first |
| Stack-based layout | `UIStackView` | HStack/VStack-like automatic sibling constraints |
| Safe rendering region | `safeAreaLayoutGuide`, `UILayoutGuide` | Avoid system chrome; invisible constraint regions |
| Failure diagnosis | Conflict vs. ambiguity | Two distinct failure modes with different tooling |
| Self-sizing | `systemLayoutSizeFitting` | Compute ideal size via the constraint solver |
