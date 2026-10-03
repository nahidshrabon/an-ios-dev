**Difficulty:** 🟢 Beginner · 🟡 Intermediate · 🔴 Advanced

## 46.1 MVC and Massive View Controller 🟡

**MVC (Model-View-Controller)** is UIKit's original pattern. In practice, the "Controller" often takes on everything (networking, business logic, view setup). This is why it is nicknamed **"Massive View Controller."**

```swift
// MVC aims for a clean split, but UIViewController does two jobs,
// so it becomes a dumping ground:
class RecipeListViewController: UIViewController {
    // Model, networking, business logic, AND view setup
    // all end up here without discipline
}
```

`UIViewController` is both the "controller" (it coordinates) and the "view" owner (it builds and manages the `UIView`s). **Nothing stops it from also taking on networking and business logic.** Without splitting code into model, logic, and presentation (45.2), it keeps growing.

This is a gap in the pattern, not a mistake by developers. It is the reason the other patterns in this section exist.

---

## 46.2 MVP and MVVM Compared 🟡

**MVP (Model-View-Presenter)** and **MVVM** both move logic out of the view into a separate object. They differ in how that object talks back to the view.

```swift
// MVP: the Presenter calls methods on the View (via a protocol)
protocol RecipeListView: AnyObject {
    func display(recipes: [Recipe])
}
final class RecipeListPresenter {
    weak var view: RecipeListView?
    func loadRecipes() async {
        let recipes = try? await service.getRecipes()
        view?.display(recipes: recipes ?? [])
    }
}

// MVVM: the ViewModel exposes state; it has no reference to the View (45.3)
@Observable final class RecipeListViewModel {
    private(set) var recipes: [Recipe] = []
    func loadRecipes() async { recipes = (try? await service.getRecipes()) ?? [] }
}
```

- **MVP:** the presenter holds a reference to the view (usually through a protocol) and *pushes* updates by calling its methods.
- **MVVM:** the view model has no reference to the view. It exposes observable state, and the view *pulls* it when it draws. `@Observable` (section 25) sends the updates.

Because the view model does not know the view exists, MVVM fits SwiftUI's state-driven style well. That is why MVVM, not MVP, is the most common pattern in modern SwiftUI apps.

---

## 46.3 VIPER: Structure and Trade-offs 🟡

**VIPER** (View, Interactor, Presenter, Entity, Router) splits one screen into five small parts. Each part has one job.

```swift
// VIPER's five parts for one screen:
// View       — shows what the Presenter tells it to
// Interactor — business logic, talks to services/repositories
// Presenter  — connects View and Interactor, formats data for display
// Entity     — plain data objects
// Router     — navigation (which screen comes next)
```

VIPER's strength is that each part has a clear job and can be tested on its own. The cost is **extra code**: even a simple screen needs five types wired together.

It pays off on large teams with complex screens and complex business logic. For small teams or simple screens it is too much. We come back to this in 46.13.

---

## 46.4 Clean Architecture Layers on iOS 🔴

**Clean Architecture** is a way to organize code so that your core business logic does not depend on the UI, the database, or any framework. Robert C. Martin ("Uncle Bob") made it popular, and it is not specific to iOS.

**An example, without iOS.** Think of an online shop with this rule: "an order over $50 ships for free". This is business logic. It stays true if the shop is a website or a phone app, and if the data is stored in one database or another.

In a messy design, this rule is mixed into the screen code or the database code. If you change the database or redesign the screen, you must rewrite the rule too, and you may break it.

Clean Architecture puts the rule in the centre and builds layers around it. The rule does not know about the screen, the database, or the framework. They know about the rule. So they can change, and the rule stays the same.

**The one rule:** code in the centre must not know about code outside it. Outside code can know about the centre.

**On iOS**, this usually becomes three layers: **Presentation** (what the user sees), **Domain** (the core of your app), and **Data** (how data is fetched or saved). "Depends on" means "knows about", and the Domain layer must know about nothing else.

```plaintext
Presentation  (Views, ViewModels)         — knows about Domain
Domain        (Entities, Use Cases)       — knows about nothing
Data          (Repositories, API clients) — knows about Domain
```

