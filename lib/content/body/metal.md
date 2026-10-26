**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

**Metal** is Apple's **low-level GPU** API. Everything visual on Apple platforms (SwiftUI, Core Animation, Core Image, RealityKit) ends up as Metal work. This section shows when to use Metal **directly**, the core objects, a complete "hello triangle", the **Metal Shading Language**, **compute** shaders, ready-made **MPS** kernels, **MetalFX** upscaling, and the GPU **debugging** tools.

---

## 63.1 Why and When to Reach for Metal 🟢

Metal gives you **full control** of the GPU. That also means **you** do the work the higher-level frameworks normally do for you. So first check if a higher level fits:

| Need | Try first |
|---|---|
| Custom 2D drawing in a view | SwiftUI `Canvas`, `Shape` (30.1, 30.5) |
| A per-pixel effect on a **view** | SwiftUI **shaders**: `.colorEffect`, `.layerEffect` (30.9) — these **are** Metal, in a small form |
| Photo filters | **Core Image** (62.10) |
| 3D scenes, AR, visionOS | **RealityKit** (64) |
| Machine-learning models | **Core ML** (59) |

Reach for Metal **directly** when:

- you build a **game engine** or a custom **renderer** (your own lighting, particles, terrain),
- you need **GPU compute** for big parallel number crunching (simulations, signal processing, custom ML layers),
- you need a rendering technique the higher-level frameworks **can't** express,
- you're **porting** an existing engine or GPU code from another platform.

| | Higher-level frameworks | Metal |
|---|---|---|
| Control | Limited to what they offer | **Total** |
| Work for you | Memory, sync, pipeline setup are **handled** | **You** manage them |
| Bugs | Rare and visible | Can be **subtle** (a black screen, a GPU hang) |

Metal is the right tool when the automation of the higher-level frameworks is **what stands in the way**. Otherwise, it's a lot of extra code.

---

## 63.2 Devices, Command Queues, and Buffers 🟢

Three objects are the base of all Metal work:

| Object | Represents | How many |
|---|---|---|
| **`MTLDevice`** | The **GPU** | **One**, for the whole app |
| **`MTLCommandQueue`** | A line where you **submit** work to the GPU | Usually **one**, reused |
| **`MTLBuffer`** | A block of **memory** the GPU can read and write | As many as your data needs |

```swift
import Metal

final class GPU {
    let device: MTLDevice
    let commandQueue: MTLCommandQueue

    init() {
        guard let device = MTLCreateSystemDefaultDevice(),        // the GPU
              let queue = device.makeCommandQueue() else {         // create ONCE, reuse
            fatalError("Metal isn't available")
        }
        self.device = device
        self.commandQueue = queue
    }

    func makeVertexBuffer() -> MTLBuffer? {
        let vertices: [SIMD2<Float>] = [[0, 0.8], [-0.8, -0.8], [0.8, -0.8]]   // a triangle
        return device.makeBuffer(bytes: vertices,
                                 length: MemoryLayout<SIMD2<Float>>.stride * vertices.count,
                                 options: .storageModeShared)                 // CPU and GPU share it
    }
}
```

How work flows, every frame:

```
CommandQueue ──► makeCommandBuffer()           (one "package" of GPU work)
                    └─► makeRenderCommandEncoder / makeComputeCommandEncoder
                           set pipeline, set buffers, draw / dispatch
                           endEncoding()
                 commit() ──► the GPU runs it, in order
```

On Apple silicon, the CPU and GPU share the **same memory** (unified memory), so a `.storageModeShared` buffer needs **no copying**. Use `MemoryLayout<T>.stride` (not `.size`) for array lengths: it includes **padding**.

---

## 63.3 Your First Render Pipeline 🟡

A **render pipeline state** bundles everything **fixed** about a draw: which **shaders** to run (63.4) and the **pixel format** of the target. Building it **compiles** shaders for the GPU, which is **slow**, so build it **once** at setup:

