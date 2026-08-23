## 63.1 Why and When to Reach for Metal

Metal provides direct, low-level access to the GPU — appropriate when an app's graphics or compute needs genuinely exceed what higher-level frameworks (SwiftUI's `Canvas`, Core Animation, Core Image, or even RealityKit, covered in section 64) can provide, such as a custom game engine, a highly specialized rendering technique, or GPU-accelerated general computation beyond image filtering.

```swift
import Metal

// Metal is appropriate when higher-level frameworks genuinely can't meet the need:
// - Custom game rendering with full control over the graphics pipeline
// - GPU compute for large-scale parallel numerical work (beyond Core Image's filter model)
// - Specialized rendering techniques not expressible through Core Animation/Core Image
```

Reaching for Metal directly is a meaningful escalation in both power and responsibility compared to every higher-level graphics framework covered elsewhere in this curriculum (Core Animation's layer tree, section 62; Core Image's filter graph, section 62.10; RealityKit's entity-component model, section 64.1) — Metal provides essentially complete control over the GPU, but also requires the developer to correctly handle far more of what those higher-level frameworks otherwise manage automatically, making it the right choice specifically when that higher-level automation is what's actually standing in the way of a genuine requirement.

---

## 63.2 Devices, Command Queues, and Buffers

`MTLDevice` represents the actual GPU hardware, `MTLCommandQueue` schedules work for that device to execute, and `MTLBuffer` holds data (vertex data, uniforms, compute input/output) accessible to GPU code — the foundational objects underlying essentially all Metal work.

```swift
guard let device = MTLCreateSystemDefaultDevice() else {
    fatalError("Metal is not supported on this device")
}
let commandQueue = device.makeCommandQueue()!

let vertexData: [Float] = [0, 1, 0, -1, -1, 0, 1, -1, 0]
let buffer = device.makeBuffer(bytes: vertexData, length: vertexData.count * MemoryLayout<Float>.size, options: [])
```

This trio of core objects establishes Metal's fundamental execution model — a `MTLDevice` is typically created once per app (the GPU itself doesn't change during a session), a `MTLCommandQueue` is created once and reused to submit work over the app's lifetime, and `MTLBuffer` instances are created as needed to hold the actual data the GPU will read from or write to, forming the basic building blocks every subsequent Metal concept (render pipelines, shaders, compute) is built on top of.

---

## 63.3 Your First Render Pipeline

A Metal render pipeline (`MTLRenderPipelineState`) describes the complete configuration for a drawing operation — which vertex and fragment shader functions to use, pixel format, and other fixed-function state — compiled once and reused across many actual draw calls for efficiency.

```swift
func buildPipeline(device: MTLDevice, library: MTLLibrary) throws -> MTLRenderPipelineState {
    let descriptor = MTLRenderPipelineDescriptor()
    descriptor.vertexFunction = library.makeFunction(name: "vertexShader")
    descriptor.fragmentFunction = library.makeFunction(name: "fragmentShader")
    descriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
    return try device.makeRenderPipelineState(descriptor: descriptor)
}
```

Compiling a `MTLRenderPipelineState` is a genuinely expensive operation relative to the cost of actually using it to draw — the pipeline state should be built once (typically at setup time) and reused across every subsequent frame's draw calls, rather than rebuilt per-frame, mirroring a similar "pay the setup cost once, reuse repeatedly" principle seen elsewhere in this curriculum, like `AVAssetExportSession`'s presets (section 55.12) being configured once rather than reconstructed for every export.

---

## 63.4 Metal Shading Language Basics

Metal Shading Language (MSL) is a C++-based language for writing GPU shader and compute code, compiled either at build time or (less commonly) at runtime into a `MTLLibrary` containing the actual GPU-executable functions a render or compute pipeline references by name.

```cpp
// MSL, typically in a .metal file compiled as part of the Xcode build:
#include <metal_stdlib>
using namespace metal;

struct VertexOut {
    float4 position [[position]];
    float4 color;
};

vertex VertexOut vertexShader(uint vertexID [[vertex_id]],
                                constant float3 *vertices [[buffer(0)]]) {
    VertexOut out;
    out.position = float4(vertices[vertexID], 1.0);
    out.color = float4(1.0, 0.0, 0.0, 1.0);
    return out;
}
```

MSL's C++ foundation, combined with attribute annotations like `[[position]]`, `[[vertex_id]]`, and `[[buffer(0)]]`, explicitly declares how data flows between the CPU-side Swift code (which buffers get bound where) and the GPU-side shader function — this explicit, attribute-driven binding is meaningfully more low-level and manual than, say, `@Generable`'s implicit structural binding in Foundation Models (section 58.7), reflecting Metal's position at the opposite end of the abstraction spectrum from high-level, declarative frameworks.

---

## 63.5 Vertex and Fragment Shaders

The graphics pipeline's two primary programmable stages are the vertex shader (runs once per vertex, transforming vertex positions and computing per-vertex data like color or texture coordinates) and the fragment shader (runs once per pixel/fragment, computing the final color to be written to the screen).

```cpp
fragment float4 fragmentShader(VertexOut in [[stage_in]]) {
    return in.color;  // simplest possible fragment shader: just output the interpolated color
}
```

The `[[stage_in]]` attribute signals that this fragment shader receives its input via automatic interpolation of the vertex shader's per-vertex outputs across each triangle's surface — a vertex shader might set a different color at each of a triangle's three corners, and the GPU automatically interpolates that color smoothly across the triangle's interior before the fragment shader runs for each covered pixel, which is precisely how smooth color gradients across a triangle's surface are achieved without any explicit interpolation code in the fragment shader itself.

