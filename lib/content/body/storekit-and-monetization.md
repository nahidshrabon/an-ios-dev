**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**StoreKit 2** is how apps sell **digital** things: a "Pro" unlock, a subscription, coins. It uses **async/await**, signed transactions, and ready-made SwiftUI paywalls. This section covers product types, loading and buying products, keeping **entitlements** (what the user owns) correct, subscriptions and offers, the **server** side, restores, refunds, and testing.

---

## 56.1 In-App Purchase Concepts and Product Types 🟢

There are **four** product types. You create them in **App Store Connect** (or in a `.storekit` file for testing, 56.13), not in code:

| Type | Bought | Example | Who tracks it |
|---|---|---|---|
| **Consumable** | Again and again; **used up** | 100 coins, one extra recipe pack credit | **Your app or server** keeps the balance |
| **Non-consumable** | **Once**, kept **forever** | "Unlock Pro" | StoreKit (restorable on every device) |
| **Auto-renewable subscription** | Renews **automatically** | Recipes+ monthly | StoreKit, plus your server (56.9) |
| **Non-renewing subscription** | A **fixed** period, no auto-renew | A 3-month season pass | **Your app or server** (rare) |

The type is a **product decision** with real code results:

- A **non-consumable** must work on the user's **other devices** and after a **reinstall** (56.11). StoreKit remembers it for you.
- A **consumable** is gone once delivered. StoreKit only says "they bought 100 coins". **You** must add 100 to a balance, store it safely (ideally on a **server**), and subtract when they spend.

Rules to know before you design a paywall:

- **Digital** content and features unlocked **in the app** must generally use in-app purchase. **Physical** goods and services (food delivery, a taxi) must **not**.
- Apple takes a **commission** (usually 30%, or 15% for subscriptions after a year and for small businesses).
- The rules about linking to **outside** payment differ by **country** and have changed recently. ⚠️ Check the current **App Review Guidelines** (section 3.1).

---

## 56.2 StoreKit 2: Fetching Products 🟢

Load products by their **IDs** with one async call:

```swift
import StoreKit

enum ProductID {
    static let pro = "com.example.recipes.pro"
    static let monthly = "com.example.recipes.plus.monthly"
    static let yearly = "com.example.recipes.plus.yearly"
    static let all = [pro, monthly, yearly]
}

@MainActor
@Observable
final class Store {
    private(set) var products: [Product] = []

    func loadProducts() async {
        do {
            products = try await Product.products(for: ProductID.all)
                .sorted { $0.price < $1.price }
        } catch {
            print("Failed to load products: \(error)")
        }
    }
}
```

A **`Product`** has everything the paywall needs, already **localized** for the user's country:

```swift
Text(product.displayName)          // "Recipes Plus Monthly"
Text(product.description)          // "All recipes, meal plans, and more"
Text(product.displayPrice)         // "$4.99", "4,99 €", "¥700"
```

⚠️ Always show **`displayPrice`**. Never hard-code prices: they differ per country, and you can change them in App Store Connect.

This replaces the old **`SKProductsRequest`** + delegate API with a single `async` call.

**Gotcha:** if an ID is wrong, or the product isn't ready, you **don't get an error**. That product is just **missing** from the array. Got an **empty** array? Check the IDs, the product's status in App Store Connect, and that the **Paid Apps agreement** is active.

---

## 56.3 StoreKit 2: Making a Purchase 🟢

**`product.purchase()`** shows the system purchase sheet and returns a **result**:

```swift
extension Store {
    func purchase(_ product: Product) async throws {
        let result = try await product.purchase(options: [
            .appAccountToken(currentUser.storeToken)        // links the purchase to YOUR user (a UUID)
        ])

        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)   // 56.5
            await updateEntitlements()                          // 1. give access
            await transaction.finish()                          // 2. THEN finish

        case .userCancelled:
            break                                               // not an error: do nothing

        case .pending:
            showMessage("Waiting for approval")                 // e.g. Ask to Buy (56.4 delivers it later)

        @unknown default:
            break
        }
    }
}
```

