**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 21.1 `AsyncSequence` and `AsyncIteratorProtocol` 🟡

**`AsyncSequence`** is just like `Sequence` (14.1), except each element arrives **asynchronously**. Its iterator's `next()` is **`async`** (and can `throw`). Getting the next element may **pause**: waiting for network data, a timer, or any other async source.

```swift
protocol AsyncSequence {
    associatedtype Element
    associatedtype AsyncIterator: AsyncIteratorProtocol where AsyncIterator.Element == Element
    func makeAsyncIterator() -> AsyncIterator
}

protocol AsyncIteratorProtocol {
    associatedtype Element
    mutating func next() async throws -> Element?
}
```

(These are simplified. The real protocols also track the error type.)

Like `Sequence`, `next()` returns **`nil`** when the sequence is **finished**. The only real difference: getting each element can **suspend**.

| | `Sequence` | `AsyncSequence` |
|---|---|---|
| `next()` | Returns right away | `async`: may wait |
| Loop | `for x in s` | `for await x in s` |
| Example | `[1, 2, 3]` | Lines of a downloading file, location updates |

You've probably met one already:

```swift
// Lines of a file or URL, read as they arrive
for try await line in url.lines {
    print(line)
}

// Notifications, as an async sequence
for await _ in NotificationCenter.default.notifications(named: UIApplication.didBecomeActiveNotification) {
    print("App became active")
}
```

---

## 21.2 Consuming an Async Sequence with `for await` 🟢

**`for await`** is the async version of `for-in` (2.6). It calls `next()` again and again, **pausing** at each step until the next element is ready, and stops when the sequence returns `nil`:

```swift
func processLines(from sequence: some AsyncSequence<String, Never>) async {
    for await line in sequence {
        print("Received: \(line)")
    }
    print("Sequence finished")
}
```

For a **throwing** async sequence, use **`for try await`**, like `try await` for a single call (17.4):

```swift
func processLinesThrowing(from sequence: some AsyncSequence<String, Error>) async throws {
    for try await line in sequence {
        print("Received: \(line)")
    }
}
```

Many Apple APIs are async sequences already. For example, **`URLSession.bytes(from:)`** (section 40.11) **streams** a response, so you can handle data **as it arrives**, instead of waiting for the whole download:

```swift
let (bytes, _) = try await URLSession.shared.bytes(from: url)
for try await line in bytes.lines {
    print("Got a line: \(line)")       // handle each line as soon as it arrives
}
```

Important behavior to know:

- The loop **keeps waiting** until the sequence finishes. For an endless sequence (like notifications), code **after** the loop never runs.
- If the task is **cancelled**, most sequences end, and the loop exits.
- `break` stops the loop early, like a normal loop.

Many `Sequence` operations work on async sequences too:

```swift
for await value in sequence.filter({ $0 > 0 }).map({ $0 * 2 }).prefix(10) {
    print(value)
}

let first = await sequence.first(where: { $0 > 100 })
```

---

## 21.3 `AsyncStream` Basics 🟡

**`AsyncStream`** turns a **push-based** source (delegate callbacks, notification handlers, sensor updates) into something you can read with **`for await`**. You create it with a closure that gets a **continuation**. Call `yield` on the continuation to **send a value** into the stream:

```swift
func makeCounterStream() -> AsyncStream<Int> {
    AsyncStream { continuation in
        let task = Task {
            for count in 1...5 {
                try? await Task.sleep(for: .seconds(1))
                continuation.yield(count)   // pushes a new value into the stream
            }
            continuation.finish()           // signals the stream is complete — for await will exit its loop
        }
        continuation.onTermination = { _ in
            task.cancel()   // cleanup if the consumer stops iterating early (e.g. via cancellation)
        }
    }
}

func consumeCounter() async {
    for await value in makeCounterStream() {
        print(value)   // 1, 2, 3, 4, 5, then the loop exits after finish()
    }
}
```

| Continuation call | Effect |
|---|---|
| `yield(value)` | Sends one value to the stream |
| `finish()` | Ends the stream; `for await` exits |
| `onTermination = { ... }` | Runs when the stream ends **or** the consumer stops (cleanup) |

A very common real use: wrapping a **delegate** API. **`AsyncStream.makeStream`** gives you the stream **and** the continuation separately, which fits delegates well:

