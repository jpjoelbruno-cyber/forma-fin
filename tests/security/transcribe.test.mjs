import {test} from 'node:test';import assert from 'node:assert/strict';import handler from '../../api/transcribe.js';
const origin='https://forma-fin.vercel.app';function response(){return{statusCode:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this},json(body){this.body=body;return this}};}
test('capabilities expose only a boolean, never a credential',async()=>{const prior=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;const r=response();await handler({method:'GET',headers:{}},r);assert.deepEqual(r.body,{cloud:false});if(prior)process.env.OPENAI_API_KEY=prior;});
test('foreign origin is denied before provider processing',async()=>{const r=response();await handler({method:'POST',headers:{origin:'https://other.example'}},r);assert.equal(r.statusCode,403);});
test('missing authentication is denied',async()=>{const r=response();await handler({method:'POST',headers:{origin}},r);assert.equal(r.statusCode,401);});
test('unsupported methods are denied',async()=>{const r=response();await handler({method:'PUT',headers:{origin}},r);assert.equal(r.statusCode,405);});
