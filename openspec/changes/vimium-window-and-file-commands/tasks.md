## 1. Split Commands

- [x] 1.1 Add `:split` / `:sp` command — horizontal split, duplicate current tab or open specified type
- [x] 1.2 Add `:vsplit` / `:vsp` command — vertical split, duplicate current tab or open specified type
- [x] 1.3 Add `:only` / `:on` command — close all other panes, keep current
- [x] 1.4 Add `:swap` / `:sw` command — swap content with adjacent pane

## 2. Tab Commands

- [x] 2.1 Add `:tabnew` / `:tabn` command — open new tab (dashboard default, optional type arg)
- [x] 2.2 Add `:tabclose` / `:tabc` command — close active tab
- [x] 2.3 Add `:tabonly` / `:tabo` command — close all tabs except active
- [x] 2.4 Add `:tabmove` / `:tabm` command — move tab to position (0-indexed, `$` for last, no-arg = shift right)
- [x] 2.5 Add `:tabclose-right` / `:tcr` command — close tabs to the right
- [x] 2.6 Add `:tabreopen` / `:topen` command — reopen last closed tab

## 3. File / Document Commands

- [x] 3.1 Add `:edit` / `:e` command — open command center with pre-filled query for document search
- [x] 3.2 Add `:bdelete` / `:bd` command — close tab by current or by type name
- [x] 3.3 Add `:buffers` / `:ls` command — display open tabs list in command bar dropdown

## 4. Navigation Commands

- [x] 4.1 Add `:jump` / `:j` command — navigate to app section with alias resolution (dash, docs, rev, etc.)
- [x] 4.2 Add `:recent` / `:r` command — show recently viewed documents, open by index
- [x] 4.3 Add `:focus` / `:fo` command — cycle or directionally move focus between panes
- [x] 4.4 Add `:zen` / `:z` command — toggle distraction-free mode (hide chrome)

## 5. Session Commands

- [x] 5.1 Add `:qall` / `:qa` / `:q` command — close all tabs with unsaved-changes confirmation
- [x] 5.2 Add `:wqall` / `:wqa` command — save session state and close all tabs
- [x] 5.3 Add `:reload` / `:rld` command — reload the application
- [x] 5.4 Add `:theme` / `:th` command — toggle or set light/dark theme

## 6. Help & Polish

- [x] 6.1 Update the `?` help overlay to list all new commands grouped by category (Split, Tabs, Files, Navigation, Session)
- [x] 6.2 Add tab type alias resolver utility (docs→documents, dash→dashboard, rev→review, set→settings, anal→analytics, queue→queue, rss→rss)
- [ ] 6.3 Test all commands end-to-end: verify split, tab, file, navigation, and session commands work correctly
