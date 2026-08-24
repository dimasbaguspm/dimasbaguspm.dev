// Projects content store backed by GitHub (Phase 7). JSON files in
// src/content/projects on the GITHUB_CONTENT_BRANCH. Schema matches the `projects`
// data collection in src/content.config.ts.

import {
  getGithubConfig,
  getFile,
  putFile,
  deleteFile,
  listDir,
} from "./github";
import type { GithubConfig } from "./github";

export interface ProjectInput {
  name: string;
  url: string;
  repo?: string;
  blurb: string;
  order: number;
  tags?: string[];
  featured?: boolean;
}

const DIR = "src/content/projects";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

export async function listProjects(
  cfg: GithubConfig = getGithubConfig(),
): Promise<ProjectInput[]> {
  const entries = await listDir(cfg, DIR);
  const out: ProjectInput[] = [];
  for (const e of entries.filter((x) => x.name.endsWith(".json"))) {
    const f = await getFile(cfg, e.path);
    if (f) out.push(JSON.parse(f.content) as ProjectInput);
  }
  return out.sort((a, b) => a.order - b.order);
}

export async function getProject(
  slug: string,
  cfg: GithubConfig = getGithubConfig(),
): Promise<ProjectInput | null> {
  const file = await getFile(cfg, `${DIR}/${slug}.json`);
  return file ? (JSON.parse(file.content) as ProjectInput) : null;
}

export async function writeProject(
  input: ProjectInput,
  committer: { name: string; email: string },
  cfg: GithubConfig = getGithubConfig(),
): Promise<{ slug: string }> {
  const slug = slugify(input.name);
  const path = `${DIR}/${slug}.json`;
  const data: ProjectInput = {
    name: input.name,
    url: input.url,
    repo: input.repo || undefined,
    blurb: input.blurb,
    order: Number(input.order) || 0,
    tags: Array.isArray(input.tags) ? input.tags : [],
    featured: Boolean(input.featured),
  };
  const existing = await getFile(cfg, path);
  await putFile(
    cfg,
    path,
    JSON.stringify(data, null, 2) + "\n",
    `${existing ? "Update" : "Add"} project: ${input.name}`,
    existing?.sha,
    cfg.contentBranch,
    committer,
  );
  return { slug };
}

export async function deleteProject(
  slug: string,
  committer: { name: string; email: string },
  cfg: GithubConfig = getGithubConfig(),
): Promise<boolean> {
  const path = `${DIR}/${slug}.json`;
  const existing = await getFile(cfg, path);
  if (!existing) return false;
  await deleteFile(
    cfg,
    path,
    `Delete project: ${slug}`,
    existing.sha,
    cfg.contentBranch,
    committer,
  );
  return true;
}
