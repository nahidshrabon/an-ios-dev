## 30.1 Path and Drawing Primitives

`Path` describes vector geometry — lines, curves, and shapes — built from a sequence of drawing commands like `move(to:)`, `addLine(to:)`, `addCurve(to:control1:control2:)`, and `addArc()`.

```swift
struct TrianglePathView: View {
    var body: some View {
        Path { path in
            path.move(to: CGPoint(x: 100, y: 20))
            path.addLine(to: CGPoint(x: 180, y: 160))
            path.addLine(to: CGPoint(x: 20, y: 160))
            path.closeSubpath()
        }
        .stroke(.blue, lineWidth: 3)
        .frame(width: 200, height: 180)
    }
}
```

`move(to:)` starts a new subpath at a point without drawing, `addLine(to:)` draws a straight line from the current point, and `closeSubpath()` connects back to the starting point, completing a closed shape. `Path` can be used directly as a `View` (via `.stroke()`/`.fill()`) or as the geometry basis for a custom `Shape`.

---

## 30.2 Custom Shape Conformance

Conforming to the `Shape` protocol lets you define reusable, parameterized custom shapes by implementing a single `path(in:)` method that returns a `Path` scaled to a given `CGRect`.

```swift
struct Chevron: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        return path
    }
}

struct ChevronDemoView: View {
    var body: some View {
        Chevron()
            .stroke(.green, style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
            .frame(width: 100, height: 50)
    }
}
```

Unlike a one-off `Path` literal, a `Shape` conformer is a reusable, composable view type — it can be instantiated multiple times with different frames/styling, used in `if`/`else` branches, and passed around like any other SwiftUI view. Building the path relative to the passed-in `rect` (using `rect.minX`, `rect.midX`, etc., rather than hardcoded coordinates) makes the shape correctly scale to whatever frame it's given.

---

## 30.3 Stroke, Fill, and Stroke Styles

Shapes and paths can be filled with a color/gradient, stroked with an outline, or both — and `StrokeStyle` provides fine control over line appearance.

```swift
struct StrokeFillDemoView: View {
    var body: some View {
        VStack(spacing: 20) {
            Circle()
                .fill(.orange)

            Circle()
                .stroke(.blue, lineWidth: 6)

            Circle()
                .strokeBorder(.purple, lineWidth: 6)

            Circle()
                .fill(.yellow)
                .overlay(Circle().stroke(.black, lineWidth: 2))

            Rectangle()
                .stroke(.red, style: StrokeStyle(lineWidth: 4, dash: [10, 6]))
        }
        .frame(width: 100, height: 100)
    }
}
```

`.fill()` fills the shape's interior; `.stroke()` draws an outline centered on the shape's path boundary (meaning half the stroke width extends outside the shape's nominal bounds); `.strokeBorder()` instead draws the outline entirely inset within the shape's bounds. Combining `.fill()` with an `.overlay()` containing a `.stroke()` is the common pattern for a shape that needs both fill and outline simultaneously. `StrokeStyle`'s `dash:` parameter produces dashed lines, and `lineCap:`/`lineJoin:` control how line ends and corners are rendered.

---

## 30.4 Trimming Paths

`.trim(from:to:)` draws only a portion of a shape's path, specified as fractional progress along the path (0 to 1) — commonly animated to produce "drawing itself in" effects.

```swift
struct TrimmedCircleView: View {
    @State private var progress: CGFloat = 0

    var body: some View {
        Circle()
            .trim(from: 0, to: progress)
            .stroke(.blue, style: StrokeStyle(lineWidth: 8, lineCap: .round))
            .frame(width: 150, height: 150)
            .rotationEffect(.degrees(-90))
            .onAppear {
                withAnimation(.easeInOut(duration: 1.5)) {
                    progress = 1.0
                }
            }
    }
}
```

Animating `progress` from `0` to `1` while trimmed causes the stroke to appear to draw itself progressively along the circle's outline — a very common effect for loading indicators and progress rings. `.rotationEffect(.degrees(-90))` here rotates the starting point to the top of the circle (12 o'clock) rather than `Circle`'s default rightmost starting point (3 o'clock).

---

## 30.5 Canvas

`Canvas` provides an immediate-mode drawing surface — rather than composing a hierarchy of shape views, you draw directly into a graphics context using imperative commands, which can be significantly more performant for a large number of drawn elements.

```swift
struct CanvasDemoView: View {
    let points: [CGPoint] = (0..<50).map { i in
        CGPoint(x: Double(i) * 6, y: 100 + sin(Double(i) * 0.3) * 50)
    }

    var body: some View {
        Canvas { context, size in
            for point in points {
                let rect = CGRect(x: point.x, y: point.y, width: 6, height: 6)
                context.fill(Path(ellipseIn: rect), with: .color(.blue))
            }

            var path = Path()
            path.addLines(points)
            context.stroke(path, with: .color(.blue.opacity(0.4)), lineWidth: 2)
        }
        .frame(height: 200)
    }
}
```

