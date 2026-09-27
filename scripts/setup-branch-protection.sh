#!/usr/bin/env bash
# Protect the main branch via the GitHub API (requires `gh` authenticated as a repo admin).
# Usage:  ./scripts/setup-branch-protection.sh <owner/repo>
set -euo pipefail
REPO="${1:?usage: setup-branch-protection.sh <owner/repo>}"

gh api -X PUT "repos/$REPO/branches/main/protection" \
  -H "Accept: application/vnd.github+json" \
  -f "required_status_checks[strict]=true" \
  -f "required_status_checks[checks][][context]=quality" \
  -f "required_status_checks[checks][][context]=test" \
  -F "enforce_admins=true" \
  -F "required_pull_request_reviews[required_approving_review_count]=1" \
  -F "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  -F "restrictions=" \
  -F "required_linear_history=true" \
  -F "allow_force_pushes=false" \
  -F "allow_deletions=false"

echo "✓ main is protected: PR + 1 review, CI 'quality' & 'test' must pass, no force-push/delete, linear history."
