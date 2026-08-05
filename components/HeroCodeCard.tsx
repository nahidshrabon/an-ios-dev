const KEYWORD = "text-[#ff7ab2]";
const TYPE = "text-[#6bdfff]";
const LITERAL = "text-[#f9c859]";
const STRING = "text-[#8bd49c]";
const MUTED = "text-zinc-500";

export function HeroCodeCard() {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[#1e1e1e] shadow-xl shadow-black/10 ring-1 ring-white/10 dark:shadow-black/40">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
        <span className="size-2.5 rounded-full bg-[#ff5f56]" />
        <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="size-2.5 rounded-full bg-[#27c93f]" />
        <span className="ml-3 text-xs text-zinc-500">LearningPath.swift</span>
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-relaxed text-zinc-200">
        <code>
          <span className={KEYWORD}>struct</span> <span className={TYPE}>LearningPath</span> {"{"}
          {"\n  "}
          <span className={KEYWORD}>let</span> topic: <span className={TYPE}>String</span>
          {"\n  "}
          <span className={KEYWORD}>var</span> isDone = <span className={LITERAL}>false</span>
          {"\n\n  "}
          <span className={KEYWORD}>mutating</span> <span className={KEYWORD}>func</span>{" "}
          complete() {"{"}
          {"\n    "}
          isDone = <span className={LITERAL}>true</span>
          {"\n  "}
          {"}"}
          {"\n"}
          {"}"}
          {"\n\n"}
          <span className={KEYWORD}>guard</span> <span className={KEYWORD}>let</span> next =
          path.first(<span className={MUTED}>where:</span> {"{"} !$0.isDone {"}"}){" "}
          <span className={KEYWORD}>else</span> {"{"}
          {"\n  "}
          <span className={KEYWORD}>return</span>{" "}
          <span className={STRING}>&quot;All caught up! 🎉&quot;</span>
          {"\n"}
          {"}"}
        </code>
      </pre>
    </div>
  );
}
