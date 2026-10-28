**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

This section covers **3D and spatial** apps. **RealityKit** renders 3D content (on iPhone, iPad, Mac, and Vision Pro). **ARKit** understands the **real world** through the camera and sensors. **visionOS** adds windows, volumes, and immersive spaces you can walk around in. We go from entities and components, through AR tracking, to visionOS input and performance.

---

## 64.1 RealityKit Entities and Components 🟢

A RealityKit scene is made of **entities**. An entity on its own is **empty**: what it **is** and **does** comes from its **components**.

```swift
import RealityKit

// A plate: a visible mesh + a shape for taps and physics
let plate = Entity()
plate.components.set(ModelComponent(
    mesh: .generateCylinder(height: 0.02, radius: 0.12),          // meters!
    materials: [SimpleMaterial(color: .white, roughness: 0.3, isMetallic: false)]
))
plate.components.set(CollisionComponent(shapes: [.generateBox(size: [0.24, 0.02, 0.24])]))
plate.position = [0, 0, -0.5]                                      // 50 cm in front

// ModelEntity is a shortcut: an Entity that already has a ModelComponent
let tomato = ModelEntity(mesh: .generateSphere(radius: 0.03),
                         materials: [SimpleMaterial(color: .red, isMetallic: false)])
plate.addChild(tomato)                                             // entities form a tree
```

| Component | Gives the entity |
|---|---|
| `ModelComponent` | A **mesh** and **materials**: something you can see |
| `CollisionComponent` | A **shape** for hit testing and collisions |
| `PhysicsBodyComponent` | **Physics**: gravity, forces, bouncing |
| `InputTargetComponent` | Can receive **gestures** (with a collision shape) |
| `Transform` | Position, rotation, scale (every entity has one) |

This is the **Entity–Component–System** (ECS) design. Instead of a class hierarchy (`class PhysicsTomato: Tomato: Vegetable`), you **compose**: any entity can become visible, physical, or tappable just by **adding** components.

You can define **your own** components. They're just data:

```swift
struct SpinComponent: Component {
    var radiansPerSecond: Float = 1
}

SpinComponent.registerComponent()                 // once, at app start
plate.components.set(SpinComponent(radiansPerSecond: 0.5))
```

Components are **structs** (values). To change one, read it, modify it, and **set it back**.

---

## 64.2 The ECS Model: Systems and Updates 🟡

If components are **data**, **systems** are the **behavior**. A system runs **every frame**, finds all entities with certain components, and updates them:

```swift
import RealityKit

struct SpinSystem: System {
    private static let query = EntityQuery(where: .has(SpinComponent.self))

    init(scene: RealityKit.Scene) {}                   // required

    func update(context: SceneUpdateContext) {
        let dt = Float(context.deltaTime)              // seconds since the last frame
        for entity in context.entities(matching: Self.query, updatingSystemWhen: .rendering) {
            guard let spin = entity.components[SpinComponent.self] else { continue }
            let angle = spin.radiansPerSecond * dt     // by TIME, not by frame (like 62.5)
            entity.transform.rotation *= simd_quatf(angle: angle, axis: [0, 1, 0])
        }
    }
}

SpinSystem.registerSystem()                            // once, at app start
```

| ECS part | Holds | Example |
|---|---|---|
| **Entity** | Just an identity + a list of components | "the plate" |
| **Component** | **Data** only | `SpinComponent(radiansPerSecond: 0.5)` |
| **System** | **Logic**, applied to every matching entity | `SpinSystem` rotates everything with a `SpinComponent` |

Why it scales: a new **behavior** is a new **system**. Want things to bob up and down? Add a `BobComponent` and a `BobSystem`. You never touch existing classes, and **any** entity can opt in.

Keep systems **fast**: they run up to 90 times a second on Vision Pro. Don't allocate or do heavy work in `update`.

---

## 64.3 RealityView in SwiftUI 🟢

**`RealityView`** puts RealityKit content inside a SwiftUI view. It has a **make** closure (runs **once**) and an optional **update** closure (runs when SwiftUI state it reads **changes**):

