import { OWNER, gh, octokit } from "./github";
import { cached } from "./cache";

export interface Repo {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  homepage: string | null;
  topics: string[];
  url: string;
}

export interface ProjectAsset {
  name: string;
  url: string;
  video: boolean;
}

async function listRepos(): Promise<Repo[]> {
  return cached("repos", async () => {
    const { data } = await gh("github.listRepos", () =>
      octokit.rest.repos.listForUser({ username: OWNER, per_page: 100 }),
    );
    return data
      .filter((r) => !r.fork)
      .map((r) => ({
        name: r.name,
        description: r.description,
        language: r.language ?? null,
        stars: r.stargazers_count ?? 0,
        forks: r.forks_count ?? 0,
        homepage: r.homepage ?? null,
        topics: r.topics ?? [],
        url: r.html_url,
      }))
      .sort((a, b) => b.stars - a.stars);
  });
}

/** All repos tagged with a topic, e.g. "personal-project". */
export async function listProjectsByTag(
  tag = "personal-project",
): Promise<Repo[]> {
  return (await listRepos()).filter((r) => r.topics.includes(tag));
}

export async function getProject(slug: string): Promise<Repo | null> {
  const repos = await listRepos();
  return repos.find((r) => r.name.toLowerCase() === slug.toLowerCase()) ?? null;
}

/** Assets in docs/preview/* (images + video) for the Preview carousel. */
export async function listPreviewAssets(
  repoName: string,
): Promise<ProjectAsset[]> {
  return cached(`preview:${repoName}`, () =>
    gh("github.listPreview", async () => {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: OWNER,
          repo: repoName,
          path: "docs/preview",
        });
        if (!Array.isArray(data)) return [];
        return data
          .filter((f) => f.type === "file" && f.download_url)
          .map((f) => ({
            name: f.name,
            url: f.download_url as string,
            video: /\.(mp4|webm|mkv|mov)$/i.test(f.name),
          }))
          .filter(
            (a) => a.video || /\.(jpe?g|png|gif|webp|avif)$/i.test(a.name),
          );
      } catch {
        return []; // no docs/preview dir
      }
    }),
  );
}

/** docs/ENGINEERING_SPEC.md content (our own format = markdown + frontmatter). */
export async function getEngineeringSpec(
  repoName: string,
): Promise<string | null> {
  return cached(`spec:${repoName}`, () =>
    gh("github.getSpec", async () => {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: OWNER,
          repo: repoName,
          path: "docs/ENGINEERING_SPEC.md",
        });
        if (Array.isArray(data) || data.type !== "file") return null;
        return Buffer.from(data.content, "base64").toString("utf8");
      } catch {
        return null; // no spec file
      }
    }),
  );
}
