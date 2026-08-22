## 59.1 What Core ML Does and When to Use It

Core ML runs a pre-trained (or on-device-trained) machine learning model efficiently on Apple hardware — distinct from Foundation Models' general-purpose, pre-built language model (section 58), Core ML is the framework of choice when an app needs a *custom* model for a specific, often narrower task (image classification, a custom recommendation model, a domain-specific prediction task).

```swift
import CoreML

// Core ML is appropriate when:
// - You have (or can obtain/train) a model for a specific task not covered by
//   a general-purpose framework like Foundation Models or Vision
// - You need full control over model architecture and training data
// - The task is narrow and well-defined (classification, regression, custom detection)
```

The distinction from Foundation Models matters for architectural decision-making — Foundation Models provides a single, general-purpose, ready-to-use language model with no training required, while Core ML is the right tool when an app's needs are genuinely custom (a specific classification task trained on domain-specific data that no general-purpose model would know) and a bespoke model, either trained in-house or sourced from elsewhere, is the more appropriate fit.

---

## 59.2 Adding a Core ML Model to a Project

A trained model, packaged as an `.mlmodel` or `.mlpackage` file, is added directly to an Xcode project — Xcode automatically generates a strongly-typed Swift interface class matching the model's inputs and outputs, letting the model be used with ordinary, type-safe Swift code rather than manual tensor manipulation.

```swift
// After dragging RecipeClassifier.mlpackage into the project,
// Xcode generates a `RecipeClassifier` class automatically:
let model = try RecipeClassifier(configuration: MLModelConfiguration())
```

This automatic code generation is a significant developer-experience advantage — rather than manually constructing input tensors and parsing raw output tensors, the generated interface exposes properly typed Swift properties matching the model's actual defined inputs and outputs, making integrating a Core ML model feel similar to calling any other strongly-typed Swift API rather than working with a lower-level machine learning runtime directly.

---

## 59.3 Making a Prediction

