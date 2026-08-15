## 34.1 DocumentGroup Basics

`DocumentGroup` is the `Scene` type purpose-built for document-based apps — it automatically wires up the standard system document lifecycle: File > New, File > Open, the macOS/iPadOS document browser, recent documents, and autosave.

```swift
@main
struct NotesDocumentApp: App {
    var body: some Scene {
        DocumentGroup(newDocument: NoteDocument()) { file in
            NoteEditorView(document: file.$document)
        }
    }
}
```

`DocumentGroup(newDocument:)` takes a factory value (or closure) producing a fresh, empty document for the File > New flow, and its content closure receives a `file` binding wrapper giving access to the currently open document (`file.$document`) for the editor view to read and mutate. This single declaration replaces what would otherwise be substantial manual UIKit/AppKit document-lifecycle plumbing — opening, saving, and presenting the system document browser all come essentially for free.

---

## 34.2 FileDocument and ReferenceFileDocument

`FileDocument` defines a value-type (struct-based) document model, appropriate for documents that are naturally copy-on-write and don't need shared mutable reference semantics; `ReferenceFileDocument` is the class-based counterpart for documents better modeled as a shared mutable reference (such as one with expensive-to-copy internal state or in-place mutation patterns).

```swift
struct NoteDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.plainText] }

    var text: String

    init(text: String = "") {
        self.text = text
    }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents,
              let string = String(data: data, encoding: .utf8) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        text = string
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: Data(text.utf8))
    }
}
```

`FileDocument` requires `readableContentTypes` (the `UTType`s it can open), an `init(configuration:)` to parse raw file data into the model, and `fileWrapper(configuration:)` to serialize the model back to disk. Because `FileDocument` is a `struct`, SwiftUI's normal state-diffing machinery (recall section 25's value-type observation) applies naturally — each edit produces a new value, and the framework can efficiently detect exactly what changed. `ReferenceFileDocument` mirrors this same shape but as a class-based protocol with an additional `snapshot(contentType:)` requirement, used specifically to support undo and to decouple in-progress edits from the state actually being written to disk.

---

## 34.3 ReadableDocument and WritableDocument (iOS 27)

`ReadableDocument` and `WritableDocument` split the read and write halves of document I/O into separate, narrower protocols, primarily to support async, streaming-friendly document access patterns better suited to very large files or remote/cloud-backed storage than the original synchronous `FileDocument` model.

```swift
struct LargeDatasetDocument: ReadableDocument, WritableDocument {
    static var readableContentTypes: [UTType] { [.commaSeparatedText] }

    var rows: [DataRow]

    static func read(from source: DocumentReadSource) async throws -> LargeDatasetDocument {
        var rows: [DataRow] = []
        for try await line in source.lines() {
            rows.append(DataRow(parsing: line))
        }
        return LargeDatasetDocument(rows: rows)
    }

    func write(to destination: DocumentWriteDestination) async throws {
        for row in rows {
            try await destination.writeLine(row.serialized())
        }
    }
}
```

Splitting reading and writing into separate protocol requirements (rather than one combined `FileDocument` conformance) lets a document type participate in only the capability it actually needs — a read-only viewer, for instance, could conform to just `ReadableDocument`. The `async`/`await`-based, streaming-style API (`for try await line in source.lines()`) directly applies structured concurrency (Part 2) to document I/O, allowing large files to be read and written incrementally rather than requiring the entire file's contents to be materialized in memory synchronously up front, as the original `FileDocument` model effectively requires.

---

## 34.4 Snapshot-Based Diffing and Performance

`ReferenceFileDocument`'s `snapshot(contentType:)` requirement produces an immutable, point-in-time value-type copy of a reference document's current state — used by SwiftUI to compute exactly what changed since the last save without needing to lock or freeze the live, mutable document object itself.

```swift
@Observable
class DrawingDocument: ReferenceFileDocument {
    static var readableContentTypes: [UTType] { [.drawingDocument] }

    var strokes: [Stroke] = []

    required init(configuration: ReadConfiguration) throws {
        // decode strokes from configuration.file
        strokes = []
    }

    func snapshot(contentType: UTType) throws -> [Stroke] {
        strokes // a value-type copy, safe to diff/serialize independently of live edits
    }

    func fileWrapper(snapshot: [Stroke], configuration: WriteConfiguration) throws -> FileWrapper {
        let data = try JSONEncoder().encode(snapshot)
        return FileWrapper(regularFileWithContents: data)
    }
}
```

