import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";
import indexHtml from "./index.html";
import profileHtml from "./profile.html";

// Setup SQLite database
const db = new Database("faceboook.db", { create: true });

db.run(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    profile_id TEXT REFERENCES profiles(id),
    path TEXT NOT NULL,
    caption TEXT DEFAULT '',
    created_at INTEGER DEFAULT (unixepoch())
  )
`);

Bun.serve({
  port: 3000,
  hostname: "0.0.0.0",
  routes: {
    "/": indexHtml,
    "/profile/:id": profileHtml,

    "/api/profiles": {
      GET: () => {
        const profiles = db
          .query("SELECT * FROM profiles ORDER BY created_at DESC")
          .all();
        return Response.json(profiles);
      },
      POST: async (req) => {
        const formData = await req.formData();
        const name = formData.get("name") as string;
        const avatarFile = formData.get("avatar") as File | null;

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

        db.run("INSERT INTO profiles (id, name, avatar) VALUES (?, ?, ?)", [
          id,
          name.trim(),
          avatarPath,
        ]);

        return Response.json({ id, name: name.trim(), avatar: avatarPath });
      },
    },

    "/api/profiles/:id": {
      GET: (req) => {
        const profile = db
          .query("SELECT * FROM profiles WHERE id = ?")
          .get(req.params.id);
        if (!profile)
          return Response.json({ error: "Not found" }, { status: 404 });

        const photos = db
          .query(
            "SELECT * FROM photos WHERE profile_id = ? ORDER BY created_at DESC"
          )
          .all(req.params.id);

        return Response.json({ ...(profile as object), photos });
      },
    },

    "/api/profiles/:id/upload": {
      POST: async (req) => {
        const profile = db
          .query("SELECT * FROM profiles WHERE id = ?")
          .get(req.params.id);
        if (!profile)
          return Response.json({ error: "Not found" }, { status: 404 });

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
        db.run(
          "INSERT INTO photos (id, profile_id, path, caption) VALUES (?, ?, ?, ?)",
          [photoId, req.params.id, path, caption]
        );

        return Response.json({ id: photoId, path, caption });
      },
    },

    "/uploads/:filename": (req) => {
      const file = Bun.file(`./uploads/${req.params.filename}`);
      return new Response(file);
    },
  },
  development: {
    hmr: true,
    console: true,
  },
});

console.log("Faceboook 2.0 running at http://localhost:3000");
