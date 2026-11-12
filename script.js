// 👇 Google Apps Script "Web app URL" (/exec nu mudiyanum) ingha paste pannunga
const API_URL = 'https://script.google.com/macros/s/AKfycbxwcqeNzxpA8SULWZ-p9qtY_97EqGfxFcoa3oUzmgdE0Ztx-eqgkhICTvcxoEAfRnlS/exec';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let token = sessionStorage.getItem('token');
let session = JSON.parse(sessionStorage.getItem('session') || 'null');
let role = 'student', students = [], professors = [], marks = [];
let editingStu = false, editingProf = false;

function say(el, text, type) { el.textContent = text || ''; el.className = 'msg ' + (type || ''); }
const note = (t, type) => say($('msg'), t, type);
const done = (r, okText) => { note(r.ok ? okText : r.error, r.ok ? 'ok' : 'err'); return r.ok; };

async function api(action, extra = {}) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // CORS preflight varama irukka
      body: JSON.stringify({ action, token, ...extra })
    });
    const j = await res.json();
    if (!j.ok && /Session expired/.test(j.error || '')) logout();
    return j;
  } catch (e) { return { ok: false, error: 'Network error / API_URL check pannunga' }; }
}
// disabled fields (edit mode la Roll No / ID) FormData la varaadhu, athaan temporary enable panrom
function formData(form) {
  const dis = [...form.elements].filter(el => el.disabled);
  dis.forEach(el => el.disabled = false);
  const d = Object.fromEntries(new FormData(form));
  dis.forEach(el => el.disabled = true);
  return d;
}
function fillForm(form, rec) {
  for (const el of form.elements) if (el.name && el.name !== 'Password') el.value = rec[el.name] ?? '';
}

/* ---------- LOGIN ---------- */
$('roleTabs').addEventListener('click', e => {
  if (!e.target.dataset.role) return;
  role = e.target.dataset.role;
  document.querySelectorAll('#roleTabs button').forEach(b => b.classList.toggle('active', b === e.target));
  $('loginId').placeholder = role === 'student' ? 'Roll No' : role === 'professor' ? 'Professor ID' : 'Admin ID';
});
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('loginBtn').disabled = true; say($('loginMsg'), 'Logging in...'); token = null;
  const r = await api('login', { role, id: $('loginId').value.trim(), password: $('loginPw').value });
  $('loginBtn').disabled = false;
  if (!r.ok) return say($('loginMsg'), r.error, 'err');
  token = r.token; session = { role: r.role, id: r.id, name: r.name };
  sessionStorage.setItem('token', token); sessionStorage.setItem('session', JSON.stringify(session));
  $('loginForm').reset(); say($('loginMsg'), ''); start();
});
function logout() {
  sessionStorage.clear(); token = null; session = null;
  $('appView').hidden = true; $('loginView').hidden = false;
}
$('logoutBtn').onclick = logout;
$('pwBtn').onclick = async () => {
  const oldPassword = prompt('Old password:'); if (!oldPassword) return;
  const newPassword = prompt('New password (min 6 characters):'); if (!newPassword) return;
  done(await api('changePassword', { oldPassword, newPassword }), 'Password maathiyaachu ✅');
};

function start() {
  if (!token || !session) return;
  $('loginView').hidden = true; $('appView').hidden = false;
  $('userName').textContent = session.name; $('roleBadge').textContent = session.role;
  ['studentPanel', 'profPanel', 'adminPanel'].forEach(p => $(p).hidden = true);
  note('');
  if (session.role === 'student') { $('studentPanel').hidden = false; loadMyData(); }
  if (session.role === 'professor') { $('profPanel').hidden = false; $('attDate').value = new Date().toISOString().slice(0, 10); loadStudents(); }
  if (session.role === 'admin') { $('adminPanel').hidden = false; loadAdmin(); }
}

