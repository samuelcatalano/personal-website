# Fountain water — visible motion and material

Owner requested going further with realistic moving water. Previous plaza improvements are already implemented and remain in scope as the baseline.

Replace normal-only concentric rings with small displaced waves, six jet-driven impact fields, flowing/wobbling tapered streams, restrained impact foam, dielectric Fresnel reflection and subtle shallow-floor caustics. All movement uses the existing scene clock, frozen under reduced motion. No changes to routes, fountain footprint, surrounding geometry, WebGL availability, dependencies, assets, dynamic lights or passes. Keep four plaza meshes/four textures and the pre-existing 12,000-triangle limit.

Verify real shader compilation, visible surface changes, stream silhouette displacement on the GPU, bounded geometry, frozen-time determinism, day/night/mobile rendering and the Node suite. Capture a short actual-render motion preview. No commit/push requested.