```swift
import SwiftUI
import RealityKit

struct DishView: View {
    @State private var showGarnish = false

    var body: some View {
        RealityView { content in
            // MAKE: runs once. Load and add content here (it's async).
            if let dish = try? await Entity(named: "Pasta") {
                dish.name = "dish"
                content.add(dish)
            }
        } update: { content in
            // UPDATE: runs when showGarnish changes. Only adjust existing entities here.
            content.entities.first?.findEntity(named: "Garnish")?.isEnabled = showGarnish
        }
        .gesture(
            TapGesture()
                .targetedToAnyEntity()                       // which entity was tapped?
                .onEnded { value in
                    value.entity.scale *= 1.1
                }
        )
        .toolbar {
            Toggle("Garnish", isOn: $showGarnish)
        }
    }
}
```

It's SwiftUI's **declarative** model, applied to a 3D scene: change **state**, and the `update` closure brings the scene in line.

Rules:

- **Create** entities in `make`, not in `update`: `update` can run **many** times.
- Tappable entities need **`InputTargetComponent`** + **`CollisionComponent`** (64.1).
- On **visionOS**, `RealityView` can also hold **attachments**: SwiftUI views placed in 3D space next to your entities. On **iOS 18+**, `RealityView` can show AR content through the camera with `.camera(.spatialTracking)`.

---

## 64.4 Loading USDZ Assets 🟢

**USDZ** is the standard 3D file format on Apple platforms. One file holds **geometry**, **materials**, **textures**, and **animations**. It's based on **USD** (Universal Scene Description), an open format created by Pixar and used across the 3D industry.

```swift
import RealityKit

// From the app bundle
let chair = try await Entity(named: "Chair")

// From a downloaded file
let downloaded = try await Entity(contentsOf: fileURL)

// Play an animation stored in the file
if let animation = chair.availableAnimations.first {
    chair.playAnimation(animation.repeat())
}
```

On visionOS, the simplest way to **show** a model is the SwiftUI **`Model3D`** view, with no RealityView setup:

```swift
Model3D(named: "Chair") { model in
    model.resizable().scaledToFit()
} placeholder: {
    ProgressView()
}
```

Why USDZ matters:

- Artists can export it from **Blender**, Maya, Cinema 4D, and other tools; Reality Composer Pro (64.5) works with USD directly.
- The **same** file opens in the system's **AR Quick Look** (in Files, Messages, Safari, or `QLPreviewController`), with no custom app code.
- You can **create** USDZ models from photos with **Object Capture** (`PhotogrammetrySession`).

Keep models **light**: fewer polygons and smaller textures load faster and render more smoothly (64.17).

---

## 64.5 Reality Composer Pro Workflow 🟢

**Reality Composer Pro** (Xcode ▸ Open Developer Tool) is a **visual editor** for RealityKit scenes. You place models, set up components, build **particle** effects and **shader graph** materials (64.6), and add **audio**, without writing code for each detail.

Your project gets a Swift **package** (by default named `RealityKitContent`) that holds the scenes as `.usda` files. Load them in code:

```swift
import RealityKit
import RealityKitContent                        // the generated package

RealityView { content in
    if let kitchen = try? await Entity(named: "Kitchen", in: realityKitContentBundle) {
        content.add(kitchen)

        // Find an entity the designer named in the editor
        if let oven = kitchen.findEntity(named: "Oven") {
            oven.components.set(InputTargetComponent())
        }
    }
}
```

The split of work:

| Reality Composer Pro (visual) | Swift code |
|---|---|
| Layout, materials, lights, particles | **Behavior**: systems, gestures, game logic |
| Custom **components** with values set per entity | Reading those components and acting on them |
| Previewing the scene, also on a device | State, data, and SwiftUI UI |

It's the same idea as a `.storekit` file (56.13) or a Core ML model in Xcode (59.2): **configure visually**, then **use from Swift**. Designers can change the look without touching code.

---

## 64.6 Shader Graph Materials 🔴

RealityKit's built-in materials cover the common cases:

| Material | Look |
|---|---|
| `SimpleMaterial` | A basic color, metallic or not |
| `PhysicallyBasedMaterial` | Realistic: base color, roughness, metalness, normal maps, … |
| `UnlitMaterial` | No lighting: always the same color (good for UI-like elements) |

