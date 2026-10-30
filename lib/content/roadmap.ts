/**
 * How important a section is for a working iOS developer, shown as stars on
 * the roadmap:
 * 5 — essential, used in almost every app;
 * 4 — important, expected of a professional;
 * 3 — useful, common in many apps;
 * 2 — specialized, needed for some kinds of apps;
 * 1 — niche, for specific products or deep interest.
 */
export type Importance = 1 | 2 | 3 | 4 | 5;

export interface RoadmapSection {
  /** Permanent identifier — referenced by roadmap_progress rows. Do not renumber. */
  id: string;
  number: number;
  title: string;
  /** Slug of the article that covers this section, if one exists yet. */
  articleSlug?: string;
  importance: Importance;
}

export interface RoadmapPart {
  id: string;
  title: string;
  sections: RoadmapSection[];
}

function section(
  number: number,
  title: string,
  articleSlug: string | undefined,
  importance: Importance
): RoadmapSection {
  return { id: String(number), number, title, articleSlug, importance };
}

export const roadmap: RoadmapPart[] = [
  {
    id: "part-1",
    title: "Swift Language",
    sections: [
      section(1, "Swift Basics", "swift-basics", 5),
      section(2, "Control Flow", "control-flow", 5),
      section(3, "Collections", "collections", 5),
      section(4, "Optionals", "optionals", 5),
      section(5, "Functions and Closures", "functions-and-closures", 5),
      section(6, "Structs, Classes, and Enums", "structs-classes-enums", 5),
      section(7, "Protocols and Extensions", "protocols-and-extensions", 5),
      section(8, "Generics", "generics", 4),
      section(9, "Error Handling", "error-handling", 5),
      section(10, "Memory Management", "memory-management", 5),
      section(11, "Advanced Type System", "advanced-type-system", 3),
      section(12, "Result Builders and Property Wrappers", "result-builders-and-property-wrappers", 3),
      section(13, "Macros", "macros", 2),
      section(14, "Standard Library Deep Dive", "standard-library-deep-dive", 3),
      section(15, "Low-Level Swift", "low-level-swift", 2),
      section(16, "Swift Evolution Literacy", "swift-evolution-literacy", 2),
    ],
  },
  {
    id: "part-2",
    title: "Concurrency",
    sections: [
      section(17, "Async/Await Foundations", "async-await-foundations", 5),
      section(18, "Structured Concurrency", "structured-concurrency", 4),
      section(19, "Actors and Isolation", "actors-and-isolation", 5),
      section(20, "Sendable and Data-Race Safety", "sendable-and-data-race-safety", 4),
      section(21, "AsyncSequence and Streams", "async-sequence-and-streams", 3),
      section(22, "Legacy Concurrency", "legacy-concurrency", 3),
    ],
  },
  {
    id: "part-3",
    title: "SwiftUI",
    sections: [
      section(23, "SwiftUI Fundamentals", "swiftui-fundamentals", 5),
      section(24, "Layout", "layout", 5),
      section(25, "State Management", "state-management", 5),
      section(26, "Lists and Collections", "lists-and-collections", 5),
      section(27, "Navigation and Presentation", "navigation-and-presentation", 5),
      section(28, "Forms and Input", "forms-and-input", 4),
      section(29, "Animation", "animation", 3),
      section(30, "Drawing and Custom Graphics", "drawing-and-custom-graphics", 2),
      section(31, "SwiftUI Architecture and Internals", "swiftui-architecture-and-internals", 3),
      section(32, "Liquid Glass and Modern Design", "liquid-glass-and-modern-design", 3),
      section(33, "Multiplatform SwiftUI", "multiplatform-swiftui", 2),
      section(34, "Document-Based Apps", "document-based-apps", 1),
    ],
  },
  {
    id: "part-4",
    title: "UIKit",
    sections: [
      section(35, "UIKit Essentials", "uikit-essentials", 4),
      section(36, "Auto Layout", "auto-layout", 3),
      section(37, "Table and Collection Views", "table-and-collection-views", 3),
      section(38, "UIKit and SwiftUI Interop", "uikit-and-swiftui-interop", 4),
    ],
  },
  {
    id: "part-5",
    title: "Data",
    sections: [
      section(39, "Networking Fundamentals", "networking-fundamentals", 5),
      section(40, "Advanced Networking", "advanced-networking", 3),
      section(41, "SwiftData", "swiftdata", 4),
      section(42, "Core Data", "core-data", 3),
      section(43, "Other Persistence", "other-persistence", 4),
      section(44, "CloudKit and Sync", "cloudkit-and-sync", 2),
    ],
  },
  {
    id: "part-6",
    title: "Architecture",
    sections: [
      section(45, "Architecture Foundations", "architecture-foundations", 4),
      section(46, "Architecture Patterns", "architecture-patterns", 4),
      section(47, "Dependency Injection", "dependency-injection", 4),
      section(48, "Modularization", "modularization", 3),
    ],
  },
  {
    id: "part-7",
    title: "Platform Frameworks",
    sections: [
      section(49, "App Lifecycle and System Integration", "app-lifecycle-and-system-integration", 4),
      section(50, "Notifications", "notifications", 4),
      section(51, "App Intents and Siri", "app-intents-and-siri", 3),
      section(52, "WidgetKit and Live Activities", "widgetkit-and-live-activities", 3),
      section(53, "App Extensions", "app-extensions", 2),
      section(54, "Location and Maps", "location-and-maps", 3),
      section(55, "Camera, Photos, and Media", "camera-photos-and-media", 3),
      section(56, "StoreKit and Monetization", "storekit-and-monetization", 3),
      section(57, "Other System Frameworks", "other-system-frameworks", 2),
    ],
  },
  {
    id: "part-8",
    title: "On-Device AI",
    sections: [
      section(58, "Foundation Models", "foundation-models", 3),
      section(59, "Core ML and Custom Models", "core-ml-and-custom-models", 2),
      section(60, "Vision, Speech, and Language", "vision-speech-and-language", 2),
      section(61, "AI-Assisted Development", "ai-assisted-development", 4),
    ],
  },
  {
    id: "part-9",
    title: "Graphics and Immersive",
    sections: [
      section(62, "Core Animation and Graphics", "core-animation-and-graphics", 2),
      section(63, "Metal", "metal", 1),
      section(64, "RealityKit, ARKit, and visionOS", "realitykit-arkit-and-visionos", 1),
    ],
  },
  {
    id: "part-10",
    title: "Quality",
    sections: [
      section(65, "Testing Foundations", "testing-foundations", 5),
      section(66, "Advanced Testing", "advanced-testing", 3),
      section(67, "UI Testing", "ui-testing", 3),
      section(68, "Debugging", "debugging", 5),
      section(69, "Performance", "performance", 4),
      section(70, "Accessibility", "accessibility", 4),
      section(71, "Localization", "localization", 3),
    ],
  },
  {
    id: "part-11",
    title: "Tooling and Shipping",
    sections: [
      section(72, "Xcode and the Build System", "xcode-and-the-build-system", 4),
      section(73, "Swift Package Manager", "swift-package-manager", 4),
      section(74, "Git and Collaboration", "git-and-collaboration", 5),
      section(75, "Code Quality Tooling", "code-quality-tooling", 3),
      section(76, "CI/CD", "ci-cd", 3),
      section(77, "Code Signing and Distribution", "code-signing-and-distribution", 4),
      section(78, "App Store", "app-store", 4),
      section(79, "Security and Privacy", "security-and-privacy", 4),
      section(80, "Observability and Analytics", "observability-and-analytics", 3),
    ],
  },
  {
    id: "part-12",
    title: "Beyond the App",
    sections: [
      section(81, "Swift Outside iOS", "swift-outside-ios", 1),
      section(82, "Engineering Craft", "engineering-craft", 4),
    ],
  },
];

