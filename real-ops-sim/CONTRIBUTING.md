# Contributing

Thanks for considering a contribution. This project is small on purpose — every file should earn its place.

## What we want

- **Performance quick-reference sheets** for popular sim aircraft. Follow the YAML shape of the existing files in `data/performance/`. Cite your source (freely available OEM figures, community mod documentation, published charts). Do not paste anything from a payware AFM.
- **Type-specific SOP variants** — e.g. a B738 takeoff briefing, an A320 approach briefing. Keep the same structure as the generic templates; add only what genuinely differs.
- **Training scenarios** — one page each, structured the same as the existing ones. Focus on scenarios you can actually recreate reliably in MSFS 2024 or X-Plane 12.
- **Translations** — Spanish, German, French, Portuguese, Italian, Japanese. Put translated files in `docs/<lang>/` mirroring the English structure.

## What we do not want

- Copyrighted material from operator manuals, Jeppesen charts, or payware AFMs.
- Speculative "how I think a real crew does it" without a source. Cite freely available OEM/regulator sources (FCOM excerpts published by OEMs, EASA/FAA advisory material, AC 120-71B on SOPs, etc.).
- Aircraft-specific procedures for aircraft with no meaningful sim representation.

## Style

- Markdown, `##` for main sections, plain sentences, no emoji.
- YAML performance files: 2-space indent, keys in `snake_case`, weights in kg, distances in metres, speeds in knots. Include a `notes` block explaining assumptions and source.
- Keep each file focused. If a template grows past ~200 lines, split it.

## Process

1. Open an issue first for anything larger than a typo or a single template. Describe the aircraft or topic and cite your sources.
2. Fork, branch, PR. One topic per PR.
3. A maintainer (usually [@glapira](https://github.com/glapira)) will review. Expect real feedback — this is a training-oriented project and precision matters.

## Code of conduct

Be direct, be technical, be kind. This is a small aviation-nerd community. Treat contributors the way you would want a Line Training Captain to treat a new First Officer: brief, honest, and focused on the flying.
