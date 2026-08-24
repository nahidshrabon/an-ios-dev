## 79.1 Threat Modeling a Mobile App

Threat modeling systematically identifies what could go wrong (what assets need protection, who might attack them, and how) before investing security effort — appropriate as a deliberate, structured first step rather than applying security techniques ad hoc without a clear understanding of what specific threats they're actually meant to address.

```plaintext
// A simple threat modeling framework: for each asset, ask:
// - What is it? (user credentials, health data, payment tokens)
// - Who might want it? (a malicious app on the same device, a network attacker, a thief with physical access)
// - How might they get it? (insecure storage, unencrypted network transit, jailbroken device tampering)
// - What's the actual, appropriate mitigation given the realistic threat and asset sensitivity?
```

Threat modeling's genuine value is preventing exactly the kind of scattered, unfocused security effort that either over-invests in protecting against unlikely threats or under-invests in protecting against genuinely likely ones — a banking app handling real financial credentials warrants meaningfully more security investment (certificate pinning, 79.9; Secure Enclave-backed keys, 79.6) than a simple recipe-sharing app, and threat modeling is the discipline that helps correctly calibrate security effort to an app's actual, specific risk profile rather than either extreme.

---

## 79.2 Where Secrets Should and Shouldn't Live

API keys, credentials, and other secrets should never be hardcoded directly in an app's compiled binary (recall the AI coding tool data-handling concern from section 61.12, which raises a related but distinct issue) — since a compiled app binary can be reverse-engineered and inspected, any embedded secret is genuinely, eventually extractable, meaning secrets requiring genuine confidentiality belong server-side, with the app authenticating to a backend that then handles the actual sensitive credential.

```swift
// Insecure: a hardcoded API key extractable from the compiled binary via reverse engineering
let apiKey = "sk_live_abc123..."  // NEVER do this for a genuinely sensitive secret

// Better: the app authenticates to your own backend, which holds the actual sensitive credential
// and makes the authenticated third-party API call on the app's behalf
```

This is a genuinely important, sometimes-underestimated point — no amount of client-side obfuscation (string encoding tricks, splitting a key across multiple constants) provides genuine security against a sufficiently motivated attacker with access to the compiled binary, since the app must eventually decode and use the actual secret at runtime, meaning the only genuinely secure approach for a truly sensitive credential is keeping it entirely server-side and never embedding it in the distributed app binary at all.

---

## 79.3 CryptoKit: Hashing and HMAC

CryptoKit provides modern, safe cryptographic hashing (`SHA256`, `SHA384`, `SHA512`) and HMAC (keyed hashing, verifying both data integrity and authenticity using a shared secret key) through a Swift-native, misuse-resistant API considerably safer to use correctly than older, lower-level C cryptography APIs.

```swift
import CryptoKit

let data = "hello world".data(using: .utf8)!
let digest = SHA256.hash(data: data)
print(digest.compactMap { String(format: "%02x", $0) }.joined())

let key = SymmetricKey(size: .bits256)
let authenticationCode = HMAC<SHA256>.authenticationCode(for: data, using: key)
```

CryptoKit's genuine design goal is making the *correct*, secure use of cryptography the *easy*, default path — rather than a developer needing deep cryptographic expertise to correctly use a lower-level API (with genuine risk of subtle misuse producing an insecure result despite looking superficially correct), CryptoKit's Swift-native types and APIs are specifically designed to make the safe, correct usage pattern the natural, straightforward one, meaningfully reducing the risk of cryptographic implementation mistakes compared to working with older, more error-prone C-level cryptography APIs directly.

---

## 79.4 CryptoKit: Symmetric Encryption

