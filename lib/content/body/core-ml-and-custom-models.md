**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 59.1 What Core ML Does and When to Use It 🟢

**Core ML** runs a **trained machine learning model** on Apple hardware. Use it when you need a **custom model** for one narrow job, like classifying images or predicting something from your own data.

Compare it with Foundation Models (section 58):

| | Foundation Models | Core ML |
|---|---|---|
| Model | One general language model, ready to use | Your own model, for one task |
| Training | None | You train it, or get a model |
| Good for | Chat, summaries, text tasks | Classification, prediction, custom detection |

```swift
import CoreML

// Use Core ML when:
// - You need a model for a specific task that general frameworks don't cover
// - You want full control over the model and its training data
// - The task is narrow and clear (classification, regression, custom detection)
```

---

## 59.2 Adding a Core ML Model to a Project 🟢

Drag a trained model file (`.mlmodel` or `.mlpackage`) into Xcode. Xcode **writes a Swift class for you**, with typed inputs and outputs. You never touch raw tensors.

```swift
// After dragging RecipeClassifier.mlpackage into the project,
// Xcode generates a `RecipeClassifier` class automatically:
let model = try RecipeClassifier(configuration: MLModelConfiguration())
```

It feels like calling any other Swift API:

```swift
let input = RecipeClassifierInput(ingredientList: "flour, eggs, milk")   // typed input
let output = try model.prediction(input: input)
print(output.cuisineType)                                                 // typed output
```

---

## 59.3 Making a Prediction 🟡

`prediction(input:)` runs the model and returns a typed output.

```swift
func classifyRecipe(ingredients: [String]) throws -> String {
    let model = try RecipeClassifier(configuration: MLModelConfiguration())
    let input = RecipeClassifierInput(ingredientList: ingredients.joined(separator: ", "))
    let output = try model.prediction(input: input)
    return output.cuisineType
}
```

It runs **synchronously** and can be slow for big models. **Keep it off the main thread**, or the screen freezes:

```swift
@Observable
final class ClassifierViewModel {
    var cuisine = ""

    func classify(_ ingredients: [String]) async {
        let result = try? await Task.detached {          // runs in the background
            try classifyRecipe(ingredients: ingredients)
        }.value
        cuisine = result ?? "Unknown"                    // update the UI after
    }
}
```

---

## 59.4 Converting Models with coremltools 🟡

Most models are trained in **PyTorch** or **TensorFlow**. To use them, you **convert** them to Core ML first, with Apple's Python package **`coremltools`**. You do this once, offline, **before** you add the model to Xcode.

```python
# Python, using coremltools — not Swift, but a necessary step before Swift integration:
import coremltools as ct

mlmodel = ct.convert(
    pytorch_model,
    inputs=[ct.TensorType(shape=(1, 3, 224, 224))]
)
mlmodel.save("MyModel.mlpackage")
```

A fuller PyTorch example:

```python
import torch
import coremltools as ct

model.eval()                                           # 1. put the model in inference mode
example = torch.rand(1, 3, 224, 224)                   # 2. an example input
traced = torch.jit.trace(model, example)               # 3. record the model's steps

mlmodel = ct.convert(
    traced,
    inputs=[ct.TensorType(name="image", shape=example.shape)],
)
mlmodel.save("MyModel.mlpackage")                      # 4. add this file to Xcode (59.2)
```

---

## 59.5 Quantization and Palettization 🟡

Both make a model **smaller** (and often faster), but may make it a bit **less accurate**.

- **Quantization:** uses less precise numbers. For example, 32-bit decimals become 8-bit integers.
- **Palettization:** groups similar weights and stores a small lookup table of values.

```python
import coremltools.optimize.coreml as cto

config = cto.OptimizationConfig(
    global_config=cto.OpPalettizerConfig(nbits=4)
)
compressed_model = cto.palettize_weights(mlmodel, config)
```

**How palettization works.** Think of a GIF with only 256 colors: each pixel stores a number that points into a small palette. A model does the same with its weights:

```plaintext
Original weights:   0.8123   0.8109   -0.3342   0.8130
Palette:            [0] 0.812    [1] -0.334
Stored indexes:     0        0         1         0
```

1. **Group** weights that are close together.
2. **Pick one value** for each group. These values are the **palette**.
3. **Store a small index** for each weight, not the full number.

`nbits=4` means a palette of 2⁴ = **16 values**. Each weight becomes a 4-bit index instead of 16 bits, so the weights take about **4 times less space**. Fewer bits give a smaller model, but each weight is rounded more.

Compared with quantization, the palette values come **from your own data** and are not evenly spaced.

Quantization looks like this:

```python
import coremltools.optimize.coreml as cto

config = cto.OptimizationConfig(
    global_config=cto.OpLinearQuantizerConfig(mode="linear_symmetric")
)
smaller_model = cto.linear_quantize_weights(mlmodel, config)
```

**Always measure the accuracy** after compressing. A full-size model can be too big for an app. But too much compression can hurt the results, so do not just use the maximum.

---

## 59.6 Compute Units: CPU, GPU, Neural Engine 🟡

`MLModelConfiguration.computeUnits` says **which hardware** Core ML may use. The **Neural Engine** is Apple's chip made for machine learning.

```swift
let config = MLModelConfiguration()
config.computeUnits = .all // let Core ML choose CPU, GPU, or Neural Engine per operation
let model = try RecipeClassifier(configuration: config)
```