```swift
import CoreLocation

final class LocationStream: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private let continuation: AsyncStream<CLLocation>.Continuation
    let locations: AsyncStream<CLLocation>

    override init() {
        (locations, continuation) = AsyncStream.makeStream(of: CLLocation.self)
        super.init()
        manager.delegate = self
        manager.startUpdatingLocation()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for location in locations {
            continuation.yield(location)          // delegate callback → stream value
        }
    }
}

// Usage:
for await location in LocationStream().locations {
    print(location.coordinate)
}
```

**Continuation vs stream:**

| | `withCheckedContinuation` (18.11) | `AsyncStream` |
|---|---|---|
| Callback fires | **Once** | **Many times** |
| You get | One value with `await` | A sequence with `for await` |

---

## 21.4 `AsyncThrowingStream` and Finishing with Error 🟡

**`AsyncThrowingStream`** is the version that can **fail**. `continuation.finish(throwing:)` ends the stream **with an error**. The error is **thrown** out of the `for try await` loop, instead of the loop just ending:

```swift
func makeDataStream() -> AsyncThrowingStream<Data, Error> {
    AsyncThrowingStream { continuation in
        let connection = startLegacyConnection { result in
            switch result {
            case .success(let data):
                continuation.yield(data)
            case .failure(let error):
                continuation.finish(throwing: error)   // ends the stream WITH an error
            }
        }
        continuation.onTermination = { _ in
            connection.cancel()
        }
    }
}

func consumeData() async {
    do {
        for try await chunk in makeDataStream() {
            process(chunk)
        }
    } catch {
        print("Stream failed: \(error)")
    }
}
```

| End the stream with | `for try await` then... |
|---|---|
| `continuation.finish()` | Exits the loop normally |
| `continuation.finish(throwing: error)` | Throws `error` out of the loop |

This is the same pattern you see all over Swift concurrency: **the same tool, plus a throwing version** when failure is possible (`withCheckedContinuation` / `withCheckedThrowingContinuation`, `AsyncStream` / `AsyncThrowingStream`).

---

## 21.5 Buffering Policies and Back-Pressure 🔴

The **producer** (the code calling `yield`) and the **consumer** (the `for await` loop) run **independently**. What if the producer sends values **faster** than the consumer handles them? The **`bufferingPolicy`** decides:

```swift
// unbounded: buffer every value, no matter how far the consumer falls behind (risk: unbounded memory growth)
AsyncStream(bufferingPolicy: .unbounded) { continuation in /* ... */ }

// bufferingNewest(n): keep only the most recent n values, discarding older ones once the buffer is full
AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in /* ... */ }

// bufferingOldest(n): keep only the first n values once the buffer is full, discarding newer ones
AsyncStream(bufferingPolicy: .bufferingOldest(1)) { continuation in /* ... */ }
```

Example: the producer sends 1, 2, 3, 4, 5 while the consumer is busy. When the consumer asks again, it gets:

```plaintext
.unbounded           →  1, 2, 3, 4, 5      (all of them; memory may grow)
.bufferingNewest(1)  →  5                  (only the latest)
.bufferingOldest(1)  →  1                  (only the first; newer ones dropped)
```

This is called **back-pressure**: how you handle a fast producer and a slow consumer.

| Policy | Good for |
|---|---|
| `.unbounded` (default) | Every value matters, and the rate is reasonable (messages, events) |
| `.bufferingNewest(1)` | Only the **latest** value matters (sensor readings, location, UI state) |
| `.bufferingOldest(n)` | The **first** values matter more than later ones |

`yield` tells you what happened, if you need to know:

```swift
let result = continuation.yield(reading)
if case .dropped = result {
    droppedCount += 1               // the buffer was full, and a value was dropped
}
```

---

## 21.6 Writing a Custom `AsyncSequence` 🔴

You can implement both protocols from 21.1 **directly**, instead of using `AsyncStream`. That gives you **full control**, and a **reusable type**:

```swift
struct Countdown: AsyncSequence {
    typealias Element = Int
    let start: Int

    struct AsyncIterator: AsyncIteratorProtocol {
        var current: Int
        mutating func next() async -> Int? {
            guard current > 0 else { return nil }
            try? await Task.sleep(for: .seconds(1))   // simulate async work between elements
            defer { current -= 1 }
            return current
        }
    }

    func makeAsyncIterator() -> AsyncIterator {
        AsyncIterator(current: start)
    }
}

func runCountdown() async {
    for await number in Countdown(start: 3) {
        print(number)   // 3 (after ~1s), 2 (after ~2s), 1 (after ~3s)
    }
}
```

