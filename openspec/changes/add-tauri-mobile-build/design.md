## Context

Current workflows build desktop artifacts but do not validate Tauri mobile targets in CI. Mobile builds require platform-specific runners and setup steps (Android SDK/JDK on Linux; Xcode on macOS for iOS), and can fail for reasons not covered by desktop jobs.

## Goals / Non-Goals

**Goals:**
- Add a repeatable GitHub Actions workflow path for Tauri mobile builds.
- Ensure Android build output is generated and uploaded as CI artifacts.
- Ensure iOS build path runs on macOS and provides clear status and logs.
- Keep the workflow runnable by pull requests and manual dispatch.

**Non-Goals:**
- Publishing mobile apps to app stores.
- Replacing existing desktop workflows.
- Defining signing/distribution automation beyond required CI validation.

## Decisions

- Use a dedicated mobile workflow file (`.github/workflows/mobile-build.yml`) to isolate toolchain complexity from desktop pipelines.
Rationale: keeps desktop CI stable and makes mobile troubleshooting straightforward.
Alternative considered: extending existing build workflow matrix; rejected due to high coupling and reduced readability.

- Split jobs by platform (Android on `ubuntu-latest`, iOS on `macos-latest`) with shared conventions for checkout, dependency install, and artifact upload.
Rationale: each platform has different prerequisites and permissions.
Alternative considered: single matrix job; rejected because setup, caching, and failure diagnosis are less clear.

- Require explicit handling for credentials/secrets needed by mobile signing or provisioning, and skip/signpost unsupported paths when secrets are unavailable.
Rationale: PRs from forks commonly lack secrets; workflow should fail clearly or skip intentionally based on policy.
Alternative considered: hard fail on all missing secrets; rejected because it blocks contributor PR validation unnecessarily.

- Upload build outputs and logs as artifacts for both successful and failed jobs when available.
Rationale: developers need downloadable evidence for debugging CI-only failures.
Alternative considered: logs only in console; rejected due to reduced diagnosability.

## Risks / Trade-offs

- [Runner variability and long setup times] -> Use caching where safe and keep setup steps explicit and minimal.
- [iOS signing/provisioning complexity] -> Define minimum validation path and document secret requirements clearly.
- [Higher CI cost and duration] -> Limit triggers to PR-relevant branches and manual dispatch as needed.
- [Toolchain drift between local and CI] -> Pin major action/tool versions and validate versions in logs.

## Migration Plan

1. Add the mobile workflow alongside existing workflows without changing release automation.
2. Validate Android build path first and confirm artifact output.
3. Enable iOS build path with documented secret requirements and runner assumptions.
4. Roll out PR enforcement once baseline stability is confirmed.
5. Rollback by disabling or reverting the new workflow file if instability is detected.

## Open Questions

- Should iOS jobs be required for all PRs or only for protected branches/manual runs?
- Which mobile artifacts are mandatory for pass/fail validation (APK/AAB, app bundle, logs only)?
- Should forked PRs skip secret-dependent steps or run an unsigned/simulator-only variant?
