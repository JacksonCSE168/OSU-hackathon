import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

interface Profile {
  id: string;
  name: string;
  avatar: string | null;
}

// Split a flat list into honeycomb rows alternating 5 and 4 items
function toHiveRows<T>(items: T[]): { items: T[]; offset: boolean }[] {
  const rows: { items: T[]; offset: boolean }[] = [];
  let i = 0;
  while (i < items.length) {
    const size = rows.length % 2 === 0 ? 5 : 4;
    rows.push({ items: items.slice(i, i + size), offset: rows.length % 2 === 1 });
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
          <div className="hex-initial">{profile.name[0].toUpperCase()}</div>
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

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setAvatar(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("name", name.trim());
    if (avatar) fd.append("avatar", avatar);
    try {
      const res = await fetch("/api/profiles", { method: "POST", body: fd });
      if (res.ok) {
        onCreated();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Create Profile</h2>

        <div className="avatar-picker">
          <div
            className="avatar-hex-preview"
            onClick={() => fileRef.current?.click()}
          >
            {preview ? (
              <img src={preview} alt="preview" />
            ) : (
              <div className="hex-initial">+</div>
            )}
          </div>
          <span className="avatar-hint">Click to add a profile photo</span>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
        </div>

        <form onSubmit={handleSubmit}>
          <input
            className="field"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <button className="btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Creating…" : "Create Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    const res = await fetch("/api/profiles");
    setProfiles(await res.json());
  };

  useEffect(() => { load(); }, []);

  // Build rows: append a sentinel "add" item
  const allItems: (Profile | "add")[] = [...profiles, "add"];
  const rows = toHiveRows(allItems);

  return (
    <div>
      <header className="header">
        <span className="logo">faceboook 2.0</span>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + New Profile
        </button>
      </header>

      <main className="hive">
        {profiles.length === 0 && (
          <div className="empty" style={{ marginBottom: 40 }}>
            <h2>No profiles yet</h2>
            <p>Be the first — create a profile below</p>
          </div>
        )}
        {rows.map((row, ri) => (
          <div
            key={ri}
            className={`hive-row${row.offset ? " hive-row--offset" : ""}`}
          >
            {row.items.map((item, ii) =>
              item === "add" ? (
                <AddCell key="add" onClick={() => setShowModal(true)} />
              ) : (
                <HexCell key={(item as Profile).id} profile={item as Profile} />
              )
            )}
          </div>
        ))}
      </main>

      {showModal && (
        <CreateModal onClose={() => setShowModal(false)} onCreated={load} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
