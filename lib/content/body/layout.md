**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

SwiftUI layout is a short talk between views. A **parent offers a size**, the **child picks its own size**, and the parent **places** the child. Stacks, frames, padding, and `GeometryReader` all follow this one rule (24.8). Once you know it, most "strange" layout results make sense.

---

## 24.1 `VStack`, `HStack`, `ZStack` 🟢

The three basic **containers** place their children in a line **down** (`VStack`), **across** (`HStack`), or **on top of each other** (`ZStack`):

```swift
VStack {
    Text("First")
    Text("Second")
}

HStack {
    Image(systemName: "star")
    Text("Favorite")
}

ZStack {
    Color.blue
    Text("On top")   // drawn above Color.blue, because it comes later
}
```

In a `ZStack`, **later children are drawn on top** of earlier ones. To change that without reordering the code, use `.zIndex()`:

```swift
ZStack {
    Text("Back").zIndex(1)   // now drawn above "Front"
    Text("Front")
}
```

A real example, a card with a photo and a caption on top:

```swift
ZStack(alignment: .bottomLeading) {
    Image("beach")
        .resizable()
        .scaledToFill()
    Text("Summer trip")
        .font(.headline)
        .foregroundStyle(.white)
        .padding()
}
.frame(height: 200)
.clipShape(.rect(cornerRadius: 16))
```

Stacks only build what you give them, all at once. For **long, scrolling** content, use **lazy** stacks and `List` (section 26).

---

## 24.2 `Spacer` and How It Grows 🟢

A **`Spacer`** is an **invisible view** that **grows** to fill free space along its stack's direction. It **pushes** its neighbors apart:

```swift
HStack {
    Text("Left")
    Spacer()                 // takes all the free space
    Text("Right")
}                            // "Left" at one edge, "Right" at the other

HStack {
    Text("A")
    Spacer(minLength: 20)    // at least 20 points, more if there's room
    Text("B")
}
```

When there are **several** spacers, they **share** the free space **equally**:

```swift
HStack {
    Spacer()
    Text("Centered")
    Spacer()
}                            // equal space on both sides → centered

VStack {
    Spacer()
    Text("Bottom-ish")
    Spacer()
    Spacer()                 // two spacers below, one above → text sits at about 1/3 from the top
}
```

A `Spacer` in a `VStack` grows **up and down**; in an `HStack`, **left and right**. A `Spacer` **outside** a stack has no direction, so it grows both ways.

---

## 24.3 Stack Alignment 🟢

The `alignment` parameter lines children up on the **other axis** (the cross-axis):

- `VStack` → **horizontal** alignment (`.leading`, `.center`, `.trailing`)
- `HStack` → **vertical** alignment (`.top`, `.center`, `.bottom`, and text baselines)

```swift
VStack(alignment: .leading) {
    Text("Short")
    Text("A much longer line of text")
}
// both lines start at the left edge (the default is .center)

HStack(alignment: .top) {
    Text("Short")
    Text("A much\ntaller\nmulti-line text")
}
// both line up at their top edges
```

For text with **different font sizes**, align on the **baseline** (the line letters sit on). It looks much better:

```swift
HStack(alignment: .firstTextBaseline) {
    Text("$42").font(.largeTitle)
    Text("per month").font(.caption)
}
```

A `ZStack` has no main direction, so its `alignment` is **2D**: `.topLeading`, `.bottomTrailing`, `.center`, and so on.

```swift
ZStack(alignment: .topTrailing) {
    Image(systemName: "bell").font(.largeTitle)
    Circle().fill(.red).frame(width: 12, height: 12)   // a badge in the top-right corner
}
```

---

## 24.4 Stack Spacing and `Divider` 🟢

`spacing` sets a **fixed gap** between children. A `Spacer` is a **flexible** gap that grows. **`Divider`** draws a thin line **across** the stack:

```swift
VStack(spacing: 16) {
    Text("First")
    Divider()          // a horizontal line, because it's in a VStack
    Text("Second")
}

HStack(spacing: 8) {
    Text("Left")
    Divider()          // a vertical line, because it's in an HStack
    Text("Right")
}
.frame(height: 24)     // a Divider grows to fill its space, so limit the height
```

The default is `spacing: nil`. That's **not zero**: SwiftUI picks a **standard gap** for each pair of children. Use `spacing: 0` when you really want views to touch:

```swift
VStack(spacing: 0) {
    HeaderView()
    ContentView()      // no gap between header and content
}
```

| You want | Use |
|---|---|
| The same fixed gap between all children | `spacing:` |
| A gap that grows to fill space | `Spacer()` |
| A visible line between children | `Divider()` |
| Extra space around one child only | `.padding()` on that child |

---

## 24.5 `.padding()` Variations 🟢

`.padding()` adds **space around** a view. You can choose **which edges** and **how much**:

```swift
Text("Hello").padding()                         // standard space on all four edges
Text("Hello").padding(20)                       // 20 points on all edges
Text("Hello").padding(.horizontal, 20)          // 20 points on leading and trailing only
Text("Hello").padding(.top, 10)                 // 10 points on top only
Text("Hello").padding([.top, .leading], 8)      // a set of edges
Text("Hello").padding(EdgeInsets(top: 5, leading: 10, bottom: 5, trailing: 10))   // each edge its own value
```

Remember 23.8: **order matters**. Padding **before** `.background()` makes the background **bigger**. Padding **after** adds space **outside** it:

```swift
Text("Tag")
    .padding(.horizontal, 12)
    .padding(.vertical, 6)
    .background(.blue.opacity(0.15), in: .capsule)   // a pill-shaped tag
    .padding(4)                                       // space outside the pill
```

Plain `.padding()` uses a **system** value that can differ between platforms. Use fixed numbers when a design needs exact spacing.

---

## 24.6 `.frame()` Fixed Sizing 🟢

`.frame(width:height:)` **wraps** the view in a new, invisible **frame** of that size. The frame **is** that size. The **content inside** still picks its own size, and is **centered** in the frame by default:

```swift
Text("Hello")
    .frame(width: 200, height: 100)
    .background(.blue)        // the blue fills 200×100; the text stays small, in the center

Circle()
    .frame(width: 50, height: 50)   // a Circle is flexible, so it fills the 50×50 frame

Text("Hello")
    .frame(width: 200, height: 100, alignment: .topLeading)   // text in the top-left corner of the frame
```

This is why `.frame()` sometimes "doesn't work". The frame changed, but the content didn't want to grow:

```swift
Image("photo")
    .frame(width: 100, height: 100)   // ❌ the image still draws at its full size and spills out

Image("photo")
    .resizable()                      // ✅ now the image accepts the offered size
    .scaledToFit()
    .frame(width: 100, height: 100)
```

You can set **only one** side. The other comes from the content:

```swift
Text("A long title that will wrap onto more lines")
    .frame(width: 120)                // width fixed, height grows to fit the wrapped lines
```

---

## 24.7 `.frame(maxWidth: .infinity)` and Flexible Sizing 🟢

**Flexible** frames take **min** and **max** values. `.frame(maxWidth: .infinity)` means "**take all the width you're offered**". It's the most common way to stretch a view:

```swift
Text("Hello")
    .frame(maxWidth: .infinity, alignment: .leading)   // full width, text on the leading side
    .background(.blue)                                   // the blue now spans the whole width

Rectangle()
    .frame(maxWidth: .infinity, maxHeight: .infinity)   // fills all space in both directions
```

Only the **frame** grows. The **text** stays its own size. So `alignment:` decides **where** the text sits inside the big frame. Without it, the text is centered.

A full-width button is a typical use:

```swift
Button {
    save()
} label: {
    Text("Save")
        .frame(maxWidth: .infinity)    // stretch the label, not the button
}
.buttonStyle(.borderedProminent)
.padding(.horizontal)
```

You can also give limits:

```swift
Text(article.body)
    .frame(minWidth: 200, maxWidth: 600)      // readable line length on iPad and Mac

Color.gray
    .frame(minHeight: 44, maxHeight: 120)     // between 44 and 120 points tall
```

| Frame | Meaning |
|---|---|
| `.frame(width: 100)` | Exactly 100 wide |
| `.frame(maxWidth: .infinity)` | As wide as offered |
| `.frame(minWidth: 100)` | At least 100 wide |
| `.frame(maxWidth: 300)` | At most 300 wide |

---

## 24.8 How SwiftUI Layout Negotiation Works: Parent Proposes, Child Decides 🟡

This is the **one rule** behind every layout in this section. Layout is a **3-step talk**:

1. The **parent proposes** (offers) a size to the child.
2. The **child decides** its own size. It can take more, less, or exactly what was offered.
3. The **parent places** the child, based on the size the child chose.

```swift
// The screen offers its full size to the root view.
// A VStack offers part of that space to each child.
// A Text answers: "I only need enough room for my string."
// The VStack places each child, using the size it answered with.
```

Different views answer **differently**:

| View | What it does with the offer |
|---|---|
| `Text` | Takes only what its text needs; wraps or truncates if offered too little |
| `Image` (not resizable) | Ignores the offer; uses the image's own size |
| `Color`, shapes, `Spacer` | Takes **all** it's offered (flexible) |
| `.frame(width: 100)` | Offers 100 to its child, and is 100 itself |
| `.padding(10)` | Offers 10 less on each side, then adds it back |
| `.fixedSize()` | Offers the child "as much as you want" (24.9) |

This explains a common surprise. A `Text` in a `VStack` **doesn't fill** the width:

```swift
VStack {
    Text("Hi")
        .background(.yellow)   // yellow only behind "Hi", not the full width
}
```

The `VStack` **offered** the full width, but `Text` **decided** to be small. To change this, wrap it in a frame that **wants** the full width:

```swift
Text("Hi")
    .frame(maxWidth: .infinity)
    .background(.yellow)       // now full width
```

Each **modifier** is a parent of the view before it. So in `Text("Hi").padding().background(.yellow)`, the background asks the padding, and the padding asks the text. Reading the chain this way explains almost every layout question.

---

## 24.9 `.fixedSize()` and Escaping Proposals 🟡

`.fixedSize()` tells the view: **ignore the offered size**, use your **ideal size** (the size it would choose with no limits). It's useful when the parent would **cut** text you want to show in full:

```swift
Text("This is a fairly long piece of text that would normally wrap or truncate")
    .frame(width: 100)   // the frame offers only 100 points, so the text wraps

Text("This is a fairly long piece of text that would normally wrap or truncate")
    .fixedSize()         // ignores the offer: one long line, even if it goes off screen
```

You can choose the axis. A very common fix is for **multi-line text that gets cut** with "…" in tight layouts:

```swift
Text(longDescription)
    .fixedSize(horizontal: false, vertical: true)
    // wraps to the offered width (horizontal: false)
    // but always gets the height it needs (vertical: true), so it never truncates
```

`.fixedSize()` on a **stack** is a neat trick to make children **match** each other. Here both buttons get the **width of the widest** one:

```swift
VStack {
    Button { } label: {
        Text("OK").frame(maxWidth: .infinity)
    }
    Button { } label: {
        Text("Cancel and Go Back").frame(maxWidth: .infinity)
    }
}
.buttonStyle(.bordered)
.fixedSize(horizontal: true, vertical: false)
// The VStack's ideal width is its widest child.
// Each maxWidth: .infinity label then fills that width.
```

⚠️ `.fixedSize()` can push content **off screen**. Use it on small, known content, not on long user text without a limit.

---

## 24.10 `.layoutPriority()` 🟡

When a stack is **short on space**, it must shrink some children. By default, every child has priority **`0`**. Children with a **higher** `.layoutPriority()` get their space **first**. Lower ones shrink:

```swift
HStack {
    Text("A fixed label:")
        .layoutPriority(1)   // gets its full size first, so it never truncates
    TextField("Enter a value", text: $inputValue)
        // priority 0: shrinks to fit what's left
}
```

This is the standard fix when a **label gets cut** ("A fixed la…") next to a **flexible** view like a `TextField` or a long `Text`.

Another common case: a title and a date in one row. The **date** must always show in full:

```swift
HStack {
    Text(message.subject)
        .lineLimit(1)              // can truncate: "Meeting about the new…"
    Spacer()
    Text(message.date, style: .date)
        .layoutPriority(1)         // always shown in full
        .foregroundStyle(.secondary)
}
```

Priority only matters when there **isn't enough space**. With enough room, every child gets its ideal size anyway.

---

## 24.11 Shapes: `Rectangle`, `RoundedRectangle`, `Circle`, `Capsule` 🟢

SwiftUI has built-in **shapes**. They are **real views** (the `Shape` protocol is in 30.2). You can **fill** them, **stroke** them (draw the outline), and size them:

```swift
Rectangle()
    .fill(.blue)
    .frame(width: 100, height: 60)

RoundedRectangle(cornerRadius: 12)
    .fill(.green)
    .frame(width: 100, height: 60)

Circle()
    .fill(.red)
    .frame(width: 60, height: 60)

Capsule()
    .fill(.orange)
    .frame(width: 120, height: 40)   // a pill: a rounded rectangle with fully round ends

Ellipse()
    .stroke(.purple, lineWidth: 3)   // only the outline
    .frame(width: 120, height: 60)
```

Shapes are **flexible**: they fill **all** the space they're offered. Always give them a frame, or put them in a background (24.13).

You can **fill and stroke** the same shape (iOS 17+):

```swift
Circle()
    .fill(.yellow)
    .stroke(.orange, lineWidth: 4)
    .frame(width: 80, height: 80)
```

The short **shape names** work anywhere a shape is expected:

```swift
.clipShape(.circle)
.clipShape(.capsule)
.clipShape(.rect(cornerRadius: 12))
.clipShape(.rect(topLeadingRadius: 16, topTrailingRadius: 16))   // only the top corners
```

Pass `style: .continuous` (for example, `RoundedRectangle(cornerRadius: 16, style: .continuous)`) for the **smooth** corner Apple uses on app icons.

---

## 24.12 `.clipShape()` and `.mask()` 🟢

**`.clipShape()`** cuts a view to a **shape**. Anything outside the shape is hidden:

```swift
Image("myPhoto")
    .resizable()
    .scaledToFill()
    .frame(width: 100, height: 100)
    .clipShape(.circle)        // a round avatar
```

**`.mask { }`** is more general. It uses **any view** as a stencil: where the mask is **opaque**, the content shows; where it's **clear**, it's hidden:

```swift
// Fade out the bottom of a long text preview
Text(article.body)
    .lineLimit(6)
    .mask {
        LinearGradient(colors: [.black, .clear], startPoint: .center, endPoint: .bottom)
    }
```

For **gradient text**, you don't need a mask anymore. Just use a gradient as the style:

```swift
Text("Gradient Text")
    .font(.largeTitle.bold())
    .foregroundStyle(
        LinearGradient(colors: [.blue, .purple], startPoint: .leading, endPoint: .trailing)
    )
```

| Tool | Use for |
|---|---|
| `.clipShape(.circle)` | Simple shape cropping: avatars, rounded cards |
| `.mask { }` | Fades, cut-outs, using any view's shape |
| `.clipped()` | Cut to the view's own rectangle (after `.scaledToFill()`) |

Clipping only changes **what you see**. The view can still be **tapped** outside the shape. Add `.contentShape(.circle)` to match the tap area too.

---

## 24.13 `.background()` with a View 🟢

`.background()` takes **any view**, not just a color. It's placed **behind** the view, and gets the **same size** as the view:

