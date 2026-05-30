/* api.js — centralised fetch helpers */
const API = {
  base: '',
  async req(method, path, body){
    const opts = { method, headers:{'Content-Type':'application/json'} };
    if(body) opts.body = JSON.stringify(body);
    const r = await fetch(this.base + path, opts);
    const json = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(json.error || 'Request gagal');
    return json;
  },
  get:    (p)       => API.req('GET',    p),
  post:   (p, body) => API.req('POST',   p, body),
  put:    (p, body) => API.req('PUT',    p, body),
  delete: (p)       => API.req('DELETE', p),

  /* Auth */
  login: (nip, password) => API.post('/api/auth/login', {nip, password}),

  /* Letters */
  getLetters:       (user)    => {
    const q = user ? `?role=${encodeURIComponent(user.role)}&userId=${encodeURIComponent(user.id)}` : '';
    return API.get('/api/letters' + q);
  },
  getLetter:        (id)      => API.get(`/api/letters/${id}`),
  createLetter:     (data)    => API.post('/api/letters', data),
  updateLetter:     (id, d)   => API.put(`/api/letters/${id}`, d),
  deleteLetter:     (id)      => API.delete(`/api/letters/${id}`),
  submitLetter:     (id)      => API.post(`/api/letters/${id}/submit`),
  addComment:       (id, d)   => API.post(`/api/letters/${id}/comments`, d),
  submitReview:              (id, d) => API.post(`/api/letters/${id}/review`, d),
  submitSignature:           (id, d) => API.post(`/api/letters/${id}/signature`, d),
  requestRevisionFromSigner: (id, d) => API.post(`/api/letters/${id}/request-revision`, d),
  documentUrl:      (id)      => `/api/letters/${id}/document`,
  documentDownloadUrl: (id)   => `/api/letters/${id}/document-download`,
  signatureUrl:     (id)      => `/api/letters/${id}/signature-image`,
  signatureDownloadUrl: (id)  => `/api/letters/${id}/signature-download`,
  reviewAttachmentUrl: (letterId, reviewId, attachmentId) => `/api/review-attachments/${letterId}/${reviewId}/${attachmentId}`,
  reviewAttachmentDownloadUrl: (letterId, reviewId, attachmentId) => `/api/review-attachments/${letterId}/${reviewId}/${attachmentId}?download=1`,
  signerRevisionAttachmentUrl: (letterId, revisionId, attachmentId) => `/api/signer-revision-attachments/${letterId}/${revisionId}/${attachmentId}`,
  signerRevisionAttachmentDownloadUrl: (letterId, revisionId, attachmentId) => `/api/signer-revision-attachments/${letterId}/${revisionId}/${attachmentId}?download=1`,

  /* Users */
  getUsers:   ()       => API.get('/api/users'),
  createUser: (data)   => API.post('/api/users', data),
  updateUser: (id, d)  => API.put(`/api/users/${id}`, d),
  deleteUser: (id)     => API.delete(`/api/users/${id}`),

  /* Super admin */
  getFiles:   ()       => API.get('/api/files'),
  resetData:  ()       => API.post('/api/admin/reset-data', { confirm: 'RESET' }),
  backupUrl:  ()       => '/api/admin/backup.zip',
};
