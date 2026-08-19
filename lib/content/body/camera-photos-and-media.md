## 55.1 PHPickerViewController and Privacy-Preserving Picking

`PHPickerViewController` (and its SwiftUI wrapper, `PhotosPicker`) lets a user select photos/videos from their library without the app ever needing explicit photo library permission at all — the picker runs in a separate, system-owned process, handing the app only the specific items the user actually selected.

```swift
import PhotosUI
import SwiftUI

struct PhotoPickerView: View {
    @State private var selectedItem: PhotosPickerItem?
    @State private var selectedImage: Image?

    var body: some View {
        PhotosPicker(selection: $selectedItem, matching: .images) {
            Text("Choose a Photo")
        }
        .onChange(of: selectedItem) { _, newItem in
            Task {
                if let data = try? await newItem?.loadTransferable(type: Data.self),
                   let uiImage = UIImage(data: data) {
                    selectedImage = Image(uiImage: uiImage)
                }
            }
        }
    }
}
```

This is a genuinely significant privacy improvement over older, full-library-access-requiring picker APIs — because the picker UI itself runs outside the app's own process (similar in spirit to the extension sandboxing model, section 53.1) and only hands back the specific items the user explicitly chose, an app using `PhotosPicker` never needs to request or be granted broad photo library access just to let a user pick a single profile picture, meaningfully reducing the permission footprint for the extremely common "let the user pick one photo" use case.

---

## 55.2 PhotoKit: Fetching and Displaying Assets

