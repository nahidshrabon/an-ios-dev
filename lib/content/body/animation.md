**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

In SwiftUI you don't animate **views**; you animate **state changes**. You change a value and say "**animate this**". SwiftUI then moves every view that depends on that value **smoothly** from the old look to the new one. Almost everything in this section is a different way to say **what** to animate and **how**.

---

## 29.1 Implicit Animation 🟢

**Implicit** animation uses the **`.animation(_:value:)`** modifier. It means: "**when this value changes**, animate the changes on this view".

```swift
struct ImplicitAnimationView: View {
    @State private var isExpanded = false

    var body: some View {
        Circle()
            .fill(.blue)
            .frame(width: isExpanded ? 200 : 100, height: isExpanded ? 200 : 100)
            .animation(.default, value: isExpanded)
            .onTapGesture { isExpanded.toggle() }   // no withAnimation needed
    }
}
```

The **`value:`** is required. It limits the animation to changes of **that one value**. Without it (the old, deprecated form), **any** change touching the view animated, even ones you didn't want, like data loading or rotation.

⚠️ `.animation` only affects modifiers **above** it in the chain:

```swift
Circle()
    .frame(width: size, height: size)    // ✅ animated: above .animation
    .animation(.spring, value: size)
    .opacity(size > 100 ? 1 : 0.5)       // ❌ not animated by it: below .animation
```

You can watch **several** values with several modifiers, each with its own curve:

```swift
.animation(.spring, value: isExpanded)
.animation(.easeInOut, value: isHighlighted)
```

---

## 29.2 Explicit Animation 🟢

**Explicit** animation wraps a **state change** in **`withAnimation`**. Every view affected by that change animates:

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

| | Implicit `.animation(_:value:)` | Explicit `withAnimation { }` |
|---|---|---|
| Set on | A **view** | A **state change** |
| Animates | That view, when the value changes | **Every** view affected by the change |
| Good for | One view that always animates a value | Animating **because of an event** (a tap, a load) |

`withAnimation` is usually **easier to reason about**: you see the animation right where the change happens.

From iOS 17, you can run code **when the animation finishes**:

```swift
withAnimation(.easeOut(duration: 0.3)) {
    isCardVisible = false
} completion: {
    cards.removeFirst()          // runs after the card has slid away
}
```

The same change **without** `withAnimation` happens **instantly**. So you choose per change whether it animates.

---

## 29.3 Animation Curves 🟢

A **curve** (timing curve) decides the **speed** of the motion over time. SwiftUI has the standard ones:

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

| Curve | Speed | Feels like |
|---|---|---|
| `.linear` | The same the whole way | Mechanical; good for progress bars and spinners |
| `.easeIn` | Starts slow, ends fast | Something leaving or falling |
| `.easeOut` | Starts **fast**, ends **slow** | Something arriving and stopping |
| `.easeInOut` | Slow, fast, slow | A natural move from A to B |

Each takes a **`duration:`** in seconds. Without one, it uses a short default.

For **exact** control, use a custom **Bézier curve**, like in design tools:

```swift
.animation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.6), value: moved)
```

Most of the time, though, a **spring** (29.4) looks better than any of these.

---

## 29.4 Spring Animations 🟢

A **spring** moves like a real spring: fast at first, maybe a little **bounce**, then it **settles**. Springs feel natural, and they handle **interruptions** well (a new tap mid-animation keeps the current speed instead of jumping).

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

- **`response`**: about how **long** it takes. Lower = **snappier**.
- **`dampingFraction`**: how fast the bounce **dies down**. **`1.0`** = no bounce. **Lower** = **more bounce** and overshoot.

The newer, simpler form uses **`duration`** and **`bounce`**:

```swift
.spring(duration: 0.5, bounce: 0.3)    // bounce: 0 = none, 0.3 = some, 0.6+ = a lot
```

And there are ready-made presets:

| Preset | Feel |
|---|---|
| `.smooth` | No bounce; calm |
| `.snappy` | Quick, a tiny bounce |
| `.bouncy` | Clearly bouncy; playful |
| `.spring` | The balanced default |

```swift
withAnimation(.bouncy) { isLiked.toggle() }
withAnimation(.snappy(duration: 0.25)) { isMenuOpen.toggle() }
```

**Since iOS 17, the default animation (`.default`) is a spring.** It's a good choice for most UI.

---

## 29.5 Delay and Repeat 🟢

