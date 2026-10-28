**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Almost every app asks the user for something: a name, a password, a date, a setting. This section covers SwiftUI's **`Form`** container and the **input controls** that go in it, plus **validation**, the **keyboard**, and moving **focus** between fields. Every control here works the same way: it's **bound** to a piece of state with `$`.

---

## 28.1 Form and Section 🟢

A **`Form`** is a container, like `List`, that styles its content for **data entry**. On iOS, it looks like the **Settings** app: grouped rows on a gray background.

```swift
struct ProfileFormView: View {
    @State private var name = ""
    @State private var bio = ""
    @State private var notificationsOn = true

    var body: some View {
        Form {
            Section("Personal Info") {
                TextField("Name", text: $name)
                TextField("Bio", text: $bio)
            }

            Section {
                Toggle("Notifications", isOn: $notificationsOn)
            } footer: {
                Text("You can change this later in Settings.")
            }
        }
    }
}
```

A **`Section`** groups related controls. Its **header** names the group. Its **footer** gives **extra explanation** under it, in small gray text: what a setting does, or a hint about the input.

For **read-only** rows (a label on the left, a value on the right), use **`LabeledContent`**:

```swift
Form {
    Section("Account") {
        LabeledContent("Email", value: user.email)
        LabeledContent("Plan") {
            Text("Pro").foregroundStyle(.green)
        }
    }
}
```

A `Form` usually lives in a `NavigationStack`, with a title and **Cancel/Save** buttons (27.19):

```swift
NavigationStack {
    Form { /* ... */ }
        .navigationTitle("Edit Profile")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("Save") { save() } }
        }
}
```

---

## 28.2 TextField and Styles 🟢

**`TextField`** is for **single-line** text. It's bound to a `String`:

```swift
struct SignUpFormView: View {
    @State private var username = ""

    var body: some View {
        Form {
            TextField("Username", text: $username)
                .autocorrectionDisabled()                 // no "smart" word changes
                .textInputAutocapitalization(.never)      // no capital first letter
        }
    }
}
```

For **usernames**, **emails**, and **codes**, autocorrect and auto-capitals **get in the way**. "jsmith" shouldn't become "Smith". So turn both off.

Outside a `Form`, give the field a **style** so users can see it:

```swift
TextField("Search", text: $query)
    .textFieldStyle(.roundedBorder)    // a visible box; inside a Form, the row style is used instead
```

A `TextField` can grow to **several lines** (iOS 16+). Unlike `TextEditor` (28.5), it keeps its **placeholder**:

```swift
TextField("Description", text: $description, axis: .vertical)
    .lineLimit(3...6)       // starts at 3 lines, grows up to 6, then scrolls
```

It can also edit **numbers** and other values directly, with a **format**:

```swift
@State private var age = 0
@State private var price = 0.0

TextField("Age", value: $age, format: .number)
    .keyboardType(.numberPad)

TextField("Price", value: $price, format: .currency(code: "USD"))
    .keyboardType(.decimalPad)
```

With a format, the value updates when the user **finishes editing** (presses return or leaves the field), not on every keystroke.

---

## 28.3 Keyboard Types and Submit Labels 🟢

**`.keyboardType()`** shows a keyboard that **fits the input**. **`.submitLabel()`** changes the text on the **return key**:

```swift
struct ContactFormView: View {
    @State private var email = ""
    @State private var website = ""
    @State private var phone = ""

    var body: some View {
        Form {
            TextField("Email", text: $email)
                .keyboardType(.emailAddress)     // shows "@" and "." up front
                .textContentType(.emailAddress)  // suggests the user's email
                .submitLabel(.next)              // return key says "next"

            TextField("Website", text: $website)
                .keyboardType(.URL)
                .submitLabel(.next)

            TextField("Phone", text: $phone)
                .keyboardType(.phonePad)
                .textContentType(.telephoneNumber)
        }
    }
}
```

| Keyboard type | Shows |
|---|---|
| `.emailAddress` | Letters, with `@` and `.` easy to reach |
| `.URL` | Letters, with `/` and `.com` |
| `.numberPad` | Digits only |
| `.decimalPad` | Digits and a decimal point |
| `.phonePad` | Digits, `+`, `*`, `#` |

