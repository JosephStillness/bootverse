import Markdown from "react-markdown";
import { safeMarkdownUrl } from "../../lib/community/validation";
export function PostMarkdown({ content }: { content: string }) {
  return (
    <div className="post-markdown">
      <Markdown
        skipHtml
        urlTransform={safeMarkdownUrl}
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          img: ({ alt }) => (
            <span className="text-muted-foreground">
              [Image omitted{alt ? `: ${alt}` : ""}]
            </span>
          ),
          a: ({ href, children }) =>
            href ? (
              <a href={href} rel="ugc nofollow noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
