const { Document, Packer, Paragraph, TextRun } = require('docx');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { html, title } = JSON.parse(event.body || '{}');

    const lines = stripHtml(html || '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const paragraphs = lines.length > 0
      ? lines.map(line => new Paragraph({ children: [new TextRun({ text: line, size: 24 })] }))
      : [new Paragraph({ children: [new TextRun({ text: ' ', size: 24 })] })];

    const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
    const buffer = await Packer.toBuffer(doc);
    const base64 = buffer.toString('base64');

    const filename = sanitize(title || 'document') + '.docx';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Transfer-Encoding': 'base64'
      },
      body: base64,
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

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
