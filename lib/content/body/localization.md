## 71.1 String Catalogs and Extraction

String Catalogs (`.xcstrings` files) are Xcode's modern, unified format for managing all of an app's localizable strings — automatically extracted from `Text`, `String(localized:)`, and similar source code usage, with each string's translations across every supported language stored and editable together in one structured, Xcode-integrated file.

```swift
Text("Welcome back, \(userName)")  // automatically extracted into the String Catalog
Text("welcome_message", comment: "Greeting shown on the home screen after login")
```

Automatic extraction is a genuinely significant improvement over the older, separate `.strings`-file-per-language workflow — rather than a developer manually maintaining string keys across parallel files that can easily drift out of sync as code changes, Xcode scans source code directly and keeps the String Catalog synchronized with actual usage, surfacing newly added strings needing translation and flagging strings whose source has changed since it was last translated, considerably reducing the bookkeeping burden of keeping localization actually current with a codebase's real content.

---

## 71.2 Translation States and Comments for Translators

Each string entry in a String Catalog carries an explicit translation state (new, needs review, translated) per language, and an optional developer-provided comment giving a translator context that the string's raw text alone might not convey — genuinely important for strings that are short, ambiguous, or context-dependent in ways only the surrounding code and UI truly clarify.

```swift
Text("Close", comment: "Button that dismisses the current modal sheet, not a verb meaning 'nearby'")
```

Comments matter because a short string in isolation is frequently genuinely ambiguous out of context — "Close" could mean the verb (dismissing something) or the adjective (physically nearby), and a translator working purely from a spreadsheet of isolated strings has no way to disambiguate this without the developer's comment providing that missing context, meaning comments are a meaningfully high-leverage investment for exactly the strings most likely to otherwise be mistranslated.

---

## 71.3 Pluralization Rules

Different languages have genuinely different, sometimes surprisingly complex pluralization rules (English distinguishes only singular/plural, while some languages have distinct forms for one, few, many, and other counts) — String Catalogs support this via `.stringsdict`-style plural variation rules, letting `String(localized:)` automatically select the grammatically correct form based on a provided count.

```swift
Text("^[\(itemCount) item](inflect: true)")
// Or via explicit plural rule definitions in the String Catalog covering
// the "zero," "one," "two," "few," "many," and "other" categories
// that different languages require in varying combinations
```

Correctly handling pluralization is more genuinely complex than English speakers might assume purely from their own language's simple singular/plural distinction — languages like Arabic or Polish require several distinct grammatical plural categories depending on the exact count, and String Catalogs' plural rule support exists specifically to handle this genuine linguistic complexity correctly across every supported language, rather than an app awkwardly hardcoding English-style pluralization logic that would simply be grammatically wrong when applied to other languages.

---

## 71.4 Device and Variable-Width Variations

Beyond pluralization, String Catalogs also support device-specific variations (a shorter string for watchOS given its limited screen space, a longer one for macOS) and width variations (a compact string when space is limited, an expanded version when more room is available) — letting one logical string concept adapt its actual wording to context, not just to language.

```swift
// Width variation example: the same string concept, adapted to available space
// "Delete" for expanded/normal contexts
// "Del" for compact-width contexts where space is genuinely constrained
```

This device/width variation capability addresses a genuine limitation of treating localization purely as a language-translation problem — the *right* wording for a given UI element can depend on available space just as much as on language, and String Catalogs' variation support lets this context-sensitivity be handled through the same structured mechanism as language translation itself, rather than requiring ad hoc, manually-conditioned string selection logic scattered throughout the app's own code.

---

## 71.5 Localizing with AttributedString and Markdown

`AttributedString` supports Markdown-formatted localized strings (bold, italics, links) directly, letting translators work with and preserve meaningful formatting within a translated string without requiring separate, error-prone concatenation of multiple distinct localized string fragments around fixed formatting.

```swift
let attributedGreeting = try! AttributedString(
    localized: "Welcome to **\(appName)**! [Learn more](https://example.com/help)."
)
Text(attributedGreeting)
```

