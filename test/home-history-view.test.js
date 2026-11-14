import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canAutoLoad} from '../src/home-history-view.js';

test('canAutoLoad needs the end near, a ready list, more pages and nothing pending',()=>{
 const ready={nearEnd:true,phase:'ready',hasMore:true,loadingMore:false,moreError:null};
 assert.equal(canAutoLoad(ready),true);
 for(const changed of [{nearEnd:false},{phase:'loading'},{hasMore:false},{loadingMore:true},{moreError:Error('offline')}])assert.equal(canAutoLoad({...ready,...changed}),false);
});
