/*  frontend/src/App.jsx  */

import { useState, useEffect } from "react";
import axios from "axios";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import "./index.css";   // <- Tailwind build (see tailwind.config.js)

/* ------------------------------------------------------------------ */
/*  component                                                          */
/* ------------------------------------------------------------------ */
export default function App() {
  /* --------------------------- state ------------------------------ */
  const [file, setFile]         = useState(null);

  const [mode, setMode]         = useState("scene");   // "scene" | "all"
  const [threshold, setThresh]  = useState(0.03);

  const [progress, setProgress] = useState(0);         // 0–100 upload bar
  const [processing, setProc]   = useState(false);     // backend extraction

  const [jobId, setJobId]       = useState(null);

  const [images, setImages]     = useState([]);        // thumbnails on page
  const [page, setPage]         = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [open, setOpen]   = useState(false);           // lightbox
  const [idx, setIdx]     = useState(0);               // lightbox index

  /* ---------------------- constants / helpers --------------------- */
  const PAGE_SIZE = 50;
  const THRESHOLD_STEP = 0.05;

  /* ----------------------------------------------
   fire whenever jobId changes (and isn’t empty)
  ---------------------------------------------- */
  useEffect(() => {
    if (jobId) {
      fetchPage(1, jobId);      // page 1, fresh id
    }
  }, [jobId]);                  // ← dependency array

  /* fetch one page of thumbnails (after extraction is done) */
  const fetchPage = async (p, id = jobId) => {
    if (!id) return;                               // guard
    const { data } = await axios.get(`/api/images/${id}`, {
      params: { page: p, limit: PAGE_SIZE },
    });

    setImages(data.images);
    setPage(data.page);
    setTotalPages(data.total_pages);
  };


  /* upload handler */
  const upload = async () => {
    if (!file) return;

    setProc(true);
    setProgress(0);
    setImages([]);
    setPage(1);
    setTotalPages(1);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    if (mode === "scene") fd.append("threshold", threshold);

    try {
      const { data } = await axios.post("/api/upload", fd, {
        onUploadProgress: (e) => {
          if (e.total) {
            setProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      });

      const newId = data.job_id;      // server-returned ID
      setJobId(newId);                // update React state
      setProc(false);                 // extraction finished
      fetchPage(1, newId);            // ← first GET happens **right now**
    } catch (err) {
      console.error(err);
      setProc(false);
    }
  };


  /* --------------------------- render ----------------------------- */
  return (
    <div className="min-h-screen flex flex-col items-center gap-6 p-8 bg-gray-50">
      <h1 className="text-3xl font-extrabold">Video Scene Extractor</h1>

      {/* ---------- control card ---------- */}
      <div className="w-full max-w-xl bg-white shadow rounded-xl p-6 space-y-4">

        {/* file picker / drag-n-drop */}
        <label
          className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 text-gray-500"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
          }}
        >
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files[0])}
          />
          {file ? file.name : "Drag & drop video here or click to browse"}
        </label>

        {/* mode & threshold */}
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-medium">Mode:</span>

          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              value="scene"
              checked={mode === "scene"}
              onChange={(e) => setMode(e.target.value)}
            />
            Scene
          </label>

          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              value="all"
              checked={mode === "all"}
              onChange={(e) => setMode(e.target.value)}
            />
            Every frame
          </label>

          {mode === "scene" && (
            <label className="flex items-center gap-1">
              <span className="font-medium">Threshold:</span>
              <input
                type="number"
                min="0"
                max="1"
                step={THRESHOLD_STEP}
                value={threshold}
                onChange={(e) => setThresh(parseFloat(e.target.value) || 0)}
                className="border rounded p-1 w-24"
              />
            </label>
          )}
        </div>

        {/* upload button */}
        <button
          onClick={upload}
          disabled={!file || processing}
          className="w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {processing ? "Processing…" : "Upload & Extract"}
        </button>

        {/* progress bar */}
        {progress > 0 && progress < 100 && (
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-3 bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {processing && progress === 100 && (
          <p className="text-sm text-gray-600">Extracting frames…</p>
        )}

        {/* download-all link */}
        {images.length > 0 && (
          <a
            href={`/api/download/${jobId}`}
            className="block text-center underline text-blue-600"
          >
            Download all as ZIP
          </a>
        )}
      </div>

      {/* ---------- thumbnail gallery & pager ---------- */}
      {images.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">
            Page {page}/{totalPages}
          </h2>

          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {images.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`frame ${i}`}
                className="object-cover h-40 sm:h-60 md:h-68 rounded shadow bg-gray-200 cursor-pointer"
                onClick={() => { setIdx(i); setOpen(true); }}
              />
            ))}
          </div>

          {/* pager controls */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => fetchPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-2">{page}/{totalPages}</span>
            <button
              onClick={() => fetchPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* ---------- light-box ---------- */}
      {open && (
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          index={idx}
          slides={images.map((s) => ({ src: s }))}
          on={{ view: ({ index }) => setIdx(index) }}
        />
      )}
    </div>
  );
}
