const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('education-accounts.js','utf8');
function player(){const c=vm.createContext({document:{createElement:()=>({})},esc:x=>String(x)});vm.runInContext(source.slice(source.indexOf(' function videoPoster('),source.indexOf(' function paintCatalog(')),c);const container={replaceChildren(frame){this.frame=frame}};return{c,container}}
test('click playback embeds video in app with autoplay permission',()=>{const {c,container}=player();c.playVideo({youtube_id:'abcdefghijk',title:'Clase'},container);assert.match(container.frame.src,/youtube-nocookie.com\/embed\/abcdefghijk\?playsinline=1&autoplay=1$/);assert.match(container.frame.allow,/autoplay/)});
test('admin preview does not autoplay before clicking player',()=>{const {c,container}=player();c.playVideo({youtube_id:'abcdefghijk',title:'Clase'},container,false);assert.doesNotMatch(container.frame.src,/autoplay=1/)});
test('invalid video ID cannot create a frame',()=>{const {c,container}=player();c.playVideo({youtube_id:'https://evil.example'},container);assert.equal(container.frame,undefined)});
