**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**Liquid Glass** is Apple's design language from iOS 26 (and macOS, iPadOS, watchOS, tvOS, visionOS 26). Bars, buttons, and controls are made of a **see-through, light-bending material** that floats **above** your content. This section covers the SwiftUI APIs for glass, **when not** to use it, accessibility, the newest **SF Symbols** features, app icons, and keeping a design **consistent** with tokens.

All `glassEffect` APIs below need **iOS 26 or later**.

---

## 32.1 What Liquid Glass Is and the Design Intent 🟢

**Liquid Glass** is a **material**: a surface that's **translucent** (partly see-through), **bends light** like real glass (refraction), and **reacts** to what's behind it and to touch.

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
                    .glassEffect()          // the text floats on a piece of glass
            }
        }
    }
}
```

The **idea** behind it:

- **Content comes first.** Photos, maps, and text fill the screen. Controls **float** on top, in a separate layer.
- **Controls don't block content.** Older designs used **opaque** bars that hid what's behind. Glass lets content **show through**, in a controlled, readable way.
- **One system.** Bars, buttons, sheets, and menus all use the **same** material, so the whole UI feels like one physical thing.
- **It feels alive.** Glass **lights up** and **flexes** when touched, and changes shape smoothly (32.4).

The good news: **standard components** (navigation bars, tab bars, toolbars, sheets, menus) get glass **automatically** when you build with the iOS 26 SDK. You only use the APIs in this section for **custom** controls.

---

## 32.2 .glassEffect() on a View 🟢

**`.glassEffect(_:in:)`** puts the glass material **behind** a view, in a **shape** you choose:

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

- The **first** parameter is the **style** (the "variant"). `.regular` is the normal one; `.clear` is more see-through, for use over **rich media** like photos.
- **`in:`** is the **shape** of the glass: `.circle`, `.capsule` (the default), `.rect(cornerRadius:)`, or any `Shape`.

You can **customize** the glass:

```swift
Label("Record", systemImage: "record.circle")
    .padding()
    .glassEffect(
        .regular
            .tint(.red)          // a colored glass, for important actions
            .interactive(),      // reacts to touch: scales and shimmers when pressed
        in: .capsule
    )
```

For **buttons**, it's usually easier to use the button styles from 28.12. They're built on the same material, tuned for buttons:

```swift
Button("Continue") { }
    .buttonStyle(.glass)            // = glass behind a button, with press feedback

Button("Buy Now") { }
    .buttonStyle(.glassProminent)   // tinted glass for the main action
```

| Use | When |
|---|---|
| `.buttonStyle(.glass)` | A normal button with glass |
| `.glassEffect()` | A **custom** control, label, or container |

Apply `.glassEffect()` **after** the modifiers that size the content (like `.padding()`), so the glass covers the right area.

---

## 32.3 GlassEffectContainer and Grouping 🟡

When **several** glass shapes sit **close together**, put them in a **`GlassEffectContainer`**:

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

Why it matters:

1. **Glass can't see other glass.** Each piece bends the light from **behind** it. Without a container, neighboring pieces render **separately** and can look wrong where they're close.
2. **They render together.** The container draws all its glass **in one pass**, which is **faster** and looks consistent.
3. **They can blend.** Shapes closer than the container's **`spacing`** **melt together** like drops of water. That's also what makes **morphing** possible (32.4).

The container's `spacing` is about **blending**, not layout. The `HStack`'s `spacing` still decides where the shapes go.

To make separate views look like **one** piece of glass, use **`.glassEffectUnion`**:

```swift
@Namespace private var ns

GlassEffectContainer {
    HStack(spacing: 0) {
        Button("Bold", systemImage: "bold") { }
            .padding()
            .glassEffect()
            .glassEffectUnion(id: "format", namespace: ns)
        Button("Italic", systemImage: "italic") { }
            .padding()
            .glassEffect()
            .glassEffectUnion(id: "format", namespace: ns)   // one capsule around both
    }
}
```

---

## 32.4 glassEffectID and Morphing Between Elements 🟡

**`.glassEffectID(_:in:)`** gives a glass shape an **identity**. When views with glass **appear**, **disappear**, or **change**, SwiftUI **morphs** the glass from one to the other, like liquid, instead of a hard cut:

```swift
struct MorphingGlassView: View {
    @Namespace private var glassNamespace
    @State private var isExpanded = false

