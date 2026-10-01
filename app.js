/**
 * DriveGuard — Interactive Landing Page Script
 * Features:
 * - Real-time animated ECG Canvas (P-Q-R-S-T waves)
 * - Driver State Machine (Normal, Fatigue, Critical Sleep)
 * - Web Audio API Siren Synthesizer
 * - Dynamic 2GIS Nearby Places recommendations
 */

// =============================================================================
// Simulation Data & State
// =============================================================================

const SIM_SCENARIOS = {
  normal: {
    statusTitle: "Водитель в норме",
    statusClass: "normal",
    telemetryDesc: "Показатели вегетативного тонуса стабильны, симпатический баланс",
    hr: 75,
    hrSub: "База: 74 уд/мин",
    rmssd: 37.4,
    rmssdSub: "База: 36.0 мс (Норма)",
    fatigueScore: 8,
    sleepProb: 0,
    sleepProbText: "0% • Безопасно",
    canvasColor: "#00e676",
    dotColor: "#00e676",
    ecgSpeed: 2.2,
    places: [
      { name: "Шоколадница Drive-Thru", type: "Кафе", dist: "1.2 км", time: "3 мин", rating: "4.7" },
      { name: "АЗС «Газпромнефть» (Кофе & Зона отдыха)", type: "АЗС", dist: "850 м", time: "2 мин", rating: "4.9" },
      { name: "Вкусно — и точка (Авто)", type: "Кафе", dist: "450 м", time: "1 мин", rating: "4.8" }
    ]
  },
  fatigue: {
    statusTitle: "Внимание: Начальная усталость",
    statusClass: "fatigue",
    telemetryDesc: "Рост парасимпатического тонуса, брадикардия покоя",
    hr: 64,
    hrSub: "Падение на -10 уд/мин",
    rmssd: 58.2,
    rmssdSub: "Рост на +61% (Вагусный тонус)",
    fatigueScore: 54,
    sleepProb: 42,
    sleepProbText: "42% • Внимание",
    canvasColor: "#f59e0b",
    dotColor: "#f59e0b",
    ecgSpeed: 1.7,
    places: [
      { name: "Вкусно — и точка (Авто)", type: "Кафе / Еда", dist: "450 м", time: "1 мин", rating: "4.8" },
      { name: "АЗС «Лукойл» с кофейней", type: "АЗС", dist: "620 м", time: "2 мин", rating: "4.7" },
      { name: "Охраняемая парковка с зоной отдыха", type: "Отдых", dist: "1.4 км", time: "4 мин", rating: "4.6" }
    ]
  },
  sleep: {
    statusTitle: "ОПАСНОСТЬ: КРИТИЧЕСКИЙ МИКРОСОН!",
    statusClass: "sleep",
    telemetryDesc: "Резкое падение ЧСС, скачок RMSSD и гиподинамия на руле",
    hr: 52,
    hrSub: "Критическое замедление",
    rmssd: 89.6,
    rmssdSub: "Всплеск +148% (Сон)",
    fatigueScore: 94,
    sleepProb: 98,
    sleepProbText: "98% • МИКРОСОН",
    canvasColor: "#ef4444",
    dotColor: "#ef4444",
    ecgSpeed: 1.3,
    places: [
      { name: "Вкусно — и точка (Авто / Парковка)", type: "Срочная остановка", dist: "450 м", time: "1 мин", rating: "4.8" },
      { name: "АЗС «Газпромнефть» (Освещенная зона)", type: "АЗС", dist: "850 м", time: "2 мин", rating: "4.9" },
      { name: "Парковочный карман у Поклонной горы", type: "Парковка", dist: "1.1 км", time: "3 мин", rating: "4.7" }
    ]
  }
};

let currentScenarioKey = 'normal';
let isAudioEnabled = false;
let audioContext = null;
let sirenInterval = null;

// =============================================================================
// DOM Elements
// =============================================================================

