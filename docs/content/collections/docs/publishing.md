---
version: 1
title: Publishing
description: How publishing works, how long it takes, and what happens when two people edit at once.
section: editors
order: 2
---

**Publish** saves what you changed to the site's repository on GitHub or GitLab, as one change, from your own browser. The host then rebuilds the site, usually within a minute or two, and the top of the admin panel shows when the live site has been updated, or that the rebuild failed, with a link to the details.

## Working with other editors

Several people can edit the same site. If someone else published changes to other pages while you were editing, publishing still goes ahead. If they changed the same page or file, publishing stops and explains what happened, instead of overwriting their work; reload the page to see their version, then make your change again.

## Unpublished changes

Leaving a screen with unpublished changes asks first, so nothing is lost by accident. Changes aren't saved anywhere until you publish, so publish before closing the tab.

## In development

When the site runs on your own computer with `npm run dev`, Publish writes straight to the files in `content/`, with no sign-in.