    var body: some View {
        GlassEffectContainer(spacing: 20) {
            HStack(spacing: 20) {
                Button {
                    withAnimation(.bouncy) { isExpanded.toggle() }
                } label: {
                    Image(systemName: isExpanded ? "xmark" : "plus")
                        .frame(width: 44, height: 44)
                }
                .glassEffect(.regular.interactive(), in: .circle)
                .glassEffectID("toggle", in: glassNamespace)

                if isExpanded {
                    ForEach(["camera", "photo", "doc"], id: \.self) { icon in
                        Image(systemName: icon)
                            .frame(width: 44, height: 44)
                            .glassEffect(.regular, in: .circle)
                            .glassEffectID(icon, in: glassNamespace)   // flows out of the "+" button
                    }
                }
            }
        }
    }
}
```

When `isExpanded` turns on, the new buttons **flow out** of the "+" button like drops splitting off. When it turns off, they **merge back** in.

Three things are needed:

1. A **`GlassEffectContainer`** around them.
2. A **`@Namespace`**, and a **`.glassEffectID`** on each glass shape.
3. The change inside **`withAnimation`**.

It's the same idea as **`matchedGeometryEffect`** (29.8): a **shared namespace** plus a **matching ID** says "these are the **same** logical thing", so SwiftUI animates between them. Here it's built **for glass**, so the material itself **flows**.

---

## 32.5 Glass in Toolbars and Tab Bars 🟢

**System bars** use glass **automatically**: navigation bars, toolbars (27.19), and tab bars (27.8). You **don't** add `.glassEffect()` to them:

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
                    Button("Share", systemImage: "square.and.arrow.up") { }   // gets glass for free
                }
            }
        }
    }
}
```

What you **can** control:

```swift
.toolbar {
    ToolbarItemGroup(placement: .topBarTrailing) {      // items in one group share one glass capsule
        Button("Bold", systemImage: "bold") { }
        Button("Italic", systemImage: "italic") { }
    }
    ToolbarSpacer(.fixed, placement: .topBarTrailing)   // a gap: separate glass groups
    ToolbarItem(placement: .topBarTrailing) {
        Button("Done", systemImage: "checkmark") { }
            .buttonStyle(.glassProminent)               // a tinted, prominent action
    }
}
```

And for **tab bars**:

```swift
TabView { /* ... */ }
    .tabBarMinimizeBehavior(.onScrollDown)    // the tab bar shrinks while scrolling down
    .tabViewBottomAccessory {                 // a glass bar above the tabs, like Music's mini player
        NowPlayingBar()
    }
```

The manual APIs from 32.2–32.4 are for **custom** pieces: a floating map control, a camera shutter panel, a custom player bar. Those should **match** the system's glass, so the app feels consistent.

⚠️ If you put a **custom background** on system bars (like an opaque color), you **remove** the glass. Check old code for `.toolbarBackground(...)` when moving to iOS 26.

---

## 32.6 Scroll Edge Effects with Glass Content 🟢

When content **scrolls under** a glass bar, the system adds a **scroll edge effect**: content near the edge **fades and blurs** a little. It keeps the bar's buttons **readable** over busy content, and shows that the bar is a **separate layer**.

```swift
struct ScrollEdgeGlassView: View {
    var body: some View {
        NavigationStack {
            List(0..<50) { index in
                Text("Row \(index)")
            }
            .navigationTitle("Scrolling List")
            // nothing to add: the edge effect comes with the navigation bar
        }
    }
}
```

It's **automatic** for scroll views under system bars. You can adjust it with **`.scrollEdgeEffectStyle`** (26.19):

```swift
ScrollView { content }
    .scrollEdgeEffectStyle(.hard, for: .top)     // a sharper edge, good for dense text and tables

ScrollView { content }
    .scrollEdgeEffectHidden(true, for: .bottom)  // no effect at the bottom edge
```

If you build a **custom** floating bar with `.safeAreaInset` (24.15), the scroll view knows about it, and the edge effect follows it too.

---

## 32.7 Concentric Corner Radii and ConcentricRectangle 🟡

**Concentric** shapes share the **same center** for their corner curves. When you nest a rounded shape inside another with **padding**, the inner radius should be **smaller**, so the gap stays **even** all the way around the corner:

**inner radius = outer radius − padding**

If you use the **same** radius inside and out, the corners look **wrong**: the gap is wider at the corners than on the sides.

