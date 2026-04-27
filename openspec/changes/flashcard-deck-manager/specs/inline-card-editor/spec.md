## ADDED Requirements

### Requirement: Inline card expansion and editing
The system SHALL allow users to click a card row to expand it into an inline editor panel below the row, showing editable fields for question, answer, tags, and suspension state. No modal SHALL be opened.

#### Scenario: Expanding a card for editing
- **WHEN** user clicks on a card row in the deck list
- **THEN** the row expands to reveal editable question, answer, and tag fields inline, without opening a modal

#### Scenario: Editing question text
- **WHEN** user modifies the question field and clicks "Save"
- **THEN** the card's question is updated in the database and the card row updates to reflect the new question preview

#### Scenario: Editing answer text
- **WHEN** user modifies the answer field and clicks "Save"
- **THEN** the card's answer is updated in the database

#### Scenario: Editing tags
- **WHEN** user adds or removes tags and clicks "Save"
- **THEN** the card's tag array is updated in the database, and if the tag change causes the card to no longer match the current deck's filters, the card is removed from the visible list

### Requirement: Optimistic updates with rollback
The system SHALL apply edits optimistically (updating the UI immediately) and roll back changes if the save operation fails, displaying an error notification.

#### Scenario: Successful optimistic update
- **WHEN** user saves an edit to a card
- **THEN** the UI updates immediately with the new content before the API response arrives

#### Scenario: Failed save with rollback
- **WHEN** user saves an edit and the API call fails
- **THEN** the UI reverts to the previous content and displays an error notification

### Requirement: Card type-aware editing
The system SHALL adapt the inline editor based on card type. For basic and QA cards, show question/answer fields. For cloze cards, show the cloze text with highlighted ranges. For cards with interaction metadata (multiple-choice, image-occlusion), show a "Edit in Studio" link that opens FlashcardStudioModal instead.

#### Scenario: Editing a basic/QA card inline
- **WHEN** user clicks a basic or QA type card
- **THEN** the inline editor shows editable question and answer text fields

#### Scenario: Editing a cloze card inline
- **WHEN** user clicks a cloze type card
- **THEN** the inline editor shows the cloze text with highlighted deletion ranges, allowing text editing

#### Scenario: Complex card type redirects to Studio
- **WHEN** user clicks a multiple-choice or image-occlusion card
- **THEN** the inline editor shows a read-only preview with an "Edit in Studio" button that opens FlashcardStudioModal for that card

### Requirement: Quick suspend/unsuspend toggle
The system SHALL provide a toggle within the inline editor to suspend or unsuspend the card, with immediate visual feedback (dimmed row when suspended).

#### Scenario: Suspending a card inline
- **WHEN** user toggles the suspend switch in the inline editor
- **THEN** the card's `is_suspended` is set to true, the row becomes visually dimmed, and the suspension persists on save

#### Scenario: Unsuspending a card inline
- **WHEN** user toggles the suspend switch off for a suspended card
- **THEN** the card's `is_suspended` is set to false, the row returns to normal appearance
