**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 77.1 Certificates, App IDs, and Profiles Explained 🟢

**Code signing** proves who made an app and allows it to run. It is built on **three pieces**:

| Piece | What it proves | Example |
|---|---|---|
| **Certificate** | "This is a registered developer or team" | Apple Distribution: Example Inc. |
| **App ID** | "This is this specific app" (and its capabilities) | `com.example.myapp` |
| **Provisioning profile** | Ties a certificate + an App ID + devices and capabilities together | Embedded in the built app |

```plaintext
Certificate:          Proves "this is genuinely a specific registered developer/team"
App ID:                Identifies "this is genuinely this specific app" (e.g., com.example.myapp)
Provisioning Profile:  Binds together: [this certificate] + [this App ID] + [these devices/capabilities]
                       — actually embedded in the built app, authorizing it to run under these conditions
```

See the signing certificates on your Mac:

```bash
security find-identity -v -p codesigning
```

Look inside a provisioning profile (it is a signed file):

```bash
security cms -D -i embedded.mobileprovision      # shows the App ID, devices, entitlements, and expiry
```

**Remember the binding.** Almost every signing error is a **mismatch** somewhere in it: an expired certificate, an App ID without a needed capability, or a profile that does not include your device (more in 77.4).

---

## 77.2 Automatic vs Manual Signing 🟢

- **Automatic signing:** Xcode creates and renews certificates and profiles for you. Good for most developers and small teams.
- **Manual signing:** you choose the **exact** certificate and profile. Good for **CI** (often with `fastlane match`, section 76.9), and when you need full control.

```plaintext
// Automatic signing: Xcode silently creates/renews certificates and profiles as needed
// Manual signing: an explicit, specific certificate + profile combination is selected,
// with no automatic modification — appropriate for CI's need for deterministic,
// explicitly-controlled signing rather than Xcode's own automatic management
```

Manual signing in an `.xcconfig` file (section 72.4):

```plaintext
// Release.xcconfig
CODE_SIGN_STYLE = Manual
DEVELOPMENT_TEAM = ABCDE12345
CODE_SIGN_IDENTITY = Apple Distribution
PROVISIONING_PROFILE_SPECIFIER = match AppStore com.example.myapp
```

If you do use automatic signing on CI, let `xcodebuild` talk to Apple with an App Store Connect API key (section 76.11):

```bash
xcodebuild archive -scheme MyApp -archivePath MyApp.xcarchive \
  -allowProvisioningUpdates \
  -authenticationKeyPath AuthKey.p8 \
  -authenticationKeyID YOUR_KEY_ID \
  -authenticationKeyIssuerID YOUR_ISSUER_ID
```

**Why CI usually uses manual signing:** CI needs the **same result on every run**. Automatic signing can try to create new certificates or profiles on a CI machine, which makes runs unpredictable.

---

## 77.3 Entitlements and Capability Drift 🟡

**Entitlements** list the system features your app may use: push notifications, App Groups (section 43.4), CloudKit, and more. They live in an **`.entitlements`** file.

**Capability drift** happens when your `.entitlements` file and your **App ID's capabilities** on the Apple Developer website **no longer match**. It is a common cause of confusing signing errors.

```xml
<!-- MyApp.entitlements -->
<key>com.apple.developer.icloud-container-identifiers</key>
<array>
    <string>iCloud.com.example.myapp</string>
</array>
```

How it happens:

1. You turn on CloudKit in Xcode. The `.entitlements` file now asks for it.
2. The App ID on the Developer website was **not** updated.
3. The profile (built from the old App ID) does not allow CloudKit, so **signing fails**.

Check what a built app really asks for:

```bash
codesign -d --entitlements :- MyApp.app        # print the app's entitlements
```

Compare it with what the profile allows (`security cms -D -i`, from 77.1). The difference is your drift.

---

## 77.4 Why Signing Breaks and How to Diagnose It 🟡

Signing errors come from **a few common causes**. Read the **exact** error message, find the category, and apply its fix.

```plaintext
// Common signing error categories to check systematically:
// - "No signing certificate found" → certificate expired, revoked, or not installed locally
// - "Provisioning profile doesn't include device" → the specific test device's UDID isn't registered
// - "Entitlement not supported" → capability drift (77.3) between local entitlements and App ID config
// - "Profile has expired" → a profile past its validity period needs regeneration
```

| Error | Cause | Fix |
|---|---|---|
| No signing certificate found | Certificate expired, revoked, or not on this Mac | Install or create a new certificate |
| Profile doesn't include device | The device is not registered | Register its UDID, then regenerate the profile |
| Entitlement not supported | Capability drift (77.3) | Turn on the capability for the App ID |
| Profile has expired | Too old | Regenerate and download it |

Tools that help:

```bash
security find-identity -v -p codesigning      # which certificates are valid on this Mac
codesign -dv --verbose=4 MyApp.app            # who signed the app, and with what
codesign --verify --deep --strict MyApp.app   # is the signature valid?
```

**The skill is to stop treating "signing failed" as one mystery.** Each category has its own cause and its own fix, so a careful read of the message usually leads straight to the solution.

