**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

Performance work starts with **measuring**, not guessing. This section covers the main **Instruments** tools, custom **signposts**, **launch** time, **scrolling** and frame budgets, ProMotion, **image** costs, **hangs**, **memory** limits, **app size**, real-world data from **MetricKit** and the Organizer, **energy**, and protecting performance with **budgets** in CI.

---

## 69.1 Measure Before Optimizing: The Discipline 🟢

**Short answer:** find the **real** bottleneck with a tool **before** changing code.

Intuition about "what's slow" is often **wrong**. Developers optimize a sort that takes 2 ms while a synchronous file read takes 400 ms on the line above. The user sees **no** difference, and the code got more complex.

The loop:

```
1. MEASURE   – record the slow scenario with a tool (Instruments, signposts, MetricKit)
2. FIND      – identify the biggest cost in the data
3. CHANGE    – fix THAT one thing, as simply as possible
4. MEASURE   – same scenario, same device: did the number actually improve?
   → repeat, or stop when it's fast enough
```

Rules that make measurements **trustworthy**:

| Rule | Why |
|---|---|
| Profile a **Release** build (Product ▸ Profile does this) | Debug builds are unoptimized; their slow spots can be different |
| Use a **real device**, ideally an **older** one | The Simulator uses your Mac's CPU; users have slower phones |
| Measure the **same scenario** before and after | Otherwise you're comparing different work |
| Decide what "**fast enough**" means | Without a goal, optimization never ends |

You've already seen this idea for specific frameworks: offscreen rendering (62.7), Metal frame capture (63.9), the Core ML performance report (59.7). This section applies it to the **whole** app.

---

## 69.2 Instruments: Time Profiler 🟢

**Time Profiler** answers: "**Where does the CPU time go?**" It takes a snapshot of every thread's **call stack** about every millisecond, then counts which functions appear most:

```
Call Tree (Invert Call Tree ☑, Hide System Libraries ☑)
Weight     Symbol
412 ms     RecipeSearch.rank(_:query:)          ← most time spent HERE, in your code
  398 ms     String.lowercased()                ← called 200,000 times inside the loop
 96 ms     JSONDecoder.decode(_:from:)
 31 ms     RecipeCell.configure(with:)
```

How to read it:

- **Invert Call Tree**: shows the functions that **themselves** use the most time (the leaves) at the top.
- **Hide System Libraries**: shows **your** code that calls into slow system work.
- Select a time range in the timeline (for example, the moment the UI froze) to see **only** that part.
- Double-click a function to see **which lines** cost the most.

In the example, the fix isn't "make sorting faster": it's "**don't lowercase every string in every comparison**":

```swift
// Before: lowercases both strings on every comparison
recipes.filter { $0.title.lowercased().contains(query.lowercased()) }

// After: prepare once
let needle = query.lowercased()
recipes.filter { $0.searchKey.contains(needle) }   // searchKey = title.lowercased(), stored once
```

Why **sampling** instead of recording every call? It adds **very little** overhead, so the app runs almost normally while measured. The price: tiny functions may not show up exactly, but the **hot spots** always do, and those are what matter.

---

## 69.3 Instruments: Allocations 🟡

**Allocations** records every **memory allocation**: how many objects of each type are alive, how much memory they use, and how that changes over time.

Its best feature for finding growth: **Mark Generation**. Repeat an action that should be **memory-neutral**, and mark between repetitions:

```
1. Open the app, go to the recipe list
2. Mark Generation A
3. Open a recipe, go back             ← should leave NO new objects behind
4. Mark Generation B
5. Open a recipe, go back again
6. Mark Generation C

Generation B: +4.2 MB   RecipeDetailViewModel ×1, UIImage ×12, …
Generation C: +4.1 MB   RecipeDetailViewModel ×1, UIImage ×12, …   ← grows EVERY time: a problem
```

Each generation shows objects created in that step and **still alive**. If every round leaves the same objects behind, memory grows without limit.

| View | Shows |
|---|---|
| **Statistics** | Live count and size per type ("UIImage: 1,200 live") |
| **Generations** | What each repetition left behind |
| **Call Trees** | **Where** in your code the memory was allocated |
| Persistent vs. Transient | Still alive vs. already freed |

Allocations finds **any** unexpected growth: leaks, but also caches that never **evict**, images kept at full size (69.12), or view models kept by a long-lived object. Leaks (69.4) only finds the strict kind.

---

