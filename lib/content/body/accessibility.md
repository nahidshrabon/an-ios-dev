## 70.1 Turning On VoiceOver and Navigating Your Own App

VoiceOver is iOS's built-in screen reader, converting on-screen content into spoken audio and haptic feedback, navigated via swipe gestures rather than direct taps — the single most important accessibility testing practice is genuinely turning VoiceOver on and attempting to use one's own app with it, rather than relying purely on reading accessibility-related code or documentation.

```swift
// Not a Swift API — enabled via Settings > Accessibility > VoiceOver,
// or Siri ("Hey Siri, turn on VoiceOver"), or a configured Accessibility Shortcut
// (triple-click the side/home button) for quick toggling during development
```

Actually navigating an app with VoiceOver turned on surfaces problems that are genuinely difficult to anticipate purely by reasoning about code — an element that seems obviously labeled when reading SwiftUI source might turn out to have a confusing or entirely absent spoken description, and experiencing this firsthand (swiping through the actual app rather than imagining how it should theoretically behave) is what the rest of this section's more specific techniques ultimately exist to support.

---

## 70.2 Accessibility Labels

The accessibility label is the primary spoken description VoiceOver announces for an element — for elements with visible text, SwiftUI/UIKit often infer a reasonable default label automatically, but elements without inherent text (an icon-only button, a custom graphic) require an explicitly provided label to be usable at all with VoiceOver.

```swift
Button(action: deleteItem) {
    Image(systemName: "trash")
}
.accessibilityLabel("Delete item")
```

Without an explicit label, an icon-only button like the trash icon above would be announced by VoiceOver as something unhelpful like "button" or, worse, be entirely unlabeled and effectively unusable — the accessibility label is what bridges the gap between an element's purely visual meaning (immediately obvious to a sighted user recognizing a trash icon) and a meaningful spoken equivalent conveying that same information to someone using VoiceOver.

---

## 70.3 Accessibility Values and Hints

Beyond the label (what an element *is*), the accessibility value communicates an element's current state (a slider's current position, a toggle's on/off state), while the accessibility hint provides additional guidance about what will happen if the user interacts with the element — both supplementing, not replacing, the core label.

```swift
Slider(value: $volume, in: 0...100)
    .accessibilityLabel("Volume")
    .accessibilityValue("\(Int(volume)) percent")

Button("Submit") { submitForm() }
    .accessibilityHint("Submits the form and proceeds to the confirmation screen")
```

Distinguishing label, value, and hint clearly matters because conflating them produces a confusing, verbose spoken experience — a slider's label should stay stable ("Volume") while its value changes dynamically ("50 percent," "75 percent") as the user adjusts it, and a hint should only be used when a control's action genuinely isn't obvious from its label alone, since VoiceOver users who already understand common patterns don't benefit from (and can find tedious) an unnecessary hint on every single, self-explanatory button.

---

## 70.4 Accessibility Traits

Accessibility traits describe an element's *kind* or role (button, header, link, selected, disabled) to VoiceOver, influencing both how the element is announced (a "header" trait causes VoiceOver to announce "heading" alongside the content) and how it behaves within rotor-based navigation (70.7).

```swift
Text("Recommended Recipes")
    .accessibilityAddTraits(.isHeader)

Button("Add to Cart") { addToCart() }
    .accessibilityAddTraits(isInCart ? [.isSelected] : [])
```

Correctly applying traits like `.isHeader` genuinely matters beyond just how a single element sounds in isolation — VoiceOver users frequently navigate by heading, jumping directly between sections of a screen via the rotor rather than swiping through every single element sequentially, meaning a screen with content that's visually structured into clear sections but lacking the corresponding `.isHeader` traits denies VoiceOver users this same efficient, structure-aware navigation that sighted users get for free just by visually scanning the screen.

---

## 70.5 Grouping and Combining Elements

`.accessibilityElement(children: .combine)` merges several individual child views into a single VoiceOver-navigable element with a combined spoken description, appropriate when a group of related visual elements (an icon plus a label plus a value) genuinely represents one conceptual unit that shouldn't require several separate swipes to fully understand.

```swift
HStack {
    Image(systemName: "cart.fill")
    Text("3 items")
    Text("$45.00")
}
.accessibilityElement(children: .combine)
// VoiceOver announces this as one element: "cart, 3 items, $45.00"
// rather than three separate swipe-through elements
```

