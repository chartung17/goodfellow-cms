import { GitApiError, SignInError } from "@goodfellow/core";

export interface ApiOptions {
  apiUrl: string;
  token: string;
  fetch: typeof fetch;
}

/** Calls the GitHub REST or GraphQL API. Treats 401 as an expired sign-in; other errors become `GitApiError`. */
export async function githubRequest(
  { apiUrl, token, fetch }: ApiOptions,
  path: string,
  init: { method?: string; body?: unknown; accept?: string; allow?: number[] } = {},
): Promise<Response> {
  const response = await fetch(`${apiUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      accept: init.accept ?? "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      ...(init.body !== undefined && { "content-type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (response.status === 401)
    throw new SignInError("invalid", "GitHub didn't accept the sign-in. It may have expired.");
  if (!response.ok && !init.allow?.includes(response.status)) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new GitApiError(
      response.status,
      `GitHub answered ${response.status}: ${body.message ?? response.statusText}`,
    );
  }
  return response;
}

export async function githubJson<T>(
  options: ApiOptions,
  path: string,
  init?: Parameters<typeof githubRequest>[2],
): Promise<T> {
  return (await (await githubRequest(options, path, init)).json()) as T;
}

/** Path segments of a repository name, encoded for URLs: `owner/name` stays `owner/name`. */
export function repoPath(repo: string): string {
  return repo
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}
