**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Real apps often **mix** UIKit and SwiftUI. You might use a UIKit-only control inside a SwiftUI screen, or add new SwiftUI screens to an old UIKit app. Apple gives you bridges in **both** directions:

| Direction | Tool |
|---|---|
| UIKit **view** inside SwiftUI | `UIViewRepresentable` |
| UIKit **view controller** inside SwiftUI | `UIViewControllerRepresentable` |
| SwiftUI **screen** inside UIKit | `UIHostingController` |
| SwiftUI **cell content** inside UIKit lists | `UIHostingConfiguration` |

The hard part isn't the wrapping; it's moving **data** and **events** across the boundary. That's what most of this section is about.

---

## 38.1 UIViewRepresentable Basics 🟢

**`UIViewRepresentable`** wraps a **`UIView`** so you can use it like a SwiftUI view. You write **two** methods:

```swift
struct ActivityIndicatorView: UIViewRepresentable {
    var isAnimating: Bool

    // ONCE: create and configure the UIKit view
    func makeUIView(context: Context) -> UIActivityIndicatorView {
        let indicator = UIActivityIndicatorView(style: .medium)
        indicator.hidesWhenStopped = true
        return indicator
    }

    // MANY TIMES: make the UIKit view match the current SwiftUI values
    func updateUIView(_ uiView: UIActivityIndicatorView, context: Context) {
        if isAnimating {
            uiView.startAnimating()
        } else {
            uiView.stopAnimating()
        }
    }
}

// Use it like any SwiftUI view
ActivityIndicatorView(isAnimating: isLoading)
```

| Method | Runs | Job |
|---|---|---|
| `makeUIView(context:)` | **Once**, when the view first appears | Create the `UIView`; one-time setup |
| `updateUIView(_:context:)` | Every time SwiftUI **updates** this view | Copy the current values **into** the `UIView` |

The representable **struct** is like any SwiftUI view: a **cheap value**, recreated often. The **`UIView`** it makes is a **long-lived object** that SwiftUI keeps for you.

Why does `updateUIView` run **many** times? Because whenever an **input** changes (here, `isAnimating`), SwiftUI makes a **new** struct and calls `updateUIView`, so you can bring the **existing** UIKit object in line. It's like `body` running again, but instead of returning a new description, you **change** an object.

⚠️ `updateUIView` can run even when **nothing** you care about changed. Keep it **cheap**, and only change what's different:

```swift
func updateUIView(_ uiView: UILabel, context: Context) {
    if uiView.text != text {           // avoid needless work (and resetting things like the cursor)
        uiView.text = text
    }
}
```

---

## 38.2 UIViewControllerRepresentable Basics 🟢

**`UIViewControllerRepresentable`** wraps a whole **`UIViewController`**. Use it when the UIKit API gives you a **view controller**, not a view: a Safari view, a mail composer, a document scanner, or an old screen of your own app.

```swift
import SafariServices

struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {
        // nothing to update: Safari view controllers can't change their URL
    }
}

// Show it in a sheet
.sheet(isPresented: $showHelp) {
    SafariView(url: URL(string: "https://example.com/help")!)
}
```

It works **exactly** like `UIViewRepresentable`, with `makeUIViewController` and `updateUIViewController`.

| Use | When the UIKit side is |
|---|---|
| `UIViewRepresentable` | A **view**: `MKMapView`, `UITextView`, a custom `UIView` |
| `UIViewControllerRepresentable` | A **view controller**: `SFSafariViewController`, `PHPickerViewController`, a legacy screen |

The choice is simple: wrap **whatever the API gives you**. A view controller brings its **own lifecycle** (35.2) and often presents its own UI, so it must stay a controller.

---

## 38.3 The Coordinator Pattern 🟡

UIKit objects talk back through **delegates** and **target-action** (35.7, 35.8). These need a **long-lived object** to call. But the representable **struct** is recreated all the time, and a struct can't be a weak delegate anyway. The fix is a **`Coordinator`**: a small **class** that SwiftUI creates **once** and keeps.

```swift
import VisionKit

struct ScannerContainerView: UIViewControllerRepresentable {
    @Binding var scannedPages: Int
    @Environment(\.dismiss) private var dismiss

    // 1. Create the coordinator (once, before makeUIViewController)
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    // 2. Hook it up as the delegate
    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let scanner = VNDocumentCameraViewController()
        scanner.delegate = context.coordinator
        return scanner
    }

    // 3. Keep the coordinator's copy of the struct fresh
    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {
        context.coordinator.parent = self
    }

    final class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        var parent: ScannerContainerView

        init(_ parent: ScannerContainerView) {
            self.parent = parent
        }

        // UIKit calls this; we push the result into SwiftUI state
        func documentCameraViewController(_ controller: VNDocumentCameraViewController,
                                          didFinishWith scan: VNDocumentCameraScan) {
            parent.scannedPages = scan.pageCount      // writes through the @Binding
            parent.dismiss()
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            parent.dismiss()
        }
    }
}
```

