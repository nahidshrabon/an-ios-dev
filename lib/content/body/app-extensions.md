**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**App extensions** let your app's features appear **inside other apps** and the system: in the share sheet, as a keyboard, inside Photos, in Safari, or as a VPN. Each extension is a **small, separate program** with **tight limits**. This section covers how extensions run, the common types, in-app web views, App Clips, Network Extension, and the memory limits that make extension work different.

---

## 53.1 What Extensions Are and How They Run 🟢

An **extension** is a separate **target** in your project. It's shipped **inside** your app's bundle, but it runs as its **own process**, started by the **system** when another app needs it.

Three words to know:

| Term | Meaning | Example |
|---|---|---|
| **Containing app** | Your app, which ships the extension | RecipeApp |
| **Host app** | The app the user is **in** when the extension runs | Safari, Photos |
| **Extension** | Your small program, running in its own process | "Save to RecipeApp" in the share sheet |

```
User in Safari taps Share ▸ "Save to RecipeApp"
        │
        ▼
System starts your share extension (own process, own sandbox)
        │   gets ONLY the shared item (a URL)
        ▼
Extension saves it to the App Group ──► RecipeApp reads it later
```

| | Main app | Extension |
|---|---|---|
| Started by | The **user** | The **system**, for a host app |
| Lifetime | Long | **Short**: it does one job, then ends |
| Memory | Large budget | **Much smaller** limit (53.11) |
| Sees host app's data? | — | **No**: only what's handed to it |

Why a separate process?

- **Security**: the extension can't read Safari's history or Photos' library. It only gets the **one item** the user shared.
- **Stability**: if your extension **crashes**, the host app keeps running.

The extension and your app **don't share memory** either. They share data through an **App Group** (43.2), just like widgets (52.1, 52.9). Most extensions also **can't open** your main app directly; they save data and **finish**.

---

## 53.2 Share Extension 🟢

A **share extension** adds your app to the **share sheet**. Users can send a link, text, or image from **any** app into yours.

Xcode: File ▸ New ▸ Target ▸ **Share Extension**. First, say **what** it accepts in its **Info.plist**, so it only shows up when it's useful:

```xml
<key>NSExtensionAttributes</key>
<dict>
    <key>NSExtensionActivationRule</key>
    <dict>
        <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
        <integer>1</integer>      <!-- show for one web link -->
        <key>NSExtensionActivationSupportsImageWithMaxCount</key>
        <integer>1</integer>      <!-- or one image -->
    </dict>
</dict>
```

Then read the shared item from **`extensionContext`**:

```swift
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        Task { await handleSharedItem() }
    }

    private func handleSharedItem() async {
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let provider = item.attachments?.first(where: {
                  $0.hasItemConformingToTypeIdentifier(UTType.url.identifier)
              }) else {
            extensionContext?.cancelRequest(withError: ShareError.unsupportedContent)
            return
        }

        do {
            let loaded = try await provider.loadItem(forTypeIdentifier: UTType.url.identifier)
            guard let url = loaded as? URL else { throw ShareError.unsupportedContent }

            SharedInbox.add(url)                                  // App Group storage (43.2)
            extensionContext?.completeRequest(returningItems: nil) // done: close the sheet
        } catch {
            extensionContext?.cancelRequest(withError: error)
        }
    }
}

enum ShareError: Error { case unsupportedContent }
```

| Piece | Meaning |
|---|---|
| `inputItems` | What the user shared, as `NSExtensionItem`s |
| `attachments` | `NSItemProvider`s, one per item, each with **type identifiers** (`UTType`, 34.5) |
| `completeRequest(returningItems:)` | "**I'm done**": the system closes your UI |
| `cancelRequest(withError:)` | "**I can't do this**": also closes it |

⚠️ **Always** call one of the two. If you forget, your UI stays on screen and the user is **stuck**.

You can show **SwiftUI** for the UI (a preview, a "Save" button) by adding a **`UIHostingController`** (38.5) as a child of this view controller.

