## ADDED Requirements

### Requirement: Export deck to Anki .apkg with correct card type mapping
The system SHALL export a deck's learning items as a valid Anki .apkg file where Basic, Flashcard, and QA cards use Anki's "Basic" note model (Front/Back), and Cloze cards use Anki's "Cloze" note model with `{{c1::text}}` syntax derived from the card's `cloze_text` and `cloze_ranges` fields.

#### Scenario: Export basic flashcards
- **WHEN** a user exports a deck containing Basic and Flashcard cards
- **THEN** each card is written as an Anki note with model "Basic", the question as Front, and the answer as Back

#### Scenario: Export cloze cards
- **WHEN** a user exports a deck containing Cloze cards with `cloze_text` and `cloze_ranges`
- **THEN** each card is written as an Anki note with model "Cloze" and the cloze ranges are converted to `{{c1::text}}` syntax in the Text field

#### Scenario: Export QA cards
- **WHEN** a user exports a deck containing QA cards
- **THEN** each card is written as an Anki note with model "Basic", the question as Front, and the answer as Back

#### Scenario: Export deck with mixed card types
- **WHEN** a user exports a deck containing Basic, Cloze, and QA cards
- **THEN** the .apkg contains both "Basic" and "Cloze" note models and each card uses the correct model

### Requirement: Embed image assets in .apkg media
The system SHALL read image assets referenced by exported learning items and include them as numbered media files inside the .apkg ZIP with a correct `media` JSON manifest. Card HTML fields SHALL reference embedded images using `<img src="N">` syntax.

#### Scenario: Export cards with images
- **WHEN** a user exports a deck where some cards reference image assets
- **THEN** the .apkg ZIP contains the image files in the media entries and the card fields contain `<img>` tags pointing to those media entries

#### Scenario: Export cards without images
- **WHEN** a user exports a deck where no cards reference image assets
- **THEN** the .apkg ZIP contains an empty `media` JSON `{}` and card fields contain no `<img>` tags

### Requirement: Export deck as tab-separated text for Anki import
The system SHALL export a deck's learning items as a tab-separated .txt file with columns Front, Back, Tags — compatible with Anki's native text import.

#### Scenario: Export deck as CSV
- **WHEN** a user chooses to export a deck as tab-separated text
- **THEN** the system writes a .txt file with one line per card, fields separated by tabs, and tags joined by spaces

#### Scenario: Cloze cards in CSV export
- **WHEN** a user exports a deck containing Cloze cards as tab-separated text
- **THEN** the cloze syntax is included verbatim in the Front column

### Requirement: Visible export button in DeckManager toolbar
The system SHALL display a visible "Export to Anki" button in the DeckManager component toolbar (not only in the context menu) that opens a format picker (APKG or CSV) and triggers the export.

#### Scenario: Export from toolbar
- **WHEN** a user clicks the "Export to Anki" button in the DeckManager toolbar
- **THEN** a format picker appears offering APKG and CSV options, and selecting one triggers the export for the selected deck

#### Scenario: No deck selected
- **WHEN** no deck is currently selected in DeckManager
- **THEN** the export button is disabled

### Requirement: Deck-to-Anki export in Import/Export settings
The system SHALL include a dedicated section in the Import/Export settings page for exporting a specific deck to Anki, with a deck picker dropdown and format selector.

#### Scenario: Export from settings
- **WHEN** a user selects a deck from the dropdown in the Import/Export Anki section and clicks Export
- **THEN** the system exports that deck in the selected format and saves the file

#### Scenario: Empty deck
- **WHEN** a user tries to export a deck that has no matching learning items
- **THEN** the system shows an error message indicating the deck is empty

### Requirement: Bulk export all decks
The system SHALL allow exporting all decks into a single .apkg file where each Incrementum deck becomes a separate Anki deck within the package.

#### Scenario: Bulk export
- **WHEN** a user triggers bulk export from the Import/Export settings
- **THEN** the system creates one .apkg containing all learning items organized into separate Anki decks by their tag-based deck membership

#### Scenario: Some decks empty
- **WHEN** some decks have no matching learning items during bulk export
- **THEN** those decks are skipped and the export proceeds with the non-empty decks

### Requirement: Export preview with card count
The system SHALL show a preview of the export before generating the file, including the number of cards to be exported and the deck name.

#### Scenario: Preview shown before export
- **WHEN** a user initiates an export
- **THEN** a confirmation dialog shows the deck name, card count, and export format before the file is generated
