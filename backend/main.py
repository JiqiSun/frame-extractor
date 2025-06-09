"""
backend/main.py
FastAPI backend for the Video Scene Extractor
---------------------------------------------

* POST /api/upload             – upload a video, returns job_id
* GET  /api/images/{job_id}    – paginated list of JPG URLs
* GET  /api/download/{job_id}  – ZIP of every extracted image
* Static mounts:
    /output/<job-id>/...  (extracted frames)
    /static/*, /assets/*  (React build, if present)

Requirements:
    pip install fastapi uvicorn python-multipart
    # plus FFmpeg in $PATH
"""

import os
import math
import shutil
import subprocess
import uuid
from typing import List

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    Form,
    HTTPException,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# -------------------------------------------------------------------
# basic config
# -------------------------------------------------------------------
OUTPUT_ROOT = "output"
os.makedirs(OUTPUT_ROOT, exist_ok=True)

ALLOWED_ORIGINS: List[str] = [
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5173",
    "*",                      # ← loosen / tighten as needed
]

app = FastAPI(
    title="Video Scene Extractor API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# serve extracted frames
app.mount("/output", StaticFiles(directory=OUTPUT_ROOT), name="output")

# serve React build *if it exists*
if os.path.isdir("static"):
    app.mount("/static", StaticFiles(directory="static", html=True), name="static")
    assets_dir = os.path.join("static", "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    def root():
        return FileResponse("static/index.html")
else:

    @app.get("/", include_in_schema=False)
    def root():
        return {"message": "Backend running (no static bundle found)."}


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def ffmpeg_extract(
    src_path: str,
    dest_dir: str,
    mode: str = "scene",
    threshold: float = 0.03,
):
    """
    Run FFmpeg to dump either:
      * every frame                  (mode == 'all'), or
      * 1 frame per scene transition (mode == 'scene')

    Frames are stored as dest_dir/frame-%06d.jpg (quality ≈ q=2).
    """
    os.makedirs(dest_dir, exist_ok=True)
    if mode == "all":
        vf = "fps=30"  # keep original fps? adjust as desired
    else:
        # SCENE mode — ffmpeg's mpdecimate is also possible, but here we use select
        vf = f"select='gt(scene,{threshold})',showinfo"

    cmd = [
        "ffmpeg",
        "-i",
        src_path,
        "-vf",
        vf,
        "-vsync",
        "vfr",
        "-qscale:v",
        "2",
        os.path.join(dest_dir, "frame-%06d.jpg"),
    ]
    # capture but ignore ffmpeg output (for brevity)
    subprocess.run(cmd, capture_output=True, check=True)


def make_zip(job_dir: str) -> str:
    """Return path to a zip archive of job_dir (creates it if needed)."""
    zip_path = shutil.make_archive(job_dir, "zip", job_dir)
    return zip_path


# -------------------------------------------------------------------
# API endpoints
# -------------------------------------------------------------------
@app.post("/api/upload")
async def upload_video(
    file: UploadFile = File(...),
    mode: str = Form("scene"),  # 'scene' (default) or 'all'
    threshold: float = Form(0.3),
):
    if mode not in ("scene", "all"):
        raise HTTPException(400, "mode must be 'scene' or 'all'")

    # save uploaded video to a temp file
    job_id = uuid.uuid4().hex
    job_dir = os.path.join(OUTPUT_ROOT, job_id)
    os.makedirs(job_dir, exist_ok=True)

    temp_path = os.path.join(job_dir, file.filename)
    with open(temp_path, "wb") as f:
        f.write(await file.read())

    try:
        ffmpeg_extract(temp_path, job_dir, mode=mode, threshold=threshold)
    except subprocess.CalledProcessError as exc:
        raise HTTPException(500, f"ffmpeg failed: {exc.stderr.decode()[:200]}") from exc
    finally:
        # remove the original video to save space
        os.remove(temp_path)

    return {"job_id": job_id}


@app.get("/api/images/{job_id}")
def list_images(
    job_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
):
    """Return paginated list of image URLs for a job."""
    job_dir = os.path.join(OUTPUT_ROOT, job_id)
    if not os.path.isdir(job_dir):
        raise HTTPException(404, "job not found")

    all_images = sorted(f for f in os.listdir(job_dir) if f.endswith(".jpg"))
    total = len(all_images)
    total_pages = max(1, math.ceil(total / limit))

    start, end = (page - 1) * limit, (page - 1) * limit + limit
    urls = [
        f"/output/{job_id}/{name}"
        for name in all_images[start:end]
    ]
    return {
        "images": urls,
        "page": page,
        "total_pages": total_pages,
        "total": total,
        "page_size": limit,
    }


@app.get("/api/download/{job_id}", include_in_schema=False)
def download_zip(job_id: str):
    job_dir = os.path.join(OUTPUT_ROOT, job_id)
    if not os.path.isdir(job_dir):
        return JSONResponse({"error": "job not found"}, status_code=404)

    zip_path = make_zip(job_dir)
    return FileResponse(
        zip_path,
        filename=f"{job_id}.zip",
        media_type="application/zip",
    )
