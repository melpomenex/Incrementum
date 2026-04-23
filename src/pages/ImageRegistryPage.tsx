import { ImageRegistryLibrary } from "../components/image-registry/ImageRegistryLibrary";
import { useI18n } from "../lib/i18n";

export function ImageRegistryPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.08),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.09),_transparent_28%)] p-4 md:p-6">
      <div className="mx-auto flex h-[calc(100vh-8.5rem)] max-w-[1500px] min-h-[640px] flex-col">
        <ImageRegistryLibrary
          title={t("imageRegistry.pageTitle")}
          subtitle={t("imageRegistry.pageSubtitle")}
        />
      </div>
    </div>
  );
}

export default ImageRegistryPage;
