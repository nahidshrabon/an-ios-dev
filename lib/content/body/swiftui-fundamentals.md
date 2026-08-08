*Estimated read time: ~30 minutes*

---

## 23.1 The `View` Protocol and `body`

Every SwiftUI view is a type conforming to the `View` protocol, which has exactly one requirement: a computed property named `body` describing what the view displays, in terms of other views.

```swift
struct GreetingView: View {
    var body: some View {
        Text("Hello, SwiftUI!")
    }
}
```

`body`'s return type, `some View` (recall the opaque return type mechanism from section 8.7), means "some specific, concrete view type, determined by what's actually written inside — but callers don't need to know exactly which type." This is precisely why `body` can return wildly different concrete types (a `Text`, a `VStack` containing several other views, and so on) across different views, all expressed with the exact same `some View` signature.

---

## 23.2 Views Are Descriptions, Not Objects

Unlike UIKit's `UIView` (a genuine, persistent object that lives on screen and can be mutated after creation), a SwiftUI `View` value is a lightweight, disposable **description** of what should appear — SwiftUI creates and discards these description values constantly, computing a new `body` any time the underlying state changes, and then diffing the result against the previous description to decide what actually needs to change on screen.

```swift
struct CounterView: View {
    var count: Int

    var body: some View {
        Text("Count: \(count)")   // this Text VALUE is recreated fresh every time body is computed
    }
}
```

This is a genuine mental model shift from UIKit: you never mutate a `Text` view's string after creating it the way you'd set `label.text = "new value"` on a `UILabel` — instead, you describe what the view *should* look like for the current state, and SwiftUI recomputes and re-renders that description automatically whenever the state driving it changes (the full mechanics of what triggers this recomputation are covered in section 25).

---

## 23.3 `Text` and Text Styling

`Text` displays a string, and supports a chainable set of modifiers for basic text-specific styling — separate from the general-purpose modifiers covered in 23.7, though visually similar in usage:

```swift
Text("Hello, World!")
    .font(.title)
    .fontWeight(.bold)
    .foregroundStyle(.blue)
    .italic()
    .underline()
    .strikethrough()
```

`Text` also accepts an `AttributedString` directly (recall section 14.17), letting you author rich text with mixed formatting — bold words, links — using Markdown syntax rather than manually chaining modifiers over an entire string:

```swift
Text("This is **bold** and this is *italic*")   // Markdown syntax works directly in Text's string literal
```

---

## 23.4 `Image` and Image Scaling Modes

`Image` displays either an asset-catalog image, an SF Symbol (see 23.5), or a system-provided image, and requires explicit configuration to control how it fits into whatever frame it's given:

```swift
Image("myPhoto")           // from the asset catalog
    .resizable()             // without this, the image renders at its native pixel size, ignoring .frame()
    .aspectRatio(contentMode: .fit)    // scales to fit entirely within the frame, preserving aspect ratio
    .frame(width: 200, height: 200)

Image("myPhoto")
    .resizable()
    .aspectRatio(contentMode: .fill)   // scales to fill the frame entirely, cropping if necessary
    .frame(width: 200, height: 200)
    .clipped()                          // without this, the overflowing portion still renders outside the frame
```

The `.resizable()` modifier is easy to forget and a common source of "my image isn't respecting `.frame()`" confusion — without it, `Image` always renders at its underlying asset's native pixel dimensions, entirely ignoring any `.frame()` modifier applied afterward.

---

## 23.5 SF Symbols and Symbol Configuration

SF Symbols are Apple's built-in icon library, referenced by name via `Image(systemName:)`, and support their own configuration options distinct from photo images:

```swift
Image(systemName: "star.fill")
    .font(.largeTitle)              // symbols scale with font size, unlike photo images
    .foregroundStyle(.yellow)

Image(systemName: "heart.fill")
    .symbolRenderingMode(.multicolor)   // some symbols support built-in multi-color rendering

Image(systemName: "wifi")
    .symbolVariant(.slash)              // applies a variant, e.g. "wifi.slash" without hardcoding the string
```

