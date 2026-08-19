## 54.1 Location Permission Types and the Prompt Flow

Location access has two distinct permission tiers — "When In Use" (location available only while the app is actively being used) and "Always" (location available even when backgrounded, subject to additional system scrutiny) — each requiring its own specific usage description string (recall `Info.plist` usage descriptions, section 49.3) and following a specific, system-enforced request flow.

```swift
import CoreLocation

let locationManager = CLLocationManager()

func requestLocationPermission() {
    locationManager.requestWhenInUseAuthorization()
    // "Always" access typically requires FIRST being granted "When In Use,"
    // then later requesting the upgrade via requestAlwaysAuthorization()
}
```

Apple deliberately makes "Always" authorization a two-step process in most flows — an app must first be granted "When In Use," and only later (ideally at a moment when the always-on need is contextually obvious to the user, like enabling a background delivery-tracking feature) can it request the upgrade to "Always," rather than being able to request the more expansive, more sensitive permission immediately at first launch; this staged approach exists specifically to prevent apps from over-requesting background location access before users understand why it's genuinely needed.

---

## 54.2 CLLocationUpdate Async API

`CLLocationUpdate.liveUpdates()` provides the modern, `AsyncSequence`-based way to receive a continuous stream of location updates — directly applying `AsyncSequence` iteration (section 21) to location tracking, replacing the older delegate-callback-based `CLLocationManagerDelegate` pattern for this specific use case.

```swift
func trackLocation() async throws {
    let updates = CLLocationUpdate.liveUpdates()
    for try await update in updates {
        if let location = update.location {
            print("Current location: \(location.coordinate)")
        }
        if update.authorizationDenied {
            break // stop iterating if permission was revoked mid-stream
        }
    }
}
```

This `for try await` pattern is a direct, welcome simplification over the older delegate-based approach (which required implementing `locationManager(_:didUpdateLocations:)` and managing a separate delegate object) — location updates now integrate naturally into structured concurrency, letting a `Task` simply iterate the stream and `break` out (cleanly canceling the underlying tracking) whenever the app no longer needs updates, consistent with the general shift toward `AsyncSequence`-based APIs seen throughout modern Apple frameworks (recall `URLSession.bytes`, section 39.12).

---

## 54.3 Accuracy Authorization and Reduced Accuracy

Beyond the When In Use/Always permission tiers, users can independently grant only "reduced accuracy" location — a coarser, roughly city-block-level location rather than precise GPS coordinates — and an app can request a temporary precise-accuracy upgrade for a specific purpose when genuinely needed.

```swift
func requestPreciseLocationIfNeeded() {
    guard locationManager.accuracyAuthorization == .reducedAccuracy else { return }
    locationManager.requestTemporaryFullAccuracyAuthorization(withPurposeKey: "PreciseDeliveryTracking")
}
```

`requestTemporaryFullAccuracyAuthorization(withPurposeKey:)` requires a corresponding purpose string declared in `Info.plist`, explaining to the user exactly why precise location is needed for this specific request — reflecting the same general privacy-transparency principle as ordinary usage description strings (54.1), but specifically for the more granular reduced-versus-full accuracy distinction, letting users default to coarser, more private location sharing while still allowing genuinely justified, purpose-specific upgrades to precise accuracy.

---

## 54.4 Region Monitoring with CLMonitor

`CLMonitor` (a more recent, `async`-native replacement for the older region-monitoring delegate callbacks) lets an app register geographic regions and receive notifications when the device enters or exits them, even while the app isn't actively running — the technical foundation behind geofencing features like location-based reminders.

```swift
func monitorGroceryStore(center: CLLocationCoordinate2D) async {
    let monitor = await CLMonitor("GroceryStoreMonitor")
    let condition = CLMonitor.CircularGeographicCondition(center: center, radius: 100)
    await monitor.add(condition, identifier: "grocery-store", assuming: .unsatisfied)

    for try? await event in await monitor.events {
        if event.identifier == "grocery-store" && event.state == .satisfied {
            // user has entered the region
        }
    }
}
```

Like `CLLocationUpdate` (54.2), `CLMonitor` embraces `AsyncSequence`-based iteration over the older delegate pattern — `await monitor.events` produces a continuous stream of region transition events the app can process with the same `for await` structured-concurrency pattern used throughout the rest of modern location APIs, while the underlying region monitoring itself continues to work even when the app isn't actively in the foreground, relying on system-level geofencing infrastructure rather than the app needing to continuously poll its own location.

---

## 54.5 Significant Location Change

Significant location change monitoring is a coarser, far more battery-efficient alternative to continuous location tracking — the system only delivers an update when the device has moved a meaningfully large distance (roughly, between cell tower handoffs), appropriate for apps needing general awareness of the user's location over time without the battery cost of continuous precise tracking.

```swift
locationManager.startMonitoringSignificantLocationChanges()
```

