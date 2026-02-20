.PHONY: help dev build test clean docker-up docker-down migrate db-reset install

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install all dependencies
	@echo "Installing backend dependencies..."
	cd backend && cargo build
	@echo "Installing frontend dependencies..."
	cd frontend && bun install

dev: ## Start development environment
	docker-compose up -d postgres redis
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@echo "Starting backend and frontend..."
	$(MAKE) -j2 dev-backend dev-frontend

dev-backend: ## Start backend in development mode
	cd backend && cargo watch -x run

dev-frontend: ## Start frontend in development mode
	cd frontend && bun run dev

build: ## Build all services for production
	cd backend && cargo build --release
	cd frontend && bun run build

test: ## Run all tests
	cd backend && cargo test
	cd frontend && bun test

test-integration: ## Run integration tests
	cd backend && cargo test --test '*' -- --test-threads=1

docker-up: ## Start all services with Docker Compose
	docker-compose up -d

docker-down: ## Stop all Docker services
	docker-compose down

docker-build: ## Build Docker images
	docker-compose build

docker-logs: ## View Docker logs
	docker-compose logs -f

migrate: ## Run database migrations
	cd backend && sqlx migrate run

migrate-new: ## Create a new migration (usage: make migrate-new NAME=migration_name)
	cd backend && sqlx migrate add $(NAME)

db-reset: ## Reset database (WARNING: destroys all data)
	docker-compose down -v
	docker-compose up -d postgres
	@sleep 3
	$(MAKE) migrate

db-shell: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U capexcycle -d capexcycle

redis-shell: ## Open Redis CLI
	docker-compose exec redis redis-cli

clean: ## Clean build artifacts
	cd backend && cargo clean
	cd frontend && rm -rf .next node_modules
	docker-compose down -v

format: ## Format code
	cd backend && cargo fmt
	cd frontend && bun run format

lint: ## Lint code
	cd backend && cargo clippy -- -D warnings
	cd frontend && bun run lint

check: format lint test ## Run all checks (format, lint, test)

deploy-staging: ## Deploy to staging environment
	@echo "Deploying to staging..."
	# Add your deployment commands here

deploy-prod: ## Deploy to production environment
	@echo "Deploying to production..."
	# Add your deployment commands here

.DEFAULT_GOAL := help