For **custom** effects (animated glow, procedural patterns, water, "sizzle" on a pan), build a **shader graph** in Reality Composer Pro: a **node graph** of inputs, math, and texture samples. It's based on the **MaterialX** standard. Then load it in code:

```swift
import RealityKit
import RealityKitContent

func applySizzle(to pan: ModelEntity) async throws {
    var material = try await ShaderGraphMaterial(
        named: "/Root/SizzleMaterial",              // the material's path inside the scene
        from: "Materials.usda",
        in: realityKitContentBundle
    )
    try material.setParameter(name: "Heat", value: .float(0.8))   // an input you exposed in the graph
    pan.model?.materials = [material]
}
```

Where it sits:

```
SimpleMaterial ──► PhysicallyBasedMaterial ──► Shader graph ──► Metal shaders (63.4)
   easiest              realistic                 custom, visual      full control, most work
```

On **iOS** and **macOS**, RealityKit also offers **`CustomMaterial`** with Metal surface shaders. On **visionOS**, shader graphs are the way to make custom materials. They give you most of the power of shader code, without writing MSL.

---

## 64.7 ARKit World Tracking 🟡

**World tracking** lets an iPhone or iPad know **where it is** and **which way it faces** in a room, all the time. That's what keeps a virtual object **fixed** to a spot as you walk around it.

It works by **visual-inertial odometry**: combining **camera** images (it tracks feature points: edges, corners, texture) with **motion sensor** data (57.5). Each sensor alone drifts or jumps; together they're **stable**.

```swift
import ARKit
import RealityKit

final class ARViewController: UIViewController {
    private let arView = ARView(frame: .zero)

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard ARWorldTrackingConfiguration.isSupported else { return }   // needs A9+ (not Simulator)

        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal, .vertical]            // 64.8
        configuration.environmentTexturing = .automatic                    // realistic reflections
        arView.session.run(configuration)                                  // NSCameraUsageDescription
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        arView.session.pause()                                             // stop the camera
    }
}
```

Tracking quality changes with the environment. Watch `camera.trackingState`:

| State | Common reason | Tell the user |
|---|---|---|
| `.normal` | — | Nothing |
| `.limited(.initializing)` | Just started | "Move your phone slowly" |
| `.limited(.insufficientFeatures)` | A blank wall, darkness | "Point at a textured surface" |
| `.limited(.excessiveMotion)` | Moving too fast | "Slow down" |

**`ARCoachingOverlayView`** shows Apple's standard instructions for you. Use it: users don't know how AR tracking works.

On **iOS 18+**, you can also run AR inside SwiftUI with `RealityView` and `.camera(.spatialTracking)`. On **visionOS**, tracking is always on and handled by the system.

---

## 64.8 Plane Detection and Anchoring 🟡

With plane detection on, ARKit finds **flat surfaces**: floors, tables (horizontal), walls (vertical). Each one becomes an **`ARPlaneAnchor`**, with a position, a size, and often a **classification** (floor, table, wall, seat).

In RealityKit, the easiest way is an **`AnchorEntity`** that waits for a matching plane:

```swift
// "Put the dish on the first table-like surface, at least 30 × 30 cm"
let tableAnchor = AnchorEntity(.plane(.horizontal,
                                      classification: .table,
                                      minimumBounds: [0.3, 0.3]))
tableAnchor.addChild(try await Entity(named: "Pasta"))
arView.scene.addAnchor(tableAnchor)
```

**Tap to place** with a **raycast** from the screen point onto real surfaces:

```swift
@objc func handleTap(_ gesture: UITapGestureRecognizer) {
    let point = gesture.location(in: arView)
    guard let hit = arView.raycast(from: point,
                                   allowing: .estimatedPlane,
                                   alignment: .horizontal).first else { return }

    let anchor = AnchorEntity(world: hit.worldTransform)       // a fixed spot on that surface
    anchor.addChild(dishModel.clone(recursive: true))
    arView.scene.addAnchor(anchor)
}
```

