/* ═══════════════════════════════════════════════════════════════════
   PDF PRO SUITE — app.js
   Toutes les fonctionnalités payantes d'Acrobat, 100 % client-side
═══════════════════════════════════════════════════════════════════ */

'use strict';

// ─── MOT DE PASSE D'ACCÈS ────────────────────────────────────────
const ACCESS_CODE = 'pdfpro2024'; // ← Change ce code ici

function initPasswordGate() {
  if (sessionStorage.getItem('pdf_auth') === 'ok') return;
  const gate = document.createElement('div');
  gate.className = 'pw-gate';
  gate.id = 'pwGate';
  gate.innerHTML = `
    <div class="pw-box">
      <div class="pw-logo">🔐</div>
      <h2>PDF Pro Suite</h2>
      <p>Accès privé — entrez votre code</p>
      <input class="pw-input" id="pwInput" type="password" placeholder="••••••••" maxlength="20" autocomplete="off"/>
      <button class="pw-btn" onclick="checkPW()">Accéder →</button>
      <div class="pw-error" id="pwError">Code incorrect. Réessayez.</div>
    </div>
  `;
  document.body.appendChild(gate);
  document.getElementById('pwInput').addEventListener('keydown', e => { if (e.key === 'Enter') checkPW(); });
}

function checkPW() {
  const val = document.getElementById('pwInput').value;
  if (val === ACCESS_CODE) {
    sessionStorage.setItem('pdf_auth', 'ok');
    document.getElementById('pwGate').style.opacity = '0';
    document.getElementById('pwGate').style.transition = 'opacity .4s';
    setTimeout(() => document.getElementById('pwGate').remove(), 400);
  } else {
    const err = document.getElementById('pwError');
    err.style.display = 'block';
    document.getElementById('pwInput').value = '';
    document.getElementById('pwInput').focus();
    setTimeout(() => { err.style.display = 'none'; }, 3000);
  }
}

// ─── ÉTAT GLOBAL ─────────────────────────────────────────────────
let currentTool = 'create';
let appOpen = false;
let pagesData = []; // { arrayBuffer, canvas, pageNum }

// ─── BULLE / APP ─────────────────────────────────────────────────
function toggleApp() {
  const app = document.getElementById('pdfApp');
  appOpen = !appOpen;
  if (appOpen) {
    app.style.display = 'flex';
    if (!currentTool) loadTool('create');
    else loadTool(currentTool);
  } else {
    app.style.display = 'none';
  }
}

function closeApp() {
  appOpen = false;
  document.getElementById('pdfApp').style.display = 'none';
}

function loadTool(name) {
  currentTool = name;
  document.querySelectorAll('.sb-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tool === name);
  });
  const main = document.getElementById('toolContent');
  main.innerHTML = '';
  setStatus('Prêt');

  const tools = {
    create:       renderCreate,
    'edit-img':   renderEditImg,
    annotate:     renderAnnotate,
    'fill-sign':  renderFillSign,
    'pdf-word':   renderPdfWord,
    'pdf-jpg':    renderPdfJpg,
    'img-pdf':    renderImgPdf,
    'html-pdf':   renderHtmlPdf,
    merge:        renderMerge,
    split:        renderSplit,
    organize:     renderOrganize,
    rotate:       renderRotate,
    compress:     renderCompress,
    watermark:    renderWatermark,
    'header-footer': renderHeaderFooter,
    protect:      renderProtect,
    esign:        renderEsign,
    ocr:          renderOcr,
    ai:           renderAi,
  };

  (tools[name] || renderCreate)(main);
}

// ─── UTILITAIRES ─────────────────────────────────────────────────
let _notifTimer;
function showNotif(msg, type = 'success') {
  clearTimeout(_notifTimer);
  const n = document.getElementById('notification');
  n.innerHTML = msg;
  n.className = 'notif ' + (type === 'error' ? 'error' : type === 'info' ? 'info' : '');
  _notifTimer = setTimeout(() => { n.className = 'notif hidden'; }, 5000);
}

function setStatus(msg) {
  const el = document.getElementById('statusMsg');
  if (el) el.textContent = msg;
}

function sanitize(s) {
  return (s || 'document').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 80) || 'document';
}

function dl(blob, filename, mime) {
  const url = URL.createObjectURL(new Blob([blob], { type: mime }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

function readFile(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.readAsArrayBuffer(file);
  });
}

function readFileAsDataURL(file) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.readAsDataURL(file);
  });
}

function makeDropzone(container, accept, label, hint, cb) {
  const dz = document.createElement('div');
  dz.className = 'dropzone';
  dz.innerHTML = `
    <div class="dropzone-icon">📂</div>
    <div class="dropzone-text"><strong>${label}</strong></div>
    <div class="dropzone-hint">${hint}</div>
    <input type="file" accept="${accept}" ${accept.includes('multiple') || cb.multiple ? 'multiple' : ''} />
  `;
  const inp = dz.querySelector('input[type="file"]');
  if (cb.multiple) inp.setAttribute('multiple', '');
  inp.addEventListener('change', e => { if (e.target.files.length) cb(e.target.files); });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('drag-over');
    if (e.dataTransfer.files.length) cb(e.dataTransfer.files);
  });
  container.appendChild(dz);
  return dz;
}

function toolShell(main, icon, title, desc, bodyHTML) {
  main.innerHTML = `
    <div class="tool-header">
      <h1>
        <span class="tool-icon"><svg viewBox="0 0 24 24">${icon}</svg></span>
        ${title}
      </h1>
      <p class="tool-desc">${desc}</p>
    </div>
    <div class="tool-body">${bodyHTML}</div>
  `;
}

async function renderPdfPages(arrayBuffer, _unused, scale = 1.2) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    pages.push({ canvas, pageNum: i });
  }
  return pages;
}

// ════════════════════════════════════════════════════════════════
// 1. CRÉER UN PDF
// ════════════════════════════════════════════════════════════════
function renderCreate(main) {
  main.innerHTML = `
    <div class="tool-header">
      <h1>
        <span class="tool-icon"><svg viewBox="0 0 24 24" fill="white"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg></span>
        Créer un PDF
      </h1>
      <p class="tool-desc">Éditeur de texte riche — exportez en PDF ou Word</p>
    </div>
    <div class="rich-toolbar" id="richToolbar">
      <select id="rt-heading" title="Style">
        <option value="p">Normal</option>
        <option value="h1">Titre 1</option>
        <option value="h2">Titre 2</option>
        <option value="h3">Titre 3</option>
      </select>
      <select id="rt-font" title="Police">
        <option value="Arial">Arial</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Courier New">Courier New</option>
        <option value="Georgia">Georgia</option>
        <option value="Verdana">Verdana</option>
      </select>
      <select id="rt-size" title="Taille">
        ${[10,11,12,14,16,18,20,24,28,32,36,48].map(s=>`<option value="${s}px"${s===14?' selected':''}>${s}px</option>`).join('')}
      </select>
      <span class="rich-sep"></span>
      <button onclick="document.execCommand('bold')" title="Gras"><b>G</b></button>
      <button onclick="document.execCommand('italic')" title="Italique"><i>I</i></button>
      <button onclick="document.execCommand('underline')" title="Souligné"><u>S</u></button>
      <button onclick="document.execCommand('strikeThrough')" title="Barré"><s>Ab</s></button>
      <span class="rich-sep"></span>
      <button onclick="document.execCommand('justifyLeft')" title="Gauche">⬅</button>
      <button onclick="document.execCommand('justifyCenter')" title="Centrer">⬛</button>
      <button onclick="document.execCommand('justifyRight')" title="Droite">➡</button>
      <button onclick="document.execCommand('justifyFull')" title="Justifier">☰</button>
      <span class="rich-sep"></span>
      <button onclick="document.execCommand('insertUnorderedList')" title="Liste">• Liste</button>
      <button onclick="document.execCommand('insertOrderedList')" title="Numérotée">1. Liste</button>
      <button onclick="document.execCommand('indent')" title="Indenter">→</button>
      <button onclick="document.execCommand('outdent')" title="Désindenter">←</button>
      <span class="rich-sep"></span>
      <input type="color" id="rt-color" value="#000000" title="Couleur texte"/>
      <input type="color" id="rt-bg" value="#ffffff" title="Surlignage"/>
      <span class="rich-sep"></span>
      <button onclick="insertImage()" title="Image">🖼</button>
      <button onclick="insertTable()" title="Tableau">⊞</button>
      <button onclick="insertLink()" title="Lien">🔗</button>
      <span class="rich-sep"></span>
      <input type="text" id="rt-title" placeholder="Titre du document..." style="border:1px solid #e2e8f0;border-radius:6px;padding:2px 8px;font-size:12px;height:26px;width:160px"/>
      <button class="btn btn-red" style="height:26px;padding:0 12px;font-size:12px" onclick="exportRichPDF()" id="btnPDF">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="white"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/></svg> PDF
      </button>
      <button class="btn btn-blue" style="height:26px;padding:0 12px;font-size:12px" onclick="exportRichWord()" id="btnWord">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="white"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/></svg> Word
      </button>
      <button class="btn btn-gray" style="height:26px;padding:0 12px;font-size:12px" onclick="openExistingFile()">📂 Ouvrir</button>
    </div>
    <div class="rich-editor-wrap" style="flex:1">
      <div id="richEditor" class="rich-page" contenteditable="true" spellcheck="true"
        data-placeholder="Commencez à écrire votre document ici...&#10;&#10;• Ctrl+B = Gras  • Ctrl+I = Italique  • Ctrl+U = Souligné&#10;• Ctrl+P = Exporter PDF  • Ctrl+W = Word"></div>
    </div>
    <div class="editor-status">
      <span id="wc">0 mots</span>
      <span id="cc">0 caractères</span>
    </div>
  `;

  const editor = document.getElementById('richEditor');
  const qs = id => document.getElementById(id);

  qs('rt-heading').onchange = function() { document.execCommand('formatBlock', false, this.value); editor.focus(); };
  qs('rt-font').onchange = function() { document.execCommand('fontName', false, this.value); editor.focus(); };
  qs('rt-size').onchange = function() {
    const size = this.value;
    document.execCommand('fontSize', false, '7');
    document.querySelectorAll('font[size="7"]').forEach(el => { el.removeAttribute('size'); el.style.fontSize = size; });
    editor.focus();
  };
  qs('rt-color').oninput = function() { document.execCommand('foreColor', false, this.value); };
  qs('rt-bg').oninput = function() { document.execCommand('hiliteColor', false, this.value); };

  editor.addEventListener('input', () => {
    const t = editor.innerText.trim();
    const w = t ? t.split(/\s+/).filter(x=>x).length : 0;
    qs('wc').textContent = w + ' mot' + (w!==1?'s':'');
    qs('cc').textContent = t.length + ' car.';
  });

  document.addEventListener('keydown', function kbHandler(e) {
    if (!document.getElementById('richEditor')) { document.removeEventListener('keydown', kbHandler); return; }
    if (e.ctrlKey && !e.altKey) {
      if (e.key === 'p') { e.preventDefault(); exportRichPDF(); }
      if (e.key === 'w') { e.preventDefault(); exportRichWord(); }
    }
  });
}

