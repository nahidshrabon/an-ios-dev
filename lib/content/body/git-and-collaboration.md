## 74.1 Commits, Staging, and History

Git's staging area (the "index") lets changes be selectively prepared for a commit — `git add` stages specific changes, `git commit` records the staged snapshot permanently into the project's history, and this two-step model (stage, then commit) lets a developer construct a commit representing a coherent, deliberate unit of change rather than simply capturing every uncommitted change indiscriminately.

```bash
git add ProfileView.swift ProfileViewModel.swift  # stage only the specific, related files
git commit -m "Add profile editing support"
git log --oneline  # view the resulting commit history
```

The staging area's genuine value becomes apparent specifically when a developer's working directory contains multiple, unrelated changes simultaneously (an in-progress feature alongside an unrelated bug fix stumbled upon along the way) — selectively staging only the files relevant to one coherent change lets that change be committed as its own clean, focused commit, while the unrelated change remains uncommitted and can be staged and committed separately afterward, rather than both getting tangled together into one confusing, mixed-purpose commit.

---

## 74.2 Branching and Merging

A Git branch is a movable pointer to a specific commit, letting development on a new feature or fix proceed independently from the main line of development (commonly called `main`) without affecting it until explicitly merged back — `git merge` integrates a branch's changes into another branch, creating a merge commit that records the point where the two histories rejoined.

```bash
git checkout -b feature/profile-editing
# ... make commits on this branch ...
git checkout main
git merge feature/profile-editing
```

Branching's fundamental value is enabling genuinely parallel, isolated development — multiple developers (or one developer working on multiple things) can work simultaneously on entirely separate lines of development without their in-progress, potentially incomplete or broken changes interfering with each other or with `main`'s own stability, with `merge` providing the mechanism to eventually integrate that isolated work back together once it's actually ready, while preserving the full historical record of how and when that integration happened.

---

## 74.3 Rebasing and Interactive Rebase

`git rebase` replays a branch's commits on top of a different base commit, producing a linear history rather than merge's explicit branching-and-rejoining structure, while interactive rebase (`git rebase -i`) additionally lets a developer reorder, combine (squash), edit, or drop individual commits before they become part of the branch's final, shared history.

```bash
git rebase main  # replay feature branch commits on top of main's latest state
git rebase -i HEAD~3  # interactively edit the last 3 commits: squash, reword, reorder, or drop
```

Interactive rebase's genuine value lies in letting a developer clean up their own local commit history *before* sharing it — a feature branch's real development history might include several "fix typo" or "actually make it work" commits reflecting the messy reality of how the work actually happened, and squashing these into fewer, more coherent commits before opening a pull request produces a genuinely more readable, reviewable history for teammates, though this cleanup should generally happen only on commits not yet pushed/shared, since rewriting already-shared history can create genuine confusion for anyone else who has already based work on the original commits.

---

## 74.4 Resolving Merge Conflicts in Xcode Projects

Merge conflicts within Xcode's `.pbxproj` project file (a sprawling, machine-generated format, recall the `.xcconfig` discussion in section 72.4) are notoriously more painful to resolve manually than conflicts in ordinary source files, since the file's internal structure (unique identifiers, ordering-sensitive entries) makes naive text-based conflict resolution genuinely risky, potentially corrupting the project file if resolved carelessly.

```plaintext
<<<<<<< HEAD
		A1B2C3D4 /* NewFile.swift in Sources */ = {isa = PBXBuildFile; fileRef = A1B2C3D5 /* NewFile.swift */; };
=======
		E5F6A7B8 /* OtherFile.swift in Sources */ = {isa = PBXBuildFile; fileRef = E5F6A7B9 /* OtherFile.swift */; };
>>>>>>> feature-branch
```

Practical strategies for minimizing `.pbxproj` conflict pain include keeping the file's structure genuinely sorted/organized when possible, having team members avoid working on completely unrelated features that both happen to add new files during overlapping time windows when feasible, and, when a conflict does occur, sometimes resorting to opening the project in Xcode and re-adding a conflicting file reference cleanly rather than attempting to hand-edit the raw, cryptic `.pbxproj` conflict markers directly, since Xcode's own project file manipulation is considerably safer than manual text editing of this particular, unusually sensitive file format.

