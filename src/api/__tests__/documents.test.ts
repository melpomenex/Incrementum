import { beforeEach, describe, expect, it, vi } from "vitest";
import { convertDocumentPdfToHtml, convertPdfToHtml } from "../documents";

const mocks = vi.hoisted(() => ({
  invokeCommand: vi.fn(),
  browserInvoke: vi.fn(),
  isTauri: true,
}));

vi.mock("../../lib/tauri", () => ({
  invokeCommand: mocks.invokeCommand,
  isTauri: () => mocks.isTauri,
  openFilePicker: vi.fn(),
  openFolderPicker: vi.fn(),
}));

vi.mock("../../lib/browser-backend", () => ({
  browserInvoke: mocks.browserInvoke,
}));

describe("document PDF conversion API", () => {
  beforeEach(() => {
    mocks.invokeCommand.mockReset();
    mocks.browserInvoke.mockReset();
    mocks.isTauri = true;
  });

  it("uses snake_case parameters for Tauri file-path PDF conversion", async () => {
    mocks.invokeCommand.mockResolvedValue({
      html_content: "<p>Converted</p>",
      saved_path: "/tmp/source.html",
      original_filename: "source.pdf",
    });

    await convertPdfToHtml("/tmp/source.pdf", true, "/tmp/source.html");

    expect(mocks.invokeCommand).toHaveBeenCalledWith("convert_pdf_to_html", {
      file_path: "/tmp/source.pdf",
      save_to_file: true,
      output_path: "/tmp/source.html",
    });
  });

  it("uses snake_case parameters for Tauri document-id PDF conversion", async () => {
    mocks.invokeCommand.mockResolvedValue({
      html_content: "<p>Converted</p>",
      saved_path: "/tmp/source.html",
      original_filename: "source.pdf",
    });

    await convertDocumentPdfToHtml("doc-1", true, "/tmp/source.html");

    expect(mocks.invokeCommand).toHaveBeenCalledWith("convert_document_pdf_to_html", {
      id: "doc-1",
      save_to_file: true,
      output_path: "/tmp/source.html",
    });
  });

  it("uses the browser backend in web mode", async () => {
    mocks.isTauri = false;
    mocks.browserInvoke.mockResolvedValue({
      html_content: "<p>Converted</p>",
      saved_path: null,
      original_filename: "source.pdf",
    });

    await convertDocumentPdfToHtml("doc-1", false);

    expect(mocks.browserInvoke).toHaveBeenCalledWith("convert_document_pdf_to_html", {
      id: "doc-1",
      save_to_file: false,
      output_path: undefined,
    });
    expect(mocks.invokeCommand).not.toHaveBeenCalled();
  });
});
