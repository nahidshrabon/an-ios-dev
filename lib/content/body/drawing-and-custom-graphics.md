**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

When built-in views aren't enough, SwiftUI lets you **draw** your own graphics: lines and curves with **`Path`**, reusable **`Shape`**s, fast drawing with **`Canvas`**, time-based drawing with **`TimelineView`**, and even **Metal shaders** that run on the GPU for every pixel. This section goes from simple lines to shaders.

---

## 30.1 Path and Drawing Primitives 🟢

A **`Path`** describes **vector** geometry: lines and curves, built from **drawing commands**. It's like guiding a pen: move it, draw a line, draw a curve.

```swift
struct TrianglePathView: View {
    var body: some View {
        Path { path in
            path.move(to: CGPoint(x: 100, y: 20))      // lift the pen and put it here
            path.addLine(to: CGPoint(x: 180, y: 160))  // draw a line to here
            path.addLine(to: CGPoint(x: 20, y: 160))
            path.closeSubpath()                        // draw a line back to the start
        }
        .stroke(.blue, lineWidth: 3)
        .frame(width: 200, height: 180)
    }
}
```

| Command | What it does |
|---|---|
| `move(to:)` | Moves the pen **without drawing**; starts a new subpath |
| `addLine(to:)` | A straight line from the current point |
| `addQuadCurve(to:control:)` | A curve bent toward one control point |
| `addCurve(to:control1:control2:)` | A curve with two control points (a Bézier curve) |
| `addArc(center:radius:startAngle:endAngle:clockwise:)` | Part of a circle |
| `closeSubpath()` | A line **back to the start**, closing the shape |

There are also quick **ready-made** paths:

```swift
Path(ellipseIn: CGRect(x: 0, y: 0, width: 100, height: 60))
Path(roundedRect: CGRect(x: 0, y: 0, width: 100, height: 60), cornerRadius: 12)
```

Remember: in SwiftUI (and UIKit), **y goes down**. `(0, 0)` is the **top-left** corner.

A `Path` is a **view**, so you can `.stroke()` or `.fill()` it directly. But its coordinates are **fixed** numbers. For a drawing that **resizes** with its frame, make a `Shape` (30.2).

---

## 30.2 Custom Shape Conformance 🟢

A **`Shape`** is a reusable drawing. You write **one method**, **`path(in:)`**. SwiftUI passes in the **rectangle** to draw in:

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

The key: build points **from `rect`** (`rect.minX`, `rect.midX`, `rect.maxY`), **not** fixed numbers. Then the shape **fits any frame**: 20×10 in a button, or 300×150 on a poster.

Compared to a plain `Path`, a `Shape`:

- **Resizes** to its frame.
- Can be **reused** anywhere, like `Circle()`.
- Works with **every shape modifier**: `.fill`, `.stroke`, `.trim`, `.clipShape`, as a background.
- Can **animate** its properties (29.12).

Shapes can have **parameters**:

```swift
struct Star: Shape {
    var points: Int = 5
    var innerRatio: Double = 0.45     // how deep the dents are

    func path(in rect: CGRect) -> Path {
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let outer = min(rect.width, rect.height) / 2
        let inner = outer * innerRatio
        var path = Path()

        for i in 0..<(points * 2) {
            let radius = i.isMultiple(of: 2) ? outer : inner
            let angle = Double(i) * .pi / Double(points) - .pi / 2   // start at the top
            let point = CGPoint(x: center.x + cos(angle) * radius,
                                y: center.y + sin(angle) * radius)
            if i == 0 { path.move(to: point) } else { path.addLine(to: point) }
        }
        path.closeSubpath()
        return path
    }
}

// Star(points: 6).fill(.yellow).frame(width: 80, height: 80)
```

---

## 30.3 Stroke, Fill, and Stroke Styles 🟢

You can **fill** a shape (paint the inside), **stroke** it (draw the outline), or **both**. **`StrokeStyle`** controls how the outline looks:

