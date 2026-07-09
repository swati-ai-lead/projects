const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const calendarGrid = document.getElementById('calendarGrid');
const bookingSummary = document.getElementById('bookingSummary');

const services = ['full body', 'brazilian', 'bikini', 'laser', 'single part'];
const baseDate = new Date(2026, 6, 14);
const dates = Array.from({ length: 5 }, (_, index) => {
  const date = new Date(baseDate);
  date.setDate(baseDate.getDate() + index);
  return {
    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    slots: index % 2 === 0 ? '2 slots' : '1 slot'
  };
});

let selectedService = 'full body';
let selectedDate = dates[0].date;

function addMessage(text, sender = 'bot') {
  const message = document.createElement('div');
  message.className = `message ${sender}`;
  message.textContent = text;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderCalendar() {
  calendarGrid.innerHTML = '';
  dates.forEach((entry) => {
    const card = document.createElement('button');
    card.className = `day-card ${entry.date === selectedDate ? 'active' : ''}`;
    card.innerHTML = `<strong>${entry.day}</strong><small>${entry.date}</small><small>${entry.slots}</small>`;
    card.addEventListener('click', () => {
      selectedDate = entry.date;
      renderCalendar();
      updateSummary();
    });
    calendarGrid.appendChild(card);
  });
}

function updateSummary() {
  bookingSummary.textContent = `You selected ${selectedService} for ${selectedDate}. A confirmation message will be sent shortly.`;
}

async function respondToInput(text) {
  addMessage('Thinking...', 'bot');
  try {
    const response = await fetch('http://localhost:3000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await response.json();
    const reply = data.reply || 'I can help you book your next appointment.';
    chatMessages.lastChild.remove();
    addMessage(reply, 'bot');
  } catch (error) {
    chatMessages.lastChild.remove();
    addMessage('I’m having trouble reaching the assistant right now. Please try again shortly.', 'bot');
  }
  updateSummary();
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  chatInput.value = '';
  await respondToInput(text);
});

renderCalendar();
updateSummary();
addMessage('Hi! I can help you book a waxing session. Try saying full body, Brazilian, bikini, laser, or choose a date.', 'bot');