The `Canvas` closure receives a `GraphicsContext` (`context`) and the available `size`, and draws by calling methods like `context.fill()` and `context.stroke()` directly — no individual SwiftUI view is created per drawn element. For scenarios like rendering hundreds of data points or particles, this avoids the overhead of instantiating hundreds of separate `Shape` views, since `Canvas` draws everything within a single view in the hierarchy.

---

## 30.6 TimelineView

`TimelineView` re-invokes its content closure on a schedule, providing a `context` with the current date — the standard mechanism for building continuously-updating, time-driven visuals like clocks or live animations that aren't tied to discrete state changes.

```swift
struct AnimatedCanvasClockView: View {
    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let angle = timeline.date.timeIntervalSinceReferenceDate
                let center = CGPoint(x: size.width / 2, y: size.height / 2)
                let radius = min(size.width, size.height) / 2 - 10

                var path = Path()
                path.move(to: center)
                path.addLine(to: CGPoint(
                    x: center.x + cos(angle) * radius,
                    y: center.y + sin(angle) * radius
                ))
                context.stroke(path, with: .color(.red), lineWidth: 3)
            }
        }
        .frame(width: 200, height: 200)
    }
}
```

`.animation` schedule requests updates as often as possible (matching display refresh rate), suitable for smooth continuous motion; `.periodic(from:by:)` instead updates at fixed intervals (e.g., once per second, appropriate for a literal clock face). Because `TimelineView` drives updates externally rather than through `@State` changes, it's the correct tool for visuals that should animate continuously and indefinitely without any user interaction triggering each frame.

---

## 30.7 .visualEffect()

`.visualEffect()` (iOS 17+) applies purely visual, geometry-aware transformations to a view based on its own layout information (size, frame) without affecting that view's actual layout or the layout of siblings — useful for effects that need geometry context but shouldn't participate in the layout system.

```swift
struct VisualEffectDemoView: View {
    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 20) {
                ForEach(0..<10) { index in
                    RoundedRectangle(cornerRadius: 16)
                        .fill(.teal)
                        .frame(width: 100, height: 150)
                        .visualEffect { content, proxy in
                            content.scaleEffect(
                                scaleFor(frame: proxy.frame(in: .scrollView))
                            )
                        }
                }
            }
        }
    }

    func scaleFor(frame: CGRect) -> CGFloat {
        let midX = frame.midX
        return midX > 0 ? 1.0 : 0.9
    }
}
```

`.visualEffect()`'s closure receives both the view's `content` and a `GeometryProxy`, letting effects like scale or opacity respond to the view's actual position (e.g., relative to a scroll view) — similar to what a `GeometryReader` could provide, but without `GeometryReader`'s side effect of taking over the layout of its container.

---

## 30.8 GeometryEffect

`GeometryEffect` is a lower-level protocol for building custom animatable geometric transformations (like shakes, wobbles, or custom distortions) by returning a `ProjectionTransform`, and — like `Shape` — conforms to `Animatable` for smooth interpolation.

```swift
struct ShakeEffect: GeometryEffect {
    var amount: CGFloat = 10
    var shakesPerUnit = 3
    var animatableData: CGFloat

    func effectValue(size: CGSize) -> ProjectionTransform {
        let translation = amount * sin(animatableData * .pi * CGFloat(shakesPerUnit))
        return ProjectionTransform(CGAffineTransform(translationX: translation, y: 0))
    }
}

struct ShakeDemoView: View {
    @State private var attempts: CGFloat = 0

    var body: some View {
        Text("Wrong Password")
            .modifier(ShakeEffect(animatableData: attempts))
            .onTapGesture {
                withAnimation(.linear(duration: 0.4)) {
                    attempts += 1
                }
            }
    }
}
```

`effectValue(size:)` computes a `ProjectionTransform` (built from a `CGAffineTransform`) based on the current `animatableData` value — as `animatableData` animates from `0` to `1` via `withAnimation()`, the sine-based translation oscillates back and forth, producing a shake effect. `GeometryEffect` is more low-level than `.visualEffect()`, appropriate when you need genuine custom transform math rather than composing existing modifiers.

---

## 30.9 SwiftUI Shaders — .colorEffect()

`.colorEffect()` applies a custom Metal shader function to a view's rendered pixels, operating per-pixel on color values — enabling GPU-accelerated visual effects beyond what standard modifiers provide.

```swift
// Metal shader function (in a .metal file):
// [[ stitchable ]]
// half4 invertColor(float2 position, half4 color) {
//     return half4(1.0 - color.rgb, color.a);
// }

struct ColorEffectDemoView: View {
    var body: some View {
        Image(systemName: "photo.fill")
            .font(.system(size: 100))
            .foregroundStyle(.blue)
            .colorEffect(ShaderLibrary.invertColor())
    }
}
```

The `[[ stitchable ]]` attribute marks a Metal function as usable from SwiftUI's shader APIs. `ShaderLibrary` provides typed access to shader functions compiled into the app, and `.colorEffect()` runs the referenced function once per pixel of the view's rendered output, here inverting each pixel's RGB color — a lightweight way to apply custom, GPU-accelerated pixel-level effects declaratively.

