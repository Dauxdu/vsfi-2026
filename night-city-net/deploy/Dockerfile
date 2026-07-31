# Stage 1: build frontend with node js
FROM registry.team01.vsfi.team/node:26-alpine AS build
WORKDIR /app

ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/root-ca.crt

COPY ./deploy/ca.crt /usr/local/share/ca-certificates/root-ca.crt
RUN apk add --no-cache ca-certificates && update-ca-certificates

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

COPY ./deploy/ca.crt /usr/local/share/ca-certificates/root-ca.crt
RUN update-ca-certificates

COPY deploy/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
