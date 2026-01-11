import type { Config } from "./types";

export async function loadConfig() {
  const fs = await import("fs");
  const path = await import("path");

  // Load environment file
  const loadEnvFile = (filePath: string): Record<string, string> => {
    const env: Record<string, string> = {};
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...valueParts] = trimmed.split("=");
          if (key) {
            env[key.trim()] = valueParts
              .join("=")
              .trim()
              .replace(/^["']|["']$/g, "");
          }
        }
      }
    }
    return env;
  };

  const env = loadEnvFile(".env");

  // Get environment file paths (with defaults)
  const backendEnvPath =
    env.BACKEND_ENV_FILE || process.env.BACKEND_ENV_FILE || ".env.backend";
  const frontendEnvPath =
    env.FRONTEND_ENV_FILE || process.env.FRONTEND_ENV_FILE || ".env.frontend";

  // Verify environment files exist
  if (!fs.existsSync(backendEnvPath)) {
    throw new Error(
      `Backend environment file not found: ${backendEnvPath}\n` +
        `Please create it or update BACKEND_ENV_FILE in .env`
    );
  }

  if (!fs.existsSync(frontendEnvPath)) {
    throw new Error(
      `Frontend environment file not found: ${frontendEnvPath}\n` +
        `Please create it or update FRONTEND_ENV_FILE in .env`
    );
  }

  const config: Config = {
    appName: env.APP_NAME || process.env.APP_NAME || "app",
    ip: env.SERVER_IP || process.env.SERVER_IP!,
    user: env.SSH_USER || process.env.SSH_USER || "root",
    key: fs.readFileSync(env.SSH_KEY_PATH || process.env.SSH_KEY_PATH!, "utf-8"),
    repo: (env.GIT_REPO_URL || process.env.GIT_REPO_URL!).replace(
      "https://",
      `https://${env.GIT_TOKEN || process.env.GIT_TOKEN}@`
    ),
    branch: env.GIT_BRANCH || process.env.GIT_BRANCH || "main",
    domain: env.DOMAIN || process.env.DOMAIN!,
    nodeVersion: env.NODE_VERSION || process.env.NODE_VERSION || "22",
    deploymentPath:
      env.DEPLOYMENT_PATH ||
      process.env.DEPLOYMENT_PATH ||
      `/var/www/${env.APP_NAME || "app"}`,
    envBackend: fs.readFileSync(backendEnvPath, "utf-8"),
    envFrontend: fs.readFileSync(frontendEnvPath, "utf-8"),
  };

  if (!config.ip || !config.key || !config.repo || !config.domain) {
    throw new Error(
      "Missing required environment variables. Check your .env file."
    );
  }

  // Log which environment files are being used
  console.log(`📋 Using environment files:`);
  console.log(`   Backend:  ${backendEnvPath}`);
  console.log(`   Frontend: ${frontendEnvPath}`);
  console.log("");

  return config;
}
