PLAYBOOK_DIR := playbooks

.PHONY: help
help:
	@echo "Available targets:"
	@echo "  all                    - Run all playbooks sequentially"
	@echo "  setup-server           - Initial server setup"
	@echo "  setup-docker           - Setup Docker"
	@echo "  setup-docker-swarm     - Setup Docker Swarm"
	@echo "  deploy-traefik         - Deploy Traefik"
	@echo "  deploy-portainer       - Deploy Portainer"
	@echo "  deploy-hashicorp-vault - Deploy HashiCorp Vault"
	@echo "  deploy-lgtm            - Deploy LGTM stack"
	@echo "  graph                  - Show inventory graph"

.PHONY: lint
lint:
	yamllint .
	ansible-lint

.PHONY: syntax
syntax:
	ansible-playbook $(PLAYBOOK_DIR)/00-all.yml --syntax-check

.PHONY: check
check:
	ansible-playbook $(PLAYBOOK_DIR)/00-all.yml --check --diff

.PHONY: graph
graph:
	ansible-inventory --graph

.PHONY: all
all:
	ansible-playbook $(PLAYBOOK_DIR)/00-all.yml --ask-become-pass

.PHONY: setup-server
setup-server:
	ansible-playbook $(PLAYBOOK_DIR)/01-setup-server.yml --ask-become-pass

.PHONY: setup-docker
setup-docker:
	ansible-playbook $(PLAYBOOK_DIR)/02-setup-docker.yml

.PHONY: setup-docker-swarm
setup-docker-swarm:
	ansible-playbook $(PLAYBOOK_DIR)/03-setup-docker-swarm.yml

.PHONY: deploy-hashicorp-vault
deploy-hashicorp-vault:
	ansible-playbook $(PLAYBOOK_DIR)/04-deploy-hashicorp-vault.yml

.PHONY: deploy-portainer
deploy-portainer:
	ansible-playbook $(PLAYBOOK_DIR)/05-deploy-portainer.yml

.PHONY: deploy-traefik
deploy-traefik:
	ansible-playbook $(PLAYBOOK_DIR)/06-deploy-traefik.yml

.PHONY: deploy-postgres
deploy-postgres:
	ansible-playbook $(PLAYBOOK_DIR)/07-deploy-postgres.yml

.PHONY: deploy-keycloak
deploy-keycloak:
	ansible-playbook $(PLAYBOOK_DIR)/08-deploy-keycloak.yml

.PHONY: deploy-lgtm
deploy-lgtm:
	ansible-playbook $(PLAYBOOK_DIR)/09-deploy-lgtm.yml

.PHONY: deploy-gitlab
deploy-gitlab:
	ansible-playbook $(PLAYBOOK_DIR)/10-deploy-gitlab.yml

.PHONY: deploy-rustfs
deploy-rustfs:
	ansible-playbook $(PLAYBOOK_DIR)/11-deploy-rustfs.yml

.PHONY: deploy-nexus
deploy-nexus:
	ansible-playbook $(PLAYBOOK_DIR)/12-deploy-nexus.yml

.PHONY: deploy-postgres-backup
deploy-postgres-backup:
	ansible-playbook $(PLAYBOOK_DIR)/13-deploy-postgres-backup.yml