The main app then **picks up** the saved items the next time it becomes active (49.2).

---

## 53.3 Action Extension 🟡

An **action extension** also gets content from the host app, but its job is different: it **acts on** the content, and can **send a result back**.

| | Share extension | Action extension |
|---|---|---|
| Job | **Send** content **into** your app | **Transform** or **view** content **in place** |
| Result | Usually nothing returned | Can **return** changed content to the host app |
| Shows up | Share sheet, app row (top) | Share sheet, action list (bottom) |
| Example | "Save to RecipeApp" | "Clean Up Recipe Text", "View as Recipe Card" |

Both use the **same** `extensionContext` and `NSExtensionItem` tools (53.2). The difference is the **extension point** you choose in Xcode, and what you return:

```swift
import UIKit
import UniformTypeIdentifiers

final class CleanUpTextActionViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        Task { await cleanUp() }
    }

    private func cleanUp() async {
        guard let provider = (extensionContext?.inputItems.first as? NSExtensionItem)?
                .attachments?.first,
              let text = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String
        else {
            extensionContext?.completeRequest(returningItems: nil)
            return
        }

        let cleaned = RecipeTextCleaner.clean(text)        // shared code from your app

        // Return the result to the host app
        let output = NSExtensionItem()
        output.attachments = [NSItemProvider(item: cleaned as NSString,
                                             typeIdentifier: UTType.plainText.identifier)]
        extensionContext?.completeRequest(returningItems: [output])
    }
}
```

