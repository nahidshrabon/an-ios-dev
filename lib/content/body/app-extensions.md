## 53.1 What Extensions Are and How They Run

An app extension is a separate executable bundled inside the main app but running as its own distinct, sandboxed process — invoked by the system on the host app or system's behalf (e.g., when a user taps "Share" in Photos), with a fundamentally more constrained lifecycle and resource budget than the main app itself.

```plaintext
Main App                         Extension
- Full memory budget              - Strict, low memory limit
- Long-lived process               - Short-lived, launched on demand
- Direct user launch                - Launched by the SYSTEM on behalf
                                       of the host app/context
```

This architecture — a genuinely separate process rather than code running inside the host app — exists specifically for security and stability: an extension runs sandboxed and can't access the host app's (e.g., Photos') internal data beyond what's explicitly handed to it, and if an extension crashes or misbehaves, it can't take down the host app hosting it, only itself. This is the same separate-process model already seen for widgets (section 52.1), generalized here to the broader family of extension types the rest of this section covers.

---

## 53.2 Share Extension

A share extension lets users send content from other apps directly into your app via the system share sheet — appearing as one of the options when a user taps the Share icon from Photos, Safari, or virtually any app presenting shareable content.

```swift
class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachment = item.attachments?.first else { return }

        attachment.loadItem(forTypeIdentifier: "public.url") { [weak self] url, error in
            guard let url = url as? URL else { return }
            self?.saveSharedURL(url)
            self?.extensionContext?.completeRequest(returningItems: nil)
        }
    }
}
```

`extensionContext?.inputItems` carries whatever content the user is sharing (a URL, an image, plain text, and more, each identified by a UTType-style type identifier, recall `UTType`, section 34.5) — the extension's job is to extract that content, do something meaningful with it (like saving a shared recipe URL for the main app to process later), and call `completeRequest()` to signal it's finished, at which point the system dismisses the share sheet and returns control to whatever app the user was originally sharing from.

---

## 53.3 Action Extension

An action extension operates on content already displayed within another app (like transforming selected text, or processing an image shown in another app) rather than receiving content via the general share sheet — appearing in a context-specific action menu rather than necessarily the Share icon specifically.

```swift
class RecipeExtractorActionViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachment = item.attachments?.first else { return }

        attachment.loadItem(forTypeIdentifier: "public.plain-text") { [weak self] text, _ in
            guard let text = text as? String else { return }
            let extractedRecipe = self?.parseRecipeFromText(text)
            // present extracted recipe for confirmation, then complete
        }
    }
}
```

The distinction from a share extension is subtle but real: a share extension is generally about *sending* content somewhere (into your app, for later processing), while an action extension is more often about *transforming* or *acting on* content in place, potentially returning a modified result back to the host app rather than simply consuming it — both use the same underlying `NSExtensionItem`/`extensionContext` mechanics from 53.2, differing primarily in their declared extension point identifier and the UX context in which the system presents them.

---

## 53.4 Custom Keyboard Extension

A custom keyboard extension replaces the system keyboard system-wide (once the user explicitly enables it in Settings, including granting "Full Access" if the keyboard needs network access), built from a `UIInputViewController` subclass responsible for both rendering the keyboard UI and inserting text into whatever text field currently has focus in the host app.

```swift
class RecipeKeyboardViewController: UIInputViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        let insertButton = UIButton(type: .system)
        insertButton.setTitle("Insert Recipe Link", for: .normal)
        insertButton.addTarget(self, action: #selector(insertRecipeLink), for: .touchUpInside)
        view.addSubview(insertButton)
    }

    @objc private func insertRecipeLink() {
        textDocumentProxy.insertText("https://example.com/recipes/42")
    }
}
```

`textDocumentProxy` is the keyboard extension's specific interface for interacting with whatever text field currently has focus in the *host* app (which could be any app on the device, not just your own) — inserting text, deleting characters, and reading limited context around the cursor, all without the keyboard extension ever having direct access to the host app's other data, consistent with the sandboxing principle from 53.1; "Full Access" is a separate, explicit user grant specifically required if the keyboard needs network access (like a predictive-text service), given the significant privacy sensitivity of a keyboard that could, in principle, observe everything a user types across every app.

---

## 53.5 Photo Editing Extension

A photo editing extension lets a user apply your app's specific editing capabilities (filters, adjustments) directly from within the Photos app's own edit interface, without needing to export the photo out to your app and back.

```swift
class RecipePhotoEditingViewController: UIViewController, PHContentEditingController {
    func canHandle(_ adjustmentData: PHAdjustmentData) -> Bool {
        adjustmentData.formatIdentifier == "com.example.myapp"
    }

    func startContentEditing(with contentEditingInput: PHContentEditingInput, placeholderImage: UIImage) {
        // present editing UI using contentEditingInput.displaySizeImage
    }

    func finishContentEditing(completionHandler: @escaping (PHContentEditingOutput?) -> Void) {
        // apply edits, write to a PHContentEditingOutput, then call completionHandler
    }
}
```

`PHContentEditingController` conformance is the specific protocol this extension type implements — `startContentEditing` receives the original photo to edit, and `finishContentEditing` must produce a `PHContentEditingOutput` (including both the rendered edited image and `PHAdjustmentData` describing the edit non-destructively, so Photos can preserve the ability to revert to the original) — this non-destructive editing model is central to how Photos preserves original assets even as extensions apply their own custom edits on top.

---

## 53.6 Safari Web Extensions

A Safari web extension brings the same JavaScript/HTML/CSS-based web extension model used by Chrome, Firefox, and other browsers to Safari, packaged and distributed alongside a native iOS/macOS app — letting a single extension codebase largely target multiple browsers with minimal Safari-specific adaptation.

```javascript
// A Safari web extension's background script — ordinary JavaScript,
// using the same browser.* / chrome.* extension APIs other browsers support
browser.action.onClicked.addListener((tab) => {
    browser.tabs.sendMessage(tab.id, { action: "highlightRecipes" });
});
```

Unlike the other extension types in this section (which are native Swift/UIKit code), Safari web extensions are built primarily in JavaScript against the cross-browser WebExtensions API standard, with only a thin native wrapper needed to package and distribute the extension through the App Store — this is a deliberate design choice enabling genuine cross-browser code reuse for developers already maintaining an extension for Chrome/Firefox, at the cost of being a genuinely different technology stack from the rest of this section's native extension types.

---

## 53.7 SFSafariViewController vs. In-App Browser

`SFSafariViewController` presents a Safari-based web view within your app, sharing Safari's cookies, saved passwords, and other browsing data — distinct from building a fully custom in-app browser using `WKWebView` directly, which gets none of that shared context by default.

```swift
import SafariServices

func presentWebContent(url: URL) {
    let safariVC = SFSafariViewController(url: url)
    present(safariVC, animated: true)
}
```

`SFSafariViewController` is generally the recommended default for simply showing web content (like an external article link) within an app — it provides a consistent, familiar, Safari-branded UI (complete with a recognizable reader mode, share sheet, and other standard Safari chrome) and, importantly, shares login state with the system's actual Safari browser, meaning a user already logged into a website in Safari sees that same logged-in state reflected immediately. A custom `WKWebView`-based browser is instead appropriate specifically when an app needs deeper control over the browsing experience (custom chrome, JavaScript injection, tighter integration with in-app navigation) that `SFSafariViewController`'s more constrained, standardized presentation doesn't allow.

---

## 53.8 App Clips: Concept and Size Budget

An App Clip is a small, focused subset of a full app's functionality — launchable instantly, without a full App Store install, from a QR code, NFC tag, Safari App Banner, or Maps/App Store listing — specifically designed for a single, quick task (viewing a menu, ordering a specific item, unlocking a scooter) rather than the full app experience.

```plaintext
Full App: potentially hundreds of MB, full feature set, standard install flow
App Clip: strict binary size limit, single focused task, launches
          almost instantly with no full install step required
```

The strict size budget (a hard limit meaningfully smaller than what a full app is permitted) is what makes an App Clip's near-instant launch possible — a user scanning a QR code at a restaurant expects the ordering experience to appear within seconds, which simply wouldn't be achievable if the App Clip needed to download and install anywhere close to the size of a typical full-featured app; this constraint fundamentally shapes App Clip design toward a genuinely minimal, single-purpose slice of functionality rather than an attempt to cram the full app experience into a smaller package.

---

## 53.9 App Clip Invocations and Experiences

An App Clip is launched via a specific "invocation" (a QR code, NFC tag, a specially-configured Safari App Banner, a Place Card in Maps, or an App Store Connect-configured "Advanced App Clip Experience" URL), and the app's code can read exactly which invocation URL triggered the launch to route directly to the relevant specific content — echoing universal link handling (section 49.6–49.7) but specific to the App Clip launch context.

```swift
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    guard let url = activity.webpageURL else { return }
                    // route directly to content matching this specific invocation URL
                }
        }
    }
}
```

This routing pattern is deliberately similar to the universal link handling already covered in section 49.7 — an App Clip invocation URL, much like a universal link, carries the specific context needed to jump directly to relevant content (the specific restaurant's menu, the specific scooter to unlock) without requiring the user to navigate through any kind of general app structure first, since the entire premise of an App Clip is arriving directly at the one specific task the user came for.

---

## 53.10 Network Extension Overview 🔴

Network Extension is a specialized, advanced extension framework for building VPN clients, content filtering, and DNS proxy functionality — operating at a genuinely lower network-stack level than any other extension type in this section, intercepting and processing network traffic system-wide rather than integrating with a specific app UI context.

```swift
import NetworkExtension

class MyPacketTunnelProvider: NEPacketTunnelProvider {
    override func startTunnel(options: [String: NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        // configure and establish a VPN tunnel, processing packets
        // as they flow through the system's networking stack
    }
}
```

Because Network Extension operates at the level of the device's entire network stack (rather than integrating with a specific user-facing context like sharing or keyboard input), it's a meaningfully more specialized, lower-level, and higher-responsibility category of extension than the others covered in this section — appropriate specifically for genuine VPN/network-security products, and requiring careful attention to performance (since it sits in the path of all network traffic) and security (given its privileged position observing and potentially modifying all network communication).

---

## 53.11 Extension Memory Limits and Crashes 🟠

Every extension type operates under a strict, extension-type-specific memory limit meaningfully lower than the main app's own budget — exceeding it causes the system to terminate the extension process immediately, often with limited diagnostic information, making memory discipline a genuinely first-class concern for extension development.

```swift
// Defensive practice specific to extensions:
// - Avoid loading full-resolution images when a smaller size will do
//   (recall .externalStorage / lazy-loading discipline from persistence material)
// - Release large temporary buffers explicitly and promptly rather than
//   relying on eventual ARC deallocation timing
// - Test with Instruments' Allocations tool specifically targeting the
//   extension process, not just the main app
```

A share extension processing a large photo, for instance, might naively load the full-resolution original image into memory when a much smaller thumbnail would suffice for its actual purpose (like generating a preview) — given how much lower an extension's memory ceiling typically is compared to the main app, practices that might be merely wasteful in the main app (loading more data than strictly necessary) can be outright fatal (an immediate, hard crash) within an extension, making deliberate memory economy a genuinely different, stricter discipline than typical main-app development requires.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Extension architecture | Separate sandboxed process | Security, stability, isolation from the host app |
| Sending content in | Share extension, `NSExtensionItem` | Receive shared content from other apps |
| Acting on content | Action extension | Transform/process content in place |
| System-wide text input | `UIInputViewController`, `textDocumentProxy` | Custom keyboards, with gated "Full Access" |
| In-Photos editing | `PHContentEditingController` | Non-destructive photo edits from within Photos |
| Cross-browser extensions | Safari web extension (JavaScript) | WebExtensions-standard code, thin native wrapper |
| In-app web content | `SFSafariViewController` vs. `WKWebView` | Shared Safari context vs. fully custom browsing |
| Instant, focused experiences | App Clips, strict size budget | Single-task functionality with near-instant launch |
| Direct-to-content routing | App Clip invocations | Universal-link-like routing to specific launch context |
| Network-level extensions | `NEPacketTunnelProvider` | VPN/filtering, operating on the entire network stack |
| Resource discipline | Extension memory limits | Stricter memory economy than main-app development |
