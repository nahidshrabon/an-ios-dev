**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 60.1 Vision Framework: The Modern Swift API 🟢

**Vision** lets your app understand images: find text, faces, barcodes, and more. Every job follows the **same pattern**:

1. Make a **handler** for an image.
2. Make a **request** for what you want (text, faces, and so on).
3. **Perform** the request. You get typed **observations** back.

```swift
import Vision

func performVisionRequest(on cgImage: CGImage) async throws -> [Observation] {
    let handler = ImageRequestHandler(cgImage)
    let request = RecognizeTextRequest()
    return try await handler.perform(request)
}
```

This modern API uses `async`/`await`. One `await handler.perform(request)` replaces the old `VNImageRequestHandler` and `VNRequest` code that needed completion handlers. Other frameworks moved the same way (StoreKit in section 56.2, PhotoKit in section 55.2).

To use it, swap the request type:

```swift
let textRequest = RecognizeTextRequest()          // find text
let barcodeRequest = DetectBarcodesRequest()      // find barcodes
let faceRequest = DetectFaceRectanglesRequest()   // find faces
```

---

## 60.2 Text Recognition and OCR 🟢

**OCR** (optical character recognition) reads text from an image. `RecognizeTextRequest` returns the text, where it is, and how sure Vision is. The same job can become a tool for Foundation Models (the `TextRecognitionTool` in 58.13).

```swift
func recognizeText(in cgImage: CGImage) async throws -> [String] {
    let handler = ImageRequestHandler(cgImage)
    let request = RecognizeTextRequest()
    let observations = try await handler.perform(request)
    return observations.compactMap { $0.topCandidates(1).first?.string }
}
```

Use it from a view model:

```swift
@Observable
final class ScannerViewModel {
    var lines: [String] = []

    func scan(_ image: UIImage) async {
        guard let cgImage = image.cgImage else { return }
        lines = (try? await recognizeText(in: cgImage)) ?? []
    }
}
```

`topCandidates(1)` asks for the **best guess**. OCR is never certain, so Vision can give several guesses, ranked by confidence. For a blurry receipt, you could look at more than one.

---

## 60.3 Barcode and QR Detection 🟢

`DetectBarcodesRequest` finds barcodes and QR codes, and gives you the **text inside** and **where** each one is.

```swift
func detectBarcodes(in cgImage: CGImage) async throws -> [String] {
    let handler = ImageRequestHandler(cgImage)
    let request = DetectBarcodesRequest()
    let observations = try await handler.perform(request)
    return observations.compactMap { $0.payloadStringValue }
}
```

Use the result:

```swift
let codes = try await detectBarcodes(in: cgImage)
if let first = codes.first {
    print("Scanned: \(first)")        // for example a URL or a product number
}
```

For **live scanning**, feed each frame from the camera into the same request. The camera side uses `AVCaptureVideoDataOutput` (section 55.7). The user does not need to take a photo first.

---

## 60.4 Face and Body Detection 🟡

Vision can find **faces** and **body poses**:

- `DetectFaceRectanglesRequest`: a box around each face (fast).
- `DetectFaceLandmarksRequest`: points for eyes, nose, and mouth.
- `DetectHumanBodyPoseRequest`: positions of the body's joints.

```swift
func detectFaces(in cgImage: CGImage) async throws -> [CGRect] {
    let handler = ImageRequestHandler(cgImage)
    let request = DetectFaceRectanglesRequest()
    let observations = try await handler.perform(request)
    return observations.map { $0.boundingBox }
}
```

A `boundingBox` is **normalized** (values from 0 to 1) and its origin is the **bottom-left**. To draw it on the image, convert it:

```swift
func imageRect(for box: CGRect, imageWidth w: CGFloat, imageHeight h: CGFloat) -> CGRect {
    CGRect(
        x: box.minX * w,
        y: (1 - box.maxY) * h,        // flip the y axis
        width: box.width * w,
        height: box.height * h
    )
}
```

Pick by need:

- **How many faces are in the photo?** Rectangles are enough, and faster.
- **A filter on the eyes, or checking exercise form?** You need landmarks or body pose.

---

## 60.5 Image Feature Prints and Similarity 🟡

