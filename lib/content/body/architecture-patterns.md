## 46.1 MVC and Massive View Controller

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

## 46.2 MVP and MVVM Compared

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

## 46.3 VIPER: Structure and Trade-offs

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

## 46.4 Clean Architecture Layers on iOS

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

## 46.5 Unidirectional Data Flow

In **unidirectional (one-way) data flow**, state always changes in one direction: an action updates the state, and the state updates the screen. The screen never changes state directly. It only sends actions, and a **reducer** is the one place that changes the state (more in 46.6). Redux (a popular JavaScript state library) made this common on the web, and SwiftUI follows a similar idea.

```plaintext
Action → Reducer (new State from old State + Action) → State → View shows State
   ↑                                                                          |
   └────────────────────── the user does something: new Action ──────────────┘
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

## 46.6 Reducers, Actions, and Effects

Unidirectional data flow uses three ideas: **actions** (something happened, like a tap or a network response), **reducers** (pure functions that make the new state from the old state and an action), and **effects** (work that is not pure, like a network call, which sends a new action when it finishes).

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
        // an EFFECT runs elsewhere and later sends
        // .recipesLoaded when the network call finishes
    case .recipesLoaded(let recipes):
        state.recipes = recipes
        state.isLoading = false
    }
}
```

A reducer is pure and has no side effects: the same state and action always give the same new state. Impure work (network calls, timers, `async`/`await` from Part 2) goes into effects, which send their result back as a new action like `.recipesLoaded`.

This makes the reducer easy to test, because it is just a plain function.

---

## 46.7 The Composable Architecture: @Reducer and @ObservableState

**The Composable Architecture (TCA)** is a popular third-party library for the reducer/action/effect pattern (46.6). It uses macros (`@Reducer`, `@ObservableState`) to remove most of the boilerplate.

```swift
import ComposableArchitecture

@Reducer
struct RecipeFeature {
    @ObservableState
    struct State {
        var recipes: [Recipe] = []
        var isLoading = false
    }

    enum Action {
        case loadButtonTapped
        case recipesLoaded([Recipe])
    }

    var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .loadButtonTapped:
                state.isLoading = true
                return .run { send in
                    let recipes = try await recipeService.getRecipes()
                    await send(.recipesLoaded(recipes))
                }
            case .recipesLoaded(let recipes):
                state.recipes = recipes
                state.isLoading = false
                return .none
            }
        }
    }
}
```

`@Reducer` and `@ObservableState` are macros (section 13). They write the repeated code for you.

`.run { send in }` is how TCA runs effects. It is an `async` closure: it can `await` work and send the result back as a new action with `send`. It uses the concurrency tools from Part 2, not a new system.

---

## 46.8 The Composable Architecture: Effects and Dependencies

TCA effects are easy to test and cancel. TCA also has a dependency system (like `swift-dependencies`, see section 47.7) to inject the services an effect uses.

```swift
@Reducer
struct RecipeFeature {
    @Dependency(\.recipeService) var recipeService

    // ...
    case .loadButtonTapped:
        return .run { send in
            let recipes = try await recipeService.getRecipes()
            await send(.recipesLoaded(recipes))
        }
        .cancellable(id: CancelID.loadRecipes)
```

`@Dependency(\.recipeService)` gives the effect its service. You can replace it for production, tests, and previews, so the same reducer uses a real service in the app and a fake one in tests, with no `if` checks inside the reducer.

`.cancellable(id:)` ties an effect to an id, so a later action (or the feature going away) can cancel it. This uses Swift's cancellation (section 18, and `.task(id:)` in section 40.4).

---

## 46.9 The Composable Architecture: TestStore

**`TestStore`** is TCA's testing tool. A test sends actions and checks exactly how the state changes at each step. This works because reducers are pure and predictable (46.6).

```swift
@Test
func loadingRecipesUpdatesState() async {
    let store = TestStore(initialState: RecipeFeature.State()) {
        RecipeFeature()
    } withDependencies: {
        $0.recipeService = .mock(returning: [Recipe(title: "Test Recipe")])
    }

    await store.send(.loadButtonTapped) {
        $0.isLoading = true
    }
    await store.receive(\.recipesLoaded) {
        $0.recipes = [Recipe(title: "Test Recipe")]
        $0.isLoading = false
    }
}
```

- `store.send(action) { }`: the closure describes the state change you expect. The test fails if the real state is different.
- `store.receive(_:)`: checks that a specific action arrives next (usually from a finished effect), and what state change it causes.

This gives a very exact, step-by-step test of a whole feature. It is possible because of pure reducers and injectable dependencies (46.8).

---

## 46.10 The Coordinator Pattern

