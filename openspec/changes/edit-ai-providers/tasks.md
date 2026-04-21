## 1. State Management

- [x] 1.1 Add `editingProvider` state (nullable `LLMProviderConfig`) to `LLMProviderSettings` component to track which provider is being edited
- [x] 1.2 Add `startEditing(provider)` and `cancelEditing()` handler functions that set/clear the editing state

## 2. Form Adaptation

- [x] 2.3 When `editingProvider` is set, pre-populate the form fields with the provider's current values (name, API key, base URL, model)
- [x] 2.4 Disable the provider type selector when in edit mode
- [x] 2.5 Change the form submit button label to "Save Changes" in edit mode and "Add Provider" in add mode
- [x] 2.6 On form submit in edit mode, call `updateProvider(editingProvider.id, formData)` instead of `addProvider`

## 3. Provider List UI

- [x] 3.7 Add an edit button (pencil icon) to each provider card, positioned alongside the existing test and delete buttons
- [x] 3.8 Clicking the edit button calls `startEditing(provider)` which opens the form pre-filled
- [x] 3.9 Clicking edit while already editing a different provider switches to the new provider's values

## 4. Cancel and Cleanup

- [x] 4.10 The cancel button in edit mode calls `cancelEditing()` which clears the form and hides it
- [x] 4.11 After a successful save, clear `editingProvider` state and return to the provider list view
