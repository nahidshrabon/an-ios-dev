**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

This section looks **under the hood**. How does a `body` with five views become one type? Why is `AnyView` discouraged? How does data flow **up** the tree? How do you write your **own** `HStack`? And when a screen is slow, how do you find **which** view is redrawing too often? You can build apps without this, but it explains many "strange" behaviors.

---

## 31.1 ViewBuilder and TupleView 🟡

**`@ViewBuilder`** is a **result builder** (12.1). It's what lets you write **several views** in a `body` or a stack, one per line, with no commas and no `return`. It combines them into **one** view type.

```swift
struct MultiChildView: View {
    var body: some View {
        VStack {
            Text("First")
            Text("Second")
        }
    }
}
```

Behind the scenes, the two `Text` lines become **one** value of type **`TupleView<(Text, Text)>`**. `VStack` receives that one value and lays out its parts.

That's how `some View` works with "two views": `some View` needs **one** concrete type, and the builder always produces one:

| You write | The builder makes |
|---|---|
| One view | That view |
| Several views | `TupleView<(A, B, C)>` |
| `if` without `else` | `Optional<A>` |
| `if` / `else` | `_ConditionalContent<A, B>` (31.2) |
| `if #available` | A type-erased wrapper for the newer view |

You can see the real type with `type(of:)`:

```swift
let view = VStack {
    Text("A")
    if Bool.random() { Image(systemName: "star") }
}
print(type(of: view))
// VStack<TupleView<(Text, Optional<Image>)>>
```

You can use `@ViewBuilder` on **your own** properties, functions, and parameters:

```swift
struct Card<Content: View>: View {
    @ViewBuilder var content: Content            // the caller can pass several views

    var body: some View {
        VStack(alignment: .leading, spacing: 8) { content }
            .padding()
            .background(.background, in: .rect(cornerRadius: 12))
    }
}

Card {
    Text("Title").font(.headline)
    Text("Body text")
}
```

---

## 31.2 _ConditionalContent and Branch Identity 🟡

An **`if`/`else`** in a builder becomes **`_ConditionalContent<TrueContent, FalseContent>`**. It holds **one** branch at a time. Each branch has its **own identity** (25.14).

```swift
struct BranchIdentityView: View {
    @State private var showFirst = true

    var body: some View {
        VStack {
            if showFirst {
                Text("Branch A").transition(.opacity)
            } else {
                Text("Branch B").transition(.opacity)
            }
        }
        .onTapGesture { withAnimation { showFirst.toggle() } }
    }
}
```

Both branches are `Text`, but to SwiftUI they're **two different views**, because they're in **different branches**. Switching branches **removes** one view and **inserts** another. So:

- Any **`@State`** inside the old branch is **lost**.
- With `withAnimation`, you get a **transition** (a fade by default), not a smooth change of one view. Use **`.transition()`** to pick **which** transition.
- Without `withAnimation`, the swap is **instant**.

Compare with **one view** whose **value** changes:

```swift
// One identity: the text and color animate smoothly as values
Text(showFirst ? "Branch A" : "Branch B")
    .foregroundStyle(showFirst ? .blue : .orange)
    .contentTransition(.interpolate)
```

**Rule of thumb:** `if`/`else` for **different things**; a ternary (`? :`) for **the same thing, looking different**.

---

## 31.3 AnyView and Its Real Cost 🟡

**`AnyView`** wraps **any** view in **one** type. It "erases" the real type. It looks handy for returning different views, but it has a real cost.

```swift
struct TypeErasedRouterView: View {
    let destination: String

    var body: some View {
        content
    }

    // ✅ Keeps the real types: _ConditionalContent<ProfileView, SettingsView>
    @ViewBuilder
    private var content: some View {
        if destination == "profile" {
            ProfileView()
        } else {
            SettingsView()
        }
    }

    // ⚠️ Hides the types: just "AnyView"
    private var erasedContent: AnyView {
        if destination == "profile" {
            return AnyView(ProfileView())
        } else {
            return AnyView(SettingsView())
        }
    }
}
```

