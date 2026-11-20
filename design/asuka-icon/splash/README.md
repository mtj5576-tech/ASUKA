# ASUKA boot screen

## Direction

The splash screen treats ASUKA as a premium agent system rather than a generic AI app. The left side is an ink-colored terminal surface; the right side is a warm ivory paper field and a coral sunrise. Nova, the core bot, is the character anchor.

The layout uses the existing ASUKA palette and bot system, plus grain, halftone dots, scan lines, a print-registration wordmark, and segmented boot status.

## Files

- `splash.html`: responsive animated source
- `splash.css`: layout, texture and motion system
- `splash.js`: boot state machine, bot switching, command input and keyboard controls
- `asuka-splash-1920x1080.png`: desktop export
- `asuka-splash-mobile-1080x1920.png`: vertical export
- `asuka-splash-console-1920x1080.png`: desktop command-deck state
- `asuka-splash-mobile-console-1080x1920.png`: portrait command-deck state
- `asuka-splash-thinking-1920x1080.png`: decision bot thinking state
- `asuka-splash-execution-1920x1080.png`: execution crew working state
- `asuka-splash-complete-1920x1080.png`: all-bots-complete state
- `asuka-splash-mobile-execution-1080x1920.png`: portrait execution state

## Copy

- Wordmark: `ASUKA`
- Tagline: `BUILD THE NEXT MOVE.`
- Status: `INITIALIZING NOVA CORE`
- Crew state: `9 AGENTS READY`

## Interactions

- Boot sequence runs automatically and advances through four status stages.
- `SKIP` immediately completes boot.
- `ENTER` or the enter button opens the command deck.
- Pointer movement adds a restrained mascot parallax.
- The nine crew controls swap mascot, accent color, role copy and command placeholder.
- Commands appear in the terminal with a clear runtime-not-connected response.
- The selected bot becomes the decision node with a scanning ring and thinking dots.
- The other eight bots move through `QUEUE`, role-specific work labels, and `DONE` in timed waves.
- Each bot card exposes a live state label and progress strip.
- Sending a new command or selecting another bot cancels the previous orchestration.
- `Escape` or `BOOT` returns to the ready screen.

The command input is a front-end demo. It intentionally does not pretend to send a real model request.
