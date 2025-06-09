# 1. Build the image (≈2–3 min the first time)
$ docker build -t scene-extractor .

# 2. Run – maps container port 80 → host 8080
$ docker run --rm -p 8080:80 scene-extractor

# 3. Open your browser → http://localhost:8080

# 4  Launch FastAPI with hot-reload
uvicorn main:app --reload --port 8000

# Launch frontend
npm run dev