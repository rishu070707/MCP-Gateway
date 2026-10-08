.PHONY: help install test test-unit test-integration test-e2e lint build run-gateway run-woo run-inventory run-analytics run-dashboard helm-lint helm-template docker-build clean

help:
	@echo "Urumi AI — Team MCP Gateway"
	@echo "==========================="
	@echo "make install          - Install dependencies across all components"
	@echo "make test             - Run all unit, integration, and e2e tests"
	@echo "make test-unit        - Run backend unit tests"
	@echo "make test-integration - Run integration tests"
	@echo "make test-e2e         - Run end-to-end verification tests"
	@echo "make build            - Build React dashboard and all services"
	@echo "make run-gateway      - Start Gateway server locally"
	@echo "make run-woo          - Start WooCommerce MCP service locally"
	@echo "make run-inventory    - Start Inventory MCP service locally"
	@echo "make run-analytics    - Start Analytics MCP service locally"
	@echo "make run-dashboard    - Start Dashboard Vite dev server"
	@echo "make helm-lint        - Lint the Helm chart"
	@echo "make helm-template    - Render Helm templates"
	@echo "make docker-build     - Build all Docker images"

install:
	pip install -r apps/gateway/requirements.txt
	pip install -r services/woo-mcp/requirements.txt
	pip install -r services/inventory-mcp/requirements.txt
	pip install -r services/analytics-mcp/requirements.txt
	cd apps/dashboard && npm install

test: test-unit test-integration test-e2e

test-unit:
	python -m pytest tests/unit -v

test-integration:
	python -m pytest tests/integration -v

test-e2e:
	python -m pytest tests/e2e -v

build:
	cd apps/dashboard && npm run build

docker-build:
	docker build -t urumi/gateway:latest apps/gateway
	docker build -t urumi/dashboard:latest apps/dashboard
	docker build -t urumi/woo-mcp:latest services/woo-mcp
	docker build -t urumi/inventory-mcp:latest services/inventory-mcp
	docker build -t urumi/analytics-mcp:latest services/analytics-mcp

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf apps/dashboard/dist
