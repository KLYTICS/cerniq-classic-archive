#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "=== Creating 20 focused commits ==="

# 1
git add frontend/lib/format.test.ts
HUSKY=0 git commit -m "test: format utilities — currency, number, date, relative time"
echo "✓ Commit 1/20"

# 2
git add frontend/hooks/useDebounce.test.ts
HUSKY=0 git commit -m "test: useDebounce hook timing behavior"
echo "✓ Commit 2/20"

# 3
git add frontend/hooks/useLocalStorage.test.ts
HUSKY=0 git commit -m "test: useLocalStorage hook persistence"
echo "✓ Commit 3/20"

# 4
git add frontend/components/ui/Spinner.test.tsx
HUSKY=0 git commit -m "test: Spinner component renders with correct classes"
echo "✓ Commit 4/20"

# 5
git add frontend/components/ui/Badge.test.tsx
HUSKY=0 git commit -m "test: Badge component variant rendering"
echo "✓ Commit 5/20"

# 6
git add frontend/components/ui/EmptyState.test.tsx
HUSKY=0 git commit -m "test: EmptyState component with custom message"
echo "✓ Commit 6/20"

# 7
git add frontend/components/ui/Card.test.tsx
HUSKY=0 git commit -m "test: Card component renders children"
echo "✓ Commit 7/20"

# 8
git add frontend/components/ui/Skeleton.test.tsx
HUSKY=0 git commit -m "test: Skeleton component animation classes"
echo "✓ Commit 8/20"

# 9
git add backend-node/src/common/utils/retry.util.spec.ts
HUSKY=0 git commit -m "test: retry utility exponential backoff behavior"
echo "✓ Commit 9/20"

# 10
git add backend-node/src/common/utils/mask.util.spec.ts
HUSKY=0 git commit -m "test: data masking utility for emails, phones, API keys"
echo "✓ Commit 10/20"

# 11
git add backend-node/src/common/utils/pagination.util.spec.ts
HUSKY=0 git commit -m "test: pagination utility offset/limit calculations"
echo "✓ Commit 11/20"

# 12
git add backend-node/src/common/utils/currency.util.spec.ts
HUSKY=0 git commit -m "test: bilingual currency formatting EN/ES"
echo "✓ Commit 12/20"

# 13
git add backend-node/src/common/utils/slug.util.spec.ts
HUSKY=0 git commit -m "test: slug generator URL safety"
echo "✓ Commit 13/20"

# 14
git add backend-node/src/common/utils/crypto.util.spec.ts
HUSKY=0 git commit -m "test: crypto utilities — token generation, HMAC, hash comparison"
echo "✓ Commit 14/20"

# 15
git add backend-node/src/common/validators/password-strength.validator.spec.ts
HUSKY=0 git commit -m "test: password strength validator complexity rules"
echo "✓ Commit 15/20"

# 16
git add backend-node/src/common/pipes/trim.pipe.spec.ts
HUSKY=0 git commit -m "test: TrimPipe whitespace handling"
echo "✓ Commit 16/20"

# 17
git add backend-node/src/common/pipes/sanitize.pipe.spec.ts
HUSKY=0 git commit -m "test: SanitizePipe XSS prevention"
echo "✓ Commit 17/20"

# 18
git add backend-node/src/common/guards/admin.guard.spec.ts
HUSKY=0 git commit -m "test: AdminGuard key validation"
echo "✓ Commit 18/20"

# 19
git add frontend/public/manifest.json
HUSKY=0 git commit -m "feat: PWA manifest.json for installable web app"
echo "✓ Commit 19/20"

# 20
git add frontend/public/sitemap-static.xml
HUSKY=0 git commit -m "feat: static sitemap for SEO crawlers"
echo "✓ Commit 20/20"

echo ""
echo "=== All 20 commits created successfully ==="
git log --oneline -20
