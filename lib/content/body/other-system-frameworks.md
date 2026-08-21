## 57.1 HealthKit: Authorization and Reading Data

HealthKit centralizes a user's health and fitness data under explicit, per-data-type user authorization — an app must request access to specific data types (like heart rate or step count) individually, and users can grant read access, write access, or neither for each type independently.

```swift
import HealthKit

let healthStore = HKHealthStore()

func requestAuthorization() async throws {
    let stepType = HKQuantityType(.stepCount)
    let heartRateType = HKQuantityType(.heartRate)
    try await healthStore.requestAuthorization(toShare: [], read: [stepType, heartRateType])
}

func fetchStepCount() async throws -> HKStatisticsCollection {
    let stepType = HKQuantityType(.stepCount)
    let predicate = HKQuery.predicateForSamples(withStart: .now.addingTimeInterval(-86400), end: .now)
    let query = HKStatisticsCollectionQueryDescriptor(
        predicate: HKSamplePredicate.quantitySample(type: stepType, predicate: predicate),
        options: .cumulativeSum,
        anchorDate: .now,
        intervalComponents: DateComponents(day: 1)
    )
    return try await query.result(for: healthStore)
}
```

HealthKit's per-type, per-direction (read vs. write) authorization granularity is deliberately fine-grained — a user might reasonably grant an app permission to read step count while denying access to more sensitive data like reproductive health records, and critically, an app cannot even determine whether *read* authorization was denied (as opposed to granted) for privacy reasons, meaning apps must design their UI to gracefully handle the case of simply receiving no data rather than an explicit denial signal.

---

## 57.2 HealthKit: Writing Data and Workouts

Writing health data requires explicit write authorization and uses `HKQuantitySample` (or specialized types) for simple data points, while `HKWorkoutBuilder` handles the more involved process of recording a complete workout session with associated samples (heart rate, distance, energy burned) over its duration.

```swift
func saveWorkout(start: Date, end: Date) async throws {
    let configuration = HKWorkoutConfiguration()
    configuration.activityType = .running

    let builder = HKWorkoutBuilder(healthStore: healthStore, configuration: configuration, device: .local())
    try await builder.beginCollection(at: start)
    // ... add samples via builder.addSamples(...) during the workout ...
    try await builder.endCollection(at: end)
    _ = try await builder.finishWorkout()
}
```

`HKWorkoutBuilder`'s begin/add/end collection lifecycle mirrors a workout's own real-time structure — samples are added incrementally as the workout progresses (heart rate readings, distance updates) rather than all being known upfront, which is fundamentally different from writing a single retrospective data point like a one-off body weight entry, reflecting workouts' nature as an extended, evolving activity rather than an instantaneous measurement.

---

## 57.3 EventKit: Calendar and Reminders

EventKit provides access to the user's calendar events and reminders through `EKEventStore`, requiring explicit authorization (separate for calendar full access, calendar write-only access, and reminders) before an app can read or create entries.

```swift
import EventKit

let eventStore = EKEventStore()

func addCalendarEvent(title: String, start: Date, end: Date) async throws {
    try await eventStore.requestFullAccessToEvents()
    let event = EKEvent(eventStore: eventStore)
    event.title = title
    event.startDate = start
    event.endDate = end
    event.calendar = eventStore.defaultCalendarForNewEvents
    try eventStore.save(event, span: .thisEvent)
}
```

The distinction between full calendar access and write-only access exists for a similar privacy-minimization reason as HealthKit's granular read/write split (57.1) — an app that only ever needs to add events (like a "add to calendar" button for an event listing) can request write-only access, letting it create entries without ever being able to read the user's existing, potentially sensitive calendar contents.

---

## 57.4 Contacts Framework

The Contacts framework (`CNContactStore`) provides access to the user's address book, with fetches built around explicitly requested "keys to fetch" — an app must specify exactly which contact properties (name, phone numbers, email) it needs, rather than receiving entire contact records by default.

```swift
import Contacts

func fetchContacts() throws -> [CNContact] {
    let store = CNContactStore()
    let keysToFetch: [CNKeyDescriptor] = [
        CNContactGivenNameKey as CNKeyDescriptor,
        CNContactPhoneNumbersKey as CNKeyDescriptor
    ]
    let request = CNContactFetchRequest(keysToFetch: keysToFetch)
    var contacts: [CNContact] = []
    try store.enumerateContacts(with: request) { contact, _ in
        contacts.append(contact)
    }
    return contacts
}
```

Requiring explicit keys-to-fetch is a deliberate performance and privacy design choice — fetching only the specific properties actually needed avoids the overhead of loading a contact's full record (which can include a photo, notes, and many other fields) when, say, only a name and phone number are actually required, while also limiting incidental exposure to contact data an app has no genuine need to see.

---

## 57.5 Core Motion and Device Sensors

