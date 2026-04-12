const mammoth = require('mammoth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { docxBase64, filename } = JSON.parse(event.body || '{}');

    if (!docxBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Champ docxBase64 manquant' }) };
    }

    const buffer = Buffer.from(docxBase64, 'base64');
    const result = await mammoth.convertToHtml({ buffer });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html: result.value,
        messages: result.messages,
        filename: filename || 'document'
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
