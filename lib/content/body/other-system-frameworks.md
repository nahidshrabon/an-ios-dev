**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

iOS has many more frameworks than one app will ever use. This section is a **practical tour** of the ones you're most likely to meet: health, calendars, contacts, motion, Bluetooth, accessories, NFC, Apple Pay, Wallet, CarPlay, Screen Time, drag and drop, translation, and App Attest. Notice a **pattern** as you read: most of them protect privacy with **narrow permissions** or a **system picker** that shares only what the user chooses.

---

## 57.1 HealthKit: Authorization and Reading Data 🟡

**HealthKit** is the shared store behind the **Health** app. Your app asks for access **per data type**, and **separately** for **read** and **write**:

```swift
import HealthKit

let healthStore = HKHealthStore()

func requestHealthAccess() async throws {
    guard HKHealthStore.isHealthDataAvailable() else { return }   // false on some devices

    let read: Set<HKObjectType> = [HKQuantityType(.stepCount), HKQuantityType(.heartRate)]
    let write: Set<HKSampleType> = [HKQuantityType(.dietaryWater)]

    try await healthStore.requestAuthorization(toShare: write, read: read)
}
```

Setup: add the **HealthKit** capability, and the **`NSHealthShareUsageDescription`** (read) and **`NSHealthUpdateUsageDescription`** (write) keys to Info.plist. In SwiftUI, the **`.healthDataAccessRequest(...)`** modifier (iOS 17) does the same.

Read today's step count:

```swift
func stepsToday() async throws -> Double {
    let startOfDay = Calendar.current.startOfDay(for: .now)
    let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: .now)

    let descriptor = HKStatisticsQueryDescriptor(
        predicate: .quantitySample(type: HKQuantityType(.stepCount), predicate: predicate),
        options: .cumulativeSum                                  // add up, without double counting
    )
    let statistics = try await descriptor.result(for: healthStore)
    return statistics?.sumQuantity()?.doubleValue(for: .count()) ?? 0
}
```

Use **statistics** queries for totals. The iPhone **and** the Apple Watch both record steps; `.cumulativeSum` removes the **overlap**. Adding up raw samples yourself counts steps **twice**.

⚠️ The big HealthKit surprise: your app **can't tell** whether the user **denied read** access. A denied read looks exactly like "**no data**". Even knowing "the user refused to share pregnancy data" would reveal something private. So design for **empty results**: show "No step data yet" with a hint to check **Settings ▸ Health**, never "You denied access".

(`authorizationStatus(for:)` only tells you about **write** access.)

---

## 57.2 HealthKit: Writing Data and Workouts 🟡

A **single** value is one **sample**:

```swift
func logWater(milliliters: Double) async throws {
    let sample = HKQuantitySample(
        type: HKQuantityType(.dietaryWater),
        quantity: HKQuantity(unit: .literUnit(with: .milli), doubleValue: milliliters),
        start: .now,
        end: .now
    )
    try await healthStore.save(sample)
}
```

A **workout** is different: it has a **start**, an **end**, and many samples **in between** (energy, distance, heart rate). **`HKWorkoutBuilder`** follows that shape:

```swift
func saveCookingClassWorkout(start: Date, end: Date, kilocalories: Double) async throws {
    let configuration = HKWorkoutConfiguration()
    configuration.activityType = .mixedCardio

    let builder = HKWorkoutBuilder(healthStore: healthStore,
                                   configuration: configuration,
                                   device: .local())

    try await builder.beginCollection(at: start)                     // 1. begin

    let energy = HKQuantitySample(                                    // 2. add samples
        type: HKQuantityType(.activeEnergyBurned),
        quantity: HKQuantity(unit: .kilocalorie(), doubleValue: kilocalories),
        start: start, end: end
    )
    try await builder.addSamples([energy])

    try await builder.endCollection(at: end)                         // 3. end
    _ = try await builder.finishWorkout()                            // 4. save the workout
}
```