Because `strokes` on a live `ReferenceFileDocument` instance can keep mutating while a save is in progress (the user might keep drawing), serializing directly from the live object risks capturing a torn, inconsistent state mid-write. `snapshot(contentType:)` sidesteps this by handing back an immutable value-type copy (here, a plain `[Stroke]` array) representing exactly the state at the moment the snapshot was taken — `fileWrapper(snapshot:configuration:)` then serializes from that frozen snapshot, decoupled from whatever further edits happen on the live document afterward, which is both safer and avoids blocking ongoing user interaction during potentially slow serialization.

---

## 34.5 Custom UTType Declarations

A document app's custom file format needs a corresponding `UTType` (Uniform Type Identifier) declaration, registered both in Swift code and in the app's Info.plist, so the system knows how to recognize, icon, and route files of that type to the app.

```swift
extension UTType {
    static var drawingDocument: UTType {
        UTType(exportedAs: "com.example.myapp.drawing")
    }
}
```

```xml
<!-- Info.plist: declaring the exported type -->
<key>UTExportedTypeDeclarations</key>
<array>
    <dict>
        <key>UTTypeIdentifier</key>
        <string>com.example.myapp.drawing</string>
        <key>UTTypeConformsTo</key>
        <array><string>public.data</string></array>
        <key>UTTypeTagSpecification</key>
        <dict>
            <key>public.filename-extension</key>
            <array><string>drawing</string></array>
        </dict>
    </dict>
</array>
```

The Swift-side `UTType` extension and the Info.plist `UTExportedTypeDeclarations` entry must agree on the same reverse-DNS type identifier string — together, they tell the system "this app owns and can open files with the `.drawing` extension," which is what enables double-clicking a `.drawing` file in Finder (or the Files app) to correctly launch this specific app, and what makes `readableContentTypes` in `FileDocument`/`ReferenceFileDocument` meaningful as a filter.

---

## 34.6 Multi-Format Document Support

A single document-based app can support multiple distinct file formats — for import/export compatibility, or because a document naturally has several valid on-disk representations — by declaring multiple `UTType`s in `readableContentTypes`/`writableContentTypes` and branching format-specific logic within the document's read/write implementations.

```swift
struct MultiFormatDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.myAppFormat, .plainText, .commaSeparatedText] }
    static var writableContentTypes: [UTType] { [.myAppFormat, .plainText] }

    var content: DocumentContent

    init(configuration: ReadConfiguration) throws {
        switch configuration.contentType {
        case .plainText:
            content = try DocumentContent(parsingPlainText: configuration.file)
        case .commaSeparatedText:
            content = try DocumentContent(parsingCSV: configuration.file)
        default:
            content = try DocumentContent(parsingNativeFormat: configuration.file)
        }
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        switch configuration.contentType {
        case .plainText:
            return try content.asPlainTextFileWrapper()
        default:
            return try content.asNativeFormatFileWrapper()
        }
    }
}
```

`configuration.contentType` (available on both the read and write configuration types) tells the document exactly which format is being read from or written to for a given operation, letting one document type gracefully handle several formats — for instance, allowing users to open plain `.txt` or `.csv` files directly into the app's native editing experience, while still saving in the app's own richer native format by default. Separating `readableContentTypes` from `writableContentTypes` (as shown, `.commaSeparatedText` is readable but not writable) is a common pattern for supporting broad import compatibility while keeping export focused on formats the app can serialize with full fidelity.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Document scene | `DocumentGroup` | Automatic New/Open/browser/autosave lifecycle |
| Value document model | `FileDocument` | Struct-based document with synchronous read/write |
| Reference document model | `ReferenceFileDocument` | Class-based document with snapshot-based saving |
| Async document I/O | `ReadableDocument`/`WritableDocument` | Streaming, structured-concurrency-friendly access |
| Safe concurrent saving | `snapshot(contentType:)` | Immutable point-in-time copy for serialization |
| Custom file types | `UTType`, Info.plist declarations | Register and recognize a custom document format |
| Format flexibility | `readableContentTypes`/`writableContentTypes` | Support import/export across multiple formats |

**Next up:** Section 35 — UIKit Essentials (opening Part 4 — UIKit).
