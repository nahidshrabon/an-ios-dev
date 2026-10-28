**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

A **document-based app** works with **files** the user owns: text files, drawings, spreadsheets. The user creates, opens, renames, and shares them, in the **Files** app on iOS or the **Finder** on Mac. SwiftUI gives you all the standard document features (New, Open, Save, the document browser, autosave, recent files) with very little code. You describe **how to read and write** your file format; the system does the rest.

---

## 34.1 DocumentGroup Basics 🟢

**`DocumentGroup`** is a **scene** type made for document apps. One declaration gives you the full document **lifecycle**:

```swift
@main
struct NotesDocumentApp: App {
    var body: some Scene {
        DocumentGroup(newDocument: NoteDocument()) { file in
            NoteEditorView(document: file.$document)
        }
    }
}

struct NoteEditorView: View {
    @Binding var document: NoteDocument

    var body: some View {
        TextEditor(text: $document.text)     // edits go straight into the document
    }
}
```

The two parts:

- **`newDocument:`** makes a **fresh, empty** document when the user chooses **New**.
- The **content closure** gets a **`file`** value. **`file.$document`** is a **binding** to the open document, so the editor can **read and change** it.

What you get **for free**:

| Feature | iOS / iPadOS | macOS |
|---|---|---|
| Create a new document | ✅ "+" in the browser | ✅ File → New (⌘N) |
| Open existing files | ✅ Document browser | ✅ File → Open (⌘O) |
| Autosave | ✅ | ✅ |
| Rename, duplicate, move | ✅ | ✅ |
| Recent documents | ✅ | ✅ File → Open Recent |
| One window per document | iPad | ✅ |

Without `DocumentGroup`, you'd write all of that yourself with `UIDocument` and `UIDocumentBrowserViewController` (or `NSDocument` on the Mac).

For an app that only **opens** files and never edits them (a viewer), use the **viewing** form:

```swift
DocumentGroup(viewing: PDFReportDocument.self) { file in
    ReportViewer(document: file.document)    // read-only: no binding
}
```

---

## 34.2 FileDocument and ReferenceFileDocument 🟡

You describe your document with one of two protocols:

| | `FileDocument` | `ReferenceFileDocument` |
|---|---|---|
| Type | A **struct** (value type) | A **class** (reference type) |
| Editor gets | A **binding** (`file.$document`) | The **object** (`file.document`) |
| Saving | SwiftUI copies the value | You provide a **snapshot** (34.4) |
| Change tracking | Automatic, through the binding | Through the **undo manager** |
| Best for | Small to medium, simple documents | Large documents, complex models |

A complete **`FileDocument`** for plain text:

```swift
import SwiftUI
import UniformTypeIdentifiers

struct NoteDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.plainText] }   // which files it can open

    var text: String

    init(text: String = "") {
        self.text = text
    }

    // READ: file → model
    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents,
              let string = String(data: data, encoding: .utf8) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        text = string
    }

    // WRITE: model → file
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: Data(text.utf8))
    }
}
```

A `FileDocument` needs **three** things:

1. **`readableContentTypes`**: the **file types** (`UTType`s, 34.5) it can open. `writableContentTypes` defaults to the same list.
2. **`init(configuration:)`**: **parse** the file's data into your model. Throw if the data is bad.
3. **`fileWrapper(configuration:)`**: **turn** your model back into file data.

Because it's a **struct**, every edit makes a **new value**, just like any `@State` struct. SwiftUI sees the change through the **binding**, marks the document as **edited**, and **autosaves** it. You don't write any save code.

SwiftUI may call `fileWrapper` on a **background thread**, with a **copy** of your value. Since it's a struct, that copy is **safe** to read while the user keeps typing.

For **JSON** models, the code is just as short:

```swift
struct TodoListDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.todoList] }    // a custom type (34.5)

    var items: [TodoItem] = []

    init() {}

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }
        items = try JSONDecoder().decode([TodoItem].self, from: data)
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: try JSONEncoder().encode(items))
    }
}
```

---

## 34.3 ReadableDocument and WritableDocument (iOS 27) 🔴

`FileDocument` reads and writes the **whole file at once**, as one `Data` value in memory. That's fine for notes, but not for a **2 GB** data file or a file stored in the **cloud**.

The iOS 27 SDK (in the title) introduces **`ReadableDocument`** and **`WritableDocument`**, which split document I/O into **two separate, `async`** protocols:

```swift
struct LargeDatasetDocument: ReadableDocument, WritableDocument {
    static var readableContentTypes: [UTType] { [.commaSeparatedText] }

    var rows: [DataRow]

    static func read(from source: DocumentReadSource) async throws -> LargeDatasetDocument {
        var rows: [DataRow] = []
        for try await line in source.lines() {          // stream the file line by line
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

⚠️ These are **new APIs**. Exact type and method names can change between SDK betas, so **check the current documentation** before relying on this code.

The **ideas** behind the design hold either way:

- **Two protocols, two jobs.** A **viewer** only needs reading, so it conforms to **just** `ReadableDocument`. Small protocols that each do one thing (8.5).
- **`async` I/O.** Reading and writing can **wait** (for disk or network) without blocking the main thread (17).
- **Streaming.** `for try await line in ...` is an `AsyncSequence` (21): it handles **one line at a time**, so the whole file never has to sit in memory.

You can **stream** files **today** with Foundation, on any recent OS. `URL.lines` is an `AsyncSequence` of lines:

```swift
func countRows(in url: URL) async throws -> Int {
    var count = 0
    for try await _ in url.lines {     // reads the file bit by bit, not all at once
        count += 1
    }
    return count
}
```

For very large documents on current OS versions, another option is a **package** document: a **folder** that looks like one file, where each part is saved separately (a directory `FileWrapper`). Then saving one change doesn't rewrite everything.

---

## 34.4 Snapshot-Based Diffing and Performance 🔴

A **`ReferenceFileDocument`** is a **class**: the live object the user edits. Saving it is harder than saving a struct, because the user can **keep editing** while the save runs **in the background**. If the writer read the live object directly, it could see **half-changed** data and write a **broken** file.

The fix is a **snapshot**: a **frozen copy** of the state, taken at one moment, that the writer uses instead:

```swift
import Combine

final class DrawingDocument: ReferenceFileDocument {
    static var readableContentTypes: [UTType] { [.drawingDocument] }

    @Published var strokes: [Stroke] = []      // ReferenceFileDocument is an ObservableObject

    init() {}

    required init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }
        strokes = try JSONDecoder().decode([Stroke].self, from: data)
    }

    // 1. Called on the MAIN thread: copy the current state
    func snapshot(contentType: UTType) throws -> [Stroke] {
        strokes                                // an array of structs: a real, independent copy
    }

    // 2. Called on a BACKGROUND thread: write the frozen copy
    func fileWrapper(snapshot: [Stroke], configuration: WriteConfiguration) throws -> FileWrapper {
        let data = try JSONEncoder().encode(snapshot)
        return FileWrapper(regularFileWithContents: data)
    }
}
```

How saving works:

1. SwiftUI calls **`snapshot(contentType:)`** on the **main thread**. It's quick: just copy the data.
2. SwiftUI calls **`fileWrapper(snapshot:configuration:)`** on a **background thread**, with that **copy**.
3. Meanwhile, the user **keeps drawing** on the live object. The save isn't affected, and the UI doesn't **freeze** during slow encoding.

The snapshot should be a **value type** (`[Stroke]`, where `Stroke` is a struct). Copying a value type gives a **truly independent** copy (5.1). If it were an array of **classes**, the "copy" would still point at the **same** live objects, and the problem would come back.

⚠️ One more rule: a reference document knows it has **changed** through the **undo manager**. Register every edit as an undoable action, or the document **won't be saved**:

```swift
struct CanvasView: View {
    @ObservedObject var document: DrawingDocument
    @Environment(\.undoManager) private var undoManager

    func add(_ stroke: Stroke) {
        document.strokes.append(stroke)
        undoManager?.registerUndo(withTarget: document) { doc in
            doc.strokes.removeLast()            // how to undo it; also marks the document as edited
        }
    }

    var body: some View { /* drawing canvas */ EmptyView() }
}

// In the App:
// DocumentGroup(newDocument: { DrawingDocument() }) { file in
//     CanvasView(document: file.document)
// }
```

You also get **Undo and Redo** (⌘Z, shake to undo) for free that way.

---

## 34.5 Custom UTType Declarations 🟡

Every file format has a **Uniform Type Identifier** (**UTI**), a reverse-DNS name like `public.plain-text` or `com.adobe.pdf`. In Swift, it's a **`UTType`**. For your **own** format, you declare a new type in **two** places that must **match**.

**1. In Swift:**

```swift
import UniformTypeIdentifiers

