/* ui.js — shared UI helpers */

/* ── Toast ── */
let toastTimer;
function showToast(msg, type=''){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast${type ? ' '+type : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ t.className='toast hidden'; }, 3000);
}

/* ── Modal ── */
function showModal(html, onClose){
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document._modalClose = onClose;
}
function closeModal(){
  document.getElementById('modal-overlay').classList.add('hidden');
  if(typeof document._modalClose === 'function') document._modalClose();
}

/* ── Format date ── */
function fmtDate(iso){
  if(!iso) return '—';
  return new Date(iso).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function fmtDateShort(iso){
  if(!iso) return '—';
  return new Date(iso).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
}

/* ── Status pill ── */
function statusPill(s){
  const map={
    'Draft':          'pill-draft',
    'Menunggu Review':'pill-review',
    'Sedang Direvisi':'pill-revision',
    'Ditolak':        'pill-rejected',
    'Menunggu TTD':   'pill-waiting-sign',
    'Ditandatangani': 'pill-signed',
    'Selesai':        'pill-done',
  };
  return `<span class="pill ${map[s]||'pill-draft'}">${s}</span>`;
}

/* ── Role badge ── */
function roleBadge(r){
  const map={'super-admin':'rb-super-admin',pembuat:'rb-pembuat',pereview:'rb-pereview',penandatangan:'rb-penandatangan',pemonitor:'rb-pemonitor'};
  const label={'super-admin':'Super Admin',pembuat:'Pembuat',pereview:'Pereview',penandatangan:'Penanda Tangan',pemonitor:'Pemonitor'};
  return `<span class="role-badge ${map[r]||''}">${label[r]||r}</span>`;
}

/* ── Avatar ── */
function avatar(name, size=28){
  const init = (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const colors=['#4a6fa5','#48bb78','#ed8936','#9f7aea','#e53e3e','#319795'];
  const color = colors[(init.charCodeAt(0)||0) % colors.length];
  return `<div class="avatar-chip" style="width:${size}px;height:${size}px;font-size:${Math.floor(size*0.38)}px;background:${color}">${init}</div>`;
}

/* ── Spinner ── */
function spinner(){ return `<div style="text-align:center;padding:40px;color:#8892a4">Memuat data...</div>`; }

/* ── Empty ── */
function emptyState(msg='Tidak ada data'){
  return `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p>${msg}</p></div>`;
}

/* ── Confirm modal ── */
function confirmModal(msg, onConfirm){
  showModal(`
    <div class="modal-title">Konfirmasi</div>
    <div class="modal-body"><p style="color:#5a6478">${msg}</p></div>
    <div class="modal-actions">
      <button class="btn-sm btn-outline" onclick="closeModal()">Batal</button>
      <button class="btn-sm btn-danger" id="confirmOk">Ya, Lanjutkan</button>
    </div>
  `);
  document.getElementById('confirmOk').onclick = ()=>{ closeModal(); onConfirm(); };
}

function documentActions(letter){
  if(!letter || !letter.dokumen) {
    return `<div class="document-panel muted-doc">Belum ada PDF yang diunggah.</div>`;
  }
  const doc = letter.dokumen;
  const size = doc.size ? `${(doc.size / 1024 / 1024).toFixed(2)} MB` : 'PDF';
  return `
    <div class="document-panel">
      <div class="document-meta">
        <strong>${doc.originalName || 'Dokumen PDF'}</strong>
        <span>${size}</span>
      </div>
      <div class="actions-row">
        <a class="btn-sm btn-outline" href="${API.documentUrl(letter.id)}" target="_blank">Lihat PDF</a>
        <a class="btn-sm btn-dark" href="${API.documentDownloadUrl(letter.id)}" download>Download PDF</a>
      </div>
    </div>`;
}

function signatureActions(letter){
  if(!letter || !letter.tandaTangan || !letter.tandaTangan.image) return '';
  const sign = letter.tandaTangan;
  return `
    <div class="signature-download-panel">
      <div>
        <div style="font-size:12px;color:#065f46;font-weight:700">Gambar TTD elektronik tersedia</div>
        <div style="font-size:11px;color:#065f46">${sign.nama || ''} ${sign.jabatan ? '• ' + sign.jabatan : ''}</div>
      </div>
      <img src="${API.signatureUrl(letter.id)}" alt="Tanda tangan elektronik">
      <div class="actions-row">
        <a class="btn-sm btn-outline" href="${API.signatureUrl(letter.id)}" target="_blank">Lihat TTD</a>
        <a class="btn-sm btn-dark" href="${API.signatureDownloadUrl(letter.id)}" download>Download TTD</a>
      </div>
    </div>`;
}

function reviewAttachmentActions(letter, review){
  const files = review && review.attachments || [];
  if(!files.length) return '';
  return `
    <div class="revision-attachments">
      ${files.map(file => `
        <div class="revision-file">
          <div class="document-meta">
            <strong>${file.originalName || 'Lampiran revisi'}</strong>
            <span>${file.mime || 'file'}${file.size ? ' • ' + (file.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</span>
          </div>
          <div class="actions-row">
            <a class="btn-sm btn-outline" href="${API.reviewAttachmentUrl(letter.id, review.id, file.id)}" target="_blank">Lihat</a>
            <a class="btn-sm btn-dark" href="${API.reviewAttachmentDownloadUrl(letter.id, review.id, file.id)}" download>Download</a>
          </div>
        </div>`).join('')}
    </div>`;
}

function signerRevisionAttachmentActions(letter, revision){
  const files = revision && revision.attachments || [];
  if(!files.length) return '';
  return `
    <div class="revision-attachments">
      ${files.map(file => `
        <div class="revision-file">
          <div class="document-meta">
            <strong>${file.originalName || 'Lampiran revisi penandatangan'}</strong>
            <span>${file.mime || 'file'}${file.size ? ' • ' + (file.size / 1024 / 1024).toFixed(2) + ' MB' : ''}</span>
          </div>
          <div class="actions-row">
            <a class="btn-sm btn-outline" href="${API.signerRevisionAttachmentUrl(letter.id, revision.id, file.id)}" target="_blank">Lihat</a>
            <a class="btn-sm btn-dark" href="${API.signerRevisionAttachmentDownloadUrl(letter.id, revision.id, file.id)}" download>Download</a>
          </div>
        </div>`).join('')}
    </div>`;
}
