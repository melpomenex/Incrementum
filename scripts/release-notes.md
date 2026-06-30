### Fixed & Improved
- **Boot-time sync registration** — Fixed a bug where documents present in the local database on app startup were not registered with the file transfer manager. This caused devices to not advertise their files in their presence, making other peers (like mobile devices) get stuck waiting with `"Waiting for device with this file to come online"`.
