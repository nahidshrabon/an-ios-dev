**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**UIKit** is Apple's older UI framework, used since the first iPhone SDK. It's **imperative**: you create view **objects**, change them over time, and react to events through **delegates** and **actions**. Even in a SwiftUI-first world, you'll meet it in existing apps, in interop (38), and in its many ideas that SwiftUI grew from. This section covers the core pieces.

---

## 35.1 Why UIKit Still Matters in 2026 🟢

SwiftUI is mature, but UIKit is still **everywhere**:

1. **Existing apps.** Most large production iOS apps have years of UIKit code. Full rewrites are **rarely** worth it, so teams **mix** both.
2. **Fine control.** Some things are still more direct in UIKit: very tuned scrolling and cell reuse, advanced text layout (TextKit), some custom transitions.
3. **Missing pieces.** SwiftUI apps sometimes need a UIKit-only view or controller. You wrap it with **`UIViewRepresentable`** or **`UIViewControllerRepresentable`** (38).

```swift
// A SwiftUI app can host UIKit content when needed
struct LegacyMapWrapperView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> LegacyMapViewController {
        LegacyMapViewController()
    }

    func updateUIViewController(_ uiViewController: LegacyMapViewController, context: Context) {
        // copy SwiftUI state into the UIKit controller
    }
}
```

| | UIKit | SwiftUI |
|---|---|---|
| Style | **Imperative**: create objects, then change them | **Declarative**: describe the UI for the current state |
| Views | Long-lived **objects** (`UIView`) | Short-lived **values** (`View` structs) |
| Updates | You update views yourself | SwiftUI updates them from state |
| Events | Delegates, target-action, closures | Closures and bindings |

Knowing UIKit is a **practical** skill: you'll read it, maintain it, and bridge to it.

---

## 35.2 View Controller Lifecycle Methods 🟢

A **`UIViewController`** manages **one screen** (or part of one). UIKit calls its **lifecycle methods** in a fixed order as its view loads, appears, and disappears:

```swift
class ProfileViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        // ONCE: create subviews, set up constraints, configure data sources
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        // EVERY TIME the screen is about to show: refresh data
    }

    override func viewIsAppearing(_ animated: Bool) {
        super.viewIsAppearing(animated)
        // every time, with the final size and traits known: update UI that depends on them
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // after Auto Layout set the frames: final sizes are known here (may run MANY times)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // fully on screen: start animations, log "screen viewed"
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        // about to leave: save drafts, stop timers
    }
}
```

| Method | How often | Use for |
|---|---|---|
| `viewDidLoad` | **Once** per controller | One-time setup |
| `viewWillAppear` | Each time it's about to show | Refreshing data |
| `viewIsAppearing` (iOS 17, back-deployed to 13) | Each time, after size and traits are set | Layout-dependent setup on appear |
| `viewDidLayoutSubviews` | After **every** layout pass | Reading final frames |
| `viewDidAppear` | Each time it's fully visible | Animations, analytics |
| `viewWillDisappear` / `viewDidDisappear` | Each time it hides | Saving, pausing |

**Appear and disappear** methods can run **many times**: each push, pop back, present, or dismiss. **`viewDidLoad`** runs **once**.

⚠️ In `viewDidLoad`, the view's **size isn't final** yet. Don't read `view.bounds` there to size things. Use constraints, or read sizes in `viewDidLayoutSubviews` (which can run often, so keep it light).

Always call **`super`** in these overrides. UIKit's own logic depends on it.

---

## 35.3 UIView Hierarchy and Frames 🟢

`UIView`s form a **tree**: each view has a **superview** and **subviews**, like SwiftUI's view tree. The big difference: a `UIView` has **stored, changeable geometry**:

- **`frame`**: its position and size in its **superview's** coordinates.
- **`bounds`**: its size (and origin) in its **own** coordinates. Usually starts at `(0, 0)`.

```swift
class CustomBadgeView: UIView {
    private let iconImageView = UIImageView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        addSubview(iconImageView)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        // place the subview based on THIS view's current size
        iconImageView.frame = bounds.insetBy(dx: 8, dy: 8)
    }
}
```

A quick example of the difference:

```swift
let card = UIView(frame: CGRect(x: 20, y: 100, width: 200, height: 120))
card.frame    // (20, 100, 200, 120): where it is in its parent
card.bounds   // (0, 0, 200, 120): its own space; subviews use these coordinates
```

