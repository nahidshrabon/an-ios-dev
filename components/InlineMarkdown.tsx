import ReactMarkdown from "react-markdown";

export function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <>{children}</>,
        code: ({ children }) => (
          <code className="rounded bg-black/5 px-1.5 py-0.5 text-[0.9em] dark:bg-white/10">
            {children}
          </code>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
