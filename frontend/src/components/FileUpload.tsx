import { useCallback, useRef, useState } from "react";
import "./FileUpload.css";

interface Props {
  onFile: (file: File) => void;
  currentFile: File | null;
  onClear: () => void;
}

export default function FileUpload({ onFile, currentFile, onClear }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/pdf") onFile(file);
    },
    [onFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  if (currentFile) {
    return (
      <div className="file-upload file-upload--filled animate-fade">
        <div className="file-upload__icon file-upload__icon--filled">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div className="file-upload__info">
          <span className="file-upload__filename">{currentFile.name}</span>
          <span className="file-upload__size">
            {(currentFile.size / 1024).toFixed(1)} KB · PDF
          </span>
        </div>
        <button
          className="btn btn-danger file-upload__clear"
          onClick={onClear}
          aria-label="Remove file"
          type="button"
          id="btn-clear-file"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
          Remove
        </button>
      </div>
    );
  }

  return (
    <div
      className={`file-upload ${dragging ? "file-upload--drag" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      aria-label="Upload resume PDF by clicking or dragging"
      id="file-upload-zone"
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={handleChange}
        id="input-resume-file"
      />
      <div className="file-upload__icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="19" x2="12" y2="5" />
          <polyline points="5 12 12 5 19 12" />
        </svg>
      </div>
      <p className="file-upload__hint">
        <strong>Drop your resume PDF here</strong>
        <span className="file-upload__subhint">or click to browse</span>
      </p>
      <span className="file-upload__limit-pill">PDF only • Max 10MB</span>
    </div>
  );
}
