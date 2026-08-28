import { Octokit } from "@octokit/rest";
import { SpanStatusCode } from "@opentelemetry/api";
import { log, tracer } from "./otel";
import { cached } from "./cache";

const TOKEN = process.env.GITHUB_TOKEN ?? "";
const [OWNER, REPO] = (
  process.env.GITHUB_REPOSITORY ?? "dimasbaguspm/dimasbaguspm.dev"
).split("/");

export { OWNER, REPO };

const octokit = new Octokit({ auth: TOKEN || undefined });
export { octokit };

/** Runs a GitHub API call inside an OTEL span + error log. */
export async function gh<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      return await fn();
    } catch (e) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (e as Error).message,
      });
      log.error("github request failed", {
        operation: name,
        error: (e as Error).message,
      });
      throw e;
    } finally {
      span.end();
    }
  });
}

export async function listFiles(path: string) {
  return cached(`files:${path}`, () =>
    gh("github.listFiles", async () => {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: OWNER,
          repo: REPO,
          path,
        });
        return Array.isArray(data) ? data : [];
      } catch {
        return []; // 404 or rate-limited → degrade
      }
    }),
  );
}

export async function readFile(path: string): Promise<string | null> {
  return cached(`file:${path}`, () =>
    gh("github.readFile", async () => {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner: OWNER,
          repo: REPO,
          path,
        });
        if (Array.isArray(data) || data.type !== "file") return null;
        return Buffer.from(data.content, "base64").toString("utf8");
      } catch {
        return null; // 404 or rate-limited → treat as missing
      }
    }),
  );
}
