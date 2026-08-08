*Estimated read time: ~30 minutes*

---

## 28.1 Form and Section

`Form` is a specialized container, similar to `List`, that automatically applies platform-appropriate styling to its grouped content — on iOS this typically means the grouped/inset grouped list appearance familiar from Settings.app.

```swift
struct ProfileFormView: View {
    @State private var name = ""
    @State private var bio = ""

    var body: some View {
        Form {
            Section("Personal Info") {
                TextField("Name", text: $name)
                TextField("Bio", text: $bio)
            }

            Section {
                Toggle("Notifications", isOn: .constant(true))
            } footer: {
                Text("You can change this later in Settings.")
            }
        }
    }
}
```

`Section` groups related controls, and accepts an optional `header:` and `footer:` for section-level labels and descriptive text. Multiple sections within a `Form` are visually separated, matching the standard iOS settings-screen pattern users already recognize.

---

## 28.2 TextField and Styles

`TextField` is the primary control for single-line text entry, bound to a `String` via `@State` or another binding source.

```swift
struct SignUpFormView: View {
    @State private var username = ""

    var body: some View {
        Form {
            TextField("Username", text: $username)
                .textFieldStyle(.roundedBorder)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
        }
    }
}
```

`.textFieldStyle(.roundedBorder)` is most relevant outside of `Form` (inside a `Form`, the surrounding grouped style typically governs appearance already). `.autocorrectionDisabled()` and `.textInputAutocapitalization(.never)` are common companions for fields like usernames or emails where autocorrect/autocapitalization would actively work against the user.

---

## 28.3 Keyboard Types and Submit Labels

`.keyboardType()` swaps in a specialized keyboard layout suited to the expected input, and `.submitLabel()` customizes the keyboard's return-key text.

```swift
struct ContactFormView: View {
    @State private var email = ""
    @State private var phone = ""

    var body: some View {
        Form {
            TextField("Email", text: $email)
                .keyboardType(.emailAddress)
                .submitLabel(.next)

            TextField("Phone", text: $phone)
                .keyboardType(.phonePad)
                .submitLabel(.done)
        }
    }
}
```

Common `.keyboardType()` values include `.emailAddress`, `.numberPad`, `.phonePad`, `.decimalPad`, and `.URL` — each swaps the on-screen keyboard layout to reduce user friction for that specific data type. `.submitLabel()` values like `.next`, `.done`, `.search`, and `.send` change what the return key says and communicates, matching user expectation for what happens on tap.

---

## 28.4 SecureField

`SecureField` behaves like `TextField` but masks entered characters — the standard control for password entry.

```swift
struct LoginFormView: View {
    @State private var password = ""

    var body: some View {
        Form {
            SecureField("Password", text: $password)
                .textContentType(.password)
        }
    }
}
```

`.textContentType(.password)` (or `.newPassword` for sign-up flows) hints to the system that this field is password-related, enabling integration with the system's password autofill and strong-password suggestion features — a meaningful usability win with almost no additional code.

---

## 28.5 TextEditor

While `TextField` handles single-line input, `TextEditor` provides multi-line, scrollable plain-text entry — appropriate for longer free-form text like notes or descriptions.

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

Unlike `TextField`, `TextEditor` has no built-in placeholder text support — a common workaround is overlaying a `Text` view conditionally when the bound string is empty, using a `ZStack` or `.overlay()`.

---

## 28.6 Toggle

`Toggle` renders a standard on/off switch, bound to a `Bool`.

```swift
struct SettingsFormView: View {
    @State private var wifiEnabled = true
    @State private var airplaneMode = false

    var body: some View {
        Form {
            Toggle("Wi-Fi", isOn: $wifiEnabled)
            Toggle("Airplane Mode", isOn: $airplaneMode)
                .tint(.orange)
        }
    }
}
```