**`.delay()`** waits before starting. **`.repeatCount()`** and **`.repeatForever()`** repeat the animation:

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

**`.repeatForever(autoreverses: true)`** loops **forever**, going **forward and back** each time (big, small, big, small) instead of **snapping** back to the start. It's the classic pattern for a **pulsing** "live" dot.

**Delays** are great for **staggering**: making items appear one after another:

```swift
ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
    ItemRow(item: item)
        .opacity(appeared ? 1 : 0)
        .offset(y: appeared ? 0 : 20)
        .animation(.spring.delay(Double(index) * 0.05), value: appeared)   // 50 ms apart
}
.onAppear { appeared = true }
```

For **SF Symbols**, there are built-in repeating effects, with no state needed:

```swift
Image(systemName: "wifi")
    .symbolEffect(.variableColor.iterative, options: .repeating)

Image(systemName: "bell")
    .symbolEffect(.bounce, value: notificationCount)   // bounces each time the count changes
```

---

## 29.6 .transition() 🟢

**`.transition()`** describes how a view **appears** and **disappears**: when it's **added to** or **removed from** the view tree (usually by an `if`). `.animation` is for a view that **stays** and **changes**.

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

| Transition | Effect |
|---|---|
| `.opacity` | Fade (the default) |
| `.slide` | Slide in from the leading edge, out to the trailing edge |
| `.scale` | Grow from / shrink to a point |
| `.move(edge: .bottom)` | Slide in from / out to an edge |
| `.offset(x:y:)` | Move by a fixed amount |
| `.push(from: .trailing)` | Push in, pushing the old view out |
| `.blurReplace` | Blur and fade (iOS 17) |

⚠️ A transition only runs if the **change is animated**: inside `withAnimation`, or under an `.animation(_:value:)` that watches the value. Without that, the view just **pops** in and out.

```swift
// ❌ No animation → the transition is ignored
Button("Toggle") { showDetail.toggle() }

// ✅ Animated change → the transition runs
Button("Toggle") { withAnimation { showDetail.toggle() } }
```

Also keep the `if` inside a **container that stays** (like the `VStack` above). The container is what animates the child coming and going.

---

## 29.7 AsymmetricTransition 🟡

A normal transition uses the **same** effect **in** and **out** (reversed). **`.asymmetric(insertion:removal:)`** gives **different** effects for each:

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

The banner **slides down and fades in** when it appears, but **only fades out** when it goes. **`.combined(with:)`** runs two transitions **together**.

A **card stack** is another common case: new cards come from the right, old ones leave to the left:

```swift
CardView(card: current)
    .id(current.id)            // a new id → a new view → the transition runs (25.15)
    .transition(.asymmetric(
        insertion: .move(edge: .trailing),
        removal: .move(edge: .leading)
    ))
```

You can also build your own **custom** transitions with the **`Transition`** protocol (iOS 17):

```swift
struct RotateFade: Transition {
    func body(content: Content, phase: TransitionPhase) -> some View {
        content
            .rotationEffect(.degrees(phase.isIdentity ? 0 : 30))
            .opacity(phase.isIdentity ? 1 : 0)
    }
}

// .transition(RotateFade())
```

---

## 29.8 matchedGeometryEffect Basics 🟡

**`matchedGeometryEffect(id:in:)`** links **two views** that represent **the same thing**. When one disappears and the other appears, SwiftUI animates the **position and size** from one to the other. It looks like **one view changing shape**.

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

Two parts:

- **`@Namespace`** creates a **shared space** for IDs. IDs only match **inside the same namespace**, so two different screens can both use `"shape"` without clashing.
- The **same `id:`** tells SwiftUI: "these two are **one logical element**".

Only one of them exists at a time, but SwiftUI animates **between their frames** as if it were one shape.

A popular use is a **sliding tab indicator**:

```swift
struct TabBarIndicator: View {
    @Namespace private var namespace
    @State private var selected = "Home"
    let tabs = ["Home", "Search", "Profile"]

    var body: some View {
        HStack {
            ForEach(tabs, id: \.self) { tab in
                Text(tab)
                    .padding(.vertical, 8)
                    .padding(.horizontal, 12)
                    .background {
                        if selected == tab {
                            Capsule()
                                .fill(.blue.opacity(0.2))
                                .matchedGeometryEffect(id: "indicator", in: namespace)
                        }
                    }
                    .onTapGesture {
                        withAnimation(.snappy) { selected = tab }   // the capsule slides to the new tab
                    }
            }
        }
    }
}
```