---

## 30.10 SwiftUI Shaders — .distortionEffect()

`.distortionEffect()` applies a shader that can remap *where* each pixel is sampled from, enabling geometric distortion effects (like ripples or waves) rather than just color changes.

```swift
// Metal shader function (in a .metal file):
// [[ stitchable ]]
// float2 wave(float2 position, float time) {
//     position.y += sin(position.x / 10 + time) * 8;
//     return position;
// }

struct DistortionEffectDemoView: View {
    @State private var time: CGFloat = 0

    var body: some View {
        Text("Wavy Text")
            .font(.system(size: 40, weight: .bold))
            .distortionEffect(
                ShaderLibrary.wave(.float(time)),
                maxSampleOffset: CGSize(width: 0, height: 20)
            )
            .onAppear {
                withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                    time = .pi * 2
                }
            }
    }
}
```

Unlike `.colorEffect()` (which only changes a pixel's color), `.distortionEffect()`'s shader function returns a new *position* to sample from, letting content appear to warp or ripple. `maxSampleOffset:` tells SwiftUI the maximum distance the shader might sample from, so it can allocate a large enough rendering buffer to avoid clipping the distorted result.

---

## 30.11 SwiftUI Shaders — .layerEffect()

`.layerEffect()` is the most powerful of the three shader modifiers, giving the shader function access to sample arbitrary neighboring pixels (not just the current one) — necessary for effects like blur, pixelation, or edge detection that depend on surrounding pixel values.

```swift
// Metal shader function (in a .metal file):
// [[ stitchable ]]
// half4 pixelate(float2 position, SwiftUI::Layer layer, float pixelSize) {
//     float2 samplePos = floor(position / pixelSize) * pixelSize;
//     return layer.sample(samplePos);
// }

struct LayerEffectDemoView: View {
    var body: some View {
        Image(systemName: "star.fill")
            .font(.system(size: 100))
            .foregroundStyle(.yellow)
            .layerEffect(
                ShaderLibrary.pixelate(.float(12)),
                maxSampleOffset: .zero
            )
    }
}
```

The `SwiftUI::Layer` parameter (available only in `.layerEffect()` shaders, not `.colorEffect()`) lets the shader sample from any position within the rendered layer — here, snapping each pixel's sample position to a coarse grid to produce a pixelation effect. This flexibility comes at a performance cost relative to `.colorEffect()`, since the shader can read from arbitrary neighboring positions rather than being restricted to the single pixel it's computing.

---

## 30.12 Blend Modes and Compositing Groups

`.blendMode()` controls how a view's rendered pixels combine with content beneath it (mimicking familiar blend modes from image editing tools), and `.compositingGroup()` flattens a subtree into a single layer before further effects (like blend mode or opacity) are applied to it as a whole.

```swift
struct BlendModeDemoView: View {
    var body: some View {
        ZStack {
            Image(systemName: "circle.fill")
                .font(.system(size: 150))
                .foregroundStyle(.red)

            Image(systemName: "circle.fill")
                .font(.system(size: 150))
                .foregroundStyle(.blue)
                .offset(x: 60)
                .blendMode(.multiply)
        }
        .compositingGroup()
        .opacity(0.9)
    }
}
```

`.blendMode(.multiply)` here darkens the overlapping region between the red and blue circles, similar to layer blend modes in tools like Photoshop; other common modes include `.screen`, `.overlay`, and `.difference`. `.compositingGroup()` is important when applying an effect (like `.opacity()`) to the *combined result* of a blended group — without it, the opacity would apply to each individual layer separately before blending, producing a different (usually undesired) visual result than applying it to the final composited output.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Vector geometry | `Path`, `move(to:)`, `addLine(to:)` | Build custom line/curve geometry |
| Reusable custom shapes | `Shape` protocol, `path(in:)` | Parameterized, reusable shape views |
| Fill/outline | `.fill()`, `.stroke()`, `.strokeBorder()` | Render shape interior/outline |
| Line styling | `StrokeStyle` | Dash patterns, caps, joins |
| Partial paths | `.trim(from:to:)` | Animatable "draw itself in" effects |
| Immediate-mode drawing | `Canvas` | High-performance direct pixel/path drawing |
| Time-driven visuals | `TimelineView` | Continuously updating, schedule-driven content |
| Geometry-aware visual effects | `.visualEffect()` | Layout-independent geometry-based effects |
| Custom transforms | `GeometryEffect` | Low-level animatable geometric transformations |
| Pixel color shaders | `.colorEffect()` | Per-pixel Metal shader color transformation |
| Position-remapping shaders | `.distortionEffect()` | Geometric warp/ripple effects |
| Neighbor-sampling shaders | `.layerEffect()` | Blur, pixelation, and similar layer-wide effects |
| Layer compositing | `.blendMode()`, `.compositingGroup()` | Combine and flatten layered content |

**Next up:** Section 31 (continuing Part 3 — SwiftUI).
