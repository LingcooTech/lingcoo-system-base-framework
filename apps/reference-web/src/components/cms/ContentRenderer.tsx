import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ContentRenderer({ content }: { content: string }) {
  return (
    <div className="cms-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