Because SF Symbols are vector-based and scale with the current font/Dynamic Type setting (recall section 23.13's connection to Dynamic Type), they automatically respect accessibility text-size preferences in a way that a fixed-pixel-size photo asset never could, without any extra work required.

---

## 23.6 `Label` and Its Layout Styles

`Label` pairs an icon with text as a single semantic unit — more than just visual convenience, since it also carries accessibility meaning as one combined element rather than two separate ones a screen reader would announce independently:

```swift
Label("Settings", systemImage: "gear")

Label("Favorites", systemImage: "star.fill")
    .labelStyle(.iconOnly)     // shows only the icon, hides the text (but keeps it for accessibility)

Label("Favorites", systemImage: "star.fill")
    .labelStyle(.titleOnly)    // shows only the text, hides the icon
```

`Label` is used extensively throughout system UI (tab bar items, list rows with leading icons, toolbar buttons) precisely because it bundles icon + text as one coherent, accessibility-aware unit, rather than requiring you to manually compose an `HStack { Image(...); Text(...) }` and separately manage its accessibility behavior yourself.

---

## 23.7 What a View Modifier Is

A view modifier is a method that takes an existing view and returns a **new** view wrapping it with additional behavior or appearance — modifiers don't mutate the original view in place (recall 23.2's "views are descriptions" point); they produce a new, wrapped description each time.

```swift
Text("Hello")
    .padding()              // wraps Text in a new view adding padding around it
    .background(.blue)       // wraps that padded view in a new view adding a blue background
    .cornerRadius(8)          // wraps that in a new view clipping corners
```

Each modifier call in this chain produces a distinct, nested view type under the hood — this chain's actual type is something like `_ClipEffect<_BackgroundStyleModifier<_PaddingLayout<Text>>>`, a deeply nested composition the `some View` opaque return type (23.1) conveniently hides from you, letting you write and reason about the chain without ever needing to spell out that type yourself.

---

## 23.8 Modifier Order Matters — A Demo

Since each modifier wraps the *previous* result (rather than all applying simultaneously to the original view), **the order modifiers are applied in changes the actual visual result** — this is one of the most common sources of SwiftUI confusion for newcomers.

```swift
// Padding BEFORE background: the background color extends to cover the padding too
Text("Hello")
    .padding()
    .background(.blue)
// Result: a blue rectangle with padding INSIDE it, around the text

// Background BEFORE padding: the background only covers the text's original bounds;
// the padding then adds transparent space OUTSIDE that colored rectangle
Text("Hello")
    .background(.blue)
    .padding()
// Result: a small blue rectangle tightly around the text, with transparent padding around THAT
```

The mental model that resolves this confusion: read a modifier chain from top to bottom (or left to right) as "wrap the previous result in this new behavior," not as "apply all of these properties to the base view simultaneously" — each step operates on the *cumulative* result of everything above it, not on the original `Text` alone.

---

## 23.9 Colors and Semantic System Colors

SwiftUI's `Color` type supports both fixed values (`.red`, `.blue`, a custom `Color(red:green:blue:)`) and **semantic system colors** that automatically adapt to context — most importantly, automatically adjusting between light and dark mode (recall section 23.16) without any extra code.

```swift
Text("Hello")
    .foregroundStyle(.primary)      // adapts: near-black in light mode, near-white in dark mode
    .background(Color(.systemBackground))   // adapts: white in light mode, near-black in dark mode

Text("Subtitle")
    .foregroundStyle(.secondary)     // a dimmer, adaptive variant of .primary, for de-emphasized text
```

Preferring semantic colors (`.primary`, `.secondary`, `Color(.systemBackground)`) over hardcoded fixed values (`.black`, `.white`) is what makes a view automatically correct in both light and dark mode, and is also what respects system-wide accessibility settings like Increase Contrast, without any conditional logic checking the current color scheme yourself.

---

