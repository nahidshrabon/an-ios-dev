**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Photos, camera, video, and audio are a big part of many apps. This section starts with the **easy, private** way to pick photos, then goes deeper: **PhotoKit**, the **camera** with `AVCaptureSession`, **playback**, **audio sessions**, recording, **editing and exporting** video, **streaming**, MusicKit and ShazamKit, and the **Now Playing** controls on the Lock Screen.

---

## 55.1 PHPickerViewController and Privacy-Preserving Picking 🟢

To let the user **pick** a photo, use **`PhotosPicker`** (SwiftUI) or **`PHPickerViewController`** (UIKit). The best part: **no permission prompt**.

```swift
import SwiftUI
import PhotosUI

struct ProfilePhotoPicker: View {
    @State private var selectedItem: PhotosPickerItem?
    @State private var image: Image?

    var body: some View {
        VStack {
            image?
                .resizable()
                .scaledToFill()
                .frame(width: 120, height: 120)
                .clipShape(.circle)

            PhotosPicker("Choose Photo", selection: $selectedItem, matching: .images)
        }
        .task(id: selectedItem) {                         // re-runs (and cancels) on each new pick
            guard let selectedItem else { return }
            if let data = try? await selectedItem.loadTransferable(type: Data.self),
               let uiImage = UIImage(data: data) {
                image = Image(uiImage: uiImage)
            }
        }
    }
}
```

Why no prompt? The picker runs in a **separate, system process**. Your app never sees the library; it only gets the items the user **chose**. That's the same idea as the extension sandbox (53.1).

Useful options:

```swift
PhotosPicker(selection: $items,                          // [PhotosPickerItem]
             maxSelectionCount: 5,
             selectionBehavior: .ordered,
             matching: .any(of: [.images, .videos]),
             preferredItemEncoding: .compatible) {       // JPEG/H.264 instead of HEIC/HEVC
    Label("Add Photos", systemImage: "photo.on.rectangle")
}
```

**Videos** are big, so load them as a **file**, not as `Data`:

```swift
struct Movie: Transferable {
    let url: URL

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { movie in
            SentTransferredFile(movie.url)
        } importing: { received in
            // The received file is temporary: copy it somewhere we own
            let copy = URL.temporaryDirectory.appending(path: UUID().uuidString + ".mov")
            try FileManager.default.copyItem(at: received.file, to: copy)
            return Movie(url: copy)
        }
    }
}

let movie = try await item.loadTransferable(type: Movie.self)
```

For "pick a profile picture" or "attach photos", this is **always** the right choice. Full library access (55.2) is only for apps that **browse** the library.

---

## 55.2 PhotoKit: Fetching and Displaying Assets 🟡

**PhotoKit** gives **direct** access to the library: for a gallery app, a photo editor, or a backup tool. This **needs permission**:

```swift
import Photos

func requestLibraryAccess() async -> Bool {
    let status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)   // NSPhotoLibraryUsageDescription
    return status == .authorized || status == .limited                        // limited: 55.3
}
```

| Access level | Lets you | Info.plist key |
|---|---|---|
| `.addOnly` | Only **save** new photos | `NSPhotoLibraryAddUsageDescription` |
| `.readWrite` | **Read**, edit, and save | `NSPhotoLibraryUsageDescription` |

Fetch **assets** (photo/video records), newest first:

```swift
func fetchRecentPhotos() -> PHFetchResult<PHAsset> {
    let options = PHFetchOptions()
    options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
    return PHAsset.fetchAssets(with: .image, options: options)
}
```

A **`PHFetchResult`** is **lazy**: it doesn't load 30,000 photos at once. Read items by index as cells appear.

Load an **image** for an asset:

```swift
func loadImage(for asset: PHAsset, targetSize: CGSize) async -> UIImage? {
    let options = PHImageRequestOptions()
    options.deliveryMode = .highQualityFormat          // call the handler ONCE (important!)
    options.isNetworkAccessAllowed = true              // the photo may be in iCloud only

    return await withCheckedContinuation { continuation in
        PHImageManager.default().requestImage(for: asset, targetSize: targetSize,
                                              contentMode: .aspectFill, options: options) { image, _ in
            continuation.resume(returning: image)
        }
    }
}
```