CryptoKit's symmetric encryption (`AES.GCM`, using the same key for both encryption and decryption) provides authenticated encryption — encrypting data while also verifying it hasn't been tampered with — appropriate for encrypting data at rest (recall Core Data's encryption discussion, section 42) or data the app itself both encrypts and later decrypts using a securely-stored key.

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

AES-GCM's "authenticated" property is a genuinely important distinction from simpler encryption schemes that only provide confidentiality without integrity verification — because GCM mode includes an authentication tag validated during decryption, tampering with encrypted data (an attacker modifying ciphertext, even without knowing the actual key) is detected and causes decryption to fail explicitly, rather than silently producing corrupted, incorrect plaintext that the app might otherwise process without any indication something had actually been tampered with.

---

## 79.5 CryptoKit: Public Key Cryptography and Signatures

CryptoKit's public key cryptography (`Curve25519`, `P256`, and related elliptic curve types) supports asymmetric key pairs — a private key that must remain secret and a public key that can be freely shared — appropriate for digital signatures (proving data originated from a specific key holder without revealing the private key itself) and key agreement protocols.

```swift
import CryptoKit

let privateKey = Curve25519.Signing.PrivateKey()
let publicKey = privateKey.publicKey

let message = "important data".data(using: .utf8)!
let signature = try privateKey.signature(for: message)

// Anyone with the public key can verify the signature without ever having the private key:
let isValid = publicKey.isValidSignature(signature, for: message)
```

The genuine power of asymmetric cryptography, distinct from the symmetric encryption covered in 79.4, is that verification doesn't require possessing the same secret used to create the signature — anyone holding the public key can verify a signature's authenticity, while only the private key holder could have actually created that valid signature in the first place, a fundamentally different trust model than symmetric encryption's shared-secret approach, and the actual foundation underlying mechanisms like App Attest (recall section 57.16) that need to prove authenticity without embedding a shared, extractable secret.

---

## 79.6 Secure Enclave-Backed Keys 🔴

The Secure Enclave is a dedicated, isolated hardware security coprocessor present on modern Apple devices, and Secure Enclave-backed cryptographic keys can be generated such that the actual private key material never leaves the Secure Enclave at all — even the app's own process (and even a jailbroken device's root access) cannot directly extract the raw private key, since cryptographic operations using it happen entirely within the isolated hardware.

```swift
import CryptoKit

let privateKey = try SecureEnclave.P256.Signing.PrivateKey()
// The actual private key material is generated and remains entirely within
// the Secure Enclave hardware — the app only ever interacts with a reference to it,
// and can request signing operations without ever accessing the raw key bytes
```

This hardware-backed isolation provides a genuinely stronger security guarantee than any software-only key storage approach could ever achieve — even Keychain-stored keys (without Secure Enclave backing) exist as actual extractable bytes somewhere accessible to sufficiently privileged code, while a genuine Secure Enclave-backed key's private material is architecturally, physically isolated such that no software running on the device (regardless of its privilege level) can directly read the raw key material, making this the appropriate choice for the most security-critical key material a genuinely high-stakes app might need to protect.

---

## 79.7 LocalAuthentication and Biometrics

`LAContext` provides Face ID/Touch ID authentication, letting an app verify a user's biometric identity (or device passcode fallback) before performing a sensitive action — critically, the app never receives the actual biometric data itself, only a success/failure result, since biometric processing happens entirely within the Secure Enclave (79.6).

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

The fact that raw biometric data never actually reaches the app (or even leaves the Secure Enclave) is a genuinely important privacy property, directly related to the hardware isolation discussed in 79.6 — an app using `LAContext` fundamentally cannot access or store a user's actual fingerprint or face data even if it wanted to, since the entire comparison happens within the Secure Enclave's isolated hardware, with the app receiving only a simple boolean success/failure result rather than anything resembling the actual biometric measurement itself.

---

## 79.8 Detecting Biometry Changes 🟠

`LAContext`'s `evaluatedPolicyDomainState` changes if the set of enrolled biometric data changes (a new fingerprint or face added, or all biometric data removed) — letting an app detect this specific event and, for security-sensitive uses, potentially require re-authentication via a stronger factor rather than trusting a newly-changed biometric enrollment automatically.

