## 1. Fix Dashboard Tab Navigation

- [x] 1.1 Remove the early-return guard in `openTab` in `src/components/tabs/DashboardTab.tsx` — delete the `tabs.find()` check and the `if (existing) return` block, letting `addTab` handle existing tab activation
- [x] 1.2 Remove the early-return guard in `openSyncSettings` in `src/components/tabs/DashboardTab.tsx` — same pattern: delete the `tabs.find()` check and the `if (existing) return` block
- [x] 1.3 Verify that clicking dashboard quick-action buttons (Settings, Review, etc.) navigates to the target tab whether it's already open or not