This is the correct tool for use cases like "notice roughly when the user has traveled to a new city" or "periodically check in on general location for a long-running background feature," where continuous, precise tracking would be significant battery overkill relative to the actual precision the feature needs — the trade-off for this battery efficiency is coarser, less frequent updates, making it inappropriate for anything requiring fine-grained, real-time positioning (like active turn-by-turn navigation), where `CLLocationUpdate.liveUpdates()` (54.2) remains the correct choice despite its higher battery cost.

---

## 54.6 Background Location and the Blue Bar

Continuing to receive location updates while an app is backgrounded requires both "Always" authorization (54.1) and the `location` background mode capability declared in Xcode — and the system displays a persistent, hard-to-miss blue status bar/indicator whenever an app is actively using location in the background, a deliberate, non-optional transparency measure users cannot disable.

```xml
<!-- Info.plist: declaring the background location capability -->
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
</array>
```

The blue indicator (and its associated banner, tappable to jump directly to the app actively using background location) is specifically designed to be impossible for the user to miss or silence — this is a deliberate design choice reflecting how much more sensitive background location tracking is compared to foreground-only access, ensuring users always have clear, ongoing visibility into which apps are tracking their location even when those apps aren't actively open and visible, a meaningful check against silent, unwanted background tracking.

---

## 54.7 Map in SwiftUI with Annotations

SwiftUI's `Map` view renders an interactive map directly within a SwiftUI view hierarchy, with `Annotation` (or `Marker`) placing custom or standard pins at specific coordinates.

```swift
import MapKit

struct RestaurantMapView: View {
    let restaurants: [Restaurant]

    var body: some View {
        Map {
            ForEach(restaurants) { restaurant in
                Annotation(restaurant.name, coordinate: restaurant.coordinate) {
                    Image(systemName: "fork.knife.circle.fill")
                        .foregroundStyle(.red)
                        .background(.white, in: .circle)
                }
            }
        }
    }
}
```

This declarative, `ForEach`-driven approach to placing annotations directly mirrors the same patterns from `List`/`ForEach` (section 26.2) — each `Restaurant`'s coordinate drives an `Annotation`'s placement, and `Annotation`'s trailing closure accepts arbitrary SwiftUI content (unlike the simpler, standard-pin-only `Marker`), letting a custom icon, label, or even a small interactive control be placed directly on the map at that specific location.

---

## 54.8 Map Overlays and Polylines

Beyond point annotations, `Map` supports overlay content like `MapPolyline` (drawing a route or path) and `MapCircle`/`MapPolygon` (highlighting a region), letting an app visualize richer geographic data than individual pins alone can express.

```swift
Map {
    MapPolyline(coordinates: routeCoordinates)
        .stroke(.blue, lineWidth: 4)

    MapCircle(center: deliveryZoneCenter, radius: 2000)
        .foregroundStyle(.blue.opacity(0.15))
        .stroke(.blue, lineWidth: 2)
}
```

`MapPolyline` is exactly the tool for visualizing a route (like a walking or driving path between two points, whether hand-computed or sourced from `MKDirections`, 54.11), and `MapCircle`/`MapPolygon` are well suited to visualizing regions (a delivery zone, a geofenced area from `CLMonitor`, 54.4) — these overlay types compose naturally within the same `Map { }` builder alongside `Annotation`s, letting a single map combine points of interest, a highlighted route, and a relevant boundary region all within one coherent view.

---

## 54.9 Map Camera Control and Positions

