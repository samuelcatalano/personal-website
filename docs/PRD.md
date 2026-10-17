# PRD — London Bus Portfolio

## Problem
The current site (https://samuelcatalano.github.io/personal-website/) is a conventional one-page CV. It does not stand out to recruiters or engineering managers who scan dozens of portfolios.

## Goal
A memorable, playful portfolio that still answers the recruiter's questions in under 30 seconds: who Samuel is, what he does, where he worked, how to contact him.

Inspiration: bridglabs.com (scroll-driven voxel San Francisco with a cable car). Our version: **voxel London, red double-decker bus**.

## Users
1. Recruiters / hiring managers (primary) — want role, seniority, stack, contact fast.
2. Engineers — appreciate the craft, read articles and repos.

## Experience
- Visitor lands on a hero: name, title "Senior Software Engineer", "17+ years · Java · Backend · London", voxel/pixel avatar based on Samuel's Memoji.
- Scrolling drives a red double-decker bus along a route through voxel London. A stop sign with the year pops above the bus at each chapter; the side panel highlights the matching entry.
- Route (chronological): Heathrow → "Before London" stops (Brazil, 🇧🇷 sign) → plane flyover at 2020 → London stops → ends at Wembley (where Samuel lives) at "Now".

## Content (stops)
1. **Hero**
2. **Journey**
   - 2003–2008 PUC-SP — BSc Computer Science
   - 2011 Arizona Premedia — Java Web Developer 🇧🇷
   - 2012 Insane Games — Mobile Application Developer 🇧🇷
   - 2014 Taqtile — Mobile Software Engineer 🇧🇷
   - 2017 Mira Educação — Software Engineer 🇧🇷
   - 2017 Reclame AQUI — Software Engineer 🇧🇷
   - 2020 Millimetric.ai — Sr. Java Engineer (London)
   - 2020 xDesign — Senior Java Software Engineer (FanDuel / Onfido)
   - 2021–2022 OLM Systems, London — Software Developer III (CP-IS child protection)
   - 2023–Feb 2024 OLM Systems, Glasgow — Software Developer III (CP-IS child protection)
   - 2024 Tribal Worldwide London — Senior Software Developer (VW stock platform) — current
   - Samuel lived in Glasgow through the end of 2024, including while working at Tribal from June 2024; this does not extend the OLM role beyond February 2024.
3. **Stack** as landmarks: Java, Spring Boot, Quarkus, Kafka/Debezium, AWS, Docker/Kubernetes, PostgreSQL/MySQL/MongoDB.
4. **Articles**: Mastering the Art of Backend Hiring; Quarkus and the MicroProfile Fault Tolerance API; Mapping Entities to DTOs and vice versa in Java (links from the current site).
5. **GitHub**: 3–6 curated public repos from github.com/samuelcatalano (static list, approved by Samuel).
6. **Recommendations**: Romeu Ivolela Neto (UOL), Decio di Napoli.
7. **Contact**: email, LinkedIn, GitHub, CV PDF download.

## Requirements
- EN (default) and PT toggle; day/night toggle.
- Works on mobile (panel becomes bottom sheet).
- Works without WebGL and with reduced motion (static background, panel intact).
- Hosted on GitHub Pages, no backend, no build.
- Must not expose home address or phone.
- Keep the existing favicons, social preview and sitemap.

## Success
- Lighthouse a11y ≥ 95, performance ≥ 80 on desktop.
- First meaningful content (panel) < 2s on 4G; 3D world lazy-loads after.
- All 12 journey entries reachable by scroll and keyboard.

## Out of scope
Blog engine, CMS, analytics, contact form, sound, multiplayer, controllable driving.