Choosing appropriately between leaving elements separate versus combining them reflects a genuine information-architecture decision about VoiceOver navigation efficiency — three separate, individually-swipeable elements ("cart" icon, "3 items," "$45.00") forces a VoiceOver user to swipe three times just to understand something a sighted user grasps in a single glance, while combining them into one coherent announcement provides the equivalent efficient, holistic understanding in a single swipe, appropriately matching the visual grouping's actual conceptual unity.

---

## 70.6 Custom Accessibility Actions

Beyond a control's default single action (activating a button), `accessibilityAction` lets additional custom actions be exposed to VoiceOver users — accessible via a rotor gesture (swiping up/down after selecting an element) — appropriate for surfacing actions that a sighted user might access via a swipe gesture, long-press, or context menu that wouldn't otherwise be discoverable through VoiceOver's standard interaction model.

```swift
Text(message.text)
    .accessibilityActions {
        Button("Reply") { reply(to: message) }
        Button("Delete") { delete(message) }
        Button("Mark Unread") { markUnread(message) }
    }
```

Custom accessibility actions address a genuine parity gap that would otherwise exist between sighted and VoiceOver interaction models — a sighted user might discover "swipe left to delete" on a message row through visual affordance or simple exploration, but that same swipe-to-reveal gesture is meaningless within VoiceOver's own distinct gesture vocabulary, making explicit custom actions the mechanism that restores equivalent functional access to the same underlying capability, regardless of which interaction mode a user relies on.

---

## 70.7 The VoiceOver Rotor

The rotor is a VoiceOver navigation mechanism (a twisting gesture, like turning a dial) letting users quickly switch between navigation modes — jumping by headings, links, form controls, or custom app-defined rotor categories — providing efficient, non-linear navigation through a screen's content rather than requiring sequential swipe-through of every element.

```swift
// Custom rotor exposing a specific navigable category beyond the system defaults:
.accessibilityRotor("Unread Messages") {
    ForEach(unreadMessages) { message in
        AccessibilityRotorEntry(message.subject, id: message.id)
    }
}
```

A custom rotor category is genuinely valuable for content with an app-specific structure that the system's default rotor categories (headings, links, form controls) don't naturally capture — a messaging app's "Unread Messages" rotor, for instance, lets a VoiceOver user jump directly between only the unread messages in a long list, mirroring the same kind of efficient, non-linear access to relevant content that the default heading-based rotor navigation (70.4) provides for section-level structure.

---

## 70.8 accessibilityRepresentation for Custom Controls

For genuinely custom controls built from primitive drawing (recall Core Graphics/Canvas from section 30, or Core Animation layers from section 62) rather than composed from standard, already-accessible SwiftUI/UIKit controls, `accessibilityRepresentation` lets a developer explicitly describe how that custom visual should be represented to assistive technology, since a hand-drawn control has no inherent accessibility semantics.

```swift
CustomDialControl(value: $temperature)
    .accessibilityRepresentation {
        Slider(value: $temperature, in: 60...80)  // presents a standard slider interface to VoiceOver
    }
```

This is a genuinely important escape hatch specifically for custom-drawn controls — a hand-rolled dial control built with `Canvas` drawing calls (section 30.8) has no automatic accessibility semantics whatsoever, since VoiceOver has no inherent understanding of arbitrary drawn pixels, and `accessibilityRepresentation` lets the developer explicitly substitute a semantically equivalent, standard representation (like a `Slider`) for VoiceOver's purposes, even though the actual visual presentation remains the fully custom drawn control.

---

## 70.9 Focus Order and Reading Order

VoiceOver's default reading order generally follows a view hierarchy's natural structure, but this default order doesn't always match a screen's actual intended visual/logical reading order (particularly with overlapping content, `ZStack` layering, or custom layouts) — `accessibilitySortPriority` lets a developer explicitly control the order elements are announced in, independent of their structural position in code.

```swift
Text("Total: $45.00")
    .accessibilitySortPriority(1)  // announced before the button below, regardless of code order
Button("Checkout") { proceedToCheckout() }
    .accessibilitySortPriority(0)
```