## 23.10 `.foregroundStyle()` and Hierarchical Styles

`.foregroundStyle()` (the modern replacement for the older `.foregroundColor()`) accepts not just a single color, but a **style** — including hierarchical styles that automatically derive complementary shades from a single base color, useful for symbols/views with multiple layered parts:

```swift
Image(systemName: "cloud.sun.fill")
    .foregroundStyle(.blue, .yellow)   // multiple styles, applied to a symbol's distinct layers

Text("Title")
    .foregroundStyle(.primary)

Text("Subtitle")
    .foregroundStyle(.secondary)   // hierarchical: automatically a dimmer variant relative to .primary
```

`.foregroundStyle()` can accept up to three style arguments for multi-layered symbols (primary, secondary, tertiary layers), letting a single SF Symbol render with a coordinated, automatically-harmonious multi-tone appearance rather than requiring separate manual color configuration for each visual layer.

---

## 23.11 Gradients: Linear, Radial, Angular

SwiftUI provides three gradient types, usable anywhere a `ShapeStyle` is expected (backgrounds, foreground styles, shape fills):

```swift
LinearGradient(
    colors: [.blue, .purple],
    startPoint: .top,
    endPoint: .bottom
)

RadialGradient(
    colors: [.yellow, .orange],
    center: .center,
    startRadius: 0,
    endRadius: 200
)

AngularGradient(
    colors: [.red, .orange, .yellow, .green, .blue, .purple, .red],
    center: .center
)

Text("Hello")
    .padding()
    .background(LinearGradient(colors: [.blue, .purple], startPoint: .leading, endPoint: .trailing))
```

`LinearGradient` transitions along a straight line between two points; `RadialGradient` transitions outward from a center point; `AngularGradient` sweeps around a center point like a color wheel — each accepting either a plain color array or a `Gradient` value (which supports precise per-color "stop" positions for finer control over the transition).

---

## 23.12 Fonts and Text Styles

SwiftUI's `.font()` modifier accepts both fixed-size fonts and **text styles** — semantic sizes (`.largeTitle`, `.title`, `.headline`, `.body`, `.caption`, and others) that automatically scale with the user's Dynamic Type accessibility setting (see 23.13), rather than a fixed point size that ignores it entirely.

```swift
Text("Heading")
    .font(.largeTitle)          // semantic — scales with Dynamic Type

Text("Custom size")
    .font(.system(size: 24))    // fixed — does NOT scale with Dynamic Type

Text("Custom weight")
    .font(.title.weight(.bold))  // text styles support chaining weight/design modifications

Text("Custom design")
    .font(.body.monospaced())     // or a monospaced/rounded/serif design variant
```

**Prefer semantic text styles over fixed point sizes** for the vast majority of app text — this single choice is what makes text automatically respect a user's accessibility text-size preferences, a significant, low-effort accessibility win covered in full in section 70.

---

## 23.13 Dynamic Type and Scalable Text

Dynamic Type is the system-wide setting (in Settings → Accessibility → Display & Text Size) letting users scale all supporting text larger or smaller across every app — SwiftUI's semantic text styles (23.12) automatically participate in this scaling with zero additional code required.

```swift
Text("This text scales automatically")
    .font(.body)   // will grow noticeably larger if the user has increased their Dynamic Type setting
```

You can preview how a view behaves at different Dynamic Type sizes directly in Xcode Previews (see 23.14–23.15) using the `.environment(\.sizeCategory, ...)` modifier, or by testing with the Accessibility Inspector — verifying your layout doesn't break, truncate awkwardly, or overlap at the larger accessibility sizes is an important, often-overlooked part of building genuinely accessible SwiftUI views, expanded on further in section 70.10.

---

## 23.14 Xcode Previews with `#Preview`

