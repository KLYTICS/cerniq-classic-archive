#!/bin/bash
# Script to commit all 20 enterprise improvements individually
set -e
cd /Users/money/Desktop/Cerniq

# 1. robots.ts
git add frontend/app/robots.ts
HUSKY=0 git commit -m "feat: robots.ts metadata API for dynamic robots.txt"

# 2. ALM aria-labels
git add frontend/app/alm/page.tsx
HUSKY=0 git commit -m "a11y: add aria-labels to ALM dashboard icon buttons"

# 3. UUID validator
git add backend-node/src/common/validators/is-uuid.validator.ts
HUSKY=0 git commit -m "feat: custom UUID validation pipe for type-safe route params"

# 4. noopener noreferrer on pricing
git add frontend/app/pricing/page.tsx
HUSKY=0 git commit -m "security: add noopener noreferrer to external links on pricing page"

# 5. Constants module
git add backend-node/src/common/constants/index.ts
HUSKY=0 git commit -m "feat: centralized constants module for shared config values"

# 6. Public decorator
git add backend-node/src/common/decorators/public.decorator.ts
HUSKY=0 git commit -m "feat: @Public() decorator to skip auth on open endpoints"

# 7. Path traversal sanitizer
git add backend-node/src/common/middleware/path-traversal.middleware.ts
HUSKY=0 git commit -m "security: path traversal sanitization middleware"

# 8. Skip-to-main improvements
git add frontend/components/SkipToContent.tsx
HUSKY=0 git commit -m "a11y: enhanced skip-to-main-content link component"

# 9. Response time histogram interceptor
git add backend-node/src/common/interceptors/response-time.interceptor.ts
HUSKY=0 git commit -m "observability: response time histogram interceptor"

# 10. Password complexity validator
git add backend-node/src/common/validators/password-complexity.validator.ts
HUSKY=0 git commit -m "security: password complexity validation pipe"

# 11. Preconnect hints
git add frontend/components/PreconnectHints.tsx
HUSKY=0 git commit -m "perf: preconnect hints component for API domain"

# 12. CORS preflight caching
git add backend-node/src/common/middleware/cors-preflight-cache.middleware.ts
HUSKY=0 git commit -m "perf: CORS preflight response caching middleware"

# 13. manifest.json improvements
git add frontend/public/manifest.json
HUSKY=0 git commit -m "pwa: enhanced manifest.json with screenshots and shortcuts"

# 14. Request deduplication middleware
git add backend-node/src/common/middleware/request-dedup.middleware.ts
HUSKY=0 git commit -m "perf: request deduplication middleware for identical in-flight requests"

# 15. Color contrast utility
git add frontend/lib/color-contrast.ts
HUSKY=0 git commit -m "a11y: WCAG color contrast ratio utility functions"

# 16. API changelog endpoint
git add backend-node/src/common/controllers/changelog.controller.ts
HUSKY=0 git commit -m "feat: API changelog endpoint for version history"

# 17. Graceful queue drain
git add backend-node/src/common/services/graceful-shutdown.service.ts
HUSKY=0 git commit -m "ops: graceful queue drain on shutdown service"

# 18. Security headers middleware
git add backend-node/src/common/middleware/security-headers.middleware.ts
HUSKY=0 git commit -m "security: strict security headers middleware (CSP, HSTS, X-Frame)"

# 19. Frontend error boundary
git add frontend/components/ErrorBoundary.tsx
HUSKY=0 git commit -m "resilience: reusable error boundary component with retry"

# 20. Backend health check enrichment
git add backend-node/src/common/controllers/health.controller.ts
HUSKY=0 git commit -m "ops: enriched health check endpoint with dependency status"

echo ""
echo "=== All 20 commits complete ==="
echo ""
git log --oneline -25
