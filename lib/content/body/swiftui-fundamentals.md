**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 23.1 The `View` Protocol and `body` 🟢

Every SwiftUI view is a type that conforms to the **`View`** protocol. It has **one requirement**: a computed property named **`body`** that describes what the view shows, **built from other views**.

```swift
struct GreetingView: View {
    var body: some View {
        Text("Hello, SwiftUI!")
    }
}
```

The return type **`some View`** (an opaque type, 8.7) means: "**one specific view type**, decided by what's written inside, but callers don't need to know which." That's why every view can use the same `some View` signature, whether `body` returns a `Text`, or a `VStack` holding ten other views.

Views are usually small **structs** with **inputs** (properties) and a `body`:

```swift
struct RecipeRow: View {
    let title: String
    let minutes: Int

    var body: some View {
        VStack(alignment: .leading) {
            Text(title).font(.headline)
            Text("\(minutes) min").foregroundStyle(.secondary)
        }
    }
}

// Using it:
RecipeRow(title: "Pancakes", minutes: 20)
```

**Small views are cheap.** Split big `body`s into small, named views. It's easier to read, and SwiftUI can update each piece separately.

---

## 23.2 Views Are Descriptions, Not Objects 🟢

In UIKit, a `UIView` is a **real object** that lives on screen; you **change** it after creating it. A SwiftUI `View` is a **lightweight description** of what should appear. SwiftUI **creates and throws away** these descriptions all the time: whenever the state changes, it computes a **new `body`**, **compares** it with the old one, and updates only what changed on screen.

```swift
struct CounterView: View {
    var count: Int

    var body: some View {
        Text("Count: \(count)")   // this Text VALUE is recreated fresh every time body is computed
    }
}
```

The mental shift from UIKit:

```swift
// UIKit: change the object
label.text = "Count: \(count)"

// SwiftUI: describe the screen for the current state; SwiftUI does the rest
Text("Count: \(count)")
```

```plaintext
state changes  →  SwiftUI calls body  →  new description  →  compare with old  →  update the screen
```

So in SwiftUI you **never** "update the label". You change the **state**, and the description follows. Section 25 covers which state changes trigger a new `body`.

Two consequences:

- `body` can run **often**. Keep it **fast** and **free of side effects** (no network calls inside `body`).
- Don't keep references to views to change them later. There's nothing to keep.

---

## 23.3 `Text` and Text Styling 🟢

**`Text`** shows a string. It has modifiers for text styling:

```swift
Text("Hello, World!")
    .font(.title)
    .fontWeight(.bold)
    .foregroundStyle(.blue)
    .italic()
    .underline()
    .strikethrough()
```

A **string literal** in `Text` supports **Markdown**, for mixed styles and links (14.17):

```swift
Text("This is **bold** and this is *italic*")   // Markdown syntax works directly in Text's string literal
Text("Read the [terms](https://example.com/terms).")   // a tappable link
```

Useful text modifiers for real layouts:

```swift
Text(recipe.description)
    .lineLimit(2)                       // at most 2 lines, then "…"
    .multilineTextAlignment(.leading)
    .truncationMode(.tail)

Text(price, format: .currency(code: "USD"))   // formatting built in (14.14)
Text(date, style: .relative)                  // "5 minutes ago", updates itself
```

You can even join `Text` values with `+`, each with its own style:

```swift
Text("Total: ").foregroundStyle(.secondary) + Text("$12.50").bold()
```

---

## 23.4 `Image` and Image Scaling Modes 🟢

**`Image`** shows an image from the asset catalog, an **SF Symbol** (23.5), or a system image. You must **configure** how it fits its frame:

```swift
Image("myPhoto")           // from the asset catalog
    .resizable()             // without this, the image renders at its native pixel size, ignoring .frame()
    .aspectRatio(contentMode: .fit)    // scales to fit entirely within the frame, preserving aspect ratio
    .frame(width: 200, height: 200)

Image("myPhoto")
    .resizable()
    .aspectRatio(contentMode: .fill)   // scales to fill the frame entirely, cropping if necessary
    .frame(width: 200, height: 200)
    .clipped()                          // without this, the overflowing portion still renders outside the frame
```

| Mode | Result |
|---|---|
| `.fit` (`.scaledToFit()`) | The whole image is visible; may leave empty space |
| `.fill` (`.scaledToFill()`) | The frame is full; the image may be **cropped** (add `.clipped()`) |

