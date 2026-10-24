const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const utilFile = 'src/utils/adminMonitorRows.ts';
const viewFile = 'src/features/attendance/AdminAttendanceDashboard.tsx';
const util = read(utilFile), view = read(viewFile);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS R55-${String(passed).padStart(2,'0')}: ${name}`); }

for (const filename of [utilFile, viewFile]) {
  const tree = ts.createSourceFile(filename, read(filename), ts.ScriptTarget.Latest, true,
    filename.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  test(`${filename} parses as TypeScript`,()=>assert.equal(tree.parseDiagnostics.length,0,
    tree.parseDiagnostics.map(x=>x.messageText).join('; ')));
}
const transpiled=ts.transpileModule(util,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox = {exports:{}};
vm.runInNewContext(transpiled, sandbox, {timeout:1000});
const {buildAdminMonitorRows} = sandbox.exports;

const schedule = (id,name,room='Gerbang')=>({petugasId:id,petugasName:name,ruangName:room,active:true});
const att=(id,userId,userName)=>({id,userId,userName,status:'DALAM_LOKASI'});
const project=(rows)=>JSON.parse(JSON.stringify(rows));
const reference=(schedules,attendance,active)=>{
  const rows=new Map();
  for (const schedule of schedules.filter(active)) {
    const key=schedule.petugasId||`name:${schedule.petugasName}`;
    const matching=attendance.find(a=>a.userId===schedule.petugasId)||attendance.find(a=>a.userName.trim().toLowerCase()===schedule.petugasName.trim().toLowerCase());
    const prev=rows.get(key);
    if (prev) prev.assignment+=` · ${schedule.ruangName}`;
    else rows.set(key,{id:key,name:schedule.petugasName,assignment:schedule.ruangName||'Piket',attendance:matching});
  }
  for(const a of attendance){if(![...rows.values()].some(r=>r.attendance?.id===a.id)) rows.set(`extra:${a.id}`,{id:`extra:${a.id}`,name:a.userName,assignment:'Presensi tambahan / tanpa jadwal',attendance:a});}
  return [...rows.values()].sort((a,b)=>a.name.localeCompare(b.name,'id-ID'));
};
const check=(name,ss,aa)=>test(name,()=>assert.deepEqual(project(buildAdminMonitorRows(ss,aa,s=>s.active)),project(reference(ss,aa,s=>s.active))));
check('empty',[],[]);
check('exact ID takes precedence', [schedule('u1','Guru Satu')],[att('a2','u2','Guru Satu'),att('a1','u1','Another')]);
check('legacy name fallback', [schedule('missing','GURU DUA')],[att('a1','x',' Guru Dua ')]);
check('multiple shifts count one row', [schedule('u1','Guru Satu','Pagi'),schedule('u1','Guru Satu','Sore')],[att('a1','u1','Guru Satu')]);
check('unscheduled attendance preserved', [schedule('u1','Guru Satu')],[att('a1','u1','Guru Satu'),att('a2','u2','Guru Lain')]);
check('duplicate attendance records preserved', [schedule('u1','Guru Satu')],[att('a1','u1','Guru Satu'),att('a2','u1','Guru Satu')]);
check('inactive schedule ignored', [{...schedule('u1','Guru Satu'),active:false}],[att('a1','u1','Guru Satu')]);
check('unassigned duplicate shifts respect same keys', [schedule('','Anonim'),schedule('','Anonim','Kelas')],[]);
check('empty room fallback', [schedule('u1','Guru Satu','')],[]);
check('same user name and another ID', [schedule('u1','Guru Satu'),schedule('u2','Guru Satu')],[att('a1','u1','Guru Satu'),att('a2','u2','Guru Satu')]);

// Larger deterministic collection comparison checks the optimized algorithm against R54 semantics.
const ss=Array.from({length:1000},(_,i)=>schedule(`u${i}`,`Guru ${i}`,`Pos ${i % 5}`));
const aa=Array.from({length:1300},(_,i)=>att(`a${i}`,`u${i}`,`Guru ${i}`));
check('1000 assignments + 1300 attendance equivalence',ss,aa);
test('history initially collapsed',()=>assert.match(view,/useState\(false\);[\s\S]*?const \[userFilter/));
test('subscription guarded by expanded state',()=>assert.match(view,/if \(!admin \|\| !historyExpanded \|\| history\.range\.error\) return;/));
test('unsubscribe when collapse/unmount dependency',()=>assert.match(view,/\[admin, historyExpanded, history\.key, history\.constraints, history\.range\.error\]/));
test('history controls remain mounted only after click',()=>assert.match(view,/historyExpanded && <div id="monitor-history-content"/));
test('history toggle keyboard accessible',()=>assert.match(view,/type="button" aria-controls="monitor-history-content" aria-expanded=\{historyExpanded\}/));
test('admin-only guard retained',()=>assert.match(view,/if \(!admin\) return <div role="alert"/));
test('edit / delete and audited dialog retained',()=>{assert.match(view,/mode: 'edit'/);assert.match(view,/mode: 'delete'/);assert.match(view,/<AdminAttendanceDialog /)});
test('today attendance remains realtime',()=>assert.match(view,/subscribeToCollection<AttendanceRecord>\('attendance', data =>/));
console.log(`R55: ${passed} checks passed`);