| Data | Shape | API |
|---|---|---|
| Weight, water, a blood pressure reading | **One** moment | `HKQuantitySample` + `save` |
| A run, a swim, a class | A **time span** with many samples | `HKWorkoutBuilder` (begin → add → end → finish) |

On **Apple Watch**, live workouts use **`HKWorkoutSession`** with **`HKLiveWorkoutBuilder`**, which collect heart rate and energy **automatically** from the sensors while the workout runs.

---

## 57.3 EventKit: Calendar and Reminders 🟢

**EventKit** reads and writes **calendar events** and **reminders** through **`EKEventStore`**. Since iOS 17, there are **three** access levels:

| Access | Lets you | Info.plist key |
|---|---|---|
| **None needed** | Show the system's **"Add Event" screen** (`EKEventEditViewController`) | — |
| **Write-only** | **Add** events, but **not read** any | `NSCalendarsWriteOnlyAccessUsageDescription` |
| **Full access** | Read, edit, and delete events | `NSCalendarsFullAccessUsageDescription` |

Most apps only need "**Add to Calendar**". Ask for **write-only**:

```swift
import EventKit

let eventStore = EKEventStore()

func addCookingClass(title: String, start: Date, end: Date) async throws {
    guard try await eventStore.requestWriteOnlyAccessToEvents() else {
        throw CalendarError.denied
    }

    let event = EKEvent(eventStore: eventStore)
    event.title = title
    event.startDate = start
    event.endDate = end
    event.calendar = eventStore.defaultCalendarForNewEvents
    event.addAlarm(EKAlarm(relativeOffset: -3600))             // remind 1 hour before

    try eventStore.save(event, span: .thisEvent)
}
```

Even better: show **`EKEventEditViewController`** (from EventKitUI) with the event filled in. It runs **outside** your app, so since iOS 17 it needs **no permission at all**, and the user can change the details before saving.

Only a **calendar app** (or a scheduling tool) needs **full** access: `requestFullAccessToEvents()`. **Reminders** have their own request: `requestFullAccessToReminders()`.

Write-only access means your app can add the event without ever seeing the user's **other** appointments: doctor visits, interviews, private meetings.

---

## 57.4 Contacts Framework 🟢

The **Contacts** framework reads the address book with **`CNContactStore`**. You must list the **exact properties** ("keys") you want:

```swift
import Contacts

func fetchNamesAndPhones() async throws -> [CNContact] {
    let store = CNContactStore()
    guard try await store.requestAccess(for: .contacts) else { return [] }   // NSContactsUsageDescription

    let keys: [CNKeyDescriptor] = [
        CNContactFormatter.descriptorForRequiredKeys(for: .fullName),   // everything a name needs
        CNContactPhoneNumbersKey as CNKeyDescriptor
    ]
    let request = CNContactFetchRequest(keysToFetch: keys)

    // enumerateContacts is slow and synchronous: run it off the main thread
    return try await Task.detached {
        var contacts: [CNContact] = []
        try store.enumerateContacts(with: request) { contact, _ in
            contacts.append(contact)
        }
        return contacts
    }.value
}
```

Why keys? **Speed** and **privacy**. A contact can hold a photo, notes, addresses, birthdays, relations. Loading all of that for 2,000 contacts when you only need **names** is slow, and it's data you **shouldn't** touch.

⚠️ Reading a property you **didn't** fetch (for example `contact.emailAddresses` above) **crashes** with `CNPropertyNotFetchedException`.

Lighter options, often better:

| Need | Use | Permission |
|---|---|---|
| The user picks **one** contact | `CNContactPickerViewController` | **None** (system picker) |
| The user shares **some** contacts | iOS 18 **limited access**, `ContactAccessButton` | Limited |
| Your app needs the **whole** address book | `CNContactStore` | Full |

---

## 57.5 Core Motion and Device Sensors 🟢

**Core Motion** reads the motion sensors: accelerometer, gyroscope, magnetometer. **Device motion** combines them into clean values like **attitude** (tilt) and **user acceleration**:

