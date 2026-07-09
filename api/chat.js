const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '02-intermediate-projects', 'waxing-agentic-ai');

function sendFile(res, relativePath, contentType) {
  const absolutePath = path.join(PROJECT_ROOT, relativePath);
  fs.readFile(absolutePath, (error, data) => {
    if (error) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', contentType);
    res.end(data);
  });
}

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

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/') {
    return sendFile(res, 'index.html', 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && pathname === '/styles.css') {
    return sendFile(res, 'styles.css', 'text/css; charset=utf-8');
  }

  if (req.method === 'GET' && pathname === '/script.js') {
    return sendFile(res, 'script.js', 'application/javascript; charset=utf-8');
  }

  if (req.method === 'POST' && (pathname === '/api/chat' || pathname === '/chat')) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        const message = parsed.message || '';
        const prompt = `You are a polished beauty booking assistant for a waxing salon. Help the user book or plan an appointment with short, friendly, practical guidance. Prefer specific recommendations, ask one clarifying question if needed, and keep replies to 1-3 sentences. User asks: ${message}`;

        if (!process.env.OPENROUTER_API_KEY) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ reply: getFallbackReply(message) }));
          return;
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/swati-ai-lead/projects',
            'X-Title': 'Waxing Agentic AI'
          },
          body: JSON.stringify({
            model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }]
          })
        });

        const data = await response.json();
        const reply = data?.choices?.[0]?.message?.content || 'I can help you book a waxing appointment.';
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ reply }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ reply: 'I am having trouble reaching the assistant right now. Please try again in a moment.' }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
};
