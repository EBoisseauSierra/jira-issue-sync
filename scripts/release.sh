#!/usr/bin/env bash
set -euo pipefail

# Usage: npm run release -- v1.2.3

TAG="${1:-}"

if [ -z "$TAG" ]; then
  echo "Usage: npm run release -- v<major>.<minor>.<patch>"
  exit 1
fi

if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: tag must match vX.Y.Z (got: $TAG)"
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree is dirty. Commit or stash changes first."
  exit 1
fi

echo "Building dist..."
npm run build

if [ -n "$(git diff --name-only dist/)" ]; then
  echo "Committing updated dist/..."
  git add dist/
  git commit -m "chore(release): update dist bundle for $TAG"
fi

echo "Tagging $TAG..."
git tag "$TAG"

echo "Pushing main + tag..."
git push origin main
git push origin "refs/tags/$TAG"

echo "Done. The release workflow will create the GitHub Release."
