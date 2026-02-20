#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Track GitHub release binary download counts.

Required environment variables:
  OWNER   GitHub owner/org (e.g. melpomenex)
  REPO    GitHub repo name (e.g. incrementum-tauri)

Select one mode:
  TAG=<tag>                    Query a specific release tag.
  --all                        Query all releases (paginated).
  --graph                      Print a per-tag download graph (all releases).
  (no TAG, no --all)           Query latest release.

Examples:
  OWNER=melpomenex REPO=incrementum-tauri TAG=v1.2.3 ./scripts/release-downloads.sh
  OWNER=melpomenex REPO=incrementum-tauri ./scripts/release-downloads.sh --all
  OWNER=melpomenex REPO=incrementum-tauri ./scripts/release-downloads.sh --graph
EOF
}

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) is required." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required." >&2
  exit 1
fi

OWNER="${OWNER:-melpomenex}"
REPO="${REPO:-}"
TAG="${TAG:-}"
ALL=0
GRAPH=0

while (($# > 0)); do
  case "$1" in
    --all)
      ALL=1
      shift
      ;;
    --graph)
      GRAPH=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$OWNER" || -z "$REPO" ]]; then
  echo "Error: OWNER and REPO must be set." >&2
  usage >&2
  exit 1
fi

echo "Repository: $OWNER/$REPO"

if [[ "$GRAPH" -eq 1 ]]; then
  echo "Mode: graph (all releases)"
  rows="$(
    gh api --paginate "repos/$OWNER/$REPO/releases?per_page=100" \
      --jq '.[] | [.tag_name, .published_at, ([.assets[]?.download_count] | add // 0)] | @tsv'
  )"

  if [[ -z "$rows" ]]; then
    echo "No releases found."
    exit 0
  fi

  echo
  echo "Downloads per release tag:"
  printf '%s\n' "$rows" | sort -k2 | awk -F'\t' '
    BEGIN { max=0; width=40; }
    {
      tag[NR]=$1;
      ts[NR]=$2;
      val[NR]=$3+0;
      if (val[NR] > max) max=val[NR];
      n=NR;
    }
    END {
      if (n == 0) {
        print "No releases found.";
        exit 0;
      }
      if (max == 0) max = 1;
      for (i=1; i<=n; i++) {
        bar_len=int((val[i]/max)*width);
        if (val[i] > 0 && bar_len == 0) bar_len=1;
        bar="";
        for (j=0; j<bar_len; j++) bar=bar "#";
        printf "%-18s %8d | %s\n", tag[i], val[i], bar;
      }
      print "";
      printf "Total across tags: %d\n", sum_array(val, n);
      printf "Max single tag: %d\n", max;
    }
    function sum_array(a, count,   i, s) {
      s=0;
      for (i=1; i<=count; i++) s+=a[i];
      return s;
    }
  '
  exit 0
fi

if [[ "$ALL" -eq 1 ]]; then
  echo "Mode: all releases"
  rows="$(
    gh api --paginate "repos/$OWNER/$REPO/releases?per_page=100" \
      --jq '.[] | .tag_name as $tag | .assets[]? | [$tag, .name, (.download_count|tostring), .browser_download_url] | @tsv'
  )"

  if [[ -z "$rows" ]]; then
    echo "No release assets found."
    exit 0
  fi

  printf '\n%-18s %-42s %10s  %s\n' "TAG" "ASSET" "DOWNLOADS" "URL"
  printf '%s\n' "---------------------------------------------------------------------------------------------------------------"
  while IFS=$'\t' read -r tag name count url; do
    printf '%-18s %-42s %10s  %s\n' "$tag" "$name" "$count" "$url"
  done <<< "$rows"

  echo
  echo "Totals by tag:"
  while IFS=$'\t' read -r tag total; do
    printf '  %-18s %10s\n' "$tag" "$total"
  done < <(printf '%s\n' "$rows" | awk -F'\t' '{sum[$1]+=$3} END {for (t in sum) printf "%s\t%d\n", t, sum[t]}' | sort)

  grand_total="$(printf '%s\n' "$rows" | awk -F'\t' '{s+=$3} END {print s+0}')"
  echo "Grand total: $grand_total"
  exit 0
fi

if [[ -n "$TAG" ]]; then
  echo "Mode: tag '$TAG'"
  rows="$(
    gh api "repos/$OWNER/$REPO/releases/tags/$TAG" \
      --jq '.assets[]? | [.name, (.download_count|tostring), .browser_download_url] | @tsv'
  )"
else
  echo "Mode: latest release"
  TAG="$(gh api "repos/$OWNER/$REPO/releases/latest" --jq '.tag_name')"
  rows="$(
    gh api "repos/$OWNER/$REPO/releases/latest" \
      --jq '.assets[]? | [.name, (.download_count|tostring), .browser_download_url] | @tsv'
  )"
  echo "Latest tag: $TAG"
fi

if [[ -z "$rows" ]]; then
  echo "No release assets found."
  exit 0
fi

printf '\n%-42s %10s  %s\n' "ASSET" "DOWNLOADS" "URL"
printf '%s\n' "---------------------------------------------------------------------------------------------------------------"
while IFS=$'\t' read -r name count url; do
  printf '%-42s %10s  %s\n' "$name" "$count" "$url"
done <<< "$rows"

total="$(printf '%s\n' "$rows" | awk -F'\t' '{s+=$2} END {print s+0}')"
echo
echo "Total downloads for ${TAG:-latest}: $total"
