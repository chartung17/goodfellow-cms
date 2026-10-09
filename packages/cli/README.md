# goodfellow

The `goodfellow` command: builds a site into static files, runs the development server with the admin panel at `/admin`, and previews a build.

```sh
npx goodfellow dev       # http://localhost:4321, admin panel at /admin
npx goodfellow build     # writes the site to dist/
npx goodfellow preview   # serves dist/
```

[Goodfellow](https://github.com/chartung17/goodfellow-cms) is a website builder for people who aren't developers, with no server or database: pages are files in your own GitHub or GitLab repository, edited in a visual editor built on [Puck](https://puckeditor.com). To start a new site, run `npm create goodfellow@latest my-site`. See the [documentation](https://chartung17.github.io/goodfellow-cms/) for everything else.

More in the docs: [Commands](https://chartung17.github.io/goodfellow-cms/docs/commands).

## License

MIT