/* ---------- STUDENT ---------- */
async function loadMyData() {
  const r = await api('myData'); if (!r.ok) return note(r.error, 'err');
  const p = r.profile;
  $('profile').innerHTML = [['Roll No', p.RollNo], ['Name', p.Name], ['Class', p.Class], ['Date of Birth', p.DOB],
    ['Father', p.FatherName], ['Mother', p.MotherName], ['Siblings', p.Siblings || '-'], ['Address', p.Address],
    ['Phone', p.Phone], ['Email', p.Email]].map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  const total = r.attendance.length, present = r.attendance.filter(a => a.Status === 'Present').length;
  const pct = total ? Math.round(100 * present / total) : 0;
  $('myAtt').innerHTML = total ? `Present: <b>${present}</b> / ${total} days &nbsp;
    <span class="badge ${pct >= 75 ? 'good' : 'bad'}">${pct}%</span>`
    : 'Innum attendance mark pannala.';
  const m = [...r.marks].sort((a, b) => a.Semester - b.Semester || a.Subject.localeCompare(b.Subject));
  $('myMarks').innerHTML = m.length ? m.map(x => `<tr><td>${esc(x.Semester)}</td><td>${esc(x.Subject)}</td><td>${esc(x.Marks)}</td><td>${esc(x.MaxMarks)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="empty">Marks innum add pannala</td></tr>';
}

/* ---------- PROFESSOR: tabs ---------- */
function showTab(id) {
  document.querySelectorAll('#profPanel .pane').forEach(p => p.hidden = p.id !== id);
  document.querySelectorAll('#profTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  if (id === 'tabAttendance') loadAttendance();
  if (id === 'tabMarks') loadMarks();
}
$('profTabs').addEventListener('click', e => { if (e.target.dataset.tab) showTab(e.target.dataset.tab); });

/* ---------- PROFESSOR: students ---------- */
async function loadStudents() {
  const r = await api('listStudents'); if (!r.ok) return note(r.error, 'err');
  students = r.students; renderStudents();
  $('markStu').innerHTML = students.map(s => `<option value="${esc(s.RollNo)}">${esc(s.RollNo)} - ${esc(s.Name)}</option>`).join('')
    || '<option value="">Students illa</option>';
}
function renderStudents() {
  $('stuCount').textContent = students.length;
  const q = $('stuSearch').value.trim().toLowerCase();
  const list = students.filter(s => [s.RollNo, s.Name, s.Class, s.City].join(' ').toLowerCase().includes(q));
  $('stuBody').innerHTML = list.length ? list.map(s => `<tr>
    <td>${esc(s.RollNo)}</td><td>${esc(s.Name)}</td><td>${esc(s.Class)}</td><td>${esc(s.Phone)}</td>
    <td>${s.AttPct === '' ? '-' : `<span class="badge ${s.AttPct >= 75 ? 'good' : 'bad'}">${s.AttPct}%</span>`}</td>
    <td><div class="row"><button class="small" data-edit="${esc(s.RollNo)}">Edit</button>
    <button class="small ghost" data-marks="${esc(s.RollNo)}">Marks</button>
    <button class="small del" data-del="${esc(s.RollNo)}">Delete</button></div></td></tr>`).join('')
    : '<tr><td colspan="6" class="empty">Students illa 🙂</td></tr>';
}
function resetStuForm() {
  const f = $('stuForm'); f.reset(); editingStu = false;
  f.RollNo.disabled = false; $('stuPw').required = true; $('stuPw').placeholder = 'Student Password (min 6)';
  $('stuFormTitle').textContent = 'Add Student'; $('stuCancel').hidden = true;
}
$('stuForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; note('Saving...');
  const r = await api(editingStu ? 'updateStudent' : 'addStudent', { data: formData(e.target) });
  btn.disabled = false;
  if (done(r, editingStu ? 'Student details update aayiduchu ✅' : 'Student add aayiduchu ✅')) { resetStuForm(); loadStudents(); }
});
$('stuBody').addEventListener('click', async e => {
  const { edit, del, marks: mk } = e.target.dataset;
  if (edit) {
    const s = students.find(x => x.RollNo === edit), f = $('stuForm');
    fillForm(f, s); editingStu = true; f.RollNo.disabled = true; $('stuPw').required = false;
    $('stuPw').placeholder = 'New password (blank = maatha vendaam)';
    $('stuFormTitle').textContent = 'Edit Student: ' + s.RollNo; $('stuCancel').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (mk) { $('markStu').value = mk; showTab('tabMarks'); }
  if (del && confirm('Intha student + avanga attendance, marks ellam delete aagum. Seri ah?')) {
    done(await api('deleteStudent', { id: del }), 'Deleted 🗑️'); loadStudents();
  }
});
$('stuCancel').onclick = () => { resetStuForm(); note(''); };
$('stuSearch').addEventListener('input', renderStudents);

/* ---------- PROFESSOR: attendance ---------- */
async function loadAttendance() {
  const date = $('attDate').value; if (!date) return;
  const r = await api('getAttendance', { date }); if (!r.ok) return note(r.error, 'err');
  $('attBody').innerHTML = students.length ? students.map(s => {
    const st = r.records[s.RollNo] || 'Present';
    return `<tr><td>${esc(s.RollNo)}</td><td>${esc(s.Name)}</td><td>${esc(s.Class)}</td>
      <td><select data-roll="${esc(s.RollNo)}"><option${st === 'Present' ? ' selected' : ''}>Present</option><option${st === 'Absent' ? ' selected' : ''}>Absent</option></select></td></tr>`;
  }).join('') : '<tr><td colspan="4" class="empty">Students illa</td></tr>';
}
$('attDate').addEventListener('change', loadAttendance);
$('attSave').onclick = async () => {
  const records = {};
  document.querySelectorAll('#attBody select').forEach(s => records[s.dataset.roll] = s.value);
  $('attSave').disabled = true; note('Saving...');
  const r = await api('saveAttendance', { date: $('attDate').value, records });
  $('attSave').disabled = false;
  if (done(r, 'Attendance save aayiduchu ✅')) loadStudents();
};

/* ---------- PROFESSOR: marks ---------- */
async function loadMarks() {
  const roll = $('markStu').value; if (!roll) { $('markBody').innerHTML = ''; return; }
  const r = await api('listMarks', { rollno: roll }); if (!r.ok) return note(r.error, 'err');
  marks = [...r.marks].sort((a, b) => a.Semester - b.Semester || a.Subject.localeCompare(b.Subject));
  $('markBody').innerHTML = marks.length ? marks.map((m, i) => `<tr>
    <td>${esc(m.Semester)}</td><td>${esc(m.Subject)}</td><td>${esc(m.Marks)}</td><td>${esc(m.MaxMarks)}</td>
    <td><div class="row"><button class="small" data-medit="${i}">Edit</button>
    <button class="small del" data-mdel="${i}">Delete</button></div></td></tr>`).join('')
    : '<tr><td colspan="5" class="empty">Marks innum illa</td></tr>';
}
$('markStu').addEventListener('change', loadMarks);
$('markForm').addEventListener('submit', async e => {
  e.preventDefault();
  const data = { ...formData(e.target), RollNo: $('markStu').value };
  const r = await api('saveMark', { data });
  if (done(r, 'Mark save aayiduchu ✅')) { e.target.Subject.value = ''; e.target.Marks.value = ''; loadMarks(); }
});
$('markBody').addEventListener('click', async e => {
  const { medit, mdel } = e.target.dataset, f = $('markForm');
  if (medit !== undefined) fillForm(f, marks[medit]);
  if (mdel !== undefined && confirm('Intha mark delete pannanuma?')) {
    done(await api('deleteMark', { data: marks[mdel] }), 'Deleted 🗑️'); loadMarks();
  }
});

/* ---------- ADMIN ---------- */
async function loadAdmin() {
  const [st, pr] = await Promise.all([api('stats'), api('listProfessors')]);
  if (!st.ok) return note(st.error, 'err');
  professors = pr.professors || [];
  $('statStu').textContent = st.totalStudents; $('statProf').textContent = st.totalProfessors;
  $('byProf').innerHTML = st.byProfessor.length ? st.byProfessor.map(p =>
    `<tr><td>${esc(p.ID)}</td><td>${esc(p.Name)}</td><td><b>${p.count}</b></td></tr>`).join('')
    : '<tr><td colspan="3" class="empty">Professors illa</td></tr>';
  const cls = Object.entries(st.byClass);
  $('byClass').innerHTML = cls.length ? cls.map(([c, n]) => `<tr><td>${esc(c)}</td><td><b>${n}</b></td></tr>`).join('')
    : '<tr><td colspan="2" class="empty">Students illa</td></tr>';
  $('profBody').innerHTML = professors.length ? professors.map(p => `<tr>
    <td>${esc(p.ID)}</td><td>${esc(p.Name)}</td><td>${esc(p.Degree)}</td><td>${esc(p.Experience)}</td><td>${esc(p.DOB)}</td>
    <td>${esc(p.Email)}</td><td>${esc(p.Contact)}</td>
    <td><div class="row"><button class="small" data-pedit="${esc(p.ID)}">Edit</button>
    <button class="small del" data-pdel="${esc(p.ID)}">Delete</button></div></td></tr>`).join('')
    : '<tr><td colspan="8" class="empty">Professors illa</td></tr>';
}
function resetProfForm() {
  const f = $('profForm'); f.reset(); editingProf = false;
  f.ID.disabled = false; $('profPw').required = true; $('profPw').placeholder = 'Password (min 6)';
  $('profFormTitle').textContent = 'Add Professor'; $('profCancel').hidden = true;
}
$('profForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; note('Saving...');
  const r = await api(editingProf ? 'updateProfessor' : 'addProfessor', { data: formData(e.target) });
  btn.disabled = false;
  if (done(r, editingProf ? 'Professor details update aayiduchu ✅' : 'Professor add aayiduchu ✅')) { resetProfForm(); loadAdmin(); }
});
$('profBody').addEventListener('click', async e => {
  const { pedit, pdel } = e.target.dataset;
  if (pedit) {
    const p = professors.find(x => x.ID === pedit), f = $('profForm');
    fillForm(f, p); editingProf = true; f.ID.disabled = true; $('profPw').required = false;
    $('profPw').placeholder = 'New password (blank = maatha vendaam)';
    $('profFormTitle').textContent = 'Edit Professor: ' + p.ID; $('profCancel').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (pdel && confirm('Intha professor-a delete pannanuma?')) { done(await api('deleteProfessor', { id: pdel }), 'Deleted 🗑️'); loadAdmin(); }
});
$('profCancel').onclick = () => { resetProfForm(); note(''); };

start();