This is a meaningful improvement over the older, more brittle pattern of manually concatenating separately-localized string fragments around hardcoded formatting (`Text("Welcome to ") + Text(appName).bold() + Text("!")`) — that concatenation approach can produce grammatically incorrect results in languages with different word order, while Markdown-embedded localization lets the entire sentence (including its formatting) be translated as one coherent, natural unit, letting a translator naturally reorder words as their language's grammar actually requires while still preserving the intended bold emphasis or link placement correctly.

---

## 71.6 FormatStyle for Locale-Aware Dates

`Date.FormatStyle` produces locale-appropriate date formatting automatically — date component order, separators, month name conventions, and calendar system (71.11) all adapt to the current locale without a developer needing to manually construct locale-specific format strings.

```swift
let date = Date.now
Text(date.formatted(date: .long, time: .shortened))
// U.S. locale: "August 22, 2026 at 3:45 PM"
// German locale: "22. August 2026 um 15:45"
// automatically, with no locale-specific branching in app code
```

Manually constructing date format strings per locale (the older `DateFormatter` pattern, still requiring explicit format string knowledge) is genuinely error-prone and incomplete — date conventions vary in ways far more subtle than most developers would think to handle manually (component order, whether a leading zero is used, which calendar era conventions apply), and `Date.FormatStyle`'s automatic, locale-driven formatting handles this correctly without requiring the app's own code to encode locale-specific formatting knowledge at all.

---

## 71.7 FormatStyle for Numbers and Currency

Similarly, `FormatStyle` extends locale-aware formatting to numbers and currency — decimal separators, digit grouping, and currency symbol placement all vary meaningfully by locale, and `.formatted()` handles this correctly without manual locale-specific logic.

```swift
let price = 1234.56
Text(price.formatted(.currency(code: "USD")))
// U.S. locale: "$1,234.56"
// German locale: "1.234,56 $"
// — note both the grouping/decimal separator swap AND currency symbol placement
```

The decimal/grouping separator swap between locales (a comma versus a period serving opposite roles) is a classic, genuinely consequential localization pitfall if handled manually or incorrectly — a price displayed with the wrong separator convention isn't merely stylistically off but can be genuinely misread by a user as a completely different numeric value, making `FormatStyle`'s correct, automatic handling of this specific distinction a meaningfully important correctness concern, not just a cosmetic one.

---

## 71.8 Locale-Aware Sorting and Searching

Sorting strings correctly for a given locale requires more than simple byte-wise or codepoint comparison — `String.localizedStandardCompare` and locale-aware `Collator`-style comparison account for language-specific alphabetical ordering, accent/diacritic handling, and case-insensitive comparison conventions that differ across languages.

```swift
let names = ["Émile", "Émilie", "Émir"]
let sorted = names.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
// produces locale-appropriate ordering, correctly handling accented characters
// according to the current locale's actual alphabetical conventions
```

Naive, simple string comparison (comparing raw Unicode codepoint values directly) frequently produces genuinely wrong sort orders for real-world text — accented characters, different alphabetical traditions, and locale-specific collation rules (like how German sorts umlauted characters) all require locale-aware comparison to produce a result that actually matches what a user of that locale would consider correctly, intuitively sorted.

---

## 71.9 RTL Layout and Mirroring

Right-to-left languages (Arabic, Hebrew) require an app's entire layout to mirror — not just text alignment, but the whole interface's directional flow (navigation stack push direction, leading/trailing edge placement, icon positioning) — and SwiftUI's leading/trailing-based layout APIs (rather than explicit left/right) automatically support this mirroring when the app's layout direction is RTL.

```swift
HStack {
    Image(systemName: "chevron.left")
    Text("Back")
}
// Using .leading/.trailing (not .left/.right) throughout layout code lets
// SwiftUI automatically mirror this entire arrangement correctly for RTL locales,
// without any locale-specific conditional layout code
```