⚠️ By default, `requestImage` may call its handler **twice**: first a **blurry** preview, then the final image. Resuming a continuation twice **crashes** (18.11). Set **`.highQualityFormat`** (one call), or check `PHImageResultIsDegradedKey` in the info dictionary.

More tools:

- **`PHCachingImageManager`**: pre-loads thumbnails for a **scrolling grid**.
- **`PHPhotoLibraryChangeObserver`**: updates your UI when the library changes.
- **Saving**: `PHPhotoLibrary.shared().performChanges { PHAssetChangeRequest.creationRequestForAssetFromImage(image) }`.

---

## 55.3 Limited Photo Library Access 🟢

When asked for library access, the user can choose **Limited Access**: they **select** some photos, and your app sees **only those**.

```swift
let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)

switch status {
case .authorized:   showFullLibrary()
case .limited:      showSelectedPhotosWithManageButton()   // fetches return ONLY the selected ones
case .denied, .restricted: showSettingsHint()
case .notDetermined: Task { await requestLibraryAccess() }
@unknown default:   break
}
```

In limited mode, PhotoKit works **normally**, but every fetch only returns the photos the user **shared**. Your app can't even tell how many others exist.

Give users an easy way to **add more**, with the system's picker:

```swift
// UIKit
PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: viewController)

// iOS 15+: also returns the new selection's identifiers
let identifiers = await PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: viewController)
```

Good apps show a small **"Manage"** or **"Select More Photos"** button in their own gallery when the status is `.limited`.

By default, the system may **remind** the user about the limited selection. If your app has its own "Manage" button, turn that off with **`PHPhotoLibraryPreventAutomaticLimitedAccessAlert`** = `YES` in Info.plist.

Remember: if you only need the user to **pick** photos, use `PhotosPicker` (55.1) and skip all of this.

---

## 55.4 AVCaptureSession Setup 🟡

For a **custom camera** screen, use **AVFoundation**. The center is **`AVCaptureSession`**: it connects **inputs** (camera, microphone) to **outputs** (photos, video files, live frames).

```
Camera ──► AVCaptureDeviceInput ──┐
                                   ├──► AVCaptureSession ──► AVCapturePhotoOutput   (55.5)
Microphone ──► input ─────────────┘            │      ──► AVCaptureMovieFileOutput (55.6)
                                               │      ──► AVCaptureVideoDataOutput (55.7)
                                               └──► AVCaptureVideoPreviewLayer (what the user sees)
```

First, permission (`NSCameraUsageDescription` in Info.plist):

```swift
import AVFoundation

func cameraAllowed() async -> Bool {
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized:    return true
    case .notDetermined: return await AVCaptureDevice.requestAccess(for: .video)
    default:             return false                       // denied: point to Settings
    }
}
```

Then configure the session:

```swift
final class CameraController {
    let session = AVCaptureSession()
    let photoOutput = AVCapturePhotoOutput()
    private let sessionQueue = DispatchQueue(label: "camera.session")   // never block the main thread

    func configure() throws {
        session.beginConfiguration()
        defer { session.commitConfiguration() }               // apply all changes together

        session.sessionPreset = .photo

        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            throw CameraError.noCamera                        // e.g. the Simulator
        }
        let input = try AVCaptureDeviceInput(device: camera)
        guard session.canAddInput(input) else { throw CameraError.cannotAddInput }
        session.addInput(input)

        guard session.canAddOutput(photoOutput) else { throw CameraError.cannotAddOutput }
        session.addOutput(photoOutput)
    }

    func start() {
        sessionQueue.async { self.session.startRunning() }   // blocking call: keep it off main
    }

    func stop() {
        sessionQueue.async { self.session.stopRunning() }
    }
}
```

| Call | Why |
|---|---|
| `beginConfiguration` / `commitConfiguration` | Apply many changes **at once**, not one by one |
| `canAddInput` / `canAddOutput` | Some combinations aren't supported on some devices. Adding anyway **throws an exception** |
| `startRunning()` on a **background** queue | It **blocks** until the camera starts |

Show the live preview in SwiftUI with a small `UIViewRepresentable` (38.1):

```swift
final class PreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
}

struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ uiView: PreviewView, context: Context) {}
}
```

