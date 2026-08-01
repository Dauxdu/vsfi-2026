# Stage 1: build frontend with node js
FROM registry.team01.vsfi.team/node:26-alpine AS build
WORKDIR /app

ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/root-ca.crt

COPY ./deploy/ca.crt /tmp/root-ca.crt
RUN apk add --no-cache ca-certificates \
    && cp /tmp/root-ca.crt /usr/local/share/ca-certificates/ \
    && update-ca-certificates \
    && rm /tmp/root-ca.crt

# Install deps against the lockfile for reproducible builds
COPY package.json package-lock.json ./
RUN npm set registry https://nexus.team01.vsfi.team/repository/npm-shisha-proxy-modules/ \
    && npm ci --prefer-offline --no-audit --no-fund

# Build the static bundle -> /app/dist
COPY . .
RUN npm run build


# Stage 2: nginx frontend
FROM registry.team01.vsfi.team/nginx:1.31.2-alpine

# OCI metadata
LABEL org.opencontainers.image.title="night-city-net" \
    org.opencontainers.image.description="Night City Net frontend" \
    org.opencontainers.image.vendor="VSFI"

COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY deploy/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

HEALTHCHECK --interval=15s --timeout=3s --retries=3 --start-period=5s \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/nginx_status || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
