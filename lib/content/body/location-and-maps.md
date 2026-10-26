**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Location is one of the most **private** things an app can ask for. This section covers **Core Location** (permissions, accuracy, live updates, geofences, background tracking) and **MapKit** (maps in SwiftUI, pins, overlays, the camera, search, directions, Look Around, and turning addresses into coordinates and back).

---

## 54.1 Location Permission Types and the Prompt Flow 🟢

There are **two** levels of location permission:

| Level | Location available | Info.plist key |
|---|---|---|
| **When In Use** | While the app is **in use** (on screen, or just after) | `NSLocationWhenInUseUsageDescription` |
| **Always** | Also in the **background**, and can **relaunch** the app | `NSLocationAlwaysAndWhenInUseUsageDescription` |

The user also has choices of their own: **Allow Once** (When In Use, for this session only), **Don't Allow**, and turning **Precise** location off (54.3). Without the usage-description key (49.3), the request **does nothing**.

Request **When In Use** first, at the moment the user does something that needs it ("Find restaurants near me"):

```swift
import CoreLocation

@MainActor
final class LocationPermission: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    var onChange: ((CLAuthorizationStatus) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
    }

    func request() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()     // shows the prompt (only once!)
        case .denied, .restricted:
            showOpenSettingsHint()                      // only Settings can change it now
        default:
            break                                       // already allowed
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in onChange?(status) }
    }
}
```

From iOS 18, the simpler way is a **`CLServiceSession`**. Keep it alive while a feature needs location; it asks for permission when needed:

```swift
// While the "nearby" screen is open:
let session = CLServiceSession(authorization: .whenInUse)
// ... use CLLocationUpdate.liveUpdates() (54.2) ...
// Release it (set to nil) when done
```

**Always** is a **two-step** flow by design:

```
1. App asks for When In Use ──► user allows
2. Later, when a background feature is turned on, the app asks for Always
   ──► the system may show the upgrade prompt LATER, when the app
       actually uses location in the background ("Keep Only While Using"
       or "Change to Always Allow")
```

So users see the Always question **when the reason is clear**, not at first launch. Ask for Always **only** if a feature truly needs it (geofences, 54.4; significant changes, 54.5). Most apps never do.

---

## 54.2 CLLocationUpdate Async API 🟢

**`CLLocationUpdate.liveUpdates()`** (iOS 17) gives you locations as an **`AsyncSequence`** (21.2). No delegate needed:

```swift
import CoreLocation

func trackLocation() async throws {
    for try await update in CLLocationUpdate.liveUpdates() {
        if let location = update.location {
            print("Now at \(location.coordinate), ±\(location.horizontalAccuracy) m")
        }
        if update.authorizationDenied {                     // iOS 18
            break                                           // the user said no: stop
        }
        if update.isStationary {
            // the device stopped moving; updates pause to save battery
        }
    }
}
```

To **stop**, leave the loop (`break`), or **cancel** the task that runs it. In SwiftUI, `.task` does that for you when the view goes away:

```swift
struct NearbyView: View {
    @State private var location: CLLocation?

    var body: some View {
        Text(location.map { "\($0.coordinate.latitude), \($0.coordinate.longitude)" } ?? "Locating…")
            .task {                                          // starts on appear, cancels on disappear
                do {
                    for try await update in CLLocationUpdate.liveUpdates() {
                        location = update.location
                    }
                } catch {
                    // location updates failed
                }
            }
    }
}
```

Pick a **configuration** that matches the activity. It helps the system filter and save power:

```swift
CLLocationUpdate.liveUpdates(.fitness)               // also: .automotiveNavigation, .otherNavigation, .airborne
```

| Old way | New way |
|---|---|
| A `CLLocationManager` + delegate object | One `for try await` loop |
| `startUpdatingLocation()` / `stopUpdatingLocation()` | Start the loop / leave it |
| Callbacks on some queue | Structured concurrency: cancels with the task |

Need only **one** location ("where am I now?")? Take the **first** good update and `break`.

---

## 54.3 Accuracy Authorization and Reduced Accuracy 🟡

Since iOS 14, the user can turn **Precise** location **off**. The app then gets **approximate** location: an area of a **few kilometers**, updated only a few times an hour. Enough for **weather** or "which city?", not for **turn-by-turn** directions.

Check it with **`accuracyAuthorization`**:

```swift
let manager = CLLocationManager()

switch manager.accuracyAuthorization {
case .fullAccuracy:    showExactPin()
case .reducedAccuracy: showApproximateArea()             // design for this case too!
@unknown default:      showApproximateArea()
}
```

When a **specific** feature really needs precision, ask for it **just for now**:

```swift
func startDeliveryTracking() async {
    if manager.accuracyAuthorization == .reducedAccuracy {
        try? await manager.requestTemporaryFullAccuracyAuthorization(
            withPurposeKey: "DeliveryTracking"              // a key in Info.plist (below)
        )
    }
    // continue; it may still be reduced if the user said no
}
```

The **purpose key** points to a sentence in **Info.plist**, shown in the prompt:

```xml
<key>NSLocationTemporaryUsageDescriptionDictionary</key>
<dict>
    <key>DeliveryTracking</key>
    <string>Precise location lets the driver find your door.</string>
</dict>
```

Precise access then lasts for **this session** only.

If your app **never** needs precision (a weather app), set **`NSLocationDefaultAccuracyReduced`** to `YES` in Info.plist. The prompt then offers **approximate** location by default. Users trust apps that ask for **less**.

---

## 54.4 Region Monitoring with CLMonitor 🟡

**Geofencing** means "tell me when the user **enters** or **leaves** a place", like a reminder when arriving at the grocery store. **`CLMonitor`** (iOS 17) does this with async events, and the **system** watches the regions, even when your app **isn't running**:

```swift
import CoreLocation

func startStoreMonitoring(storeCenter: CLLocationCoordinate2D) async {
    let monitor = await CLMonitor("StoreMonitor")              // a stable name

    let condition = CLMonitor.CircularGeographicCondition(center: storeCenter, radius: 150)
    await monitor.add(condition, identifier: "grocery-store", assuming: .unsatisfied)
}

func handleStoreEvents() async throws {
    let monitor = await CLMonitor("StoreMonitor")              // same name: same conditions

    for try await event in await monitor.events {
        switch event.state {
        case .satisfied:   remindShoppingList(for: event.identifier)   // entered
        case .unsatisfied: break                                       // left
        default:           break                                       // unknown, unmonitored
        }
    }
}
```

How it works:

- Conditions are **saved** by the system under the monitor's **name**. They survive app restarts.
- When an event happens and your app isn't running, the system **launches it in the background**. Re-create the monitor with the **same name** at launch, and start reading **`events`** right away, or you'll miss it.
- Background launches need **Always** permission (54.1).
- There's a limit of about **20** conditions per app. Monitor the **nearest** few places, and update the list as the user moves.
- Use a radius of at least **100–200 m**: geofences aren't precise.

It's the same async style as `CLLocationUpdate` (54.2), and it uses **no** extra battery from your app: the system does the watching.

---

## 54.5 Significant Location Change 🟡

**Significant-change** monitoring is the **low-power** way to follow a user over time. The system tells you only when the device has moved a **real distance** (about **500 meters** or more), and not more often than about every **5 minutes**:

```swift
final class TripLogger: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()

    func start() {
        manager.delegate = self
        manager.startMonitoringSignificantLocationChanges()     // needs Always for background use
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let latest = locations.last else { return }
        TripStore.shared.append(latest)                         // e.g. "arrived in a new city"
    }
}
```

Like geofences, it can **relaunch** your app in the background. Start monitoring again at launch to receive the event.

| Need | Use |
|---|---|
| Turn-by-turn, a running route | `liveUpdates()` (54.2): precise, more battery |
| "Arrived at the gym" | `CLMonitor` (54.4) |
| "Now in a new city", a rough travel log | **Significant change**: coarse, very low battery |
| "Spent time at a place" | Visit monitoring: `startMonitoringVisits()` |

Pick the **least** precise tool that does the job. Battery life is part of the user experience.

---

## 54.6 Background Location and the Blue Bar 🟡

To keep receiving **live** updates when the app goes to the background, add the **Location updates** background mode (Signing & Capabilities ▸ Background Modes):

```xml
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
</array>
```

Then, with **When In Use** permission, **start** the session in the **foreground** and tell the system it should continue (iOS 17):