`.tint()` customizes the toggle's "on" color, useful for matching an app's accent color or signaling a particular category of setting (as seen here mimicking iOS's own orange Airplane Mode toggle).

---

## 28.7 Slider and Stepper

`Slider` provides continuous-range selection via a draggable track; `Stepper` provides discrete increment/decrement via plus/minus buttons.

```swift
struct AdjustmentsFormView: View {
    @State private var brightness = 0.5
    @State private var quantity = 1

    var body: some View {
        Form {
            Section("Brightness") {
                Slider(value: $brightness, in: 0...1, step: 0.05) {
                    Text("Brightness")
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

`Slider`'s `in:` sets the value range and `step:` (optional) quantizes movement to fixed increments; the optional `minimumValueLabel:`/`maximumValueLabel:` closures add icons or text at each end of the track. `Stepper`'s `in:` similarly bounds the range, incrementing/decrementing by 1 (or a custom `step:`) per tap.

---

## 28.8 Picker

`Picker` presents a selection among a fixed set of options, bound to a selection value, and its visual presentation is controlled by `.pickerStyle()`.

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
            .pickerStyle(.navigationLink)

            Picker("Shipping", selection: $method) {
                ForEach(ShippingMethod.allCases) { option in
                    Text(option.rawValue).tag(option)
                }
            }
            .pickerStyle(.segmented)
        }
    }
}
```

Inside a `Form`, the default picker style pushes to a dedicated selection screen (like `.navigationLink`); `.segmented` instead renders an inline segmented control. Other styles include `.wheel` (the classic spinning wheel, often used inside a sheet or overlay) and `.menu` (a dropdown-style menu). As with `List` selection (24.11/26.10 territory), each option must carry a matching `.tag()` value for the binding to correctly track the selection.

---

## 28.9 DatePicker

`DatePicker` provides a dedicated control for selecting dates and/or times, bound to a `Date`.

```swift
struct EventFormView: View {
    @State private var eventDate = Date()

    var body: some View {
        Form {
            DatePicker("Event Date", selection: $eventDate, displayedComponents: [.date])

            DatePicker(
                "Event Date & Time",
                selection: $eventDate,
                in: Date()...,
                displayedComponents: [.date, .hourAndMinute]
            )
            .datePickerStyle(.graphical)
        }
    }
}
```

`displayedComponents:` controls whether the picker shows just a date, just a time, or both. The `in:` parameter restricts the selectable range (here, `Date()...` means "today onward, no past dates"). `.datePickerStyle(.graphical)` renders a full interactive calendar grid, an alternative to the default compact field-style presentation.

---

## 28.10 ColorPicker

`ColorPicker` provides a system-standard color-selection control, bound to a `Color`.

```swift
struct ThemeFormView: View {
    @State private var accentColor: Color = .blue

    var body: some View {
        Form {
            ColorPicker("Accent Color", selection: $accentColor)
            ColorPicker("Accent Color", selection: $accentColor, supportsOpacity: false)
        }
    }
}
```

Tapping a `ColorPicker` opens the system color-selection interface (spectrum, grid, and sliders). `supportsOpacity:` (default `true`) controls whether an alpha/opacity slider is included, useful to disable when the selected color will be used somewhere opacity isn't meaningful.

---

## 28.11 Buttons and Button Roles

`Button` triggers an action on tap, and its `role:` parameter communicates semantic intent that SwiftUI can use to apply appropriate default styling.

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

`role: .destructive` typically renders the button's label in red, signaling a dangerous or irreversible action (like deletion) without any manual color styling. `role: .cancel` communicates a dismissive, no-consequence action, and is also used by system-presented controls like `.confirmationDialog()` (27.15) to determine button styling and positioning automatically.

---

## 28.12 Button Styles Including .glass and .glassProminent

`.buttonStyle()` controls a button's visual presentation. Alongside long-standing styles like `.bordered` and `.borderedProminent`, recent SwiftUI versions introduce glass-material styles that adopt the system's translucent, frosted visual language.

```swift
struct StyledButtonsView: View {
    var body: some View {
        VStack(spacing: 16) {
            Button("Continue") { }
                .buttonStyle(.borderedProminent)

            Button("Learn More") { }
                .buttonStyle(.bordered)

            Button("Get Started") { }
                .buttonStyle(.glass)

            Button("Confirm") { }
                .buttonStyle(.glassProminent)
        }
    }
}
```

`.glass` applies a translucent, frosted-glass material background appropriate for buttons floating over rich or dynamic content (like images or video), letting underlying content subtly show through. `.glassProminent` is the higher-emphasis counterpart, appropriate for a screen's primary call-to-action while still adopting the glass material treatment — both styles let a button visually integrate with modern system chrome rather than sitting as a flat, opaque shape.

---

## 28.13 Form Validation Patterns

SwiftUI has no built-in "form validation" API — validation is typically implemented with computed properties that drive conditional UI, such as disabling a submit button until requirements are met.

```swift
struct SignUpValidationView: View {
    @State private var email = ""
    @State private var password = ""

    private var isEmailValid: Bool {
        email.contains("@") && email.contains(".")
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

The pattern is straightforward: derive `Bool` validity flags as computed properties from the current field values, conditionally show inline error text only once a field is non-empty (avoiding premature error messages on an untouched field), and gate the submit action's `.disabled()` state on overall form validity.

---

## 28.14 Keyboard Avoidance and Dismissal

SwiftUI automatically scrolls focused text fields above the keyboard within scrollable containers like `Form` and `List` in most cases, but standalone layouts (like a `VStack` in a plain `ScrollView`) sometimes need `.scrollDismissesKeyboard()` for controlling dismiss behavior, and a tap gesture for dismissing the keyboard on background tap.

```swift
struct KeyboardAwareFormView: View {
    @State private var message = ""

    var body: some View {
        ScrollView {
            VStack {
                TextField("Message", text: $message)
                    .textFieldStyle(.roundedBorder)
                    .padding()
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .onTapGesture {
            hideKeyboard()
        }
    }

    private func hideKeyboard() {
        UIApplication.shared.sendAction(
            #selector(UIResponder.resignFirstResponder),
            to: nil, from: nil, for: nil
        )
    }
}
```

`.scrollDismissesKeyboard(.interactively)` lets the keyboard dismiss progressively as the user drags down through scroll content, matching the feel of Messages.app. `.immediately` dismisses as soon as a drag begins, and `.never` disables scroll-driven dismissal entirely. The `resignFirstResponder` selector trick remains the standard SwiftUI-compatible way to programmatically dismiss the keyboard from a tap gesture, since SwiftUI has no direct "dismiss keyboard" API of its own.

---

## 28.15 .onSubmit() and Focus Movement

`.onSubmit()` runs a closure when the user taps the keyboard's return/submit key, and `@FocusState` enables programmatically moving focus between fields — commonly combined so tapping "next" advances to the following field.

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
                .onSubmit { focusedField = .email }

            TextField("Email", text: $email)
                .focused($focusedField, equals: .email)
                .keyboardType(.emailAddress)
                .submitLabel(.next)
                .onSubmit { focusedField = .phone }

            TextField("Phone", text: $phone)
                .focused($focusedField, equals: .phone)
                .keyboardType(.phonePad)
                .submitLabel(.done)
                .onSubmit { focusedField = nil }
        }
        .onSubmit {
            // fallback, fires for any field without its own .onSubmit
        }
    }
}
```

`@FocusState` mirrors the `Identifiable`-selection pattern seen with `List` (26.10) and `TabView` (27.7) — an enum representing each possible focus target, bound via `.focused($focusedField, equals:)` on each field. Each field's `.onSubmit()` closure advances `focusedField` to the next logical field, and setting it to `nil` on the final field dismisses the keyboard entirely, producing a smooth, guided multi-field entry flow.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Grouped form container | `Form`, `Section` | Platform-styled data-entry screens |
| Single-line text | `TextField` | Text entry with style/autocorrect control |
| Keyboard tuning | `.keyboardType()`, `.submitLabel()` | Input-appropriate keyboards and return key |
| Password entry | `SecureField` | Masked text with autofill integration |
| Multi-line text | `TextEditor` | Scrollable free-form text |
| Boolean input | `Toggle` | On/off switch |
| Range input | `Slider`, `Stepper` | Continuous vs. discrete value selection |
| Fixed-option selection | `Picker` | Segmented, wheel, menu, or navigation-link styles |
| Date/time selection | `DatePicker` | Compact or graphical calendar styles |
| Color selection | `ColorPicker` | System color-selection UI |
| Actions | `Button`, `role:` | Semantic styling for destructive/cancel actions |
| Modern button styling | `.buttonStyle(.glass/.glassProminent)` | Translucent material button treatments |
| Validation | Computed `Bool` properties | Disable submission until requirements are met |
| Keyboard handling | `.scrollDismissesKeyboard()` | Interactive, immediate, or disabled dismissal |
| Focus flow | `@FocusState`, `.onSubmit()` | Programmatic advancement between fields |

**Next up:** Section 29 — Animation.
