/* forms.js — Create/Edit letter form, Review form, Signing form */

/* ─── CREATE / EDIT LETTER FORM ─── */
async function renderLetterForm(letterId = null) {
  const users = window._users || (await API.getUsers().then(r => { window._users = r.users; return r.users; }));
  const reviewers = users.filter(u => u.role === 'pereview');
  const signers   = users.filter(u => u.role === 'penandatangan');
  let letter = null;
  if (letterId) letter = await API.getLetter(letterId).then(r => r.letter);

  const v = letter || {};
  const selReviewers = v.reviewerIds || [];
  const selSigner    = v.penandatanganId || '';

  const reviewerItems = reviewers.map(u => `
    <div class="reviewer-item ${selReviewers.includes(u.id) ? 'selected' : ''}" data-uid="${u.id}" onclick="toggleReviewer(this)">
      ${avatar(u.name, 36)}
      <div class="reviewer-info">
        <div class="reviewer-name">${u.name}</div>
        <div class="reviewer-role">${u.unit || 'Pereview'}</div>
      </div>
      <div class="check-mark" ${selReviewers.includes(u.id) ? 'style="display:flex"' : ''}>✓</div>
    </div>`).join('');

  const signerOpts = signers.map(u =>
    `<option value="${u.id}" ${selSigner === u.id ? 'selected' : ''}>${u.name} — ${u.unit || ''}</option>`).join('');

  const kategoris = ['Surat Keputusan (SK)', 'Nota Dinas', 'Laporan', 'Undangan', 'Memorandum', 'Lainnya'];

  document.getElementById('view-letter-form').innerHTML = `
    <div class="breadcrumb">
      <a href="#" onclick="switchView('dashboard')">Dashboard</a> ›
      ${letterId ? 'Edit Surat' : 'Buat Surat Baru'}
    </div>
    <div class="two-col form-page">
      <div>
        <div class="form-section">
          <h2>Informasi Surat</h2>
          <p class="sub">Lengkapi detail surat resmi di bawah ini untuk memulai alur review.</p>
          <div class="field-group">
            <label>Perihal Surat <span style="color:#e53e3e">*</span></label>
            <input id="f-perihal" placeholder="Masukkan judul atau perihal surat..." value="${v.perihal || ''}">
          </div>
          <div class="form-grid-2">
            <div class="field-group">
              <label>Kategori</label>
              <select id="f-kategori">
                ${kategoris.map(k => `<option ${(v.kategori || 'Surat Keputusan (SK)') === k ? 'selected' : ''}>${k}</option>`).join('')}
              </select>
            </div>
            <div class="field-group">
              <label>Prioritas</label>
              <div class="radio-group" style="margin-top:8px">
                <label class="radio-label"><input type="radio" name="prioritas" value="Normal" ${(v.prioritas || 'Normal') === 'Normal' ? 'checked' : ''}> Normal</label>
                <label class="radio-label"><input type="radio" name="prioritas" value="Urgent" ${v.prioritas === 'Urgent' ? 'checked' : ''}> Urgent</label>
              </div>
            </div>
          </div>
          <div class="field-group">
            <label>Nomor Surat</label>
            <input id="f-nomor" placeholder="Menunggu nomor TU" value="${v.nomor || ''}">
          </div>
          <div class="field-group">
            <label>Ringkasan</label>
            <textarea id="f-ringkasan" rows="4" placeholder="Isi ringkas surat...">${v.ringkasan || ''}</textarea>
          </div>
          <div class="field-group">
            <label>Penanda Tangan</label>
            <select id="f-signer">
              <option value="">— Pilih Penanda Tangan —</option>
              ${signerOpts}
            </select>
          </div>
        </div>
        <div class="form-section">
          <h2>Unggah Dokumen</h2>
          <div class="drop-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
            <div class="drop-zone-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
            </div>
            <div class="drop-zone-text">Klik atau Seret file ke sini</div>
            <div class="drop-zone-sub">Mendukung PDF hingga 15MB</div>
            <input type="file" id="fileInput" accept="application/pdf,.pdf" style="display:none" onchange="handleFileSelect(this)">
          </div>
          <div id="uploadedFile">
            ${v.dokumen ? uploadedFileMarkup(v.dokumen, v.id) : ''}
          </div>
        </div>
        <div style="display:flex;gap:10px;padding-bottom:40px">
          <button class="btn-sm btn-outline" onclick="saveDraft()">Simpan Draf</button>
          <button class="btn-sm btn-dark" onclick="submitForReview()">
            ▶ Submit ke Reviewer
          </button>
          <span id="formMsg" style="font-size:12px;color:#8892a4;align-self:center"></span>
        </div>
      </div>
      <div>
        <div class="form-section">
          <h2>Reviewer Pertama</h2>
          <p class="sub">Pilih pejabat yang akan melakukan verifikasi tahap awal.</p>
          <div class="reviewer-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Cari Nama / NIP..." oninput="filterReviewers(this.value)">
          </div>
          <div class="reviewer-list" id="reviewerList">${reviewerItems}</div>
        </div>
        <div class="workflow-panel">
          <h3>Alur Persetujuan</h3>
          <div class="workflow-step active"><div class="workflow-dot"></div> Reviewer 1 (dipilih)</div>
          <div class="workflow-step"><div class="workflow-dot"></div> Reviewer 2 (TBA)</div>
          <div class="workflow-step"><div class="workflow-dot"></div> Penandatangan Akhir</div>
        </div>
      </div>
    </div>`;

  window._editingLetterId = letterId;
  window._uploadedFile = null;
}