The cost isn't mainly **memory**. It's that SwiftUI **can't see inside**:

1. Normally, SwiftUI compares the old and new tree **by type**. It knows a `ProfileView` stays a `ProfileView`, so it updates only what changed.
2. With `AnyView`, the type is hidden. SwiftUI must **check at run time** if the inner type changed. If it did, it **throws away** the whole subtree and builds a new one, losing `@State` and breaking animations.
3. These extra checks add up in **long lists** and **deep trees**.

Better options:

| Instead of `AnyView` for… | Use |
|---|---|
| "One of several views" | `@ViewBuilder` with `if`/`switch` |
| A function returning different views | A `@ViewBuilder` function, or `some View` |
| Different **layouts** | `AnyLayout` (23.13) |
| Passing a view into a component | A generic `Content: View` (31.1) |

`AnyView` is still fine for a **small number** of views that rarely change, or when you truly need **mixed views in an array**, like a plugin system.

---

## 31.4 Custom ViewModifier 🟢

A **`ViewModifier`** packages a **reusable set of modifiers**. Most built-in modifiers work this way. You write **one** method, **`body(content:)`**: it gets the view and returns a new one.

```swift
struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding()
            .background(.background, in: .rect(cornerRadius: 12))   // adapts to dark mode
            .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
    }
}

extension View {
    func cardStyle() -> some View {
        modifier(CardStyle())
    }
}

struct CardStyleDemoView: View {
    var body: some View {
        Text("Card Content")
            .cardStyle()          // reads like a built-in modifier
    }
}
```

The **`View` extension** is the usual pattern. `.cardStyle()` reads like `.padding()` at the call site, and it's easy to find with autocomplete.

A modifier can take **parameters**, and can have its **own state** and **environment**, which a simple extension function can't:

```swift
struct Shake: ViewModifier {
    var trigger: Int
    @State private var offset: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .offset(x: offset)
            .onChange(of: trigger) {
                guard !reduceMotion else { return }
                withAnimation(.spring(duration: 0.2, bounce: 0.8)) { offset = 8 }
                withAnimation(.spring.delay(0.1)) { offset = 0 }
            }
    }
}

extension View {
    func shake(on trigger: Int) -> some View { modifier(Shake(trigger: trigger)) }
}

// TextField("Code", text: $code).shake(on: failedAttempts)
```

| Use | When |
|---|---|
| `View` extension with modifiers | Just a fixed chain of modifiers |
| `ViewModifier` | It needs **state**, the **environment**, or is reused a lot |

---

## 31.5 PreferenceKey Fundamentals 🟡

`@Environment` and bindings send data **down** the tree. **`PreferenceKey`** sends data **up**: from a **child** to an **ancestor**.

```swift
struct HeightPreferenceKey: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())      // several children: keep the tallest
    }
}

struct MeasuredChildView: View {
    var body: some View {
        Text("Some content")
            .background {
                GeometryReader { proxy in
                    Color.clear.preference(key: HeightPreferenceKey.self, value: proxy.size.height)
                }
            }
    }
}
```

A preference key has two parts:

- **`defaultValue`**: the value when **no child** sets one.
- **`reduce(value:nextValue:)`**: how to **combine** values when **several children** set one. Here: keep the **maximum**. For a list, you'd **append**.

A child sends a value with **`.preference(key:value:)`**. Many built-in features use preferences: that's how `.navigationTitle` on a **child** sets the title of the **navigation bar** above it.

The `GeometryReader` goes in a **background**, so it gets the **child's** size without changing layout (24.19).

Use `static let` (or a computed `static var`) for `defaultValue`. A plain `static var` is **shared mutable state**, which Swift 6 flags as a data race risk (20).

---

## 31.6 Passing Data Up with Preferences 🟡

An ancestor **reads** the value with **`.onPreferenceChange()`**:

