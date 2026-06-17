import { useEffect, useState, useRef } from "react";
import { Check, CircleNotch, Images } from "@phosphor-icons/react";
import { ingestImageBlob } from "../../api/image-registry";
import { useToast } from "../common/Toast";
import { useI18n } from "../../lib/i18n";
import { cn } from "../../utils";

interface ImageHoverData {
  src: string;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export function ImageSaveOverlay() {
  const toast = useToast();
  const { t } = useI18n();
  const [hoverData, setHoverData] = useState<ImageHoverData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const hideTimeoutRef = useRef<number | null>(null);
  const isMouseOverButtonRef = useRef(false);

  useEffect(() => {
    const handleImageHover = (e: CustomEvent<ImageHoverData>) => {
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setHoverData(e.detail);
      // Reset saved state if we switch to a new image hover
      if (hoverData?.src !== e.detail.src) {
        setIsSaved(false);
      }
    };

    const handleImageLeave = () => {
      // Small timeout to give user time to transition mouse to the button
      hideTimeoutRef.current = window.setTimeout(() => {
        if (!isMouseOverButtonRef.current) {
          setHoverData(null);
          setIsSaved(false);
        }
      }, 300);
    };

    // Hide overlay immediately when scrolling
    const handleScroll = () => {
      setHoverData(null);
      setIsSaved(false);
    };

    window.addEventListener("image-hover" as any, handleImageHover);
    window.addEventListener("image-leave" as any, handleImageLeave);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("image-hover" as any, handleImageHover);
      window.removeEventListener("image-leave" as any, handleImageLeave);
      window.removeEventListener("scroll", handleScroll, true);
      if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    };
  }, [hoverData?.src]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!hoverData || isSaving || isSaved) return;

    setIsSaving(true);
    try {
      // Fetch image data
      let blob: Blob;
      if (hoverData.src.startsWith("data:")) {
        const response = await fetch(hoverData.src);
        blob = await response.blob();
      } else {
        const response = await fetch(hoverData.src);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        blob = await response.blob();
      }

      // Generate a reasonable file name based on current timestamp
      const fileExt = blob.type.split("/")[1] || "png";
      const fileName = `saved-image-${Date.now()}.${fileExt}`;

      // Ingest image blob into registry
      await ingestImageBlob(blob, fileName);

      setIsSaved(true);
      toast.success(
        t("imageRegistry.assetsAdded") || "Saved to Image Registry",
        "Successfully added image to registry.",
        {
          action: {
            label: "View Registry",
            onClick: () => {
              window.dispatchEvent(new CustomEvent("navigate", { detail: "/image-registry" }));
            },
          },
        }
      );
    } catch (error) {
      console.error("Failed to save image to registry", error);
      toast.error(
        "Save Failed",
        error instanceof Error ? error.message : "An unknown error occurred while saving."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!hoverData) return null;

  // Position the button near the top right of the hovered image
  const buttonSize = 40;
  const padding = 12;
  const top = hoverData.rect.top + padding;
  const left = hoverData.rect.left + hoverData.rect.width - buttonSize - padding;

  return (
    <div
      className="fixed z-[9999] pointer-events-auto"
      style={{
        top: `${top}px`,
        left: `${left}px`,
        width: `${buttonSize}px`,
        height: `${buttonSize}px`,
      }}
      onMouseEnter={() => {
        isMouseOverButtonRef.current = true;
        if (hideTimeoutRef.current) {
          window.clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
      }}
      onMouseLeave={() => {
        isMouseOverButtonRef.current = false;
        // Trigger leave check
        window.dispatchEvent(new CustomEvent("image-leave"));
      }}
    >
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        title={isSaved ? "Saved to Image Registry" : "Save to Image Registry"}
        className={cn(
          "w-full h-full flex items-center justify-center rounded-xl transition-all duration-300 shadow-lg cursor-pointer",
          "backdrop-blur-md border",
          isSaved
            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
            : "bg-background/85 border-border/60 text-foreground hover:bg-primary hover:text-primary-foreground hover:scale-105 active:scale-95",
          "animate-in fade-in zoom-in-90 duration-200"
        )}
      >
        {isSaving ? (
          <CircleNotch className="w-5 h-5 animate-spin" />
        ) : isSaved ? (
          <Check className="w-5 h-5 animate-in zoom-in-75 duration-200" />
        ) : (
          <Images className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}

export default ImageSaveOverlay;