```swift
import MetalKit

final class TriangleRenderer: NSObject, MTKViewDelegate {
    private let commandQueue: MTLCommandQueue
    private let pipeline: MTLRenderPipelineState
    private let vertexBuffer: MTLBuffer

    init?(view: MTKView) {
        guard let device = view.device,
              let queue = device.makeCommandQueue(),
              let library = device.makeDefaultLibrary() else { return nil }   // all .metal files in the app

        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = library.makeFunction(name: "vertexShader")
        descriptor.fragmentFunction = library.makeFunction(name: "fragmentShader")
        descriptor.colorAttachments[0].pixelFormat = view.colorPixelFormat     // must match the target

        let vertices: [SIMD2<Float>] = [[0, 0.8], [-0.8, -0.8], [0.8, -0.8]]
        guard let pipeline = try? device.makeRenderPipelineState(descriptor: descriptor),  // SLOW: once!
              let buffer = device.makeBuffer(bytes: vertices,
                                             length: MemoryLayout<SIMD2<Float>>.stride * vertices.count,
                                             options: .storageModeShared) else { return nil }

        self.commandQueue = queue
        self.pipeline = pipeline
        self.vertexBuffer = buffer
        super.init()
    }

    // Called every frame
    func draw(in view: MTKView) {
        guard let passDescriptor = view.currentRenderPassDescriptor,           // where to draw
              let drawable = view.currentDrawable,
              let commandBuffer = commandQueue.makeCommandBuffer(),
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: passDescriptor)
        else { return }

        encoder.setRenderPipelineState(pipeline)                                // FAST: reuse
        encoder.setVertexBuffer(vertexBuffer, offset: 0, index: 0)              // → [[buffer(0)]]
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
        encoder.endEncoding()

        commandBuffer.present(drawable)                                         // show when done
        commandBuffer.commit()
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {}
}
```

Show it in SwiftUI with a small `UIViewRepresentable` (38.1):

```swift
struct MetalTriangleView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> MTKView {
        let view = MTKView(frame: .zero, device: MTLCreateSystemDefaultDevice())
        view.clearColor = MTLClearColor(red: 0.1, green: 0.1, blue: 0.12, alpha: 1)
        context.coordinator.renderer = TriangleRenderer(view: view)
        view.delegate = context.coordinator.renderer                 // the view keeps it weakly
        return view
    }

    func updateUIView(_ view: MTKView, context: Context) {}

    final class Coordinator { var renderer: TriangleRenderer? }      // keeps the renderer alive
}
```

| Cost | Object | When |
|---|---|---|
| **Expensive** | `MTLDevice`, `MTLCommandQueue`, `MTLRenderPipelineState`, `MTLLibrary` | Create **once**, at setup |
| **Cheap** | Command buffers, encoders | Create **every frame** |

It's the same "pay setup once, reuse many times" rule as a shared `CIContext` (62.10).

---

## 63.4 Metal Shading Language Basics 🟡

GPU code is written in **Metal Shading Language** (MSL), in `.metal` files. MSL is based on **C++**, with extra **types** (`float2`, `float4`, `float4x4`) and **attributes** in `[[double brackets]]` that connect data between the CPU and GPU. Xcode compiles `.metal` files at **build time** into the app's **default library**.

```cpp
// Shaders.metal
#include <metal_stdlib>
using namespace metal;

struct VertexOut {
    float4 position [[position]];   // REQUIRED: where this vertex lands on screen
    float4 color;                   // extra data, interpolated for the fragment shader (63.5)
};

vertex VertexOut vertexShader(uint vertexID [[vertex_id]],                  // which vertex: 0, 1, 2
                              constant float2 *positions [[buffer(0)]]) {   // setVertexBuffer(index: 0)
    VertexOut out;
    out.position = float4(positions[vertexID], 0.0, 1.0);

    // A different color for each corner
    float3 colors[3] = { float3(1, 0.4, 0), float3(1, 0.8, 0), float3(0.9, 0.1, 0.2) };
    out.color = float4(colors[vertexID], 1.0);
    return out;
}
```

