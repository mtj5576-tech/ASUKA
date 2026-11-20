from __future__ import annotations

import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent
INK = "#241C3A"
LIGHT = "#FFF3E5"
SKIN = "#FFD9C9"


BOTS = [
    {
        "key": "nova",
        "name": "ASUKA-01 / NOVA",
        "role": "Core agent",
        "shape": "squircle",
        "primary": "#FF4F87",
        "accent": "#35DDD0",
        "accent2": "#FFE45C",
        "hair": "#FF3E7F",
        "hair_dark": "#D51F62",
        "hair_light": "#FF9DBD",
        "iris1": "#7BF8E9",
        "iris2": "#3796F5",
    },
    {
        "key": "byte",
        "name": "ASUKA-02 / BYTE",
        "role": "Code agent",
        "shape": "hexagon",
        "primary": "#3978F6",
        "accent": "#6BF3FF",
        "accent2": "#A8FF5C",
        "hair": "#294DF0",
        "hair_dark": "#1733B7",
        "hair_light": "#7393FF",
        "iris1": "#8DFFF4",
        "iris2": "#17B8FF",
    },
    {
        "key": "lens",
        "name": "ASUKA-03 / LENS",
        "role": "Research agent",
        "shape": "circle",
        "primary": "#8A5CFF",
        "accent": "#D9FF4D",
        "accent2": "#FF7ACC",
        "hair": "#6D46E7",
        "hair_dark": "#4326A7",
        "hair_light": "#B28CFF",
        "iris1": "#D9FF72",
        "iris2": "#7E5CFF",
    },
    {
        "key": "grid",
        "name": "ASUKA-04 / GRID",
        "role": "Data agent",
        "shape": "pill",
        "primary": "#0D8E9F",
        "accent": "#6BE6FF",
        "accent2": "#FFD15A",
        "hair": "#087987",
        "hair_dark": "#04505C",
        "hair_light": "#4DC2D1",
        "iris1": "#8DFBFF",
        "iris2": "#0D7BA8",
    },
    {
        "key": "bloom",
        "name": "ASUKA-05 / BLOOM",
        "role": "Design agent",
        "shape": "flower",
        "primary": "#F13BC2",
        "accent": "#FFE45C",
        "accent2": "#6BFFF1",
        "hair": "#D72AA7",
        "hair_dark": "#981174",
        "hair_light": "#FF85D9",
        "iris1": "#FFE45C",
        "iris2": "#FF6FB1",
    },
    {
        "key": "relay",
        "name": "ASUKA-06 / RELAY",
        "role": "Ops agent",
        "shape": "shield",
        "primary": "#11B981",
        "accent": "#FF9E3D",
        "accent2": "#C3FF7A",
        "hair": "#0A9768",
        "hair_dark": "#056449",
        "hair_light": "#58D4A0",
        "iris1": "#D8FF88",
        "iris2": "#12D7B5",
    },
    {
        "key": "guard",
        "name": "ASUKA-07 / GUARD",
        "role": "Security agent",
        "shape": "octagon",
        "primary": "#E33F57",
        "accent": "#FFF1DA",
        "accent2": "#FFB03A",
        "hair": "#C72D46",
        "hair_dark": "#8E1730",
        "hair_light": "#FF7F91",
        "iris1": "#FFE0A1",
        "iris2": "#FF5353",
    },
    {
        "key": "sprout",
        "name": "ASUKA-08 / SPROUT",
        "role": "Growth agent",
        "shape": "droplet",
        "primary": "#8BCF25",
        "accent": "#FF7A32",
        "accent2": "#F7FF8A",
        "hair": "#6FAE17",
        "hair_dark": "#4D7A0B",
        "hair_light": "#BBEA62",
        "iris1": "#F7FF8A",
        "iris2": "#36D79B",
    },
    {
        "key": "luna",
        "name": "ASUKA-09 / LUNA",
        "role": "Night agent",
        "shape": "cloud",
        "primary": "#4B4ACF",
        "accent": "#FF6BCB",
        "accent2": "#7DEBFF",
        "hair": "#3D3AB2",
        "hair_dark": "#272577",
        "hair_light": "#8A87FF",
        "iris1": "#A4EEFF",
        "iris2": "#FF77D9",
    },
]


