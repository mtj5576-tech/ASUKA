# ASUKA bot avatar system

## System rule

Each avatar keeps the same ASUKA face, wink, hair silhouette, headset and diamond signal. Differentiation comes from three layers: badge shape, saturated color pair, and one role glyph.

This borrows the useful product logic of Grok Bot's shape-and-color badges without copying its face, character or artwork.

| Bot | Role | Badge | Primary | Accent |
| --- | --- | --- | --- | --- |
| NOVA | Core orchestrator | Squircle | `#FF4F87` | `#35DDD0` |
| BYTE | Code specialist | Hexagon | `#3978F6` | `#6BF3FF` |
| LENS | Research specialist | Circle | `#8A5CFF` | `#D9FF4D` |
| GRID | Data specialist | Pill | `#0D8E9F` | `#6BE6FF` |
| BLOOM | Design specialist | Flower | `#F13BC2` | `#FFE45C` |
| RELAY | Ops specialist | Shield | `#11B981` | `#FF9E3D` |
| GUARD | Security specialist | Octagon | `#E33F57` | `#FFF1DA` |
| SPROUT | Growth specialist | Droplet | `#8BCF25` | `#FF7A32` |
| LUNA | Night specialist | Cloud | `#4B4ACF` | `#FF6BCB` |

## Files

- `asuka-bots-board.png`: 3 x 3 overview board
- `asuka-bot-<name>.svg`: editable vector source
- `asuka-bot-<name>-1024.png`: master avatar
- `asuka-bot-<name>-512.png`: primary product-size avatar
- `asuka-bot-<name>-128.png`: compact sidebar-size avatar
- `bots.json`: palette and role manifest
- `generate_bots.py`: deterministic generator for all nine SVGs

Run `python asuka-icon/bots/generate_bots.py` after changing the palette or role configuration.