`MapCameraPosition` (bound to `Map`'s `position:` parameter) controls exactly what region/viewpoint the map currently displays, programmatically adjustable — the map equivalent of controlling a `ScrollView`'s scroll position (recall `scrollPosition`, section 26.16).

```swift
struct ControlledMapView: View {
    @State private var cameraPosition: MapCameraPosition = .automatic

    var body: some View {
        Map(position: $cameraPosition) {
            // annotations, overlays
        }
        .onAppear {
            withAnimation {
                cameraPosition = .region(MKCoordinateRegion(center: userLocation, latitudinalMeters: 1000, longitudinalMeters: 1000))
            }
        }
    }
}
```

`.automatic` lets the map choose a sensible default framing based on its content (like fitting all displayed annotations into view), while `.region()`, `.camera()` (for more precise control including pitch/heading), and `.userLocation()` (centering directly on the device's current position) provide explicit, programmatic control — binding `cameraPosition` as `@State` means the app can both read the map's current viewpoint (useful for "search this area" style features) and set it programmatically (like animating to a specific location when a search result is tapped).

---

## 54.10 Search with MKLocalSearch

`MKLocalSearch` performs a geographic search for places matching a text query (like "coffee shops" or a specific business name), returning `MKMapItem` results with location, name, and other point-of-interest metadata — the mapping equivalent of a text-based search API, but geographically aware.

```swift
func searchNearby(query: String, region: MKCoordinateRegion) async throws -> [MKMapItem] {
    let request = MKLocalSearch.Request()
    request.naturalLanguageQuery = query
    request.region = region

    let search = MKLocalSearch(request: request)
    let response = try await search.start()
    return response.mapItems
}
```

`request.region` biases (though doesn't strictly limit) results toward a specific geographic area, meaning a search for "pizza" run with a region centered on the user's current location returns geographically relevant results rather than pizza places anywhere in the world — each returned `MKMapItem` carries rich metadata (name, phone number, category, and its `MKPlacemark`/coordinate) suitable for both displaying as a search result and immediately plotting as a map annotation (54.7).

---

## 54.11 Directions and Routing

`MKDirections` computes an actual route (turn-by-turn steps, estimated travel time, and the route's geographic path) between two points, suitable for both displaying a route overlay (54.8) and presenting textual step-by-step directions.

```swift
func getDirections(from source: CLLocationCoordinate2D, to destination: CLLocationCoordinate2D) async throws -> MKRoute? {
    let request = MKDirections.Request()
    request.source = MKMapItem(placemark: MKPlacemark(coordinate: source))
    request.destination = MKMapItem(placemark: MKPlacemark(coordinate: destination))
    request.transportType = .walking

    let directions = MKDirections(request: request)
    let response = try await directions.calculate()
    return response.routes.first
}
```

The returned `MKRoute`'s `polyline` property provides exactly the coordinate data `MapPolyline` (54.8) needs to visually render the computed route on screen, while `route.steps` provides the individual turn-by-turn instructions (each with its own instruction text and distance) suitable for a textual directions list — `transportType` (`.walking`, `.automobile`, `.transit`) meaningfully changes both the computed route and its estimated travel time, since a walking route may reasonably take paths a driving route cannot (and vice versa).

---

## 54.12 Look Around Scenes 🟠

Look Around (Apple's street-level imagery feature, its counterpart to Google's Street View) can be embedded directly within an app via `LookAroundPreview`, showing an immersive, navigable street-level view of a specific location.

```swift
struct LocationLookAroundView: View {
    @State private var scene: MKLookAroundScene?
    let coordinate: CLLocationCoordinate2D

    var body: some View {
        LookAroundPreview(scene: $scene)
            .task {
                let request = MKLookAroundSceneRequest(coordinate: coordinate)
                scene = try? await request.scene
            }
    }
}
```

`MKLookAroundSceneRequest` asynchronously fetches whether Look Around imagery is even available for a given coordinate (not every location has coverage) and, if so, the actual scene data `LookAroundPreview` needs to render — this gives an app the same kind of immersive, "what does this place actually look like from the street" preview Apple Maps itself provides, directly embedded within a custom view rather than requiring the user to leave the app and open Maps separately.

---

## 54.13 Geocoding and Reverse Geocoding

Geocoding converts a human-readable address into geographic coordinates; reverse geocoding does the opposite, converting coordinates into a human-readable address/placemark — both handled via `CLGeocoder`.

```swift
func geocodeAddress(_ address: String) async throws -> CLLocationCoordinate2D? {
    let geocoder = CLGeocoder()
    let placemarks = try await geocoder.geocodeAddressString(address)
    return placemarks.first?.location?.coordinate
}

func reverseGeocode(_ coordinate: CLLocationCoordinate2D) async throws -> String? {
    let geocoder = CLGeocoder()
    let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
    let placemarks = try await geocoder.reverseGeocodeLocation(location)
    return placemarks.first?.name
}
```

Geocoding is the appropriate tool when an app has address text (from a user-entered form field, or an external data source that only provides addresses rather than coordinates) that needs to be plotted on a map or used for distance calculations; reverse geocoding is the appropriate tool for the opposite direction — converting a raw coordinate (like the device's current GPS location) into a human-readable street address or place name suitable for display, such as showing "123 Main St, Anytown" instead of raw latitude/longitude numbers in a UI.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Permission tiers | When In Use vs. Always | Staged, transparency-focused authorization flow |
| Modern location stream | `CLLocationUpdate.liveUpdates()` | `AsyncSequence`-based continuous location updates |
| Accuracy control | `accuracyAuthorization`, temporary full accuracy | Coarse-by-default, purpose-justified precise upgrades |
| Geofencing | `CLMonitor` | Async region enter/exit notifications |
| Battery-efficient tracking | Significant location change | Coarse, infrequent updates for general awareness |
| Background tracking transparency | `location` background mode, blue indicator | Non-optional, always-visible background tracking notice |
| Declarative mapping | `Map`, `Annotation`, `Marker` | SwiftUI-native map rendering with custom pins |
| Richer geographic visuals | `MapPolyline`, `MapCircle`/`MapPolygon` | Routes and region overlays |
| Programmatic viewpoint | `MapCameraPosition` | Read/set the map's current displayed region |
| Place search | `MKLocalSearch` | Geographically-aware text search for points of interest |
| Route computation | `MKDirections`, `MKRoute` | Turn-by-turn steps and route geometry |
| Street-level imagery | `LookAroundPreview`, `MKLookAroundSceneRequest` | Immersive, embedded street-level views |
| Address conversion | `CLGeocoder` | Address ↔ coordinate conversion in both directions |