| Result | Meaning | What to do |
|---|---|---|
| `.success(verification)` | Paid | Verify, give access, **finish** |
| `.userCancelled` | The user closed the sheet | Nothing. Don't show an error |
| `.pending` | Needs approval (**Ask to Buy**, Strong Customer Authentication) | Tell the user; the result arrives **later** through `Transaction.updates` |

**Order matters**: deliver the content **first**, then call **`finish()`**. `finish()` tells StoreKit "**delivered**". If the app crashes before that, StoreKit gives you the transaction **again** later, so nothing is lost.

In SwiftUI, you can also use the **`@Environment(\.purchase)`** action (iOS 17), which knows the current scene:

```swift
@Environment(\.purchase) private var purchase

Button("Buy \(product.displayPrice)") {
    Task {
        let result = try await purchase(product)    // then handle it as above
    }
}
```

---

## 56.4 StoreKit 2: Transaction.updates and Entitlements 🟡

Purchases don't only happen **inside** your purchase function:

- an **Ask to Buy** request is approved an hour later,
- a subscription **renews**,
- the user buys on their **iPad**,
- a purchase is **refunded**.

**`Transaction.updates`** is an **`AsyncSequence`** (21.2) that delivers all of these. Start listening **at launch**, and keep listening while the app runs:

```swift
extension Store {
    func listenForTransactions() -> Task<Void, Never> {
        Task(priority: .background) { [weak self] in
            for await update in Transaction.updates {
                guard let self else { return }
                if let transaction = try? self.checkVerified(update) {
                    await self.updateEntitlements()
                    await transaction.finish()
                }
            }
        }
    }
}

@main
struct RecipeApp: App {
    @State private var store = Store()
    @State private var updatesTask: Task<Void, Never>?

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(store)
                .task {
                    updatesTask = store.listenForTransactions()   // as early as possible
                    await store.updateEntitlements()
                    await store.loadProducts()
                }
        }
    }
}
```

The **source of truth** for "what does the user own **right now**?" is **`Transaction.currentEntitlements`**. Re-check it at launch and after every change:

```swift
extension Store {
    // Kept in the Store class: private(set) var ownedProductIDs: Set<String> = []

    func updateEntitlements() async {
        var owned: Set<String> = []
        for await result in Transaction.currentEntitlements {
            if let transaction = try? checkVerified(result),
               transaction.revocationDate == nil {             // not refunded
                owned.insert(transaction.productID)
            }
        }
        ownedProductIDs = owned
    }

    var isPro: Bool {
        !ownedProductIDs.isDisjoint(with: [ProductID.pro, ProductID.monthly, ProductID.yearly])
    }
}
```

Expired subscriptions **drop out** of `currentEntitlements` on their own. So "**is this user Pro?**" is just: is a valid entitlement in this list?

SwiftUI also has helpers for this (iOS 17): **`.currentEntitlementTask(for:)`** and **`.subscriptionStatusTask(for:)`**.

---

## 56.5 Verifying Transactions 🟡

Every transaction comes **wrapped** in a **`VerificationResult`**. StoreKit has already checked Apple's **signature** on the device; you must **look** at the answer:

```swift
enum StoreError: Error {
    case failedVerification
}

extension Store {
    nonisolated func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value):
            return value                                         // signed by the App Store: trust it
        case .unverified(_, let error):
            print("Unverified transaction: \(error)")
            throw StoreError.failedVerification                  // don't grant anything
        }
    }
}
```

| Case | Meaning |
|---|---|
| `.verified(T)` | The **signature** is valid: the data came from the App Store, unchanged |
| `.unverified(T, error)` | The check **failed**: the data may be **tampered** or **fake** |

Why this matters: a modified device can **fake** purchase data. If you unwrap the value **without** checking, you give premium content to anyone. That's a **security hole**, not just a small bug.