**Forgetting `.resizable()`** is the classic mistake: without it, an image always draws at its **original size**, and `.frame()` seems to do nothing.

A common pattern: a round profile picture:

```swift
Image("avatar")
    .resizable()
    .scaledToFill()
    .frame(width: 64, height: 64)
    .clipShape(.circle)
```

Decorative images should be hidden from VoiceOver; meaningful ones need a label (section 70):

```swift
Image(decorative: "background-pattern")
Image("chart").accessibilityLabel("Sales grew 20% this month")
```

---

## 23.5 SF Symbols and Symbol Configuration 🟢

**SF Symbols** are Apple's built-in icons, thousands of them, used with **`Image(systemName:)`**. Browse them in the free **SF Symbols** Mac app.

```swift
Image(systemName: "star.fill")
    .font(.largeTitle)              // symbols scale with font size, unlike photo images
    .foregroundStyle(.yellow)

Image(systemName: "heart.fill")
    .symbolRenderingMode(.multicolor)   // some symbols support built-in multi-color rendering

Image(systemName: "wifi")
    .symbolVariant(.slash)              // applies a variant, e.g. "wifi.slash" without hardcoding the string
```

Symbols are **vectors**, sized like **text**. They follow the font and **Dynamic Type** (23.13), so they grow for users with larger text, with no extra work. A fixed-size photo can't do that.

Rendering modes:

| Mode | Look |
|---|---|
| `.monochrome` | One color (the default) |
| `.hierarchical` | One color in several opacities, for depth |
| `.palette` | Your own color per layer |
| `.multicolor` | The symbol's built-in colors |

Symbols can also **animate**:

```swift
Image(systemName: "bell.fill")
    .symbolEffect(.bounce, value: notificationCount)   // bounces each time the count changes

Image(systemName: "wifi")
    .symbolEffect(.variableColor.iterative)            // a "searching" animation
```

Match symbols to text with `.imageScale`:

```swift
Label("Downloads", systemImage: "arrow.down.circle")
    .imageScale(.large)
```

---

## 23.6 `Label` and Its Layout Styles 🟢

**`Label`** combines an **icon** and **text** into **one unit**. It's more than a shortcut: for **VoiceOver**, it's **one element** with a clear name, not two separate things.

```swift
Label("Settings", systemImage: "gear")

Label("Favorites", systemImage: "star.fill")
    .labelStyle(.iconOnly)     // shows only the icon, hides the text (but keeps it for accessibility)

Label("Favorites", systemImage: "star.fill")
    .labelStyle(.titleOnly)    // shows only the text, hides the icon
```

The system uses `Label` everywhere: tab bar items, list rows with icons, toolbar buttons. Often the **container** decides the style for you:

```swift
TabView {
    HomeView()
        .tabItem { Label("Home", systemImage: "house") }    // icon + title in the tab bar
}

.toolbar {
    Button { share() } label: {
        Label("Share", systemImage: "square.and.arrow.up")  // icon in the toolbar, text for VoiceOver
    }
}
```

Compare with building it yourself:

```swift
// ❌ Two separate elements; VoiceOver may read "gear, image" and "Settings" separately
HStack { Image(systemName: "gear"); Text("Settings") }

// ✅ One element named "Settings"; the style adapts to where it's used
Label("Settings", systemImage: "gear")
```

---

## 23.7 What a View Modifier Is 🟢

A **view modifier** is a method that takes a view and returns a **new view** that **wraps** it, adding behavior or appearance. Modifiers **don't change** the original view (views are descriptions, 23.2). Each one makes a **new, wrapped** description.

```swift
Text("Hello")
    .padding()              // wraps Text in a new view adding padding around it
    .background(.blue)       // wraps that padded view in a new view adding a blue background
    .clipShape(.rect(cornerRadius: 8))   // wraps that in a new view clipping corners
```

Under the hood, each step creates a nested type. You can see it:

```swift
let view = Text("Hello").padding().background(.blue)
print(type(of: view))
// ModifiedContent<ModifiedContent<Text, _PaddingLayout>, _BackgroundStyleModifier<Color>>
```

`some View` (23.1) hides this long type, so you never have to write it.

You can make **your own** modifiers for styles you repeat:

```swift
struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding()
            .background(.background.secondary)
            .clipShape(.rect(cornerRadius: 12))
            .shadow(radius: 2)
    }
}

extension View {
    func cardStyle() -> some View { modifier(CardStyle()) }
}

Text("Pancakes").cardStyle()
```