Why anchor to **real surfaces**? A model placed at a random point in space **floats**. A model anchored to a detected table **sits** on it, and ARKit keeps adjusting the anchor as it **learns** more about the table. That's the difference between "a 3D model on top of a video" and "a dish on my table".

---

## 64.9 Image and Object Tracking 🟡

Plane detection finds **any** flat surface. **Image** and **object** tracking find **specific, known** things, and attach content to **them**.

**Image tracking**: add reference images (with their **real size**) to an **AR Resources** group in the asset catalog:

```swift
guard let recipeCards = ARReferenceImage.referenceImages(inGroupNamed: "AR Resources",
                                                         bundle: nil) else { return }

// Only images (fast; follows a moving card):
let configuration = ARImageTrackingConfiguration()
configuration.trackingImages = recipeCards
configuration.maximumNumberOfTrackedImages = 2

// Or: world tracking + image detection (images in a fixed place, like a poster)
let world = ARWorldTrackingConfiguration()
world.detectionImages = recipeCards
```

In RealityKit:

```swift
let cardAnchor = AnchorEntity(.image(group: "AR Resources", name: "carbonara-card"))
cardAnchor.addChild(stepByStepVideoPanel)          // the video sits ON the printed card
```

| Tracking | Finds | Example |
|---|---|---|
| Plane detection (64.8) | **Any** flat surface | Put furniture on the floor |
| **Image** tracking | A **known** 2D image | A recipe card shows a cooking video |
| **Object** tracking | A **known** 3D object | Instructions float over a coffee machine |

The image's **known size and shape** also give ARKit its exact **orientation**, so content lines up precisely. Good reference images have **lots of detail** and contrast; plain logos track badly. Xcode warns about weak images in the asset catalog.

---

## 64.10 Scene Reconstruction and Occlusion 🟡

**Occlusion** means real things **hide** virtual things behind them. Without it, a virtual cat "behind" your sofa is still drawn **on top** of the sofa, which breaks the illusion at once.

Two kinds:

| Occlusion | Hides virtual content behind | Needs |
|---|---|---|
| **People occlusion** | **People** (hands, bodies) | A12 chip or later |
| **Scene reconstruction** | **Everything**: furniture, walls | A **LiDAR** scanner (Pro iPhones and iPads) |

```swift
let configuration = ARWorldTrackingConfiguration()

// People occlusion
if ARWorldTrackingConfiguration.supportsFrameSemantics(.personSegmentationWithDepth) {
    configuration.frameSemantics.insert(.personSegmentationWithDepth)
}

// Full scene mesh (LiDAR only)
if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
    configuration.sceneReconstruction = .mesh
    arView.environment.sceneUnderstanding.options.insert(.occlusion)   // real mesh hides virtual
    arView.environment.sceneUnderstanding.options.insert(.physics)     // virtual balls bounce off real tables
}

arView.session.run(configuration)
```

With **scene reconstruction**, LiDAR builds a live 3D **mesh** of the room. RealityKit uses it for occlusion, **physics** against real objects, and even lighting.

Always **check support** and fall back gracefully: without LiDAR, the experience still works, with less realism. On **visionOS**, the same data comes from `SceneReconstructionProvider` (in an immersive space).

---

## 64.11 Face and Body Tracking 🟡

**Face tracking** (front **TrueDepth** camera) gives a 3D face mesh and **blend shapes**: about 50 named expressions, each a number from **0** (neutral) to **1** (fully expressed).

```swift
import ARKit

final class FaceTracker: NSObject, ARSessionDelegate {
    func start(session: ARSession) {
        guard ARFaceTrackingConfiguration.isSupported else { return }
        session.delegate = self
        session.run(ARFaceTrackingConfiguration())
    }

    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        guard let face = anchors.compactMap({ $0 as? ARFaceAnchor }).first else { return }

        let smile = face.blendShapes[.mouthSmileLeft]?.floatValue ?? 0     // 0...1
        let jawOpen = face.blendShapes[.jawOpen]?.floatValue ?? 0
        let browUp = face.blendShapes[.browInnerUp]?.floatValue ?? 0

        avatar.setExpression(smile: smile, mouthOpen: jawOpen, surprise: browUp)  // drive a character
    }
}
```