The Domain layer holds **entities** (your core models, like `Recipe`) and **use cases** (single business actions, see 46.12). The view model needs recipes, and recipes come from the network (the Data layer). So how can Domain not know about Data? The Domain layer only *describes* what it needs, with a protocol. The Data layer does the real work.

```swift
// Domain layer: says WHAT it needs, not how to get it
protocol RecipeRepository {
    func getRecipes() async throws -> [Recipe]
}

// Data layer: does the real work and follows the Domain's protocol
final class NetworkRecipeRepository: RecipeRepository {
    func getRecipes() async throws -> [Recipe] {
        // call the network, decode the JSON, convert DTOs to Recipe
        []
    }
}
```

The protocol lives in Domain, so Data has to know about Domain, not the other way around. Domain never mentions `URLSession` or JSON. This turn-around is called **dependency inversion** (more in section 48.5).

Think of a restaurant. The Domain is the menu: it says "we serve soup". The Data layer is the kitchen: it cooks the soup. The menu does not say which stove to use, so the kitchen can change its stove and the menu stays the same.

The benefit: when you change a networking library or a database, only the Data layer changes. Your most important logic is not affected.

---

## 46.5 Unidirectional Data Flow 🟡

In **unidirectional (one-way) data flow**, state always changes in one direction: an action updates the state, and the state updates the screen. The screen never changes state directly. It only sends actions, and a **reducer** is the one place that changes the state (more in 46.6). Redux (a popular JavaScript state library) made this common on the web, and SwiftUI follows a similar idea.

```plaintext
Action ──► Reducer ──► State ──► View
  ▲                                │
  └───── user does something ──────┘
```

**Example: a "Load recipes" button.** The state is `isLoading` and `recipes`.

1. The user taps the button. The view does not change anything. It sends the action `.loadButtonTapped`.
2. The reducer gets the action and the current state. It makes a new state: `isLoading` becomes `true`.
3. SwiftUI sees the new state and redraws the screen with a spinner.
4. When the recipes arrive, a new action, `.recipesLoaded`, goes to the reducer. The new state has the recipes and `isLoading` is `false`.
5. The screen redraws again with the list.

At every step, the view only *sends* actions and *shows* the state. The reducer is the only one that changes it.

Every change goes through the same step: `(State, Action) -> State`. This means you can list every way the state can change. It is like 45.7 (wrong states impossible), but for the *changes* between states.

SwiftUI's `@State` and `@Observable` already work a little like this. The next four lessons (46.6 to 46.9) make it strict.

---

## 46.6 Reducers, Actions, and Effects 🔴

Unidirectional data flow uses three ideas:

- **Action:** a description of something that happened, like a button tap or a network response.
- **Reducer:** a *pure* function that takes the old state and an action, and returns the new state. *Pure* means it only calculates: the same input always gives the same output, and it changes nothing outside.
- **Effect:** work that is *not* pure, like a network call, a timer, or saving to a database. When an effect finishes, it sends a new action.

```swift
enum RecipeAction {
    case loadButtonTapped
    case recipesLoaded([Recipe])
}

struct RecipeState {
    var recipes: [Recipe] = []
    var isLoading = false
}

func reduce(state: inout RecipeState, action: RecipeAction) {
    switch action {
    case .loadButtonTapped:
        state.isLoading = true
        // the store (below) starts the effect that calls the network
    case .recipesLoaded(let recipes):
        state.recipes = recipes
        state.isLoading = false
    }
}
```

Here is the effect. It is not pure: it calls the network, then sends a new action when the call finishes.

```swift
func loadRecipesEffect(send: @escaping (RecipeAction) -> Void) async {
    let recipes = (try? await recipeService.getRecipes()) ?? []
    send(.recipesLoaded(recipes))
}
```

The reducer is only a rule. Something has to use it. This is the **store**: an object that keeps the current state and does four jobs:

1. It **holds the current state**.
2. It **receives actions** from the view (with `send`).
3. It **runs the reducer** with the current state and the action, and saves the new state.
4. It **starts effects** and tells the view to redraw.

Think of a vending machine. The reducer is the rule inside ("press B2 and pay, get a drink"). The store is the whole machine: it holds the items, takes your button press, applies the rule, and gives you the result.

