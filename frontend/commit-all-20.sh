#!/usr/bin/env bash
# Run from the repo root: cd /Users/money/Desktop/Cerniq && bash frontend/commit-all-20.sh
set -e

cd "$(dirname "$0")/.."

export HUSKY=0

echo "=== Commit 1/20: lib/constants.ts ==="
git add frontend/lib/constants.ts
git commit -m "feat: centralized frontend constants"

echo "=== Commit 2/20: hooks/useLocalStorage.ts ==="
git add frontend/hooks/useLocalStorage.ts
git commit -m "feat: useLocalStorage hook with type safety"

echo "=== Commit 3/20: hooks/useDebounce.ts ==="
git add frontend/hooks/useDebounce.ts
git commit -m "feat: useDebounce hook for search optimization"

echo "=== Commit 4/20: hooks/useMediaQuery.ts ==="
git add frontend/hooks/useMediaQuery.ts
git commit -m "feat: useMediaQuery hook for responsive layouts"

echo "=== Commit 5/20: hooks/useClickOutside.ts ==="
git add frontend/hooks/useClickOutside.ts
git commit -m "feat: useClickOutside hook for modal dismiss"

echo "=== Commit 6/20: hooks/useKeyPress.ts ==="
git add frontend/hooks/useKeyPress.ts
git commit -m "feat: useKeyPress hook for keyboard shortcuts"

echo "=== Commit 7/20: hooks/useCopyToClipboard.ts ==="
git add frontend/hooks/useCopyToClipboard.ts
git commit -m "feat: useCopyToClipboard hook with toast feedback"

echo "=== Commit 8/20: lib/format.ts ==="
git add frontend/lib/format.ts
git commit -m "feat: formatting utilities — currency, number, date, relative time"

echo "=== Commit 9/20: lib/validation.ts ==="
git add frontend/lib/validation.ts
git commit -m "feat: client validation utilities — email, phone, uuid"

echo "=== Commit 10/20: components/ui/Spinner.tsx ==="
git add frontend/components/ui/Spinner.tsx
git commit -m "feat: reusable Spinner component"

echo "=== Commit 11/20: components/ui/Badge.tsx ==="
git add frontend/components/ui/Badge.tsx
git commit -m "feat: Badge component for status indicators"

echo "=== Commit 12/20: components/ui/EmptyState.tsx ==="
git add frontend/components/ui/EmptyState.tsx
git commit -m "feat: EmptyState component for empty lists/results"

echo "=== Commit 13/20: components/ui/Tooltip.tsx ==="
git add frontend/components/ui/Tooltip.tsx
git commit -m "feat: Tooltip component for contextual help"

echo "=== Commit 14/20: components/ui/ProgressBar.tsx ==="
git add frontend/components/ui/ProgressBar.tsx
git commit -m "feat: ProgressBar component for loading/upload progress"

echo "=== Commit 15/20: components/ui/Avatar.tsx ==="
git add frontend/components/ui/Avatar.tsx
git commit -m "feat: Avatar component with initials fallback"

echo "=== Commit 16/20: components/ui/Modal.tsx ==="
git add frontend/components/ui/Modal.tsx
git commit -m "feat: accessible Modal component with focus trap"

echo "=== Commit 17/20: components/ui/Toast.tsx ==="
git add frontend/components/ui/Toast.tsx
git commit -m "feat: Toast notification component"

echo "=== Commit 18/20: components/ui/Skeleton.tsx ==="
git add frontend/components/ui/Skeleton.tsx
git commit -m "feat: Skeleton loader component for content placeholders"

echo "=== Commit 19/20: components/ui/Tabs.tsx ==="
git add frontend/components/ui/Tabs.tsx
git commit -m "feat: accessible Tabs component with keyboard navigation"

echo "=== Commit 20/20: components/ui/Card.tsx ==="
git add frontend/components/ui/Card.tsx
git commit -m "feat: Card component for consistent content containers"

echo ""
echo "=== All 20 commits complete! ==="
echo ""
git log --oneline -25