```swift
import CoreMotion

final class TiltReader {
    private let motionManager = CMMotionManager()
    private let queue = OperationQueue()                     // not main: high rates are a lot of calls

    func start(onTilt: @escaping @Sendable (Double) -> Void) {
        guard motionManager.isDeviceMotionAvailable else { return }   // false in the Simulator

        motionManager.deviceMotionUpdateInterval = 1.0 / 30.0         // 30 updates per second
        motionManager.startDeviceMotionUpdates(to: queue) { motion, _ in
            guard let motion else { return }
            onTilt(motion.attitude.pitch)                             // radians
        }
    }

    func stop() {
        motionManager.stopDeviceMotionUpdates()                       // always stop when done
    }
}
```

**`deviceMotionUpdateInterval`** is a real **trade-off**: a faster rate means smoother data, and more **battery** and **CPU**:

| Feature | Rate |
|---|---|
| A tilt-to-steer **game** | 60 Hz |
| A "hold the phone level" indicator | 10–30 Hz |
| Detecting a **shake** | ~20 Hz |

For **activity** data, use the higher-level classes (they need **`NSMotionUsageDescription`**):

```swift
let pedometer = CMPedometer()
pedometer.startUpdates(from: .now) { data, _ in
    let steps = data?.numberOfSteps.intValue ?? 0           // steps since start
}

let activityManager = CMMotionActivityManager()
activityManager.startActivityUpdates(to: .main) { activity in
    if activity?.walking == true { /* "walking to the store" */ }
}
```

These use a **low-power** motion chip, so they're cheap to run.

---

## 57.6 Core Bluetooth: Central Role 🟡

In Bluetooth Low Energy (**BLE**), the **central** is the side that **scans** and **connects** (your app); the **peripheral** is the **device** (a heart rate strap, a kitchen scale). A peripheral has **services**, and each service has **characteristics** (values you can read, write, or subscribe to).

```
Your app (central) ──scan──► Heart rate strap (peripheral)
                    ──connect──►
                    ──discover──► Service 180D (Heart Rate)
                                     └─ Characteristic 2A37 (Measurement) ──notify──► BPM values
```

The full flow, as delegate callbacks (Info.plist: **`NSBluetoothAlwaysUsageDescription`**):

```swift
import CoreBluetooth

final class HeartRateMonitor: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private var central: CBCentralManager!
    private var heartRateStrap: CBPeripheral?                 // ⚠️ keep a strong reference!
    private let heartRateService = CBUUID(string: "180D")
    private let measurement = CBUUID(string: "2A37")

    var onHeartRate: ((Int) -> Void)?

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: nil)    // triggers the permission prompt
    }

    // 1. Bluetooth is ready → scan ONLY for heart rate devices
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard central.state == .poweredOn else { return }
        central.scanForPeripherals(withServices: [heartRateService])
    }

    // 2. Found one → stop scanning, keep it, connect
    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        central.stopScan()
        heartRateStrap = peripheral
        central.connect(peripheral)
    }

    // 3. Connected → find the service
    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.delegate = self
        peripheral.discoverServices([heartRateService])
    }

    // 4. Service found → find the characteristic
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let service = peripheral.services?.first else { return }
        peripheral.discoverCharacteristics([measurement], for: service)
    }

    // 5. Characteristic found → subscribe to updates
    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard let characteristic = service.characteristics?.first else { return }
        peripheral.setNotifyValue(true, for: characteristic)
    }

    // 6. New value → decode it
    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard let bytes = characteristic.value.map(Array.init), bytes.count >= 2 else { return }
        let isUInt16 = bytes[0] & 0x01 != 0                  // flag bit: 8-bit or 16-bit value
        if isUInt16 && bytes.count < 3 { return }
        let bpm = isUInt16 ? Int(bytes[1]) | Int(bytes[2]) << 8 : Int(bytes[1])
        onHeartRate?(bpm)
    }
}
```

Why scan **by service UUID** (`180D` is the standard Heart Rate service)? There may be **dozens** of BLE devices nearby: headphones, TVs, other phones. Filtering saves **battery**, avoids pointless callbacks, and is **required** for scanning in the **background**.

