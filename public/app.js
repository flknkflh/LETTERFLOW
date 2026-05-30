/* app.js — Main application controller */

/* ── State ── */
window._currentUser = null;
window._letters     = [];
window._allLetters  = [];
window._users       = [];
window._currentView = 'dashboard';

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('lf_user');
  if (saved) {
    window._currentUser = JSON.parse(saved);
    showApp();
  } else {
    showPage('login');
  }
  bindGlobal();
});

/* ── Pages ── */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + name);
  if (el) el.classList.add('active');
}

function showApp() {
  const user = window._currentUser;
  const isSuper = user.role === 'super-admin';
  // Show/hide nav items based on role
  document.getElementById('navUserMgmt').style.display =
    isSuper ? 'flex' : 'none';
  document.getElementById('navFileDb').style.display =
    isSuper ? 'flex' : 'none';

  // Avatar
  document.getElementById('avatarBtn').textContent =
    user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  // Create button visibility
  document.getElementById('sidebarCreateBtn').style.display =
    (user.role === 'pembuat' || isSuper) ? 'flex' : 'none';

  showPage('app');
  refreshData().then(() => switchView('dashboard'));
}

/* ── Data ── */
async function refreshData() {
  try {
    const [lr, ur] = await Promise.all([API.getLetters(window._currentUser), API.getUsers()]);
    window._allLetters = lr.letters;
    window._letters = filterLettersForRole(lr.letters, window._currentUser);
    window._users   = ur.users;
    updateInboxBadge();
  } catch (e) { console.error('refreshData:', e); }
}

function filterLettersForRole(letters, user) {
  if (!user) return [];
  if (user.role === 'super-admin' || user.role === 'pemonitor') return letters;
  if (user.role === 'pembuat') return letters.filter(l => l.pembuatId === user.id);
  if (user.role === 'pereview') return letters.filter(l => (l.reviewerIds || []).includes(user.id));
  if (user.role === 'penandatangan') return letters.filter(l => l.penandatanganId === user.id);
  return [];
}

function updateInboxBadge() {
  const user = window._currentUser;
  let count = 0;
  if (user.role === 'pereview')
    count = window._letters.filter(l => (l.reviewerIds||[]).includes(user.id) && l.status === 'Menunggu Review').length;
  else if (user.role === 'penandatangan')
    count = window._letters.filter(l => l.penandatanganId === user.id && l.status === 'Menunggu TTD').length;
  else if (user.role === 'pembuat')
    count = window._letters.filter(l => l.pembuatId === user.id && (l.status === 'Sedang Direvisi' || l.status === 'Ditolak')).length;
  const badge = document.getElementById('inboxBadge');
  if (count > 0) { badge.textContent = count; badge.style.display = ''; }
  else badge.style.display = 'none';
  const dot = document.getElementById('notifDot');
  if (count > 0) dot.classList.add('show'); else dot.classList.remove('show');
}

/* ── Navigation ── */
function switchView(view) {
  window._currentView = view;
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('view-' + view);
  if (panel) panel.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.view === view);
  });
  renderView(view);
}

async function renderView(view) {
  const user    = window._currentUser;
  const letters = window._letters;
  switch (view) {
    case 'dashboard':       await renderDashboard(user, letters); break;
    case 'inbox':           await renderInbox(user, letters); break;
    case 'archive':         await renderArchive(user, letters); break;
    case 'workflows':       renderWorkflows(user, letters); break;
    case 'user-management': await renderUserManagement(); break;
    case 'file-database':   await renderFileDatabase(); break;
    case 'settings':        renderSettings(user); break;
  }
}

/* ── Open helpers ── */
async function openLetterDetail(id) {
  const { letter } = await API.getLetter(id);
  if (!canAccessLetter(letter, window._currentUser)) {
    showToast('Anda tidak punya akses ke surat ini', 'error');
    return;
  }
  renderLetterDetail(letter, window._currentUser);
  switchViewPanel('letter-detail');
}

function canAccessLetter(letter, user) {
  if (!letter || !user) return false;
  if (user.role === 'super-admin' || user.role === 'pemonitor') return true;
  if (user.role === 'pembuat') return letter.pembuatId === user.id;
  if (user.role === 'pereview') return (letter.reviewerIds || []).includes(user.id);
  if (user.role === 'penandatangan') return letter.penandatanganId === user.id;
  return false;
}

async function openCreateForm(letterId = null) {
  switchViewPanel('letter-form');
  await renderLetterForm(letterId);
}

async function openReview(id) {
  switchViewPanel('review');
  await renderReviewForm(id);
}

