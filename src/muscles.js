/** The fixed list of muscle groups, in display order. */
export const MUSCLE_GROUPS = Object.freeze([
  'Chest',
  'Lats',
  'Upper back',
  'Biceps',
  'Triceps',
  'Front delts',
  'Side delts',
  'Rear delts',
  'Abs',
  'Quads',
  'Hamstrings',
  'Calves',
]);

const info = (min, max, sets, notes) => Object.freeze({ recommended: Object.freeze({ min, max }), sets, notes });

/** Per muscle: the recommended goal range (sets per session, inclusive) and the info text shown in the goals dialog. */
export const MUSCLE_INFO = Object.freeze({
  Chest: info(4, 8, '4–8 direct sets per session.',
    'Combine pressing and flyes; pressing fatigue can impair later performance.'),
  Lats: info(4, 8, '4–8 direct sets per session.',
    'Include shoulder-adduction and extension patterns; consider grip fatigue.'),
  'Upper back': info(4, 8, '4–8 direct sets per session.',
    'Chest support may reduce lower-back fatigue; diversify scapular loading.'),
  Biceps: info(4, 8, '2–6 additional direct sets after pulling; 4–8 if trained largely alone.',
    'Account for pulling; use curls targeting different elbow-flexor functions; monitor tendon symptoms.'),
  Triceps: info(4, 8, '2–6 additional direct sets after pressing; 4–8 if trained largely alone.',
    'Overhead extensions complement pressing; monitor elbow fatigue.'),
  'Front delts': info(3, 6, '0–4 additional direct sets after substantial pressing; around 3–6 with little pressing.',
    'Often receive sufficient work without front raises; manage shoulder-press fatigue.'),
  'Side delts': info(3, 8, '3–8 direct sets per session.',
    'Direct lateral raises allow targeted loading with limited systemic fatigue.'),
  'Rear delts': info(3, 8, '2–6 additional direct sets after rowing; around 3–8 with little rowing.',
    'Reverse flyes and rear-delt rows can complement broader back work.'),
  Abs: info(2, 6, '2–6 direct sets per session.',
    'Use progressively loaded spinal-flexion and/or anti-extension exercises; manage trunk fatigue.'),
  Quads: info(4, 8, '4–8 direct sets per session.',
    'High-fatigue compound movements often justify fewer sets than isolated extensions.'),
  Hamstrings: info(4, 8, '4–8 combined hip-extension and knee-flexion sets.',
    'Include both functions; stretched-position and eccentric loading may increase recovery demand.'),
  Calves: info(4, 8, '4–8 direct sets per session.',
    'Consider gastrocnemius and soleus; use controlled stretch and full ROM.'),
});