⚠️ The classic bug: not storing the **`CBPeripheral`**. If nothing holds it, it's **released**, and the connection silently never happens.

---

## 57.7 Core Bluetooth: Peripheral Role 🔴

The **peripheral** role flips the direction: **your app** advertises services, and **other** devices connect to **it**. Use **`CBPeripheralManager`**:

```swift
import CoreBluetooth

final class RecipeBeacon: NSObject, CBPeripheralManagerDelegate {
    private var manager: CBPeripheralManager!
    private let serviceID = CBUUID(string: "8E6A2C10-7F31-4B8E-9C2D-5A1F3E4B6C70")   // your own UUID
    private let stepID = CBUUID(string: "8E6A2C11-7F31-4B8E-9C2D-5A1F3E4B6C70")
    private var stepCharacteristic: CBMutableCharacteristic!

    override init() {
        super.init()
        manager = CBPeripheralManager(delegate: self, queue: nil)
    }

    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        guard peripheral.state == .poweredOn else { return }

        stepCharacteristic = CBMutableCharacteristic(
            type: stepID,
            properties: [.read, .notify],                    // readable, and subscribable
            value: nil,                                      // nil = value changes; answer on request
            permissions: .readable
        )
        let service = CBMutableService(type: serviceID, primary: true)
        service.characteristics = [stepCharacteristic]

        peripheral.add(service)
        peripheral.startAdvertising([CBAdvertisementDataServiceUUIDsKey: [serviceID]])
    }

    // A central reads the value
    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
        request.value = Data("Step 3".utf8)
        peripheral.respond(to: request, withResult: .success)
    }

    // Push a new value to subscribed centrals
    func publish(step: String) {
        manager.updateValue(Data(step.utf8), for: stepCharacteristic, onSubscribedCentrals: nil)
    }
}
```

| | Central (57.6) | Peripheral |
|---|---|---|
| Role | **Client**: scans and connects | **Server**: advertises and answers |
| Class | `CBCentralManager` | `CBPeripheralManager` |
| Common in apps | **Very** common (wearables, scales, locks) | **Rare** |

Use the peripheral role when the **phone** is the data source: two iPhones talking **directly**, or the phone feeding a nearby device. Use **custom 128-bit UUIDs** for your own services (short ones like `180D` are reserved for standard services). Advertising in the **background** is limited: the system may drop your local name and move service UUIDs to a special area that only iOS scanners see.

---

## 57.8 AccessorySetupKit 🟡

**AccessorySetupKit** (iOS 18) gives your accessory a **system pairing card**, like AirPods get. The system **finds** the device and asks the user; your app only learns about **that one** accessory. No general Bluetooth permission prompt is needed.

```swift
import AccessorySetupKit
import CoreBluetooth

final class ScaleSetup {
    private let session = ASAccessorySession()

    func start() {
        session.activate(on: .main) { [weak self] event in
            switch event.eventType {
            case .accessoryAdded:
                guard let id = event.accessory?.bluetoothIdentifier else { return }
                // Save the ID, then connect with Core Bluetooth (57.6)
                self?.connect(to: id)
            default:
                break
            }
        }
    }

    func showPicker() {
        let descriptor = ASDiscoveryDescriptor()
        descriptor.bluetoothServiceUUID = CBUUID(string: "8E6A2C10-7F31-4B8E-9C2D-5A1F3E4B6C70")

        let item = ASPickerDisplayItem(
            name: "Smart Kitchen Scale",
            productImage: UIImage(named: "scale")!,
            descriptor: descriptor
        )
        session.showPicker(for: [item]) { error in
            if let error { print("Picker failed: \(error)") }
        }
    }
}
```

You also declare the supported accessory types and Bluetooth services in **Info.plist** (`NSAccessorySetupKitSupports`, `NSAccessorySetupBluetoothServices`). ⚠️ Check the documentation for the exact keys your accessory needs.

It's the **same idea** as `PhotosPicker` (55.1): a **system-owned picker** does the discovery, and the app gets **only** what the user chose. Before, an app needed **Bluetooth** permission (and could see **every** nearby device) just to pair **one** known product.