⚠️ Only **one** view with a given ID should be **visible** at a time (unless you use `isSource:`). Two visible views with the same ID give strange results.

---

## 29.9 matchedGeometryEffect Hero Transitions 🟡

A **hero transition** is a **small thumbnail** that **grows** into a **full detail view**, like in the App Store's Today tab:

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

Each row uses **its own item** as the ID. When you tap "Beta", the list goes away and the detail appears with the **same ID**, `"Beta"`. SwiftUI animates from the **small row's frame** to the **big detail's frame**. The row seems to **grow** into the detail, instead of a hard cut.

Tips for real apps:

- Match **pieces** separately (the image, the title, the background), each with its own ID like `"\(item.id)-image"`. The result looks more polished.
- Add `.zIndex(1)` to the detail, so it animates **above** the other rows.
- For **navigation** (pushing a screen), the **zoom transition** (27.23) is simpler and handles back swipes for you. Use `matchedGeometryEffect` for **custom** layouts **inside one screen**.

---

## 29.10 Phase Animators 🟡

**`.phaseAnimator()`** (iOS 17) moves a view through a **list of phases**, one after another, animating between them. It's great for **multi-step** effects like a **shake** or a **pulse**:

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
                content.offset(x: phase.xOffset)       // how each phase looks
            } animation: { _ in
                .easeInOut(duration: 0.1)              // how to move to that phase
            }
            .onTapGesture { trigger.toggle() }
    }
}
```

The parts:

| Part | Role |
|---|---|
| Phases (`ShakePhase.allCases`) | The steps, in order |
| `trigger:` | **Each time** this value changes, run through all phases **once** |
| Content closure | How the view looks **in** each phase |
| `animation:` closure | The animation used to **reach** each phase |

**Without** a `trigger:`, the phases **loop forever**. That's an easy "breathing" effect:

```swift
Circle()
    .fill(.green)
    .frame(width: 12, height: 12)
    .phaseAnimator([false, true]) { content, isBig in
        content.scaleEffect(isBig ? 1.4 : 1.0).opacity(isBig ? 0.6 : 1)
    } animation: { _ in
        .easeInOut(duration: 1)
    }
```

It replaces chains of `withAnimation` calls with **delays** and **completion** blocks, which were hard to keep in sync.

---

## 29.11 Keyframe Animators 🔴

**`.keyframeAnimator()`** (iOS 17) gives you **full control** over **several properties**, each with its **own timeline**. Think of a video editor: each property has its own track of **keyframes** (values at certain times).

```swift
struct KeyframeAnimatorView: View {
    struct AnimationValues {
        var scale = 1.0
        var verticalOffset = 0.0
        var rotation = Angle.zero
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
                    .rotationEffect(value.rotation)
            } keyframes: { _ in
                KeyframeTrack(\.scale) {
                    SpringKeyframe(1.3, duration: 0.2)
                    SpringKeyframe(1.0, duration: 0.3)
                }
                KeyframeTrack(\.verticalOffset) {
                    LinearKeyframe(-30, duration: 0.2)
                    CubicKeyframe(0, duration: 0.3)
                }
                KeyframeTrack(\.rotation) {
                    LinearKeyframe(.degrees(15), duration: 0.1)
                    LinearKeyframe(.degrees(-15), duration: 0.2)
                    SpringKeyframe(.zero, duration: 0.2)
                }
            }
            .onTapGesture { trigger.toggle() }
    }
}
```

How to read it:

- **`AnimationValues`** holds **every** property you animate.
- Each **`KeyframeTrack`** animates **one** property (by key path), as a list of keyframes.
- All tracks run **at the same time**, side by side.
- Each keyframe sets a **target value** and how long to take to get there.

| Keyframe | Movement to its value |
|---|---|
| `LinearKeyframe` | Constant speed |
| `CubicKeyframe` | Smooth curve, flowing into the next keyframe |
| `SpringKeyframe` | Spring motion |
| `MoveKeyframe` | Jump instantly, no animation |

| Use | When |
|---|---|
| `withAnimation` | A simple A → B change |
| `phaseAnimator` | A few steps, all properties moving together |
| `keyframeAnimator` | Several properties with **different timing** |

Keyframes cost more setup, but give the most **polished** results, like the star above: it **pops up**, **wiggles**, and **settles**, all at once.

---

## 29.12 Animatable and animatableData 🔴

How does SwiftUI animate at all? For each frame, it computes an **in-between value** (it **interpolates**) and redraws. Built-in modifiers like `.frame` and `.opacity` already know how. For your **own** shapes and views, you tell SwiftUI **which number** to interpolate, with **`Animatable`** and **`animatableData`**:

```swift
struct AnimatableCounter: View, Animatable {
    var value: Double