The order of calls:

1. **`makeCoordinator()`**: **once**, **before** `makeUIView`/`makeUIViewController`. SwiftUI stores the result for the whole life of the view.
2. **`make…`**: once; `context.coordinator` is ready to use.
3. **`update…`**: many times; same coordinator each time.

The coordinator is the home for everything that needs **identity**: delegate methods, `@objc` action methods, observers, timers.

It holds a **`parent`** copy of the struct, to reach its **bindings** and **closures**. A binding keeps working even from an old copy (it points at the real state), but **other** values (like closures or plain `let`s) can be **stale**. That's why step 3 refreshes `parent` in `update…`: a small habit that prevents confusing bugs.

---

## 38.4 Context and Environment Access 🟡

Every representable method gets a **`context`**. It carries three things:

| Property | What it is |
|---|---|
| `context.coordinator` | Your coordinator (38.3) |
| `context.environment` | The SwiftUI **environment** at this point in the tree |
| `context.transaction` | The current **transaction**, including its **animation** (29.14) |

```swift
struct StyledTextView: UIViewRepresentable {
    var text: String

    func makeUIView(context: Context) -> UITextView {
        let textView = UITextView()
        textView.font = .preferredFont(forTextStyle: .body)
        textView.adjustsFontForContentSizeCategory = true      // follows Dynamic Type
        return textView
    }

    func updateUIView(_ uiView: UITextView, context: Context) {
        if uiView.text != text { uiView.text = text }

        uiView.isEditable = context.environment.isEnabled      // follows .disabled(...) from SwiftUI
        uiView.backgroundColor = context.environment.colorScheme == .dark
            ? .secondarySystemBackground
            : .systemBackground
    }
}

// The SwiftUI side controls it like any other view:
StyledTextView(text: notes)
    .disabled(isLocked)
```

**`context.environment`** gives the representable the **same** values a normal view gets with `@Environment` (25.6): `isEnabled`, `colorScheme`, `locale`, `dynamicTypeSize`, your own `@Entry` values, and more. So the UIKit view can follow `.disabled()`, dark mode, or a custom theme, **without** extra properties.

**`context.transaction.animation`** tells you whether the current change is **animated**. From iOS 18, you can run UIKit changes **with the same SwiftUI animation**, so both sides move together:

```swift
func updateUIView(_ uiView: GaugeUIView, context: Context) {
    context.animate {                       // iOS 18: uses the transaction's animation, if any
        uiView.needleAngle = angle          // animates in sync with the SwiftUI views around it
    }
}
```

---

## 38.5 Hosting SwiftUI Inside UIKit with UIHostingController 🟢

The other direction: **`UIHostingController`** puts a **SwiftUI view** inside a UIKit app. It **is** a `UIViewController`, so you use it like any other one:

```swift
// As a whole screen: push or present it
let profileScreen = UIHostingController(rootView: ProfileView(user: currentUser))
navigationController?.pushViewController(profileScreen, animated: true)
```

To show SwiftUI as **part** of a UIKit screen, add it as a **child** view controller, with the containment steps from 35.12:

```swift
class LegacyProfileViewController: UIViewController {
    private var hostingController: UIHostingController<ProfileSummaryView>!

    override func viewDidLoad() {
        super.viewDidLoad()

        hostingController = UIHostingController(rootView: ProfileSummaryView(user: currentUser))

        addChild(hostingController)                                 // 1
        view.addSubview(hostingController.view)                     // 2
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        hostingController.didMove(toParent: self)                   // 3
    }

    func userDidChange(_ user: User) {
        hostingController.rootView = ProfileSummaryView(user: user)  // update the SwiftUI content
    }
}
```

Skipping `addChild`/`didMove` makes the SwiftUI view show up, but things like **safe area**, **trait changes**, and **lifecycle** events won't work right (35.12).

There are **two** ways to update the content later:

1. **Replace `rootView`** with a new view value, as above. SwiftUI **diffs** it and updates only what changed.
2. **Share a model.** Pass an **`@Observable`** object into the SwiftUI view. When UIKit code changes the model, the SwiftUI view **updates by itself**:

```swift
@Observable final class ProfileModel {
    var user: User
    init(user: User) { self.user = user }
}

let model = ProfileModel(user: currentUser)
let host = UIHostingController(rootView: ProfileSummaryView(model: model))
// later, anywhere in UIKit:
model.user = updatedUser          // the SwiftUI view redraws automatically
```

The shared-model way is usually **cleaner** for screens that change often.

---

## 38.6 Sizing and Layout Across the Boundary 🟡