| Submit label | Use for |
|---|---|
| `.next` | Go to the next field |
| `.done` | Finish the form |
| `.search` | Run a search |
| `.send` | Send a message |
| `.go` | Start an action, like logging in |

The submit label only **changes the text**. What happens on tap is up to you, with `.onSubmit` (28.15).

⚠️ A keyboard type is a **hint**, not a rule. Users can paste anything, and hardware keyboards type anything. **Validate** the value anyway (28.13).

---

## 28.4 SecureField 🟢

**`SecureField`** is a `TextField` that **hides** what's typed, with dots. Use it for **passwords**:

```swift
struct LoginFormView: View {
    @State private var username = ""
    @State private var password = ""

    var body: some View {
        Form {
            TextField("Username", text: $username)
                .textContentType(.username)
                .textInputAutocapitalization(.never)
            SecureField("Password", text: $password)
                .textContentType(.password)
        }
    }
}
```

**`.textContentType`** tells the system what the field is **for**. With it, iOS can **AutoFill** saved passwords from the Passwords app, and suggest a **strong password** on sign-up:

| Content type | Use |
|---|---|
| `.username` | The login name, so AutoFill fills both fields |
| `.password` | Logging in with an existing password |
| `.newPassword` | Sign-up or change password (suggests a strong one) |
| `.oneTimeCode` | SMS codes (offers the code from Messages) |

A common pattern is a **show/hide** button:

```swift
struct PasswordField: View {
    @Binding var password: String
    @State private var isVisible = false

    var body: some View {
        HStack {
            Group {
                if isVisible {
                    TextField("Password", text: $password)
                } else {
                    SecureField("Password", text: $password)
                }
            }
            .textContentType(.password)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()

            Button(isVisible ? "Hide" : "Show", systemImage: isVisible ? "eye.slash" : "eye") {
                isVisible.toggle()
            }
            .labelStyle(.iconOnly)
        }
    }
}
```

---

## 28.5 TextEditor 🟢

**`TextEditor`** is for **long, multi-line** text, like notes. It **scrolls** when the text is longer than its frame:

```swift
struct NotesFormView: View {
    @State private var noteText = ""

    var body: some View {
        Form {
            Section("Notes") {
                TextEditor(text: $noteText)
                    .frame(minHeight: 150)
            }
        }
    }
}
```

Unlike `TextField`, a `TextEditor` has **no placeholder**. A common fix is an **overlay** that shows only when the text is empty:

```swift
TextEditor(text: $noteText)
    .frame(minHeight: 150)
    .overlay(alignment: .topLeading) {
        if noteText.isEmpty {
            Text("Write something…")
                .foregroundStyle(.tertiary)
                .padding(.top, 8)
                .padding(.leading, 5)
                .allowsHitTesting(false)      // taps go through to the editor
        }
    }
```

| Need | Use |
|---|---|
| A few lines, with a placeholder | `TextField(..., axis: .vertical)` (28.2) |
| A big, scrolling text area | `TextEditor` |

Other useful modifiers:

```swift
TextEditor(text: $noteText)
    .scrollContentBackground(.hidden)         // remove the default background
    .background(.yellow.opacity(0.1))
    .font(.body.monospaced())
```

From iOS 26, `TextEditor` can also edit **rich text** when bound to an `AttributedString` (14.17), with bold, italic, and more.

---

## 28.6 Toggle 🟢

**`Toggle`** is an **on/off switch**, bound to a `Bool`:

```swift
struct SettingsFormView: View {
    @State private var wifiEnabled = true
    @State private var airplaneMode = false

    var body: some View {
        Form {
            Toggle("Wi-Fi", isOn: $wifiEnabled)
            Toggle("Airplane Mode", isOn: $airplaneMode)
                .tint(.orange)              // the "on" color
        }
    }
}
```

**`.tint()`** sets the switch's color when it's **on**. Here it copies the orange Airplane Mode switch from iOS Settings.

A toggle's label can be a **`Label`** or any view:

```swift
Toggle(isOn: $notificationsOn) {
    Label("Notifications", systemImage: "bell.badge")
}

Toggle(isOn: $isPrivate) {
    VStack(alignment: .leading) {
        Text("Private Account")
        Text("Only followers can see your posts")
            .font(.caption)
            .foregroundStyle(.secondary)
    }
}
```