Here is a small store:

```swift
@Observable
final class RecipeStore {
    private(set) var state = RecipeState()         // job 1: holds the state

    // The view calls this to send an action
    func send(_ action: RecipeAction) {            // job 2: receives actions
        reduce(state: &state, action: action)      // job 3: runs the reducer

        if case .loadButtonTapped = action {       // job 4: starts the effect
            Task { await loadRecipesEffect(send: send) }
        }
    }
}
```

The view only sends actions:

```swift
Button("Load recipes") { store.send(.loadButtonTapped) }
```

The whole flow, step by step:

1. The button calls `store.send(.loadButtonTapped)`.
2. The store runs the reducer, and `isLoading` becomes `true`.
3. The store sees that this action needs an effect, and starts `loadRecipesEffect`.
4. The effect waits for the network, then calls `send(.recipesLoaded(recipes))`.
5. That goes through the same `send`, and the reducer puts the recipes in the state.

The store is the part TCA writes for you (46.7).

A reducer must be pure, so it cannot wait for a server. Look at the code: on `.loadButtonTapped` it only sets `isLoading = true`, which is instant. The effect does the network call (this is the part that is not pure, and it uses `async`/`await` from Part 2).

**The reducer stays simple and predictable, and the messy work happens in effects.** This also makes the reducer easy to test, because it is just a plain function.

---

## 46.7 The Composable Architecture: @Reducer and @ObservableState 🔴

**The Composable Architecture (TCA)** is a popular third-party library (a Swift package you add to your project). It gives you the pieces from 46.6 ready to use, so you don't write the store yourself. It uses macros (`@Reducer`, `@ObservableState`) to remove most of the repeated code.

Here is how each piece from 46.6 looks in TCA:

| In 46.6 (by hand) | In TCA |
|---|---|
| `RecipeState` | a `State` struct |
| `RecipeAction` | an `Action` enum |
| the `reduce` function | `Reduce { state, action in ... }` |
| `loadRecipesEffect` | `.run { send in ... }`, returned by the reducer |
| `RecipeStore` | `Store`, provided by TCA |

The same recipe example in TCA:

```swift
import ComposableArchitecture

@Reducer
struct RecipeFeature {
    // The state: the data for this feature
    @ObservableState
    struct State {
        var recipes: [Recipe] = []
        var isLoading = false
    }

    // The actions: everything that can happen
    enum Action {
        case loadButtonTapped
        case recipesLoaded([Recipe])
    }

    // The reducer: how each action changes the state
    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .loadButtonTapped:
                state.isLoading = true
                // Return an effect: call the network, then send a new action
                // (recipeService is explained in 46.8)
                return .run { send in
                    let recipes = try await recipeService.getRecipes()
                    await send(.recipesLoaded(recipes))
                }
            case .recipesLoaded(let recipes):
                state.recipes = recipes
                state.isLoading = false
                return .none   // no effect needed
            }
        }
    }
}
```

The view reads the state from the store and sends actions to it:

```swift
struct RecipeView: View {
    let store: StoreOf<RecipeFeature>

    var body: some View {
        VStack {
            Button("Load recipes") { store.send(.loadButtonTapped) }
            List(store.recipes) { Text($0.title) }
        }
    }
}
```

**What changed from 46.6:**

- **The reducer returns an effect.** In 46.6 the store decided to start the effect. In TCA, the reducer says which effect to start: `.run` starts one, and `.none` means no effect.
- **`.run { send in }` is the same idea as `loadRecipesEffect`.** It is an `async` closure. It can `await` work, then send the result back as a new action with `send`. It uses the concurrency tools from Part 2, not a new system.
- **The two macros write repeated code** (macros are in section 13). `@Reducer` connects your reducer to the store. `@ObservableState` makes the state observable, so the view redraws when it changes, like `@Observable`.

---

## 46.8 The Composable Architecture: Effects and Dependencies 🔴

TCA gives effects two helpers: **dependencies** (the things an effect needs from outside, like `RecipeService`) and **cancelling** (stopping an effect that is still running).