---

## 23.8 Modifier Order Matters — A Demo 🟢

Each modifier wraps the **result so far**. They don't all apply to the original view at once. So **the order changes the result**. This confuses many newcomers.

```swift
// Padding BEFORE background: the background color extends to cover the padding too
Text("Hello")
    .padding()
    .background(.blue)
// Result: a blue rectangle with padding INSIDE it, around the text

// Background BEFORE padding: the background only covers the text's original bounds;
// the padding then adds transparent space OUTSIDE that colored rectangle
Text("Hello")
    .background(.blue)
    .padding()
// Result: a small blue rectangle tightly around the text, with transparent padding around THAT
```

```plaintext
.padding().background(.blue)          .background(.blue).padding()

┌───────────────┐                      ┌───────────────┐
│███████████████│                      │               │
│███ Hello █████│                      │   ███████     │
│███████████████│                      │   █Hello█     │
└───────────────┘                      │   ███████     │
                                       └───────────────┘
```

Another classic: a frame and a border:

```swift
Text("Hi").border(.red).frame(width: 200)   // border hugs the text
Text("Hi").frame(width: 200).border(.red)   // border is 200 wide
```

**The mental model:** read the chain **top to bottom** as "**wrap** the previous result in this". Each step works on everything **above** it, not on the original `Text`.

---

## 23.9 Colors and Semantic System Colors 🟢

SwiftUI's **`Color`** has **fixed** colors (`.red`, `.blue`, `Color(red:green:blue:)`) and **semantic** colors that **adapt** automatically, most importantly between **light and dark mode** (23.16).

```swift
Text("Hello")
    .foregroundStyle(.primary)      // adapts: near-black in light mode, near-white in dark mode
    .background(Color(.systemBackground))   // adapts: white in light mode, near-black in dark mode

Text("Subtitle")
    .foregroundStyle(.secondary)     // a dimmer, adaptive variant of .primary, for de-emphasized text
```

