#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-${GITHUB_REPOSITORY:-}}"
LIMIT="${2:-10}"

if [[ -z "$REPO" ]]; then
  echo "Usage: $0 <owner/repo> [limit]" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required." >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required." >&2
  exit 1
fi

echo "# GitHub Actions Failure Triage"
echo
echo "Repository: \`$REPO\`"
echo "Generated: $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
echo
echo "## Latest failed/cancelled runs"

gh run list -R "$REPO" --limit "$LIMIT" \
  --json databaseId,workflowName,displayTitle,headBranch,headSha,status,conclusion,createdAt,url \
  | jq -r '
      map(select(.conclusion=="failure" or .conclusion=="cancelled"))
      | if length == 0 then
          "No failed/cancelled runs found in requested window."
        else
          ("| Run | Workflow | Branch | Conclusion | Created |", "|---|---|---|---|---|"),
          (.[] | "| [#\(.databaseId)](\(.url)) | \(.workflowName) | \(.headBranch) | \(.conclusion) | \(.createdAt) |")
        end
    '

echo
echo "## Failing jobs and steps"

gh run list -R "$REPO" --limit "$LIMIT" --json databaseId,workflowName,conclusion \
  | jq -r '.[] | select(.conclusion=="failure") | [.databaseId,.workflowName] | @tsv' \
  | while IFS=$'\t' read -r run_id workflow_name; do
      echo "### Run #${run_id} (${workflow_name})"
      gh run view "$run_id" -R "$REPO" --json jobs,url \
        | jq -r '
            "Run: " + .url,
            (if ([.jobs[] | select(.conclusion=="failure")] | length) == 0 then
               "No failed jobs reported."
             else
               ("| Job | Failed Step |", "|---|---|"),
               (.jobs[]
                 | select(.conclusion=="failure")
                 | . as $job
                 | [($job.steps[]? | select(.conclusion=="failure") | .name)] as $failedSteps
                 | if ($failedSteps | length) == 0 then
                     "| " + $job.name + " | (step name unavailable; inspect logs) |"
                   else
                     ($failedSteps[] | "| " + $job.name + " | " + . + " |")
                   end)
             end)
          '
      echo
    done
