## 31.1 ViewBuilder and TupleView

`@ViewBuilder` is the result builder that powers every SwiftUI `body`, letting you write multiple views in a block and have them combined into a single composite view type — usually a `TupleView`.

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

Behind the scenes, `@ViewBuilder` transforms the two `Text` statements inside `VStack`'s trailing closure into `TupleView<(Text, Text)>` — a single concrete view type wrapping both children as a tuple. This is why `some View` works even though you're conceptually returning "two views": the builder always collapses multiple statements into one concrete composite type, satisfying the single-return-type requirement of an opaque `some View`.

---

## 31.2 _ConditionalContent and Branch Identity

When a `@ViewBuilder` block contains an `if`/`else`, the builder produces a `_ConditionalContent<TrueContent, FalseContent>` type — and which branch is "currently active" affects view identity in ways that matter for animation and state.

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

Switching between the `if` and `else` branches is treated by SwiftUI as removing one view and inserting a different one — even though both are `Text` views with similar content, they are considered distinct identities because they occupy different branches of the `_ConditionalContent`. This is exactly why `.transition()` (section 29.6) is needed here to animate the swap smoothly — without it, `_ConditionalContent`'s branch switch produces an instant cut, since a genuinely different view is being inserted/removed rather than one view's property changing.

---

## 31.3 AnyView and Its Real Cost

`AnyView` type-erases any conforming view into a single concrete wrapper type, useful for escaping `some View`'s single-type constraint — but it comes with a real performance cost that's worth understanding precisely.

```swift
struct TypeErasedRouterView: View {
    let destination: String

    var body: some View {
        content
    }

    @ViewBuilder
    private var content: some View {
        if destination == "profile" {
            ProfileView()
        } else {
            SettingsView()
        }
    }

    // Contrast: a genuinely type-erased version
    private var erasedContent: AnyView {
        if destination == "profile" {
            return AnyView(ProfileView())
        } else {
            return AnyView(SettingsView())
        }
    }
}
```

The real cost of `AnyView` isn't primarily allocation overhead — it's that it hides the underlying view's concrete type from SwiftUI's diffing machinery. Normally, SwiftUI compares old and new view trees structurally, type by type, to determine exactly what changed. Once a subtree is wrapped in `AnyView`, SwiftUI can no longer see through to the concrete type, so it loses the ability to efficiently diff that subtree — it must treat any change conservatively, which can mean more re-rendering than necessary. `@ViewBuilder`-based conditional content (as in `content` above) preserves concrete typing (via `_ConditionalContent`) and should generally be preferred over `AnyView` unless type erasure is genuinely unavoidable, such as storing heterogeneous views in a collection.

---

## 31.4 Custom ViewModifier

A `ViewModifier` packages a reusable transformation that can be applied to any view via `.modifier()`, and is the mechanism underlying nearly every built-in modifier like `.padding()` or `.foregroundStyle()`.

```swift
struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding()
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(radius: 4)
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
            .cardStyle()
    }
}
```

`ViewModifier`'s single required method, `body(content:)`, receives the view it's being applied to (`content`) and returns a new view built from it. Wrapping the `.modifier(CardStyle())` call in a `View` extension method (`cardStyle()`) is the idiomatic pattern — it lets the custom modifier read as a first-class part of the fluent modifier-chaining syntax, indistinguishable at the call site from a built-in modifier.

---

## 31.5 PreferenceKey Fundamentals

While `@Environment` and bindings pass data *down* the view hierarchy, `PreferenceKey` is SwiftUI's mechanism for passing data *up* — from a child view to an ancestor.

```swift
struct HeightPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

struct MeasuredChildView: View {
    var body: some View {
        Text("Some content")
            .background(
                GeometryReader { proxy in
                    Color.clear.preference(key: HeightPreferenceKey.self, value: proxy.size.height)
                }
            )
    }
}
```

A `PreferenceKey` conformer defines a `defaultValue` (used when no descendant sets one) and a `reduce(value:nextValue:)` function describing how to combine multiple values if several descendants report one (here, taking the maximum). A view reports a value upward via `.preference(key:value:)`, typically computed from a `GeometryReader` as shown, since size/position information is exactly the kind of data that naturally needs to flow from a child (who knows its own rendered size) up to a parent (who might need that size to lay out other content).

---

## 31.6 Passing Data Up with Preferences

An ancestor view reads reported preference values via `.onPreferenceChange()`, completing the upward data flow — a common pattern for cases like sizing a container based on its dynamic content.

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

`.onPreferenceChange(HeightPreferenceKey.self) { }` sits on an ancestor, receiving the (possibly reduced/combined) value reported by descendants below it, and can store it into local `@State` to drive further layout decisions elsewhere in the hierarchy — completing a full round trip where a child's measured size ultimately influences behavior back up at the parent level, something a simple `@Binding` alone isn't naturally suited for.

---

## 31.7 Anchor and Coordinate Space Conversion