| Setting | Uses |
|---|---|
| `.all` (default) | CPU, GPU, and Neural Engine. Core ML chooses. |
| `.cpuAndGPU` | CPU and GPU only |
| `.cpuAndNeuralEngine` | CPU and Neural Engine only |
| `.cpuOnly` | CPU only |

**Leave it on `.all`** for most apps. Use `.cpuOnly` only for special cases, like debugging, or when you need the same numbers on every run. The GPU and Neural Engine can give tiny floating-point differences. `.cpuOnly` is usually slower.

---

## 59.7 The Core ML Performance Report 🟡

Xcode can **run your model on a real device** and show how long each step takes, and **which chip ran it**. This is the **performance report**.

```plaintext
// Not a Swift API — accessed via Xcode's Core ML model inspector:
// Select the .mlpackage file, choose the "Performance" tab,
// select a target device, and run the report to see per-layer
// latency and actual compute unit assignment (CPU/GPU/ANE).
```

Steps:

1. Click your `.mlpackage` in Xcode.
2. Open the **Performance** tab.
3. Pick a device, and run the report.
4. Look at each layer's time, and which chip (CPU, GPU, or Neural Engine) ran it.

Why this matters: `.all` only says Core ML **may** use the Neural Engine. Some steps are not supported there, and they quietly run on the CPU or GPU instead. The report shows this, so you can find the slow parts **before you ship**.

---

## 59.8 MLTensor and Stateful Models 🔴

- **`MLTensor`:** a Swift type for working with tensors directly, when the generated class is not flexible enough.
- **Stateful models:** a model that **remembers state** between predictions. Each call does not start from zero.

```swift
// Stateful models avoid recomputing shared context on every call —
// conceptually similar to how a LanguageModelSession (section 58.3)
// maintains conversation state across turns, but at Core ML's lower level:
let state = model.makeState()
let output1 = try model.prediction(input: input1, using: state)
let output2 = try model.prediction(input: input2, using: state) // benefits from prior state
```

Why it helps: for models like transformers that read a sequence, the model would otherwise redo the shared work on every call. With state, it **keeps that work** and only does the new part.

It works like a `LanguageModelSession`, which keeps the conversation between turns (section 58.3). Here it is done at Core ML's lower level.

---

## 59.9 Create ML for On-Device Training 🔴

**Create ML** trains Core ML models. It comes as a Mac app and as a **Swift framework**. You can even train on the user's own data **without sending it anywhere**.

```swift
import CreateML

func trainClassifier(trainingData: MLDataTable) throws -> MLClassifier {
    let classifier = try MLClassifier(trainingData: trainingData, targetColumn: "label")
    return classifier
}
```

The data is a table, and one column is the answer you want to predict:

```swift
let data = try MLDataTable(contentsOf: URL(fileURLWithPath: "recipes.csv"))   // columns: ingredients, label
let classifier = try trainClassifier(trainingData: data)
```

**The privacy benefit** is the same as for on-device inference (58.1). A model that learns one user's habits, like their handwriting, can train **fully on the device**. Their personal data never goes to a training server.

---

## 59.10 The Core AI Framework for Custom Local Models (iOS 27) 🔴

iOS 27 adds the **Core AI** framework. It is for running **your own local models** with more platform support than raw Core ML.

```plaintext
// Conceptually: Core AI sits between Foundation Models' general-purpose LLM
// and raw Core ML's fully custom model flexibility, providing a middle-ground
// toolkit for teams building specialized, custom local model experiences.
```

Where it fits:

| | Foundation Models | **Core AI** | Core ML |
|---|---|---|---|
| Model | One ready-made LLM | Your own local models | Your own model |
| Platform support | Most | **Some** | Least (you build the rest) |
| Flexibility | Least | Middle | Most |

Choose Core AI when you need more than the one general LLM, but you do not want to build all the supporting parts around Core ML yourself.

---

## 59.11 MLX on Apple Silicon 🔴

**MLX** is an open-source machine learning framework from Apple. It is built for Apple silicon's **unified memory**, where the CPU and GPU share the same memory.

```python
# MLX (Python, though Swift bindings also exist) —
# note the unified-memory-aware design distinct from Core ML's inference focus:
import mlx.core as mx

a = mx.array([1, 2, 3])
b = a * 2  # operations leverage Apple silicon's unified memory directly
```

MLX and Core ML have **different jobs**:

| | MLX | Core ML |
|---|---|---|
| Main use | Research, trying ideas, training | Running models in a shipping app |
| Language | Mostly Python (Swift bindings exist) | Swift, with Xcode integration |
| Extras | Fast experiments on a Mac | Typed classes, compression tools |

A common path: **experiment and train with MLX**, then **export the model and deploy it with Core ML** in your app.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Core ML's role | Custom models for narrow tasks | Different from the one general LLM in section 58 |
| Adding a model | `.mlpackage`, a generated Swift class | Typed, Xcode-integrated interface |
| Predicting | `model.prediction(input:)` | Run it off the main thread |
| Converting | `coremltools` (Python) | Turn PyTorch or TensorFlow models into Core ML |
| Making it smaller | Quantization, palettization | Smaller model, check the accuracy |
| Hardware | `MLModelConfiguration.computeUnits` | Choose CPU, GPU, or Neural Engine |
| Finding slow parts | Xcode performance report | Per-layer time and the chip that ran it |
| Sequences | `MLTensor`, stateful models | Keep state between predictions |
| Private training | Create ML | Train on the device, data stays there |
| Middle option | Core AI (iOS 27) | Custom local models with platform help |
| Research | MLX | Fast experiments and training on Apple silicon |
