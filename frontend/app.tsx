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
              display: "inline-flex", alignItems: "center
