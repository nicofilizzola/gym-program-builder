/**
 * Stylised front and back body figures for the volume panel.
 * Every shape is the left half of the figure (viewBox 0 0 100 210); it is mirrored for the right half.
 */

const SILHOUETTE = 'M50 26 L45 26 L45 33 Q33 34 25 38 Q18 42 17 52 L14 80 L11 104 L9 118 Q8 125 13 125 '
  + 'L17 118 L21 100 L25 80 L28 66 L29 92 Q28 104 30 112 L29 140 Q29 160 32 176 L33 196 Q31 204 37 204 '
  + 'L42 204 Q44 200 43 194 L45 170 Q46 150 47 130 L49 116 L50 116 Z';

const SHOULDER = 'M25 39 Q18 43 17.5 53 Q21 57 26.5 55 Q29 48 31 41 Q28 38 25 39 Z';
const UPPER_ARM = 'M18 58 Q16 68 17 78 Q20 80 23.5 78 Q25.5 68 26 60 Q22 56 18 58 Z';
const THIGH = 'M31 120 Q29 138 31 160 Q34 170 38 171 Q43 168 45 160 Q47 141 47.5 127 Q40 119 31 120 Z';

/** [muscle, left-half path] per view. Later entries draw on top. */
const REGIONS = {
  front: [
    ['Chest', 'M49.5 41 L33 41 Q29 44 28.5 54 Q32 63 42 63 Q48 62 49.5 59 Z'],
    ['Shoulders', SHOULDER],
    ['Biceps', UPPER_ARM],
    ['Abs', 'M49.5 66 L39 66 Q37 80 38 94 Q41 106 49.5 110 Z'],
    ['Quads', THIGH],
  ],
  back: [
    ['Upper back', 'M50 30 L45 33 Q36 36 31 41 Q37 50 43 57 L50 61 Z'],
    ['Lats', 'M29.5 49 Q28.5 62 30 74 Q34 88 42 96 Q47 89 48.5 76 L48.5 65 Q41 61 35 53 Z'],
    ['Shoulders', SHOULDER],
    ['Triceps', UPPER_ARM],
    ['Hamstrings', THIGH],
    ['Calves', 'M32 177 Q30 186 33 194 L38 195 Q42 188 43.5 179 Q38 173 32 177 Z'],
  ],
};

const mirrored = (d) => `<path d="${d}"/><path d="${d}" transform="matrix(-1 0 0 1 100 0)"/>`;

/**
 * @param {'front' | 'back'} view
 * @returns {string} SVG markup; each muscle is a `<g class="region" data-muscle="…">`
 */
export function bodySvg(view) {
  const regions = REGIONS[view]
    .map(([muscle, d]) => `<g class="region" data-muscle="${muscle}">${mirrored(d)}</g>`)
    .join('');
  return `<svg viewBox="0 0 100 210" aria-hidden="true" focusable="false">
    <g class="silhouette"><ellipse cx="50" cy="16" rx="9" ry="11"/>${mirrored(SILHOUETTE)}</g>
    ${regions}
  </svg>`;
}
