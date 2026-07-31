# ML Risk

Сервис оценки опасности работы. По `title`, `location` и `client` возвращает класс `risk`: `LOW` | `MEDIUM` | `HIGH` | `EXTREME`.

## Что нужно

- Python **3.12+**
- зависимости из `requirements.txt`

Образ на площадке: `registry.vsfi.ru/python:3.12-slim`.

Заготовка под Dockerfile: `Dockerfile.example`.

## API

| Метод  | Путь       | Назначение                 |
| ------ | ---------- | -------------------------- |
| `GET`  | `/health`  | статус и метаданные модели |
| `POST` | `/predict` | предсказание risk          |

Пример:

```bash
curl -s http://localhost:8090/predict \
  -H 'Content-Type: application/json' \
  -d '{"title":"Trace rogue AI handshake","location":"Pacifica","client":"Arasaka"}'
```

Ответ:

```json
{ "risk": "EXTREME", "model_version": "0.1.0" }
```

## Переменные окружения

| Переменная   | По умолчанию              | Назначение        |
| ------------ | ------------------------- | ----------------- |
| `LOG_FORMAT` | `text`                    | `text` или `json` |
| `MODEL_PATH` | `model/risk_model.joblib` | путь к модели     |
| `META_PATH`  | `model/meta.json`         | метаданные модели |

## Локальный запуск

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python train.py
uvicorn app:app --host 0.0.0.0 --port 8090
```

`train.py` читает `data/jobs.csv`, обучает модель и пишет артефакты в `model/`. Без этого шага сервис не стартует.

## Подсказка по Docker

Сначала поставьте зависимости из `requirements.txt`, затем скопируйте код и датасет, обучите модель на этапе сборки (`python train.py`) и запускайте uvicorn на `8090`.
