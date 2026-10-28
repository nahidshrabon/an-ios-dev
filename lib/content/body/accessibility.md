**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Accessibility means **everyone** can use your app: people who are blind or have low vision, who are deaf, who have limited movement, or who are sensitive to motion. Many of these features help **all** users too. This section covers **VoiceOver** (labels, values, hints, traits, grouping, actions, the rotor, reading order), **visual** settings (Dynamic Type, Reduce Motion, transparency, contrast, color), **tap targets**, other **input** methods, the **tools**, App Store **Nutrition Labels**, and **media**.

---

## 70.1 Turning On VoiceOver and Navigating Your Own App 🟢

**VoiceOver** is the built-in **screen reader**: it speaks what's on screen, and you control it with gestures. The most important accessibility test is simple: **turn it on and use your own app**.

Set up a quick toggle first: **Settings ▸ Accessibility ▸ Accessibility Shortcut ▸ VoiceOver**. Now a **triple-click** of the side button turns it on and off.

The basic gestures:

| Gesture | Does |
|---|---|
| Touch / drag a finger | Speak what's under the finger |
| **Swipe right / left** | Next / previous element |
| **Double-tap** (anywhere) | Activate the selected element |
| Two-finger swipe **up** | Read everything from the top |
| **Three-finger swipe** | Scroll |
| Two-finger **scrub** (a quick "Z") | Go back / close |
| **Rotor**: twist two fingers like a dial | Choose a navigation mode (70.7) |

A good test routine for each screen:

```
1. Swipe through EVERY element, start to end.
   - Does each one say something meaningful? ("button" alone = broken)
   - Is the order logical?
2. Do the screen's main task (log in, add to cart) with VoiceOver only.
3. Try Screen Curtain (three-finger triple-tap): the screen goes dark.
   Can you still do the task by sound alone?
```

You'll find problems in minutes that are hard to see by reading code: unlabeled icons, decorative images read aloud, a price read **after** the "Buy" button. The rest of this section shows how to fix them.

---

## 70.2 Accessibility Labels 🟢

The **label** is **what VoiceOver says** for an element. Elements with visible **text** get a label automatically. **Icons** and images usually don't:

```swift
// ❌ VoiceOver may say only "button" (or read the symbol's name)
Button(action: deleteRecipe) {
    Image(systemName: "trash")
}

// ✅ Option 1: add a label
Button(action: deleteRecipe) {
    Image(systemName: "trash")
}
.accessibilityLabel("Delete recipe")

// ✅ Option 2 (best): use a Label, and show only the icon
Button(action: deleteRecipe) {
    Label("Delete recipe", systemImage: "trash")
        .labelStyle(.iconOnly)          // looks like an icon; VoiceOver says "Delete recipe, button"
}
```

Option 2 also helps **Voice Control** (70.15) and keyboard users, and the text is already **localized** with the rest of your strings.

Good labels:

| Do | Don't |
|---|---|
| "Delete recipe" | "Delete recipe **button**" (the **trait** adds "button", 70.4) |
| "Favorite" | "Heart icon" (say what it **does**, not what it **looks like**) |
| Short: 1–3 words | A full sentence (that's a hint, 70.3) |
| Localized | Hard-coded English |

**Decorative** images (a background pattern, an illustration that repeats the text) should be **skipped** by VoiceOver:

```swift
Image(decorative: "kitchen-illustration")              // never read
Image("divider").accessibilityHidden(true)            // or hide any view
```

UIKit: set `accessibilityLabel` on the view, and `isAccessibilityElement = false` for decorative ones.

---

## 70.3 Accessibility Values and Hints 🟢

Three different pieces of information:

| Property | Answers | Example |
|---|---|---|
| **Label** (70.2) | **What** is it? | "Servings" |
| **Value** | What's its **current state**? | "4" |
| **Hint** | What **happens** if I use it? | "Changes the ingredient amounts." |

VoiceOver reads them in that order: "Servings, 4, adjustable. Changes the ingredient amounts."

```swift
Stepper("Servings", value: $servings, in: 1...12)
    .accessibilityValue("\(servings) servings")
    .accessibilityHint("Changes the ingredient amounts.")

// A custom progress ring has no built-in value: provide it
CookingProgressRing(progress: progress)
    .accessibilityLabel("Cooking progress")
    .accessibilityValue("\(Int(progress * 100)) percent")
```

Rules:

- Keep the **label stable** and put the changing part in the **value**. ("Volume, 50 percent" → "Volume, 75 percent", not a new label each time.)
- Use a **hint** only when the result **isn't obvious** from the label. "Delete recipe" needs no hint; a "Sync" button that also **logs you out** of other devices does.
- Hints describe the **result**, start with a **verb**, and end with a period: "Opens the recipe." not "Double-tap to open the recipe" (users already know how to activate).

Users can turn hints **off** in settings, so never put **essential** information only in a hint.

---

## 70.4 Accessibility Traits 🟢

**Traits** tell VoiceOver what **kind** of element something is. They change **how** it's announced and **how** users can navigate to it:

| Trait | VoiceOver says / does |
|---|---|
| `.isButton` | "…, button" |
| `.isHeader` | "…, heading": reachable with the **Headings** rotor (70.7) |
| `.isLink` | "…, link" |
| `.isSelected` | "selected, …" (current tab, chosen option) |
| `.isToggle` | "…, switch button" (iOS 17) |
| `.isImage` | "…, image" |
| `.updatesFrequently` | For values that change constantly, like a timer |
| `.isModal` | VoiceOver stays **inside** this view (custom alerts, sheets) |

```swift
Text("Breakfast")
    .font(.title2.bold())
    .accessibilityAddTraits(.isHeader)            // or .accessibilityHeading(.h2)

MealTypeChip(type: .vegan, isSelected: filter == .vegan)
    .accessibilityAddTraits(filter == .vegan ? .isSelected : [])
```

**Headings** matter a lot: many VoiceOver users navigate by **heading**, jumping from section to section, the way sighted users **scan** the screen. A screen with visual sections but no heading traits forces them to swipe through **everything**.

A common bug: making `Text` tappable with `onTapGesture`. Visually it acts like a button, but VoiceOver doesn't know it's **actionable**:

```swift
// ❌ VoiceOver: "Show all" (no hint that it does anything)
Text("Show all").onTapGesture { showAll() }

// ✅ Use a real Button (correct trait, focus, keyboard, Voice Control)
Button("Show all") { showAll() }
```

---

## 70.5 Grouping and Combining Elements 🟢

By default, every text and image is a **separate** VoiceOver stop. For a recipe card, that's many swipes for **one** thing:

```
Without grouping (5 swipes):  "Photo" → "Pasta Carbonara" → "25 min" → "4.8 stars" → "Favorite, button"
```

Group related pieces into **one** element:

```swift
struct RecipeCard: View {
    let recipe: Recipe

    var body: some View {
        VStack(alignment: .leading) {
            RecipePhoto(recipe: recipe)
                .accessibilityHidden(true)                // decorative here
            Text(recipe.title).font(.headline)
            HStack {
                Label("\(recipe.minutes) min", systemImage: "clock")
                Label(recipe.rating.formatted(), systemImage: "star.fill")
            }
        }
        .accessibilityElement(children: .combine)        // ONE stop
        // VoiceOver: "Pasta Carbonara, 25 min, 4.8"
    }
}
```

Three grouping modes:

| Mode | Result |
|---|---|
| `.combine` | One element; the children's labels are **joined** automatically |
| `.ignore` | One element; children ignored. **You** write the label |
| `.contain` | Children stay **separate**, but are treated as a **group** (affects order, 70.9) |

With `.ignore`, write a label that **reads well**:

```swift
.accessibilityElement(children: .ignore)
.accessibilityLabel("\(recipe.title), \(recipe.minutes) minutes, rated \(recipe.rating.formatted()) stars")
```

Group when the pieces form **one idea**. Keep things **separate** when each is a different **action** (a card with "Edit" and "Share" buttons): or group them and expose the buttons as custom actions (70.6).

---

## 70.6 Custom Accessibility Actions 🟡

Sighted users find extra actions through **gestures**: swipe a row to delete, long-press for a menu. Those gestures don't exist for VoiceOver users. **Custom actions** expose the same actions in VoiceOver's **Actions** rotor: the user swipes **up or down** to pick one, then double-taps:

```swift
RecipeRow(recipe: recipe)
    .swipeActions {
        Button("Delete", role: .destructive) { delete(recipe) }
        Button("Favorite") { toggleFavorite(recipe) }
    }
    .accessibilityElement(children: .combine)
    .accessibilityActions {
        Button("Favorite") { toggleFavorite(recipe) }
        Button("Share") { share(recipe) }
        Button("Delete", role: .destructive) { delete(recipe) }
    }
// VoiceOver: "Pasta Carbonara, 25 min. Actions available."
```

(SwiftUI's `swipeActions` and `contextMenu` are often exposed automatically, but **custom** gestures never are. Check with VoiceOver.)

For values you change **up and down** (a custom rating, a dial), use an **adjustable** action: the user swipes **up** or **down** on the element:

```swift
StarRatingView(rating: $rating)
    .accessibilityElement()
    .accessibilityLabel("Rating")
    .accessibilityValue("\(rating) of 5 stars")
    .accessibilityAdjustableAction { direction in
        switch direction {
        case .increment: rating = min(rating + 1, 5)
        case .decrement: rating = max(rating - 1, 1)
        @unknown default: break
        }
    }
```

The rule: **every** action a sighted user can do must be possible with VoiceOver, even if the **way** to do it is different.

---

## 70.7 The VoiceOver Rotor 🟡

The **rotor** (twist two fingers like a dial) changes what **swipe up/down** does: move by **headings**, **links**, **form controls**, **words**, adjust **speech rate**, and more. It turns a long screen into something you can **jump** through.

The built-in rotors work automatically if your traits are right (headings, 70.4; links). You can add **your own** rotor for content that matters in **your** app:

```swift
struct InboxView: View {
    let messages: [Message]

    var body: some View {
        List(messages) { message in
            MessageRow(message: message)
        }
        .accessibilityRotor("Unread") {
            ForEach(messages.filter(\.isUnread)) { message in
                AccessibilityRotorEntry(message.subject, id: message.id)
            }
        }
    }
}
```

Now a VoiceOver user picks "**Unread**" in the rotor and swipes down to jump **only** between unread messages, skipping the 200 read ones.

Good candidates for custom rotors:

- **Unread** or **flagged** items in a long list,
- **Errors** in a long form ("jump to the next field with a problem"),
- **Ingredients** vs. **steps** in a recipe,
- **Search matches** inside a document.

Add a rotor when sighted users would **scan** for something visually (bold unread items, red error fields). The rotor is the VoiceOver equivalent of that quick visual scan.

---

## 70.8 accessibilityRepresentation for Custom Controls 🟡

A control you **draw yourself** (with `Canvas`, 30.5, or shapes and gestures) has **no** accessibility meaning: VoiceOver sees pixels, not "a slider". **`accessibilityRepresentation`** says: "**for accessibility, treat this like that standard control**":

```swift
struct OvenDial: View {
    @Binding var temperature: Double            // 100...250 °C

    var body: some View {
        Canvas { context, size in
            drawDial(in: context, size: size, value: temperature)    // fully custom drawing
        }
        .frame(width: 180, height: 180)
        .gesture(DragGesture().onChanged { updateTemperature(from: $0) })
        .accessibilityRepresentation {
            Slider(value: $temperature, in: 100...250, step: 5) {
                Text("Oven temperature")
            }
        }
    }
}
// VoiceOver: "Oven temperature, 180, adjustable." Swipe up/down changes it by 5.
```

The **look** stays your custom dial. For VoiceOver, Voice Control, and keyboard users, it behaves exactly like a standard `Slider`, with its label, value, and adjust actions, **for free**.

| Approach | When |
|---|---|
| Use a **standard** control, styled (`.buttonStyle`, `.toggleStyle`) | Best: accessibility is built in |
| `accessibilityRepresentation` | A truly custom look, with standard **behavior** |
| Manual label + value + adjustable action (70.6) | When no standard control matches |

UIKit equivalent: subclass `UIControl`, set `accessibilityTraits = .adjustable`, and implement `accessibilityIncrement()` / `accessibilityDecrement()`.

---

## 70.9 Focus Order and Reading Order 🟡

VoiceOver reads elements roughly **top-left to bottom-right**, following the view structure. Usually that's right. But custom layouts, `ZStack`s, and overlays can produce a **confusing** order:

```
Visual layout:                       Default VoiceOver order:
┌─────────────────────────┐          1. "Buy now, button"     ← action before context!
│ [ Buy now ]   Total: $45│          2. "Total: $45"
└─────────────────────────┘
```

Fix the order with **`accessibilitySortPriority`**: **higher** numbers are read **first**, within the same container:

```swift
HStack {
    Button("Buy now") { checkout() }
        .accessibilitySortPriority(1)
    Text("Total: $45.00")
        .accessibilitySortPriority(2)          // read first: context, then action
}
.accessibilityElement(children: .contain)      // priorities apply inside this group
```

The **best** fix is often simpler: put views in the code in the **logical** order, and let layout handle the visuals.

Sometimes you must **move** VoiceOver's focus, for example to an **error** that just appeared. Use **`@AccessibilityFocusState`**:

```swift
struct LoginForm: View {
    @State private var errorMessage: String?
    @AccessibilityFocusState private var errorIsFocused: Bool

    var body: some View {
        Form {
            // ... fields ...
            if let errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
                    .accessibilityFocused($errorIsFocused)
            }
            Button("Sign In") {
                errorMessage = validate()
                errorIsFocused = errorMessage != nil       // VoiceOver jumps to the error
            }
        }
    }
}
```

For short, non-visual updates ("Saved"), post an **announcement** instead: `AccessibilityNotification.Announcement("Recipe saved").post()`.

---

## 70.10 Dynamic Type Across the Full Size Ramp 🟢

Users choose their **text size** in Settings. The range is big: from **xSmall** up to **xxxLarge**, then five **accessibility** sizes (**AX1–AX5**, turned on under Accessibility ▸ Display & Text Size ▸ Larger Text). At AX5, body text is about **3×** the default size.

Text styles scale **automatically**:

```swift
Text(recipe.title).font(.headline)             // ✅ scales
Text(recipe.summary).font(.body)               // ✅ scales
Text("Note").font(.system(size: 15))           // ❌ fixed size: ignores the user's choice
Text("Note").font(.custom("Avenir", size: 15, relativeTo: .body))   // ✅ custom font that scales
```

Text scaling is the easy part. **Layouts** break at the large sizes. Make them adapt:

```swift
struct RecipeHeader: View {
    @Environment(\.dynamicTypeSize) private var typeSize
    @ScaledMetric(relativeTo: .body) private var iconSize = 24.0     // grows with the text

    var body: some View {
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading))           // stack vertically when huge
            : AnyLayout(HStackLayout())

        layout {
            Image(systemName: "clock")
                .frame(width: iconSize, height: iconSize)
            Text("25 minutes")
            Text("Serves 4")
        }
    }
}
```

| ❌ Breaks at large sizes | ✅ Instead |
|---|---|
| Fixed `.frame(height:)` around text | Let height grow; use `minHeight` if needed |
| `.lineLimit(1)` on important text | Allow wrapping |
| Rows of many items side by side | Switch to vertical (`AnyLayout`, `ViewThatFits`) |
| Fixed icon and spacing sizes | `@ScaledMetric` |

**Test** at the **largest** sizes, not just "a bit bigger": in Xcode Previews (Variants ▸ Dynamic Type), with the Accessibility Inspector's settings (70.17), or `.environment(\.dynamicTypeSize, .accessibility5)`. UIKit: use `UIFont.preferredFont(forTextStyle:)` (or `UIFontMetrics` for custom fonts) and set `adjustsFontForContentSizeCategory = true`.

---

## 70.11 Reduce Motion Support 🟢

Some people get **dizzy** or **nauseous** from motion: large slides, zooms, parallax, spinning. They turn on **Reduce Motion**. For them, respecting it isn't style: it decides whether the app is **usable**.

```swift
struct RecipeStepView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var step = 0

    var body: some View {
        StepContent(step: step)
            .id(step)
            .transition(reduceMotion
                        ? .opacity                                              // gentle cross-fade
                        : .asymmetric(insertion: .move(edge: .trailing),
                                      removal: .move(edge: .leading)))
            .animation(reduceMotion ? .easeInOut(duration: 0.2) : .spring, value: step)
    }
}

// UIKit
if UIAccessibility.isReduceMotionEnabled { /* use a fade instead of a slide */ }
```

| Reduce or replace | Usually fine |
|---|---|
| Large **slides** and **zooms** between screens | Short **fades** and color changes |
| **Parallax** and motion-linked effects | Small, quick state changes |
| **Auto-playing** animations and video loops | Animations the user **starts** |
| Bouncy, **springy** movement | Simple progress indicators |

The fix is usually small: swap the motion for a **cross-fade**, or skip a decorative animation. Many system animations already adapt automatically. See also 29.15.

---

## 70.12 Reduce Transparency and Increase Contrast 🟡

Two display settings, two different needs:

| Setting | Helps | Your app should |
|---|---|---|
| **Reduce Transparency** | People who find text over **blurry, see-through** backgrounds hard to read | Use **solid** backgrounds instead of translucent ones |
| **Increase Contrast** | People with low vision | Use **stronger** colors and borders |

**System materials** (`.regularMaterial`, Liquid Glass, 32) **adapt automatically**. Your **own** translucent colors don't:

```swift
struct RecipeOverlayCard: View {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.colorSchemeContrast) private var contrast

    var body: some View {
        Text("Pasta Carbonara")
            .padding()
            .background(
                reduceTransparency
                    ? AnyShapeStyle(Color(.systemBackground))          // solid
                    : AnyShapeStyle(Color.black.opacity(0.35))         // custom translucency
            )
            .overlay {
                RoundedRectangle(cornerRadius: 12)
                    .stroke(.secondary, lineWidth: contrast == .increased ? 2 : 0.5)   // stronger edge
            }
    }
}
```

For colors, the easiest path: in the **asset catalog**, turn on **High Contrast** for a color set and define stronger variants. The system picks them automatically when Increase Contrast is on. System colors (`.label`, `.secondaryLabel`, `.systemBlue`, …) already do this.

UIKit equivalents: `UIAccessibility.isReduceTransparencyEnabled` and `UIAccessibility.isDarkerSystemColorsEnabled`.

Test both settings on your most **visual** screens, especially anything with text over **photos** or **blur**.

---

## 70.13 Differentiate Without Color 🟢

About **1 in 12** men (and fewer women) have some form of **color blindness**. If **color alone** carries meaning, they miss it:

```swift
// ❌ Only color tells "in stock" from "sold out"
Circle().fill(item.inStock ? .green : .red).frame(width: 10, height: 10)

// ✅ Color PLUS shape PLUS text
Label(item.inStock ? "In stock" : "Sold out",
      systemImage: item.inStock ? "checkmark.circle.fill" : "xmark.circle.fill")
    .foregroundStyle(item.inStock ? .green : .red)
```

The rule: color can **support** meaning, but never be the **only** carrier. Add an icon, a shape, a pattern, or text.

Users can also turn on **Differentiate Without Color** in Settings; check it to add **extra** cues where your design normally relies on color:

```swift
@Environment(\.accessibilityDifferentiateWithoutColor) private var differentiateWithoutColor

ChartLine(data: series)
    .foregroundStyle(series.color)
    .lineStyle(differentiateWithoutColor ? series.dashPattern : .solid)   // dashes as well as colors
```

Also check **contrast** itself: normal text needs a contrast ratio of at least **4.5:1** with its background (3:1 for large text). The Accessibility Inspector has a **color contrast** calculator (70.17).

This is the same principle as labels for VoiceOver (70.2): never let **one** sense (sight, or color specifically) be the **only** way to get the information.

---

## 70.14 Minimum Tap Target Sizes 🟢

Apple's guideline: interactive elements should have a tap area of at least **44 × 44 points**. Small targets are hard to hit for people with **tremors**, limited **dexterity**, or simply big fingers, and for **everyone** while walking.

The trick: the **visible** icon can be small; the **tappable** area must not be:

```swift
// ❌ The tap area is only the 14-pt glyph
Button(action: dismiss) {
    Image(systemName: "xmark")
        .font(.system(size: 14, weight: .semibold))
}

// ✅ Same look, 44 × 44 tap area
Button(action: dismiss) {
    Image(systemName: "xmark")
        .font(.system(size: 14, weight: .semibold))
        .frame(width: 44, height: 44)            // the frame INSIDE the label
        .contentShape(Rectangle())               // the whole frame is tappable
}
.accessibilityLabel("Close")
```

Put the frame **inside** the button's label (with `contentShape`), so the button's hit area really grows.

| Platform | Minimum target |
|---|---|
| iPhone, iPad | 44 × 44 pt |
| visionOS | 60 pt (64.14) |
| Mac (pointer) | Can be smaller, but keep generous spacing |

Also leave **space** between targets: two 44-pt buttons touching each other still cause mis-taps.

UIKit: give buttons enough content insets (`UIButton.Configuration`), or override `point(inside:with:)` to extend the hit area. The **hit region** audit in `performAccessibilityAudit()` (67.9) and the Accessibility Inspector both flag small targets.

---

## 70.15 Switch Control and Voice Control 🟡

Two more assistive technologies for people who can't use **touch** easily:

| Technology | How people use it |
|---|---|
| **Switch Control** | One or more **switches** (a button, a head movement, a sip-and-puff device). iOS **highlights** elements one by one; the user presses a switch to pick |
| **Voice Control** | **Speaking**: "Tap Add to Cart", "Scroll down", "Show numbers" (then "Tap 7") |

Good news: both use the **same** accessibility information as VoiceOver: labels, traits, grouping, actions. The work from 70.2–70.9 helps **all** of them.

Voice Control has one special need: users say what they **see**. So labels should **match the visible text**, and you can add **alternative** names:

```swift
Button {
    addToCart()
} label: {
    Label("Add to Cart", systemImage: "cart.badge.plus")
}
.accessibilityInputLabels(["Add to Cart", "Add", "Cart"])   // any of these works when spoken

// An icon-only button: users will say what they think it is
Button(action: showFilters) { Image(systemName: "line.3.horizontal.decrease.circle") }
    .accessibilityLabel("Filters")
    .accessibilityInputLabels(["Filters", "Filter"])
```

Test with Voice Control on: say "**Show names**" to see the name of every control. If a button shows "button" or a name that differs from its visible text, users can't call it.

For Switch Control, the grouping (70.5) and order (70.9) matter a lot: scanning through 40 separate elements one by one is **slow**, while well-grouped screens are quick.

---

## 70.16 Full Keyboard Access 🟡

**Full Keyboard Access** (Settings ▸ Accessibility ▸ Keyboards) lets people use an iPhone or iPad entirely with a **hardware keyboard**: **Tab** and arrow keys move the focus, **Space** activates. It helps people who can't touch the screen precisely, and keyboard power users on iPad.

**Standard** controls (buttons, toggles, text fields, list rows) work **automatically**. **Custom** interactive views need to opt in:

```swift
struct StarRating: View {
    @Binding var rating: Int
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack {
            ForEach(1...5, id: \.self) { star in
                Image(systemName: star <= rating ? "star.fill" : "star")
                    .onTapGesture { rating = star }
            }
        }
        .padding(4)
        .focusable()                                     // can receive keyboard focus
        .focused($isFocused)
        .overlay {                                       // a visible focus ring
            RoundedRectangle(cornerRadius: 6).stroke(.tint, lineWidth: isFocused ? 2 : 0)
        }
        .onKeyPress(.rightArrow) { rating = min(rating + 1, 5); return .handled }
        .onKeyPress(.leftArrow)  { rating = max(rating - 1, 1); return .handled }
        .accessibilityRepresentation {                   // and VoiceOver (70.8)
            Stepper("Rating", value: $rating, in: 1...5)
        }
    }
}
```

Checklist:

- Every action reachable with **Tab** / arrows and **Space**. No action available **only** through a gesture.
- A **visible** focus indicator on custom controls.
- Focus order matches the visual order (70.9).
- Add **keyboard shortcuts** for common commands (`.keyboardShortcut("n", modifiers: .command)` for "New Recipe").

Test it: connect a keyboard (or use the Mac keyboard in the Simulator with Full Keyboard Access on) and try your main flows **without touching** the screen.

---

## 70.17 The Accessibility Inspector 🟢

The **Accessibility Inspector** (Xcode ▸ Open Developer Tool ▸ Accessibility Inspector) shows how assistive technologies **see** your app, on the Simulator, a device, or the Mac:

| Feature | Use for |
|---|---|
| **Inspection pointer** | Point at any element: see its **label, value, traits, identifier**, and frame |
| **Audit** | Scan the current screen for issues: missing labels, low **contrast**, small **targets**, clipped text, Dynamic Type problems |
| **Settings** panel | Change **text size**, Increase Contrast, Reduce Motion, and more **live**, without opening Settings |
| **Navigation** | Step through elements like VoiceOver does, with an option to **speak** them |
| **Color Contrast Calculator** | Check two colors against the 4.5:1 rule (70.13) |

A fast workflow per screen:

```
1. Run Audit → fix the issues it lists (each one links to the element)
2. Settings panel → drag text size to the maximum → check the layout (70.10)
3. Inspection pointer on every icon → does it have a meaningful label?
```

The Inspector's **audit** and **`performAccessibilityAudit()`** in UI tests (67.9) check the same kinds of problems. Use the Inspector to **explore and fix** while developing, and the UI-test audit to **keep** them fixed in CI. Neither replaces actually **using** the app with VoiceOver (70.1): tools find mechanical problems; only real use finds confusing experiences.

---

## 70.18 Accessibility Nutrition Labels on the App Store 🟢

**Accessibility Nutrition Labels** show on your App Store page **which** accessibility features your app supports, so people can see **before downloading** whether the app will work for them.

You declare them in **App Store Connect**, per device type (iPhone, iPad, Mac, …). The features include:

| Feature | Means your app… |
|---|---|
| **VoiceOver** | Works fully with the screen reader |
| **Voice Control** | Works fully by voice |
| **Larger Text** | Supports large Dynamic Type sizes without breaking |
| **Dark Interface** | Supports a dark appearance |
| **Differentiate Without Color Alone** | Never relies on color only |
| **Sufficient Contrast** | Meets contrast guidelines |
| **Reduced Motion** | Respects Reduce Motion |
| **Captions**, **Audio Descriptions** | Provides them for media (70.19) |

The bar is: users can complete the app's **common tasks** with that feature, not "it mostly works on some screens".

Be **honest**. A blind user who downloads your app because it says "VoiceOver" and then gets stuck on an unlabeled login screen loses time and trust, and will leave a review saying so. It's better to declare **less** and improve over time.

Labels also make a good **checklist**: if you can't honestly claim a feature yet, that's your accessibility to-do list for the next release.

---

## 70.19 Captions and Audio Descriptions for Media 🟡

For video and audio, two different accommodations:

| Accommodation | For | Contains |
|---|---|---|
| **Captions** (and **SDH**: subtitles for the deaf and hard of hearing) | Deaf and hard-of-hearing users | Text of the **speech**, plus important **sounds** ("[timer beeps]") |
| **Audio descriptions** | Blind and low-vision users | An extra narration of what's **shown** ("She folds the egg into the flour.") |

Neither replaces the other: captions don't help someone who can't **see**, and audio descriptions don't help someone who can't **hear**. A cooking video needs **both** to be fully accessible, and a **transcript** helps for audio-only content like podcasts.

These tracks must be **in the media** (created when the video is produced: for HLS, WebVTT subtitle tracks and a described audio track). The app's job is to **offer** them. `AVPlayer` and `AVPlayerViewController` (55.8) do most of the work: by default they follow the user's **system settings** (Settings ▸ Accessibility ▸ Subtitles & Captioning, Audio Descriptions) and choose matching tracks **automatically**.

With a **custom** player UI, you must offer the choice yourself:

```swift
import AVFoundation

func captionOptions(for item: AVPlayerItem) async throws -> [AVMediaSelectionOption] {
    guard let group = try await item.asset.loadMediaSelectionGroup(for: .legible) else { return [] }
    return group.options                                   // show these in your captions menu
}

func selectSDHCaptions(for item: AVPlayerItem) async throws {
    guard let group = try await item.asset.loadMediaSelectionGroup(for: .legible) else { return }
    let sdh = AVMediaSelectionGroup.mediaSelectionOptions(
        from: group.options,
        withMediaCharacteristics: [.describesMusicAndSoundForAccessibility]
    )
    item.select(sdh.first, in: group)
}

// Audio descriptions live in the .audible group, with the
// .describesVideoForAccessibility characteristic
```

Also respect the user's **caption style** (size, color, background) from the system, which `AVPlayer`'s caption rendering does automatically. And for **sounds** your app uses as signals (a timer alarm), add a **visual** cue or haptic too.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Real testing | VoiceOver, Screen Curtain | Use the app the way blind users do |
| Labels | `accessibilityLabel`, `Label` + `.iconOnly`, `Image(decorative:)` | Say what each element is or does |
| Values and hints | `accessibilityValue`, `accessibilityHint` | Current state; non-obvious results |
| Traits | `.isHeader`, `.isButton`, `.isSelected`, real `Button`s | Roles that enable navigation |
| Grouping | `.accessibilityElement(children:)` | One stop per idea |
| Actions | `accessibilityActions`, `accessibilityAdjustableAction` | Gesture-only actions for everyone |
| Rotor | `accessibilityRotor` | Jump between important items |
| Custom controls | `accessibilityRepresentation` | Custom look, standard behavior |
| Order and focus | `accessibilitySortPriority`, `@AccessibilityFocusState` | Logical reading; move focus to errors |
| Dynamic Type | Text styles, `@ScaledMetric`, `AnyLayout` | Layouts that work at AX5 |
| Motion | `accessibilityReduceMotion` | Fades instead of big movement |
| Transparency and contrast | `accessibilityReduceTransparency`, `colorSchemeContrast` | Solid backgrounds, stronger edges |
| Color | Icons + text with color; 4.5:1 contrast | Meaning without relying on color |
| Tap targets | 44 × 44 pt frames + `contentShape` | Easy to hit, for everyone |
| Switch and Voice Control | Same labels; `accessibilityInputLabels` | Spoken and switch access |
| Keyboard | `.focusable()`, `.onKeyPress`, shortcuts | Full use without touch |
| Tools | Accessibility Inspector, UI-test audits | Find and keep fixing mechanical issues |
| App Store | Accessibility Nutrition Labels | Honest support info before download |
| Media | Captions/SDH, audio descriptions | Both, for different users |