For apps that genuinely need broader library access (a photo-editing or gallery app browsing the user's entire library, as opposed to picking one item), PhotoKit's `PHAsset`/`PHFetchResult` APIs provide direct, queryable access to the user's photo library, requiring explicit, broader authorization.

```swift
import Photos

func fetchRecentPhotos() -> PHFetchResult<PHAsset> {
    let options = PHFetchOptions()
    options.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
    return PHAsset.fetchAssets(with: .image, options: options)
}

func loadImage(for asset: PHAsset, targetSize: CGSize) async -> UIImage? {
    await withCheckedContinuation { continuation in
        let manager = PHImageManager.default()
        manager.requestImage(for: asset, targetSize: targetSize, contentMode: .aspectFill, options: nil) { image, _ in
            continuation.resume(returning: image)
        }
    }
}
```

`PHFetchResult` behaves much like a lazily-evaluated, sortable/filterable collection over the device's photo library — appropriate specifically for apps whose core purpose genuinely requires browsing across the whole library (unlike the single-selection `PHPickerViewController` use case from 55.1), and `withCheckedContinuation` here bridges `PHImageManager`'s older completion-handler-based image loading API into the modern `async`/`await` world, a common bridging pattern (recall continuations more broadly from Part 2's structured concurrency material) for wrapping still-callback-based system APIs.

---

## 55.3 Limited Photo Library Access

Beyond full library access or none at all, users can grant "Limited" access — selecting a specific subset of photos the app is allowed to see, with the ability to add more selected photos later via a system-presented picker, without the app ever gaining visibility into the rest of the library.

```swift
func checkAuthorizationStatus() {
    let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    if status == .limited {
        // Offer the user a way to add more photos to the limited selection:
        PHPhotoLibrary.shared().presentLimitedLibraryPicker(from: someViewController)
    }
}
```

`presentLimitedLibraryPicker(from:)` lets an app that's been granted only limited access offer the user a convenient way to expand their selection (add more specific photos to what the app can see) without requiring a trip to Settings — well-designed apps generally detect the `.limited` status and surface this option contextually, such as showing a small "Select More Photos" prompt within their own photo browsing UI, rather than leaving users to discover the option only accidentally.

---

## 55.4 AVCaptureSession Setup

`AVCaptureSession` is the foundational object coordinating camera/microphone input with one or more capture outputs (photo capture, video recording, real-time frame processing) — configuring one correctly requires explicitly adding inputs (device access) and outputs (what to actually do with the captured data) within a begin/commit configuration block.

```swift
import AVFoundation

func setupCaptureSession() throws -> AVCaptureSession {
    let session = AVCaptureSession()
    session.beginConfiguration()
    defer { session.commitConfiguration() }

    guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
        throw CaptureError.noCameraAvailable
    }
    let input = try AVCaptureDeviceInput(device: device)
    guard session.canAddInput(input) else { throw CaptureError.cannotAddInput }
    session.addInput(input)

    return session
}
```

`beginConfiguration()`/`commitConfiguration()` bracket a batch of session changes, letting `AVCaptureSession` apply them together as one atomic reconfiguration rather than incrementally reacting to each individual `addInput`/`addOutput` call — `canAddInput`/`canAddOutput` should always be checked before actually adding, since a session can reject certain input/output combinations depending on hardware capability and what's already configured, making these checks a genuine correctness requirement rather than defensive boilerplate.

---

## 55.5 Capturing a Photo

`AVCapturePhotoOutput`, added to a configured capture session (54.4), handles the actual photo capture — `capturePhoto(with:delegate:)` triggers a capture, with the result delivered asynchronously through `AVCapturePhotoCaptureDelegate`.

```swift
class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    var onCapture: ((Data?) -> Void)?

    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        onCapture?(photo.fileDataRepresentation())
    }
}

func capturePhoto(output: AVCapturePhotoOutput, delegate: AVCapturePhotoCaptureDelegate) {
    let settings = AVCapturePhotoSettings()
    output.capturePhoto(with: settings, delegate: delegate)
}
```

`AVCapturePhotoSettings` configures per-capture options (flash mode, whether to also capture a preview image, format preferences) independently for each individual capture, letting the same `AVCapturePhotoOutput` handle photos with different settings across successive captures without needing to be reconfigured each time — `photo.fileDataRepresentation()` provides the actual encoded image data (typically HEIC or JPEG) ready to be saved or further processed once the delegate callback fires.

---

## 55.6 Capturing Video

`AVCaptureMovieFileOutput` handles video recording, writing directly to a specified file URL, with recording start/stop controlled explicitly and completion reported via `AVCaptureFileOutputRecordingDelegate`.

```swift
class VideoCaptureDelegate: NSObject, AVCaptureFileOutputRecordingDelegate {
    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        // recording complete; outputFileURL contains the recorded video
    }
}

func startRecording(output: AVCaptureMovieFileOutput, to url: URL, delegate: AVCaptureFileOutputRecordingDelegate) {
    output.startRecording(to: url, recordingDelegate: delegate)
}
```

Unlike photo capture's single discrete request/response, video recording is fundamentally a start/stop-bounded operation — `startRecording(to:recordingDelegate:)` begins writing continuously to the specified file until an explicit `stopRecording()` call, with the delegate callback firing only once recording has genuinely finished and the file is complete and ready for use, reflecting video's inherently different temporal nature compared to photo capture's single-moment operation.

---

## 55.7 Real-Time Frame Processing with AVCaptureVideoDataOutput

`AVCaptureVideoDataOutput` delivers a live, continuous stream of raw video frames as they're captured, appropriate for real-time processing (like a barcode scanner, an on-device ML vision feature, or a custom camera filter effect) rather than saving to a file.

```swift
class FrameProcessor: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        // process pixelBuffer in real time — e.g., feed into a Vision request
    }
}
```

`captureOutput(_:didOutput:from:)` fires continuously, once per captured frame (typically 30 or 60 times per second) — this callback runs on a dedicated capture queue rather than the main thread, meaning any processing done here must itself be fast enough to keep up with the incoming frame rate or explicitly offload heavier work elsewhere, since falling behind causes frames to be dropped; `CMSampleBufferGetImageBuffer` extracts the actual pixel data (`CVPixelBuffer`) from the lower-level `CMSampleBuffer` container, which is the format most downstream processing (like Vision framework requests) actually expects.

---

## 55.8 AVPlayer and VideoPlayer Playback

`AVPlayer` is the foundational video/audio playback engine, and SwiftUI's `VideoPlayer` wraps it for direct, declarative use within a SwiftUI view hierarchy — the AVFoundation equivalent of the relationship between `UIViewController` and `UIHostingController`/`UIViewRepresentable` (section 38) bridging patterns, but built specifically for media playback.

```swift
import AVKit

struct RecipeVideoView: View {
    let videoURL: URL

    var body: some View {
        VideoPlayer(player: AVPlayer(url: videoURL))
            .aspectRatio(16/9, contentMode: .fit)
    }
}
```

`VideoPlayer` provides standard playback controls (play/pause, scrubbing, fullscreen) essentially for free, appropriate for the common case of showing a video with expected, standard controls — apps needing custom playback UI (a bespoke scrubber, custom overlay controls) instead work directly with `AVPlayer` and `AVPlayerLayer` (typically via a `UIViewRepresentable` wrapper, section 38.1) for full control over presentation, trading `VideoPlayer`'s convenience for greater customization flexibility.

---

## 55.9 AVAudioSession Categories and Interruptions

`AVAudioSession` configures how an app's audio behaves relative to other audio on the device — its `category` determines fundamental behavior like whether audio continues when the device is muted, whether it mixes with or silences other apps' audio, and how the app responds to interruptions (like an incoming phone call).

```swift
func configureAudioSession() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playback, mode: .default, options: [])
    try session.setActive(true)
}

NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { notification in
    guard let info = notification.userInfo,
          let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
          let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
    if type == .began {
        // pause playback
    } else if type == .ended {
        // optionally resume playback
    }
}
```

`.playback` category is appropriate for an app whose core purpose is playing audio/video content (continuing even if the device's silent switch is enabled, and by default silencing other background audio) — other categories like `.ambient` (mixes with other audio, respects the silent switch) or `.playAndRecord` (for apps needing simultaneous playback and recording) express meaningfully different behavioral contracts, and the interruption notification handling shown is essential for gracefully pausing playback when, say, a phone call interrupts the app's audio, then optionally resuming once that interruption ends.

---

## 55.10 AVAudioEngine Basics

`AVAudioEngine` provides a lower-level, node-graph-based audio processing pipeline — connecting audio source nodes (microphone input, a file player) through processing nodes (effects, mixing) to an output node, appropriate for apps needing genuine audio synthesis, real-time effects processing, or fine-grained mixing control beyond what `AVPlayer`'s simpler playback model provides.

```swift
let engine = AVAudioEngine()
let playerNode = AVAudioPlayerNode()

engine.attach(playerNode)
engine.connect(playerNode, to: engine.mainMixerNode, format: nil)

try engine.start()
playerNode.scheduleFile(audioFile, at: nil)
playerNode.play()
```

This node-graph model (attach nodes, connect them into a signal-flow graph, then start the whole engine) is meaningfully more powerful and more complex than `AVPlayer`'s simple "give it a URL, call play()" model — appropriate specifically for apps doing genuine audio work (a music production tool, a real-time voice effects app, precise multi-track mixing) rather than simply playing back existing media files, where `AVPlayer`/`VideoPlayer` (55.8) remain the simpler, more appropriate choice.

---

## 55.11 Recording Audio

`AVAudioRecorder` provides straightforward audio recording to a file, configured with format/quality settings and controlled via simple start/stop calls — the audio-specific analog of `AVCaptureMovieFileOutput`'s video recording (55.6).

```swift
func startAudioRecording(to url: URL) throws -> AVAudioRecorder {
    let settings: [String: Any] = [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVSampleRateKey: 44100,
        AVNumberOfChannelsKey: 1,
        AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
    ]
    let recorder = try AVAudioRecorder(url: url, settings: settings)
    recorder.record()
    return recorder
}
```

The `settings` dictionary configures the actual encoding format (AAC here, a common, efficient compressed audio format), sample rate, channel count, and quality — these choices involve real trade-offs between file size and audio fidelity, with the specific right choice depending on the recording's purpose (a voice memo can reasonably use lower quality/mono than professional music recording would require), and `AVAudioSession`'s `.record` or `.playAndRecord` category (55.9) must be properly configured before recording will actually function correctly.

---

## 55.12 Video Export with AVAssetExportSession

`AVAssetExportSession` transcodes/exports a video asset — changing its format, resolution, or applying a preset quality level — appropriate for preparing a captured or composed video for sharing, upload, or storage in a more space-efficient format than the original capture.

```swift
func exportVideo(asset: AVAsset, to outputURL: URL) async throws {
    guard let exportSession = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetMediumQuality) else {
        throw ExportError.cannotCreateSession
    }
    exportSession.outputURL = outputURL
    exportSession.outputFileType = .mp4

    await exportSession.export()

    if exportSession.status == .failed {
        throw exportSession.error ?? ExportError.unknown
    }
}
```

Export presets (`AVAssetExportPresetMediumQuality`, `AVAssetExportPresetHighestQuality`, and others) provide convenient, pre-tuned quality/size trade-offs without needing to manually specify every individual encoding parameter — this is commonly used before uploading a captured video to a server (recall multipart upload, section 39.11), since a device's raw captured video is often considerably larger than what's actually necessary or desirable to transmit and store, making export-before-upload a practical, common step in a video-handling pipeline.

---

## 55.13 Composing Video with AVMutableComposition 🔴

`AVMutableComposition` builds a new video asset by combining and arranging multiple existing video/audio tracks — trimming clips, layering audio over video, or concatenating several separate clips into one continuous timeline — the foundation for building video editing functionality.

```swift
func combineClips(_ clipURLs: [URL]) async throws -> AVMutableComposition {
    let composition = AVMutableComposition()
    let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)

    var currentTime = CMTime.zero
    for url in clipURLs {
        let asset = AVURLAsset(url: url)
        let assetTrack = try await asset.loadTracks(withMediaType: .video).first!
        let duration = try await asset.load(.duration)
        try videoTrack?.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: assetTrack, at: currentTime)
        currentTime = CMTimeAdd(currentTime, duration)
    }
    return composition
}
```

`insertTimeRange(_:of:at:)` is the core building block — placing a specific time range from a source track at a specific point in the composition's own timeline, and calling it repeatedly (as shown, advancing `currentTime` after each clip) is how multiple separate video files get concatenated into one continuous composition; this same building block, applied differently, also enables trimming (inserting only a sub-range of a source clip) and layering (adding a separate audio track alongside video at overlapping time ranges) — the composition, once built, can then be rendered via `AVAssetExportSession` (55.12) into a final, standalone video file.

---

## 55.14 HLS Streaming and Offline Download 🔴

HTTP Live Streaming (HLS) is Apple's adaptive bitrate streaming protocol — a video is encoded at multiple quality levels, with `AVPlayer` automatically switching between them based on current network conditions, and `AVAssetDownloadTask` supports downloading HLS content for offline playback.

```swift
func downloadForOffline(hlsURL: URL) {
    let asset = AVURLAsset(url: hlsURL)
    let configuration = URLSessionConfiguration.background(withIdentifier: "com.example.myapp.hls-download")
    let session = AVAssetDownloadURLSession(configuration: configuration, assetDownloadDelegate: downloadDelegate, delegateQueue: .main)

    let downloadTask = session.makeAssetDownloadTask(asset: asset, assetTitle: "Recipe Video", assetArtworkData: nil, options: nil)
    downloadTask?.resume()
}
```

Because `AVPlayer` transparently handles quality-level switching for adaptive streams, a well-encoded HLS asset provides a smooth playback experience across varying network conditions (dropping to a lower quality automatically during a poor connection, rather than buffering indefinitely) with no manual bitrate-switching logic required in the app — `AVAssetDownloadURLSession`, built on the same background `URLSession` infrastructure from section 40.8, extends this same adaptive-streaming asset format to support genuine offline playback, downloading and storing the content locally for later use without requiring network connectivity at playback time.

---

## 55.15 MusicKit and ShazamKit 🟠

MusicKit provides programmatic access to Apple Music's catalog and a user's library/playback (search, playlists, playback control), while ShazamKit provides on-device and catalog-matched audio recognition — identifying a song from a short audio sample, the same underlying technology behind the standalone Shazam app.

```swift
import ShazamKit

func recognizeAudio(from buffer: AVAudioPCMBuffer, at time: AVAudioTime) {
    let session = SHSession()
    let signature = SHSignatureGenerator()
    try? signature.append(buffer, at: time)
    session.match(try! signature.signature())
}

class MatchDelegate: NSObject, SHSessionDelegate {
    func session(_ session: SHSession, didFind match: SHMatch) {
        let title = match.mediaItems.first?.title
        // present the recognized song
    }
}
```

`SHSignatureGenerator` builds an audio "fingerprint" from a captured buffer (fed from something like the `AVCaptureVideoDataOutput`-adjacent audio capture path, or a dedicated audio tap), and `SHSession.match()` compares that fingerprint against Shazam's catalog (or, for `SHCustomCatalog`, a developer-provided custom set of reference audio) — these two frameworks (MusicKit for catalog access/playback, ShazamKit for recognition) are commonly used together in apps building music-adjacent experiences, like a recipe app that could recognize background music playing in a cooking video and offer to add it to a playlist.

---

## 55.16 Now Playing Info and Remote Commands

`MPNowPlayingInfoCenter` publishes what an app is currently playing (title, artist, artwork, playback position) to the system, making it appear in Control Center, the Lock Screen, and on connected devices like CarPlay or a paired watch, while `MPRemoteCommandCenter` handles playback commands (play/pause/skip) arriving from those same external surfaces.

```swift
import MediaPlayer

func updateNowPlayingInfo(title: String, artwork: UIImage) {
    var info: [String: Any] = [
        MPMediaItemPropertyTitle: title,
        MPNowPlayingInfoPropertyElapsedPlaybackTime: currentPlayer.currentTime,
        MPMediaItemPropertyPlaybackDuration: currentPlayer.duration
    ]
    info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: artwork.size) { _ in artwork }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
}

func configureRemoteCommands() {
    let commandCenter = MPRemoteCommandCenter.shared()
    commandCenter.playCommand.addTarget { _ in currentPlayer.play(); return .success }
    commandCenter.pauseCommand.addTarget { _ in currentPlayer.pause(); return .success }
}
```

Publishing accurate, up-to-date Now Playing info (and correctly wiring up remote commands) is what makes an app's media playback feel like a genuine first-class citizen of the system's broader media ecosystem — a user controlling playback from their Lock Screen, AirPods, or car's dashboard without ever needing to unlock their phone and open the app directly is a meaningfully better experience than an app that plays media with no system integration at all, and is expected baseline behavior for any app with substantial audio/video playback functionality.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Privacy-preserving picking | `PHPickerViewController`, `PhotosPicker` | Select photos with no broad library permission needed |
| Full library access | `PHAsset`, `PHFetchResult`, `PHImageManager` | Queryable browsing for genuine gallery/editing apps |
| Partial access | `.limited` authorization, `presentLimitedLibraryPicker` | User-controlled, expandable subset library access |
| Capture foundation | `AVCaptureSession`, inputs/outputs | Coordinates camera/mic input with capture outputs |
| Photo capture | `AVCapturePhotoOutput`, delegate | Single-request, async-delivered photo capture |
| Video capture | `AVCaptureMovieFileOutput` | Start/stop-bounded file recording |
| Real-time frames | `AVCaptureVideoDataOutput` | Continuous frame stream for live processing |
| Media playback | `AVPlayer`, `VideoPlayer` | Standard controls with minimal setup |
| Audio session behavior | `AVAudioSession`, categories, interruptions | How app audio interacts with the rest of the system |
| Advanced audio pipeline | `AVAudioEngine`, node graph | Synthesis, effects, and fine-grained mixing |
| Audio recording | `AVAudioRecorder` | Straightforward file-based audio capture |
| Format conversion | `AVAssetExportSession`, presets | Transcode/resize video for sharing or storage |
| Video editing foundation | `AVMutableComposition` | Trim, layer, and concatenate tracks |
| Adaptive streaming | HLS, `AVAssetDownloadTask` | Network-adaptive playback and offline download |
| Catalog access & recognition | MusicKit, ShazamKit | Apple Music integration and audio fingerprint matching |
| System media integration | `MPNowPlayingInfoCenter`, `MPRemoteCommandCenter` | Lock Screen/Control Center/CarPlay playback control |
