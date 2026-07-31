"""Risk inference API: title + location + client -> risk class."""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv("MODEL_PATH", ROOT / "model" / "risk_model.joblib"))
META_PATH = Path(os.getenv("META_PATH", ROOT / "model" / "meta.json"))
LOG_FORMAT = os.getenv("LOG_FORMAT", "text").strip().lower()


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "level": record.levelname.lower(),
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["msg"] = f"{payload['msg']}\n{self.formatException(record.exc_info)}"
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(fmt: str) -> logging.Logger:
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    if fmt == "json":
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))

    root.addHandler(handler)

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uv_logger = logging.getLogger(name)
        uv_logger.handlers.clear()
        uv_logger.propagate = True

    return logging.getLogger("ml-risk")


log = configure_logging(LOG_FORMAT)

app = FastAPI(title="jobs-risk-ml", version="0.1.0")

pipeline = None
meta: dict = {}


class PredictRequest(BaseModel):
    title: str = Field(..., description="Тип / название работы")
    location: str = Field(..., description="Район работы")
    client: str = Field(..., description="Заказчик")


class PredictResponse(BaseModel):
    risk: str
    model_version: str = "0.1.0"


@app.on_event("startup")
def load_model() -> None:
    global pipeline, meta
    log.info("log format: %s", LOG_FORMAT or "text")
    if not MODEL_PATH.exists():
        log.error("model not found: %s", MODEL_PATH)
        raise RuntimeError(f"model not found: {MODEL_PATH}")
    pipeline = joblib.load(MODEL_PATH)
    if META_PATH.exists():
        meta = json.loads(META_PATH.read_text(encoding="utf-8"))
    log.info(
        "model loaded path=%s accuracy=%s features=%s",
        MODEL_PATH.name,
        meta.get("accuracy"),
        meta.get("features", ["title", "location", "client"]),
    )


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model_loaded": pipeline is not None,
        "features": meta.get("features", ["title", "location", "client"]),
        "accuracy": meta.get("accuracy"),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(body: PredictRequest) -> PredictResponse:
    if pipeline is None:
        log.error("predict rejected: model not loaded")
        raise HTTPException(status_code=503, detail="model not loaded")

    frame = pd.DataFrame(
        [
            {
                "title": body.title,
                "location": body.location,
                "client": body.client,
            }
        ]
    )
    risk = str(pipeline.predict(frame)[0])
    log.info(
        "predict title=%r location=%r client=%r risk=%s",
        body.title,
        body.location,
        body.client,
        risk,
    )
    return PredictResponse(risk=risk)
