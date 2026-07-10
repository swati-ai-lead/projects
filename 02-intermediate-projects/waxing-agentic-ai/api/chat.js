const https = require('https');
require('dotenv').config();

function getFallbackReply(message) {
  const text = (message || '').toLowerCase();

  if (text.includes('brazilian') || text.includes('bikini')) {
    return 'I can help with a Brazilian or bikini wax. The next openings are Thursday at 2 PM and Friday at 4 PM.';
  }

  if (text.includes('laser')) {
    return 'Laser appointments are available for consultation. I can help you choose a suitable date.';
  }

  if (text.includes('full body')) {
    return 'A full body waxing session is available this week. I can help you pick the best time slot.';
  }

  if (text.includes('date') || text.includes('when') || text.includes('slot')) {
    return 'We currently have openings on Monday, Wednesday, and Friday this week. I can help you choose one.';
  }

  return 'I can help you book a waxing appointment. Tell me your preferred service or date and I will guide you.';
}

async function getModelReply(prompt, timeoutMs) {
  const payload = JSON.stringify({
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    max_tokens: 180,
    messages: [{ role: 'user', content: prompt }]
  });

  return new Promise((resolve) => {
    let completed = false;
    const finish = (value) => {
      if (!completed) {
        completed = true;
        resolve(value);
      }
    };

    const request = https.request(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'HTTP-Referer': 'https://github.com/swati-ai-lead/projects',
          'X-Title': 'Waxing Agentic AI'
        }
      },
      (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            return finish(null);
          }

          try {
            const data = JSON.parse(raw);
            return finish(data?.choices?.[0]?.message?.content || null);
          } catch (error) {
            return finish(null);
          }
        });
      }
    );

    request.on('error', () => finish(null));
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      finish(null);
    });

    request.write(payload);
    request.end();
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      const message = parsed.message;

      if (!message) {
        sendJson(res, 400, { error: 'Message is required.' });
        return;
      }

      const prompt = `You are a polished beauty booking assistant for a waxing salon. Help the user book or plan an appointment with short, friendly, practical guidance. Prefer specific recommendations, ask one clarifying question if needed, and keep replies to 1-3 sentences. User asks: ${message}`;

      if (!process.env.OPENROUTER_API_KEY) {
        sendJson(res, 200, { reply: getFallbackReply(message) });
        return;
      }

      const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 5000);
      const reply = await getModelReply(prompt, timeoutMs);
      sendJson(res, 200, { reply: reply || getFallbackReply(message) });
    } catch (error) {
      sendJson(res, 200, { reply: getFallbackReply('') });
    }
  });
};
