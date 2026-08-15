## 32.1 What Liquid Glass Is and the Design Intent

Liquid Glass is a translucent, dynamic material that reacts to underlying content and light, used throughout system chrome (toolbars, tab bars, controls) to create a sense of depth and continuity between interface layers and the content beneath them.

```swift
struct GlassIntentDemoView: View {
    var body: some View {
        ZStack {
            Image("scenic-background")
                .resizable()
                .scaledToFill()
                .ignoresSafeArea()

            VStack {
                Text("Liquid Glass")
                    .font(.title.bold())
                    .padding()
                    .glassEffect()
            }
        }
    }
}
```

The design intent behind Liquid Glass is that interface chrome shouldn't feel like an opaque layer sitting flatly on top of content — it should feel like it's genuinely part of the same physical space, refracting and reflecting the content beneath it the way real glass would. This differs conceptually from earlier flat/opaque design languages: rather than fully obscuring what's underneath, glass elements let content show through in a controlled, legible way, unifying chrome and content into one coherent visual system.

---

## 32.2 .glassEffect() on a View

`.glassEffect()` is the core modifier that applies the Liquid Glass material to any view, giving it the characteristic translucent, refractive appearance.

```swift
struct GlassButtonDemoView: View {
    var body: some View {
        Button {
            // action
        } label: {
            Image(systemName: "heart.fill")
                .font(.title2)
                .padding()
        }
        .glassEffect(.regular, in: .circle)
    }
}
```

`.glassEffect()` accepts an optional style (like `.regular`) and an `in:` shape parameter (such as `.circle` or a `RoundedRectangle`) that defines the glass element's clipped silhouette — the glass material is rendered within that shape's bounds, giving precise control over exactly how the translucent surface is contoured. This is the direct building block behind the `.glass`/`.glassProminent` button styles covered in section 28.12, which apply glass styling specifically tuned for button contexts.

---

## 32.3 GlassEffectContainer and Grouping

When multiple glass elements sit near each other, `GlassEffectContainer` groups them so they visually and physically interact as a coherent set — sharing refraction and blending behavior — rather than rendering as independent, disconnected glass surfaces.

```swift
struct GlassContainerDemoView: View {
    var body: some View {
        GlassEffectContainer(spacing: 16) {
            HStack(spacing: 16) {
                Image(systemName: "play.fill")
                    .padding()
                    .glassEffect(.regular, in: .circle)

                Image(systemName: "pause.fill")
                    .padding()
                    .glassEffect(.regular, in: .circle)

                Image(systemName: "stop.fill")
                    .padding()
                    .glassEffect(.regular, in: .circle)
            }
        }
    }
}
```

Without a shared `GlassEffectContainer`, each `.glassEffect()` call would render as an independent glass surface with no visual relationship to its neighbors. `GlassEffectContainer` establishes a shared rendering context so grouped glass elements behave as a cohesive material — closer to how physically adjacent pieces of glass would interact with light together, rather than each being computed in total isolation.

---

## 32.4 glassEffectID and Morphing Between Elements

`.glassEffectID(_:in:)` tags a glass element with a stable identity within a `GlassEffectContainer`'s namespace, enabling a smooth morphing transition when that element's shape, size, or position changes — rather than an abrupt cut between two distinct glass surfaces.

```swift
struct MorphingGlassView: View {
    @Namespace private var glassNamespace
    @State private var isExpanded = false

    var body: some View {
        GlassEffectContainer {
            Group {
                if isExpanded {
                    RoundedRectangle(cornerRadius: 24)
                        .fill(.clear)
                        .frame(width: 220, height: 80)
                        .glassEffect(.regular, in: .rect(cornerRadius: 24))
                        .glassEffectID("controlSurface", in: glassNamespace)
                } else {
                    Circle()
                        .fill(.clear)
                        .frame(width: 60, height: 60)
                        .glassEffect(.regular, in: .circle)
                        .glassEffectID("controlSurface", in: glassNamespace)
                }
            }
        }
        .onTapGesture { withAnimation(.spring) { isExpanded.toggle() } }
    }
}
```

