## ADDED Requirements

### Requirement: Dynamic theme application
The HTML viewer SHALL apply dark or light theme CSS to the iframe content matching the application's current theme.

#### Scenario: Dark mode applied
- **WHEN** the application is in dark mode and the HTML viewer is displayed
- **THEN** the iframe content uses dark background, light text, and appropriate border colors

#### Scenario: Light mode applied
- **WHEN** the application is in light mode and the HTML viewer is displayed
- **THEN** the iframe content uses light background, dark text, and appropriate border colors

#### Scenario: Theme change updates iframe
- **WHEN** the user toggles the application theme while viewing an HTML document
- **THEN** the iframe content theme updates immediately without page reload

### Requirement: Theme CSS injection
Theme styles SHALL be injected as a `<style>` element in the iframe's document head, applying to the body and common elements (paragraphs, headings, links, tables, code blocks).

#### Scenario: CSS injection on load
- **WHEN** the HTML iframe loads
- **THEN** a `<style>` element with theme-matching CSS is injected into the iframe document head

#### Scenario: CSS update on theme change
- **WHEN** the application theme changes
- **THEN** the injected `<style>` element is updated with the new theme's CSS values
