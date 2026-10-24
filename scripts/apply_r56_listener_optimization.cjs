#!/usr/bin/env node
/**
 * R56 safe incremental installer. Requires the CURRENT local Piket Guru checkout.
 * Never copies old MasterDataTabs/SettingsView sources into newer releases.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const files = [
  'src/features/master/MasterDataTabs.tsx',
  'src/features/settings/SettingsView.tsx'
];
const marker = 'R56: listener optimizations';
function requireOnce(src, token, label) {
  const parts = src.split(token);
  if (parts.length !== 2) throw Error(`R56 compatibility check failed (${label}, found ${parts.length-1}). No files changed.`);
  return true;
}
function substitute(src, before, after, label) {
  requireOnce(src,before,label);
  return src.replace(before,after);
}
function updateMaster(original) {
  if (original.includes(marker)) throw Error('Master already modified by R56. Stop rather than applying twice.');
  let src=original;
  src=substitute(src,
    "  const [categories, setCategories] = useState<IncidentCategoryRecord[]>([]);",
    `  const [categories, setCategories] = useState<IncidentCategoryRecord[]>([]);\n  // ${marker}: inactive master tabs use inexpensive counts, not live document streams.\n  const [masterCounts, setMasterCounts] = useState<Record<string, number>>({});`,
    'master state');

  const start=src.indexOf('  // Initial Load & Realtime subscriptions');
  if (start===-1) throw Error('R56 compatibility check failed (Master listener block missing). No files changed.');
  const end=src.indexOf('  // Modal Openers with custom status support',start);
  if(end<start) throw Error('R56 compatibility check failed (Master end anchor missing). No files changed.');
  const old=src.slice(start,end);
  const names=["'teachers'", "'staff'", "'students'", "'rooms'", "'incidentCategories'"];
  for(const n of names) if(!old.includes(`subscribeToCollection`)||!old.includes(n)) throw Error('R56 compatibility check failed (master live listener '+n+'). No files changed.');
  if(!src.includes('<LessonSchedulesPanel teachers={teachers} students={students} />')) throw Error('R56 compatibility check failed (LessonSchedules dependent collections changed). No files changed.');
  if(!old.includes('MasterDataService.bootstrapIfEmpty()'))throw Error('R56 compatibility check failed (bootstrap semantics). No files changed.');
  if(!old.includes('unsubTeachers()')||!old.includes('unsubStudents()'))throw Error('R56 compatibility check failed (teardown semantics). No files changed.');
  const replacement=`  // Initial Master bootstrap remains unchanged; one lightweight count query per category\n  // replaces opening five complete collection listeners on the default Guru tab.\n  useEffect(() => {\n    let alive = true;\n    MasterDataService.bootstrapIfEmpty().then(() => {\n      if (alive) setIsLoading(false);\n    }).catch((error) => {\n      console.warn('[R56] Master bootstrap:', error);\n      if (alive) setIsLoading(false);\n    });\n    const names = ['teachers', 'staff', 'students', 'rooms', 'incidentCategories'] as const;\n    for (const collectionName of names) {\n      FirestoreService.getCollectionCount(collectionName).then(count => {\n        if (alive) setMasterCounts(previous => previous[collectionName] === undefined ? ({ ...previous, [collectionName]: count }) : previous);\n      }).catch(error => {\n        // Unknown is not zero. Keep badge as ellipsis until tab data is opened.\n        console.warn('[R56] Collection count unavailable:', collectionName, error);\n      });\n    }\n    return () => { alive = false; };\n  }, []);\n\n  // ${marker}: only one master collection is live at a time.\n  useEffect(() => {\n    let alive = true;\n    const subscriptions: Array<() => void> = [];\n    const listen = <T,>(collectionName: string, receive: (items: T[]) => void) => {\n      subscriptions.push(FirestoreService.subscribeToCollection<T>(collectionName, items => {\n        if (!alive) return;\n        receive(items);\n        setMasterCounts(previous => ({ ...previous, [collectionName]: items.length }));\n      }));\n    };\n    if (activeTab === 'teachers') listen<TeacherRecord>('teachers', setTeachers);\n    else if (activeTab === 'staff') listen<StaffRecord>('staff', setStaffList);\n    else if (activeTab === 'students') listen<StudentRecord>('students', setStudents);\n    else if (activeTab === 'rooms') listen<RoomRecord>('rooms', setRooms);\n    else if (activeTab === 'categories') listen<IncidentCategoryRecord>('incidentCategories', setCategories);\n    else if (activeTab === 'lessonSchedules') {\n      // LessonSchedulesPanel uses both datasets to populate teacher/student pickers.\n      listen<TeacherRecord>('teachers', setTeachers);\n      listen<StudentRecord>('students', setStudents);\n    }\n    return () => { alive = false; for (const stop of subscriptions) stop(); };\n  }, [activeTab]);\n\n`;
  src=src.slice(0,start)+replacement+src.slice(end);
  const badges=[
    ['teachers.length',"masterCounts.teachers ?? (activeTab === 'teachers' ? teachers.length : undefined)"],
    ['staffList.length',"masterCounts.staff ?? (activeTab === 'staff' ? staffList.length : undefined)"],
    ['students.length',"masterCounts.students ?? (activeTab === 'students' ? students.length : undefined)"],
    ['rooms.length',"masterCounts.rooms ?? (activeTab === 'rooms' ? rooms.length : undefined)"],
    ['categories.length',"masterCounts.incidentCategories ?? (activeTab === 'categories' ? categories.length : undefined)"]
  ];
  for(const [oldCount,newCount] of badges) {
    const token=`count: ${oldCount}`;
    src=substitute(src,token,`count: ${newCount}`,`badge ${oldCount}`);
  }
  // Render unknown counts as an ellipsis, not 0; once a tab is opened it receives live updates.
  src=substitute(src,`{tab.count !== undefined && <span`,`{<span`,'badge indicator');
  src=substitute(src,`                {tab.count}\n              </span>}`,`                {tab.count ?? '…'}\n              </span>}`,'badge fallback');
  return src;
}

function updateSettings(original) {
  if(original.includes(marker))throw Error('Settings already modified by R56. Stop rather than applying twice.');
  const startToken="    const unsubUsers = FirestoreService.subscribeToCollection<UserProfile>('users', (data) => {";
  const start=original.indexOf(startToken);
  if(start<0)throw Error('R56 compatibility check failed (Settings users listener missing). No files changed.');
  const endToken='    return () => {\n      mountedRef.current = false;';
  const end=original.indexOf(endToken,start);
  if(end<0)throw Error('R56 compatibility check failed (Settings cleanup missing). No files changed.');
  const block=original.slice(start,end);
  for(const name of ['users','schedules','substitutions','studentTardiness','studentPermits','visitors','announcements']) {
    if (!block.includes(`'${name}'`)) throw Error(`R56 compatibility check failed (Settings source ${name}). No files changed.`);
  }
  // Guard against silently starving NEW settings widgets introduced after this audit.
  // We audited references in the original source: only SecurityCenterCard consumes
  // users, and LobbyTvSettingsCard consumes the six operational arrays.
  const expectedUsage = { users: 4, schedules: 4, substitutions: 4, tardiness: 3, permits: 3, visitors: 4, announcements: 4 };
  for (const [field, expected] of Object.entries(expectedUsage)) {
    const matches = original.match(new RegExp(`\\b${field}\\b`, 'g')) || [];
    if (matches.length !== expected) throw Error(`R56 compatibility check failed (Settings field ${field} now has ${matches.length} references; expected ${expected}). No files changed.`);
  }
  const cleanup=`      unsubUsers();\n      unsubSched();\n      unsubSub();\n      unsubTrd();\n      unsubPmt();\n      unsubVis();\n      unsubAnnounce();\n`;
  requireOnce(original,cleanup,'Settings listener cleanup');
  let src=original.slice(0,start)+original.slice(end);
  src=substitute(src,cleanup,'','Settings cleanup removal');
  // New effect is scoped to tab, allowing real-time TV preview and security details to stay live.
  const anchor='  // 1. Terapkan jam input utama ke seluruh hari operasional aktif';
  const effect=`  // ${marker}: subscribe to operational data only for the tab that uses it.\n  useEffect(() => {\n    if (activeTab === 'security' && isAdmin) {\n      return FirestoreService.subscribeToCollection<UserProfile>('users', setUsers);\n    }\n    if (activeTab !== 'lobby_tv') return;\n    const todayISO = new Date().toISOString().split('T')[0];\n    const stop = [\n      FirestoreService.subscribeToCollection<ScheduleItem>('schedules', setSchedules),\n      FirestoreService.subscribeToCollection<TeacherSubstitutionRecord>('substitutions', setSubstitutions, undefined, [where('tanggal', '==', todayISO)]),\n      FirestoreService.subscribeToCollection<StudentTardyRecord>('studentTardiness', setTardiness, undefined, [where('tanggal', '==', todayISO)]),\n      FirestoreService.subscribeToCollection<StudentPermitRecord>('studentPermits', setPermits, undefined, [where('status', '==', 'SEDANG_KELUAR')]),\n      FirestoreService.subscribeToCollection<VisitorRecord>('visitors', setVisitors, undefined, [where('status', '==', 'SEDANG_BERKUNJUNG')]),\n      FirestoreService.subscribeToCollection<AnnouncementRecord>('announcements', setAnnouncements, undefined, [where('isActive', '==', true)]),\n    ];\n    return () => { for (const unsubscribe of stop) unsubscribe(); };\n  }, [activeTab, isAdmin]);\n\n`;
  src=substitute(src,anchor,effect+anchor,'Settings tab-dependent subscriptions');
  return src;
}
function main(){
  const originals=files.map(f=>({rel:f,abs:path.resolve(root,f)}));
  for(const f of originals){if(!f.abs.startsWith(root+path.sep)||!fs.existsSync(f.abs))throw Error(`Missing ${f.rel}: run from repository root containing the real R55 source.`);f.content=fs.readFileSync(f.abs,'utf8')}
  const result=[updateMaster(originals[0].content),updateSettings(originals[1].content)];
  // Optional compiler check on the staged output if available locally; no install needed.
  let ts;try{ts=require('typescript')}catch{}
  if(ts) {
    for(let i=0;i<result.length;i++){
      const name=files[i];
      const ast=ts.createSourceFile(name,result[i],ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      if(ast.parseDiagnostics.length)throw Error(`TypeScript syntax validation failed for ${name}: ${ast.parseDiagnostics.map(d=>d.messageText).join('; ')}`);
    }
  }
  if(dryRun){console.log('R56 DRY RUN PASSED: current repository matches expected anchors. No source files changed.');return}
  const backup=fs.mkdtempSync(path.join(os.tmpdir(),'piket-r56-backup-'));
  for(let i=0;i<originals.length;i++){
    const f=originals[i];fs.writeFileSync(path.join(backup,path.basename(f.rel)),f.content);
  }
  try {for(let i=0;i<originals.length;i++)fs.writeFileSync(originals[i].abs,result[i]);}
  catch(e){for(let i=0;i<originals.length;i++)fs.writeFileSync(originals[i].abs,originals[i].content);throw e}
  console.log('R56 APPLIED to two source files; original backups:',backup);
  console.log('Review GitHub Desktop Changes, then run npm run lint and npm run build before Commit/Push.');
}
try{main()}catch(e){console.error('R56 STOPPED SAFELY:',e.message);process.exitCode=1}
