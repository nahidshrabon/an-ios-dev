## 64.1 RealityKit Entities and Components

RealityKit models a scene as a collection of `Entity` objects, each composed of `Component`s that attach specific data or behavior — a `ModelComponent` for visual geometry, a `PhysicsBodyComponent` for physics simulation, a `CollisionComponent` for hit-testing — following the Entity-Component-System (ECS) pattern rather than a traditional class-hierarchy-based scene graph.

```swift
import RealityKit

let entity = Entity()
entity.components.set(ModelComponent(mesh: .generateBox(size: 0.1), materials: [SimpleMaterial(color: .blue, isMetallic: false)]))
entity.components.set(CollisionComponent(shapes: [.generateBox(size: [0.1, 0.1, 0.1])]))
```

This component-based composition is a meaningfully different design from the inheritance-based scene graphs common in older 3D frameworks — rather than an entity's capabilities being determined by which class it inherits from, an entity's actual behavior and appearance emerge entirely from which components have been attached to it, letting the same generic `Entity` type represent a static decoration, a physics-simulated object, or an interactive, collidable object purely based on its component composition.

---

## 64.2 The ECS Model: Systems and Updates

Complementing entities and components, RealityKit `System`s implement the "S" in ECS — logic that runs each frame, querying for entities with a specific combination of components and updating them accordingly, keeping behavioral logic separate from the data components themselves.

```swift
struct RotationSystem: System {
    static let query = EntityQuery(where: .has(RotationComponent.self))

    func update(context: SceneUpdateContext) {
        for entity in context.entities(matching: Self.query, updatingSystemWhen: .rendering) {
            guard let rotation = entity.components[RotationComponent.self] else { continue }
            entity.transform.rotation *= simd_quatf(angle: rotation.speed, axis: [0, 1, 0])
        }
    }
}
```

This separation of data (components) from behavior (systems) is the defining characteristic of the ECS pattern — a `RotationComponent` itself holds no logic, just data describing how fast an entity should rotate, while a separate `RotationSystem` queries for all entities having that component and applies the actual rotation behavior each frame, a design that scales cleanly as scenes grow more complex, since new behaviors are added as new systems rather than requiring changes to entity class hierarchies.

---

## 64.3 RealityView in SwiftUI

`RealityView` is SwiftUI's native integration point for RealityKit content — a view that hosts a RealityKit scene directly within a SwiftUI view hierarchy, with a closure-based setup for adding initial content and an optional update closure for responding to SwiftUI state changes.

```swift
struct ARSceneView: View {
    @State private var rotationSpeed: Float = 1.0

    var body: some View {
        RealityView { content in
            let box = ModelEntity(mesh: .generateBox(size: 0.1))
            content.add(box)
        } update: { content in
            // react to SwiftUI state changes, updating RealityKit entities accordingly
        }
    }
}
```

`RealityView`'s update closure provides the same declarative, state-driven update pattern SwiftUI uses elsewhere (recall the general SwiftUI reactivity model from Part 3) applied to a RealityKit scene — rather than manually and imperatively mutating entities in response to state changes scattered throughout the app, changes to observed state trigger the update closure, which then reconciles the RealityKit scene's actual entities to match the current state, consistent with SwiftUI's broader declarative philosophy.

---

## 64.4 Loading USDZ Assets

USDZ (Universal Scene Description, zipped) is the standard 3D asset format for RealityKit content — a single, self-contained file bundling geometry, materials, textures, and animations, loadable directly into a RealityKit scene via `Entity.load` or `ModelEntity`'s async loading APIs.

```swift
func loadModel() async throws -> Entity {
    let entity = try await Entity(named: "Chair", in: nil)
    return entity
}
```

USDZ's self-contained, standardized nature (an open format, not Apple-proprietary) is what enables it to serve as a genuine interchange format across the broader 3D content ecosystem — assets authored in professional 3D tools (Blender, Cinema 4D, Reality Composer Pro) can be exported to USDZ and loaded directly into a RealityKit scene, and the same USDZ file can also be viewed directly by the system's own AR Quick Look feature outside of any custom app entirely, a meaningful interoperability advantage over a proprietary, app-specific asset format.

---

## 64.5 Reality Composer Pro Workflow

Reality Composer Pro is Apple's dedicated authoring tool for RealityKit content — assembling scenes visually (positioning entities, configuring components, building particle effects and shader graph materials) and exporting the result as a `.reality` file or Swift package content bundle, referenced from app code rather than constructed purely programmatically.

```swift
// Content authored in Reality Composer Pro is typically loaded via a generated
// Swift accessor, similar in spirit to Xcode's Core ML model code generation (59.2):
let scene = try await Entity(named: "MyScene", in: realityKitContentBundle)
```

