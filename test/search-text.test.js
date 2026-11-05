import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesQuery,normalizeSearch} from '../src/search-text.js';

test('matchesQuery is token, case and accent insensitive',()=>{
 assert.equal(matchesQuery('Pull A — Dos','pull'),true);
 assert.equal(matchesQuery('Épaules lourdes','epaules LOURD'),true);
 assert.equal(matchesQuery('Push A','push b'),false);
 assert.equal(matchesQuery('Anything','   '),true);
 assert.equal(matchesQuery('Anything',''),true);
});
test('normalizeSearch strips marks, lowercases and trims',()=>{
 assert.equal(normalizeSearch('  Crème  '),'creme');
});
