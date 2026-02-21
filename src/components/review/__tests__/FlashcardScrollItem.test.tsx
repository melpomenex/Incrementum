import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FlashcardScrollItem } from "../FlashcardScrollItem";

vi.mock("../../../api/image-registry", () => ({
  getImageAssetById: vi.fn(),
}));

import { getImageAssetById } from "../../../api/image-registry";

const baseLearningItem = {
  id: "item-1",
  item_type: "Flashcard" as const,
  question: "What is shown?",
  answer: "An image",
  difficulty: 3,
  interval: 0,
  ease_factor: 2.5,
  due_date: new Date().toISOString(),
  date_created: new Date().toISOString(),
  date_modified: new Date().toISOString(),
  review_count: 0,
  lapses: 0,
  state: "New" as const,
  is_suspended: false,
  tags: [],
  image_asset_ids: [],
};

describe("FlashcardScrollItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders registry images when image asset IDs are present", async () => {
    vi.mocked(getImageAssetById).mockResolvedValue({
      id: "asset-1",
      mime_type: "image/png",
      byte_size: 123,
      sha256: "abc",
      created_at: new Date().toISOString(),
      data_url: "data:image/png;base64,AAAA",
    });

    render(
      <FlashcardScrollItem
        learningItem={{ ...baseLearningItem, image_asset_ids: ["asset-1"] }}
        onRate={() => undefined}
      />
    );

    await waitFor(() => {
      expect(screen.getByAltText("Flashcard visual 1")).toBeInTheDocument();
    });
  });

  it("does not render image block when no image asset IDs are provided", () => {
    render(<FlashcardScrollItem learningItem={baseLearningItem} onRate={() => undefined} />);
    expect(screen.queryByAltText("Flashcard visual 1")).not.toBeInTheDocument();
  });
});