```swift
struct StrokeFillDemoView: View {
    var body: some View {
        VStack(spacing: 20) {
            Circle()
                .fill(.orange)                          // inside only

            Circle()
                .stroke(.blue, lineWidth: 6)            // outline, centered on the edge

            Circle()
                .strokeBorder(.purple, lineWidth: 6)    // outline, fully inside the edge

            Circle()
                .fill(.yellow)
                .stroke(.black, lineWidth: 2)           // both (iOS 17+)

            Rectangle()
                .stroke(.red, style: StrokeStyle(lineWidth: 4, dash: [10, 6]))   // dashed
        }
        .frame(width: 100)
        .padding()
    }
}
```

**`.stroke()` vs. `.strokeBorder()`**:

- `.stroke()` draws the line **centered** on the edge. **Half** of it falls **outside** the frame and can be **cut off**.
- `.strokeBorder()` draws it **fully inside**. The shape keeps **exactly** its frame size.

For a ring or a badge border that must fit its frame, use `.strokeBorder()`.

Before iOS 17, the way to get fill **and** outline was an overlay:

```swift
Circle()
    .fill(.yellow)
    .overlay(Circle().stroke(.black, lineWidth: 2))
```

`StrokeStyle` options:

```swift
StrokeStyle(
    lineWidth: 4,
    lineCap: .round,        // ends: .butt (flat), .round, .square
    lineJoin: .round,       // corners: .miter (sharp), .round, .bevel (cut)
    dash: [10, 6],          // 10 points drawn, 6 points gap, repeat
    dashPhase: 0            // shift the dash pattern; animate it for "marching ants"
)
```

A fill can be **any style**: a color, a gradient, or a material:

```swift
Star().fill(.linearGradient(colors: [.yellow, .orange], startPoint: .top, endPoint: .bottom))
Capsule().fill(.ultraThinMaterial)
```

---

## 30.4 Trimming Paths 🟢

**`.trim(from:to:)`** draws only **part** of a shape's outline. The numbers go from **0** (the start of the path) to **1** (the end). Animating it makes the shape look like it's **drawing itself**:

```swift
struct TrimmedCircleView: View {
    @State private var progress: CGFloat = 0

    var body: some View {
        Circle()
            .trim(from: 0, to: progress)
            .stroke(.blue, style: StrokeStyle(lineWidth: 8, lineCap: .round))
            .frame(width: 150, height: 150)
            .rotationEffect(.degrees(-90))     // start at 12 o'clock, not 3 o'clock
            .onAppear {
                withAnimation(.easeInOut(duration: 1.5)) {
                    progress = 1.0
                }
            }
    }
}
```

A `Circle`'s path **starts on the right** (3 o'clock). The `-90°` rotation moves the start to the **top**, where people expect a progress ring to start.

A complete **progress ring** with a track behind it:

```swift
struct ProgressRing: View {
    var progress: Double       // 0...1

    var body: some View {
        ZStack {
            Circle()
                .stroke(.gray.opacity(0.2), lineWidth: 12)       // the empty track
            Circle()
                .trim(from: 0, to: progress)
                .stroke(.green, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.spring, value: progress)
            Text(progress, format: .percent.precision(.fractionLength(0)))
                .font(.title2.bold())
                .contentTransition(.numericText(value: progress))
        }
        .padding(6)                                              // room for the stroke
    }
}
```

`trim` works on **any shape**: a checkmark that draws itself, a signature, a route on a map.

Moving **both** ends makes a classic **loading spinner**:

```swift
Circle()
    .trim(from: 0, to: 0.7)
    .stroke(.blue, style: StrokeStyle(lineWidth: 4, lineCap: .round))
    .frame(width: 30, height: 30)
    .rotationEffect(.degrees(isSpinning ? 360 : 0))
    .animation(.linear(duration: 1).repeatForever(autoreverses: false), value: isSpinning)
    .onAppear { isSpinning = true }
```

---

## 30.5 Canvas 🟡

**`Canvas`** is a **drawing surface**. Instead of building a tree of shape **views**, you **draw directly** with commands, like `draw(_:)` in UIKit. It's much **faster** when you draw **many** things:

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