---

## 57.9 Core NFC and Tag Reading 🟡

**Core NFC** reads **NFC tags**: stickers on products, museum labels, access badges. Setup: the **Near Field Communication Tag Reading** capability and **`NFCReaderUsageDescription`** in Info.plist.

```swift
import CoreNFC

final class TagReader: NSObject, NFCNDEFReaderSessionDelegate {
    private var session: NFCNDEFReaderSession?                 // keep it alive while scanning
    var onURL: ((URL) -> Void)?

    func scan() {
        guard NFCNDEFReaderSession.readingAvailable else { return }    // not on iPad, not in Simulator
        session = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: true)
        session?.alertMessage = "Hold your iPhone near the recipe card."
        session?.begin()                                        // shows the system scan sheet
    }

    func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
        for record in messages.flatMap(\.records) {
            if let url = record.wellKnownTypeURIPayload() {                    // a URL record
                DispatchQueue.main.async { self.onURL?(url) }
            } else {
                let (text, _) = record.wellKnownTypeTextPayload()             // a text record
                print(text ?? "Unknown record")
            }
        }
    }

    // Required: called when the session ends (success, timeout, or user cancel)
    func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        self.session = nil
    }
}
```

Use the **`wellKnownType…Payload()`** helpers. NDEF text and URL records have **header bytes**, so decoding `record.payload` as plain UTF-8 gives broken text.

In-app reading **always** shows the **system sheet**. The user always **knows** the phone is scanning; an app can't read tags **silently**. (Newer iPhones also have **background tag reading**, but it only handles **URL** tags: it shows a **notification**, and opening it launches the matching app through a universal link, 49.6.)

---

## 57.10 PassKit and Apple Pay 🟡

**Apple Pay** pays for **physical** goods and services (food, tickets, rides). Digital content uses in-app purchase (56.1).

Setup: a **Merchant ID**, a payment processing **certificate** (usually from your payment provider, like Stripe or Adyen), and the **Apple Pay** capability.

```swift
import PassKit

final class CheckoutController: NSObject, PKPaymentAuthorizationControllerDelegate {
    func pay(total: Decimal) {
        let request = PKPaymentRequest()
        request.merchantIdentifier = "merchant.com.example.recipes"
        request.supportedNetworks = [.visa, .masterCard, .amex]
        request.merchantCapabilities = .threeDSecure
        request.countryCode = "US"
        request.currencyCode = "USD"
        request.paymentSummaryItems = [
            PKPaymentSummaryItem(label: "Cooking Kit", amount: NSDecimalNumber(decimal: total)),
            PKPaymentSummaryItem(label: "Recipe Shop", amount: NSDecimalNumber(decimal: total))  // last = total, your name
        ]

        let controller = PKPaymentAuthorizationController(paymentRequest: request)
        controller.delegate = self
        controller.present()
    }

    // The user approved with Face ID: send the token to your server
    func paymentAuthorizationController(_ controller: PKPaymentAuthorizationController,
                                        didAuthorizePayment payment: PKPayment,
                                        handler completion: @escaping (PKPaymentAuthorizationResult) -> Void) {
        Task {
            let charged = (try? await api.charge(token: payment.token.paymentData)) ?? false
            completion(PKPaymentAuthorizationResult(status: charged ? .success : .failure, errors: nil))
        }
    }

    func paymentAuthorizationControllerDidFinish(_ controller: PKPaymentAuthorizationController) {
        controller.dismiss()
    }
}
```

In SwiftUI, use the standard **`PayWithApplePayButton`**. Show it only when `PKPaymentAuthorizationController.canMakePayments(usingNetworks:)` is true.

Why it's **safer** than your own card form: the app **never sees a card number**. It gets an **encrypted token** that only the payment processor can use. A hacked app or a leaked database can't expose cards it **never had**. And for the user it's faster: no typing, Face ID, done.

---

## 57.11 Wallet Passes 🟡

**Wallet passes** are boarding passes, tickets, loyalty cards, and coupons in the **Wallet** app. A pass is a **`.pkpass`** file: a **signed ZIP** with a `pass.json` and images. Your **server** builds and signs it with a **Pass Type ID** certificate.

