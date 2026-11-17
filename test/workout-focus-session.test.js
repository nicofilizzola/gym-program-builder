import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkoutFocusSession} from '../src/workout-focus-session.js';
test('session defaults and reads are copied',()=>{const s=createWorkoutFocusSession();assert.deepEqual(s.read('one'),{viewed:null,autoNext:true,weightIncrement:2.5});const ref={exerciseId:'e',setId:'s'};s.patch('one',{viewed:ref});ref.setId='changed';const value=s.read('one');value.viewed.setId='changed';assert.equal(s.read('one').viewed.setId,'s');});
test('cursor is per log while preferences are shared',()=>{const s=createWorkoutFocusSession();s.patch('one',{viewed:{exerciseId:'e',setId:'s'},autoNext:false,weightIncrement:.25});assert.deepEqual(s.read('two'),{viewed:null,autoNext:false,weightIncrement:.25});});
test('auth clear removes all cursors and preferences',()=>{const s=createWorkoutFocusSession();s.patch('one',{viewed:{exerciseId:'e',setId:'s'},autoNext:false});s.clear();assert.deepEqual(s.read('one'),{viewed:null,autoNext:true,weightIncrement:2.5});});
test('per-page partner selections are never session fields',()=>{const s=createWorkoutFocusSession();s.patch('one',{viewed:{exerciseId:'a',setId:'a1'},selection:{round:{exerciseId:'b',setId:'b1'}},pages:[1]});assert.deepEqual(Object.keys(s.read('one')).sort(),['autoNext','viewed','weightIncrement']);assert.deepEqual(s.read('one').viewed,{exerciseId:'a',setId:'a1'});});
