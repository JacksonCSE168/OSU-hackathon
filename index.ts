import postgres from "postgres"; 
import { randomUUID } from "crypto";
import { mkdirSync, unlinkSync } from "fs";

try { mkdirSync("./uploads", { recursive: true }); } catch (e) {}

import indexHtml from "./index.html";
import profileHtml from "./profile.html";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require",
});

async function initDB() {
  // 已经帮你把 DROP TABLE 删掉了，数据安全了！
  
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

  await sql`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      caption TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS profile_tags (
      profile_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      tag TEXT NOT NULL
    )
  `;
}

async function getProfilesWithTags(rows: any[]) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return [];
  
  return Promise.all(
    rows.map(async (p) => {
      const tags = await sql`SELECT tag FROM profile_tags WHERE profile_id = ${p.id}`;
      return { ...p, tags: (tags || []).map((r: any) => r.tag) };
    })
  );
}

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

      // 🌟 这里是终极修复点：把 /api/profiles/search 改成了 /api/search
      "/api/search": {
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
            const targetX = parseFloat(url.searchParams.get("x") || "50");
            const targetY = parseFloat(url.searchParams.get("y") || "50");

            const allProfiles = await sql`SELECT * FROM profiles`;
            if (!allProfiles || allProfiles.length === 0) return Response.json([]);

            const profilesWithDistance = allProfiles.map((p: any) => {
              const d2 = Math.pow(p.x - targetX, 2) + Math.pow(p.y - targetY, 2);
              return { ...p, distance: d2 };
            });

            const closest = profilesWithDistance
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 10);

            return Response.json(await getProfilesWithTags(closest));
          } catch (err) {
            console.error("雷达搜索失败:", err);
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
        DELETE: async (req) => {
          const rows = await sql`SELECT avatar FROM profiles WHERE id = ${req.params.id}`;
          if (rows[0]?.avatar) {
            try { unlinkSync(`.${rows[0].avatar}`); } catch (e) {}
          }
          const photos = await sql`SELECT path FROM photos WHERE profile_id = ${req.params.id}`;
          for (const photo of photos) {
            try { unlinkSync(`.${photo.path}`); } catch (e) {}
          }
          await sql`DELETE FROM profiles WHERE id = ${req.params.id}`;
          return Response.json({ success: true });
        }
      },

      "/api/profiles/:id/tags/:tag": {
        DELETE: async (req) => {
          await sql`DELETE FROM profile_tags WHERE profile_id = ${req.params.id} AND tag = ${req.params.tag}`;
          return Response.json({ success: true });
        }
      },

      "/api/photos/:id": {
        DELETE: async (req) => {
          const rows = await sql`SELECT path FROM photos WHERE id = ${req.params.id}`;
          if (rows[0]?.path) {
            try { unlinkSync(`.${rows[0].path}`); } catch (e) {}
          }
          await sql`DELETE FROM photos WHERE id = ${req.params.id}`;
          return Response.json({ success: true });
        }
      },

      "/api/profiles/:id/upload": {
        POST: async (req) => {
          const photoId = randomUUID();
          const formData = await req.formData();
          const file = formData.get("photo") as File;
          const caption = (formData.get("caption") as string) || "";
          if (!file) return Response.json({ error: "No file" }, { status: 400 });

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
    development: process.env.NODE_ENV === "development",
  });

  console.log(`Faceboook 2.0 running on port ${process.env.PORT || 3000}`);
}

startServer();
