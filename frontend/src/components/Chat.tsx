import type { AIExplanationType } from "../services/aiExplanationsService";

type TabType = "Partner Chat" | "AI Chat" | "AI Explanations";

type Props = {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  remainingRequests: number | null;
  loading: boolean;
  handleAIRequest: (type: AIExplanationType) => void;
  aiResponse: string;
};

export default function Chat({
  activeTab,
  setActiveTab,
  remainingRequests,
  loading,
  handleAIRequest,
  aiResponse,
}: Props) {
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

      {/* {activeTab === "AI Chat" */}

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
              : aiResponse || "Ask for help to see AI explanation."}
          </div>
        </>
      )}
    </div>
  );
}