| Use | Instead of |
|---|---|
| `.primary`, `.secondary`, `.tertiary` | `.black`, `.gray` |
| `.background`, `Color(.systemBackground)` | `.white` |
| `.tint` (the app's accent color) | A hard-coded blue |

**Prefer semantic colors.** Your view is then correct in **light and dark mode**, and respects settings like **Increase Contrast**, with no `if` checks.

Your **own brand colors** can adapt too: add a **Color Set** in the asset catalog with a light and a dark variant, then use it by name:

```swift
Text("Welcome").foregroundStyle(Color("BrandPrimary"))   // light/dark versions from the asset catalog
// Xcode also generates a symbol: .foregroundStyle(.brandPrimary)
```

Set the app-wide accent color with `.tint`:

```swift
ContentView()
    .tint(.orange)          // buttons, links, toggles use orange
```

---

## 23.10 `.foregroundStyle()` and Hierarchical Styles 🟡

**`.foregroundStyle()`** (the modern replacement for `.foregroundColor()`) takes a **style**, not just a color. That includes **hierarchical** styles that build matching shades from one base, and gradients.

```swift
Image(systemName: "cloud.sun.fill")
    .foregroundStyle(.blue, .yellow)   // multiple styles, applied to a symbol's distinct layers

Text("Title")
    .foregroundStyle(.primary)

Text("Subtitle")
    .foregroundStyle(.secondary)   // hierarchical: automatically a dimmer variant relative to .primary
```

For multi-layer SF Symbols, it accepts up to **three** styles (primary, secondary, tertiary layers):

```swift
Image(systemName: "person.crop.circle.badge.plus")
    .symbolRenderingMode(.palette)
    .foregroundStyle(.white, .blue, .green)
```

A style set on a **container** flows down to its children. Children can then use `.secondary` **relative to it**:

```swift
VStack {
    Text("Order shipped")             // uses the container's style (orange)
    Text("Arrives Friday")
        .foregroundStyle(.secondary)  // a dimmer orange
}
.foregroundStyle(.orange)
```

Gradients work too, anywhere a style is accepted:

```swift
Text("Premium")
    .font(.largeTitle.bold())
    .foregroundStyle(.linearGradient(colors: [.purple, .pink], startPoint: .leading, endPoint: .trailing))
```

---

## 23.11 Gradients: Linear, Radial, Angular 🟢

SwiftUI has three gradient types. Use them anywhere a **`ShapeStyle`** is expected: backgrounds, foreground styles, shape fills.

```swift
LinearGradient(
    colors: [.blue, .purple],
    startPoint: .top,
    endPoint: .bottom
)

RadialGradient(
    colors: [.yellow, .orange],
    center: .center,
    startRadius: 0,
    endRadius: 200
)

AngularGradient(
    colors: [.red, .orange, .yellow, .green, .blue, .purple, .red],
    center: .center
)

Text("Hello")
    .padding()
    .background(LinearGradient(colors: [.blue, .purple], startPoint: .leading, endPoint: .trailing))
```

| Gradient | Changes color |
|---|---|
| `LinearGradient` | Along a straight line |
| `RadialGradient` | Outward from a center point |
| `AngularGradient` | Around a center, like a color wheel |

For exact control, use **stops** (where each color is placed, from 0 to 1):

```swift
LinearGradient(
    stops: [
        .init(color: .clear, location: 0),
        .init(color: .black.opacity(0.7), location: 1),
    ],
    startPoint: .top,
    endPoint: .bottom
)
```

That one is a classic: a **dark fade** at the bottom of a photo, so white text on top stays readable.

There's also a quick, subtle system gradient from any color:

```swift
Rectangle().fill(.blue.gradient)
```

---

## 23.12 Fonts and Text Styles 🟢

**`.font()`** accepts fixed sizes and **text styles**. Text styles (`.largeTitle`, `.title`, `.headline`, `.body`, `.caption`, ...) are **semantic** sizes that **scale with Dynamic Type** (23.13). A fixed point size doesn't.

```swift
Text("Heading")
    .font(.largeTitle)          // semantic — scales with Dynamic Type

Text("Custom size")
    .font(.system(size: 24))    // fixed — does NOT scale with Dynamic Type

Text("Custom weight")
    .font(.title.weight(.bold))  // text styles support chaining weight/design modifications

Text("Custom design")
    .font(.body.monospaced())     // or a monospaced/rounded/serif design variant
```

The text styles, from biggest to smallest:

```plaintext
.largeTitle  .title  .title2  .title3  .headline  .body  .callout  .subheadline  .footnote  .caption  .caption2
```

**Use text styles for almost all app text.** It's the easiest big accessibility win (section 70).

If you need a **custom font** or size, make it scale **relative to** a text style:

```swift
Text("Brand heading")
    .font(.custom("Avenir-Heavy", size: 28, relativeTo: .title))   // scales like .title

@ScaledMetric(relativeTo: .body) private var iconSize = 24.0       // a number that scales too
Image(systemName: "star").font(.system(size: iconSize))
```

---

## 23.13 Dynamic Type and Scalable Text 🟢

**Dynamic Type** is the system setting (**Settings → Accessibility → Display & Text Size → Larger Text**) that lets users make text **bigger or smaller** in every app. SwiftUI's text styles (23.12) follow it **automatically**:

```swift
Text("This text scales automatically")
    .font(.body)   // will grow noticeably larger if the user has increased their Dynamic Type setting
```

Test larger sizes in Previews with **`.dynamicTypeSize`**:

```swift
#Preview("Accessibility size") {
    RecipeRow(title: "Pancakes with maple syrup", minutes: 20)
        .dynamicTypeSize(.accessibility3)
}
```

Check that at large sizes your layout **doesn't break, cut off text, or overlap**. A common fix is switching from horizontal to vertical:

```swift
struct InfoRow: View {
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let layout = typeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading))
            : AnyLayout(HStackLayout())

        layout {
            Text("Prep time")
            Spacer()
            Text("20 min").foregroundStyle(.secondary)
        }
    }
}
```

You can also limit the range for a specific view, when a design truly can't grow:

```swift
Text("Tab").dynamicTypeSize(...DynamicTypeSize.xxxLarge)   // use sparingly
```

More in section 70.10.

---

## 23.14 Xcode Previews with `#Preview` 🟢

**`#Preview`** is a macro (13.2) that shows a **live preview** of a view in Xcode's **canvas**, without building and running the whole app:

```swift
struct GreetingView: View {
    var body: some View {
        Text("Hello, SwiftUI!")
    }
}

#Preview {
    GreetingView()
}
```

Previews use the **real rendering engine**, update **as you type**, and are **interactive** (tap buttons, scroll). That makes UI work **much faster** than relaunching a simulator for every small change.

Give previews **sample data**, so they don't need a network or database:

```swift
extension Recipe {
    static let sample = Recipe(title: "Pancakes", minutes: 20)
}

#Preview {
    RecipeRow(title: Recipe.sample.title, minutes: Recipe.sample.minutes)
}
```

For views that need **state** (like a binding), use **`@Previewable`**:

```swift
#Preview {
    @Previewable @State var isOn = true
    Toggle("Notifications", isOn: $isOn)
}
```

Tip: if previews are slow or crash, check that the view doesn't start **real** network calls or heavy work on appear. Inject a fake service instead (section 47).

---

## 23.15 Multiple Previews and Preview Traits 🟡

One file can have **several** `#Preview` blocks, each set up differently. You can check many **states**, **devices**, and **settings** side by side:

```swift
#Preview("Light Mode") {
    GreetingView()
}

#Preview("Dark Mode") {
    GreetingView()
        .preferredColorScheme(.dark)
}

#Preview("Large Text", traits: .sizeThatFitsLayout) {
    GreetingView()
        .dynamicTypeSize(.accessibility2)
}
```

Preview **traits** set up the **canvas** itself, separate from the view's content:

| Trait | Effect |
|---|---|
| `.sizeThatFitsLayout` | The canvas is just as big as the view (great for rows and cards) |
| `.fixedLayout(width:height:)` | A fixed canvas size |
| `.landscapeLeft` | Rotated device |

Preview **states** that are hard to reach in the running app:

```swift
#Preview("Loading") { RecipeListView(state: .loading) }
#Preview("Empty")   { RecipeListView(state: .loaded([])) }
#Preview("Error")   { RecipeListView(state: .failed("No connection")) }
```

Previews for **other languages** and **right-to-left** layout:

```swift
#Preview("Arabic") {
    GreetingView()
        .environment(\.locale, Locale(identifier: "ar"))
        .environment(\.layoutDirection, .rightToLeft)
}
```

---

## 23.16 Dark Mode and `.colorScheme` 🟢

SwiftUI adapts **semantic colors** (23.9) to light and dark mode by itself. Sometimes a view needs **different logic** (not just colors) per mode. Read the current mode from the **environment**, or force a mode:

```swift
struct AdaptiveView: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Text("Current mode: \(colorScheme == .dark ? "Dark" : "Light")")
            .background(colorScheme == .dark ? Color.black : Color.white)
    }
}

// force a specific appearance regardless of the system setting, e.g. for a preview or a fixed-theme screen:
SomeView()
    .preferredColorScheme(.dark)
```

`@Environment(\.colorScheme)` (environment values are covered in 25.6) reads the current appearance in `body`.

**Use explicit checks only when colors aren't enough**, for example choosing a **different image**:

```swift
Image(colorScheme == .dark ? "logo-dark" : "logo-light")
```

Even this can often be done in the **asset catalog**, with light and dark variants of the same image. Then `Image("logo")` picks the right one automatically, with **no code**.

`.preferredColorScheme` affects the **whole presentation** (the window or sheet), not just one view. Use it for a deliberately dark screen, like a video player, or for previews.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `View` protocol/`body` | One requirement: a `some View` property built from other views |
| Views as descriptions | Cheap values recreated on each change, not objects you mutate |
| `Text` | Styling modifiers, Markdown, formatting, and line limits |
| `Image` | `.resizable()` first; `.fit` shows all, `.fill` crops |
| SF Symbols | Vector icons that scale with text; rendering modes and effects |
| `Label` | Icon + text as one accessible unit |
| View modifiers | Each wraps the previous view; make your own with `ViewModifier` |
| Modifier order | Order changes the result; read the chain top to bottom |
| Semantic colors | `.primary`, `.secondary`, `.background` adapt to light, dark, and contrast |
| `.foregroundStyle()` | Hierarchical, multi-layer, and gradient styles |
| Gradients | Linear, radial, angular; stops for exact control |
| Fonts/text styles | Text styles scale with Dynamic Type; custom fonts use `relativeTo:` |
| Dynamic Type | Test big sizes; switch layouts with `AnyLayout` when needed |
| `#Preview` | Live, interactive previews; use sample data and `@Previewable` |
| Multiple previews/traits | Preview states, sizes, languages, and modes side by side |
| `.colorScheme` | Read it only when colors alone aren't enough |
