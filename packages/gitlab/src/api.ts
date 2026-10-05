import { GitApiError, SignInError } from "@goodfellow/core";

export interface ApiOptions {
  /** The API root, such as `https://gitlab.com/api/v4`. */
  apiUrl: string;
  /** Returns a current access token, refreshing it if needed. */
  token: (options?: { refresh?: boolean }) => Promise<string>;
  /** Whether the token can be refreshed after a 401. */
  canRefresh: boolean;
  fetch: typeof fetch;
}

/** Calls the GitLab API. A 401 refreshes the token once; after that it means the sign-in has expired. */
export async function gitlabRequest(
  api: ApiOptions,
  path: string,
  init: { method?: string; body?: unknown; allow?: number[] } = {},
): Promise<Response> {
  const send = async (refresh: boolean) =>
    api.fetch(`${api.apiUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${await api.token({ refresh })}`,
        ...(init.body !== undefined && { "content-type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });

  let response = await send(false);
  if (response.status === 401 && api.canRefresh) response = await send(true);
  if (response.status === 401)
    throw new SignInError("invalid", "GitLab didn't accept the sign-in. It may have expired.");
  if (!response.ok && !init.allow?.includes(response.status)) {
    const body = (await response.json().catch(() => ({}))) as { message?: unknown; error?: string };
    const message = typeof body.message === "string" ? body.message : JSON.stringify(body.message ?? body.error ?? "");
    throw new GitApiError(response.status, `GitLab answered ${response.status}: ${message || response.statusText}`);
  }
  return response;
}

export async function gitlabJson<T>(
  api: ApiOptions,
  path: string,
  init?: Parameters<typeof gitlabRequest>[2],
): Promise<T> {
  return (await (await gitlabRequest(api, path, init)).json()) as T;
}