Core Motion provides access to the device's motion sensors — accelerometer, gyroscope, magnetometer, and derived data like device motion (attitude, rotation rate) and pedometer step counts — through `CMMotionManager` for raw sensor streams and `CMPedometer` for step-related data.

```swift
import CoreMotion

let motionManager = CMMotionManager()

func startDeviceMotionUpdates() {
    guard motionManager.isDeviceMotionAvailable else { return }
    motionManager.deviceMotionUpdateInterval = 1.0 / 60.0
    motionManager.startDeviceMotionUpdates(to: .main) { motion, error in
        guard let motion else { return }
        let pitch = motion.attitude.pitch
        // use pitch, roll, yaw, or motion.userAcceleration
    }
}
```

`deviceMotionUpdateInterval` directly controls the sensor data's sampling rate, and this is a genuine trade-off, not a free parameter — a higher rate (like 60Hz) provides smoother, more responsive data appropriate for something like a real-time game control scheme, but also consumes meaningfully more battery and CPU than a lower rate appropriate for something like periodic activity classification, making the right interval dependent on the specific feature's actual responsiveness requirements.

---

## 57.6 Core Bluetooth: Central Role

Core Bluetooth's central role lets an app scan for, connect to, and interact with nearby Bluetooth Low Energy (BLE) peripherals (like a heart rate monitor or a smart lock) — `CBCentralManager` handles scanning and connection, while `CBPeripheral` exposes the connected device's services and characteristics.

```swift
import CoreBluetooth

class BLECentral: NSObject, CBCentralManagerDelegate {
    var centralManager: CBCentralManager!

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            central.scanForPeripherals(withServices: [CBUUID(string: "180D")], options: nil)
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        central.stopScan()
        central.connect(peripheral, options: nil)
    }
}
```

Scanning specifically filtered by service UUID (like `180D`, the standard Bluetooth SIG-defined Heart Rate service) rather than scanning for all nearby devices indiscriminately is both a performance best practice (reducing unnecessary discovery callbacks and battery drain) and often a practical necessity, since many real-world BLE environments have numerous unrelated devices advertising nearby that an app has no reason to discover or connect to.

---

## 57.7 Core Bluetooth: Peripheral Role 🔴

The peripheral role inverts Core Bluetooth's usual direction — instead of connecting to other devices, an app itself advertises services and characteristics via `CBPeripheralManager`, becoming discoverable and connectable by other BLE central devices, appropriate for apps that need to act as the "server" side of a BLE interaction.

```swift
class BLEPeripheral: NSObject, CBPeripheralManagerDelegate {
    var peripheralManager: CBPeripheralManager!

    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        guard peripheral.state == .poweredOn else { return }
        let characteristic = CBMutableCharacteristic(type: CBUUID(string: "FFF1"), properties: .read, value: nil, permissions: .readable)
        let service = CBMutableService(type: CBUUID(string: "FFF0"), primary: true)
        service.characteristics = [characteristic]
        peripheralManager.add(service)
        peripheralManager.startAdvertising([CBAdvertisingServiceUUIDsKey: [service.uuid]])
    }
}
```

The peripheral role is meaningfully rarer in typical app development than the central role — most apps consume data from external BLE hardware (fitness trackers, beacons) rather than acting as a BLE server themselves — but it's the right model for scenarios like two iPhones communicating directly peer-to-peer, or a companion device acting as a sensor/data source for other nearby central devices to discover and connect to.

---

## 57.8 AccessorySetupKit

`AccessorySetupKit` streamlines pairing with supported Bluetooth/Wi-Fi accessories through a standardized, privacy-preserving system picker UI — replacing older, more manual Bluetooth pairing flows with a consistent presentation that also avoids requiring broad Bluetooth permission just to discover and pair with one specific, known accessory.

```swift
import AccessorySetupKit

func presentAccessoryPicker() async throws {
    let descriptor = ASPickerDisplayItem(
        name: "My Smart Device",
        productImage: UIImage(named: "device")!,
        descriptor: .bluetooth(companyIdentifier: 0x004C, serviceUUID: CBUUID(string: "180D"))
    )
    let session = ASAccessorySession()
    try await session.showPicker(for: [descriptor])
}
```

This mirrors the same privacy-minimization design pattern seen in `PHPickerViewController` (section 55.1) — the system-owned picker handles discovery and pairing itself, and the app only learns about the specific accessory the user actually selected, rather than requiring broad, standing Bluetooth scanning permission just to support pairing with one particular known device type.

---

## 57.9 Core NFC and Tag Reading

Core NFC lets an app read (and, for writable tag types, write) NFC tags — `NFCTagReaderSession` or the simpler `NFCNDEFReaderSession` present a system scanning sheet, detect a nearby tag, and deliver its contents, appropriate for use cases like scanning a product tag or a physical access badge.