```swift
let context = LAContext()
_ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
let currentDomainState = context.evaluatedPolicyDomainState
// Compare against a previously stored domain state; a change indicates
// enrolled biometric data has been added or removed since last checked
```

This detection capability addresses a genuine, specific security scenario — if a device is temporarily accessible to someone other than its owner, that person could potentially enroll their own additional fingerprint or face, and without detecting this change, a security-sensitive app might continue trusting biometric authentication that now includes an unauthorized person's enrolled biometric data, making `evaluatedPolicyDomainState` monitoring a genuinely important, if narrow, additional safeguard for apps with meaningfully high security stakes tied to biometric authentication specifically.

---

## 79.9 Certificate Pinning and Safe Rotation 🔴

Certificate pinning hardens network communication against man-in-the-middle attacks by having an app verify a server's certificate (or public key) against a specific, expected value embedded in the app, rather than trusting any certificate merely because it chains to a trusted root authority — providing protection even against a compromised or maliciously-issued certificate that would otherwise pass standard TLS validation.

```swift
// Conceptual pinning validation within a URLSessionDelegate's challenge handling:
func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                 completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
    // Compare the server's actual presented certificate/public key against
    // a specific, expected pinned value, rather than relying solely on standard chain validation
}
```

The "safe rotation" concern in this subtopic's title reflects a genuinely real, easy-to-get-wrong operational risk with certificate pinning — because a pinned app hardcodes a specific expected certificate or key, that pin must be updated *before* the actual server certificate is rotated/renewed, or the app will suddenly reject all connections to its own legitimate backend the moment the old, pinned certificate expires, meaning certificate pinning requires genuine, deliberate operational discipline (typically pinning to a more stable intermediate key, or maintaining multiple valid pins during a transition period) rather than being a purely one-time, "set it and forget it" security configuration.

---

## 79.10 Jailbreak and Tamper Detection Trade-offs 🔴

Jailbreak/tamper detection attempts to identify whether an app is running on a compromised device (jailbroken, with security restrictions bypassed) or whether the app binary itself has been tampered with — a genuinely imperfect, adversarial cat-and-mouse endeavor, since any client-side detection logic can, in principle, itself be identified and bypassed by a sufficiently determined attacker with full control over the device.

```swift
// Common (imperfect) jailbreak detection signals:
// - Presence of specific files typically only present on jailbroken devices
// - Ability to write outside the app's normal sandbox
// - Unusual dynamic library loading patterns
// None of these checks are foolproof against a sufficiently motivated, sophisticated attacker
```

The genuine trade-off worth understanding here is that jailbreak/tamper detection provides a real, meaningful deterrent against unsophisticated or casual tampering while providing essentially no guarantee against a genuinely determined, sophisticated attacker — this connects directly back to the App Attest discussion (section 57.16), which addresses the same underlying integrity-verification goal but through hardware-backed attestation rather than client-side heuristic detection, making App Attest the meaningfully stronger mechanism where genuine tamper-resistance matters, with jailbreak detection heuristics providing a real but genuinely limited, secondary layer at best.

---

## 79.11 App Tracking Transparency

App Tracking Transparency (ATT) requires explicit user permission before an app can track a user's activity across other companies' apps and websites (most commonly for cross-app advertising attribution) — presented via a standardized system permission prompt (`ATTrackingManager.requestTrackingAuthorization`), with tracking without this permission being both a technical restriction (the advertising identifier is unavailable) and an explicit App Review Guidelines violation.

```swift
import AppTrackingTransparency

func requestTrackingPermission() async -> ATTrackingManager.AuthorizationStatus {
    await ATTrackingManager.requestTrackingAuthorization()
}
```

ATT represents a genuinely significant, deliberate shift in the mobile advertising ecosystem's default posture — rather than cross-app tracking being possible by default with an opt-out buried in settings, ATT requires an explicit, standardized, system-level opt-*in* prompt before any cross-app tracking can occur at all, a meaningfully stronger privacy default than the industry's prior norm, with real, measurable downstream consequences for advertising attribution accuracy that directly motivated the development of privacy-preserving alternatives like SKAdNetwork and AdAttributionKit (79.12).

