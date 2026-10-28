import {test} from 'node:test';import assert from 'node:assert/strict';import {readSse} from '../src/sse.js';
const enc=new TextEncoder();
export const bytesStream=chunks=>new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(typeof chunk==='string'?enc.encode(chunk):chunk);c.close();}});
test('SSE decoding preserves split Unicode, CRLF, multiline data and comments at every boundary',async()=>{
 const bytes=enc.encode(': keepalive\r\nevent: delta\r\ndata: 💪\r\ndata: next\r\n\r\ndata: end\n\n');
 for(let i=0;i<=bytes.length;i++){const events=[];for await(const frame of readSse(bytesStream([bytes.slice(0,i),bytes.slice(i)])))events.push(frame);assert.deepEqual(events,[{event:'delta',data:'💪\nnext'},{event:'message',data:'end'}]);}
});
test('SSE bounds unterminated frames and cancels its reader',async()=>{
 await assert.rejects(async()=>{for await(const _ of readSse(bytesStream(['data: '+ 'x'.repeat(100)]),{maxFrameBytes:32}))void _;},/large/i);
 let cancelled=false;const abort=new AbortController();const stream=new ReadableStream({cancel(){cancelled=true;}});
 const pending=(async()=>{for await(const _ of readSse(stream,{signal:abort.signal}))void _;})();abort.abort();await assert.rejects(pending);assert.equal(cancelled,true);
});
test('SSE bounds each frame rather than a transport chunk containing many frames',async()=>{
 let count=0;for await(const _ of readSse(bytesStream(['data: ok\n\n'.repeat(100)]),{maxFrameBytes:32})){void _;count++;}assert.equal(count,100);
});
