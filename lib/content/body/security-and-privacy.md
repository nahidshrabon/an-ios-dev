**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 79.1 Threat Modeling a Mobile App 🟢

**Threat modeling** means thinking about **what could go wrong before you add security**: what you protect, who might attack it, and how. Then you spend effort where the real risk is.

```plaintext
// A simple threat modeling framework: for each asset, ask:
// - What is it? (user credentials, health data, payment tokens)
// - Who might want it? (a malicious app on the same device, a network attacker, a thief with physical access)
// - How might they get it? (insecure storage, unencrypted network transit, jailbroken device tampering)
// - What's the actual, appropriate mitigation given the realistic threat and asset sensitivity?
```

A small example for a recipe app with accounts:

| Asset | Who wants it | How | Protection |
|---|---|---|---|
| Login token | A thief with the phone | Reads app storage | Keychain (79.2) |
| Password | Someone on public Wi-Fi | Reads network traffic | HTTPS (always on) |
| Saved recipes | Almost nobody | — | Normal storage is fine |

**Match the effort to the risk.** A banking app needs much more (certificate pinning in 79.9, Secure Enclave keys in 79.6) than a recipe app. Threat modeling keeps you from both **over-protecting** and **under-protecting**.

---

## 79.2 Where Secrets Should and Shouldn't Live 🟢

**Never put a real secret in your app's code.** Anyone can take your compiled app apart and find it. Secrets that must stay secret belong **on your server**.

```swift
// Insecure: a hardcoded API key extractable from the compiled binary via reverse engineering
let apiKey = "sk_live_abc123..."  // NEVER do this for a genuinely sensitive secret

// Better: the app authenticates to your own backend, which holds the actual sensitive credential
// and makes the authenticated third-party API call on the app's behalf
```

| Secret | Where it belongs |
|---|---|
| A third-party API key with real power | Your server only |
| The user's login token | The **Keychain** on the device |
| Settings and non-secret data | `UserDefaults` or files |

Store a user's token in the **Keychain**, not in `UserDefaults`:

```swift
import Security

func saveToken(_ token: String) -> Bool {
    let base: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: "authToken",
    ]
    SecItemDelete(base as CFDictionary)            // remove an old value, if any

    var item = base
    item[kSecValueData as String] = Data(token.utf8)
    item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
}
```

**Hiding a key does not work.** Encoding it or splitting it into pieces only slows an attacker down, because the app must rebuild the real key at runtime. (Keeping secrets away from AI tools is a related topic, section 61.12.)

---

## 79.3 CryptoKit: Hashing and HMAC 🟡

**CryptoKit** is Apple's modern, safe crypto library.

- A **hash** (like SHA-256) turns data into a short fingerprint. The same data always gives the same hash, and any change gives a different one.
- An **HMAC** is a hash **with a secret key**. It proves the data was not changed **and** came from someone with the key.

```swift
import CryptoKit

let data = "hello world".data(using: .utf8)!
let digest = SHA256.hash(data: data)
print(digest.compactMap { String(format: "%02x", $0) }.joined())

let key = SymmetricKey(size: .bits256)
let authenticationCode = HMAC<SHA256>.authenticationCode(for: data, using: key)
```

Check an HMAC later:

```swift
let isValid = HMAC<SHA256>.isValidAuthenticationCode(
    authenticationCode, authenticating: data, using: key
)
// true only if the data is unchanged and the same key was used
```

Hash a downloaded file to check it was not damaged:

```swift
let fileData = try Data(contentsOf: downloadedURL)
let fileHash = SHA256.hash(data: fileData)
```

CryptoKit is designed so that **the safe way is the easy way**. Older C crypto APIs were easy to use wrongly, with results that looked fine but were not secure.

---

## 79.4 CryptoKit: Symmetric Encryption 🟡

**Symmetric encryption** uses **the same key** to encrypt and decrypt. CryptoKit's **`AES.GCM`** also **detects tampering**. Use it for data your app stores and later reads back (like Core Data encryption, section 42).

```swift
import CryptoKit

let key = SymmetricKey(size: .bits256)
let plaintext = "sensitive data".data(using: .utf8)!
let sealedBox = try AES.GCM.seal(plaintext, using: key)
let combined = sealedBox.combined!  // ciphertext + authentication tag + nonce, ready to store

// Later, decryption also verifies the data wasn't tampered with:
let decryptedBox = try AES.GCM.SealedBox(combined: combined)
let decrypted = try AES.GCM.open(decryptedBox, using: key)
```

The key must survive app restarts. Turn it into bytes and keep it in the **Keychain** (79.2):