## 69.4 Instruments: Leaks 🟢

**Leaks** finds memory that is **unreachable**, nothing points to it anymore, but was **never freed**. In Swift, that's almost always a **retain cycle** (68.14):

```
Leaks: 3 leaked objects
  RecipeDetailViewModel   ── cycle ──►  CookTimer  ──►  closure context  ──► RecipeDetailViewModel
```

Leaks checks the heap **periodically** while you record, and shows the **cycle** graphically, with the allocation stack of each object.

| Tool | Finds |
|---|---|
| **Leaks** | Strict leaks: **unreachable** but still allocated (cycles) |
| **Allocations** (69.3) | **Any** growth: leaks, plus caches and objects held too long |
| **Memory Graph** (68.13) | A one-moment **snapshot** while debugging |

Leaks can miss "**abandoned memory**": objects that are still **reachable** (a singleton keeps them in an array) but will never be used again. Technically not a leak, but just as wasteful. For those, use Allocations generations.

A practical routine: before each release, run Leaks while using your **main flows**, and fix anything it reports. Most leaks are a missing `[weak self]` or `weak var delegate`.

---

## 69.5 Instruments: Animation Hitches 🟡

A **hitch** is a frame shown **later** than it should be: the user sees a stutter. **Animation Hitches** measures them during scrolling and animations.

The key number is the **hitch time ratio**: milliseconds of hitching per second of scrolling.

| Hitch ratio | Feels |
|---|---|
| **< 5 ms/s** | Smooth |
| **5–10 ms/s** | Users notice now and then |
| **> 10 ms/s** | Clearly janky |

Each hitch is classified by **where** the time went (62.6):

| Type | Means | Typical cause |
|---|---|---|
| **Commit** hitch | Your **app** took too long preparing the frame | Heavy layout, `draw(_:)`, image decoding, cell setup |
| **Render** hitch | The **render server/GPU** took too long | Offscreen rendering (62.7), blur, huge layers |

The powerful move: record **Animation Hitches together with Time Profiler** (the Animation Hitches template includes both). Select a hitch in the timeline, and the call tree shows what the main thread was doing **during that frame**:

```
Hitch at 3.21 s (34 ms, commit)
  Time Profiler for 3.19–3.23 s:
    RecipeCell.configure(with:)
      UIImage(data:)                ← decoding a full-size photo on the main thread
```

Now you know **what** stuttered **and why**.

---

## 69.6 Instruments: System Trace 🔴

Time Profiler shows where **your** code spends CPU time. But sometimes your code isn't **running** at all: it's **waiting**. **System Trace** shows everything the **system** is doing: every thread of every process, when it runs, when it's **blocked**, and why.

```
Main thread, 2.10–2.45 s:
  ███ running  ░░░░░░░░░░░░ blocked (waiting on lock in DatabaseQueue)  ███ running
                ↑ 300 ms of NOTHING in Time Profiler: the thread wasn't running
Background thread "sync":
  ████████████ holding the database lock during a big import
```

Use it when Time Profiler doesn't explain the slowness:

| Symptom | System Trace shows |
|---|---|
| Main thread "**idle**" but the UI is frozen | It's **blocked**: on a lock, a semaphore, a sync dispatch |
| Work is slow only **sometimes** | Other processes using the CPU; your thread **preempted** |
| A high-priority thread waits for a low-priority one | **Priority inversion** |
| Slow first access to data | **Virtual memory** faults: pages loaded from disk |

It's the deepest (and most detailed) view, like a sysdiagnose (68.23) for performance. Record **short** sessions (a few seconds around the problem): the data is huge.

---

## 69.7 os_signpost for Custom Measurement 🟡

Profilers show **functions**. But you care about **operations**: "open a recipe", "sync", "load the feed". **Signposts** mark those operations in your code, and Instruments shows them as named intervals on the timeline:

```swift
import os

extension OSSignposter {
    static let recipes = OSSignposter(subsystem: "com.example.recipes", category: .pointsOfInterest)
}

func loadFeed() async throws -> [Recipe] {
    let state = OSSignposter.recipes.beginInterval("Load Feed")
    defer { OSSignposter.recipes.endInterval("Load Feed", state) }

    let data = try await api.feed()                       // network
    OSSignposter.recipes.emitEvent("Feed downloaded")     // a single moment
    return try decodeAndRank(data)                        // CPU work
}

// Shorter form for synchronous work
let ranked = OSSignposter.recipes.withIntervalSignpost("Rank Recipes") {
    rank(recipes, for: query)
}
```

