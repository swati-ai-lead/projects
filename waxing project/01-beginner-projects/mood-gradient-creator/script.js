const color1 = document.getElementById('color1');
const color2 = document.getElementById('color2');
const previewCard = document.getElementById('previewCard');
const previewText = document.getElementById('previewText');
const moodInput = document.getElementById('moodInput');
const cssCode = document.getElementById('cssCode');
const randomButton = document.getElementById('randomButton');
const presetButtons = document.querySelectorAll('.preset-button');

function updateGradient() {
  const first = color1.value;
  const second = color2.value;
  const gradient = `linear-gradient(135deg, ${first}, ${second})`;
  previewCard.style.background = gradient;
  cssCode.textContent = `background: ${gradient};`;
}

function updateText() {
  previewText.textContent = moodInput.value || 'Your mood is a gradient.';
}

function choosePreset(event) {
  const button = event.currentTarget;
  const presetColor1 = button.dataset.color1;
  const presetColor2 = button.dataset.color2;
  const presetText = button.dataset.text;
  color1.value = presetColor1;
  color2.value = presetColor2;
  moodInput.value = presetText;
  updateGradient();
  updateText();
}

function randomColor() {
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
}

function randomMood() {
  color1.value = randomColor();
  color2.value = randomColor();
  moodInput.value = ['Bright idea', 'Calm breeze', 'Vivid motion', 'Night shimmer', 'Feeling playful'][Math.floor(Math.random() * 5)];
  updateGradient();
  updateText();
}

color1.addEventListener('input', updateGradient);
color2.addEventListener('input', updateGradient);
moodInput.addEventListener('input', updateText);
randomButton.addEventListener('click', randomMood);
presetButtons.forEach((button) => button.addEventListener('click', choosePreset));

updateGradient();
updateText();
