## MODIFIED Requirements

### Requirement: QueueScrollPage Escape key handling
The system SHALL NOT close the queue scroll tab on Escape when a modal, popup, or dialog is open (FlashcardStudioModal, ClozeCreatorPopup, QACreatorPopup, CreateExtractDialog, settings modals, etc.).

#### Scenario: User closes FlashcardStudioModal from queue
- GIVEN user is in QueueScrollPage with a document rendered
- AND user selects text and right-clicks "Create Flashcard"
- AND FlashcardStudioModal is open
- WHEN user presses Escape to close the modal
- THEN FlashcardStudioModal closes
- AND user remains in the queue scroll page with the same item visible

#### Scenario: User presses Escape with no modal open
- GIVEN user is in QueueScrollPage with no modal/popup open
- WHEN user presses Escape
- THEN the queue scroll tab closes as before