def flower_shape() -> str:
    points = []
    for index in range(12):
        angle = math.radians(-90 + index * 30)
        radius = 478 if index % 2 == 0 else 430
        x = 512 + math.cos(angle) * radius
        y = 512 + math.sin(angle) * radius
        points.append(f"{x:.1f} {y:.1f}")
    return "M" + " L".join(points) + " Z"


SHAPES = {
    "squircle": '<rect x="32" y="32" width="960" height="960" rx="242"/>',
    "hexagon": '<path d="M512 34 928 274V750L512 990 96 750V274Z"/>',
    "circle": '<circle cx="512" cy="512" r="480"/>',
    "pill": '<rect x="162" y="32" width="700" height="960" rx="350"/>',
    "flower": f'<path d="{flower_shape()}"/>',
    "shield": '<path d="M512 34C684 120 840 154 942 168V520C942 728 770 890 512 990 254 890 82 728 82 520V168C184 154 340 120 512 34Z"/>',
    "octagon": '<path d="M328 34H696L990 328V696L696 990H328L34 696V328Z"/>',
    "droplet": '<path d="M512 30C650 170 892 330 892 600 892 804 728 990 512 990 296 990 132 804 132 600 132 330 374 170 512 30Z"/>',
    "cloud": '<path d="M250 150C320 64 430 50 512 118 596 44 724 66 792 156 900 176 976 264 962 380 952 468 896 528 820 552 892 666 890 808 830 902 884 932 930 960 962 990H62C94 960 140 932 194 902 134 808 132 666 204 552 128 528 72 468 62 380 48 264 124 176 232 156 238 154 244 152 250 150Z"/>',
}


HAIR_EXTRAS = {
    "nova": "",
    "byte": '<path d="M510 220 484 116 548 166 604 92 584 230Z" fill="{hair}" stroke="{ink}" stroke-width="10" stroke-linejoin="round"/>',
    "lens": '<circle cx="286" cy="314" r="76" fill="{hair}" stroke="{ink}" stroke-width="12"/><circle cx="738" cy="314" r="76" fill="{hair}" stroke="{ink}" stroke-width="12"/><circle cx="286" cy="314" r="34" fill="{accent}"/><circle cx="738" cy="314" r="34" fill="{accent2}"/>',
    "grid": '<path d="M296 360 188 284 230 438Z" fill="{hair_dark}" stroke="{ink}" stroke-width="10" stroke-linejoin="round"/><path d="M728 360 836 284 794 438Z" fill="{hair_dark}" stroke="{ink}" stroke-width="10" stroke-linejoin="round"/>',
    "bloom": '<path d="M704 398C828 326 938 394 918 514 902 606 814 644 766 606 832 548 804 480 704 470Z" fill="{hair}" stroke="{ink}" stroke-width="12" stroke-linejoin="round"/>',
    "relay": '<path d="M600 252C704 112 856 148 900 278 938 394 854 496 772 478 844 396 804 306 680 326Z" fill="{hair}" stroke="{ink}" stroke-width="12" stroke-linejoin="round"/>',
    "guard": '<path d="M302 316 188 246 246 438Z" fill="{hair_dark}" stroke="{ink}" stroke-width="10" stroke-linejoin="round"/><path d="M722 316 836 246 778 438Z" fill="{hair_dark}" stroke="{ink}" stroke-width="10" stroke-linejoin="round"/>',
    "sprout": '<path d="M286 632C190 700 186 832 250 902 310 968 402 918 390 846 316 864 274 806 334 724Z" fill="{hair}" stroke="{ink}" stroke-width="12" stroke-linejoin="round"/><path d="M738 632C834 700 838 832 774 902 714 968 622 918 634 846 708 864 750 806 690 724Z" fill="{hair}" stroke="{ink}" stroke-width="12" stroke-linejoin="round"/>',
    "luna": '<path d="M742 548C890 590 906 742 814 850 880 748 790 690 704 662Z" fill="{hair}" stroke="{ink}" stroke-width="12" stroke-linejoin="round"/><path d="M282 548C134 590 118 742 210 850 144 748 234 690 320 662Z" fill="{hair_dark}" stroke="{ink}" stroke-width="12" stroke-linejoin="round"/>',
}


