.PHONY: dev prod build test deploy-backend deploy-frontend migrate health lint

# ─── Development ───────────────────────────────
dev:
	docker compose up -d postgres redis
	@echo "Waiting for services..."
	@sleep 3
	cd backend-node && npm run start:dev &
	cd frontend && npm run dev

dev-docker:
	docker compose up --build

# ─── Production ────────────────────────────────
prod:
	docker compose -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml down

# ─── Build ─────────────────────────────────────
build-backend:
	cd backend-node && npm ci --legacy-peer-deps && npm run build

build-frontend:
	cd frontend && npm ci && npm run build

build: build-backend build-frontend

# ─── Database ──────────────────────────────────
migrate:
	cd backend-node && npx prisma migrate deploy

migrate-dev:
	cd backend-node && npx prisma migrate dev

db-studio:
	cd backend-node && npx prisma studio

db-seed:
	cd backend-node && npx prisma db seed

# ─── Test ──────────────────────────────────────
test:
	cd backend-node && npm test

test-e2e:
	cd frontend && npm run test:e2e

test-cov:
	cd backend-node && npm run test:cov

# ─── Deploy ────────────────────────────────────
deploy-backend:
	cd backend-node && railway up

deploy-frontend:
	cd frontend && vercel --prod

deploy: deploy-backend deploy-frontend

# ─── Health ────────────────────────────────────
health:
	@curl -sf http://localhost:3000/health | python3 -m json.tool || echo "Backend not running"

health-prod:
	@curl -sf https://api.cerniq.io/health | python3 -m json.tool || echo "Backend not reachable"

# ─── Lint ──────────────────────────────────────
lint:
	cd backend-node && npm run lint
	cd frontend && npm run lint

# ─── Clean ─────────────────────────────────────
clean:
	cd backend-node && rm -rf dist node_modules
	cd frontend && rm -rf .next node_modules

# ─── Logs ──────────────────────────────────────
logs:
	docker compose logs -f --tail=100

logs-prod:
	docker compose -f docker-compose.prod.yml logs -f --tail=100
