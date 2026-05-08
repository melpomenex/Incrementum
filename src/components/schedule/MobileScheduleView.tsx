import { ScheduleView } from "./ScheduleView";

interface MobileScheduleViewProps {
  onStartReview?: (itemId?: string) => void;
  onOpenDocument?: (documentId: string, title: string) => void;
}

export function MobileScheduleView({ onStartReview, onOpenDocument }: MobileScheduleViewProps) {
  return <ScheduleView isMobile onStartReview={onStartReview} onOpenDocument={onOpenDocument} />;
}