Getting reading order right matters because an incorrect order can produce a genuinely confusing, disorienting VoiceOver experience even when every individual element is otherwise perfectly labeled — a screen where VoiceOver announces a "Total" price *after* a "Checkout" button (an order that might make perfect sense visually, with the total displayed below the button, but poor sense read aloud sequentially) requires exactly this kind of explicit reading order correction to actually match the coherent, logical sequence a listening user needs.

---

## 70.10 Dynamic Type Across the Full Size Ramp

Dynamic Type lets users choose their preferred text size system-wide, ranging from the smallest standard size through the largest standard sizes and further into the accessibility size range (significantly larger than any standard size) — apps should support this entire range, not just the standard sizes, since users who rely on the accessibility size range genuinely need that larger text to use the app at all.

```swift
Text("Welcome back, \(userName)")
    .font(.body)  // scales automatically with the user's chosen Dynamic Type size,
                  // including the accessibility size range, without additional code
```

Testing only within the standard Dynamic Type range while neglecting the accessibility size range is a common, meaningful gap — a layout that looks fine at standard sizes can break in ways ranging from merely awkward (excessive line wrapping) to genuinely broken (truncated, cut-off, or overlapping content) at the largest accessibility sizes, meaning genuinely thorough Dynamic Type testing (recall broader localization/layout flexibility concerns from section 24) means specifically testing at the largest accessibility sizes, not just confirming that text scales at all within the more commonly tested standard range.

---

## 70.11 Reduce Motion Support

Reduce Motion is a system setting some users enable to minimize animation and motion effects, which can cause genuine discomfort (motion sickness-like symptoms) for users sensitive to parallax, large-scale movement, or certain animation styles — apps should check `UIAccessibility.isReduceMotionEnabled` and provide alternative, less motion-heavy transitions when the setting is active.

```swift
@Environment(\.accessibilityReduceMotion) var reduceMotion

var body: some View {
    someView
        .transition(reduceMotion ? .opacity : .move(edge: .trailing).combined(with: .opacity))
}
```

Respecting Reduce Motion isn't merely a stylistic preference to accommodate — for users who experience genuine physical discomfort from certain motion effects, an app ignoring this setting can make the app actively unpleasant or unusable to interact with, making Reduce Motion support a genuine accessibility requirement (not unlike accommodating a physical sensory need) rather than an optional nicety, and the fix is often as simple as swapping a large-scale, motion-heavy transition for a subtler cross-fade when the setting is active.

---

## 70.12 Reduce Transparency and Increase Contrast

Reduce Transparency reduces or eliminates blur/translucency effects (which can reduce legibility for some users, particularly interacting poorly with certain visual impairments), while Increase Contrast strengthens color and border contrast throughout the system — both settings that well-behaved apps should observe via `UIAccessibility.isReduceTransparencyEnabled` and `UIAccessibility.isDarkerSystemColorsEnabled` respectively.

```swift
@Environment(\.accessibilityReduceTransparency) var reduceTransparency

var backgroundMaterial: Material {
    reduceTransparency ? .opaque(.regularMaterial) : .regularMaterial
    // conceptually: substitute a solid, opaque background when transparency is reduced
}
```

These two settings address genuinely distinct visual accessibility needs, both worth explicit support — translucent, blurred backgrounds (recall the Liquid Glass design material from section 32) can reduce text legibility against a busy or low-contrast background for some users, while insufficient contrast more broadly affects users with various visual impairments regardless of transparency specifically, meaning apps built heavily around translucent materials benefit from explicitly testing and providing solid alternatives when Reduce Transparency is active, rather than assuming a design that looks fine to the designer looks equally legible to every user.

---

## 70.13 Differentiate Without Color

Differentiate Without Color addresses the reality that color-only encoding of meaning (a red versus green status indicator, with no other visual distinction) is inaccessible to users with certain forms of color blindness — apps should pair color with a redundant, non-color signal (an icon, a shape, a text label) so meaning remains clear even without relying on color perception.

```swift
HStack {
    Image(systemName: isError ? "xmark.circle.fill" : "checkmark.circle.fill")
        .foregroundStyle(isError ? .red : .green)
    Text(isError ? "Failed" : "Success")
}
// meaning is conveyed by icon shape AND text, not solely by the red/green color difference
```

This principle directly parallels a broader design pattern already established for accessibility traits (70.4) and labels (70.2) — just as VoiceOver users need a non-visual (spoken) equivalent of visual information, users with color vision deficiencies need a non-color-dependent equivalent of color-encoded information, and in both cases the underlying design discipline is the same: never let a single sensory channel (sight generally, or color specifically) be the *sole* carrier of meaningful information, always providing a redundant path to the same understanding.