```swift
// The manual way: compute it yourself
let outer: CGFloat = 28
let padding: CGFloat = 12

RoundedRectangle(cornerRadius: outer)
    .fill(.gray.opacity(0.15))
    .frame(width: 200, height: 120)
    .overlay {
        RoundedRectangle(cornerRadius: outer - padding)   // 16
            .fill(.blue)
            .padding(padding)
    }
```

iOS 26 adds **`ConcentricRectangle`**. It reads the **container's shape** and computes the right radius **for you**:

```swift
struct ConcentricDemoView: View {
    var body: some View {
        VStack {
            ConcentricRectangle()
                .fill(.blue)
                .padding(12)
        }
        .frame(width: 200, height: 120)
        .background(.gray.opacity(0.15), in: .rect(cornerRadius: 28))
        .containerShape(.rect(cornerRadius: 28))      // tells children the outer shape
    }
}
```

**`.containerShape`** tells child views the **outer shape**. `ConcentricRectangle` then fits itself **inside** it, at its own distance from the edges.

This matters more now, because devices, windows, sheets, and glass controls all have **rounded corners**. A button near the corner of a sheet should **follow** the sheet's curve. With `ConcentricRectangle`, it does, even if the outer radius changes (for example, on a different device).

---

## 32.8 When Not to Use Glass 🟢

Glass is for a **small set** of roles: **bars**, **floating controls**, and **short labels** over content. Using it **everywhere** makes an app **harder to read** and look busy.

```swift
// ❌ Glass behind long reading content
struct OverusedGlassView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Article Title").font(.title.bold())
            Text("Long paragraph of body text that users need to read carefully...")
        }
        .padding()
        .glassEffect(in: .rect(cornerRadius: 16))   // contrast changes with whatever is behind
    }
}

// ✅ A solid background for reading; glass stays on the controls
struct AppropriateGlassUsageView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Article Title").font(.title.bold())
            Text("Long paragraph of body text that users need to read carefully...")
        }
        .padding()
        .background(.background)                     // stable, high contrast
    }
}
```

Glass is **see-through**, so the **contrast** of text on it **changes** with what's behind: a dark photo, a white page, a busy map. For a short label, that's fine. For long text or a data table, it's tiring and can become **unreadable**.

| ✅ Use glass for | ❌ Avoid glass for |
|---|---|
| Navigation bars, toolbars, tab bars (automatic) | Long text, articles |
| Floating buttons over maps, photos, video | Lists and table rows |
| Small status labels and badges | Dense data, forms |
| Custom player bars, camera controls | Every card on a screen |

Two more rules:

- **Don't stack glass on glass.** Glass can't see through other glass (32.3); layers of it look muddy.
- **Content stays in the content layer.** Glass is the **control** layer. If everything is glass, nothing stands out.

---

## 32.9 Reduce Transparency and Contrast Fallbacks 🟡

**Reduce Transparency** is an accessibility setting for users who find see-through surfaces **hard to read**. **Increase Contrast** asks for **stronger** borders and colors.

**System glass adapts automatically.** With these settings on, `.glassEffect()`, glass buttons, and system bars become **frostier** or **more solid**, with clearer edges. You don't have to do anything for them.

Your **own** see-through styles (materials, opacity, custom blur) are **your** job:

```swift
struct TransparencyAwareCard: View {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast

    var body: some View {
        Text("Status: Online")
            .padding()
            .background(
                reduceTransparency
                    ? AnyShapeStyle(.background)           // solid
                    : AnyShapeStyle(.ultraThinMaterial),   // see-through
                in: .rect(cornerRadius: 12)
            )
            .overlay {
                if contrast == .increased {
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(.primary, lineWidth: 1)   // a clear edge for Increase Contrast
                }
            }
    }
}
```

It works like **Reduce Motion** (29.15): the user states a preference, and you **swap** to a calmer version, without losing information.

Test with **Settings → Accessibility → Display & Text Size → Reduce Transparency** and **Increase Contrast** (70). Also test over **light and dark** content, since glass looks different over each.

---

## 32.10 SF Symbols 7: Variable Color 🟢

Some symbols have **layers** that can light up **step by step**: Wi-Fi bars, speaker waves, a battery. **`variableValue:`** (0 to 1) sets **how much** is filled, to show a **level**:

```swift
struct VariableColorDemoView: View {
    @State private var signalLevel: Double = 0.6

    var body: some View {
        VStack {
            Image(systemName: "wifi", variableValue: signalLevel)
                .font(.system(size: 50))
                .foregroundStyle(.blue)

            Slider(value: $signalLevel, in: 0...1)
        }
    }
}
```