It's the same shape as the custom `Sequence` in 14.1. The only change: `next()` is **`async`**, so it can **pause** (here with `Task.sleep`) between elements. A normal `Sequence` can't do that.

Handle **cancellation** inside `next()`, so loops stop when the task is cancelled:

```swift
mutating func next() async -> Int? {
    guard current > 0, !Task.isCancelled else { return nil }   // end the sequence when cancelled
    try? await Task.sleep(for: .seconds(1))
    guard !Task.isCancelled else { return nil }
    defer { current -= 1 }
    return current
}
```

A practical example: page through an API, one page at a time, as the loop asks for more:

```swift
struct PagedRecipes: AsyncSequence {
    typealias Element = [Recipe]
    let api: RecipeAPI

    struct AsyncIterator: AsyncIteratorProtocol {
        let api: RecipeAPI
        var nextPage: Int? = 1

        mutating func next() async throws -> [Recipe]? {
            guard let page = nextPage else { return nil }      // no more pages
            let response = try await api.recipes(page: page)
            nextPage = response.hasMore ? page + 1 : nil
            return response.items
        }
    }

    func makeAsyncIterator() -> AsyncIterator { AsyncIterator(api: api) }
}

for try await page in PagedRecipes(api: api) {
    recipes += page            // the next page is only loaded when the loop needs it
}
```

**When to use which:** `AsyncStream` for wrapping **push** sources (callbacks, delegates). A custom `AsyncSequence` for **pull** sources, where each element is produced **on demand**.

---

## 21.7 swift-async-algorithms: `debounce` and `throttle` 🟡

**swift-async-algorithms** is an official Swift package (add it with SPM: `github.com/apple/swift-async-algorithms`). It adds common operators to `AsyncSequence`, like the ones you may know from Combine or RxSwift.

**`debounce`** and **`throttle`** both **limit how often** values come through, in different ways:

```swift
import AsyncAlgorithms

// debounce: only emits a value after the source has been quiet for the specified duration —
// ideal for something like a search field that shouldn't fire a network request on every keystroke
let debounced = searchTextStream.debounce(for: .milliseconds(300))

for await query in debounced {
    await performSearch(query)   // only fires 300ms after the user stops typing
}

// throttle: emits at most one value per specified interval, regardless of how many arrive —
// ideal for rate-limiting a rapidly-firing source like scroll position updates
let throttled = scrollPositionStream._throttle(for: .milliseconds(100))
```