This is precisely why consistently using semantic leading/trailing (rather than literal left/right) throughout an app's layout code matters so significantly for RTL support — leading/trailing are direction-relative concepts that SwiftUI automatically flips appropriately based on the current layout direction, while explicit left/right positioning would require the app to manually detect RTL and conditionally swap positioning throughout the codebase, a considerably more error-prone and maintenance-heavy approach than simply using the direction-aware layout primitives consistently from the start.

---

## 71.10 Image and Symbol Flipping for RTL

Beyond layout mirroring, some images and SF Symbols should also visually flip for RTL locales (a "forward" arrow pointing left instead of right) while others genuinely shouldn't (a photo of a person's face, a brand logo) — `.flipsForRightToLeftLayoutDirection` and SF Symbols' built-in RTL-aware variants control this per-image behavior explicitly.

```swift
Image(systemName: "arrow.right")
    .flipsForRightToLeftLayoutDirection(true)  // becomes a leftward arrow under RTL

Image("companyLogo")
    .flipsForRightToLeftLayoutDirection(false)  // logos should never mirror
```

Correctly distinguishing which images genuinely need RTL mirroring from which shouldn't ever mirror is a real design judgment call, not a rule that can be applied uniformly — directional imagery (arrows indicating forward progress, a "next" chevron) conveys meaning through its direction and should flip to preserve that meaning under RTL, while non-directional imagery (a logo, a photograph) has no directional meaning to preserve and would look genuinely wrong or nonsensical if mirrored, making this per-image judgment an important part of a genuinely thoughtful RTL implementation rather than a purely mechanical, blanket setting.

---

## 71.11 Non-Gregorian Calendars

Beyond the Gregorian calendar assumed by many Western-centric apps by default, users in various locales may prefer other calendar systems (Islamic, Hebrew, Buddhist, Japanese era-based) for date display — `Calendar` and locale-aware `FormatStyle` (71.6) support these automatically when the user's locale/calendar preference indicates a non-Gregorian system.

```swift
var calendar = Calendar(identifier: .islamicUmmAlQura)
let components = calendar.dateComponents([.year, .month, .day], from: .now)
// correctly represents the current date within the Islamic calendar system,
// rather than assuming Gregorian dates are universal
```

Apps that hardcode Gregorian-specific date logic (assuming exactly 12 months named a specific way, or a specific year-numbering convention) can produce genuinely incorrect or confusing results for users whose actual calendar preference differs — properly using `Calendar` and locale-aware formatting throughout, rather than manually constructing Gregorian-specific date logic, is what actually respects users' real calendar preferences rather than silently imposing a Western-centric assumption on every user regardless of their actual locale and calendar convention.

---

## 71.12 Time Zones and DST Edge Cases

Time zone handling introduces genuine edge cases beyond simple offset arithmetic — daylight saving time transitions create an hour that's genuinely ambiguous (occurring twice, during a "fall back" transition) or entirely nonexistent (skipped during a "spring forward" transition), and correct time zone-aware code (using `TimeZone` and `Calendar` properly rather than naive fixed-offset math) must account for these genuinely tricky boundary conditions.

```swift
// Naive, incorrect approach: treating a time zone as a fixed offset
let wrongOffset = date.addingTimeInterval(-5 * 3600)  // breaks during DST transitions

// Correct approach: let Calendar/TimeZone handle the actual, non-fixed offset correctly
let calendar = Calendar.current
let localDate = calendar.date(byAdding: .day, value: 1, to: date)!
```

DST transition bugs are a classic, recurring category of subtle date/time bug precisely because they only manifest during the specific, narrow windows when a transition actually occurs (twice a year in regions observing DST) — code that works correctly for 363 days of the year can still contain a genuine bug that only surfaces during those specific transition windows, making deliberate testing around DST boundaries (not just "does date math generally work") a genuinely necessary part of thorough time zone-aware code validation.

---

## 71.13 Pseudolocalization for Testing

Pseudolocalization generates a synthetic "locale" that transforms strings in ways deliberately designed to surface localization bugs early — commonly, expanding string length (since translated text is frequently longer than English source text) and replacing standard characters with accented look-alikes, without requiring actual translation into a real target language.