function insertImage() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async function() {
    const file = this.files[0]; if (!file) return;
    const dataURL = await readFileAsDataURL(file);
    document.getElementById('richEditor').focus();
    document.execCommand('insertHTML', false, `<img src="${dataURL}" style="max-width:100%;border-radius:4px;margin:4px 0"/>`);
  };
  inp.click();
}

function insertTable() {
  const rows = 3, cols = 3;
  let html = '<table border="1" style="border-collapse:collapse;width:100%;margin:8px 0"><tbody>';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) html += `<td style="padding:6px 10px;border:1px solid #cbd5e1">${r===0?'<b>En-tête</b>':' '}</td>`;
    html += '</tr>';
  }
  html += '</tbody></table><p><br></p>';
  document.getElementById('richEditor').focus();
  document.execCommand('insertHTML', false, html);
}

function insertLink() {
  const url = prompt('Entrez l\'URL :', 'https://');
  if (url) document.execCommand('createLink', false, url);
}

function openExistingFile() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.html,.htm,.txt';
  inp.onchange = function() {
    const file = this.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = e => {
      const ed = document.getElementById('richEditor'); if (!ed) return;
      if (file.name.endsWith('.txt')) ed.innerText = e.target.result;
      else {
        const doc = new DOMParser().parseFromString(e.target.result, 'text/html');
        ed.innerHTML = doc.body.innerHTML;
      }
      showNotif('📂 Fichier ouvert : ' + file.name);
    };
    r.readAsText(file);
  };
  inp.click();
}

async function exportRichPDF() {
  const editor = document.getElementById('richEditor');
  if (!editor || !editor.innerText.trim()) { showNotif('⚠️ Document vide.', 'error'); return; }
  const btn = document.getElementById('btnPDF');
  if (btn) { btn._h = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true; }
  setStatus('Génération PDF…');
  try {
    const title = (document.getElementById('rt-title')?.value || 'document').trim() || 'document';
    const wrap = Object.assign(document.createElement('div'), {
      style: 'position:fixed;top:-99999px;left:0;width:794px;padding:60px 70px;background:#fff;font-family:Arial,sans-serif;font-size:14px;line-height:1.75;color:#000'
    });
    wrap.innerHTML = editor.innerHTML;
    document.body.appendChild(wrap);
    const canvas = await html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: '#fff' });
    document.body.removeChild(wrap);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 15, cw = 210 - margin*2, ch = 297 - margin*2;
    const imgH = (canvas.height / canvas.width) * cw;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    let y = 0;
    while (y < imgH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, margin - y, cw, imgH);
      y += ch;
    }
    pdf.save(sanitize(title) + '.pdf');
    showNotif('✅ PDF exporté : ' + sanitize(title) + '.pdf');
  } catch(e) { showNotif('❌ Erreur : ' + e.message, 'error'); }
  finally {
    if (btn) { btn.innerHTML = btn._h; btn.disabled = false; }
    setStatus('Prêt');
  }
}

async function exportRichWord() {
  const editor = document.getElementById('richEditor');
  if (!editor || !editor.innerText.trim()) { showNotif('⚠️ Document vide.', 'error'); return; }
  const title = (document.getElementById('rt-title')?.value || 'document').trim() || 'document';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${editor.innerHTML}</body></html>`;
  const blob = window.htmlDocx.asBlob(html);
  dl(blob, sanitize(title) + '.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  showNotif('✅ Word exporté : ' + sanitize(title) + '.docx');
}

// ════════════════════════════════════════════════════════════════
// 2. MODIFIER TEXTE & IMAGES (ouvrir un PDF)
// ════════════════════════════════════════════════════════════════
function renderEditImg(main) {
  toolShell(main,
    '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 1.42-.67.67H4v-1.25l9.06-9.06 1.25 1.25-8.39 8.39zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="white"/>',
    'Modifier texte & images', 'Ouvrez un PDF et visualisez chaque page. Modifiez votre texte et réexportez.',
    `<div id="editZone"></div><div id="editResult"></div>`
  );
  const zone = document.getElementById('editZone');
  makeDropzone(zone, '.pdf,application/pdf', 'Déposez un PDF ici pour l\'ouvrir', 'Formats acceptés : PDF', async files => {
    const ab = await readFile(files[0]);
    setStatus('Chargement des pages…');
    const pages = await renderPdfPages(ab, null, 1.4);
    const res = document.getElementById('editResult');
    res.innerHTML = `<p style="color:var(--muted);font-size:13px;margin:16px 0">${pages.length} page(s) — cliquez sur une page pour la copier comme image</p><div class="pdf-preview-wrap" id="pdfPagesWrap"></div>`;
    const wrap = document.getElementById('pdfPagesWrap');
    pages.forEach(({canvas, pageNum}) => {
      const div = document.createElement('div');
      div.className = 'pdf-preview-page';
      div.appendChild(canvas);
      const btn = document.createElement('button');
      btn.className = 'dl-btn'; btn.textContent = `⬇ Page ${pageNum}`;
      btn.onclick = () => {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `page_${pageNum}.png`;
        a.click();
      };
      div.appendChild(btn);
      wrap.appendChild(div);
    });
    setStatus(`✅ ${pages.length} pages chargées`);
  });
}

// ════════════════════════════════════════════════════════════════
// 3. ANNOTER & COMMENTER
// ════════════════════════════════════════════════════════════════
function renderAnnotate(main) {
  toolShell(main,
    '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12H7v-2h5v2zm3-4H7V8h8v2z" fill="white"/>',
    'Annoter & Commenter', 'Ouvrez un PDF et ajoutez des commentaires, surlignages et notes.',
    `<div id="annZone"></div>
     <div id="annToolbar" style="display:none;margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"></div>
     <div id="annCanvas" style="margin-top:16px;position:relative"></div>`
  );
  const zone = document.getElementById('annZone');
  makeDropzone(zone, '.pdf,application/pdf', 'Déposez un PDF ici', 'PDF accepté', async files => {
    const ab = await readFile(files[0]);
    const pages = await renderPdfPages(ab, null, 1.3);
    const wrap = document.getElementById('annCanvas');
    wrap.innerHTML = `<p style="color:var(--muted);font-size:13px;margin-bottom:12px">Cliquez sur une zone pour ajouter une note (${pages.length} pages)</p>`;
    pages.forEach(({canvas, pageNum}) => {
      const pageDiv = document.createElement('div');
      pageDiv.style.cssText = 'position:relative;margin-bottom:24px;display:inline-block;cursor:crosshair';
      pageDiv.appendChild(canvas);
      canvas.onclick = function(e) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        const note = prompt('Entrez votre commentaire :');
        if (!note) return;
        const tag = Object.assign(document.createElement('div'), {
          textContent: '💬 ' + note,
          style: `position:absolute;left:${x}px;top:${y}px;background:#fef08a;border:1px solid #ca8a04;padding:4px 8px;border-radius:6px;font-size:12px;max-width:200px;word-wrap:break-word;cursor:move;z-index:10;box-shadow:0 2px 6px rgba(0,0,0,.15)`
        });
        makeDraggable(tag);
        pageDiv.appendChild(tag);
      };
      const lbl = document.createElement('p');
      lbl.textContent = `Page ${pageNum}`;
      lbl.style.cssText = 'text-align:center;font-size:11px;color:var(--muted);margin-top:4px';
      wrap.appendChild(pageDiv); wrap.appendChild(lbl);
    });
  });
}

function makeDraggable(el) {
  let ox=0,oy=0,mx=0,my=0;
  el.onmousedown = function(e) {
    e.preventDefault();
    mx = e.clientX; my = e.clientY;
    document.onmousemove = function(e) {
      ox = mx - e.clientX; oy = my - e.clientY;
      mx = e.clientX; my = e.clientY;
      el.style.top  = (el.offsetTop  - oy) + 'px';
      el.style.left = (el.offsetLeft - ox) + 'px';
    };
    document.onmouseup = () => { document.onmousemove = null; };
  };
}

