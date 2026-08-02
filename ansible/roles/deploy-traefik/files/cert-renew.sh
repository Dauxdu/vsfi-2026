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
CHECK_INTERVAL="${CHECK_INTERVAL:-3600}"    # проверка каждые 1 час
RENEW_THRESHOLD="${RENEW_THRESHOLD:-86400}"    # обновить за 24 ч до истечения

CERT_FILE="${CERT_DIR}/${COMMON_NAME}.crt"
KEY_FILE="${CERT_DIR}/${COMMON_NAME}.key"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

# ── Чтение токена ─────────────────────────────────────────────
get_token() {
    if [ -f "$VAULT_TOKEN_FILE" ]; then
        # vault_keys.json: {"root_token":"...","keys_base64":[...]}
        TOKEN=$(cat "$VAULT_TOKEN_FILE" | sed -n 's/.*"root_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
    fi
    if [ -z "${TOKEN:-}" ]; then
        log "ERROR: cannot read Vault token from ${VAULT_TOKEN_FILE}"
        return 1
    fi
}

# ── Проверка: нужен ли новый сертификат? ──────────────────────
needs_renewal() {
    # Файла нет → нужен
    [ ! -f "$CERT_FILE" ] && return 0
    [ ! -f "$KEY_FILE" ]  && return 0
    
    # Сертификат истекает раньше порога → нужен
    if ! openssl x509 -in "$CERT_FILE" -checkend "$RENEW_THRESHOLD" -noout 2>/dev/null; then
        return 0
    fi
    
    # Ключ не совпадает с сертификатом → нужен
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
        "${VAULT_ADDR}/v1/${PKI_PATH}/issue/${PKI_ROLE}" 2>/dev/null) || {
        log "ERROR: Vault PKI issue request failed"
        return 1
    }
    
    # Извлекаем поля через sed (без jq в alpine)
    NEW_CERT=$(echo "$RESPONSE" | sed -n 's/.*"certificate":"\(-----BEGIN CERTIFICATE-----[^"]*\)".*/\1/p' | sed 's/\\n/\n/g')
    NEW_KEY=$(echo "$RESPONSE"  | sed -n 's/.*"private_key":"\(-----BEGIN RSA PRIVATE KEY-----[^"]*\)".*/\1/p'  | sed 's/\\n/\n/g')
    # Vault может вернуть EC или PKCS8 ключ
    if [ -z "$NEW_KEY" ]; then
        NEW_KEY=$(echo "$RESPONSE" | sed -n 's/.*"private_key":"\(-----BEGIN PRIVATE KEY-----[^"]*\)".*/\1/p' | sed 's/\\n/\n/g')
    fi
    CA_CHAIN=$(echo "$RESPONSE" | sed -n 's/.*"ca_chain":\["\(-----BEGIN CERTIFICATE-----[^"]*\)".*/\1/p' | sed 's/\\n/\n/g')
    
    if [ -z "$NEW_CERT" ] || [ -z "$NEW_KEY" ]; then
        log "ERROR: empty certificate or key in Vault response"
        return 1
    fi
    
    # Атомарная запись через временные файлы
    TMP_DIR=$(mktemp -d)
    printf '%s\n%s\n' "$NEW_CERT" "$CA_CHAIN" > "${TMP_DIR}/cert.pem"
    printf '%s\n' "$NEW_KEY"                   > "${TMP_DIR}/key.pem"
    
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