---

## 79.12 SKAdNetwork and AdAttributionKit 🔴

SKAdNetwork (and its newer evolution, AdAttributionKit) provides privacy-preserving advertising attribution — determining whether an ad click led to an app install and subsequent engagement — without requiring the precise, individual-level cross-app tracking that App Tracking Transparency (79.11) now gates behind explicit user permission.

```swift
// Conceptual: reporting a conversion event without individual-level tracking
import AdAttributionKit
// AdAttributionKit reports aggregated, privacy-preserving attribution signals
// (did an install/engagement occur following an ad interaction) rather than
// tracking and correlating a specific individual user's precise cross-app activity
```

These frameworks exist specifically to solve a genuine, real business problem created by ATT's stronger privacy default (79.11) — advertisers and app developers still have a legitimate need to measure whether their advertising spend is actually effective, and SKAdNetwork/AdAttributionKit's privacy-preserving design provides aggregated, statistically useful attribution signals without requiring the precise, individual-level tracking data that ATT now requires explicit permission for, representing a genuine attempt to reconcile legitimate advertising measurement needs with a meaningfully stronger default privacy posture.

---

## 79.13 Secure Logging: Keeping PII Out

Secure logging practices ensure that logs (recall `Logger`'s privacy annotation system from section 68.19) never inadvertently capture personally identifiable information (PII) — names, email addresses, precise location, health data — in a form that could be inappropriately exposed if logs are ever collected, transmitted to a third-party logging service, or accessed by someone who shouldn't see genuinely sensitive user data.

```swift
import os

let logger = Logger(subsystem: "com.example.app", category: "auth")

// Insecure: logs a user's actual email address in plain text
logger.info("Login attempt for \(userEmail)")

// Secure: uses Logger's privacy annotation (recall section 68.19) to redact by default
logger.info("Login attempt for \(userEmail, privacy: .private)")
```

This directly extends the `Logger` privacy annotation discussion from section 68.19 into a genuine, deliberate security and compliance practice, not merely a debugging convenience — beyond the general privacy benefit of redaction-by-default, secure logging discipline matters acutely for regulatory compliance purposes (79.15), since logs inadvertently containing PII can themselves become a genuine data protection liability, subject to the same GDPR/CCPA data handling obligations as any other collected personal data, making disciplined use of `Logger`'s privacy annotations a practical compliance measure, not just good hygiene.

---

## 79.14 Auditing SPM Dependencies for Supply Chain Risk 🔴

Beyond the general dependency evaluation criteria discussed in section 73.7 (maintenance activity, license, necessity), supply chain security specifically concerns whether a dependency (or a compromised update to a previously-trustworthy dependency) could introduce malicious code into an app — a genuine, real-world attack vector that has affected other software ecosystems and represents a meaningful risk for any project with a non-trivial dependency tree.

```plaintext
// Supply chain-specific auditing practices, beyond general dependency evaluation:
// - Pinning to specific, audited versions via Package.resolved (recall section 73.2)
//   rather than automatically accepting new versions without review
// - Reviewing a dependency's actual source changes before updating, not just its changelog
// - Being appropriately cautious about a dependency gaining new maintainers or ownership changes
```

This connects directly to `Package.resolved`'s reproducibility guarantee from section 73.2, but applied here specifically through a security lens rather than purely a build-consistency one — pinning to exact, previously-reviewed versions via `Package.resolved` isn't just about avoiding "works on my machine" inconsistency, but also genuinely prevents an app from automatically pulling in a newly-published, potentially-compromised version of a dependency without deliberate review, making disciplined version pinning a meaningful supply chain security practice, not merely a build reproducibility one.

---

## 79.15 GDPR and CCPA Obligations for App Developers

GDPR (EU) and CCPA (California) impose genuine legal obligations around personal data handling — requiring, among other things, a clear legal basis for data collection, user rights to access/delete their own data, and appropriate data protection measures — obligations that apply to an app collecting personal data from users in these jurisdictions regardless of where the app's own developer happens to be located.

```plaintext
// Representative GDPR/CCPA-relevant obligations for an app collecting personal data:
// - A genuinely clear, accessible privacy policy explaining what data is collected and why
// - A mechanism for users to request access to or deletion of their own collected data
// - Data collection genuinely limited to what's actually needed (connecting to 79.16)
// - Appropriate technical security measures protecting collected data (connecting to 79.2-79.4)
```

These legal obligations aren't merely abstract compliance concerns disconnected from the technical material covered throughout this section — a user's right to request data deletion has genuine technical implications for how an app's data storage is actually architected (can specific user data genuinely be located and deleted upon request), and appropriate security measures directly connect to the CryptoKit and secure storage practices covered earlier in this section (79.3-79.6), meaning legal compliance and sound technical security/privacy engineering are genuinely intertwined concerns rather than separate, independent tracks of work.

---

## 79.16 Data Minimization as a Design Strategy

Data minimization — collecting only the data genuinely necessary for an app's actual functionality, rather than collecting broadly "just in case" it might be useful someday — is both a genuine legal best practice (directly supporting GDPR/CCPA compliance, 79.15) and a sound security design principle in its own right, since data never collected in the first place can never be leaked, breached, or misused.

```swift
// Data minimization in practice: does this feature genuinely need this specific data point?
// - A weather app needs approximate location, not necessarily precise GPS coordinates
// - A recipe app's meal planning feature doesn't need a user's exact birthdate,
//   even if "age range" might theoretically be marketing-interesting someday
```

Data minimization represents a genuinely elegant security principle specifically because it sidesteps entire categories of risk rather than attempting to mitigate them after the fact — every other security technique covered in this section (encryption, secure storage, careful logging) exists to protect data that's already been collected, while data minimization's approach of simply not collecting unnecessary data in the first place eliminates the corresponding risk surface entirely, making it worth genuinely deliberate consideration during a feature's initial design (asking "do we actually need this specific data point") rather than treating data protection purely as a downstream technical concern applied after a data collection decision has already been made.

---

## Summary

| Concept | Key Mechanism | Purpose |
|---|---|---|
| Structured risk assessment | Threat modeling | Calibrates security effort to actual, specific risk |
| Secret handling | Server-side credential storage | No client-side obfuscation resists a determined attacker |
| Integrity/authenticity | CryptoKit hashing, HMAC | Safe-by-default cryptographic primitives |
| Confidentiality + integrity | CryptoKit `AES.GCM` | Authenticated encryption detects tampering |
| Asymmetric trust | CryptoKit signatures (`Curve25519`, `P256`) | Verification without sharing the signing secret |
| Hardware isolation | Secure Enclave-backed keys | Private key material never leaves isolated hardware |
| Biometric authentication | `LAContext` | App never receives raw biometric data |
| Enrollment change detection | `evaluatedPolicyDomainState` | Guards against unauthorized biometric re-enrollment |
| MITM protection | Certificate pinning | Requires deliberate rotation discipline |
| Tamper resistance (limited) | Jailbreak detection | A real but bypassable deterrent, not a guarantee |
| Tracking consent | App Tracking Transparency | Explicit opt-in default for cross-app tracking |
| Privacy-preserving attribution | SKAdNetwork, AdAttributionKit | Aggregated measurement without individual tracking |
| Log hygiene | `Logger` privacy annotations | Prevents PII exposure, supports compliance |
| Supply chain discipline | Reviewed, pinned dependency versions | Prevents unreviewed malicious dependency updates |
| Legal compliance | GDPR, CCPA obligations | Intertwined with technical architecture and security |
| Risk elimination | Data minimization | Never-collected data can never be leaked or misused |
