const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const serverless = require('serverless-http');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

function sendFile(res, filePath, contentType) {
  const absolutePath = path.join(__dirname, '..', filePath);
  fs.readFile(absolutePath, (error, data) => {
    if (error) {
      return res.status(404).send('Not found');
    }
    res.type(contentType).send(data);
  });
}

function getFallbackReply(message) {
  const text = message.toLowerCase();

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

app.get('/', (req, res) => {
  sendFile(res, 'index.html', 'html');
});

app.get('/styles.css', (req, res) => {
  sendFile(res, 'styles.css', 'css');
});

app.get('/script.js', (req, res) => {
  sendFile(res, 'script.js', 'js');
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  const prompt = `You are a polished beauty booking assistant for a waxing salon. Help the user book or plan an appointment with short, friendly, practical guidance. Prefer specific recommendations, ask one clarifying question if needed, and keep replies to 1-3 sentences. User asks: ${message}`;

  if (!process.env.OPENROUTER_API_KEY) {
    return res.json({ reply: getFallbackReply(message) });
  }

  try {
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
    return res.json({ reply });
  } catch (error) {
    return res.status(500).json({ reply: 'I am having trouble reaching the assistant right now. Please try again in a moment.' });
  }
});

module.exports = serverless(app);
