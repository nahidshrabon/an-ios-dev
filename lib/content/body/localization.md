**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**Localization** makes the app feel native in every language and region: not just translated words, but correct **plurals**, **dates**, **numbers**, **sorting**, **right-to-left** layout, **calendars**, and **time zones**. This section covers String Catalogs, helping translators, formatting with `FormatStyle`, RTL, date and time pitfalls, testing with pseudolanguages, App Store metadata, and AI-assisted translation.

---

## 71.1 String Catalogs and Extraction 🟢

A **String Catalog** (`Localizable.xcstrings`) holds **all** your app's strings and **all** their translations in one file, with an editor in Xcode. You don't add keys by hand: when you **build**, Xcode **extracts** strings from your code automatically.

```swift
// SwiftUI: string literals in these APIs are localized automatically
Text("Recipes")
Button("Add Recipe") { addRecipe() }
Label("Favorites", systemImage: "heart")
Text("Welcome back, \(userName)")          // key in the catalog: "Welcome back, %@"

// Outside views: String(localized:) and LocalizedStringResource
let title = String(localized: "New Recipe")
let message: LocalizedStringResource = "Recipe saved"     // can be passed around, localized later
```

⚠️ The classic bug: a **`String` variable** is **not** localized:

```swift
let key = "Recipes"
Text(key)                     // ❌ shows "Recipes" in every language (String → verbatim)
Text(LocalizedStringKey(key)) // ✅ looks it up

// For your own views, take LocalizedStringKey (or LocalizedStringResource), not String
struct SectionHeader: View {
    let title: LocalizedStringKey           // ✅ SectionHeader(title: "Breakfast") gets localized
    var body: some View { Text(title).font(.headline) }
}
```

Why catalogs beat the old `.strings` files:

| Old `.strings` files | String Catalog |
|---|---|
| One file per language, keys added **by hand** | **One** file, filled **automatically** at build |
| Files drift out of sync with the code | New strings appear; removed ones are marked **stale** |
| No overview | Shows how complete each language is (a percentage) |
| Plurals in a separate `.stringsdict` | Plurals and variations **built in** (71.3, 71.4) |

Already have `.strings` files? Right-click them ▸ **Migrate to String Catalog**.

Use `Text(verbatim:)` for text that must **never** be translated, like a user's own content or a code.

---

## 71.2 Translation States and Comments for Translators 🟢

Each string in the catalog has a **state** per language:

| State | Meaning |
|---|---|
| **New** | Not translated yet |
| **Needs Review** | Translated, but someone must check it (e.g. the source changed, or an AI draft, 71.15) |
| **Translated** | Done |
| **Stale** | The string no longer exists in the code |

Translators often see strings **without** the app: just a list. A short string can be **ambiguous**:

| English | Could mean | German |
|---|---|---|
| "Close" | Shut the sheet (verb) | "Schließen" |
| "Close" | Near (adjective) | "Nah" |
| "Book" | A cookbook (noun) | "Buch" |
| "Book" | Reserve a class (verb) | "Buchen" |

So add a **comment** that explains **where** and **how** it's used:

```swift
Button(String(localized: "Close", comment: "Button: dismisses the recipe detail sheet")) {
    dismiss()
}

Text("Book", comment: "Button: reserves a seat in a live cooking class (verb)")

Text("\(count) servings", comment: "Shown under the recipe title. %lld = number of servings")
```

Comments appear in the catalog editor and in the files you **export** for translators (Product ▸ **Export Localizations** creates `.xcloc` packages, using the standard XLIFF format inside). Newer Xcode versions can even **suggest** comments from how a string is used; check and improve them.

Comments are **cheap** to write and prevent the **most common** translation mistakes. Write one for every short, single-word, or ambiguous string.

---

## 71.3 Pluralization Rules 🟡

English has **two** forms: "1 recipe", "2 recipes". Many languages have **more**:

| Language | Plural categories |
|---|---|
| English, German | one, other |
| French | one (0 **and** 1), other |
| Russian, Polish | one, **few**, **many**, other |
| Arabic | **zero**, one, **two**, few, many, other |
| Japanese, Chinese | **other** only (no plural forms) |

So never build plurals with `if count == 1`. Let the system choose:

**Option 1: a plural variation in the String Catalog.** Write the string with the number:

```swift
Text("\(recipeCount) recipes")      // catalog key: "%lld recipes"
```

In the catalog, right-click the string ▸ **Vary by Plural**. Xcode shows **exactly** the categories each language needs (one/other for English, one/few/many/other for Russian), and translators fill each one:

```
English:  one   → "%lld recipe"
          other → "%lld recipes"
Russian:  one   → "%lld рецепт"      (1, 21, 31…)
          few   → "%lld рецепта"     (2–4, 22–24…)
          many  → "%lld рецептов"    (5–20, 25–30…)
          other → "%lld рецепта"
```

**Option 2: automatic grammar agreement** for supported languages (English, French, German, Spanish, Italian, Portuguese, and more):

```swift
Text("^[\(recipeCount) recipe](inflect: true)")   // "1 recipe" / "3 recipes", agreement done for you
```

The plural form can also affect **other** words in the sentence (adjectives, verbs) in some languages. With catalog variations, translators control the **whole** sentence for each category.

---

## 71.4 Device and Variable-Width Variations 🟡

Sometimes the right **wording** depends on the **device**, not only the language. A String Catalog can **vary by device**:

```swift
Text("Tap a recipe to see the steps")
// Catalog ▸ right-click ▸ Vary by Device:
//   iPhone / iPad:  "Tap a recipe to see the steps"
//   Mac:            "Click a recipe to see the steps"
//   Apple Watch:    "Tap for steps"            (tiny screen)
//   Apple Vision:   "Pinch a recipe to see the steps"
```

Older `.stringsdict` files also supported **width variations** (`NSStringVariableWidthRuleType`): several versions of one string by **length**, picked with `variantFittingPresentationWidth(_:)` in UIKit.

In modern SwiftUI, the more flexible tool is to let the **layout** choose between strings that **fit**:

```swift
ViewThatFits {
    Text("Add to Shopping List")            // used when it fits
    Text("Add to List")                     // shorter fallback
    Image(systemName: "cart.badge.plus")    // last resort
        .accessibilityLabel("Add to Shopping List")
}
```

`ViewThatFits` picks the **first** child that fits the available space, for **each** language: German's longer "Zur Einkaufsliste hinzufügen" may fall back to the short form, while English keeps the long one.

Prefer layouts that **grow** (wrapping, flexible widths) over abbreviations: abbreviations are often **unclear**, especially when translated.

---

## 71.5 Localizing with AttributedString and Markdown 🟡

Never build a sentence by **gluing** localized pieces together:

```swift
// ❌ Word order is fixed to English; translators can't fix it
Text("Welcome to ") + Text("RecipeApp").bold() + Text("!")
```

In Japanese, the app name comes **first**; in German, the verb may move. Translators need the **whole sentence**.

Instead, use **Markdown** inside **one** localized string. `Text` with a string literal supports it directly:

```swift
Text("Welcome to **\(appName)**! [Learn more](https://example.com/help)")
// Catalog key: "Welcome to **%@**! [Learn more](https://example.com/help)"
// German:      "Willkommen bei **%@**! [Mehr erfahren](https://example.com/de/help)"
```

The translator moves the **bold** part and the **link** wherever their language needs them, and can even point the link to a **localized** page.

Outside `Text` literals, create an `AttributedString`:

```swift
let banner = AttributedString(localized: "Your recipe **\(recipe.title)** was saved.")
Text(banner)

// Style parts of it in code, e.g. color the bold run
var styled = AttributedString(localized: "Only **\(minutesLeft) minutes** left")
for run in styled.runs where run.inlinePresentationIntent == .stronglyEmphasized {
    styled[run.range].foregroundColor = .orange
}
```

Supported Markdown: **bold**, *italic*, `code`, ~~strikethrough~~, and links. Keep it simple: translators must understand and keep the markup.

---

## 71.6 FormatStyle for Locale-Aware Dates 🟢

Date formats differ **a lot** between regions: order, separators, month names, 12/24-hour time. **`Date.FormatStyle`** gets them right automatically:

```swift
let classDate = Date.now

classDate.formatted(date: .long, time: .shortened)
// 🇺🇸 "January 12, 2026 at 6:30 PM"
// 🇩🇪 "12. Januar 2026 um 18:30"
// 🇯🇵 "2026年1月12日 18:30"

classDate.formatted(.dateTime.weekday(.wide).day().month(.wide))
// 🇺🇸 "Monday, January 12"   🇫🇷 "lundi 12 janvier"   ← you choose the PARTS; the locale picks the ORDER

classDate.formatted(.relative(presentation: .named))
// "tomorrow", "in 3 days", "demain", "morgen"

(classStart..<classEnd).formatted(.interval.hour().minute())
// 🇺🇸 "6:30 – 8:00 PM"   🇩🇪 "18:30–20:00"

Duration.seconds(5_400).formatted(.units(allowed: [.hours, .minutes], width: .wide))
// "1 hour, 30 minutes"   "1 Stunde und 30 Minuten"
```

| ❌ Don't, for display | ✅ Do |
|---|---|
| `formatter.dateFormat = "MM/dd/yyyy"` | `.formatted(date: .numeric, time: .omitted)` |
| Hard-coded "AM"/"PM" | Let the format style decide (many regions use 24-hour time) |
| Building "Monday, Jan 12" by hand | `.dateTime.weekday().month().day()` |

**But** for data exchanged with **servers** and files, use a **fixed** format that never changes with the user's settings:

```swift
let wire = classDate.formatted(.iso8601)            // "2026-01-12T17:30:00Z": same everywhere
let parsed = try Date(wire, strategy: .iso8601)
```

Rule: **ISO 8601** for machines, **`FormatStyle`** for people.

---

## 71.7 FormatStyle for Numbers and Currency 🟢

Numbers are just as regional:

```swift
let price: Decimal = 1234.56

price.formatted(.currency(code: "USD"))
// 🇺🇸 "$1,234.56"    🇩🇪 "1.234,56 $"    🇫🇷 "1 234,56 $US"    🇮🇳 "$1,234.56"

(0.25).formatted(.percent)                 // "25%"  (🇩🇪 "25 %",  🇫🇷 "25 %")
1_500_000.formatted(.number.notation(.compactName))   // "1.5M"  (🇩🇪 "1,5 Mio.")
```

Look at the German result: the **comma and period swap** roles. "1.234" means **one thousand two hundred thirty-four** in Germany, but **one point two** in the US. Formatting by hand doesn't just look wrong: it shows the wrong **number**.

Two rules for money:

- The **currency code** comes from your **data** (the price is in USD), not from the user's locale. A German user looking at a USD price must still see dollars.
- Store and compute money with **`Decimal`**, not `Double` (no rounding surprises).

For a **recipe app**, units matter too. **`Measurement`** can convert to the user's preferred system:

```swift
let flour = Measurement(value: 250, unit: UnitMass.grams)

flour.formatted(.measurement(width: .abbreviated, usage: .asProvided))   // "250 g" everywhere
flour.formatted(.measurement(width: .abbreviated, usage: .general))      // 🇺🇸 converted (oz/lb)   🇩🇪 "250 g"
```

When **reading** numbers the user types, parse them with the **locale** too: `TextField("Price", value: $price, format: .currency(code: "EUR"))` accepts "12,50" in Germany and "12.50" in the US.

---

## 71.8 Locale-Aware Sorting and Searching 🟡

Plain `<` compares **Unicode code points**, which gives wrong results for real text:

```swift
let names = ["banana", "Apple", "éclair", "cherry", "Step 10", "Step 2"]

names.sorted()
// ["Apple", "Step 10", "Step 2", "banana", "cherry", "éclair"]
// ❌ uppercase before lowercase, "é" after "z", "10" before "2"

names.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
// ["Apple", "banana", "cherry", "éclair", "Step 2", "Step 10"]
// ✅ like Finder: case-insensitive, accents in place, numbers by value
```

With key paths (iOS 15+):

```swift
recipes.sorted(using: KeyPathComparator(\.title, comparator: .localizedStandard))
```

The **right** order also depends on the **language**:

| Language | Rule |
|---|---|
| Swedish | å, ä, ö come **after** z |
| German | ä is sorted with a (dictionary order) |
| Spanish (traditional) | ñ is its own letter, after n |

Localized comparison follows the user's locale automatically.

**Searching** needs the same care. Users type "creme" and expect "Crème brûlée":

```swift
"Crème brûlée".localizedStandardContains("creme")      // true: ignores case and accents
"Crème brûlée".contains("creme")                         // false

let results = recipes.filter { $0.title.localizedStandardContains(query) }
```

