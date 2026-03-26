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

  await sql`DROP TABLE IF EXISTS profile_tags CASCADE`;
  await sql`DROP TABLE IF EXISTS photos CASCADE`;
  await sql`DROP TABLE IF EXISTS profiles CASCADE`;
  
  // 个人资料表：加入了 x, y 坐标
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
initDB();

// 辅助函数：获取带标签的用户数据
async function getProfilesWithTags(rows: any[]) {
  return Promise.all(
    rows.map(async (p) => {
      const tags = await sql`SELECT tag FROM profile_tags WHERE profile_id = ${p.id}`;
      return { ...p, tags: tags.map((r: any) => r.tag) };
    })
  );
}

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
        const tags: string[] = tagsRaw ? JSON.parse(tagsRaw) : [];
        
        // 🌟 找回坐标数据！
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

        // 写入主表 (包含坐标)
        await sql`INSERT INTO profiles (id, name, avatar, x, y) VALUES (${id}, ${name.trim()}, ${avatarPath}, ${x}, ${y})`;

        // 写入标签
        for (const tag of tags) {
          if (tag.trim()) {
            await sql`INSERT INTO profile_tags (profile_id, tag) VALUES (${id}, ${tag.trim().toLowerCase()})`;
          }
        }

        return Response.json({ id, name: name.trim(), avatar: avatarPath, tags, x, y });
      },
    },

    // 🌟 雷达搜索接口：找回坐标匹配逻辑
    "/api/profiles/nearby": {
      GET: async (req) => {
        try {
          const url = new URL(req.url);
          const targetX = parseFloat(url.searchParams.get("x") || "50");
          const targetY = parseFloat(url.searchParams.get("y") || "50");

          // 🌟 核心检查：如果查询失败，会跳到 catch
          const allProfiles = await sql`SELECT * FROM profiles`;

          // 确保 allProfiles 是数组
          if (!allProfiles || !Array.isArray(allProfiles)) return Response.json([]);

          const profilesWithDistance = allProfiles.map((p: any) => {
            const d2 = Math.pow(p.x - targetX, 2) + Math.pow(p.y - targetY, 2);
            return { ...p, distance: d2 };
          });

          const closest = profilesWithDistance
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 10);

          return Response.json(await getProfilesWithTags(closest));
        } catch (err) {
          console.error("搜索失败:", err);
          // 🌟 万一崩了，给前端回个空数组，别让前端报错
          return Response.json([]); 
        }
      }
    },

    "/api/profiles/:id": {
      GET: async (req) => {
        const rows = await sql`SELECT * FROM profiles WHERE id = ${req.params.id}`;
        if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });
        const photos = await sql`SELECT * FROM photos WHERE profile_id = ${req.params.id} ORDER BY created_at DESC`;
        const tags = await sql`SELECT tag FROM profile_tags WHERE profile_id = ${req.params.id}`;
        return Response.json({ ...rows[0], photos, tags: tags.map(r => r.tag) });
      },
      // 🌟 顺便把删除功能也加上
      DELETE: async (req) => {
        await sql`DELETE FROM profiles WHERE id = ${req.params.id}`;
        return Response.json({ success: true });
      }
    },

    "/api/profiles/:id/upload": {
      POST: async (req) => {
        const photoId = randomUUID();
        const formData = await req.formData();
        const file = formData.get("photo") as File;
        const caption = (formData.get("caption") as string) || "";
        const ext = file.name.split(".").pop();
        const filename = `${photoId}.${ext}`;
        await Bun.write(`./uploads/${filename}`, file);
        const path = `/uploads/${filename}`;
        await sql`INSERT INTO photos (id, profile_id, path, caption) VALUES (${photoId}, ${req.params.id}, ${path}, ${caption})`;
        return Response.json({ id: photoId, path, caption });
      },
    },

    "/uploads/:filename": (req) => {
      const file = Bun.file(`./uploads/${req.params.filename}`);
      return new Response(file);
    },
  },
  development: { hmr: true, console: true },
});

console.log(`Faceboook 2.0 running on port ${process.env.PORT || 3000}`);