---

## 74.5 .gitignore for Xcode

A properly configured `.gitignore` for an Xcode project excludes genuinely local, machine-specific, or regeneratable files from version control — user-specific Xcode state (`xcuserdata/`), build products (`DerivedData/`, `.build/`), and `Package.resolved` for library packages (recall the distinction discussed in section 73.2) — while correctly *including* files the team genuinely needs to share, like the project file itself and `.xcconfig` files.

```plaintext
# Representative Xcode .gitignore entries
xcuserdata/
DerivedData/
.build/
*.xcuserstate
.swiftpm/
```

Getting `.gitignore` right matters for genuinely practical reasons beyond mere tidiness — committing `xcuserdata/` (which stores per-developer editor state like open tabs and breakpoint positions) produces constant, meaningless merge conflicts as different developers' local editor state collides in version control, while committing `DerivedData/` or `.build/` bloats the repository with entirely regeneratable build artifacts that provide no actual value to anyone cloning the repository, making a correct `.gitignore` a genuine, practical hygiene concern rather than a purely cosmetic one.

---

## 74.6 Pull Requests and Review Etiquette

A pull request (PR) proposes merging a branch's changes, providing a structured space for code review before integration — good review etiquette involves reviewing promptly (respecting a teammate's time and momentum), distinguishing genuinely blocking concerns from optional suggestions, and providing specific, actionable feedback rather than vague criticism.

```plaintext
// A vague, less useful review comment:
"This doesn't look right."

// A specific, actionable review comment:
"This closure captures `self` strongly (recall section 61.11's retain cycle discussion) —
should this be `[weak self]` given that `viewModel` holds a reference to this closure?"
```

Distinguishing blocking from non-blocking feedback explicitly (often via a lightweight convention like prefixing optional suggestions with "nit:") is a genuinely valuable review practice — it lets an author immediately understand which specific pieces of feedback must be addressed before merging versus which are optional, worth-considering suggestions, avoiding the genuinely common friction of an author being uncertain whether a reviewer's comment represents a hard blocker or just a passing thought, and this clarity meaningfully speeds up the overall review-and-iterate cycle for both parties.

---

## 74.7 Writing Commit Messages That Explain Why

A genuinely useful commit message explains *why* a change was made, not merely *what* changed — the "what" is usually already evident from the diff itself, while the "why" (the actual reasoning, context, or problem being solved) is exactly the information that's genuinely lost forever if not captured explicitly in the commit message at the time the change was actually made.

```plaintext
# Less useful: restates what's already visible in the diff
"Change timeout from 30 to 60 seconds"

# More useful: explains the actual reasoning behind the change
"Increase network timeout to 60s

Users on slow connections were seeing premature timeout errors during
large file uploads (see support ticket #4521). 30s wasn't sufficient
for uploads exceeding ~10MB on connections under 1 Mbps."
```

