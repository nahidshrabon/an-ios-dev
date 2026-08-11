## 21.1 `AsyncSequence` and `AsyncIteratorProtocol`

`AsyncSequence` mirrors `Sequence` (recall 14.1) exactly, except each element is produced *asynchronously* — its `next()` method is `async` (and `throws`, for the throwing variant), meaning producing the next element might involve genuine suspension (waiting on network data, a timer, or any other async source).

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

Just as `Sequence`'s `next()` returns `nil` when exhausted (recall 14.1), `AsyncIteratorProtocol`'s `next()` returns `nil` to signal the sequence has genuinely finished — the only structural difference is that producing each element is itself an asynchronous, potentially suspending operation.

---

## 21.2 Consuming an Async Sequence with `for await`

`for await` is the async counterpart to `for-in` (recall section 2.6) — it repeatedly calls `next()` on the underlying async iterator, suspending at each step until the next element is ready, until the sequence signals completion with `nil`:

```swift
func processLines(from sequence: some AsyncSequence<String, Never>) async {
    for await line in sequence {
        print("Received: \(line)")
    }
    print("Sequence finished")
}
```

For a throwing async sequence, `for try await` combines both suspension and error propagation, exactly mirroring `async throws` function calls from section 17.4:

```swift
func processLinesThrowing(from sequence: some AsyncSequence<String, Error>) async throws {
    for try await line in sequence {
        print("Received: \(line)")
    }
}
```

Many standard-library and Foundation APIs already conform to `AsyncSequence` directly — for example, `URLSession.bytes(from:)` (covered in section 40.11) returns an async sequence of bytes you can iterate with `for try await`, streaming a response incrementally rather than waiting for the entire download to complete.

---

## 21.3 `AsyncStream` Basics

`AsyncStream` is the standard bridge for turning a **push-based**, callback-driven event source (like a delegate callback, a notification handler, or a sensor reading callback) into something consumable with `for await` — you create it with a closure that receives a `continuation`, which you call to emit values into the stream.

```swift
func makeCounterStream() -> AsyncStream<Int> {
    AsyncStream { continuation in
        var count = 0
        let timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            count += 1
            continuation.yield(count)   // pushes a new value into the stream
            if count >= 5 {
                continuation.finish()    // signals the stream is complete — for await will exit its loop
            }
        }
        continuation.onTermination = { _ in
            timer.invalidate()   // cleanup if the consumer stops iterating early (e.g. via cancellation)
        }
    }
}

func consumeCounter() async {
    for await value in makeCounterStream() {
        print(value)   // 1, 2, 3, 4, 5, then the loop exits after finish()
    }
}
```

This is precisely the async/await-native replacement for wrapping a delegate/callback API — where section 18.11's `withCheckedContinuation` bridges exactly *one* callback invocation into a single `await`-able value, `AsyncStream` bridges a *repeated series* of callback invocations into a continuous sequence of values.

---

## 21.4 `AsyncThrowingStream` and Finishing with Error

`AsyncThrowingStream` is the throwing counterpart — its `continuation.finish(throwing:)` lets the underlying event source signal a genuine failure, which propagates as a thrown error out of the consuming `for try await` loop rather than simply ending the sequence cleanly:

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

This mirrors the plain/throwing split seen throughout Swift Concurrency (`AsyncSequence` vs. its throwing element type, `Task.sleep` vs. a cancelling throw, `withCheckedContinuation` vs. `withCheckedThrowingContinuation`) — a consistent pattern of "the same tool, plus a throwing variant when failure is a real possibility."

---

## 21.5 Buffering Policies and Back-Pressure

Since a stream's producer (the closure calling `continuation.yield(...)`) and its consumer (the `for await` loop) run independently, a mismatch in their speeds raises a real question: what happens if the producer yields values faster than the consumer processes them? `AsyncStream`'s `bufferingPolicy` parameter controls exactly this.

```swift
// unbounded: buffer every value, no matter how far the consumer falls behind (risk: unbounded memory growth)
AsyncStream(bufferingPolicy: .unbounded) { continuation in /* ... */ }

// bufferingNewest(n): keep only the most recent n values, discarding older ones once the buffer is full
AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in /* ... */ }

// bufferingOldest(n): keep only the first n values once the buffer is full, discarding newer ones
AsyncStream(bufferingPolicy: .bufferingOldest(1)) { continuation in /* ... */ }
```

This buffering choice is exactly what "back-pressure" refers to: a strategy for handling the case where a fast producer would otherwise overwhelm a slower consumer. `.bufferingNewest(1)` is a common, sensible choice for something like sensor readings or UI state updates, where only the *latest* value genuinely matters and older, stale values can be safely dropped without harm.