At `0.6`, about **60%** of the layers are **full color**; the rest are **dimmed**. You get a clear "level" icon with **no custom drawing**.

Good symbols for this:

```swift
Image(systemName: "speaker.wave.3.fill", variableValue: volume)
Image(systemName: "cellularbars", variableValue: signal)
Image(systemName: "chart.bar.fill", variableValue: progress)
```

Only symbols **designed** for variable color react. You can check in the **SF Symbols app** (filter by "Variable").

SF Symbols 7 (iOS 26) adds a second mode, **variable draw**: instead of dimming layers, the symbol's **strokes** are drawn **partway**, like a gauge filling up:

```swift
Image(systemName: "thermometer.high", variableValue: temperature)
    .symbolVariableValueMode(.draw)     // draw the stroke partway (iOS 26)
```

---

## 32.11 SF Symbols 7: Draw Animations and Symbol Effects 🟢

**Symbol effects** are ready-made animations for SF Symbols. SF Symbols 7 adds **Draw** animations: the symbol is **drawn stroke by stroke**, like a pen writing it. It's similar to animating `.trim()` (30.4), but built into the symbol.

```swift
struct DrawAnimationDemoView: View {
    @State private var isDrawn = false

    var body: some View {
        Image(systemName: "signature")
            .font(.system(size: 60))
            .symbolEffect(.drawOn, isActive: isDrawn)   // toggling isActive plays the draw animation
            .onTapGesture { isDrawn.toggle() }
    }
}
```

There are several **kinds** of effects:

| Effect | Looks like | Trigger |
|---|---|---|
| `.bounce` | A quick jump | Each time a `value:` changes |
| `.pulse` | Fading in and out | While active |
| `.variableColor` | Layers lighting up in turn | While active |
| `.wiggle` | A small shake | Each time a `value:` changes |
| `.breathe` | Slowly growing and shrinking | While active |
| `.rotate` | Spinning (like a fan or gear) | While active |
| `.drawOn` / `.drawOff` | Drawing in / erasing the strokes | While active, or as a transition |

```swift
Image(systemName: "bell")
    .symbolEffect(.wiggle, value: unreadCount)         // wiggles when a new notification arrives

Image(systemName: "arrow.triangle.2.circlepath")
    .symbolEffect(.rotate, isActive: isSyncing)        // spins while syncing

Image(systemName: isMuted ? "speaker.slash" : "speaker.wave.2")
    .contentTransition(.symbolEffect(.replace))        // smooth swap between two symbols
```

You get polished animations with **no** `Animatable` or `GeometryEffect` code (29.12, 30.8). And they follow **Reduce Motion** automatically.

---

## 32.12 Creating Custom SF Symbols 🟡

You can turn your **own** icons (like a brand logo) into **custom symbols**. They then work **exactly like** system symbols: they scale with the **font**, match text **weight**, support **rendering modes**, and can use **symbol effects**.

The steps:

1. In the **SF Symbols app**, pick a system symbol close to your design and **export a template** (an SVG with guides).
2. Draw your icon on the template in a vector tool (Sketch, Figma, Illustrator).
3. **Import** it back into the SF Symbols app. **Annotate** it: assign paths to **layers** (for multicolor, hierarchical, and variable color) and check different **weights**.
4. **Export** it and drag it into your **Asset Catalog** in Xcode.

Then use it by **name**:

```swift
struct CustomSymbolDemoView: View {
    var body: some View {
        VStack {
            Image("custom.brand-mark")          // a custom symbol from the asset catalog
                .font(.system(size: 40, weight: .semibold))
                .foregroundStyle(.purple)

            Label("Rewards", image: "custom.brand-mark")   // works in labels too
                .font(.headline)
        }
    }
}
```

Note: custom symbols use `Image("name")` (from the asset catalog), not `Image(systemName:)`, which is only for Apple's built-in symbols.

Why bother, instead of a PNG?

| PNG icon | Custom symbol |
|---|---|
| Fixed size; blurry when scaled | Vector; sharp at any size |
| Doesn't match text weight | Thin to black, like the font |
| One color | Rendering modes and tints |
| No animation | Symbol effects |

---

## 32.13 App Icons with Icon Composer 🟢

**Icon Composer** is Apple's app (it comes with Xcode 26) for making **app icons** in the new **layered** format.

