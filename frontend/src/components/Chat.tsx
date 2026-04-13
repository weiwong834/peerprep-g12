/*
AI Assistance Disclosure:
Tool: ChatGPT (model: GPT-5.3-Codex), date: 2026‐04-13
Scope: Generated tailwind CSS utility classes according to requested aesthetic preferences.
Author review: Provide instructions for UI design, adjusted output where necessary.
*/

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AIExplanationType } from "../services/aiExplanationsService";

type TabType = "Partner Chat" | "AI Chat" | "AI Explanations";

type Props = {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  remainingPrompts: number | null;
  promptCountLoading: boolean;
  aiChatMessages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  aiChatHistoryLoading: boolean;
  appendAiChatMessage: (message: { role: "user" | "assistant"; content: string }) => void;
  onSendAiChatPrompt: (prompt: string) => Promise<string>;
  onAiChatMessageSent: () => void;
  remainingRequests: number | null;
  loading: boolean;
  handleAIRequest: (type: AIExplanationType) => void;
  aiResponse: string;
};

export default function Chat({
  activeTab,
  setActiveTab,
  remainingPrompts,
  promptCountLoading,
  aiChatMessages,
  aiChatHistoryLoading,
  appendAiChatMessage,
  onSendAiChatPrompt,
  onAiChatMessageSent,
  remainingRequests,
  loading,
  handleAIRequest,
  aiResponse,
}: Props) {
  const MIN_INPUT_HEIGHT_PX = 40;
  const MAX_INPUT_HEIGHT_PX = 56;

  const MAX_PROMPTS = 15;
  const [promptsLeft, setPromptsLeft] = useState<number>(MAX_PROMPTS);
  const [isUsingBackendCount, setIsUsingBackendCount] = useState(false);
  const [sendingAiChat, setSendingAiChat] = useState(false);
  const [aiChatInput, setAiChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  function resizeInput(target: HTMLTextAreaElement) {
    target.style.height = `${MIN_INPUT_HEIGHT_PX}px`;
    const nextHeight = Math.min(target.scrollHeight, MAX_INPUT_HEIGHT_PX);
    target.style.height = `${nextHeight}px`;
    target.style.overflowY = target.scrollHeight > MAX_INPUT_HEIGHT_PX ? "auto" : "hidden";
  }

  useEffect(() => {
    if (typeof remainingPrompts === "number") {
      setPromptsLeft(remainingPrompts);
      setIsUsingBackendCount(true);
      return;
    }

    if (!promptCountLoading) {
      setIsUsingBackendCount(false);
    }
  }, [remainingPrompts, promptCountLoading]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aiChatMessages, sendingAiChat]);

  useEffect(() => {
    if (activeTab !== "AI Chat") return;

    window.requestAnimationFrame(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [activeTab]);

  async function sendAiChatMessage() {
    const trimmed = aiChatInput.trim();
    if (!trimmed || promptsLeft <= 0 || sendingAiChat) return;

    appendAiChatMessage({ role: "user", content: trimmed });
    setAiChatInput("");

    const inputEl = document.getElementById("ai-chat-input") as HTMLTextAreaElement | null;
    if (inputEl) {
      inputEl.style.height = `${MIN_INPUT_HEIGHT_PX}px`;
      inputEl.style.overflowY = "hidden";
    }

    // Fallback for prompt count in case backend count not avail
    if (!isUsingBackendCount) {
      setPromptsLeft((prev) => Math.max(0, prev - 1));
    }

    try {
      setSendingAiChat(true);
      const response = await onSendAiChatPrompt(trimmed);
      appendAiChatMessage({ role: "assistant", content: response });
      onAiChatMessageSent();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to get AI response.";
      appendAiChatMessage({ role: "assistant", content: errorMessage });
    } finally {
      setSendingAiChat(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col min-h-0">
      <div className="flex border-b mb-3">
        <button
          onClick={() => setActiveTab("Partner Chat")}
          className={`px-3 py-2 text-sm ${
            activeTab === "Partner Chat"
              ? "border-b-2 border-indigo-500 font-medium"
              : "text-gray-500"
          }`}
        >
          Partner Chat
        </button>

        <button
          onClick={() => setActiveTab("AI Chat")}
          className={`px-3 py-2 text-sm ${
            activeTab === "AI Chat"
              ? "border-b-2 border-indigo-500 font-medium"
              : "text-gray-500"
          }`}
        >
          AI Chat
        </button>

        <button
          onClick={() => setActiveTab("AI Explanations")}
          className={`px-3 py-2 text-sm ${
            activeTab === "AI Explanations"
              ? "border-b-2 border-indigo-500 font-medium"
              : "text-gray-500"
          }`}
        >
          AI Explanations
        </button>
      </div>

      {/* {activeTab === "Partner Chat" */}

      {activeTab === "AI Chat" && (
        <>
          <div className="text-sm text-gray-500 mb-2">
            {`Prompts left: ${promptsLeft} / ${MAX_PROMPTS}`}
            {promptCountLoading && " (syncing...)"}
            {!promptCountLoading && !isUsingBackendCount && " (estimated)"}
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-xl bg-slate-100/80 p-4 text-sm text-slate-700 space-y-2">
            {aiChatHistoryLoading ? (
              <p className="text-slate-500">Loading chat history...</p>
            ) : aiChatMessages.length === 0 ? (
              <p className="text-slate-500">Send a prompt to start chatting with AI.</p>
            ) : (
              aiChatMessages.map((message, index) => (
                message.role === "user" ? (
                  <div key={index} className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg bg-indigo-100 px-3 py-2 text-indigo-900 whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div
                    key={index}
                    className="prose prose-slate max-w-none overflow-x-hidden text-slate-700 prose-pre:whitespace-pre-wrap prose-pre:break-words prose-pre:overflow-x-hidden prose-code:break-words"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </div>
                )
              ))
            )}
            {sendingAiChat && <p className="text-slate-500">Thinking...</p>}
            <div ref={chatBottomRef} />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <textarea
              id="ai-chat-input"
              value={aiChatInput}
              onChange={(e) => {
                setAiChatInput(e.target.value);
                resizeInput(e.currentTarget);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendAiChatMessage();
                }
              }}
              placeholder="Ask AI for guidance..."
              rows={1}
              className="flex-1 h-10 resize-none rounded-lg border border-slate-300 p-2 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button
              onClick={() => {
                void sendAiChatMessage();
              }}
              disabled={sendingAiChat || promptsLeft === 0 || aiChatInput.trim().length === 0}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${
                sendingAiChat || promptsLeft === 0 || aiChatInput.trim().length === 0
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
              aria-label="Send AI chat prompt"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M22 2 11 13"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m22 2-7 20-4-9-9-4 20-7Z"
                />
              </svg>
            </button>
          </div>
        </>
      )}

      {activeTab === "AI Explanations" && (
        <>
          <div className="text-sm text-gray-500 mb-2">
            {remainingRequests !== null
              ? `Hints left: ${remainingRequests} / 5`
              : "Loading remaining hints..."}
          </div>

          <div className="flex flex-col gap-2 mb-4">
            <button
              onClick={() => handleAIRequest("EXPLAIN_QUESTION")}
              disabled={loading || remainingRequests === 0 || remainingRequests === null}
              className={`rounded px-3 py-2 text-sm ${
                loading || remainingRequests === 0 || remainingRequests === null
                  ? "bg-gray-200 cursor-not-allowed"
                  : "bg-slate-100 hover:bg-slate-200"
              }`}
            >
              Explain Question
            </button>

            <button
              onClick={() => handleAIRequest("HINT")}
              disabled={loading || remainingRequests === 0 || remainingRequests === null}
              className={`rounded px-3 py-2 text-sm ${
                loading || remainingRequests === 0 || remainingRequests === null
                  ? "bg-gray-200 cursor-not-allowed"
                  : "bg-slate-100 hover:bg-slate-200"
              }`}
            >
              Give Hint
            </button>

            <button
              onClick={() => handleAIRequest("EXPLAIN_CODE")}
              disabled={loading || remainingRequests === 0 || remainingRequests === null}
              className={`rounded px-3 py-2 text-sm ${
                loading || remainingRequests === 0 || remainingRequests === null
                  ? "bg-gray-200 cursor-not-allowed"
                  : "bg-slate-100 hover:bg-slate-200"
              }`}
            >
              Explain Code
            </button>
          </div>

          <div className="flex-1 overflow-y-auto border rounded p-3 text-sm text-slate-700 whitespace-pre-wrap">
            {loading
              ? "Thinking..."
              : aiResponse ? (
                <div className="prose prose-slate max-w-none text-slate-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {aiResponse}
                  </ReactMarkdown>
                </div>
              ) : (
                "Ask for help to see AI explanation."
              )}
          </div>
        </>
      )}
    </div>
  );
}