A **feature print** is a short list of numbers that describes what an image looks like. Two images that look alike have feature prints that are **close**. This lets you find similar or duplicate images without comparing pixels.

```swift
func computeSimilarity(imageA: CGImage, imageB: CGImage) async throws -> Float {
    let handlerA = ImageRequestHandler(imageA)
    let handlerB = ImageRequestHandler(imageB)
    let request = GenerateImageFeaturePrintRequest()
    let printA = try await handlerA.perform(request).first!
    let printB = try await handlerB.perform(request).first!
    return try printA.featurePrint.distance(to: printB.featurePrint)
}
```

Read the result:

```swift
let distance = try await computeSimilarity(imageA: photo1, imageB: photo2)
// A small number means the images look alike. A big number means they are different.
let isDuplicate = distance < 0.5   // choose your own limit by testing
```

This is the same idea as text embeddings in 60.9: turn something complex into numbers, so that **"similar" means "close"**.

---

## 60.6 Document and Rectangle Detection 🟡

`DetectDocumentSegmentationRequest` and `DetectRectanglesRequest` find **paper or other rectangles** in an image, even when the photo is taken at an angle. They return the **corner points**.

```swift
func detectDocument(in cgImage: CGImage) async throws -> [VNPoint] {
    let handler = ImageRequestHandler(cgImage)
    let request = DetectDocumentSegmentationRequest()
    let observations = try await handler.perform(request)
    return observations.first?.topLeft.map { [$0] } ?? []
}
```

This is how "scan a document" works in the Notes app:

1. Find the **four corners** of the paper.
2. Use a **perspective correction** to straighten the photo.
3. Show a clean, flat, top-down page.

This is much better than only cropping the photo, because cropping does not fix the camera angle.

---

## 60.7 SpeechAnalyzer and SpeechTranscriber 🟡

`SpeechAnalyzer` with `SpeechTranscriber` turns **speech into text**, on the device. It replaces the older `SFSpeechRecognizer`, and works with both audio files and live audio.

```swift
import Speech

func transcribeAudio(from url: URL) async throws -> String {
    let transcriber = SpeechTranscriber(locale: .current)
    let analyzer = SpeechAnalyzer(modules: [transcriber])
    let audioFile = try AVAudioFile(forReading: url)
    try await analyzer.analyzeSequence(from: audioFile)

    var fullText = ""
    for try await result in transcriber.results {
        fullText += result.text
    }
    return fullText
}
```

Use it:

```swift
let text = try await transcribeAudio(from: voiceMemoURL)
print(text)   // "Remember to buy flour and eggs."
```

It runs **on the device**, so it is private and works offline. A private voice memo or a confidential meeting never has to be uploaded. This is the same benefit as on-device translation (57.15) and Foundation Models (58.1).

---

## 60.8 Natural Language: Tokenization and Tagging 🟢

The **Natural Language** framework works with text:

- **`NLTokenizer`:** splits text into words, sentences, or paragraphs, using the rules of the language.
- **`NLTagger`:** puts a label on each piece, like noun or verb, a person's name, or a place.

```swift
import NaturalLanguage

func tagPartsOfSpeech(in text: String) -> [(String, String)] {
    let tagger = NLTagger(tagSchemes: [.lexicalClass])
    tagger.string = text
    var results: [(String, String)] = []
    tagger.enumerateTags(in: text.startIndex..<text.endIndex, unit: .word, scheme: .lexicalClass) { tag, range in
        if let tag {
            results.append((String(text[range]), tag.rawValue))
        }
        return true
    }
    return results
}
```

Splitting into sentences:

```swift
func sentences(in text: String) -> [String] {
    let tokenizer = NLTokenizer(unit: .sentence)
    tokenizer.string = text
    var result: [String] = []
    tokenizer.enumerateTokens(in: text.startIndex..<text.endIndex) { range, _ in
        result.append(String(text[range]))
        return true
    }
    return result
}
```

Detecting the language:

```swift
let language = NLLanguageRecognizer.dominantLanguage(for: "Bonjour tout le monde")
print(language?.rawValue ?? "unknown")   // "fr"
```

