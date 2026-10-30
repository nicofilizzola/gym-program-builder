import test from 'node:test';
import assert from 'node:assert/strict';
import {duplicateName} from '../src/duplicate-name.js';
test('library copies choose the lowest unused suffix without changing the source base',()=>{
 assert.equal(duplicateName('ABC',[],'Untitled template'),'ABC 1');
 assert.equal(duplicateName(' ABC ',['ABC 1',' abc 2 '],'Untitled template'),'ABC 3');
 assert.equal(duplicateName('ABC',['ABC 1','ABC 3'],'Untitled template'),'ABC 2');
 assert.equal(duplicateName(' ',[],'Untitled template'),'Untitled template 1');
 assert.equal(duplicateName('',[],'Untitled program'),'Untitled program 1');
 assert.equal(duplicateName('ABC 1',[],'Untitled template'),'ABC 1 1');
});
