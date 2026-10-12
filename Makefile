.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'

# Verification skill (skills/verify-visualsubnetcalc): builds dist/, serves it on 127.0.0.1:8280, drives headless Chrome. Targets come from verify-kit: verify, verify-dry-run, verify-test.
VERIFY_SKILL := skills/verify-visualsubnetcalc
include $(VERIFY_SKILL)/verify.mk