The closure gets:

- **`context`**: a **`GraphicsContext`**, the "pen". You call `fill`, `stroke`, `draw` on it.
- **`size`**: the **size** of the canvas, to place things relative to it.

| | Many `Shape` views | One `Canvas` |
|---|---|---|
| 1,000 dots | 1,000 views to create, lay out, and diff | 1 view, 1,000 draw calls |
| Each item tappable, accessible | ✅ | ❌ (one view) |
| Animate items with `withAnimation` | ✅ | ❌ (redraw yourself) |

So: use **views** for a few interactive items, a **Canvas** for **lots** of drawn items (charts, particles, graphs).

You can draw **text**, **images**, and **SwiftUI views** too:

```swift
Canvas { context, size in
    context.draw(Text("Hello").font(.headline), at: CGPoint(x: size.width / 2, y: 20))
    context.draw(Image(systemName: "star.fill"), at: CGPoint(x: 40, y: 40))

    if let badge = context.resolveSymbol(id: "badge") {
        context.draw(badge, at: CGPoint(x: size.width - 30, y: 30))
    }

    var copy = context                 // a copy has its own transform and opacity
    copy.opacity = 0.5
    copy.translateBy(x: 100, y: 100)
    copy.fill(Path(ellipseIn: CGRect(x: 0, y: 0, width: 40, height: 40)), with: .color(.red))
} symbols: {
    Text("NEW").padding(4).background(.red, in: .capsule).tag("badge")   // a real view, drawn into the canvas
}
```

⚠️ A `Canvas` is **one** view to VoiceOver. Add an `.accessibilityLabel` that describes what it shows (70).

---

## 30.6 TimelineView 🟡

**`TimelineView`** redraws its content **on a schedule**, and gives you the **current date**. Use it for things that change **with time**, not because of user actions: clocks, timers, and continuous animations.

A real clock **second hand**, updated **once per second**:

```swift
struct SecondHandClock: View {
    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { timeline in
            let seconds = Calendar.current.component(.second, from: timeline.date)
            let angle = Angle.degrees(Double(seconds) * 6)        // 360° / 60 seconds

            ZStack {
                Circle().stroke(.gray, lineWidth: 2)
                Capsule()
                    .fill(.red)
                    .frame(width: 3, height: 80)
                    .offset(y: -40)                               // pivot at the center
                    .rotationEffect(angle)
            }
            .frame(width: 200, height: 200)
        }
    }
}
```

A **smooth**, continuous animation, redrawn **every frame**:

```swift
struct SpinningLine: View {
    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, size in
                let angle = timeline.date.timeIntervalSinceReferenceDate   // seconds → radians: one turn per ~6.3 s
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

| Schedule | Redraws | Use for |
|---|---|---|
| `.animation` | Every frame (60 or 120 times a second) | Smooth, continuous motion |
| `.animation(minimumInterval: 1/30, paused: isPaused)` | Up to 30 times a second; can pause | Saving battery |
| `.periodic(from:by:)` | At a fixed interval | A clock, a countdown |
| `.everyMinute` | At the start of each minute | "5 min ago" labels |

Why not just `@State` and a `Timer`? Because `TimelineView` is **made for this**: no timer to start, stop, or leak, and the system can **slow it down or pause it** when the view is off screen or the device is in Low Power Mode.

The pattern **`TimelineView(.animation)` + `Canvas`** is SwiftUI's way to build **games**, **particle effects**, and **live visualizations**.

---

## 30.7 .visualEffect() 🟡

**`.visualEffect()`** (iOS 17) changes how a view **looks**, based on **its own geometry** (size and position), without changing **layout**. It gives you a **`GeometryProxy`** like `GeometryReader`, but **without** its greedy, layout-changing behavior (24.19):

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
                            let frame = proxy.frame(in: .scrollView)
                            let isLeaving = frame.minX < 0             // partly off the leading edge
                            return content
                                .scaleEffect(isLeaving ? 0.9 : 1)
                                .opacity(isLeaving ? 0.6 : 1)
                        }
                }
            }
        }
    }
}
```

