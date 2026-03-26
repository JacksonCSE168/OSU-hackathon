import { sql } from "bun";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";

try { mkdirSync("./uploads", { recursive: true }); } catch (e) {}

import indexHtml from "./index.html";
import profileHtml from "./profile.html";

// 建表（已存在则跳过）
await sql`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT,
    created_at BIGINT DEFAULT extract(epoch from now())
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    profile_id TEXT REFERENCES profiles(id),
    path TEXT NOT NULL,
    caption TEXT DEFAULT '',
    created_at BIGINT DEFAULT extract(epoch from now())
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS profile_tags (
    profile_id TEXT REFERENCES profiles(id),
    tag TEXT NOT NULL
  )
`;

async function getProfilesWithTags(rows: any[]): Promise<any[]> {
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

        if (!name?.trim()) {
          return Response.json({ error: "Name is required" }, { status: 400 });
        }

        const id = randomUUID();
        let avatarPath: string | null = null;

        if (avatarFile && avatarFile.size > 0) {
          const ext = avatarFile.name.split(".").pop();
          const filename = `${id}-avatar.${ext}`;
          await Bun.write(`./uploads/${filename}`, avatarFile);
          avatarPath = `/uploads/${filename}`;
        }

        await sql`INSERT INTO profiles (id, name, avatar) VALUES (${id}, ${name.trim()}, ${avatarPath})`;

        for (const tag of tags) {
          if (tag.trim()) {
            await sql`INSERT INTO profile_tags (profile_id, tag) VALUES (${id}, ${tag.trim().toLowerCase()})`;
          }
        }

        return Response.json({ id, name: name.trim(), avatar: avatarPath, tags });
      },
    },

    "/api/profiles/search": {
      GET: async (req) => {
        const url = new URL(req.url);
        const tag = url.searchParams.get("tag")?.trim().toLowerCase();
        if (!tag) return Response.json([]);

        const profiles = await sql`
          SELECT DISTINCT p.* FROM profiles p
          JOIN profile_tags pt ON p.id = pt.profile_id
          WHERE pt.tag = ${tag}
          ORDER BY p.created_at DESC
        `;
        return Response.json(await getProfilesWithTags(profiles));
      },
    },

    "/api/profiles/:id": {
      GET: async (req) => {
        const rows = await sql`SELECT * FROM profiles WHERE id = ${req.params.id}`;
        const profile = rows[0];
        if (!profile) return Response.json({ error: "Not found" }, { status: 404 });

        const photos = await sql`SELECT * FROM photos WHERE profile_id = ${req.params.id} ORDER BY created_at DESC`;
        const tagRows = await sql`SELECT tag FROM profile_tags WHERE profile_id = ${req.params.id}`;

        return Response.json({ ...profile, photos, tags: tagRows.map((r: any) => r.tag) });
      },
    },

    "/api/profiles/:id/upload": {
      POST: async (req) => {
        const rows = await sql`SELECT * FROM profiles WHERE id = ${req.params.id}`;
        if (!rows[0]) return Response.json({ error: "Not found" }, { status: 404 });

        const formData = await req.formData();
        const file = formData.get("photo") as File;
        const caption = (formData.get("caption") as string) || "";

        if (!file || file.size === 0) {
          return Response.json({ error: "No file provided" }, { status: 400 });
        }

        const photoId = randomUUID();
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