The camera **doesn't work in the Simulator**. Test on a device.

---

## 55.5 Capturing a Photo 🟡

**`AVCapturePhotoOutput`** takes photos. Each shot uses a **new** `AVCapturePhotoSettings`, and the result arrives in a **delegate**:

```swift
final class PhotoCaptureProcessor: NSObject, AVCapturePhotoCaptureDelegate {
    private let completion: (Result<Data, Error>) -> Void

    init(completion: @escaping (Result<Data, Error>) -> Void) {
        self.completion = completion
    }

    func photoOutput(_ output: AVCapturePhotoOutput,
                     didFinishProcessingPhoto photo: AVCapturePhoto,
                     error: Error?) {
        if let error {
            completion(.failure(error))
        } else if let data = photo.fileDataRepresentation() {   // HEIC or JPEG, ready to save
            completion(.success(data))
        } else {
            completion(.failure(CameraError.noData))
        }
    }
}
```

The photo output only holds a **weak** reference to the delegate. Keep it **alive** yourself until the photo arrives:

```swift
extension CameraController {
    func takePhoto() async throws -> Data {
        let settings = AVCapturePhotoSettings()               // NEW settings for every shot
        settings.flashMode = .auto
        settings.photoQualityPrioritization = .balanced       // .speed, .balanced, or .quality

        return try await withCheckedThrowingContinuation { continuation in
            var processor: PhotoCaptureProcessor?
            processor = PhotoCaptureProcessor { result in
                continuation.resume(with: result)
                processor = nil                               // release it when done
            }
            photoOutput.capturePhoto(with: settings, delegate: processor!)
        }
    }
}
```

