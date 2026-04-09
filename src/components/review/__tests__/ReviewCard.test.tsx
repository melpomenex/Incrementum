import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReviewCard } from "../ReviewCard";
import { useSettingsStore } from "../../../stores/settingsStore";

useSettingsStore.persist.setOptions({
  storage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  } as any,
});

vi.mock("../../../hooks/useTTS", () => ({
  useTTS: () => ({
    speak: vi.fn(),
    stop: vi.fn(),
    isSpeaking: false,
    isPaused: false,
    pause: vi.fn(),
    resume: vi.fn(),
    isSupported: false,
  }),
}));

vi.mock("../../../api/image-registry", () => ({
  getImageAssetById: vi.fn(),
}));

const baseCard = {
  id: "card-1",
  item_type: "flashcard" as const,
  question: "Which answer is correct?",
  answer: "Paris",
  difficulty: 3,
  interval: 1,
  ease_factor: 2.5,
  due_date: new Date().toISOString(),
  date_created: new Date().toISOString(),
  date_modified: new Date().toISOString(),
  review_count: 0,
  lapses: 0,
  state: "new" as const,
  is_suspended: false,
  tags: [],
};

describe("ReviewCard", () => {
  it("renders and resolves multiple-choice cards", () => {
    useSettingsStore.setState((state) => ({
      settings: {
        ...state.settings,
        general: { ...state.settings.general, language: "en" },
      },
    }));

    const onShowAnswer = vi.fn();
    const onInteractionResultChange = vi.fn();

    render(
      <ReviewCard
        card={{
          ...baseCard,
          interaction_metadata: {
            multipleChoiceOptions: [
              { id: "a", text: "London" },
              { id: "b", text: "Paris", isCorrect: true },
            ],
            multipleChoiceExplanation: "Paris is the capital of France.",
          },
        }}
        showAnswer={false}
        onShowAnswer={onShowAnswer}
        onInteractionResultChange={onInteractionResultChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /paris/i }));

    expect(onShowAnswer).toHaveBeenCalled();
    expect(onInteractionResultChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        interactionType: "multiple-choice",
        correct: true,
        selectedOptionId: "b",
      })
    );
  });

  it("renders image occlusion overlays before reveal", async () => {
    const { getImageAssetById } = await import("../../../api/image-registry");
    vi.mocked(getImageAssetById).mockResolvedValue({
      id: "asset-1",
      mime_type: "image/png",
      byte_size: 123,
      sha256: "abc",
      created_at: new Date().toISOString(),
      data_url: "data:image/png;base64,AAAA",
    });

    const onInteractionResultChange = vi.fn();
    render(
      <ReviewCard
        card={{
          ...baseCard,
          image_asset_ids: ["asset-1"],
          interaction_metadata: {
            imageOcclusionRegions: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }],
          },
        } as any}
        showAnswer={false}
        onShowAnswer={vi.fn()}
        onInteractionResultChange={onInteractionResultChange}
      />
    );

    expect(await screen.findByAltText("Image occlusion study prompt")).toBeInTheDocument();
    expect(onInteractionResultChange).toHaveBeenCalledWith(
      expect.objectContaining({ interactionType: "image-occlusion" })
    );
  });
});
