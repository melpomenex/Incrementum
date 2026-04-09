export interface MultipleChoiceOption {
  id?: string;
  text: string;
  isCorrect?: boolean;
  feedback?: string;
}

export interface ImageOcclusionRegion {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  color?: string;
}

export interface LearningItemInteractionMetadata {
  typedMode?: "exact" | "fuzzy" | "semantic";
  hints?: string[];
  acceptedAnswers?: string[];
  audioQuestionUrl?: string;
  audio_question_url?: string;
  audioAnswerUrl?: string;
  audio_answer_url?: string;
  interactionType?: "ordering" | "matching" | "multiple-choice" | "image-occlusion";
  orderingItems?: string[];
  orderingAnswer?: string[];
  matchingPairs?: Array<{ left: string; right: string }>;
  handwritingEnabled?: boolean;
  multipleChoiceOptions?: Array<string | MultipleChoiceOption>;
  multipleChoiceCorrectOptionId?: string;
  multipleChoiceExplanation?: string;
  imageOcclusionAssetId?: string;
  imageOcclusionRegions?: ImageOcclusionRegion[];
  imageOcclusionPrompt?: string;
}
