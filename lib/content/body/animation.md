## 29.1 Implicit Animation

Implicit animation uses `.animation()` attached to a view, automatically animating any changes to values that modifier observes.

```swift
struct ImplicitAnimationView: View {
    @State private var isExpanded = false

    var body: some View {
        Circle()
            .fill(.blue)
            .frame(width: isExpanded ? 200 : 100, height: isExpanded ? 200 : 100)
            .animation(.default, value: isExpanded)
            .onTapGesture { isExpanded.toggle() }
    }
}
```

`.animation(.default, value: isExpanded)` tells SwiftUI: whenever `isExpanded` changes, animate any resulting visual differences on this view (here, the frame size) using the default animation curve. The `value:` parameter is required — it scopes the animation to only trigger when that specific value changes, rather than animating every possible state change touching the view.

---

## 29.2 Explicit Animation

Explicit animation wraps a state change inside `withAnimation()`, animating whatever visual effects result from that specific state mutation — useful when you want precise control over exactly which changes animate.

```swift
struct ExplicitAnimationView: View {
    @State private var scale: CGFloat = 1.0

    var body: some View {
        Image(systemName: "star.fill")
            .font(.system(size: 60))
            .foregroundStyle(.yellow)
            .scaleEffect(scale)
            .onTapGesture {
                withAnimation(.spring) {
                    scale = scale == 1.0 ? 1.5 : 1.0
                }
            }
    }
}
```

Unlike `.animation()`, which continuously watches a value on a specific view, `withAnimation()` animates the *effects of a single code block* — any state changes made inside it that affect the view hierarchy get animated together. This is generally the more predictable and commonly recommended approach for triggering animation from a specific event.

---

## 29.3 Animation Curves

SwiftUI provides a family of standard timing curves via static `Animation` values, each producing a different pacing feel.

```swift
struct CurvesComparisonView: View {
    @State private var moved = false

    var body: some View {
        VStack(spacing: 20) {
            indicator(offset: moved ? 200 : 0, animation: .linear(duration: 1))
            indicator(offset: moved ? 200 : 0, animation: .easeIn(duration: 1))
            indicator(offset: moved ? 200 : 0, animation: .easeOut(duration: 1))
            indicator(offset: moved ? 200 : 0, animation: .easeInOut(duration: 1))
        }
        .onTapGesture { moved.toggle() }
    }

    func indicator(offset: CGFloat, animation: Animation) -> some View {
        Circle()
            .fill(.blue)
            .frame(width: 30, height: 30)
            .offset(x: offset)
            .animation(animation, value: offset)
    }
}
```

`.linear` moves at constant speed throughout; `.easeIn` starts slow and accelerates; `.easeOut` starts fast and decelerates (often feels the most natural for elements entering a stopped state); `.easeInOut` combines both, starting and ending slow with acceleration in the middle. Each accepts a `duration:` parameter controlling total animation length.

---

## 29.4 Spring Animations

Spring animations model physical spring-like motion, producing natural-feeling bounce and settle behavior rather than a fixed mathematical curve.

```swift
struct SpringAnimationView: View {
    @State private var isToggled = false

    var body: some View {
        Circle()
            .fill(.purple)
            .frame(width: 80, height: 80)
            .offset(y: isToggled ? 150 : 0)
            .onTapGesture {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.6)) {
                    isToggled.toggle()
                }
            }
    }
}
```

`response:` roughly controls how quickly the spring reacts (lower values feel snappier), and `dampingFraction:` controls how much the motion oscillates before settling — a value near `1.0` settles smoothly with minimal bounce, while lower values produce more pronounced overshoot and bounce. SwiftUI also offers convenience presets like `.bouncy`, `.smooth`, and `.snappy` that provide well-tuned spring configurations without manually specifying `response`/`dampingFraction`.

---

## 29.5 Delay and Repeat

Animations can be delayed before starting, and repeated a fixed number of times or indefinitely, via `.delay()` and `.repeatCount()`/`.repeatForever()`.