Toggles have **styles** too. A **button-style** toggle is great in toolbars:

```swift
Toggle("Favorite", systemImage: "heart", isOn: $isFavorite)
    .toggleStyle(.button)       // a button that looks "pressed" when on
```

Run code when it changes with **`.onChange`**:

```swift
Toggle("Dark Mode", isOn: $darkMode)
    .onChange(of: darkMode) { _, newValue in
        analytics.log("dark_mode", newValue)
    }
```

---

## 28.7 Slider and Stepper 🟢

A **`Slider`** picks a value from a **continuous range** by dragging. A **`Stepper`** changes a value in **fixed steps** with **−** and **+** buttons:

```swift
struct AdjustmentsFormView: View {
    @State private var brightness = 0.5
    @State private var quantity = 1

    var body: some View {
        Form {
            Section("Brightness") {
                Slider(value: $brightness, in: 0...1, step: 0.05) {
                    Text("Brightness")              // used by VoiceOver
                } minimumValueLabel: {
                    Image(systemName: "sun.min")
                } maximumValueLabel: {
                    Image(systemName: "sun.max")
                }
            }

            Stepper("Quantity: \(quantity)", value: $quantity, in: 1...10)
        }
    }
}
```

| | `Slider` | `Stepper` |
|---|---|---|
| Input | Drag along a track | Tap − or + |
| Values | Any in a range (or `step:`) | Exact steps |
| Good for | Volume, brightness, a price filter | Quantity, number of guests |

`in:` sets the **range**. `step:` makes the value move in **fixed jumps**.

A `Stepper` can step by **any amount**, and show a **formatted** value:

```swift
@State private var tip = 0.15

Stepper(value: $tip, in: 0...0.3, step: 0.05) {
    Text("Tip: \(tip, format: .percent)")       // "Tip: 15%"
}
```

To act only when the user **lets go** of a slider (for example, to save), use **`onEditingChanged`**:

```swift
Slider(value: $volume, in: 0...1) { isEditing in
    if !isEditing {
        saveVolume(volume)          // called once at the end of the drag
    }
}
```

---

## 28.8 Picker 🟢

A **`Picker`** lets the user choose **one option** from a fixed set. It's bound to a selection value. **`.pickerStyle()`** changes how it looks:

```swift
enum ShippingMethod: String, CaseIterable, Identifiable {
    case standard = "Standard"
    case express = "Express"
    case overnight = "Overnight"

    var id: String { rawValue }
}

struct ShippingFormView: View {
    @State private var method: ShippingMethod = .standard

    var body: some View {
        Form {
            Picker("Shipping", selection: $method) {
                ForEach(ShippingMethod.allCases) { option in
                    Text(option.rawValue).tag(option)
                }
            }
            .pickerStyle(.navigationLink)      // pushes a list of choices

            Picker("Shipping", selection: $method) {
                ForEach(ShippingMethod.allCases) { option in
                    Text(option.rawValue).tag(option)
                }
            }
            .pickerStyle(.segmented)           // a row of segments, all visible
        }
    }
}
```

The **`.tag()`** is what links each option to a **selection value**. The tag's **type must match** the binding's type exactly. Here, `.tag(option)` is a `ShippingMethod`, like `method`. Without it, `ForEach` would tag rows with their `id` (a `String`), which doesn't match, so **nothing** would look selected.

| Style | Look |
|---|---|
| `.automatic` | Inside a `Form` on iOS: a **menu** (a pop-up list) |
| `.menu` | A pop-up menu |
| `.navigationLink` | Pushes a screen with the choices |
| `.segmented` | A segmented control, all options visible |
| `.wheel` | The classic spinning wheel |
| `.inline` | All options as rows, inside the form |

Use **`.segmented`** for **2–4 short** options. Use a **menu** or **navigation link** for longer lists.

An **optional** selection allows "none":

```swift
@State private var category: Category?

Picker("Category", selection: $category) {
    Text("None").tag(Category?.none)
    ForEach(categories) { category in
        Text(category.name).tag(Optional(category))   // the tag must be Category? too
    }
}
```

---

## 28.9 DatePicker 🟢

