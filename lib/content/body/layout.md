*Estimated read time: ~30 minutes*

---

## 24.1 `VStack`, `HStack`, `ZStack`

The three foundational layout containers arrange their children vertically, horizontally, or stacked on top of each other along the z-axis, respectively:

```swift
VStack {
    Text("First")
    Text("Second")
}

HStack {
    Image(systemName: "star")
    Text("Favorite")
}

ZStack {
    Color.blue
    Text("On top")   // renders above Color.blue, since it's declared later
}
```

Within a `ZStack`, later children render on top of earlier ones — this stacking order (not just visual position) is a common source of confusion for developers used to CSS's different default layering conventions.

---

## 24.2 `Spacer` and How It Grows

`Spacer` is an invisible view that expands to fill all available space along its containing stack's axis, pushing sibling views apart — it's the primary tool for distributing space deliberately rather than letting views bunch together.

```swift
HStack {
    Text("Left")
    Spacer()              // expands to push "Left" and "Right" to opposite ends
    Text("Right")
}

HStack {
    Text("A")
    Spacer(minLength: 20)   // guarantees at least 20 points, but can grow larger if space allows
    Text("B")
}
```

Multiple `Spacer`s in one stack divide the available extra space among themselves — two `Spacer()`s in an `HStack` with three texts distribute equally, effectively spreading the texts into three evenly-spaced groups.

---

## 24.3 Stack Alignment

Each stack type accepts an `alignment` parameter controlling how children line up along the *cross*-axis (perpendicular to the stack's main direction) — for a `VStack`, that's horizontal alignment; for an `HStack`, vertical alignment.

```swift
VStack(alignment: .leading) {
    Text("Short")
    Text("A much longer line of text")
}
// both lines left-align, rather than the default .center alignment

HStack(alignment: .top) {
    Text("Short")
    Text("A much\ntaller\nmulti-line text")
}
// both align to their top edges, rather than vertically centering relative to each other
```

`ZStack` accepts a two-dimensional `alignment` (like `.topLeading`, `.bottomTrailing`) since it has no single primary axis — this determines where children are positioned relative to each other when they don't all share the same size.

---

## 24.4 Stack Spacing and `Divider`

The `spacing` parameter controls the fixed gap between a stack's children (as opposed to `Spacer`'s flexible, space-filling gap), and `Divider` draws a thin separator line matching the stack's cross-axis:

```swift
VStack(spacing: 16) {
    Text("First")
    Divider()          // a thin horizontal line, since it's inside a VStack
    Text("Second")
}

HStack(spacing: 8) {
    Text("Left")
    Divider()          // a thin vertical line, since it's inside an HStack
    Text("Right")
}
```

`spacing` sets a uniform, fixed gap between every consecutive pair of children (or `nil`, the default, which uses a small system-standard spacing) — unlike `Spacer`, which grows to consume whatever space is available rather than staying fixed.

---

## 24.5 `.padding()` Variations

`.padding()` adds space around a view's edges, with several overloads controlling exactly which edges and how much:

```swift
Text("Hello").padding()                     // default system spacing, applied to all four edges
Text("Hello").padding(20)                    // 20 points, applied to all four edges
Text("Hello").padding(.horizontal, 20)        // 20 points, only leading and trailing edges
Text("Hello").padding(.top, 10)               // 10 points, only the top edge
Text("Hello").padding(EdgeInsets(top: 5, leading: 10, bottom: 5, trailing: 10))   // fully custom per-edge
```

Recall from section 23.8 that padding's *visual* effect depends heavily on where it falls in a modifier chain relative to `.background()` — padding applied before a background extends that background to cover the padded area; padding applied after leaves the background at its original, smaller size.

---

## 24.6 `.frame()` Fixed Sizing

