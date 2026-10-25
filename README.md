# Barbacana documentation

Source of the Barbacana documentation site. Read the docs at **https://barbacana.dev/**.

Barbacana is an open-source WAF and API security gateway. The code lives at [barbacana-waf/barbacana](https://github.com/barbacana-waf/barbacana).

## Work on the docs

The site is built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/). Pages are under `docs/`, and the navigation is in `mkdocs.yml`.

```bash
make install   # install dependencies with uv
make serve     # preview at http://127.0.0.1:8000
make build     # strict build into site/
make deploy    # publish to GitHub Pages
```
