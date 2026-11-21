# PRD — London Bus Portfolio

Original product brief. The current 3D city direction and release gate are in [3D City North Star PRD](product/3d-city-north-star-prd.md). The voxel and year-sign art described below is historical. The requirements on content, privacy and accessibility still apply.

## Problem

The previous site was a conventional one-page CV. It does not stand out to recruiters or engineering managers who scan many portfolios.

## Goal

A memorable portfolio that still answers a recruiter's questions in under 30 seconds: who Samuel is, what he does, where he worked, and how to contact him.

Inspiration: a scroll-driven voxel city. This version: **voxel London, red double-decker bus**.

## Users

1. Recruiters and hiring managers (primary): role, seniority, stack and contact, quickly.
2. Engineers: the craft, the articles and the repositories.

## Experience

- The hero shows the name, the title and a 3D figure of Samuel.
- Scrolling drives a red double-decker bus along a route through the city. Each stop shows its entry in the HTML panel, which is the source of truth. The 3D world is decoration.
- The narrative is chronological: São Paulo, then London (2019), then Glasgow (2023), then London from June 2024 at Tribal Worldwide. Earlier Brazil chapters appear as "Before London" stops. A plane marks the 2019 move. The route ends at a contact stop.

## Content

Content lives in `js/content.js` (`stops` and `i18n`, in `en` and `pt`). This PRD defines the order and the content types, not the copy:

1. Hero.
2. Journey: career and education entries, chronological.
3. Stack: key technologies, shown as city landmarks.
4. Articles: links to published articles.
5. GitHub: a curated list of 3–6 public repositories, approved by Samuel.
6. Recommendations.
7. Contact: email, LinkedIn, GitHub, and a redacted CV download.

## Requirements

- EN (default) and PT toggle; day and night toggle.
- Works on mobile: the panel becomes a bottom sheet. Mobile checks are paused.
- Works with reduced motion. WebGL is on in the shipped site; a WebGL-off run is a test scenario only.
- Hosted on GitHub Pages, with no backend and no build.
- Must not expose a home address or phone number.
- Keep the existing favicons, social preview and sitemap.

## Success

- Lighthouse accessibility ≥ 95 and performance ≥ 80 on desktop.
- The panel is readable within 2 s on 4G. The 3D world loads after it.
- Every journey entry is reachable by scroll and by keyboard.

## Out of scope

Blog engine, CMS, analytics, contact form, multiplayer, controllable driving.
