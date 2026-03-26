import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

interface Photo {
  id: string;
  path: string;
  caption: string;
}

interface ProfileData {
  id: string;
  name: string;
  avatar: string | null;
  photos: Photo[];
  tags: string[];
}

function UploadModal({
  profileId,
  onClose,
  onUploaded,
}: {
  profileId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
    setPreviews(selected.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;
    setLoading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("photo", file);
        fd.append("caption", caption);
        await fetch(`/api/profiles/${profileId}/upload`, {
          method: "POST",
          body: fd,
        });
      }
      onUploaded();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Upload Photos</h2>

        <div
          className="upload-zone"
          onClick={() => fileRef.current?.click()}
        >
          {previews.length > 0 ? (
            <div className="upload-preview-grid">
              {previews.map((p, i) => (
                <img key={i} src={p} alt="" />
              ))}
            </div>
          ) : (
            <div className="upload-zone-hint">
              Click to select photos
              <br />
              <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                Multiple files supported
              </span>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleFiles}
          />
        </div>

        <form onSubmit={handleSubmit}>
          <input
            className="field"
            type="text"
            placeholder="Caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <button
            className="btn-primary"
            style={{ width: "100%" }}
            disabled={loading || files.length === 0}
          >
            {loading
              ? "Uploading…"
              : files.length > 0
              ? `Upload ${files.length} photo${files.length !== 1 ? "s" : ""}`
              : "Select photos first"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ProfilePage() {
  const profileId = window.location.pathname.split("/").at(-1)!;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [notFound, setNotFound] = useState(false);

  const deleteProfile = async () => {
    if (!confirm("Delete this profile? This cannot be undone.")) return;
    await fetch(`/api/profiles/${profileId}`, { method: "DELETE" });
    window.location.href = "/";
  };

  const deleteTag = async (tag: string) => {
    await fetch(`/api/profiles/${profileId}/tags/${encodeURIComponent(tag)}`, { method: "DELETE" });
    load();
  };

  const deletePhoto = async (photoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this photo?")) return;
    await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
    load();
  };

  const load = async () => {
    const res = await fetch(`/api/profiles/${profileId}`);
    if (res.ok) setProfile(await res.json());
    else setNotFound(true);
  };

  useEffect(() => { load(); }, []);

  if (notFound)
    return (
      <div>
        <header className="header">
          <a href="/" className="back-btn">← Back</a>
          <span className="logo">faceboook 2.0</span>
        </header>
        <div className="empty"><h2>Profile not found</h2></div>
      </div>
    );

  if (!profile) return <div className="loading">Loading…</div>;

  return (
    <div>
      <header className="header">
        <a href="/" className="back-btn">← Back</a>
        <span className="logo">faceboook 2.0</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" onClick={() => setShowUpload(true)}>+ Upload</button>
          <button className="btn-danger" onClick={deleteProfile}>Delete Profile</button>
        </div>
      </header>

      <div className="profile-hero">
        <div className="profile-hex-lg">
          {profile.avatar ? (
            <img src={profile.avatar} alt={profile.name} />
          ) : (
            <div className="hex-initial">{profile.name[0].toUpperCase()}</div>
          )}
        </div>
        <h1 className="profile-name">{profile.name}</h1>
        <span className="photo-count">
          {profile.photos.length === 0
            ? "No photos yet"
            : `${profile.photos.length} photo${profile.photos.length !== 1 ? "s" : ""}`}
        </span>
        {profile.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: 480 }}>
            {profile.tags.map((tag) => (
              <span key={tag} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "rgba(24,119,242,0.15)",
                border: "1px solid rgba(24,119,242,0.35)",
                borderRadius: 20,
                padding: "2px 8px 2px 10px",
                fontSize: "0.78rem",
                fontWeight: 500,
              }}>
                <a href={`/?tag=${encodeURIComponent(tag)}`} style={{ color: "var(--blue-light)", textDecoration: "none" }}>#{tag}</a>
                <button onClick={() => deleteTag(tag)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", lineHeight: 1,
                  padding: "0 2px",
                }} title="Remove tag">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {profile.photos.length === 0 ? (
        <div className="empty">
          <h2>No photos yet</h2>
          <p>Upload some photos to fill this profile</p>
        </div>
      ) : (
        <div className="photo-grid">
          {profile.photos.map((photo) => (
            <div
              key={photo.id}
              className="photo-card"
              onClick={() => setLightbox(photo)}
            >
              <img src={photo.path} alt={photo.caption} />
              {photo.caption && (
                <p className="photo-caption">{photo.caption}</p>
              )}
              <button
                className="photo-delete-btn"
                onClick={(e) => deletePhoto(photo.id, e)}
                title="Delete photo"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadModal
          profileId={profileId}
          onClose={() => setShowUpload(false)}
          onUploaded={load}
        />
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox.path} alt={lightbox.caption} />
          {lightbox.caption && <p>{lightbox.caption}</p>}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<ProfilePage />);