This closely parallels `matchedGeometryEffect` (section 29.8–29.9) conceptually — a shared `@Namespace` plus a matching identity (here via `.glassEffectID()` rather than a plain `id:`) tells SwiftUI that two differently-shaped glass elements represent "the same" logical surface across a state change, so it animates a smooth morph between the small circular control and the larger expanded surface rather than performing an abrupt swap.

---

## 32.5 Glass in Toolbars and Tab Bars

System chrome elements like toolbars (section 27.16–27.18) and tab bars (section 27.7–27.9) adopt Liquid Glass automatically in modern SwiftUI, without requiring explicit `.glassEffect()` calls — the material is baked into these standard components' default appearance.

```swift
struct GlassChromeDemoView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                Image("content-image")
                    .resizable()
                    .scaledToFit()
            }
            .toolbar {
                ToolbarItem(placement: .bottomBar) {
                    Button("Share", systemImage: "square.and.arrow.up") { }
                }
            }
        }
    }
}
```

Because toolbars and tab bars already render with glass material automatically, developers generally don't need to manually apply `.glassEffect()` to system chrome — the manual APIs from 32.2–32.4 are primarily intended for *custom* controls and surfaces (like a bespoke floating control panel) that should visually match the same glass language used throughout the rest of the system.

---

## 32.6 Scroll Edge Effects with Glass Content

When glass-styled chrome (like a toolbar) sits at the edge of a scrollable view, the system applies a scroll edge effect — content passing beneath the glass chrome is subtly blurred/faded as it approaches the edge, reinforcing the sense that the chrome is a distinct translucent layer above the scrolling content.

```swift
struct ScrollEdgeGlassView: View {
    var body: some View {
        NavigationStack {
            List(0..<50) { index in
                Text("Row \(index)")
            }
            .navigationTitle("Scrolling List")
            .toolbarBackground(.visible, for: .navigationBar)
        }
    }
}
```

This edge effect happens automatically as part of standard navigation and toolbar chrome — as list content scrolls up beneath a glass navigation bar, it doesn't abruptly clip at the boundary but instead fades/blurs progressively, similar in spirit to `.scrollEdgeEffectStyle()` from section 26.19's discussion of edge effects, but specifically tuned to complement glass material's translucency.

---

## 32.7 Concentric Corner Radii and ConcentricRectangle

`ConcentricRectangle` is a shape that automatically computes a corner radius concentric with (i.e., proportionally matched to) its container's own corner radius — useful for nested glass or rounded elements that should visually "nest" correctly regardless of the outer shape's exact radius.

```swift
struct ConcentricDemoView: View {
    var body: some View {
        RoundedRectangle(cornerRadius: 28)
            .fill(.gray.opacity(0.15))
            .frame(width: 200, height: 120)
            .overlay(
                ConcentricRectangle()
                    .fill(.blue)
                    .padding(12)
            )
    }
}
```

Without `ConcentricRectangle`, nesting a smaller rounded rectangle inside a larger one requires manually computing a smaller corner radius that still looks visually "concentric" (proportionally consistent) with the outer shape — get it wrong and the nested shape looks either too sharp or too round relative to its container. `ConcentricRectangle` automates this calculation, always producing a corner radius that reads as a natural, nested companion to whatever container it's placed within.

---

## 32.8 When Not to Use Glass

Glass material is intentionally reserved for specific roles — primarily system chrome and floating controls — and overusing it on content-heavy or information-dense surfaces can actively hurt legibility and visual clarity.

```swift
// AVOID: applying glass to large blocks of primary reading content
struct OverusedGlassView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Article Title").font(.title.bold())
            Text("Long paragraph of body text that users need to read carefully...")
        }
        .padding()
        .glassEffect() // legibility suffers against variable backgrounds
    }
}

// BETTER: reserve glass for chrome/controls; use solid backgrounds for dense reading content
struct AppropriateGlassUsageView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Article Title").font(.title.bold())
            Text("Long paragraph of body text that users need to read carefully...")
        }
        .padding()
        .background(.background) // solid, reliable contrast for reading
    }
}
```