const simDisplayCard = document.getElementById('simDisplayCard');
const simEmergencyOverlay = document.getElementById('simEmergencyOverlay');
const simStatusTitle = document.getElementById('simStatusTitle');
const simTelemetryDesc = document.getElementById('simTelemetryDesc');
const simPulseDot = document.getElementById('simPulseDot');
const simHrValue = document.getElementById('simHrValue');
const simHrSub = document.getElementById('simHrSub');
const simRmssdValue = document.getElementById('simRmssdValue');
const simRmssdSub = document.getElementById('simRmssdSub');
const simFatigueScore = document.getElementById('simFatigueScore');
const simFatigueBar = document.getElementById('simFatigueBar');
const simSleepProb = document.getElementById('simSleepProb');
const simSleepSub = document.getElementById('simSleepSub');
const simPlacesGrid = document.getElementById('simPlacesGrid');
const audioToggleBtn = document.getElementById('audioToggleBtn');
const audioStatusText = document.getElementById('audioStatusText');

// Hero elements
const heroCircle = document.getElementById('heroCircle');

// =============================================================================
// Scenario Controller
// =============================================================================

function setSimScenario(key) {
  currentScenarioKey = key;
  const data = SIM_SCENARIOS[key];
  if (!data) return;

  // Обновление кнопок табов
  document.querySelectorAll('.sim-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-scenario') === key);
  });

  // Обновление состояния карточки
  simDisplayCard.className = `sim-display state-${key}`;
  
  if (key === 'sleep') {
    simEmergencyOverlay.classList.add('active');
    startAudioAlarm();
  } else {
    simEmergencyOverlay.classList.remove('active');
    stopAudioAlarm();
  }

  // Обновление текстов и метрик
  simStatusTitle.innerText = data.statusTitle;
  simStatusTitle.style.color = data.dotColor;
  simTelemetryDesc.innerText = data.telemetryDesc;
  simPulseDot.style.background = data.dotColor;
  simPulseDot.style.boxShadow = `0 0 12px ${data.dotColor}`;

  simHrValue.innerHTML = `${data.hr} <small>уд/мин</small>`;
  simHrSub.innerText = data.hrSub;

  simRmssdValue.innerHTML = `${data.rmssd} <small>мс</small>`;
  simRmssdSub.innerText = data.rmssdSub;

  simFatigueScore.innerText = `${data.fatigueScore}%`;
  simFatigueBar.style.width = `${data.fatigueScore}%`;
  simFatigueBar.style.backgroundColor = data.dotColor;

  simSleepProb.innerText = `${data.sleepProb}%`;
  simSleepSub.innerText = data.sleepProbText;
  simSleepProb.style.color = data.dotColor;

  // Рендер 2ГИС карточек
  renderPlaces(data.places);

  // Обновление Hero карточки в унисон для живого эффекта
  if (heroCircle) {
    heroCircle.className = `mockup-state-circle ${key}`;
    const hTitle = heroCircle.querySelector('.circle-title');
    const hDesc = heroCircle.querySelector('.circle-desc');
    const hIcon = heroCircle.querySelector('.circle-icon');
    if (hTitle) hTitle.innerText = data.statusTitle;
    if (hDesc) hDesc.innerText = data.telemetryDesc;
    if (hIcon) hIcon.style.color = data.dotColor;
  }
}

function renderPlaces(places) {
  if (!simPlacesGrid) return;
  simPlacesGrid.innerHTML = '';

  places.forEach(place => {
    const card = document.createElement('div');
    card.className = 'place-sim-card';
    card.innerHTML = `
      <div class="place-type-row">
        <span>${place.type}</span>
        <span>★ ${place.rating}</span>
      </div>
      <div class="place-title">${place.name}</div>
      <div class="place-dist">📍 ${place.dist} • ~${place.time} в пути</div>
      <a href="https://2gis.ru" target="_blank" class="btn-open-route">
        Открыть маршрут в 2ГИС →
      </a>
    `;
    simPlacesGrid.appendChild(card);
  });
}

// =============================================================================
// Web Audio API Alarm Synthesis
// =============================================================================

function toggleAudioDemo() {
  isAudioEnabled = !isAudioEnabled;
  
  if (isAudioEnabled) {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    audioToggleBtn.classList.add('active');
    audioStatusText.innerText = "Звук сирены включен ✓";
    
    if (currentScenarioKey === 'sleep') {
      startAudioAlarm();
    }
  } else {
    audioToggleBtn.classList.remove('active');
    audioStatusText.innerText = "Включить сирену при микросне";
    stopAudioAlarm();
  }
}

