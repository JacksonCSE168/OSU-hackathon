import postgres from "postgres"; // 必须使用这个库来连接 Render Postgres
import { randomUUID } from "crypto";
import { mkdirSync, unlinkSync } from "fs";

try { mkdirSync("./uploads", { recursive: true }); } catch (e) {}

import indexHtml from "./index.html";
import profileHtml from "./profile.html";

// 🌟 连接到 Render 的 Postgres 数据库
const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
});

// 🌟 初始化表 (使用 Postgres 语法)
async function initDB() {
  // 🚩 注意：如果你已经确认表结构正确，可以删掉这三行 DROP，否则每次重启数据都会丢
  await sql`DROP TABLE IF EXISTS profile_tags CASCADE`;
  await sql`DROP TABLE IF EXISTS photos CASCADE`;
  await sql`DROP TABLE IF EXISTS profiles CASCADE`;
  
  // 个人资料表
  await sql`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      x REAL DEFAULT 50,
      y REAL DEFAULT 50,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 照片表
  await sql`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      caption TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 标签表
  await sql`
    CREATE TABLE IF NOT EXISTS profile_tags (
      profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      tag TEXT NOT NULL
    )
  `;
}

// 辅助函数：获取带标签的用户数据
async function getProfilesWithTags(rows: any[]) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return [];
  
  return Promise.all(
    rows.map(async (p) => {
      const tags = await sql`SELECT tag FROM profile_tags WHERE profile_id = ${p.id}`;
      return { ...p, tags: (tags || []).map((r: any) => r.tag) };
    })
  );
}

// 🌟 包装启动逻辑：确保数据库初始化完成后再开启服务
async function startServer() {
  await initDB();
  console.log("✅ 数据库表初始化完成");

  Bun.serve({
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    hostname: "0.0.0.0",
    routes: {
      "/": indexHtml,
      "/profile/:id": profileHtml,

      "/api/profiles": {
        GET: async () => {
          const profiles = await sql`SELECT * FROM profiles ORDER BY created_at DESC`;
          return Response.json(await getProfilesWithTags(profiles));
        },
        POST: async (req) => {
          const formData = await req.formData();
          const name = formData.get("name") as string;
          const avatarFile = formData.get("avatar") as File | null;
          const tagsRaw = formData.get("tags") as string | null;
          
          let tags: string[] = [];
          try { tags = tagsRaw ? JSON.parse(tagsRaw) : []; } catch(e) { tags = []; }
          
          const x = parseFloat((formData.get("x") as string) || "50");
          const y = parseFloat((formData.get("y") as string) || "50");

          if (!name?.trim()) return Response.json({ error: "Name is required" }, { status: 400 });

          const id = randomUUID();
          let avatarPath: string | null = null;

          if (avatarFile && avatarFile.size > 0) {
            const ext = avatarFile.name.split(".").pop();
            const filename = `${id}-avatar.${ext}`;
            await Bun.write(`./uploads/${filename}`, avatarFile);
            avatarPath = `/uploads/${filename}`;
          }

          await sql`INSERT INTO profiles (id, name, avatar, x, y) VALUES (${id}, ${name.trim()}, ${avatarPath}, ${x}, ${y})`;

          for (const tag of tags) {
            if (tag.trim()) {
              await sql`INSERT INTO profile_tags (profile_id, tag) VALUES (${id}, ${tag.trim().toLowerCase()})`;
            }
          }

          return Response.json({ id, name: name.trim(), avatar: avatarPath, tags, x, y });
        },
      },

      // 🌟 新增：Tag 搜索接口 (修复搜不到 cat 的问题)
      "/api/profiles/search": {
        GET: async (req) => {
          const url = new URL(req.url);
          const tag = url.searchParams.get("tag")?.trim().toLowerCase();
          
          if (!tag) {
            const all = await sql`SELECT * FROM profiles ORDER BY created_at DESC`;
            return Response.json(await getProfilesWithTags(all));
          }

          try {
            const profiles = await sql`
              SELECT DISTINCT p.* FROM profiles p
              JOIN profile_tags pt ON p.id = pt.profile_id
              WHERE pt.tag = ${tag}
              ORDER BY p.created_at DESC
            `;
            return Response.json(await getProfilesWithTags(profiles));
          } catch (err) {
            console.error("搜索报错:", err);
            return Response.json([]);
          }
        }
      },

      "/api/profiles/nearby": {
        GET: async (req) => {
          try {
            const url = new URL(req.url);
            const targetX = parseFloat(url.searchParams.get("x") || "