async function openSigning(id) {
  switchViewPanel('signing');
  await renderSigningForm(id);
}

function switchViewPanel(view) {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));
  const panel = document.getElementById('view-' + view);
  if (panel) panel.classList.add('active');
  window._currentView = view;
}

/* ── Letter actions ── */
async function deleteLetter(id) {
  confirmModal('Hapus surat ini secara permanen?', async () => {
    try {
      await API.deleteLetter(id);
      showToast('Surat dihapus', 'success');
      await refreshData();
      switchView('archive');
    } catch(e) { showToast(e.message, 'error'); }
  });
}

async function sendComment(letterId) {
  const input = document.getElementById('newComment');
  const pesan = input.value.trim();
  if (!pesan) return;
  try {
    await API.addComment(letterId, {
      pesan, oleh: window._currentUser.name, peran: window._currentUser.role
    });
    showToast('Catatan dikirim ✓', 'success');
    input.value = '';
    await refreshData();
    await openLetterDetail(letterId);
  } catch(e) { showToast(e.message, 'error'); }
}

/* ── User management ── */
function showAddUserModal() {
  showModal(`
    <div class="modal-title">Tambah User Baru</div>
    <div class="modal-body">
      <div class="field-group"><label>Nama Lengkap</label><input id="mu-name" placeholder="Nama lengkap"></div>
      <div class="field-group"><label>NIP / Username</label><input id="mu-nip" placeholder="nip atau username unik"></div>
      <div class="field-group"><label>Password</label><input id="mu-pass" type="password" placeholder="Password"></div>
      <div class="field-group"><label>Unit / Jabatan</label><input id="mu-unit" placeholder="Divisi / jabatan"></div>
      <div class="field-group"><label>Peran</label>
        <select id="mu-role">
          <option value="super-admin">Super Admin</option>
          <option value="pembuat">Pembuat</option>
          <option value="pereview">Pereview</option>
          <option value="penandatangan">Penanda Tangan</option>
          <option value="pemonitor">Pemonitor</option>
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-sm btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn-sm btn-dark" onclick="doAddUser()">Tambah</button>
    </div>`);
}

async function doAddUser() {
  const data = {
    name: document.getElementById('mu-name').value.trim(),
    nip:  document.getElementById('mu-nip').value.trim(),
    password: document.getElementById('mu-pass').value,
    unit: document.getElementById('mu-unit').value.trim(),
    role: document.getElementById('mu-role').value,
  };
  if (!data.name || !data.nip || !data.password) { showToast('Nama, NIP, dan password wajib diisi','error'); return; }
  try {
    await API.createUser(data);
    showToast('User ditambahkan ✓', 'success');
    closeModal();
    await renderUserManagement();
  } catch(e) { showToast(e.message,'error'); }
}

