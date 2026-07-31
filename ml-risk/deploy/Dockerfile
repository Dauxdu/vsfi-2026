FROM registry.team01.vsfi.team/python:3.12-slim

WORKDIR /app

# Self-signed CA
COPY ./deploy/ca.crt /usr/local/share/ca-certificates/vsfi-root-ca.crt
RUN update-ca-certificates

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY data/ ./data/
COPY train.py app.py ./

RUN python train.py

COPY . .

RUN useradd -r -u 1000 -m appuser && chown -R appuser:appuser /app
USER appuser

ENV LOG_FORMAT=text \
    MODEL_PATH=model/risk_model.joblib \
    META_PATH=model/meta.json

EXPOSE 8090

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090"]