Because glass surfaces are translucent by design, text or controls placed directly on glass can suffer variable, sometimes poor contrast depending on what's showing through underneath — a real usability risk for content the user needs to read carefully, like long-form article text or dense data tables. The general guidance is: use glass for chrome, floating controls, and short, glanceable labels; use solid, high-contrast backgrounds for primary reading content and information-dense layouts.

---

## 32.9 Reduce Transparency and Contrast Fallbacks

The system-wide Reduce Transparency accessibility setting expresses a user preference for less see-through interface material, and well-behaved glass usage should respect it by falling back to a more opaque appearance.

```swift
struct TransparencyAwareGlassView: View {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        Text("Status")
            .padding()
            .background {
                if reduceTransparency {
                    RoundedRectangle(cornerRadius: 12).fill(.regularMaterial)
                } else {
                    Color.clear
                }
            }
            .glassEffect(reduceTransparency ? .regular.interactive(false) : .regular)
    }
}
```

Much like `accessibilityReduceMotion` (section 29.15) informs animation choices, `@Environment(\.accessibilityReduceTransparency)` lets an app adjust its glass usage — substituting a more opaque material or solid background — for users who've indicated a preference against heavily see-through interfaces, ensuring the app remains legible and comfortable regardless of what content happens to be showing through underneath.

---

## 32.10 SF Symbols 7: Variable Color

SF Symbols 7 extends variable color rendering, letting a symbol's fill progressively "light up" across its component layers to represent a continuous value like signal strength or volume level.

```swift
struct VariableColorDemoView: View {
    @State private var signalLevel: Double = 0.6

    var body: some View {
        Image(systemName: "wifi", variableValue: signalLevel)
            .font(.system(size: 50))
            .foregroundStyle(.blue)
    }
}
```

The `variableValue:` parameter (0 to 1) controls how much of the symbol's variable-color-capable layers appear filled versus dimmed — for a symbol like `wifi` with multiple signal-strength bars, a value of `0.6` fills roughly 60% of the available layers, giving an immediate, glanceable visual representation of a continuous quantity without needing a separate custom progress indicator.

---

## 32.11 SF Symbols 7: Draw Animations and Symbol Effects

SF Symbols 7 introduces new built-in symbol effects, including draw-on animations that render a symbol's strokes progressively, similar in spirit to `.trim()` (section 30.4) but built directly into the symbol rendering system.

```swift
struct DrawAnimationDemoView: View {
    @State private var isDrawn = false

    var body: some View {
        Image(systemName: "signature")
            .font(.system(size: 60))
            .symbolEffect(.drawOn, isActive: isDrawn)
            .onTapGesture { isDrawn.toggle() }
    }
}
```

`.symbolEffect(.drawOn, isActive:)` applies the draw-on animation, progressively tracing the symbol's strokes as if being drawn, toggled by the `isActive:` binding-like parameter. Other symbol effects (introduced across recent SF Symbols/SwiftUI versions) include `.bounce`, `.pulse`, `.variableColor`, and `.wiggle` — each providing a built-in, semantically named animation specifically tuned for SF Symbols, without needing custom `Animatable`/`GeometryEffect` work (sections 29.12–29.13) to achieve similar polish.

---

## 32.12 Creating Custom SF Symbols

Beyond the thousands of built-in system symbols, Xcode's companion app (SF Symbols) supports importing custom vector artwork and annotating it to behave as a fully-featured custom symbol — including multi-weight, multi-scale, and variable-color support.

```swift
struct CustomSymbolDemoView: View {
    var body: some View {
        Image("custom.brand-mark") // a custom symbol imported via the SF Symbols app / Asset Catalog
            .font(.system(size: 40, weight: .semibold))
            .foregroundStyle(.purple)
    }
}
```

