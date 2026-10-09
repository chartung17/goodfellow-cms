/** Set by the admin panel's build from `@goodfellow-cms/registry`'s version. */
declare const __GOODFELLOW_REGISTRY_VERSION__: string | undefined;

/** The release of Goodfellow's block registry this admin panel was built with, so a site gets blocks that match it. */
export const REGISTRY_VERSION =
  typeof __GOODFELLOW_REGISTRY_VERSION__ === "string" ? __GOODFELLOW_REGISTRY_VERSION__ : "latest";