---

## 70.14 Minimum Tap Target Sizes

Apple's Human Interface Guidelines specify a minimum recommended tap target size (44×44 points) for interactive elements, ensuring controls remain reliably tappable for users with limited fine motor control or larger fingers — a visually small icon or button should still have its actual tappable area meet this minimum, even if the icon itself is rendered smaller.

```swift
Button(action: dismiss) {
    Image(systemName: "xmark")
        .font(.system(size: 16))  // small, visually appropriate icon...
}
.frame(minWidth: 44, minHeight: 44)  // ...but with a tappable area meeting the minimum target size
```

The distinction between visual size and tappable area size is the key technique here — a designer might reasonably want a small, unobtrusive close icon visually, but expanding the actual interactive frame beyond the icon's own visible bounds (rather than shrinking the tappable area to match the small icon exactly) preserves both the intended visual design and genuine usability for users who would otherwise struggle to reliably hit an undersized tap target, a real accessibility concern independent of any assistive technology specifically.

---

## 70.15 Switch Control and Voice Control

Switch Control lets users navigate and interact with iOS using one or more physical switches (appropriate for users with limited mobility who can't use touch directly), scanning through interactive elements sequentially and selecting via a switch activation, while Voice Control lets users navigate and interact entirely through spoken commands — both depending on the same underlying accessibility properties (labels, traits) already covered in this section to function correctly.

```swift
// Both Switch Control and Voice Control rely on the same accessibility labels/traits
// already established for VoiceOver support — a well-labeled button
// ("Add to Cart") is both correctly announced by VoiceOver AND
// correctly invokable by saying "Tap Add to Cart" under Voice Control
```

This shared dependency on the same underlying accessibility metadata is a genuinely important, easy-to-miss point — the accessibility labeling and trait work already done to support VoiceOver (70.2, 70.4) isn't VoiceOver-specific investment at all, but rather foundational accessibility infrastructure that simultaneously benefits Switch Control and Voice Control users too, meaning correctly implementing accessibility labels once provides multiplied benefit across several genuinely distinct assistive technologies rather than requiring separate, redundant work for each one.

---

## 70.16 Full Keyboard Access

Full Keyboard Access lets users navigate and control iOS (including apps) entirely via an external physical keyboard, without needing to touch the screen at all — appropriate for users who find touch interaction difficult but can use a keyboard, requiring that all interactive elements be genuinely reachable and operable via keyboard focus navigation and standard activation keys.

```swift
// SwiftUI's standard focus system (recall .focusable(), .focused()) generally
// provides Full Keyboard Access support automatically for standard controls;
// custom controls need explicit .focusable() and key-handling to participate correctly
Button("Save") { save() }
    .focusable()  // ensures the button participates correctly in keyboard focus navigation
```

Like Switch Control and Voice Control (70.15), Full Keyboard Access largely builds on infrastructure already needed for other accessibility purposes — standard SwiftUI controls generally participate in keyboard focus navigation automatically with no additional work, meaning the specific area requiring deliberate developer attention is genuinely custom, non-standard controls (much like the custom-control accessibility representation concern from 70.8), which need explicit `.focusable()` support and appropriate key-event handling to be genuinely usable under Full Keyboard Access.

---

## 70.17 The Accessibility Inspector

The Accessibility Inspector (a standalone macOS tool, also integrated into Xcode) lets a developer inspect any running app's actual accessibility tree — viewing each element's label, value, traits, and hierarchy directly, and running automated accessibility audits — providing much of the same diagnostic value for accessibility that the View Hierarchy Debugger (section 68.12) provides for layout.

```swift
// Not a Swift API — accessed via Xcode > Open Developer Tool > Accessibility Inspector,
// or directly running an automated audit against a running simulator/device,
// surfacing issues like missing labels, insufficient contrast, and undersized tap targets
```

The Accessibility Inspector's automated audit capability directly parallels `performAccessibilityAudit()` from UI testing (section 67.9) — both surface the same broad categories of accessibility issue (missing labels, contrast problems, undersized targets), with the Inspector providing an interactive, exploratory tool for accessibility investigation during development, while `performAccessibilityAudit()` provides the equivalent check as an automated, continuously-run assertion integrated directly into a UI test suite, the two tools complementing each other across different points in the development workflow.

---

## 70.18 Accessibility Nutrition Labels on the App Store

Accessibility Nutrition Labels let developers declare, on an app's App Store listing, which specific accessibility features the app actually supports (VoiceOver, Voice Control, larger text, sufficient contrast, and others) — giving users with disabilities visibility into an app's accessibility support *before* downloading it, rather than discovering accessibility gaps only after installation.

```swift
// Declared via App Store Connect, not Swift code — developers select which
// accessibility features (VoiceOver support, Voice Control support,
// Larger Text support, Sufficient Contrast, Reduced Motion support, etc.)
// their app genuinely and accurately supports
```

Accurate self-declaration here carries genuine weight beyond a simple marketing checkbox — a user with a disability relying on VoiceOver can use Accessibility Nutrition Labels to make an informed decision about whether an app is actually likely to be usable *before* investing time downloading and attempting to use it, meaning honestly and accurately declaring supported features (rather than over-claiming support the app doesn't genuinely, thoroughly provide) directly affects real users' ability to make good decisions about which apps to trust and try.

---

## 70.19 Captions and Audio Descriptions for Media 🟠

For apps presenting video or audio content (recall `AVPlayer`/`VideoPlayer` from section 55.8), captions (text representation of spoken dialogue and relevant sound effects) and audio descriptions (a supplementary narration track describing visually-important content for users who can't see the video) provide access to media content for deaf/hard-of-hearing and blind/low-vision users respectively.

```swift
// AVPlayerItem can be configured with accessible media selection options,
// including caption tracks and, where available, audio description tracks,
// with AVPlayerViewController providing standard, accessible UI for track selection
let playerItem = AVPlayerItem(url: videoURL)
// Caption/audio-description tracks embedded in the media asset are exposed
// through AVMediaSelectionGroup, letting VoiceOver users select them via
// the standard playback controls' accessible track-selection UI
```

Captions and audio descriptions address two genuinely distinct accessibility needs, each requiring media actually authored to include the relevant track in the first place (this isn't something an app can add automatically to arbitrary video content it didn't produce) — captions provide deaf/hard-of-hearing users access to a video's spoken and sound content, while audio descriptions provide blind/low-vision users access to visually-conveyed information a video might never verbally state (an on-screen action, a visual sight gag, text shown briefly on screen), making both genuinely necessary, complementary accommodations rather than either alone being fully sufficient for comprehensive media accessibility.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Foundational testing | VoiceOver navigation | Surfaces problems code review alone would miss |
| Spoken identity | `accessibilityLabel` | Bridges visual meaning to spoken equivalent |
| State and guidance | `accessibilityValue`, `accessibilityHint` | Current state and non-obvious action guidance |
| Role/kind | `accessibilityAddTraits` | Enables structure-aware rotor navigation |
| Unit cohesion | `.accessibilityElement(children: .combine)` | Merges related elements into one coherent announcement |
| Hidden actions | `accessibilityActions` | Restores parity for swipe/long-press/context menu actions |
| Non-linear navigation | VoiceOver rotor, custom rotors | Efficient jumping through app-specific content categories |
| Custom control semantics | `accessibilityRepresentation` | Substitutes standard semantics for hand-drawn controls |
| Logical sequencing | `accessibilitySortPriority` | Corrects reading order independent of code structure |
| Text scaling | Dynamic Type, accessibility sizes | Full-range support, not just standard sizes |
| Motion sensitivity | Reduce Motion | Alternative, less motion-heavy transitions |
| Legibility/contrast | Reduce Transparency, Increase Contrast | Solid alternatives and stronger contrast |
| Non-color signaling | Differentiate Without Color | Redundant, non-color-dependent meaning |
| Physical usability | 44×44pt minimum tap targets | Reliable interaction regardless of visual icon size |
| Alternative input | Switch Control, Voice Control | Built on the same underlying labels/traits |
| Keyboard-only use | Full Keyboard Access, `.focusable()` | Complete non-touch operability |
| Diagnostic tooling | Accessibility Inspector | Interactive, exploratory accessibility investigation |
| Pre-download transparency | Accessibility Nutrition Labels | Honest, informed user decision-making |
| Media accessibility | Captions, audio descriptions | Distinct, complementary accommodations for media content |
