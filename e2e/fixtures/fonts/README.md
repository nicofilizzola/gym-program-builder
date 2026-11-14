# Browser test font fixtures

Test-only local copies of the same Barlow and Barlow Condensed normal faces requested by index.html, Latin WOFF2 subsets, downloaded 2026-11-13. The test server substitutes this stylesheet only with --test; production assets/index are unchanged. This removes third-party network timing from browser setup, screenshots and typography assertions. Fallback checks explicitly abort this local stylesheet.

Original Google Fonts stylesheet: https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&display=swap

Sources:

- barlow-400.woff2 (400): https://fonts.gstatic.com/s/barlow/v13/7cHpv4kjgoGqM7E_DMs5.woff2
- barlow-500.woff2 (500): https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E3_-gs51os.woff2
- barlow-600.woff2 (600): https://fonts.gstatic.com/s/barlow/v13/7cHqv4kjgoGqM7E30-8s51os.woff2
- barlow-condensed-600.woff2 (600): https://fonts.gstatic.com/s/barlowcondensed/v13/HTxwL3I-JCGChYJ8VI-L6OO_au7B4873z3bWuQ.woff2
- barlow-condensed-700.woff2 (700): https://fonts.gstatic.com/s/barlowcondensed/v13/HTxwL3I-JCGChYJ8VI-L6OO_au7B46r2z3bWuQ.woff2

Licenses: accompanying barlow-OFL.txt and barlowcondensed-OFL.txt, copied from https://github.com/google/fonts/tree/main/ofl/barlow and https://github.com/google/fonts/tree/main/ofl/barlowcondensed. Fonts are unmodified; licensed under SIL Open Font License 1.1.
