**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**Auto Layout** is UIKit's layout system. Instead of setting frames yourself, you describe **relationships**: "this label is 16 points from the left edge", "these two buttons have equal widths". Each relationship is a **constraint**, and each constraint is a small **math equation**. Auto Layout **solves** all the equations together and sets every view's frame. Thinking of constraints as **equations** is the key to everything in this section.

---

## 36.1 Constraints and the Layout Equation 🟢

Every constraint is a **linear equation**:

**item1.attribute1 = multiplier × item2.attribute2 + constant**

```swift
// button.leading = container.leading × 1.0 + 16
// → "the button's left edge is 16 points right of the container's left edge"

// image.height = image.width × 0.75 + 0
// → "the image is 4:3"

// label.top = avatar.bottom × 1.0 + 8
// → "the label is 8 points below the avatar"
```

The **relation** can also be **≤** or **≥**, not just **=**:

```swift
// label.width ≤ 300            → "at most 300 wide"
// button.width ≥ 44            → "at least 44 wide (a good tap target)"
```

Auto Layout collects **all** the equations in a view hierarchy and solves them **together**, like a system of equations in math class. It needs **exactly one** solution:

| Equations | Result |
|---|---|
| Exactly enough, and they agree | ✅ One clear layout |
| **Too few** | ⚠️ **Ambiguous**: many layouts fit (36.8) |
| **They contradict** each other | ❌ **Conflict**: no layout fits all (36.8) |

This is different from SwiftUI (24.8, 31.8). SwiftUI **negotiates** step by step: a parent **offers** a size, the child **answers**. Auto Layout solves **everything at once**, as one big system. That's why a constraint between two **distant** views can affect the whole screen.

---

## 36.2 NSLayoutConstraint in Code 🟢

**`NSLayoutConstraint`** is one equation. You create constraints and turn them on with **`NSLayoutConstraint.activate()`**:

```swift
class ProfileCardView: UIView {
    private let avatarImageView = UIImageView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        avatarImageView.translatesAutoresizingMaskIntoConstraints = false   // ⚠️ don't forget
        addSubview(avatarImageView)                                          // add BEFORE constraining

        NSLayoutConstraint.activate([
            avatarImageView.widthAnchor.constraint(equalToConstant: 60),
            avatarImageView.heightAnchor.constraint(equalTo: avatarImageView.widthAnchor),   // square
            avatarImageView.topAnchor.constraint(equalTo: topAnchor, constant: 16),
            avatarImageView.centerXAnchor.constraint(equalTo: centerXAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}
```

Three rules to remember:

1. **`translatesAutoresizingMaskIntoConstraints = false`**. By default, UIKit turns a view's old-style **frame** and **autoresizing mask** into constraints automatically. Those extra constraints **fight** yours and cause conflicts. Turn it off for every view **you** constrain. (Views created in Interface Builder have it off already.)
2. **Add the view first.** Both views in a constraint must be in the **same hierarchy**, or the app **crashes**.
3. **Use `activate([...])`**, not `.isActive = true` one by one. It's shorter, and UIKit can add the whole batch at once, which is more efficient.

Keep a **reference** to a constraint you want to **change** later:

```swift
private var heightConstraint: NSLayoutConstraint!

heightConstraint = panel.heightAnchor.constraint(equalToConstant: 80)
heightConstraint.isActive = true

func expand() {
    heightConstraint.constant = 300          // change the equation's constant
    UIView.animate(withDuration: 0.3) {
        self.view.layoutIfNeeded()           // solve again, inside the animation
    }
}
```

Changing **`constant`** and then calling **`layoutIfNeeded()`** inside an animation block is the classic way to **animate** Auto Layout.

---

## 36.3 Layout Anchors 🟢

**Layout anchors** (`leadingAnchor`, `topAnchor`, `widthAnchor`, `centerYAnchor`, …) are the modern, readable way to make constraints. Compare with the **old** initializer:

```swift
// Old: long, and errors only show at run time
NSLayoutConstraint(item: title, attribute: .leading, relatedBy: .equal,
                   toItem: card, attribute: .leading, multiplier: 1, constant: 12)

// Anchors: short and type-checked
title.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12)
```

A fuller example:

```swift
let card = UIView()
let title = UILabel()
card.addSubview(title)
title.translatesAutoresizingMaskIntoConstraints = false

NSLayoutConstraint.activate([
    title.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 12),
    title.trailingAnchor.constraint(lessThanOrEqualTo: card.trailingAnchor, constant: -12),   // can be shorter
    title.centerYAnchor.constraint(equalTo: card.centerYAnchor)
])
```

Anchors are **typed** by direction:

