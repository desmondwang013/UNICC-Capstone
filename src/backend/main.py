"""
UNICC AI Safety Lab — FastAPI Backend
"""
from __future__ import annotations

import logging
import os
import sys
from typing import Dict, Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

sys.path.insert(0, os.path.dirname(__file__))

from models import EvaluationInput, EnsembleReport, LLMConfig, ContentType
from orchestrator import MoEOrchestrator
from file_parser import parse_file, detect_content_type

app = FastAPI(
    title="UNICC AI Safety Lab",
    description="Mixture-of-Experts AI Safety evaluation ensemble.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend — resolve relative to this file so it works from any cwd
_FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")
if os.path.isdir(_FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=_FRONTEND_DIR), name="static")

orchestrator  = MoEOrchestrator()
_report_store: Dict[str, EnsembleReport] = {}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    index = os.path.join(_FRONTEND_DIR, "index.html")
    if os.path.isfile(index):
        return FileResponse(index)
    return {"status": "UNICC AI Safety Lab API", "docs": "/docs"}


@app.get("/health")
async def health():
    from orchestrator import _is_demo_mode
    return {"status": "ok", "version": "2.0.0", "demo_mode": _is_demo_mode()}


@app.post("/evaluate", response_model=EnsembleReport)
async def evaluate(input: EvaluationInput):
    """Evaluate pasted text content."""
    try:
        if not input.content_type:
            input.content_type = detect_content_type(input.content)
        report = await orchestrator.evaluate(input)
        _report_store[report.evaluation_id] = report
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/evaluate/upload", response_model=EnsembleReport)
async def evaluate_upload(
    file: UploadFile = File(...),
    context: Optional[str] = Form(None),
    llm_config_json: Optional[str] = Form(None),
):
    """Evaluate an uploaded file (txt, json, csv, xlsx, docx, md)."""
    try:
        data = await file.read()
        content, content_type = parse_file(file.filename, data)

        llm_config = None
        if llm_config_json:
            import json
            llm_config = LLMConfig(**json.loads(llm_config_json))

        input = EvaluationInput(
            content=content,
            content_type=content_type,
            filename=file.filename,
            context=context,
            llm_config=llm_config,
        )
        report = await orchestrator.evaluate(input)
        _report_store[report.evaluation_id] = report
        return report
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/report/{evaluation_id}", response_model=EnsembleReport)
async def get_report(evaluation_id: str):
    report = _report_store.get(evaluation_id.upper())
    if not report:
        raise HTTPException(status_code=404, detail=f"Report {evaluation_id} not found")
    return report


@app.get("/reports")
async def list_reports():
    return [
        {
            "evaluation_id":    r.evaluation_id,
            "filename":         r.filename,
            "content_type":     r.content_type.value,
            "timestamp":        r.timestamp,
            "final_risk_tier":  r.final_risk_tier.value,
            "final_score":      r.final_score,
            "deployment_verdict": r.deployment_verdict.value,
        }
        for r in _report_store.values()
    ]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
