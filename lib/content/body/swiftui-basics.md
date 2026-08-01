## Declarative UI

SwiftUI lets you describe what your interface should look like for a given state, rather than writing imperative code to mutate views step by step. A `Text("Hello")` view isn't an instruction to draw text — it's a description that SwiftUI turns into pixels, and re-renders automatically whenever the underlying data changes.

## Views and Modifiers

Every visual element in SwiftUI — text, images, buttons, stacks — conforms to the `View` protocol. Modifiers like `.padding()`, `.foregroundColor(.blue)`, or `.font(.title)` don't mutate a view in place; each one wraps the view in a new one with that modification applied, which is why modifier order can change the result.

## State and Binding

`@State` marks a piece of data as owned by a view and, when it changes, triggers a re-render of that view and its children. `@Binding` lets a child view read and write a value it doesn't own, creating a two-way connection back to the parent's `@State`. Together they're the foundation of how SwiftUI keeps UI in sync with data.