**Body tracking** (rear camera, A12+) estimates a person's **skeleton**: joint positions for the head, arms, spine, and legs. RealityKit's **`BodyTrackedEntity`** can move a rigged 3D character with it.

| Tracking | Raw input | Structured output |
|---|---|---|
| Face | TrueDepth camera | Blend shapes (expression values) + face mesh |
| Body | Rear camera | A **skeleton** of joint transforms |

Both turn a complex real signal into **simple numbers** an app can use: an animated avatar, a fitness form check, a game controlled by your face.

Face data is **sensitive**. App Review rules forbid using it for advertising or marketing, and your privacy policy must explain how you use it.

---

## 64.12 visionOS: Windows, Volumes, Immersive Spaces 🟢

visionOS has **three** kinds of scenes:

| Scene | Content | Example |
|---|---|---|
| **Window** | **2D** SwiftUI, in a glass panel | Recipe list, settings |
| **Volume** | **3D** content in a **bounded box** you can look around | A dish model on your table |
| **Immersive space** | **Unbounded** content all around you | A virtual kitchen, a cooking game |

```swift
import SwiftUI

@main
struct RecipeVisionApp: App {
    @State private var immersionStyle: ImmersionStyle = .mixed

    var body: some Scene {
        WindowGroup {                                         // a window
            RecipeListView()
        }

        WindowGroup(id: "dish-viewer", for: Recipe.ID.self) { $recipeID in   // a volume
            DishVolumeView(recipeID: recipeID)
        }
        .windowStyle(.volumetric)
        .defaultSize(width: 0.4, height: 0.3, depth: 0.4, in: .meters)

        ImmersiveSpace(id: "kitchen") {                       // an immersive space
            KitchenImmersiveView()
        }
        .immersionStyle(selection: $immersionStyle, in: .mixed, .progressive, .full)
    }
}
```

Open them from your views:

```swift
struct RecipeDetailView: View {
    let recipe: Recipe
    @Environment(\.openWindow) private var openWindow
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace

    var body: some View {
        Button("View Dish in 3D") { openWindow(id: "dish-viewer", value: recipe.id) }
        Button("Cook in the Virtual Kitchen") {
            Task { _ = await openImmersiveSpace(id: "kitchen") }    // only ONE can be open at a time
        }
    }
}
```

| Immersion style | Your surroundings |
|---|---|
| `.mixed` | Still visible; your content is **added** to the room |
| `.progressive` | Partly replaced; the user turns the **Digital Crown** to adjust |
| `.full` | Completely replaced |

Pick the scene by the **content**, not by "more immersive = better". Most features belong in a **window**. Use a volume for 3D **objects**, and an immersive space for **experiences**, and let users leave them easily.

---

## 64.13 visionOS: Ornaments and Hover Effects 🟢

An **ornament** is a piece of UI attached to the **edge** of a window, like a floating toolbar below it. It moves **with** the window but doesn't take space **inside** it:

```swift
struct RecipeListView: View {
    var body: some View {
        List(recipes) { recipe in RecipeRow(recipe: recipe) }
            .ornament(attachmentAnchor: .scene(.bottom)) {
                HStack {
                    Button("Shuffle", systemImage: "shuffle") { shuffle() }
                    Button("Timer", systemImage: "timer") { startTimer() }
                }
                .padding()
                .glassBackgroundEffect()                   // the standard visionOS glass
            }
    }
}
```

(A `toolbar` in a `TabView` or `NavigationStack` also becomes an ornament automatically.)

**Hover effects** show the user what they're **looking at**: a soft highlight on the button under their eyes, before they pinch. Standard controls (`Button`, `Toggle`, list rows) have them **automatically**. Custom views need one:

```swift
RecipeCard(recipe: recipe)
    .contentShape(.hoverEffect, .rect(cornerRadius: 16))   // the shape that lights up
    .hoverEffect()                                        // default highlight
```

For **3D entities**, add a **`HoverEffectComponent`** (plus `InputTargetComponent` and `CollisionComponent`).

Why hover effects matter so much: there's **no cursor** and no finger on glass. The highlight is the **only** feedback that says "you're about to select **this**". Without it, users pinch and **hope**.