In SwiftUI, a view has **no frame you store**; size and position come from the layout pass (24.8). In UIKit, the frame is **real state**. Either **you** set it (manual layout, as above), or **Auto Layout** computes and sets it from constraints (36).

**`layoutSubviews()`** is UIKit's layout hook: it runs when the view's size changes, and is where a custom view **positions its children**. Never call it directly; call **`setNeedsLayout()`** to ask UIKit to run it on the next update.

From iOS 26 (and iOS 18 with an Info.plist opt-in), UIKit also **tracks `@Observable` properties** read in `layoutSubviews()` and similar methods, and re-runs them when those properties change, much like SwiftUI does.

---

## 35.4 Programmatic Views vs. Interface Builder 🟢

You can build UIKit UI in **two** ways:

- **Programmatically**: create and configure views in **Swift code**.
- **Interface Builder** (IB): design visually in Xcode, saved as **Storyboards** or **XIBs** (XML files loaded at run time).

```swift
// Programmatic construction
class ProgrammaticProfileView: UIView {
    private let nameLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .headline)    // supports Dynamic Type
        label.adjustsFontForContentSizeCategory = true
        label.translatesAutoresizingMaskIntoConstraints = false // we'll use Auto Layout
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

| | Programmatic | Interface Builder |
|---|---|---|
| Where the UI lives | Swift files | XML (`.storyboard`, `.xib`) |
| Code review and diffs | Easy to read | XML diffs are hard to read |
| Merge conflicts | Rare, easy to fix | Common, painful |
| Seeing the layout | Previews (below) or run the app | Visual canvas |
| Reuse and parameters | Easy (normal Swift) | Limited |

Most teams today prefer **programmatic** UIKit, mainly because of **git**: storyboard XML is hard to review and merge. IB is still common in **older** codebases and small projects.

You also get **live previews** for UIKit, with the same `#Preview` macro as SwiftUI (iOS 17):

```swift
#Preview {
    ProfileViewController()      // a view controller
}

#Preview("Badge", traits: .sizeThatFitsLayout) {
    CustomBadgeView()            // or a single UIView
}
```

---

## 35.5 Storyboards and Segues — Reading Legacy Code 🟢

A **Storyboard** holds **several screens** (scenes) and the **segues** (arrows) between them. New code rarely uses them, but you'll **read** them in existing apps.

```swift
class LegacyListViewController: UITableViewController {
    var items: [Item] = []

    override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
        if segue.identifier == "showDetail",
           let detailVC = segue.destination as? DetailViewController,
           let selectedRow = tableView.indexPathForSelectedRow {
            detailVC.item = items[selectedRow.row]     // pass data before the transition
        }
    }
}
```

How to read it:

- The **segue** (the transition) is drawn in the storyboard, not written in code.
- **`prepare(for:sender:)`** runs **just before** the transition. It's where you **pass data** to the next screen.
- The **`identifier`** (set in IB) tells you **which** segue is firing, because one screen can have several.

Other storyboard code you'll see:

```swift
// Start a segue from code
performSegue(withIdentifier: "showDetail", sender: self)

// Create a screen defined in a storyboard
let storyboard = UIStoryboard(name: "Main", bundle: nil)
let detail = storyboard.instantiateViewController(identifier: "DetailViewController") { coder in
    DetailViewController(coder: coder, item: selectedItem)   // inject data through init (iOS 13+)
}
navigationController?.pushViewController(detail, animated: true)
```

The **`instantiateViewController(identifier:creator:)`** form is the modern way: the data is passed in **`init`**, so it can be a **`let`** instead of an optional `var` that might be forgotten.

---

## 35.6 XIBs and View Loading 🟢

A **XIB** (`.xib`, also called a **nib**) holds **one** view or view controller, not a whole flow like a storyboard. It's often used for **reusable custom views** and **cells**.

```swift
class CustomCardCell: UICollectionViewCell {
    static let reuseIdentifier = "CustomCardCell"

    static func nib() -> UINib {
        UINib(nibName: "CustomCardCell", bundle: nil)
    }

    @IBOutlet weak var titleLabel: UILabel!         // connected to a label in the XIB

    override func awakeFromNib() {
        super.awakeFromNib()
        titleLabel.font = .preferredFont(forTextStyle: .headline)   // setup after loading
    }
}

// Registration:
collectionView.register(CustomCardCell.nib(), forCellWithReuseIdentifier: CustomCardCell.reuseIdentifier)
```

The pieces:

- **`@IBOutlet`** marks a property that IB **connects** to a view in the file. It's filled in when the XIB **loads**. It's an **implicitly unwrapped** optional (`!`), because it's `nil` until then.
- **`UINib`** is the loaded XIB, ready to make copies.
- Registering a **nib** (not a class) tells the collection view to **build each cell from the XIB**.
- **`awakeFromNib()`** runs after loading, when outlets are connected: the place for extra setup.

⚠️ A common crash: "**this class is not key value coding-compliant for the key titleLabel**". It means an outlet in the XIB points to a property that was **renamed or deleted** in code. Fix the connection in IB's Connections inspector.

---

## 35.7 The Delegate Pattern 🟢

A **delegate** is an object that another object **hands decisions or events to**. It's UIKit's most common way for objects to talk. You define a **protocol**, and the delegating object holds a **`weak`** reference to whoever implements it:

```swift
protocol TemperatureSliderDelegate: AnyObject {
    func temperatureSlider(_ slider: TemperatureSlider, didChangeTo value: Double)
}

class TemperatureSlider: UIView {
    weak var delegate: TemperatureSliderDelegate?     // weak: no retain cycle

    private func handleValueChanged(_ newValue: Double) {
        delegate?.temperatureSlider(self, didChangeTo: newValue)
    }
}

class WeatherViewController: UIViewController, TemperatureSliderDelegate {
    private let slider = TemperatureSlider()

    override func viewDidLoad() {
        super.viewDidLoad()
        slider.delegate = self                        // "tell ME when it changes"
    }

    func temperatureSlider(_ slider: TemperatureSlider, didChangeTo value: Double) {
        // respond to the change
    }
}
```

**Why `weak`?** The view controller **owns** the slider (strong reference). If the slider also held the controller **strongly**, each would keep the other alive: a **retain cycle** (9.4), and neither would ever be freed. `weak` breaks the loop. That's also why the protocol is `AnyObject`: only classes can be referenced weakly.

The pattern is all over UIKit: `UITableViewDelegate`, `UIScrollViewDelegate`, `UITextFieldDelegate`, and many more. Conventions to notice:

- The first parameter is the **sender** (`slider`), so one delegate can serve several objects.
- Names say **when**: `will…` (before, often can say no), `did…` (after), `should…` (asks permission, returns `Bool`).

It's the ancestor of SwiftUI's **closure callbacks** (`.onChange(of:)`, `onSubmit`, `Button { }`). In new UIKit code, a **closure property** is often simpler for **one** event:

```swift
class TemperatureSlider: UIView {
    var onChange: ((Double) -> Void)?       // one event: a closure is enough
}

slider.onChange = { [weak self] value in    // capture self weakly, for the same reason
    self?.updateForecast(for: value)
}
```

---

## 35.8 Target-Action and @IBAction 🟢

**Target-action** connects a **control** (like a `UIButton`) to a **method** on an **object**, for a specific **event** (like a tap):

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
        // connected to a button drawn in Interface Builder
    }
}
```

- **target**: the object to call (`self`).
- **action**: the method, as a **selector** (`#selector(...)`).
- **event**: when to call it (`.touchUpInside` = finger lifted inside the button).

The method needs **`@objc`** because selectors use the **Objective-C runtime** to find and call the method **by name** at run time. **`@IBAction`** marks a method that IB can connect to a control in a storyboard or XIB (it implies `@objc`).

Since iOS 14, you can use **closures** instead, with **`UIAction`**. No `@objc`, no selector:

```swift
let saveButton = UIButton(configuration: .filled(), primaryAction: UIAction(title: "Save") { [weak self] _ in
    self?.save()
})

// Or add to an existing control
slider.addAction(UIAction { [weak self] action in
    guard let slider = action.sender as? UISlider else { return }
    self?.volumeChanged(slider.value)
}, for: .valueChanged)
```

| Event | When |
|---|---|
| `.touchUpInside` | Tap on a button |
| `.valueChanged` | Slider, switch, segmented control, date picker changed |
| `.editingChanged` | Text field text changed |
| `.primaryActionTriggered` | The control's main action (tap, return key) |

This is the ancestor of SwiftUI's `Button("Save") { save() }`.

---

## 35.9 The Responder Chain 🟡

The **responder chain** routes **events** (touches, keyboard presses, and actions like **copy** and **paste**) through a line of **`UIResponder`** objects. Each one can **handle** the event or **pass it on** to its **`next`** responder.