```swift
final class RunTracker {
    private var backgroundSession: CLBackgroundActivitySession?
    private var trackingTask: Task<Void, Never>?

    func startRun() {                                   // called from a button, in the foreground
        backgroundSession = CLBackgroundActivitySession()
        trackingTask = Task {
            do {
                for try await update in CLLocationUpdate.liveUpdates(.fitness) {
                    if let location = update.location { RunStore.shared.add(location) }
                }
            } catch { }
        }
    }

    func stopRun() {
        trackingTask?.cancel()
        backgroundSession?.invalidate()                 // stop background location now
        backgroundSession = nil
    }
}
```

While this runs in the background, iOS shows a **blue indicator** (a pill around the clock or a blue status bar). The user can **tap** it to jump back to your app. Your app **can't** hide it.

| Permission | Background behavior |
|---|---|
| When In Use + background mode | Continues a session **started in the foreground**; **blue indicator** shown |
| Always | Can also get geofence and significant-change **launches** (54.4, 54.5) |

Why so visible? Background tracking is **very** sensitive. The indicator makes sure users always **know** which app follows them. A good app **stops** as soon as the feature ends (the run, the delivery), and the indicator goes away.

---

## 54.7 Map in SwiftUI with Annotations 🟢

SwiftUI's **`Map`** (iOS 17 API) takes a **builder**, like `List`. You put **markers** and **annotations** inside, with `ForEach` (26.2):

```swift
import SwiftUI
import MapKit

struct RestaurantMapView: View {
    let restaurants: [Restaurant]
    @State private var selection: Restaurant.ID?

    var body: some View {
        Map(selection: $selection) {
            UserAnnotation()                                    // the blue "you are here" dot

            ForEach(restaurants) { restaurant in
                Marker(restaurant.name, systemImage: "fork.knife",
                       coordinate: restaurant.coordinate)
                    .tint(.orange)
                    .tag(restaurant.id)                         // makes it selectable
            }
        }
        .mapControls {
            MapUserLocationButton()
            MapCompass()
            MapScaleView()
        }
        .safeAreaInset(edge: .bottom) {
            if let id = selection, let restaurant = restaurants.first(where: { $0.id == id }) {
                RestaurantCard(restaurant: restaurant)          // details for the selected pin
            }
        }
    }
}
```

**`Marker`** vs. **`Annotation`**:

| | `Marker` | `Annotation` |
|---|---|---|
| Looks like | The standard Maps **balloon** pin | **Any SwiftUI view** you want |
| Content | Title + SF Symbol, text, or monogram | Your own view |
| Best for | Many pins, standard look | Custom badges, prices, photos |

```swift
Annotation(restaurant.name, coordinate: restaurant.coordinate) {
    Text("$\(restaurant.averagePrice)")
        .font(.caption.bold())
        .padding(6)
        .background(.orange, in: .capsule)
        .foregroundStyle(.white)
}
```

Change the look of the map with **`.mapStyle`**:

```swift
.mapStyle(.standard(pointsOfInterest: .excludingAll))   // hide other businesses
.mapStyle(.imagery(elevation: .realistic))              // satellite, 3D
.mapStyle(.hybrid)                                      // satellite + labels
```

---

## 54.8 Map Overlays and Polylines 🟢

Besides points, a map can draw **lines** and **areas**:

```swift
Map {
    // A path: a route, a run, a delivery
    MapPolyline(coordinates: runCoordinates)
        .stroke(.blue, lineWidth: 5)

    // A round area: a delivery zone, a geofence (54.4)
    MapCircle(center: storeCenter, radius: 2000)
        .foregroundStyle(.orange.opacity(0.15))
        .stroke(.orange, lineWidth: 2)

    // Any shape: a park, a neighborhood
    MapPolygon(coordinates: parkCorners)
        .foregroundStyle(.green.opacity(0.2))

    Marker("Store", coordinate: storeCenter)
}
```

| Overlay | Draws |
|---|---|
| `MapPolyline` | A **line** through points, or an `MKRoute` (54.11) |
| `MapCircle` | A **circle**, with a radius in **meters** |
| `MapPolygon` | A filled **shape** from corner points |

Overlays and pins **mix freely** in the same `Map { }` builder. Draw the overlays **first** so the pins stay on top.

---

## 54.9 Map Camera Control and Positions 🟡

**`MapCameraPosition`** controls **what part** of the world the map shows. Bind it, like `.scrollPosition()` for a scroll view (26.16):

