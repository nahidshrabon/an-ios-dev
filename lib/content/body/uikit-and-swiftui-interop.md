## 38.1 UIViewRepresentable Basics

`UIViewRepresentable` is the protocol that wraps a `UIView` for use inside SwiftUI, bridging UIKit's imperative, mutable view model into SwiftUI's declarative one via two required methods: `makeUIView(context:)` and `updateUIView(_:context:)`.

```swift
struct ActivityIndicatorView: UIViewRepresentable {
    var isAnimating: Bool

    func makeUIView(context: Context) -> UIActivityIndicatorView {
        let indicator = UIActivityIndicatorView(style: .medium)
        indicator.hidesWhenStopped = true
        return indicator
    }

    func updateUIView(_ uiView: UIActivityIndicatorView, context: Context) {
        if isAnimating {
            uiView.startAnimating()
        } else {
            uiView.stopAnimating()
        }
    }
}
```

`makeUIView(context:)` runs once, constructing and configuring the initial `UIView` instance — the UIKit equivalent of a SwiftUI view's initial `body` evaluation. `updateUIView(_:context:)`, by contrast, runs every time SwiftUI re-evaluates this representable's containing view (whenever `isAnimating` or any other input changes) — it's where the wrapped UIKit view is synced to match SwiftUI's current state, conceptually parallel to how a SwiftUI view's `body` re-runs on every state change, just applied imperatively to an existing object instead of producing a fresh view description.

---

## 38.2 UIViewControllerRepresentable Basics

`UIViewControllerRepresentable` is the analogous protocol for wrapping a whole `UIViewController` (rather than just a `UIView`) — appropriate when the UIKit functionality being bridged owns its own view controller lifecycle, like a camera picker, map controller, or an entire legacy screen.

```swift
struct DocumentScannerView: UIViewControllerRepresentable {
    @Binding var scannedText: String

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let scanner = VNDocumentCameraViewController()
        scanner.delegate = context.coordinator
        return scanner
    }

    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {
        // no ongoing sync needed for this particular controller
    }
}
```

The method pair mirrors `UIViewRepresentable` exactly — `makeUIViewController(context:)` for one-time construction, `updateUIViewController(_:context:)` for ongoing sync — but operating on a `UIViewController` subclass instead of a `UIView` subclass. Choosing between the two protocols comes down to what the UIKit API you're bridging actually vends: some frameworks (like `VisionKit`'s document scanner here) hand you a ready-made view controller, in which case `UIViewControllerRepresentable` is the natural fit, while a standalone reusable control (like a custom `UIView` subclass) fits `UIViewRepresentable` better.

---

## 38.3 The Coordinator Pattern

Since `UIViewRepresentable`/`UIViewControllerRepresentable` structs are themselves value types recreated on every SwiftUI update, they can't directly serve as a persistent UIKit delegate (35.7) — the `Coordinator` is a small reference-type helper object, created once via `makeCoordinator()`, that fills this role instead.

```swift
struct ScannerContainerView: UIViewControllerRepresentable {
    @Binding var scannedText: String

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let scanner = VNDocumentCameraViewController()
        scanner.delegate = context.coordinator
        return scanner
    }

    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}

    class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        var parent: ScannerContainerView

        init(_ parent: ScannerContainerView) {
            self.parent = parent
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            parent.scannedText = extractText(from: scan)
        }
    }
}
```