function toggleReviewer(el) {
  el.classList.toggle('selected');
  const cm = el.querySelector('.check-mark');
  if (el.classList.contains('selected')) cm.style.display = 'flex';
  else cm.style.display = 'none';
}

function filterReviewers(q) {
  document.querySelectorAll('.reviewer-item').forEach(el => {
    const name = el.querySelector('.reviewer-name').textContent.toLowerCase();
    el.style.display = name.includes(q.toLowerCase()) ? '' : 'none';
  });
}

function handleFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Dokumen wajib berupa PDF', 'error');
    input.value = '';
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showToast('Ukuran PDF maksimal 15MB', 'error');
    input.value = '';
    return;
  }
  window._uploadedFile = file;
  document.getElementById('uploadedFile').innerHTML = `
    <div class="uploaded-file">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <div class="uploaded-file-name">${file.name}</div>
      <button onclick="clearFile()" style="color:#e53e3e;font-size:12px">Hapus</button>
    </div>`;
}

function clearFile() { window._uploadedFile = null; document.getElementById('uploadedFile').innerHTML = ''; }

function uploadedFileMarkup(doc, letterId) {
  const size = doc.size ? ` • ${(doc.size / 1024 / 1024).toFixed(2)} MB` : '';
  return `
    <div class="uploaded-file">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <div class="uploaded-file-name">${doc.originalName || 'Dokumen PDF'}${size}</div>
      ${letterId ? `<a class="btn-sm btn-outline" href="${API.documentUrl(letterId)}" target="_blank">Download</a>` : ''}
      <button onclick="clearFile()" style="color:#e53e3e;font-size:12px">Ganti</button>
    </div>`;
}

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      type: file.type || 'application/pdf',
      size: file.size,
      dataUrl: reader.result
    });
    reader.onerror = () => reject(new Error('Gagal membaca file PDF'));
    reader.readAsDataURL(file);
  });
}