(Throttle is currently spelled **`_throttle`** in the package, because its API isn't final yet.)

On a timeline, typing "swift" quickly, then pausing:

```plaintext
input:     s  sw  swi  swif  swift  ........(pause 300 ms)
debounce:                                     swift          ← one value, after the pause

scroll events: ||||||||||||||||||||||||||||||| (very fast)
throttle(100ms):  |    |    |    |    |    |   ← at most one every 100 ms
```

| | `debounce` | `throttle` |
|---|---|---|
| Emits | After a **pause** in activity | At a **steady maximum rate** |
| Good for | "Wait until the user stops typing" | "Handle scroll events at most 10× per second" |

---

## 21.8 swift-async-algorithms: `merge`, `zip`, `combineLatest` 🟡

These three operators **combine several async sequences** into one, each in a different way. They're like `zip` from 3.15, but for **async** sources:

```swift
import AsyncAlgorithms

// merge: interleaves elements from multiple sequences as they arrive, in whatever order they actually occur
let merged = merge(sequenceA, sequenceB)
for await value in merged {
    print(value)   // elements from either source, in arrival order
}

// zip: pairs up elements positionally, waiting for both sources to each produce their next element
let zipped = zip(namesStream, agesStream)
for await (name, age) in zipped {
    print("\(name): \(age)")
}

// combineLatest: emits a new combined value whenever *either* source produces a new element,
// pairing it with the most recent value from the other source
let combined = combineLatest(temperatureStream, humidityStream)
for await (temp, humidity) in combined {
    print("Temp: \(temp), Humidity: \(humidity)")
}
```

```plaintext
A:  1 ------- 2 ------------- 3
B:  ---- x ------------ y -------

merge:          1, x, 2, y, 3                  (everything, in arrival order)
zip:            (1,x), (2,y)                   (pairs by position; waits for both)
combineLatest:  (1,x), (2,x), (2,y), (3,y)     (whenever either changes, with the other's latest)
```

| Operator | Element type | Emits when |
|---|---|---|
| `merge` | Same type from all sources | **Any** source emits |
| `zip` | A tuple | **Both** have a new element |
| `combineLatest` | A tuple | **Either** changes (after both have one) |

`combineLatest` is the usual choice for combining **independent state** that keeps updating, like form fields:

```swift
for await (email, password) in combineLatest(emailStream, passwordStream) {
    isSubmitEnabled = email.contains("@") && password.count >= 8
}
```

---

## 21.9 swift-async-algorithms: `chunked` and Batching 🔴

**Chunking** groups a stream's elements into **batches**, by **count** or by **time**. It's useful when elements arrive **too fast** to handle one by one efficiently.

```swift
import AsyncAlgorithms

// chunked by count: groups elements into arrays of exactly N (the last chunk may be smaller)
let chunkedByCount = numberStream.chunks(ofCount: 10)
for await batch in chunkedByCount {
    print("Processing batch of \(batch.count) items")
}

// chunked by time: groups whatever elements arrived within a time window into one batch
let chunkedByTime = eventStream.chunked(by: AsyncTimerSequence.repeating(every: .seconds(1)))
for await batch in chunkedByTime {
    print("Processing \(batch.count) events from the last second")
}
```

You can combine both: "**50 items, or 1 second, whichever comes first**":

```swift
let batches = analyticsEvents.chunks(ofCount: 50, or: AsyncTimerSequence.repeating(every: .seconds(1)))

for await batch in batches {
    try? await uploader.send(batch)      // one request per batch, not one per event
}
```

This is a common pattern for **analytics** (see batching in 80.3): instead of one network request **per event**, send one request per batch. That saves battery and network.

---

## 21.10 Bridging `@Observable` to Async with `Observations` 🔴

**`Observations`** (Swift 6.2, iOS 26) turns changes of `@Observable` properties (14.20) into an **`AsyncSequence`**. So you can react to model changes with **`for await`**, instead of the callback-style `withObservationTracking`.

```swift
@Observable
class Counter {
    var count = 0
}

func watchCounter(_ counter: Counter) async {
    let changes = Observations { counter.count }
    for await value in changes {
        print("count is now \(value)")
    }
}

let counter = Counter()
Task { await watchCounter(counter) }
counter.count += 1   // "count is now 1" prints via the async sequence
```

How it behaves:

- It emits the **current value first**, then a new value after each change.
- The closure can read **several** properties. It re-runs when **any** of them change.
- Changes made together in one go may arrive as **one** update (they're "coalesced").

```swift
let summary = Observations { "\(cart.items.count) items, total \(cart.total)" }
for await text in summary {
    badgeLabel = text              // updates when items OR total changes
}
```

Compare with the callback version from 14.20:

| | `withObservationTracking` | `Observations` |
|---|---|---|
| Style | Callback, fires **once** | `AsyncSequence`, keeps going |
| Re-register after each change | You must | Automatic |
| Works with `debounce`, `combineLatest`, ... | No | Yes |

This connects two newer systems: **Observation's** precise tracking and **`AsyncSequence`'s** `for await`. You can even run model changes through the operators from 21.7–21.9:

```swift
for await query in Observations({ searchModel.text }).debounce(for: .milliseconds(300)) {
    await searchModel.search(query)
}
```

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `AsyncSequence`/`AsyncIteratorProtocol` | Like `Sequence`, but `next()` is `async` |
| `for await` | The async `for-in`; `for try await` for throwing sequences |
| `AsyncStream` | Turns repeated callbacks or delegates into a `for await` sequence |
| `AsyncThrowingStream` | Can end with `finish(throwing:)` |
| Buffering policies | Handle a fast producer: keep all, newest, or oldest values |
| Custom `AsyncSequence` | Your own type; great for on-demand (pull) sources like pagination |
| `debounce`/`throttle` | Wait for a pause vs cap the rate |
| `merge`/`zip`/`combineLatest` | Interleave, pair by position, or pair latest values |
| `chunked` | Batch by count or time to reduce work |
| `Observations` | `@Observable` changes as an `AsyncSequence` |