| Anchor type | Examples | Can relate to |
|---|---|---|
| `NSLayoutXAxisAnchor` | `leading`, `trailing`, `centerX` | Other **x** anchors |
| `NSLayoutYAxisAnchor` | `top`, `bottom`, `centerY`, `firstBaseline` | Other **y** anchors |
| `NSLayoutDimension` | `width`, `height` | Other dimensions, or a constant |

So `title.leadingAnchor.constraint(equalTo: card.topAnchor)` **doesn't compile**. With the old API, that mistake would only crash at **run time**.

Note the **sign** of trailing and bottom constants: "12 points **inside** the trailing edge" is **`-12`**, because the equation is `title.trailing = card.trailing - 12`. (Or flip the order: `card.trailingAnchor.constraint(equalTo: title.trailingAnchor, constant: 12)`.)

Use **`leading`/`trailing`**, not `left`/`right`. Leading and trailing **flip** automatically for right-to-left languages like Arabic and Hebrew (71).

A small helper removes repetition for the most common case:

```swift
extension UIView {
    func pinEdges(to other: UIView, insets: UIEdgeInsets = .zero) {
        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            topAnchor.constraint(equalTo: other.topAnchor, constant: insets.top),
            leadingAnchor.constraint(equalTo: other.leadingAnchor, constant: insets.left),
            trailingAnchor.constraint(equalTo: other.trailingAnchor, constant: -insets.right),
            bottomAnchor.constraint(equalTo: other.bottomAnchor, constant: -insets.bottom)
        ])
    }
}
```

---

## 36.4 Constraint Priorities 🟡

Every constraint has a **priority** from **1 to 1000**:

- **1000** (`.required`): **must** be satisfied.
- **Below 1000** (`.defaultHigh` = 750, `.defaultLow` = 250, or any number): **optional**. Auto Layout tries to satisfy it, but may **give up on it** when it clashes with something more important.

```swift
let widthConstraint = view.widthAnchor.constraint(equalToConstant: 300)
widthConstraint.priority = UILayoutPriority(750)          // "I'd like 300…"

let maxWidthConstraint = view.widthAnchor.constraint(lessThanOrEqualTo: container.widthAnchor)
maxWidthConstraint.priority = .required                    // "…but never wider than the container"

NSLayoutConstraint.activate([widthConstraint, maxWidthConstraint])
```

On a wide screen, the view is **300** wide. On a narrow one (say, 280), the two can't both hold: the **required** one wins, and the view is **280**. Auto Layout gets the optional constraint **as close as it can** to its wish, instead of just throwing it away.

| Situation | What happens |
|---|---|
| Optional clashes with required | The required one wins; the optional gets as close as possible |
| Two optionals clash | The **higher** priority wins |
| Two **required** clash | ❌ A **conflict**: Auto Layout logs an error and **breaks** one of them to recover |

This is how you build **flexible** layouts: "preferably X, but adapt when there isn't room". It's like SwiftUI's `.frame(idealWidth:maxWidth:)` and `.layoutPriority()` (24.10).

⚠️ You can't change a constraint's priority between **required** and **optional** while it's **active**. Set the priority **before** activating it.

---

## 36.5 Content Hugging and Compression Resistance 🟡

Labels, buttons, and image views have an **intrinsic content size**: the size their **content** needs (the text, the image). Two per-view **priorities** say how much each view **defends** that size:

| Priority | Question it answers | Default |
|---|---|---|
| **Content hugging** | "How much do I **resist growing** bigger than my content?" | 250 (low) |
| **Compression resistance** | "How much do I **resist shrinking** smaller than my content?" | 750 (high) |

Think of it as: **hugging** = holding your content **tight**; **compression resistance** = refusing to be **squeezed**.

A typical row: a **name** that can be long, and a **date** that must always show in full.

```swift
let nameLabel = UILabel()      // "Alexandra Montgomery-Smith"
let dateLabel = UILabel()      // "Yesterday"

// Extra space → the NAME should stretch, the date should stay tight
dateLabel.setContentHuggingPriority(.defaultHigh, for: .horizontal)   // hugs harder → doesn't grow
nameLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)

// Not enough space → the NAME should be cut ("Alexandra Mon…"), never the date
dateLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
nameLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
```

The rules:

- With **extra** space, the view with **lower hugging** **grows**.
- With **too little** space, the view with **lower compression resistance** **shrinks** (and truncates).

If both labels have the **same** priorities, Auto Layout has no way to choose, so the layout is **ambiguous**: it may pick differently on different devices or runs. Xcode's Interface Builder often warns about exactly this. Making one priority different fixes it.

It's the UIKit version of SwiftUI's `.layoutPriority()` and `.fixedSize()` (24.9, 24.10).

---

## 36.6 UIStackView 🟢