| Attribute | Meaning |
|---|---|
| `[[position]]` | The output **screen position** of a vertex |
| `[[vertex_id]]` | The **index** of the current vertex |
| `[[buffer(n)]]` | The buffer bound at **index n** from Swift |
| `[[stage_in]]` | Interpolated data from the previous stage (63.5) |
| `[[thread_position_in_grid]]` | This thread's index in a compute grid (63.6) |

Address spaces tell the GPU how memory is used:

| Keyword | Memory |
|---|---|
| `constant` | **Read-only** data, same for all threads (fast) |
| `device` | **Read-write** GPU memory |
| `thread` | Private to one thread (local variables) |
| `threadgroup` | Shared between threads of a group (63.6) |

Everything is **explicit**: you decide which buffer goes to which index, in both Swift and MSL. If the indices or the **memory layout** don't match (`SIMD2<Float>` in Swift ↔ `float2` in MSL), you get garbage, not an error. Many teams keep shared structs in a **C header** imported by both sides, so they can't drift apart.

---

## 63.5 Vertex and Fragment Shaders 🟡

The render pipeline has two **programmable** stages:

```
vertices ──► VERTEX SHADER ──► (GPU builds triangles, finds covered pixels) ──► FRAGMENT SHADER ──► pixels
             once per vertex        rasterization + interpolation                 once per pixel
             "where is it?"                                                       "what color?"
```

| Stage | Runs | Job |
|---|---|---|
| **Vertex shader** | Once per **vertex** | Compute the **position** (apply camera and model transforms), pass data along |
| **Fragment shader** | Once per **pixel** covered | Compute the final **color** (lighting, textures) |

The fragment shader for our triangle:

```cpp
fragment float4 fragmentShader(VertexOut in [[stage_in]]) {
    return in.color;     // already interpolated across the triangle
}
```

**`[[stage_in]]`** means "the vertex outputs, **interpolated**". Our vertex shader set **orange**, **yellow**, and **red** at the three corners. For a pixel in the middle, the GPU **blends** the three colors by distance. So you get a smooth **gradient** with no blending code at all.

A slightly richer fragment shader, sampling a **texture**:

```cpp
struct TexturedVertexOut {
    float4 position [[position]];
    float2 uv;                        // texture coordinate, 0...1
};

fragment float4 texturedFragment(TexturedVertexOut in [[stage_in]],
                                 texture2d<float> photo [[texture(0)]]) {
    constexpr sampler linearSampler(filter::linear);
    float4 color = photo.sample(linearSampler, in.uv);
    return float4(color.rgb * 0.9, color.a);    // a little darker
}
```

On Apple GPUs, fragment work is usually the **most expensive** part: a full-screen pass on a 120 Hz iPad Pro runs the fragment shader for millions of pixels, 120 times a second. Keep fragment shaders **simple**.

---

## 63.6 Compute Shaders 🔴

**Compute shaders** use the GPU for **general** work, not drawing. You launch a **grid** of threads; each thread handles **one piece** of the data, all in **parallel**:

```cpp
// Compute.metal
kernel void scaleValues(device float *values      [[buffer(0)]],
                        constant float &factor    [[buffer(1)]],
                        constant uint &count      [[buffer(2)]],
                        uint index [[thread_position_in_grid]]) {   // which element am I?
    if (index >= count) return;                                     // stay inside the array
    values[index] *= factor;
}
```

Run it from Swift:

```swift
func scaleOnGPU(_ input: [Float], by factor: Float, gpu: GPU) throws -> [Float] {
    let library = gpu.device.makeDefaultLibrary()!
    let function = library.makeFunction(name: "scaleValues")!
    let pipeline = try gpu.device.makeComputePipelineState(function: function)   // build once in real code

    var factor = factor
    var count = UInt32(input.count)
    let buffer = gpu.device.makeBuffer(bytes: input,
                                       length: MemoryLayout<Float>.stride * input.count,
                                       options: .storageModeShared)!

    let commandBuffer = gpu.commandQueue.makeCommandBuffer()!
    let encoder = commandBuffer.makeComputeCommandEncoder()!
    encoder.setComputePipelineState(pipeline)
    encoder.setBuffer(buffer, offset: 0, index: 0)
    encoder.setBytes(&factor, length: MemoryLayout<Float>.stride, index: 1)   // small values: setBytes
    encoder.setBytes(&count, length: MemoryLayout<UInt32>.stride, index: 2)

    let threadsPerGroup = MTLSize(width: pipeline.threadExecutionWidth, height: 1, depth: 1)
    encoder.dispatchThreads(MTLSize(width: input.count, height: 1, depth: 1),  // one thread per value
                            threadsPerThreadgroup: threadsPerGroup)
    encoder.endEncoding()

    commandBuffer.commit()
    commandBuffer.waitUntilCompleted()             // OK off the main thread; never block main on the GPU

    let result = buffer.contents().bindMemory(to: Float.self, capacity: input.count)
    return Array(UnsafeBufferPointer(start: result, count: input.count))
}
```

| | Render pipeline | Compute pipeline |
|---|---|---|
| Input | **Vertices** | Any **data** (buffers, textures) |
| Unit of work | A **vertex**, then a **pixel** | A **thread** in a grid you choose |
| Output | **Pixels** on a render target | Whatever you **write** to buffers or textures |
| Example | Drawing a 3D scene | Physics, image analysis, audio FFT, particles |