The **Coordinator pattern** moves navigation (which screen comes next, and how it is shown) out of the screens into a separate coordinator object.

```swift
protocol Coordinator: AnyObject {
    func start()
}

final class RecipeFlowCoordinator: Coordinator {
    private let navigationController: UINavigationController

    init(navigationController: UINavigationController) {
        self.navigationController = navigationController
    }

    func start() {
        let listVC = RecipeListViewController()
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

Without a coordinator, a view controller must know which screen comes next and how to build it. That ties it to the app's navigation.

With a coordinator, `RecipeListViewController` only says "a recipe was selected" (through `onRecipeSelected`). The coordinator decides what happens next. Screens become easier to reuse and test, and you can see the whole navigation flow in one place.

---

## 46.11 SwiftUI-Native Navigation vs. Coordinators

SwiftUI's own tools (`NavigationStack`, `navigationDestination(for:)`, `NavigationPath`, section 27) already separate what starts navigation from which screen comes next. So some teams ask if they still need a Coordinator.

```swift
// SwiftUI-native: navigation state lives in a NavigationPath,
// outside the screens, so no separate coordinator type is needed
@Observable
final class AppRouter {
    var path = NavigationPath()

    func showRecipeDetail(_ recipe: Recipe) {
        path.append(recipe)
    }
}
```

An `@Observable` router that holds a `NavigationPath` gives you most of the Coordinator's benefit with plain SwiftUI. Navigation is in one place and easy to test.

What many teams do: SwiftUI's own navigation is enough for small and medium apps. A formal coordinator helps in large apps with complex flows, like an onboarding wizard that can start from several places.

---

## 46.12 Use Cases and Interactors: Worth the Extra Code?

A **use case** (called an "interactor" in VIPER, 46.3) is a small type for exactly one business action, like "mark a recipe as favorite". It goes one step beyond a service, which puts many actions in one type (45.5).

```swift
// A use case: does exactly one thing
struct ToggleFavoriteRecipeUseCase {
    let repository: RecipeRepository

    func execute(_ recipe: Recipe) async throws {
        var updated = recipe
        updated.isFavorite.toggle()
        try await repository.save(updated)
    }
}

// Compare: the same logic as a method on a service (45.5)
extension RecipeService {
    func toggleFavorite(_ recipe: Recipe) async throws { /* ... */ }
}
```

**When it helps:** for complex business logic, each action is its own unit that you can test alone and reuse in many screens.

**When it hurts:** for simple CRUD actions, a type for every small action is more structure than the problem needs. This is the same trade-off as VIPER (46.3): rigor versus simplicity.

---

## 46.13 Choosing an Architecture for Your Team Size

**There is no single correct architecture.** The right choice depends on team size, app complexity, and how long the app must live. Choose on purpose, not because something is trending.

```plaintext
A rough guide, not a rule:
- Solo dev / small app          → MVVM (45.3), little extra code
- Small-medium team, growing    → MVVM + service layer (45.5) + light dependency injection (Section 47)
- Large team, complex logic     → Clean Architecture (46.4) or TCA (46.7-46.9)
- Many teams working in         → Modularization (Section 48) matters as much as the
  parallel                        pattern, because module borders become team borders
```

Every pattern beyond the basic split into model, logic, and presentation (45.2) adds structure and code in return for more rigor, testability, and scale. VIPER's five parts, Clean Architecture's layers, and TCA's reducers all cost effort up front, and **only pay off when the app or team is big enough**.

**Choosing something too big for your app is a common mistake.** So is choosing something too small for a fast-growing, multi-team app. Be honest about where your project is, and don't just pick the most talked-about pattern.

---

## Summary

| Concept | Key Idea | Purpose |
|---|---|---|
| MVC | `UIViewController` does two jobs | Why "Massive View Controller" happens |
| MVP vs. MVVM | Push (view reference) vs. pull (observed state) | Why MVVM fits SwiftUI |
| VIPER | Five small parts per screen | Easy to test, but a lot of extra code |
| Clean Architecture | Domain depends on nothing | Core logic is safe from tool changes |
| Unidirectional data flow | Action → Reducer → State → View | Every state change can be listed |
| Reducers / actions / effects | Pure changes, impure work separate | Simple, testable core logic |
| The Composable Architecture | `@Reducer`, `@ObservableState`, `.run`, `@Dependency` | Macro-powered version of the pattern |
| TestStore | `send()` and `receive()` with exact state checks | Step-by-step feature tests |
| Coordinator | One object owns navigation | Screens don't decide what comes next |
| SwiftUI navigation | A router with `NavigationPath` | Often enough alone; coordinators for complex flows |
| Use cases | One type per business action | Testable, but can be too much |
| Choosing | Match the pattern to team and app size | No single correct choice |