    var animatableData: Double {
        get { value }
        set { value = newValue }      // SwiftUI sets in-between values here, frame by frame
    }

    var body: some View {
        Text("\(Int(value))")
            .font(.system(size: 40, weight: .bold, design: .rounded))
            .monospacedDigit()
    }
}

struct CounterDemoView: View {
    @State private var count: Double = 0

    var body: some View {
        VStack {
            AnimatableCounter(value: count)     // counts 0, 1, 2 … 50
            Button("Add 50") {
                withAnimation(.easeOut(duration: 1)) { count += 50 }
            }
        }
    }
}
```

Without `Animatable`, SwiftUI doesn't know that `value` can be **in between**. It would just **jump** from 0 to 50. With `animatableData`, SwiftUI sets 0.0, 0.8, 2.1, … 50.0 over one second, and `body` shows each one.

This is the base of **animatable custom shapes**:

```swift
struct ProgressRing: Shape {
    var progress: Double            // 0...1

    var animatableData: Double {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        Path { p in
            p.addArc(center: CGPoint(x: rect.midX, y: rect.midY),
                     radius: min(rect.width, rect.height) / 2,
                     startAngle: .degrees(-90),
                     endAngle: .degrees(-90 + 360 * progress),
                     clockwise: false)
        }
    }
}

// ProgressRing(progress: progress).stroke(.blue, lineWidth: 8)
// withAnimation { progress = 0.75 } → the ring grows smoothly
```

`Shape` already conforms to `Animatable`; you only add `animatableData`. iOS 26 also adds an **`@Animatable`** macro that writes `animatableData` for you.

For a simple **number** change in `Text`, there's an easier tool than `Animatable`: `.contentTransition(.numericText())` (29.16) animates the **digits** rolling.

---

## 29.13 VectorArithmetic 🔴

`animatableData` must be a type that conforms to **`VectorArithmetic`**. That's a type SwiftUI can **do math** on:

- **add** and **subtract** values (to get the difference between start and end),
- **scale** by a number (to get "30% of the way"),
- measure its **size** (`magnitudeSquared`), for springs.

`Double`, `CGFloat`, and `Float` already conform. To animate **two** values, combine them with **`AnimatablePair`**:

```swift
struct WavyShape: Shape {
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

`amplitude` and `phase` must **both** animate, so they're packed into **one** `AnimatablePair`. A single `Double` could only carry one of them; the other would **jump**.

For **three or more** values, **nest** pairs:

```swift
var animatableData: AnimatablePair<Double, AnimatablePair<Double, Double>> {
    get { AnimatablePair(a, AnimatablePair(b, c)) }
    set {
        a = newValue.first
        b = newValue.second.first
        c = newValue.second.second
    }
}
```

Nested pairs get hard to read fast. That's one reason the `@Animatable` macro (29.12) is welcome.

---

## 29.14 Transactions and Animation Scoping 🔴

Every state change comes with a **`Transaction`**: a small package of context, including **which animation** (if any) to use. `withAnimation` is really "set the animation on this change's transaction". The **`.transaction`** modifier lets one part of the tree **change** that:

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
                    transaction.animation = nil     // this view opts out
                }
        }
        .onTapGesture {
            withAnimation(.spring) { isExpanded.toggle() }
        }
    }
}
```

Both rectangles react to the **same** animated change. The **blue** one animates. The **green** one **resizes instantly**, because its transaction's animation was set to `nil`.

Other tools for **scoping** animations:

```swift
// Turn off animation for one change, even inside an animated context
var transaction = Transaction()
transaction.disablesAnimations = true
withTransaction(transaction) {
    scrollOffset = 0
}

// Animate only the modifiers inside the closure (iOS 17)
Text("Hello")
    .animation(.spring) { content in
        content
            .scaleEffect(isPressed ? 0.9 : 1)   // animated
    }
    .foregroundStyle(isPressed ? .red : .primary)   // not animated