```swift
struct PulsingIndicatorView: View {
    @State private var isPulsing = false

    var body: some View {
        Circle()
            .fill(.red)
            .frame(width: 20, height: 20)
            .scaleEffect(isPulsing ? 1.5 : 1.0)
            .opacity(isPulsing ? 0.3 : 1.0)
            .animation(
                .easeInOut(duration: 0.8)
                    .repeatForever(autoreverses: true)
                    .delay(0.5),
                value: isPulsing
            )
            .onAppear { isPulsing = true }
    }
}
```

`.repeatForever(autoreverses: true)` loops the animation indefinitely, alternating between the start and end states each cycle (autoreversing) rather than snapping back — a common pattern for attention-grabbing pulsing indicators like the one above. `.delay()` inserts a pause before the animation begins, useful for staggering multiple elements' entrance animations.

---

## 29.6 .transition()

`.transition()` defines how a view animates into and out of the hierarchy — that is, what happens specifically when a view is added or removed (as opposed to a property changing on a view that remains present).

```swift
struct TransitionExampleView: View {
    @State private var showDetail = false

    var body: some View {
        VStack {
            Button("Toggle") { withAnimation { showDetail.toggle() } }

            if showDetail {
                Text("Extra detail content")
                    .padding()
                    .background(.yellow)
                    .transition(.slide)
            }
        }
    }
}
```

Standard built-in transitions include `.opacity` (fade), `.slide`, `.scale`, `.move(edge:)`, and `.offset()`. Transitions only take visible effect when the insertion/removal is wrapped in `withAnimation()` (or occurs within an implicitly animated context) — without that, the view simply appears/disappears instantly regardless of the assigned `.transition()`.

---

## 29.7 AsymmetricTransition

`.asymmetric(insertion:removal:)` lets a view use different transitions for appearing versus disappearing, rather than the same transition reversed.

```swift
struct AsymmetricTransitionView: View {
    @State private var showBanner = false

    var body: some View {
        VStack {
            Button("Toggle Banner") { withAnimation { showBanner.toggle() } }

            if showBanner {
                Text("New message!")
                    .padding()
                    .background(.green)
                    .transition(
                        .asymmetric(
                            insertion: .move(edge: .top).combined(with: .opacity),
                            removal: .opacity
                        )
                    )
            }
        }
    }
}
```

Here the banner slides down while fading in on insertion, but simply fades out (without sliding back up) on removal — a common pattern where entrance and exit should feel intentionally different rather than symmetric. `.combined(with:)` layers multiple transitions together, as shown combining `.move` and `.opacity`.

---

## 29.8 matchedGeometryEffect Basics

`matchedGeometryEffect(id:in:)` links two views (typically appearing at different times or in different parts of the hierarchy) sharing a common namespace, so SwiftUI can smoothly animate one view's position/size into matching the other's — producing the illusion of a single view morphing between two states.

```swift
struct MatchedGeometryBasicsView: View {
    @Namespace private var animation
    @State private var isExpanded = false

    var body: some View {
        VStack {
            if !isExpanded {
                RoundedRectangle(cornerRadius: 10)
                    .fill(.blue)
                    .matchedGeometryEffect(id: "shape", in: animation)
                    .frame(width: 60, height: 60)
            } else {
                RoundedRectangle(cornerRadius: 30)
                    .fill(.blue)
                    .matchedGeometryEffect(id: "shape", in: animation)
                    .frame(width: 300, height: 300)
            }
        }
        .onTapGesture { withAnimation(.spring) { isExpanded.toggle() } }
    }
}
```

`@Namespace` creates the shared coordinate context (`animation` here), and matching `id:` values across the two conditionally-shown views tell SwiftUI they represent "the same" logical element — even though only one is actually present in the hierarchy at any given moment, SwiftUI animates the transition between their frames as if it were one continuous shape.

---

## 29.9 matchedGeometryEffect Hero Transitions

