'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');
let ts;
try { ts = require('typescript'); }
catch { try { ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript'); }
  catch { throw Error('TypeScript belum tersedia. Jalankan npm ci terlebih dahulu.'); } }
const root = process.cwd();
const target = path.join(root, 'src', 'utils', 'reportPdf.ts');
const content = fs.readFileSync(target, 'utf8');
let checks = 0;
function ok(label, callback) { callback(); checks++; console.log('PASS', label); }
const parsed = ts.createSourceFile(target, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
ok('Syntax PDF module', () => assert.equal(parsed.parseDiagnostics.length, 0));
ok('R66 layout present', () => assert.match(content, /R66: dynamically reserve caption height/));
ok('Other PDF report builder unchanged', () => assert.match(content, /export async function createReportPdf/));
ok('Print and download helpers preserved', () => assert.match(content, /export function downloadPdf/));
ok('Original source date text preserved', () => assert.match(content, /photo\.tanggalKejadian/));
ok('Caption uses wrapped lines', () => assert.match(content, /splitTextToSize\(text\(part.value\), captionWidth\)/));
ok('Uncropped image uses contain-fit scale', () => assert.match(content, /Math\.min\(\(cw - 2 \* pad\) \/ props\.width, imageBoxHeight \/ props\.height\)/));
ok('Layout respects signatures', () => assert.match(content, /f\.signatures\(f\.bottom - signatureSpace/));
ok('No fixed caption baseline', () => assert.doesNotMatch(content, /top \+ ch - 19/));

const start = content.indexOf('export async function createPhotoReportPdf('), end = content.indexOf('\nexport function downloadPdf', start);
assert.ok(start >= 0 && end > start);
const src = content.slice(start, end);
const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const photo = (n, description = 'Tamu: Bambang • Asal: Dinas Pemadam Kebakaran') => ({
  id: 'p' + n, photoUrl: 'demo-' + n, title: 'Dokumentasi ' + n,
  briefIdentity: description, tanggalKejadian: '2026-10-23', waktuKejadian: '08.42 WIB', petugasName: 'Admin Sekolah',
});
function createHarness({ perPage, entries, signatures, bottom = 275, letterhead = 32 }) {
  const pages = [[]]; let page = 0;
  const cards = [], images = [], captions = [], separators = [];
  let fontSize = 7;
  const doc = {
    setProperties() {}, addPage() { page++; pages.push([]); },
    setFont() {}, setFontSize(value) { fontSize = value; }, setTextColor() {},
    setDrawColor() {}, setLineWidth() {}, setFillColor() {},
    roundedRect(x,y,w,h) { cards.push({page,x,y,w,h}); },
    addImage(data,type,x,y,w,h) { images.push({page,x,y,w,h}); },
    getImageProperties() { return {width:1600,height:900}; },
    line(x1,y1,x2,y2) { separators.push({page,x1,y1,x2,y2}); },
    splitTextToSize(value,width) {
      // Estimate number of 7pt glyphs for geometric regression without a PDF runtime.
      const max = Math.max(5,Math.floor(width / (fontSize * 25.4 / 72 * .52)));
      return String(value).split('\n').flatMap(s=>{const words=s.split(/\s+/);const arr=[];let line='';for(const word of words){if((line+' '+word).trim().length>max && line){arr.push(line);line=word;}else line=[line,word].filter(Boolean).join(' ');}if(line)arr.push(line);return arr.length?arr:[''];});
    },
    text(lines,x,y,options={}) { captions.push({page,x,y,lines, fontSize,lh:options.lineHeightFactor||1}); },
  };
  const f = {
    doc, config: {showSignatures: signatures}, left:15, width:180, bottom,
    letterhead: () => letterhead,
    write: (value,x,y) => 5,
    signatures() {}, finish: () => new Uint8Array([37,80,68,70]),
  };
  const module={exports:{}};
  vm.runInNewContext(js, {module, exports:module.exports, pdfDocument:async()=>f,
    photoData:async()=> 'data:image/jpeg;base64,AAAA', text:x=>String(x??''),
    PT:25.4/72, Math, Uint8Array, Error, console,
  });
  return {fn:module.exports.createPhotoReportPdf, settings:{},options:{perPage,period:'Oktober 2026', date:'24 Oktober 2026', city:'Purwakarta'}, entries,cards,images,captions,separators,pages};
}
(async()=>{
  for(const [label, config] of [
    ['Four-up A4', {perPage:4,entries:Array.from({length:4},(_,i)=>photo(i))}],
    ['Two-up A4', {perPage:2,entries:Array.from({length:2},(_,i)=>photo(i))}],
    ['Four-up signatures', {perPage:4,entries:Array.from({length:4},(_,i)=>photo(i)),signatures:true}],
    ['Single last-page card', {perPage:4,entries:Array.from({length:5},(_,i)=>photo(i))}],
    ['Long identity, 2-up', {perPage:2,entries:[photo(0,'Peristiwa kerusakan sarana prasarana sekolah pada ruang kelas X APL dan kursi kelas belum lengkap sehingga diperlukan tindak lanjut petugas sekolah'),photo(1)]}],
  ]) {
    const h=createHarness(config);
    await h.fn(h.entries,h.settings,h.options);
    ok(label + ': one card per photo',()=>assert.equal(h.cards.length,h.entries.length));
    ok(label + ': images contained by cards',()=>{for(const [i,img] of h.images.entries()){
      const card=h.cards[i];assert.equal(img.page,card.page);assert.ok(img.x>=card.x-0.001 && img.y>=card.y-0.001);
      assert.ok(img.x+img.w<=card.x+card.w+0.001 && img.y+img.h<=card.y+card.h+0.001);
    }});
    ok(label + ': text inside card and below photograph',()=>{for(const c of h.captions){
      const card=h.cards.find(b=>b.page===c.page && c.x>=b.x && c.x<=b.x+b.w && c.y>=b.y && c.y<=b.y+b.h);
      assert.ok(card,'Caption without card');
      const image=h.images.find(i=>i.page===card.page && i.x>=card.x && i.x<=card.x+card.w && i.y>=card.y && i.y<=card.y+card.h);
      const textBottom = c.y + Math.max(0,c.lines.length-1)*c.fontSize*25.4/72*c.lh;
      assert.ok(textBottom <= card.y+card.h - 1,'Caption extends beyond card');
      assert.ok(c.y > image.y+image.h,'Caption overlaps photo');
    }});
  }
  const one = createHarness({perPage:4, entries:[photo(1)]});
  await one.fn(one.entries,one.settings,one.options);
  ok('Single photo uses full available width',()=>assert.equal(one.cards[0].w,180));
  const big = createHarness({perPage:4,entries:[photo(1, 'Penjelasan '.repeat(160)),photo(2),photo(3),photo(4)]});
  await assert.rejects(big.fn(big.entries,big.settings,big.options), /Keterangan foto tidak muat|Ruang rekap foto terlalu sempit/);
  ok('Oversized caption fails safely instead of clipping',()=>{});
  console.log(`R66: ${checks} checks PASS`);
})().catch(e=>{console.error('FAIL R66:',e);process.exitCode=1;});
