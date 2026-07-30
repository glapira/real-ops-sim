# real-ops-sim

**Real-world airline and business-jet operating procedures, briefings, and performance references — adapted for Microsoft Flight Simulator 2024 and X-Plane 12 by a Line Training Captain / TRI.**

Most sim SOPs and briefings on the internet are written by hobbyists working from YouTube videos. This project is different: the material here is derived from the way real commercial and business-jet crews actually brief, call out, and fly. It has been sanitised and adapted so that home simmers can practice with the same rhythm, structure, and threat-and-error mindset that line pilots use in the real cockpit.

The goal is to raise the floor of realism for serious simmers — VATSIM/IVAO controllers, virtual airline pilots, aspiring commercial pilots training their scan and callouts before ground school, and anyone who wants their sim flying to feel like real ops instead of like a video game.

## Who this is for

- Simmers on **MSFS 2024** or **X-Plane 12** who want structured, realistic briefings and callouts instead of freelancing them.
- Virtual airlines and VATSIM/IVAO groups looking for a common set of briefing templates to standardise their pilots.
- Ab-initio students who want to internalise professional briefing structure before starting real flight training.
- Instructors on the sim side (many virtual airline "training captains" have never seen a real airline briefing template).

## What's here

```
real-ops-sim/
├── docs/
│   ├── briefings/               Takeoff, approach, descent, and threat briefing templates
│   ├── callouts/                Standard flight-deck callouts (generic + type-specific notes)
│   └── training-scenarios/      One-page instructor lesson plans for common sim training events
├── data/
│   └── performance/             Structured performance quick-reference sheets (YAML)
├── CONTRIBUTING.md
├── LICENSE                      MIT
└── README.md
```

Everything is plain Markdown and YAML by design. No install, no build step, nothing to break. Read it in a browser, print it, paste it into your kneeboard app, or feed the YAML into your own tools.

## Contents (v0.1)

### Briefings — `docs/briefings/`
- [Takeoff briefing template](docs/briefings/takeoff-briefing.md)
- [Approach & landing briefing template](docs/briefings/approach-briefing.md)
- [Descent & arrival briefing template](docs/briefings/descent-briefing.md)
- [Threat & Error Management (TEM) prompts](docs/briefings/threat-and-error-management.md)

### Standard callouts — `docs/callouts/`
- [Generic two-crew callouts (takeoff → cruise → landing)](docs/callouts/standard-callouts.md)

### Training scenarios — `docs/training-scenarios/`
- [Rejected takeoff (low-speed and high-speed regime)](docs/training-scenarios/rejected-takeoff.md)
- [Engine failure at/after V1](docs/training-scenarios/engine-failure-v1.md)
- [Unstable approach → go-around](docs/training-scenarios/unstable-approach-goaround.md)

### Performance quick-references — `data/performance/`
- [Default MSFS Boeing 747-8I](data/performance/b747-8i.yaml)
- [FlyByWire A32NX (community A320neo)](data/performance/a32nx.yaml)
- [Default MSFS Daher TBM 930](data/performance/tbm930.yaml)

Each file is a small, structured YAML sheet with V-speeds, typical fuel burns, landing distance rules of thumb, and reference weights. It is not a substitute for AFM data — it is a fast in-cockpit reference for sim use.

## How to use it

1. Pick the briefing template that fits the phase of flight.
2. Copy it into your kneeboard, EFB app, or a text file on your second monitor.
3. Fill in the fields *before* you push takeoff, top of descent, or start the approach — same as a real crew.
4. Read it out loud. That is the point. Briefings work because they force you to think ahead and to *hear yourself commit to* a plan.

## Why this project exists

Real crews do not improvise. They follow a rhythm — brief, call, monitor, cross-check, act — that has been refined over decades and is the single biggest reason large aircraft fly as safely as they do. Home simmers rarely get exposed to that rhythm, and when they do it is often a garbled second-hand version.

This repo is a small, opinionated attempt to close that gap, contributed to the community by someone who does this job in real life.

## Contributing

Contributions are very welcome — especially:
- Performance quick-reference sheets for other popular sim aircraft.
- Type-specific callouts and SOP variants (with citations to public OEM/operator sources).
- Translations (Spanish, German, French, Portuguese).

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Disclaimer

**This material is for flight-simulation use only.** It is not authorised for real-world flight operations, is not derived from any specific operator's manuals, and does not replace an AFM, OM-A/B/C, or any regulatory document. Real pilots must fly to their own operator's SOPs.

## License

[MIT](LICENSE). Use it, fork it, adapt it, ship it in your own tools.

## Maintainer

Maintained by [@glapira](https://github.com/glapira) — a working Line Training Captain / TRI. Feedback from real-world pilots and serious simmers welcome via GitHub Issues.