```swift
struct AdaptiveHeightContainerView: View {
    @State private var measuredHeight: CGFloat = 0

    var body: some View {
        VStack {
            MeasuredChildView()
        }
        .onPreferenceChange(HeightPreferenceKey.self) { newHeight in
            measuredHeight = newHeight
        }
        .overlay(alignment: .bottom) {
            Text("Measured height: \(Int(measuredHeight))pt")
                .font(.caption)
        }
    }
}
```

The full round trip:

1. The **child** measures itself and reports with `.preference`.
2. SwiftUI **combines** values from all children with `reduce`.
3. The **ancestor** gets the result in `.onPreferenceChange` and stores it in `@State`.
4. That state can change the **layout** elsewhere.

A real use: making several **labels** the **same width** (the widest one):

```swift
struct WidthKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

struct AlignedForm: View {
    @State private var labelWidth: CGFloat = 0

    var body: some View {
        VStack(alignment: .leading) {
            ForEach(["Name", "Email address", "Phone"], id: \.self) { label in
                HStack {
                    Text(label)
                        .background { GeometryReader { Color.clear.preference(key: WidthKey.self, value: $0.size.width) } }
                        .frame(width: labelWidth > 0 ? labelWidth : nil, alignment: .leading)
                    TextField(label, text: .constant(""))
                }
            }
        }
        .onPreferenceChange(WidthKey.self) { labelWidth = $0 }
    }
}
```

In Swift 6 language mode, the `.onPreferenceChange` closure is `@Sendable`. If the compiler complains about changing state inside it, wrap the change in `MainActor.assumeIsolated { }` (the closure does run on the main thread).

⚠️ Don't set state that **changes the measured size again**. That makes an **update loop**, and SwiftUI warns about it in the console.

For **one view's own size**, the newer **`.onGeometryChange`** (24.20) is simpler: no key type needed. Preferences are still the right tool when **many children** report to **one ancestor**.

---

## 31.7 Anchor and Coordinate Space Conversion 🔴

Sometimes a parent needs to know **where** a child is, to draw something **on top** of it (a highlight, a tooltip, an onboarding spotlight). But a frame only makes sense **in a coordinate space**: "x = 20" relative to **what**?

An **`Anchor`** solves this. It's a **reference** to a child's geometry, sent up with a preference, and turned into a real `CGRect` **later**, in the reader's own coordinates:

```swift
struct BoundsPreferenceKey: PreferenceKey {
    static var defaultValue: Anchor<CGRect>? { nil }      // computed: safe in Swift 6

    static func reduce(value: inout Anchor<CGRect>?, nextValue: () -> Anchor<CGRect>?) {
        value = nextValue() ?? value
    }
}

struct AnchorDemoView: View {
    var body: some View {
        VStack {
            Text("Target")
                .padding()
                .background(.blue.opacity(0.2))
                .anchorPreference(key: BoundsPreferenceKey.self, value: .bounds) { $0 }   // send a reference up

            Spacer().frame(height: 100)
        }
        .overlayPreferenceValue(BoundsPreferenceKey.self) { anchor in
            GeometryReader { proxy in
                if let anchor {
                    let rect = proxy[anchor]          // resolve it HERE, in the overlay's coordinates
                    Rectangle()
                        .stroke(.red, lineWidth: 2)
                        .frame(width: rect.width, height: rect.height)
                        .position(x: rect.midX, y: rect.midY)
                }
            }
        }
    }
}
```

Why wait to resolve it? The child doesn't know **who** will read the value, or **where** that reader is. If it sent a fixed `CGRect`, the numbers would be in the **wrong** coordinate space for the reader. `proxy[anchor]` converts it into the **reader's** space, so the red box lines up exactly, wherever the overlay is.

**`.overlayPreferenceValue`** (and `.backgroundPreferenceValue`) read a preference and **draw** with it in one step. This is the classic way to build **spotlights** and **coach marks**.

To track **several** targets, use a dictionary as the value:

```swift
struct SpotlightKey: PreferenceKey {
    static var defaultValue: [String: Anchor<CGRect>] { [:] }
    static func reduce(value: inout [String: Anchor<CGRect>], nextValue: () -> [String: Anchor<CGRect>]) {
        value.merge(nextValue()) { $1 }
    }
}

// .anchorPreference(key: SpotlightKey.self, value: .bounds) { ["addButton": $0] }
```

---

## 31.8 The Layout Protocol: sizeThatFits 🔴

The **`Layout`** protocol (iOS 16) lets you write **your own container**, like `HStack`, with the **same speed** as the built-in ones. A classic example is a **flow layout**: items go left to right and **wrap** to a new line, like **tags**.

A layout works in **two steps**, just like built-in containers (24.8):

1. **`sizeThatFits`**: "Given this offer, **how big** am I?"
2. **`placeSubviews`**: "Now **put each child** at its spot" (31.9).

```swift
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        let maxWidth = proposal.width ?? .infinity      // nil = "use your ideal size"
        var x: CGFloat = 0
        var totalHeight: CGFloat = 0
        var rowHeight: CGFloat = 0
        var widestRow: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)   // ask each child its ideal size
            if x > 0 && x + size.width > maxWidth {          // doesn't fit: wrap
                totalHeight += rowHeight + spacing
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            widestRow = max(widestRow, x - spacing)
        }
        totalHeight += rowHeight
        return CGSize(width: widestRow, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        // 31.9
    }
}
```

Things to know:

- **`ProposedViewSize`** is the **offer** from the parent. A `nil` width or height means "**no limit; tell me your ideal**".
- **`subview.sizeThatFits(_:)`** asks a **child** how big it wants to be for an offer. `.unspecified` means "your ideal size".
- `sizeThatFits` only returns the **container's own size**. It doesn't place anything yet.
- SwiftUI may call it **several times** with **different** offers (for example, to check min and max sizes). Keep it **fast** and **side-effect free**.

Using it looks just like a stack:

```swift
FlowLayout(spacing: 6) {
    ForEach(tags, id: \.self) { tag in
        Text(tag)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(.blue.opacity(0.15), in: .capsule)
    }
}
```

---

## 31.9 The Layout Protocol: placeSubviews 🔴

**`placeSubviews`** is the second step. You get the **bounds** (the final rectangle the parent gave you) and call **`place(at:proposal:)`** on **every** child:

```swift
extension FlowLayout {
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX && x + size.width > bounds.maxX {   // wrap to the next row
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(
                at: CGPoint(x: x, y: y),
                anchor: .topLeading,                 // the point is the child's top-left corner
                proposal: ProposedViewSize(size)     // offer it exactly its ideal size
            )
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
```

Important details:

- **Use `bounds.minX` and `bounds.minY`**, not 0. The bounds can start anywhere in the parent's coordinates.
- **Place every child.** A child you don't place ends up at the **center**, on top of the others.
- The **wrapping logic must match** `sizeThatFits`. If the two disagree, children spill **outside** the size you reported.

A layout can also read **values** from its children, through **layout values**:

```swift
struct Rank: LayoutValueKey {
    static let defaultValue = 0
}

extension View {
    func rank(_ value: Int) -> some View { layoutValue(key: Rank.self, value: value) }
}

// Inside the layout:
// let sorted = subviews.sorted { $0[Rank.self] < $1[Rank.self] }
```

And because it's a real layout, you can **animate between layouts** with `AnyLayout` (23.13):

```swift
let layout = isGrid ? AnyLayout(FlowLayout()) : AnyLayout(VStackLayout())
layout { ForEach(tags, id: \.self) { TagView(tag: $0) } }
    .animation(.spring, value: isGrid)      // children slide to their new places
```

---

## 31.10 Layout Cache for Expensive Layouts 🔴

SwiftUI may call `sizeThatFits` **several times**, then `placeSubviews`, on every layout pass. If measuring is **expensive** (many children, text measuring), you can **store results** in a **cache** and reuse them.

