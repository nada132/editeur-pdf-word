const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = 3456;

// Fichier à ouvrir passé en argument : node server.js "C:\path\to\file.docx"
const fileToOpen = process.argv[2] || process.env.OPEN_FILE || null;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- Ouvrir un fichier .docx existant ----
app.get('/api/open-file', async (_req, res) => {
  if (!fileToOpen) return res.json({ content: null, title: null });

  try {
    if (!fs.existsSync(fileToOpen)) {
      return res.status(404).json({ error: 'Fichier introuvable : ' + fileToOpen });
    }

    const mammoth = require('mammoth');
    const result = await mammoth.convertToHtml({ path: fileToOpen });
    const title = path.basename(fileToOpen, path.extname(fileToOpen));

    res.json({ content: result.value, title });
  } catch (err) {
    console.error('Open file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Lire / convertir un DOCX uploadé en HTML ----
app.post('/api/read-docx', async (req, res) => {
  try {
    const { docxBase64, filename } = req.body;
    if (!docxBase64) return res.status(400).json({ error: 'Champ docxBase64 manquant' });

    const mammoth = require('mammoth');
    const buffer = Buffer.from(docxBase64, 'base64');
    const result = await mammoth.convertToHtml({ buffer });

    res.json({ html: result.value, messages: result.messages, filename: filename || 'document' });
  } catch (err) {
    console.error('Read DOCX error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Export Word (.docx) ----
app.post('/api/export-word', async (req, res) => {
  try {
    const { html, title } = req.body;
    const { Document, Packer, Paragraph, TextRun } = require('docx');

    const lines = stripHtml(html)
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const paragraphs = lines.length > 0
      ? lines.map(line => new Paragraph({ children: [new TextRun({ text: line, size: 24 })] }))
      : [new Paragraph({ children: [new TextRun({ text: ' ', size: 24 })] })];

    const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
    const buffer = await Packer.toBuffer(doc);

    const filename = sanitize(title || 'document') + '.docx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Word error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Chemins possibles pour Edge/Chrome sur Windows
const BROWSER_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function findBrowser() {
  for (const p of BROWSER_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ---- Export PDF via Puppeteer / Edge ----
app.post('/api/export-pdf', async (req, res) => {
  try {
    const { html, title } = req.body;

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.7; color: #000; margin: 0; padding: 18mm 20mm; }
  h1 { font-size: 22pt; font-weight: 700; margin: 0 0 14px; }
  h2 { font-size: 16pt; font-weight: 600; margin: 12px 0 8px; }
  h3 { font-size: 13pt; font-weight: 600; margin: 10px 0 6px; }
  p { margin: 0 0 8px; }
  ul, ol { padding-left: 24px; margin: 0 0 8px; }
  li { margin-bottom: 3px; }
</style>
</head>
<body>
  ${title ? `<h1>${escapeHtml(title)}</h1>` : ''}
  ${html}
</body>
</html>`;

    let browser;
    const edgePath = findBrowser();

    try {
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      });
    } catch (e) {
      if (edgePath) {
        const puppeteer = require('puppeteer-core');
        browser = await puppeteer.launch({
          executablePath: edgePath,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        });
      } else {
        throw new Error('Aucun navigateur disponible pour générer le PDF.');
      }
    }

    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    await browser.close();

    const filename = sanitize(title || 'document') + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helpers
function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function sanitize(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 80) || 'document';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Démarrer le serveur
app.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n✅ Editeur démarré sur ${url}`);
  if (fileToOpen) console.log(`   Fichier : ${fileToOpen}`);
  console.log('');

  if (process.platform === 'win32') {
    exec(`start ${url}`);
  } else if (process.platform === 'darwin') {
    exec(`open ${url}`);
  } else {
    exec(`xdg-open ${url}`);
  }
});
