import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

interface Profile {
  id: string;
  name: string;
  avatar: string | null;
  tags: string[];
}

function toHiveRows<T>(items: T[]): { items: T[]; offset: boolean }[] {
  const safeItems = Array.isArray(items) ? items : [];
  const rows: { items: T[]; offset: boolean }[] = [];
  let i = 0;
  while (i < safeItems.length) {
    const size = rows.length % 2 === 0 ? 5 : 4;
    rows.push({ items: safeItems.slice(i, i + size), offset: rows.length % 2 === 1 });
    i += size;
  }
  return rows;
}

function HexCell({ profile }: { profile: Profile }) {
  return (
    <a href={`/profile/${profile.id}`} className="hex-wrap" title={profile.name}>
      <div className="hex">
        {profile.avatar ? (
          <img src={profile.avatar} alt={profile.name} />
        ) : (
          <div className="hex-initial">{profile.name ? profile.name[0].toUpperCase() : "?"}</div>
        )}
      </div>
      <span className="hex-name">{profile.name}</span>
    </a>
  );
}

function AddCell({ onClick }: { onClick: () => void }) {
  return (
    <div className="hex-wrap hex-add" onClick={onClick} title="New profile">
      <div className="hex">
        <div className="hex-initial">+</div>
      </div>
      <span className="hex-name">Add profile</span>
    </div>
  );
}

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const val = input.trim().toLowerCase();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput("");
  };

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const rows: string[][] = [];
  for (let i = 0; i < tags.length; i += 5) rows.push(tags.slice(i, i + 5));

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: tags.length ? 8 : 0 }}>
        {rows.map((row, ri) =>
          row.map((tag) => (
            <span key={tag} style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: "rgba(24,119,242,0.15)",
              border: "1px solid rgba(24,119,242,0.35)",
              color: "var(--blue-light)",
              borderRadius: 20,
              padding: "2px 10px",
              fontSize: "0.78rem",
              fontWeight: 500,
            }}>
              #{tag}
              <button type="button" onClick={() => removeTag(tag)} style={{
                background: "none", border: "none", color: "inherit",
                cursor: "pointer", padding: 0, fontSize: "0.9rem", lineHeight: 1,
                opacity: 0.6,
              }}>×</button>
            </span>
          ))
        )}
      </div>
      <input
        className="field"
        style={{ marginBottom: 0 }}
        type="text"
        placeholder="Add a tag, press Enter"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={addTag}
      />
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [vibe, setVibe] = useState({ x: 50, y: 50 });
  
  const fileRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setAvatar(f); setPreview(URL.createObjectURL(f)); }
  };

  const handleMapClick = (e: React.MouseEvent) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setVibe({ 
      x: Math.max(0, Math.min(100, x)), 
      y: Math.max(0, Math.min(100, y)) 
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    
    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("tags", JSON.stringify(tags));
    fd.append("x", vibe.x.toString());
    fd.append("y", vibe.y.toString());

    if (avatar) fd.append("avatar", avatar);
    try {
      const res = await fetch("/api/profiles", { method: "POST", body: fd });
      if (res.ok) { onCreated(); onClose(); }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>×</button>
        <h2>Find Your Soul</h2>

        <form onSubmit={handleSubmit}>
          <div className="avatar-picker">
            <div className="avatar-hex-preview" onClick={() => fileRef.current?.click()}>
              {preview ? <img src={preview} alt="preview" /> : <div className="hex-initial">+</div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
          </div>

          <input 
            className="field" 
            type="text" 
            placeholder="Your name"
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            required 
          />

          <div style={{ marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            Click your position on the soul map (Vibe: {vibe.x.toFixed(0)}, {vibe.y.toFixed(0)})
          </div>
          <div className="soul-map" ref={mapRef} onClick={handleMapClick}>
            <div 
              className="soul-marker" 
              style={{ left: `${vibe.x}%`, top: `${vibe.y}%` }} 
            />
            <span className="map-hint">Click anywhere to set coordinates</span>
          </div>

          <TagInput tags={tags} onChange={setTags} />

          <button type="submit" className="btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Creating..." : "Create My Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTag, setSearchTag] = useState("");
  const [searching, setSearching] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const loadAll = async () => {
    try {
      const res = await fetch("/api/profiles");
      const data = await res.json();
      setProfiles(Array.isArray(data) ? data : []);
    } catch (e) {
      setProfiles([]);
    }
    setSearching(false);
  };

  const searchByTag = async (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (!t) { loadAll(); return; }
    
    setSearching(true);
    setIsScanning(true);

    try {
      const res = await fetch(`/api/search?tag=${encodeURIComponent(t)}`);
      if (!res.ok) throw new Error("Search request failed");
      const data = await res.json();
      
      setTimeout(() => {
        setProfiles(Array.isArray(data) ? data : []);
        setIsScanning(false);
      }, 1500);

    } catch (e) {
      console.error(e);
      setTimeout(() => {
        setProfiles([]);
        setIsScanning(false);
      }, 1500);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const safeProfiles = Array.isArray(profiles) ? profiles : [];
  const allItems: (Profile | "add")[] = [...safeProfiles, "add"];
  const rows = toHiveRows(allItems);

  return (
    <div>
      <header className="header">
        <span className="logo">faceboook 2.0</span>
        <button type="button" className="btn-primary" onClick={() => setShowModal(true)}>+ New Profile</button>
      </header>

      <div style={{ display: "flex", justifyContent: "center", padding: "24px 24px 0", gap: 10, position: "relative", zIndex: 10 }}>
        <input
          className="field"
          style={{ maxWidth: 320, marginBottom: 0 }}
          placeholder="Search tag (e.g. music)"
          value={searchTag}
          onChange={(e) => {
            setSearchTag(e.target.value);
            if (!e.target.value.trim()) loadAll();
          }}
          onKeyDown={(e) => e.key === "Enter" && searchByTag(searchTag)}
        />
        <button type="button" className="btn-primary" onClick={() => searchByTag(searchTag)}>Search</button>
      </div>

      <main className="hive">
        {safeProfiles.length === 0 && !searching && (
          <div className="empty">
            <h2>No profiles yet</h2>
            <p>Be the first — create a profile below</p>
          </div>
        )}
        
        {rows.map((row, ri) => (
          <div key={ri} className={`hive-row${row.offset ? " hive-row--offset" : ""}`}>
            {row.items.map((item, ii) =>
              item === "add" ? (
                <AddCell key={`add-${ii}`} onClick={() => setShowModal(true)} />
              ) : (
                <HexCell key={(item as Profile).id || `hex-${ii}`} profile={item as Profile} />
              )
            )}
          </div>
        ))}
      </main>

      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreated={loadAll} />}

      {isScanning && (
        <div className="radar-overlay">
          <div className="radar-screen">
            <div className="radar-sweep"></div>
          </div>
          <div className="radar-text">Scanning Souls...</div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
