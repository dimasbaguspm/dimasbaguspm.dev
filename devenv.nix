{ pkgs, ... }:
{
  # Keep parity with runtime: Node 22 (Docker/CI) + pnpm.
  languages.javascript = {
    enable = true;
    pnpm.enable = true;
    node = pkgs.nodejs_22;
  };

  # Local response cache — the site reads REDIS_HOST for cached GitHub fetches.
  services.redis.enable = true;

  # Dev defaults; secrets (GITHUB_TOKEN, UMAMI_*, OTEL_HOST) come from .env,
  # which devenv loads automatically via dotenv.
  dotenv.enable = true;
  env = {
    REDIS_HOST = "localhost:6379";
    OTEL_HOST = "";
    UMAMI_SRC = "";
    UMAMI_ID = "";
  };
}