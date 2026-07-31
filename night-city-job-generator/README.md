# Jobs Backend

Go-сервис API для Night City Net. Отдаёт джобы, SSE-стрим и ходит в ML-сервис за оценкой `risk`.

## Что нужно

- Go **1.22+**
- PostgreSQL
- (опционально) ML-сервис risk на `/predict`

Образы и proxy на площадке:

- `registry.vsfi.ru/golang:1.22-alpine`
- `registry.vsfi.ru/alpine:3.22`
- `GOPROXY=https://nexus.vsfi.ru/repository/go-mod-shisha-server/`

Заготовка под Dockerfile: `Dockerfile.example`.

## Переменные окружения

| Переменная     | По умолчанию                                                                       | Назначение                       |
| -------------- | ---------------------------------------------------------------------------------- | -------------------------------- |
| `PORT`         | `8080`                                                                             | HTTP-порт                        |
| `DATABASE_URL` | `postgres://competitions:competitions@localhost:5432/competitions?sslmode=disable` | Postgres                         |
| `API_KEY`      | `nc-net-7749-key`                                                                  | заголовок `X-API-Key`            |
| `NETWORK_NODE` | `NIGHT_CITY_PRIMARY`                                                               | заголовок `X-Network-Node`       |
| `LOG_FORMAT`   | `text`                                                                             | `text` или `json`                |
| `ML_RISK_URL`  | `http://ml-risk:8090`                                                              | базовый URL ML (`POST /predict`) |

Если ML недоступен, в джобе будет `risk: "Unknown"`.

## Локальный запуск

```bash
# поднять Postgres (пример)
# затем:
go mod download
go run .
```

Проверка:

```bash
curl -s http://localhost:8080/api/jobs/active \
  -H 'X-API-Key: nc-net-7749-key' \
  -H 'X-Network-Node: NIGHT_CITY_PRIMARY'
```

Метрики: `GET /metrics` (без API-ключей).

## Подсказки

- сначала копируйте `go.mod` / `go.sum` и делайте `go mod download` — так лучше кешируется слой;
- `GOPROXY` задайте через `ENV` на этапе сборки;
- в runtime не нужны исходники и компилятор.

Сборка и запуск:

```bash
docker build -t jobs-backend .
docker run --rm -p 8080:8080 \
  -e DATABASE_URL='postgres://...' \
  -e ML_RISK_URL='http://host:8090' \
  jobs-backend
```

Сервису нужны сеть до Postgres и (желательно) до ML.
