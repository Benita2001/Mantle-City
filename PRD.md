# MantleCity2 — Product Requirements Document
*Last updated: March 2026 | Deadline: March 31 2026*

## Submission Context
- Bounty: Mantle x Scribble "When AI Meets Mantle" — Track 2 Builders
- Prize pool: $5,000
- Deliverable: Live Vercel URL + demo video

---

## What We Are Building
A 3D interactive night-city visualization of the Mantle Network.
Every building = a Mantle wallet. The city is dark and realistic.
Teal Mantle accents are the lights that bring it to life.

---

## Visual Reference
Target quality: datacity.datafa.st (screenshots in /docs/references/)

### Reference Image 1 — Aerial View
[aerial.png]
Key observations:
- Two building material types: grey glass-curtain + warm tan/brick
- Dense window grid readable at all distances
- Wide streets with crosswalks and lane markings
- Stylized round trees at corners
- Dark pill labels floating above buildings
- Landmark tower = tallest building, center of city

### Reference Image 2 — Wide Aerial with Popup
[aerial-popup.png]
Key observations:
- Click popup: white card, building name + metric value
- Flying drone visible top-right
- Trees have color variation (green, orange, yellow)
- Ground is flat light beige between buildings
- Streets form clear grid

### Reference Image 3 — Street Level Close-up
[street-level.png]
Key observations:
- Window grid: ~8-10 cols × many rows, small inset rectangles
- Street detail: lane dividers, crosswalk stripes, traffic lights
- Building bases have a plinth/podium step
- Labels visible from street level

---

## MantleCity2 Differences from Reference
| Feature | datacity.datafa.st | MantleCity2 |
|---|---|---|
| Time of day | Daytime, light sky | Night, deep dark navy sky |
| Window color | White/grey lit | Teal #65B3AE glow |
| Brand identity | Neutral | Mantle Network |
| Data source | Web analytics | Live Mantle blockchain |
| Building color | Grey + tan | Dark grey concrete only |
| Accent color | None | Teal windows + UI |

---

## Color Specification

### Environment (NO teal here)
- Sky: #050D20 → #0E1A30 (deep dark navy gradient)
- Ground/streets: #1a1a1a dark asphalt
- Street markings: #FFFFFF white lines
- Building facades: #1C1C1E to #2C2C2E (dark concrete variation)
- Building podiums/bases: #252528

### Mantle Teal Accents ONLY on:
- Lit windows: #65B3AE (primary)
- Window variant: #008F6A (secondary, ~15% of lit windows)
- Street light glow: #65B3AE at low opacity
- Protocol landmark highlights: #65B3AE border/glow
- UI stats bar: #65B3AE text and accents
- Minimap accents: #65B3AE

---

## Data Mapping
Source: Dune Analytics Query ID 6848710
(Top 1000 active Mantle wallets, 30-day window)

| Blockchain Data | Visual Property |
|---|---|
| Transaction volume | Building height |
| Transaction count | Building width |
| Each transaction | One window cell |
| Active window | Teal lit (#65B3AE) |
| Inactive window | Dark (#0d1117) |
| Protocol wallet | Landmark building, tallest, labeled |

---

## Protocol Landmarks
These wallets become the tallest labeled landmark buildings:
- Agni Finance: 0x765CD3C8AB7F872B4dDCaeefd32714D5A13bCC65
- Merchant Moe: 0x4515a45337f461a11ff0fe8abf3c606ae5dc00c9
- Lendle: 0x25356aeca4210ef7553140edb9b8026089e49396

Landmark buildings have:
- Floating name label above
- Teal glow border
- Slightly different facade (Mantle logo texture panel)

---

## Build Layers (strict order)

### Layer 1 — Single Building ← WE ARE HERE
- One building, canvas window texture
- Teal lit windows, dark concrete facade
- Validate looks like real skyscraper
- Checkpoint: screenshot comparison to reference

### Layer 2 — Scene Foundation
- Dark night sky
- Ground plane (dark asphalt)
- Ambient + directional lighting
- One street block

### Layer 3 — City Grid
- 20 buildings placed on grid
- Height/width variation
- Basic street network

### Layer 4 — Navigation
- Orbit controls (aerial)
- Street level pedestrian mode
- Click to focus building

### Layer 5 — Live Data
- Dune query integration
- Buildings sized by real wallet data
- Protocol landmarks identified

### Layer 6 — Polish
- Trees, street lights, crosswalks
- Flying drone objects
- Click popups with Mantle Explorer links
- Minimap
- Stats bar
- Deploy to Vercel

---

## Tech Stack
- React + Vite
- React Three Fiber + Three.js
- Dune Analytics MCP (Query ID: 6848710)
- Wallet classifier: MantleCity/src/utils/walletClassifier.js
- Deploy: Vercel

---

## Definition of Done (Bounty Submission)
- [ ] Live Vercel URL accessible
- [ ] 1000 wallet buildings visible
- [ ] Protocol landmarks labeled
- [ ] Click popup with Mantle Explorer link
- [ ] Looks impressive in a screenshot/demo video
- [ ] Night city with teal window glow visible