| Setting | Controls |
|---|---|
| `flashMode` | `.off`, `.on`, `.auto` |
| `photoQualityPrioritization` | Faster shots vs. better processing (limited by the output's `maxPhotoQualityPrioritization`) |
| `AVCapturePhotoSettings(format:)` | HEVC/HEIC vs. JPEG |

Reusing a settings object **throws an exception**: create one per capture.

Save the result to the library (needs **add-only** permission, 55.2):

```swift
try await PHPhotoLibrary.shared().performChanges {
    PHAssetCreationRequest.forAsset().addResource(with: .photo, data: photoData, options: nil)
}
```

---

## 55.6 Capturing Video 🟡

**`AVCaptureMovieFileOutput`** records video straight to a **file**. Add a **microphone** input too (`NSMicrophoneUsageDescription`), or the video has no sound:

```swift
extension CameraController {
    func addMovieOutput(_ movieOutput: AVCaptureMovieFileOutput) throws {
        session.beginConfiguration()
        defer { session.commitConfiguration() }

        if let mic = AVCaptureDevice.default(for: .audio) {
            let micInput = try AVCaptureDeviceInput(device: mic)
            if session.canAddInput(micInput) { session.addInput(micInput) }
        }
        guard session.canAddOutput(movieOutput) else { throw CameraError.cannotAddOutput }
        session.addOutput(movieOutput)
        movieOutput.maxRecordedDuration = CMTime(seconds: 60, preferredTimescale: 600)
    }
}
```

Recording has a **start** and a **stop**, unlike a photo:

```swift
final class RecordingDelegate: NSObject, AVCaptureFileOutputRecordingDelegate {
    var onFinish: ((URL) -> Void)?

    func fileOutput(_ output: AVCaptureFileOutput,
                    didFinishRecordingTo outputFileURL: URL,
                    from connections: [AVCaptureConnection],
                    error: Error?) {
        // ⚠️ An error doesn't always mean failure (e.g. max duration reached)
        let succeeded = (error as NSError?)?
            .userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool ?? (error == nil)
        if succeeded { onFinish?(outputFileURL) }
    }
}

let fileURL = URL.temporaryDirectory.appending(path: "\(UUID().uuidString).mov")  // must not exist yet
movieOutput.startRecording(to: fileURL, recordingDelegate: recordingDelegate)
// ... later, when the user taps Stop:
movieOutput.stopRecording()
```

| | Photo (55.5) | Video |
|---|---|---|
| Shape | One **moment** | A **time span**: start → stop |
| Result | `Data` in a callback | A **file**, after recording finishes |
| Done when | Delegate called | `didFinishRecordingTo` called (file is complete) |

Need more control (custom compression, adding overlays while recording)? Use **`AVAssetWriter`** with data outputs instead. It's more work, but you control every frame.

---

## 55.7 Real-Time Frame Processing with AVCaptureVideoDataOutput 🔴

**`AVCaptureVideoDataOutput`** gives you **every frame**, live (30 or 60 per second), instead of saving a file. Use it for **scanners**, **live filters**, or **Vision** and Core ML features.

```swift
import AVFoundation
import Vision

final class BarcodeFrameProcessor: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    var onCode: ((String) -> Void)?
    private let request = VNDetectBarcodesRequest()

    // Runs on the queue you chose below, once per frame
    func captureOutput(_ output: AVCaptureOutput,
                       didOutput sampleBuffer: CMSampleBuffer,
                       from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: .right)
        try? handler.perform([request])

        if let code = request.results?.first?.payloadStringValue {
            DispatchQueue.main.async { self.onCode?(code) }    // back to main for the UI
        }
    }
}

// Setup:
let videoOutput = AVCaptureVideoDataOutput()
videoOutput.alwaysDiscardsLateVideoFrames = true            // drop frames we can't keep up with
videoOutput.setSampleBufferDelegate(processor, queue: DispatchQueue(label: "camera.frames"))
if session.canAddOutput(videoOutput) { session.addOutput(videoOutput) }
```

Rules for frame processing:

- The callback runs on **your** serial queue, **not** main. Hop to main only for UI updates.
- You have about **16–33 ms** per frame. If you're slower, frames are **dropped**. Skip frames on purpose (e.g. analyze every 5th) if the work is heavy.
- **Don't keep** `CMSampleBuffer`s. The camera uses a small **pool** of buffers; holding them makes the camera **stop** sending frames.
- `CMSampleBufferGetImageBuffer` gives the **`CVPixelBuffer`**: the raw pixels most tools (Vision, Core Image, Core ML) want.

For a plain **barcode or text scanner**, VisionKit's **`DataScannerViewController`** (iOS 16) does all of this for you, with a ready-made UI. Build your own pipeline only when you need something it can't do.

---

## 55.8 AVPlayer and VideoPlayer Playback 🟢

**`AVPlayer`** plays video and audio: local files, remote files, and streams (55.14). SwiftUI's **`VideoPlayer`** shows an `AVPlayer` with the **standard controls**:

```swift
import SwiftUI
import AVKit

struct RecipeVideoView: View {
    let videoURL: URL
    @State private var player = AVPlayer()                  // keep ONE player for the view

    var body: some View {
        VideoPlayer(player: player) {
            // Optional overlay, drawn over the video (not touchable)
            Text("Step 3: Fold the dough").padding().background(.black.opacity(0.5))
        }
        .aspectRatio(16 / 9, contentMode: .fit)
        .task {
            player.replaceCurrentItem(with: AVPlayerItem(url: videoURL))
        }
        .onDisappear { player.pause() }
    }
}
```

⚠️ Don't write `VideoPlayer(player: AVPlayer(url: url))` inside `body`. It creates a **new player** each time the view updates, and playback restarts or stops.

| Need | Use |
|---|---|
| Show a video with normal controls | **`VideoPlayer`** |
| System player with Picture in Picture, AirPlay, chapters | **`AVPlayerViewController`** (UIKit, wrap with 38.2) |
| Your **own** controls and design | **`AVPlayerLayer`** in a `UIViewRepresentable` (the same layer trick as 55.4) |

Watch progress with a time observer, for a custom scrubber:

```swift
let token = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: 600),
                                           queue: .main) { time in
    progress = time.seconds                                  // update your slider
}
// later: player.removeTimeObserver(token)
```

---

## 55.9 AVAudioSession Categories and Interruptions 🟡

**`AVAudioSession`** tells iOS **how** your app's audio should behave next to other audio: music, calls, the silent switch.

```swift
import AVFoundation

func configureForPlayback() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playback, mode: .spokenAudio)   // a cooking podcast
    try session.setActive(true)
}
```

| Category | Silent switch | Other apps' audio | Typical app |
|---|---|---|---|
| `.ambient` | **Silences** it | **Mixes** with it | Game sound effects |
| `.soloAmbient` (default) | **Silences** it | **Stops** it | Simple apps |
| `.playback` | **Keeps playing** | Stops it (or mixes with `.mixWithOthers`) | Music, podcasts, video |
| `.record` | — | Stops it | Voice recorder |
| `.playAndRecord` | Keeps playing | Stops it | Calls, voice chat |

For audio that keeps playing **in the background**, you need **both** `.playback` **and** the **Audio** background mode (`UIBackgroundModes`: `audio`).

**Interruptions** happen when a phone call, an alarm, or Siri takes the audio. Handle them:

```swift
func observeInterruptions() async {
    for await notification in NotificationCenter.default.notifications(named: AVAudioSession.interruptionNotification) {
        guard let info = notification.userInfo,
              let rawType = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: rawType) else { continue }

        switch type {
        case .began:
            player.pause()                                    // the system already paused audio
        case .ended:
            let rawOptions = info[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            if AVAudioSession.InterruptionOptions(rawValue: rawOptions).contains(.shouldResume) {
                player.play()                                 // only if the system says so
            }
        @unknown default:
            break
        }
    }
}
```

Also handle **route changes**: when the user **unplugs** headphones or disconnects AirPods, **pause** (`routeChangeNotification` with reason `.oldDeviceUnavailable`). Otherwise the audio suddenly plays out loud.

---

## 55.10 AVAudioEngine Basics 🔴

**`AVAudioEngine`** is a **graph of audio nodes**: sources → effects → mixer → output. Use it for **real-time** audio work: effects, mixing, synthesis, or reading the **microphone** live.

```swift
import AVFoundation

final class NarrationPlayer {
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let timePitch = AVAudioUnitTimePitch()             // change speed, keep the pitch

    func play(fileURL: URL, speed: Float) throws {
        let file = try AVAudioFile(forReading: fileURL)

        engine.attach(player)
        engine.attach(timePitch)

        // player → timePitch → mixer → speaker
        engine.connect(player, to: timePitch, format: file.processingFormat)
        engine.connect(timePitch, to: engine.mainMixerNode, format: file.processingFormat)

        timePitch.rate = speed                                 // 1.5 = 50% faster, no "chipmunk" voice
        try engine.start()

        player.scheduleFile(file, at: nil)
        player.play()
    }
}
```

**Reading the microphone** live uses a **tap** on the input node:

```swift
let input = engine.inputNode
let format = input.outputFormat(forBus: 0)

input.installTap(onBus: 0, bufferSize: 4096, format: format) { buffer, time in
    // buffer: AVAudioPCMBuffer with the latest audio
    // e.g. measure loudness, send to speech recognition, or ShazamKit (55.15)
}
try engine.start()
// later: input.removeTap(onBus: 0); engine.stop()
```

| Need | Use |
|---|---|
| Play a song, podcast, or video | `AVPlayer` (55.8): simpler |
| Record a voice memo | `AVAudioRecorder` (55.11): simpler |
| Effects, mixing several sounds, live mic analysis, synthesis | **`AVAudioEngine`** |

The tap's closure runs on an **audio thread**: keep it fast, and don't touch the UI from it.

---

## 55.11 Recording Audio 🟢

**`AVAudioRecorder`** records the microphone to a **file**. Three steps: **permission**, **session**, **recorder**:

```swift
import AVFoundation

final class VoiceNoteRecorder {
    private var recorder: AVAudioRecorder?

    func start(to url: URL) async throws {
        // 1. Permission (NSMicrophoneUsageDescription in Info.plist)
        guard await AVAudioApplication.requestRecordPermission() else {   // iOS 17
            throw RecordingError.permissionDenied
        }

        // 2. The audio session must allow recording (55.9)
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
        try session.setActive(true)

        // 3. The recorder
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,              // AAC: small and good quality
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,                         // mono is fine for voice
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]
        let recorder = try AVAudioRecorder(url: url, settings: settings)
        recorder.isMeteringEnabled = true                     // for a live level meter
        recorder.record()
        self.recorder = recorder
    }

    func level() -> Float {
        recorder?.updateMeters()
        return recorder?.averagePower(forChannel: 0) ?? -160  // in dB: -160 (silent) to 0 (loud)
    }

    func stop() {
        recorder?.stop()
        recorder = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
```

The settings are a **trade-off** between **size** and **quality**: mono AAC is great for **voice notes**; music recording needs **stereo** and a higher quality. And without the right **session category**, `record()` silently records **nothing**.

---

## 55.12 Video Export with AVAssetExportSession 🟡

**`AVAssetExportSession`** converts a video: a smaller **size**, a different **format**, or a final render of an edit (55.13). A common use: **shrink** a video before **uploading** it (39.11):

```swift
import AVFoundation

func exportForUpload(from sourceURL: URL, to outputURL: URL) async throws {
    let asset = AVURLAsset(url: sourceURL)

    guard let export = AVAssetExportSession(asset: asset,
                                            presetName: AVAssetExportPreset1280x720) else {
        throw ExportError.cannotCreateSession
    }

    // iOS 18+: one async call that throws on failure
    try await export.export(to: outputURL, as: .mp4)
}
```

Before iOS 18, set `outputURL` and `outputFileType`, call `await export.export()`, and then **check** `export.status` and `export.error` yourself.

Show **progress** while it works (iOS 18):

```swift
Task {
    for await state in export.states(updateInterval: 0.5) {
        if case .exporting(let progress) = state {
            exportProgress = progress.fractionCompleted        // 0.0 ... 1.0
        }
    }
}
```

| Preset | Result |
|---|---|
| `AVAssetExportPresetLowQuality` / `MediumQuality` / `HighestQuality` | Simple quality levels |
| `AVAssetExportPreset1280x720`, `1920x1080`, … | A fixed **maximum** size |
| `AVAssetExportPresetHEVCHighestQuality` | HEVC: smaller files, same quality |
| `AVAssetExportPresetPassthrough` | **No re-encoding**: just a new container (fast) |

A phone's 4K video is often **far** bigger than needed for a recipe upload. Exporting to 720p first saves the user's **data** and your **server** storage.

---

## 55.13 Composing Video with AVMutableComposition 🔴

**`AVMutableComposition`** builds a **new timeline** from pieces of other videos: join clips, **trim** them, add **music**. It's the base of any video editor.

```swift
import AVFoundation

func joinClips(_ clipURLs: [URL], music: URL?) async throws -> AVMutableComposition {
    let composition = AVMutableComposition()
    guard let videoTrack = composition.addMutableTrack(withMediaType: .video,
                                                       preferredTrackID: kCMPersistentTrackID_Invalid),
          let audioTrack = composition.addMutableTrack(withMediaType: .audio,
                                                       preferredTrackID: kCMPersistentTrackID_Invalid)
    else { throw CompositionError.cannotAddTrack }

    var cursor = CMTime.zero                                         // where the next clip goes

    for url in clipURLs {
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration)
        let range = CMTimeRange(start: .zero, duration: duration)   // the WHOLE clip (trim: a sub-range)

        guard let sourceVideo = try await asset.loadTracks(withMediaType: .video).first else { continue }
        try videoTrack.insertTimeRange(range, of: sourceVideo, at: cursor)
        videoTrack.preferredTransform = try await sourceVideo.load(.preferredTransform)  // keep orientation

        if let sourceAudio = try await asset.loadTracks(withMediaType: .audio).first {
            try audioTrack.insertTimeRange(range, of: sourceAudio, at: cursor)
        }
        cursor = cursor + duration
    }

    // Background music under the whole video, on its own track
    if let music,
       let musicTrack = composition.addMutableTrack(withMediaType: .audio,
                                                    preferredTrackID: kCMPersistentTrackID_Invalid),
       let source = try await AVURLAsset(url: music).loadTracks(withMediaType: .audio).first {
        try musicTrack.insertTimeRange(CMTimeRange(start: .zero, duration: cursor), of: source, at: .zero)
    }
    return composition
}
```

**`insertTimeRange(_:of:at:)`** is the one building block:

| Goal | How |
|---|---|
| **Join** clips | Insert each one at the **end** of the previous (`cursor`) |
| **Trim** | Insert only a **sub-range** of the source |
| **Layer** audio | Insert into a **separate** audio track at the same time |

A composition is an **`AVAsset`**, so you can:

- **preview** it right away: `AVPlayer(playerItem: AVPlayerItem(asset: composition))`,
- **render** it to a file with `AVAssetExportSession` (55.12).

For transitions, text, and filters, add an **`AVVideoComposition`** too. Nothing is copied until export: the composition only **points to** ranges of the source files.

---

## 55.14 HLS Streaming and Offline Download 🔴

**HLS** (HTTP Live Streaming) is Apple's streaming format. The video is cut into **small segments**, at **several quality levels**, listed in a **`.m3u8`** playlist. `AVPlayer` plays it with **no extra code**:

```swift
let player = AVPlayer(url: URL(string: "https://example.com/videos/pasta/master.m3u8")!)
player.play()
```

While playing, `AVPlayer` **switches quality automatically**: lower quality on a weak connection (instead of stopping to buffer), higher when the network improves. You can guide it:

```swift
player.currentItem?.preferredPeakBitRate = 2_000_000          // cap at ~2 Mbps (e.g. on cellular)
player.currentItem?.preferredForwardBufferDuration = 10       // seconds to buffer ahead
```

For **offline** viewing (a cooking class on a plane), download the stream with **`AVAssetDownloadURLSession`**. It's built on **background `URLSession`** (40.8), so the download continues when the app isn't running:

```swift
final class OfflineDownloader: NSObject, AVAssetDownloadDelegate {
    private lazy var session = AVAssetDownloadURLSession(
        configuration: .background(withIdentifier: "com.example.recipes.hls"),
        assetDownloadDelegate: self,
        delegateQueue: .main
    )

    func download(_ streamURL: URL, title: String) {
        let asset = AVURLAsset(url: streamURL)
        let configuration = AVAssetDownloadConfiguration(asset: asset, title: title)
        session.makeAssetDownloadTask(downloadConfiguration: configuration).resume()
    }

    // The system picks the folder: SAVE this location (relative path) to play it later
    func urlSession(_ session: URLSession,
                    assetDownloadTask: AVAssetDownloadTask,
                    willDownloadTo location: URL) {
        OfflineStore.save(location.relativePath, for: assetDownloadTask.urlAsset.url)
    }
}

// Later, offline:
// let asset = AVURLAsset(url: URL.homeDirectory.appending(path: savedRelativePath))
// player.replaceCurrentItem(with: AVPlayerItem(asset: asset))
```

Paid content is often protected with **FairPlay Streaming** (DRM); offline playback then also needs **persistable keys** through `AVContentKeySession`.

---

## 55.15 MusicKit and ShazamKit 🟡

Two music frameworks, two jobs:

| | MusicKit | ShazamKit |
|---|---|---|
| Job | **Apple Music**: search the catalog, the user's library, **play** songs | **Recognize** a song (or your own audio) from a short sound sample |
| Needs | `MusicAuthorization`; an Apple Music **subscription** to play full songs | Microphone permission |
| Setup | Enable the **MusicKit** App Service for your App ID | Enable the **ShazamKit** App Service |

**MusicKit**: find a song and play it:

```swift
import MusicKit

func playSong(matching term: String) async throws {
    guard await MusicAuthorization.request() == .authorized else { return }

    var request = MusicCatalogSearchRequest(term: term, types: [Song.self])
    request.limit = 1
    let response = try await request.response()
    guard let song = response.songs.first else { return }

    let player = ApplicationMusicPlayer.shared                 // plays inside your app
    player.queue = [song]
    try await player.play()
}
```

**ShazamKit**: from iOS 17, **`SHManagedSession`** records from the microphone **and** matches, in one call:

```swift
import ShazamKit

func identifyBackgroundSong() async -> String? {
    let session = SHManagedSession()

    switch await session.result() {                            // listens until a match or a timeout
    case .match(let match):
        let item = match.mediaItems.first
        return [item?.title, item?.artist].compactMap { $0 }.joined(separator: " – ")
    case .noMatch:
        return nil
    case .error(let error, _):
        print("Shazam failed: \(error)")
        return nil
    }
}
```

ShazamKit can also match against a **custom catalog** (`SHCustomCatalog`) of **your** audio: for example, syncing your app to the cooking **video** playing on a TV. And the two work well together: recognize a song with ShazamKit, then add it to a playlist with MusicKit.

---

## 55.16 Now Playing Info and Remote Commands 🟡

When your app plays audio, users expect to control it from the **Lock Screen**, **Control Center**, **AirPods**, **CarPlay**, and the **Apple Watch**. Two classes make that work:

| Class | Direction | Job |
|---|---|---|
| **`MPNowPlayingInfoCenter`** | App → system | **What** is playing: title, artwork, time |
| **`MPRemoteCommandCenter`** | System → app | **Commands**: play, pause, skip, seek |

```swift
import MediaPlayer
import AVFoundation

@MainActor
final class NowPlayingController {
    private let player: AVPlayer

    init(player: AVPlayer) {
        self.player = player
        setUpRemoteCommands()
    }

    func publish(title: String, show: String, artwork: UIImage) {
        let duration = player.currentItem?.duration.seconds ?? 0
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: title,
            MPMediaItemPropertyArtist: show,
            MPMediaItemPropertyPlaybackDuration: duration.isFinite ? duration : 0,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: player.currentTime().seconds,
            MPNowPlayingInfoPropertyPlaybackRate: player.rate,         // the system moves the bar for you
            MPMediaItemPropertyArtwork: MPMediaItemArtwork(boundsSize: artwork.size) { _ in artwork }
        ]
    }

    private func setUpRemoteCommands() {
        let commands = MPRemoteCommandCenter.shared()

        commands.playCommand.addTarget { [player] _ in player.play(); return .success }
        commands.pauseCommand.addTarget { [player] _ in player.pause(); return .success }

        commands.skipForwardCommand.preferredIntervals = [15]
        commands.skipForwardCommand.addTarget { [player] _ in
            player.seek(to: player.currentTime() + CMTime(seconds: 15, preferredTimescale: 600))
            return .success
        }

        commands.changePlaybackPositionCommand.addTarget { [player] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            player.seek(to: CMTime(seconds: event.positionTime, preferredTimescale: 600))
            return .success                                    // the user dragged the Lock Screen bar
        }
    }
}
```

Rules that make it **work**:

- Use the **`.playback`** audio session (55.9). Otherwise your app doesn't become the "now playing" app.
- Update the info when the **track**, **rate** (play/pause), or **position** (after a seek) changes. You **don't** need to update it every second: the system moves the time forward using the rate.
- Only enable the commands you **support**. Unsupported buttons should not appear.

With `AVPlayer`, **`MPNowPlayingSession`** (iOS 16) can publish much of this **automatically**. Either way, Lock Screen and headphone controls are **expected** in any app that plays media.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Private picking | `PhotosPicker`, `PHPickerViewController` | Pick photos with no permission prompt |
| Full library | `PHAsset`, `PHFetchResult`, `PHImageManager` | Browse and edit the library (with permission) |
| Limited access | `.limited`, `presentLimitedLibraryPicker` | Work with the user's selected subset |
| Camera setup | `AVCaptureSession`, inputs, outputs, preview layer | Connect camera and mic to outputs |
| Photo capture | `AVCapturePhotoOutput`, new settings per shot | One moment, delivered to a delegate |
| Video capture | `AVCaptureMovieFileOutput` | Start/stop recording to a file |
| Live frames | `AVCaptureVideoDataOutput`, Vision | Per-frame processing on your own queue |
| Playback | `AVPlayer`, `VideoPlayer`, `AVPlayerViewController` | Standard or custom video players |
| Audio behavior | `AVAudioSession` categories, interruptions | Play nicely with calls and other apps |
| Audio graph | `AVAudioEngine`, nodes, input taps | Effects, mixing, live microphone audio |
| Recording audio | `AVAudioRecorder` | Permission + session + recorder |
| Export | `AVAssetExportSession`, presets | Shrink or convert video |
| Editing | `AVMutableComposition`, `insertTimeRange` | Join, trim, and layer clips |
| Streaming | HLS, `AVAssetDownloadURLSession` | Adaptive playback and offline downloads |
| Music | MusicKit, ShazamKit (`SHManagedSession`) | Apple Music access and song recognition |
| System controls | `MPNowPlayingInfoCenter`, `MPRemoteCommandCenter` | Lock Screen, AirPods, and CarPlay control |
