## 1. Workflow Scaffolding

- [x] 1.1 Create `.github/workflows/mobile-build.yml` with triggers (`pull_request`, `workflow_dispatch`) and job-level permissions.
- [x] 1.2 Add shared workflow setup steps for checkout, Node/npm install, and Tauri CLI prerequisites.
- [x] 1.3 Define concurrency/caching strategy for mobile jobs to reduce redundant runs.

## 2. Android CI Build Job

- [x] 2.1 Add Android job on `ubuntu-latest` that installs JDK/Android SDK and required Tauri mobile dependencies.
- [x] 2.2 Implement Android build command(s) for the Tauri app and fail the job on build errors.
- [x] 2.3 Upload Android outputs and build logs as workflow artifacts.

## 3. iOS CI Validation Job

- [x] 3.1 Add iOS job on `macos-latest` with Xcode/Tauri mobile setup.
- [x] 3.2 Implement iOS build validation steps with explicit handling for missing signing/provisioning prerequisites.
- [x] 3.3 Upload available iOS outputs/logs as artifacts, including failure diagnostics when packaging is incomplete.

## 4. Validation and Documentation

- [x] 4.1 Add clear step/job names and messages so skipped/failure reasons are obvious in GitHub Actions UI.
- [ ] 4.2 Run a dry run/manual dispatch to validate artifact upload paths and job outcomes for both platforms.
- [x] 4.3 Document required secrets/prerequisites and expected artifact outputs in repository docs or workflow comments.