Only **visual** modifiers are allowed inside (scale, offset, rotation, opacity, blur, color effects). Anything that changes **size** or **layout** isn't. That's what keeps it **fast** and **safe**.

⚠️ The closure isn't on the main actor. Do the math **inside** the closure (as above), not by calling **methods** on your view.

For effects **while scrolling**, there's an even simpler modifier, **`.scrollTransition`**:

```swift
ForEach(photos) { photo in
    PhotoCard(photo: photo)
        .scrollTransition { content, phase in
            content
                .opacity(phase.isIdentity ? 1 : 0.4)      // fully visible = identity
                .scaleEffect(phase.isIdentity ? 1 : 0.85)
                .rotationEffect(.degrees(phase.value * 8)) // value: -1 (leading) … 0 … 1 (trailing)
        }
}
```

| Tool | Use when |
|---|---|
| `.scrollTransition` | The effect depends on **entering or leaving** a scroll view |
| `.visualEffect` | The effect depends on **exact position or size** |
| `GeometryReader` | You need the size to **change layout** (rarely) |

---

## 30.8 GeometryEffect 🔴

**`GeometryEffect`** is a lower-level protocol for **custom, animatable transforms**. You return a **`ProjectionTransform`** (a move, scale, rotate, or skew) for the current animation value:

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

How it works:

1. `GeometryEffect` is **`Animatable`**. When `attempts` goes from 0 to 1 inside `withAnimation`, SwiftUI calls `effectValue` many times with **in-between** values: 0.0, 0.1, 0.2, … 1.0.
2. `sin(value × π × 3)` swings **left and right** three times as the value goes 0 → 1, and is back at **0** at the end.
3. So the text **shakes**, then stops in place.

The **`animatableData`** is what makes it move. Without it, SwiftUI would only call `effectValue` with the **final** value, and there'd be no shake (29.12).

`effectValue(size:)` gets the view's **size**, so you can do transforms relative to it, like a **3D flip** around the center:

```swift
struct FlipEffect: GeometryEffect {
    var angle: Double            // degrees
    var animatableData: Double {
        get { angle }
        set { angle = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        var transform3D = CATransform3DIdentity
        transform3D.m34 = -1 / 500                               // perspective
        transform3D = CATransform3DRotate(transform3D, angle * .pi / 180, 0, 1, 0)
        let toCenter = CGAffineTransform(translationX: -size.width / 2, y: 0)
        let back = CGAffineTransform(translationX: size.width / 2, y: 0)
        return ProjectionTransform(toCenter)
            .concatenating(ProjectionTransform(transform3D))
            .concatenating(ProjectionTransform(back))
    }
}
```

Today, `.phaseAnimator` or `.keyframeAnimator` (29.10, 29.11) can do a shake with **less code**. `GeometryEffect` is still useful when you need **real transform math**.

---

## 30.9 SwiftUI Shaders — .colorEffect() 🔴

**Shaders** are small programs, written in the **Metal Shading Language**, that run on the **GPU**, once for **every pixel**. From iOS 17, SwiftUI can apply them to any view. **`.colorEffect()`** is the simplest kind: it gets each pixel's **color** and returns a **new color**.

The shader, in a **`.metal`** file in your app target:

```cpp
#include <metal_stdlib>
using namespace metal;

[[ stitchable ]]
half4 invertColor(float2 position, half4 color) {
    return half4(1.0 - color.rgb, color.a);    // flip the color, keep transparency
}
```

Using it in SwiftUI:

```swift
struct ColorEffectDemoView: View {
    var body: some View {
        Image(systemName: "photo.fill")
            .font(.system(size: 100))
            .foregroundStyle(.blue)
            .colorEffect(ShaderLibrary.invertColor())
    }
}
```

- **`[[ stitchable ]]`** marks the function so SwiftUI can **find and link** it at run time. Without it, SwiftUI can't call it.
- **`ShaderLibrary.invertColor()`** looks up the function **by name** in the app's compiled Metal code.
- The first two parameters (`position`, `color`) are **filled in by SwiftUI**. Extra parameters are **yours**:

```cpp
[[ stitchable ]]
half4 tint(float2 position, half4 color, half4 tintColor, float strength) {
    return mix(color, tintColor * color.a, strength);
}
```

```swift
Image("photo")
    .colorEffect(ShaderLibrary.tint(.color(.orange), .float(0.4)))
```

| Swift argument | Metal parameter |
|---|---|
| `.float(x)` | `float` |
| `.float2(x, y)` | `float2` |
| `.color(c)` | `half4` |
| `.image(img)` | `texture2d<half>` |
| `.floatArray([...])` | `device const float *ptr, int count` |

Shaders are **fast** (the GPU runs millions of pixels in parallel), but only available on **iOS 17+**.

---

## 30.10 SwiftUI Shaders — .distortionEffect() 🔴

**`.distortionEffect()`** doesn't change colors. It changes **where each pixel comes from**. The shader gets a pixel's **position** and returns the position to **read** the color from. That lets content **bend**, **ripple**, and **wave**.

```cpp
[[ stitchable ]]
float2 wave(float2 position, float time) {
    position.y += sin(position.x / 10 + time) * 8;   // read from a bit above or below
    return position;
}
```

Shader arguments **don't animate** with `withAnimation`; SwiftUI can't interpolate them. To move a shader over time, give it the **time** from a **`TimelineView`** (30.6):

```swift
struct DistortionEffectDemoView: View {
    private let start = Date.now

    var body: some View {
        TimelineView(.animation) { timeline in
            let time = timeline.date.timeIntervalSince(start)

            Text("Wavy Text")
                .font(.system(size: 40, weight: .bold))
                .distortionEffect(
                    ShaderLibrary.wave(.float(time)),
                    maxSampleOffset: CGSize(width: 0, height: 8)
                )
        }
    }
}
```

**`maxSampleOffset`** tells SwiftUI the **farthest** a pixel can be moved (here, 8 points up or down). SwiftUI then draws the view into a **bigger** area, so the moved edges aren't **cut off**. Set it to match your shader: too small, and the edges are clipped; too big, and you waste memory.

| Modifier | Shader returns | Good for |
|---|---|---|
| `.colorEffect` | A new **color** | Tints, inverting, color grading |
| `.distortionEffect` | A **position** to read from | Waves, ripples, wobble, bulge |

---

## 30.11 SwiftUI Shaders — .layerEffect() 🔴

**`.layerEffect()`** is the most powerful of the three. The shader gets the whole rendered view as a **`SwiftUI::Layer`**, and can **read any pixel** in it, not just the current one. That's needed for effects that **mix neighboring pixels**: **pixelation**, **blur**, **edge detection**, **glow**.

```cpp
#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>      // needed for SwiftUI::Layer
using namespace metal;

[[ stitchable ]]
half4 pixelate(float2 position, SwiftUI::Layer layer, float pixelSize) {
    float2 samplePos = floor(position / pixelSize) * pixelSize;   // snap to a grid
    return layer.sample(samplePos);
}
```

```swift
struct LayerEffectDemoView: View {
    @State private var pixelSize = 12.0

    var body: some View {
        VStack {
            Image(systemName: "star.fill")
                .font(.system(size: 100))
                .foregroundStyle(.yellow)
                .layerEffect(
                    ShaderLibrary.pixelate(.float(pixelSize)),
                    maxSampleOffset: .zero,              // we only read inside the view
                    isEnabled: pixelSize > 1             // skip the shader when it does nothing
                )
            Slider(value: $pixelSize, in: 1...30)
        }
    }
}
```

All the pixels in a square read the **same** sample, so the image looks **blocky**.

**Why is it slower?** A `.colorEffect` shader only touches **its own pixel**, which is the cheapest case for the GPU. A layer effect can read **anywhere**, so SwiftUI must first render the whole view into an **off-screen layer** (a texture), and then each pixel may do **several reads** from it. A blur that reads 25 neighbors costs about **25 times** more per pixel.

