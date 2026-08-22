## 60.1 Vision Framework: The Modern Swift API

Vision provides a broad suite of computer vision capabilities — text/object/face detection, image similarity, and more — through a consistent request/handler pattern: an `ImageRequestHandler` processes an image against one or more request types, each producing structured, typed observations.

```swift
import Vision

func performVisionRequest(on cgImage: CGImage) async throws -> [Observation] {
    let handler = ImageRequestHandler(cgImage)
    let request = RecognizeTextRequest()
    return try await handler.perform(request)
}
```

This modern, `async`/`await`-native Swift API represents a meaningful simplification over Vision's older `VNImageRequestHandler`/`VNRequest` completion-handler-based pattern — consistent with the broader platform-wide shift toward async/await seen throughout this curriculum (StoreKit's product fetching in section 56.2, PhotoKit's continuation-wrapped calls in section 55.2), Vision's modern API lets a single `await handler.perform(request)` call replace what previously required delegate or completion-handler boilerplate.

---

## 60.2 Text Recognition and OCR

`RecognizeTextRequest` performs optical character recognition on an image, returning recognized text strings along with their bounding boxes and confidence scores — the same underlying capability that could power a Vision-backed tool exposed to Foundation Models (recall section 58.13's `TextRecognitionTool` example).

```swift
func recognizeText(in cgImage: CGImage) async throws -> [String] {
    let handler = ImageRequestHandler(cgImage)
    let request = RecognizeTextRequest()
    let observations = try await handler.perform(request)
    return observations.compactMap { $0.topCandidates(1).first?.string }
}
```

`topCandidates(1)` reflects that OCR is inherently probabilistic — for any given piece of recognized text, Vision can return multiple candidate interpretations ranked by confidence, and requesting just the top candidate is the common case, though an app dealing with genuinely ambiguous or low-quality source images (like a blurry photographed receipt) might reasonably inspect several candidates or confidence scores before committing to a single interpretation.

---

## 60.3 Barcode and QR Detection

`DetectBarcodesRequest` locates and decodes barcodes and QR codes within an image, returning both the decoded payload string and the code's position within the image — commonly paired with live camera frame processing (recall `AVCaptureVideoDataOutput`, section 55.7) for real-time scanning experiences.

```swift
func detectBarcodes(in cgImage: CGImage) async throws -> [String] {
    let handler = ImageRequestHandler(cgImage)
    let request = DetectBarcodesRequest()
    let observations = try await handler.perform(request)
    return observations.compactMap { $0.payloadStringValue }
}
```

Pairing barcode detection with `AVCaptureVideoDataOutput`'s continuous frame stream is what enables a live, real-time scanning experience (rather than requiring the user to manually capture a still photo of a barcode first) — each incoming frame from the capture pipeline can be fed directly into a Vision barcode request, with detected results processed and acted upon as soon as a valid code appears in frame.

---

## 60.4 Face and Body Detection

Vision's face detection (`DetectFaceRectanglesRequest`, `DetectFaceLandmarksRequest`) and body detection (`DetectHumanBodyPoseRequest`) locate faces and body poses within an image, returning bounding boxes, facial landmarks, or a full set of body joint positions, depending on the specific request type used.

```swift
func detectFaces(in cgImage: CGImage) async throws -> [CGRect] {
    let handler = ImageRequestHandler(cgImage)
    let request = DetectFaceRectanglesRequest()
    let observations = try await handler.perform(request)
    return observations.map { $0.boundingBox }
}
```

The distinction between simple rectangle detection and full landmark/pose detection reflects a real granularity trade-off — bounding box detection alone is sufficient and faster for a use case like "how many faces are in this photo," while landmark or full body pose detection (returning individual facial feature points or joint positions) is necessary for more sophisticated use cases like applying a filter aligned to specific facial features or building a fitness app that analyzes exercise form.

---

## 60.5 Image Feature Prints and Similarity

`GenerateImageFeaturePrintRequest` produces a compact, numeric embedding representing an image's visual content — two images with similar visual content produce feature prints with a small computed distance between them, enabling similarity search and near-duplicate detection without needing to compare raw pixel data directly.

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

This feature-print-based similarity approach conceptually parallels the embeddings-and-similarity pattern also seen in Natural Language for text (60.9) — in both cases, complex, high-dimensional content (an image's visual appearance, or a piece of text's meaning) is reduced to a compact numeric representation specifically designed so that semantic or visual similarity translates into small computed distances between representations, enabling efficient similarity search across large collections.

---

## 60.6 Document and Rectangle Detection

`DetectDocumentSegmentationRequest` and `DetectRectanglesRequest` locate document-like or general rectangular shapes within an image (like a piece of paper or a whiteboard captured at an angle), returning the shape's corner points — the foundation for document-scanning features that correct perspective distortion.

```swift
func detectDocument(in cgImage: CGImage) async throws -> [VNPoint] {
    let handler = ImageRequestHandler(cgImage)
    let request = DetectDocumentSegmentationRequest()
    let observations = try await handler.perform(request)
    return observations.first?.topLeft.map { [$0] } ?? []
}
```

Detecting a document's four corners is specifically what enables the classic "scan a document" feature seen in Notes and dedicated scanner apps — once the corner points are known, a perspective-correction transform can warp the photographed, angled document into a clean, rectangular, top-down view, a substantially better result than simply cropping the original photo without correcting for the camera's actual viewing angle.

---

## 60.7 SpeechAnalyzer and SpeechTranscriber

`SpeechAnalyzer`, paired with `SpeechTranscriber`, provides on-device speech-to-text transcription — a modernized, more flexible replacement for the older `SFSpeechRecognizer` API, supporting both file-based and live, streaming audio transcription.

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

Running transcription entirely on-device (rather than requiring an uploaded audio file processed by a cloud speech-to-text service) provides the same privacy and offline-availability benefits already discussed for on-device translation (57.15) and Foundation Models (58.1) — genuinely sensitive audio content, like a private voice memo or a confidential meeting recording, never needs to leave the device for transcription to succeed.

---

## 60.8 Natural Language: Tokenization and Tagging

The Natural Language framework's `NLTokenizer` splits text into words, sentences, or paragraphs according to language-aware rules, while `NLTagger` assigns linguistic tags (part of speech, named entities like people or places, language identification) to tokens within text.

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

`NLTokenizer`'s language-aware splitting is a meaningfully more robust foundation than naive whitespace-based splitting — many languages don't use whitespace to separate words at all (a challenge that would defeat a simple `.split(separator: " ")` approach entirely), and even for languages that do, correctly handling punctuation, contractions, and sentence boundaries requires genuine linguistic awareness rather than simple character-based rules.

---

## 60.9 Natural Language: Embeddings and Similarity

`NLEmbedding` provides pre-trained word and sentence embeddings — numeric vector representations of text meaning, where semantically similar words or sentences produce vectors with small computed distances between them, enabling similarity search, clustering, or "find related content" features.

```swift
func findSimilarWords(to word: String) -> [(String, Double)] {
    guard let embedding = NLEmbedding.wordEmbedding(for: .english) else { return [] }
    return embedding.neighbors(for: word, maximumCount: 5)
}
```

This mirrors the image feature print similarity pattern from 60.5, applied here to text instead of images — both techniques reduce complex, high-dimensional content to a compact vector representation specifically designed so that semantic similarity corresponds to small distances between vectors, and both enable practical features like "find related items" without requiring an app to implement or train its own custom embedding model from scratch.

---

## 60.10 Sound Analysis Basics

The Sound Analysis framework (`SNAudioStreamAnalyzer` with a `SNClassifySoundRequest`) classifies sounds within an audio stream against a built-in taxonomy of everyday sounds (a dog barking, a doorbell, applause, and hundreds of other categories) — distinct from ShazamKit's specific song-matching purpose (section 55.15), Sound Analysis identifies general sound *categories* rather than matching against a specific catalog of known songs.

```swift
import SoundAnalysis

func classifySound(from buffer: AVAudioPCMBuffer) throws {
    let analyzer = try SNAudioStreamAnalyzer(format: buffer.format)
    let request = try SNClassifySoundRequest(classifierIdentifier: .version1)
    try analyzer.add(request, withObserver: soundObserver)
    analyzer.analyze(buffer, atAudioFramePosition: 0)
}
```

The distinction from ShazamKit is worth being precise about — Sound Analysis answers "what kind of sound is this" (a dog barking, glass breaking, a smoke alarm) using a general classification taxonomy, useful for accessibility features (alerting a deaf user to important environmental sounds) or ambient context awareness, while ShazamKit answers the narrower, different question of "what specific song is this," matched against a catalog of known audio fingerprints.

---

## 60.11 Image Playground and Genmoji APIs 🟠

Image Playground provides a system-integrated API for generating images from a text description or existing photo, presented through a standard system UI sheet (`ImagePlaygroundViewController` or a SwiftUI equivalent), while Genmoji extends similar generative capability specifically to creating custom, personalized emoji-like images.

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

Like the other generative capabilities covered in this Part, Image Playground's generation runs through Apple's on-device (or hybrid) generative pipeline via a standardized system UI, rather than requiring an app to integrate a third-party image generation API directly — this provides a consistent, system-standard generation experience across apps, similar in spirit to how `SubscriptionStoreView` (section 56.6) provides consistent, standard purchase UI rather than each app building custom presentation from scratch.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Modern Vision API | `ImageRequestHandler`, async requests | Unified, async/await computer vision access |
| OCR | `RecognizeTextRequest` | Text extraction with candidates and confidence |
| Code scanning | `DetectBarcodesRequest` | Barcode/QR detection, often paired with live capture |
| Face/body analysis | `DetectFaceRectanglesRequest`, body pose requests | Bounding boxes, landmarks, and joint positions |
| Visual similarity | `GenerateImageFeaturePrintRequest` | Compact embeddings for image similarity search |
| Document scanning | `DetectDocumentSegmentationRequest` | Corner detection for perspective correction |
| Speech to text | `SpeechAnalyzer`, `SpeechTranscriber` | On-device, streaming-capable transcription |
| Text segmentation | `NLTokenizer` | Language-aware word/sentence/paragraph splitting |
| Linguistic tagging | `NLTagger` | Part of speech, named entities, language ID |
| Text similarity | `NLEmbedding` | Word/sentence vector embeddings for similarity |
| Ambient sound ID | `SNClassifySoundRequest` | General sound category classification |
| Generative imagery | Image Playground, Genmoji | System-integrated, on-device image generation |