```swift
let keyData = key.withUnsafeBytes { Data($0) }    // save these bytes in the Keychain
let restoredKey = SymmetricKey(data: keyData)      // later, rebuild the key
```

**"Authenticated" encryption matters.** If someone changes the encrypted bytes, even without the key, `AES.GCM.open` **throws an error**. Without that check, the app could quietly read corrupted data.

---

## 79.5 CryptoKit: Public Key Cryptography and Signatures 🟡

**Public key cryptography** uses a **key pair**:

- a **private key** that stays secret
- a **public key** that you can share with anyone

With a **signature**, the private key signs data, and **anyone with the public key can check it**, without ever having the private key.

```swift
import CryptoKit

let privateKey = Curve25519.Signing.PrivateKey()
let publicKey = privateKey.publicKey

let message = "important data".data(using: .utf8)!
let signature = try privateKey.signature(for: message)

// Anyone with the public key can verify the signature without ever having the private key:
let isValid = publicKey.isValidSignature(signature, for: message)
```

**Key agreement** lets two sides create the **same secret key** without ever sending it:

```swift
let alice = Curve25519.KeyAgreement.PrivateKey()
let bob = Curve25519.KeyAgreement.PrivateKey()

// Each side uses its own private key and the other's public key
let shared = try alice.sharedSecretFromKeyAgreement(with: bob.publicKey)
let symmetricKey = shared.hkdfDerivedSymmetricKey(
    using: SHA256.self, salt: Data(), sharedInfo: Data(), outputByteCount: 32
)
// Bob gets the same key from bob.sharedSecretFromKeyAgreement(with: alice.publicKey)
```

| | Symmetric (79.4) | Public key |
|---|---|---|
| Keys | One shared secret | A private and a public key |
| Who can check | Only people with the secret | Anyone with the public key |

This is the base of features like App Attest (section 57.16), which proves authenticity **without a shared secret** inside the app.

---

## 79.6 Secure Enclave-Backed Keys 🔴

The **Secure Enclave** is a separate, isolated **security chip** in Apple devices. A key created there **never leaves the chip**. Your app only gets a reference to it, and asks the chip to sign. Not even a jailbroken device with full access can read the raw key.

```swift
import CryptoKit

let privateKey = try SecureEnclave.P256.Signing.PrivateKey()
// The actual private key material is generated and remains entirely within
// the Secure Enclave hardware — the app only ever interacts with a reference to it,
// and can request signing operations without ever accessing the raw key bytes
```

Check that the device has one, and keep the key across launches:

```swift
guard SecureEnclave.isAvailable else { return }    // not on the simulator, for example

let key = try SecureEnclave.P256.Signing.PrivateKey()
let reference = key.dataRepresentation             // an encrypted reference, not the key itself
// Save `reference` in the Keychain. Later:
let sameKey = try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: reference)
```

You can even require **Face ID or Touch ID** for every use of the key:

```swift
let access = SecAccessControlCreateWithFlags(
    nil,
    kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    [.privateKeyUsage, .biometryCurrentSet],
    nil
)!
let protectedKey = try SecureEnclave.P256.Signing.PrivateKey(accessControl: access)
```

**Why it is the strongest option:** a normal Keychain key still exists as bytes that very privileged code could read. A Secure Enclave key is **physically isolated**. Use it for your most important keys.

---

## 79.7 LocalAuthentication and Biometrics 🟢

**`LAContext`** asks for **Face ID or Touch ID** (or the device passcode) before a sensitive action. Your app **never sees the face or fingerprint**. It only gets **yes or no**, because the check happens inside the Secure Enclave (79.6).

```swift
import LocalAuthentication

func authenticateUser() async throws -> Bool {
    let context = LAContext()
    return try await context.evaluatePolicy(
        .deviceOwnerAuthenticationWithBiometrics,
        localizedReason: "Authenticate to view your account balance"
    )
}
```

Add the reason to `Info.plist`, or the app crashes when it asks for Face ID:

```xml
<key>NSFaceIDUsageDescription</key>
<string>Use Face ID to unlock your saved payment details.</string>
```

Check first, and allow the passcode as a fallback:

```swift
let context = LAContext()
var error: NSError?

if context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) {
    // .deviceOwnerAuthentication = biometrics, or the passcode if biometrics fail
    let ok = try await context.evaluatePolicy(.deviceOwnerAuthentication,
                                              localizedReason: "Unlock your account")
} else {
    // No biometrics and no passcode set: show another way to sign in
}
```

This is an important privacy property: the app **cannot** read or store biometric data, even if it wanted to.

---