```swift
class CustomInputView: UIView {
    override var canBecomeFirstResponder: Bool { true }

    override func copy(_ sender: Any?) {
        // handles Copy when this view is the first responder
        UIPasteboard.general.string = "Custom content"
    }

    override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
        action == #selector(copy(_:)) || super.canPerformAction(action, withSender: sender)
    }
}
```

The chain usually goes:

**first responder** (e.g., the focused text field) → its **superview** → … → the **view controller** → the **window** → the **application** → the **app delegate**

When the user picks **Edit → Copy** (or presses ⌘C on iPad), UIKit sends `copy(_:)` to the **first responder**. If it can't handle it, the next one gets a chance, and so on. So **Copy works** whatever is focused, without the menu knowing **which** view that is.

**First responder** is the object that gets keyboard input first:

```swift
textField.becomeFirstResponder()    // focus it: the keyboard appears
textField.resignFirstResponder()    // unfocus it: the keyboard hides
```

You can also send an action to **"whoever handles it"**, with a `nil` target. That's the trick from 28.14 to hide the keyboard:

```swift
UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
```

It's similar in spirit to SwiftUI's **`@FocusState`** (28.15): both decide **where input goes**. UIKit uses a **chain of objects** you can walk; SwiftUI uses a **state value** you bind.

---

## 35.10 Gesture Recognizers 🟡

A **`UIGestureRecognizer`** detects a gesture (tap, pan, pinch, long press, swipe, rotation) on a view. It hides the messy **touch tracking** you'd otherwise write yourself.

```swift
class InteractiveCardView: UIView {
    override init(frame: CGRect) {
        super.init(frame: frame)
        let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        addGestureRecognizer(panGesture)
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: superview)
        switch gesture.state {
        case .began:
            break                                    // the drag started
        case .changed:
            transform = CGAffineTransform(translationX: translation.x, y: translation.y)   // follow the finger
        case .ended, .cancelled:
            UIView.animate(withDuration: 0.3) { self.transform = .identity }   // spring back
        default:
            break
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}
```

A recognizer moves through **states**, and calls your action at each change:

| State | Meaning |
|---|---|
| `.possible` | Waiting; not recognized yet |
| `.began` | The gesture **started** (continuous gestures) |
| `.changed` | It's **moving** (called many times) |
| `.ended` | Finished normally (for a tap, this is the only call) |
| `.cancelled` | Interrupted (for example, by a phone call) |
| `.failed` | It wasn't this gesture after all |

Common recognizers:

```swift
let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap))
tap.numberOfTapsRequired = 2                       // double tap

let longPress = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress))
longPress.minimumPressDuration = 0.5

let pinch = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch))   // gesture.scale
```

⚠️ `UIImageView` and `UILabel` have **`isUserInteractionEnabled = false`** by default. Set it to `true`, or their gestures never fire.

It uses the same **target-action** wiring as controls (35.8), and it's the ancestor of SwiftUI's `.gesture(DragGesture())` and `.onTapGesture`.

---

## 35.11 Gesture Recognizer Conflicts and Dependencies 🟡

When several recognizers can see the **same touch** (a draggable card **inside** a scroll view; a single tap and a double tap on one view), UIKit needs to know **who wins**.

**By default**, recognizers are **exclusive**: the **first** to recognize its gesture **wins**, and the others **fail**.