`makeCoordinator()` is called once (independent of `makeUIViewController`/`updateUIViewController`'s repeated invocations) and its result is stored by SwiftUI for the representable's entire lifetime, making the `Coordinator` the natural home for anything requiring object identity — delegate conformance, target-action handlers (35.8), or KVO observers. The `Coordinator` keeps a reference back to its parent representable, letting delegate callbacks (like `didFinishWith`) write into SwiftUI-owned state (here, `scannedText` via a `@Binding`) to flow data from the UIKit side back up into SwiftUI.

---

## 38.4 Context and Environment Access

The `context: Context` parameter passed to every representable method carries the `Coordinator` instance, environment values SwiftUI has propagated down to this point in the view tree, and a `transaction` describing the update currently in progress.

```swift
struct StyledTextView: UIViewRepresentable {
    var text: String

    func makeUIView(context: Context) -> UITextView {
        UITextView()
    }

    func updateUIView(_ uiView: UITextView, context: Context) {
        uiView.text = text
        uiView.textColor = UIColor(context.environment.foregroundStyle as? Color ?? .primary)
        uiView.isEditable = !context.environment.isEnabled == false
    }
}
```

`context.environment` exposes the same environment values a regular SwiftUI view would read via `@Environment` (state management, section 25) — letting a representable's UIKit content respond to ambient context like color scheme, `isEnabled`, or `dynamicTypeSize` without those values needing to be manually threaded through as explicit properties. `context.transaction` additionally exposes the active animation (if any) driving the current update, useful for deciding whether a UIKit-side change (like a `UIView.animate` call) should itself be animated to match.

---

## 38.5 Hosting SwiftUI Inside UIKit with UIHostingController

Going the other direction — embedding SwiftUI content inside a UIKit-based app — is done via `UIHostingController<Content: View>`, which wraps any SwiftUI view so it can be used like any other `UIViewController` via containment (35.12).

```swift
class LegacyProfileViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()

        let profileView = ProfileSummaryView(user: currentUser)
        let hostingController = UIHostingController(rootView: profileView)

        addChild(hostingController)
        view.addSubview(hostingController.view)
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        hostingController.didMove(toParent: self)
    }
}
```

`UIHostingController` is instantiated with a `rootView` (the SwiftUI content to display) and behaves as a normal child view controller from that point on — it must go through the exact same containment sequence (`addChild`, add its `view`, `didMove(toParent:)`) as any other child controller, since `UIHostingController` itself is just a `UIViewController` subclass under the hood. To update the displayed SwiftUI content later, `hostingController.rootView` can be reassigned directly with a new view value, which triggers SwiftUI's normal diffing and re-render for that subtree.

---

## 38.6 Sizing and Layout Across the Boundary

Because UIKit's frame-based layout (35.3) and SwiftUI's proposal-based layout negotiation are fundamentally different systems, sizing a representable or a hosted SwiftUI view correctly requires explicit attention at the boundary between them.

```swift
struct FixedHeightChart: UIViewRepresentable {
    func makeUIView(context: Context) -> ChartUIView {
        let view = ChartUIView()
        view.setContentHuggingPriority(.defaultHigh, for: .vertical)
        return view
    }

    func updateUIView(_ uiView: ChartUIView, context: Context) {}
}

// SwiftUI usage:
FixedHeightChart()
    .frame(height: 220) // SwiftUI still needs an explicit size hint for a UIKit-backed view
```

A `UIViewRepresentable`'s wrapped `UIView` reports its size to SwiftUI's layout system via its intrinsic content size and content hugging/compression resistance priorities (36.5) — properties SwiftUI's own layout negotiation understands and respects when sizing the representable within a stack or other container. In the reverse direction, a `UIHostingController` computes and exposes a `sizeThatFits(in:)`-driven preferred size for its SwiftUI content, which UIKit code can query (similar in spirit to `systemLayoutSizeFitting`, 36.9) when it needs to size a container around hosted SwiftUI content that doesn't have an explicit fixed frame.

---

## 38.7 UIHostingConfiguration for Cells 🟠

`UIHostingConfiguration` lets a `UITableViewCell` or `UICollectionViewCell` (37.2) use SwiftUI directly for its content, without manually wiring up a `UIHostingController` as a child view controller inside each cell.

```swift
class ModernFeedViewController: UITableViewController {
    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        let item = items[indexPath.row]

        cell.contentConfiguration = UIHostingConfiguration {
            FeedItemRow(item: item)
        }

        return cell
    }
}
```

Assigning a `UIHostingConfiguration` to a cell's `contentConfiguration` property lets that cell's entire visual content be described declaratively in SwiftUI, while the cell itself remains a normal, reusable `UITableViewCell`/`UICollectionViewCell` participating in the standard reuse pool (37.2) — UIKit handles the underlying hosting machinery automatically on each reuse, rather than requiring manual `UIHostingController` containment per cell. This is generally the preferred modern approach for mixing SwiftUI content into table/collection view cells within an otherwise UIKit-based screen, avoiding the containment boilerplate a hand-rolled hosting controller would require.

---

## 38.8 Data Flow: Bindings, Closures, and Combine Bridges

Passing data across the UIKit/SwiftUI boundary cleanly typically means translating UIKit's delegate/target-action idioms (35.7, 35.8) into SwiftUI's `@Binding` and closure-based conventions, usually via the `Coordinator`.

```swift
struct LegacySliderView: UIViewRepresentable {
    @Binding var value: Double
    var onEditingChanged: (Bool) -> Void = { _ in }

    func makeCoordinator() -> Coordinator {
        Coordinator(value: $value, onEditingChanged: onEditingChanged)
    }

    func makeUIView(context: Context) -> UISlider {
        let slider = UISlider()
        slider.addTarget(context.coordinator, action: #selector(Coordinator.valueChanged), for: .valueChanged)
        slider.addTarget(context.coordinator, action: #selector(Coordinator.editingEnded), for: [.touchUpInside, .touchUpOutside])
        return slider
    }

    func updateUIView(_ uiView: UISlider, context: Context) {
        uiView.value = Float(value)
    }

    class Coordinator: NSObject {
        var value: Binding<Double>
        var onEditingChanged: (Bool) -> Void

        init(value: Binding<Double>, onEditingChanged: @escaping (Bool) -> Void) {
            self.value = value
            self.onEditingChanged = onEditingChanged
        }

        @objc func valueChanged(_ sender: UISlider) {
            value.wrappedValue = Double(sender.value)
        }

        @objc func editingEnded(_ sender: UISlider) {
            onEditingChanged(false)
        }
    }
}
```

The `Coordinator` here wires UIKit's target-action mechanism directly to a `@Binding`'s `wrappedValue`, giving the same two-way data flow SwiftUI's own `Slider(value:)` provides natively, just bridged through UIKit's `UISlider` and its `.valueChanged` control event. This pattern generalizes to Combine-based bridges too — a `Coordinator` can hold `AnyCancellable` subscriptions to a UIKit object's Combine publishers (or `NotificationCenter` publishers), forwarding updates into `@Published` properties or bindings the SwiftUI side observes, whenever an interop surface needs richer reactive data flow than a single delegate callback provides.

---

## 38.9 Dismantling and Lifecycle Cleanup 🟠

`UIViewRepresentable`/`UIViewControllerRepresentable` provide an optional `dismantleUIView(_:coordinator:)` (or `dismantleUIViewController`) static method, called when the wrapped view is being permanently removed from the SwiftUI view hierarchy — the natural place for any cleanup the `Coordinator` can't handle via ordinary deinitialization.

```swift
struct AudioVisualizerView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> VisualizerUIView {
        let view = VisualizerUIView()
        context.coordinator.startObserving(view)
        return view
    }

    func updateUIView(_ uiView: VisualizerUIView, context: Context) {}

    static func dismantleUIView(_ uiView: VisualizerUIView, coordinator: Coordinator) {
        coordinator.stopObserving()
    }

    class Coordinator {
        private var displayLink: CADisplayLink?

        func startObserving(_ view: VisualizerUIView) {
            displayLink = CADisplayLink(target: self, selector: #selector(tick))
            displayLink?.add(to: .main, forMode: .common)
        }

        func stopObserving() {
            displayLink?.invalidate()
        }

        @objc private func tick() {}
    }
}
```

Because `dismantleUIView` is a `static` method, it deliberately has no implicit access to `self` — it receives the outgoing view and coordinator explicitly as parameters, since the representable value that originally created them may no longer exist by the time dismantling happens. This matters specifically for resources that wouldn't otherwise be cleaned up by simple deallocation, like an active `CADisplayLink` (which retains its target and keeps firing until explicitly invalidated) or a manually-started system service — ordinary Swift deinitialization alone won't stop these without an explicit teardown call, making `dismantleUIView` necessary in exactly these cases.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Wrapping a UIView | `UIViewRepresentable` | Bridge a single UIKit view into SwiftUI |
| Wrapping a UIViewController | `UIViewControllerRepresentable` | Bridge a whole UIKit screen/controller into SwiftUI |
| Persistent delegate/target | `Coordinator`, `makeCoordinator()` | Reference-type helper surviving representable re-creation |
| Ambient context access | `context.environment`, `context.transaction` | Read SwiftUI environment values and active animation |
| Hosting SwiftUI in UIKit | `UIHostingController` | Embed a SwiftUI view tree as a UIKit child controller |
| Cross-boundary sizing | Intrinsic content size, `sizeThatFits(in:)` | Reconcile frame-based and proposal-based layout |
| SwiftUI cell content | `UIHostingConfiguration` | Declarative cell content without manual hosting controllers |
| Two-way data flow | `@Binding` + target-action/Combine bridges | Sync UIKit control state with SwiftUI state |
| Interop cleanup | `dismantleUIView(_:coordinator:)` | Explicit teardown for resources deinit alone won't stop |
