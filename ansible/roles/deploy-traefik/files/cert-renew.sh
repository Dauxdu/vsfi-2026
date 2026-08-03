#!/bin/sh
# Автоматическая ротация TLS-сертификата через HashiCorp Vault PKI.
set -eu

# ── Настройки (передаются через ENV) ──────────────────────────
VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"
VAULT_TOKEN_FILE="${VAULT_TOKEN_FILE}"
PKI_PATH="${PKI_PATH}"
PKI_ROLE="${PKI_ROLE}"
COMMON_NAME="${COMMON_NAME}"
ALT_NAMES="${ALT_NAMES}"
CERT_TTL="${CERT_TTL:-720h}"
CERT_DIR="${CERT_DIR:-/certs}"
CHECK_INTERVAL="${CHECK_INTERVAL:-3600}"
RENEW_THRESHOLD="${RENEW_THRESHOLD:-86400}"

CERT_FILE="${CERT_DIR}/${COMMON_NAME}.crt"
KEY_FILE="${CERT_DIR}/${COMMON_NAME}.key"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

# ── Чтение токена ─────────────────────────────────────────────
get_token() {
    if [ -f "$VAULT_TOKEN_FILE" ]; then
        TOKEN=$(jq -r '.root_token' "$VAULT_TOKEN_FILE" 2>/dev/null)
    fi
    if [ -z "${TOKEN:-}" ] || [ "$TOKEN" = "null" ]; then
        log "ERROR: cannot read Vault token from ${VAULT_TOKEN_FILE}"
        return 1
    fi
}

# ── Проверка: нужен ли новый сертификат? ──────────────────────
needs_renewal() {
    [ ! -f "$CERT_FILE" ] && return 0
    [ ! -f "$KEY_FILE" ]  && return 0
    
    if ! openssl x509 -in "$CERT_FILE" -checkend "$RENEW_THRESHOLD" -noout 2>/dev/null; then
        return 0
    fi
    
    cert_pub=$(openssl x509 -noout -pubkey -in "$CERT_FILE" 2>/dev/null || true)
    key_pub=$(openssl pkey -pubout -in "$KEY_FILE" 2>/dev/null || true)
    [ "$cert_pub" != "$key_pub" ] && return 0
    
    return 1
}

# ── Выпуск нового сертификата ─────────────────────────────────
issue_cert() {
    log "Issuing new certificate: CN=${COMMON_NAME}, TTL=${CERT_TTL}"
    
    RESPONSE=$(wget -qO- \
        --header="X-Vault-Token: ${TOKEN}" \
        --header="Content-Type: application/json" \
        --post-data="{
            \"common_name\": \"${COMMON_NAME}\",
            \"alt_names\": \"${ALT_NAMES}\",
            \"ttl\": \"${CERT_TTL}\",
            \"format\": \"pem\",
            \"private_key_format\": \"pem\"
        }" \
        "${VAULT_ADDR}/v1/${PKI_PATH}/issue/${PKI_ROLE}") || {
        log "ERROR: Vault PKI issue request failed"
        return 1
    }
    
    NEW_CERT=$(echo "$RESPONSE" | jq -r '.data.certificate')
    NEW_KEY=$(echo "$RESPONSE"  | jq -r '.data.private_key')
    CA_CHAIN=$(echo "$RESPONSE" | jq -r '.data.ca_chain | join("\n")')
    
    if [ -z "$NEW_CERT" ] || [ "$NEW_CERT" = "null" ] || \
    [ -z "$NEW_KEY" ]  || [ "$NEW_KEY" = "null" ]; then
        log "ERROR: empty certificate or key in Vault response"
        return 1
    fi
    
    # Атомарная запись через временные файлы
    TMP_DIR=$(mktemp -d)
    printf '%s\n%s\n' "$NEW_CERT" "$CA_CHAIN" > "${TMP_DIR}/cert.pem"
    printf '%s\n' "$NEW_KEY"                  > "${TMP_DIR}/key.pem"
    
    # Валидация: ключ совпадает с сертификатом
    c_pub=$(openssl x509 -noout -pubkey -in "${TMP_DIR}/cert.pem" 2>/dev/null)
    k_pub=$(openssl pkey  -pubout       -in "${TMP_DIR}/key.pem"  2>/dev/null)
    if [ "$c_pub" != "$k_pub" ]; then
        log "ERROR: key/cert mismatch, aborting"
        rm -rf "$TMP_DIR"
        return 1
    fi
    
    mv "${TMP_DIR}/cert.pem" "$CERT_FILE"
    mv "${TMP_DIR}/key.pem"  "$KEY_FILE"
    chmod 644 "$CERT_FILE"
    chmod 600 "$KEY_FILE"
    rm -rf "$TMP_DIR"
    
    EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d= -f2)
    log "OK: certificate renewed, expires ${EXPIRY}"
}

# ── Основной цикл ─────────────────────────────────────────────
log "cert-renewer started (interval=${CHECK_INTERVAL}s, threshold=${RENEW_THRESHOLD}s)"

while true; do
    get_token || { sleep 30; continue; }
    
    if needs_renewal; then
        log "Certificate missing or expiring soon — renewing"
        issue_cert || log "WARN: renewal failed, will retry in ${CHECK_INTERVAL}s"
    else
        EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
        log "Certificate valid (expires ${EXPIRY}), next check in ${CHECK_INTERVAL}s"
    fi
    
    sleep "$CHECK_INTERVAL"
done