**`UIStackView`** arranges views in a **row** or **column**, like SwiftUI's `HStack` and `VStack`. It creates the constraints **between** its children for you:

```swift
let stackView = UIStackView(arrangedSubviews: [avatarImageView, nameLabel, followButton])
stackView.axis = .horizontal
stackView.spacing = 12
stackView.alignment = .center
stackView.distribution = .fill

// You still constrain the STACK itself to its parent
view.addSubview(stackView)
stackView.translatesAutoresizingMaskIntoConstraints = false
NSLayoutConstraint.activate([
    stackView.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
    stackView.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
    stackView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16)
])
```

Under the hood, a stack view is **not magic**: it adds normal `NSLayoutConstraint`s between its arranged subviews. It just writes them **for** you.

| Property | Controls | Like in SwiftUI |
|---|---|---|
| `axis` | Row or column | `HStack` vs. `VStack` |
| `spacing` | Gap between children | `HStack(spacing:)` |
| `alignment` | Cross-axis alignment (`.leading`, `.center`, `.fill`…) | `VStack(alignment:)` |
| `distribution` | How space is shared along the axis | `Spacer`s and frames |

| Distribution | Effect |
|---|---|
| `.fill` | Fill the space; hugging/compression decide who grows |
| `.fillEqually` | All children the **same** size |
| `.fillProportionally` | Sizes in proportion to their content size |
| `.equalSpacing` | Equal **gaps** between children |
| `.equalCentering` | Equal distance between child **centers** |

Handy features:

```swift
stackView.setCustomSpacing(24, after: nameLabel)   // one bigger gap
followButton.isHidden = true                       // hidden children COLLAPSE: no gap left behind
stackView.isLayoutMarginsRelativeArrangement = true
stackView.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16)
```

Hiding an arranged subview **removes** it from the layout. Showing it again (even inside `UIView.animate`) animates nicely. That makes stack views great for "**show more**" sections.

Use **`addArrangedSubview`**, not `addSubview`, to add children. A plain `addSubview` adds it as a normal subview that the stack **doesn't** arrange.

---

## 36.7 Layout Guides and Safe Area 🟢

A **`UILayoutGuide`** is an **invisible rectangle** that takes part in Auto Layout. It has anchors like a view, but nothing is drawn. Every view comes with useful built-in guides:

| Guide | Area |
|---|---|
| `safeAreaLayoutGuide` | Not covered by the status bar, Dynamic Island, home indicator, or bars |
| `layoutMarginsGuide` | The safe area, minus standard **margins** (about 16–20 points) |
| `readableContentGuide` | A comfortable **width for reading text**, centered on big screens |
| `keyboardLayoutGuide` | The **keyboard's** area (iOS 15); moves when the keyboard shows or hides |

```swift
NSLayoutConstraint.activate([
    contentView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
    contentView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
    contentView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
    contentView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
])
```

In UIKit you must **opt in** to the safe area by constraining to `safeAreaLayoutGuide`. If you constrain to `view.topAnchor` instead, content goes **under** the Dynamic Island. In SwiftUI, staying in the safe area is the **default** (24.15).

The **keyboard guide** makes "stick to the top of the keyboard" a single constraint:

```swift
// A message input bar that rides on top of the keyboard, and sits at the bottom when it's hidden
inputBar.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor).isActive = true
```

No more listening for keyboard notifications and computing heights by hand.

You can also create **your own** guides, as invisible **spacers** or **regions**, instead of adding empty `UIView`s:

```swift
let spacer = UILayoutGuide()
view.addLayoutGuide(spacer)

NSLayoutConstraint.activate([
    spacer.leadingAnchor.constraint(equalTo: leftButton.trailingAnchor),
    spacer.trailingAnchor.constraint(equalTo: rightButton.leadingAnchor),
    centerLabel.centerXAnchor.constraint(equalTo: spacer.centerXAnchor)   // centered BETWEEN the buttons
])
```

A guide costs less than a view: it's not drawn, can't be touched, and isn't in the view hierarchy.

---

## 36.8 Debugging Ambiguous and Conflicting Constraints 🟡

Auto Layout has **two** different ways to fail:

| | **Conflict** | **Ambiguity** |
|---|---|---|
| Cause | Required constraints **contradict** each other | **Not enough** constraints |
| Solutions | **None** | **Many** |
| What you see | A long console log; a constraint gets broken | Views at **odd sizes or positions**, often with **no** message |
| Example | `width = 100` **and** `width = 200` | A label with a `top` and `leading`, but nothing for its **width** in a tight row |

A **conflict** prints a log like this:

```
Unable to simultaneously satisfy constraints.
    Probably at least one of the constraints in the following list is one you don't want.
    (
        "<NSLayoutConstraint:0x600 UIView:0x7f8.width == 100   (active)>",
        "<NSLayoutConstraint:0x601 UIView:0x7f8.width == 200   (active)>"
    )
Will attempt to recover by breaking constraint
    <NSLayoutConstraint:0x601 UIView:0x7f8.width == 200   (active)>
```

Read the list **one line at a time**: usually two of them obviously can't both be true. Make the logs readable by giving constraints and views **names**:

```swift
let width = card.widthAnchor.constraint(equalToConstant: 100)
width.identifier = "card.fixedWidth"            // shows up in the log instead of a memory address
card.accessibilityIdentifier = "ProfileCard"
```

To **stop** in the debugger when a conflict happens, add a **symbolic breakpoint** on **`UIViewAlertForUnsatisfiableConstraints`**.

**Ambiguity** is **sneakier**. Nothing crashes, and often nothing is logged. The view just ends up **somewhere**, picked by the solver, and it may **change** between devices, rotations, or iOS versions. Tools to find it:

```swift
// In the debugger or in code:
if view.hasAmbiguousLayout {
    print(view.constraintsAffectingLayout(for: .horizontal))
    view.exerciseAmbiguityInLayout()     // jumps to ANOTHER valid layout: you SEE what's unclear
}
```

```
// LLDB, while paused: print the whole view tree, marking ambiguous views
(lldb) expr -l objc -O -- [[UIWindow keyWindow] _autolayoutTrace]
```

And the visual tool: **Xcode → Debug View Hierarchy** shows each view in 3D, marks views with **ambiguous** layout with a purple **"!"**, and lists every constraint on the selected view.

---

## 36.9 systemLayoutSizeFitting and Self-Sizing 🔴

**`systemLayoutSizeFitting`** asks a view: "Given **this** target size, how big do you **need** to be?" It runs the **constraint solver** on the view's subtree to find out:

```swift
let targetSize = CGSize(width: tableView.bounds.width, height: UIView.layoutFittingCompressedSize.height)
let fittingSize = cellContentView.systemLayoutSizeFitting(
    targetSize,
    withHorizontalFittingPriority: .required,         // the width MUST be the target width
    verticalFittingPriority: .fittingSizeLevel        // the height: whatever the content needs
)
// fittingSize.height = the height for this width, e.g. 87 points for 3 lines of text
```

The two **fitting priorities** make it work:

- **Horizontal `.required`**: "the width is **fixed** at the table's width".
- **Vertical `.fittingSizeLevel`** (the lowest priority): "the height is **free**; give me the **smallest** height the constraints allow".

So the solver answers "**how tall** for this width?", and the text wraps as needed. This is exactly how **self-sizing cells** get their height (37.3): no manual math for text heights.

For self-sizing to work, the cell's content needs an **unbroken chain** of constraints from **top to bottom**:

```swift
NSLayoutConstraint.activate([
    titleLabel.topAnchor.constraint(equalTo: contentView.layoutMarginsGuide.topAnchor),
    bodyLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
    bodyLabel.bottomAnchor.constraint(equalTo: contentView.layoutMarginsGuide.bottomAnchor),   // closes the chain
    // + leading/trailing for both labels
])
bodyLabel.numberOfLines = 0     // allow wrapping
```

If the **bottom** constraint is missing, the content has no "floor", so the cell can't know its height and collapses to a default.

You rarely call `systemLayoutSizeFitting` yourself. Table and collection views call it for you when cells are **self-sizing** (the default since iOS 11 for tables). It's useful for **measuring** a view in code, for example a header or a popover's preferred size.

It's the UIKit version of `sizeThatFits` in SwiftUI's `Layout` protocol (31.8): both ask "given this space, what size do you need?". UIKit answers with the **constraint solver**; SwiftUI with **proposals**.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Layout foundation | Linear constraint equations | `item1.attr1 = multiplier × item2.attr2 + constant`, solved together |
| Building constraints | `NSLayoutConstraint`, `.activate()` | Turn equations on; turn off autoresizing translation |
| Type-safe constraints | Layout anchors (`.leadingAnchor`, etc.) | Short, compile-checked; use leading/trailing |
| Resolving over-determination | Constraint `priority` | Required always wins; optional gets as close as possible |
| Sibling space allocation | Content hugging / compression resistance | Who grows with extra space, who shrinks without it |
| Stack-based layout | `UIStackView` | Rows and columns; hidden children collapse |
| Safe rendering region | `safeAreaLayoutGuide`, margins, keyboard guide | Avoid system UI; invisible layout regions |
| Failure diagnosis | Conflict vs. ambiguity | Too many vs. too few constraints; logs vs. View Debugger |
| Self-sizing | `systemLayoutSizeFitting` | Height for a given width, via the solver |
