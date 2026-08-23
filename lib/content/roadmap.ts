export interface RoadmapSection {
  /** Permanent identifier — referenced by roadmap_progress rows. Do not renumber. */
  id: string;
  number: number;
  title: string;
  /** Slug of the article that covers this section, if one exists yet. */
  articleSlug?: string;
}

export interface RoadmapPart {
  id: string;
  title: string;
  sections: RoadmapSection[];
}

function section(
  number: number,
  title: string,
  articleSlug?: string
): RoadmapSection {
  return { id: String(number), number, title, articleSlug };
}

export const roadmap: RoadmapPart[] = [
  {
    id: "part-1",
    title: "Swift Language",
    sections: [
      section(1, "Swift Basics", "swift-basics"),
      section(2, "Control Flow", "control-flow"),
      section(3, "Collections", "collections"),
      section(4, "Optionals", "optionals"),
      section(5, "Functions and Closures", "functions-and-closures"),
      section(6, "Structs, Classes, and Enums", "structs-classes-enums"),
      section(7, "Protocols and Extensions", "protocols-and-extensions"),
      section(8, "Generics", "generics"),
      section(9, "Error Handling", "error-handling"),
      section(10, "Memory Management", "memory-management"),
      section(11, "Advanced Type System", "advanced-type-system"),
      section(12, "Result Builders and Property Wrappers", "result-builders-and-property-wrappers"),
      section(13, "Macros", "macros"),
      section(14, "Standard Library Deep Dive", "standard-library-deep-dive"),
      section(15, "Low-Level Swift", "low-level-swift"),
      section(16, "Swift Evolution Literacy", "swift-evolution-literacy"),
    ],
  },
  {
    id: "part-2",
    title: "Concurrency",
    sections: [
      section(17, "Async/Await Foundations", "async-await-foundations"),
      section(18, "Structured Concurrency", "structured-concurrency"),
      section(19, "Actors and Isolation", "actors-and-isolation"),
      section(20, "Sendable and Data-Race Safety", "sendable-and-data-race-safety"),
      section(21, "AsyncSequence and Streams", "async-sequence-and-streams"),
      section(22, "Legacy Concurrency", "legacy-concurrency"),
    ],
  },
  {
    id: "part-3",
    title: "SwiftUI",
    sections: [
      section(23, "SwiftUI Fundamentals", "swiftui-fundamentals"),
      section(24, "Layout", "layout"),
      section(25, "State Management", "state-management"),
      section(26, "Lists and Collections", "lists-and-collections"),
      section(27, "Navigation and Presentation", "navigation-and-presentation"),
      section(28, "Forms and Input", "forms-and-input"),
      section(29, "Animation", "animation"),
      section(30, "Drawing and Custom Graphics", "drawing-and-custom-graphics"),
      section(31, "SwiftUI Architecture and Internals", "swiftui-architecture-and-internals"),
      section(32, "Liquid Glass and Modern Design", "liquid-glass-and-modern-design"),
      section(33, "Multiplatform SwiftUI", "multiplatform-swiftui"),
      section(34, "Document-Based Apps", "document-based-apps"),
    ],
  },
  {
    id: "part-4",
    title: "UIKit",
    sections: [
      section(35, "UIKit Essentials", "uikit-essentials"),
      section(36, "Auto Layout", "auto-layout"),
      section(37, "Table and Collection Views", "table-and-collection-views"),
      section(38, "UIKit and SwiftUI Interop", "uikit-and-swiftui-interop"),
    ],
  },
  {
    id: "part-5",
    title: "Data",
    sections: [
      section(39, "Networking Fundamentals", "networking-fundamentals"),
      section(40, "Advanced Networking", "advanced-networking"),
      section(41, "SwiftData", "swiftdata"),
      section(42, "Core Data", "core-data"),
      section(43, "Other Persistence", "other-persistence"),
      section(44, "CloudKit and Sync", "cloudkit-and-sync"),
    ],
  },
  {
    id: "part-6",
    title: "Architecture",
    sections: [
      section(45, "Architecture Foundations", "architecture-foundations"),
      section(46, "Architecture Patterns", "architecture-patterns"),
      section(47, "Dependency Injection", "dependency-injection"),
      section(48, "Modularization", "modularization"),
    ],
  },
  {
    id: "part-7",
    title: "Platform Frameworks",
    sections: [
      section(49, "App Lifecycle and System Integration", "app-lifecycle-and-system-integration"),
      section(50, "Notifications", "notifications"),
      section(51, "App Intents and Siri", "app-intents-and-siri"),
      section(52, "WidgetKit and Live Activities", "widgetkit-and-live-activities"),
      section(53, "App Extensions", "app-extensions"),
      section(54, "Location and Maps", "location-and-maps"),
      section(55, "Camera, Photos, and Media", "camera-photos-and-media"),
      section(56, "StoreKit and Monetization", "storekit-and-monetization"),
      section(57, "Other System Frameworks", "other-system-frameworks"),
    ],
  },
  {
    id: "part-8",
    title: "On-Device AI",
    sections: [
      section(58, "Foundation Models", "foundation-models"),
      section(59, "Core ML and Custom Models", "core-ml-and-custom-models"),
      section(60, "Vision, Speech, and Language", "vision-speech-and-language"),
      section(61, "AI-Assisted Development", "ai-assisted-development"),
    ],
  },
  {
    id: "part-9",
    title: "Graphics and Immersive",
    sections: [
      section(62, "Core Animation and Graphics", "core-animation-and-graphics"),
      section(63, "Metal", "metal"),
      section(64, "RealityKit, ARKit, and visionOS", "realitykit-arkit-and-visionos"),
    ],
  },
  {
    id: "part-10",
    title: "Quality",
    sections: [
      section(65, "Testing Foundations", "testing-foundations"),
      section(66, "Advanced Testing", "advanced-testing"),
      section(67, "UI Testing", "ui-testing"),
      section(68, "Debugging", "debugging"),
      section(69, "Performance", "performance"),
      section(70, "Accessibility", "accessibility"),
      section(71, "Localization", "localization"),
    ],
  },
  {
    id: "part-11",
    title: "Tooling and Shipping",
    sections: [
      section(72, "Xcode and the Build System"),
      section(73, "Swift Package Manager"),
      section(74, "Git and Collaboration"),
      section(75, "Code Quality Tooling"),
      section(76, "CI/CD"),
      section(77, "Code Signing and Distribution"),
      section(78, "App Store"),
      section(79, "Security and Privacy"),
      section(80, "Observability and Analytics"),
    ],
  },
  {
    id: "part-12",
    title: "Beyond the App",
    sections: [section(81, "Swift Outside iOS"), section(82, "Engineering Craft")],
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
