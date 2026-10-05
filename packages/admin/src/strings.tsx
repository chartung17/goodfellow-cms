import { createContext, type ReactNode, useContext, useMemo } from "react";

/**
 * Every piece of text the admin panel shows, so it can be reworded or
 * translated. `{name}` placeholders are filled in when the text is used.
 * Puck's own editor text is translated separately, with its `dictionary`.
 */
export const defaultStrings = {
  "app.title": "Site admin",
  "app.viewSite": "View site",
  "nav.pages": "Pages",
  "nav.layout": "Header & footer",
  "nav.settings": "Site settings",

  loading: "Loading…",

  "setup.noBackend":
    "This site's settings don't say where the site is stored, so the admin panel can't open it. A developer needs to add a backend to goodfellow.config.tsx.",
  "signIn.title": "Sign in to edit this site",
  "signIn.intro": "The site is stored on {host}. Sign in with a {host} account that's allowed to change it.",
  "signIn.redirect": "Sign in with {host}",
  "signIn.orToken": "Or sign in with an access token",
  "signIn.token.title": "Sign in with an access token",
  "signIn.token.step1":
    "Create an access token on {host}. This link opens {host} with the right settings already chosen:",
  "signIn.token.create": "Create a token on {host}",
  "signIn.token.createBroad": "Create a broader token instead",
  "signIn.token.createBroadHint":
    "Use this if the site belongs to someone else and the first link doesn't let you choose it. This kind of token can change everything your account can.",
  "signIn.token.chooseSite": "If {host} asks what the token can access, choose this site.",
  "signIn.token.step2": "Copy the token and paste it here:",
  "signIn.token.label": "Access token",
  "signIn.remember": "Stay signed in on this device",
  "signIn.rememberHint": "Leave this off on shared or public computers.",
  "signIn.submit": "Sign in",
  "signIn.checking": "Signing in…",
  "signIn.error.invalid": "That sign-in didn't work. Check that the whole token was copied and that it hasn't expired.",
  "signIn.error.no-access": "That account can't see this site. Make sure the token was given access to it.",
  "signIn.error.cant-publish":
    "That account can see the site but isn't allowed to change it. Ask the site's owner to give it permission.",
  "signIn.error.redirect-failed": "Signing in didn't finish. Try again.",
  "signIn.error.expired": "You were signed out because your sign-in expired. Sign in again to keep editing.",
  "signIn.error.other": "Couldn't reach {host}. Check your connection and try again.",
  "account.signedInAs": "Signed in as {name}",
  "account.signOut": "Sign out",
  "deploy.building": "Updating the live site…",
  "deploy.live": "The live site is up to date",
  "deploy.failed": "The live site couldn't be updated",
  "deploy.details": "Details",
  "loadError.title": "The admin panel couldn't open this site",
  "loadError.contentProblems": "Some of the site's files have problems, so they can't be edited until they're fixed.",
  "loadError.other": "Something went wrong while loading the site. Check your connection and try again.",
  "action.tryAgain": "Try again",
  "action.cancel": "Cancel",
  "action.close": "Close",
  "action.reload": "Reload",
  "details.show": "Details",

  "publish.button": "Publish",
  "publish.publishing": "Publishing…",
  "publish.done": "Published.",
  "publish.conflict":
    "Someone else changed the site since you opened this page, so your changes weren't published. Reload to see their changes, then make yours again.",
  "publish.error": "Your changes couldn't be published. Check your connection and try again.",
  "publish.invalid": "Fix the highlighted problems before publishing.",
  "unsaved.confirm": "You have changes that aren't published yet. Leave anyway and lose them?",
  "unsaved.label": "Unpublished changes",

  "pages.title": "Pages",
  "pages.new": "New page",
  "pages.empty": "This site has no pages yet.",
  "pages.column.title": "Title",
  "pages.column.address": "Address",
  "pages.edit": "Edit",
  "pages.move": "Change address",
  "pages.delete": "Delete",
  "pages.view": "View",
  "pages.homeCantDelete": "The home page can't be deleted.",

  "newPage.title": "New page",
  "newPage.pageTitle": "Page title",
  "newPage.address": "Address",
  "newPage.addressHint": "The part of the web address after the site's name, such as /about or /events/picnic.",
  "newPage.create": "Create page",
  "newPage.message": 'Add page "{title}"',

  "movePage.title": "Change the address of {title}",
  "movePage.address": "New address",
  "movePage.updateLinks": "Update menu links to this page",
  "movePage.warning":
    "Links to the old address elsewhere, such as in page text or on other websites, will stop working.",
  "movePage.submit": "Change address",
  "movePage.message": 'Move page "{title}" from {from} to {to}',

  "deletePage.title": "Delete {title}?",
  "deletePage.body": "The page at {path} will be removed from the site. Menu links to it will stop working.",
  "deletePage.submit": "Delete page",
  "deletePage.message": 'Delete page "{title}"',

  "address.invalid": "Use lowercase letters, numbers and hyphens, with / between parts, such as /about-us.",
  "address.reserved": "This address is used by the admin panel. Choose another.",
  "address.taken": "Another page already uses this address.",
  "field.required": "This can't be empty.",

  "editPage.message": 'Update page "{title}"',
  "editPage.notFound": "This page doesn't exist. It may have been moved or deleted.",
  "editPage.backToPages": "Back to pages",

  "layout.header": "Header",
  "layout.footer": "Footer",
  "layout.headerMessage": "Update the header",
  "layout.footerMessage": "Update the footer",

  "settings.title": "Site settings",
  "settings.tab.general": "General",
  "settings.tab.theme": "Colors & fonts",
  "settings.tab.menus": "Menus",
  "settings.tab.css": "Custom CSS",
  "settings.message": "Update site settings",
  "settings.preview": "Preview of the home page",
  "settings.previewEmpty": "Add a home page to see a preview here.",

  "general.siteTitle": "Site name",
  "general.description": "Description",
  "general.descriptionHint": "Shown by search engines when a page doesn't have its own description.",
  "general.url": "Site address",
  "general.urlHint": "The full public address, such as https://example.org. Used for search engines and link previews.",
  "general.language": "Language code",
  "general.languageHint": "Such as en, es or fr.",
  "general.titleTemplate": "Browser tab title",
  "general.titleTemplateHint": '%s is replaced by the page title, so "%s | My site" shows "About | My site".',
  "general.favicon": "Browser tab icon (URL)",
  "general.logo": "Logo (URL)",
  "general.logoAlt": "Logo description",
  "general.socialImage": "Image when shared on social media (URL)",

  "theme.colors": "Colors",
  "theme.fonts": "Fonts",
  "theme.fontsHint":
    "Any font name from Google Fonts, such as Inter or Playfair Display. Leave empty for the device's standard font.",
  "theme.headingFont": "Headings",
  "theme.bodyFont": "Text",
  "theme.radius": "Corner rounding",
  "theme.radiusHint": "Such as 0.5rem, or 0 for square corners.",
  "theme.color.background": "Background",
  "theme.color.foreground": "Text",
  "theme.color.primary": "Main color",
  "theme.color.primaryForeground": "Text on main color",
  "theme.color.secondary": "Second color",
  "theme.color.secondaryForeground": "Text on second color",
  "theme.color.muted": "Subtle background",
  "theme.color.mutedForeground": "Subtle text",
  "theme.color.accent": "Highlight",
  "theme.color.accentForeground": "Text on highlight",
  "theme.color.border": "Borders",
  "theme.default": "Default",
  "theme.pickColor": "Choose a color for {name}",

  "menus.intro": "Menus are lists of links. Show one anywhere with the Menu block, using its name.",
  "menus.empty": "There are no menus yet.",
  "menus.add": "Add menu",
  "menus.newName": "New menu name",
  "menus.nameInvalid": "Use lowercase letters, numbers and hyphens, and a name no other menu uses.",
  "menus.deleteMenu": "Delete menu",
  "menus.addLink": "Add link",
  "menus.addSublink": "Add link below this one",
  "menus.label": "Label",
  "menus.href": "Link to",
  "menus.moveUp": "Move up",
  "menus.moveDown": "Move down",
  "menus.remove": "Remove",
  "menus.newLink": "New link",

  "css.intro": "CSS here applies to every page and overrides the blocks' own styles. Tailwind's @apply works too.",
  "css.label": "Custom CSS",
} as const;

export type StringKey = keyof typeof defaultStrings;
export type Strings = Record<StringKey, string>;

const StringsContext = createContext<Strings>(defaultStrings);

export function StringsProvider({ strings, children }: { strings?: Partial<Strings>; children: ReactNode }) {
  const value = useMemo(() => ({ ...defaultStrings, ...strings }), [strings]);
  return <StringsContext.Provider value={value}>{children}</StringsContext.Provider>;
}

export type Translate = (key: StringKey, values?: Record<string, string>) => string;

/** Returns `t(key, values)`, which looks up a string and fills in its `{placeholders}`. */
export function useStrings(): Translate {
  const strings = useContext(StringsContext);
  return (key, values) => strings[key].replace(/\{(\w+)\}/g, (match, name: string) => values?.[name] ?? match);
}