function editUser(id) {
  const user = window._users.find(u => u.id === id);
  if (!user) return;
  showModal(`
    <div class="modal-title">Edit User</div>
    <div class="modal-body">
      <div class="field-group"><label>Nama Lengkap</label><input id="eu-name" value="${user.name}"></div>
      <div class="field-group"><label>Unit / Jabatan</label><input id="eu-unit" value="${user.unit||''}"></div>
      <div class="field-group"><label>Password Baru (kosongkan jika tidak diubah)</label><input id="eu-pass" type="password" placeholder="Password baru..."></div>
      <div class="field-group"><label>Peran</label>
        <select id="eu-role">
          ${['super-admin','pembuat','pereview','penandatangan','pemonitor'].map(r =>
            `<option value="${r}" ${user.role===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-sm btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn-sm btn-dark" onclick="doEditUser('${id}')">Simpan</button>
    </div>`);
}

async function doEditUser(id) {
  const data = {
    name: document.getElementById('eu-name').value.trim(),
    unit: document.getElementById('eu-unit').value.trim(),
    role: document.getElementById('eu-role').value,
  };
  const pass = document.getElementById('eu-pass').value;
  if (pass) data.password = pass;
  try {
    await API.updateUser(id, data);
    showToast('User diperbarui ✓', 'success');
    closeModal();
    await renderUserManagement();
  } catch(e) { showToast(e.message,'error'); }
}

async function deleteUser(id) {
  confirmModal('Hapus user ini?', async () => {
    try {
      await API.deleteUser(id);
      showToast('User dihapus','success');
      await renderUserManagement();
    } catch(e) { showToast(e.message,'error'); }
  });
}

/* ── Settings ── */
async function resetAllData() {
  if (window._currentUser?.role !== 'super-admin') {
    showToast('Hanya super admin yang bisa reset data', 'error');
    return;
  }
  confirmModal('Reset semua data? Semua surat, riwayat, catatan, file upload, dan akun selain super admin akan dihapus permanen.', async () => {
    try {
      const result = await API.resetData();
      window._currentUser = { ...window._currentUser, ...result.user };
      sessionStorage.setItem('lf_user', JSON.stringify(window._currentUser));
      window._letters = [];
      window._allLetters = [];
      window._users = result.users || [result.user];
      showToast('Semua data berhasil direset', 'success');
      await refreshData();
      switchView('dashboard');
    } catch(e) { showToast(e.message, 'error'); }
  });
}

async function saveProfile() {
  const name = document.getElementById('setName').value.trim();
  const unit = document.getElementById('setUnit').value.trim();
  try {
    const r = await API.updateUser(window._currentUser.id, { name, unit });
    window._currentUser = { ...window._currentUser, ...r.user };
    sessionStorage.setItem('lf_user', JSON.stringify(window._currentUser));
    showToast('Profil disimpan ✓','success');
  } catch(e) { showToast(e.message,'error'); }
}

/* ── Auth ── */
function bindGlobal() {
  /* Login */
  document.getElementById('loginBtn').onclick = doLogin;
  document.getElementById('loginPassword').onkeydown = e => { if(e.key==='Enter') doLogin(); };

  /* Role select */
  document.querySelectorAll('.role-card').forEach(card => {
    card.onclick = () => {
      const role = card.dataset.role;
      if (window._currentUser && window._currentUser.role !== role && window._currentUser.role !== 'super-admin') {
        showToast(`Akun Anda adalah ${window._currentUser.role}, bukan ${role}`, 'error');
        return;
      }
      showApp();
    };
  });

  document.getElementById('logoutFromRole').onclick = e => { e.preventDefault(); doLogout(); };
  document.getElementById('logoutBtn').onclick      = e => { e.preventDefault(); doLogout(); };
  document.getElementById('backToRoleBtn').onclick = e => {
  e.preventDefault();
  showPage('role');
  };
  /* Sidebar nav */
  document.querySelectorAll('.nav-link[data-view]').forEach(a => {
    a.onclick = e => { e.preventDefault(); switchView(a.dataset.view); };
  });

  document.addEventListener('click', e => {
    if (e.defaultPrevented) return;

    const backRole = e.target.closest('#backToRoleBtn');
    if (backRole) {
      e.preventDefault();
      showPage('role');
      return;
    }

    const logout = e.target.closest('#logoutBtn');
    if (logout) {
      e.preventDefault();
      doLogout();
      return;
    }

    const nav = e.target.closest('.nav-link[data-view]');
    if (nav) {
      e.preventDefault();
      switchView(nav.dataset.view);
    }
  });

  /* Create letter button */
  document.getElementById('sidebarCreateBtn').onclick = () => openCreateForm();

  /* Topbar filter tabs */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterByTab(btn.dataset.filter);
    };
  });

  /* Global search */
  document.getElementById('globalSearch').oninput = e => {
    const q = e.target.value.toLowerCase();
    window._letters = window._letters; // just re-render
    renderView(window._currentView);
  };

  /* Modal close on overlay click */
  document.getElementById('modal-overlay').onclick = e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  };

  /* Quick Verify */
  document.getElementById('quickVerifyBtn').onclick = () => {
    switchView('inbox');
  };
}

async function doLogin() {
  const nip  = document.getElementById('loginNip').value.trim();
  const pass = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  if (!nip || !pass) { errEl.textContent='NIP dan password wajib diisi'; errEl.classList.remove('hidden'); return; }
  try {
    document.getElementById('loginBtn').textContent = 'Memuat...';
    const { user } = await API.login(nip, pass);
    window._currentUser = user;
    sessionStorage.setItem('lf_user', JSON.stringify(user));
    showPage('role');
  } catch(e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  } finally {
    document.getElementById('loginBtn').innerHTML = 'LOGIN TO WORKSPACE <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>';
  }
}

function doLogout() {
  sessionStorage.removeItem('lf_user');
  window._currentUser = null;
  window._letters = [];
  showPage('login');
  document.getElementById('loginNip').value = '';
  document.getElementById('loginPassword').value = '';
}

function filterByTab(filter) {
  const all = filterLettersForRole(window._allLetters, window._currentUser);
  let filtered = all;
  if (filter === 'review')  filtered = all.filter(l => l.status === 'Menunggu Review');
  if (filter === 'signed')  filtered = all.filter(l => l.status === 'Ditandatangani');
  renderDashboard(window._currentUser, filtered);
}