**`DatePicker`** picks a **date**, a **time**, or both. It's bound to a `Date`:

```swift
struct EventFormView: View {
    @State private var eventDate = Date.now

    var body: some View {
        Form {
            DatePicker("Event Date", selection: $eventDate, displayedComponents: [.date])

            DatePicker(
                "Event Date & Time",
                selection: $eventDate,
                in: Date.now...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .datePickerStyle(.graphical)
        }
    }
}
```

- **`displayedComponents:`** picks **what** to show: `.date`, `.hourAndMinute`, or both.
- **`in:`** limits the **range**. `Date.now...` means "**from now on**": past dates can't be picked.
- **`.datePickerStyle(.graphical)`** shows a full **calendar**. The default (`.compact`) is a small button that opens one.

More range examples:

```swift
// A birthday: at least 13 years ago
let thirteenYearsAgo = Calendar.current.date(byAdding: .year, value: -13, to: .now)!
DatePicker("Birthday", selection: $birthday, in: ...thirteenYearsAgo, displayedComponents: .date)

// A booking in the next 30 days
let in30Days = Calendar.current.date(byAdding: .day, value: 30, to: .now)!
DatePicker("Check-in", selection: $checkIn, in: Date.now...in30Days)
```

To pick **several dates**, use **`MultiDatePicker`** with a `Set<DateComponents>`.

A `Date` is a **moment in time**. The picker shows it in the user's **time zone** and **calendar**, so don't build date strings yourself; use `Text(date, format: ...)` (14.14).

---

## 28.10 ColorPicker 🟢

**`ColorPicker`** opens the system **color chooser** (grid, spectrum, and sliders). It's bound to a `Color`:

```swift
struct ThemeFormView: View {
    @State private var accentColor: Color = .blue
    @State private var textColor: Color = .primary

    var body: some View {
        Form {
            ColorPicker("Accent Color", selection: $accentColor)
            ColorPicker("Text Color", selection: $textColor, supportsOpacity: false)
        }
    }
}
```

**`supportsOpacity: false`** **hides the opacity slider**. Use it when a see-through color makes no sense, like text color.

The picked color can be used right away:

```swift
RoundedRectangle(cornerRadius: 12)
    .fill(accentColor)
    .frame(height: 60)
```

To **save** a `Color`, store its **components**, not the `Color` itself. `Color.resolve(in:)` (iOS 17) gives you the red, green, blue, and opacity values to save.

---

## 28.11 Buttons and Button Roles 🟢

A **`Button`** runs an action when tapped. Its **`role:`** says what **kind** of action it is, and SwiftUI styles it to match:

```swift
struct AccountFormView: View {
    var body: some View {
        Form {
            Button("Save Changes") {
                // save action
            }

            Button("Delete Account", role: .destructive) {
                // delete action
            }

            Button("Cancel", role: .cancel) {
                // dismiss action
            }
        }
    }
}
```

| Role | Meaning | Effect |
|---|---|---|
| none | A normal action | Accent color |
| `.destructive` | Dangerous or can't be undone | **Red** text |
| `.cancel` | Go back, no changes | Placed and styled as "cancel" in alerts and dialogs |

In **alerts** and **confirmation dialogs** (27.16, 27.17), roles also decide the button's **position**. The cancel button goes in the standard place for each platform.

A button's label can be **any view**:

```swift
Button {
    addToCart()
} label: {
    Label("Add to Cart", systemImage: "cart.badge.plus")
}

Button(action: share) {
    Image(systemName: "square.and.arrow.up")
}
.accessibilityLabel("Share")      // icon-only buttons need a label for VoiceOver (70)
```

Buttons that start **async** work can call a `Task`:

```swift
Button("Upload") {
    Task { await upload() }
}
.disabled(isUploading)            // stop double taps while it runs
```

---

## 28.12 Button Styles Including .glass and .glassProminent 🟡

**`.buttonStyle()`** sets how a button **looks**. Next to the classic `.bordered` and `.borderedProminent`, iOS 26 adds **glass** styles, part of the **Liquid Glass** design (32):

