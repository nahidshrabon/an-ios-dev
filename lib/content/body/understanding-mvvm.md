## The Problem MVVM Solves

As soon as a view needs to fetch data, validate input, or talk to a database, putting that logic directly inside the view makes it hard to test and hard to reuse. MVVM (Model-View-ViewModel) separates concerns: the Model holds your data, the View renders it, and the ViewModel sits in between, holding presentation logic and state the View observes.

## ViewModel in SwiftUI

In SwiftUI, a ViewModel is typically a class marked `@Observable` (or conforming to `ObservableObject` in older code), exposing published properties the View reads and methods the View calls in response to user actions. The View itself stays a thin, mostly declarative description of layout — all the decision-making lives in the ViewModel.

## When to Use It

MVVM shines once a screen has real logic: network calls, validation, multiple pieces of derived state. For a purely static screen, introducing a ViewModel is often unnecessary ceremony — it's fine for a View to just render fixed content directly.
