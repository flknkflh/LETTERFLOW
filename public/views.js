/* views.js — render each view panel */

/* ─── DASHBOARD ─── */
async function renderDashboard(user, letters){
  const mine   = letters.filter(l=>l.pembuatId===user.id);
  const forMe  = letters.filter(l=>l.reviewerIds&&l.reviewerIds.includes(user.id)&&l.status==='Menunggu Review');
  const sign   = letters.filter(l=>l.penandatanganId===user.id&&l.status==='Menunggu TTD');
  const all    = letters;

  let stats = '';
  if(user.role==='super-admin'){
    stats=`
      <div class="stat-card"><div class="stat-label">TOTAL SURAT</div><div class="stat-value">${all.length}</div></div>
      <div class="stat-card"><div class="stat-label">TOTAL USER</div><div class="stat-value">${(window._users||[]).length}</div></div>
      <div class="stat-card dark"><div class="stat-label">FILE MASUK</div><div class="stat-value">${all.filter(l=>l.dokumen).length}</div></div>`;
  } else if(user.role==='pembuat'){
    stats=`
      <div class="stat-card"><div class="stat-label">TOTAL DRAFT <span class="stat-badge">+${mine.filter(l=>l.status==='Draft').length} baru</span></div><div class="stat-value">${mine.filter(l=>l.status==='Draft').length}</div></div>
      <div class="stat-card"><div class="stat-label">MENUNGGU REVIEW <span class="stat-badge red">Perlu perhatian</span></div><div class="stat-value">${mine.filter(l=>l.status==='Menunggu Review').length}</div></div>
      <div class="stat-card dark"><div class="stat-label">PUBLISHED <span class="stat-badge">Target Tercapai</span></div><div class="stat-value">${mine.filter(l=>l.status==='Ditandatangani'||l.status==='Selesai').length}</div></div>`;
  } else if(user.role==='pereview'){
    stats=`
      <div class="stat-card"><div class="stat-label">MENUNGGU REVIEW</div><div class="stat-value">${forMe.length}</div></div>
      <div class="stat-card"><div class="stat-label">TELAH DIREVIEW</div><div class="stat-value">${letters.filter(l=>l.reviewHistory&&l.reviewHistory.some(r=>r.reviewerId===user.id&&r.status!=='Menunggu')).length}</div></div>
      <div class="stat-card dark"><div class="stat-label">DITOLAK</div><div class="stat-value">${letters.filter(l=>l.reviewHistory&&l.reviewHistory.some(r=>r.reviewerId===user.id&&r.status==='Ditolak')).length}</div></div>`;
  } else if(user.role==='penandatangan'){
    stats=`
      <div class="stat-card"><div class="stat-label">SIAP TANDA TANGAN <span class="stat-badge red">Prioritas Tinggi</span></div><div class="stat-value">${sign.length}</div></div>
      <div class="stat-card"><div class="stat-label">MENUNGGU VERIFIKASI BARCODE</div><div class="stat-value">${letters.filter(l=>l.status==='Menunggu TTD').length}</div></div>
      <div class="stat-card dark"><div class="stat-label">TOTAL PUBLISHED</div><div class="stat-value">${letters.filter(l=>l.status==='Ditandatangani'||l.status==='Selesai').length}</div></div>`;
  } else {
    stats=`
      <div class="stat-card"><div class="stat-label">TOTAL SURAT</div><div class="stat-value">${all.length}</div></div>
      <div class="stat-card"><div class="stat-label">SEDANG BERJALAN</div><div class="stat-value">${all.filter(l=>l.status!=='Ditandatangani'&&l.status!=='Selesai').length}</div></div>
      <div class="stat-card dark"><div class="stat-label">SELESAI</div><div class="stat-value">${all.filter(l=>l.status==='Ditandatangani'||l.status==='Selesai').length}</div></div>`;
  }

  const rows = letters.slice(0,6).map(l=>`
    <tr>
      <td><div class="letter-title">${l.perihal}</div><div class="letter-sub">${l.nomor}</div></td>
      <td>${fmtDateShort(l.createdAt)}</td>
      <td>${statusPill(l.status)}</td>
      <td>${l.reviewerIds&&l.reviewerIds.length ? l.reviewerIds.map(rid=>{const u=window._users.find(u=>u.id===rid);return u?avatar(u.name):'';}).join(''):'—'}</td>
      <td><button class="btn-sm btn-outline btn-icon" onclick="openLetterDetail('${l.id}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Detail</button></td>
    </tr>`).join('');

  document.getElementById('view-dashboard').innerHTML=`
    <h1 class="page-title">Dashboard Utama</h1>
    <p class="page-sub">Selamat datang kembali, <strong>${user.name}</strong>. Berikut ringkasan progres surat Anda.</p>
    <div class="stats-grid">${stats}</div>
    <div class="section-card">
      <div class="section-header">
        <span class="section-title">Daftar Surat Terbaru</span>
        <a href="#" class="see-all" onclick="switchView('archive')">Lihat Semua →</a>
      </div>
      ${letters.length===0 ? emptyState('Belum ada surat') : `
      <table class="data-table">
        <thead><tr><th>JUDUL SURAT</th><th>TANGGAL DIBUAT</th><th>STATUS</th><th>REVIEWER</th><th>AKSI</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>`;
}

/* ─── INBOX ─── */
async function renderInbox(user, letters){
  let items=[];
  if(user.role==='super-admin') items=letters.filter(l=>['Menunggu Review','Sedang Direvisi','Menunggu TTD','Ditolak'].includes(l.status));
  else if(user.role==='pereview') items=letters.filter(l=>l.reviewerIds&&l.reviewerIds.includes(user.id)&&l.status==='Menunggu Review');
  else if(user.role==='penandatangan') items=letters.filter(l=>l.penandatanganId===user.id&&l.status==='Menunggu TTD');
  else items=letters.filter(l=>l.pembuatId===user.id&&(l.status==='Ditolak'||l.status==='Sedang Direvisi'||l.catatan.length>0));

  const rows = items.map(l=>{
    const rv = l.reviewHistory&&l.reviewHistory.find(r=>r.reviewerId===user.id);
    return `<tr>
      <td>${avatar(l.pembuatNama,32)}</td>
      <td><div class="letter-title">${l.perihal}</div><div class="letter-sub">${l.pembuatUnit||''}</div></td>
      <td>${fmtDateShort(l.createdAt)}</td>
      <td>${statusPill(l.status)}</td>
      <td>
        ${user.role==='super-admin'?`<button class="btn-sm btn-outline btn-icon" onclick="openLetterDetail('${l.id}')">Detail</button>`:
          user.role==='pereview'?`<button class="btn-sm btn-dark" onclick="openReview('${l.id}')">Review Sekarang</button>`:
          user.role==='penandatangan'?`<button class="btn-sm btn-dark" onclick="openSigning('${l.id}')">Cek & Tanda Tangani</button>`:
          l.status==='Sedang Direvisi'?`<button class="btn-sm btn-dark" onclick="openCreateForm('${l.id}')">Revisi Surat</button>`:
          `<button class="btn-sm btn-outline btn-icon" onclick="openLetterDetail('${l.id}')">Detail</button>`}
      </td>
    </tr>`;
  }).join('');

  document.getElementById('view-inbox').innerHTML=`
    <h1 class="page-title">Inbox</h1>
    <p class="page-sub">Surat yang memerlukan tindakan Anda.</p>
    <div class="section-card">
      ${items.length===0 ? emptyState('Tidak ada surat di inbox') : `
      <table class="data-table">
        <thead><tr><th></th><th>JUDUL SURAT</th><th>TANGGAL</th><th>STATUS</th><th>AKSI</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>`;
}

/* ─── ARCHIVE ─── */
async function renderArchive(user, letters){
  const rows = letters.map(l=>`
    <tr>
      <td><div class="letter-title">${l.perihal}</div><div class="letter-sub">${l.nomor}</div></td>
      <td>${l.kategori||'—'}</td>
      <td>${fmtDateShort(l.createdAt)}</td>
      <td>${statusPill(l.status)}</td>
      <td><div class="actions-row">
        <button class="btn-sm btn-outline btn-icon" onclick="openLetterDetail('${l.id}')">Detail</button>
        ${l.dokumen?`<a class="btn-sm btn-outline btn-icon" href="${API.documentDownloadUrl(l.id)}" download>PDF</a>`:''}
        ${(user.role==='pembuat' || user.role==='super-admin') && (l.pembuatId===user.id || user.role==='super-admin') && l.tandaTangan&&l.tandaTangan.image?`<a class="btn-sm btn-dark btn-icon" href="${API.signatureDownloadUrl(l.id)}" download>TTD</a>`:''}
        ${(user.role==='pembuat' || user.role==='super-admin')?`<button class="btn-sm btn-danger btn-icon" onclick="deleteLetter('${l.id}')">Hapus</button>`:''}
      </div></td>
    </tr>`).join('');

  document.getElementById('view-archive').innerHTML=`
    <h1 class="page-title">Arsip Surat</h1>
    <p class="page-sub">Semua surat yang pernah dibuat.</p>
    <div class="section-card">
      ${letters.length===0 ? emptyState() : `
      <table class="data-table">
        <thead><tr><th>JUDUL SURAT</th><th>KATEGORI</th><th>TANGGAL</th><th>STATUS</th><th>AKSI</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>`;
}

/* ─── WORKFLOWS ─── */
function renderWorkflows(user, letters){
  const rows = letters.map(l=>{
    const steps=[
      {label:'Draft',done:true},
      {label:'Review',done:l.status!=='Draft'},
      {label:'TTD',done:l.status==='Ditandatangani'||l.status==='Selesai'},
      {label:'Selesai',done:l.status==='Selesai'},
    ];
    return `<tr>
      <td><div class="letter-title">${l.perihal}</div></td>
      <td>${statusPill(l.status)}</td>
      <td>${steps.map(s=>`<span style="margin-right:8px;font-size:11px;color:${s.done?'#48bb78':'#aab0bc'}">${s.done?'✓':' '}${s.label}</span>`).join('')}</td>
      <td><button class="btn-sm btn-outline" onclick="openLetterDetail('${l.id}')">Detail</button></td>
    </tr>`;
  }).join('');

  document.getElementById('view-workflows').innerHTML=`
    <h1 class="page-title">Workflows</h1>
    <p class="page-sub">Pantau alur persetujuan setiap surat.</p>
    <div class="section-card">
      ${letters.length===0 ? emptyState() : `
      <table class="data-table">
        <thead><tr><th>SURAT</th><th>STATUS</th><th>PROGRESS</th><th>AKSI</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>`;
}

/* ─── USER MANAGEMENT ─── */
async function renderUserManagement(){
  if (window._currentUser?.role !== 'super-admin') {
    document.getElementById('view-user-management').innerHTML = emptyState('User Management hanya untuk super admin');
    return;
  }
  const {users} = await API.getUsers();
  window._users = users;

  const cards = users.map(u=>`
    <div class="user-card">
      ${avatar(u.name,40)}
      <div class="user-card-info">
        <div class="user-card-name">${u.name} <span style="font-size:11px;color:#8892a4">· ${u.nip}</span></div>
        <div class="user-card-meta">${u.unit||'—'}</div>
      </div>
      ${roleBadge(u.role)}
      <div class="actions-row" style="margin-left:12px">
        ${window._currentUser?.role === 'super-admin' ? `<button class="btn-sm btn-dark" onclick="startRemoteUser('${u.id}')">Remote</button>` : ''}
        <button class="btn-sm btn-outline" onclick="editUser('${u.id}')">Edit</button>
        <button class="btn-sm btn-danger" onclick="deleteUser('${u.id}')">Hapus</button>
      </div>
    </div>`).join('');

  document.getElementById('view-user-management').innerHTML=`
    <div class="flex-between">
      <div><h1 class="page-title">User Management</h1><p class="page-sub">Kelola akun pengguna sistem.</p></div>
      <div class="actions-row">
        <a class="btn-sm btn-outline btn-icon" href="${API.backupUrl()}" download>
          Download Backup ZIP
        </a>
        <button class="btn-sm btn-danger btn-icon" onclick="resetAllData()">
          Reset Semua Data
        </button>
        <button class="btn-sm btn-dark btn-icon" onclick="showAddUserModal()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Tambah User
        </button>
      </div>
    </div>
    <div class="danger-zone">
      <strong>Zona reset super admin</strong>
      <span>Reset akan menghapus semua surat, riwayat, catatan, file upload, dan semua akun selain super admin.</span>
    </div>
    <div class="grid-users">${cards||emptyState('Belum ada user')}</div>`;
}

async function renderFileDatabase(){
  const {files} = await API.getFiles();
  const rows = files.map(f=>`
    <tr>
      <td><div class="letter-title">${f.originalName||'File'}</div><div class="letter-sub">${f.type} · ${f.mime||'file'}</div></td>
      <td><div class="letter-title">${f.perihal||'—'}</div><div class="letter-sub">${f.nomor||'—'}</div></td>
      <td>${f.uploader||'—'}<div class="letter-sub">${f.role||'—'}</div></td>
      <td>${fmtDate(f.uploadedAt)}</td>
      <td>${f.size ? (f.size / 1024 / 1024).toFixed(2) + ' MB' : '—'}</td>
      <td><div class="actions-row">
        ${f.type==='Dokumen Surat'
          ? `<a class="btn-sm btn-outline" href="${API.documentUrl(f.letterId)}" target="_blank">Lihat</a><a class="btn-sm btn-dark" href="${API.documentDownloadUrl(f.letterId)}" download>Download</a>`
          : f.type==='Lampiran Revisi Penandatangan'
            ? `<a class="btn-sm btn-outline" href="${API.signerRevisionAttachmentUrl(f.letterId, f.revisionId, f.id)}" target="_blank">Lihat</a><a class="btn-sm btn-dark" href="${API.signerRevisionAttachmentDownloadUrl(f.letterId, f.revisionId, f.id)}" download>Download</a>`
            : `<a class="btn-sm btn-outline" href="${API.reviewAttachmentUrl(f.letterId, f.reviewId, f.id)}" target="_blank">Lihat</a><a class="btn-sm btn-dark" href="${API.reviewAttachmentDownloadUrl(f.letterId, f.reviewId, f.id)}" download>Download</a>`}
      </div></td>
    </tr>`).join('');

  document.getElementById('view-file-database').innerHTML=`
    <div class="flex-between" style="gap:12px;flex-wrap:wrap">
      <div>
        <h1 class="page-title">Database File Masuk</h1>
        <p class="page-sub">Audit semua PDF surat dan lampiran revisi, termasuk uploader dan jam upload.</p>
      </div>
      <a class="btn-sm btn-dark btn-icon" href="${API.backupUrl()}" download>Download Backup ZIP</a>
    </div>
    <div class="section-card">
      ${files.length===0 ? emptyState('Belum ada file masuk') : `
      <table class="data-table">
        <thead><tr><th>FILE</th><th>SURAT</th><th>DIUPLOAD OLEH</th><th>JAM UPLOAD</th><th>UKURAN</th><th>AKSI</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`}
    </div>`;
}

/* ─── SETTINGS ─── */
function renderSettings(user){
  document.getElementById('view-settings').innerHTML=`
    <h1 class="page-title">Pengaturan</h1>
    <p class="page-sub">Konfigurasi akun dan preferensi.</p>
    <div class="section-card" style="max-width:500px">
      <h2 style="font-size:15px;font-weight:700;margin-bottom:16px">Profil Saya</h2>
      <div class="field-group"><label>Nama</label><input value="${user.name}" id="setName"></div>
      <div class="field-group"><label>NIP</label><input value="${user.nip}" disabled style="background:#f4f6f9"></div>
      <div class="field-group"><label>Unit</label><input value="${user.unit||''}" id="setUnit"></div>
      <div class="field-group"><label>Peran</label><input value="${user.role}" disabled style="background:#f4f6f9"></div>
      <button class="btn-sm btn-dark" onclick="saveProfile()">Simpan Perubahan</button>
    </div>`;
}

/* ─── LETTER DETAIL ─── */
function renderLetterDetail(letter, user){
  const sign = letter.tandaTangan;
  const rvRows = (letter.reviewHistory||[]).map(r=>`
    <div class="timeline-item">
      <div class="timeline-dot ${r.status==='Disetujui'?'green':r.status==='Ditolak'?'red':r.status==='Direvisi'?'orange':''}">
        ${r.status==='Disetujui'?'✓':r.status==='Ditolak'?'✗':'⋯'}
      </div>
      <div class="timeline-content">
        <div class="timeline-action">${r.reviewerNama} — <span style="color:${r.status==='Disetujui'?'#48bb78':r.status==='Ditolak'?'#e53e3e':'#8892a4'}">${r.status}</span></div>
        ${r.catatan?`<div class="timeline-meta">${r.catatan}</div>`:''}
        ${reviewAttachmentActions(letter, r)}
        <div class="timeline-meta">${r.reviewedAt?fmtDate(r.reviewedAt):'Menunggu review'}</div>
      </div>
    </div>`).join('');

  const logRows = (letter.riwayat||[]).map(h=>`
    <div class="timeline-item">
      <div class="timeline-dot green">✓</div>
      <div class="timeline-content">
        <div class="timeline-action">${h.aksi}</div>
        <div class="timeline-meta">oleh ${h.oleh} · ${fmtDate(h.createdAt)}</div>
      </div>
    </div>`).join('');

  const signerRevisionRows = (letter.signerRevisions || []).map(r=>`
    <div class="timeline-item">
      <div class="timeline-dot orange">↺</div>
      <div class="timeline-content">
        <div class="timeline-action">${r.signerNama || 'Penandatangan'} — <span style="color:#c05621">Direvisi</span></div>
        ${r.catatan?`<div class="timeline-meta">${r.catatan}</div>`:''}
        ${signerRevisionAttachmentActions(letter, r)}
        <div class="timeline-meta">${fmtDate(r.createdAt)}</div>
      </div>
    </div>`).join('');

  const commentRows = (letter.catatan||[]).map(c=>`
    <div class="comment-item">
      ${avatar(c.oleh,32)}
      <div class="comment-body">
        <span class="comment-author">${c.oleh}</span><span class="comment-role">${c.peran}</span>
        <div class="comment-text">${c.pesan}</div>
        <div class="comment-time">${fmtDate(c.createdAt)}</div>
      </div>
    </div>`).join('');

  const canEdit = ((user.role==='pembuat' && user.id===letter.pembuatId) || user.role==='super-admin') && (letter.status==='Draft' || letter.status==='Sedang Direvisi');
  const canReview = user.role==='pereview' && (letter.reviewerIds||[]).includes(user.id) && letter.status==='Menunggu Review';
  const canSign = user.role==='penandatangan' && user.id===letter.penandatanganId && letter.status==='Menunggu TTD';

  document.getElementById('view-letter-detail').innerHTML=`
    <div class="breadcrumb"><a href="#" onclick="switchView('dashboard')">Dashboard</a> › Detail Surat</div>
    <div class="flex-between" style="margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <div>
        <div class="page-title">${letter.perihal}</div>
        <div style="font-size:13px;color:#8892a4;margin-top:4px">${letter.nomor}</div>
      </div>
      <div class="actions-row">
        ${statusPill(letter.status)}
        ${canEdit?`<button class="btn-sm btn-outline" onclick="openCreateForm('${letter.id}')">Edit</button>`:''}
        ${canReview?`<button class="btn-sm btn-dark" onclick="openReview('${letter.id}')">Review</button>`:''}
        ${canSign?`<button class="btn-sm btn-dark" onclick="openSigning('${letter.id}')">Tanda Tangani</button>`:''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div>
        <div class="section-card">
          <div class="detail-grid-info">
            <div class="detail-info-item"><span>Kategori</span><strong>${letter.kategori||'—'}</strong></div>
            <div class="detail-info-item"><span>Prioritas</span><strong>${letter.prioritas||'—'}</strong></div>
            <div class="detail-info-item"><span>Pembuat</span><strong>${letter.pembuatNama}</strong></div>
            <div class="detail-info-item"><span>Unit</span><strong>${letter.pembuatUnit||'—'}</strong></div>
            <div class="detail-info-item"><span>Dibuat</span><strong>${fmtDateShort(letter.createdAt)}</strong></div>
            <div class="detail-info-item"><span>Update</span><strong>${fmtDateShort(letter.updatedAt)}</strong></div>
          </div>
          <hr class="divider">
          ${documentActions(letter)}
          ${letter.ringkasan?`<hr class="divider"><p style="color:#5a6478;line-height:1.6;font-size:13px">${letter.ringkasan}</p>`:''}
          ${sign?`<hr class="divider"><div style="padding:12px;background:#d1fae5;border-radius:8px">
            <div style="font-size:12px;color:#065f46;font-weight:600">✓ Ditandatangani elektronik oleh ${sign.nama}</div>
            <div style="font-size:11px;color:#065f46">${sign.jabatan} · ${fmtDate(sign.signedAt)}</div>
          </div>${user.role==='pembuat' && user.id===letter.pembuatId ? signatureActions(letter) : ''}`:''}
        </div>
        <div class="section-card">
          <div class="section-title" style="margin-bottom:14px">Catatan</div>
          <div>${commentRows||emptyState('Belum ada catatan')}</div>
          <div class="comment-form-inline">
            <input id="newComment" placeholder="Tambah catatan...">
            <button class="btn-sm btn-dark" onclick="sendComment('${letter.id}')">Kirim</button>
          </div>
        </div>
      </div>
      <div>
        <div class="section-card">
          <div class="section-title" style="margin-bottom:14px">Alur Review</div>
          <div class="timeline">${rvRows||'<div class="text-muted" style="font-size:13px">Belum ada reviewer</div>'}</div>
        </div>
        ${signerRevisionRows ? `<div class="section-card">
          <div class="section-title" style="margin-bottom:14px">Revisi Penandatangan</div>
          <div class="timeline">${signerRevisionRows}</div>
        </div>` : ''}
        <div class="section-card">
          <div class="section-title" style="margin-bottom:14px">Riwayat Siklus</div>
          <div class="timeline">${logRows}</div>
        </div>
      </div>
    </div>`;
}
