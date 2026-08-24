// Read/write highlighted project entries as JSON files under src/content/projects.
// Schemas are defined in src/content.config.ts (the `projects` collection). Writes
// by the admin API must keep the same shape the collection expects.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECTS_DIR = process.env.CONTENT_DIR
  ? path.join(process.env.CONTENT_DIR, "projects")
  : path.resolve(__dirname, "../../content/projects");

export interface ProjectInput {
  name: string;
  url: string;
  repo?: string;
  blurb: string;
  order: number;
  tags?: string[];
  featured?: boolean;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

function safeFile(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!base.endsWith(".json")) return `${base}.json`;
  return base;
}

export function listProjects(): ProjectInput[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs
    .readdirSync(PROJECTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map(
      (f) =>
        JSON.parse(
          fs.readFileSync(path.join(PROJECTS_DIR, f), "utf8"),
        ) as ProjectInput,
    );
}

export function getProject(slug: string): ProjectInput | null {
  const file = safeFile(slug);
  const p = path.join(PROJECTS_DIR, file);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as ProjectInput;
}

export function writeProject(input: ProjectInput): {
  slug: string;
  file: string;
} {
  const slug = slugify(input.name);
  const file = path.join(PROJECTS_DIR, `${slug}.json`);
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  const data: ProjectInput = {
    name: input.name,
    url: input.url,
    repo: input.repo || undefined,
    blurb: input.blurb,
    order: Number(input.order) || 0,
    tags: Array.isArray(input.tags) ? input.tags : [],
    featured: Boolean(input.featured),
  };
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  return { slug, file };
}

export function deleteProject(slug: string): boolean {
  const file = path.join(PROJECTS_DIR, safeFile(slug));
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    return true;
  }
  return false;
}