---

## 63.6 Compute Shaders

Beyond the graphics-specific vertex/fragment pipeline, Metal compute shaders (`MTLComputePipelineState`, kernel functions) provide general-purpose GPU computation — massively parallel numerical work not tied to rendering a triangle to the screen, appropriate for tasks like image processing, physics simulation, or any problem naturally expressible as many independent, parallel operations.

```cpp
kernel void doubleValues(device float *data [[buffer(0)]],
                          uint index [[thread_position_in_grid]]) {
    data[index] = data[index] * 2.0;
}
```

Compute shaders reflect a genuinely different execution model than the vertex/fragment pipeline — rather than being tied to rendering geometry, a compute kernel is dispatched across a grid of threads (each identified by `thread_position_in_grid`), with each thread independently processing its own slice of the data, making compute shaders appropriate for problems that are fundamentally about parallel data processing rather than drawing pixels, a distinction worth keeping clear when deciding which pipeline type a given GPU task actually needs.

---

## 63.7 Metal Performance Shaders

Metal Performance Shaders (MPS) provides a library of pre-built, highly optimized GPU kernels for common operations — image processing (blur, resize, convolution), matrix operations, and neural network primitives — sparing developers from hand-writing and tuning their own MSL kernels for these frequently-needed operations.

```swift
import MetalPerformanceShaders

func applyGaussianBlur(to texture: MTLTexture, device: MTLDevice, commandBuffer: MTLCommandBuffer) -> MTLTexture {
    let blur = MPSImageGaussianBlur(device: device, sigma: 4.0)
    let outputTexture = /* allocate output texture matching input dimensions */ texture
    blur.encode(commandBuffer: commandBuffer, sourceTexture: texture, destinationTexture: outputTexture)
    return outputTexture
}
```

MPS's relationship to raw Metal programming parallels Core ML's relationship to raw neural network implementation (recall section 59) — in both cases, a higher-level, pre-optimized library handles the substantial engineering effort of correctly and efficiently implementing a common operation, letting a developer reach for a well-tested, already-tuned kernel (like Gaussian blur) rather than writing and tuning custom MSL from scratch for functionality that's already been solved well.

---

## 63.8 MetalFX Upscaling

MetalFX provides GPU-accelerated upscaling (`MTLFXSpatialScaler`, `MTLFXTemporalScaler`) — rendering a scene at a lower internal resolution for better performance, then intelligently upscaling to the target display resolution, trading a controlled amount of image quality for a meaningful performance gain, particularly valuable for demanding real-time rendering like games.

```swift
let scalerDescriptor = MTLFXSpatialScalerDescriptor()
scalerDescriptor.inputWidth = 960
scalerDescriptor.inputHeight = 540
scalerDescriptor.outputWidth = 1920
scalerDescriptor.outputHeight = 1080
scalerDescriptor.colorTextureFormat = .bgra8Unorm
let scaler = scalerDescriptor.makeSpatialScaler(device: device)
```

This performance/quality trade-off directly parallels the quantization/palettization trade-off discussed for Core ML models (section 59.5) — just as compressing a model's weights trades some prediction accuracy for meaningfully reduced size, rendering at a lower internal resolution and upscaling trades some image fidelity for meaningfully improved frame rate, with MetalFX's intelligent upscaling algorithms specifically designed to minimize the perceptible quality cost relative to naive, simple upscaling approaches.

---

## 63.9 Profiling with the Metal Debugger

Xcode's Metal debugger (accessed via the GPU frame capture tool) lets a developer step through an individual captured frame's actual GPU commands, inspect resource bindings, and visualize performance bottlenecks — the Metal-specific analog to Instruments' Core Animation instrument (section 62.7) for diagnosing rendering performance.

```plaintext
// Not a Swift API — accessed via Xcode's GPU frame capture button during a debug session:
// Capturing a frame reveals the actual sequence of draw calls, resource bindings,
// and per-stage GPU timing for that specific frame, letting a developer pinpoint
// exactly which draw call or shader stage is consuming the most GPU time.
```

Frame capture's ability to inspect the *actual* sequence of GPU commands and their measured timing — rather than reasoning about performance purely from source code — mirrors the same "measure, don't guess" principle underlying the Core ML performance report (section 59.7) and the Core Animation instrument (section 62.7): for GPU-bound work specifically, the Metal debugger's frame capture is the authoritative tool for identifying which specific draw call, shader, or resource binding is actually responsible for a given frame's performance cost.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| When to use Metal | Low-level GPU access | For needs exceeding higher-level graphics frameworks |
| Foundational objects | `MTLDevice`, `MTLCommandQueue`, `MTLBuffer` | GPU handle, work scheduling, and data storage |
| Pipeline configuration | `MTLRenderPipelineState` | Compiled once, reused across many draw calls |
| Shader language | Metal Shading Language (MSL) | C++-based GPU code with explicit CPU/GPU data binding |
| Per-vertex/per-pixel stages | Vertex and fragment shaders | Geometry transformation and final pixel color computation |
| General GPU computation | Compute shaders, `MTLComputePipelineState` | Massively parallel, non-rendering-specific work |
| Pre-built GPU operations | Metal Performance Shaders (MPS) | Optimized kernels for common image/compute operations |
| Resolution/performance trade-off | MetalFX (`MTLFXSpatialScaler`) | Lower internal render resolution with intelligent upscaling |
| Frame-level diagnostics | Metal debugger, GPU frame capture | Authoritative, measured GPU performance inspection |