```swift
Text("Hello")
    .padding()
    .background {
        RoundedRectangle(cornerRadius: 8)
            .fill(.blue)
    }

Text("Layered")
    .padding()
    .background {
        Image("texture")
            .resizable()
            .opacity(0.3)
    }
```

For the common "color in a shape" case, there's a short form:

```swift
Text("Hello")
    .padding()
    .background(.blue, in: .rect(cornerRadius: 8))
```

The **closure form** `.background { ... }` is a `@ViewBuilder` (12.4), so you can put **several views** in it, and choose an `alignment`:

```swift
Text("Inbox")
    .padding()
    .background(alignment: .bottom) {
        Rectangle()
            .fill(.blue)
            .frame(height: 3)      // an underline at the bottom
    }
```

A background **never changes the size** of the view it's on. The view decides the size; the background just fills it.

---

## 24.14 `.overlay()` with a View 🟢

`.overlay()` is the **mirror** of `.background()`: it puts a view **on top**. It's great for **borders**, **badges**, and **labels**:

```swift
Circle()
    .fill(.blue)
    .frame(width: 60, height: 60)
    .overlay {
        Text("5")
            .foregroundStyle(.white)
            .font(.headline)
    }

Image("profile")
    .resizable()
    .scaledToFill()
    .frame(width: 80, height: 80)
    .clipShape(.circle)
    .overlay {
        Circle().stroke(.white, lineWidth: 3)   // a border ring on top of the round image
    }
```

The **border ring** is a common pattern. You **clip** with a circle, then **stroke** the same circle on top. Both use the same frame, so the ring follows the edge exactly.

Use `alignment` to place a **badge** in a corner:

```swift
Image(systemName: "bell")
    .font(.largeTitle)
    .overlay(alignment: .topTrailing) {
        Text("3")
            .font(.caption2.bold())
            .foregroundStyle(.white)
            .padding(4)
            .background(.red, in: .circle)
            .offset(x: 6, y: -6)       // move it a little past the corner
    }
```

Like a background, an overlay **doesn't change** the size of the base view. That's the main difference from a `ZStack`, which sizes itself to fit **all** its children.

---

## 24.15 Safe Area and `.ignoresSafeArea()` 🟢

The **safe area** is the part of the screen **not covered** by system UI: the status bar, Dynamic Island, home indicator, navigation bar, and tab bar. SwiftUI keeps content **inside** it by default. `.ignoresSafeArea()` lets a view draw **under** those areas:

```swift
Color.blue
    .ignoresSafeArea()   // the blue fills the whole screen, under the status bar too

VStack {
    Text("Content")
}
.ignoresSafeArea(.container, edges: .bottom)   // only the bottom edge
```

The usual pattern: the **background** goes edge to edge, but the **content** stays safe:

```swift
ZStack {
    LinearGradient(colors: [.blue, .purple], startPoint: .top, endPoint: .bottom)
        .ignoresSafeArea()           // only the background ignores it

    VStack {
        Text("Welcome")              // content still avoids the Dynamic Island
        Spacer()
        Button("Start") { }          // and the home indicator
    }
    .padding()
}
```

A **background** is even easier. Backgrounds made with a style, like `.background(.blue)`, **already** extend into the safe area by default.

To **add** your own bar at an edge, and push the content to make room for it, use `.safeAreaInset`:

```swift
List(messages) { message in
    MessageRow(message: message)
}
.safeAreaInset(edge: .bottom) {
    MessageInputBar()               // the list scrolls above this bar, not under it
        .padding()
        .background(.bar)
}
```

The **keyboard** is also a safe area region. Views move up when it appears. `.ignoresSafeArea(.keyboard)` stops that for a view that should stay put.

---

## 24.16 `.aspectRatio()` and Content Modes 🟢

`.aspectRatio()` isn't just for images (23.4). It can lock **any** view to a **width-to-height ratio**:

```swift
Rectangle()
    .fill(.blue)
    .aspectRatio(16/9, contentMode: .fit)   // always 16:9, as big as fits

Color.gray
    .aspectRatio(1, contentMode: .fit)      // always a square
```

This is handy for video players, photo grids, and cards that must keep their shape on every screen:

```swift
LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))]) {
    ForEach(photos) { photo in
        Color.clear
            .aspectRatio(1, contentMode: .fit)    // a square cell
            .overlay {
                AsyncImage(url: photo.url) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color.gray.opacity(0.2)
                }
            }
            .clipped()                            // crop the filled image to the square
    }
}
```

The `Color.clear` + `.overlay` trick sets the **cell's** size first, then fills it with the image. That keeps odd-sized images from breaking the grid.

Without a ratio, `.aspectRatio(contentMode:)` uses the view's **own** ratio (for images, the photo's shape). `.scaledToFit()` and `.scaledToFill()` are short names for exactly that.

---

## 24.17 `ViewThatFits` 🟡

`ViewThatFits` tries its children **in order** and shows the **first one that fits**. You give it a full version and smaller fallbacks. No measuring code needed:

```swift
ViewThatFits {
    HStack {
        Text("Full label with lots of detail")
        Image(systemName: "star.fill")
    }
    Image(systemName: "star.fill")   // used only if the HStack above doesn't fit
}
```

You can check only **one axis**. This is useful for buttons that should go **vertical** when the row gets too narrow (for example, with very large Dynamic Type):

```swift
ViewThatFits(in: .horizontal) {
    HStack {
        Button("Accept") { }
        Button("Decline") { }
    }
    VStack {
        Button("Accept") { }
        Button("Decline") { }
    }
}
```

Each child is measured at its **ideal size**. So `ViewThatFits` works best with **content-sized** children like text and stacks. Flexible views like `Color` have a tiny ideal size, so they almost always "fit".

---

## 24.18 `GeometryReader` Basics 🟡

`GeometryReader` gives you the **size** of the space it's offered, through a **`GeometryProxy`**. You can use it to size children as a **fraction** of the space:

```swift
GeometryReader { geometry in
    Text("Available width: \(geometry.size.width)")
        .frame(width: geometry.size.width * 0.5)   // half the available width
}
```

The proxy can tell you more:

```swift
GeometryReader { proxy in
    let size = proxy.size                           // the offered size
    let insets = proxy.safeAreaInsets               // the safe area around it
    let frame = proxy.frame(in: .global)            // its position on the whole screen

    Text("\(Int(size.width)) × \(Int(size.height))")
}
```

Two things make `GeometryReader` **different** from normal views:

1. It **takes all the space** it's offered (it's greedy), no matter what's inside.
2. It puts its content at the **top-leading corner**, not the center.

Both often surprise people, and lead to the problems in 24.19.

---

## 24.19 `GeometryReader` Pitfalls and Alternatives 🟡

Because `GeometryReader` **grabs all the space**, putting it **in a stack** changes the whole layout:

```swift
// ❌ The GeometryReader takes all the leftover height
VStack {
    Text("Hello")
    GeometryReader { geo in
        Color.blue
    }
    Text("World")
}
// "World" is pushed to the very bottom, and the blue fills everything between
```

Other common problems:

- It's easy to make a **layout loop**: you read a size, change state, the size changes, and so on.
- Content is placed at the **top-leading** corner, so things look "off center".
- Code that wraps whole screens in `GeometryReader` is hard to read.

Before using it, check if a simpler tool does the job:

| You want | Use instead |
|---|---|
| A view as a fraction of its container | `containerRelativeFrame()` (24.21) |
| To **know** a view's size (and react) | `.onGeometryChange()` (24.20) |
| Different layouts for narrow vs. wide | `ViewThatFits` (24.17) or size classes |
| A view filling the width | `.frame(maxWidth: .infinity)` |
| A fully custom layout | The `Layout` protocol (31.8) |

If you do need `GeometryReader`, a safer place is **inside a background or overlay**. There it gets the **same size as the view**, and can't change the layout:

```swift
Text("Hello")
    .background {
        GeometryReader { proxy in
            Color.clear   // reads the Text's size without changing it
        }
    }
```

---

## 24.20 `.onGeometryChange()` 🟡

`.onGeometryChange()` lets a view **watch its own size or position** and run code when it **changes**. No `GeometryReader` container is needed:

```swift
struct ContentView: View {
    @State private var width: CGFloat = 0

    var body: some View {
        Text("Hello")
            .onGeometryChange(for: CGFloat.self) { proxy in
                proxy.size.width          // 1. pick the value you care about
            } action: { newWidth in
                width = newWidth          // 2. called when that value changes
            }
    }
}
```

It's a **modifier**, not a container. So it **doesn't change** the view's layout at all. It just **reports** the size the view ended up with.

Pick a **small value** (like a `Bool`) to run code only when something **important** changes:

```swift
struct HeaderView: View {
    @State private var isCompact = false

    var body: some View {
        Group {
            if isCompact {
                CompactHeader()
            } else {
                FullHeader()
            }
        }
        .frame(maxWidth: .infinity)
        .onGeometryChange(for: Bool.self) { proxy in
            proxy.size.width < 400       // only a true/false, not every pixel
        } action: { compact in
            isCompact = compact
        }
    }
}
```

It also works with **positions**. For example, to see how far a view has scrolled:

```swift
.onGeometryChange(for: CGFloat.self) { proxy in
    proxy.frame(in: .scrollView).minY
} action: { offset in
    showsTitleInBar = offset < -50
}
```

⚠️ Don't change something in `action` that **changes the same size** again. That makes a loop.

---

## 24.21 `containerRelativeFrame()` 🟡

`containerRelativeFrame()` sizes a view **relative to its container**: the nearest scroll view, `List`, navigation stack, or the window. "One third of the scroll view's width" becomes one line:

```swift
ScrollView(.horizontal) {
    LazyHStack(spacing: 10) {
        ForEach(items) { item in
            ItemView(item: item)
                .containerRelativeFrame(.horizontal, count: 3, spacing: 10)   // 3 items per screen
        }
    }
}

Color.blue
    .containerRelativeFrame(.horizontal) { width, axis in
        width * 0.8   // 80% of the container's width
    }
```

`count: 3, spacing: 10` means: split the width into **3 columns** with **10-point gaps**, and make this view **one column** wide. Add `span:` for a view that covers **more than one** column.

It shines in **carousels** (26.13). Add snapping, so each swipe stops exactly on an item:

```swift
ScrollView(.horizontal) {
    LazyHStack(spacing: 12) {
        ForEach(cards) { card in
            CardView(card: card)
                .containerRelativeFrame(.horizontal)   // one full-width card per page
        }
    }
    .scrollTargetLayout()
}
.scrollTargetBehavior(.viewAligned)    // snap to each card
.contentMargins(.horizontal, 20)       // show a bit of the next card
```

Unlike `GeometryReader`, it doesn't **grab** space or change the layout around it.

---

## 24.22 Alignment Guides 🔴

Every view has **alignment guides**: named lines like `.top`, `.leading`, `.center`, and `.firstTextBaseline`. A stack lines up its children by making those lines **meet**.

`.alignmentGuide()` **moves** one view's guide, for that view only:

```swift
HStack(alignment: .top) {
    Text("A")
        .alignmentGuide(.top) { dimensions in
            dimensions[.top] + 10   // A's "top" line is now 10 points below its real top
        }
    Text("B")                       // B uses its real top
}
// The two "top" lines meet, so A sits 10 points HIGHER than B
```

Read it like this: the closure returns **where the guide is**, measured inside the view. A bigger value moves the guide **down**, so the **view** moves **up** to line it up.

A practical example: a **bullet list** where the bullet hangs to the left, and the text lines up:

```swift
VStack(alignment: .leading) {
    Text("Ingredients").font(.headline)

    HStack(alignment: .firstTextBaseline) {
        Text("•")
        Text("2 cups flour")
    }
    .alignmentGuide(.leading) { d in
        d[.leading] + 14          // the text, not the bullet, lines up with the title
    }
}
```

You can also read **other** guides in the closure, like `d[.trailing]` or `d.width`, to line up on any point you want.

---

## 24.23 Custom Alignment Identifiers 🔴

Built-in guides only line up views **in the same stack**. A **custom alignment** can line up views that are **nested deeper**, in different stacks.

You define one by making a type that conforms to **`AlignmentID`**:

```swift
extension VerticalAlignment {
    private struct CustomCenter: AlignmentID {
        static func defaultValue(in context: ViewDimensions) -> CGFloat {
            context[VerticalAlignment.center]   // used when a view doesn't set it
        }
    }
    static let customCenter = VerticalAlignment(CustomCenter.self)
}

HStack(alignment: .customCenter) {
    Image(systemName: "star.fill")
        .alignmentGuide(.customCenter) { $0[VerticalAlignment.center] }
    VStack {
        Text("Title")
        Text("Subtitle")
            .alignmentGuide(.customCenter) { $0[VerticalAlignment.center] }
    }
}
// The star lines up with the CENTER of "Subtitle",
// even though "Subtitle" is inside another VStack
```

How it works: the inner `VStack` **passes up** the custom guide from the child that set it. The outer `HStack` then lines up the star with that point.

A classic use is a **form** where labels and fields in **different rows** share one column line:

```swift
extension HorizontalAlignment {
    private struct FieldColumn: AlignmentID {
        static func defaultValue(in d: ViewDimensions) -> CGFloat { d[.leading] }
    }
    static let fieldColumn = HorizontalAlignment(FieldColumn.self)
}

VStack(alignment: .fieldColumn) {
    HStack {
        Text("Name")
        TextField("Name", text: $name)
            .alignmentGuide(.fieldColumn) { $0[.leading] }
    }
    HStack {
        Text("Email address")
        TextField("Email", text: $email)
            .alignmentGuide(.fieldColumn) { $0[.leading] }
    }
}
// Both text fields start at the same x, whatever the label lengths
```

This is an **advanced** tool. For simple rows and columns, `Grid` (section 26) is often easier.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `VStack`/`HStack`/`ZStack` | Down, across, or on top; later `ZStack` children draw on top |
| `Spacer` | Grows to fill free space; several spacers share it equally |
| Stack alignment | Lines children up on the other axis; use baselines for text |
| Spacing/`Divider` | `spacing:` is a fixed gap (`nil` = standard, not zero); `Divider` is a line |
| `.padding()` | Space around a view; order with `.background()` matters |
| `.frame()` fixed | The frame is that size; the content still picks its own size |
| `.frame(maxWidth: .infinity)` | Take all offered width; `alignment:` places the content |
| Parent proposes, child decides | The one rule behind all SwiftUI layout |
| `.fixedSize()` | Use the ideal size and ignore the offer; fixes cut-off text |
| `.layoutPriority()` | Higher priority gets space first when space is short |
| Shapes | Real, flexible views; fill, stroke, and use as clip shapes |
| `.clipShape()`/`.mask()` | Cut to a shape, or use any view as a stencil |
| `.background()`/`.overlay()` | A view behind or on top, same size, no layout change |
| Safe area | Content stays safe; backgrounds go edge to edge; `.safeAreaInset` for bars |
| `.aspectRatio()` | Locks a ratio for any view |
| `ViewThatFits` | Shows the first child that fits |
| `GeometryReader` | Reads the offered size; greedy and top-leading |
| `GeometryReader` pitfalls | Prefer newer tools; if needed, put it in a background |
| `.onGeometryChange()` | Reacts to size or position changes without changing layout |
| `containerRelativeFrame()` | A fraction of the container; great for carousels |
| Alignment guides | Move one view's alignment line |
| Custom alignment identifiers | Line up views across nested stacks |