Compute is worth it for **large**, **independent** work: thousands to millions of elements. For 100 numbers, the setup costs more than it saves; the CPU (or Accelerate's vectorized functions) is faster.

Threads in the same **threadgroup** can share fast `threadgroup` memory and **synchronize**. That's how advanced kernels (blurs, reductions, sorting) get their speed.

---

## 63.7 Metal Performance Shaders 🟡

**Metal Performance Shaders (MPS)** is a library of **ready-made**, highly tuned GPU kernels: blurs, resizing, convolution, histograms, matrix math, and neural-network building blocks. Apple tunes them for **each GPU family**, so they're usually faster than code you write yourself.

```swift
import MetalPerformanceShaders

func blurred(_ source: MTLTexture, sigma: Float, gpu: GPU) -> MTLTexture? {
    // The output must be a SEPARATE texture with the same size and format
    let descriptor = MTLTextureDescriptor.texture2DDescriptor(
        pixelFormat: source.pixelFormat,
        width: source.width,
        height: source.height,
        mipmapped: false
    )
    descriptor.usage = [.shaderRead, .shaderWrite]
    guard let output = gpu.device.makeTexture(descriptor: descriptor),
          let commandBuffer = gpu.commandQueue.makeCommandBuffer() else { return nil }

    let blur = MPSImageGaussianBlur(device: gpu.device, sigma: sigma)     // create once in real code
    blur.encode(commandBuffer: commandBuffer, sourceTexture: source, destinationTexture: output)

    commandBuffer.commit()
    return output                                    // ready when the command buffer completes
}
```

MPS kernels **encode into your command buffer**, next to your own shaders, so you can mix them: render a scene → MPS blur → your custom color-grading kernel, all in **one** submission.

| Library | Gives you |
|---|---|
| **MPS** image kernels | Blur, Sobel edges, resampling, morphology, histogram |
| **MPS** matrix kernels | Fast matrix multiply and linear algebra |
| **MPSGraph** | A whole graph of ML/tensor operations, compiled for the GPU |

It's the same idea as Core ML (59) relative to writing neural networks by hand: use the **well-tested, tuned** version of a common operation, and spend your own effort on what's **unique** to your app. (Core ML itself runs on Metal and MPS when it uses the GPU.)

---

## 63.8 MetalFX Upscaling 🔴

**MetalFX** lets a game **render at a lower resolution**, then **upscale** smartly to the screen's resolution. Fewer pixels to shade (63.5) means a **higher frame rate**, with only a small loss in sharpness.

```
Render at 1280 × 720 (fast)  ──► MetalFX upscaler ──► show at 2560 × 1440
          4× fewer pixels to shade                    looks close to native
```

| Scaler | Input | Quality |
|---|---|---|
| **`MTLFXSpatialScaler`** | Just the **color** image of this frame | Good; simple to add |
| **`MTLFXTemporalScaler`** | Color + **depth** + **motion vectors**, using **previous** frames too | **Better**; needs more engine work |

```swift
import MetalFX

func makeUpscaler(device: MTLDevice) -> MTLFXSpatialScaler? {
    let descriptor = MTLFXSpatialScalerDescriptor()
    descriptor.inputWidth = 1280
    descriptor.inputHeight = 720
    descriptor.outputWidth = 2560
    descriptor.outputHeight = 1440
    descriptor.colorTextureFormat = .bgra8Unorm
    descriptor.outputTextureFormat = .bgra8Unorm
    descriptor.colorProcessingMode = .perceptual
    return descriptor.makeSpatialScaler(device: device)          // create once
}

// Every frame, after rendering the low-resolution scene:
upscaler.colorTexture = lowResolutionSceneTexture
upscaler.outputTexture = fullResolutionTexture
upscaler.encode(commandBuffer: commandBuffer)
```

It's a **quality vs. performance** trade-off, like **quantizing** a Core ML model (59.5): give up a little fidelity, gain a lot of speed. Newer OS versions add more MetalFX features (such as frame interpolation); ⚠️ check the documentation for what your target OS supports.

---

## 63.9 Profiling with the Metal Debugger 🟡

GPU bugs and slowdowns are hard to find by **reading code**. Xcode's GPU tools show what **really** happened on the GPU.

**Capture a frame**: while debugging, click the **Metal capture** button (the "M" icon) in the debug bar. Xcode records **one frame** of GPU work, and you can:

- step through **every** command buffer, encoder, and **draw call**, in order,
- inspect every **buffer** and **texture** bound to a draw (see the actual data and images),
- see **GPU time** per draw and per shader, and which shader lines are **hot**,
- **debug a shader**: pick a pixel or vertex and step through the shader code, with variable values,
- view **dependencies** between passes.

More tools:

| Tool | Use for |
|---|---|
| **Metal API Validation** (scheme ▸ Diagnostics) | Catches wrong API use: bad indices, wrong formats. **Keep it on** while developing |
| **Shader Validation** | Catches out-of-bounds memory access **inside** shaders |
| **Metal Performance HUD** (`MTL_HUD_ENABLED=1`) | Live FPS, GPU time, and memory overlay |
| **Instruments ▸ Metal System Trace** | CPU and GPU **timelines** together: who is waiting for whom |

```
Typical investigation:
1. HUD shows 45 FPS instead of 60 → is it the CPU or the GPU?
2. Metal System Trace: the GPU is busy the whole frame → GPU-bound
3. Frame capture: one fragment shader takes 70% of GPU time
4. Shader profiler: a texture sample inside a loop is the hot line → fix it
```

This is the same "**measure, don't guess**" rule as the Core ML performance report (59.7) and the Animation Hitches instrument (62.7). The capture is the **source of truth** for which draw call or shader actually costs the time.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| When to use Metal | Custom renderers, GPU compute | Only when higher-level frameworks can't do it |
| Core objects | `MTLDevice`, `MTLCommandQueue`, `MTLBuffer` | The GPU, a work queue, and shared memory |
| Render pipeline | `MTLRenderPipelineState`, `MTKView` | Build once (slow); draw every frame (fast) |
| Shader language | MSL, `[[attributes]]`, address spaces | C++-based GPU code with explicit data binding |
| Vertex and fragment | `vertex`, `fragment`, `[[stage_in]]` | Where things go, then what color each pixel is |
| Compute | `kernel`, `dispatchThreads`, `thread_position_in_grid` | Parallel work on large data |
| Ready-made kernels | MPS, MPSGraph | Tuned blur, matrix, and ML operations |
| Upscaling | MetalFX spatial and temporal scalers | Render fewer pixels, upscale smartly |
| Debugging | Frame capture, validation, HUD, Metal System Trace | Measure what the GPU really did |
