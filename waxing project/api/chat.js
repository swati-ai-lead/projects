const fs = require('fs');
const https = require('https');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.js') return 'application/javascript; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'text/plain; charset=utf-8';
}

function sendFile(res, relativePath) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  fs.readFile(absolutePath, (error, data) => {
    if (error) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', getContentType(absolutePath));
    res.end(data);
  });
}

function sendStaticPath(res, pathname) {
  const normalized = decodeURIComponent(pathname)
    .replace(/^\/projects\//, '')
    .replace(/^\//, '');

  const candidatePath = normalized || 'index.html';
  const filePath = path.join(REPO_ROOT, candidatePath);

  if (!filePath.startsWith(REPO_ROOT)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) {
      sendFile(res, candidatePath);
      return;
    }

    const indexCandidate = path.join(candidatePath, 'index.html');
    const indexPath = path.join(REPO_ROOT, indexCandidate);

    if (!indexPath.startsWith(REPO_ROOT)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    fs.stat(indexPath, (indexError, indexStats) => {
      if (!indexError && indexStats.isFile()) {
        sendFile(res, indexCandidate);
        return;
      }

      res.statusCode = 404;
      res.end('Not found');
    });
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

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (req.method === 'GET') {
    sendStaticPath(res, pathname);
    return;
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

        const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || 5000);
        const reply = await getModelReply(prompt, timeoutMs);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ reply: reply || getFallbackReply(message) }));
      } catch (error) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ reply: getFallbackReply('') }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end('Not found');
};