export function getAllRoadmapSections(): RoadmapSection[] {
  return roadmap.flatMap((part) => part.sections);
}

export function getRoadmapSectionByArticleSlug(
  slug: string
): RoadmapSection | undefined {
  return getAllRoadmapSections().find((s) => s.articleSlug === slug);
}

/**
 * The next published article after the given one, in roadmap order.
 * Skips over sections that don't have an article yet.
 */
export function getNextArticleSection(
  currentArticleSlug: string
): RoadmapSection | undefined {
  const sections = getAllRoadmapSections();
  const currentIndex = sections.findIndex(
    (s) => s.articleSlug === currentArticleSlug
  );
  if (currentIndex === -1) return undefined;

  return sections
    .slice(currentIndex + 1)
    .find((s): s is RoadmapSection & { articleSlug: string } =>
      Boolean(s.articleSlug)
    );
}

/**
 * A section linked to an article is completed automatically once that
 * article is marked "read" — it ignores manualCompleted and can't be
 * toggled by hand. Unlinked sections use the manually-checked map.
 */
export function isRoadmapSectionCompleted(
  section: RoadmapSection,
  manualCompleted: Record<string, boolean>,
  readArticleSlugs: ReadonlySet<string>
): boolean {
  return section.articleSlug
    ? readArticleSlugs.has(section.articleSlug)
    : !!manualCompleted[section.id];
}

export function countCompletedRoadmapSections(
  manualCompleted: Record<string, boolean>,
  readArticleSlugs: ReadonlySet<string>
): number {
  return getAllRoadmapSections().filter((section) =>
    isRoadmapSectionCompleted(section, manualCompleted, readArticleSlugs)
  ).length;
}