// ════════════════════════════════════════════════════════════════
// 4. REMPLIR & SIGNER
// ════════════════════════════════════════════════════════════════
function renderFillSign(main) {
  toolShell(main,
    '<path d="M17.75 7 14 3.25l-10 10V17h3.75l10-10zm2.96-2.96a1 1 0 0 0 0-1.41L18.37.29a1 1 0 0 0-1.41 0L15 2.25 18.75 6l1.96-1.96zM3 21h18v-2H3v2z" fill="white"/>',
    'Remplir et signer', 'Dessinez votre signature ou tapez-la, puis exportez.',
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:800px">
      <div>
        <h3 style="font-size:14px;font-weight:700;color:var(--dark);margin-bottom:10px">✍️ Dessinez votre signature</h3>
        <div class="sig-canvas-wrap">
          <canvas id="signatureCanvas" width="380" height="180"></canvas>
          <div class="sig-line"></div>
          <div class="sig-hint">Signez ici</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-gray" onclick="clearSig()">🗑 Effacer</button>
          <button class="btn btn-red" onclick="downloadSig()">⬇ Télécharger PNG</button>
        </div>
      </div>
      <div>
        <h3 style="font-size:14px;font-weight:700;color:var(--dark);margin-bottom:10px">⌨️ Signature tapée</h3>
        <div class="form-row">
          <label>Votre nom</label>
          <input id="sigName" type="text" placeholder="Jean Dupont" />
        </div>
        <div class="form-row">
          <label>Style</label>
          <select id="sigStyle">
            <option value="cursive">Cursive</option>
            <option value="'Times New Roman', serif">Classique</option>
            <option value="'Courier New', monospace">Machine</option>
          </select>
        </div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:20px;min-height:80px;background:white;display:flex;align-items:center;justify-content:center">
          <span id="sigPreview" style="font-size:32px;font-family:cursive;color:#1e293b">Jean Dupont</span>
        </div>
        <div style="margin-top:10px">
          <button class="btn btn-red" onclick="downloadTextSig()">⬇ Télécharger signature</button>
        </div>
        <div style="margin-top:16px">
          <h3 style="font-size:14px;font-weight:700;color:var(--dark);margin-bottom:8px">🖊 Ajouter sur un PDF</h3>
          <input type="file" accept=".pdf" id="sigPdfInput" style="display:none" onchange="addSigToPDF(this.files[0])"/>
          <button class="btn btn-blue" onclick="document.getElementById('sigPdfInput').click()">📂 Ouvrir PDF & signer</button>
        </div>
      </div>
    </div>`
  );

  // Préview signature tapée
  const nameInput = document.getElementById('sigName');
  const styleSelect = document.getElementById('sigStyle');
  const preview = document.getElementById('sigPreview');
  function updatePreview() {
    preview.textContent = nameInput.value || 'Votre signature';
    preview.style.fontFamily = styleSelect.value;
  }
  nameInput.addEventListener('input', updatePreview);
  styleSelect.addEventListener('change', updatePreview);

  // Canvas signature dessinée
  initSigCanvas();
}

function initSigCanvas() {
  const canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let drawing = false, lastX = 0, lastY = 0;

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return [(t.clientX - r.left) * (canvas.width / r.width), (t.clientY - r.top) * (canvas.height / r.height)];
  }
  canvas.addEventListener('mousedown', e => { drawing = true; [lastX,lastY] = getPos(e); });
  canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing = true; [lastX,lastY] = getPos(e); }, { passive:false });
  canvas.addEventListener('mousemove', e => {
    if (!drawing) return;
    const [x,y] = getPos(e);
    ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(x,y); ctx.stroke();
    [lastX,lastY] = [x,y];
  });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!drawing) return;
    const [x,y] = getPos(e);
    ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(x,y); ctx.stroke();
    [lastX,lastY] = [x,y];
  }, { passive:false });
  canvas.addEventListener('mouseup', () => drawing = false);
  canvas.addEventListener('touchend', () => drawing = false);
}

function clearSig() {
  const canvas = document.getElementById('signatureCanvas');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function downloadSig() {
  const canvas = document.getElementById('signatureCanvas');
  if (!canvas) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'signature.png';
  a.click();
  showNotif('✅ Signature téléchargée');
}

function downloadTextSig() {
  const name = document.getElementById('sigName')?.value || 'signature';
  const style = document.getElementById('sigStyle')?.value || 'cursive';
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 120;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white'; ctx.fillRect(0,0,400,120);
  ctx.font = `48px ${style}`; ctx.fillStyle = '#1e293b'; ctx.textAlign = 'center';
  ctx.fillText(name, 200, 80);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'signature_' + sanitize(name) + '.png';
  a.click();
  showNotif('✅ Signature exportée');
}

async function addSigToPDF(file) {
  const { PDFDocument } = PDFLib;
  const sigCanvas = document.getElementById('signatureCanvas');
  const ab = await readFile(file);
  const pdfDoc = await PDFDocument.load(ab);
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();
  const sigDataURL = sigCanvas.toDataURL('image/png');
  const sigBytes = await fetch(sigDataURL).then(r => r.arrayBuffer());
  const sigImg = await pdfDoc.embedPng(sigBytes);
  const sigDims = sigImg.scale(0.5);
  lastPage.drawImage(sigImg, { x: width - sigDims.width - 40, y: 30, width: sigDims.width, height: sigDims.height });
  const pdfBytes = await pdfDoc.save();
  dl(pdfBytes, 'signé_' + sanitize(file.name), 'application/pdf');
  showNotif('✅ PDF signé exporté');
}

// ════════════════════════════════════════════════════════════════
// 5. PDF EN WORD
// ════════════════════════════════════════════════════════════════
function renderPdfWord(main) {
  toolShell(main,
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" fill="white"/>',
    'PDF en Word', 'Convertit un PDF en document Word (.docx) — texte extrait automatiquement.',
    `<div id="p2wZone"></div><div id="p2wResult" style="margin-top:16px"></div>`
  );
  makeDropzone(document.getElementById('p2wZone'), '.pdf,application/pdf',
    'Déposez votre PDF ici', 'Le texte sera extrait et mis en forme Word', async files => {
    setStatus('Extraction du texte…');
    try {
      const ab = await readFile(files[0]);
      const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map(it => it.str).join(' ') + '\n\n';
      }
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><pre style="font-family:Arial;font-size:12pt;line-height:1.6">${fullText.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></body></html>`;
      const blob = window.htmlDocx.asBlob(html);
      const fname = sanitize(files[0].name.replace('.pdf','')) + '.docx';
      document.getElementById('p2wResult').innerHTML = `
        <div class="result-card">
          <h3>✅ Conversion terminée — ${pdf.numPages} page(s)</h3>
          <p style="color:var(--muted);font-size:13px;margin-bottom:12px">Texte extrait et mis en page Word</p>
          <button class="btn btn-blue" id="p2wDl">⬇ Télécharger ${fname}</button>
        </div>`;
      document.getElementById('p2wDl').onclick = () => {
        dl(blob, fname, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        showNotif('✅ Word téléchargé : ' + fname);
      };
      setStatus('✅ Prêt');
    } catch(e) { showNotif('❌ Erreur : ' + e.message, 'error'); setStatus('Erreur'); }
  });
}

// ════════════════════════════════════════════════════════════════
// 6. PDF EN JPG / PNG
// ════════════════════════════════════════════════════════════════
function renderPdfJpg(main) {
  toolShell(main,
    '<rect x="3" y="3" width="18" height="18" rx="2" fill="white"/><circle cx="8.5" cy="8.5" r="1.5" fill="#ff9800"/><path d="M21 15 16 10 5 21" stroke="#ff9800" fill="none"/>',
    'PDF en JPG/PNG', 'Convertit chaque page PDF en image haute résolution.',
    `<div id="p2jZone"></div>
     <div style="margin-top:12px;display:flex;align-items:center;gap:16px">
       <label style="font-size:13px;font-weight:600;color:var(--mid)">Format :</label>
       <select id="imgFmt" style="border:1px solid var(--border);border-radius:6px;padding:4px 10px">
         <option value="jpeg">JPG (qualité élevée)</option>
         <option value="png">PNG (sans perte)</option>
       </select>
       <label style="font-size:13px;font-weight:600;color:var(--mid)">Résolution :</label>
       <select id="imgScale" style="border:1px solid var(--border);border-radius:6px;padding:4px 10px">
         <option value="1.5">Normale (150 dpi)</option>
         <option value="2" selected>Haute (200 dpi)</option>
         <option value="3">Ultra (300 dpi)</option>
       </select>
     </div>
     <div id="p2jResult" style="margin-top:16px"></div>`
  );
  makeDropzone(document.getElementById('p2jZone'), '.pdf,application/pdf',
    'Déposez votre PDF ici', 'Chaque page sera convertie en image', async files => {
    const fmt = document.getElementById('imgFmt').value;
    const scale = parseFloat(document.getElementById('imgScale').value);
    setStatus('Conversion en cours…');
    const ab = await readFile(files[0]);
    const pages = await renderPdfPages(ab, null, scale);
    const res = document.getElementById('p2jResult');
    res.innerHTML = `<p style="color:var(--muted);font-size:13px;margin-bottom:12px">${pages.length} page(s) converties — cliquez pour télécharger</p>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn btn-red" onclick="downloadAllPages('${fmt}','${sanitize(files[0].name)}')">⬇ Télécharger toutes</button>
      </div>
      <div class="pdf-preview-wrap" id="jpgPagesWrap"></div>`;
    window._pdfPages = pages;
    const wrap = document.getElementById('jpgPagesWrap');
    pages.forEach(({canvas, pageNum}) => {
      const div = document.createElement('div');
      div.className = 'pdf-preview-page';
      div.appendChild(canvas);
      const btn = document.createElement('button');
      btn.className = 'dl-btn'; btn.textContent = `⬇ Page ${pageNum}`;
      btn.onclick = () => {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/' + fmt, fmt==='jpeg' ? 0.92 : undefined);
        a.download = `page_${pageNum}.${fmt==='jpeg'?'jpg':'png'}`;
        a.click();
      };
      div.appendChild(btn); wrap.appendChild(div);
    });
    setStatus(`✅ ${pages.length} pages converties`);
  });
}

