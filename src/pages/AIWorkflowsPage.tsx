import { useState } from "react";
import { invokeCommand as invoke } from "../lib/tauri";
import { useI18n } from "../lib/i18n";
import {
  BookOpen,
  CircleNotch,
  Lightbulb,
  PaperPlaneTilt,
  Question,
  Sparkle,
  TextT,
} from "@phosphor-icons/react";

type WorkflowType =
  | "flashcards"
  | "qa"
  | "summarize"
  | "keypoints"
  | "simplify"
  | "title";

const workflows = [
  {
    id: "flashcards" as WorkflowType,
    label: "aiWorkflows.generateFlashcards",
    description: "aiWorkflows.generateFlashcardsDesc",
    icon: <TextT className="w-6 h-6" />,
  },
  {
    id: "qa" as WorkflowType,
    label: "aiWorkflows.qa",
    description: "aiWorkflows.qaDesc",
    icon: <Question className="w-6 h-6" />,
  },
  {
    id: "summarize" as WorkflowType,
    label: "aiWorkflows.summarize",
    description: "aiWorkflows.summarizeDesc",
    icon: <BookOpen className="w-6 h-6" />,
  },
  {
    id: "keypoints" as WorkflowType,
    label: "aiWorkflows.keyPoints",
    description: "aiWorkflows.keyPointsDesc",
    icon: <Lightbulb className="w-6 h-6" />,
  },
  {
    id: "simplify" as WorkflowType,
    label: "aiWorkflows.simplify",
    description: "aiWorkflows.simplifyDesc",
    icon: <Sparkle className="w-6 h-6" />,
  },
  {
    id: "title" as WorkflowType,
    label: "aiWorkflows.generateTitle",
    description: "aiWorkflows.generateTitleDesc",
    icon: <Sparkle className="w-6 h-6" />,
  },
];

export function AIWorkflowsPage() {
  const { t } = useI18n();
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType | null>(
    null
  );
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [question, setQuestion] = useState("");

  const handleProcess = async () => {
    if (!selectedWorkflow || !input.trim()) return;

    setIsProcessing(true);
    setOutput("");

    try {
      let result: string;

      switch (selectedWorkflow) {
        case "flashcards":
          result = await invoke<string>("generate_flashcards_from_content", {
            content: input,
          });
          break;
        case "qa":
          if (!question.trim()) {
            alert(t("integrations.pleaseEnterQuestion"));
            setIsProcessing(false);
            return;
          }
          result = await invoke<string>("answer_question", {
            question,
            context: input,
          });
          break;
        case "summarize":
          result = await invoke<string>("summarize_content", {
            content: input,
          });
          break;
        case "keypoints":
          result = await invoke<string>("extract_key_points", {
            content: input,
          });
          break;
        case "simplify":
          result = await invoke<string>("simplify_content", {
            content: input,
          });
          break;
        case "title":
          result = await invoke<string>("generate_title", {
            content: input,
          });
          break;
        default:
          result = t("integrations.unknownWorkflow");
      }

      setOutput(result);
    } catch (error: any) {
      setOutput(`Error: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-cream">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <h1 className="text-xl font-semibold text-foreground mb-1">
          {t("aiWorkflows.title")}
        </h1>
        <p className="text-sm text-foreground-secondary">
          {t("aiWorkflows.subtitle")}
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Workflow Selection */}
        <div className="w-72 border-r border-border bg-card p-4 overflow-y-auto">
          <h3 className="text-sm font-medium text-foreground mb-3">
            {t("aiWorkflows.selectWorkflow")}
          </h3>
          <div className="space-y-2">
            {workflows.map((workflow) => (
              <button
                key={workflow.id}
                onClick={() => setSelectedWorkflow(workflow.id)}
                aria-label={t(workflow.label)}
                className={`w-full p-3 rounded text-left transition-colors ${selectedWorkflow === workflow.id
                    ? "bg-primary-100 border border-primary-300"
                    : "hover:bg-muted border border-transparent"
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-primary-600">{workflow.icon}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {t(workflow.label)}
                    </div>
                    <div className="text-xs text-foreground-secondary mt-1">
                      {t(workflow.description)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Workflow Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedWorkflow ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-foreground-secondary">
                <Sparkle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t("integrations.selectWorkflowDesc")}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Input Section */}
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                {selectedWorkflow === "qa" && (
                  <div className="mb-4">
                    <label htmlFor="ai-question" className="block text-sm font-medium text-foreground mb-2">
                      {t("aiWorkflows.yourQuestion")}
                    </label>
                    <input
                      id="ai-question"
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder={t("aiWorkflows.whatWouldYouLike")}
                      className="w-full px-3 py-2 bg-card border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary-300"
                    />
                  </div>
                )}

                <div className="mb-4 flex-1 flex flex-col">
                  <label htmlFor="ai-input" className="block text-sm font-medium text-foreground mb-2">
                    {selectedWorkflow === "flashcards"
                      ? t("aiWorkflows.contentToGenerateFlashcards")
                      : selectedWorkflow === "qa"
                        ? t("aiWorkflows.contextToAnswer")
                        : t("aiWorkflows.contentToProcess")}
                  </label>
                  <textarea
                    id="ai-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t("aiWorkflows.pasteContent")}
                    className="flex-1 px-3 py-2 bg-card border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary-300 resize-none"
                  />
                </div>

                {/* Output Section */}
                {output && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t("aiWorkflows.result")}
                    </label>
                    <div className="p-3 bg-card border border-border rounded max-h-64 overflow-y-auto">
                      <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
                        {output}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="p-4 bg-card border-t border-border">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setInput("");
                      setOutput("");
                      setQuestion("");
                    }}
                    className="px-4 py-2 text-sm text-foreground-secondary hover:text-foreground"
                  >
                    {t("common.clear")}
                  </button>
                  <button
                    onClick={handleProcess}
                    disabled={isProcessing || !input.trim()}
                    className="px-4 py-2 bg-primary-300 text-white rounded hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <CircleNotch className="w-4 h-4 animate-spin" />
                        {t("common.processing")}
                      </>
                    ) : (
                      <>
                        <PaperPlaneTilt className="w-4 h-4" />
                        {t("aiWorkflows.process")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
