'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  source: string;
  className?: string;
}

export default function MarkdownPreview({ source, className }: Props) {
  return (
    <div className={`md-preview ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
