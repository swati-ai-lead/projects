const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const calendarGrid = document.getElementById('calendarGrid');
const bookingSummary = document.getElementById('bookingSummary');

const services = ['full body', 'brazilian', 'bikini', 'laser', 'single part'];
const dates = [
  { day: 'Mon', date: 'Jul 14', slots: '2 slots' },
  { day: 'Tue', date: 'Jul 15', slots: '1 slot' },
  { day: 'Wed', date: 'Jul 16', slots: '3 slots' },
  { day: 'Thu', date: 'Jul 17', slots: '2 slots' },
  { day: 'Fri', date: 'Jul 18', slots: '4 slots' }
];

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
  dates.forEach((entry, index) => {
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

function respondToInput(text) {
  const lower = text.toLowerCase();
  if (services.some(service => lower.includes(service))) {
    selectedService = lower.includes('laser') ? 'laser treatment' : lower.includes('brazilian') ? 'brazilian wax' : lower.includes('bikini') ? 'bikini wax' : lower.includes('single') ? 'single-part service' : 'full body wax';
    addMessage(`Perfect — I can help you book a ${selectedService}. Choose a date from the calendar.`, 'bot');
  } else if (/(next|tomorrow|today|jul|mon|tue|wed|thu|fri)/i.test(lower)) {
    addMessage(`I’ve marked ${selectedDate} as your preferred date. I’ll keep the ${selectedService} appointment ready.`, 'bot');
  } else {
    addMessage('I can help with full body, bikini, Brazilian, laser, or single-part appointments. Tell me what you want and a date.', 'bot');
  }
  updateSummary();
}

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  chatInput.value = '';
  setTimeout(() => respondToInput(text), 450);
});

renderCalendar();
updateSummary();
addMessage('Hi! I can help you book a waxing session. Try saying full body, Brazilian, bikini, laser, or choose a date.', 'bot');
