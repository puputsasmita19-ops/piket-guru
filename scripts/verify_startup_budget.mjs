// Static graph and loader regressions. No browser, Firebase, or network IO.
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { build } from 'esbuild';

const graph = await build({ stdin:{contents:"export {default} from './src/App';",resolveDir:process.cwd(),loader:'tsx'},bundle:true,splitting:true,write:false,format:'esm',platform:'browser',outdir:'startup-graph-only',metafile:true,loader:{'.png':'dataurl'},external:['crypto'] });
assert.ok(!Object.keys(graph.metafile.inputs).some(f=>f.includes('AttendanceGoogleMap')||f.includes('googleMapsLoader')), 'Paid Google SDK must be absent from the entire reachable application graph');console.log('PASS no paid Google Maps integration in the application graph');
const outputs=graph.metafile.outputs, seen=new Set();
function visit(file){if(seen.has(file))return;seen.add(file);for(const dep of outputs[file]?.imports||[]){if(dep.kind!=='dynamic-import'&&!dep.external)visit(dep.path in outputs?dep.path:path.posix.join(path.posix.dirname(file),dep.path));}}
visit(Object.keys(outputs).find(file=>outputs[file].entryPoint==='<stdin>'));
const initialInputs=new Set([...seen].flatMap(file=>Object.keys(outputs[file]?.inputs||{})));
for(const forbidden of ['@firebase/firestore','services/firebase/firestoreService','services/firebase/attendanceService','services/firebase/incidentService','services/firebase/visitorService','vendor/leaflet','features/attendance/AttendanceLocationMap','features/attendance/AttendanceGoogleMap','services/maps/googleMapsLoader']){
 assert.ok(![...initialInputs].some(file=>file.includes(forbidden)),`${forbidden} must stay outside the login static graph`);
 console.log('PASS deferred from login:',forbidden);
}
const loader=await build({stdin:{contents:"export {loadAuthenticatedShell,preloadAuthenticatedShell} from './src/appBootstrap';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'fixture-shell',setup(b){b.onResolve({filter:/AuthenticatedShell$/},()=>({path:'shell',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'globalThis.fixture.evaluations++;export default function Shell(){}'}));}}]});
const fixture={evaluations:0};const ctx=vm.createContext({fixture,module:{exports:{}}});vm.runInContext(loader.outputFiles[0].text,ctx);const {loadAuthenticatedShell,preloadAuthenticatedShell}=ctx.module.exports;
preloadAuthenticatedShell();const a=loadAuthenticatedShell(),b=loadAuthenticatedShell();assert.equal(a,b);await a;assert.equal(fixture.evaluations,1);console.log('PASS prefetch and lazy rendering share a single module request');
if(fs.existsSync('dist/.vite/manifest.json')){
 const manifest=JSON.parse(fs.readFileSync('dist/.vite/manifest.json'));const seenKeys=new Set();
 function collect(key){if(seenKeys.has(key))return;seenKeys.add(key);for(const dep of manifest[key].imports||[])collect(dep);}
 collect('index.html');const files=[...seenKeys].map(k=>manifest[k].file).filter(f=>f.endsWith('.js'));
 const raw=files.reduce((n,f)=>n+fs.statSync('dist/'+f).size,0),gzip=files.reduce((n,f)=>n+zlib.gzipSync(fs.readFileSync('dist/'+f)).length,0);
 assert.ok(raw<600_000,`Login graph budget exceeded: ${raw}`);console.log('PASS production login JS budget:',JSON.stringify({raw,gzip,files}));
 assert.ok(files.length<=2,`Login needs too many serial chunks: ${files.length}`);console.log('PASS login needs at most two initial JavaScript files');
}
