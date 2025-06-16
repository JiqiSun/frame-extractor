# Video Scene Extractor

A web service for extracting frames or scene transitions from uploaded video files. Built with **React** (frontend) and **FastAPI** (backend), powered by **FFmpeg** for video processing.

---

## Features

- Upload a video and extract:
  - Every frame, or
  - One frame per scene transition (using FFmpeg's scene detection)
- Paginated gallery of extracted frames
- Download all frames as a ZIP archive
- Modern, responsive UI (React + Tailwind CSS)
- Lightbox for viewing frames
- Dockerized for easy deployment

---

## Quick Start

### 1. Build the Docker Image

```sh
docker build -t scene-extractor .
```

### 2. Run the Docker Container

This maps container port **80** to host port **8080**:

```sh
docker run --rm -p 8080:80 scene-extractor
```

### 3. Access the Web App

Open your browser and go to [http://localhost:8080](http://localhost:8080).

---

## Development Setup

You can run the backend and frontend separately for development.

### 1. Backend (FastAPI)

Install Python dependencies (requires Python 3.12+):

```sh
cd backend
pip install -r requirements.txt
```

Start the backend server (with hot-reload):

```sh
uvicorn main:app --reload --port 8000
```

### 2. Frontend (React + Vite)

Install Node dependencies:

```sh
cd frontend
npm install
```

Start the frontend development server:

```sh
npm run dev
```

- The frontend runs on [http://localhost:5173](http://localhost:5173) by default.
- API requests to `/api`, `/output`, `/static`, and `/assets` are proxied to the backend (see `frontend/vite.config.js`).

---

## Project Structure

```
.
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── utils.py
│   └── output/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js
├── Dockerfile
├── README.md
└── .gitignore
```

---

## API Endpoints

- `POST /api/upload`  
  Upload a video file. Returns a `job_id`.

- `GET /api/images/{job_id}?page=1&limit=50`  
  Get a paginated list of extracted frame image URLs.

- `GET /api/download/{job_id}`  
  Download all extracted frames as a ZIP archive.

- Static files:
  - `/output/<job_id>/...` – Extracted frames
  - `/static/*`, `/assets/*` – React frontend (in production)

---

## Notes

- **FFmpeg** is required for frame extraction (installed in the Docker image).
- Uploaded videos and extracted frames are stored in `backend/output/`.
- The default scene detection threshold is `0.03` (can be adjusted in the UI).
- The backend allows CORS from `localhost:5173` for development.

---

## Troubleshooting

- If uploads do not work, ensure both frontend and backend are running and accessible.
- Check browser console and backend logs for errors.
- For local development, make sure the backend is running on port 8000 and the frontend on 5173.

---