## 79.8 Detecting Biometry Changes 🟡

If someone **adds a new fingerprint or face** to the device, `LAContext.evaluatedPolicyDomainState` **changes**. A security-sensitive app can notice this and ask for a **stronger sign-in** (like the password) before trusting Face ID again.

```swift
let context = LAContext()
_ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
let currentDomainState = context.evaluatedPolicyDomainState
// Compare against a previously stored domain state; a change indicates
// enrolled biometric data has been added or removed since last checked
```

Store it after a successful sign-in, and compare it next time:

```swift
func biometryChanged() -> Bool {
    let context = LAContext()
    _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
    let current = context.evaluatedPolicyDomainState
    let saved = UserDefaults.standard.data(forKey: "biometryState")
    return saved != nil && saved != current
}

// After a successful password sign-in:
// UserDefaults.standard.set(context.evaluatedPolicyDomainState, forKey: "biometryState")
```

A simpler way: protect a Keychain item with **`.biometryCurrentSet`** (as in 79.6). It **stops working automatically** when the enrolled biometrics change.

**Why:** someone who borrows the phone could add **their own face**. Without this check, your app would trust it.

---

## 79.9 Certificate Pinning and Safe Rotation 🔴

Normal HTTPS trusts **any valid certificate** from a trusted authority. **Certificate pinning** also checks that the server uses **the exact key you expect**. This protects against a **man-in-the-middle** attack, even one that uses a wrongly issued certificate.

```swift
// Conceptual pinning validation within a URLSessionDelegate's challenge handling:
func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                 completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    // Compare the server's actual presented certificate/public key against
    // a specific, expected pinned value, rather than relying solely on standard chain validation
}
```

**The easiest way** (iOS 14 and later) is in `Info.plist`, with no code:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSPinnedDomains</key>
    <dict>
        <key>api.example.com</key>
        <dict>
            <key>NSPinnedLeafIdentities</key>
            <array>
                <dict>
                    <key>SPKI-SHA256-BASE64</key>
                    <string>CURRENT_KEY_HASH_BASE64=</string>
                </dict>
                <dict>
                    <key>SPKI-SHA256-BASE64</key>
                    <string>BACKUP_KEY_HASH_BASE64=</string>   <!-- the next key, for rotation -->
                </dict>
            </array>
        </dict>
    </dict>
</dict>
```

Or check it in code, with a `URLSessionDelegate`:

```swift
import CryptoKit

final class PinningDelegate: NSObject, URLSessionDelegate {
    let pinnedKeyHashes: Set<String> = ["CURRENT_KEY_HASH", "BACKUP_KEY_HASH"]

    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge)
        async -> (URLSession.AuthChallengeDisposition, URLCredential?) {
        guard let trust = challenge.protectionSpace.serverTrust,
              SecTrustEvaluateWithError(trust, nil),                     // normal checks first
              let leaf = (SecTrustCopyCertificateChain(trust) as? [SecCertificate])?.first,
              let key = SecCertificateCopyKey(leaf),
              let keyData = SecKeyCopyExternalRepresentation(key, nil) as Data?
        else { return (.cancelAuthenticationChallenge, nil) }

        // Hash the key bytes as iOS exports them. Compute your pins the same way.
        let hash = Data(SHA256.hash(data: keyData)).base64EncodedString()
        return pinnedKeyHashes.contains(hash)
            ? (.useCredential, URLCredential(trust: trust))
            : (.cancelAuthenticationChallenge, nil)
    }
}
```

**The danger is rotation.** Your app has the expected key built in. If the server gets a new key **before** the app knows it, the app **rejects its own server**, and every request fails. So:

- Always pin **at least two keys**: the current one and the next one.
- Update the app **before** you change the server's key.
- Consider pinning a more stable key, like your certificate authority's.

---

## 79.10 Jailbreak and Tamper Detection Trade-offs 🔴

**Jailbreak and tamper detection** tries to notice if the device's security was removed, or if your app was modified. It is **never perfect**: an attacker with full control of the device can find and bypass the checks.

```swift
// Common (imperfect) jailbreak detection signals:
// - Presence of specific files typically only present on jailbroken devices
// - Ability to write outside the app's normal sandbox
// - Unusual dynamic library loading patterns
// None of these checks are foolproof against a sufficiently motivated, sophisticated attacker
```

A simple check looks like this:

```swift
func looksJailbroken() -> Bool {
    #if targetEnvironment(simulator)
    return false
    #else
    let suspiciousPaths = ["/Applications/Cydia.app", "/bin/bash", "/usr/sbin/sshd"]
    if suspiciousPaths.contains(where: { FileManager.default.fileExists(atPath: $0) }) {
        return true
    }
    // A normal app cannot write outside its sandbox
    do {
        try "test".write(toFile: "/private/jailbreak_test.txt", atomically: true, encoding: .utf8)
        return true
    } catch {
        return false
    }
    #endif
}
```

**The trade-off:** these checks stop **casual** tampering, but **not a determined attacker**. For real integrity checks, use **App Attest** (section 57.16), which uses hardware-backed proof instead of guesses. Treat jailbreak checks as a small extra layer at best.

---

## 79.11 App Tracking Transparency 🟢

**App Tracking Transparency (ATT)** requires the **user's permission** before your app tracks them across **other companies'** apps and websites, usually for advertising. Without permission, the advertising identifier is not available, and tracking anyway **breaks the App Review Guidelines**.

```swift
import AppTrackingTransparency