---

## 77.5 Archiving and Exporting a Build 🟡

**Archiving** (`Product → Archive` in Xcode, or `xcodebuild archive` on CI) makes a **`.xcarchive`**: a signed build **plus its debug symbols**. You then **export** it for a specific way of distributing (App Store, ad hoc, enterprise, 77.6).

```bash
xcodebuild archive -scheme MyApp -archivePath MyApp.xcarchive
xcodebuild -exportArchive -archivePath MyApp.xcarchive -exportPath ./export \
  -exportOptionsPlist ExportOptions.plist
```

The `ExportOptions.plist` says how to export:

```xml
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store-connect</string>     <!-- older Xcode versions: app-store -->
    <key>teamID</key>
    <string>ABCDE12345</string>
    <key>uploadSymbols</key>
    <true/>
    <key>destination</key>
    <string>upload</string>               <!-- upload to App Store Connect directly -->
</dict>
</plist>
```

An archive contains both the **app to ship** and the **dSYMs** to read crash reports later (section 76.13). That is why a release pipeline should **keep the archive**, not just the app file.

---

## 77.6 Ad Hoc and Enterprise Distribution 🟡

Two ways to install an app **without the App Store or TestFlight**:

- **Ad hoc:** install on a **small list of registered devices**. The profile lists each device's UDID.
- **Enterprise:** install on **any of your company's own devices**, with no device list. It needs the Apple Developer Enterprise Program.

```plaintext
// Ad hoc: provisioning profile explicitly lists specific device UDIDs — a hard device count limit applies
// Enterprise: no per-device UDID registration needed, but strictly limited to internal organizational use,
//             explicitly prohibited by Apple's terms for distribution to the general public
```

| | Ad hoc | Enterprise |
|---|---|---|
| Who can install | Registered devices only (about 100 per device type each year) | Any device in your company |
| Good for | Small test groups | Internal company apps |
| Rule | Device limit | **Internal use only** |

Export an ad hoc build:

```xml
<key>method</key>
<string>release-testing</string>     <!-- older Xcode versions: ad-hoc -->
```

**Be careful with enterprise distribution.** Apple's terms say it must stay **inside your company**. Using it to give apps to the public can get your enterprise certificate **revoked**, which stops all your internal apps from working.

---

## 77.7 MDM and Custom App Distribution 🔴

**Mobile Device Management (MDM)** lets a company manage its **own devices** from one place: install apps, push settings, and set restrictions. It can deploy **custom internal apps** (through enterprise distribution, 77.6, or Apple Business Manager's custom apps).

```plaintext
// MDM-distributed custom apps typically combine:
// - Enterprise or Apple Business Manager custom app distribution (the actual app binary)
// - Managed App Configuration (pre-configured settings pushed to the app at install/launch,
//   letting organizations pre-configure things like a server endpoint without user input)
```

The app reads the **settings pushed by MDM** (Managed App Configuration) from `UserDefaults`:

```swift
let managed = UserDefaults.standard.dictionary(forKey: "com.apple.configuration.managed")
let serverURL = managed?["serverURL"] as? String ?? "https://default.example.com"
```

So the IT department can set, for example, the company's server address **without the user typing anything**.

This is a different model from everything else in this section. The user does not choose apps in the App Store. **The company's IT team** decides what is installed and how it is set up.

---

## 77.8 Notarization and Alternative Marketplaces (EU) 🔴

Because of EU rules (the **Digital Markets Act**), Apple must allow, **in the EU only**, apps from **alternative app marketplaces** and from **direct distribution**, outside the App Store. These apps still go through **notarization**: a basic security check by Apple, which is smaller than full App Review.

```plaintext
// EU-specific alternative distribution model (conceptual):
// - An app can be distributed via an alternative marketplace or directly, within the EU
// - Apple's notarization process still performs a baseline security check
//   (though distinct from, and less extensive than, full App Store review)
// - This distribution model does not apply outside the EU's specific regulatory scope
```

| | App Store | EU alternative distribution |
|---|---|---|
| Where | Everywhere | EU only |
| Apple's check | Full App Review | Notarization (a basic check) |
| Who distributes | Apple | A marketplace, or you |

This is a big change from iOS's traditional closed model, but it **only applies in the EU**. The rules are still changing, so if you target the EU, check Apple's current documentation.

---

## Summary

| Concept | Key Mechanism | Purpose |
|---|---|---|
| The three pieces | Certificate, App ID, profile | The binding behind every signature |
| Signing style | Automatic vs. manual | Convenience vs. predictable CI |
| Entitlements | `.entitlements` vs. App ID | Avoid capability drift |
| Diagnosis | Error categories and `codesign` | Turn a mystery into a known fix |
| Archives | `.xcarchive`, `ExportOptions.plist` | The app plus its debug symbols |
| Ad hoc | Registered devices | Small test groups |
| Enterprise | Company devices only | Internal apps, internal use only |
| MDM | Managed install and settings | Company-controlled devices |
| EU distribution | Alternative marketplaces, notarization | Non-App Store distribution in the EU |