Privacy detail: the system draws hover effects **outside** your app. Your app **never learns** where the user is looking, only what they finally **select**.

---

## 64.14 visionOS: Gaze and Pinch Input 🟢

The main input on Vision Pro is **look and pinch**:

```
1. LOOK at a button        → the system highlights it (hover effect, 64.13)
2. PINCH thumb + index     → the system sends a "tap" to that button
                           (hands can rest in your lap: no need to reach)
```

Users can also **touch** content **directly** when it's within arm's reach (direct touch), and use a keyboard, trackpad, or game controller.

The good news: **standard SwiftUI** just works. A look + pinch arrives as a normal **tap**:

```swift
Button("Start Cooking") { startCooking() }        // no visionOS-specific code

RecipeCard(recipe: recipe)
    .onTapGesture { select(recipe) }              // also works
```

Drag, magnify, and rotate gestures work too: pinch and **move** your hand. For **3D entities**, target the gestures at entities:

```swift
RealityView { content in /* ... */ }
    .gesture(
        DragGesture()
            .targetedToAnyEntity()
            .onChanged { value in
                // move the entity with the hand, in scene coordinates
                value.entity.position = value.convert(value.location3D, from: .local, to: value.entity.parent!)
            }
    )
```

Design tips for eyes:

- Make targets **big enough**: at least **60 points** apart, center to center.
- Avoid UI that needs **precise** or **long** looking.
- Keep important content **in front** of the user, not far to the sides.

---

## 64.15 visionOS: Hand Tracking 🔴

Look-and-pinch covers most apps. For **custom gestures** or **direct hand interaction** (squeeze dough, catch a flying ingredient), ARKit's **`HandTrackingProvider`** gives you the full **skeleton** of both hands: about 27 joints each.

Requirements: an **immersive space** must be **open** (64.12), and the user must allow it (**`NSHandsTrackingUsageDescription`** in Info.plist).

```swift
import ARKit
import RealityKit

@MainActor
final class HandTracker {
    private let session = ARKitSession()
    private let handTracking = HandTrackingProvider()

    func run(fingertipMarker: Entity) async {
        guard HandTrackingProvider.isSupported else { return }
        do {
            try await session.run([handTracking])            // asks for permission
        } catch {
            return
        }

        for await update in handTracking.anchorUpdates {
            let hand = update.anchor
            guard hand.isTracked,
                  hand.chirality == .right,
                  let tip = hand.handSkeleton?.joint(.indexFingerTip),
                  tip.isTracked else { continue }

            // joint position in world space = hand origin × joint offset
            let worldTransform = hand.originFromAnchorTransform * tip.anchorFromJointTransform
            fingertipMarker.setTransformMatrix(worldTransform, relativeTo: nil)
        }
    }
}
```

For **simple** cases, RealityKit can do the anchoring for you (visionOS 2+): `AnchorEntity(.hand(.right, location: .indexFingerTip))` with a `SpatialTrackingSession`.

Use raw hand tracking **only** when the standard gestures can't do it. It's a step **down** to a lower level, like the Bluetooth peripheral role (57.7) or a custom `CIKernel` (62.11): more power, more work, and more ways to make interactions that feel **tiring**. Custom gestures must be easy to discover and comfortable to repeat.

---

## 64.16 Spatial Video and Photo Capture 🔴

**Spatial** videos and photos are **stereoscopic**: two images from two cameras a little apart, like your two eyes. On Vision Pro, they play with **real depth**.

Vision Pro captures them, and so do recent iPhones (iPhone 15 Pro and later), using **two** rear cameras side by side. Your own camera app can record spatial video with **AVFoundation** (55.4, 55.6), iOS 18+:

```swift
import AVFoundation

func configureSpatialVideo(session: AVCaptureSession, movieOutput: AVCaptureMovieFileOutput) throws {
    // Spatial capture uses the dual-wide camera pair
    guard let device = AVCaptureDevice.default(.builtInDualWideCamera, for: .video, position: .back),
          let format = device.formats.first(where: { $0.isSpatialVideoCaptureSupported }) else {
        throw CaptureError.spatialNotSupported
    }

    session.beginConfiguration()
    defer { session.commitConfiguration() }

    try device.lockForConfiguration()
    device.activeFormat = format                       // a format that can record both views
    device.unlockForConfiguration()

    if movieOutput.isSpatialVideoCaptureSupported {
        movieOutput.isSpatialVideoCaptureEnabled = true
    }
}
```