func requestTrackingPermission() async -> ATTrackingManager.AuthorizationStatus {
    await ATTrackingManager.requestTrackingAuthorization()
}
```

Explain why, in `Info.plist`:

```xml
<key>NSUserTrackingUsageDescription</key>
<string>This lets us show you ads that match your cooking interests.</string>
```

Ask when the app is **active and on screen**, then respect the answer:

```swift
import AdSupport

let status = await requestTrackingPermission()
if status == .authorized {
    let adID = ASIdentifierManager.shared().advertisingIdentifier
    // allowed to use it for tracking
} else {
    // do not track; the identifier is all zeros anyway
}
```

ATT changed the default: tracking used to be **on unless you opted out**. Now it is **off unless you opt in**. That made ad measurement harder, which is why Apple made private alternatives (79.12).

---

## 79.12 SKAdNetwork and AdAttributionKit 🔴

**SKAdNetwork** and its newer version **AdAttributionKit** answer the question "**did this ad lead to an install?**" **without tracking a single person**. They give **combined, privacy-safe** results, so this works even when the user did not allow tracking (79.11).

```swift
// Conceptual: reporting a conversion event without individual-level tracking
import AdAttributionKit
// AdAttributionKit reports aggregated, privacy-preserving attribution signals
// (did an install/engagement occur following an ad interaction) rather than
// tracking and correlating a specific individual user's precise cross-app activity
```

Ad networks you work with are listed in `Info.plist`, so they can receive these results:

```xml
<key>SKAdNetworkItems</key>
<array>
    <dict>
        <key>SKAdNetworkIdentifier</key>
        <string>example123.skadnetwork</string>   <!-- the ID your ad network gives you -->
    </dict>
</array>
```

| | Tracking with ATT permission | SKAdNetwork / AdAttributionKit |
|---|---|---|
| Data | Each user's activity | Combined, delayed results |
| Needs permission | Yes | No |
| Answers | Exactly who did what | Whether ads worked overall |

**Why they exist:** advertisers still need to know if their ads work. These frameworks give useful numbers **without** individual tracking.

---

## 79.13 Secure Logging: Keeping PII Out 🟢

**Logs must not leak PII** (personally identifiable information): names, emails, exact locations, health data. Logs can be collected, sent to services, or seen by people who should not see that data. Use `Logger`'s **privacy** options (section 68.19).

```swift
import os

let logger = Logger(subsystem: "com.example.app", category: "auth")

// Insecure: logs a user's actual email address in plain text
logger.info("Login attempt for \(userEmail)")

// Secure: uses Logger's privacy annotation (recall section 68.19) to redact by default
logger.info("Login attempt for \(userEmail, privacy: .private)")
```

More options:

```swift
logger.info("Recipe count: \(count, privacy: .public)")                 // not sensitive: show it
logger.info("User: \(userID, privacy: .private(mask: .hash))")         // hidden, but the same user
                                                                         // gives the same hash
