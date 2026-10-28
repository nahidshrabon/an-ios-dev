**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Under every SwiftUI and UIKit view, **Core Animation** layers do the real drawing and animating. This section goes one level down: **layers**, layer animations, **transactions**, frame timing, how a frame gets to the screen, **offscreen rendering**, **Core Graphics** drawing and PDFs, **Core Image** filters, and finally **color**: wide gamut and HDR.

---

## 62.1 The Layer Tree and CALayer 🟢

Every `UIView` has a **`CALayer`** (`view.layer`). The two split the work:

| `UIView` | `CALayer` |
|---|---|
| **Touches**, gestures, the responder chain | **Drawing**: content, color, border, shadow |
| **Layout** (Auto Layout, `layoutSubviews`) | **Animation** of visual properties |
| Accessibility | Sent to the **render server** for the GPU |

So many visual properties live **only on the layer**:

```swift
import UIKit

let card = UIView()
card.backgroundColor = .systemBackground

card.layer.cornerRadius = 16
card.layer.cornerCurve = .continuous             // the smooth, "squircle" corners Apple uses
card.layer.borderWidth = 1
card.layer.borderColor = UIColor.separator.cgColor
card.layer.shadowColor = UIColor.black.cgColor
card.layer.shadowOpacity = 0.15
card.layer.shadowRadius = 8
card.layer.shadowOffset = CGSize(width: 0, height: 4)
```

Layers form their own **tree**, matching the view tree. You can also add **layers without views**: they're lighter, but have no touch handling or layout:

```swift
let progressRing = CAShapeLayer()
progressRing.path = UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: 60, height: 60)).cgPath
progressRing.fillColor = nil
progressRing.strokeColor = UIColor.systemOrange.cgColor
progressRing.lineWidth = 6
progressRing.strokeEnd = 0.4                    // 40% drawn: animatable!
card.layer.addSublayer(progressRing)
```

Special layer classes do special drawing **on the GPU**: `CAShapeLayer` (paths), `CAGradientLayer`, `CATextLayer`, `CAEmitterLayer` (particles), `CAReplicatorLayer` (copies), `CAMetalLayer` (63).

SwiftUI uses layers too, behind the scenes. That's why the ideas in this section (offscreen rendering, the commit cycle) affect SwiftUI performance as well.

---

## 62.2 Implicit vs Explicit Layer Animation 🟡

**Implicit animation**: change an animatable property of a **standalone** layer (one you created, like `progressRing` above), and Core Animation **animates it by itself**, over 0.25 seconds:

```swift
progressRing.strokeEnd = 0.8          // animates from 0.4 to 0.8 automatically
```

⚠️ This does **not** happen for a view's **own** layer (`view.layer`). UIKit **turns off** implicit animations there; changes are instant unless you're inside `UIView.animate`. So:

| Layer | Property change outside an animation block |
|---|---|
| `view.layer` (a view's backing layer) | **Instant** |
| A **standalone** `CALayer` / sublayer you added | **Animated** (implicit, 0.25 s) |

The common surprise is the **second** row: "why does my sublayer animate when I didn't ask?". To change a standalone layer **instantly**, turn actions off in a **transaction** (62.4):

```swift
CATransaction.begin()
CATransaction.setDisableActions(true)
progressRing.strokeEnd = 0.8          // instant, no animation
CATransaction.commit()
```

**Explicit animation** (62.3) is the other way: you create an animation **object** and control its timing, curve, and lifecycle completely.

---

## 62.3 CABasicAnimation and CAKeyframeAnimation 🟡

**`CABasicAnimation`** animates **one** property from one value to another. **`CAKeyframeAnimation`** goes through **several** values, or along a **path**:

```swift
// Basic: grow the progress ring
let grow = CABasicAnimation(keyPath: "strokeEnd")
grow.fromValue = 0.4
grow.toValue = 0.8
grow.duration = 0.6
grow.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)

// Keyframe: a "shake" for a wrong password
let shake = CAKeyframeAnimation(keyPath: "position.x")
shake.values = [0, -10, 10, -6, 6, 0]
shake.isAdditive = true                 // relative to the current position
shake.duration = 0.4
textField.layer.add(shake, forKey: "shake")

// Keyframe along a path
let orbit = CAKeyframeAnimation(keyPath: "position")
orbit.path = UIBezierPath(ovalIn: CGRect(x: 50, y: 50, width: 200, height: 200)).cgPath
orbit.duration = 2
orbit.repeatCount = .infinity
```

⚠️ The **big** gotcha: an animation only changes what you **see** (the **presentation** layer). It does **not** change the property's real value (the **model** layer). When the animation ends and is removed, the layer **jumps back**:

```
Model layer:         strokeEnd = 0.4  ──────────────────────────── 0.4  ← snaps back!
Presentation layer:  0.4 → 0.5 → 0.6 → 0.7 → 0.8 (animation removed)
```

The **right** pattern: set the **model** value **first**, then add an animation **from** the old value:

```swift
let oldValue = progressRing.strokeEnd

CATransaction.begin()
CATransaction.setDisableActions(true)   // no implicit animation for the model change
progressRing.strokeEnd = 0.8            // 1. the REAL new value
CATransaction.commit()

let grow = CABasicAnimation(keyPath: "strokeEnd")
grow.fromValue = oldValue               // 2. animate from the old value...
grow.duration = 0.6                     //    ...to the model value (no toValue needed)
progressRing.add(grow, forKey: "grow")
```

Avoid the common "fix" of `fillMode = .forwards` + `isRemovedOnCompletion = false`. It **looks** right, but the model value stays **wrong**, so hit testing, layout, and later animations misbehave.

Other animation classes: **`CASpringAnimation`** (bouncy, physics-based), **`CAAnimationGroup`** (several at once), and **`CATransition`** (fades and pushes between layer contents).

---

## 62.4 CATransaction 🟡

A **`CATransaction`** groups layer changes so they're applied **together**, with **shared** settings:

```swift
CATransaction.begin()
CATransaction.setAnimationDuration(0.5)
CATransaction.setAnimationTimingFunction(CAMediaTimingFunction(name: .easeOut))
CATransaction.setCompletionBlock {                    // set it BEFORE the changes
    print("All animations in this transaction finished")
}

badgeLayer.opacity = 0.5                              // both use 0.5 s, ease-out
ringLayer.transform = CATransform3DMakeScale(1.2, 1.2, 1)

CATransaction.commit()
```

| Setting | Effect |
|---|---|
| `setAnimationDuration` | Duration for **all** implicit animations inside |
| `setAnimationTimingFunction` | Shared easing curve |
| `setDisableActions(true)` | No implicit animations (62.2) |
| `setCompletionBlock` | **One** callback when **everything** finishes |

Even without `begin()`/`commit()`, Core Animation creates an **implicit** transaction on each run-loop turn and commits it at the end (62.6). That's why many changes in one method all appear on the **same** frame.

It's the same "**batch changes, apply once**" idea as `AVCaptureSession`'s `beginConfiguration`/`commitConfiguration` (55.4) and SwiftUI's `Transaction` (29.14). `UIView.animate` is built on top of Core Animation transactions too.

---

## 62.5 CADisplayLink 🟡

**`CADisplayLink`** calls your code **once per screen refresh**, right before the next frame. Use it for **frame-by-frame** work: a game loop, physics, a custom drawing that changes every frame.

```swift
final class BounceAnimator {
    private var displayLink: CADisplayLink?
    private var position: CGFloat = 0
    private var velocity: CGFloat = 300                 // points per second
    var onFrame: ((CGFloat) -> Void)?

    func start() {
        let link = CADisplayLink(target: self, selector: #selector(step))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
        link.add(to: .main, forMode: .common)           // .common: keeps firing while scrolling
        displayLink = link
    }

    @objc private func step(_ link: CADisplayLink) {
        let dt = link.targetTimestamp - link.timestamp  // this frame's length: 1/60 or 1/120 s
        position += velocity * dt                        // move by TIME, not by "one frame"
        if position > 300 || position < 0 { velocity = -velocity }
        onFrame?(position)
    }

    func stop() {
        displayLink?.invalidate()                        // required: the link retains its target
        displayLink = nil
    }
}
```

| | `Timer` | `CADisplayLink` |
|---|---|---|
| Fires | Roughly at its interval, run-loop dependent | **In sync** with the display refresh |
| Frame rate aware | No | Yes: 60, 120 Hz (ProMotion), and adapts |
| Use for | "Every 5 seconds" | "**Every frame**" |

Two rules:

- Always compute movement from **elapsed time** (`dt`). On a 120 Hz iPad, a "move 5 points per frame" animation runs **twice as fast**.
- **Invalidate** it. The display link holds a **strong** reference to its target, so forgetting `invalidate()` leaks the object and keeps firing.

In SwiftUI, **`TimelineView(.animation)`** (30.6) gives you the same per-frame updates, without the bookkeeping.

---

## 62.6 The Core Animation Commit Cycle 🔴

When you change a layer, it doesn't appear on screen **right away**. Changes collect during the current **run-loop** turn, then get **committed** together:

```
Your code changes properties (model layer updates immediately)
        │
        ▼   end of the run-loop turn: the CA transaction commits
1. Layout   – layoutSubviews / layoutSublayers for anything marked dirty
2. Display  – draw(_:) / draw(in:) for layers that need new content (CPU)
3. Prepare  – decode images, prepare content for the GPU
4. Commit   – package the layer tree and send it to the render server
        │
        ▼   in another process
Render server draws it on the GPU ──► shown at the next display refresh
```

This explains some "mysteries":

- **Reading right after writing** returns the **new** value: `layer.position = p; print(layer.position)` prints `p`. The **model** layer updates **at once**; only the **pixels** come later.
- To see what's **on screen right now** (mid-animation), read the **presentation layer**: `layer.presentation()?.position`. Useful to start a new animation from where the old one visually **is**.
- **`layoutIfNeeded()`** runs the layout step **now**, instead of waiting. That's why the classic UIKit pattern works: change constraints, then call `layoutIfNeeded()` inside `UIView.animate` so the layout change is **animated**.

Each step has a **time budget**. At 120 Hz, the whole frame has about **8 ms**. Slow layout, heavy `draw(_:)` methods, or decoding big images on the main thread make you miss the deadline: a **hitch** (69.5).

---

## 62.7 Offscreen Rendering and Why It Costs 🔴

Normally the GPU draws layers **directly** into the frame. Some effects can't be drawn that way: the GPU must first draw the layer into a separate **offscreen buffer**, then copy it in. That **extra pass** costs time, and with many layers (a scrolling list of cards) it causes **dropped frames**.

Common triggers:

| Trigger | Fix |
|---|---|
| **Shadow without `shadowPath`**: the GPU must find the shape from the content | Set an explicit **`shadowPath`** |
| **`mask`** layers | Prefer simpler shapes, or a pre-rendered image |
| **`cornerRadius` + `masksToBounds`** on a layer with **images or sublayers** | Pre-round images, or only round the background |
| **Group opacity**: `alpha < 1` on a view **with subviews** | Fade the content differently, or accept it for short animations |
| **Blur** (`UIVisualEffectView`) | Use it, but don't stack many |

The **shadow** case is the most common, and the easiest to fix:

```swift
final class CardView: UIView {
    override func layoutSubviews() {
        super.layoutSubviews()
        // The shadow's shape is known: tell the GPU, no offscreen pass needed.
        // Update it here, because bounds change with layout and rotation!
        layer.shadowPath = UIBezierPath(roundedRect: bounds, cornerRadius: layer.cornerRadius).cgPath
    }
}
```

⚠️ Setting `shadowPath` once in `init` is a common bug: when the view resizes, the shadow keeps the **old** shape.

How to **find** offscreen rendering:

- **Xcode's view debugger** lists "optimization opportunities" for layers that render offscreen.
- In the Simulator: **Debug ▸ Color Offscreen-Rendered** highlights them in **yellow**.
- **Instruments** (Animation Hitches, 69.5) shows the frames you actually **drop**.

`shouldRasterize = true` caches a layer as a bitmap. It can help a **static**, complex layer, but it **hurts** when the content changes (the cache is redrawn every time). Measure before and after.

---

## 62.8 Core Graphics Contexts and Drawing 🟢

**Core Graphics** (`CGContext`) is the **2D drawing** API: paths, shapes, gradients, text, images. It draws into a **context**: a bitmap, a PDF (62.9), or a view.

To create an **image**, use **`UIGraphicsImageRenderer`**:

```swift
import UIKit

func makeTimerBadge(minutes: Int, size: CGSize = CGSize(width: 64, height: 64)) -> UIImage {
    let renderer = UIGraphicsImageRenderer(size: size)       // screen scale + wide color, automatically
    return renderer.image { context in
        let rect = CGRect(origin: .zero, size: size)
        let cg = context.cgContext

        // Circle
        cg.setFillColor(UIColor.systemOrange.cgColor)
        cg.fillEllipse(in: rect)

        // White ring
        cg.setStrokeColor(UIColor.white.cgColor)
        cg.setLineWidth(3)
        cg.strokeEllipse(in: rect.insetBy(dx: 4, dy: 4))

        // Centered text (UIKit string drawing works inside the renderer)
        let text = "\(minutes)'" as NSString
        let attributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.boldSystemFont(ofSize: 22),
            .foregroundColor: UIColor.white
        ]
        let textSize = text.size(withAttributes: attributes)
        text.draw(at: CGPoint(x: rect.midX - textSize.width / 2, y: rect.midY - textSize.height / 2),
                  withAttributes: attributes)
    }
}
```

`UIGraphicsImageRenderer` replaces the old `UIGraphicsBeginImageContext` / `UIGraphicsGetImageFromCurrentImageContext` / `UIGraphicsEndImageContext` calls. It's **safer** (no "forgot to end the context" bugs) and picks the right **scale** and **color range** for the screen.

| Need | Use |
|---|---|
| Custom drawing **in a SwiftUI view** | `Canvas` (30.5) or `Shape` |
| An **image** to share, cache, or use in a widget | `UIGraphicsImageRenderer` |
| A custom UIKit view that draws itself | Override `draw(_:)` (keep it **fast**: it runs on the main thread) |
| Animated paths | `CAShapeLayer` (62.1): drawn on the GPU |

Note: raw `CGContext`s (outside UIKit renderers) have **y going up** from the bottom-left. UIKit's renderers flip it for you, so y goes **down** like everywhere else in UIKit.

---

## 62.9 Generating PDFs with Core Graphics 🟢

**`UIGraphicsPDFRenderer`** uses the **same** drawing calls to create a **PDF**. Drawing commands become **vector** content: text stays **real text** (selectable, searchable), and shapes stay **sharp** at any zoom:

```swift
func makeRecipePDF(_ recipe: Recipe) -> Data {
    let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)      // US Letter, in points (A4: 595 × 842)
    let margin: CGFloat = 50
    let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

    return renderer.pdfData { context in
        context.beginPage()

        let title = NSAttributedString(string: recipe.title, attributes: [
            .font: UIFont.boldSystemFont(ofSize: 28)
        ])
        title.draw(at: CGPoint(x: margin, y: margin))

        // Wrapped body text: draw into a rect, not at a point
        let body = NSAttributedString(string: recipe.steps.joined(separator: "\n\n"), attributes: [
            .font: UIFont.systemFont(ofSize: 14)
        ])
        body.draw(in: CGRect(x: margin, y: 110,
                             width: pageRect.width - 2 * margin,
                             height: pageRect.height - 160))

        // A vector divider line
        context.cgContext.setStrokeColor(UIColor.systemOrange.cgColor)
        context.cgContext.move(to: CGPoint(x: margin, y: 95))
        context.cgContext.addLine(to: CGPoint(x: pageRect.width - margin, y: 95))
        context.cgContext.strokePath()
    }
}
```

Then share it, for example with `ShareLink`, or show it with **PDFKit**'s `PDFView`.

| | Vector PDF (this way) | Screenshot inside a PDF |
|---|---|---|
| Zoom / print | **Sharp** at any size | **Blurry** pixels |
| Text | Selectable, searchable, accessible | Just an image |
| File size | Usually **small** | Often large |

For long text across **several pages**, you need to split it yourself (for example with Core Text's `CTFramesetter`), and call `beginPage()` for each page.

---

## 62.10 Core Image Filters 🟡

**Core Image** applies **GPU-accelerated** image filters: blur, color adjustments, distortion, compositing, and more (over 200 built in).

```swift
import CoreImage
import CoreImage.CIFilterBuiltins          // the typed filter API: CIFilter.sepiaTone() etc.
import UIKit

final class PhotoFilterer {
    private let context = CIContext()      // EXPENSIVE to create: make ONE and reuse it

    func warmVintage(_ input: CIImage) -> UIImage? {
        // 1. Build a chain of filters (nothing runs yet)
        let sepia = CIFilter.sepiaTone()
        sepia.inputImage = input
        sepia.intensity = 0.6

        let vignette = CIFilter.vignette()
        vignette.inputImage = sepia.outputImage
        vignette.intensity = 1.2
        vignette.radius = 2

        let blurred = vignette.outputImage?
            .applyingGaussianBlur(sigma: 1)                    // convenience methods work too
            .cropped(to: input.extent)                         // blur grows the edges: crop back

        // 2. Render: NOW the whole chain runs, as one optimized GPU pass
        guard let blurred,
              let cgImage = context.createCGImage(blurred, from: blurred.extent) else { return nil }
        return UIImage(cgImage: cgImage)
    }
}
```

A **`CIImage`** is a **recipe**, not pixels. Chaining filters only **describes** the work. Core Image runs it **lazily**, when you **render** (`createCGImage`, or drawing into a Metal view). Because it sees the **whole** chain, it can **combine** steps into fewer GPU passes, which is faster than running each filter separately.

Tips:

- Create the **`CIContext` once**. Creating one per image is a classic performance bug.
- For a **live preview** (camera, slider), render into an `MTKView` (63) instead of creating `UIImage`s.
- Many filters change the image **extent** (blur makes it bigger, some make it infinite). **Crop** before rendering.

---

## 62.11 Custom CIKernel Filters 🔴

When no built-in filter (or chain of them) does what you need, write your **own** kernel: a small function that runs on the GPU for **every pixel**.

Modern Core Image kernels are written in **Metal Shading Language** (the old GLSL-like "Core Image Kernel Language" is deprecated):

```metal
// HalveGreen.ci.metal
#include <CoreImage/CoreImage.h>

extern "C" float4 halveGreen(coreimage::sample_t pixel) {
    return float4(pixel.r, pixel.g * 0.5, pixel.b, pixel.a);   // runs once per pixel
}
```

Build it with the **`-fcikernel`** Metal compiler flag (and the **`-cikernel`** linker flag), then load it in Swift:

```swift
import CoreImage

enum CustomFilters {
    static let halveGreen: CIColorKernel = {
        let url = Bundle.main.url(forResource: "default", withExtension: "metallib")!
        let data = try! Data(contentsOf: url)
        return try! CIColorKernel(functionName: "halveGreen", fromMetalLibraryData: data)
    }()

    static func apply(to image: CIImage) -> CIImage? {
        halveGreen.apply(extent: image.extent, arguments: [image])
    }
}
```

| Kernel type | Can do |
|---|---|
| `CIColorKernel` | Change **each pixel's color** on its own (fastest) |
| `CIWarpKernel` | Move pixels: **distortion** |
| `CIKernel` (general) | Read **any** pixels: neighborhood effects, custom blurs |

Use a custom kernel only for **truly new** effects: the built-in filters already cover most needs, and GPU code is harder to write and debug. For **SwiftUI views** (not images), the simpler path is a **shader** modifier (30.9).

---

## 62.12 Color Management and Wide Gamut 🔴

Old screens used **sRGB**. Modern Apple screens use **Display P3**: a **wider gamut** with more saturated reds, greens, and oranges. iPhone cameras capture in P3 too.

```
sRGB ⊂ Display P3      (P3 has about 25% more colors)
A P3 tomato red  ──► shown correctly on a P3 screen
                 ──► CLIPPED to the nearest sRGB red if a step in your pipeline assumes sRGB
```

Most of the system already **handles** color for you: `UIImage`, `UIImageView`, SwiftUI `Image`, `UIGraphicsImageRenderer` (62.8), and Core Image (which works in an extended color space) all keep P3 colors. Define P3 colors explicitly when you need them:

```swift
let tomato = UIColor(displayP3Red: 1.0, green: 0.25, blue: 0.1, alpha: 1)   // UIKit
let tomatoSwiftUI = Color(.displayP3, red: 1.0, green: 0.25, blue: 0.1)     // SwiftUI

let p3 = CGColorSpace(name: CGColorSpace.displayP3)!
let tomatoCG = CGColor(colorSpace: p3, components: [1.0, 0.25, 0.1, 1.0])!  // Core Graphics
```

In an asset catalog, you can set a color's **gamut** to Display P3.

Where colors go **wrong**:

| Mistake | Result |
|---|---|
| Drawing into a hand-made **8-bit sRGB** bitmap context | P3 colors **clipped** (duller photos) |
| **Stripping** the image's color profile (e.g. on upload) | Colors **shift** when shown elsewhere |
| Comparing pixel values from images in **different** color spaces | Wrong results in image processing |

The rule: keep the **color space** with the pixels through the whole pipeline, and only convert **on purpose**.

---

## 62.13 HDR and EDR Rendering 🔴

**Wide gamut** (62.12) extends **color**. **HDR** (High Dynamic Range) extends **brightness**: highlights **brighter** than normal "white". Apple's displays show this with **EDR** (Extended Dynamic Range): values above 1.0 are drawn brighter than SDR white, up to the screen's current **headroom**.

```
SDR:  0.0 (black) ──────── 1.0 (UI white)
EDR:  0.0 ──────── 1.0 ──────── 2.0 ──── … up to the headroom (e.g. 4–16× on XDR screens)
                              ↑ sunlight glinting on a sauce pan
```

HDR **video** in `AVPlayer` "just works". HDR **photos** need you to **opt in** (iOS 17):

```swift
// SwiftUI
Image(uiImage: hdrPhoto)
    .allowedDynamicRange(.high)                  // .standard, .constrainedHigh, or .high

// UIKit
imageView.preferredImageDynamicRange = .high
```

For **custom** rendering (Metal, 63), the layer must opt in, and use a pixel format and color space that can hold values above 1.0:

```swift
let metalLayer = CAMetalLayer()
metalLayer.wantsExtendedDynamicRangeContent = true
metalLayer.pixelFormat = .rgba16Float                                       // can store > 1.0
metalLayer.colorspace = CGColorSpace(name: CGColorSpace.extendedLinearDisplayP3)

let headroom = view.window?.screen.currentEDRHeadroom ?? 1                 // how bright, right now
```

Without these steps, HDR content is **clipped** or **tone-mapped** down to SDR, and looks flat.

Use HDR **carefully** in UI: very bright content next to normal UI can look **harsh**, and it uses more **power**. Save it for **photos and video**, where it really helps.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Views and layers | `CALayer`, `view.layer`, layer subclasses | Views handle touch and layout; layers draw and animate |
| Implicit animation | Standalone layers, `setDisableActions` | Sublayers animate by default; view layers don't |
| Explicit animation | `CABasicAnimation`, `CAKeyframeAnimation` | Set the model value first, then animate from the old one |
| Transactions | `CATransaction` | Shared duration, curve, and one completion block |
| Frame timing | `CADisplayLink`, `preferredFrameRateRange` | Per-frame work, based on elapsed time |
| Commit cycle | Layout → display → prepare → commit | Model updates now; pixels at the next frame |
| Offscreen rendering | `shadowPath`, masks, group opacity | An extra GPU pass; fix shadows in `layoutSubviews` |
| 2D drawing | `CGContext`, `UIGraphicsImageRenderer` | Images from drawing code |
| PDFs | `UIGraphicsPDFRenderer` | Sharp, searchable vector documents |
| Image filters | `CIFilter`, one shared `CIContext` | Lazy, GPU-accelerated filter chains |
| Custom filters | Metal-based `CIColorKernel`, `CIKernel` | New per-pixel effects |
| Wide color | Display P3, `CGColorSpace` | Keep the color space through the pipeline |
| HDR / EDR | `.allowedDynamicRange(.high)`, `wantsExtendedDynamicRangeContent` | Brighter-than-white highlights, on purpose |