**Dependencies.** If the reducer creates the real `RecipeService` itself, every test would call the real network. Instead, the reducer asks TCA for the service with `@Dependency`. This is dependency injection (like `swift-dependencies`, see section 47.7).

```swift
@Reducer
struct RecipeFeature {
    // Ask TCA for the service. Do not create it here.
    @Dependency(\.recipeService) var recipeService

    // ... State, Action, and body as in 46.7 ...
    // Inside the reducer:
    // case .loadButtonTapped:
    //     return .run { send in
    //         let recipes = try await recipeService.getRecipes()
    //         await send(.recipesLoaded(recipes))
    //     }
}
```

TCA gives the reducer the **real** service in the app, and a **fake** one in tests and previews. The reducer code is the same in every case, with no `if` checks inside it.

You register the real service once, so TCA knows what to give:

```swift
extension DependencyValues {
    var recipeService: RecipeService {
        get { self[RecipeServiceKey.self] }
        set { self[RecipeServiceKey.self] = newValue }
    }
}

private enum RecipeServiceKey: DependencyKey {
    // The real service (setup not shown)
    static let liveValue: RecipeService = DefaultRecipeService(/* ... */)
}
```

**Cancelling.** Imagine the user taps "Load recipes" twice. Now two network calls run, and the old one might finish last and replace newer data. `.cancellable(id:)` gives the effect a name, so a new effect with the same name can cancel the old one.

```swift
enum CancelID { case loadRecipes }

// In the reducer:
return .run { send in
    let recipes = try await recipeService.getRecipes()
    await send(.recipesLoaded(recipes))
}
.cancellable(id: CancelID.loadRecipes, cancelInFlight: true)
```

`cancelInFlight: true` means: if an effect with this id is still running, cancel it first. A feature going away also cancels its effects. This uses Swift's cancellation (section 18, and `.task(id:)` in section 40.4).

---

## 46.9 The Composable Architecture: TestStore 🔴

**`TestStore`** is a store made for tests. It runs your reducer and effects like a normal store, but it checks **every step**: you must say what you expect, and the test fails if the real result is different. This works because reducers are pure and predictable (46.6), and because dependencies can be replaced (46.8).

First, a fake service that returns fixed recipes, so the test needs no network:

```swift
struct FakeRecipeService: RecipeService {
    let recipes: [Recipe]
    func getRecipes() async throws -> [Recipe] { recipes }
    func save(_ recipe: Recipe) async throws {}
}
```

Now the test:

```swift
@Test
func loadingRecipesUpdatesState() async {
    let testRecipe = Recipe(id: UUID(), title: "Test Recipe", minutesToCook: 5)

    // A store for tests, with the fake service instead of the real one
    let store = TestStore(initialState: RecipeFeature.State()) {
        RecipeFeature()
    } withDependencies: {
        $0.recipeService = FakeRecipeService(recipes: [testRecipe])
    }

    // Step 1: send an action, and say how the state should change
    await store.send(.loadButtonTapped) {
        $0.isLoading = true
    }

    // Step 2: the effect finishes and sends .recipesLoaded. Say what changes.
    await store.receive(\.recipesLoaded) {
        $0.recipes = [testRecipe]
        $0.isLoading = false
    }
}
```

- **`store.send(action) { }`**: sends the action. Inside the closure, `$0` is the state *before* the action. Change it to what you expect *after*. The test fails if the real state is different.
- **`store.receive(_:)`**: checks that a specific action arrives next, usually from a finished effect (here `.recipesLoaded`), and what state change it causes. If an action arrives and you do not check it, the test fails.

`TestStore` compares states, so `State` and `Recipe` must be `Equatable`.

This gives a very exact, step-by-step test of a whole feature, with no real network.

---

## 46.10 The Coordinator Pattern 🟡

In an app with many screens, something must decide which screen comes next. If every screen decides for itself, the screens become tied together. The **Coordinator pattern** moves that decision (which screen comes next, and how it is shown) out of the screens and into a separate **coordinator** object.

**Without a coordinator**, the list screen builds and shows the next screen itself:

```swift
class RecipeListViewController: UIViewController {
    func didSelect(_ recipe: Recipe) {
        // The list screen knows about the detail screen
        let detailVC = RecipeDetailViewController(recipe: recipe)
        navigationController?.pushViewController(detailVC, animated: true)
    }
}
```