async function getFormData() {
  const selReviewers = [...document.querySelectorAll('.reviewer-item.selected')].map(el => el.dataset.uid);
  const data = {
    perihal:          document.getElementById('f-perihal').value.trim(),
    kategori:         document.getElementById('f-kategori').value,
    prioritas:        document.querySelector('input[name="prioritas"]:checked')?.value || 'Normal',
    nomor:            document.getElementById('f-nomor').value.trim(),
    ringkasan:        document.getElementById('f-ringkasan').value.trim(),
    penandatanganId:  document.getElementById('f-signer').value || null,
    reviewerIds:      selReviewers,
    pembuatId:        window._currentUser.id,
    updatedBy:        window._currentUser.name,
  };
  const dokumen = await fileToPayload(window._uploadedFile);
  if (dokumen) data.dokumen = dokumen;
  return data;
}

async function saveDraft() {
  const data = await getFormData();
  if (!data.perihal) { showToast('Perihal wajib diisi','error'); return; }
  const msg = document.getElementById('formMsg');
  msg.textContent = 'Menyimpan...';
  try {
    if (window._editingLetterId) {
      await API.updateLetter(window._editingLetterId, data);
    } else {
      await API.createLetter(data);
    }
    showToast('Draft tersimpan ✓', 'success');
    msg.textContent = '';
    await refreshData();
    switchView('dashboard');
  } catch(e) { showToast(e.message,'error'); msg.textContent=''; }
}

async function submitForReview() {
  const data = await getFormData();
  if (!data.perihal) { showToast('Perihal wajib diisi','error'); return; }
  if (!data.reviewerIds.length) { showToast('Pilih minimal 1 reviewer','error'); return; }
  try {
    let letter;
    if (window._editingLetterId) {
      await API.updateLetter(window._editingLetterId, data);
      letter = await API.submitLetter(window._editingLetterId);
    } else {
      const r = await API.createLetter({ ...data, status:'Menunggu Review' });
      letter = r;
      await API.submitLetter(r.letter.id);
    }
    showToast('Surat disubmit ke reviewer ✓', 'success');
    await refreshData();
    switchView('dashboard');
  } catch(e) { showToast(e.message,'error'); }
}

