import { classNameField, cx } from "@goodfellow-cms/react";
import type { ComponentConfig } from "@puckeditor/core";
import { SiteSetupForm } from "./site-setup-form";

export interface SiteSetupProps {
  gitlabClientId: string;
  className: string;
}

/**
 * The setup page's form, which creates a site in someone's GitHub or GitLab
 * account from their browser, as `npm create goodfellow` does on a computer.
 */
export const SiteSetup: ComponentConfig<SiteSetupProps> = {
  label: "Site setup",
  fields: {
    gitlabClientId: {
      type: "text",
      label: "GitLab application ID, for “Sign in with GitLab” (leave empty to sign in with a token)",
    },
    className: classNameField,
  },
  defaultProps: { gitlabClientId: "", className: "" },
  render: ({ gitlabClientId, className }) => (
    <div className={cx("mx-auto w-full max-w-3xl", className)}>
      <SiteSetupForm gitlabClientId={gitlabClientId} />
    </div>
  ),
};