```swift
struct CachedFlowLayout: Layout {
    struct CacheData {
        var subviewSizes: [CGSize] = []
    }

    func makeCache(subviews: Subviews) -> CacheData {
        CacheData(subviewSizes: subviews.map { $0.sizeThatFits(.unspecified) })   // measure once
    }

    func updateCache(_ cache: inout CacheData, subviews: Subviews) {
        cache.subviewSizes = subviews.map { $0.sizeThatFits(.unspecified) }       // children changed: re-measure
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout CacheData) -> CGSize {
        // reuse cache.subviewSizes instead of measuring every child again
        let totalWidth = cache.subviewSizes.reduce(0) { $0 + $1.width }
        return CGSize(width: totalWidth, height: cache.subviewSizes.map(\.height).max() ?? 0)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout CacheData) {
        var x = bounds.minX
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: x, y: bounds.minY), proposal: ProposedViewSize(cache.subviewSizes[index]))
            x += cache.subviewSizes[index].width
        }
    }
}
```

How the cache works:

| Method | Called when |
|---|---|
| `makeCache(subviews:)` | Once, when the layout is created |
| `updateCache(_:subviews:)` | When the **children change** (added, removed, or their content changed) |
| `sizeThatFits` / `placeSubviews` | Every layout pass, with the **same** `cache` passed `inout` |

⚠️ Only cache things that **don't depend on the proposal**. A child's **ideal** size is fine. A size measured for **one particular width** is not, because the next call may offer a different width.

Don't add a cache **by default**. For a few children, measuring is cheap, and a cache only adds code. Add it when **Instruments** shows layout time is high (31.13).

---

## 31.11 EquatableView and Manual Diffing 🔴

When a parent redraws, SwiftUI **compares** each child's **inputs** (its stored properties) with last time. If they're the same, the child's `body` is **skipped**. But SwiftUI's built-in comparison is **cautious**: some inputs (like closures, or some reference types) always look "changed".

**`.equatable()`** lets **you** decide, with your own **`==`**:

```swift
struct ExpensiveRow: View, Equatable {
    let item: Item
    let onTap: () -> Void              // closures can't be compared, so SwiftUI assumes "changed"

    static func == (lhs: ExpensiveRow, rhs: ExpensiveRow) -> Bool {
        lhs.item.id == rhs.item.id && lhs.item.lastModified == rhs.item.lastModified
    }

    var body: some View {
        // expensive content
        Text(item.title)
            .onTapGesture(perform: onTap)
    }
}

struct EquatableUsageView: View {
    let items: [Item]

    var body: some View {
        ForEach(items) { item in
            ExpensiveRow(item: item, onTap: { select(item) })
                .equatable()          // skip body when == says "same"
        }
    }
}
```

If `==` returns **`true`**, SwiftUI **skips** the row's `body`, even though the closure is a **new** value each time.

⚠️ This is **your promise**. If `==` ignores something that `body` **uses**, the row will show **stale** data. Here, if `title` changed without `lastModified` changing, the row wouldn't update. Compare **everything that affects the output**.

Use it **rarely**, and only after measuring:

- With **`@Observable`**, most extra redraws are already gone (25.13).
- Often a better fix is to pass **simpler inputs** (an ID and a title, not a big model) or **fewer closures**.

---

## 31.12 Diagnosing Body Invalidation Storms 🔴

A **body invalidation storm** is when `body` runs **far more often** than the screen actually changes. Each run is small, but hundreds per second make scrolling and typing **stutter**.

Common causes:

1. A **fast-changing value** (scroll offset, a timer, a drag position) stored **high** in the tree. Every change redraws the **whole screen** below it.
2. A **parent body** that reads **everything**, so any change in the model redraws it and all its children.
3. **Inputs** that always look "changed" (new closures, new arrays built in `body`), so children can't be skipped.
4. **`ObservableObject`** with a **frequently-changing** `@Published` property: every observer redraws (25.13).