```json
{
  "formatVersion": 1,
  "passTypeIdentifier": "pass.com.example.recipes.class",
  "serialNumber": "CLASS-2026-0042",
  "teamIdentifier": "ABCDE12345",
  "organizationName": "Recipe School",
  "description": "Pasta Masterclass ticket",
  "relevantDate": "2026-09-01T18:00:00Z",
  "locations": [{ "latitude": 37.3349, "longitude": -122.0090 }],
  "barcodes": [{ "format": "PKBarcodeFormatQR", "message": "CLASS-2026-0042",
                 "messageEncoding": "iso-8859-1" }],
  "eventTicket": {
    "primaryFields": [{ "key": "event", "label": "CLASS", "value": "Pasta Masterclass" }]
  }
}
```

The app downloads the file and offers it to the user:

```swift
import PassKit
import SwiftUI

struct TicketView: View {
    let passData: Data
    @State private var pass: PKPass?

    var body: some View {
        if let pass {
            AddPassToWalletButton([pass]) { added in
                // added == true: it's in Wallet now
            }
            .frame(height: 50)
        } else {
            ProgressView().task { pass = try? PKPass(data: passData) }
        }
    }
}
```

The **relevance** data (`relevantDate`, `locations`) is what makes passes **smart**: the system can show the ticket on the **Lock Screen** near the **time** or **place** it's needed. You don't write any location code; Wallet handles it, much like the system handles geofences (54.4).

Passes can also **update**: your server registers a **web service**, sends a **push**, and Wallet downloads the new version (a new gate, a changed seat).

---

## 57.12 CarPlay App Templates 🔴

CarPlay apps **don't draw their own UI**. They pick from **system templates** (lists, grids, tabs, maps, Now Playing), and CarPlay draws them. Only certain app **categories** may use CarPlay (audio, communication, navigation, EV charging, parking, quick food ordering, and a few more), and you need a **CarPlay entitlement** from Apple.

CarPlay is a separate **scene** in your app:

```swift
import CarPlay

final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    private var interfaceController: CPInterfaceController?

    func templateApplicationScene(_ scene: CPTemplateApplicationScene,
                                  didConnect interfaceController: CPInterfaceController) {
        self.interfaceController = interfaceController

        let items = RecipeAudioLibrary.shared.recent.map { recipe in
            let item = CPListItem(text: recipe.title, detailText: "\(recipe.minutes) min · audio steps")
            item.handler = { _, completion in
                AudioPlayer.shared.playSteps(for: recipe)              // then CarPlay shows Now Playing
                completion()
            }
            return item
        }

        let list = CPListTemplate(title: "Recipes", sections: [CPListSection(items: items)])
        interfaceController.setRootTemplate(list, animated: true, completion: nil)
    }

    func templateApplicationScene(_ scene: CPTemplateApplicationScene,
                                  didDisconnectInterfaceController interfaceController: CPInterfaceController) {
        self.interfaceController = nil
    }
}
```

