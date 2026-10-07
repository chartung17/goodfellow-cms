---
version: 1
title: Editors and sign-in
description: How editors sign in with GitHub or GitLab, what permissions they need, and how their sign-in is kept.
section: owners
order: 2
---

Editors sign in at `/admin` on the live site with their own GitHub or GitLab account. There's no separate list of users: anyone who can change the site's repository can edit the site.

## GitHub

Editors sign in with a personal access token. The admin panel's **Create a token on GitHub** link opens GitHub's token page with the right permissions already chosen; under **Repository access**, choose **Only select repositories** and pick the site. Paste the token into the admin panel.

Every editor needs write access to the repository. GitHub doesn't let collaborators on someone else's personal repository use these fine-grained tokens, so either:

- put the repository in a free GitHub organization and add editors as members, or
- have collaborators use the **Create a broader token instead** link, which creates a classic token.

## GitLab

With the site's application registered (see [Put it online](/docs/put-it-online#4-set-up-sign-in)), editors click **Sign in with GitLab**. Without it, or as an alternative, they sign in with a personal access token. Editors need the Developer role or higher.

## Staying signed in

Editors choose whether to stay signed in on the device (**Stay signed in on this device**; leave it off on shared computers). Otherwise the sign-in lasts until the browser tab closes. **Sign out** forgets the token, and the AI keys entered in the AI tab too.

Tokens are only ever sent to GitHub or GitLab, never anywhere else. If a token stops working, for example because it expired, the admin panel asks to sign in again.