The host app gets the returned items **only if** it asks for them (for example, through `UIActivityViewController`'s `completionWithItemsHandler`). Many apps don't, so an action extension often **shows** its result in its own UI instead.

---

## 53.4 Custom Keyboard Extension 🟡

A **custom keyboard** replaces the system keyboard in **every** app, after the user turns it on in **Settings ▸ General ▸ Keyboard ▸ Keyboards**. It's a **`UIInputViewController`** subclass:

```swift
import UIKit

final class RecipeKeyboardViewController: UIInputViewController {
    private let nextKeyboardButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()

        let insertButton = UIButton(type: .system, primaryAction: UIAction(title: "Insert Recipe Link") { [weak self] _ in
            self?.textDocumentProxy.insertText("https://example.com/recipes/42")
        })

        // Required: a way to switch to the next keyboard (the 🌐 key)
        nextKeyboardButton.setTitle("🌐", for: .normal)
        nextKeyboardButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)

        let stack = UIStackView(arrangedSubviews: [nextKeyboardButton, insertButton])
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }

    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        nextKeyboardButton.isHidden = !needsInputModeSwitchKey    // some devices show their own
    }
}
```

**`textDocumentProxy`** is the keyboard's **only** link to the text field in the host app:

| Call | Does |
|---|---|
| `insertText(_:)` | Types text at the cursor |
| `deleteBackward()` | Deletes one character |
| `documentContextBeforeInput` | Reads a **little** text before the cursor |
| `adjustTextPosition(byCharacterOffset:)` | Moves the cursor |

The keyboard **can't** see the rest of the host app.

**Full Access** is a separate, scary-sounding switch the user must turn on (you ask for it with `RequestsOpenAccess` in Info.plist). Without it, the keyboard has **no network** access and can't share data with your app through the App Group. Check it with **`hasFullAccess`**, and work well **without** it: a keyboard sees everything the user types, so many users will never grant it.

Some fields **always** use the system keyboard: **secure** (password) fields and phone-number pads. Apps can also refuse custom keyboards.

---

## 53.5 Photo Editing Extension 🟡

A **photo editing extension** puts your filters **inside the Photos app's** Edit screen. No exporting and re-importing.

The view controller conforms to **`PHContentEditingController`**:

```swift
import UIKit
import Photos
import PhotosUI

final class RecipePhotoEditingViewController: UIViewController, PHContentEditingController {
    private var input: PHContentEditingInput?
    private var settings = FilterSettings()                     // your own Codable filter settings

    // 1. Can we continue an earlier edit made by us?
    func canHandle(_ adjustmentData: PHAdjustmentData) -> Bool {
        adjustmentData.formatIdentifier == "com.example.recipes.filter"
            && adjustmentData.formatVersion == "1.0"
    }

    // 2. Start: show a preview using the small display image
    func startContentEditing(with contentEditingInput: PHContentEditingInput, placeholderImage: UIImage) {
        input = contentEditingInput
        if let data = contentEditingInput.adjustmentData?.data,
           let saved = try? JSONDecoder().decode(FilterSettings.self, from: data) {
            settings = saved                                    // continue the earlier edit
        }
        showPreview(contentEditingInput.displaySizeImage)
    }

    // 3. Finish: save the full-size result AND the recipe of the edit
    func finishContentEditing(completionHandler: @escaping (PHContentEditingOutput?) -> Void) {
        guard let input, let fullSizeURL = input.fullSizeImageURL else { completionHandler(nil); return }

        let output = PHContentEditingOutput(contentEditingInput: input)
        output.adjustmentData = PHAdjustmentData(
            formatIdentifier: "com.example.recipes.filter",
            formatVersion: "1.0",
            data: (try? JSONEncoder().encode(settings)) ?? Data()
        )
        do {
            try FilterRenderer.renderJPEG(from: fullSizeURL, settings: settings,
                                          to: output.renderedContentURL)   // Core Image, not UIImage
            completionHandler(output)
        } catch {
            completionHandler(nil)
        }
    }

    var shouldShowCancelConfirmation: Bool { true }             // "Discard changes?"
    func cancelContentEditing() { }
}
```

The output has **two** parts:

| Part | Why |
|---|---|
| **Rendered image** at `renderedContentURL` | What Photos **shows** everywhere |
| **`PHAdjustmentData`** | A small description of **how** you edited (your settings) |

This makes edits **non-destructive**: Photos keeps the **original**, so the user can **Revert** at any time. And if `canHandle` returns `true`, Photos gives you the **original** plus your saved settings, so the user can **change** the edit later instead of stacking a new one on top.

Full-size photos are **big**. Render with **Core Image** (which works in tiles) rather than loading a full `UIImage`, or you'll hit the memory limit (53.11).

---

## 53.6 Safari Web Extensions 🟡

A **Safari web extension** is built with **web technology**: JavaScript, HTML, CSS, and a `manifest.json`. It's the **same** WebExtensions standard Chrome and Firefox use. Xcode wraps it in a **native app** so it ships through the **App Store**.

Already have a Chrome extension? Apple's converter creates the Xcode project for you:

```bash
xcrun safari-web-extension-converter /path/to/my-chrome-extension
```

The extension itself is ordinary web-extension code:

```json
{
  "manifest_version": 3,
  "name": "Recipe Highlighter",
  "version": "1.0",
  "action": { "default_title": "Highlight recipes" },
  "background": { "service_worker": "background.js" },
  "content_scripts": [{ "matches": ["<all_urls>"], "js": ["content.js"] }],
  "permissions": ["nativeMessaging"]
}
```

```javascript
// background.js: plain JavaScript, using the browser.* APIs
browser.action.onClicked.addListener(async (tab) => {
    // Ask the page's content script to highlight recipes
    browser.tabs.sendMessage(tab.id, { action: "highlightRecipes" });

    // Talk to the native app side (Safari ignores the ID argument)
    const reply = await browser.runtime.sendNativeMessage("application.id", { saveURL: tab.url });
    console.log("Saved:", reply.saved);
});
```

The **native** side receives those messages in Swift:

```swift
import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem
        let message = item?.userInfo?[SFExtensionMessageKey] as? [String: Any]

        if let urlString = message?["saveURL"] as? String, let url = URL(string: urlString) {
            SharedInbox.add(url)                                  // App Group, like 53.2
        }

        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: ["saved": true]]
        context.completeRequest(returningItems: [response])
    }
}
```

| Other extension types | Safari web extensions |
|---|---|
| Swift / UIKit | Mostly **JavaScript** |
| Apple-only APIs | A **cross-browser** standard |
| Run when the system calls them | Run **inside web pages**, plus a small native part |

On iOS, users turn it on in **Settings ▸ Apps ▸ Safari ▸ Extensions**, and choose which **websites** it may access. (For simple ad or tracker blocking, Safari also has lighter **content blockers**: a JSON rule list, no JavaScript.)

---

## 53.7 SFSafariViewController vs. In-App Browser 🟢

This isn't an extension, but it's the same question: **how much of Safari** should your app use? There are four common ways to show web content:

| Option | Use it for |
|---|---|
| **Open in Safari** (`openURL`) | The user leaves your app. Simplest |
| **`SFSafariViewController`** | Show a web page **in** your app, with Safari's UI |
| **`ASWebAuthenticationSession`** | **Logging in** with a website (OAuth) |
| **`WKWebView`** (or SwiftUI's `WebView`, iOS 26) | **Your own** UI, full control, JavaScript bridge |

**`SFSafariViewController`** is the best default for "show this article":

```swift
import SafariServices

func showArticle(_ url: URL) {
    let config = SFSafariViewController.Configuration()
    config.entersReaderIfAvailable = true                  // open in Reader when possible

    let safari = SFSafariViewController(url: url, configuration: config)
    safari.preferredControlTintColor = .systemOrange
    present(safari, animated: true)
}
```

What it gives you **for free**: Safari's familiar UI, **Reader**, **AutoFill** of saved passwords, content blockers, and the share button. And **privacy**: your app **can't** see what the user does in it.

⚠️ A common myth: since **iOS 11**, `SFSafariViewController` **doesn't** share cookies with Safari. Each app has its **own** separate website data. So for "**log in with a website**", use **`ASWebAuthenticationSession`**: it's built for that, and can share the login with Safari.

Use **`WKWebView`** when you need **control** that Safari's UI doesn't allow:

- your own toolbar and navigation,
- running your **JavaScript** in the page (`WKUserScript`), or receiving messages from it,
- showing **your own** HTML content (help pages, rich text).

You give up Safari's UI and features, and you take on more work (navigation, errors, security). Don't use `WKWebView` for **third-party logins**: users can't trust what they type into it.

In SwiftUI, there's no built-in `SFSafariViewController` view: wrap it with `UIViewControllerRepresentable` (38.2), or just use `openURL` to open Safari.

---

## 53.8 App Clips: Concept and Size Budget 🟡

An **App Clip** is a **tiny part** of your app that people can use **without installing** the app. It opens in seconds from a **QR code**, an **NFC tag**, an **App Clip Code**, a link in **Safari** or **Messages**, or a place card in **Maps**.

```
Scan code at a restaurant
     │  (no App Store visit, no install screen)
     ▼
App Clip card appears ─► tap "Open" ─► order food in seconds
     │
     ▼
Later: "Get the full app" (optional)
```

It's for **one quick task**: order from **this** café, rent **this** scooter, pay for **this** parking spot. Not the full app.

To make it **fast**, the App Clip has a **strict size limit**:

| | Size limit (uncompressed) |
|---|---|
| Full app | Very large |
| App Clip, iOS 16 | **15 MB** |
| App Clip, iOS 17+, digital launch only (Safari, Messages, …) | Up to **100 MB** |

⚠️ Check Apple's current limits: they've grown over time. If the clip supports **physical** codes (QR, NFC), plan for the **smaller** limit: the user is standing at a counter, waiting.

Building one:

- Add an **App Clip target** to your project. It **shares code** with the main app (the same Swift files, added to both targets).
- Add a compiler flag like **`APPCLIP`** to the clip target, to leave out code it doesn't need:

```swift
#if APPCLIP
    OrderView(location: location)          // just the one task
#else
    MainTabView()                          // the full app
#endif
```

What App Clips can do differently:

- **Ephemeral notifications**: notifications for up to **8 hours**, without asking (`NSAppClipRequestEphemeralUserNotification`), e.g. "Your order is ready".
- **Sign in with Apple** and **Apple Pay**, so there's no account form.
- Suggest the full app with **`SKOverlay`** (`.appStoreOverlay` in SwiftUI).
- Share data with the full app through an **App Group** (43.2): when the user installs the full app, it can pick up the clip's data.

The system **removes** the clip and its data after a period of no use. Keep important data on your **server**.

---

## 53.9 App Clip Invocations and Experiences 🟡

Every App Clip launch comes with a **URL**, the **invocation URL**: `https://example.com/order?store=42`. Your code reads it and goes **straight** to the right content. It works just like a **universal link** (49.6–49.7):

```swift
import SwiftUI

@main
struct RecipeClipApp: App {
    @State private var router = Router()                 // the same router as the full app (49.7)

    var body: some Scene {
        WindowGroup {
            ClipRootView()
                .environment(router)
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    guard let url = activity.webpageURL else { return }
                    router.handle(url)                   // e.g. open store 42's menu
                }
        }
    }
}
```

Setup:

| Step | Where |
|---|---|
| Associated Domains: `appclips:example.com` | Clip target's entitlements |
| The clip's ID in your **apple-app-site-association** file | Your web server (49.6) |
| **App Clip experiences**: which URLs show which card (title, image, action) | App Store Connect |

A **default** experience covers simple cases. **Advanced** experiences let you set a **different card** per URL prefix, for example one per store, and link them to a **place in Maps**.

Two important details:

1. **After the user installs the full app**, the **same** URLs open the **full app** instead. So the full app must handle **every** invocation URL, too. Sharing one router (49.7) makes this easy.
2. For things like payments at a **physical** spot, you can check that the user is **really there**:

```swift
import AppClip
import CoreLocation

func verifyLocation(_ activity: NSUserActivity, expected: CLCircularRegion) {
    activity.appClipActivationPayload?.confirmAcquired(in: expected) { inRegion, error in
        // inRegion == false: the code may have been copied or moved
    }
}
```

(This needs `NSAppClipRequestLocationConfirmation` in the clip's Info.plist.)

---

## 53.10 Network Extension Overview 🔴

**Network Extension** is the framework for apps that work with the device's **network traffic**: VPNs, content filters, and DNS settings. It's very different from the other extensions here: there's **no UI context**. It sits **in the path of the network**.

| Provider | Builds |
|---|---|
| `NEPacketTunnelProvider` | A **VPN** client (your own protocol) |
| `NEFilterDataProvider` | A **content filter** (e.g. parental controls; limited to certain device setups) |
| `NEDNSProxyProvider` / `NEDNSSettingsManager` | Custom **DNS** handling / encrypted DNS settings |
| `NEHotspotConfiguration` | Joining a **Wi-Fi** network from your app (no extension needed) |

A VPN extension, in short:

```swift
import NetworkExtension

final class RecipeTunnelProvider: NEPacketTunnelProvider {
    override func startTunnel(options: [String: NSObject]?) async throws {
        // 1. Connect to your VPN server (your protocol, your code) ...

        // 2. Tell the system how to route traffic through the tunnel
        let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: "203.0.113.1")
        settings.ipv4Settings = NEIPv4Settings(addresses: ["10.0.0.2"], subnetMasks: ["255.255.255.0"])
        settings.ipv4Settings?.includedRoutes = [NEIPv4Route.default()]   // all traffic
        settings.dnsSettings = NEDNSSettings(servers: ["10.0.0.1"])
        try await setTunnelNetworkSettings(settings)

        // 3. Start moving packets
        readPackets()
    }

    private func readPackets() {
        packetFlow.readPackets { [weak self] packets, protocols in
            // encrypt and send each packet to the server ...
            self?.readPackets()                       // keep reading
        }
    }

    override func stopTunnel(with reason: NEProviderStopReason) async {
        // close the connection to the server
    }
}
```

The **main app** installs the VPN configuration with **`NETunnelProviderManager`**, and the system asks the user to **allow** it.

Why it's 🔴:

- **Performance**: **all** traffic flows through your code. Slow code makes the **whole device** feel slow. The extension also has a **tight memory limit** (53.11).
- **Security and trust**: your code can see **all** network traffic. Users and App Review expect great care with privacy.
- It needs the **Network Extensions** capability, and some providers only work on **supervised** (managed) devices.

Use it only if your product **is** a VPN, filter, or network tool.

---

## 53.11 Extension Memory Limits and Crashes 🟡

Every extension type has a **memory limit**, much **lower** than the main app's. Go over it, and the system **kills** the extension at once (a "**jetsam**" event). No error, no warning to the user: the share sheet just **disappears**.

Apple doesn't publish exact numbers, and they change. But the idea is simple: keyboards, widgets, and network extensions get **far less** than a main app. Design as if memory is **very** tight.

The classic crash: a share extension loads a **full-size photo**:

```
48-megapixel photo, decoded = 8064 × 6048 × 4 bytes ≈ 195 MB  ❌ killed
Thumbnail you actually need  = 600 × 450 × 4 bytes   ≈ 1 MB   ✅
```

The file on disk may be only 5 MB, but **decoded** pixels take **width × height × 4** bytes (69.12). So **never** decode the full image. **Downsample** straight from the file with ImageIO:

```swift
import ImageIO

func downsampledImage(at url: URL, maxPixelSize: CGFloat) -> CGImage? {
    let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary   // don't decode yet
    guard let source = CGImageSourceCreateWithURL(url as CFURL, sourceOptions) else { return nil }

    let options = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceShouldCacheImmediately: true,
        kCGImageSourceCreateThumbnailWithTransform: true,    // respect the photo's rotation
        kCGImageSourceThumbnailMaxPixelSize: maxPixelSize
    ] as CFDictionary
    return CGImageSourceCreateThumbnailAtIndex(source, 0, options)   // decodes only the small size
}
```

And ask the item provider for a **file**, not for **`Data`** in memory:

```swift
provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, error in
    guard let url else { return }
    // The file is deleted when this closure returns: use or copy it now
    let thumbnail = downsampledImage(at: url, maxPixelSize: 600)
    // ...
}
```

More rules for extensions:

| Do | Why |
|---|---|
| Work with **file URLs** and **streams** | Don't hold whole files in memory |
| Wrap loops over many images in **`autoreleasepool { }`** | Frees temporary objects **each** pass, not at the end |
| Keep **caches** small, or skip them | The extension is short-lived anyway |
| Move heavy work to the **main app** | Save the input to the App Group; process it later |

To **test**: run the **extension's scheme** in Xcode and watch the **memory gauge**, or profile it with **Instruments ▸ Allocations** (69.3), attached to the **extension** process, not the app. Jetsam crashes also show up as **JetsamEvent** reports on the device (69.14).

Something that's merely **wasteful** in an app is a **crash** in an extension.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Extension model | Separate process, App Group | Secure, stable, short-lived helpers |
| Sending content in | Share extension, `NSExtensionItem`, `completeRequest` | Save items from any app into yours |
| Acting on content | Action extension, returned items | Transform or view content in place |
| Custom keyboard | `UIInputViewController`, `textDocumentProxy` | System-wide typing; Full Access is optional |
| Editing in Photos | `PHContentEditingController`, `PHAdjustmentData` | Non-destructive, revertible edits |
| Safari web extensions | `manifest.json`, `browser.*`, native handler | Cross-browser JavaScript, App Store delivery |
| Web content in apps | `SFSafariViewController`, `ASWebAuthenticationSession`, `WKWebView` | Safari UI vs. login vs. full control |
| App Clips | Clip target, `APPCLIP` flag, size limit | One quick task, no install |
| Clip invocations | `webpageURL`, App Clip experiences | Jump straight to the right content |
| Network Extension | `NEPacketTunnelProvider` and others | VPNs, filters, DNS: high-responsibility |
| Memory limits | Downsampling, file URLs, Instruments | Wasteful in an app means fatal in an extension |
