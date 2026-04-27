import { useEffect, useState } from "react";
import { useReviewStore } from "../../stores/reviewStore";
import { ReviewHome } from "../../components/review/ReviewHome";
import { ReviewSession } from "../../components/review/ReviewSession";
import { DeckManager } from "../../components/review/DeckManager";

type Mode = "home" | "session" | "deck-manager";

export function ReviewTab() {
  const { loadQueue, resetSession, queue, currentCard } = useReviewStore();
  const [mode, setMode] = useState<Mode>("home");

  const handleStartReview = async () => {
    await loadQueue();
    const { queue } = useReviewStore.getState();
    if (queue.length > 0) {
      setMode("session");
    }
  };

  const handleExit = () => {
    resetSession();
    setMode("home");
  };

  useEffect(() => {
    if (queue.length > 0 && currentCard) {
      setMode("session");
    } else if (queue.length === 0 && mode === "session") {
      setMode("home");
    }
  }, [queue.length, currentCard, mode]);

  useEffect(() => {
    return () => {
      resetSession();
    };
  }, [resetSession]);

  if (mode === "session") {
    return <ReviewSession onExit={handleExit} />;
  }

  if (mode === "deck-manager") {
    return <DeckManager onBack={() => setMode("home")} />;
  }

  return (
    <ReviewHome
      onStartReview={handleStartReview}
      onOpenDeckManager={() => setMode("deck-manager")}
    />
  );
}