/* ─── REVIEW FORM ─── */
async function renderReviewForm(letterId) {
  const { letter } = await API.getLetter(letterId);
  const user = window._currentUser;
  const rv = (letter.reviewHistory || []).find(r => r.reviewerId === user.id);

  document.getElementById('view-review').innerHTML = `
    <div class="breadcrumb"><a href="#" onclick="switchView('inbox')">Inbox</a> › Review Surat</div>
    <h1 class="page-title">${letter.perihal}</h1>
    <p class="page-sub">${letter.nomor} · ${letter.kategori}</p>
    <div style="display:grid;grid-template-columns:1fr 340px;gap:20px">
      <div>
        <div class="section-card">
          <div class="section-title" style="margin-bottom:14px">Detail Dokumen</div>
          <div class="detail-grid-info">
            <div class="detail-info-item"><span>Pembuat</span><strong>${letter.pembuatNama}</strong></div>
            <div class="detail-info-item"><span>Prioritas</span><strong>${letter.prioritas}</strong></div>
            <div class="detail-info-item"><span>Status</span><strong>${letter.status}</strong></div>
          </div>
          <hr class="divider">
          <p style="color:#5a6478;line-height:1.6;font-size:13px">${letter.ringkasan || 'Tidak ada ringkasan.'}</p>
          ${documentActions(letter)}
        </div>
        <div class="section-card">
          <div class="section-title" style="margin-bottom:14px">Keputusan Review Anda</div>
          <div class="field-group">
            <label>Catatan Review</label>
            <textarea id="rv-catatan" rows="4" placeholder="Berikan catatan atau anotasi...">${rv?.catatan || ''}</textarea>
          </div>
          <div style="display:flex;gap:10px;margin-top:8px">
            <button class="btn-sm btn-success" onclick="submitReview('${letterId}','Disetujui')">✓ Setujui Dokumen</button>
            <button class="btn-sm btn-danger" onclick="submitReview('${letterId}','Ditolak')">✗ Tolak Dokumen</button>
          </div>
          ${rv && rv.status !== 'Menunggu' ? `<div style="margin-top:14px;padding:10px 14px;background:#f0f2f5;border-radius:8px;font-size:13px;color:#5a6478">Status review Anda: <strong>${rv.status}</strong></div>` : ''}
        </div>
      </div>
      <div>
        <div class="section-card">
          <div class="section-title" style="margin-bottom:14px">Status Reviewer</div>
          ${(letter.reviewHistory || []).map(r => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f4f6f9">
              ${avatar(r.reviewerNama)}
              <div style="flex:1"><div style="font-size:13px;font-weight:600">${r.reviewerNama}</div></div>
              <span class="pill ${r.status === 'Disetujui' ? 'pill-signed' : r.status === 'Ditolak' ? 'pill-rejected' : 'pill-review'}">${r.status}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
  const catatanField = document.getElementById('rv-catatan')?.closest('.field-group');
  if (catatanField) {
    catatanField.insertAdjacentHTML('afterend', `
      <div class="field-group">
        <label>Lampiran Revisi (opsional)</label>
        <input id="rv-attachments" type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" multiple onchange="handleReviewAttachmentSelect(this)">
        <div id="rv-attachment-list" class="revision-attachments">${reviewAttachmentActions(letter, rv)}</div>
      </div>`);
  }
  const reviewButtons = [...document.querySelectorAll('#view-review button')].filter(btn => btn.getAttribute('onclick') || ''.includes('submitReview'));
  const approveButton = [...document.querySelectorAll('#view-review button')].find(btn => (btn.getAttribute('onclick') || '').includes("Disetujui"));
  if (approveButton && !document.getElementById('revisionRequestBtn')) {
    approveButton.insertAdjacentHTML('afterend', `<button id="revisionRequestBtn" class="btn-sm btn-outline" onclick="submitReview('${letterId}','Direvisi')">↺ Minta Revisi</button>`);
  }
}

async function submitReview(letterId, status) {
  const catatan = document.getElementById('rv-catatan').value.trim();
  try {
    await API.submitReview(letterId, { reviewerId: window._currentUser.id, status, catatan });
    showToast(`Review ${status} ✓`, 'success');
    await refreshData();
    switchView('inbox');
  } catch(e) { showToast(e.message, 'error'); }
}

function handleSignerRevisionAttachmentSelect(input) {
  const files = [...input.files];
  const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
  if (files.some(file => !allowed.includes(file.type))) {
    showToast('Lampiran revisi hanya PDF, PNG, atau JPG', 'error');
    input.value = '';
    window._signRevisionAttachments = [];
    return;
  }
  if (files.some(file => file.size > 15 * 1024 * 1024)) {
    showToast('Ukuran tiap lampiran maksimal 15MB', 'error');
    input.value = '';
    window._signRevisionAttachments = [];
    return;
  }
  window._signRevisionAttachments = files;
  const list = document.getElementById('sign-revision-attachment-list');
  if (list) {
    list.innerHTML = files.map(file => `
      <div class="revision-file">
        <div class="document-meta"><strong>${file.name}</strong><span>${file.type} • ${(file.size / 1024 / 1024).toFixed(2)} MB</span></div>
      </div>`).join('');
  }
}

async function mintaRevisiDariPenandatangan(letterId) {
  const catatan = document.getElementById('sign-catatan-revisi')?.value.trim();
  if (!catatan) { showToast('Catatan revisi wajib diisi', 'error'); return; }
  try {
    const attachments = await Promise.all((window._signRevisionAttachments || []).map(fileToPayload));
    await API.requestRevisionFromSigner(letterId, {
      userId: window._currentUser.id,
      catatan,
      attachments
    });
    window._signRevisionAttachments = [];
    showToast('Permintaan revisi terkirim ke pembuat', 'success');
    await refreshData();
    switchView('inbox');
  } catch(e) { showToast(e.message, 'error'); }
}

/* ─── SIGNING FORM ─── */
async function renderSigningForm(letterId) {
  const { letter } = await API.getLetter(letterId);
  const user = window._currentUser;

  document.getElementById('view-signing').innerHTML = `
    <div class="breadcrumb"><a href="#" onclick="switchView('inbox')">Inbox</a> › Tanda Tangan Elektronik</div>
    <h1 class="page-title">${letter.perihal}</h1>
    <p class="page-sub">${letter.nomor}</p>
    <div style="display:grid;grid-template-columns:1fr 320px;gap:20px">
      <div>
        <div class="section-card">
          <div class="section-title" style="margin-bottom:14px">Area Tanda Tangan</div>
          <div class="canvas-wrap" style="height:220px;position:relative">
            <canvas id="sigCanvas" style="width:100%;height:220px"></canvas>
            <div class="canvas-hint" id="canvasHint">Tanda tangan di sini...</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn-sm btn-outline" onclick="clearCanvas()">Bersihkan</button>
          </div>
        </div>
        <div class="section-card">
          <div class="field-group"><label>Nama Penandatangan</label><input id="sig-name" value="${user.name}"></div>
          <div class="field-group"><label>Jabatan</label><input id="sig-jabatan" value="${user.unit || ''}"></div>
          <button class="btn-sm btn-dark" style="width:100%;padding:12px" onclick="doSign('${letterId}')">
            ✓ Sahkan & Tandatangani
          </button>
        </div>
        <div class="section-card">
          <div class="section-title" style="margin-bottom:14px">Minta Revisi ke Pembuat</div>
          <div class="field-group">
            <label>Catatan Revisi <span style="color:#e53e3e">*</span></label>
            <textarea id="sign-catatan-revisi" rows="3" placeholder="Jelaskan apa yang perlu direvisi oleh pembuat..."></textarea>
          </div>
          <div class="field-group">
            <label>Lampiran Revisi (opsional)</label>
            <input id="sign-revision-attachments" type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" multiple onchange="handleSignerRevisionAttachmentSelect(this)">
            <div id="sign-revision-attachment-list" class="revision-attachments"></div>
          </div>
          <button class="btn-sm btn-outline" style="margin-top:8px" onclick="mintaRevisiDariPenandatangan('${letterId}')">
            ↺ Minta Revisi ke Pembuat
          </button>
        </div>
      </div>
      <div>
        <div class="section-card">
          <div class="section-title" style="margin-bottom:14px">Info Dokumen</div>
          <div class="detail-info-item" style="margin-bottom:10px"><span>Perihal</span><strong>${letter.perihal}</strong></div>
          <div class="detail-info-item" style="margin-bottom:10px"><span>Pembuat</span><strong>${letter.pembuatNama}</strong></div>
          <div class="detail-info-item"><span>Kategori</span><strong>${letter.kategori}</strong></div>
          ${documentActions(letter)}
        </div>
        <div class="section-card">
          <div class="section-title" style="margin-bottom:12px">Status Reviewer</div>
          ${(letter.reviewHistory || []).map(r => `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              ${avatar(r.reviewerNama, 24)}
              <span style="font-size:12px;flex:1">${r.reviewerNama}</span>
              <span class="pill ${r.status === 'Disetujui' ? 'pill-signed' : 'pill-review'}" style="font-size:10px">${r.status}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  initCanvas();
}

/* Canvas drawing */
let _isDrawing = false, _ctx = null, _canvas = null;
function initCanvas() {
  _canvas = document.getElementById('sigCanvas');
  if (!_canvas) return;
  _canvas.width  = _canvas.offsetWidth  || 600;
  _canvas.height = 220;
  _ctx = _canvas.getContext('2d');
  _ctx.strokeStyle = '#1a2236';
  _ctx.lineWidth   = 2.5;
  _ctx.lineCap     = 'round';
  _canvas.onmousedown  = e => { _isDrawing = true; const p = pos(e); _ctx.beginPath(); _ctx.moveTo(p.x, p.y); document.getElementById('canvasHint').style.display='none'; };
  _canvas.onmousemove  = e => { if (!_isDrawing) return; const p = pos(e); _ctx.lineTo(p.x, p.y); _ctx.stroke(); };
  _canvas.onmouseup    = () => _isDrawing = false;
  _canvas.onmouseleave = () => _isDrawing = false;
  _canvas.ontouchstart = e => { e.preventDefault(); _isDrawing = true; const p = pos(e.touches[0]); _ctx.beginPath(); _ctx.moveTo(p.x, p.y); document.getElementById('canvasHint').style.display='none'; };
  _canvas.ontouchmove  = e => { e.preventDefault(); if (!_isDrawing) return; const p = pos(e.touches[0]); _ctx.lineTo(p.x, p.y); _ctx.stroke(); };
  _canvas.ontouchend   = () => _isDrawing = false;
}
function pos(e) { const r = _canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (_canvas.width / r.width), y: (e.clientY - r.top) * (_canvas.height / r.height) }; }
function clearCanvas() { if (_ctx) { _ctx.clearRect(0, 0, _canvas.width, _canvas.height); document.getElementById('canvasHint').style.display=''; } }

async function doSign(letterId) {
  const nama    = document.getElementById('sig-name').value.trim();
  const jabatan = document.getElementById('sig-jabatan').value.trim();
  if (!nama) { showToast('Nama wajib diisi', 'error'); return; }
  const image = _canvas ? _canvas.toDataURL('image/png') : null;
  try {
    await API.submitSignature(letterId, { userId: window._currentUser.id, image, nama, jabatan });
    showToast('Dokumen berhasil ditandatangani ✓', 'success');
    await refreshData();
    switchView('dashboard');
  } catch(e) { showToast(e.message, 'error'); }
}

async function mintaRevisiDariPenandatangan(letterId) {
  const catatan = document.getElementById('sign-catatan-revisi')?.value.trim();
  if (!catatan) { showToast('Catatan revisi wajib diisi', 'error'); return; }
  try {
    await API.requestRevisionFromSigner(letterId, {
      userId: window._currentUser.id,
      catatan
    });
    showToast('Permintaan revisi terkirim ke pembuat ✓', 'success');
    await refreshData();
    switchView('inbox');
  } catch(e) { showToast(e.message, 'error'); }
}

function handleReviewAttachmentSelect(input) {
  const files = [...input.files];
  const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
  if (files.some(file => !allowed.includes(file.type))) {
    showToast('Lampiran revisi hanya PDF, PNG, atau JPG', 'error');
    input.value = '';
    window._reviewAttachments = [];
    return;
  }
  if (files.some(file => file.size > 15 * 1024 * 1024)) {
    showToast('Ukuran tiap lampiran maksimal 15MB', 'error');
    input.value = '';
    window._reviewAttachments = [];
    return;
  }
  window._reviewAttachments = files;
  const list = document.getElementById('rv-attachment-list');
  if (list) {
    list.innerHTML = files.map(file => `
      <div class="revision-file">
        <div class="document-meta"><strong>${file.name}</strong><span>${file.type} • ${(file.size / 1024 / 1024).toFixed(2)} MB</span></div>
      </div>`).join('');
  }
}

async function submitReview(letterId, status) {
  const catatan = document.getElementById('rv-catatan').value.trim();
  if (status === 'Direvisi' && !catatan) {
    showToast('Catatan revisi wajib diisi', 'error');
    return;
  }
  try {
    const attachments = await Promise.all((window._reviewAttachments || []).map(fileToPayload));
    await API.submitReview(letterId, { reviewerId: window._currentUser.id, status, catatan, attachments });
    window._reviewAttachments = [];
    showToast(`Review ${status} selesai`, 'success');
    await refreshData();
    switchView('inbox');
  } catch(e) { showToast(e.message, 'error'); }
}