UIKit lays out with **frames and constraints** (35.3, 36); SwiftUI with **proposals** (24.8). At the boundary, each side needs to **understand** the other's size.

**UIKit view inside SwiftUI.** SwiftUI asks the `UIView` for its **intrinsic content size**, and respects its **hugging** and **compression resistance** (36.5). Views without a natural size (like a chart or a map) take **all** the offered space, so give them a frame:

```swift
FixedHeightChart()
    .frame(height: 220)      // a UIKit view with no intrinsic height needs a size hint
```

From iOS 16, you can answer the size question **yourself**, with **`sizeThatFits`** on the representable. This is perfect for a wrapped **multi-line label**, which needs to know the **width** to compute its **height**:

```swift
struct WrappingLabel: UIViewRepresentable {
    var text: String

    func makeUIView(context: Context) -> UILabel {
        let label = UILabel()
        label.numberOfLines = 0
        return label
    }

    func updateUIView(_ uiView: UILabel, context: Context) {
        uiView.text = text
    }

    // SwiftUI asks: "for this proposed width, how big are you?"
    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UILabel, context: Context) -> CGSize? {
        let width = proposal.width ?? .greatestFiniteMagnitude
        return uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
    }
}
```

**SwiftUI inside UIKit.** A `UIHostingController` can **report** its SwiftUI content's size to UIKit. Turn it on with **`sizingOptions`** (iOS 16):

```swift
let host = UIHostingController(rootView: BadgeView(count: 3))
host.sizingOptions = .intrinsicContentSize     // the hosted view gets a real intrinsic size for Auto Layout
// or .preferredContentSize: useful for popovers and sheets that size to fit

// You can also ask directly:
let size = host.sizeThatFits(in: CGSize(width: 300, height: CGFloat.greatestFiniteMagnitude))
```

With `.intrinsicContentSize`, you can put the hosting controller's view in a **stack view** or pin only its **top and leading** edges, and Auto Layout sizes it to fit the SwiftUI content, just like a `UILabel`. It updates when the SwiftUI content changes size.

---

## 38.7 UIHostingConfiguration for Cells 🟢

**`UIHostingConfiguration`** (iOS 16) lets a table or collection view **cell** (37.2) show **SwiftUI** content. No hosting controller, no containment code:

```swift
class ModernFeedViewController: UITableViewController {
    var items: [FeedItem] = []

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        let item = items[indexPath.row]

        cell.contentConfiguration = UIHostingConfiguration {
            FeedItemRow(item: item)                 // any SwiftUI view
        }
        .margins(.horizontal, 16)                   // cell padding

        return cell
    }
}
```

What you get:

- The cell is still a **normal** UIKit cell, in the normal **reuse** pool. UIKit handles the hosting **inside** it.
- Cells **self-size** to the SwiftUI content automatically (37.3).
- Swipe actions, selection, and the rest of the table/collection view features keep working.

Why it beats putting a `UIHostingController` in each cell by hand:

| Hosting controller per cell | `UIHostingConfiguration` |
|---|---|
| Containment code in every cell (`addChild`…), and you need the parent view controller | One line |
| Easy to leak or mis-handle on reuse | Reuse handled for you |
| Manual sizing | Self-sizing built in |

It's a great way to **migrate** gradually: keep the UIKit list (and its proven scrolling, prefetching, and editing), and write each **row** in SwiftUI.

You can react to the **cell's state** (selected, highlighted, editing) inside the SwiftUI content:

```swift
cell.configurationUpdateHandler = { cell, state in
    cell.contentConfiguration = UIHostingConfiguration {
        FeedItemRow(item: item, isSelected: state.isSelected)
    }
}
```

---

## 38.8 Data Flow: Bindings, Closures, and Combine Bridges 🟡

