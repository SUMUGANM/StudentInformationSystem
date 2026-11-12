// ===== 3 separate Google Sheets: Admin / Professor / Student =====
// Ovvoru Google Sheet-oda ID-yum (URL la /d/ ku apram irukkura text) ingha paste pannunga
const IDS = {
  admin: 'PASTE_ADMIN_SHEET_ID',
  prof:  'PASTE_PROFESSOR_SHEET_ID',
  stu:   'PASTE_STUDENT_SHEET_ID'
};
const SALT = 'change-this-secret-text';   // <-- own random text podunga

const T = {
  admin: { file: 'admin', tab: 'Admins',     h: ['ID', 'Name', 'PasswordHash'] },
  prof:  { file: 'prof',  tab: 'Professors', h: ['ID', 'Name', 'Degree', 'Experience', 'DOB', 'Email', 'Contact', 'PasswordHash', 'AddedOn'] },
  stu:   { file: 'stu',   tab: 'Students',   h: ['RollNo', 'Name', 'DOB', 'FatherName', 'MotherName', 'Siblings', 'Address', 'Phone', 'Email', 'Class', 'PasswordHash', 'AddedBy', 'AddedOn'] },
  att:   { file: 'stu',   tab: 'Attendance', h: ['RollNo', 'Date', 'Status', 'MarkedBy'] },
  mark:  { file: 'stu',   tab: 'Marks',      h: ['RollNo', 'Semester', 'Subject', 'Marks', 'MaxMarks', 'UpdatedBy'] }
};
const STU_F = ['RollNo', 'Name', 'DOB', 'FatherName', 'MotherName', 'Siblings', 'Address', 'Phone', 'Email', 'Class'];
const PROF_F = ['ID', 'Name', 'Degree', 'Experience', 'DOB', 'Email', 'Contact'];
const ROLE_KEY = { admin: 'admin', professor: 'prof', student: 'stu' };

// ---- ONE TIME: Apps Script la "setup" Run pannunga ----
function setup() {
  Object.keys(T).forEach(sheet_);
  const a = sheet_('admin');
  if (a.getLastRow() < 2) add_('admin', { ID: 'admin', Name: 'Administrator', PasswordHash: hash_('admin', 'admin123') });
}

// ---------- helpers ----------
function sheet_(k) {
  const t = T[k], ss = SpreadsheetApp.openById(IDS[t.file]);
  let s = ss.getSheetByName(t.tab);
  if (!s) {
    s = ss.insertSheet(t.tab);
    s.getRange(1, 1, s.getMaxRows(), t.h.length).setNumberFormat('@'); // ellam text ah save aagum
    s.appendRow(t.h);
  }
  return s;
}
function rows_(k) {
  const v = sheet_(k).getDataRange().getValues(), h = v[0];
  return v.slice(1).map((r, i) => { const o = { _row: i + 2 }; h.forEach((c, j) => o[c] = String(r[j])); return o; });
}
function find_(k, id) {
  const key = T[k].h[0];
  return rows_(k).find(r => r[key].toLowerCase() === String(id).toLowerCase());
}
function add_(k, o) { sheet_(k).appendRow(T[k].h.map(c => o[c] == null ? '' : String(o[c]))); }
function set_(k, row, o) { const h = T[k].h; sheet_(k).getRange(row, 1, 1, h.length).setValues([h.map(c => o[c] == null ? '' : String(o[c]))]); }
function hash_(id, pw) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(id).toLowerCase() + ':' + SALT + ':' + pw);
  return b.map(x => ('0' + (x & 0xff).toString(16)).slice(-2)).join('');
}
function clean_(o) { const c = Object.assign({}, o); delete c.PasswordHash; delete c._row; return c; }
function need_(x, fields) { for (const f of fields) if (!String(x[f] || '').trim()) return f + ' venum'; return null; }
function pick_(x, fields) { const o = {}; fields.forEach(f => o[f] = String(x[f] || '').trim()); return o; }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
const fail_ = e => ({ ok: false, error: e });
const OK = { ok: true };