You register this scene in Info.plist with the role **`CPTemplateApplicationSceneSessionRoleApplication`**. Test it with the **CarPlay Simulator** (from Xcode's additional tools) or the iOS Simulator's **I/O ▸ External Displays ▸ CarPlay**.

The trade-off:

| You give up | You get |
|---|---|
| Custom design, custom layouts | **Safe**, familiar UI the driver can use at a glance |
| Deep navigation | Limits on list size and depth (fewer taps while driving) |
| Your brand's look | Automatic support for **every** car screen size and input (touch, knobs) |

The rules are about **driver safety**: a custom, busy UI is dangerous at 100 km/h.

---

## 57.13 Screen Time APIs: FamilyControls and ManagedSettings 🔴

The **Screen Time** APIs let parental-control and "digital wellbeing" apps **limit** app use. You need the **Family Controls** entitlement (Apple must approve it for App Store distribution).

| Framework | Job |
|---|---|
| **FamilyControls** | Authorization + the **picker** to choose apps |
| **ManagedSettings** | Apply **restrictions** ("shields") |
| **DeviceActivity** | **Schedules** and usage thresholds, in an extension |

```swift
import SwiftUI
import FamilyControls
import ManagedSettings

struct LimitAppsView: View {
    @State private var selection = FamilyActivitySelection()
    @State private var showPicker = false
    private let store = ManagedSettingsStore()

    var body: some View {
        Button("Choose Apps to Limit") { showPicker = true }
            .familyActivityPicker(isPresented: $showPicker, selection: $selection)
            .onChange(of: selection) { _, newSelection in
                store.shield.applications = newSelection.applicationTokens
                store.shield.applicationCategories = .specific(newSelection.categoryTokens)
            }
            .task {
                // .child: a parent managing a child's device (Family Sharing)
                // .individual: a user limiting their OWN apps
                try? await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            }
    }
}
```

The **privacy design** is the interesting part. The picker returns **opaque tokens**, not app names or bundle IDs. Your app can **block** "token A", but it **never learns** that token A is a dating app. You can even **show** the selected apps with `Label(token)`: the **system** draws the name and icon; your code never sees them.

So a parental-control app can work fully **without** learning which apps someone uses. Control **and** privacy, both at once.

---

## 57.14 Transferable and Drag and Drop 🟢

**`Transferable`** (also used to load picker items, 55.1) describes how a type **leaves** your app or **arrives**: drag and drop, copy and paste, and sharing. Conform **once**, use it **everywhere**:

```swift
import SwiftUI
import UniformTypeIdentifiers

extension UTType {
    static let recipe = UTType(exportedAs: "com.example.recipes.recipe")   // declare it in Info.plist (34.5)
}

struct Recipe: Codable, Transferable {
    var name: String
    var ingredients: [String]

    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .recipe)        // full data, for apps that understand it
        ProxyRepresentation(exporting: \.name)             // plain-text fallback for everyone else
    }
}
```

Representations are tried **in order**: the **richest** first, then **fallbacks**. Drop a recipe into **your** app and it arrives as a full `Recipe`; drop it into **Notes** and it arrives as the **name**.

Now every interaction works with the **same** type:

```swift
// Drag
RecipeCard(recipe: recipe)
    .draggable(recipe)

// Drop
MealPlanDay()
    .dropDestination(for: Recipe.self) { recipes, location in
        plan.add(recipes)
        return true
    }

// Share
ShareLink(item: recipe, preview: SharePreview(recipe.name))

// Paste
PasteButton(payloadType: Recipe.self) { recipes in
    plan.add(recipes)
}
```

| Representation | Use for |
|---|---|
| `CodableRepresentation` | Your own `Codable` types |
| `DataRepresentation` | Custom binary formats |
| `FileRepresentation` | Large data as **files** (videos, documents) |
| `ProxyRepresentation` | "Treat me as another `Transferable`" (a `String`, a `URL`) |

---

## 57.15 Translation Framework 🟢

The **Translation** framework translates text **on the device**, using the same models as Apple's **Translate** app.

The simplest way is the **system translation sheet** (iOS 17.4):

```swift
import SwiftUI
import Translation

struct ReviewView: View {
    let review: String                                 // e.g. a recipe review in Italian
    @State private var showTranslation = false

    var body: some View {
        Text(review)
            .toolbar {
                Button("Translate", systemImage: "translate") { showTranslation = true }
            }
            .translationPresentation(isPresented: $showTranslation, text: review)
    }
}
```

To translate **in code** and show the result in **your own** UI, use a **`TranslationSession`** (iOS 18):

```swift
struct TranslatedReview: View {
    let review: String
    @State private var translated: String?
    @State private var configuration: TranslationSession.Configuration?

    var body: some View {
        Text(translated ?? review)
            .onAppear {
                configuration = .init(target: Locale.Language(identifier: "en"))   // source: auto-detect
            }
            .translationTask(configuration) { session in
                translated = try? await session.translate(review).targetText
            }
    }
}
```

The language **models** are downloaded on demand. The system asks the user if one is missing. Check ahead with **`LanguageAvailability`**.

Because it runs **on the device**, the user's text **never leaves** the phone, and you don't need a translation **server** or API key. That matters for private content like messages or notes.

---

## 57.16 App Attest and DeviceCheck 🔴

**App Attest** helps your **server** check that a request comes from **your real app** on a **real Apple device**, not from a script, a modified app, or an emulator. It uses a **key** stored in the device's **Secure Enclave**.

```swift
import DeviceCheck
import CryptoKit

final class AppAttestClient {
    private let service = DCAppAttestService.shared

    // Once per install: create a key, and have Apple attest it
    func registerDevice() async throws {
        guard service.isSupported else { throw AttestError.unsupported }   // not in the Simulator

        let keyID = try await service.generateKey()
        let challenge = try await api.fetchChallenge()                     // a one-time value from YOUR server
        let hash = Data(SHA256.hash(data: challenge))

        let attestation = try await service.attestKey(keyID, clientDataHash: hash)
        try await api.registerAttestation(attestation, keyID: keyID)       // server verifies with Apple
        KeyStore.save(keyID)
    }

    // For each sensitive request: sign it with the attested key
    func signedRequest(body: Data) async throws -> (body: Data, assertion: Data) {
        guard let keyID = KeyStore.load() else { throw AttestError.notRegistered }
        let hash = Data(SHA256.hash(data: body))
        let assertion = try await service.generateAssertion(keyID, clientDataHash: hash)
        return (body, assertion)
    }
}
```

| Step | Who | What |
|---|---|---|
| 1. `generateKey` | App | A new key pair in the Secure Enclave (the private key **never** leaves it) |
| 2. `attestKey` | App + Apple | Apple **signs** a statement: "this key belongs to app X on a genuine device" |
| 3. Verify | Your **server** | Checks Apple's signature, the app ID, and the challenge; stores the public key |
| 4. `generateAssertion` | App, per request | Signs requests; the server checks them with the stored public key |

Why it beats an **API key** in the app: anyone can **extract** a key from an app binary and use it from a script. An App Attest key **can't** be copied out of the hardware, and Apple vouches for it.

It's **not** a complete defense: use it as **one strong signal**, together with rate limits and other checks. Roll it out **gradually** (Apple limits how fast attestations can be created).

The older **DeviceCheck** API (`DCDevice.current.generateToken()`) does something simpler: it lets your server store **two bits** per device, for example "this device already used its free trial", and they survive a reinstall.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Health data | `HKHealthStore`, statistics queries | Per-type access; denied reads look like no data |
| Workouts | `HKWorkoutBuilder` | Begin → add samples → end → finish |
| Calendar | `EKEventStore`, write-only access, `EKEventEditViewController` | Add events without reading the calendar |
| Contacts | `CNContactStore`, keys to fetch, contact picker | Fetch only what you need |
| Motion | `CMMotionManager`, `CMPedometer` | Sensor data at a chosen rate; low-power activity data |
| BLE central | `CBCentralManager`, `CBPeripheral` | Scan by service, connect, subscribe |
| BLE peripheral | `CBPeripheralManager` | Advertise and serve your own data |
| Accessory pairing | `AccessorySetupKit` | A system pairing card; no broad Bluetooth access |
| NFC | `NFCNDEFReaderSession` | Read tags, always with a visible system sheet |
| Apple Pay | `PKPaymentAuthorizationController` | Pay with a token; the app never sees the card |
| Wallet | `.pkpass`, `AddPassToWalletButton` | Tickets and cards that appear at the right time and place |
| CarPlay | `CPTemplateApplicationSceneDelegate`, templates | Safe, system-drawn in-car UI |
| Screen Time | FamilyControls, ManagedSettings | Restrict apps through opaque tokens |
| Transfer | `Transferable` | One type for drag, drop, paste, and share |
| Translation | `.translationPresentation`, `TranslationSession` | Private, on-device translation |
| App integrity | `DCAppAttestService`, DeviceCheck | Hardware-backed proof of a genuine app |