EAR_SYMBOLS = {
    "nova": '<path d="M264 548 286 570 264 592" fill="none" stroke="{ink}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>',
    "byte": '<path d="M258 544 280 566 258 588M288 598h18" fill="none" stroke="{ink}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>',
    "lens": '<circle cx="276" cy="566" r="18" fill="none" stroke="{ink}" stroke-width="9"/><path d="M289 579 306 598" stroke="{ink}" stroke-width="9" stroke-linecap="round"/>',
    "grid": '<path d="M260 594V570M278 594V548M296 594V528" stroke="{ink}" stroke-width="9" stroke-linecap="round"/>',
    "bloom": '<path d="M278 538 286 558 308 560 292 576 296 598 278 586 260 598 264 576 248 560 270 558Z" fill="{ink}"/>',
    "relay": '<circle cx="278" cy="566" r="17" fill="none" stroke="{ink}" stroke-width="9"/><path d="M278 538V550M278 582V598M250 566H264M292 566H306" stroke="{ink}" stroke-width="8" stroke-linecap="round"/>',
    "guard": '<rect x="258" y="568" width="40" height="30" rx="7" fill="{ink}"/><path d="M266 568v-8c0-12 24-12 24 0v8" fill="none" stroke="{ink}" stroke-width="8"/>',
    "sprout": '<path d="M278 594V558M278 572c-22 0-32-14-32-30 22 0 34 12 32 30ZM278 562c4-22 20-30 34-28-2 20-14 30-34 28Z" fill="{ink}"/>',
    "luna": '<path d="M292 540c-24 2-38 22-34 44 4 22 24 34 46 28-20-8-28-24-24-40 2-12 8-22 12-32Z" fill="{ink}"/>',
}


TOP_PINS = {
    "nova": '<path d="M824 202 850 240 824 278 798 240Z" fill="{accent2}" stroke="{ink}" stroke-width="7"/>',
    "byte": '<path d="M796 232 816 250 796 268M832 278h22" fill="none" stroke="{accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
    "lens": '<circle cx="820" cy="244" r="22" fill="none" stroke="{accent}" stroke-width="8"/><path d="M836 260 852 278" stroke="{accent}" stroke-width="8" stroke-linecap="round"/>',
    "grid": '<path d="M794 276V250M818 276V228M842 276V206" stroke="{accent2}" stroke-width="10" stroke-linecap="round"/>',
    "bloom": '<path d="M824 204 834 228 858 232 840 248 844 272 824 258 804 272 808 248 790 232 814 228Z" fill="{accent}" stroke="{ink}" stroke-width="5"/>',
    "relay": '<circle cx="824" cy="240" r="20" fill="none" stroke="{accent2}" stroke-width="8"/><path d="M824 206V220M824 260V274M790 240H804M844 240H858" stroke="{accent2}" stroke-width="7" stroke-linecap="round"/>',
    "guard": '<rect x="802" y="232" width="44" height="34" rx="8" fill="{accent2}"/><path d="M812 232v-9c0-14 24-14 24 0v9" fill="none" stroke="{accent2}" stroke-width="8"/>',
    "sprout": '<path d="M824 272V218M824 238c-28-2-42-20-40-42 26 0 42 16 40 42ZM824 224c6-28 26-38 46-34-2 24-18 38-46 34Z" fill="{accent2}"/>',
    "luna": '<path d="M848 208c-30 4-46 30-38 58 8 28 36 42 64 32-28-10-40-32-34-54 4-14 12-26 8-36Z" fill="{accent}"/>',
}


MOUTHS = {
    "nova": '<path d="M452 636c20 54 100 54 120 0-34 20-86 20-120 0Z" fill="#7E173F" stroke="{ink}" stroke-width="8" stroke-linejoin="round"/><path d="M486 662c18 18 52 18 70 0-10 28-60 28-70 0Z" fill="#FF7599"/>',
    "byte": '<path d="M470 646c26 26 56 26 82 0" fill="none" stroke="{ink}" stroke-width="9" stroke-linecap="round"/>',
    "lens": '<path d="M484 650c18 18 38 18 56 0" fill="none" stroke="{ink}" stroke-width="9" stroke-linecap="round"/>',
    "grid": '<path d="M470 650h84" fill="none" stroke="{ink}" stroke-width="8" stroke-linecap="round"/>',
    "bloom": '<path d="M452 636c20 54 100 54 120 0-34 20-86 20-120 0Z" fill="#7E173F" stroke="{ink}" stroke-width="8" stroke-linejoin="round"/><path d="M502 664c14 34 38 34 50 0-14 12-38 12-50 0Z" fill="#FF7599"/>',
    "relay": '<path d="M442 630c26 62 114 62 140 0-38 30-102 30-140 0Z" fill="#7E173F" stroke="{ink}" stroke-width="8" stroke-linejoin="round"/>',
    "guard": '<path d="M462 648c26 10 64 10 90-8" fill="none" stroke="{ink}" stroke-width="9" stroke-linecap="round"/>',
    "sprout": '<path d="M446 628c26 68 106 68 132 0-38 26-94 26-132 0Z" fill="#7E173F" stroke="{ink}" stroke-width="8" stroke-linejoin="round"/><path d="M486 660c20 24 52 24 72 0-12 32-60 32-72 0Z" fill="#FF7599"/>',
    "luna": '<path d="M484 648c16 14 40 14 56 0" fill="none" stroke="{ink}" stroke-width="8" stroke-linecap="round"/>',
}


