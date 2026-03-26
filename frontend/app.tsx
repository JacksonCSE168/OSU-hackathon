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
  // 🌟 防崩保护：确保 items 是数组
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
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 🌟 新增：坐标状态 (默认为中心点 50, 50)
  const [vibe, setVibe] = useState({ x: 50, y: 50 });
  
  const fileRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setAvatar(f); setPreview(URL.createObjectURL(f)); }
  };

  // 🌟 新增：处理地图点击
  const handleMapClick = (e: React.MouseEvent) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    
    // 计算百分比坐标 (0-100)
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
    
    // 🌟 传送真实的点击坐标
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
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>定位你的灵魂</h2>

        <form onSubmit={handleSubmit}>
          {/* 1. 头像选择 */}
          <div className="avatar-picker">
            <div className="avatar-hex-preview" onClick={() => fileRef.current?.click()}>
              {preview ? <img src={preview} alt="preview" /> : <div className="hex-initial">+</div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
          </div>

          <input 
            className="field" 
            type="text" 
            placeholder="你的名字" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            required 
          />

          {/* 2. 🌟 灵魂地图 (坐标选择器) */}
          <div style={{ marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            在星图中点击你的位置 (Vibe: {vibe.x.toFixed(0)}, {vibe.y.toFixed(0)})
          </div>
          <div className="soul-map" ref={mapRef} onClick={handleMapClick}>
            <div 
              className="soul-marker" 
              style={{ left: `${vibe.x}%`, top: `${vibe.y}%` }} 
            />
            <span className="map-hint">点击任意处设定坐标</span>
          </div>

          <TagInput tags={tags} onChange={setTags} />

          <button className="btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "正在同步宇宙坐标..." : "创建我的 Profile"}
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

  // 🌟 核心修复：确保 setProfiles 拿到的永远是数组
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
    try {
      const res = await fetch(`/api/profiles/search?tag=${encodeURIComponent(t)}`);
      const data = await res.json();
      setProfiles(Array.isArray(data) ? data : []);
    } catch (e) {
      setProfiles([]);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // 🌟 核心修复：在这里加保护，防止 profiles 为空时崩溃
  const safeProfiles = Array.isArray(profiles) ? profiles : [];
  const allItems: (Profile | "add")[] = [...safeProfiles, "add"];
  const rows = toHiveRows(allItems);

  return (
    <div>
      <header className="header">
        <span className="logo">faceboook 2.0</span>
        <button className="btn-primary" onClick={() => setShowModal(true)}>+ New Profile</button>
      </header>

      <div style={{ display: "flex", justifyContent: "center", padding: "24px 24px 0", gap: 10 }}>
        <input
          className="field"
          style={{ maxWidth: 320, marginBottom: 0 }}
          placeholder="搜索 tag (例如 music)"
          value={searchTag}
          onChange={(e) => {
            setSearchTag(e.target.value);
            if (!e.target.value.trim()) loadAll();
          }}
          onKeyDown={(e) => e.key === "Enter" && searchByTag(searchTag)}
        />
        <button className="btn-primary" onClick={() => searchByTag(searchTag)}>搜索</button>
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
                <AddCell key="add" onClick={() => setShowModal(true)} />
              ) : (
                <HexCell key={(item as Profile).id || ii} profile={item as Profile} />
              )
            )}
          </div>
        ))}
      </main>

      {showModal && <CreateModal onClose={() => setShowModal(false)} onCreated={loadAll} />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
