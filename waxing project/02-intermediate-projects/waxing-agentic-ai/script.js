const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const calendarGrid = document.getElementById('calendarGrid');
const bookingSummary = document.getElementById('bookingSummary');
const slotGrid = document.getElementById('slotGrid');
const selectedMonthLabel = document.getElementById('selectedMonthLabel');
const servicePicker = document.getElementById('servicePicker');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');

const services = [
  { name: 'Full body wax', slug: 'full body', duration: '60 min', price: '$95', keywords: ['full body', 'full-body', 'fullbody'] },
  { name: 'Brazilian wax', slug: 'brazilian', duration: '45 min', price: '$75', keywords: ['brazilian', 'brazilian wax'] },
  { name: 'Bikini wax', slug: 'bikini', duration: '30 min', price: '$55', keywords: ['bikini', 'bikini wax'] },
  { name: 'Laser touch-up', slug: 'laser', duration: '20 min', price: '$60', keywords: ['laser', 'laser touch-up', 'touch-up'] },
  { name: 'Single part', slug: 'single part', duration: '25 min', price: '$40', keywords: ['single part', 'underarm', 'single'] }
];

const serviceTimeMap = {
  'Full body wax': ['9:00 AM', '10:30 AM', '12:00 PM', '2:00 PM', '3:30 PM', '5:00 PM'],
  'Brazilian wax': ['9:30 AM', '11:00 AM', '1:00 PM', '2:30 PM', '4:00 PM', '6:00 PM'],
  'Bikini wax': ['8:30 AM', '10:00 AM', '12:30 PM', '2:00 PM', '4:00 PM', '5:30 PM'],
  'Laser touch-up': ['9:00 AM', '11:30 AM', '2:00 PM', '4:30 PM'],
  'Single part': ['10:00 AM', '11:30 AM', '1:30 PM', '3:30 PM', '6:00 PM']
};

const today = new Date();
today.setHours(0, 0, 0, 0);

let currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedService = services[0];
let selectedDate = getNextAvailableDate();
let selectedTime = null;

const CHAT_API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api/chat'
  : 'https://projects-vt6a.vercel.app/api/chat';

function getNextAvailableDate(referenceDate = today) {
  const startDate = new Date(referenceDate);
  startDate.setHours(0, 0, 0, 0);

  for (let offset = 0; offset <= 45; offset += 1) {
    const candidate = new Date(startDate);
    candidate.setDate(startDate.getDate() + offset);
    if (candidate.getDay() !== 0 && candidate.getDay() !== 6) {
      return candidate;
    }
  }

  const fallback = new Date(startDate);
  fallback.setDate(startDate.getDate() + 1);
  return fallback;
}

function formatDateLong(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function formatDateShort(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function getAvailabilityLabel(date) {
  const slots = getAvailableSlots(date);
  return slots.length > 0 ? `${slots.length} slots` : 'Booked';
}

function getAvailableSlots(date) {
  const filteredSlots = serviceTimeMap[selectedService.name] || serviceTimeMap['Full body wax'];
  const offset = date.getDay();
  return filteredSlots.filter((_, index) => (index + offset) % 2 !== 0 || selectedService.slug === 'laser');
}

function addMessage(text, sender = 'bot') {
  const message = document.createElement('div');
  message.className = `message ${sender}`;
  message.textContent = text;
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderServicePicker() {
  servicePicker.innerHTML = '';
  services.forEach((service) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `service-option ${service.name === selectedService.name ? 'active' : ''}`;
    button.textContent = `${service.name} · ${service.price}`;
    button.addEventListener('click', () => {
      selectedService = service;
      selectedTime = null;
      renderServicePicker();
      renderTimeSlots();
      updateSummary();
    });
    servicePicker.appendChild(button);
  });
}

function renderCalendar() {
  calendarGrid.innerHTML = '';
  selectedMonthLabel.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(currentMonth);

  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const totalCells = 42;

  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - startOffset + 1;
    const cellDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNumber);
    const isCurrentMonth = cellDate.getMonth() === currentMonth.getMonth();
    const isSelectable = isCurrentMonth && cellDate >= today;

    const card = document.createElement('button');
    card.type = 'button';
    card.className = `day-card ${isCurrentMonth ? '' : 'outside'} ${cellDate.getTime() === selectedDate.getTime() ? 'active' : ''} ${!isSelectable ? 'disabled' : ''}`;
    card.disabled = !isSelectable;
    card.innerHTML = `
      <span class="day-number">${cellDate.getDate()}</span>
      <small>${isSelectable ? getAvailabilityLabel(cellDate) : 'Unavailable'}</small>
    `;

    if (isSelectable) {
      card.addEventListener('click', () => {
        selectedDate = cellDate;
        selectedTime = null;
        renderCalendar();
        renderTimeSlots();
        updateSummary();
      });
    }

    calendarGrid.appendChild(card);
  }
}

function renderTimeSlots() {
  slotGrid.innerHTML = '';
  const slots = getAvailableSlots(selectedDate);

  if (!slots.length) {
    slotGrid.innerHTML = '<div class="time-empty">No openings on this date. Please select another day.</div>';
    selectedTime = null;
    return;
  }

  slots.forEach((slot) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `time-slot ${selectedTime === slot ? 'selected' : ''}`;
    button.textContent = slot;
    button.addEventListener('click', () => {
      selectedTime = slot;
      renderTimeSlots();
      updateSummary();
    });
    slotGrid.appendChild(button);
  });
}

function updateSummary() {
  if (!selectedDate || !selectedTime) {
    bookingSummary.textContent = `You selected ${selectedService.name} for ${formatDateShort(selectedDate)}. Choose a time slot to continue.`;
    return;
  }

  bookingSummary.textContent = `Confirmed: ${selectedService.name} on ${formatDateLong(selectedDate)} at ${selectedTime}. A confirmation message will be sent shortly.`;
}

prevMonthBtn.addEventListener('click', () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  selectedDate = getNextAvailableDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
  selectedTime = null;
  renderCalendar();
  renderTimeSlots();
  updateSummary();
});

nextMonthBtn.addEventListener('click', () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  selectedDate = getNextAvailableDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
  selectedTime = null;
  renderCalendar();
  renderTimeSlots();
  updateSummary();
});

async function respondToInput(text) {
  addMessage('Thinking...', 'bot');
  try {
    const response = await fetch(CHAT_API_URL, {
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

renderServicePicker();
renderCalendar();
renderTimeSlots();
updateSummary();
addMessage('Hi! I can help you book a waxing session. Try saying full body, Brazilian, bikini, laser, or choose a date.', 'bot');
