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

// Tag 输入组件
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

  // 每 5 个 tag 换行
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
              <button onClick={() => removeTag(tag)} style={{
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
        placeholder="输入 tag，按 Enter 添加"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        onBlur={addTag}
      />
      <p style={{ fontSize: "0.72rem", color: "var(--text-dim)", marginTop: 4 }}>
        按 Enter 或逗号添加，无上限
      </p>
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setAvatar(f); setPreview(URL.createObjectURL(f)); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("tags", JSON.stringify(tags));
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
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Create Profile</h2>

        <div className="avatar-picker">
          <div className="avatar-hex-preview" onClick={() => fileRef.current?.click()}>
            {preview ? <img src={preview} alt="preview" /> : <div className="hex-initial">+</div>}
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
          <TagInput tags={tags} onChange={setTags} />
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
  const [searchTag, setSearchTag] = useState("");
  const [searching, setSearching] = useState(false);

  const loadAll = async () => {
    const res = await fetch("/api/profiles");
    setProfiles(await res.json());
    setSearching(false);
  };

  const searchByTag = async (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (!t) { loadAll(); return; }
    setSearching(true);
    const res = await fetch(`/api/profiles/search?tag=${encodeURIComponent(t)}`);
    setProfiles(await res.json());
  };

  useEffect(() => { loadAll(); }, []);

  const allItems: (Profile | "add")[] = [...profiles, "add"];
  const rows = toHiveRows(allItems);

  return (
    <div>
      <header className="header">
        <span className="logo">faceboook 2.0</span>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ New Profile</button>
      </header>

      {/* Tag 搜索栏 */}
      <div style={{ display: "flex", justifyContent: "center", padding: "24px 24px 0", gap: 10 }}>
        <input
          className="field"
          style={{ maxWidth: 320, marginBottom: 0 }}
          placeholder="搜索 tag，例如：music"
          value={searchTag}
          onChange={(e) => {
            setSearchTag(e.target.value);
            if (!e.target.value.trim()) loadAll();
          }}
          onKeyDown={(e) => e.key === "Enter" && searchByTag(searchTag)}
        />
        <button
          className="btn-primary"
          onClick={() => searchByTag(searchTag)}
        >搜索</button>
        {searching && (
          <button
            className="btn-primary"
            style={{ background: "rgba(255,255,255,0.1)", color: "var(--text-dim)" }}
            onClick={() => { setSearchTag(""); loadAll(); }}
          >清除</button>
        )}
      </div>
      {searching && (
        <p style={{ textAlign: "center", color: "var(--text-dim)", fontSize: "0.8rem", margin: "8px 0 0" }}>
          #{searchTag.trim()} — 找到 {profiles.length} 人
        </p>
      )}

      <main className="hive">
        {profiles.length === 0 && (
          <div className="empty" style={{ marginBottom: 40 }}>
            <h2>{searching ? "没有找到相关用户" : "No profiles yet"}</h2>
            <p>{searching ? `没有人添加 #${searchTag.trim()} 这个 tag` : "Be the first — create a profile below"}</p>
          </div>
        )}
        {rows.map((row, ri) => (
          <div key={ri} className={`hive-row${row.offset ? " hive-row--offset" : ""}`}>
            {row.items.map((item) =>
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
        <CreateModal onClose={() => setShowModal(false)} onCreated={loadAll} />
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
