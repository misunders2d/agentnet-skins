## Skin contribution checklist

- [ ] Package builds independently; declared assets, Host API v1 conformance and shared tests pass.
- [ ] Every added/changed gallery skin has a visible GitHub preview of the current real rendered implementation; mockups are labeled separately and do not replace screenshots.
- [ ] Previews cover desktop and mobile, plus light/dark where supported, using synthetic content only.
- [ ] Images inspected for private data/URLs, permissions for depicted content checked, and gallery inclusion reviewed by maintainers; captions record the tested revision.
- [ ] Visible changes refresh previews. Screenshots supplement tests; logs, keys and fixture data remain private.
- [ ] Previews use invented people and companies only; no trademarks, real people or private data.
- [ ] `gallery.json` filled and `npm run publish` re-run; `published/` committed and `npm run check` passes.
- [ ] `npm test` suite summary attached: which suites ran for this skin, and any failure explained.

See [CONTRIBUTING.md](../CONTRIBUTING.md). Describe the concrete change and validation. Link rendered previews and identify any unverified provider/platform behavior.