```swift
import CoreNFC

class NFCReader: NSObject, NFCNDEFReaderSessionDelegate {
    func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
        for message in messages {
            for record in message.records {
                let payload = String(data: record.payload, encoding: .utf8)
                // use the decoded tag payload
            }
        }
    }

    func startScanning() {
        let session = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateMessageOnConnection: true)
        session.begin()
    }
}
```

NFC scanning always presents a system-owned sheet during the scan (never a silent, background read) — this is a deliberate design choice ensuring the user is always aware their device is actively scanning for and reading a physical tag, consistent with the broader platform pattern of surfacing sensitive or unusual data access (like camera or microphone use) through visible, user-aware system UI rather than allowing it silently in the background.

---

## 57.10 PassKit and Apple Pay

PassKit's Apple Pay integration lets an app request payment through the user's stored payment cards via `PKPaymentAuthorizationController`, presenting Apple's standardized, trusted payment sheet — the app itself never sees the user's actual card number, only an encrypted payment token to forward to a payment processor.

```swift
import PassKit

func requestApplePay(amount: Decimal) {
    let request = PKPaymentRequest()
    request.merchantIdentifier = "merchant.com.example.app"
    request.supportedNetworks = [.visa, .masterCard, .amex]
    request.merchantCapabilities = .threeDSecure
    request.countryCode = "US"
    request.currencyCode = "USD"
    request.paymentSummaryItems = [PKPaymentSummaryItem(label: "Total", amount: amount as NSDecimalNumber)]

    let controller = PKPaymentAuthorizationController(paymentRequest: request)
    controller.present { presented in
        // handle presentation result
    }
}
```

The app never directly handling the user's actual card number is a core security property of Apple Pay's design — the payment sheet generates an encrypted, single-use payment token that the app forwards to its payment processor, meaning a compromised app could never leak raw card data it never had access to in the first place, a meaningfully stronger security posture than an app implementing its own card-entry payment form.

---

## 57.11 Wallet Passes

Wallet passes (`.pkpass` files, built from a JSON pass definition and cryptographically signed) let an app issue boarding passes, event tickets, loyalty cards, or coupons that live in the system Wallet app, with support for relevant-location and relevant-time notifications and, for supported pass types, real-time updates pushed from a server.

```plaintext
A .pkpass is a signed ZIP archive containing pass.json plus images.
pass.json (conceptually):
{
  "formatVersion": 1,
  "passTypeIdentifier": "pass.com.example.loyalty",
  "teamIdentifier": "ABCDE12345",
  "relevantDate": "2026-09-01T09:00:00Z",
  "locations": [{ "latitude": 37.3349, "longitude": -122.0090 }],
  "storeCard": { "primaryFields": [...] }
}
PKAddPassesViewController presents the pass for the user to add to Wallet.
```

Wallet passes' relevant-location and relevant-time metadata is what enables their most distinctive feature — a boarding pass automatically surfacing on the Lock Screen when the user arrives at the airport, or a loyalty card appearing when near the associated store — turning a static digital card into something contextually proactive, closely paralleling the location-based context-awareness themes from region monitoring (section 54.4).

---

## 57.12 CarPlay App Templates 🔴

CarPlay apps don't render arbitrary custom UI — instead, they're built from a constrained set of system-provided templates (list templates, grid templates, map templates, now-playing templates) that CarPlay itself renders, ensuring a consistent, driving-safe interface across all CarPlay apps regardless of vendor.

```swift
import CarPlay

func buildListTemplate() -> CPListTemplate {
    let item = CPListItem(text: "Nearby Coffee Shops", detailText: "3 results")
    let section = CPListSection(items: [item])
    return CPListTemplate(title: "Places", sections: [section])
}
```

This template-only constraint exists specifically for driving safety — CarPlay deliberately does not allow the freeform custom UI a regular iOS app can build, since an inconsistent, potentially distracting custom interface would be genuinely dangerous in a driving context, so every CarPlay app instead composes its experience from the same limited set of system-rendered templates, trading customization for guaranteed consistency and safety.

---

## 57.13 Screen Time APIs: FamilyControls and ManagedSettings 🔴

`FamilyControls` and `ManagedSettings` let an app (typically a parental-control app, with explicit Family Controls authorization) restrict or monitor another family member's device usage — selecting specific apps/categories to limit and applying shields that block access, all without the controlling app ever seeing which specific apps the restricted user actually has installed.

```swift
import FamilyControls
import ManagedSettings

func requestAuthorization() async throws {
    try await AuthorizationCenter.shared.requestAuthorization(for: .child)
}

func applyShield(to selection: FamilyActivitySelection) {
    let store = ManagedSettingsStore()
    store.shield.applications = selection.applicationTokens
    store.shield.applicationCategories = .specific(selection.applicationCategories)
}
```