Now the list screen depends on the detail screen. You can't reuse the list in another flow that opens a different screen, and changing the navigation means editing the screens.

**With a coordinator**, the screen only reports what happened:

```swift
class RecipeListViewController: UIViewController {
    var onRecipeSelected: ((Recipe) -> Void)?   // the coordinator sets this

    func didSelect(_ recipe: Recipe) {
        onRecipeSelected?(recipe)               // only says "a recipe was selected"
    }
}
```

The coordinator decides what happens next:

```swift
protocol Coordinator: AnyObject {
    func start()
}

final class RecipeFlowCoordinator: Coordinator {
    // A UINavigationController is a stack of screens.
    // "Push" puts a new screen on top.
    private let navigationController: UINavigationController

    init(navigationController: UINavigationController) {
        self.navigationController = navigationController
    }

    func start() {
        let listVC = RecipeListViewController()
        // [weak self] avoids a memory leak (the coordinator and the screen holding each other)
        listVC.onRecipeSelected = { [weak self] recipe in
            self?.showDetail(for: recipe)
        }
        navigationController.pushViewController(listVC, animated: false)
    }

    private func showDetail(for recipe: Recipe) {
        let detailVC = RecipeDetailViewController(recipe: recipe)
        navigationController.pushViewController(detailVC, animated: true)
    }
}
```

Someone has to create the coordinator and call `start()`. This is the app's starting point, the `SceneDelegate`:

```swift
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    var coordinator: RecipeFlowCoordinator?          // keep a strong reference

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let navigationController = UINavigationController()
        coordinator = RecipeFlowCoordinator(navigationController: navigationController)
        coordinator?.start()                          // shows the first screen

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = navigationController
        window?.makeKeyAndVisible()
    }
}
```

Keep the `coordinator` property. Nothing else holds the coordinator, so without it the object would be freed right away and the buttons would stop working. A coordinator can also create and start another coordinator, for example a `ProfileCoordinator` when the user opens the profile.

The flow:

1. The app starts, and the `SceneDelegate` creates the coordinator and calls `start()`.
2. `start()` shows the list screen.
3. The user taps a recipe, and the list screen calls `onRecipeSelected`.
4. The coordinator's `showDetail(for:)` pushes the detail screen.

**The screen only says what happened. The coordinator decides what happens next.** Screens become easier to reuse and test, and you can see the whole navigation flow in one place.

---

## 46.11 SwiftUI-Native Navigation vs. Coordinators 🟡

SwiftUI already has navigation tools that separate "what starts navigation" from "which screen comes next" (section 27). So some teams ask if they still need a Coordinator. Here are the three tools:

- **`NavigationStack`:** a stack of screens, like `UINavigationController`.
- **`NavigationPath`:** a list of the values that were pushed. Adding a value shows a new screen, and removing one goes back.
- **`navigationDestination(for:)`:** says which screen to show for each type of value.

You can keep the path in a small `@Observable` router. It plays the role of the coordinator:

```swift
@Observable
final class AppRouter {
    var path = NavigationPath()              // the screens pushed so far

    func showRecipeDetail(_ recipe: Recipe) {
        path.append(recipe)                  // adds a screen
    }
}
```

The router is only data. These views connect it to the screens:

```swift
struct RootView: View {
    @State private var router = AppRouter()

    var body: some View {
        NavigationStack(path: $router.path) {
            RecipeListView()
                .navigationDestination(for: Recipe.self) { recipe in
                    RecipeDetailView(recipe: recipe)   // the screen for a Recipe
                }
        }
        .environment(router)                           // share the router with child views
    }
}

struct RecipeListView: View {
    @Environment(AppRouter.self) private var router
    let recipes: [Recipe]

    var body: some View {
        List(recipes) { recipe in
            Button(recipe.title) { router.showRecipeDetail(recipe) }   // only says what happened
        }
    }
}
```

This is the same idea as 46.10: the list screen only says "a recipe was selected" (`router.showRecipeDetail`), and navigation is decided in one place. The difference is that SwiftUI shows the screen for you, so there is no `push` code. (`Recipe` must be `Hashable` to go in a `NavigationPath`.)