Instead of one flat PNG, an icon has **layers** (for example: a background, a shape, a highlight). The system renders them with **glass effects**: light **reflections**, **depth**, and **blur**, and can show them in different **appearances**:

| Appearance | Look |
|---|---|
| Default | Full color |
| Dark | Adapted for Dark Mode |
| Clear | See-through glass |
| Tinted | One color chosen by the user |

The workflow is outside of code:

```
1. Design the artwork as separate layers (SVG or PNG) in your design tool.
2. Open Icon Composer and drag in the layers.
3. Adjust each layer: glass on/off, blur, shadow, opacity, and colors per appearance.
4. Preview it on iPhone, iPad, Mac, and Watch, in every appearance.
5. Save the .icon file and add it to your Xcode project.
6. In the target's settings, set the app icon to that file's name.
```

One `.icon` file can serve **all** platforms. The system lights and renders it, so the **same** icon looks right on the Home Screen, in Settings, and in Spotlight, in every mode.

---

## 32.14 Building a Design Token System in Swift 🟡

**Design tokens** are **named** values for your design: colors, spacing, corner radii, font styles. Instead of writing `16` or `Color(red: 0.2, ...)` all over the code, you write `Spacing.md` or `.brandAccent`. There's **one source of truth**.

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
        static let accent = Color("BrandAccent")          // from the asset catalog: has light and dark versions
        static let surface = Color("SurfaceBackground")
    }
}

struct TokenUsageView: View {
    var body: some View {
        Text("Themed Card")
            .padding(DesignTokens.Spacing.md)
            .background(DesignTokens.ColorToken.surface, in: .rect(cornerRadius: DesignTokens.CornerRadius.card))
    }
}
```

**Why enums with `static let`?**

- A **caseless `enum`** can't be **created** by accident (`DesignTokens()` doesn't compile). It's just a **namespace**.
- Names are **grouped**: `Spacing.md` can't clash with some other `md`, and **autocomplete** lists them neatly.
- `static let` values are **constants** and **thread-safe**, unlike global `var`s.

**Benefits**:

- Change `Spacing.md` from 16 to 14 **once**, and every screen updates.
- **Consistency** is easy to check: any raw number in a view is a smell.
- Designers and developers share the **same names**.

Make tokens feel **built in** with extensions:

```swift
extension ShapeStyle where Self == Color {
    static var brandAccent: Color { Color("BrandAccent") }
    static var surface: Color { Color("SurfaceBackground") }
}

extension CGFloat {
    static let spacingMD: CGFloat = 16
}

Text("Hello")
    .padding(.spacingMD)
    .foregroundStyle(.brandAccent)        // reads like .blue or .primary
    .background(.surface)
```

Xcode can also **generate** symbols for asset catalog colors and images, so `Color(.brandAccent)` is **checked by the compiler**: no typos in string names. If it does, use those generated names instead of writing the `Color("...")` extensions yourself (two `brandAccent`s would clash).

Put **semantic** names on top of raw ones: `ColorToken.danger` instead of `ColorToken.red500`. Then a redesign changes **what** "danger" looks like, not every place that uses it.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Design intent | Liquid Glass material | See-through, light-bending controls floating above content |
| Applying glass | `.glassEffect(_:in:)`, `.tint`, `.interactive()` | Glass behind custom controls, in any shape |
| Grouping glass | `GlassEffectContainer`, `.glassEffectUnion` | Render nearby glass together; let it blend |
| Morphing glass | `.glassEffectID(_:in:)` | Glass flows between shapes, like `matchedGeometryEffect` |
| System chrome | Toolbars, tab bars | Glass is automatic; group items and add spacers |
| Scroll interaction | Scroll edge effects | Content fades under bars; adjust with `.scrollEdgeEffectStyle` |
| Nested shapes | `ConcentricRectangle`, `.containerShape` | Inner radius = outer − padding, computed for you |
| Usage guidance | — | Glass for controls and bars; solid for reading content |
| Accessibility | `accessibilityReduceTransparency`, `colorSchemeContrast` | System glass adapts; make custom materials solid |
| Continuous values | `variableValue:`, `.symbolVariableValueMode(.draw)` | Symbols that show a level |
| Symbol animation | `.symbolEffect(...)` | Draw, bounce, wiggle, rotate, and more, built in |
| Custom iconography | Custom SF Symbols | Your icons with symbol scaling, weights, and effects |
| App icons | Icon Composer | Layered icons with glass and multiple appearances |
| Design consistency | Design token system | Named, shared values instead of magic numbers |