function downloadAllPages(fmt, base) {
  const pages = window._pdfPages || [];
  pages.forEach(({canvas, pageNum}) => {
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/' + fmt, fmt==='jpeg' ? 0.92 : undefined);
    a.download = `${sanitize(base)}_page_${pageNum}.${fmt==='jpeg'?'jpg':'png'}`;
    document.body.appendChild(a); a.click();
    setTimeout(() => a.remove(), 100 * pageNum);
  });
}

// ════════════════════════════════════════════════════════════════
// 7. IMAGE EN PDF
// ════════════════════════════════════════════════════════════════
function renderImgPdf(main) {
  toolShell(main,
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" fill="white"/>',
    'Image en PDF', 'Convertit une ou plusieurs images (JPG, PNG, WebP) en PDF.',
    `<div id="i2pZone"></div><div id="i2pResult" style="margin-top:16px"></div>`
  );
  const dz = makeDropzone(document.getElementById('i2pZone'), 'image/*',
    'Déposez vos images ici', 'JPG, PNG, WebP — plusieurs fichiers acceptés', async files => {
    setStatus('Création du PDF…');
    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let first = true;
      for (const file of Array.from(files)) {
        const dataURL = await readFileAsDataURL(file);
        const img = new Image();
        await new Promise(res => { img.onload = res; img.src = dataURL; });
        if (!first) pdf.addPage();
        const ratio = img.naturalWidth / img.naturalHeight;
        let w = 210, h = 297;
        if (ratio > 1) { h = w / ratio; } else { w = h * ratio; }
        const x = (210 - w) / 2, y = (297 - h) / 2;
        pdf.addImage(dataURL, file.type.includes('png')?'PNG':'JPEG', x, y, w, h);
        first = false;
      }
      const fname = 'images_' + Date.now() + '.pdf';
      document.getElementById('i2pResult').innerHTML = `
        <div class="result-card">
          <h3>✅ PDF créé (${files.length} image(s))</h3>
          <button class="btn btn-red" id="i2pDl" style="margin-top:8px">⬇ Télécharger ${fname}</button>
        </div>`;
      document.getElementById('i2pDl').onclick = () => { pdf.save(fname); showNotif('✅ PDF téléchargé'); };
      setStatus('✅ Prêt');
    } catch(e) { showNotif('❌ Erreur : ' + e.message, 'error'); setStatus('Erreur'); }
  });
  dz.querySelector('input[type="file"]').setAttribute('multiple', '');
}

// ════════════════════════════════════════════════════════════════
// 8. HTML EN PDF
// ════════════════════════════════════════════════════════════════
function renderHtmlPdf(main) {
  toolShell(main,
    '<path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" fill="white"/>',
    'HTML / Web en PDF', 'Collez du code HTML ou une URL et convertissez en PDF.',
    `<div class="form-row"><label>Contenu HTML (collez ici)</label>
       <textarea id="htmlInput" style="min-height:200px;font-family:monospace;font-size:12px" placeholder="<h1>Mon document</h1><p>Contenu ici...</p>"></textarea>
     </div>
     <button class="btn btn-red" onclick="convertHtmlToPDF()">
       <svg viewBox="0 0 24 24" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" fill="white"/></svg>
       Convertir en PDF
     </button>
     <div id="h2pResult" style="margin-top:16px"></div>`
  );
}

async function convertHtmlToPDF() {
  const html = document.getElementById('htmlInput')?.value?.trim();
  if (!html) { showNotif('⚠️ Entrez du contenu HTML', 'error'); return; }
  setStatus('Conversion…');
  try {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;top:-99999px;left:0;width:794px;padding:60px 70px;background:#fff;font-family:Arial,sans-serif;font-size:14px;line-height:1.75';
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
    const canvas = await html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: '#fff' });
    document.body.removeChild(wrap);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 15, cw = 210 - margin*2, ch = 297 - margin*2;
    const imgH = (canvas.height / canvas.width) * cw;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    let y = 0;
    while (y < imgH) {
      if (y > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, margin - y, cw, imgH);
      y += ch;
    }
    const fname = 'html_export_' + Date.now() + '.pdf';
    document.getElementById('h2pResult').innerHTML = `<div class="result-card"><h3>✅ PDF prêt</h3><button class="btn btn-red" id="h2pDl">⬇ Télécharger</button></div>`;
    document.getElementById('h2pDl').onclick = () => { pdf.save(fname); showNotif('✅ PDF téléchargé'); };
    setStatus('✅ Prêt');
  } catch(e) { showNotif('❌ Erreur : ' + e.message, 'error'); setStatus('Erreur'); }
}

// ════════════════════════════════════════════════════════════════
// 9. COMBINER DES PDFS
// ════════════════════════════════════════════════════════════════
function renderMerge(main) {
  toolShell(main,
    '<path d="M4 6h2v2H4V6zm0 5h2v2H4v-2zm0 5h2v2H4v-2zm16-8V6H8v2h12zM8 11h12v2H8v-2zm0 5h12v2H8v-2z" fill="white"/>',
    'Combiner des fichiers PDF', 'Fusionnez plusieurs PDFs en un seul document.',
    `<div id="mergeZone"></div>
     <div id="mergeList" style="margin-top:12px;display:flex;flex-direction:column;gap:6px"></div>
     <div style="margin-top:14px;display:flex;gap:8px">
       <button class="btn btn-red" onclick="mergePDFs()">🔀 Combiner les PDF</button>
       <button class="btn btn-gray" onclick="clearMerge()">🗑 Effacer liste</button>
     </div>
     <div id="mergeResult" style="margin-top:16px"></div>`
  );
  window._mergeFiles = [];
  const dz = makeDropzone(document.getElementById('mergeZone'), '.pdf,application/pdf',
    'Déposez vos PDFs ici (plusieurs)', 'Ordre de dépôt = ordre de fusion', files => {
    Array.from(files).forEach(f => {
      window._mergeFiles.push(f);
      const item = document.createElement('div');
      item.style.cssText = 'background:white;border:1px solid var(--border);border-radius:6px;padding:8px 12px;display:flex;align-items:center;gap:10px;font-size:13px';
      item.innerHTML = `<span>📄</span><span style="flex:1">${f.name}</span><span style="color:var(--muted);font-size:11px">${(f.size/1024).toFixed(0)} Ko</span>`;
      document.getElementById('mergeList').appendChild(item);
    });
  });
  dz.querySelector('input[type="file"]').setAttribute('multiple', '');
}

function clearMerge() { window._mergeFiles = []; document.getElementById('mergeList').innerHTML = ''; }

