// ========== FORMAT ==========
function fmt(command) {
  document.execCommand(command, false, null);
  document.getElementById('editor').focus();
}

// Taille de police
document.getElementById('fontSize').addEventListener('change', function () {
  const size = this.value;
  const sel = window.getSelection();
  if (sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) {
    document.execCommand('fontSize', false, '7');
    document.querySelectorAll('font[size="7"]').forEach(el => {
      el.removeAttribute('size');
      el.style.fontSize = size;
    });
  } else {
    document.getElementById('editor').style.fontSize = size;
  }
  document.getElementById('editor').focus();
});

// Police
document.getElementById('fontFamily').addEventListener('change', function () {
  document.execCommand('fontName', false, this.value);
  document.getElementById('editor').focus();
});

// Couleur texte
document.getElementById('fontColor').addEventListener('input', function () {
  document.execCommand('foreColor', false, this.value);
});

// Surlignage
document.getElementById('bgColor').addEventListener('input', function () {
  document.execCommand('hiliteColor', false, this.value);
});

// Titres
document.getElementById('headingLevel').addEventListener('change', function () {
  document.execCommand('formatBlock', false, this.value);
  document.getElementById('editor').focus();
});

// ========== COMPTEUR DE MOTS ==========
const editor = document.getElementById('editor');
editor.addEventListener('input', updateCount);

function updateCount() {
  const text = editor.innerText.trim();
  const words = text ? text.split(/\s+/).filter(w => w.length > 0).length : 0;
  const chars = text.length;
  document.getElementById('wordCount').textContent = words + ' mot' + (words !== 1 ? 's' : '');
  document.getElementById('charCount').textContent = chars + ' caractère' + (chars !== 1 ? 's' : '');
}

// ========== NOTIFICATION ==========
let notifTimer;
function showNotif(msg, type = 'success') {
  clearTimeout(notifTimer);
  const n = document.getElementById('notification');
  n.innerHTML = msg;
  n.className = 'notification ' + (type === 'error' ? 'error' : type === 'info' ? 'info' : '');
  notifTimer = setTimeout(() => { n.className = 'notification hidden'; }, 5000);
}

function setBtn(id, loading, originalHTML) {
  const btn = document.getElementById(id);
  if (loading) {
    btn._originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> En cours...';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._originalHTML || originalHTML;
    btn.disabled = false;
  }
}

// ========== EXPORT PDF ==========
async function exportPDF() {
  if (!editor.innerText.trim()) {
    showNotif('⚠️ Le document est vide.', 'error');
    return;
  }

  setBtn('btnPDF', true);
  showNotif('<span class="spinner"></span> Génération du PDF...', 'info');

  try {
    const title = document.getElementById('docTitle').value.trim() || 'document';
    const { jsPDF } = window.jspdf;

    // Cloner l'éditeur dans un conteneur de largeur A4 fixe
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:fixed', 'top:-99999px', 'left:0',
      'width:794px',   // ~A4 à 96dpi
      'padding:60px 70px',
      'background:#fff',
      'font-family:Arial,sans-serif',
      'font-size:13px',
      'line-height:1.7',
      'color:#000'
    ].join(';');
    wrap.innerHTML = editor.innerHTML;
    document.body.appendChild(wrap);

    const canvas = await html2canvas(wrap, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    document.body.removeChild(wrap);

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdfW = 210, pdfH = 297;
    const margin = 15;
    const contentW = pdfW - margin * 2;
    const contentH = pdfH - margin * 2;
    const totalImgH = (canvas.height / canvas.width) * contentW;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let yOff = 0;

    while (yOff < totalImgH) {
      if (yOff > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, margin - (yOff), contentW, totalImgH);
      yOff += contentH;
    }

    const filename = sanitize(title) + '.pdf';
    pdf.save(filename);
    showNotif('✅ PDF téléchargé : ' + filename);
  } catch (err) {
    showNotif('❌ Erreur PDF : ' + err.message, 'error');
  } finally {
    setBtn('btnPDF', false);
  }
}

// ========== EXPORT WORD ==========
async function exportWord() {
  if (!editor.innerText.trim()) {
    showNotif('⚠️ Le document est vide.', 'error');
    return;
  }

  setBtn('btnWord', true);
  showNotif('<span class="spinner"></span> Génération du Word...', 'info');

  try {
    const title = document.getElementById('docTitle').value.trim() || 'document';
    const res = await fetch('/api/export-word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: editor.innerHTML, title })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur serveur' }));
      throw new Error(err.error || 'Erreur ' + res.status);
    }

    const blob = await res.blob();
    const filename = sanitize(title) + '.docx';
    triggerDownload(blob, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    showNotif('✅ Word téléchargé : ' + filename);
  } catch (err) {
    showNotif('❌ Erreur Word : ' + err.message, 'error');
  } finally {
    setBtn('btnWord', false);
  }
}

// ========== TÉLÉCHARGEMENT ==========
function triggerDownload(blob, filename, type) {
  const url = URL.createObjectURL(new Blob([blob], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// ========== UTILITAIRES ==========
function sanitize(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 80) || 'document';
}

// ========== RACCOURCIS CLAVIER ==========
document.addEventListener('keydown', function (e) {
  if (e.ctrlKey && !e.altKey) {
    if (e.key === 'p') { e.preventDefault(); exportPDF(); }
    if (e.key === 'w') { e.preventDefault(); exportWord(); }
  }
});

// ========== CHARGEMENT FICHIER (Ouvrir avec) ==========
async function loadFileIfProvided() {
  try {
    const res = await fetch('/api/open-file');
    if (!res.ok) return;
    const data = await res.json();
    if (data.content) {
      editor.innerHTML = data.content;
      if (data.title) document.getElementById('docTitle').value = data.title;
      updateCount();
      showNotif('📂 Fichier ouvert : ' + data.title);
    }
  } catch (e) {
    // Pas de fichier à ouvrir, ignorer
  }
}

// ========== INIT ==========
window.addEventListener('load', () => {
  editor.focus();
  updateCount();
  loadFileIfProvided();
});
