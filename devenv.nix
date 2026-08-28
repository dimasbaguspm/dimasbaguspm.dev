{ pkgs, ... }:
{
  # Parity with runtime: Node + pnpm (devenv's default nodejs).
  languages.javascript = {
    enable = true;
    pnpm.enable = true;
  };

  # Local response cache — the site reads REDIS_HOST for cached GitHub fetches.
  services.redis.enable = true;

  # Dev defaults (non-secret). Secrets like GITHUB_TOKEN: export in your shell —
  # this devenv CLI has no dotenv integration.
  env = {
    REDIS_HOST = "localhost:6379";
    OTEL_HOST = "";
    UMAMI_SRC = "";
    UMAMI_ID = "";
  };
}