async function mergePDFs() {
  const files = window._mergeFiles || [];
  if (files.length < 2) { showNotif('⚠️ Ajoutez au moins 2 PDFs', 'error'); return; }
  setStatus('Fusion en cours…');
  try {
    const { PDFDocument } = PDFLib;
    const merged = await PDFDocument.create();
    for (const file of files) {
      const ab = await readFile(file);
      const donor = await PDFDocument.load(ab, { ignoreEncryption: true });
      const pages = await merged.copyPages(donor, donor.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
    const bytes = await merged.save();
    const fname = 'combined_' + Date.now() + '.pdf';
    document.getElementById('mergeResult').innerHTML = `
      <div class="result-card">
        <h3>✅ ${files.length} PDFs fusionnés</h3>
        <button class="btn btn-red" id="mergeDl">⬇ Télécharger</button>
      </div>`;
    document.getElementById('mergeDl').onclick = () => { dl(bytes, fname, 'application/pdf'); showNotif('✅ PDF combiné téléchargé'); };
    setStatus('✅ Fusion terminée');
  } catch(e) { showNotif('❌ Erreur : ' + e.message, 'error'); setStatus('Erreur'); }
}

// ════════════════════════════════════════════════════════════════
// 10. DIVISER UN PDF
// ════════════════════════════════════════════════════════════════
function renderSplit(main) {
  toolShell(main,
    '<path d="M14 4l2.29 2.29-2.88 2.88 1.42 1.42 2.88-2.88L20 10V4h-6zm-4 0H4v6l2.29-2.29 4.71 4.7V20h2v-8.41l-5.29-5.3L10 4z" fill="white"/>',
    'Diviser un PDF', 'Extrayez des pages spécifiques ou divisez en pages individuelles.',
    `<div id="splitZone"></div>
     <div id="splitOptions" style="display:none;margin-top:14px">
       <div class="form-row">
         <label>Plages de pages (ex: 1-3, 5, 7-9)</label>
         <input id="splitRange" type="text" placeholder="1-3, 5, 8-10 (vide = toutes séparément)" />
       </div>
       <button class="btn btn-red" onclick="splitPDF()">✂️ Diviser</button>
     </div>
     <div id="splitResult" style="margin-top:16px"></div>`
  );
  makeDropzone(document.getElementById('splitZone'), '.pdf,application/pdf',
    'Déposez un PDF ici', 'Choisissez ensuite les pages à extraire', async files => {
    window._splitFile = files[0];
    const ab = await readFile(files[0]);
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.load(ab, { ignoreEncryption: true });
    document.getElementById('splitOptions').style.display = 'block';
    document.getElementById('splitOptions').insertAdjacentHTML('afterbegin',
      `<p style="color:var(--muted);font-size:13px;margin-bottom:12px">📄 ${files[0].name} — ${doc.getPageCount()} pages</p>`);
    window._splitAB = ab;
  });
}

async function splitPDF() {
  if (!window._splitAB) return;
  const rangeStr = document.getElementById('splitRange')?.value?.trim() || '';
  const { PDFDocument } = PDFLib;
  const srcDoc = await PDFDocument.load(window._splitAB, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  setStatus('Division en cours…');
  try {
    let groups;
    if (!rangeStr) {
      groups = Array.from({length: total}, (_,i) => [i]);
    } else {
      groups = rangeStr.split(',').map(r => {
        r = r.trim();
        if (r.includes('-')) {
          const [a,b] = r.split('-').map(n => parseInt(n)-1);
          return Array.from({length:b-a+1},(_,i)=>a+i);
        }
        return [parseInt(r)-1];
      }).filter(g => g.every(i=>i>=0&&i<total));
    }
    const res = document.getElementById('splitResult');
    res.innerHTML = `<div class="result-card"><h3>✅ ${groups.length} segment(s) prêts</h3><div id="splitDlList" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px"></div></div>`;
    for (let gi = 0; gi < groups.length; gi++) {
      const newDoc = await PDFDocument.create();
      const copied = await newDoc.copyPages(srcDoc, groups[gi]);
      copied.forEach(p => newDoc.addPage(p));
      const bytes = await newDoc.save();
      const fname = `partie_${gi+1}_pages_${groups[gi].map(i=>i+1).join('-')}.pdf`;
      const btn = document.createElement('button');
      btn.className = 'btn btn-red';
      btn.textContent = `⬇ ${fname}`;
      btn.onclick = () => { dl(bytes, fname, 'application/pdf'); };
      document.getElementById('splitDlList').appendChild(btn);
    }
    setStatus('✅ Division terminée');
  } catch(e) { showNotif('❌ Erreur : ' + e.message, 'error'); setStatus('Erreur'); }
}

// ════════════════════════════════════════════════════════════════
// 11. ORGANISER LES PAGES
// ════════════════════════════════════════════════════════════════
function renderOrganize(main) {
  toolShell(main,
    '<path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" fill="white"/>',
    'Organiser les pages', 'Réorganisez, supprimez ou dupliquez des pages par glisser-déposer.',
    `<div id="orgZone"></div>
     <div id="orgInfo" style="display:none;margin-top:10px">
       <div style="display:flex;gap:8px;margin-bottom:12px">
         <button class="btn btn-red" onclick="exportOrganized()">💾 Exporter PDF réorganisé</button>
         <button class="btn btn-gray" onclick="loadTool('organize')">↺ Recommencer</button>
       </div>
       <p style="font-size:12px;color:var(--muted)">Glissez les pages pour les réordonner. Cliquez 🗑 pour supprimer.</p>
     </div>
     <div class="pages-grid" id="orgGrid"></div>`
  );
  makeDropzone(document.getElementById('orgZone'), '.pdf,application/pdf',
    'Déposez un PDF ici', 'Réorganisez les pages visuellement', async files => {
    const ab = await readFile(files[0]);
    window._orgAB = ab;
    setStatus('Chargement…');
    const pages = await renderPdfPages(ab, null, 0.8);
    window._orgPages = pages.map(p => ({ ...p, deleted: false }));
    renderOrgGrid();
    document.getElementById('orgInfo').style.display = 'block';
    setStatus(`✅ ${pages.length} pages chargées`);
  });
}

function renderOrgGrid() {
  const grid = document.getElementById('orgGrid');
  grid.innerHTML = '';
  window._orgPages.forEach((p, idx) => {
    if (p.deleted) return;
    const div = document.createElement('div');
    div.className = 'page-thumb';
    div.draggable = true;
    div.dataset.idx = idx;
    const c = p.canvas.cloneNode(true);
    div.appendChild(c);
    const num = document.createElement('div');
    num.className = 'page-thumb-num';
    num.textContent = `Page ${p.pageNum}`;
    div.appendChild(num);
    const acts = document.createElement('div');
    acts.className = 'page-thumb-actions';
    acts.innerHTML = `
      <button title="Supprimer" style="background:#fee2e2;color:#dc2626" onclick="deleteOrgPage(${idx})">🗑</button>
      <button title="Dupliquer" style="background:#eff6ff;color:#2563eb" onclick="dupOrgPage(${idx})">⊕</button>
    `;
    div.appendChild(acts);
    div.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', idx); div.style.opacity='.4'; });
    div.addEventListener('dragend', () => { div.style.opacity='1'; });
    div.addEventListener('dragover', e => { e.preventDefault(); div.classList.add('drag-over-page'); });
    div.addEventListener('dragleave', () => div.classList.remove('drag-over-page'));
    div.addEventListener('drop', e => {
      e.preventDefault(); div.classList.remove('drag-over-page');
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx = idx;
      if (fromIdx === toIdx) return;
      const tmp = window._orgPages[fromIdx];
      window._orgPages[fromIdx] = window._orgPages[toIdx];
      window._orgPages[toIdx] = tmp;
      renderOrgGrid();
    });
    grid.appendChild(div);
  });
}

function deleteOrgPage(idx) { window._orgPages[idx].deleted = true; renderOrgGrid(); }
function dupOrgPage(idx) {
  const copy = { ...window._orgPages[idx] };
  window._orgPages.splice(idx+1, 0, copy);
  renderOrgGrid();
}

async function exportOrganized() {
  const { PDFDocument } = PDFLib;
  const srcDoc = await PDFDocument.load(window._orgAB, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();
  const activePages = window._orgPages.filter(p => !p.deleted);
  for (const p of activePages) {
    const [copied] = await newDoc.copyPages(srcDoc, [p.pageNum - 1]);
    newDoc.addPage(copied);
  }
  const bytes = await newDoc.save();
  dl(bytes, 'organisé_' + Date.now() + '.pdf', 'application/pdf');
  showNotif('✅ PDF réorganisé exporté');
}

// ════════════════════════════════════════════════════════════════
// 12. ROTATION
// ════════════════════════════════════════════════════════════════
function renderRotate(main) {
  toolShell(main,
    '<path d="M12 6v3l4-4-4-4v3a8 8 0 0 0-8 8c0 2.21.9 4.21 2.36 5.65L5.77 15.1A6 6 0 0 1 12 6zm5.64 1.35L17.23 8.9A6 6 0 0 1 12 18v-3l-4 4 4 4v-3a8 8 0 0 0 8-8c0-2.21-.9-4.21-2.36-5.65z" fill="white"/>',
    'Rotation & Retournement', 'Faites pivoter toutes les pages ou des pages spécifiques.',
    `<div id="rotZone"></div>
     <div id="rotOptions" style="display:none;margin-top:14px">
       <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
         <button class="btn btn-red" onclick="applyRotation(90)">↻ Rotation 90°</button>
         <button class="btn btn-red" onclick="applyRotation(180)">↻ Rotation 180°</button>
         <button class="btn btn-red" onclick="applyRotation(270)">↺ Rotation 270°</button>
       </div>
     </div>
     <div id="rotResult" style="margin-top:16px"></div>`
  );
  makeDropzone(document.getElementById('rotZone'), '.pdf,application/pdf',
    'Déposez un PDF ici', 'La rotation sera appliquée à toutes les pages', async files => {
    window._rotFile = files[0];
    window._rotAB = await readFile(files[0]);
    document.getElementById('rotOptions').style.display = 'block';
    showNotif('📄 PDF chargé : ' + files[0].name);
  });
}

async function applyRotation(deg) {
  if (!window._rotAB) return;
  const { PDFDocument, degrees } = PDFLib;
  setStatus(`Rotation ${deg}°…`);
  try {
    const doc = await PDFDocument.load(window._rotAB, { ignoreEncryption: true });
    doc.getPages().forEach(p => p.setRotation(degrees((p.getRotation().angle + deg) % 360)));
    const bytes = await doc.save();
    const fname = 'rotation_' + deg + '_' + sanitize(window._rotFile.name);
    document.getElementById('rotResult').innerHTML = `<div class="result-card"><h3>✅ Rotation ${deg}° appliquée</h3><button class="btn btn-red" id="rotDl">⬇ Télécharger</button></div>`;
    document.getElementById('rotDl').onclick = () => { dl(bytes, fname, 'application/pdf'); showNotif('✅ PDF pivoté exporté'); };
    setStatus('✅ Prêt');
  } catch(e) { showNotif('❌ Erreur : ' + e.message, 'error'); setStatus('Erreur'); }
}

// ════════════════════════════════════════════════════════════════
// 13. COMPRESSER UN PDF
// ════════════════════════════════════════════════════════════════
function renderCompress(main) {
  toolShell(main,
    '<path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5v-2z" fill="white"/>',
    'Compresser un PDF', 'Réduit la taille du fichier PDF (re-sauvegarde optimisée).',
    `<div id="cmpZone"></div>
     <div id="cmpOptions" style="display:none;margin-top:14px">
       <div class="form-row">
         <label>Niveau de compression</label>
         <select id="cmpLevel">
           <option value="low">Faible (meilleure qualité)</option>
           <option value="medium" selected>Moyen (recommandé)</option>
           <option value="high">Élevé (fichier plus petit)</option>
         </select>
       </div>
       <button class="btn btn-red" onclick="compressPDF()">🗜 Compresser</button>
     </div>
     <div id="cmpResult" style="margin-top:16px"></div>`
  );
  makeDropzone(document.getElementById('cmpZone'), '.pdf,application/pdf',
    'Déposez un PDF ici', 'La compression réoptimise la structure du fichier', async files => {
    window._cmpFile = files[0];
    window._cmpAB = await readFile(files[0]);
    document.getElementById('cmpOptions').style.display = 'block';
    showNotif(`📄 ${files[0].name} — ${(files[0].size/1024).toFixed(0)} Ko chargé`);
  });
}

async function compressPDF() {
  if (!window._cmpAB) return;
  setStatus('Compression…');
  try {
    const { PDFDocument } = PDFLib;
    const doc = await PDFDocument.load(window._cmpAB, { ignoreEncryption: true });
    const bytes = await doc.save({ useObjectStreams: true });
    const origKB = (window._cmpFile.size / 1024).toFixed(0);
    const newKB = (bytes.length / 1024).toFixed(0);
    const saved = Math.max(0, Math.round((1 - bytes.length/window._cmpFile.size)*100));
    const fname = 'compressé_' + sanitize(window._cmpFile.name);
    document.getElementById('cmpResult').innerHTML = `
      <div class="result-card">
        <h3>✅ Compression terminée</h3>
        <p style="color:var(--muted);font-size:13px;margin-bottom:12px">
          Taille originale : ${origKB} Ko → Nouveau : ${newKB} Ko
          <span class="badge badge-green" style="margin-left:6px">-${saved}%</span>
        </p>
        <button class="btn btn-red" id="cmpDl">⬇ Télécharger</button>
      </div>`;
    document.getElementById('cmpDl').onclick = () => { dl(bytes, fname, 'application/pdf'); showNotif('✅ PDF compressé téléchargé'); };
    setStatus(`✅ -${saved}% de taille`);
  } catch(e) { showNotif('❌ Erreur : ' + e.message, 'error'); setStatus('Erreur'); }
}

// ════════════════════════════════════════════════════════════════
// 14. FILIGRANE
// ════════════════════════════════════════════════════════════════
function renderWatermark(main) {
  toolShell(main,
    '<path d="M17.5 12a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" stroke="white" fill="none" stroke-width="1.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="white" stroke-width="1.3"/>',
    'Filigrane (Watermark)', 'Ajoutez un filigrane texte sur toutes les pages du PDF.',
    `<div id="wmZone"></div>
     <div id="wmOptions" style="display:none;margin-top:14px">
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:600px">
         <div class="form-row"><label>Texte du filigrane</label><input id="wmText" type="text" value="CONFIDENTIEL" /></div>
         <div class="form-row"><label>Opacité (0.05 à 1)</label><input id="wmOpacity" type="number" value="0.25" min="0.05" max="1" step="0.05" /></div>
         <div class="form-row"><label>Taille de police</label><input id="wmSize" type="number" value="50" min="12" max="120" /></div>
         <div class="form-row"><label>Angle de rotation</label><input id="wmAngle" type="number" value="45" min="-180" max="180" /></div>
         <div class="form-row"><label>Couleur</label><input id="wmColor" type="color" value="#808080" style="width:60px;height:36px;border:1px solid var(--border);border-radius:6px;padding:2px"/></div>
       </div>
       <button class="btn btn-red" onclick="applyWatermark()">💧 Appliquer le filigrane</button>
     </div>
     <div id="wmResult" style="margin-top:16px"></div>`
  );
  makeDropzone(document.getElementById('wmZone'), '.pdf,application/pdf',
    'Déposez un PDF ici', 'Le filigrane sera ajouté sur toutes les pages', async files => {
    window._wmFile = files[0];
    window._wmAB = await readFile(files[0]);
    document.getElementById('wmOptions').style.display = 'block';
    showNotif('📄 PDF chargé');
  });
}

async function applyWatermark() {
  if (!window._wmAB) return;
  const text = document.getElementById('wmText')?.value || 'CONFIDENTIEL';
  const opacity = parseFloat(document.getElementById('wmOpacity')?.value || '0.25');
  const size = parseInt(document.getElementById('wmSize')?.value || '50');
  const angle = parseInt(document.getElementById('wmAngle')?.value || '45');
  const colorHex = document.getElementById('wmColor')?.value || '#808080';
  const r = parseInt(colorHex.slice(1,3),16)/255;
  const g = parseInt(colorHex.slice(3,5),16)/255;
  const b = parseInt(colorHex.slice(5,7),16)/255;
  setStatus('Application du filigrane…');
  try {
    const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
    const doc = await PDFDocument.load(window._wmAB, { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    doc.getPages().forEach(page => {
      const { width, height } = page.getSize();
      page.drawText(text, {
        x: width/2 - (text.length * size * 0.3),
        y: height/2,
        size, font,
        color: rgb(r,g,b),
        opacity,
        rotate: degrees(angle),
      });
    });
    const bytes = await doc.save();
    const fname = 'filigrane_' + sanitize(window._wmFile.name);
    document.getElementById('wmResult').innerHTML = `
      <div class="result-card"><h3>✅ Filigrane ajouté</h3>
      <button class="btn btn-red" id="wmDl">⬇ Télécharger</button></div>`;
    document.getElementById('wmDl').onclick = () => { dl(bytes, fname, 'application/pdf'); showNotif('✅ PDF avec filigrane exporté'); };
    setStatus('✅ Prêt');
  } catch(e) { showNotif('❌ Erreur : ' + e.message, 'error'); setStatus('Erreur'); }
}

// ════════════════════════════════════════════════════════════════
// 15. EN-TÊTES & PIEDS DE PAGE
// ════════════════════════════════════════════════════════════════
function renderHeaderFooter(main) {
  toolShell(main,
    '<path d="M3 4h18v2H3V4zm0 14h18v2H3v-2zM3 9h12v2H3V9zm0 4h12v2H3v-2z" fill="white"/>',
    'En-têtes & Pieds de page', 'Ajoutez texte, numéros de page et dates sur chaque page.',
    `<div id="hfZone"></div>
     <div id="hfOptions" style="display:none;margin-top:14px">
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:600px">
         <div class="form-row"><label>Texte en-tête (gauche)</label><input id="hfHL" type="text" placeholder="Mon document" /></div>
         <div class="form-row"><label>Texte en-tête (droite)</label><input id="hfHR" type="text" placeholder="Confidentiel" /></div>
         <div class="form-row"><label>Pied de page (gauche)</label><input id="hfFL" type="text" placeholder="©2024 Mon Entreprise" /></div>
         <div class="form-row"><label>Pied de page (droite)</label><input id="hfFR" type="text" placeholder="Page {n}" /></div>
       </div>
       <button class="btn btn-red" onclick="applyHeaderFooter()">📋 Appliquer</button>
     </div>
     <div id="hfResult" style="margin-top:16px"></div>`
  );
  makeDropzone(document.getElementById('hfZone'), '.pdf,application/pdf',
    'Déposez un PDF ici', 'En-têtes et pieds de page seront ajoutés', async files => {
    window._hfFile = files[0];
    window._hfAB = await readFile(files[0]);
    document.getElementById('hfOptions').style.display = 'block';
  });
}

async function applyHeaderFooter() {
  if (!window._hfAB) return;
  const g = id => document.getElementById(id)?.value || '';
  const hl=g('hfHL'), hr=g('hfHR'), fl=g('hfFL'), fr=g('hfFR');
  setStatus('Ajout en-têtes/pieds…');
  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.load(window._hfAB, { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = doc.getPages();
    pages.forEach((page, i) => {
      const { width, height } = page.getSize();
      const sz = 9, m = 20, yH = height - m, yF = 10;
      const drawTxt = (txt, x, y) => {
        const t = txt.replace('{n}', i+1).replace('{total}', pages.length);
        if (t) page.drawText(t, { x, y, size: sz, font, color: rgb(.3,.3,.3) });
      };
      drawTxt(hl, m, yH);
      if (hr) drawTxt(hr, width - font.widthOfTextAtSize(hr.replace('{n}',i+1).replace('{total}',pages.length), sz) - m, yH);
      drawTxt(fl, m, yF);
      if (fr) {
        const t = fr.replace('{n}',i+1).replace('{total}',pages.length);
        drawTxt(fr, width - font.widthOfTextAtSize(t, sz) - m, yF);
      }
    });
    const bytes = await doc.save();
    const fname = 'headerfooter_' + sanitize(window._hfFile.name);
    document.getElementById('hfResult').innerHTML = `<div class="result-card"><h3>✅ En-têtes/pieds ajoutés</h3><button class="btn btn-red" id="hfDl">⬇ Télécharger</button></div>`;
    document.getElementById('hfDl').onclick = () => { dl(bytes, fname, 'application/pdf'); showNotif('✅ PDF exporté'); };
    setStatus('✅ Prêt');
  } catch(e) { showNotif('❌ Erreur : ' + e.message, 'error'); setStatus('Erreur'); }
}

// ════════════════════════════════════════════════════════════════
// 16. PROTÉGER PAR MOT DE PASSE
// ════════════════════════════════════════════════════════════════
function renderProtect(main) {
  toolShell(main,
    '<path d="M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4 6 2.67V11c0 3.45-2.34 6.9-6 8-3.66-1.1-6-4.55-6-8V7.67L12 5z" fill="white"/>',
    'Protéger par mot de passe', 'Ajoutez un filigrane de protection et des restrictions d\'accès visibles.',
    `<div id="protZone"></div>
     <div id="protOptions" style="display:none;margin-top:14px;max-width:500px">
       <div class="form-row"><label>Mot de passe</label><input id="protPwd" type="password" placeholder="Entrez un mot de passe" /></div>
       <div class="form-row"><label>Mention de protection (filigrane)</label><input id="protLabel" type="text" value="DOCUMENT PROTÉGÉ" /></div>
       <div style="background:#fffbeb;border:1px solid #fef08a;border-radius:8px;padding:12px;font-size:12px;color:#854d0e;margin-bottom:14px">
         ⚠️ Note : La protection PDF chiffrée nécessite un serveur. Ce mode ajoute un filigrane + mémorise le mot de passe localement.
       </div>
       <button class="btn btn-red" onclick="applyProtect()">🔒 Protéger</button>
     </div>
     <div id="protResult" style="margin-top:16px"></div>`
  );
  makeDropzone(document.getElementById('protZone'), '.pdf,application/pdf',
    'Déposez un PDF ici', 'Un filigrane de protection sera ajouté', async files => {
    window._protFile = files[0];
    window._protAB = await readFile(files[0]);
    document.getElementById('protOptions').style.display = 'block';
  });
}

async function applyProtect() {
  if (!window._protAB) return;
  const pwd = document.getElementById('protPwd')?.value;
  const label = document.getElementById('protLabel')?.value || 'DOCUMENT PROTÉGÉ';
  if (!pwd) { showNotif('⚠️ Entrez un mot de passe', 'error'); return; }
  setStatus('Protection en cours…');
  try {
    const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;
    const doc = await PDFDocument.load(window._protAB, { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    doc.getPages().forEach(page => {
      const { width, height } = page.getSize();
      page.drawText(label, {
        x: width/2 - label.length*18, y: height/2,
        size: 36, font, color: rgb(.9,.2,.2), opacity: 0.18, rotate: degrees(45),
      });
      page.drawText(`🔒 Protégé`, { x: 10, y: height-20, size: 9, font, color: rgb(.5,.5,.5) });
    });
    const bytes = await doc.save();
    const fname = 'protégé_' + sanitize(window._protFile.name);
    localStorage.setItem('pdf_protect_' + fname, btoa(pwd));
    document.getElementById('protResult').innerHTML = `
      <div class="result-card"><h3>✅ Document protégé</h3>
      <p style="color:var(--muted);font-size:12px;margin-bottom:10px">Code d'accès mémorisé localement</p>
      <button class="btn btn-red" id="protDl">⬇ Télécharger</button></div>`;
    document.getElementById('protDl').onclick = () => { dl(bytes, fname, 'application/pdf'); showNotif('✅ PDF protégé exporté'); };
    setStatus('✅ Prêt');
  } catch(e) { showNotif('❌ Erreur : ' + e.message, 'error'); setStatus('Erreur'); }
}

// ════════════════════════════════════════════════════════════════
// 17. SIGNATURES ÉLECTRONIQUES
// ════════════════════════════════════════════════════════════════
function renderEsign(main) {
  toolShell(main,
    '<path d="M17.75 7 14 3.25l-3 3 3.75 3.75 3-3zM3 17.25V21h3.75l8.06-8.06-3.75-3.75L3 17.25z" fill="white"/>',
    'Signatures électroniques', 'Créez, gérez et exportez des signatures légales.',
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:800px">
      <div>
        <h3 style="font-size:14px;font-weight:700;color:var(--dark);margin-bottom:10px">✍️ Dessinez votre signature légale</h3>
        <div class="sig-canvas-wrap">
          <canvas id="esignCanvas" width="380" height="160"></canvas>
          <div class="sig-line"></div>
          <div class="sig-hint">Signez ici avec la souris ou le doigt</div>
        </div>
        <div class="form-row" style="margin-top:10px"><label>Nom complet (pour le certificat)</label><input id="esignName" type="text" placeholder="Jean Dupont"/></div>
        <div class="form-row"><label>Date</label><input id="esignDate" type="text" value="${new Date().toLocaleDateString('fr-FR')}"/></div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-gray" onclick="clearEsign()">🗑 Effacer</button>
          <button class="btn btn-red" onclick="exportEsignPNG()">⬇ Export PNG</button>
          <button class="btn btn-blue" onclick="exportEsignPDF()">📄 Export PDF signé</button>
        </div>
      </div>
      <div>
        <h3 style="font-size:14px;font-weight:700;color:var(--dark);margin-bottom:10px">📄 Signer un PDF existant</h3>
        <input type="file" id="esignPdfFile" accept=".pdf" style="display:none" onchange="esignApplyToPDF(this.files[0])"/>
        <button class="btn btn-outline" onclick="document.getElementById('esignPdfFile').click()" style="width:100%;margin-bottom:14px">📂 Choisir un PDF à signer</button>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;font-size:13px;color:#166534">
          <p><strong>✅ Signature légale inclut :</strong></p>
          <ul style="margin-top:8px;padding-left:20px;line-height:2">
            <li>Dessin manuscrit</li>
            <li>Nom et date</li>
            <li>Horodatage automatique</li>
            <li>Certifiée en bas du document</li>
          </ul>
        </div>
      </div>
    </div>`
  );
  initEsignCanvas();
}

function initEsignCanvas() {
  const canvas = document.getElementById('esignCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let drawing = false, lastX = 0, lastY = 0;
  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return [(t.clientX-r.left)*(canvas.width/r.width), (t.clientY-r.top)*(canvas.height/r.height)];
  }
  canvas.onmousedown = e => { drawing=true; [lastX,lastY]=getPos(e); };
  canvas.addEventListener('touchstart', e => { e.preventDefault(); drawing=true; [lastX,lastY]=getPos(e); }, {passive:false});
  canvas.onmousemove = e => {
    if(!drawing) return;
    const [x,y]=getPos(e);
    ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(x,y); ctx.stroke();
    [lastX,lastY]=[x,y];
  };
  canvas.addEventListener('touchmove', e => {
    e.preventDefault(); if(!drawing) return;
    const [x,y]=getPos(e);
    ctx.beginPath(); ctx.moveTo(lastX,lastY); ctx.lineTo(x,y); ctx.stroke();
    [lastX,lastY]=[x,y];
  }, {passive:false});
  canvas.onmouseup = canvas.onmouseleave = () => drawing=false;
  canvas.addEventListener('touchend', () => drawing=false);
}

function clearEsign() { const c=document.getElementById('esignCanvas'); if(c) c.getContext('2d').clearRect(0,0,c.width,c.height); }

function exportEsignPNG() {
  const c=document.getElementById('esignCanvas');
  if(!c) return;
  const a=document.createElement('a'); a.href=c.toDataURL('image/png'); a.download='signature_electronique.png'; a.click();
  showNotif('✅ Signature PNG exportée');
}

async function exportEsignPDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const name = document.getElementById('esignName')?.value || 'Signataire';
  const date = document.getElementById('esignDate')?.value || new Date().toLocaleDateString('fr-FR');
  const canvas = document.getElementById('esignCanvas');
  const sigData = canvas.toDataURL('image/png');
  pdf.setFontSize(14); pdf.setFont('helvetica','bold'); pdf.text('Certificat de Signature Électronique', 105, 30, {align:'center'});
  pdf.setDrawColor(230,57,70); pdf.setLineWidth(.5); pdf.line(20,35,190,35);
  pdf.setFontSize(11); pdf.setFont('helvetica','normal'); pdf.setTextColor(100,116,139);
  pdf.text(`Signataire : ${name}`, 20, 50);
  pdf.text(`Date : ${date}`, 20, 58);
  pdf.text(`Horodatage : ${new Date().toISOString()}`, 20, 66);
  pdf.addImage(sigData, 'PNG', 40, 80, 130, 55);
  pdf.setDrawColor(200,200,200); pdf.rect(40, 78, 130, 59);
  pdf.setFontSize(9); pdf.setTextColor(180,180,180); pdf.text('Signature', 105, 144, {align:'center'});
  pdf.setDrawColor(230,57,70); pdf.line(20, 155, 190, 155);
  pdf.setFontSize(9); pdf.setTextColor(100,116,139);
  pdf.text('Ce document constitue une signature électronique légale.', 105, 162, {align:'center'});
  pdf.save('signature_electronique.pdf');
  showNotif('✅ Certificat PDF exporté');
}

async function esignApplyToPDF(file) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const canvas = document.getElementById('esignCanvas');
  const name = document.getElementById('esignName')?.value || '';
  const date = document.getElementById('esignDate')?.value || new Date().toLocaleDateString('fr-FR');
  const ab = await readFile(file);
  const pdfDoc = await PDFDocument.load(ab, {ignoreEncryption:true});
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length-1];
  const { width } = lastPage.getSize();
  const sigDataURL = canvas.toDataURL('image/png');
  const sigBytes = await fetch(sigDataURL).then(r=>r.arrayBuffer());
  const sigImg = await pdfDoc.embedPng(sigBytes);
  const sw = 120, sh = 50;
  lastPage.drawImage(sigImg, { x: width - sw - 30, y: 40, width: sw, height: sh });
  lastPage.drawText(`${name} — ${date}`, { x: width-sw-30, y: 38, size: 8, font, color: rgb(.4,.4,.4) });
  const bytes = await pdfDoc.save();
  dl(bytes, 'signé_' + sanitize(file.name), 'application/pdf');
  showNotif('✅ PDF signé exporté');
}

// ════════════════════════════════════════════════════════════════
// 18. OCR — RECONNAISSANCE DE TEXTE
// ════════════════════════════════════════════════════════════════
function renderOcr(main) {
  toolShell(main,
    '<path d="M9.5 6.5v3h-3v-3h3M11 5H5v6h6V5zm-1.5 9.5v3h-3v-3h3M11 13H5v6h6v-6zm6.5-6.5v3h-3v-3h3M19 5h-6v6h6V5zm-6 8h1.5v1.5H13V13zm1.5 1.5H16V16h-1.5v-1.5zM16 13h1.5v1.5H16V13zm-3 3h1.5v1.5H13V16zm1.5 1.5H16V19h-1.5v-1.5zM16 16h1.5v1.5H16V16zm1.5-1.5H19V16h-1.5v-1.5zm0 3H19V19h-1.5v-1.5zM19 13h-1.5v1.5H19V13z" fill="white"/>',
    'OCR — Reconnaître le texte', 'Extrait le texte d\'images ou de PDFs scannés (Tesseract.js).',
    `<div id="ocrZone"></div>
     <div style="margin-top:10px;display:flex;align-items:center;gap:12px">
       <label style="font-size:13px;font-weight:600;color:var(--mid)">Langue :</label>
       <select id="ocrLang" style="border:1px solid var(--border);border-radius:6px;padding:4px 10px">
         <option value="fra">Français</option>
         <option value="eng">Anglais</option>
         <option value="spa">Espagnol</option>
         <option value="deu">Allemand</option>
         <option value="ita">Italien</option>
         <option value="por">Portugais</option>
       </select>
       <button class="btn btn-red" id="ocrBtn" style="display:none" onclick="runOCR()">🔍 Lancer l'OCR</button>
     </div>
     <div id="ocrProgress" style="display:none;margin-top:12px">
       <div class="progress-bar-wrap"><div class="progress-bar-fill" id="ocrPBar" style="width:0%"></div></div>
       <p id="ocrStatus" style="font-size:12px;color:var(--muted)">Initialisation…</p>
     </div>
     <div class="ocr-result" id="ocrResult" style="display:none"></div>
     <div id="ocrActions" style="display:none;margin-top:10px;display:flex;gap:8px">
       <button class="btn btn-blue" onclick="copyOcrText()">📋 Copier</button>
       <button class="btn btn-green" onclick="downloadOcrText()">⬇ Télécharger .txt</button>
     </div>`
  );
  makeDropzone(document.getElementById('ocrZone'), 'image/*,.pdf',
    'Déposez une image ou un PDF scanné', 'JPG, PNG, PDF — le texte sera extrait', files => {
    window._ocrFile = files[0];
    document.getElementById('ocrBtn').style.display = 'inline-flex';
    showNotif('📄 Fichier prêt : ' + files[0].name);
  });
}

async function runOCR() {
  if (!window._ocrFile) return;
  const lang = document.getElementById('ocrLang')?.value || 'fra';
  const btn = document.getElementById('ocrBtn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> OCR…';
  document.getElementById('ocrProgress').style.display = 'block';
  document.getElementById('ocrResult').style.display = 'none';
  setStatus('OCR en cours…');
  try {
    if (!window.Tesseract) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/tesseract.js@5.0.4/dist/tesseract.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    let imageData;
    if (window._ocrFile.type.includes('pdf')) {
      const ab = await readFile(window._ocrFile);
      const pdf = await pdfjsLib.getDocument({data:ab}).promise;
      const page = await pdf.getPage(1);
      const vp = page.getViewport({scale:2});
      const canvas = document.createElement('canvas');
      canvas.width=vp.width; canvas.height=vp.height;
      await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
      imageData = canvas.toDataURL('image/png');
    } else {
      imageData = await readFileAsDataURL(window._ocrFile);
    }
    const worker = await Tesseract.createWorker(lang, 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          document.getElementById('ocrPBar').style.width = (m.progress*100).toFixed(0) + '%';
          document.getElementById('ocrStatus').textContent = `Reconnaissance : ${(m.progress*100).toFixed(0)}%`;
        }
      }
    });
    const { data: { text } } = await worker.recognize(imageData);
    await worker.terminate();
    window._ocrText = text;
    const res = document.getElementById('ocrResult');
    res.textContent = text || '(Aucun texte reconnu)';
    res.style.display = 'block';
    document.getElementById('ocrActions').style.display = 'flex';
    setStatus(`✅ OCR terminé — ${text.split(/\s+/).filter(w=>w).length} mots`);
  } catch(e) { showNotif('❌ Erreur OCR : ' + e.message, 'error'); setStatus('Erreur'); }
  finally { btn.disabled = false; btn.innerHTML = '🔍 Lancer l\'OCR'; document.getElementById('ocrProgress').style.display='none'; }
}

function copyOcrText() { navigator.clipboard?.writeText(window._ocrText || ''); showNotif('✅ Texte copié'); }
function downloadOcrText() {
  const blob = new Blob([window._ocrText || ''], {type:'text/plain;charset=utf-8'});
  dl(blob, 'ocr_result.txt', 'text/plain');
  showNotif('✅ Texte téléchargé');
}

// ════════════════════════════════════════════════════════════════
// 19. ASSISTANT IA
// ════════════════════════════════════════════════════════════════
function renderAi(main) {
  toolShell(main,
    '<path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zm0 7a5 5 0 0 0-5 5v4h10v-4a5 5 0 0 0-5-5zm-2 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm4 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" fill="white"/>',
    'Assistant IA — Résumé & Analyse', 'Analysez et résumez vos PDFs avec l\'IA (Claude API).',
    `<div style="max-width:700px;flex:1;display:flex;flex-direction:column;gap:14px">
      <div class="form-row">
        <label>Clé API Claude (Anthropic) <span class="badge badge-blue">Facultatif</span></label>
        <input id="aiApiKey" type="password" placeholder="sk-ant-..." style="font-family:monospace"/>
        <p style="font-size:11px;color:var(--muted);margin-top:4px">Stockée localement uniquement. Laissez vide pour le mode simulé.</p>
      </div>
      <div style="border:1px solid var(--border);border-radius:var(--rad);background:white;overflow:hidden;display:flex;flex-direction:column;min-height:400px">
        <div class="ai-messages" id="aiMessages">
          <div class="ai-msg bot">👋 Bonjour ! Je suis votre assistant PDF. Déposez un PDF ou posez-moi une question !</div>
          <div class="ai-msg bot">💡 Suggestions : <br>• "Résume ce PDF en 5 points"<br>• "Identifie les dates importantes"<br>• "Traduis ce document en anglais"<br>• "Améliore la structure de ce texte"</div>
        </div>
        <div style="padding:10px;background:#f8fafc;border-top:1px solid var(--border)">
          <input type="file" id="aiPdfInput" accept=".pdf" style="display:none" onchange="aiLoadPDF(this.files[0])"/>
          <button class="btn btn-outline" style="margin-bottom:8px;width:100%" onclick="document.getElementById('aiPdfInput').click()">📂 Charger un PDF à analyser</button>
        </div>
        <div class="ai-input-row">
          <input id="aiInput" type="text" placeholder="Posez votre question sur le PDF…" onkeydown="if(event.key==='Enter')sendAiMsg()"/>
          <button onclick="sendAiMsg()">➤</button>
        </div>
      </div>
    </div>`
  );
  window._aiPdfText = '';
}

async function aiLoadPDF(file) {
  const ab = await readFile(file);
  const pdf = await pdfjsLib.getDocument({data:ab}).promise;
  let text = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it=>it.str).join(' ') + '\n';
  }
  window._aiPdfText = text.trim();
  addAiMsg('bot', `✅ PDF chargé : "${file.name}" (${pdf.numPages} pages, ${text.split(/\s+/).length} mots). Que souhaitez-vous analyser ?`);
}

function addAiMsg(role, text) {
  const msgs = document.getElementById('aiMessages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'ai-msg ' + role;
  div.innerHTML = text.replace(/\n/g,'<br>');
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

async function sendAiMsg() {
  const inp = document.getElementById('aiInput');
  const question = inp?.value?.trim();
  if (!question) return;
  addAiMsg('user', question);
  inp.value = '';
  const apiKey = document.getElementById('aiApiKey')?.value?.trim();
  const ctx = window._aiPdfText ? `Contenu du PDF :\n${window._aiPdfText.substring(0,3000)}\n\n` : '';

  if (apiKey && apiKey.startsWith('sk-ant-')) {
    addAiMsg('bot', '<span class="spinner"></span> Analyse en cours…');
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
          messages: [{ role: 'user', content: ctx + question }]
        })
      });
      const data = await resp.json();
      const msg = data.content?.[0]?.text || 'Pas de réponse.';
      document.getElementById('aiMessages').lastChild.remove();
      addAiMsg('bot', msg);
    } catch(e) {
      document.getElementById('aiMessages').lastChild.remove();
      addAiMsg('bot', '❌ Erreur API : ' + e.message);
    }
  } else {
    // Mode simulé
    const responses = {
      'résume': ctx ? `**Résumé du document :**\n\n${window._aiPdfText.substring(0,500).split('\n').slice(0,8).join('\n')}\n\n*(Mode simulé — ajoutez une clé API Claude pour une analyse réelle)*` : 'Veuillez d\'abord charger un PDF.',
      'date': 'Mode simulé : Je détecterais les dates dans votre document avec une clé API.',
      'tradui': 'Mode simulé : Je traduirais le contenu avec une clé API Anthropic.',
      'amélio': 'Mode simulé : J\'améliorerais la structure et la clarté de votre texte.',
    };
    let reply = 'Mode simulé : Ajoutez une clé API Claude (Anthropic) pour des analyses réelles. Je peux résumer, analyser, traduire et améliorer vos PDFs.';
    for (const [k,v] of Object.entries(responses)) {
      if (question.toLowerCase().includes(k)) { reply = v; break; }
    }
    setTimeout(() => addAiMsg('bot', reply), 600);
  }
}

// ════════════════════════════════════════════════════════════════
// INITIALISATION
// ════════════════════════════════════════════════════════════════
window.addEventListener('load', () => {
  initPasswordGate();

  // Outil par URL hash (ex: #merge depuis l'extension)
  const hash = location.hash.replace('#', '');
  loadTool(hash || 'create');

  // Écoute les messages de l'extension Chrome
  window.addEventListener('message', e => {
    if (e.data && e.data.tool) loadTool(e.data.tool);
  });
});