extension UTType {
    static var drawingDocument: UTType {
        UTType(exportedAs: "com.example.myapp.drawing")   // "exported": this app OWNS the format
    }
}
```

**2. In Info.plist** (or the target's **Info** tab in Xcode, under "Exported Type Identifiers"):

```xml
<key>UTExportedTypeDeclarations</key>
<array>
    <dict>
        <key>UTTypeIdentifier</key>
        <string>com.example.myapp.drawing</string>
        <key>UTTypeDescription</key>
        <string>Drawing</string>
        <key>UTTypeConformsTo</key>
        <array>
            <string>public.data</string>
            <string>public.content</string>
        </array>
        <key>UTTypeTagSpecification</key>
        <dict>
            <key>public.filename-extension</key>
            <array><string>drawing</string></array>
        </dict>
    </dict>
</array>

<!-- And say that the app can OPEN it (the "Document Types" section) -->
<key>CFBundleDocumentTypes</key>
<array>
    <dict>
        <key>CFBundleTypeName</key>
        <string>Drawing</string>
        <key>LSItemContentTypes</key>
        <array><string>com.example.myapp.drawing</string></array>
        <key>LSHandlerRank</key>
        <string>Owner</string>
    </dict>
</array>
```

The **identifier string** must be **exactly the same** in Swift and in Info.plist. Together they tell the system:

- Files ending in **`.drawing`** are this type.
- **This app** owns it, and can open it.

That's what makes **double-tapping** a `.drawing` file in **Files** or the **Finder** open **your** app, and shows your file type's name. It's also what makes **`readableContentTypes`** work as a filter in the document browser.

If the Info.plist entry is **missing**, the type has no **file extension** link. The browser won't show your files as openable, saved files may get the wrong extension, and double-tapping them won't open your app.

| Declaration | Use when |
|---|---|
| `UTType(exportedAs:)` + **Exported** type | **Your** app defines the format |
| `UTType(importedAs:)` + **Imported** type | **Another** app owns the format, and you just open it |
| A built-in type (`.plainText`, `.pdf`, `.json`) | A standard format; no declaration needed |

---

## 34.6 Multi-Format Document Support 🟡

One document type can **read** and **write** several formats. List them in **`readableContentTypes`** and **`writableContentTypes`**, then check **`configuration.contentType`** to know **which** one you're handling:

```swift
struct MultiFormatDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.myAppFormat, .plainText, .commaSeparatedText] }
    static var writableContentTypes: [UTType] { [.myAppFormat, .plainText] }

    var content: DocumentContent

    init(configuration: ReadConfiguration) throws {
        switch configuration.contentType {            // which format is being OPENED
        case .plainText:
            content = try DocumentContent(parsingPlainText: configuration.file)
        case .commaSeparatedText:
            content = try DocumentContent(parsingCSV: configuration.file)
        default:
            content = try DocumentContent(parsingNativeFormat: configuration.file)
        }
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        switch configuration.contentType {            // which format is being SAVED
        case .plainText:
            return try content.asPlainTextFileWrapper()
        default:
            return try content.asNativeFormatFileWrapper()
        }
    }
}
```

In this example:

| Format | Open | Save |
|---|---|---|
| `.myAppFormat` (native) | ✅ | ✅ full detail |
| `.plainText` | ✅ | ✅ text only |
| `.commaSeparatedText` | ✅ import | ❌ |

CSV is **readable** but **not writable**. That's a common pattern: **import** many formats, but only **save** formats you can write **without losing data**.

The benefit for users: they can open a `.txt` or `.csv` file **directly** in your app, edit it with all your app's features, and save in your **richer** native format. One app and one document type, instead of separate "import" screens for each format.

List your **native** format **first** in both lists, as the main one. On the Mac, "Save As…" and "Duplicate" let the user pick a format from the writable list.

---

## Summary

| Concept | Key API | Purpose |
|---|---|---|
| Document scene | `DocumentGroup` | New, Open, browser, autosave, and recents for free |
| Value document model | `FileDocument` | A struct; edits through a binding; auto-saved |
| Reference document model | `ReferenceFileDocument` | A class; changes tracked by the undo manager |
| Async document I/O | `ReadableDocument`/`WritableDocument` | New async, split read/write protocols; check the SDK |
| Safe concurrent saving | `snapshot(contentType:)` | A frozen value copy, written in the background |
| Custom file types | `UTType`, Info.plist declarations | The same identifier in Swift and Info.plist |
| Format flexibility | `readableContentTypes`/`writableContentTypes` | Import many formats; save the ones you can write fully |
