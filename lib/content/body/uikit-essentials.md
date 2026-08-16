## 35.1 Why UIKit Still Matters in 2026

Despite SwiftUI's maturity, UIKit remains relevant for several concrete reasons: the vast majority of existing production iOS codebases are UIKit-based (and full rewrites are rarely justified purely for the framework), some fine-grained control (precise scroll performance tuning, certain custom transitions, low-level text layout) is still more directly achievable in UIKit, and SwiftUI apps frequently need to interoperate with UIKit views/controllers via `UIViewRepresentable`/`UIViewControllerRepresentable` for functionality SwiftUI doesn't yet expose natively.

```swift
// A SwiftUI app can still host UIKit content directly when needed
struct LegacyMapWrapperView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> LegacyMapViewController {
        LegacyMapViewController()
    }

    func updateUIViewController(_ uiViewController: LegacyMapViewController, context: Context) {
        // sync SwiftUI state into the UIKit controller
    }
}
```

Understanding UIKit isn't just historical knowledge — it's a practical requirement for working on the large fraction of real-world iOS codebases still built on it, and it's directly useful even in SwiftUI-first apps whenever a `UIViewControllerRepresentable`/`UIViewRepresentable` bridge is needed to embed existing or UIKit-exclusive functionality.

---

## 35.2 View Controller Lifecycle Methods

A `UIViewController` progresses through a well-defined sequence of lifecycle callbacks as its view loads, appears, and disappears — each existing for a specific purpose in setup, layout, or teardown.

```swift
class ProfileViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        // one-time setup: subviews, data source configuration
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        // runs every time the view is about to become visible
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // runs after Auto Layout has computed frames — safe to read final view sizes here
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // view is now fully visible and interactive; good place to start animations
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        // save state, stop timers, etc.
    }
}
```

`viewDidLoad()` fires exactly once, when the view hierarchy is first loaded into memory — the right place for one-time setup. `viewWillAppear`/`viewDidAppear` and their `viewWillDisappear`/`viewDidDisappear` counterparts, by contrast, can fire multiple times over a view controller's life (each time it's pushed, popped back to, presented, or dismissed), making them the right place for work that should happen every time the screen becomes visible or hidden, like refreshing data or pausing animations. `viewDidLayoutSubviews()` is specifically the point at which Auto Layout has finished computing frames, making it the correct place to read a view's final, laid-out size.

---

## 35.3 UIView Hierarchy and Frames

