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
- Scrolling drives a red double-decker bus along a route through voxel London. A planted roadside sign marks each stop with its year; the side panel highlights the matching entry. The panel remains the source of truth and the 3D world is decorative.
- Career and location narrative (chronological): São Paulo → London (move in 2019) → Glasgow (move in 2023) → London role at Tribal Worldwide from June 2024. Samuel continued living in Glasgow through the end of 2024 while working at Tribal; the OLM role ended in February 2024. The world uses a single London route, with earlier Brazil chapters presented as "Before London" stops and a plane flyover at the 2019 move; the route ends at the "Now" contact stop.

## Content (stops)
1. **Hero**
2. **Journey**
   - 2003–2008 PUC-SP — BSc Computer Science, São Paulo
   - May 2011–Feb 2012 Arizona Premedia — Java Web Developer, São Paulo 🇧🇷
   - Mar 2012–Oct 2013 Insane Games — Mobile Application Developer, São Paulo 🇧🇷
   - Jan 2014–Feb 2016 Taqtile — Mobile Software Engineer, São Paulo 🇧🇷
   - Jan–Aug 2017 Mira Educação — Software Engineer, São Paulo 🇧🇷
   - Dec 2017–Apr 2020 Reclame AQUI — Software Engineer, São Paulo 🇧🇷
   - 2019 Moved to London
   - Apr–Nov 2020 Millimetric.ai — Senior Java Engineer, London
   - Nov 2020–May 2021 xDesign — Senior Java Software Engineer (FanDuel / Onfido), London
   - Jul 2021–Dec 2022 OLM Systems — Software Developer III (CP-IS), London
   - Jan 2023–Feb 2024 OLM Systems — Software Developer III (CP-IS), Glasgow
   - Jun 2024–present Tribal Worldwide London — Senior Software Developer (VW stock platform)
   - Samuel moved to Glasgow in 2023 and lived there through the end of 2024, including while working at Tribal from June 2024. The Tribal role's London location does not change his residence or extend the OLM role.
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
- All 12 Journey entries reachable by scroll and keyboard (current content count).

## Out of scope
Blog engine, CMS, analytics, contact form, sound, multiplayer, controllable driving.