A custom symbol, once properly annotated (with paths assigned to appropriate layers for template rendering, multi-weight variants, and optional variable-color layers) and added to an Asset Catalog, can be referenced by name just like a built-in `systemImage:` symbol, and participates in the same `.font()`-driven scaling, weight adjustment, and symbol effects covered in this section — giving custom brand iconography the same flexibility and consistency as Apple's own symbol library.

---

## 32.13 App Icons with Icon Composer

Icon Composer is Apple's dedicated tool for building modern, layered app icons that support Liquid Glass-era effects like dynamic lighting response and depth, replacing the older flat, single-layer icon workflow for platforms that support the newer icon format.

```
// Icon Composer produces a .icon (or similar layered) file consumed by Xcode's
// asset pipeline — not something typically built via SwiftUI code directly.
// Xcode project setup:
// 1. Design layered icon artwork (background, midground, foreground) in Icon Composer
// 2. Export/link the resulting icon package into the app target's asset catalog
// 3. The system composites and lights the layers dynamically at render time
```

Unlike a traditional flat PNG app icon, an Icon Composer-built icon is composed of multiple layered elements that the system can render with dynamic lighting, subtle parallax, and glass-consistent visual treatment — extending the Liquid Glass design language to the Home Screen itself, rather than treating the app icon as a static, isolated image asset.

---

## 32.14 Building a Design Token System in Swift 🟠

A design token system centralizes a project's core visual constants (colors, spacing, corner radii, typography scales) into a single, strongly-typed source of truth, avoiding scattered magic numbers and making systematic theme changes (like adopting a new glass-consistent visual identity) far more tractable.

```swift
enum DesignTokens {
    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
    }

    enum CornerRadius {
        static let control: CGFloat = 12
        static let card: CGFloat = 20
        static let sheet: CGFloat = 28
    }

    enum ColorToken {
        static let accent = Color("BrandAccent")
        static let surface = Color("SurfaceBackground")
    }
}

struct TokenUsageView: View {
    var body: some View {
        Text("Themed Card")
            .padding(DesignTokens.Spacing.md)
            .background(DesignTokens.ColorToken.surface)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card))
    }
}
```

Centralizing these values as `enum`-namespaced static constants (rather than repeating raw numbers like `16` or `.cornerRadius(12)` throughout the codebase) means a single change to `DesignTokens.Spacing.md` propagates everywhere that token is used, and makes visual consistency across a large app dramatically easier to enforce and audit — a practical, scalable pattern for maintaining a coherent design language (glass-based or otherwise) across dozens or hundreds of views.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Design intent | Liquid Glass material | Translucent, refractive chrome unified with content |
| Applying glass | `.glassEffect(_:in:)` | Core modifier for glass material on any view |
| Grouping glass | `GlassEffectContainer` | Cohesive rendering for adjacent glass elements |
| Morphing glass | `.glassEffectID(_:in:)` | Smooth shape/size transitions between glass states |
| System chrome | Toolbars, tab bars | Adopt glass automatically without manual code |
| Scroll interaction | Scroll edge effects | Content fades/blurs beneath glass chrome |
| Nested shapes | `ConcentricRectangle` | Auto-computed, proportionally nested corner radii |
| Usage guidance | — | Reserve glass for chrome/controls, not dense reading content |
| Accessibility | `accessibilityReduceTransparency` | Fallback to opaque appearance when requested |
| Continuous values | SF Symbols variable color | Symbol fill representing a continuous quantity |
| Symbol animation | `.symbolEffect(.drawOn, ...)` | Built-in draw-on and other symbol animations |
| Custom iconography | Custom SF Symbols | Brand icons with full symbol-system flexibility |
| App icons | Icon Composer | Layered, dynamically-lit modern app icons |
| Design consistency | Design token system | Centralized, strongly-typed visual constants |

**Next up:** Section 33 — Multiplatform SwiftUI.
