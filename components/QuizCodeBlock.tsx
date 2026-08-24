import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import swift from "highlight.js/lib/languages/swift";

export function QuizCodeBlock({ code }: { code: string }) {
  const markdown = "```swift\n" + code + "\n```";

  return (
    <ReactMarkdown
      rehypePlugins={[[rehypeHighlight, { languages: { swift } }]]}
      components={{
        pre: ({ children }) => (
          <pre className="mt-3 overflow-x-auto rounded-xl bg-[#0d1117] p-4 text-sm">
            {children}
          </pre>
        ),
        code: ({ className, children }) => (
          <code className={className}>{children}</code>
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}