To let two run **at the same time**, use the **delegate**:

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
        true   // this pan and, say, a parent scroll view's pan can both work together
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
}
```

To make one **wait** for another to **fail**, use **`require(toFail:)`**. The classic case is **single tap vs. double tap**:

```swift
let doubleTap = UITapGestureRecognizer(target: self, action: #selector(zoom))
doubleTap.numberOfTapsRequired = 2

let singleTap = UITapGestureRecognizer(target: self, action: #selector(toggleControls))
singleTap.require(toFail: doubleTap)   // only fire once we're sure it's NOT a double tap

view.addGestureRecognizer(doubleTap)
view.addGestureRecognizer(singleTap)
```

Without it, a double tap would **also** trigger the single tap first. The cost: the single tap now fires after a **short delay** (while UIKit waits to see if a second tap comes).

Other useful delegate methods:

| Method | Use |
|---|---|
| `gestureRecognizerShouldBegin(_:)` | Start only in some cases (e.g., only horizontal pans) |
| `shouldRequireFailureOf` | Like `require(toFail:)`, decided at run time |
| `shouldReceive(_ touch:)` | Ignore touches on certain subviews (like buttons) |

---

## 35.12 View Controller Containment 🟡

**Containment** lets a **parent** view controller embed **child** view controllers, each managing its own part of the screen. `UINavigationController`, `UITabBarController`, and `UISplitViewController` all work this way, and you can build your own containers too.

**Adding** a child takes **three** steps, in this order:

```swift
class DashboardViewController: UIViewController {
    private let summaryVC = SummaryViewController()

    override func viewDidLoad() {
        super.viewDidLoad()

        addChild(summaryVC)                                      // 1. link parent and child
        view.addSubview(summaryVC.view)                          // 2. add the child's view
        summaryVC.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            summaryVC.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            summaryVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            summaryVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            summaryVC.view.heightAnchor.constraint(equalToConstant: 200)
        ])
        summaryVC.didMove(toParent: self)                        // 3. tell the child it's done
    }
}
```

**Removing** is the mirror image:

```swift
func removeSummary() {
    summaryVC.willMove(toParent: nil)       // 1. tell the child it's leaving
    summaryVC.view.removeFromSuperview()    // 2. remove its view
    summaryVC.removeFromParent()            // 3. break the link
}
```

Why the exact steps matter: the parent **forwards** events to its children. With the link in place, the child gets its own **`viewWillAppear`/`viewDidAppear`** at the right times, **trait changes** (rotation, dark mode), and correct **safe area** and **navigation** info. If you just add the child's **view** without `addChild`, the view shows up, but the child controller is "**orphaned**": its lifecycle methods don't run properly, and bugs follow.

Containment is a great way to **split** a huge view controller into smaller ones, each with one job. It's also how you embed a SwiftUI screen in UIKit: a `UIHostingController` is a child view controller (38).

---

## 35.13 Custom View Controller Transitions 🔴

Besides the standard push and present animations, UIKit lets you write **fully custom** transitions with the **`UIViewControllerAnimatedTransitioning`** protocol:

```swift
class FadeTransition: NSObject, UIViewControllerAnimatedTransitioning {
    func transitionDuration(using transitionContext: UIViewControllerContextTransitioning?) -> TimeInterval {
        0.3
    }

    func animateTransition(using transitionContext: UIViewControllerContextTransitioning) {
        guard let toView = transitionContext.view(forKey: .to) else { return }
        let containerView = transitionContext.containerView      // the stage where the animation happens
        containerView.addSubview(toView)
        toView.alpha = 0

        UIView.animate(withDuration: transitionDuration(using: transitionContext), animations: {
            toView.alpha = 1
        }, completion: { _ in
            // REQUIRED: tell UIKit the transition is over (and whether it was cancelled)
            transitionContext.completeTransition(!transitionContext.transitionWasCancelled)
        })
    }
}
```

The two methods:

- **`transitionDuration(using:)`**: how long it lasts.
- **`animateTransition(using:)`**: do the animation. Get the views from the **context**, put them in the **`containerView`**, and animate.

⚠️ You **must** call **`completeTransition(_:)`** at the end. It tells UIKit the transition is **finished**, so it can install the new screen and accept touches again. If you forget, the app gets **stuck**: the screen stops responding, because UIKit thinks a transition is still running. Pass `!transitionWasCancelled`, so an **interactive** transition that the user cancelled is rolled back correctly.

To **use** it, return it from a **transitioning delegate**:

```swift
class DetailPresenter: NSObject, UIViewControllerTransitioningDelegate {
    func animationController(forPresented presented: UIViewController,
                             presenting: UIViewController,
                             source: UIViewController) -> UIViewControllerAnimatedTransitioning? {
        FadeTransition()
    }
}

let presenter = DetailPresenter()        // keep a strong reference: transitioningDelegate is weak
detailVC.modalPresentationStyle = .fullScreen
detailVC.transitioningDelegate = presenter
present(detailVC, animated: true)
```

For pushes, return it from **`UINavigationControllerDelegate`**'s `navigationController(_:animationControllerFor:from:to:)` instead.

From iOS 18, UIKit also has a built-in **zoom** transition, like SwiftUI's (27.23), with no custom class:

```swift
detailVC.preferredTransition = .zoom { _ in
    selectedCell                          // the view to zoom from
}
navigationController?.pushViewController(detailVC, animated: true)
```

---

## 35.14 UIScene and Multi-Window on iPad 🟡

A **`UIScene`** is **one instance** of your app's UI: usually **one window**. On iPad (and Mac, and visionOS), an app can have **several scenes** open at once, each with its own state and lifecycle.

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

    func sceneDidEnterBackground(_ scene: UIScene) {
        // save this window's state
    }
}
```