In Instruments, add the **os_signpost** instrument (or use **Points of Interest**). You see:

```
Load Feed       |━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━| 840 ms
                     ↑ Feed downloaded (610 ms)
Rank Recipes                                        |━━━━| 190 ms
```

Now "the feed is slow" becomes "**610 ms network, 190 ms ranking**": you know which part to work on. Signposts are very cheap when nobody is recording, so they can stay in **release** builds. The same signposts can also drive **automated** performance tests (69.19).

---

## 69.8 App Launch: Pre-Main vs Post-Main 🟡

Launch time has **two** phases, with different causes:

```
Tap icon
  │  PRE-MAIN  (before your code)
  │   - load the app binary and its dynamic frameworks (dyld)
  │   - run static initializers, Objective-C +load
  ▼
main()
  │  POST-MAIN (your code)
  │   - App.init / application(_:didFinishLaunchingWithOptions:)
  │   - build the first screen, load its data
  ▼
First frame shown  ← "launch time" as users (and the Organizer) see it
```

| Phase | Mostly affected by | Fixes |
|---|---|---|
| **Pre-main** | **Number of dynamic frameworks**; static initializers | Fewer dynamic frameworks; static linking or **mergeable libraries**; remove `+load` work |
| **Post-main** | **Your** launch code | Do less before the first frame (69.9) |

Measure with the **App Launch** template in Instruments: it shows the phases, and what each thread does during them.

Kinds of launch:

| Launch | When | Usually |
|---|---|---|
| **Cold** | After a reboot or a long time; nothing cached | Slowest |
| **Warm** | App was quit recently; parts still in memory | Faster |
| **Resume** | App was only suspended in the background | Not a launch: almost instant |