This visual authoring workflow parallels other visual-tool-plus-generated-code patterns seen elsewhere in this curriculum — much like a `.storekit` configuration file (section 56.13) or a Core ML `.mlpackage` (section 59.2) lets non-code configuration be authored visually and then referenced from Swift, Reality Composer Pro lets complex 3D scene composition happen in a purpose-built visual tool rather than requiring every entity position, material, and effect to be hand-written as raw Swift code.

---

## 64.6 Shader Graph Materials 🔴

Beyond RealityKit's built-in material types (`SimpleMaterial`, `PhysicallyBasedMaterial`), shader graph materials — authored visually in Reality Composer Pro as a node graph connecting inputs, math operations, and texture samples — enable custom, procedural surface appearance (animated patterns, complex reflectivity, procedural textures) without writing raw shader code directly.

```swift
// Shader graph materials are authored visually, then loaded and applied like any material:
if let customMaterial = try? await ShaderGraphMaterial(named: "IridescentSurface", from: "MyScene", in: realityKitContentBundle) {
    entity.components[ModelComponent.self]?.materials = [customMaterial]
}
```

Shader graph materials occupy a middle ground between RealityKit's simple built-in materials and Metal's fully manual shader programming (section 63.4) — providing much of custom shader programming's visual flexibility (procedural effects, complex material behavior) through a visual node-based authoring interface rather than requiring hand-written Metal Shading Language, appropriate for achieving sophisticated visual effects without the full complexity of raw GPU shader programming.

---

## 64.7 ARKit World Tracking

ARKit's world tracking (`ARWorldTrackingConfiguration`) uses the device's camera and motion sensors together to establish and continuously track the device's position and orientation within real-world 3D space, forming the foundation that lets virtual content appear anchored to a stable, consistent position in the physical world as the device moves.

```swift
import ARKit

let configuration = ARWorldTrackingConfiguration()
configuration.planeDetection = [.horizontal, .vertical]
let session = ARSession()
session.run(configuration)
```

World tracking's core technical achievement is visual-inertial odometry — fusing camera imagery with motion sensor data (recall Core Motion, section 57.5) to continuously estimate device position with much greater accuracy and stability than either sensor source could achieve alone — this fused tracking is precisely what makes a virtual object appear to stay fixed in place in the real world as the user physically walks around it, rather than drifting or jittering relative to the real environment.

---

## 64.8 Plane Detection and Anchoring

Building on world tracking, plane detection identifies flat surfaces (horizontal, like a table or floor; vertical, like a wall) within the tracked environment, with `ARPlaneAnchor` providing the detected plane's position, extent, and classification — the foundation for placing virtual content realistically on real-world surfaces.

```swift
func session(_ session: ARSession, didAdd anchors: [ARAnchor]) {
    for anchor in anchors {
        if let planeAnchor = anchor as? ARPlaneAnchor {
            print("Detected \(planeAnchor.alignment == .horizontal ? "horizontal" : "vertical") plane, extent: \(planeAnchor.planeExtent)")
        }
    }
}
```

Anchoring virtual content to a detected `ARPlaneAnchor` (rather than to an arbitrary, fixed point in space) is what makes an AR object appear to genuinely rest on a real surface — a virtual object placed relative to a detected horizontal plane anchor will appear to sit convincingly on the actual table or floor it was placed on, updating its apparent position appropriately if ARKit refines its estimate of that plane's exact position and extent as tracking continues.

---

## 64.9 Image and Object Tracking

Beyond generic plane detection, ARKit can track specific, pre-registered reference images (`ARImageTrackingConfiguration`, `ARReferenceImage`) or 3D reference objects (`ARReferenceObject`) — recognizing a specific known image or physical object in the camera feed and anchoring virtual content relative to its detected position and orientation.

```swift
guard let referenceImages = ARReferenceImage.referenceImages(inGroupNamed: "AR Resources", bundle: nil) else { return }
let configuration = ARImageTrackingConfiguration()
configuration.trackingImages = referenceImages
configuration.maximumNumberOfTrackedImages = 1
```

Image tracking is well suited to use cases where a specific, known visual marker exists in the real world — a product package, a poster, a printed marker — that virtual content should attach to and track relative to, distinct from plane detection's more general "find any flat surface" approach; recognizing a specific reference image also provides orientation information directly from the image's own known geometry, rather than requiring a generic flat surface to be detected first.

---

## 64.10 Scene Reconstruction and Occlusion

On devices with a LiDAR scanner, ARKit's scene reconstruction (`ARWorldTrackingConfiguration.sceneReconstruction`) builds a detailed 3D mesh of the real environment in real time, enabling realistic occlusion — virtual objects correctly appearing hidden behind real-world objects that are actually in front of them from the camera's perspective, rather than always rendering on top regardless of real depth.

```swift
if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
    configuration.sceneReconstruction = .mesh
}
```