Crossing the boundary means **translating** UIKit's delegates and target-action into SwiftUI's **bindings** and **closures**. The coordinator is the translator:

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
        slider.addTarget(context.coordinator, action: #selector(Coordinator.editingEnded),
                         for: [.touchUpInside, .touchUpOutside])
        return slider
    }

    // SwiftUI → UIKit
    func updateUIView(_ uiView: UISlider, context: Context) {
        context.coordinator.value = $value                      // keep the binding fresh
        context.coordinator.onEditingChanged = onEditingChanged
        if uiView.value != Float(value) {
            uiView.value = Float(value)                          // only when it really differs
        }
    }

    // UIKit → SwiftUI
    final class Coordinator: NSObject {
        var value: Binding<Double>
        var onEditingChanged: (Bool) -> Void

        init(value: Binding<Double>, onEditingChanged: @escaping (Bool) -> Void) {
            self.value = value
            self.onEditingChanged = onEditingChanged
        }

        @objc func valueChanged(_ sender: UISlider) {
            value.wrappedValue = Double(sender.value)            // writes the SwiftUI state
        }

        @objc func editingEnded(_ sender: UISlider) {
            onEditingChanged(false)
        }
    }
}
```

The two directions:

| Direction | Where | How |
|---|---|---|
| SwiftUI → UIKit | `updateUIView` | Copy the current values into the UIKit object |
| UIKit → SwiftUI | Coordinator (delegate / action) | Write to a `@Binding`, or call a closure |

This gives the same **two-way** behavior as SwiftUI's own `Slider(value:)`.

Watch out for **loops**: UIKit changes the value → the binding updates → SwiftUI calls `updateUIView` → which sets the UIKit value again → which might fire the event again. The `if uiView.value != Float(value)` check stops that.

For **richer** or **continuous** data, the coordinator can also hold **subscriptions**: Combine publishers (22.9) or an `AsyncSequence` task (21), for example `NotificationCenter` notifications or a UIKit object's `@Published` properties. It forwards the values into a binding or an `@Observable` model. Store the subscriptions in the coordinator, and cancel them when the view goes away (38.9).

```swift
final class Coordinator: NSObject {
    var cancellables = Set<AnyCancellable>()

    func observeKeyboard(update: @escaping (CGFloat) -> Void) {
        NotificationCenter.default.publisher(for: UIResponder.keyboardWillChangeFrameNotification)
            .compactMap { ($0.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect)?.height }
            .sink(receiveValue: update)
            .store(in: &cancellables)
    }
}
```

---

## 38.9 Dismantling and Lifecycle Cleanup 🔴

When a representable's view is **removed** from the SwiftUI tree for good, SwiftUI calls the optional **`dismantleUIView(_:coordinator:)`** (or `dismantleUIViewController`). It's the place for cleanup that **normal deallocation can't do**:

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

    // Called once, when the view leaves the hierarchy
    static func dismantleUIView(_ uiView: VisualizerUIView, coordinator: Coordinator) {
        coordinator.stopObserving()
    }

    final class Coordinator: NSObject {
        private var displayLink: CADisplayLink?
        private weak var view: VisualizerUIView?

        func startObserving(_ view: VisualizerUIView) {
            self.view = view
            displayLink = CADisplayLink(target: self, selector: #selector(tick))
            displayLink?.add(to: .main, forMode: .common)
        }

        func stopObserving() {
            displayLink?.invalidate()          // stops it AND releases its strong hold on the coordinator
            displayLink = nil
        }

        @objc private func tick() {
            view?.setNeedsDisplay()            // redraw each frame
        }
    }
}
```

**Why is it `static`?** The representable **struct** is a short-lived value. By the time the view is dismantled, the struct that **created** it may be long gone. So SwiftUI doesn't call it on an instance (`self`); it passes in **exactly** what you need: the outgoing **view** and **coordinator**.

**Why isn't `deinit` enough?** Some resources **keep themselves alive**:

- A **`CADisplayLink`** holds a **strong** reference to its **target** (the coordinator), and the run loop holds the display link. So the coordinator is **never freed**, and its `deinit` never runs. The link keeps firing **forever**, until someone calls **`invalidate()`**.
- The same goes for a repeating **`Timer`** with a target, and for **system services** you started (a camera session, location updates, audio, a `KVO` observation in old code): they run until you **stop** them.

`dismantleUIView` is the **explicit stop** call that breaks these loops. If your coordinator only holds plain data and weak references, you **don't need it**: normal deallocation is enough.

Taken together, these tools let you **mix** the frameworks **gradually**: wrap UIKit pieces that SwiftUI lacks, and add SwiftUI screens and rows to a UIKit app, one step at a time, without a big rewrite.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Wrapping a UIView | `UIViewRepresentable` | `make` once, `update` many times |
| Wrapping a UIViewController | `UIViewControllerRepresentable` | Wrap what the API gives you: a controller |
| Persistent delegate/target | `Coordinator`, `makeCoordinator()` | A long-lived class for delegates and actions; refresh `parent` |
| Ambient context access | `context.environment`, `context.transaction`, `context.animate` | Follow SwiftUI's environment and animations |
| Hosting SwiftUI in UIKit | `UIHostingController` | A view controller with SwiftUI inside; update `rootView` or share a model |
| Cross-boundary sizing | Intrinsic size, `sizeThatFits`, `sizingOptions` | Each side reports its size to the other |
| SwiftUI cell content | `UIHostingConfiguration` | SwiftUI rows in UIKit lists, with reuse and self-sizing |
| Two-way data flow | Bindings, closures, Combine in the coordinator | `update` pushes in; coordinator pushes out; avoid loops |
| Interop cleanup | `dismantleUIView(_:coordinator:)` | Stop display links, timers, and services that keep themselves alive |
