# Stage 1: Build
FROM registry.team01.vsfi.team/golang:1.22-alpine AS builder

ENV GOPROXY=https://nexus.team01.vsfi.team/repository/go-mod-shisha-server/
ENV CGO_ENABLED=0
ENV GOOS=linux
ENV GOARCH=amd64

# Self-signed CA
RUN apk --no-cache add ca-certificates
COPY ./deploy/ca.crt /usr/local/share/ca-certificates/vsfi-root-ca.crt
RUN update-ca-certificates

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -ldflags="-w -s" -o /app/jobs-backend .

# Stage 2: Runtime
FROM registry.team01.vsfi.team/alpine:3.22

RUN apk --no-cache add ca-certificates tzdata wget

# Self-signed CA
COPY ./deploy/ca.crt /usr/local/share/ca-certificates/vsfi-root-ca.crt
RUN update-ca-certificates

WORKDIR /app

COPY --from=builder /app/jobs-backend /app/jobs-backend

RUN adduser -D -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

CMD ["/app/jobs-backend"]