Occlusion is what separates a genuinely convincing AR experience from one where virtual content obviously "floats" unrealistically in front of everything regardless of actual depth — with an accurate real-time mesh of the environment, ARKit can correctly determine that a virtual character walking behind a real couch should have the couch rendered in front of it, a meaningfully more immersive and physically plausible result that depends entirely on LiDAR-equipped hardware being available to build that detailed real-time mesh.

---

## 64.11 Face and Body Tracking

ARKit's face tracking (`ARFaceTrackingConfiguration`, on TrueDepth-camera-equipped devices) provides detailed facial geometry and blend shape coefficients (tracking specific facial expressions like eyebrow raises or smiles), while body tracking (`ARBodyTrackingConfiguration`) estimates a person's full-body skeletal joint positions from the camera feed.

```swift
let faceConfiguration = ARFaceTrackingConfiguration()
// In the delegate: access anchor.blendShapes[.mouthSmileLeft], .browInnerUp, etc.
// for driving expression-responsive content (like an animated avatar)
```

Face tracking's blend shape coefficients provide a standardized, numeric representation of specific facial expressions (a value from 0 to 1 for each of dozens of defined expression categories), which is precisely the kind of structured data needed to drive an animated avatar's expression convincingly in real time — this parallels body tracking's skeletal joint output conceptually, both reducing a genuinely complex real-world signal (a face's or body's actual configuration) into structured, actionable data an app can use to drive its own content.

---

## 64.12 visionOS: Windows, Volumes, Immersive Spaces

visionOS apps present content through three distinct scene types: windows (traditional, bounded 2D SwiftUI content, familiar from other Apple platforms), volumes (bounded 3D content with real depth, appropriate for displaying a 3D object users can view from different angles), and immersive spaces (unbounded content that can partially or fully replace the user's view of their physical surroundings).

```swift
@main
struct MyVisionApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
        WindowGroup(id: "product-viewer") { ProductVolumeView() }
            .windowStyle(.volumetric)
        ImmersiveSpace(id: "immersive-experience") { ImmersiveView() }
    }
}
```

Choosing the right scene type is a genuine design decision reflecting how immersive a given piece of content should actually be — a settings screen is naturally a window (bounded, familiar, 2D), a 3D product model a user wants to examine from all angles is naturally a volume (bounded but genuinely three-dimensional), and a fully immersive game or environment is appropriately an immersive space, with the right choice depending on the content's actual nature rather than immersive spaces being automatically "better" for every use case.

---

## 64.13 visionOS: Ornaments and Hover Effects

Ornaments are auxiliary UI elements attached to a window's edge (like a toolbar floating just below a window) that remain associated with the window's position without occupying its main content area, while hover effects provide visual feedback (a subtle highlight) as a user's gaze targets an interactive element, before an actual selection gesture occurs.

```swift
struct ContentView: View {
    var body: some View {
        VStack { /* main content */ }
            .ornament(attachmentAnchor: .scene(.bottom)) {
                HStack { Button("Action") {} }
                    .padding()
                    .glassBackgroundEffect()
            }
    }
}

Button("Tap Me") {}
    .hoverEffect(.highlight)
```

Hover effects serve a genuinely important role specific to visionOS's gaze-and-pinch interaction model (64.14) — since there's no cursor or touch contact point providing continuous visual feedback the way a mouse pointer or a finger on a touchscreen would, the hover effect is what confirms to the user that their gaze is currently targeting a specific interactive element, before they commit to an actual pinch selection gesture.

---

## 64.14 visionOS: Gaze and Pinch Input

visionOS's primary interaction model combines gaze (where the user is looking, used to determine what's being targeted) with a pinch gesture (thumb and index finger touching, functioning as the equivalent of a tap or click) — a fundamentally different input paradigm from touch or mouse-based interaction, requiring no direct contact with any physical surface.

```swift
Button("Select") {
    // triggered by gaze targeting this button, followed by a pinch gesture —
    // standard SwiftUI Button and gesture APIs work largely unchanged;
    // visionOS handles the gaze+pinch-to-tap translation automatically
}
```

A genuinely convenient aspect of this interaction model is that standard SwiftUI interactive elements (`Button`, tap gestures) largely work unchanged on visionOS — the platform handles translating gaze-plus-pinch into the equivalent of a standard tap event automatically, meaning much existing SwiftUI interaction code written with touch or click in mind requires little to no modification to function correctly under visionOS's fundamentally different gaze-and-pinch input model.

---

## 64.15 visionOS: Hand Tracking 🔴

Beyond the standard gaze-and-pinch interaction model, ARKit's hand tracking APIs (`HandTrackingProvider`) provide detailed, per-joint hand skeleton data for both hands — appropriate for more sophisticated hand-interaction experiences (custom gesture recognition, direct manipulation of virtual objects) beyond the standard system-provided pinch-to-select gesture.

