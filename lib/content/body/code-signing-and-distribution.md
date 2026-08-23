## 77.1 Certificates, App IDs, and Profiles Explained

Code signing rests on three distinct, related concepts — a certificate (proving a developer's identity, issued by Apple), an App ID (identifying a specific app, potentially with wildcard or explicit capability configuration), and a provisioning profile (binding a specific certificate, App ID, and set of allowed devices/capabilities together into what actually gets embedded in a built app to authorize it to run).

```plaintext
Certificate:          Proves "this is genuinely a specific registered developer/team"
App ID:                Identifies "this is genuinely this specific app" (e.g., com.example.myapp)
Provisioning Profile:  Binds together: [this certificate] + [this App ID] + [these devices/capabilities]
                       — actually embedded in the built app, authorizing it to run under these conditions
```

Understanding this three-part relationship is genuinely foundational for diagnosing any signing problem later in this section (77.4) — a provisioning profile is fundamentally a binding, meaning a signing failure is almost always traceable to a mismatch somewhere in this binding (a certificate that's expired or revoked, an App ID whose configured capabilities don't match what the app's entitlements actually request, or a profile that doesn't include the specific device being tested on), rather than being some inexplicable, opaque failure.

---

## 77.2 Automatic vs Manual Signing

Xcode's "Automatically manage signing" option handles certificate and profile creation/renewal transparently, appropriate for most individual developer and small-team scenarios, while manual signing requires explicitly selecting a specific certificate and provisioning profile — appropriate for CI environments (where `fastlane match`, section 76.9, typically manages this explicitly) or teams needing precise, deliberate control over exactly which signing identity is used.

```plaintext
// Automatic signing: Xcode silently creates/renews certificates and profiles as needed
// Manual signing: an explicit, specific certificate + profile combination is selected,
// with no automatic modification — appropriate for CI's need for deterministic,
// explicitly-controlled signing rather than Xcode's own automatic management
```

This distinction directly explains why CI environments typically use manual signing (via `fastlane match`) rather than Xcode's automatic management — CI needs deterministic, reproducible signing behavior across every single run, while Xcode's automatic signing can behave somewhat unpredictably in a headless CI context (potentially attempting to create new certificates or profiles rather than simply using an already-established, correct one), making manual, explicit signing control genuinely more appropriate and reliable for automated build environments.

---

## 77.3 Entitlements and Capability Drift

Entitlements (declared in an app's `.entitlements` file) specify which system capabilities an app is authorized to use (push notifications, App Groups recall section 43.4, CloudKit, and others) — and "capability drift" occurs when an app's actual entitlements file and its corresponding App ID's configured capabilities in the Apple Developer portal fall out of sync, a genuinely common source of confusing signing failures.

```xml
<!-- MyApp.entitlements -->
<key>com.apple.developer.icloud-container-identifiers</key>
<array>
    <string>iCloud.com.example.myapp</string>
</array>
```

Capability drift is a genuinely easy, common mistake specifically because entitlements can be added locally (in Xcode, directly in the `.entitlements` file) without automatically, correspondingly updating the App ID's capability configuration on Apple's Developer portal — a developer enabling a new capability like CloudKit locally in Xcode, without the corresponding App ID configuration actually being updated to match, produces exactly the kind of mismatch that manifests as a confusing signing failure, since the local entitlements request a capability the actual provisioning profile (bound to the outdated App ID configuration) doesn't authorize.

---

## 77.4 Why Signing Breaks and How to Diagnose It

Signing failures typically stem from a handful of genuinely common, diagnosable root causes — an expired certificate, a provisioning profile that doesn't include a specific test device, capability drift (77.3), or a profile that's simply outdated relative to the app's current configuration — with Xcode's own signing error messages and the Apple Developer portal's certificate/profile management pages providing the actual diagnostic information needed to identify which specific cause applies.

```plaintext
// Common signing error categories to check systematically:
// - "No signing certificate found" → certificate expired, revoked, or not installed locally
// - "Provisioning profile doesn't include device" → the specific test device's UDID isn't registered
// - "Entitlement not supported" → capability drift (77.3) between local entitlements and App ID config
// - "Profile has expired" → a profile past its validity period needs regeneration
```

Recognizing these specific, distinct failure categories (rather than treating every signing error as one undifferentiated, mysterious problem) is the actual diagnostic skill worth developing here — because each category has a genuinely distinct, specific root cause and corresponding fix, correctly identifying *which* category a given failure actually falls into (by carefully reading Xcode's specific error message rather than just noting that "signing failed") is what turns a signing problem from a frustrating, opaque blocker into a straightforward, mechanical fix.

---

## 77.5 Archiving and Exporting a Build

Archiving (`Product > Archive` in Xcode, or `xcodebuild archive` in CI, recall section 76.2) produces a `.xcarchive` — a complete, signed build bundle including debug symbols — from which a build can then be exported in different forms depending on the intended distribution channel (App Store submission, ad hoc distribution, enterprise distribution, 77.6).

```bash
xcodebuild archive -scheme MyApp -archivePath MyApp.xcarchive
xcodebuild -exportArchive -archivePath MyApp.xcarchive -exportPath ./export \
  -exportOptionsPlist ExportOptions.plist
```

The `.xcarchive`'s inclusion of debug symbols alongside the signed build is precisely why archives (rather than ordinary build products) are the appropriate starting point for the dSYM upload automation discussed in section 76.13 — an archive genuinely contains everything needed both to distribute the actual app *and* to later symbolicate crash reports from that specific build, making the archive (not a plain build output) the correct artifact a release pipeline should be built around preserving and processing.

---

## 77.6 Ad Hoc and Enterprise Distribution

Ad hoc distribution allows installing a build directly on a specific, limited set of registered devices (identified by UDID in the provisioning profile) without going through TestFlight or the App Store, appropriate for very small-scale internal testing, while enterprise distribution (requiring an Apple Developer Enterprise Program membership) allows installing a build on any of an organization's own devices without per-device UDID registration, appropriate for genuinely internal, company-only apps never intended for public distribution.

```plaintext
// Ad hoc: provisioning profile explicitly lists specific device UDIDs — a hard device count limit applies
// Enterprise: no per-device UDID registration needed, but strictly limited to internal organizational use,
//             explicitly prohibited by Apple's terms for distribution to the general public
```

The distinction between these two distribution methods reflects genuinely different intended scales and use cases, each with real constraints worth understanding before choosing between them — ad hoc distribution's UDID-based device limit makes it suitable only for small-scale testing (not general internal company-wide distribution), while enterprise distribution's broader internal reach comes with Apple's explicit contractual requirement that it remain genuinely internal-only, with real consequences (including potential enterprise certificate revocation) for organizations found using it to distribute apps to the general public rather than their own employees.

---

## 77.7 MDM and Custom App Distribution 🔴

Mobile Device Management (MDM) systems let organizations manage and distribute apps to enrolled, organization-owned devices in a centrally administered way — including deploying custom, internally-developed apps (via enterprise distribution, 77.6, or Apple Business Manager's custom app distribution) alongside configuring managed app settings and restrictions across an organization's device fleet.

```plaintext
// MDM-distributed custom apps typically combine:
// - Enterprise or Apple Business Manager custom app distribution (the actual app binary)
// - Managed App Configuration (pre-configured settings pushed to the app at install/launch,
//   letting organizations pre-configure things like a server endpoint without user input)
```

MDM-based distribution represents a genuinely different distribution model from anything else covered in this section — rather than an end user discovering and installing an app through the public App Store, MDM enables centrally-administered, organization-controlled deployment (with the ability to also push configuration and enforce restrictions) appropriate specifically for genuinely internal, enterprise-managed device fleets where an organization's IT department, not individual end users, controls what gets installed and how it's configured.

---

## 77.8 Notarization and Alternative Marketplaces (EU) 🔴

Regulatory changes in the EU (under the Digital Markets Act) have required Apple to support alternative app marketplaces and direct distribution outside the traditional App Store on iOS within the EU specifically, with Apple's notarization process providing a baseline security/integrity check for apps distributed through these alternative channels, distinct from full App Store review.

```plaintext
// EU-specific alternative distribution model (conceptual):
// - An app can be distributed via an alternative marketplace or directly, within the EU
// - Apple's notarization process still performs a baseline security check
//   (though distinct from, and less extensive than, full App Store review)
// - This distribution model does not apply outside the EU's specific regulatory scope
```

This represents a genuinely significant, relatively recent shift in iOS's traditionally closed distribution model, though one specifically scoped to EU regulatory requirements rather than a global change — notarization's baseline security check reflects Apple's attempt to preserve some minimal integrity/security guarantee even for apps distributed outside its own traditional App Store review process, a genuinely evolving area of the platform that developers targeting EU markets specifically need to stay current on, distinct from the traditional single-marketplace distribution model that continues to apply everywhere else.

---

## Summary

| Concept | Key Mechanism | Purpose |
|---|---|---|
| Signing foundation | Certificate, App ID, provisioning profile | The three-part binding underlying all code signing |
| Signing management | Automatic vs. manual signing | Xcode convenience vs. CI-appropriate deterministic control |
| Capability sync | Entitlements vs. App ID configuration | Avoiding "capability drift" signing failures |
| Systematic diagnosis | Common signing error categories | Turning opaque failures into mechanical, identifiable fixes |
| Distributable artifact | `.xcarchive` | Signed build plus debug symbols, the basis for all export forms |
| Small-scale testing | Ad hoc distribution | UDID-limited, non-TestFlight device installation |
| Internal-only distribution | Enterprise distribution | Broader reach, strictly internal-use contractual requirement |
| Centralized deployment | MDM, custom app distribution | Organization-controlled installation and configuration |
| Evolving distribution model | EU alternative marketplaces, notarization | Regulatory-driven, EU-scoped alternative to App Store-only distribution |