function doGet() { return out_({ ok: true, msg: 'API running' }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'login') return out_(login_(d));
    const raw = CacheService.getScriptCache().get('t:' + d.token);
    if (!raw) return out_(fail_('Session expired. Marubadiyum login pannunga'));
    return out_(route_(d, JSON.parse(raw)));
  } catch (err) { return out_(fail_(String(err))); }
  finally { lock.releaseLock(); }
}

function login_(d) {
  const k = ROLE_KEY[d.role];
  if (!k) return fail_('Invalid role');
  const u = find_(k, d.id || '');
  if (!u) return fail_('ID illa password thappu');
  const id = u[T[k].h[0]];
  if (u.PasswordHash !== hash_(id, d.password || '')) return fail_('ID illa password thappu');
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('t:' + token, JSON.stringify({ role: d.role, id }), 21600);
  return { ok: true, token, role: d.role, id, name: u.Name };
}

function route_(d, s) {
  const k = ROLE_KEY[s.role], a = d.action, x = d.data || {};

  // ===== ellarukkum =====
  if (a === 'changePassword') {
    const u = find_(k, s.id);
    if (u.PasswordHash !== hash_(s.id, d.oldPassword || '')) return fail_('Old password thappu');
    if (!d.newPassword || d.newPassword.length < 6) return fail_('Password min 6 characters venum');
    u.PasswordHash = hash_(s.id, d.newPassword); set_(k, u._row, u);
    return OK;
  }

  // ===== STUDENT: own data mattum =====
  if (s.role === 'student' && a === 'myData') {
    return { ok: true, profile: clean_(find_('stu', s.id)),
      attendance: rows_('att').filter(r => r.RollNo === s.id).map(clean_),
      marks: rows_('mark').filter(r => r.RollNo === s.id).map(clean_) };
  }

  // ===== PROFESSOR =====
  if (s.role === 'professor') {
    if (a === 'listStudents') {
      const cnt = {};
      rows_('att').forEach(r => { const c = cnt[r.RollNo] || (cnt[r.RollNo] = { p: 0, t: 0 }); c.t++; if (r.Status === 'Present') c.p++; });
      return { ok: true, students: rows_('stu').map(r => { const o = clean_(r), c = cnt[r.RollNo]; o.AttPct = c ? Math.round(100 * c.p / c.t) : ''; return o; }) };
    }
    if (a === 'addStudent') {
      const err = need_(x, STU_F.filter(f => f !== 'Siblings').concat('Password'));
      if (err) return fail_(err);
      if (x.Password.length < 6) return fail_('Password min 6 characters venum');
      if (find_('stu', x.RollNo)) return fail_('Intha Roll No already irukku');
      const o = pick_(x, STU_F);
      o.PasswordHash = hash_(o.RollNo, x.Password); o.AddedBy = s.id; o.AddedOn = new Date().toISOString();
      add_('stu', o); return OK;
    }
    if (a === 'updateStudent') {
      const u = find_('stu', x.RollNo);
      if (!u) return fail_('Student kidaikkala');
      const err = need_(x, STU_F.filter(f => f !== 'Siblings'));
      if (err) return fail_(err);
      Object.assign(u, pick_(x, STU_F.filter(f => f !== 'RollNo')));
      if (x.Password) { if (x.Password.length < 6) return fail_('Password min 6 characters venum'); u.PasswordHash = hash_(u.RollNo, x.Password); }
      set_('stu', u._row, u); return OK;
    }
    if (a === 'deleteStudent') {
      const u = find_('stu', d.id);
      if (!u) return fail_('Student kidaikkala');
      ['att', 'mark'].forEach(t => rows_(t).filter(r => r.RollNo === u.RollNo).reverse().forEach(r => sheet_(t).deleteRow(r._row)));
      sheet_('stu').deleteRow(u._row); return OK;
    }
    // ---- Attendance ----
    if (a === 'getAttendance') {
      const rec = {}; rows_('att').filter(r => r.Date === d.date).forEach(r => rec[r.RollNo] = r.Status);
      return { ok: true, records: rec };
    }
    if (a === 'saveAttendance') {
      if (!d.date) return fail_('Date venum');
      const sh = sheet_('att'), exist = {};
      rows_('att').filter(r => r.Date === d.date).forEach(r => exist[r.RollNo] = r._row);
      const fresh = [];
      Object.keys(d.records || {}).forEach(roll => {
        const st = d.records[roll] === 'Absent' ? 'Absent' : 'Present';
        if (exist[roll]) sh.getRange(exist[roll], 3, 1, 2).setValues([[st, s.id]]);
        else fresh.push([roll, d.date, st, s.id]);
      });
      if (fresh.length) sh.getRange(sh.getLastRow() + 1, 1, fresh.length, 4).setValues(fresh);
      return OK;
    }
    // ---- Marks ----
    if (a === 'listMarks') return { ok: true, marks: rows_('mark').filter(r => r.RollNo === String(d.rollno)).map(clean_) };
    if (a === 'saveMark') {
      const err = need_(x, ['RollNo', 'Semester', 'Subject', 'Marks', 'MaxMarks']);
      if (err) return fail_(err);
      const m = Number(x.Marks), mx = Number(x.MaxMarks);
      if (isNaN(m) || isNaN(mx) || mx <= 0 || m < 0 || m > mx) return fail_('Marks sariya podunga (0 to Max)');
      if (!find_('stu', x.RollNo)) return fail_('Student kidaikkala');
      const o = pick_(x, ['RollNo', 'Semester', 'Subject', 'Marks', 'MaxMarks']); o.UpdatedBy = s.id;
      const ex = rows_('mark').find(r => r.RollNo === o.RollNo && r.Semester === o.Semester && r.Subject.toLowerCase() === o.Subject.toLowerCase());
      if (ex) set_('mark', ex._row, o); else add_('mark', o);
      return OK;
    }
    if (a === 'deleteMark') {
      const ex = rows_('mark').find(r => r.RollNo === x.RollNo && r.Semester === x.Semester && r.Subject === x.Subject);
      if (!ex) return fail_('Mark kidaikkala');
      sheet_('mark').deleteRow(ex._row); return OK;
    }
  }

  // ===== ADMIN =====
  if (s.role === 'admin') {
    if (a === 'stats') {
      const stu = rows_('stu'), profs = rows_('prof'), byClass = {};
      stu.forEach(r => byClass[r.Class] = (byClass[r.Class] || 0) + 1);
      return { ok: true, totalStudents: stu.length, totalProfessors: profs.length, byClass,
        byProfessor: profs.map(p => ({ ID: p.ID, Name: p.Name, count: stu.filter(r => r.AddedBy === p.ID).length })) };
    }
    if (a === 'listProfessors') return { ok: true, professors: rows_('prof').map(clean_) };
    if (a === 'addProfessor') {
      const err = need_(x, PROF_F.concat('Password'));
      if (err) return fail_(err);
      if (x.Password.length < 6) return fail_('Password min 6 characters venum');
      if (find_('prof', x.ID)) return fail_('Intha Professor ID already irukku');
      const o = pick_(x, PROF_F); o.PasswordHash = hash_(o.ID, x.Password); o.AddedOn = new Date().toISOString();
      add_('prof', o); return OK;
    }
    if (a === 'updateProfessor') {
      const u = find_('prof', x.ID);
      if (!u) return fail_('Professor kidaikkala');
      const err = need_(x, PROF_F);
      if (err) return fail_(err);
      Object.assign(u, pick_(x, PROF_F.filter(f => f !== 'ID')));
      if (x.Password) { if (x.Password.length < 6) return fail_('Password min 6 characters venum'); u.PasswordHash = hash_(u.ID, x.Password); }
      set_('prof', u._row, u); return OK;
    }
    if (a === 'deleteProfessor') {
      const u = find_('prof', d.id);
      if (!u) return fail_('Professor kidaikkala');
      sheet_('prof').deleteRow(u._row); return OK;
    }
  }
  return fail_('Unauthorized or unknown action');
}
