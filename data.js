/* ชั้นข้อมูลของระบบใบรับรองความประพฤติ
   - เปิดบน spk1234-aff.github.io → ใช้ Firebase spk-score-system ร่วมกับ SMART SPK
   - เปิดที่อื่น (หรือใส่ ?demo ต่อท้ายลิงก์) → โหมดทดลอง ข้อมูลเก็บในเบราว์เซอร์

   โครงสร้างใน Firestore (ขึ้นต้นด้วย ss_ ตามกฎของ SMART SPK)
     ss_cert/{key}        key = รหัสเดียวกับ ss_stu/{key} ของนักเรียนคนนั้น
                          {sid, name, cls, reqs:[ {id, createdAt, birth, father, mother, purpose, purposeOther, status, ...} ]}
     ss_cert_cfg/main     ตั้งค่า (ผู้ลงนาม เกณฑ์ ฯลฯ)
     ss_cert_cfg/counter  เลขที่ใบล่าสุดของแต่ละปีการศึกษา
   ข้อมูลที่อ่านจาก SMART SPK: ss_stu/{key}, students/{id} (คะแนน/สายจากระบบเดิม), ss_config/public, ss_users/{uid}, ss_usernames/{u} */
(function(){
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCyjqbIFbG365X_O8w04Padi5eH6BITKTU",
  authDomain: "spk-score-system.firebaseapp.com",
  projectId: "spk-score-system",
  storageBucket: "spk-score-system.firebasestorage.app",
  messagingSenderId: "568980787667",
  appId: "1:568980787667:web:daa2a6906b128271151f26"
};
const LIVE = location.hostname === "spk1234-aff.github.io" && !/[?&]demo\b/.test(location.search);

const DEFAULT_SETTINGS = {
  signers: [
    {name: "นายโชคชัย ชินโณ", acting: false},
    {name: "นายสุวรรณ ชัยขันธ์", acting: true},
    {name: "นางประภัสสร จันทร์เภา", acting: true}
  ],
  defaultSigner: 0,
  maxDeduct: 20,       // คะแนนความประพฤติที่ถูกหักสะสมเกินนี้ → ควรพิจารณา
  maxLate: 10,         // มาสายสะสมเกินนี้ → ควรพิจารณา
  showCertNo: false,
  purposes: ["สมัครเรียนต่อ", "สมัครงาน", "ขอทุนการศึกษา", "สมัครสอบ / แข่งขัน", "อื่น ๆ"]
};
const PREFIX = /^(นางสาว|นาง|นาย|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|น\.ส\.)/;
function splitName(full){
  full = String(full || "").trim();
  const m = full.match(PREFIX), prefix = m ? m[1] : "", rest = full.slice(prefix.length).trim().split(/\s+/);
  return {prefix, fname: rest[0] || "", lname: rest.slice(1).join(" ")};
}
function splitCls(cls){ const m = String(cls || "").match(/(\d)\s*\/\s*(\d{1,2})/); return m ? {level: m[1], room: String(+m[2])} : {level: "", room: ""}; }
const nowISO = () => new Date(Date.now() + 7*3600e3).toISOString().slice(0, 19);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = o => JSON.parse(JSON.stringify(o));
/* แปลงเอกสาร ss_cert เป็นรายการคำขอแบบแบน (ใส่ key และข้อมูลนักเรียนในแต่ละคำขอ) */
function flatten(key, doc){
  const base = {key, sid: doc.sid, ...splitName(doc.name), ...splitCls(doc.cls)};
  return (doc.reqs || []).map(r => ({...base, ...r}));
}
const STU_FIELDS = ["prefix", "fname", "lname", "level", "room"];
/* คำขอแบบแบน → ข้อมูลที่เก็บใน reqs (เก็บชื่อ/ชั้นเฉพาะเมื่อครูแก้ให้ต่างจากระบบ) */
function packReq(r, doc){
  const out = {...r}; delete out.key; delete out.sid;
  const base = {...splitName(doc.name), ...splitCls(doc.cls)};
  STU_FIELDS.forEach(k => { if (out[k] === base[k]) delete out[k]; });
  return out;
}

/* ====================== Firestore ====================== */
function LiveDB(){
  const base = "https://www.gstatic.com/firebasejs/10.7.0/";
  let fs, au, db, auth;
  const ready = (async () => {
    const [A, F, U] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-firestore.js"), import(base + "firebase-auth.js")]);
    const app = A.initializeApp(FIREBASE_CONFIG);   // ชื่อแอปเริ่มต้น → ใช้การล็อกอินร่วมกับ SMART SPK (โดเมนเดียวกัน)
    fs = F; au = U; db = F.getFirestore(app); auth = U.getAuth(app);
    await U.setPersistence(auth, U.browserLocalPersistence).catch(() => {});
  })();
  const get = async path => { await ready; const s = await fs.getDoc(fs.doc(db, path)); return s.exists() ? s.data() : null; };
  let pub = null;
  const portalIdOnly = async () => { pub = pub || await get("ss_config/public") || {}; return pub.portalIdOnly !== false; };
  async function keyOf(id, pw){
    const data = new TextEncoder().encode(`spk:${String(id).trim()}:${String(pw || "").replace(/\D/g, "")}`);
    const h = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(h)].slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  const toStudent = (key, s) => ({key, sid: String(s.id), ...splitName(s.name), ...splitCls(s.cls)});
  const docs = {};   // ss_cert ที่โหลดไว้ (key → doc)

  return {
    mode: "live",
    /* ---------- นักเรียน ---------- */
    portalIdOnly,
    async studentSession(){
      let p = null; try { p = JSON.parse(localStorage.getItem("ss_parent") || "null"); } catch(e){}
      if (!p || !p.key) return null;
      const s = await get("ss_stu/" + p.key).catch(() => null);
      return s ? toStudent(p.key, s) : null;
    },
    async studentLogin(id, pw){
      const key = await keyOf(id, (await portalIdOnly()) ? "" : pw);
      const s = await get("ss_stu/" + key);
      if (!s) return null;
      try { localStorage.setItem("ss_parent", JSON.stringify({id: String(id).trim(), key})); } catch(e){}
      return toStudent(key, s);
    },
    studentLogout(){ try { localStorage.removeItem("ss_parent"); } catch(e){} },
    async listMine(st){ const d = await get("ss_cert/" + st.key); return d ? flatten(st.key, d) : []; },
    async addRequest(st, data){
      await ready;
      const ref = fs.doc(db, "ss_cert", st.key), req = {id: newId(), createdAt: nowISO(), status: "pending",
        birth: data.birth, father: data.father, mother: data.mother, purpose: data.purpose, purposeOther: data.purposeOther || ""};
      const cur = await fs.getDoc(ref);
      const s = await get("ss_stu/" + st.key);
      if (cur.exists()) await fs.updateDoc(ref, {reqs: [...(cur.data().reqs || []), req]});
      else await fs.setDoc(ref, {sid: st.sid, name: s.name, cls: s.cls, reqs: [req]});
    },
    /* ---------- ครู ---------- */
    onStaff(cb){
      ready.then(() => au.onAuthStateChanged(auth, async u => {
        if (!u) return cb(null);
        const p = await get("ss_users/" + u.uid).catch(() => null);
        cb(p && !p.disabled ? {uid: u.uid, name: p.name, role: p.role} : {uid: u.uid, role: "none"});
      }));
    },
    async staffLogin(user, pw){
      await ready; user = String(user).trim().toLowerCase();
      let email = user;
      if (!user.includes("@")) { const m = await get("ss_usernames/" + user).catch(() => null); email = m && m.email ? m.email : `${user}@smartspk.app`; }
      await au.signInWithEmailAndPassword(auth, email, pw);
    },
    async staffLogout(){ await ready; await au.signOut(auth); },
    async getConduct(r){
      const legacy = await get("students/" + r.sid).catch(() => null);
      if (legacy) return {score: Math.max(0, +legacy.khun || 0), late: Math.max(0, +legacy.say || 0)};
      const s = await get("ss_stu/" + r.key).catch(() => null);
      if (!s) return null;
      const c = s.c || {};
      return {score: Math.max(0, (c.minus || 0) - (c.restore || 0) - (c.merit || 0)), late: Math.max(0, (c.late || 0) - (c.lateAdj || 0))};
    },
    async listRequests(){
      await ready;
      const snap = await fs.getDocs(fs.collection(db, "ss_cert"));
      const out = [];
      snap.forEach(d => { docs[d.id] = d.data(); out.push(...flatten(d.id, d.data())); });
      return out;
    },
    async updateRequest(r, patch){
      await ready;
      const ref = fs.doc(db, "ss_cert", r.key);
      await fs.runTransaction(db, async t => {
        const s = await t.get(ref), doc = s.data(), reqs = doc.reqs || [];
        const i = reqs.findIndex(x => x.id === r.id); if (i < 0) throw new Error("ไม่พบคำขอ");
        reqs[i] = packReq({...flatten(r.key, doc)[i], ...patch}, doc);
        t.update(ref, {reqs});
      });
    },
    async getSettings(){ return {...DEFAULT_SETTINGS, ...(await get("ss_cert_cfg/main").catch(() => null) || {})}; },
    async saveSettings(s){ await ready; await fs.setDoc(fs.doc(db, "ss_cert_cfg", "main"), s); },
    async nextCertNos(n, year){
      await ready; const ref = fs.doc(db, "ss_cert_cfg", "counter");
      return fs.runTransaction(db, async t => {
        const s = await t.get(ref), c = (s.exists() && s.data()["y" + year]) || 0;
        t.set(ref, {["y" + year]: c + n}, {merge: true});
        return Array.from({length: n}, (_, i) => c + i + 1);
      });
    }
  };
}

/* ====================== โหมดทดลอง ====================== */
function DemoDB(){
  const KEY = "certDemo.v2";
  // คะแนน = คะแนนความประพฤติที่ถูกหักสะสม (0 = ไม่เคยถูกหัก) แบบเดียวกับ SMART SPK
  const ROSTER = [
    ["13999","นางสาวสมใจ ใจดี","ม.6/2",0,1],["14001","นายภูมิ รักเรียน","ม.6/2",5,0],["14012","นางสาวกานดา ศรีสุข","ม.6/3",10,4],
    ["14020","นายธนพล มีสุข","ม.6/1",45,17],["14105","นางสาวพิมพ์ชนก บุญมา","ม.5/4",0,2],["14110","นายอนันต์ แก้วใส","ม.5/1",25,12],
    ["14233","เด็กหญิงปาริชาต ทองดี","ม.3/3",5,3],["14240","เด็กชายกิตติ ใจกล้า","ม.3/1",15,8],["14301","นายวีรภัทร สมบูรณ์","ม.6/4",0,0],
    ["14322","นางสาวณัฐธิดา พรหมมา","ม.6/5",10,6]
  ].map(([id, name, cls, score, late]) => ({id, name, cls, score, late}));
  const find = sid => ROSTER.find(x => x.id === String(sid).trim());
  const toStudent = s => ({key: "k" + s.id, sid: s.id, ...splitName(s.name), ...splitCls(s.cls)});

  function seed(){
    const P = DEFAULT_SETTINGS.purposes, certs = {}, counters = {};
    const dates = ["2025-06-12","2025-08-03","2025-08-20","2025-10-02","2025-11-18","2026-01-09","2026-02-18","2026-02-25",
                   "2026-03-03","2026-03-10","2026-03-24","2026-03-24","2026-04-07","2026-06-15","2026-08-21","2026-09-29","2026-10-30","2026-11-02","2026-11-03"];
    dates.forEach((d, i) => {
      const s = ROSTER[(i*3) % ROSTER.length], last = i >= dates.length - 3, lv = +splitCls(s.cls).level;
      const rejected = !last && s.score > 30, last2 = splitName(s.name).lname;
      const r = {id: "d" + i, createdAt: d + "T09:00:00", birth: `${2026 - 12 - lv}-0${1 + i%9}-1${i%9}`,
        father: "นายสมพร " + last2, mother: "นางสมร " + last2, purpose: P[i % P.length], purposeOther: i % P.length === 4 ? "ยื่นประกอบการขอรับบัตร" : "",
        status: last ? "pending" : rejected ? "rejected" : (i % 4 === 0 ? "approved" : "ready"), rejectReason: rejected ? "ให้มาพบครูกิจการนักเรียนก่อน" : ""};
      if (r.status === "ready") { const y = Cert.academicYear(d); counters["y" + y] = (counters["y" + y] || 0) + 1;
        Object.assign(r, {issueDate: d, printedAt: d, readyAt: d, signer: DEFAULT_SETTINGS.signers[i % 3], certNo: `${counters["y" + y]}/${y}`}); }
      const k = "k" + s.id; (certs[k] = certs[k] || {sid: s.id, name: s.name, cls: s.cls, reqs: []}).reqs.push(r);
    });
    return {certs, settings: DEFAULT_SETTINGS, counters};
  }
  let mem = null;
  const load = () => { if (mem) return mem; try { mem = JSON.parse(localStorage.getItem(KEY)); } catch(e){} if (!mem) { mem = seed(); save(); } return mem; };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch(e){} };
  let sess = null;
  return {
    mode: "demo", roster: ROSTER,
    async portalIdOnly(){ return true; },
    async studentSession(){ return sess; },
    async studentLogin(id){ const s = find(id); return sess = s ? toStudent(s) : null; },
    studentLogout(){ sess = null; },
    async listMine(st){ const d = load().certs[st.key]; return d ? clone(flatten(st.key, d)) : []; },
    async addRequest(st, data){ const d = load(), s = find(st.sid);
      const doc = d.certs[st.key] = d.certs[st.key] || {sid: s.id, name: s.name, cls: s.cls, reqs: []};
      doc.reqs.push({id: newId(), createdAt: nowISO(), status: "pending", birth: data.birth, father: data.father, mother: data.mother,
                     purpose: data.purpose, purposeOther: data.purposeOther || ""}); save(); },
    onStaff(cb){ setTimeout(() => cb({uid: "demo", name: "ครูทดลอง", role: "admin"})); },
    async staffLogin(){}, async staffLogout(){},
    async getConduct(r){ const s = find(r.sid); return s ? {score: s.score, late: s.late} : null; },
    async listRequests(){ const d = load(); return clone(Object.entries(d.certs).flatMap(([k, doc]) => flatten(k, doc))); },
    async updateRequest(r, patch){ const doc = load().certs[r.key], i = doc.reqs.findIndex(x => x.id === r.id);
      doc.reqs[i] = packReq({...flatten(r.key, doc)[i], ...patch}, doc); save(); },
    async getSettings(){ return clone({...DEFAULT_SETTINGS, ...load().settings}); },
    async saveSettings(s){ load().settings = s; save(); },
    async nextCertNos(n, year){ const d = load(), c = d.counters["y" + year] || 0; d.counters["y" + year] = c + n; save();
      return Array.from({length: n}, (_, i) => c + i + 1); },
    resetDemo(){ mem = seed(); save(); }
  };
}

window.DB = LIVE ? LiveDB() : DemoDB();
})();