```

Use these when **part** of a screen should change **instantly** while the rest animates: for example, a **text label** that should update immediately while the **layout** around it moves.

---

## 29.15 Reduce Motion 🟢

**Reduce Motion** is an accessibility setting. Users who get **dizzy** or distracted by movement turn it on. Good apps **respect** it:

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

Reduce Motion doesn't mean "**no animation at all**". It means **less movement**. The best approach is to **replace** big motion (sliding, zooming, bouncing, spinning) with a **gentle fade**, so the user still sees that something changed:

```swift
.transition(reduceMotion ? .opacity : .move(edge: .bottom))

withAnimation(reduceMotion ? .easeInOut(duration: 0.2) : .bouncy) {
    showDetail.toggle()
}
```

A small helper keeps this tidy:

```swift
func withMotionAwareAnimation<Result>(
    _ animation: Animation? = .default,
    reduceMotion: Bool,
    _ body: () throws -> Result
) rethrows -> Result {
    try withAnimation(reduceMotion ? .easeInOut(duration: 0.2) : animation, body)
}
```

System animations (navigation pushes, sheets) already follow the setting. Your **custom** ones are your job. Test with **Settings → Accessibility → Motion → Reduce Motion** (70).

---

## 29.16 Debugging Animation Glitches 🟡

Animation bugs don't crash and don't show compiler errors. Things just **jump** or **don't move**. Here are the usual causes.

**1. The view's identity changes.** A changing **`.id()`** makes a **new view** every time (25.15), so there's nothing to animate between:

```swift
// ❌ The number jumps: each change creates a brand-new Text
struct BadIdentityExampleView: View {
    @State private var count = 0

    var body: some View {
        Text("\(count)")
            .id(count)                               // new identity on every change
            .onTapGesture { withAnimation { count += 1 } }
    }
}

// ✅ Same view; only the value changes, so the digits roll
struct FixedIdentityExampleView: View {
    @State private var count = 0

    var body: some View {
        Text("\(count)")
            .contentTransition(.numericText(value: Double(count)))   // rolls up or down
            .onTapGesture { withAnimation { count += 1 } }
    }
}
```

The same thing happens with **`if`/`else` for styling** (25.14): two branches are two views, so you get a **fade** instead of a smooth change.

**2. The change isn't animated.** No `withAnimation`, or `.animation` is missing its **`value:`**, or it watches the **wrong** value.

**3. The change happens in an `async` call later.** `withAnimation` only covers changes **inside its closure, right now**:

```swift
// ❌ The await finishes later, outside the animation
withAnimation {
    Task { items = await loadItems() }
}

// ✅ Wrap the actual change
Task {
    let loaded = await loadItems()
    withAnimation { items = loaded }
}
```

**4. `.animation` is in the wrong place.** It only animates modifiers **above** it (29.1).

**5. A transition has no animated container.** The `if` must sit inside a view that **stays** (29.6).

How to investigate:

- Turn on **Debug → Slow Animations** in the Simulator to see each frame.
- Add `Self._printChanges()` to see **what** changed and **when** (25.13).
- In **Instruments**, the **SwiftUI** and **Animation Hitches** tools show dropped frames (69).

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Implicit animation | `.animation(_:value:)` | Animate one view when a value changes |
| Explicit animation | `withAnimation { }` | Animate everything a state change affects |
| Standard curves | `.linear`, `.easeIn/Out/InOut` | Fixed speed shapes over time |
| Spring motion | `.spring(duration:bounce:)`, `.smooth`, `.bouncy` | Natural motion; the default since iOS 17 |
| Timing control | `.delay()`, `.repeatForever()` | Stagger and loop animations |
| Insertion/removal | `.transition()` | How views appear and disappear (needs an animated change) |
| Asymmetric effects | `.asymmetric(insertion:removal:)` | Different effects in and out |
| Shape morphing | `matchedGeometryEffect(id:in:)` | Animate one view's frame into another's |
| Hero transitions | Shared `@Namespace` + matching `id` | A thumbnail grows into a detail view |
| Multi-stage effects | `.phaseAnimator()` | Step through phases; loops without a trigger |
| Choreographed animation | `.keyframeAnimator()` | Separate keyframe tracks per property |
| Custom interpolation | `Animatable`, `animatableData` | Tell SwiftUI which number to interpolate |
| Multi-value interpolation | `VectorArithmetic`, `AnimatablePair` | Animate several values together |
| Per-view animation control | `.transaction()`, `withTransaction` | Turn animation off or on for part of the tree |
| Accessibility | `accessibilityReduceMotion` | Swap big motion for gentle fades |
| Debugging | Stable identity, animate the real change | Fix jumps and missing animations |
