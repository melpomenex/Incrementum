import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImageRegistryLibrary } from "../ImageRegistryLibrary";

const mockApi = vi.hoisted(() => ({
  listImageAssets: vi.fn(),
  ingestImageFile: vi.fn(),
  ingestImageBlob: vi.fn(),
  deleteImageAsset: vi.fn(),
}));
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../../api/image-registry", () => mockApi);
vi.mock("../../common/Toast", () => ({
  useToast: () => mockToast,
}));

describe("ImageRegistryLibrary", () => {
  beforeEach(() => {
    mockApi.listImageAssets.mockReset();
    mockApi.ingestImageFile.mockReset();
    mockApi.ingestImageBlob.mockReset();
    mockApi.deleteImageAsset.mockReset();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
    mockToast.warning.mockReset();
    mockToast.info.mockReset();
  });

  it("renders usage metadata from the image registry", async () => {
    mockApi.listImageAssets.mockResolvedValue([
      {
        id: "asset-1",
        mime_type: "image/png",
        file_name: "diagram.png",
        byte_size: 2048,
        sha256: "sha-1",
        width: 400,
        height: 300,
        created_at: "2026-04-23T00:00:00.000Z",
        reference_count: 2,
        is_referenced: true,
        data_url: "data:image/png;base64,AAAA",
      },
    ]);

    render(<ImageRegistryLibrary />);

    expect(await screen.findByText("diagram.png")).toBeInTheDocument();
    expect(screen.getByText("In use")).toBeInTheDocument();
    expect(screen.getByText("Used in 2 flashcard(s)")).toBeInTheDocument();
  });

  it("ingests pasted image files and returns the selection", async () => {
    mockApi.listImageAssets.mockResolvedValue([]);
    mockApi.ingestImageFile.mockResolvedValue({
      id: "asset-new",
      mime_type: "image/png",
      file_name: "clipboard-shot.png",
      byte_size: 1024,
      sha256: "sha-new",
      width: 300,
      height: 200,
      created_at: "2026-04-23T01:00:00.000Z",
      reference_count: 0,
      is_referenced: false,
      data_url: "data:image/png;base64,BBBB",
    });

    const onConfirmSelection = vi.fn();
    const { container } = render(
      <ImageRegistryLibrary
        showConfirmButton
        onConfirmSelection={onConfirmSelection}
      />
    );

    await waitFor(() => expect(mockApi.listImageAssets).toHaveBeenCalled());

    const imageFile = new File(["image"], "clipboard-shot.png", { type: "image/png" });
    fireEvent.paste(container.firstElementChild as Element, {
      clipboardData: {
        files: [imageFile],
      },
    });

    expect(await screen.findAllByText("clipboard-shot.png")).not.toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Use selected images" }));

    expect(onConfirmSelection).toHaveBeenCalledWith(["asset-new"]);
  });
});
