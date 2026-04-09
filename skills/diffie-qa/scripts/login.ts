#!/usr/bin/env bun

/**
 * Diffie QA Login Script
 *
 * Opens browser for OAuth login, catches the callback,
 * exchanges for a session token, creates an API token,
 * and saves it to ~/.diffie/credentials.json.
 *
 * Usage: bun run <this-file> [--api-url URL] [--auth-url URL]
 */

import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);

function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const API_URL = getArg("--api-url", "https://api.diffie.ai");
const AUTH_URL = getArg("--auth-url", "https://auth.diffie.ai");
const AUTH_CLIENT_ID = "diffie-web";
const CONFIG_DIR = path.join(os.homedir(), ".diffie");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");

// ── PKCE ────────────────────────────────────────────────────────────────────

function base64url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const codeVerifier = base64url(crypto.randomBytes(32));
const codeChallenge = base64url(
  crypto.createHash("sha256").update(codeVerifier).digest()
);

// ── Browser ─────────────────────────────────────────────────────────────────

function openBrowser(url: string): void {
  try {
    if (process.platform === "darwin") {
      execSync(`open "${url}"`);
    } else if (process.platform === "win32") {
      execSync(`start "" "${url}"`);
    } else {
      execSync(`xdg-open "${url}"`);
    }
  } catch {
    console.log(`Open this URL in your browser:\n  ${url}`);
  }
}

// ── Main Flow ───────────────────────────────────────────────────────────────

let redirectUri = "";

const authCode = await new Promise<string>((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, "http://localhost");
    if (url.pathname !== "/callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    res.writeHead(200, { "Content-Type": "text/html" });
    if (code) {
      res.end(
        "<html><body><h2>Login successful!</h2><p>You can close this tab and return to your terminal.</p></body></html>"
      );
      server.close();
      resolve(code);
    } else {
      res.end(
        `<html><body><h2>Login failed</h2><p>${error || "Unknown error"}</p></body></html>`
      );
      server.close();
      reject(new Error(error || "Unknown error"));
    }
  });

  server.listen(0, "127.0.0.1", () => {
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      reject(new Error("Failed to start local server"));
      return;
    }
    redirectUri = `http://localhost:${addr.port}/callback`;

    const authorizeUrl = new URL(`${AUTH_URL}/authorize`);
    authorizeUrl.searchParams.set("client_id", AUTH_CLIENT_ID);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    console.log("Opening browser for authentication...");
    openBrowser(authorizeUrl.toString());
    console.log("Waiting for login...");
  });

  setTimeout(() => {
    server.close();
    reject(new Error("Login timed out after 2 minutes"));
  }, 120_000);
});

// ── Exchange code for session token ─────────────────────────────────────────

console.log("Exchanging authorization code...");

const tokenRes = await fetch(`${AUTH_URL}/token`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    client_id: AUTH_CLIENT_ID,
    code: authCode,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  }),
});

if (!tokenRes.ok) {
  console.error(`Token exchange failed: ${await tokenRes.text()}`);
  process.exit(1);
}

const tokens = (await tokenRes.json()) as {
  access_token: string;
  refresh_token: string;
};

// ── Create API token using session token ────────────────────────────────────

console.log("Creating API token...");

const apiTokenRes = await fetch(`${API_URL}/settings/api-tokens`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${tokens.access_token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: `diffie-qa-cli-${new Date().toISOString().slice(0, 10)}`,
  }),
});

if (!apiTokenRes.ok) {
  console.error(`Failed to create API token: ${await apiTokenRes.text()}`);
  process.exit(1);
}

const apiTokenData = (await apiTokenRes.json()) as { token: string };

// ── Save credentials ────────────────────────────────────────────────────────

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

const credentials = {
  apiToken: apiTokenData.token,
  apiUrl: API_URL,
};

fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), {
  mode: 0o600,
});

console.log("Login successful!");
console.log(`API token saved to ${CREDENTIALS_FILE}`);
process.exit(0);