| | `.colorEffect` | `.distortionEffect` | `.layerEffect` |
|---|---|---|---|
| Reads | Its own pixel | One other position | **Any** pixels |
| Cost | Lowest | Low | Highest |
| Example | Invert, tint | Wave | Blur, pixelate |

So pick the **simplest** one that can do the job. For a plain blur, SwiftUI's built-in **`.blur(radius:)`** is already optimized; write a layer shader only for custom effects.

---

## 30.12 Blend Modes and Compositing Groups 🟡

**`.blendMode()`** decides how a view's pixels **mix** with what's **behind** it, like layer modes in Photoshop or Figma. **`.compositingGroup()`** **flattens** a group of views into **one layer** first, so effects apply to the **result**.

```swift
struct BlendModeDemoView: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(.red)
                .frame(width: 150, height: 150)

            Circle()
                .fill(.blue)
                .frame(width: 150, height: 150)
                .offset(x: 60)
                .blendMode(.multiply)        // the overlap becomes dark purple
        }
        .compositingGroup()                  // blend only inside this group
        .opacity(0.9)                        // fade the finished result as one image
    }
}
```

| Blend mode | Result |
|---|---|
| `.multiply` | **Darker**: like overlapping colored inks |
| `.screen` | **Lighter**: like overlapping lights |
| `.overlay` | More contrast |
| `.difference` | Inverted where they overlap |
| `.destinationOut` | **Cuts a hole** where this view is drawn |

**Why `.compositingGroup()` matters.** Without it, `.opacity(0.5)` on a group is applied to **each child separately**. Overlapping children then **show through each other**, and the overlap looks darker:

```swift
// ❌ Each circle is 50% see-through; where they overlap, it looks doubled
ZStack { Circle().fill(.red); Circle().fill(.red).offset(x: 40) }
    .opacity(0.5)

// ✅ Flattened first: one even, 50% see-through shape
ZStack { Circle().fill(.red); Circle().fill(.red).offset(x: 40) }
    .compositingGroup()
    .opacity(0.5)
```

It also **contains** blend modes: the multiply only mixes **inside** the group, not with the screen's background.

A cool trick: **cut text out** of a shape with `.destinationOut`:

```swift
ZStack {
    RoundedRectangle(cornerRadius: 16).fill(.black)
    Text("SALE").font(.system(size: 60, weight: .black))
        .blendMode(.destinationOut)     // removes pixels: the background shows through the letters
}
.compositingGroup()
.frame(width: 240, height: 100)
```

A related modifier, **`.drawingGroup()`**, also flattens the group, but renders it **with Metal** off screen. It can make **complex** drawings (many shapes, gradients, blurs) **much faster**, but uses more memory. Measure before and after (69).

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Vector geometry | `Path`, `move(to:)`, `addLine(to:)`, `addCurve` | Draw lines and curves with fixed points |
| Reusable custom shapes | `Shape` protocol, `path(in:)` | Shapes that fit any frame |
| Fill/outline | `.fill()`, `.stroke()`, `.strokeBorder()` | Inside, centered outline, or inset outline |
| Line styling | `StrokeStyle` | Width, caps, joins, dashes |
| Partial paths | `.trim(from:to:)` | Progress rings and "draw itself" effects |
| Immediate-mode drawing | `Canvas`, `GraphicsContext` | Fast drawing of many items in one view |
| Time-driven visuals | `TimelineView` | Redraw on a schedule: clocks and continuous motion |
| Geometry-aware visual effects | `.visualEffect()`, `.scrollTransition` | Position-based looks without changing layout |
| Custom transforms | `GeometryEffect` | Animatable transform math (shake, flip) |
| Pixel color shaders | `.colorEffect()` | GPU per-pixel color changes |
| Position-remapping shaders | `.distortionEffect()` | Waves and ripples; set `maxSampleOffset` |
| Neighbor-sampling shaders | `.layerEffect()` | Pixelate, blur, and more; the most costly |
| Layer compositing | `.blendMode()`, `.compositingGroup()`, `.drawingGroup()` | Mix layers; flatten before effects |
