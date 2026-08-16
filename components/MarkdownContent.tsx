import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import swift from "highlight.js/lib/languages/swift";
import { BookmarkToggle } from "@/components/BookmarkToggle";
import { BookmarksProvider } from "@/components/BookmarksProvider";

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(nodeText).join("");
  }
  if (
    node &&
    typeof node === "object" &&
    "props" in node &&
    node.props &&
    typeof node.props === "object" &&
    "children" in node.props
  ) {
    return nodeText(node.props.children as ReactNode);
  }
  return "";
}

export function MarkdownContent({
  content,
  articleSlug,
}: {
  content: string;
  articleSlug?: string;
}) {
  const markdown = (
    <div className="markdown-content font-article">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, [rehypeHighlight, { languages: { swift } }]]}
        components={{
          h2: ({ id, children }) => (
            <h2
              id={id}
              className="font-heading mt-10 flex items-center gap-2 text-xl font-semibold first:mt-0"
            >
              {children}
              {articleSlug &&
                id &&
                nodeText(children).trim().toLowerCase() !== "summary" && (
                  <BookmarkToggle
                    articleSlug={articleSlug}
                    headingSlug={id}
                    headingTitle={nodeText(children)}
                  />
                )}
            </h2>
          ),
          h3: ({ id, children }) => (
            <h3
              id={id}
              className="font-heading mt-8 flex items-center gap-2 text-lg font-medium"
            >
              {children}
              {articleSlug &&
                id &&
                nodeText(children).trim().toLowerCase() !== "summary" && (
                  <BookmarkToggle
                    articleSlug={articleSlug}
                    headingSlug={id}
                    headingTitle={nodeText(children)}
                  />
                )}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mt-4 leading-7 text-zinc-700 dark:text-zinc-300">
              {children}
            </p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="underline"
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-black dark:text-white">
              {children}
            </strong>
          ),
          ul: ({ children }) => (
            <ul className="mt-4 list-disc pl-6 leading-7 text-zinc-700 dark:text-zinc-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mt-4 list-decimal pl-6 leading-7 text-zinc-700 dark:text-zinc-300">
              {children}
            </ol>
          ),
          hr: () => (
            <hr className="my-8 border-black/10 dark:border-white/10" />
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-black/5 px-1.5 py-0.5 text-[0.9em] dark:bg-white/10">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mt-4 overflow-x-auto rounded-xl bg-[#0d1117] p-4 text-sm">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mt-4 border-l-2 border-black/20 pl-4 italic text-zinc-600 dark:border-white/20 dark:text-zinc-400">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="font-heading border border-black/10 bg-black/[.03] px-3 py-2 text-left font-medium dark:border-white/10 dark:bg-white/5">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-black/10 px-3 py-2 dark:border-white/10">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );

  return articleSlug ? (
    <BookmarksProvider key={articleSlug} articleSlug={articleSlug}>
      {markdown}
    </BookmarksProvider>
  ) : (
    markdown
  );
}