`#Preview` is a macro (recall section 13.2's freestanding macro coverage) that generates a live, interactive preview of a view directly inside Xcode's canvas, without needing to build and run the full app on a simulator or device for every small UI iteration.

```swift
struct GreetingView: View {
    var body: some View {
        Text("Hello, SwiftUI!")
    }
}

#Preview {
    GreetingView()
}
```

Previews render using the same rendering engine as the actual app, update live as you edit source code, and support interaction (tapping buttons, scrolling) directly within Xcode's canvas — dramatically shortening the iteration loop compared to older UIKit-era workflows that typically required a full simulator relaunch to see even a small visual change.

---

## 23.15 Multiple Previews and Preview Traits

A single view can have multiple `#Preview` blocks, each configured differently — useful for simultaneously checking a view's appearance across different states, devices, or configurations without switching context:

```swift
#Preview("Light Mode") {
    GreetingView()
}

#Preview("Dark Mode") {
    GreetingView()
        .preferredColorScheme(.dark)
}

#Preview("Large Text", traits: .sizeThatFitsLayout) {
    GreetingView()
        .environment(\.sizeCategory, .accessibilityExtraLarge)
}
```

Preview **traits** (like `.sizeThatFitsLayout`, `.fixedLayout(width:height:)`, or device-specific traits) configure the preview's canvas behavior itself — independent from the view's own content/modifiers — letting you constrain how much space the preview canvas allocates, which device it simulates, or other environment-level presentation details.

---

## 23.16 Dark Mode and `.colorScheme`

SwiftUI automatically adapts semantic colors (23.9) to the system's current appearance setting, but you can also explicitly read or override the color scheme when a view genuinely needs different, non-color logic depending on light/dark mode:

```swift
struct AdaptiveView: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Text("Current mode: \(colorScheme == .dark ? "Dark" : "Light")")
            .background(colorScheme == .dark ? Color.black : Color.white)
    }
}

// force a specific appearance regardless of the system setting, e.g. for a preview or a fixed-theme screen:
SomeView()
    .preferredColorScheme(.dark)
```

`@Environment(\.colorScheme)` (a preview of section 25.6's broader environment-value coverage) is the mechanism for reading the current appearance inside a view's `body` — reserve explicit `colorScheme` checks for cases where semantic colors alone genuinely aren't sufficient (like choosing between two entirely different image assets, not just a color), since relying on semantic colors directly (23.9) is simpler and handles the vast majority of light/dark adaptation automatically.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `View` protocol/`body` | One requirement — a `some View`-returning computed property describing the view's content |
| Views as descriptions | Lightweight, disposable value descriptions, not persistent mutable objects like `UIView` |
| `Text` | Displays strings; supports both chained styling modifiers and `AttributedString`/Markdown |
| `Image` | Requires `.resizable()` before `.frame()` has any visual effect; scaling modes control fit vs. fill |
| SF Symbols | Vector-based, scale with font size and Dynamic Type automatically, unlike fixed-pixel photo assets |
| `Label` | Bundles icon + text as one accessibility-aware semantic unit |
| View modifiers | Wrap the previous view in a new one — never mutate in place |
| Modifier order | Each modifier wraps the cumulative result so far — order changes the actual visual outcome |
| Semantic colors | `.primary`/`.secondary`/`Color(.systemBackground)` auto-adapt to light/dark mode and contrast settings |
| `.foregroundStyle()` | Accepts hierarchical, multi-layer styles beyond a single flat color |
| Gradients | `LinearGradient`/`RadialGradient`/`AngularGradient`, usable anywhere a `ShapeStyle` is expected |
| Fonts/text styles | Prefer semantic styles (`.title`, `.body`) over fixed sizes to automatically support Dynamic Type |
| Dynamic Type | System-wide text-scaling accessibility setting; semantic text styles participate automatically |
| `#Preview` | Generates a live, interactive Xcode canvas preview without a full simulator build/run cycle |
| Multiple previews/traits | Configure several previews per view for different states/appearances/canvas layouts at once |
| `.colorScheme` | Reserve explicit checks for non-color logic; semantic colors handle most light/dark adaptation alone |

**Next up:** Section 24 — Layout.
