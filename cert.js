/* ใบรับรองความประพฤติ — ฟังก์ชันช่วยและตัวสร้างหน้าใบ (ใช้ทั้งหน้านักเรียนและหน้าครู) */
(function(){
const SCHOOL = {
  name: "โรงเรียนโซ่พิสัยพิทยาคม",
  addr: ["โรงเรียนโซ่พิสัยพิทยาคม", "ตำบลโซ่ อำเภอโซ่พิสัย", "จังหวัดบึงกาฬ ๓๘๑๗๐"],
  validDays: 60
};
const MONTHS = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const SP = "  "; // เว้น 2 ช่องแบบหนังสือราชการ

const thNum = s => String(s ?? "").replace(/[0-9]/g, d => "๐๑๒๓๔๕๖๗๘๙"[d]);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const twoSp = s => esc(s).trim().replace(/\s+/g, SP);
const parts = iso => { const [y,m,d] = String(iso).slice(0,10).split("-").map(Number); return {y, d, m, be: y + 543}; };
const todayISO = () => new Date(Date.now() + 7*3600e3).toISOString().slice(0,10); // เวลาไทย
const thaiDate = iso => { const p = parts(iso); return `วันที่ ${thNum(p.d)}${SP}เดือน${MONTHS[p.m-1]}${SP}พ.ศ. ${thNum(p.be)}`; };
const birthText = iso => { const p = parts(iso); return `${thNum(p.d)}${SP}${MONTHS[p.m-1]}${SP}พ.ศ.${thNum(p.be)}`; };
const shortDate = iso => { if(!iso) return "-"; const p = parts(iso); return `${p.d} ${MONTHS_SHORT[p.m-1]} ${String(p.be).slice(2)}`; };
const academicYear = iso => { const p = parts(iso); return p.m >= 5 ? p.be : p.be - 1; };  // ปีการศึกษาเริ่ม พ.ค.
const fiscalYear  = iso => { const p = parts(iso); return p.m >= 10 ? p.be + 1 : p.be; };  // ปีงบประมาณเริ่ม ต.ค.
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);

/* r = {prefix,fname,lname,sid,level,room,birth,father,mother}
   signer = {name, acting}  opts = {issueDate, certNo, showCertNo} */
function certHTML(r, signer, opts){
  const issue = opts.issueDate || todayISO();
  const role = (signer.acting ? "รักษาการแทนตำแหน่งผู้อำนวยการ" : "ตำแหน่งผู้อำนวยการ") + SCHOOL.name;
  const title = signer.acting ? `รองผู้อำนวยการรักษาการแทนผู้อำนวยการ<br>${SCHOOL.name}` : `ผู้อำนวยการ${SCHOOL.name}`;
  const body =
    `ข้าพเจ้า<span class="nw">${twoSp(signer.name)}</span> ${role} <span class="nw">ขอรับรองว่า</span> ` +
    `<span class="nw">${esc(r.prefix)}${twoSp((r.fname||"") + " " + (r.lname||""))}</span> ` +
    `เลขประจำตัว ${thNum(esc(r.sid))} เป็นนักเรียนชั้น<span class="nw">มัธยมศึกษาปีที่ ${thNum(esc(r.level))}/${thNum(esc(r.room))}</span> ` +
    `<span class="nw">ประจำปีการศึกษา ${thNum(academicYear(issue))}</span> เกิดวันที่ <span class="nw">${r.birth ? birthText(r.birth) : "........"}</span> ` +
    `บิดาชื่อ<span class="nw">${twoSp(r.father)}</span> มารดาชื่อ<span class="nw">${twoSp(r.mother)}</span> ` +
    `เป็นผู้มี<span class="nw">ความประพฤติ</span>เรียบร้อย มีความซื่อสัตย์สุจริต มีระเบียบวินัยดีเยี่ยม ` +
    `ปฏิบัติตนเป็นแบบอย่างที่ดีและมีคุณลักษณะ<span class="nw">อันพึงประสงค์</span>ของโรงเรียนทุกประการ`;
  const no = opts.showCertNo && opts.certNo ? `<div class="abs certno">ที่ ${thNum(esc(opts.certNo))}</div>` : "";
  return `<div class="cert-page">
    <img class="garuda" src="garuda.png" alt="">
    <div class="abs title">ใบรับรองความประพฤตินักเรียน</div>${no}
    <div class="abs addr">${SCHOOL.addr.join("<br>")}</div>
    <div class="abs date">${thaiDate(issue)}</div>
    <div class="body">${body}<div class="issued">ออกให้ ณ ${thaiDate(issue)}</div></div>
    <div class="abs sign">(${twoSp(signer.name)})<br>${title}</div>
    <div class="photo"></div>
    <div class="abs note">(หนังสือรับรองความประพฤติฉบับนี้ใช้ได้ไม่เกิน${SP}${thNum(SCHOOL.validDays)}${SP}วัน${SP}ตั้งแต่วันที่ออกให้)</div>
  </div>`;
}

/* ใส่ใบลงกล่องแบบย่อให้พอดีความกว้าง */
function previewInto(box, html){
  box.innerHTML = `<div class="cert-scale">${html}</div>`;
  const inner = box.firstElementChild, page = inner.firstElementChild;
  const fit = () => { const s = box.clientWidth / page.offsetWidth; inner.style.transform = `scale(${s})`; box.style.height = page.offsetHeight * s + "px"; };
  fit(); new ResizeObserver(fit).observe(box);
}

function printCerts(htmlList){
  let area = document.getElementById("print-area");
  if (!area) { area = document.createElement("div"); area.id = "print-area"; document.body.appendChild(area); }
  area.innerHTML = htmlList.join("");
  return document.fonts.ready.then(() => new Promise(res => {
    const imgs = [...area.querySelectorAll("img")].filter(i => !i.complete);
    if (!imgs.length) return res();
    let n = imgs.length; imgs.forEach(i => i.onload = i.onerror = () => --n || res());
  })).then(() => { try { window.print(); return true; } catch(e){ return false; } });
}

window.Cert = {SCHOOL, MONTHS, MONTHS_SHORT, thNum, esc, todayISO, thaiDate, shortDate, academicYear, fiscalYear,
               daysBetween, certHTML, previewInto, printCerts};
})();