`UIView`s form a tree (superview/subviews) much like SwiftUI's view tree, but with an important difference: UIKit views carry explicit, mutable geometric state — `frame` (position and size in the superview's coordinate space) and `bounds` (position and size in the view's own coordinate space) — that must be managed directly or via Auto Layout, rather than being purely a function of a declarative description.

```swift
class CustomBadgeView: UIView {
    override func layoutSubviews() {
        super.layoutSubviews()
        // manually position a subview based on this view's own current bounds
        iconImageView.frame = CGRect(x: 8, y: 8, width: bounds.width - 16, height: bounds.height - 16)
    }

    private let iconImageView = UIImageView()
}
```

Unlike SwiftUI, where a view's size and position emerge from the declarative layout system with no persistent, directly-settable "frame" property to manage, a `UIView`'s `frame` is genuine mutable state that either you set directly (as in manual/programmatic layout) or that Auto Layout computes and assigns on your behalf. `layoutSubviews()` is the UIKit hook (roughly analogous to SwiftUI's layout pass) where a custom view gets the opportunity to position its own subviews based on its current `bounds`.

---

## 35.4 Programmatic Views vs. Interface Builder

UIKit UI can be built two ways: programmatically (constructing and configuring views directly in Swift code) or via Interface Builder (visually, using Storyboards or XIBs, which serialize the resulting view hierarchy to an XML-based file format loaded at runtime).

```swift
// Programmatic construction
class ProgrammaticProfileView: UIView {
    private let nameLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .headline)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    override init(frame: CGRect) {
        super.init(frame: frame)
        addSubview(nameLabel)
        NSLayoutConstraint.activate([
            nameLabel.topAnchor.constraint(equalTo: topAnchor, constant: 16),
            nameLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}
```

Programmatic UI keeps everything in version-controllable, diffable Swift source (no XML merge conflicts), and is generally preferred for teams working extensively with git and code review. Interface Builder offers a faster, more visual iteration loop for laying out complex screens and is still commonly found in legacy codebases and smaller/solo projects — but its serialized XML format is notoriously difficult to meaningfully diff or merge across branches, which is the primary reason many teams have moved away from it for larger, collaborative projects.

---

## 35.5 Storyboards and Segues — Reading Legacy Code

A Storyboard is an Interface Builder file describing multiple connected view controller scenes, with segues representing the transitions between them — understanding how to read this legacy structure is essential for maintaining existing UIKit codebases, even if new development favors programmatic navigation.

```swift
class LegacyListViewController: UITableViewController {
    override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
        if segue.identifier == "showDetail",
           let detailVC = segue.destination as? DetailViewController,
           let selectedRow = tableView.indexPathForSelectedRow {
            detailVC.item = items[selectedRow.row]
        }
    }
}
```

`prepare(for:sender:)` is the standard hook for passing data to a segue's destination view controller just before the transition occurs — the segue's `identifier` (set in Interface Builder) is checked to determine which specific transition is firing, since one view controller can have several outgoing segues to different destinations. Reading legacy storyboard-driven code means understanding this pattern: rather than direct, code-driven navigation calls, transitions are declared visually in the storyboard and configured just-in-time via `prepare(for:sender:)`.

---

## 35.6 XIBs and View Loading

A XIB (`.xib`) is Interface Builder's format for a single, standalone view or view controller (as opposed to a Storyboard's multiple connected scenes) — commonly used for reusable custom views or table/collection view cells.

```swift
class CustomCardCell: UICollectionViewCell {
    static let reuseIdentifier = "CustomCardCell"

    static func nib() -> UINib {
        UINib(nibName: "CustomCardCell", bundle: nil)
    }

    @IBOutlet weak var titleLabel: UILabel!
}

// Registration:
collectionView.register(CustomCardCell.nib(), forCellWithReuseIdentifier: CustomCardCell.reuseIdentifier)
```

`@IBOutlet` marks a property as connected to a specific view within the XIB file (wired up visually in Interface Builder), populated automatically when the XIB is loaded. `UINib` is the runtime representation of a loaded XIB file, and registering it with a table/collection view (rather than registering a plain class) tells the view to instantiate cells by loading this XIB's view hierarchy each time a new cell is needed, rather than constructing the cell purely from code.

---

## 35.7 The Delegate Pattern

The delegate pattern is UIKit's dominant mechanism for one object to hand off decisions or notifications to another, customizable object — implemented via a protocol that a delegate object conforms to, and a weak reference held by the delegating object.

```swift
protocol TemperatureSliderDelegate: AnyObject {
    func temperatureSlider(_ slider: TemperatureSlider, didChangeTo value: Double)
}

class TemperatureSlider: UIView {
    weak var delegate: TemperatureSliderDelegate?

    private func handleValueChanged(_ newValue: Double) {
        delegate?.temperatureSlider(self, didChangeTo: newValue)
    }
}

class WeatherViewController: UIViewController, TemperatureSliderDelegate {
    func temperatureSlider(_ slider: TemperatureSlider, didChangeTo value: Double) {
        // respond to the change
    }
}
```

The delegate reference is deliberately `weak` to avoid a retain cycle — the delegating object (`TemperatureSlider`) doesn't own its delegate, since ownership typically flows the other direction (a view controller owns and configures the views it uses). This pattern appears throughout UIKit itself: `UITableViewDelegate`, `UIScrollViewDelegate`, `UITextFieldDelegate`, and dozens more — understanding it is foundational to reading and writing idiomatic UIKit code, and it's the direct conceptual ancestor of patterns like SwiftUI's closure-based callbacks (`onTapGesture { }`, `.onChange(of:)`), just implemented via protocol conformance instead.

---

## 35.8 Target-Action and @IBAction

Target-action is UIKit's mechanism for connecting a control (like `UIButton`) to a specific method on a specific object, triggered when a particular event (like `.touchUpInside`) occurs — the direct ancestor of SwiftUI's `Button { action }` closure syntax.

```swift
class SettingsViewController: UIViewController {
    private let saveButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        saveButton.addTarget(self, action: #selector(saveButtonTapped), for: .touchUpInside)
    }

    @objc private func saveButtonTapped() {
        // handle the tap
    }

    @IBAction private func cancelButtonTapped(_ sender: UIButton) {
        // this variant connects to a control wired up in Interface Builder
    }
}
```

`addTarget(_:action:for:)` registers a `target` object and an `action` selector (referenced via `#selector()`) to be invoked when the specified `UIControl.Event` fires — the `@objc` attribute is required since selectors rely on the Objective-C runtime's dynamic method dispatch. `@IBAction` marks a method as connectable from Interface Builder specifically, letting a XIB/Storyboard-defined control's event wire directly to that method visually, without needing a manual `addTarget()` call in code.

---

## 35.9 The Responder Chain

The responder chain is UIKit's mechanism for routing events (touches, motion, and specific actions like copy/paste) through a hierarchy of `UIResponder` objects, each of which can either handle the event or pass it along to its "next responder" if it declines.

```swift
class CustomInputView: UIView {
    override func copy(_ sender: Any?) {
        // handle a Copy command if this view is first responder
        UIPasteboard.general.string = "Custom content"
    }

    override var canBecomeFirstResponder: Bool { true }
}
```

When an event occurs, UIKit starts with the current "first responder" (often whatever the user directly interacted with, like a focused text field) and walks up through `next` (typically view → superview → ... → view controller → window → app) until some responder handles it or the chain is exhausted. This is precisely the mechanism behind features like "Edit > Copy" working correctly regardless of which specific view currently has focus — each responder in the chain gets an opportunity to handle the `copy(_:)` action before it's given up on entirely, conceptually similar to how SwiftUI's `@FocusState` (sections 28.15, 33.9) directs input to a specific active element, but implemented as an explicit, walkable object chain rather than a bound state value.

---

## 35.10 Gesture Recognizers

`UIGestureRecognizer` subclasses (`UITapGestureRecognizer`, `UIPanGestureRecognizer`, `UIPinchGestureRecognizer`, and others) attach reusable, stateful gesture-detection logic to a view, abstracting away the raw touch-tracking logic that recognizing a "tap" or "swipe" would otherwise require.

```swift
class InteractiveCardView: UIView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        addGestureRecognizer(panGesture)
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: self)
        switch gesture.state {
        case .changed:
            transform = CGAffineTransform(translationX: translation.x, y: translation.y)
        case .ended, .cancelled:
            UIView.animate(withDuration: 0.3) { self.transform = .identity }
        default:
            break
        }
    }

    required init?(coder: NSCoder) { fatalError() }
}
```

Gesture recognizers report their progress through a well-defined state machine (`.began`, `.changed`, `.ended`, `.cancelled`, etc.), letting handler code respond appropriately at each phase — here, continuously updating the view's `transform` while the pan is in progress (`.changed`), and animating back to the identity transform once released. This same target-action wiring (35.8) is used to connect a gesture recognizer's state changes to a handler method, and this whole mechanism is the direct ancestor of SwiftUI's higher-level gesture modifiers like `.gesture(DragGesture())`.

---

## 35.11 Gesture Recognizer Conflicts and Dependencies 🟠

When multiple gesture recognizers are attached to overlapping views (like a pan gesture on a card sitting inside a scroll view with its own pan gesture), UIKit needs explicit guidance on how they should interact — handled via delegate methods and explicit dependency declarations.

```swift
class ConflictAwareCardView: UIView, UIGestureRecognizerDelegate {
    let panGesture = UIPanGestureRecognizer()

    override init(frame: CGRect) {
        super.init(frame: frame)
        panGesture.delegate = self
        addGestureRecognizer(panGesture)
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        true // allow both this pan and, say, a parent scroll view's pan to recognize together
    }

    required init?(coder: NSCoder) { fatalError() }
}
```

By default, UIKit's gesture recognizers are mutually exclusive — the first one to definitively recognize its gesture typically "wins" and cancels the others. `shouldRecognizeSimultaneouslyWith` (a `UIGestureRecognizerDelegate` method) explicitly permits two recognizers to both fire concurrently when that's the desired behavior. `require(toFail:)` is another common tool here, explicitly declaring that one recognizer should only succeed after a specific other one has definitively failed — useful for disambiguating, for instance, a single-tap gesture from a double-tap gesture attached to the same view, where the single-tap should only fire once it's clear a second tap isn't coming.

---

## 35.12 View Controller Containment

Containment lets one "parent" view controller embed and manage one or more "child" view controllers as reusable, self-contained units — the mechanism underlying built-in container controllers like `UINavigationController` and `UITabBarController`, and available for building custom containers too.

```swift
class DashboardViewController: UIViewController {
    private let summaryVC = SummaryViewController()

    override func viewDidLoad() {
        super.viewDidLoad()
        addChild(summaryVC)
        view.addSubview(summaryVC.view)
        summaryVC.view.frame = view.bounds
        summaryVC.didMove(toParent: self)
    }
}
```

The containment protocol requires a specific sequence: `addChild(_:)` establishes the parent-child relationship, the child's `view` is added to the parent's view hierarchy directly, and `didMove(toParent:)` is called last to notify the child that the transition is complete (with a corresponding `willMove(toParent:)` and `removeFromParent()` pair for removal). Getting this sequence right matters because the child view controller's own lifecycle callbacks (35.2) — like `viewWillAppear`/`viewDidAppear` — are driven correctly by this containment machinery, not simply by the child's view becoming visible on screen.

---

## 35.13 Custom View Controller Transitions 🟠

Beyond the default push/pop and present/dismiss animations, UIKit supports fully custom transition animations between view controllers via the `UIViewControllerAnimatedTransitioning` protocol, giving complete control over how one screen visually becomes another.

```swift
class FadeTransition: NSObject, UIViewControllerAnimatedTransitioning {
    func transitionDuration(using transitionContext: UIViewControllerContextTransitioning?) -> TimeInterval {
        0.3
    }

    func animateTransition(using transitionContext: UIViewControllerContextTransitioning) {
        guard let toView = transitionContext.view(forKey: .to) else { return }
        let containerView = transitionContext.containerView
        containerView.addSubview(toView)
        toView.alpha = 0
        UIView.animate(withDuration: transitionDuration(using: transitionContext), animations: {
            toView.alpha = 1
        }, completion: { finished in
            transitionContext.completeTransition(finished)
        })
    }
}
```

A custom transition object implements `transitionDuration(using:)` and `animateTransition(using:)`, manipulating the incoming/outgoing view controllers' views (obtained via the `transitionContext`) directly to produce whatever visual effect is desired — here, a simple crossfade. Critically, `transitionContext.completeTransition(_:)` must be called when the animation finishes, telling UIKit the transition is genuinely done and it's safe to fully install the new view controller — omitting this call leaves the transition system in a broken, indefinitely-suspended state.

---

## 35.14 UIScene and Multi-Window on iPad 🟠

`UIScene` (and its `UISceneDelegate`) represents one instance of an app's UI — on iPad, an app can have multiple scenes (multiple independent windows) open simultaneously, each with its own `UIScene` instance and lifecycle, coordinated by a `UISceneSession`.

```swift
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = RootViewController()
        self.window = window
        window.makeKeyAndVisible()
    }
}
```

Before `UIScene` was introduced, `UIApplicationDelegate` managed a single implicit window for the entire app — `UIScene`'s introduction decoupled "the app" from "a specific window," enabling genuine multi-window support. `scene(_:willConnectTo:options:)` is where a new scene's window and initial root view controller get set up, analogous in purpose to `SwiftUI`'s `WindowGroup`/`Window` scene declarations (section 33.3) but implemented through UIKit's explicit delegate-based scene lifecycle rather than a declarative `Scene` body.

---

## 35.15 Trait Collections and registerForTraitChanges

A `UITraitCollection` bundles together a set of environmental characteristics (size class, display scale, user interface style/dark mode, and more) describing the context a view or view controller is currently rendering in — conceptually parallel to SwiftUI's `@Environment` values, and `registerForTraitChanges` is the modern API for reacting when any of these change.

```swift
class ThemedViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (self: Self, previousTraitCollection: UITraitCollection) in
            self.updateAppearance(for: self.traitCollection.userInterfaceStyle)
        }
    }

    private func updateAppearance(for style: UIUserInterfaceStyle) {
        // adjust colors/assets for light/dark mode
    }
}
```

`registerForTraitChanges` accepts a list of specific trait types to observe (like `UITraitUserInterfaceStyle` for light/dark mode) and a handler closure invoked whenever any of those specific traits change — a more targeted, modern replacement for the older, broader `traitCollectionDidChange(_:)` override, which fired for *any* trait change and required manually checking which one actually changed. This granular registration approach mirrors how SwiftUI's `@Environment` lets a view read only the specific environment values it actually depends on, rather than being broadly notified of every possible environmental change.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| UIKit's continued relevance | `UIViewControllerRepresentable` | Interop bridge from SwiftUI to UIKit |
| View controller lifecycle | `viewDidLoad`, `viewWillAppear`, etc. | Setup, appearance, and teardown hooks |
| View geometry | `frame`, `bounds`, `layoutSubviews()` | Explicit, mutable view positioning |
| Programmatic UI | Direct view construction in code | Diffable, git-friendly UI definition |
| Legacy visual UI | Storyboards, segues, `prepare(for:)` | Reading and maintaining existing IB-based code |
| Reusable IB views | XIBs, `@IBOutlet`, `UINib` | Standalone view/cell definitions |
| Delegation | `weak` delegate + protocol | Customizable one-to-one object communication |
| Control events | Target-action, `@IBAction`, `#selector()` | Connect controls to specific handler methods |
| Event routing | Responder chain, `UIResponder` | Walk up the hierarchy until an event is handled |
| Gesture detection | `UIGestureRecognizer` subclasses | Reusable, stateful gesture recognition |
| Gesture coexistence | `UIGestureRecognizerDelegate` | Resolve conflicts between overlapping recognizers |
| Embedding controllers | `addChild()`, `didMove(toParent:)` | Compose reusable child view controllers |
| Custom transitions | `UIViewControllerAnimatedTransitioning` | Fully custom screen-to-screen animations |
| Multi-window | `UIScene`, `UISceneDelegate` | Independent windows on iPad |
| Environmental context | `UITraitCollection`, `registerForTraitChanges` | React to size class, appearance, and other traits |