Use `localizedStandard…` methods for anything the **user** sees or types: lists, search, sorting by name.

---

## 71.9 RTL Layout and Mirroring 🟢

**Right-to-left** (RTL) languages like **Arabic** and **Hebrew** flip the **whole** interface: reading starts on the right, navigation pushes from the left, the back button is on the right.

SwiftUI does this **automatically** if you use **leading/trailing** instead of left/right:

```swift
HStack {
    Image(systemName: "chevron.backward")      // ✅ "backward" flips in RTL ("chevron.left" doesn't)
    Text("Recipes")
    Spacer()
}
.padding(.leading, 16)                         // leading = left in English, right in Arabic
.frame(maxWidth: .infinity, alignment: .leading)
```

| ❌ Fixed direction | ✅ Direction-aware |
|---|---|
| "left", "right" | **leading**, **trailing** |
| `chevron.left`, `arrow.right` | `chevron.backward`, `arrow.forward` |
| `.offset(x: 20)` for layout | Alignment and padding (offsets don't flip) |
| Custom `Path` / `Canvas` drawing assumes left-to-right | Check `@Environment(\.layoutDirection)` and flip yourself |
| UIKit `leftAnchor` | `leadingAnchor` |

**Test** without knowing Arabic: in the scheme, set **App Language ▸ Right-to-Left Pseudolanguage** (71.13), or preview with:

```swift
#Preview("RTL") {
    RecipeRow(recipe: .sample)
        .environment(\.layoutDirection, .rightToLeft)
}
```

Text alignment also follows the language: `.multilineTextAlignment(.leading)` means "start of the line", whichever side that is.

---

## 71.10 Image and Symbol Flipping for RTL 🟡

Layout mirrors automatically, but **images** are a **judgment call**: flip what has a **direction meaning**, keep what doesn't:

| Flip in RTL | Don't flip |
|---|---|
| Arrows for "forward"/"back", "next" chevrons | **Logos** and brand marks |
| Progress that moves "forward" | **Photos** of people and things |
| A list icon with bullets on the left | **Clocks** (they turn the same way everywhere) |
| A "reply" or "undo" arrow | **Media playback** controls (play ▶ always points right) |
| | Checkmarks, numbers, most symbols |

For **SF Symbols**, many directional symbols flip **automatically** (use the `forward`/`backward` names). For your **own** images:

```swift
Image("swipe-hint-arrow")
    .flipsForRightToLeftLayoutDirection(true)      // mirrors in RTL

Image("recipe-app-logo")                           // default: never mirrored
```

In the **asset catalog**, you can set an image's **Direction** to "Left to Right, Mirrors" so it flips everywhere it's used, or provide a **separate** RTL image when simple mirroring looks wrong (for example, an illustration with text in it).

Ask "**does this image point somewhere?**" If it shows a **direction** of movement or reading, flip it. If it shows a **thing**, don't.

---

## 71.11 Non-Gregorian Calendars 🟡

Not everyone uses the **Gregorian** calendar for daily life. Users can choose the **Islamic**, **Hebrew**, **Buddhist**, **Japanese**, and other calendars in Settings, and in Thailand the Buddhist calendar is standard (2026 is year **2569**).

If you use **`Calendar.current`** and **`FormatStyle`** (71.6) for display, this works **automatically**:

```swift
let today = Date.now
today.formatted(date: .long, time: .omitted)
// Gregorian:  "January 12, 2026"
// Buddhist:   "January 12, 2569 BE"
// Japanese:   "Reiwa 8 January 12"   (era-based year)
// Islamic:    "Rajab 23, 1447 AH"
```

Bugs come from **hard-coding** Gregorian assumptions:

```swift
// ❌ Assumes the Gregorian year, 12 months, and a fixed month name list
let year = Calendar.current.component(.year, from: today)    // 2569 for a Buddhist-calendar user!
let label = "Recipes from \(monthNames[month - 1]) \(year)"

// ✅ Display: let the user's calendar decide
let label = today.formatted(.dateTime.month(.wide).year())

// ✅ Logic and storage that must be Gregorian: say so explicitly
let gregorian = Calendar(identifier: .gregorian)
let storedYear = gregorian.component(.year, from: today)      // 2026, always
```

Other calendar facts that differ by **region**:

| Setting | Varies |
|---|---|
| `calendar.firstWeekday` | Week starts **Sunday** (US), **Monday** (most of Europe), **Saturday** (parts of the Middle East) |
| Weekend days | Saturday–Sunday, or Friday–Saturday |
| Number of months | 12, or **13** in a leap year (Hebrew calendar) |

Use `Calendar.current` for anything **shown** (week views, "this month"), and an explicit Gregorian/ISO calendar for **data**.

---

## 71.12 Time Zones and DST Edge Cases 🔴

**Daylight saving time** (DST) makes days **not** always 24 hours long:

```
US, 8 March 2026 (spring forward): 02:00 → 03:00   the day has 23 hours; 02:30 doesn't EXIST
US, 1 November 2026 (fall back):   02:00 → 01:00   the day has 25 hours; 01:30 happens TWICE
```

So "**add 86,400 seconds**" is not "**add one day**":

```swift
let calendar = Calendar.current                        // the user's time zone, e.g. America/New_York
let saturday6pm = makeDate(year: 2026, month: 3, day: 7, hour: 18)   // a Saturday, New York time

// ❌ Fixed seconds: lands at 19:00 on Sunday (the day only had 23 hours)
let wrong = saturday6pm.addingTimeInterval(86_400)

// ✅ Calendar math: 18:00 on Sunday, as the user expects
let right = calendar.date(byAdding: .day, value: 1, to: saturday6pm)!
```

Rules for date and time code:

| Situation | Store | Why |
|---|---|---|
| A **moment** ("the order was paid") | A `Date` (an absolute instant) | Same moment for everyone |
| An **event at a place** ("cooking class, 18:00 Paris") | The `Date` **plus** the **time zone identifier** ("Europe/Paris") | Rules change; offsets aren't enough |
| A **floating** date ("birthday: 14 May", "every day at 07:00") | `DateComponents` | Means "local time, wherever I am" |

More traps:

- A time zone is **not** a fixed offset. "New York = UTC−5" is wrong half the year (it's UTC−4 in summer), and countries **change** their rules.
- Repeating reminders at a **nonexistent** time (02:30 on spring-forward day) need a decision: use `calendar.nextDate(after:matching:matchingPolicy:)` with `.nextTime` or `.previousTimePreservingSmallerComponents`.
- **Test** with fixed time zones and the **transition dates**, not just "today":

```swift
@Test func addingADayAcrossSpringForwardKeepsTheClockTime() throws {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = try #require(TimeZone(identifier: "America/New_York"))

    let start = try #require(calendar.date(from: DateComponents(year: 2026, month: 3, day: 7, hour: 18)))
    let next = try #require(calendar.date(byAdding: .day, value: 1, to: start))

    #expect(calendar.component(.hour, from: next) == 18)
    #expect(next.timeIntervalSince(start) == 23 * 3600)       // only 23 real hours passed
}
```

DST bugs hide for **363 days** a year and appear on the two transition days, often at night, in production. Tests with **fixed** dates and zones (65.12) catch them in seconds.

---

## 71.13 Pseudolocalization for Testing 🟢

You can find most localization **bugs** before a single real translation exists, with **pseudolanguages**. In the scheme: **Edit Scheme ▸ Run ▸ Options ▸ App Language**:

| Pseudolanguage | Shows | Finds |
|---|---|---|
| **Double-Length** | Every string repeated: "Save Save" | **Truncation** and layouts that can't grow (German and Finnish are often 30–50% longer than English) |
| **Accented** | "Šàvé Çhàñĝéš" | Fonts or code that mishandle accents; strings you forgot to localize stay plain |
| **Bounded String** | "[# Save #]" | Text that's **cut off** (you'd lose the closing bracket) and strings built from pieces |
| **Right-to-Left** | Mirrored layout (71.9) | Hard-coded left/right, images that should flip |

Also turn on **Show non-localized strings** (same Options tab): strings that aren't localized appear in **UPPERCASE**, so you spot hard-coded text at a glance.

```
Typical findings:
- "SAVE CHANGES" in caps         → a String variable passed to Text (71.1)
- "[# Add to Shopping Li"        → a fixed-width button; let it wrap or use ViewThatFits (71.4)
- Price label stays on the left  → .offset or .left used instead of .leading
```

Make it a routine: run your main screens in **Double-Length** and **RTL** before each release. The same works in **UI tests** (67.6) by passing `-AppleLanguages (...)` launch arguments, and in **test plans** with one configuration per language (66.14).

---

## 71.14 Localizing App Store Metadata 🟢

Your **App Store page** is localized separately, in **App Store Connect**, not in the String Catalog. For each language you choose:

| Field | Limit | Notes |
|---|---|---|
| **App name** | 30 characters | Can differ per market |
| **Subtitle** | 30 characters | A short value statement |
| **Keywords** | 100 characters | Affects **search** in that country's store; research local terms |
| **Promotional text** | 170 characters | Can be updated without a new app version |
| **Description** | 4,000 characters | |
| **What's New** | | Per release |
| **Screenshots** and previews | | Should show the app **in that language** |

Why it matters: people decide to download from the **store page**. A perfectly localized app with an **English-only** page and English screenshots loses many users in, say, Japan or Brazil before they ever open it.

Practical tips:

- Generate **localized screenshots** automatically: UI tests (67) launched with each language, taking screenshots with fixed demo data.
- **Keywords** aren't translations: research what people **search** for locally ("recetas" vs. "cocina").
- In-app purchase **names** and descriptions (56.2) are localized in App Store Connect too.
- Keep **privacy** and **accessibility** information (70.18) accurate for every market.

---

## 71.15 AI-Assisted Localization in Xcode 27 🟡

The Xcode 27 tools (introduced in 61.5) can **draft** translations for new and changed String Catalog entries. That speeds up the **first** step a lot. But a draft is not a finished translation.

⚠️ Check the documentation for the exact feature set in your Xcode version.

The safe workflow:

```
1. AI drafts translations for new strings
2. Drafts get the "Needs Review" state (71.2), never "Translated"
3. A native speaker reviews them in context (the app running in that language)
4. Only then: mark as Translated and ship
```

What reviewers should check, because AI drafts often get these **wrong**:

| Check | Example problem |
|---|---|
| **Context** | "Book" translated as a noun instead of the verb (71.2: comments help the AI too) |
| **Placeholders** | `%@` or `%lld` dropped, duplicated, or in a broken order |
| **Plurals** | Missing "few"/"many" forms (71.3) |
| **Tone** | Formal vs. informal "you" (German *Sie/du*, French *vous/tu*) mixed in one app |
| **Terminology** | Your feature names or brand terms translated when they shouldn't be |
| **Length** | Correct but far too long for the button (71.13) |

Good **comments** (71.2) and a **glossary** of your terms make AI drafts much better: the model gets the same context a human translator would.

The value of AI here is **speed** on the first draft across everything in this section: plurals, variations, Markdown strings. The human **review** step stays, exactly as for any other unreviewed translation.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| String Catalogs | `.xcstrings`, `String(localized:)`, `LocalizedStringKey` | One file, auto-extracted; avoid `String` variables in `Text` |
| Translator help | States, comments, Export Localizations | Context prevents mistranslation |
| Plurals | Vary by Plural, `inflect: true` | Correct forms for every language |
| Variations | Vary by Device, `ViewThatFits` | The right wording for the space |
| Rich text | Markdown in one localized string | Translators control word order |
| Dates | `Date.FormatStyle`; ISO 8601 for data | Local formats for people, fixed for machines |
| Numbers and money | `.currency(code:)`, `Decimal`, `Measurement` | Correct separators, currencies, and units |
| Sorting and search | `localizedStandardCompare`, `localizedStandardContains` | Order and matching users expect |
| RTL layout | leading/trailing, `forward`/`backward` symbols | The whole UI mirrors automatically |
| Image flipping | `flipsForRightToLeftLayoutDirection`, asset Direction | Flip directions, not things |
| Calendars | `Calendar.current` for display, Gregorian for data | Respect the user's calendar |
| Time zones and DST | Calendar math, time zone identifiers, fixed-date tests | Days aren't always 24 hours |
| Pseudolanguages | Double-Length, Accented, Bounded, RTL | Find bugs before translations exist |
| Store page | App Store Connect localized metadata | Where download decisions happen |
| AI drafts | Needs Review + native-speaker review | Faster first drafts, same quality bar |
