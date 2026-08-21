## 56.1 In-App Purchase Concepts and Product Types

Apple defines four fundamental in-app purchase product types: consumables (used up and can be purchased repeatedly, like in-game currency), non-consumables (purchased once, owned forever, like unlocking a pro feature), auto-renewable subscriptions (recurring access, like a streaming service), and non-renewing subscriptions (a fixed-duration period that doesn't auto-renew, comparatively rare).

```swift
// Product types are configured in App Store Connect (or a .storekit file for testing),
// not directly in Swift code — but your code must handle each type's distinct lifecycle:
// - Consumable: no persistent entitlement; your server/app tracks the balance
// - Non-consumable: permanent entitlement, restorable across devices
// - Auto-renewable subscription: entitlement tied to an active subscription period
// - Non-renewing subscription: entitlement for a fixed period, requires manual repurchase
```

Choosing the right product type is a genuine product design decision with real downstream consequences — a non-consumable's entitlement persists forever and must support restoration on a new device, while a consumable's "entitlement" is really just a balance your app or server tracks and decrements, meaning the app itself (not StoreKit) is responsible for the bookkeeping around what a consumable purchase actually granted.

---

## 56.2 StoreKit 2: Fetching Products

StoreKit 2's `Product.products(for:)` fetches product metadata (localized price, title, description) for a given set of product identifiers, replacing the older, more verbose `SKProductsRequest`/delegate pattern with a simple `async` call.

```swift
import StoreKit

func loadProducts() async throws -> [Product] {
    let identifiers = ["com.example.app.pro_unlock", "com.example.app.monthly_sub"]
    return try await Product.products(for: identifiers)
}
```

This single `async` call replaces what previously required implementing `SKProductsRequestDelegate` and handling its callback — consistent with the broader modernization pattern seen throughout StoreKit 2 (and mirrored in Photos' `PHAsset` continuation-wrapping from section 55.2), where older delegate-based APIs are superseded by direct `async`/`await` equivalents that are considerably simpler to read and reason about.

---

## 56.3 StoreKit 2: Making a Purchase

`Product.purchase()` initiates the system purchase sheet and returns a `Product.PurchaseResult` once the user completes (or cancels) the flow — success, user cancellation, or pending (e.g., awaiting parental approval via Ask to Buy).

```swift
func purchase(_ product: Product) async throws {
    let result = try await product.purchase()
    switch result {
    case .success(let verification):
        let transaction = try checkVerified(verification)
        await transaction.finish()
    case .userCancelled:
        break
    case .pending:
        break
    @unknown default:
        break
    }
}
```

The `.pending` case is easy to overlook but genuinely important — it represents purchases like Ask to Buy requests that require a family organizer's approval, meaning the transaction may complete successfully later, asynchronously, well after this function returns, which is exactly what `Transaction.updates` (56.4) exists to observe.

---

## 56.4 StoreKit 2: Transaction.updates and Entitlements

`Transaction.updates` is an `AsyncSequence` (recall AsyncSequence fundamentals from section 21) that emits every transaction update as it happens — including purchases completed elsewhere (another device, a pending purchase resolving later, a subscription renewal) — making it the single source of truth an app should listen to continuously for entitlement changes.

```swift
func listenForTransactionUpdates() -> Task<Void, Never> {
    Task.detached {
        for await update in Transaction.updates {
            if let transaction = try? checkVerified(update) {
                await updateEntitlement(for: transaction)
                await transaction.finish()
            }
        }
    }
}
```

Because this listener should run for the app's entire lifetime (starting as early as possible, typically at app launch) to reliably catch transactions that complete outside the immediate purchase flow, it's commonly started as a long-lived detached task — this is the mechanism that keeps an app's local entitlement state correctly synchronized even when a purchase resolves on a different device or after a delay, rather than requiring the app to poll for changes.

---

## 56.5 Verifying Transactions

Every transaction StoreKit delivers is wrapped in `VerificationResult`, which must be explicitly unwrapped and checked — `.verified` means Apple's on-device cryptographic verification confirmed the transaction's authenticity, while `.unverified` signals something failed that check and should generally not be trusted to grant an entitlement.

```swift
func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
    switch result {
    case .unverified:
        throw StoreError.failedVerification
    case .verified(let safe):
        return safe
    }
}
```

This verification step exists precisely to protect against tampered or spoofed transaction data — StoreKit 2 performs the underlying cryptographic signature checking on-device automatically, but it's still the app's own responsibility to call `checkVerified` (or equivalent) and actually branch on the result, since silently ignoring `.unverified` and granting the entitlement anyway would defeat the purpose of the check entirely.

---

## 56.6 SubscriptionStoreView and ProductView

SwiftUI provides `SubscriptionStoreView` and `ProductView` as ready-made, App-Store-styled purchase UI — handling the presentation of pricing, terms, and the purchase button with minimal custom code, appropriate for apps that want a standard, trustworthy-looking purchase experience without building custom purchase UI from scratch.

```swift
struct PaywallView: View {
    var body: some View {
        SubscriptionStoreView(groupID: "21455498") {
            VStack {
                Text("Unlock Pro Features")
                    .font(.title)
            }
        }
        .storeButton(.visible, for: .restorePurchases)
    }
}
```

`SubscriptionStoreView` is built specifically for subscription groups (56.7), automatically presenting all the group's subscription levels together with system-standard formatting for pricing and legal text, while the simpler `ProductView` handles a single product's purchase presentation — both meaningfully reduce the amount of custom paywall UI an app needs to build and maintain compared to a fully custom purchase flow driven by raw `Product` data.

---

## 56.7 Subscription Groups and Levels

A subscription group bundles related subscription tiers (e.g., Monthly, Yearly, or Basic/Premium tiers) that are mutually exclusive — a user can only be subscribed to one level within a group at a time, with StoreKit handling upgrade/downgrade/crossgrade transitions between levels automatically.

```plaintext
Configured in App Store Connect: products within the same group share a groupID.
StoreKit automatically handles:
- Upgrades: immediate access to the new (higher) tier, prorated
- Downgrades: takes effect at the next renewal date
- Crossgrades: switching between tiers at the same service level
```

This mutual-exclusivity model reflects how subscription businesses are typically structured in practice — a streaming service's Basic and Premium tiers are alternatives to each other, not independent purchases a user would hold simultaneously, and letting StoreKit manage the upgrade/downgrade transition logic (including proration) avoids having to reimplement genuinely tricky billing edge cases in app code.

---

## 56.8 Introductory, Promotional, and Win-Back Offers

Beyond a subscription's standard price, StoreKit supports several distinct offer types: introductory offers (a discount or free trial for new subscribers), promotional offers (targeted discounts for existing or lapsed subscribers, requiring server-side signing), and win-back offers (specifically targeting subscribers who have already churned, to encourage them to return).

```swift
if let introOffer = product.subscription?.introductoryOffer {
    print("Intro offer: \(introOffer.displayPrice) for \(introOffer.period.value) \(introOffer.period.unit)")
}
```

Each offer type targets a genuinely different point in the subscriber lifecycle — introductory offers exist to lower the barrier to a first subscription, while win-back offers specifically target users who already tried the product and left, reflecting the reality that retention and reacquisition require different incentive structures than initial acquisition; promotional offers additionally require a cryptographic signature generated server-side, since they represent a discount the app itself requests rather than one configured statically in App Store Connect.

---

## 56.9 Server Notifications V2

App Store Server Notifications V2 delivers signed JSON Web Signature (JWS) payloads to a developer-configured server endpoint whenever a subscription-relevant event occurs — a renewal, cancellation, billing issue, refund, or offer redemption — providing a server-side source of truth independent of whether the user's device is even online at the time.

```plaintext
Server-side (not client Swift) — a notification payload looks conceptually like:
{
  "notificationType": "DID_RENEW",
  "data": {
    "signedTransactionInfo": "<JWS>",
    "signedRenewalInfo": "<JWS>"
  }
}
The server verifies the JWS signature, then updates its own subscription records accordingly.
```

Relying solely on client-side transaction observation (56.4) is insufficient for a backend that needs reliable subscription state — a user could uninstall the app, and a subscription could still renew or lapse without the app ever running to observe `Transaction.updates` — so Server Notifications V2 gives a backend an independent, reliable channel to stay synchronized with subscription state regardless of client app activity.

---

## 56.10 Server-Side Receipt Validation

Beyond client-side `VerificationResult` checking (56.5), sensitive operations (granting server-tracked entitlements, preventing fraud) typically warrant independent server-side validation — either by verifying the signed transaction JWS directly (StoreKit 2's recommended approach) or, for legacy compatibility, calling Apple's verifyReceipt endpoint.

```plaintext
Client sends the signed transaction (JWS string) to your backend.
Server-side, using Apple's App Store Server Library:
1. Verify the JWS signature against Apple's public keys
2. Decode the payload to confirm product ID, transaction ID, purchase date
3. Cross-reference against your own database before granting server-side entitlement
```

Trusting only the client-reported purchase state is a meaningful security gap for any app with server-tracked value (like consumable currency or server-gated premium features) — server-side validation closes that gap by independently confirming a transaction's authenticity against Apple's own signed data before the server grants anything, rather than trusting whatever the client claims happened.

---

## 56.11 Restoring Purchases

`AppStore.sync()` explicitly re-syncs the app's transaction history with the App Store, appropriate for a manual "Restore Purchases" button — restoring non-consumable purchases or resubscribing state on a new device or after a reinstall.

```swift
func restorePurchases() async {
    do {
        try await AppStore.sync()
    } catch {
        // handle restore failure
    }
}
```

While `Transaction.updates` (56.4) and `Transaction.currentEntitlements` typically keep entitlement state synchronized automatically without user intervention, an explicit restore option remains standard practice — partly as a user-facing safety net for edge cases, and partly because App Store review guidelines generally expect a visible restore mechanism for apps selling non-consumable or subscription content.

---

## 56.12 Refund Requests and Consumption

Apple handles the refund request flow itself (via `Transaction.beginRefundRequest(in:)`, presenting a system sheet), but for consumable products specifically, apps can report consumption information beforehand to help Apple's refund decision reflect how much of the consumable value was actually used.

```swift
func requestRefund(for transaction: Transaction, in scene: UIWindowScene) async throws {
    let status = try await transaction.beginRefundRequest(in: scene)
    switch status {
    case .success: break
    case .userCancelled: break
    @unknown default: break
    }
}
```

Consumption request data (submitted via a separate API ahead of a refund decision) lets an app signal relevant context — like how much of a consumable currency balance remains unused — which Apple's refund evaluation can factor in, though the ultimate refund decision itself remains entirely under Apple's control rather than the app's; this is a meaningfully more constrained role than a traditional payment processor's refund API, reflecting the App Store's platform-managed purchase model.

---

## 56.13 Testing with .storekit Configuration Files

A `.storekit` configuration file, added directly to an Xcode project, defines local test products (with configurable prices, subscription groups, and offers) that let purchase flows be developed and tested entirely in the simulator or on a device without any App Store Connect setup or network connectivity.

```swift
// In Xcode: File > New > File > StoreKit Configuration File
// Then, in the scheme's Run settings, select the .storekit file under "StoreKit Configuration"
// Product.products(for:) and purchase() then transact against this local configuration
// with zero real App Store Connect dependency during development.
```

This local-first testing capability is a genuinely significant developer experience improvement — it decouples day-to-day purchase flow development from App Store Connect's setup and propagation delays entirely, letting a developer freely experiment with different product configurations, prices, and offer scenarios purely locally, reserving actual App Store Connect and sandbox testing (56.14) for later-stage validation closer to release.

---

## 56.14 Sandbox Testing and Common Purchase Bugs

Beyond local `.storekit` testing, Apple's sandbox environment (using dedicated sandbox Apple ID test accounts) provides a more realistic end-to-end test against actual App Store Connect-configured products, including accelerated subscription renewal cycles for testing renewal and expiration behavior without waiting real-world durations.

```plaintext
Common purchase bugs to explicitly test for:
- Not calling transaction.finish() — StoreKit will keep re-delivering the transaction
- Not listening to Transaction.updates early enough at app launch — missing pending purchases
- Granting entitlement before verification succeeds — a security gap, not just a bug
- Not handling .pending (Ask to Buy) — the purchase silently appears to "hang"
- Testing only the happy path — not simulating cancellation, network failure, or refunds
```

Sandbox testing's accelerated renewal cycles (a "monthly" subscription might renew every few minutes in sandbox) are specifically valuable for exercising renewal, expiration, and billing-retry logic within a practical testing timeframe — combined with deliberately testing the failure and edge-case paths listed above (not just a single successful purchase), this is what actually validates a purchase implementation's correctness under the full range of conditions real users will eventually encounter.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Product types | Consumable, non-consumable, auto-renewable, non-renewing | Fundamental purchase entitlement models |
| Fetching products | `Product.products(for:)` | Async product metadata retrieval |
| Purchasing | `product.purchase()`, `PurchaseResult` | Initiates system purchase sheet |
| Entitlement sync | `Transaction.updates` (AsyncSequence) | Continuous, long-lived transaction observation |
| Authenticity | `VerificationResult`, `checkVerified` | On-device cryptographic transaction verification |
| Ready-made UI | `SubscriptionStoreView`, `ProductView` | Standard App-Store-styled purchase presentation |
| Tier structure | Subscription groups | Mutually exclusive tiers with managed transitions |
| Incentives | Intro, promotional, win-back offers | Lifecycle-targeted discount mechanisms |
| Server sync | Server Notifications V2 | Independent, signed backend subscription state |
| Fraud prevention | Server-side receipt/JWS validation | Independently confirmed transaction authenticity |
| Cross-device state | `AppStore.sync()` | Manual restore purchases flow |
| Refunds | `beginRefundRequest(in:)`, consumption info | Apple-managed refund flow with app-provided context |
| Local testing | `.storekit` configuration files | Zero-network, fully local purchase flow development |
| Realistic testing | Sandbox accounts, accelerated renewals | End-to-end validation including edge cases |