```swift
struct StoreMapView: View {
    let stores: [Store]
    @State private var position: MapCameraPosition = .automatic    // fit all content
    @State private var visibleRegion: MKCoordinateRegion?

    var body: some View {
        Map(position: $position) {
            ForEach(stores) { store in
                Marker(store.name, coordinate: store.coordinate)
            }
        }
        .onMapCameraChange(frequency: .onEnd) { context in
            visibleRegion = context.region                           // the user moved the map
        }
        .overlay(alignment: .top) {
            Button("Search This Area") {
                Task { await searchStores(in: visibleRegion) }
            }
            .buttonStyle(.borderedProminent)
            .padding()
        }
        .toolbar {
            Button("Me") {
                withAnimation { position = .userLocation(fallback: .automatic) }
            }
        }
    }
}
```

| Position | Shows |
|---|---|
| `.automatic` | Fits the map's **content** (all pins) |
| `.region(MKCoordinateRegion)` | A center + **size** in meters or degrees |
| `.item(MKMapItem)` | One place, nicely framed |
| `.camera(MapCamera)` | Full control: center, distance, **pitch** (tilt), **heading** |
| `.userLocation(fallback:)` | Follows the **user** |

To **move** the map, **set** the position (inside `withAnimation` for a smooth fly-over). To **know** where the user moved it, use **`onMapCameraChange`**. Note: after the user drags, the bound position becomes a "user-controlled" value; it doesn't tell you the region. That's why the `context` matters.

---

## 54.10 Search with MKLocalSearch 🟢

**`MKLocalSearch`** finds **places** from text: "coffee", "pizza", "Apple Park":

```swift
import MapKit

func searchNearby(_ query: String, in region: MKCoordinateRegion) async throws -> [MKMapItem] {
    let request = MKLocalSearch.Request()
    request.naturalLanguageQuery = query
    request.region = region                                 // prefer results near here
    request.resultTypes = .pointOfInterest                  // businesses, not addresses
    request.pointOfInterestFilter = MKPointOfInterestFilter(including: [.restaurant, .cafe])

    let response = try await MKLocalSearch(request: request).start()
    return response.mapItems
}
```

- **`region`** **biases** results toward an area. It doesn't strictly **limit** them.
- Each **`MKMapItem`** has a **name**, a location, a phone number, a website URL, a category, and more. Show it in a list, then as a `Marker` (54.7): `Marker(item: mapItem)` works directly.

For **search-as-you-type** suggestions, use **`MKLocalSearchCompleter`**. It's made for that, and it's cheap:

```swift
@Observable
final class PlaceSuggestions: NSObject, MKLocalSearchCompleterDelegate {
    var results: [MKLocalSearchCompletion] = []
    private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.pointOfInterest, .address]
    }

    func update(text: String) { completer.queryFragment = text }    // call on every keystroke

    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        results = completer.results                                // "Blue Bottle Coffee, Oakland"
    }
}

// When the user taps a suggestion, get the full place:
// let response = try await MKLocalSearch(request: .init(completion: suggestion)).start()
```

---

## 54.11 Directions and Routing 🟡

**`MKDirections`** calculates a **route** between two places:

```swift
import MapKit

func walkingRoute(to destination: MKMapItem) async throws -> MKRoute? {
    let request = MKDirections.Request()
    request.source = .forCurrentLocation()                  // from the user's location
    request.destination = destination                       // e.g. a search result (54.10)
    request.transportType = .walking
    request.requestsAlternateRoutes = true

    let response = try await MKDirections(request: request).calculate()
    return response.routes.first                            // routes are sorted, best first
}
```

An **`MKRoute`** gives you **two** different things:

| Property | Use |
|---|---|
| **`polyline`** | The **shape** of the route: draw it with `MapPolyline(route)` (54.8) |
| **`steps`** | **Text** instructions: "Turn right onto Main St", each with a distance |
| `expectedTravelTime`, `distance` | "12 min · 900 m" |

```swift
Map {
    if let route {
        MapPolyline(route).stroke(.blue, lineWidth: 6)
    }
}

List(route?.steps ?? [], id: \.self) { step in
    if !step.instructions.isEmpty {
        Text(step.instructions)
    }
}
```

**`transportType`** really changes the route: walking can use **paths** and **stairs** that cars can't; driving uses **roads** and one-way rules. For **public transit**, `MKDirections` can give an **ETA** (`calculateETA()`), but not a full drawable route.

For real **turn-by-turn** navigation, don't build your own: hand off to **Apple Maps**:

```swift
destination.openInMaps(launchOptions: [
    MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeWalking
])
```

---

## 54.12 Look Around Scenes 🟡

**Look Around** is Apple Maps' **street-level** 360° imagery. You can show it inside your app:

```swift
import SwiftUI
import MapKit

struct StoreLookAroundView: View {
    let coordinate: CLLocationCoordinate2D
    @State private var scene: MKLookAroundScene?
    @State private var isLoading = true

    var body: some View {
        Group {
            if let scene {
                LookAroundPreview(initialScene: scene)        // tap to open full screen
                    .frame(height: 200)
                    .clipShape(.rect(cornerRadius: 12))
            } else if !isLoading {
                ContentUnavailableView("No street view here", systemImage: "eye.slash")
            } else {
                ProgressView()
            }
        }
        .task {
            isLoading = true
            scene = try? await MKLookAroundSceneRequest(coordinate: coordinate).scene
            isLoading = false
        }
    }
}
```

**`MKLookAroundSceneRequest`** first checks if **coverage exists** at that spot. Many places have **none**, so `scene` can be **`nil`**: always handle that case (here, with `ContentUnavailableView`). Only show the Look Around UI when there's a scene.

---

## 54.13 Geocoding and Reverse Geocoding 🟢

| | Input | Output | Example |
|---|---|---|---|
| **Geocoding** | An **address** (text) | **Coordinates** | A typed address → a pin on the map |
| **Reverse geocoding** | **Coordinates** | An **address** / place name | GPS position → "123 Main St" |

The long-supported API is **`CLGeocoder`**:

```swift
import CoreLocation

func coordinate(for address: String) async throws -> CLLocationCoordinate2D? {
    let placemarks = try await CLGeocoder().geocodeAddressString(address)
    return placemarks.first?.location?.coordinate
}

func streetName(at coordinate: CLLocationCoordinate2D) async throws -> String? {
    let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
    let placemarks = try await CLGeocoder().reverseGeocodeLocation(location)
    guard let place = placemarks.first else { return nil }
    return [place.thoroughfare, place.locality].compactMap { $0 }.joined(separator: ", ")
}
```

iOS 26 moves this into **MapKit**, with **`MKGeocodingRequest`** and **`MKReverseGeocodingRequest`**. They return `MKMapItem`s, and `CLGeocoder` is deprecated there:

```swift
// iOS 26+ (check the documentation for details)
if let request = MKReverseGeocodingRequest(location: location) {
    let items = try await request.mapItems
    let address = items.first?.address?.shortAddress       // e.g. "123 Main St, Springfield"
}
```

Rules for both:

- Geocoding uses Apple's **servers**, and it's **rate-limited**. Don't geocode a **list** of 500 addresses in a loop. Geocode **once**, then **store** the coordinates.
- Results can be **wrong** or **empty** for unclear addresses. Show the pin and let the user **confirm**.
- Use reverse geocoding for **display** ("You're near Main St"), not to identify a **precise** spot.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Permission | When In Use, Always, `CLServiceSession` | Ask for the least, at the right moment |
| Live location | `CLLocationUpdate.liveUpdates()` | A `for try await` stream; stop by leaving the loop |
| Precision | `accuracyAuthorization`, temporary full accuracy | Work with approximate; upgrade only when needed |
| Geofences | `CLMonitor`, `CircularGeographicCondition` | Enter/exit events, even when the app isn't running |
| Low-power tracking | Significant changes, visits | Rough movement for very little battery |
| Background location | `location` mode, `CLBackgroundActivitySession` | Continue a session; the blue indicator stays visible |
| Maps | `Map`, `Marker`, `Annotation`, `UserAnnotation` | Declarative maps with standard or custom pins |
| Overlays | `MapPolyline`, `MapCircle`, `MapPolygon` | Routes and areas |
| Camera | `MapCameraPosition`, `onMapCameraChange` | Move the map; know where the user moved it |
| Place search | `MKLocalSearch`, `MKLocalSearchCompleter` | Search by text; suggestions while typing |
| Directions | `MKDirections`, `MKRoute`, `openInMaps` | Route shape + steps; hand off for navigation |
| Look Around | `MKLookAroundSceneRequest`, `LookAroundPreview` | Street-level views, when coverage exists |
| Addresses | `CLGeocoder`, `MKGeocodingRequest` (iOS 26) | Address ↔ coordinates; cache the results |