Once a model is loaded, `prediction(input:)` (or the generated convenience initializer's direct method) runs inference synchronously against a given input, returning a strongly-typed output matching the model's defined output schema.

```swift
func classifyRecipe(ingredients: [String]) throws -> String {
    let model = try RecipeClassifier(configuration: MLModelConfiguration())
    let input = RecipeClassifierInput(ingredientList: ingredients.joined(separator: ", "))
    let output = try model.prediction(input: input)
    return output.cuisineType
}
```

Because `prediction(input:)` runs synchronously and can take meaningful time for larger models, it's standard practice to run predictions off the main thread (via a background `Task` or dispatch queue) for anything beyond trivially small, fast models — a direct parallel to the general principle of keeping expensive, blocking work off the main thread, consistent with concerns raised throughout this curriculum around UI responsiveness.

---

## 59.4 Converting Models with coremltools

Models trained in other frameworks (PyTorch, TensorFlow, scikit-learn) are converted into Core ML's `.mlmodel`/`.mlpackage` format using Apple's `coremltools` Python package — a separate, offline conversion step performed before the model is ever added to an Xcode project.

```python
# Python, using coremltools — not Swift, but a necessary step before Swift integration:
import coremltools as ct

mlmodel = ct.convert(
    pytorch_model,
    inputs=[ct.TensorType(shape=(1, 3, 224, 224))]
)
mlmodel.save("MyModel.mlpackage")
```

This conversion step is a genuinely necessary bridge, since the vast majority of published machine learning models and research are trained using PyTorch or TensorFlow, not Core ML's native format directly — `coremltools` translates a model's architecture and trained weights into Core ML's format, which is what then makes the model usable within the strongly-typed, Xcode-integrated workflow described in 59.2.

---

## 59.5 Quantization and Palettization

Quantization reduces a model's numeric precision (e.g., converting 32-bit floating point weights to 8-bit integers), while palettization clusters weight values into a smaller lookup table of representative values — both techniques substantially shrink a model's file size and can improve inference speed, generally at some cost to prediction accuracy.

```python
import coremltools.optimize.coreml as cto

config = cto.OptimizationConfig(
    global_config=cto.OpPalettizerConfig(nbits=4)
)
compressed_model = cto.palettize_weights(mlmodel, config)
```

This size/accuracy trade-off is a real, consequential decision for on-device deployment — a full-precision model might be prohibitively large for an app bundle or for reasonable download size, while an overly aggressive compression could meaningfully degrade prediction quality, meaning the right level of quantization/palettization requires actually measuring accuracy impact against the target task's specific tolerance for error, not simply applying maximum compression by default.

---

## 59.6 Compute Units: CPU, GPU, Neural Engine

`MLModelConfiguration.computeUnits` controls which hardware Core ML is permitted to use for inference — CPU only, CPU and GPU, or all available compute units including the Neural Engine (Apple's dedicated ML accelerator) — with Core ML automatically choosing the most efficient available unit per operation unless explicitly restricted.

```swift
let config = MLModelConfiguration()
config.computeUnits = .all // let Core ML choose CPU, GPU, or Neural Engine per operation
let model = try RecipeClassifier(configuration: config)
```

Leaving `computeUnits` at `.all` (the default) is generally the right choice for most apps, letting Core ML's own scheduling intelligently select the fastest available option per operation — explicitly restricting to `.cpuOnly` is occasionally useful for specific debugging or consistency needs (like ensuring identical numeric results across runs, since GPU/Neural Engine execution can introduce minor floating-point differences), but sacrifices real performance in the general case.

---

## 59.7 The Core ML Performance Report

Xcode's Core ML model viewer includes a performance report tool that runs a model against actual target devices (physical or simulated), showing per-operation latency and which compute unit actually executed each operation — surfacing bottlenecks and unexpected compute unit assignment before a model ships.

```plaintext
// Not a Swift API — accessed via Xcode's Core ML model inspector:
// Select the .mlpackage file, choose the "Performance" tab,
// select a target device, and run the report to see per-layer
// latency and actual compute unit assignment (CPU/GPU/ANE).
```

This visibility into *actual* compute unit assignment (as opposed to just the `.all` configuration's aspirational intent from 59.6) is genuinely valuable, since certain operations within a model architecture may not actually be supported by the Neural Engine and silently fall back to CPU or GPU execution — the performance report is how a developer discovers this kind of unexpected fallback and its latency impact before the model ships in a production build.

---

## 59.8 MLTensor and Stateful Models 🔴

`MLTensor` provides a Swift-native, differentiable-computation-friendly tensor type for more direct, flexible model interaction beyond the strongly-typed generated interface, while stateful models (introduced for capabilities like efficient multi-turn transformer inference) maintain internal state across successive prediction calls rather than treating each call as fully independent.

```swift
// Stateful models avoid recomputing shared context on every call —
// conceptually similar to how a LanguageModelSession (section 58.3)
// maintains conversation state across turns, but at Core ML's lower level:
let state = model.makeState()
let output1 = try model.prediction(input: input1, using: state)
let output2 = try model.prediction(input: input2, using: state) // benefits from prior state
```

Stateful model support addresses a genuine efficiency gap for certain model architectures (particularly transformer-based models processing sequential input) — without statefulness, each prediction call would need to recompute shared context from scratch, while a stateful model can carry forward relevant internal computation across calls, directly analogous to the efficiency benefit of session-based conversation continuity seen in Foundation Models (58.3), but implemented here at Core ML's lower, more general level.

---

## 59.9 Create ML for On-Device Training 🔴

Create ML provides both a standalone macOS app and a Swift framework for training Core ML models directly — including genuinely on-device (or on-Mac) training for tasks like personalizing a model to an individual user's own data, without that data ever needing to leave the device to a cloud training pipeline.

```swift
import CreateML

func trainClassifier(trainingData: MLDataTable) throws -> MLClassifier {
    let classifier = try MLClassifier(trainingData: trainingData, targetColumn: "label")
    return classifier
}
```

On-device training's privacy advantage directly parallels the on-device inference advantages already discussed for Foundation Models (58.1) and Translation (57.15) — a model that personalizes itself to a specific user's data (like learning that user's personal handwriting style for improved recognition, or their specific usage patterns) can do so entirely locally, without that potentially sensitive personal training data ever needing to be transmitted to an external training service.

---

## 59.10 The Core AI Framework for Custom Local Models (iOS 27) 🔴

iOS 27 introduces the Core AI framework, providing infrastructure for running custom local models (beyond the single general-purpose Foundation Models LLM) with tighter platform integration than raw Core ML alone — appropriate for apps needing more specialized on-device model capability than the general-purpose Foundation Models framework provides, but with more platform-level support than assembling a fully custom Core ML pipeline from scratch.

```plaintext
// Conceptually: Core AI sits between Foundation Models' general-purpose LLM
// and raw Core ML's fully custom model flexibility, providing a middle-ground
// toolkit for teams building specialized, custom local model experiences.
```

This positions Core AI as filling a genuine gap in the on-device AI framework landscape — Foundation Models covers the general-purpose, ready-to-use LLM case well, while Core ML provides maximum flexibility at the cost of more implementation responsibility, and Core AI's tighter platform integration is aimed at teams whose needs sit meaningfully between those two extremes, needing custom model capability without building every piece of supporting infrastructure themselves.

---

## 59.11 MLX on Apple Silicon 🔴

MLX is an open-source array/machine-learning framework, developed by Apple, specifically optimized for Apple silicon's unified memory architecture — distinct from Core ML's inference-focused, production-app-integration design, MLX is more commonly used for research, experimentation, and training workloads that benefit from Apple silicon's specific memory architecture advantages.

```python
# MLX (Python, though Swift bindings also exist) —
# note the unified-memory-aware design distinct from Core ML's inference focus:
import mlx.core as mx

a = mx.array([1, 2, 3])
b = a * 2  # operations leverage Apple silicon's unified memory directly
```

MLX and Core ML serve genuinely different primary purposes despite both targeting Apple hardware — Core ML is the production-oriented, app-integration-focused framework covered throughout the rest of this section (strongly-typed Swift interfaces, Xcode integration, deployment-ready compression tooling), while MLX is more commonly reached for during research, prototyping, and training phases, with converted or exported models then potentially deployed via Core ML for actual production app integration.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Core ML's role | Custom, narrow-task models | Distinct from Foundation Models' general-purpose LLM |
| Project integration | `.mlpackage`, generated Swift class | Strongly-typed, Xcode-integrated model interface |
| Inference | `model.prediction(input:)` | Synchronous prediction, best run off the main thread |
| Format conversion | `coremltools` (Python) | Converts PyTorch/TensorFlow models to Core ML format |
| Size reduction | Quantization, palettization | Smaller models, with an accuracy trade-off |
| Hardware targeting | `MLModelConfiguration.computeUnits` | CPU/GPU/Neural Engine selection |
| Performance diagnosis | Xcode Core ML performance report | Per-operation latency and actual compute unit assignment |
| Efficient sequential inference | `MLTensor`, stateful models | Carries state across prediction calls |
| Private personalization | Create ML | On-device model training without data leaving the device |
| Middle-ground tooling | Core AI framework (iOS 27) | Specialized local models with platform integration |
| Research/training | MLX | Apple-silicon-optimized array/ML framework |