logger.error("Payment failed for order \(orderID, privacy: .public)")  // an order ID is not PII
```

`.private(mask: .hash)` is useful: you can see that **the same user** appears in several log lines, without seeing **who** it is.

This is about **compliance** too (79.15). PII in logs is personal data, with the **same GDPR and CCPA rules** as any other stored data.

---

## 79.14 Auditing SPM Dependencies for Supply Chain Risk 🔴

A **supply chain attack** happens when a dependency, or a **hacked update** of a trusted one, puts **malicious code** into your app. It has happened in other ecosystems. Any project with dependencies is at risk.

```plaintext
// Supply chain-specific auditing practices, beyond general dependency evaluation:
// - Pinning to specific, audited versions via Package.resolved (recall section 73.2)
//   rather than automatically accepting new versions without review
// - Reviewing a dependency's actual source changes before updating, not just its changelog
// - Being appropriately cautious about a dependency gaining new maintainers or ownership changes
```

In practice:

```bash
swift package show-dependencies            # know everything you pull in, including indirect ones
git diff Package.resolved                  # in every PR: which versions changed?
```

For a very sensitive dependency, accept **only one exact, reviewed version**:

```swift
.package(url: "https://github.com/example/crypto-lib.git", exact: "2.4.1")
```

Before updating, read the **code changes**, not just the release notes. GitHub can show them between two tags:

```plaintext
https://github.com/example/crypto-lib/compare/2.4.1...2.5.0
```

`Package.resolved` (section 73.2) is not only for **same builds everywhere**. It also stops your app from **automatically getting a new, unreviewed, possibly hacked version**.

---

## 79.15 GDPR and CCPA Obligations for App Developers 🟡

**GDPR** (EU) and **CCPA** (California) are **laws** about personal data. They apply if your users are there, **wherever you are**. They require, among other things:

```plaintext
// Representative GDPR/CCPA-relevant obligations for an app collecting personal data:
// - A genuinely clear, accessible privacy policy explaining what data is collected and why
// - A mechanism for users to request access to or deletion of their own collected data
// - Data collection genuinely limited to what's actually needed (connecting to 79.16)
// - Appropriate technical security measures protecting collected data (connecting to 79.2-79.4)
```

These rules affect **how you build the app**. For example, users must be able to **delete their data**. The App Store also requires that an app with account creation lets users **delete their account inside the app**:

```swift
struct AccountSettingsView: View {
    @State private var showConfirm = false
    let accountService: AccountService

    var body: some View {
        Button("Delete Account", role: .destructive) { showConfirm = true }
            .confirmationDialog("Delete your account and all your data?",
                                isPresented: $showConfirm) {
                Button("Delete", role: .destructive) {
                    Task { try await accountService.deleteAccount() }   // the server deletes everything
                }
            }
    }
}
```

For deletion to work, you must be able to **find all data that belongs to one user**. That is an architecture question, not just a legal one. Security (79.2 to 79.6) and legal compliance **go together**.

---

## 79.16 Data Minimization as a Design Strategy 🟢

**Data minimization** means collecting **only the data you really need**, not "just in case". It helps with the law (79.15), and it is great security: **data you never collect can never leak**.

```swift
// Data minimization in practice: does this feature genuinely need this specific data point?
// - A weather app needs approximate location, not necessarily precise GPS coordinates
// - A recipe app's meal planning feature doesn't need a user's exact birthdate,
//   even if "age range" might theoretically be marketing-interesting someday
```

For example, ask only for **approximate location**:

```xml
<!-- Info.plist: ask for approximate location by default -->
<key>NSLocationDefaultAccuracyReduced</key>
<true/>
```

```swift
import CoreLocation

let manager = CLLocationManager()
manager.desiredAccuracy = kCLLocationAccuracyReduced     // about a few kilometers, enough for weather
```

Ask this question **when you design each feature**: "Do we really need this data?"

Every other technique in this section (encryption, the Keychain, careful logging) **protects data you already collected**. Minimization **removes the risk completely**.

---

## Summary

| Concept | Key Mechanism | Purpose |
|---|---|---|
| Threat modeling | Assets, attackers, methods | Spend effort where the risk is |
| Secrets | Server for API keys, Keychain for tokens | Nothing secret in the app's code |
| Hashing and HMAC | `SHA256`, `HMAC` | Check data was not changed |
| Encryption | `AES.GCM` | Hide data and detect tampering |
| Signatures | `Curve25519`, `P256` | Anyone can verify, only you can sign |
| Secure Enclave | Hardware-isolated keys | The key never leaves the chip |
| Biometrics | `LAContext` | Yes or no, never the biometric data |
| Biometry changes | `evaluatedPolicyDomainState`, `.biometryCurrentSet` | Notice a newly added face or finger |
| Certificate pinning | `NSPinnedDomains` or a delegate | Stop man-in-the-middle, rotate safely |
| Jailbreak checks | File and sandbox checks | A small, bypassable extra layer |
| ATT | `requestTrackingAuthorization` | Tracking only with permission |
| Ad attribution | SKAdNetwork, AdAttributionKit | Measure ads without tracking people |
| Logging | `Logger` privacy options | No personal data in logs |
| Supply chain | Pinned, reviewed versions | No surprise malicious updates |
| GDPR and CCPA | Privacy policy, data deletion | Legal duties shape the design |
| Data minimization | Collect only what you need | Data never collected cannot leak |