```plaintext
// A pseudolocalized version of "Save Changes" might render as something like:
// "[Šàvéé Çhàñĝéš !!!]" — deliberately longer and using accented characters,
// surfacing layout truncation/wrapping issues and hardcoded-string assumptions
// without needing real German, French, or Japanese translations yet
```

Pseudolocalization's genuine value is catching localization-readiness problems *before* real translations even exist — a layout that breaks under pseudolocalized, artificially lengthened text would almost certainly also break under a real, similarly-lengthened French or German translation, meaning pseudolocalization testing can happen early in development (well before actual translation work is complete or even commissioned) and still surface genuine, actionable layout and hardcoding issues that would otherwise only be discovered much later, once real translated strings are finally available.

---

## 71.14 Localizing App Store Metadata

Beyond in-app string localization, App Store Connect separately supports localizing an app's actual store listing — name, subtitle, description, keywords, and screenshots — for each supported market, a genuinely distinct localization surface from the in-app String Catalog work covered throughout the rest of this section.

```plaintext
// App Store Connect metadata localization is configured per-locale, not via Swift code:
// - App name and subtitle (each with per-locale character limits)
// - Description and "what's new" release notes
// - Keywords (affecting App Store search visibility in that locale)
// - Screenshots (which can and often should show localized in-app content)
```

This metadata localization matters for genuinely practical business reasons beyond simple app usability — an app's actual App Store discoverability and conversion rate in a given market depend heavily on whether its store listing itself (not just its in-app content) is properly localized, meaning even a perfectly, thoroughly localized in-app experience can underperform in a given market if the store listing that convinces someone to actually download it in the first place remains untranslated or poorly localized.

---

## 71.15 AI-Assisted Localization in Xcode 27

As introduced in section 61.5, Xcode 27's AI-assisted localization can draft initial translations for new or changed String Catalog entries directly within Xcode — providing a meaningful head start on the localization workflow covered throughout this section, while still requiring the same human review discipline emphasized in 61.5 before any AI-drafted translation ships.

```swift
// AI-drafted translations populate directly into the String Catalog editor,
// marked with an appropriate "needs review" translation state (71.2)
// rather than being treated as already-final, human-verified translations
```

Placing AI-drafted translations into the same "needs review" state (71.2) that any other unreviewed translation would carry is a meaningful, deliberate design choice — it ensures AI-assisted localization integrates into the existing, already-established String Catalog review workflow (rather than bypassing it), meaning the genuine value of AI assistance here is accelerating the *first draft* of translation work across this section's entire localization surface (plurals, variations, Markdown-formatted strings, and more), not replacing the human review step that remains essential before any translation, AI-drafted or otherwise, actually ships to real users.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| String management | String Catalog (`.xcstrings`) | Unified, auto-extracted, synchronized string management |
| Translator context | Translation states, comments | Disambiguates short/ambiguous strings for translators |
| Grammatical correctness | Plural variation rules | Handles per-language plural category complexity |
| Contextual wording | Device/width variations | Adapts wording to available space, not just language |
| Formatted translation | `AttributedString`, Markdown | Preserves natural word order and formatting together |
| Date formatting | `Date.FormatStyle` | Locale-correct component order and conventions |
| Numeric formatting | `FormatStyle` (numbers/currency) | Correct separator and currency symbol conventions |
| Correct ordering | `localizedStandardCompare` | Locale-appropriate sorting and searching |
| Directional layout | Leading/trailing, RTL mirroring | Automatic whole-interface RTL support |
| Directional imagery | `.flipsForRightToLeftLayoutDirection` | Per-image judgment on RTL mirroring appropriateness |
| Calendar systems | `Calendar` (non-Gregorian identifiers) | Respects users' actual calendar preferences |
| Time correctness | `TimeZone`/`Calendar`-aware math | Avoids DST transition edge-case bugs |
| Early bug detection | Pseudolocalization | Surfaces layout/hardcoding issues before real translation |
| Store discoverability | App Store Connect metadata localization | A distinct, business-critical localization surface |
| Accelerated drafting | Xcode 27 AI-assisted localization | First-draft speed without bypassing human review |