---

## 21.6 Writing a Custom `AsyncSequence`

Combining 21.1's two protocols directly (rather than using `AsyncStream`) gives you full control over element production — useful when you want a genuinely custom, reusable async sequence type rather than a one-off stream instance:

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

This directly parallels the custom `Sequence` example from section 14.1 (`Countdown`/`CountdownIterator`) — the only structural change is marking `next()` as `async` and allowing genuine suspension (here, `Task.sleep`) between elements, which a synchronous `Sequence` could never do.

---

## 21.7 swift-async-algorithms: `debounce` and `throttle`

The swift-async-algorithms package (an official, separate Swift package extending `AsyncSequence` with common stream-processing operators) provides `debounce` and `throttle` — both rate-limiting techniques, but with different semantics, directly analogous to their well-known Combine/RxSwift/reactive-programming counterparts.

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
let throttled = scrollPositionStream.throttle(for: .milliseconds(100))
```

The distinction matters: `debounce` waits for a pause in activity before emitting (good for "wait until the user stops typing"), while `throttle` emits at a steady maximum rate regardless of pauses (good for "don't process scroll events more than 10 times per second, no matter how fast they're firing").

---

## 21.8 swift-async-algorithms: `merge`, `zip`, `combineLatest`

These three operators combine multiple async sequences into one, each with different combination semantics — directly mirroring `zip` from section 3.15, but for asynchronous sources instead of synchronous collections.

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

`zip` requires both sources to each produce a corresponding element (stopping once either source is exhausted, mirroring section 3.15's synchronous `zip`); `combineLatest` instead reacts to *either* source updating, always pairing with the other's latest known value — a much more common pattern for combining multiple independent, continuously-updating state sources.

---

## 21.9 swift-async-algorithms: `chunked` and Batching

`chunked` groups a continuous async sequence's elements into batches, either by a fixed count or by a time window — useful for reducing the frequency of downstream processing when individual elements arrive too rapidly to handle one at a time efficiently.

```swift
import AsyncAlgorithms

// chunked by count: groups elements into arrays of exactly N (the last chunk may be smaller)
let chunkedByCount = numberStream.chunks(ofCount: 10)
for await batch in chunkedByCount {
    print("Processing batch of \(batch.count) items")
}

// chunked by time: groups whatever elements arrived within a time window into one batch
let chunkedByTime = eventStream.chunked(by: .repeating(every: .seconds(1)))
for await batch in chunkedByTime {
    print("Processing \(batch.count) events from the last second")
}
```

This is a common real pattern for things like batching analytics events (send one network request per 50 events, or once per second, whichever comes first) rather than making one round-trip per individual event — directly reducing overhead for high-frequency event sources.

---

## 21.10 Bridging `@Observable` to Async with `Observations`

`Observations` (built on the `Observation` module from section 14.20) turns `@Observable` property changes into an `AsyncSequence` you can iterate with `for await` — letting you react to state changes using the same async-sequence-consuming patterns covered throughout this section, rather than the callback-style `withObservationTracking`.

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

This bridges two of Swift's newer systems — `Observation`'s fine-grained tracking (section 14.20) and `AsyncSequence`'s pull-based consumption model — giving you a natural `for await`-based way to react to model changes over time, well-suited for scenarios like piping observable state changes through the same `merge`/`combineLatest`/`chunked` operators covered in 21.7–21.9.

---

## Summary

| Topic | One-line takeaway |
|---|---|
| `AsyncSequence`/`AsyncIteratorProtocol` | The async counterpart to `Sequence`; `next()` is `async` (and optionally `throws`) |
| `for await` | The async counterpart to `for-in`; `for try await` adds error propagation |
| `AsyncStream` | Bridges a push-based, callback-driven event source into a `for await`-consumable sequence |
| `AsyncThrowingStream` | Adds `finish(throwing:)`, propagating a genuine failure out of the consuming loop |
| Buffering policies | `.unbounded`/`.bufferingNewest(n)`/`.bufferingOldest(n)` control back-pressure between mismatched producer/consumer speeds |
| Custom `AsyncSequence` | Implement both protocols directly for a genuinely reusable, custom async sequence type |
| `debounce`/`throttle` | Rate-limit a source — wait for a pause vs. cap the maximum emission rate |
| `merge`/`zip`/`combineLatest` | Combine multiple async sequences — interleave, pair positionally, or pair with the latest from each |
| `chunked` | Batch a rapid sequence's elements by count or time window, reducing downstream processing frequency |
| `Observations` | Bridges `@Observable` property changes into an `AsyncSequence`, consumable with `for await` |

**Next up:** Section 22 — Legacy Concurrency.