**Why not just split on spaces?** Many languages do not use spaces between words. And even in English, punctuation, contractions, and sentence ends need real language rules. `NLTokenizer` knows them.

---

## 60.9 Natural Language: Embeddings and Similarity 🟡

`NLEmbedding` has ready-made **embeddings**: lists of numbers that capture the **meaning** of a word or sentence. Words with similar meaning are **close**. Use it for "related items" and similarity search.

```swift
func findSimilarWords(to word: String) -> [(String, Double)] {
    guard let embedding = NLEmbedding.wordEmbedding(for: .english) else { return [] }
    return embedding.neighbors(for: word, maximumCount: 5)
}
```

Compare two sentences:

```swift
if let embedding = NLEmbedding.sentenceEmbedding(for: .english) {
    let near = embedding.distance(between: "I love pasta", and: "I enjoy spaghetti")
    let far = embedding.distance(between: "I love pasta", and: "The train is late")
    print(near, far)   // near is smaller than far
}
```

This is the same idea as image feature prints (60.5), but for text. And you do not need to train your own model.

---

## 60.10 Sound Analysis Basics 🟡

**Sound Analysis** (`SNAudioStreamAnalyzer` with `SNClassifySoundRequest`) tells you **what kind of sound** it hears: a dog barking, a doorbell, applause, and hundreds more.

```swift
import SoundAnalysis

func classifySound(from buffer: AVAudioPCMBuffer) throws {
    let analyzer = try SNAudioStreamAnalyzer(format: buffer.format)
    let request = try SNClassifySoundRequest(classifierIdentifier: .version1)
    try analyzer.add(request, withObserver: soundObserver)
    analyzer.analyze(buffer, atAudioFramePosition: 0)
}
```

The results come to an **observer**:

```swift
final class SoundObserver: NSObject, SNResultsObserving {
    func request(_ request: SNRequest, didProduce result: SNResult) {
        guard let result = result as? SNClassificationResult,
              let best = result.classifications.first else { return }
        print(best.identifier, best.confidence)   // for example "dog_bark", 0.93
    }
}
```

**Not the same as ShazamKit** (section 55.15):

| | Sound Analysis | ShazamKit |
|---|---|---|
| Question | "What kind of sound is this?" | "Which song is this?" |
| Example | A dog barking, glass breaking | "Bohemian Rhapsody" |
| Good for | Accessibility, ambient context | Music recognition |

---

## 60.11 Image Playground and Genmoji APIs 🟡

**Image Playground** makes images from a text description or a photo. It shows in a **standard system sheet**. **Genmoji** does the same for custom emoji-like images.

```swift
import ImagePlayground

struct GenerateImageButton: View {
    @State private var showPlayground = false
    var body: some View {
        Button("Generate Image") { showPlayground = true }
            .imagePlaygroundSheet(isPresented: $showPlayground) { url in
                // handle the generated image at `url`
            }
    }
}
```

You do not connect to a third-party image service. Apple's system handles the generation, on the device or in a hybrid way, and shows one **consistent** screen across all apps. It is like `SubscriptionStoreView` (section 56.6), which gives a standard purchase screen instead of one you build yourself.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Vision pattern | `ImageRequestHandler`, async requests | Handler, request, observations |
| OCR | `RecognizeTextRequest` | Read text, with candidates and confidence |
| Barcodes | `DetectBarcodesRequest` | Read barcodes and QR codes |
| Faces and bodies | `DetectFaceRectanglesRequest`, body pose | Boxes, landmarks, joints |
| Image similarity | `GenerateImageFeaturePrintRequest` | Close numbers mean similar images |
| Document scanning | `DetectDocumentSegmentationRequest` | Find corners, straighten the page |
| Speech to text | `SpeechAnalyzer`, `SpeechTranscriber` | On-device transcription |
| Splitting text | `NLTokenizer` | Words and sentences, by language rules |
| Tagging text | `NLTagger` | Parts of speech, names, language |
| Text similarity | `NLEmbedding` | Close vectors mean similar meaning |
| Sound categories | `SNClassifySoundRequest` | What kind of sound it is |
| Generated images | Image Playground, Genmoji | System image generation |