Measure **cold** and **warm** launches separately. Also note **prewarming**: iOS may start your app's process **before** the user taps the icon, so don't assume "the process started" means "the user opened the app" (and don't do user-visible work, like analytics "app opened", in early initializers).

---

## 69.9 Reducing Launch Time 🟢

The main rule: **only do what the first screen needs** before showing it. Everything else waits.

```swift
@main
struct RecipeApp: App {
    @State private var store = RecipeStore()          // cheap: no disk access in init

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(store)
                .task {
                    await store.loadFirstPage()        // just what the first screen shows
                }
                .task(priority: .background) {
                    await Analytics.shared.start()     // not needed for the first frame
                    await ImageCache.shared.trimIfNeeded()
                    await SearchIndex.shared.warmUp()
                }
        }
    }
}
```

| ❌ Before the first frame | ✅ Instead |
|---|---|
| Synchronous **disk** reads of big files | Load async; show a placeholder |
| **Network** calls the screen waits for | Show cached data first, refresh after |
| Starting **every** SDK (analytics, ads, crash reporting) | Start the critical one (crash reporting); defer the rest |
| Creating **all** singletons eagerly | `lazy`/`static let`: created on first use |
| Migrating the **whole** database | Migrate in the background, or on first access |

A good target: the first frame in **well under a second** on a typical device. The system's launch **watchdog** (68.11) kills apps that take far too long (many seconds), so a slow launch on old devices can become a **crash**.

Same idea as background budgets (49.13) and model warm-up (58.16): decide what **must** happen now, and move the rest **later**.

---

## 69.10 Scroll Performance and Frame Budgets 🟡

Smooth scrolling means a **new frame** every refresh:

| Refresh rate | Time per frame |
|---|---|
| 60 Hz | **16.7 ms** |
| 120 Hz (ProMotion, 69.11) | **8.3 ms** |

And your app doesn't get all of it: the system and the render server need their part (62.6). Any frame that takes longer is a **hitch** (69.5).

The classic mistake is heavy work in **cell setup**, on the main thread:

```swift
// ❌ Decodes a full-size photo synchronously, for every cell that appears
func configure(with recipe: Recipe) {
    titleLabel.text = recipe.title
    photoView.image = UIImage(contentsOfFile: recipe.photoPath)   // 20–60 ms on the main thread!
}

// ✅ Decode a small thumbnail off the main thread, then show it
func configure(with recipe: Recipe) {
    titleLabel.text = recipe.title
    photoView.image = nil
    loadTask?.cancel()
    loadTask = Task {
        let thumbnail = await UIImage(contentsOfFile: recipe.photoPath)?
            .byPreparingThumbnail(ofSize: CGSize(width: 120, height: 120))   // decoded in the background
        guard !Task.isCancelled else { return }
        photoView.image = thumbnail
    }
}
```

Checklist for smooth lists:

- **No** synchronous disk or network work in cell setup.
- Decode and **downsize** images off the main thread (69.12); cache the results.
- Use **prefetching** (`UICollectionViewDataSourcePrefetching`) to start loading before cells appear.
- Keep cell **layouts** simple; avoid offscreen rendering (62.7).
- In SwiftUI: use `List` / `LazyVStack` (lazy), keep row `body`s **cheap**, and give rows **stable IDs** (26.2).

---

## 69.11 ProMotion and Variable Refresh Implications 🟡

**ProMotion** screens (iPad Pro, iPhone Pro models) change their refresh rate **dynamically**, up to **120 Hz**: fast while scrolling, low (down to 10 Hz or less) when nothing moves, to save power.

What this means for you:

1. **Half the time per frame.** Code that fit in 16.7 ms at 60 Hz may **not** fit in 8.3 ms. "It was smooth on my old phone" isn't proof anymore: profile on a **ProMotion** device.
2. **System scrolling** and UIKit/SwiftUI animations use high rates **automatically**.
3. **Your own** frame-driven animations must **ask** for higher rates:

```swift
// A CADisplayLink (62.5) that prefers 120 Hz, but accepts less
displayLink.preferredFrameRateRange = CAFrameRateRange(minimum: 80, maximum: 120, preferred: 120)

// A Core Animation animation with a preferred rate
let animation = CABasicAnimation(keyPath: "position")
animation.preferredFrameRateRange = CAFrameRateRange(minimum: 80, maximum: 120, preferred: 120)
```

On **iPhone**, custom animations are limited to 60 Hz unless the Info.plist key **`CADisableMinimumFrameDurationOnPhone`** is `YES`.

4. **Don't** ask for 120 Hz when it doesn't help: a slow fade looks the same at 60 Hz and uses **less battery**. The system may also lower the rate itself (Low Power Mode, heat).
5. Always compute animation progress from **elapsed time**, never "per frame" (62.5), because the frame length **changes**.

---

## 69.12 Image Decoding and Downsampling Cost 🟡

A photo file is **compressed** (JPEG, HEIC). To show it, it must be **decoded** into raw pixels, and that costs **CPU time** and **memory**:

```
12 MP photo: 4032 × 3024 pixels × 4 bytes = 48.8 MB of memory once decoded
              (the file on disk may be only 2–3 MB)
Shown as a 120 × 120 pt thumbnail at 3× = 360 × 360 pixels × 4 bytes = 0.5 MB
```

Decoding the **full** image just to display it small wastes ~**100×** the memory, plus the decode time. The fix: **downsample while decoding** with ImageIO, so the full image is **never** created:

```swift
import ImageIO
import UIKit

func downsampledImage(at url: URL, pointSize: CGSize, scale: CGFloat) -> UIImage? {
    let sourceOptions = [kCGImageSourceShouldCache: false] as CFDictionary    // don't decode yet
    guard let source = CGImageSourceCreateWithURL(url as CFURL, sourceOptions) else { return nil }

    let maxPixels = max(pointSize.width, pointSize.height) * scale
    let options = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceShouldCacheImmediately: true,          // decode now (call this off the main thread)
        kCGImageSourceCreateThumbnailWithTransform: true,    // apply the photo's rotation
        kCGImageSourceThumbnailMaxPixelSize: maxPixels
    ] as CFDictionary

    guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options) else { return nil }
    return UIImage(cgImage: cgImage, scale: scale, orientation: .up)
}
```

If you already have a `UIImage`, UIKit has helpers (iOS 15+): `image.preparingThumbnail(of:)` (sync) and `await image.byPreparingThumbnail(ofSize:)` (async), plus `prepareForDisplay()` to decode **before** the image hits the main thread.

Where this matters: photo grids, feeds, avatars, widgets (52.10), and especially **extensions** with tight memory limits (53.11). Note that SwiftUI's `AsyncImage` does **not** downsample: for big images, load and downsample yourself.

---

## 69.13 Main Thread Hangs and Detection 🟡

A **hang** is when the main thread is busy (or blocked) long enough that the app **doesn't respond** to touches: generally about **250 ms** or more. That's worse than a hitch (69.5): a hitch is a stutter in motion, a hang is "**the app froze**".

Common causes:

```swift
// ❌ Synchronous I/O on the main thread
let data = try Data(contentsOf: bigFileURL)

// ❌ Waiting for other work on the main thread
let result = semaphore.wait()                 // or DispatchQueue.sync onto a busy queue

// ❌ Heavy CPU work in a @MainActor method
@MainActor func importCookbook(_ text: String) {
    recipes = Parser.parseAll(text)            // 2 seconds of parsing
}

// ✅ Move the heavy part off the main actor, update UI at the end
@MainActor func importCookbook(_ text: String) async {
    let parsed = await Task.detached(priority: .userInitiated) {
        Parser.parseAll(text)
    }.value
    recipes = parsed
}
```

How to **find** hangs:

| Tool | When |
|---|---|
| Instruments **Hangs** instrument (in Time Profiler) | Development: shows each hang and the main thread's work during it |
| **Thread Performance Checker** (scheme ▸ Diagnostics) | Development: warns about patterns like priority inversions |
| **Settings ▸ Developer ▸ Hang Detection** on a device | Testing: shows a notification when a hang happens, with a log |
| **MetricKit** hang diagnostics (69.16) and **Organizer** hang rate (69.17) | Production: real users' hangs, with stack traces |

A long hang during **launch** or **resume** gets the app **killed** by the watchdog (`0x8badf00d`, 68.11). So hangs aren't only a "feel" problem: they become **crashes**.

---

## 69.14 Memory Footprint and Jetsam Limits 🟡

iOS has **no swap file** for apps. When memory runs low, the system **kills** processes: this is called **jetsam**. Background apps go first; a **foreground** app that goes over its **own limit** is killed too.

The limit depends on the **device** (more RAM, higher limit) and the app's **state**. There's **no crash report**: users just see the app **disappear** (and, on the next launch, start from scratch).

Watch and react to memory pressure:

```swift
import os

// How much more memory can this process use before hitting the limit? (bytes)
let remaining = os_proc_available_memory()
if remaining < 150 * 1_024 * 1_024 {
    imageCache.removeAll()                  // under 150 MB left: free what we can
}

// Respond to system memory warnings
NotificationCenter.default.addObserver(forName: UIApplication.didReceiveMemoryWarningNotification,
                                       object: nil, queue: .main) { _ in
    ImageCache.shared.removeAll()
}
```

| Big memory users | Fix |
|---|---|
| Full-size decoded **images** | Downsample (69.12) |
| **Caches** that only grow | Limits and eviction (43.12); `NSCache` evicts automatically |
| **Leaks** and abandoned objects | Leaks and Allocations (69.3, 69.4) |
| Loading **whole** files or datasets | Stream, page, or memory-map them |

How to **see** jetsam in the field:

- **MetricKit**'s `MXAppExitMetric` counts exits for **memory limit** (foreground and background).
- On devices, **JetsamEvent** reports appear in Settings ▸ Privacy & Security ▸ Analytics Data.
- The Xcode debug **memory gauge** shows your footprint live while you test.

Use **less** memory when going to the **background** (drop caches): smaller background apps are killed **less** often, so users return to where they left off.

---

## 69.15 Binary Size Reduction Techniques 🔴

App size matters to users: bigger apps take longer to **download**, may need Wi-Fi (the App Store asks before large downloads over cellular, by default above **200 MB**), and use **storage** that users clean up by deleting the biggest apps.

First, **measure** what users really download. Export an archive with **App Thinning: All compatible device variants**; Xcode writes an **App Thinning Size Report** with the download and install size per device.

Then reduce:

| Technique | Effect |
|---|---|
| **Asset catalogs** for all images | App Thinning sends each device **only** its own scale (2× or 3×) |
| Compress and right-size images; prefer **HEIC** or vector (SF Symbols, PDF) | Often the **biggest** win |
| Remove **unused** images, fonts, sounds, localizations | Tools and scripts can find unreferenced files |
| **Optimize for Size** (`-Osize`) for Swift | Smaller code, usually with little speed cost |
| **Dead Code Stripping** and **Strip Symbols** (release) | Removes unused code and debug symbols from the binary |
| Fewer / smaller **third-party SDKs** | Some SDKs add many megabytes each |
| **On-Demand Resources** or **Background Assets** | Download level packs, videos, or ML models **later**, when needed |

On-demand content in practice:

```swift
// Download the "baking" video lessons only when the user opens that section
let request = NSBundleResourceRequest(tags: ["baking-lessons"])
try await request.beginAccessingResources()
// ... use the files from Bundle.main ...
request.endAccessingResources()               // the system may purge them later
```

Check app size **in CI** (69.19): it tends to creep up one SDK and one image at a time.

---

## 69.16 MetricKit Payloads 🟡

Instruments shows performance on **your** devices. **MetricKit** shows it on **users'** devices: thousands of phone models, network conditions, and usage patterns you can't reproduce.

```swift
import MetricKit

final class MetricsReceiver: NSObject, MXMetricManagerSubscriber {
    func start() {
        MXMetricManager.shared.add(self)              // early in launch
    }

    // About once per day: aggregated metrics for the previous 24 hours
    func didReceive(_ payloads: [MXMetricPayload]) {
        for payload in payloads {
            if let launch = payload.applicationLaunchMetrics {
                print(launch.histogrammedTimeToFirstDraw)          // launch time distribution
            }
            if let hangs = payload.applicationResponsivenessMetrics {
                print(hangs.histogrammedApplicationHangTime)       // hang durations
            }
            upload(payload.jsonRepresentation())                    // send to your server
        }
    }

    // Diagnostics: crashes, hangs, CPU and disk-write exceptions, WITH call stacks
    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        for payload in payloads {
            for hang in payload.hangDiagnostics ?? [] {
                upload(hang.callStackTree.jsonRepresentation())   // where the main thread was stuck
            }
        }
    }
}
```

| Payload | Contains |
|---|---|
| `MXMetricPayload` | Launch time, hang time, memory, CPU, disk writes, animation hitches, app exits (including jetsam), battery |
| `MXDiagnosticPayload` | Crash, hang, CPU-exception, and disk-write-exception reports, with **call stacks** |

The data is **aggregated** and **anonymous**: no user identity, just numbers and stacks. Process it on your own server, or rely on the Organizer (69.17), which shows the same kind of data with no code at all.

---

## 69.17 Xcode Organizer Metrics and Regressions 🟢

**Window ▸ Organizer** shows real-world data from users who agreed to share analytics, **with no code** in your app:

| Section | Shows |
|---|---|
| **Metrics** | Launch time, hang rate, memory, disk writes, battery, scrolling hitches, terminations, per **app version** |
| **Crashes**, **Hangs**, **Energy**, **Disk Writes** reports | Grouped reports with **stack traces** (symbolicated, 68.22) |
| **Regressions** | Metrics that got **worse** in a new version |

Metrics show the **typical** user and the **worst** ones (high percentiles). The bad tail often matters most: "launch takes 0.8 s for most users but **4 s** on older devices".

A regression notice looks like:

```
Hang Rate ▲ 23% in version 4.2.0 (compared to 4.1.0)
```

Then ask: **what changed** in 4.2.0? Look at the release's changes, check the **Hangs** report for 4.2.0's top stacks, reproduce with Instruments (69.13), fix, and watch the metric come back down in the next version.

Make it a habit: check the Organizer a few days after **every** release. It turns "users say it feels slower" into **numbers**, tied to a **version**.

---

## 69.18 Energy Impact and Battery Cost 🔴

**Energy** isn't just CPU. An app with **low** CPU use can still **drain** the battery through:

| Power user | Example | Better |
|---|---|---|
| **Radios** (cellular, Wi-Fi) | Polling the server every 10 seconds; many small requests | Push notifications (50); **batch** requests; background `URLSession` with `isDiscretionary` |
| **Location** | Continuous precise GPS | The least precise mode that works (54.3, 54.5) |
| **Timers** | Many timers waking the CPU | Fewer timers; set `tolerance` so the system can group them |
| **GPU** and **screen** | Animations at 120 Hz that don't need it (69.11); always-moving UI | Animate only when useful |
| **Background work** | Long background tasks, frequent refreshes | Within budgets (49.13), only when valuable |

Why radios matter so much: each network request **wakes** the radio, and it stays in a high-power state for several **seconds** after. Ten small requests spread over a minute cost far more than **one** batched request.

```swift
// ❌ Wakes the CPU every second, even when nothing changes
Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in refreshClock() }

// ✅ Lets the system group timer wake-ups (and use Text(date, style:) where possible, 52.3)
let timer = Timer(timeInterval: 60, repeats: true) { _ in refreshClock() }
timer.tolerance = 10                          // fire any time within 10 s: saves power
RunLoop.main.add(timer, forMode: .common)
```

Measure it:

- Xcode's **Energy Impact** gauge while debugging.
- Instruments' power tools (newer Xcode versions include a **Power Profiler**), and the **Energy Log** recorded on a device (Settings ▸ Developer).
- **Organizer ▸ Energy** reports and MetricKit battery metrics from real users.

Users notice battery drain, and iOS shows which apps use the most in **Settings ▸ Battery**. Being at the top of that list leads to deletions.

---

## 69.19 Building a Performance Regression Budget 🔴

The Organizer (69.17) finds regressions **after** release. A **performance budget** catches them **before**: agreed limits for key metrics, checked automatically in **CI**:

| Metric | Example budget |
|---|---|
| Cold launch to first frame (reference device) | ≤ 600 ms |
| Scroll hitch ratio on the recipe feed | ≤ 5 ms/s |
| Memory after opening 20 recipes | ≤ 250 MB |
| App download size | ≤ 60 MB |

XCTest has **performance tests** with system metrics:

```swift
import XCTest

final class PerformanceTests: XCTestCase {
    func testColdLaunch() {
        measure(metrics: [XCTApplicationLaunchMetric()]) {
            XCUIApplication().launch()
        }
    }

    func testFeedScrolling() {
        let app = XCUIApplication()
        app.launchArguments = ["-ui-testing"]                  // fixed data (67.6)
        app.launch()
        let feed = app.collectionViews["feed.list"]

        let options = XCTMeasureOptions()
        options.invocationOptions = [.manuallyStop]
        measure(metrics: [XCTOSSignpostMetric.scrollingAndDecelerationMetric], options: options) {
            feed.swipeUp(velocity: .fast)
            stopMeasuring()
            feed.swipeDown(velocity: .fast)                     // reset, not measured
        }
    }

    func testRankingSpeed() {
        let recipes = Recipe.samples(count: 5_000)
        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            _ = rank(recipes, for: "pasta")
        }
    }
}
```

In Xcode, set a **baseline** for each test (per device) and an allowed **deviation** (for example 10%). A run that's slower than the baseline plus the deviation **fails**.

Making it reliable:

- Run on **dedicated**, consistent hardware (not a busy shared machine), with the same OS version.
- Run each measurement **several** times (XCTest does 5 by default) and compare **averages**.
- Check app **size** with a simple script on the archive (it's deterministic, so no noise).
- When a budget fails, either **fix** the regression, or **consciously** raise the budget (a new feature may be worth 50 ms). Never let it drift silently.

The maturity ladder:

```
Users complain  →  Organizer regressions (69.17)  →  MetricKit monitoring (69.16)  →  CI budgets (here)
   too late           after release                    after release, detailed         BEFORE release
```

---

## Summary

| Concept | Key tool | Purpose |
|---|---|---|
| Discipline | Measure → find → change → measure | Fix the real bottleneck |
| CPU | Time Profiler (inverted call tree) | Where CPU time goes |
| Memory growth | Allocations, Mark Generation | What each repeated action leaves behind |
| Leaks | Leaks instrument | Unreachable, never-freed objects |
| Stutters | Animation Hitches + Time Profiler | Which frames hitched, and why |
| Waiting and blocking | System Trace | Locks, preemption, priority inversion |
| Operations | `OSSignposter` intervals and events | Measure what users actually wait for |
| Launch phases | App Launch template; pre-main vs. post-main | Different causes, different fixes |
| Launch speed | Defer non-essential work | First frame fast |
| Scrolling | 16.7 / 8.3 ms budgets, off-main decoding | Smooth lists |
| ProMotion | `preferredFrameRateRange`, Info.plist key | 120 Hz when useful, less when not |
| Images | ImageIO downsampling, `byPreparingThumbnail` | Avoid giant decodes |
| Hangs | Hangs instrument, Hang Detection, MetricKit | Keep the main thread free |
| Memory limits | `os_proc_available_memory`, warnings, exit metrics | Avoid jetsam kills |
| App size | Thinning report, assets, `-Osize`, on-demand content | Faster downloads, less storage |
| Real-world data | MetricKit payloads | Users' devices, not just yours |
| Trends | Organizer metrics and regressions | Tie changes to versions |
| Energy | Radios, location, timers, GPU | Battery is more than CPU |
| Budgets | XCTest metrics, baselines, CI | Catch regressions before release |
