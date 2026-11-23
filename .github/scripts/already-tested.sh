#!/usr/bin/env bash
# Copyright (c) 2025-2026 Velimir Majstorov
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Decides whether the Tests workflow has to run its gates, by content: a gate
# is skipped only when a commit with the same relevant files already passed
# this workflow. Push: the candidates are the parents of the pushed commit
# (for a merge, the previous master and the PR head). Pull request: the
# candidate is the previous head of the PR. Anything else always runs.
#
# A successful run means every gate in it either passed or was skipped for an
# earlier pass of the same content, so a chain of skips still rests on a run
# that tested that exact code.
#
# Writes quality=true|false and test=true|false to $GITHUB_OUTPUT.

set -uo pipefail

# Files the gates can see. Prettier checks every known file type (Markdown,
# YAML, JSON too), so Quality Gates only ignore the native projects and the
# generated graph. Jest does not read docs or CI files.
quality_hash() {
  git ls-tree -r "$1" | awk -F'\t' '$2 !~ /^(android|ios|graphify-out)\//' |
    sha256sum | cut -d' ' -f1
}
test_hash() {
  git ls-tree -r "$1" |
    awk -F'\t' '$2 !~ /^(android|ios|graphify-out|\.github)\// && $2 !~ /\.md$/' |
    sha256sum | cut -d' ' -f1
}

# True when a Tests run of that commit succeeded. Any API error counts as no.
passed() {
  local n
  n=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow test.yml \
    --commit "$1" --status success --limit 1 --json databaseId --jq 'length' 2>/dev/null) || return 1
  [ "${n:-0}" -gt 0 ]
}

quality=true
test=true

case "${EVENT:-}" in
  push)
    target=HEAD
    candidates=$(git rev-list --parents -n 1 HEAD | cut -d' ' -f2-)
    ;;
  pull_request)
    target=${PR_HEAD:-}
    candidates=${BEFORE:-}
    ;;
  *)
    target=
    candidates=
    ;;
esac

if [ -n "$target" ] && git cat-file -e "$target^{commit}" 2>/dev/null; then
  target_quality=$(quality_hash "$target")
  target_test=$(test_hash "$target")
  for c in $candidates; do
    git cat-file -e "$c^{commit}" 2>/dev/null || continue
    if ! passed "$c"; then
      echo "Candidate $c has no successful Tests run."
      continue
    fi
    if [ "$(quality_hash "$c")" = "$target_quality" ]; then
      echo "Quality Gates: same content as $c, which passed."
      quality=false
    fi
    if [ "$(test_hash "$c")" = "$target_test" ]; then
      echo "Test Suite: same content as $c, which passed."
      test=false
    fi
  done
fi

echo "quality=$quality"
echo "test=$test"
{
  echo "quality=$quality"
  echo "test=$test"
} >> "${GITHUB_OUTPUT:-/dev/null}"
