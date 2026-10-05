/** OAuth 2.0 with PKCE: lets the browser sign in to GitLab without any server or client secret. */

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomString(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export interface OAuthTokens {
  type: "oauth";
  access: string;
  refresh: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
  verifier: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  created_at?: number;
}

export function toTokens(response: TokenResponse, verifier: string, now = Date.now()): OAuthTokens {
  return {
    type: "oauth",
    access: response.access_token,
    refresh: response.refresh_token,
    expiresAt: now + (response.expires_in ?? 7200) * 1000,
    verifier,
  };
}

/** The admin panel's address, with a trailing slash so it always matches the redirect URI registered with GitLab. */
export function redirectUri(href: string): string {
  const url = new URL(href);
  return `${url.origin}${url.pathname.replace(/\/?$/, "/")}`;
}
