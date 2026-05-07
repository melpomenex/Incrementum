## ADDED Requirements

### Requirement: Production CSP MUST NOT include unsafe-inline in script-src
The production Content Security Policy SHALL remove `'unsafe-inline'` from `script-src` and `script-src-elem`. Scripts SHALL be authorized via nonces or hashes.

#### Scenario: Inline script injection attempt
- **WHEN** an attacker injects `<script>alert(1)</script>` into rendered content
- **THEN** the browser SHALL block execution due to CSP violation

#### Scenario: Legitimate bundle script execution
- **WHEN** the app loads its main JavaScript bundle with a valid nonce attribute
- **THEN** the script SHALL execute normally

### Requirement: CSP img-src MUST restrict to known domains
The production `img-src` directive SHALL replace the `https:` wildcard with an explicit list of allowed domains: `self`, `data:`, `blob:`, and specific domains (`ytimg.com`, `ggpht.com`, `gstatic.com`, `googleusercontent.com`, `fonts.googleapis.com`, `gravatar.com`).

#### Scenario: Image from allowed domain
- **WHEN** an `<img>` tag references `https://ytimg.com/vi/abc/default.jpg`
- **THEN** the image SHALL load normally

#### Scenario: Image from unknown domain
- **WHEN** an `<img>` tag references `https://evil.com/tracking-pixel.gif`
- **THEN** the image SHALL be blocked by CSP

### Requirement: CSP MUST include frame-ancestors directive
The production CSP SHALL include `frame-ancestors 'self'` to prevent the app from being embedded in iframes on external origins.

#### Scenario: Attempt to embed in external iframe
- **WHEN** an external website attempts to embed Incrementum's webview in an iframe
- **THEN** the browser SHALL block the framing due to the frame-ancestors directive

### Requirement: YouTube embed scripts MUST be authorized via CSP hashes
YouTube iframe embeds that require inline scripts SHALL be authorized using specific CSP hash entries for the known YouTube script content.

#### Scenario: YouTube embed renders correctly
- **WHEN** a YouTube video embed is rendered in the app
- **THEN** the YouTube scripts SHALL execute normally via CSP hash authorization

#### Scenario: Modified YouTube script is blocked
- **WHEN** an attacker modifies the YouTube embed script content
- **THEN** the modified script SHALL be blocked by CSP hash mismatch