This distinction matters because the "why" behind a change is precisely the information a future developer (quite possibly the original author, months later) will genuinely need but can no longer reconstruct purely from reading the code itself — discovering *that* a timeout value changed from 30 to 60 is trivial from the diff alone, but understanding *why* that specific value was chosen (and thus whether it's now safe to change again) requires the reasoning to have actually been captured in the commit message at the time, since that context is otherwise genuinely, irretrievably lost once the original author's memory of the specific situation fades.

---

## 74.8 Git Hooks for Linting and Formatting

Git hooks (scripts that run automatically at specific points in the Git workflow, like `pre-commit` before a commit is finalized) can enforce code quality checks automatically — running SwiftLint (recall section 75.1) or SwiftFormat (75.2) before allowing a commit to proceed, catching style violations or formatting issues at commit time rather than only later, during CI or code review.

```bash
#!/bin/sh
# .git/hooks/pre-commit
swiftlint --strict
if [ $? -ne 0 ]; then
    echo "SwiftLint found violations. Commit aborted."
    exit 1
fi
```

Catching issues at commit time via a Git hook is meaningfully earlier, and thus cheaper to fix, than catching the same issue later in CI or during code review — a developer immediately re-fixing a linting violation their own pre-commit hook just flagged, while the change is still fresh in their mind, is considerably less friction than the same violation being caught minutes or hours later in a CI run, or worse, during a teammate's code review after the change has already been pushed and is now part of a shared, reviewable history.

---

## 74.9 Trunk-Based Development vs Release Branches 🟠

Trunk-based development keeps a single, continuously-integrated main branch (`main`/`trunk`) with short-lived feature branches merged frequently, while a release-branch model maintains longer-lived branches per release version, with fixes selectively "cherry-picked" or backported between branches as needed — two genuinely different strategies for managing the tension between continuous integration and stable, released software.

```plaintext
// Trunk-based: short-lived branches, frequent merges to main, feature flags
// gate incomplete work rather than long-lived branches isolating it
main:     A---B---C---D---E---F  (continuous integration, frequent small merges)

// Release branches: longer-lived branches per version, selective backporting
main:     A---B---C-------------F  (ongoing development)
release/2.0:    D---E            (stabilization branch, cherry-picked fixes as needed)
```

The right choice between these models is a genuine trade-off depending on an app's actual release cadence and risk tolerance — trunk-based development suits teams shipping continuously (or nearly so) with strong automated testing (recall Part 10's testing material) catching regressions quickly, while a release-branch model suits situations needing a genuinely stable, frozen snapshot for an extended QA/certification period (common for apps with slower, more formal release cycles) where ongoing `main` development shouldn't risk destabilizing a release candidate still being validated.

---

## 74.10 Contributing to an Open-Source Swift Project

Contributing to an open-source Swift project (whether a widely-used package or Swift itself) typically follows a structured process — reading the project's contribution guidelines, starting with a genuinely small, well-scoped first contribution (rather than attempting a large, ambitious change immediately), and engaging with the project's existing review and discussion norms rather than assuming one's own team's internal conventions automatically apply.

```plaintext
// A practical, low-risk first-contribution approach:
// 1. Read CONTRIBUTING.md (or equivalent) thoroughly before doing anything else
// 2. Look for issues explicitly labeled "good first issue" or similar
// 3. Open a small, focused PR — a bug fix or minor improvement, not a large new feature
// 4. Engage genuinely and patiently with review feedback, which may differ from internal team norms
```

Starting with a genuinely small, well-scoped contribution rather than a large one is practical advice with real, demonstrable value — a small change is meaningfully easier for maintainers (who are frequently volunteers with limited available review time) to actually review and merge promptly, and it also gives a new contributor valuable, low-risk exposure to that specific project's particular conventions, review norms, and expectations before attempting anything more substantial, considerably reducing the risk of investing significant effort into a large contribution that ultimately gets rejected or requires extensive rework due to unfamiliarity with the project's actual expectations.

---

## Summary

| Concept | Key Mechanism | Purpose |
|---|---|---|
| Deliberate commits | Staging area, `git add`/`git commit` | Coherent, focused commits from mixed working changes |
| Parallel development | Branches, `git merge` | Isolated work, integrated back with full history |
| History cleanup | Interactive rebase | Readable, reviewable history before sharing |
| Project file conflicts | Careful `.pbxproj` conflict resolution | Avoids corrupting Xcode's sensitive project format |
| Repository hygiene | `.gitignore` | Excludes local/regeneratable files, avoids meaningless conflicts |
| Review clarity | Blocking vs. non-blocking feedback | Speeds up the review-and-iterate cycle |
| Preserved context | "Why," not just "what," commit messages | Captures reasoning that would otherwise be lost |
| Early quality checks | Git hooks (`pre-commit`) | Cheaper, immediate fixes vs. later CI/review discovery |
| Release strategy | Trunk-based vs. release branches | Trade-off between continuous integration and stability windows |
| Open-source norms | Small first contributions | Easier review, low-risk exposure to project conventions |