Use the **same** `checkVerified` everywhere: purchases (56.3), updates and entitlements (56.4).

There's one more signed object: **`AppTransaction.shared`** describes the purchase of the **app itself** (for example, its original version). It's useful when moving a **paid** app to a **free + in-app purchase** model: users who bought the paid app keep their features.

---

## 56.6 SubscriptionStoreView and ProductView 🟢

StoreKit includes **ready-made SwiftUI paywalls** (iOS 17). They show prices, terms, and buttons in the **standard** App Store style, with very little code:

```swift
import SwiftUI
import StoreKit

struct PlusPaywall: View {
    var body: some View {
        SubscriptionStoreView(groupID: "21455498") {          // your subscription group's ID
            // Your marketing content at the top
            VStack(spacing: 8) {
                Image(systemName: "fork.knife.circle.fill").font(.system(size: 60))
                Text("Recipes Plus").font(.largeTitle.bold())
                Text("Every recipe, weekly meal plans, and shopping lists.")
                    .multilineTextAlignment(.center)
            }
            .padding()
        }
        .subscriptionStoreControlStyle(.prominentPicker)        // how the options look
        .storeButton(.visible, for: .restorePurchases)          // a "Restore" button (56.11)
        .subscriptionStorePolicyDestination(url: URL(string: "https://example.com/terms")!,
                                            for: .termsOfService)
        .onInAppPurchaseCompletion { product, result in
            // optional: analytics, close the paywall, etc.
        }
    }
}
```

For **one** product, or a list of non-subscription products:

```swift
ProductView(id: ProductID.pro)                     // one product with its buy button
    .productViewStyle(.large)

StoreView(ids: ["com.example.recipes.coins100", "com.example.recipes.coins500"])
```

| View | Shows |
|---|---|
| `SubscriptionStoreView` | All levels of **one subscription group** (56.7) |
| `ProductView` | **One** product |
| `StoreView` | A **list** of products |

These views **still** go through `Transaction.updates` (56.4), so your entitlement code doesn't change. They're a fast, trustworthy start; build a custom paywall from `Product` data (56.2) only if you need a special design.

---

## 56.7 Subscription Groups and Levels 🟡

A **subscription group** holds the subscriptions that are **alternatives** to each other. A user can have **only one** active subscription **per group**:

```
Group "Recipes Plus"
  Level 1: Plus Family (yearly, monthly)    ← highest service
  Level 2: Plus (yearly, monthly)
```

You rank the **levels** in App Store Connect (highest first). When a user **switches**, StoreKit handles the billing:

| Change | Example | When it takes effect |
|---|---|---|
| **Upgrade** | Plus → Plus Family | **Right away**; the unused part is refunded pro rata |
| **Downgrade** | Plus Family → Plus | At the **next renewal** |
| **Crossgrade** | Plus monthly → Plus yearly | Same length: right away. Different length: next renewal |

Why one per group? Basic and Premium are **choices**, not things you'd buy **both** of. Letting StoreKit handle switching (and the proration math) saves you from writing tricky billing code.

Let users **manage** their subscription without leaving your app:

```swift
@State private var showManage = false

Button("Manage Subscription") { showManage = true }
    .manageSubscriptionsSheet(isPresented: $showManage)
```

Check the current status of the group:

```swift
let statuses = try await Product.SubscriptionInfo.status(for: "21455498")
for status in statuses {
    if case .verified(let renewalInfo) = status.renewalInfo {
        print(status.state, renewalInfo.willAutoRenew)   // .subscribed, .inGracePeriod, .expired, ...
    }
}
```

---

## 56.8 Introductory, Promotional, and Win-Back Offers 🟡

Offers are **discounts** for different moments in a subscriber's life:

| Offer | For | Set up |
|---|---|---|
| **Introductory** | **New** subscribers to the group (once per group) | App Store Connect |
| **Promotional** | **Existing** or **past** subscribers you choose | App Store Connect + a **signature** from your server |
| **Win-back** (iOS 18) | Subscribers who **left** | App Store Connect; the App Store can show them too |
| **Offer codes** | Anyone with a **code** (campaigns, support) | App Store Connect; redeem in the app or the App Store |

Show an **introductory** offer only to **eligible** users:

```swift
func introText(for product: Product) async -> String? {
    guard let subscription = product.subscription,
          let offer = subscription.introductoryOffer,
          await subscription.isEligibleForIntroOffer else { return nil }

    switch offer.paymentMode {
    case .freeTrial:
        return "\(offer.period.value) \(offer.period.unit) free, then \(product.displayPrice)"
    case .payAsYouGo, .payUpFront:
        return "\(offer.displayPrice) to start, then \(product.displayPrice)"
    default:
        return nil
    }
}
```

**Promotional** offers need a **signature** made on **your server** with your In-App Purchase **private key**. Why? The **app** asks for this discount, and Apple must know **you** really approved it, not a hacked app:

```swift
// The server returns: keyID, nonce, timestamp, signature for this user and offer
let signed = try await api.signPromotionalOffer(productID: product.id, offerID: "comeback50")

let result = try await product.purchase(options: [
    .promotionalOffer(offerID: "comeback50",
                      keyID: signed.keyID,
                      nonce: signed.nonce,
                      signature: signed.signature,
                      timestamp: signed.timestamp)
])
```

Let users **redeem offer codes** inside the app:

```swift
.offerCodeRedemption(isPresented: $showRedeem)
```

Each offer fits a **different** goal: intro offers lower the bar for a **first** try; win-back offers bring back people who **already know** the app.

---

## 56.9 Server Notifications V2 🔴

If you have a **backend**, it needs to know about renewals, cancellations, billing problems, and refunds, even when the user's **app never runs** (uninstalled, or the phone is off). **App Store Server Notifications V2** sends these events **to your server**.

You set the server URL in App Store Connect. Apple **POSTs** a body like this:

```json
{ "signedPayload": "eyJhbGciOiJFUzI1NiIsIng1YyI6..." }
```

The `signedPayload` is a **JWS** (a signed JSON token). After **verifying** its signature, the decoded content looks like:

```json
{
  "notificationType": "DID_RENEW",
  "subtype": "BILLING_RECOVERY",
  "data": {
    "bundleId": "com.example.recipes",
    "environment": "Production",
    "signedTransactionInfo": "<JWS: the transaction>",
    "signedRenewalInfo": "<JWS: renewal info>"
  }
}
```

Common types:

| `notificationType` | Meaning |
|---|---|
| `SUBSCRIBED` | A new subscription (or resubscribe) |
| `DID_RENEW` | Renewed successfully |
| `DID_FAIL_TO_RENEW` | Billing problem (may be in a **grace period**) |
| `DID_CHANGE_RENEWAL_STATUS` | The user turned **auto-renew** on or off |
| `EXPIRED` | Access ended |
| `REFUND` | Apple refunded it: **remove** access |

The server:

1. **verifies** the JWS signature (Apple's **App Store Server Library** does this, 56.10),
2. finds the user through **`appAccountToken`** (56.3) or the `originalTransactionId`,
3. **updates** its own subscription record.

Notifications can be **missed** (your server was down). Use the **App Store Server API** (for example, "Get All Subscription Statuses") to **re-check** a user's state when in doubt.

---

## 56.10 Server-Side Receipt Validation 🔴

On-device verification (56.5) protects the **app**. But if your **server** grants value (coins stored on the server, premium API access), the server must **not** trust "the app says they paid". It verifies the purchase **itself**.

**1. The app sends the signed transaction** to your backend:

```swift
case .success(let verification):
    let jws = verification.jwsRepresentation              // Apple-signed transaction, as a string
    try await api.confirmPurchase(jws: jws)               // the server checks it, then grants value
    let transaction = try checkVerified(verification)
    await transaction.finish()
```

**2. The server verifies it** with Apple's **App Store Server Library** (available for Swift, Java, Python, and Node):

```
1. Verify the JWS signature chain up to Apple's root certificate
2. Check bundleId, environment (Production vs. Sandbox), and productId
3. Check the transactionId isn't already used (no double-granting)
4. Grant the value and store the transaction in your database
```

| | Old way | StoreKit 2 way |
|---|---|---|
| What the app sends | The whole app **receipt** file | One signed **transaction** (JWS) |
| How the server checks | Calls Apple's **`verifyReceipt`** endpoint | Verifies the **signature** itself, or calls the App Store Server API |
| Status | **Deprecated** | Recommended |

For **consumables** stored on a server (coins), this is **required**: otherwise a faked request could add coins for free.

---

## 56.11 Restoring Purchases 🟢

With StoreKit 2, purchases usually appear **automatically** on a new device: `Transaction.currentEntitlements` (56.4) already includes them. Still, apps need a visible **"Restore Purchases"** button. App Review **expects** it, and it helps in rare cases where the local data is out of date:

```swift
extension Store {
    func restorePurchases() async {
        do {
            try await AppStore.sync()                   // may ask the user to sign in
            await updateEntitlements()                  // then re-check what they own
        } catch {
            showMessage("Couldn't restore purchases. Please try again.")
        }
    }
}
```

- Call **`AppStore.sync()`** **only** when the user **taps** the button. It can show an **Apple Account sign-in** prompt, which is confusing if it appears on its own.
- **Consumables** can't be restored by StoreKit (they're used up). If they matter, store the balance on **your server**.
- `SubscriptionStoreView` can show a restore button for you: `.storeButton(.visible, for: .restorePurchases)` (56.6).

---

## 56.12 Refund Requests and Consumption 🟡

**Apple** handles refunds, not you. But you can open the refund request sheet **inside** your app, which is friendlier than sending users to a website:

```swift
// SwiftUI
.refundRequestSheet(for: transactionID, isPresented: $showRefund) { result in
    // .success(.success): the request was submitted (not yet approved!)
}

// UIKit
let status = try await transaction.beginRefundRequest(in: windowScene)
```

The **decision** is Apple's, and it comes **later**. When a refund is approved:

- on the device, the transaction gets a **`revocationDate`**, and it arrives through `Transaction.updates` (56.4): **remove** the access;
- your server gets a **`REFUND`** notification (56.9).

**Consumption information** (for consumables and some other products): when a customer asks for a refund, Apple can send your server a **`CONSUMPTION_REQUEST`** notification. Your server may reply (within **12 hours**) using the App Store Server API's **Send Consumption Information** endpoint, with facts like "how much of the purchase was **used**" and "was the content **delivered**". Apple **considers** this, but still decides.

So the app's role is **limited**: open the sheet, give context when asked, and **react** to the result. That's very different from a normal payment provider, where your own server issues refunds.

---

## 56.13 Testing with .storekit Configuration Files 🟢

A **StoreKit configuration file** lets you test purchases **locally**: no App Store Connect setup, no network, no real money.

```
1. File ▸ New ▸ File ▸ StoreKit Configuration File
   (or "Sync this file with an app in App Store Connect" to copy your real products)
2. Add products, subscription groups, prices, and offers
3. Edit Scheme ▸ Run ▸ Options ▸ StoreKit Configuration: choose the file
4. Run: Product.products(for:) and purchase() now use the local file
```

Then use **Debug ▸ StoreKit ▸ Manage Transactions** in Xcode to **refund** a purchase, **approve** an Ask to Buy request, **expire** a subscription, or **speed up** renewals. You can also simulate **errors** and **billing problems** from the file's editor.

The same file powers **automated tests** with **`SKTestSession`**:

```swift
import Testing
import StoreKitTest
@testable import RecipeApp

@Test @MainActor
func buyingProUnlocksProFeatures() async throws {
    let session = try SKTestSession(configurationFileNamed: "Products")
    session.resetToDefaultState()
    session.clearTransactions()
    session.disableDialogs = true                          // no purchase sheet in tests

    let store = Store()
    try await session.buyProduct(identifier: ProductID.pro)
    await store.updateEntitlements()

    #expect(store.isPro)
}
```

⚠️ Local transactions are signed by **Xcode**, not by Apple. On-device verification **passes** (Xcode's certificate is trusted for testing), but your **server** won't accept them. Use **sandbox** (56.14) to test the server side.

---

## 56.14 Sandbox Testing and Common Purchase Bugs 🟡

The **sandbox** is Apple's **test store**: real App Store Connect products, fake money. Create **sandbox accounts** in App Store Connect ▸ **Users and Access** ▸ **Sandbox**, then sign in on the device under **Settings ▸ Developer ▸ Sandbox Apple Account**. TestFlight builds also use the sandbox.

Subscriptions **renew much faster** in the sandbox, so you can test renewals and expiry in minutes:

| Real length | Sandbox renewal (default) |
|---|---|
| 1 week | ~3 minutes |
| 1 month | ~5 minutes |
| 1 year | ~1 hour |

(You can change the renewal rate per sandbox account.)

Common purchase bugs, and how to avoid them:

| Bug | What happens | Fix |
|---|---|---|
| Never calling `finish()` | The same transaction is delivered **again and again** | Finish **after** delivering content (56.3) |
| Listening to `Transaction.updates` too **late** | Ask to Buy approvals and renewals that arrive at launch are **missed** | Start the listener **first thing** at launch (56.4) |
| Granting access **before** verification | Faked transactions unlock content: a **security hole** | Always `checkVerified` first (56.5) |
| Ignoring `.pending` | The UI looks **stuck** | Show "waiting for approval" (56.3) |
| Showing an error on `.userCancelled` | Users are told something "failed" | Treat cancel as **normal** |
| Hard-coded prices | Wrong price in other countries | Use `displayPrice` (56.2) |
| Not handling refunds | Users keep access after a refund | Check `revocationDate` (56.4, 56.12) |
| Testing only one **successful** purchase | Real-world failures break in production | Test cancel, network loss, Ask to Buy, refunds, expiry |

The happy path is the **easy** part. A correct implementation is one that stays right through **renewals**, **failures**, **other devices**, and **refunds**.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Product types | Consumable, non-consumable, subscriptions | Decide who tracks what the user owns |
| Loading products | `Product.products(for:)`, `displayPrice` | Localized product data in one async call |
| Buying | `product.purchase()`, `PurchaseResult` | Success, cancel, or pending; finish after delivery |
| Entitlements | `Transaction.updates`, `currentEntitlements` | Listen from launch; re-check what the user owns |
| Verification | `VerificationResult`, `checkVerified` | Never grant access on unverified data |
| Ready-made paywalls | `SubscriptionStoreView`, `ProductView`, `StoreView` | Standard purchase UI with little code |
| Subscription groups | Levels, `manageSubscriptionsSheet` | One active level; StoreKit handles switching |
| Offers | Intro, promotional (signed), win-back, offer codes | Discounts for each stage of the subscriber's life |
| Server events | App Store Server Notifications V2 | Renewals, cancellations, refunds on your server |
| Server validation | `jwsRepresentation`, App Store Server Library | The server verifies before it grants value |
| Restore | `AppStore.sync()` | A user-triggered safety net |
| Refunds | `refundRequestSheet`, `revocationDate`, consumption info | Apple decides; the app reacts |
| Local testing | `.storekit` files, `SKTestSession` | Fast, offline purchase testing |
| Sandbox | Sandbox accounts, fast renewals | Realistic end-to-end testing, including the server |