```swift
struct StyledButtonsView: View {
    var body: some View {
        VStack(spacing: 16) {
            Button("Continue") { }
                .buttonStyle(.borderedProminent)   // solid, filled with the accent color

            Button("Learn More") { }
                .buttonStyle(.bordered)            // light tinted background

            Button("Get Started") { }
                .buttonStyle(.glass)               // see-through, frosted glass

            Button("Confirm") { }
                .buttonStyle(.glassProminent)      // glass with a strong tint, for the main action
        }
    }
}
```

| Style | Look | Use for |
|---|---|---|
| `.plain` | Just the label | Rows, custom designs |
| `.borderless` | Accent-colored label | Inline actions |
| `.bordered` | Light background | Secondary actions |
| `.borderedProminent` | Filled background | The main action |
| `.glass` | Frosted, see-through glass | Buttons over photos, maps, video |
| `.glassProminent` | Tinted glass | The main action over rich content |

**Glass** lets the content behind **show through**, so a button floating over a photo or map looks **part of** the screen, not a flat shape pasted on top.

Other ways to shape buttons:

```swift
Button("Buy") { }
    .buttonStyle(.borderedProminent)
    .controlSize(.large)                  // .mini, .small, .regular, .large, .extraLarge
    .buttonBorderShape(.capsule)          // .roundedRectangle, .circle, .capsule
    .tint(.green)
```

The glass styles need **iOS 26**. If you support older versions, check first:

```swift
if #available(iOS 26, *) {
    button.buttonStyle(.glass)
} else {
    button.buttonStyle(.bordered)
}
```

---

## 28.13 Form Validation Patterns 🟡

SwiftUI has **no built-in validation** API. You build it with **computed properties** that turn the current input into `Bool`s, then use them to **show errors** and **disable** the submit button:

```swift
struct SignUpValidationView: View {
    @State private var email = ""
    @State private var password = ""

    private var isEmailValid: Bool {
        email.contains("@") && email.contains(".")   // a simple check; the server does the real one
    }

    private var isPasswordValid: Bool {
        password.count >= 8
    }

    private var canSubmit: Bool {
        isEmailValid && isPasswordValid
    }

    var body: some View {
        Form {
            Section {
                TextField("Email", text: $email)
                    .keyboardType(.emailAddress)
                if !email.isEmpty && !isEmailValid {
                    Text("Enter a valid email address.")
                        .font(.caption)
                        .foregroundStyle(.red)
                }

                SecureField("Password", text: $password)
                if !password.isEmpty && !isPasswordValid {
                    Text("Password must be at least 8 characters.")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }

            Button("Sign Up") {
                // submit
            }
            .disabled(!canSubmit)
        }
    }
}
```

Two key ideas:

1. **Computed, not stored.** `isEmailValid` is **computed** from `email`. It's always **in sync**, with no extra state to update. If it were a separate `@State`, you'd have to remember to update it on every change, and it could get out of sync.
2. **Don't scold too early.** An empty field isn't "wrong" yet; the user hasn't started. `!email.isEmpty && !isEmailValid` shows the error **only after** they type something.

For bigger forms, move the rules into a **model** you can **unit test** (65):

```swift
@Observable
final class SignUpForm {
    var email = ""
    var password = ""

    var emailError: String? {
        guard !email.isEmpty else { return nil }
        return email.contains("@") ? nil : "Enter a valid email address."
    }

    var passwordError: String? {
        guard !password.isEmpty else { return nil }
        return password.count >= 8 ? nil : "At least 8 characters."
    }

    var canSubmit: Bool {
        !email.isEmpty && !password.isEmpty && emailError == nil && passwordError == nil
    }
}
```

Errors that only the **server** knows (like "email already taken") come back **after** submitting. Show them in the same place, from a stored `@State` error.

---

## 28.14 Keyboard Avoidance and Dismissal 🟡

**Avoidance**: SwiftUI moves content up so the keyboard doesn't **cover** the focused field. In a `Form`, `List`, or `ScrollView`, it also **scrolls** the field into view. You rarely need code for this.

**Dismissal** needs more thought. The **SwiftUI way** is **`@FocusState`** (25.11): set it to `nil`, and the keyboard goes away:

```swift
struct KeyboardAwareFormView: View {
    @State private var message = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        ScrollView {
            TextField("Message", text: $message)
                .textFieldStyle(.roundedBorder)
                .focused($isFocused)
                .padding()
        }
        .scrollDismissesKeyboard(.interactively)    // drag down to push the keyboard away
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) { // a bar above the keyboard
                Spacer()
                Button("Done") { isFocused = false }
            }
        }
    }
}
```

**`.scrollDismissesKeyboard()`** controls what **scrolling** does:

| Value | Effect |
|---|---|
| `.interactively` | The keyboard follows your finger down, like Messages |
| `.immediately` | Hides as soon as you start scrolling |
| `.never` | Scrolling never hides it |
| `.automatic` | The system default for the context |

The **keyboard toolbar** is important for **`.numberPad`**, **`.phonePad`**, and **`.decimalPad`**: those keyboards have **no return key**, so without a "Done" button, users can't close them.

In older code, you'll see a UIKit trick to hide the keyboard from anywhere:

```swift
UIApplication.shared.sendAction(
    #selector(UIResponder.resignFirstResponder),
    to: nil, from: nil, for: nil
)
```

It still works, but `@FocusState` is clearer and works on every platform. Prefer it.

---

## 28.15 .onSubmit() and Focus Movement 🟡

**`.onSubmit()`** runs when the user presses the **return key**. Combined with **`@FocusState`**, it makes a smooth "**Next, Next, Done**" flow:

```swift
enum FormField: Hashable {
    case name, email, phone
}

struct MultiFieldFormView: View {
    @State private var name = ""
    @State private var email = ""
    @State private var phone = ""
    @FocusState private var focusedField: FormField?

    var body: some View {
        Form {
            TextField("Name", text: $name)
                .focused($focusedField, equals: .name)
                .submitLabel(.next)
                .onSubmit { focusedField = .email }     // return → go to email

            TextField("Email", text: $email)
                .focused($focusedField, equals: .email)
                .keyboardType(.emailAddress)
                .submitLabel(.next)
                .onSubmit { focusedField = .phone }     // return → go to phone

            TextField("Phone", text: $phone)
                .focused($focusedField, equals: .phone)
                .keyboardType(.phonePad)
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focusedField = nil }   // phonePad has no return key
            }
        }
        .onAppear { focusedField = .name }              // start in the first field
    }
}
```

How it fits together:

- An **enum** names every field. `@FocusState` holds which one is **active** (or `nil`).
- **`.focused($focusedField, equals:)`** links each field to its enum case.
- Each field's **`.onSubmit`** sets `focusedField` to the **next** case.
- Setting it to **`nil`** hides the keyboard.

It's the same "**an enum value drives the UI**" pattern as `List` selection (26.10) and tabs (27.8).

You can also put **one** `.onSubmit` on the whole form and decide with a `switch`, as in 25.11. And `.onSubmit(of: .search)` reacts to the **search field**'s return key (26.11).

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Grouped form container | `Form`, `Section`, `LabeledContent` | Settings-style data entry; footers explain |
| Single-line text | `TextField` | Text, numbers with `format:`, or growing with `axis:` |
| Keyboard tuning | `.keyboardType()`, `.submitLabel()`, `.textContentType()` | The right keyboard, return key, and AutoFill |
| Password entry | `SecureField` | Hidden text with password AutoFill |
| Multi-line text | `TextEditor` | Long, scrolling text; no placeholder |
| Boolean input | `Toggle` | On/off; `.tint()` sets the on color |
| Range input | `Slider`, `Stepper` | Drag a continuous range vs. tap exact steps |
| Fixed-option selection | `Picker` | Tags must match the selection type; menu by default in a form |
| Date/time selection | `DatePicker` | `displayedComponents:` and `in:` ranges |
| Color selection | `ColorPicker` | System chooser; `supportsOpacity: false` hides alpha |
| Actions | `Button`, `role:` | `.destructive` is red; `.cancel` placed correctly |
| Modern button styling | `.buttonStyle(.glass/.glassProminent)` | Frosted glass buttons for iOS 26 |
| Validation | Computed `Bool` properties | Always in sync; show errors after typing starts |
| Keyboard handling | `.scrollDismissesKeyboard()`, keyboard toolbar | Hide the keyboard by scroll, button, or focus |
| Focus flow | `@FocusState`, `.onSubmit()` | Next, Next, Done between fields |