It is also easy to test: call `router.showRecipeDetail(recipe)` and check that `router.path.count` is `1`.

**What many teams do:** SwiftUI's own navigation is enough for small and medium apps. A formal coordinator helps in large apps with complex flows, like an onboarding wizard that can start from several places.

---

## 46.12 Use Cases and Interactors: Worth the Extra Code? 🟡

A **use case** (called an "interactor" in VIPER, 46.3) is a small type for exactly one business action, like "mark a recipe as favorite". It goes one step beyond a service, which puts many actions in one type (45.5).

```swift
// A use case: does exactly one thing
struct ToggleFavoriteRecipeUseCase {
    let repository: RecipeRepository

    func execute(_ recipe: Recipe) async throws {
        var updated = recipe
        updated.isFavorite.toggle()           // (assumes Recipe has isFavorite)
        try await repository.save(updated)
    }
}
```

A view model uses it by calling `execute`:

```swift
@Observable
final class RecipeDetailViewModel {
    private let toggleFavorite: ToggleFavoriteRecipeUseCase
    let recipe: Recipe

    func favoriteTapped() async {
        try? await toggleFavorite.execute(recipe)
    }
}
```

Compare with the same logic as a method on a service (45.5):

```swift
extension RecipeService {
    func toggleFavorite(_ recipe: Recipe) async throws { /* ... */ }
}
```

**When it helps:** when an action has several steps (check rules, save, update other data) and many screens use it. The steps live in one small type that you can test alone and reuse everywhere.

**When it hurts:** when the action is simple, like create, read, update, or delete (CRUD). The example above is already this simple: the use case only calls the repository. A type for every small action is more structure than the problem needs. This is the same trade-off as VIPER (46.3): rigor versus simplicity.

---

## 46.13 Choosing an Architecture for Your Team Size 🟡

**There is no single correct architecture.** The right choice depends on your situation, so choose on purpose, not because something is trending. Ask yourself:

- How many developers work on the app?
- How complex are the business rules?
- How long must the app live and keep changing?

A rough guide, not a rule:

| Your situation | A good choice |
|---|---|
| Solo developer, small app | MVVM (45.3), with little extra code |
| Small or medium team, growing app | MVVM + a service layer (45.5) + light dependency injection (Section 47) |
| Large team, complex business logic | Clean Architecture (46.4) or TCA (46.7 to 46.9) |
| Many teams working in parallel | Modularization (Section 48): splitting the app into separate modules. Module borders become team borders, so this matters as much as the pattern. |

Every pattern beyond the basic split into model, logic, and presentation (45.2) adds structure and code in return for more rigor, testability, and scale. VIPER's five parts, Clean Architecture's layers, and TCA's reducers all cost effort up front, and **only pay off when the app or team is big enough**.

**Choosing something too big for your app is a common mistake.** So is choosing something too small for a fast-growing, multi-team app. Be honest about where your project is, start simple, and add structure when the app needs it. Don't just pick the most talked-about pattern.

---

## Summary

| Concept | Key Idea | Purpose |
|---|---|---|
| MVC | `UIViewController` does two jobs | Why "Massive View Controller" happens |
| MVP vs. MVVM | Push (view reference) vs. pull (observed state) | Why MVVM fits SwiftUI |
| VIPER | Five small parts per screen | Easy to test, but a lot of extra code |
| Clean Architecture | Domain depends on nothing | Core logic is safe from tool changes |
| Unidirectional data flow | Action → Reducer → State → View | Every state change can be listed |
| Reducers / actions / effects / store | Pure reducer, effects for impure work, a store runs them | Simple, testable core logic |
| The Composable Architecture | `@Reducer`, `@ObservableState`, `.run`, `@Dependency` | Macro-powered version of the pattern |
| TestStore | `send()` and `receive()` with exact state checks | Step-by-step feature tests |
| Coordinator | One object owns navigation | Screens don't decide what comes next |
| SwiftUI navigation | A router with `NavigationPath` | Often enough alone; coordinators for complex flows |
| Use cases | One type per business action | Testable, but can be too much |
| Choosing | Match the pattern to team and app size | No single correct choice |
