#######################################################################
# 1️⃣  Build the React SPA (hashed bundle ends up in /frontend/dist)
#######################################################################
FROM node:18-bookworm AS frontend-builder

WORKDIR /frontend

# install dependencies first to leverage Docker cache
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps          # use legacy flag for lightbox peer-deps

# copy source and build
COPY frontend/ .
RUN npm run build                      # → ./dist  (static assets)

#######################################################################
# 2️⃣  Install Python dependencies once (kept as a cacheable layer)
#######################################################################
FROM python:3.12-slim-bookworm AS backend-deps

WORKDIR /app
COPY backend/requirements.txt .

RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

#######################################################################
# 3️⃣  Final runtime image  (small, contains FFmpeg + your code)
#######################################################################
FROM python:3.12-slim-bookworm

LABEL org.opencontainers.image.title="Scene Extractor Service" \
      org.opencontainers.image.version="1.0.0"

# ── add FFmpeg (for frame extraction) ────────────────────────────────
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# ── copy full Python environment (binaries **and** libs) ─────────────
COPY --from=backend-deps /usr/local /usr/local

# ── copy backend code ────────────────────────────────────────────────
WORKDIR /app
COPY backend/ .

# ── copy React bundle where FastAPI expects it (/app/static) ─────────
COPY --from=frontend-builder /frontend/dist ./static

# ── runtime config ───────────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1        
EXPOSE 80

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "80"]