def fmt(bot: dict[str, str]) -> dict[str, str]:
    return {**bot, "ink": INK, "light": LIGHT, "skin": SKIN}


def eye_group(bot: dict[str, str], mirror: bool = False) -> str:
    body = f'''<path d="M344 528c14-64 62-94 114-64 30 18 40 62 30 108-12 52-50 82-94 66-44-16-62-62-50-110Z" fill="#FFF8EF" stroke="{INK}" stroke-width="14"/>
    <ellipse cx="414" cy="548" rx="38" ry="58" fill="url(#iris)"/>
    <ellipse cx="414" cy="560" rx="18" ry="34" fill="#17213D"/>
    <circle cx="402" cy="520" r="14" fill="#FFFFFF"/>
    <circle cx="430" cy="570" r="7" fill="{bot['accent']}"/>
    <path d="M352 430c38-26 80-22 112 8" fill="none" stroke="{INK}" stroke-width="14" stroke-linecap="round"/>'''
    if mirror:
        return f'<g transform="translate(1024 0) scale(-1 1)">{body}</g>'
    return body


def build_svg(bot: dict[str, str]) -> str:
    style = fmt(bot)
    shape = SHAPES[bot["shape"]]
    extra = HAIR_EXTRAS[bot["key"]].format(**style)
    ear = EAR_SYMBOLS[bot["key"]].format(**style)
    top_pin = TOP_PINS[bot["key"]].format(**style)
    mouth = MOUTHS[bot["key"]].format(**style)
    left_eye = eye_group(bot)
    both_open = bot["key"] in {"lens", "grid", "luna"}
    right_eye = eye_group(bot, mirror=True) if both_open else f'''<path d="M566 536c34-34 78-32 116-2" fill="none" stroke="{INK}" stroke-width="22" stroke-linecap="round"/><path d="M590 518c26-24 58-22 86 0" fill="none" stroke="{bot['hair_light']}" stroke-width="9" stroke-linecap="round"/><path d="M562 430c38-26 80-22 112 8" fill="none" stroke="{INK}" stroke-width="14" stroke-linecap="round"/>'''
    glasses = ""
    if bot["key"] == "lens":
        glasses = f'''<g fill="none" stroke="{bot['accent2']}" stroke-width="10" opacity="0.95"><circle cx="414" cy="548" r="92"/><circle cx="610" cy="548" r="92"/><path d="M506 548h12" stroke-linecap="round"/></g>'''

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-labelledby="title desc">
  <title id="title">{bot['name']} bot avatar</title>
  <desc id="desc">An ASUKA original anime-inspired {bot['role']} avatar in a {bot['shape']} badge.</desc>
  <defs>
    <linearGradient id="hair" x1="340" y1="236" x2="710" y2="812" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{bot['hair_light']}"/>
      <stop offset="0.48" stop-color="{bot['hair']}"/>
      <stop offset="1" stop-color="{bot['hair_dark']}"/>
    </linearGradient>
    <linearGradient id="iris" x1="380" y1="492" x2="446" y2="594" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{bot['iris1']}"/>
      <stop offset="1" stop-color="{bot['iris2']}"/>
    </linearGradient>
    <clipPath id="badgeClip">{shape}</clipPath>
  </defs>
  <g clip-path="url(#badgeClip)">
    <rect width="1024" height="1024" fill="{bot['primary']}"/>
    <path d="M42 390 314 84h120L172 390Z" fill="{bot['accent']}" opacity="0.94"/>
    <path d="M732 34h292v118L604 526Z" fill="{bot['accent2']}" opacity="0.72"/>
    <circle cx="512" cy="512" r="338" fill="{LIGHT}" opacity="0.96"/>

    {extra}
    <path d="M200 992c28-166 134-240 312-240s284 74 312 240Z" fill="{INK}"/>
    <path d="M350 868c44 68 100 102 162 102s118-34 162-102l76 124H274Z" fill="{bot['accent']}"/>
    <path d="M458 666h108v126H458Z" fill="#EEA28F"/>
    <path d="M466 768c12 26 28 38 46 38s34-12 46-38v44H466Z" fill="#D87E78" opacity="0.55"/>

    <path d="M252 558c-18-194 76-344 260-344s278 150 260 344c-10 76-32 132-66 176l42 166c-34 32-84 26-120-10l-54-58H450l-54 58c-36 36-86 42-120 10l42-166c-34-44-56-100-66-176Z" fill="url(#hair)" stroke="{INK}" stroke-width="14" stroke-linejoin="round"/>
    <path d="M286 540c-8-120 48-210 128-256-20 74-16 142 8 196-46 24-92 46-136 60Zm452 0c8-120-48-210-128-256 20 74 16 142-8 196 46 24 92 46 136 60Z" fill="{bot['hair_dark']}" opacity="0.7"/>
    <path d="M338 394c8-82 78-122 174-122s166 40 174 122c10 80-6 178-56 248-32 46-72 82-118 82s-86-36-118-82c-50-70-66-168-56-248Z" fill="{SKIN}" stroke="{INK}" stroke-width="14" stroke-linejoin="round"/>
    <path d="M298 422c18-120 94-180 214-180s196 60 214 180l-38 60c-14-82-46-132-94-162-14 60-46 104-88 124-12-68-44-116-82-146-16 76-48 132-94 176-8-24-20-42-32-52Z" fill="{bot['hair']}" stroke="{INK}" stroke-width="12" stroke-linejoin="round"/>
    <path d="M338 302c42-52 98-76 166-76" fill="none" stroke="{bot['hair_light']}" stroke-width="22" stroke-linecap="round"/>
    <path d="M612 284c50 26 82 66 94 120" fill="none" stroke="{bot['accent2']}" stroke-width="20" stroke-linecap="round"/>

    <path d="M292 520c0-204 440-204 440 0" fill="none" stroke="{INK}" stroke-width="44" stroke-linecap="round"/>
    <path d="M316 518c0-170 392-170 392 0" fill="none" stroke="{bot['accent']}" stroke-width="10" stroke-linecap="round"/>
    <rect x="226" y="486" width="104" height="166" rx="44" fill="{INK}"/>
    <rect x="248" y="512" width="60" height="114" rx="30" fill="{bot['accent']}"/>
    {ear}
    <rect x="694" y="486" width="104" height="166" rx="44" fill="{INK}"/>
    <rect x="716" y="512" width="60" height="114" rx="30" fill="{bot['accent2']}"/>
    <circle cx="746" cy="568" r="12" fill="{INK}" opacity="0.75"/>

    {left_eye}
    {right_eye}
    {glasses}
    <path d="M500 588q12 8 24 0" fill="none" stroke="#B8676B" stroke-width="8" stroke-linecap="round"/>
    {mouth}
    <ellipse cx="336" cy="598" rx="44" ry="23" fill="{bot['accent']}" opacity="0.34"/>
    <ellipse cx="688" cy="598" rx="44" ry="23" fill="{bot['accent']}" opacity="0.34"/>

    <path d="M710 306 738 346 710 386 682 346Z" fill="{bot['accent2']}" stroke="{INK}" stroke-width="9" stroke-linejoin="round"/>
    {top_pin}
    <path d="M174 624 188 648 174 672 160 648Z" fill="{LIGHT}" opacity="0.9"/>
  </g>
  <g fill="none" stroke="{INK}" stroke-width="16" stroke-linejoin="round">{shape}</g>
</svg>
'''


def main() -> None:
    manifest = []
    for bot in BOTS:
        filename = f"asuka-bot-{bot['key']}.svg"
        (ROOT / filename).write_text(build_svg(bot), encoding="utf-8")
        manifest.append({
            "key": bot["key"],
            "name": bot["name"],
            "role": bot["role"],
            "shape": bot["shape"],
            "primary": bot["primary"],
            "accent": bot["accent"],
            "accent2": bot["accent2"],
            "svg": filename,
        })
    (ROOT / "bots.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