Before iOS 13, the **`UIApplicationDelegate`** managed **one window** for the whole app. **`UIScene`** **separated** "the **app**" (launched once, one process) from "a **window** of the app" (can be many). Now:

| Object | Represents | Example callbacks |
|---|---|---|
| `UIApplicationDelegate` | The **process**: launched once | `didFinishLaunchingWithOptions`, push token registration |
| `UISceneDelegate` | **One window** | `willConnectTo`, `sceneDidBecomeActive`, `sceneDidEnterBackground` |
| `UISceneSession` | A window's saved identity | Restored after relaunch |

Each scene can be in the **foreground** or **background** separately: one window can be active while another is in the background.

**`scene(_:willConnectTo:options:)`** is where a new window gets its **root view controller**. It's the UIKit version of SwiftUI's `WindowGroup` (33.3).

Apple has announced that the **scene-based lifecycle** will be **required** for apps built with future SDKs, so older apps that still use only `UIApplicationDelegate` should move to scenes.

---

## 35.15 Trait Collections and registerForTraitChanges 🟡

A **`UITraitCollection`** describes the **environment** a view is in: **size classes**, **light or dark** mode, **Dynamic Type** size, display scale, and more. It's UIKit's version of SwiftUI's **`@Environment`** values.

**`registerForTraitChanges`** (iOS 17) lets you react when **specific** traits change:

```swift
class ThemedViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (self: Self, previousTraitCollection: UITraitCollection) in
            self.updateAppearance(for: self.traitCollection.userInterfaceStyle)
        }
    }

    private func updateAppearance(for style: UIUserInterfaceStyle) {
        // adjust things that don't adapt on their own, like CALayer colors
    }
}
```

The **older** way was overriding **`traitCollectionDidChange(_:)`**. It ran for **any** trait change, and you had to check **which** one changed yourself:

```swift
// Older, deprecated in iOS 17
override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    if traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
        updateAppearance(for: traitCollection.userInterfaceStyle)
    }
}
```

`registerForTraitChanges` is more **targeted**: you list the traits you care about, and only those trigger your code. It's like SwiftUI, where a view reading only `\.colorScheme` only updates when the color scheme changes.

Often you don't need **either**. Dynamic colors (`.label`, `.systemBackground`, asset colors with dark variants) and `preferredFont(forTextStyle:)` with `adjustsFontForContentSizeCategory` **adapt automatically**. You only react by hand for things like **`CALayer`** colors (`cgColor` doesn't update itself) or **layout changes** based on size class.

From iOS 18, UIKit also does **automatic trait tracking**: if `layoutSubviews()` or `draw(_:)` **reads** a trait, UIKit re-runs it when that trait changes. No registration needed.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| UIKit's continued relevance | `UIViewControllerRepresentable` | Existing apps, fine control, and bridging |
| View controller lifecycle | `viewDidLoad`, `viewWillAppear`, `viewIsAppearing` | Once vs. every appearance; sizes known after layout |
| View geometry | `frame`, `bounds`, `layoutSubviews()` | Stored geometry; position children in layout |
| Programmatic UI | Views in Swift code, `#Preview` | Easy to review and merge |
| Legacy visual UI | Storyboards, segues, `prepare(for:)` | Pass data just before a segue |
| Reusable IB views | XIBs, `@IBOutlet`, `UINib`, `awakeFromNib` | One view or cell per file |
| Delegation | `weak` delegate + `AnyObject` protocol | Hand off events and decisions without cycles |
| Control events | Target-action, `#selector`, `UIAction` | Connect controls to code; closures since iOS 14 |
| Event routing | Responder chain, first responder | Events walk up until something handles them |
| Gesture detection | `UIGestureRecognizer` and its states | Taps, pans, pinches without raw touch code |
| Gesture coexistence | `shouldRecognizeSimultaneouslyWith`, `require(toFail:)` | Decide who wins, or let both work |
| Embedding controllers | `addChild`, `didMove(toParent:)` | Correct lifecycle for child screens |
| Custom transitions | `UIViewControllerAnimatedTransitioning` | Custom animations; always `completeTransition` |
| Multi-window | `UIScene`, `UISceneDelegate` | App vs. window lifecycles |
| Environmental context | `UITraitCollection`, `registerForTraitChanges` | React to specific trait changes |