`Anchor<Value>` is a preference-compatible way to pass *geometry references* (rather than raw computed values) up the hierarchy, resolved later against a specific coordinate space — useful when the exact frame is only meaningful once you know which coordinate space to resolve it in.

```swift
struct AnchorDemoView: View {
    @State private var highlightAnchor: Anchor<CGRect>?

    var body: some View {
        VStack {
            Text("Target")
                .padding()
                .background(.blue.opacity(0.2))
                .anchorPreference(key: BoundsPreferenceKey.self, value: .bounds) { $0 }

            Spacer().frame(height: 100)
        }
        .overlayPreferenceValue(BoundsPreferenceKey.self) { anchor in
            GeometryReader { proxy in
                if let anchor {
                    let rect = proxy[anchor]
                    Rectangle()
                        .stroke(.red, lineWidth: 2)
                        .frame(width: rect.width, height: rect.height)
                        .position(x: rect.midX, y: rect.midY)
                }
            }
        }
    }
}

struct BoundsPreferenceKey: PreferenceKey {
    static var defaultValue: Anchor<CGRect>?
    static func reduce(value: inout Anchor<CGRect>?, nextValue: () -> Anchor<CGRect>?) {
        value = nextValue() ?? value
    }
}
```

`.anchorPreference()` reports an `Anchor` (an opaque geometry reference, not yet a concrete `CGRect`) up through preferences. Only later, when a `GeometryProxy` subscripts the anchor (`proxy[anchor]`), does it resolve into an actual `CGRect` in that proxy's specific coordinate space. This deferred-resolution design lets the same anchor be correctly interpreted in different coordinate spaces depending on where it's ultimately read, which a plain pre-computed `CGRect` value couldn't support as flexibly.

---

## 31.8 The Layout Protocol: sizeThatFits

The `Layout` protocol (iOS 16+) lets you build entirely custom container layouts (like a custom flow layout or radial arrangement) with the same performance characteristics as built-in containers like `HStack`. Its first required method, `sizeThatFits`, determines the container's own size given its subviews and available space proposal.

```swift
struct SimpleFlowLayout: Layout {
    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var currentRowWidth: CGFloat = 0
        var totalHeight: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentRowWidth + size.width > maxWidth {
                totalHeight += rowHeight
                currentRowWidth = 0
                rowHeight = 0
            }
            currentRowWidth += size.width
            rowHeight = max(rowHeight, size.height)
        }
        totalHeight += rowHeight
        return CGSize(width: maxWidth == .infinity ? currentRowWidth : maxWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        // covered in 31.9
    }
}
```

`sizeThatFits` receives a `ProposedViewSize` (the space the parent is offering) and each `subview`'s own `sizeThatFits()` to query its ideal size — the method's job is purely to compute and return *the container's own total size*, without yet deciding exact subview positions (that's `placeSubviews`'s job, next). This two-phase design (size first, then placement) mirrors exactly how SwiftUI's own built-in containers negotiate size with their parents before finalizing child positions.

---

## 31.9 The Layout Protocol: placeSubviews

`placeSubviews`, the second required `Layout` method, is where each subview actually gets assigned its final position within the bounds already computed by `sizeThatFits`.

```swift
extension SimpleFlowLayout {
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width
            rowHeight = max(rowHeight, size.height)
        }
    }
}
```

`placeSubviews` iterates each `subview` and calls `subview.place(at:proposal:)` to assign its final origin point within the container's `bounds` — here implementing simple line-wrapping flow logic, placing each subview left-to-right and wrapping to a new row when the current row would overflow. Together, `sizeThatFits` and `placeSubviews` give complete, first-class control over custom layout behavior, performing at the same level as SwiftUI's own built-in stacks since they participate in the very same layout protocol.

---

## 31.10 Layout Cache for Expensive Layouts 🔴

The `cache` parameter (of a type you define via the optional `Cache` associated type) lets a `Layout` conformer store expensive intermediate computation results across repeated `sizeThatFits`/`placeSubviews` calls, avoiding redundant work.

```swift
struct CachedFlowLayout: Layout {
    struct CacheData {
        var subviewSizes: [CGSize] = []
    }

    func makeCache(subviews: Subviews) -> CacheData {
        CacheData(subviewSizes: subviews.map { $0.sizeThatFits(.unspecified) })
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout CacheData) -> CGSize {
        // reuse cache.subviewSizes instead of recomputing sizeThatFits per subview
        let totalWidth = cache.subviewSizes.reduce(0) { $0 + $1.width }
        return CGSize(width: totalWidth, height: cache.subviewSizes.map(\.height).max() ?? 0)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout CacheData) {
        // reuse cache.subviewSizes here too
    }
}
```