```swift
// ❌ The scroll offset lives at the top: every pixel of scrolling redraws the whole screen
struct StormProneScreen: View {
    @State private var scrollOffset: CGFloat = 0

    var body: some View {
        VStack {
            HeaderView(isCompact: scrollOffset > 50)   // the only view that needs it
            FeedView()                                  // redrawn too
        }
        .onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y } action: { _, new in
            scrollOffset = new
        }
    }
}

// ✅ Store only what matters: a Bool that changes twice, not a CGFloat that changes constantly
struct CalmScreen: View {
    @State private var isCompact = false

    var body: some View {
        VStack {
            HeaderView(isCompact: isCompact)
            FeedView()
        }
        .onScrollGeometryChange(for: Bool.self) { $0.contentOffset.y > 50 } action: { _, new in
            isCompact = new
        }
    }
}
```

For **lists**, give each row **its own** `@Observable` model, so a change to **one** item redraws **one** row:

```swift
@Observable
final class ItemModel: Identifiable {
    let id = UUID()
    var title: String
    var isFavorite = false
    init(title: String) { self.title = title }
}

struct IsolatedRowView: View {
    let model: ItemModel

    var body: some View {
        HStack {
            Text(model.title)
            Image(systemName: model.isFavorite ? "star.fill" : "star")
        }
        // only redraws when THIS model's title or isFavorite changes
    }
}
```

The general fix: **keep state as low and as small as possible**. Store it in the **lowest** view that needs it, and store a **summary** (a `Bool`, an enum) instead of a raw, fast-changing number.

---

## 31.13 The SwiftUI Performance Instrument 🔴

Don't guess about performance. **Measure**. Instruments has a **SwiftUI** template that shows **which** views update, **how often**, **how long** their `body` takes, and **why** they updated.

```swift
// To investigate a slow screen:
// 1. In Xcode: Product → Profile (⌘I), and pick the SwiftUI template
// 2. Do the slow interaction (scroll, type, tap)
// 3. Stop, and look at the SwiftUI track:
//    - Which view types update the most?
//    - Which bodies take the longest?
// 4. Select an update to see what caused it (which state changed)
```

What to look for:

| Finding | Likely fix |
|---|---|
| A view updates on **every frame** while scrolling | Fast state stored too high (31.12) |
| **Many rows** update when one item changes | Per-row models, simpler row inputs |
| A **long** body update | Heavy work in `body`: move it out |
| Updates with **no visible change** | Inputs that always look "changed"; maybe `.equatable()` (31.11) |

Recent Xcode versions also show a **cause-and-effect graph**: from the state change, to each view it updated. That makes the "why" much easier to see.

The instrument **closes the loop**. The techniques in 31.11 and 31.12 are **guesses** until you measure. Profile **before** a fix, make **one** change, and profile **again** to prove it helped.

Tips:

- Profile a **Release** build on a **real device**, ideally an older one (69).
- A quick check without Instruments: `let _ = Self._printChanges()` in `body` prints **why** each run happened (25.13).

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Multi-view composition | `@ViewBuilder`, `TupleView` | Many lines become one concrete view type |
| Conditional branches | `_ConditionalContent` | Each branch is a different view identity |
| Type erasure | `AnyView` | Hides the type from diffing; prefer builders |
| Reusable transforms | `ViewModifier`, `.modifier()` | Reusable modifier sets, with their own state |
| Upward data flow | `PreferenceKey`, `.preference()` | Children send values up; `reduce` combines them |
| Reading preferences | `.onPreferenceChange()` | An ancestor reacts to children's values |
| Geometry references | `Anchor`, `.anchorPreference()` | Resolve a child's frame in the reader's space |
| Custom layout sizing | `Layout.sizeThatFits` | Report the container's size for an offer |
| Custom layout placement | `Layout.placeSubviews` | Place every child inside the bounds |
| Layout performance | `Layout` `cache` | Reuse proposal-independent measurements |
| Manual diffing | `.equatable()` | Your `==` decides when to skip `body` |
| Diagnosing over-updates | Low, small state; per-row models | Fewer views redraw per change |
| Empirical profiling | SwiftUI instrument | See what updates, how often, and why |
