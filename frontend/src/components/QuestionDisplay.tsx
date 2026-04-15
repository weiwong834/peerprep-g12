import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import type { Question } from "../services/questionService";

type Props = {
    question: Question;
    showTitle?: boolean;
}

export default function QuestionDisplay({ question, showTitle = true }: Props) {
    return (
        <div>
            {showTitle && (
                <h2 className="text-lg font-semibold mb-4">{question.title}</h2>
            )}
            <div className="space-y-4">
                {question.blocks && question.blocks.length > 0 ? (
                    question.blocks.map((block, index) =>
                        block.block_type === "text" ? (
                            <ReactMarkdown
                                key={index}
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeHighlight]}
                                components={{
                                    code({ className, children, ...props }) {
                                        const isInline = !className;
                                        return isInline ? (
                                            <code
                                                className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-sm font-mono"
                                                {...props}
                                            >{children}</code>
                                        ) : (
                                            <code className={className} {...props}>{children}</code>
                                        );
                                    },
                                    pre({ children }) {
                                        return (
                                            <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 overflow-x-auto text-sm">
                                                {children}
                                            </pre>
                                        );
                                    },
                                    p({ children }) {
                                        return (
                                            <p className="text-sm text-slate-700 leading-relaxed">{children}</p>
                                        );
                                    },
                                    strong({ children }) {
                                        return (
                                            <strong className="font-semibold text-slate-900">{children}</strong>
                                        );
                                    },
                                    ul({ children }) {
                                        return (
                                            <ul className="list-disc ml-5 space-y-1 text-sm text-slate-700">{children}</ul>
                                        );
                                    },
                                    ol({ children }) {
                                        return (
                                            <ol className="list-decimal ml-5 space-y-1 text-sm text-slate-700">
                                                {children}
                                            </ol>
                                        );
                                    },
                                }}
                            >
                                {block.content}
                            </ReactMarkdown>
                        ) : (
                            <img
                                key={index}
                                src={block.content}
                                alt={`Question image ${index + 1}`}
                                className="max-w-full rounded-lg border"
                            />
                        )
                    )
                ) : (
                    <p className="text-sm text-slate-500">No question description available.</p>
                )}
            </div>
        </div>
    );
}