The privacy design here is genuinely notable — `FamilyActivitySelection` represents chosen apps/categories as opaque, anonymized tokens rather than actual bundle identifiers, meaning the parental-control app applying restrictions never actually learns the specific identity of the apps it's restricting, only that "these tokens, selected by the parent through a system picker" should be shielded, a careful balance between enabling genuine parental control functionality and preserving the restricted user's own privacy.

---

## 57.14 Transferable and Drag and Drop

The `Transferable` protocol (also used for `PhotosPickerItem` loading in section 55.1) provides a unified way to describe how a type can be exported for drag-and-drop, copy/paste, or sharing — conforming a custom type to `Transferable` makes it usable across all of these interaction patterns with one shared implementation.

```swift
struct Recipe: Transferable, Codable {
    var name: String
    var ingredients: [String]

    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .recipeData)
    }
}

struct RecipeCardView: View {
    let recipe: Recipe
    var body: some View {
        Text(recipe.name)
            .draggable(recipe)
    }
}
```

Conforming to `Transferable` once and getting drag-and-drop, copy/paste, and `ShareLink` (recall section 26's list interaction patterns) support essentially for free is a meaningful reduction in boilerplate compared to implementing each interaction pattern's own separate serialization requirements individually — a single `transferRepresentation` describes how the type is encoded/decoded across all of these otherwise-distinct system interaction surfaces.

---

## 57.15 Translation Framework

The Translation framework provides on-device text translation directly within an app, via the `.translationPresentation` view modifier (a ready-made translation UI sheet) or the lower-level `TranslationSession` API for programmatic translation without any custom UI needed.

```swift
import Translation

struct TranslatableText: View {
    @State private var configuration: TranslationSession.Configuration?
    let text: String

    var body: some View {
        Text(text)
            .translationPresentation(isPresented: .constant(true), text: text)
    }
}
```

Because translation runs on-device (leveraging the same on-device language model infrastructure that also underlies Foundation Models, covered in section 58), an app gets genuine translation capability without needing to build or call out to any custom translation backend itself, and critically, without the user's text ever needing to leave the device to a third-party translation service — a meaningful privacy advantage for translating potentially sensitive user content.

---

## 57.16 App Attest and DeviceCheck 🔴

App Attest lets a server cryptographically verify that requests genuinely originate from an authentic, unmodified copy of the app running on genuine Apple hardware — generating a hardware-backed key and attestation that a server can validate, providing strong protection against automated abuse, tampered clients, and API scraping.

```swift
import DeviceCheck

func generateAttestation() async throws -> Data {
    let service = DCAppAttestService.shared
    guard service.isSupported else { throw AttestError.unsupported }
    let keyId = try await service.generateKey()
    let clientDataHash = Data(SHA256.hash(data: someRequestPayload))
    let attestation = try await service.attestKey(keyId, clientDataHash: clientDataHash)
    return attestation
}
```

App Attest's core value is defending server endpoints against a category of threat that's otherwise genuinely difficult to counter — a tampered or reverse-engineered client impersonating legitimate app traffic to abuse an API — by providing hardware-rooted proof of running on genuine, unmodified Apple hardware and software, which is a meaningfully stronger guarantee than any purely software-based integrity check (like an API key embedded in the app binary) could ever provide on its own.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Health data | `HKHealthStore`, `HKQuantityType` | Per-type authorized health/fitness data access |
| Workouts | `HKWorkoutBuilder` | Incremental, real-time workout session recording |
| Calendar/reminders | `EKEventStore` | Granular full vs. write-only calendar access |
| Contacts | `CNContactStore`, keys-to-fetch | Explicit, minimal-footprint contact property access |
| Motion sensors | `CMMotionManager`, `CMPedometer` | Raw and derived device motion/step data |
| BLE client | `CBCentralManager` | Scan, connect, and interact with peripherals |
| BLE server | `CBPeripheralManager` | Advertise services as a discoverable peripheral |
| Accessory pairing | `AccessorySetupKit` | Privacy-preserving, standardized accessory setup |
| Tag reading | `NFCNDEFReaderSession` | User-visible, system-sheet NFC scanning |
| Payments | `PKPaymentAuthorizationController` | Tokenized Apple Pay payment requests |
| Digital passes | `.pkpass`, Wallet | Location/time-aware boarding passes and loyalty cards |
| In-car UI | CarPlay templates | Safety-constrained, system-rendered driving UI |
| Parental controls | `FamilyControls`, `ManagedSettings` | Anonymized-token app restriction and shielding |
| Universal transfer | `Transferable` | One conformance for drag/drop, paste, and sharing |
| Translation | `TranslationSession`, `.translationPresentation` | On-device, private text translation |
| Integrity attestation | `DCAppAttestService` | Hardware-rooted proof of genuine app/device |