`.frame(width:height:)` requests a specific, fixed size for a view — though (crucially, tying into 24.8's negotiation model) it's a *request*, not an absolute guarantee, since a parent might still not honor it exactly under certain constraints.

```swift
Text("Hello")
    .frame(width: 200, height: 100)
    .background(.blue)   // the blue background now fills this fixed 200x100 area

Circle()
    .frame(width: 50, height: 50)   // a 50x50 circle, regardless of its containing view's size
```

A `.frame()` with only one dimension specified (e.g. just `width:`) lets the other dimension be determined naturally by the view's own content or by further modifiers — you don't have to fix both dimensions simultaneously.

---

## 24.7 `.frame(maxWidth: .infinity)` and Flexible Sizing

Unlike a fixed `.frame(width:height:)`, `.frame(maxWidth: .infinity)` requests that a view expand to fill *all available space* along that dimension, rather than a specific fixed size — the most common way to make a view stretch to fill its container.

```swift
Text("Hello")
    .frame(maxWidth: .infinity, alignment: .leading)   // stretches full-width, text aligned to the leading edge
    .background(.blue)                                   // background now spans the full available width

Rectangle()
    .frame(maxWidth: .infinity, maxHeight: .infinity)     // fills all available space in both dimensions
```

The `alignment:` parameter matters here specifically because the view's *content* (like the text) doesn't automatically grow to fill the expanded frame — only the frame itself expands, so `alignment` determines where within that now-larger frame the actual content sits.

---

## 24.8 How SwiftUI Layout Negotiation Works: Parent Proposes, Child Decides

This is the conceptual foundation underlying every layout modifier covered so far: SwiftUI's layout algorithm works through a **proposal/response** negotiation, not a rigid, one-directional sizing rule. A parent view *proposes* a size to each child; the child then *decides* its own actual size (which might differ from the proposal) based on that proposal and its own content; finally, the parent positions the child within itself according to that returned size.

```swift
// Conceptually:
// 1. The screen proposes its full size to the root view.
// 2. A VStack proposes a size to each of its children (dividing available space among them).
// 3. Each child (e.g. a Text) decides its own actual size — a Text might return a size
//    just large enough to fit its string, ignoring most of an overly generous proposal.
// 4. The VStack then positions each child according to the size it actually returned.
```

This explains a lot of seemingly-mysterious SwiftUI sizing behavior: a plain `Text` inside a `VStack` doesn't fill the available width by default, because `Text` (as the child) decides its own size based on its content, largely ignoring the parent's generous proposal — you have to explicitly request otherwise (via `.frame(maxWidth: .infinity)`, 24.7) to change that child's own sizing decision.

---

## 24.9 `.fixedSize()` and Escaping Proposals

`.fixedSize()` lets a view opt out of a parent's size proposal, sizing itself purely according to its own natural, "ideal" content size instead — useful when a parent would otherwise compress or truncate content you want to guarantee stays fully visible.

```swift
Text("This is a fairly long piece of text that would normally wrap or truncate")
    .frame(width: 100)   // parent proposes a narrow 100pt width, causing wrapping

Text("This is a fairly long piece of text that would normally wrap or truncate")
    .fixedSize()         // ignores any narrow proposal entirely, sizing to its full, unwrapped natural width
```

`.fixedSize(horizontal:vertical:)` lets you control this independently per axis — `.fixedSize(horizontal: false, vertical: true)` is a common pattern for a multi-line `Text` that should still wrap normally (respecting the parent's proposed width) but never truncate vertically, always growing to fit all of its wrapped lines.

---

## 24.10 `.layoutPriority()`

When an `HStack`/`VStack` doesn't have enough space to give every child its full ideal size, `.layoutPriority()` (default: `0` for every view) determines which children get compressed first — views with a *higher* priority are given their requested space before views with lower priority, which get compressed to fit whatever remains.

```swift
HStack {
    Text("A fixed label:")
        .layoutPriority(1)   // this text is protected from truncation first
    TextField("Enter a value", text: $inputValue)
        // no explicit priority (defaults to 0) — this field gets compressed first if space runs out
}
```

This is the standard fix for a common layout problem: a fixed label getting truncated while an adjacent, more flexible element (like a `TextField`) takes up disproportionate space — raising the label's priority tells the stack to protect it from compression first, letting the more flexible sibling absorb the space constraint instead.

---

## 24.11 Shapes: `Rectangle`, `RoundedRectangle`, `Circle`, `Capsule`

SwiftUI provides several built-in `Shape`-conforming views (the full `Shape` protocol is covered in section 30.2) that draw geometric primitives, fillable and strokeable like any other view:

```swift
Rectangle()
    .fill(.blue)
    .frame(width: 100, height: 60)

RoundedRectangle(cornerRadius: 12)
    .fill(.green)
    .frame(width: 100, height: 60)

Circle()
    .fill(.red)
    .frame(width: 60, height: 60)

Capsule()
    .fill(.orange)
    .frame(width: 120, height: 40)   // a rounded-rectangle whose corner radius equals half its height
```

Shapes are actual views (usable in a `body` directly, combinable with other modifiers) rather than a separate drawing-only mechanism, which is what makes them convenient to use directly as backgrounds, overlays, or clip masks (24.12) throughout ordinary view composition.

---

## 24.12 `.clipShape()` and `.mask()`

`.clipShape()` clips a view to a specific shape's boundary, hiding anything outside it; `.mask()` is more general, using an arbitrary view's opacity as the clipping template rather than being limited to geometric shapes.

```swift
Image("myPhoto")
    .resizable()
    .frame(width: 100, height: 100)
    .clipShape(Circle())   // crops the square image into a circular shape

Text("Gradient Text")
    .font(.largeTitle)
    .foregroundStyle(.clear)   // hide the plain color entirely
    .background(
        LinearGradient(colors: [.blue, .purple], startPoint: .leading, endPoint: .trailing)
    )
    .mask(Text("Gradient Text").font(.largeTitle))   // uses the text's own shape as the visible mask
```

`.clipShape()` is the simpler, more common tool for basic shape-based cropping (rounding an image's corners, making an avatar circular); `.mask()` is more powerful but more involved, letting any view's rendered content (not just a geometric shape) determine what's visible.

---

## 24.13 `.background()` with a View

`.background()` accepts not just a color, but any arbitrary view, layered behind the modified view and automatically sized to match it (unless the background view has its own independent sizing behavior):

```swift
Text("Hello")
    .padding()
    .background(
        RoundedRectangle(cornerRadius: 8)
            .fill(.blue)
    )

Text("Layered")
    .padding()
    .background {
        Image("texture")
            .resizable()
            .opacity(0.3)
    }
```

The trailing-closure form (`.background { ... }`, using `@ViewBuilder`, recall section 12.4) lets you compose more complex backgrounds without needing to construct a single combined expression — useful when the background itself needs multiple layered elements.

---

## 24.14 `.overlay()` with a View

`.overlay()` is the mirror image of `.background()` — it layers a view *on top of* the modified view, rather than behind it, commonly used for borders, badges, or icons positioned relative to the base content:

```swift
Circle()
    .fill(.blue)
    .frame(width: 60, height: 60)
    .overlay(
        Text("5")
            .foregroundStyle(.white)
            .font(.headline)
    )

Image("profile")
    .resizable()
    .frame(width: 80, height: 80)
    .clipShape(Circle())
    .overlay(
        Circle().stroke(.white, lineWidth: 3)   // a border ring drawn on top of the clipped image
    )
```

A common, specific pattern is exactly this last example — clipping an image to a circle, then adding a stroked circle overlay to create a clean border ring, since stroking the same `Circle()` used for `.clipShape()` guarantees the border precisely traces the clip boundary.

---

## 24.15 Safe Area and `.ignoresSafeArea()`

The safe area represents the portion of the screen not obscured by system UI elements (the status bar, home indicator, notch/Dynamic Island, navigation/tab bars) — SwiftUI automatically keeps content within it by default, and `.ignoresSafeArea()` explicitly opts a view out of that automatic inset.

```swift
Color.blue
    .ignoresSafeArea()   // extends the blue color to fill the entire screen, including under the status bar

VStack {
    Text("Content")
}
.ignoresSafeArea(.container, edges: .bottom)   // ignores only the bottom safe area, keeping the top inset
```

`.ignoresSafeArea()` is commonly applied to full-screen background colors/images specifically (so they visually extend edge-to-edge), while the actual interactive content within that background typically still respects the safe area — mixing "extend the background" with "keep the content properly inset" by applying `.ignoresSafeArea()` selectively, often to just a background layer rather than an entire view hierarchy.

---

## 24.16 `.aspectRatio()` and Content Modes

Beyond its use with `Image` (recall section 23.4), `.aspectRatio()` can constrain *any* view to a specific width-to-height ratio, useful for video players, custom shapes, or any layout needing a locked proportional relationship regardless of available space:

```swift
Rectangle()
    .fill(.blue)
    .aspectRatio(16/9, contentMode: .fit)   // maintains a 16:9 ratio, fitting within available space

Color.gray
    .aspectRatio(1, contentMode: .fit)      // a perfect square, regardless of the space it's given
```

When no explicit ratio is given (`aspectRatio(contentMode:)` alone), the view uses its own *intrinsic* aspect ratio (its natural width-to-height relationship) but still applies the `.fit`/`.fill` behavior relative to whatever space its parent proposes — useful for images specifically, where you want to preserve the asset's native proportions without hardcoding a specific ratio number.

---

## 24.17 `ViewThatFits`

`ViewThatFits` tries each of its children in order, rendering the *first one that actually fits* within the available space — a declarative way to provide multiple layout variants (e.g. a full version and a compact fallback) without manually measuring available space yourself.

```swift
ViewThatFits {
    HStack {
        Text("Full label with lots of detail")
        Image(systemName: "star.fill")
    }
    Image(systemName: "star.fill")   // compact fallback, used only if the HStack above doesn't fit
}
```

This is particularly useful for adaptive toolbars or labels that need to gracefully degrade to a simpler representation on narrower screens/contexts (like a compact iPhone in landscape, or a narrow sidebar column) without writing manual size-class-checking conditional logic yourself.

---

## 24.18 `GeometryReader` Basics

`GeometryReader` exposes the exact size and coordinate-space information of the space available to it, via a `GeometryProxy` passed into its content closure — the most direct, low-level way to build layouts that need to react to their own actual available dimensions.

```swift
GeometryReader { geometry in
    Text("Available width: \(geometry.size.width)")
        .frame(width: geometry.size.width * 0.5)   // exactly half of whatever space is available
}
```

Unlike ordinary views (which passively receive a proposal and decide their own size, recall 24.8), `GeometryReader` always greedily expands to fill *all* available space itself, then provides that size information to its content closure — this greedy-filling behavior is precisely the source of the pitfalls covered next in 24.19.

---

## 24.19 `GeometryReader` Pitfalls and Alternatives 🔵

`GeometryReader`'s greedy space-filling behavior (24.18) is its biggest practical drawback: since it always expands to fill all available space regardless of its content's actual needs, it frequently disrupts a layout's natural sizing behavior in ways that are surprising and hard to work around, especially when nested inside stacks alongside other, normally-behaving views.

```swift
// Problematic: GeometryReader expands to fill the VStack's available space,
// even though "Text" alone would naturally need much less room
VStack {
    Text("Hello")
    GeometryReader { geo in
        Color.blue
    }
    Text("World")
}
// The GeometryReader's greedy expansion can squeeze "Text" views into unexpectedly small space,
// or dominate the VStack in ways that don't match the visual intent
```

Modern alternatives that avoid this pitfall by not requiring a fully separate, greedily-expanding container include `.onGeometryChange()` (24.20) and `containerRelativeFrame()` (24.21) — both let you react to or express relative sizing *without* introducing `GeometryReader`'s disruptive greedy-fill side effect, and are generally preferred in new code whenever they can express what's needed.

---

## 24.20 `.onGeometryChange()` 🔵

`.onGeometryChange()` lets a view observe its own size/position changes and react via a callback, without needing to wrap it in a separate, greedily-expanding `GeometryReader` container at all — solving `GeometryReader`'s biggest pitfall (24.19) directly.

```swift
struct ContentView: View {
    @State private var width: CGFloat = 0

    var body: some View {
        Text("Hello")
            .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.width
            } action: { newWidth in
                width = newWidth
            }
    }
}
```

Since `.onGeometryChange()` is a plain modifier (not a container view), it doesn't alter the view's own natural layout behavior at all — it simply observes the size the view ends up with (through the ordinary parent-proposes/child-decides negotiation from 24.8) and reports changes to that size via a callback, without any of `GeometryReader`'s greedy expansion side effects.

---

## 24.21 `containerRelativeFrame()` 🔵

`containerRelativeFrame()` sizes a view as a fraction (or fixed count of equal divisions) of its enclosing container's size — directly expressing "half the width of my container" or "one-third of my scroll view's width" declaratively, again without needing `GeometryReader`.

```swift
ScrollView(.horizontal) {
    LazyHStack {
        ForEach(items) { item in
            ItemView(item: item)
                .containerRelativeFrame(.horizontal, count: 3, spacing: 10)   // exactly 1/3 of the scroll view's width
        }
    }
}

Color.blue
    .containerRelativeFrame(.horizontal) { width, axis in
        width * 0.8   // 80% of the container's width, computed via a custom closure
    }
```

This is especially common in horizontally-scrolling carousels/galleries (recall section 26.13's `LazyHStack` coverage), where you want each item to size itself relative to the scroll view's own width (e.g. "always show exactly 3 items per screen") without manually computing that fraction via a `GeometryReader`.

---

## 24.22 Alignment Guides 🟠

Beyond a stack's built-in `alignment` parameter (24.3), `.alignmentGuide()` lets you customize exactly where a specific view's alignment point sits, overriding the default alignment behavior for that one view without affecting its siblings.

```swift
HStack(alignment: .top) {
    Text("A")
        .alignmentGuide(.top) { dimensions in
            dimensions[.top] + 10   // shift this specific view's top-alignment point down by 10 points
        }
    Text("B")   // uses the default, unmodified top alignment
}
```

This is useful for fine-tuning visual alignment in cases where the default geometric alignment (based on each view's own bounding box) doesn't quite match the visually-intended alignment — for example, aligning text baselines against an icon's visual center rather than its bounding box edge.

---

## 24.23 Custom Alignment Identifiers 🟠

Beyond the built-in alignment guides (`.top`, `.leading`, `.center`, and similar), you can define entirely custom alignment identifiers — useful for aligning views that aren't direct siblings in the same stack, by sharing a common, custom-defined alignment guide across a more complex view hierarchy.

```swift
extension VerticalAlignment {
    private struct CustomCenter: AlignmentID {
        static func defaultValue(in context: ViewDimensions) -> CGFloat {
            context[VerticalAlignment.center]
        }
    }
    static let customCenter = VerticalAlignment(CustomCenter.self)
}

HStack(alignment: .customCenter) {
    Image(systemName: "star.fill")
        .alignmentGuide(.customCenter) { $0[VerticalAlignment.center] }
    VStack {
        Text("Title")
        Text("Subtitle")
            .alignmentGuide(.customCenter) { $0[VerticalAlignment.center] }
    }
}
```

Custom alignment identifiers are an advanced tool primarily useful for precisely aligning elements across genuinely different, nested view hierarchies (not simple direct siblings) — for example, aligning an icon against a specific line of text several levels deep in a nested `VStack`, which no built-in stack alignment option could express directly.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `VStack`/`HStack`/`ZStack` | Vertical, horizontal, and depth-stacked arrangement; `ZStack` layers later children on top |
| `Spacer` | Expands to fill available space along the stack's axis, pushing siblings apart |
| Stack alignment | Controls cross-axis alignment of children; `ZStack` uses two-dimensional alignment |
| Spacing/`Divider` | Fixed gaps between children, plus a thin separator line matching the cross-axis |
| `.padding()` | Space around a view's edges; visual effect depends on modifier order relative to `.background()` |
| `.frame()` fixed | Requests a specific size — a request, not an absolute guarantee |
| `.frame(maxWidth: .infinity)` | Requests all available space; `alignment:` positions content within the expanded frame |
| Parent-proposes/child-decides | The core negotiation model: parents propose sizes, children decide their own actual size |
| `.fixedSize()` | Opts a view out of a parent's proposal, sizing to its own natural content size instead |
| `.layoutPriority()` | Determines which children get compressed first when space runs short |
| Shapes | `Rectangle`/`RoundedRectangle`/`Circle`/`Capsule` — real views, usable anywhere a view is expected |
| `.clipShape()`/`.mask()` | Crop to a shape boundary, or use any view's rendered content as a clipping template |
| `.background()`/`.overlay()` | Layer any view behind or in front of the modified view, auto-sized to match it |
| Safe area | Automatically avoids system UI by default; `.ignoresSafeArea()` opts specific views/edges out |
| `.aspectRatio()` | Locks a width-to-height ratio for any view, not just images |
| `ViewThatFits` | Renders the first child variant that actually fits the available space |
| `GeometryReader` | Exposes exact available size/coordinate info, but always greedily fills all available space |
| `GeometryReader` pitfalls | Greedy expansion disrupts natural sibling sizing — prefer modern alternatives when possible |
| `.onGeometryChange()` | Observes a view's own size/position changes via callback, without greedy expansion |
| `containerRelativeFrame()` | Sizes a view as a fraction of its container, declaratively, without `GeometryReader` |
| Alignment guides | Override a specific view's alignment point without affecting its siblings |
| Custom alignment identifiers | Share a custom alignment guide across non-sibling views in a more complex hierarchy |

**Next up:** Section 25 — State Management.