function startAudioAlarm() {
  if (!isAudioEnabled || !audioContext) return;
  stopAudioAlarm();

  let toggleFreq = false;
  playSirenTone(1046.5); // C6

  sirenInterval = setInterval(() => {
    toggleFreq = !toggleFreq;
    playSirenTone(toggleFreq ? 1318.5 : 987.7); // E6 / B5
  }, 220);
}

function stopAudioAlarm() {
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
}

function playSirenTone(frequency) {
  try {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, audioContext.currentTime);

    gain.gain.setValueAtTime(0.18, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start();
    osc.stop(audioContext.currentTime + 0.19);
  } catch (e) {
    console.warn("Audio Context playback error:", e);
  }
}

// =============================================================================
// Real-time Animated ECG Canvas Visualizers
// =============================================================================

class ECGVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.x = 0;
    this.phase = 0;
    this.points = [];
    this.maxPoints = 400;

    // Автоматическая адаптация под плотность пикселей экрана (Retina / High DPI)
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * (window.devicePixelRatio || 1);
    this.canvas.height = rect.height * (window.devicePixelRatio || 1);
    this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    this.width = rect.width;
    this.height = rect.height;
  }

  getHeartRateValue(t) {
    // Математическая модель сердечного цикла P-Q-R-S-T
    const beatPeriod = 60 / SIM_SCENARIOS[currentScenarioKey].hr; // секунды на 1 удар
    const normalizedTime = (t % beatPeriod) / beatPeriod;

    // Базовый изоэлектрический уровень
    let y = 0;

    if (normalizedTime > 0.1 && normalizedTime < 0.2) {
      // P wave (предсердия)
      const p = (normalizedTime - 0.1) / 0.1;
      y = Math.sin(p * Math.PI) * 0.18;
    } else if (normalizedTime > 0.22 && normalizedTime < 0.26) {
      // Q wave (небольшой спад)
      y = -0.15;
    } else if (normalizedTime >= 0.26 && normalizedTime < 0.32) {
      // R wave (острый пик вверх)
      const r = (normalizedTime - 0.26) / 0.06;
      y = Math.sin(r * Math.PI) * 1.0;
    } else if (normalizedTime >= 0.32 && normalizedTime < 0.36) {
      // S wave (зубец вниз)
      const s = (normalizedTime - 0.32) / 0.04;
      y = -Math.sin(s * Math.PI) * 0.35;
    } else if (normalizedTime > 0.42 && normalizedTime < 0.6) {
      // T wave (реполяризация желудочков)
      const tw = (normalizedTime - 0.42) / 0.18;
      y = Math.sin(tw * Math.PI) * 0.3;
    }

    // Легкий физиологический шум
    y += (Math.random() - 0.5) * 0.04;
    return y;
  }

  animate(timestamp) {
    const timeSec = timestamp / 1000;
    const value = this.getHeartRateValue(timeSec);
    const midY = this.height / 2;

    this.points.push(midY - (value * (this.height * 0.42)));
    if (this.points.length > this.width) {
      this.points.shift();
    }

    // Очистка
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Сетка
    this.drawGrid();

    // Отрисовка линии ЭКГ
    const scenario = SIM_SCENARIOS[currentScenarioKey];
    this.ctx.beginPath();
    this.ctx.strokeStyle = scenario.canvasColor;
    this.ctx.lineWidth = 2.2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Свечение линии
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = scenario.canvasColor;

    for (let i = 0; i < this.points.length; i++) {
      const x = i;
      const y = this.points[i];
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();

    // Головной луч (сканирующий маркер)
    if (this.points.length > 0) {
      const lastX = this.points.length - 1;
      const lastY = this.points[lastX];
      this.ctx.beginPath();
      this.ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowBlur = 14;
      this.ctx.shadowColor = '#ffffff';
      this.ctx.fill();
    }

    requestAnimationFrame(this.animate);
  }

  drawGrid() {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    this.ctx.shadowBlur = 0;

    const gridSize = 25;
    for (let x = 0; x < this.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }
}

// =============================================================================
// Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Инициализация симулятора
  setSimScenario('normal');

  // Запуск холстов кардиограммы
  new ECGVisualizer('simEcgCanvas');
  new ECGVisualizer('heroEcgCanvas');

  console.log('DriveGuard: Лендинг и интерактивное демо успешно запущены.');
});