The result is an **MV-HEVC** video: two views in one file, which still plays as a normal **2D** video on devices without stereo display. ⚠️ Spatial capture APIs are fairly new; check the documentation for the exact requirements on your target OS and devices.

To **show** spatial media in a visionOS app, the system viewers (Quick Look, `AVPlayerViewController`) already handle it. That's usually the best choice: the system adds the right framing and comfort features.

---

## 64.17 Performance Budgets on Vision Pro 🔴

Vision Pro is **demanding**: it renders a high-resolution image for **each eye**, at **90 Hz** or more, with very **low latency** between head movement and the image. On iPhone, a dropped frame is a small glitch. On a headset, slow or late frames can cause real **discomfort**.

Every frame must fit in about **11 ms** (at 90 Hz), and the system needs part of that for itself.

What costs the most, and what to do:

| Cost | Do this |
|---|---|
| **Polygons** | Use simpler meshes; **LOD** (level of detail): a simpler model when it's **far** away |
| **Textures** | Smaller sizes; compressed formats (ASTC); share textures |
| **Transparency** (overdraw) | Avoid stacking many see-through layers; prefer opaque materials |
| **Unique materials and meshes** | **Reuse** them: identical meshes can be drawn together (instancing) |
| **Dynamic lights and shadows** | Use few; bake lighting into textures where possible |
| **Heavy `System.update` code** (64.2) | No allocations or big loops per frame |
| **Many separate windows/volumes** | Each one costs; close what's not needed |

Measure on the **device**: the Simulator uses your Mac's GPU and isn't representative.

| Tool | Shows |
|---|---|
| **Instruments ▸ RealityKit Trace** | Frame time, render cost, and where time goes, per frame |
| **Xcode's RealityKit debugger** | The entity tree and components of the running app |
| **Metal frame capture** (63.9) | Individual draw calls and shader cost |

The same rules as 62.7 and 63.9 apply: **measure, don't guess**. On Vision Pro, good performance isn't polish; it's what makes the app **comfortable** to use.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Entities and components | `Entity`, `ModelEntity`, `Component` | Build objects by composing data |
| Systems | `System`, `EntityQuery`, `deltaTime` | Per-frame behavior for matching entities |
| SwiftUI host | `RealityView` (make + update), entity gestures | Declarative 3D scenes |
| 3D assets | USDZ, `Entity(named:)`, `Model3D` | One standard file for models and animations |
| Visual authoring | Reality Composer Pro, `realityKitContentBundle` | Scenes and materials built visually |
| Custom materials | `ShaderGraphMaterial`, `setParameter` | Node-based effects without writing MSL |
| World tracking | `ARWorldTrackingConfiguration`, coaching overlay | Camera + motion = stable position in the room |
| Planes and anchors | `AnchorEntity(.plane(...))`, raycasts | Content that sits on real surfaces |
| Images and objects | `ARReferenceImage`, `AnchorEntity(.image(...))` | Content attached to known things |
| Occlusion | People occlusion, LiDAR scene mesh | Real objects hide virtual ones |
| Face and body | `ARFaceAnchor.blendShapes`, body skeleton | Simple numbers that drive avatars |
| visionOS scenes | Window, volume, `ImmersiveSpace` | Match immersion to the content |
| Ornaments and hover | `.ornament`, `.hoverEffect()` | Attached controls; gaze feedback (private) |
| Input | Look + pinch, `targetedToAnyEntity()` | Standard SwiftUI gestures just work |
| Hand tracking | `HandTrackingProvider`, hand skeleton | Custom hand interactions in immersive spaces |
| Spatial capture | Dual-camera spatial video (MV-HEVC) | Stereo media with real depth |
| Performance | LOD, reuse, RealityKit Trace | Fit every frame: comfort depends on it |