The most common real-world application of `matchedGeometryEffect` is a "hero transition" — a small thumbnail smoothly expanding into a full detail view, as seen in apps like Photos or App Store.

```swift
struct HeroTransitionView: View {
    @Namespace private var heroNamespace
    @State private var selectedItem: String?

    let items = ["Alpha", "Beta", "Gamma"]

    var body: some View {
        ZStack {
            if selectedItem == nil {
                VStack {
                    ForEach(items, id: \.self) { item in
                        Text(item)
                            .padding()
                            .background(.blue.opacity(0.2))
                            .matchedGeometryEffect(id: item, in: heroNamespace)
                            .onTapGesture {
                                withAnimation(.spring) { selectedItem = item }
                            }
                    }
                }
            } else if let selectedItem {
                Text(selectedItem)
                    .font(.largeTitle)
                    .padding(40)
                    .background(.blue.opacity(0.2))
                    .matchedGeometryEffect(id: selectedItem, in: heroNamespace)
                    .onTapGesture {
                        withAnimation(.spring) { self.selectedItem = nil }
                    }
            }
        }
    }
}
```

Each row shares an `id:` (its own item string) in the common `heroNamespace`. Tapping a row swaps `selectedItem`, causing the list to disappear and the detail view (sharing the same `id:` as the tapped row) to appear — SwiftUI interpolates the frame change between the small row and the large detail view, producing the expanding "hero" effect rather than a jarring cut. (Section 27.20's `.navigationTransition(.zoom())` is a purpose-built, simpler alternative for the specific case of navigation-triggered zoom transitions.)

---

## 29.10 Phase Animators

`.phaseAnimator()` (available from iOS 17) steps a view through a sequence of discrete "phases," automatically animating between each one — well suited to multi-stage effects like a shake or bounce sequence.

```swift
struct PhaseAnimatorView: View {
    @State private var trigger = false

    enum ShakePhase: CaseIterable {
        case start, left, right, center

        var xOffset: CGFloat {
            switch self {
            case .start, .center: return 0
            case .left: return -10
            case .right: return 10
            }
        }
    }

    var body: some View {
        Image(systemName: "bell.fill")
            .font(.system(size: 50))
            .phaseAnimator(ShakePhase.allCases, trigger: trigger) { content, phase in
                content.offset(x: phase.xOffset)
            } animation: { _ in
                .easeInOut(duration: 0.1)
            }
            .onTapGesture { trigger.toggle() }
    }
}
```

`.phaseAnimator()` takes the sequence of phase values, a `trigger:` value that restarts the sequence when it changes, a content closure describing how each phase should visually modify the view, and an `animation:` closure controlling the timing between phase transitions. SwiftUI automatically steps through each phase in order, animating between them — ideal for expressive, multi-beat effects without manually chaining several `withAnimation()` calls and completion handlers.

---

## 29.11 Keyframe Animators

`.keyframeAnimator()` (iOS 17+) provides fine-grained control over multiple animatable properties simultaneously, each with its own independent timeline of keyframes — well suited to complex, choreographed multi-property animations.

```swift
struct KeyframeAnimatorView: View {
    struct AnimationValues {
        var scale = 1.0
        var verticalOffset = 0.0
        var opacity = 1.0
    }

    @State private var trigger = false

    var body: some View {
        Image(systemName: "star.fill")
            .font(.system(size: 50))
            .foregroundStyle(.yellow)
            .keyframeAnimator(initialValue: AnimationValues(), trigger: trigger) { content, value in
                content
                    .scaleEffect(value.scale)
                    .offset(y: value.verticalOffset)
                    .opacity(value.opacity)
            } keyframes: { _ in
                KeyframeTrack(\.scale) {
                    SpringKeyframe(1.3, duration: 0.2)
                    SpringKeyframe(1.0, duration: 0.3)
                }
                KeyframeTrack(\.verticalOffset) {
                    LinearKeyframe(-30, duration: 0.2)
                    LinearKeyframe(0, duration: 0.3)
                }
                KeyframeTrack(\.opacity) {
                    LinearKeyframe(1.0, duration: 0.5)
                }
            }
            .onTapGesture { trigger.toggle() }
    }
}
```

Each `KeyframeTrack` animates one property (via key path) along its own independent sequence of keyframes (`LinearKeyframe`, `SpringKeyframe`, `CubicKeyframe`, etc., each with its own `duration:`), all running in parallel on a shared overall timeline. This gives far more choreographic control than a single `withAnimation()` call, at the cost of more setup — appropriate for polished, bespoke animation sequences like the pop-and-lift-then-settle star effect above.

---

## 29.12 Animatable and animatableData

Custom `Shape`s or views can conform to `Animatable` by exposing an `animatableData` property, telling SwiftUI exactly which underlying numeric value(s) should be interpolated during animation.

```swift
struct AnimatableCounter: View, Animatable {
    var value: Double

    var animatableData: Double {
        get { value }
        set { value = newValue }
    }

    var body: some View {
        Text("\(Int(value))")
            .font(.system(size: 40, weight: .bold, design: .rounded))
            .contentTransition(.numericText())
    }
}

struct CounterDemoView: View {
    @State private var count: Double = 0

    var body: some View {
        VStack {
            AnimatableCounter(value: count)
            Button("Add 50") {
                withAnimation(.easeOut(duration: 1)) { count += 50 }
            }
        }
    }
}
```

Without `Animatable` conformance, SwiftUI has no way to know that `value` should be smoothly interpolated frame-by-frame during an animation — it would simply jump from the old value to the new one. Exposing `animatableData` (here, directly mapped to `value`) tells the framework exactly what numeric quantity to interpolate, enabling smooth "counting up" animation as `value` transitions from its old value to the new one.

---

## 29.13 VectorArithmetic

For `Animatable` types that need to interpolate more than a single `Double`, `animatableData` can be any type conforming to `VectorArithmetic` — commonly `AnimatablePair` for combining two values, or a custom type for more complex multi-value interpolation.

```swift
struct WavyShape: Shape, Animatable {
    var amplitude: Double
    var phase: Double

    var animatableData: AnimatablePair<Double, Double> {
        get { AnimatablePair(amplitude, phase) }
        set {
            amplitude = newValue.first
            phase = newValue.second
        }
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let midY = rect.height / 2
        path.move(to: CGPoint(x: 0, y: midY))
        for x in stride(from: 0, through: rect.width, by: 1) {
            let relativeX = x / rect.width
            let sine = sin(relativeX * .pi * 4 + phase)
            let y = midY + sine * amplitude
            path.addLine(to: CGPoint(x: x, y: y))
        }
        return path
    }
}
```

`AnimatablePair<Double, Double>` bundles `amplitude` and `phase` into a single interpolatable unit — `VectorArithmetic` requires types to support addition, scaling, and a notion of "magnitude," which is exactly what's needed for SwiftUI to compute smooth in-between values across an arbitrary number of properties simultaneously, here producing a smoothly morphing wave shape as both values animate together.

---

## 29.14 Transactions and Animation Scoping

A `Transaction` carries the animation context (or lack thereof) associated with a particular state change, and can be read or modified via `.transaction()` to override animation behavior for specific parts of a view hierarchy.

```swift
struct TransactionScopingView: View {
    @State private var isExpanded = false

    var body: some View {
        VStack {
            RoundedRectangle(cornerRadius: 10)
                .fill(.blue)
                .frame(width: isExpanded ? 250 : 100, height: 80)

            RoundedRectangle(cornerRadius: 10)
                .fill(.green)
                .frame(width: isExpanded ? 250 : 100, height: 80)
                .transaction { transaction in
                    transaction.animation = nil
                }
        }
        .onTapGesture {
            withAnimation(.spring) { isExpanded.toggle() }
        }
    }
}
```

Here, both rectangles respond to the same `isExpanded` state change wrapped in `withAnimation()`, but the green rectangle's `.transaction()` modifier explicitly nils out the transaction's animation — causing it to resize instantly while the blue rectangle above it animates smoothly. This provides fine-grained, per-view control over animation participation, useful when part of a hierarchy should deliberately opt out of an otherwise-animated state change.

---

## 29.15 Reduce Motion

The system-wide Reduce Motion accessibility setting expresses a user preference for minimizing large or disorienting animations. Well-behaved apps should check this and adjust or substitute animations accordingly.

```swift
struct ReduceMotionAwareView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isExpanded = false

    var body: some View {
        Circle()
            .fill(.blue)
            .frame(width: isExpanded ? 200 : 100, height: isExpanded ? 200 : 100)
            .animation(reduceMotion ? nil : .spring, value: isExpanded)
            .onTapGesture { isExpanded.toggle() }
    }
}
```

`@Environment(\.accessibilityReduceMotion)` reflects the user's system setting. Rather than removing feedback entirely when Reduce Motion is on, well-designed apps typically substitute large movement/scale-based animation with a simpler cue (like a crossfade, or in this simplified example, no animation at all) — respecting the user's stated preference for a calmer, less motion-heavy interface without losing all sense of state change.

---

## 29.16 Debugging Animation Glitches

Common animation problems and their typical causes are worth recognizing directly, since animation bugs can be subtle and don't always throw compiler errors or crashes.

```swift
// PROBLEM: animation "jumps" instead of smoothly transitioning —
// often caused by an .id() change forcing full view identity reset
struct BadIdentityExampleView: View {
    @State private var count = 0

    var body: some View {
        Text("\(count)")
            .id(count) // new identity every change — defeats animation
            .onTapGesture { withAnimation { count += 1 } }
    }
}

// FIX: keep identity stable; animate the underlying value instead
struct FixedIdentityExampleView: View {
    @State private var count = 0

    var body: some View {
        Text("\(count)")
            .contentTransition(.numericText())
            .onTapGesture { withAnimation { count += 1 } }
    }
}
```

A frequent cause of "animation just doesn't happen" bugs is a missing `value:` argument on `.animation()`, or forgetting to wrap a state mutation in `withAnimation()` at all. Another common cause, shown above, is inadvertently changing a view's `.id()` alongside the animated state — since `.id()` controls view identity (recall structural identity from section 23), changing it forces SwiftUI to treat the view as an entirely new instance rather than an existing one transitioning between values, which defeats the animation and produces an abrupt jump instead. Keeping identity stable while only the underlying data changes is essential for smooth, correct animation behavior.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Implicit animation | `.animation(_:value:)` | Auto-animate a view's changes to a watched value |
| Explicit animation | `withAnimation { }` | Animate effects of a specific state change |
| Standard curves | `.linear`, `.easeIn/Out/InOut` | Fixed mathematical timing curves |
| Spring motion | `.spring(response:dampingFraction:)` | Physically-inspired bounce and settle |
| Timing control | `.delay()`, `.repeatForever()` | Stagger and loop animations |
| Insertion/removal | `.transition()` | Animate views appearing/disappearing |
| Asymmetric effects | `.asymmetric(insertion:removal:)` | Different transitions in vs. out |
| Shape morphing | `matchedGeometryEffect(id:in:)` | Animate one view's frame into another's |
| Hero transitions | Shared `@Namespace` + matching `id` | Thumbnail-to-detail expand effect |
| Multi-stage effects | `.phaseAnimator()` | Step through discrete animated phases |
| Choreographed animation | `.keyframeAnimator()` | Independent per-property keyframe tracks |
| Custom interpolation | `Animatable`, `animatableData` | Tell SwiftUI what to interpolate |
| Multi-value interpolation | `VectorArithmetic`, `AnimatablePair` | Combine multiple animatable values |
| Per-view animation control | `.transaction()` | Override animation for part of a hierarchy |
| Accessibility | `accessibilityReduceMotion` | Respect reduced-motion preference |
| Debugging | Stable `.id()`, explicit `value:` | Avoid identity resets that break animation |