`makeCache(subviews:)` runs once to build the initial cache, and SwiftUI passes the same `cache` value (as `inout`) into both `sizeThatFits` and `placeSubviews`, and across repeated layout passes — meaning a genuinely expensive computation (like measuring many subviews' intrinsic sizes) can be computed once and reused, rather than redundantly recalculated on every single layout pass. This matters most for `Layout` conformers with non-trivial per-subview computation and many subviews, where redundant recomputation would otherwise become a real performance bottleneck.

---

## 31.11 EquatableView and Manual Diffing 🔴

`.equatable()` opts a view into using `Equatable` conformance (on the view itself or its data) to short-circuit SwiftUI's default diffing, letting you manually declare "this view doesn't need to re-render if its inputs are equal" for cases where the default structural diffing is more conservative than necessary.

```swift
struct ExpensiveRow: View, Equatable {
    let item: Item

    static func == (lhs: ExpensiveRow, rhs: ExpensiveRow) -> Bool {
        lhs.item.id == rhs.item.id && lhs.item.lastModified == rhs.item.lastModified
    }

    var body: some View {
        // some expensive-to-compute view content
        Text(item.title)
    }
}

struct EquatableUsageView: View {
    let items: [Item]

    var body: some View {
        ForEach(items) { item in
            ExpensiveRow(item: item).equatable()
        }
    }
}
```

By default, SwiftUI re-evaluates a view's `body` whenever any of its inputs change, using its own structural comparison. `.equatable()` instead defers entirely to your custom `==` implementation — if it returns `true`, SwiftUI skips re-invoking `body` altogether, even if some input technically changed in a way your `==` considers irrelevant (like a field not used in rendering). This is a targeted performance tool for expensive views where you can prove, via a custom equality check, that certain input changes genuinely don't require re-rendering.

---

## 31.12 Diagnosing Body Invalidation Storms 🔴

A "body invalidation storm" is when a view's `body` re-evaluates far more often than the visible UI actually changes — usually because state is more broadly scoped or more frequently mutated than necessary.

```swift
// PROBLEM: entire list re-renders every time ANY item's data changes,
// because all items live in one big @State array on the parent
struct StormProneListView: View {
    @State private var items: [Item] = []

    var body: some View {
        List(items) { item in
            ExpensiveRow(item: item) // re-evaluates whenever `items` array identity changes at all
        }
    }
}

// BETTER: each row observes only its own model, isolating invalidation
@Observable
class ItemModel {
    var title: String
    init(title: String) { self.title = title }
}

struct IsolatedRowView: View {
    let model: ItemModel

    var body: some View {
        Text(model.title) // only re-evaluates when THIS model's tracked properties change
    }
}
```

The common root cause is over-broad state: a single `@State` array or object shared across many rows means mutating *any* row's data can trigger recomputation touching the whole array/object, and downstream, more `body` re-evaluation than the actual visible change warrants. `@Observable` (recall section 25) already does better than `ObservableObject` here, since it tracks property-level access rather than whole-object changes — but true isolation, as shown in `IsolatedRowView`, comes from giving each row its own independently-observed model object rather than reading from a shared parent-owned collection.

---

## 31.13 The SwiftUI Performance Instrument 🔴

Xcode's Instruments app includes a dedicated SwiftUI template with a "SwiftUI View Body" track, purpose-built for diagnosing exactly which views are re-evaluating their `body`, how often, and (crucially) *why* — surfacing the specific state dependency that triggered each invalidation.

```swift
// To investigate a suspected invalidation storm:
// 1. Product > Profile in Xcode (or Instruments > SwiftUI template)
// 2. Reproduce the interaction that feels janky
// 3. Inspect the "SwiftUI View Body" track for update frequency per view type
// 4. Each recorded update lists the specific property/dependency that triggered it
```

Rather than guessing at performance problems by reading code, the SwiftUI Performance instrument gives an authoritative, empirical view of what's actually happening at runtime — which view types are being re-evaluated, how frequently relative to user interaction, and which specific piece of state each re-evaluation was attributed to. This closes the loop on sections 31.11–31.12's diagnostic techniques: rather than only reasoning abstractly about which state might be too broadly scoped, the instrument lets you directly observe cause and effect, confirming whether a fix (like isolating a row's model, per 31.12) actually reduced invalidation frequency in practice.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Multi-view composition | `@ViewBuilder`, `TupleView` | Combine block statements into one view type |
| Conditional branches | `_ConditionalContent` | Represents `if`/`else` branches; affects identity |
| Type erasure | `AnyView` | Escapes `some View`; hides type from diffing |
| Reusable transforms | `ViewModifier`, `.modifier()` | Package composable view transformations |
| Upward data flow | `PreferenceKey`, `.preference()` | Pass data from child to ancestor |
| Reading preferences | `.onPreferenceChange()` | Ancestor reacts to reported child values |
| Geometry references | `Anchor`, `.anchorPreference()` | Deferred, coordinate-space-resolved geometry |
| Custom layout sizing | `Layout.sizeThatFits` | Compute a custom container's own size |
| Custom layout placement | `Layout.placeSubviews` | Assign final subview positions |
| Layout performance | `Layout` `cache` | Reuse expensive per-layout computation |
| Manual diffing | `.equatable()` | Skip `body` re-evaluation via custom equality |
| Diagnosing over-updates | Isolated `@Observable` models | Narrow invalidation scope per view |
| Empirical profiling | SwiftUI Performance instrument | Observe real update frequency and cause |