```swift
import ARKit

let session = ARKitSession()
let handTracking = HandTrackingProvider()

func startHandTracking() async throws {
    try await session.run([handTracking])
    for await update in handTracking.anchorUpdates {
        let handAnchor = update.anchor
        // access individual joint transforms, e.g. handAnchor.handSkeleton?.joint(.indexFingerTip)
    }
}
```

Reaching for raw hand tracking data is appropriate specifically when an experience genuinely needs custom gesture recognition or direct hand-object interaction beyond what the standard, system-handled pinch gesture (64.14) already provides — much like reaching for Core Bluetooth's peripheral role (section 57.7) or a custom `CIKernel` (section 62.11) represents a deliberate escalation to lower-level, more specialized capability when a standard, higher-level abstraction genuinely isn't sufficient for the specific interaction being built.

---

## 64.16 Spatial Video and Photo Capture 🔴

Vision Pro-compatible devices (and recent iPhones) support capturing spatial video and photos — stereoscopic capture using two slightly offset camera views, producing content with genuine, viewable depth when played back on Vision Pro, distinct from a standard flat photo or video.

```swift
// Spatial capture is configured through AVCaptureDevice/AVCaptureSession
// (recall section 55.4) with a spatial-capable format selected:
if let spatialFormat = device.formats.first(where: { $0.isSpatialVideoCaptureSupported }) {
    try device.lockForConfiguration()
    device.activeFormat = spatialFormat
    device.unlockForConfiguration()
}
```

Spatial capture builds directly on the standard `AVCaptureSession` foundation covered in section 55.4, simply configured with a spatial-capable format that captures the two offset views needed for stereoscopic depth — the resulting spatial video or photo, when viewed on Vision Pro, provides a genuine sense of depth and presence that a standard flat capture cannot convey, a capability increasingly available on recent iPhone hardware even for content ultimately intended for Vision Pro playback.

---

## 64.17 Performance Budgets on Vision Pro 🔴

Vision Pro's rendering requirements are genuinely more demanding than a typical iPhone or iPad app — rendering at high resolution per eye, at a high frame rate, with strict latency requirements to avoid user discomfort — meaning performance budgeting (profiling with the tools from sections 62 and 63, being deliberate about polygon counts, texture sizes, and shader complexity) matters even more critically than for typical 2D app performance.

```swift
// Performance-conscious RealityKit content decisions for visionOS:
// - Prefer simpler geometry/lower polygon counts where visual fidelity allows
// - Use LOD (level of detail) techniques for complex models viewed at varying distances
// - Profile actual on-device performance with Instruments rather than assuming
//   simulator performance is representative of real Vision Pro hardware
```

The stakes for missing Vision Pro's performance budget are meaningfully higher than a typical iPhone app's — where iPhone frame drops are merely a visible quality issue, failing to maintain Vision Pro's required frame rate and latency can produce genuine user discomfort (a well-documented consequence of inadequate frame rate/latency in immersive headset experiences), making the profiling discipline from sections 62.7 (offscreen rendering costs) and 63.9 (Metal frame capture) not merely a polish concern but a genuine requirement for a comfortable, usable visionOS experience.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Scene composition | `Entity`, `Component` | Data-driven, composition-based scene modeling |
| Per-frame logic | `System`, `EntityQuery` | Behavior separated from data, scaling cleanly with complexity |
| SwiftUI integration | `RealityView` | Declarative, state-driven RealityKit scene hosting |
| Asset format | USDZ, `Entity.load`/`Entity(named:)` | Standardized, interoperable 3D asset interchange |
| Visual authoring | Reality Composer Pro | Non-code scene/material authoring referenced from Swift |
| Custom materials | Shader graph materials | Visual, node-based procedural surface authoring |
| Device tracking | `ARWorldTrackingConfiguration` | Visual-inertial odometry for stable world tracking |
| Surface detection | `ARPlaneAnchor` | Realistic anchoring of content to real surfaces |
| Marker tracking | `ARImageTrackingConfiguration`, `ARReferenceObject` | Tracking specific known images/objects |
| Depth realism | Scene reconstruction, LiDAR mesh | Correct occlusion of virtual content by real objects |
| Expression/pose data | Face/body tracking, blend shapes | Structured data for driving avatars and character rigs |
| visionOS scene types | Windows, volumes, immersive spaces | Matching immersion level to content's actual nature |
| Auxiliary UI | Ornaments, hover effects | Window-attached controls and gaze feedback |
| Primary input | Gaze + pinch | Contactless interaction, largely compatible with standard SwiftUI |
| Advanced input | `HandTrackingProvider` | Per-joint hand data for custom gesture interaction |
| Immersive capture | Spatial video/photo | Stereoscopic capture for depth-viewable Vision Pro playback |
| Performance discipline | Vision Pro profiling | Higher-stakes budgeting to avoid user discomfort |
