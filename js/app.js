// Importaciones de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "logic-game-2bec1.firebaseapp.com",
  projectId: "logic-game-2bec1",
  storageBucket: "logic-game-2bec1.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Inicialización de Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variables globales del juego
let currentUser = null;
let currentScore = 0;
let currentStreak = 0;
let currentDifficulty = 'medio';
let currentMathProblem = null;
const mathOperations = ['suma', 'resta', 'multiplicacion', 'division'];

// Variables para el juego de memoria
let currentMemoryLevel = 1;
let memoryGameActive = false;
let memoryCards = [];
let flippedCards = [];
let totalPairs = 0;
let matchedPairs = 0;
let memoryMoves = 0;
let memoryGameTime = 0;
let memoryTimer = null;

// Variables para el juego de lógica
let currentLogicProblem = null;
const logicProblems = [
  {
    question: "Si todos los gatos son animales y algunos animales son domésticos, entonces:",
    options: [
      "Todos los gatos son domésticos",
      "Algunos gatos son domésticos",
      "Ningún gato es doméstico",
      "No se puede determinar"
    ],
    answer: 1
  },
  {
    question: "Juan es más alto que Pedro. Pedro es más alto que Luis. ¿Quién es el más bajo?",
    options: ["Juan", "Pedro", "Luis", "No se puede determinar"],
    answer: 2
  },
  {
    question: "Si A = 1, B = 2, C = 3, ..., Z = 26, ¿cuál es el valor de A + B + C?",
    options: ["5", "6", "7", "8"],
    answer: 1
  }
];

// Variables para el módulo de aprendizaje
let currentTable = null;
let currentFraction = null;
let currentPercentage = null;
let currentAlgebraProblem = null;

// Temporizadores
let gameTimer = null;
let timeLeft = 60;

// Sonidos
let soundsEnabled = true;
let volume = 0.7;
const sounds = {
  correct: document.getElementById('correct-sound'),
  wrong: document.getElementById('wrong-sound'),
  flip: document.getElementById('flip-sound'),
  win: document.getElementById('win-sound'),
  background: document.getElementById('background-music')
};

// API de cartas
const cardsApi = {
  currentDeckId: null,
  remainingCards: 0,

  async initNewDeck() {
    try {
      const response = await fetch('https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1');
      const data = await response.json();
      if (!data.success) throw new Error("No se pudo crear la baraja");
      
      this.currentDeckId = data.deck_id;
      this.remainingCards = data.remaining;
      updateGameUI();
      return data;
    } catch (error) {
      console.error("Error inicializando baraja:", error);
      showResultModal('Error', 'No se pudo crear la baraja de cartas', 'error');
      throw error;
    }
  },

  async drawCards(count = 1) {
    try {
      if (!this.currentDeckId || this.remainingCards < count) {
        await this.initNewDeck();
      }
      
      const response = await fetch(`https://deckofcardsapi.com/api/deck/${this.currentDeckId}/draw/?count=${count}`);
      const data = await response.json();
      
      if (!data.success) throw new Error("No se pudieron obtener cartas");
      
      this.remainingCards = data.remaining;
      updateGameUI();
      return data;
    } catch (error) {
      console.error("Error robando cartas:", error);
      showResultModal('Error', 'No se pudieron obtener cartas', 'error');
      throw error;
    }
  }
};

// ======================
// FUNCIONES DEL JUEGO MATEMÁTICO
// ======================

async function generateMathProblem() {
  try {
    clearInterval(gameTimer);
    timeLeft = 60;
    updateTimerUI();
    
    const data = await cardsApi.drawCards(2);
    const [card1, card2] = data.cards;
    
    const value1 = cardValueToNumber(card1.value);
    const value2 = cardValueToNumber(card2.value);
    const operation = mathOperations[Math.floor(Math.random() * mathOperations.length)];
    
    currentMathProblem = createMathProblem(value1, value2, operation, card1, card2);
    displayMathProblem();
    startGameTimer();
  } catch (error) {
    console.error("Error generando problema matemático:", error);
    showResultModal('Error', 'No se pudo crear el problema. Intenta de nuevo.', 'error');
  }
}

// ... (resto de las funciones del juego matemático se mantienen igual)

// ======================
// JUEGO DE MEMORIA MEJORADO
// ======================

async function startMemoryGame() {
  try {
    totalPairs = getPairCountByLevel(currentMemoryLevel);
    matchedPairs = 0;
    memoryMoves = 0;
    memoryGameTime = 0;
    flippedCards = [];
    
    const memoryGameDiv = document.getElementById('memory-game');
    const memoryResultDiv = document.getElementById('memory-result');
    const startMemoryButton = document.getElementById('start-memory-button');
    
    if (memoryGameDiv) memoryGameDiv.innerHTML = '<div class="spinner"></div>';
    if (memoryResultDiv) memoryResultDiv.innerHTML = '';
    if (startMemoryButton) startMemoryButton.disabled = true;
    
    const drawData = await cardsApi.drawCards(totalPairs);
    memoryCards = prepareMemoryCards(drawData.cards);
    
    renderMemoryBoard();
    startMemoryTimer();
    memoryGameActive = true;
    
    playSound('flip');
  } catch (error) {
    console.error("Error en el juego de memoria:", error);
    showResultModal('Error', error.message, 'error');
  } finally {
    const startMemoryButton = document.getElementById('start-memory-button');
    if (startMemoryButton) startMemoryButton.disabled = false;
  }
}

function handleMemoryCardClick(index) {
  if (!memoryGameActive || memoryCards[index].isFlipped || memoryCards[index].isMatched) return;
  
  flipCard(index, true);
  flippedCards.push(index);
  playSound('flip');
  
  if (flippedCards.length === 2) {
    memoryMoves++;
    updateMemoryUI();
    memoryGameActive = false;
    
    if (checkForMatch()) {
      setTimeout(() => {
        handleMatch();
        playSound('correct');
      }, 500);
    } else {
      setTimeout(() => {
        handleMismatch();
        playSound('wrong');
      }, 1000);
    }
  }
}

function handleMatch() {
  matchedPairs++;
  
  flippedCards.forEach(i => {
    memoryCards[i].isMatched = true;
    const cardElement = document.querySelector(`.memory-card[data-index="${i}"]`);
    if (cardElement) cardElement.classList.add('matched');
  });
  
  flippedCards = [];
  
  if (matchedPairs === totalPairs) {
    endMemoryGame(true);
    playSound('win');
  } else {
    memoryGameActive = true;
  }
}

// ======================
// MÓDULO DE APRENDIZAJE
// ======================

// Tablas de multiplicar
function initTables() {
  const tablesGrid = document.getElementById('tables-grid');
  tablesGrid.innerHTML = '';
  
  for (let i = 1; i <= 10; i++) {
    const tableBtn = document.createElement('button');
    tableBtn.className = 'table-btn';
    tableBtn.innerHTML = `<i class="fas fa-times"></i> Tabla del ${i}`;
    tableBtn.dataset.table = i;
    tableBtn.addEventListener('click', () => showTable(i));
    tablesGrid.appendChild(tableBtn);
  }
}

function showTable(number) {
  currentTable = number;
  const tableGame = document.getElementById('table-game');
  tableGame.innerHTML = '';
  
  // Mostrar la tabla completa
  const tableDiv = document.createElement('div');
  tableDiv.className = 'full-table';
  
  let tableHTML = `<h4><i class="fas fa-times"></i> Tabla del ${number}</h4><ul>`;
  for (let i = 1; i <= 10; i++) {
    tableHTML += `<li>${number} × ${i} = <span class="table-answer">${number * i}</span></li>`;
  }
  tableHTML += '</ul>';
  
  tableDiv.innerHTML = tableHTML;
  tableGame.appendChild(tableDiv);
  
  // Agregar juego de práctica
  const practiceDiv = document.createElement('div');
  practiceDiv.className = 'table-practice';
  practiceDiv.innerHTML = `
    <h4>Practica la tabla</h4>
    <div class="table-question" id="table-question"></div>
    <div class="table-options" id="table-options"></div>
    <button id="new-table-question" class="btn primary"><i class="fas fa-redo"></i> Nueva pregunta</button>
  `;
  
  tableGame.appendChild(practiceDiv);
  generateTableQuestion();
  
  document.getElementById('new-table-question').addEventListener('click', generateTableQuestion);
}

function generateTableQuestion() {
  if (!currentTable) return;
  
  const multiplier = Math.floor(Math.random() * 10) + 1;
  const correctAnswer = currentTable * multiplier;
  
  const questionDiv = document.getElementById('table-question');
  questionDiv.innerHTML = `¿Cuánto es ${currentTable} × ${multiplier}?`;
  
  const optionsDiv = document.getElementById('table-options');
  optionsDiv.innerHTML = '';
  
  // Generar opciones de respuesta
  const answers = generateAnswerOptions(correctAnswer, 4);
  
  answers.forEach(answer => {
    const btn = document.createElement('button');
    btn.className = 'table-option';
    btn.textContent = answer;
    btn.addEventListener('click', () => checkTableAnswer(answer, correctAnswer));
    optionsDiv.appendChild(btn);
  });
}

function checkTableAnswer(selected, correct) {
  const options = document.querySelectorAll('.table-option');
  options.forEach(option => {
    if (parseInt(option.textContent) === correct) {
      option.classList.add('correct');
    }
    option.disabled = true;
  });
  
  if (parseInt(selected) === correct) {
    playSound('correct');
    showResultModal('¡Correcto!', `¡Muy bien! ${selected} es la respuesta correcta`, 'success');
  } else {
    playSound('wrong');
    showResultModal('¡Ups!', `La respuesta correcta era ${correct}`, 'error');
  }
}

// Fracciones
function initFractions() {
  document.getElementById('new-fraction-btn').addEventListener('click', generateFraction);
  document.getElementById('check-fraction-btn').addEventListener('click', checkFraction);
  generateFraction();
}

function generateFraction() {
  const numerator = Math.floor(Math.random() * 10) + 1;
  const denominator = Math.floor(Math.random() * 10) + 1;
  
  currentFraction = {
    numerator,
    denominator,
    value: numerator / denominator
  };
  
  const fractionGame = document.getElementById('fraction-game');
  fractionGame.innerHTML = `
    <div class="fraction-display">
      <div class="fraction-numerator">${numerator}</div>
      <div class="fraction-line"></div>
      <div class="fraction-denominator">${denominator}</div>
    </div>
    <div class="fraction-inputs">
      <input type="number" id="decimal-answer" placeholder="Decimal (ej. 0.75)">
      <input type="text" id="percentage-answer" placeholder="Porcentaje (ej. 75%)">
    </div>
  `;
  
  document.getElementById('fraction-result').innerHTML = '';
}

function checkFraction() {
  if (!currentFraction) return;
  
  const decimalInput = document.getElementById('decimal-answer');
  const percentageInput = document.getElementById('percentage-answer');
  const fractionResult = document.getElementById('fraction-result');
  
  const decimalValue = parseFloat(decimalInput.value);
  const percentageValue = parseFloat(percentageInput.value);
  
  const correctDecimal = currentFraction.value;
  const correctPercentage = Math.round(currentFraction.value * 100);
  
  let decimalCorrect = Math.abs(decimalValue - correctDecimal) < 0.01;
  let percentageCorrect = Math.abs(percentageValue - correctPercentage) < 1;
  
  if (decimalCorrect && percentageCorrect) {
    fractionResult.innerHTML = '<div class="success"><i class="fas fa-check-circle"></i> ¡Correcto! Ambos valores son correctos</div>';
    playSound('correct');
  } else if (decimalCorrect || percentageCorrect) {
    fractionResult.innerHTML = `<div class="partial"><i class="fas fa-exclamation-circle"></i> Parcialmente correcto. 
      ${decimalCorrect ? 'El decimal es correcto' : 'El porcentaje es correcto'}</div>`;
    playSound('correct');
  } else {
    fractionResult.innerHTML = `<div class="error"><i class="fas fa-times-circle"></i> Incorrecto. 
      La respuesta correcta es ${correctDecimal.toFixed(2)} o ${correctPercentage}%</div>`;
    playSound('wrong');
  }
}

// Porcentajes
function initPercentages() {
  document.getElementById('new-percentage-btn').addEventListener('click', generatePercentageProblem);
  generatePercentageProblem();
}

function generatePercentageProblem() {
  const total = Math.floor(Math.random() * 100) + 20;
  const percentage = Math.floor(Math.random() * 100) + 1;
  const answer = Math.round(total * percentage / 100);
  
  currentPercentage = {
    total,
    percentage,
    answer
  };
  
  const percentageGame = document.getElementById('percentage-game');
  percentageGame.innerHTML = `
    <h4>¿Cuánto es el ${percentage}% de ${total}?</h4>
  `;
  
  const optionsDiv = document.getElementById('percentage-options');
  optionsDiv.innerHTML = '';
  
  // Generar opciones de respuesta
  const answers = generateAnswerOptions(answer, 4);
  
  answers.forEach(answer => {
    const btn = document.createElement('button');
    btn.className = 'percentage-option';
    btn.textContent = answer;
    btn.addEventListener('click', () => checkPercentageAnswer(answer));
    optionsDiv.appendChild(btn);
  });
}

function checkPercentageAnswer(selected) {
  const options = document.querySelectorAll('.percentage-option');
  options.forEach(option => {
    if (parseInt(option.textContent) === currentPercentage.answer) {
      option.classList.add('correct');
    }
    option.disabled = true;
  });
  
  if (parseInt(selected) === currentPercentage.answer) {
    playSound('correct');
    showResultModal('¡Correcto!', `¡Muy bien! ${selected} es la respuesta correcta`, 'success');
  } else {
    playSound('wrong');
    showResultModal('¡Ups!', `La respuesta correcta era ${currentPercentage.answer}`, 'error');
  }
}

// Álgebra básica
function initAlgebra() {
  document.getElementById('new-algebra-btn').addEventListener('click', generateAlgebraProblem);
  generateAlgebraProblem();
}

function generateAlgebraProblem() {
  const a = Math.floor(Math.random() * 5) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const c = Math.floor(Math.random() * 10) + 1;
  
  // Generar un tipo de problema aleatorio
  const problemType = Math.floor(Math.random() * 3);
  let problemText = '';
  let answer = 0;
  
  switch(problemType) {
    case 0: // Ecuación simple
      answer = c - b;
      problemText = `Si ${a}x + ${b} = ${c}, ¿cuánto vale x?`;
      break;
    case 1: // Ecuación con resta
      answer = c + b;
      problemText = `Si ${a}x - ${b} = ${c}, ¿cuánto vale x?`;
      break;
    case 2: // Ecuación con multiplicación
      answer = Math.round((c / a) * 10) / 10;
      problemText = `Si ${a}x = ${c}, ¿cuánto vale x?`;
      break;
  }
  
  currentAlgebraProblem = {
    problem: problemText,
    answer: answer
  };
  
  const algebraGame = document.getElementById('algebra-game');
  algebraGame.innerHTML = `
    <h4>${problemText}</h4>
  `;
  
  const optionsDiv = document.getElementById('algebra-options');
  optionsDiv.innerHTML = '';
  
  // Generar opciones de respuesta
  const answers = generateAnswerOptions(answer, 4, true);
  
  answers.forEach(answer => {
    const btn = document.createElement('button');
    btn.className = 'algebra-option';
    btn.textContent = answer;
    btn.addEventListener('click', () => checkAlgebraAnswer(answer));
    optionsDiv.appendChild(btn);
  });
}

function checkAlgebraAnswer(selected) {
  const options = document.querySelectorAll('.algebra-option');
  options.forEach(option => {
    if (parseFloat(option.textContent) === currentAlgebraProblem.answer) {
      option.classList.add('correct');
    }
    option.disabled = true;
  });
  
  if (parseFloat(selected) === currentAlgebraProblem.answer) {
    playSound('correct');
    showResultModal('¡Correcto!', `¡Muy bien! x = ${selected} es la respuesta correcta`, 'success');
  } else {
    playSound('wrong');
    showResultModal('¡Ups!', `La respuesta correcta era x = ${currentAlgebraProblem.answer}`, 'error');
  }
}


// ======================
// FUNCIONES AUXILIARES
// ======================

function updateGameUI() {
  const remainingCardsDisplay = document.getElementById('remaining-cards');
  if (remainingCardsDisplay) {
    remainingCardsDisplay.textContent = cardsApi.remainingCards;
  }
  updateScoreUI();
}

function updateScoreUI() {
  const currentScoreDisplay = document.getElementById('current-score');
  const currentStreakDisplay = document.getElementById('current-streak');
  const profilePoints = document.getElementById('profile-points');
  
  if (currentScoreDisplay) currentScoreDisplay.textContent = currentScore;
  if (currentStreakDisplay) currentStreakDisplay.textContent = currentStreak;
  if (currentUser && profilePoints) profilePoints.textContent = currentScore;
}

function updateMemoryUI() {
  const memoryMovesDisplay = document.getElementById('memory-moves');
  const memoryTimeDisplay = document.getElementById('memory-time');
  const memoryPointsDisplay = document.getElementById('memory-points');
  
  if (memoryMovesDisplay) memoryMovesDisplay.textContent = memoryMoves;
  if (memoryTimeDisplay) memoryTimeDisplay.textContent = formatTime(memoryGameTime);
  if (memoryPointsDisplay) memoryPointsDisplay.textContent = currentScore;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function startGameTimer() {
  clearInterval(gameTimer);
  timeLeft = 60;
  updateTimerUI();
  
  gameTimer = setInterval(() => {
    timeLeft--;
    updateTimerUI();
    
    if (timeLeft <= 0) {
      clearInterval(gameTimer);
      showResultModal('¡Tiempo terminado!', `Tu puntuación final: ${currentScore}`, 'info');
      setTimeout(() => {
        currentScore = 0;
        currentStreak = 0;
        updateScoreUI();
        generateMathProblem();
      }, 3000);
    }
  }, 1000);
}

function updateTimerUI() {
  const timeLeftDisplay = document.getElementById('time-left');
  if (timeLeftDisplay) {
    timeLeftDisplay.textContent = timeLeft;
    timeLeftDisplay.style.color = timeLeft <= 10 ? 'red' : '';
  }
}

function startMemoryTimer() {
  clearInterval(memoryTimer);
  memoryGameTime = 0;
  updateMemoryUI();
  
  memoryTimer = setInterval(() => {
    memoryGameTime++;
    updateMemoryUI();
  }, 1000);
}

function showResultModal(title, message, type, buttons = [{ text: 'OK', action: () => {} }]) {
  const modal = document.getElementById('result-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalContent = document.getElementById('modal-content');
  const modalButton = document.getElementById('modal-button');
  
  modalTitle.textContent = title;
  modalContent.innerHTML = `<p>${message}</p>`;
  modal.className = `modal ${type}`;
  
  // Configurar botones dinámicos
  modalButton.innerHTML = '';
  if (buttons.length > 0) {
    modalButton.textContent = buttons[0].text;
    modalButton.onclick = () => {
      buttons[0].action();
      modal.style.display = 'none';
    };
  }
  
  modal.style.display = 'flex';
}

function getAuthErrorMessage(errorCode) {
  const messages = {
    'auth/invalid-email': 'El correo electrónico no es válido',
    'auth/user-disabled': 'Esta cuenta ha sido deshabilitada',
    'auth/user-not-found': 'No existe una cuenta con este correo',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/email-already-in-use': 'Este correo ya está registrado',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
    'auth/operation-not-allowed': 'Esta operación no está permitida'
  };
  
  return messages[errorCode] || 'Ocurrió un error inesperado';
}

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function getOperationSymbol(operation) {
  const symbols = {
    'suma': '+',
    'resta': '-',
    'multiplicacion': '×',
    'division': '÷'
  };
  return symbols[operation] || '?';
}

function generateAnswerOptions(correctAnswer, numOptions) {
  let answers = [correctAnswer];
  
  while (answers.length < numOptions) {
    let variation = Math.floor(Math.random() * 10) + 1;
    if (currentMathProblem.operation === 'multiplicacion' || currentMathProblem.operation === 'division') {
      variation = Math.floor(Math.random() * 5) + 1;
    }
    
    const newAnswer = answers.length % 2 === 0 ? 
      correctAnswer + variation : 
      correctAnswer - variation;
      
    if (currentDifficulty === 'facil' && newAnswer < 0) continue;
    if (!answers.includes(newAnswer)) answers.push(newAnswer);
  }
  
  return shuffleArray(answers);
}

function calculateLevel(points) {
  return Math.floor(points / 1000) + 1;
}

// ======================
// GUARDADO DE PROGRESO
// ======================

async function saveMathProgress(operation, isCorrect) {
  if (!currentUser) return;
  
  try {
    await addDoc(collection(db, `users/${currentUser.uid}/mathProgress`), {
      operation,
      isCorrect,
      difficulty: currentDifficulty,
      timestamp: serverTimestamp(),
      problem: currentMathProblem?.problem,
      streak: currentStreak
    });
    
    await updateUserStats(isCorrect ? calculatePoints() : 0, 0, currentStreak);
  } catch (error) {
    console.error("Error guardando progreso matemático:", error);
  }
}

async function saveMemoryProgress(pointsEarned, level, moves, time) {
  if (!currentUser) return;
  
  try {
    await addDoc(collection(db, `users/${currentUser.uid}/memoryProgress`), {
      level,
      points: pointsEarned,
      moves,
      time,
      timestamp: serverTimestamp()
    });
    
    await updateUserStats(0, pointsEarned, 0);
  } catch (error) {
    console.error("Error guardando progreso de memoria:", error);
  }
}

async function saveLogicProgress(isCorrect) {
  if (!currentUser) return;
  
  try {
    await addDoc(collection(db, `users/${currentUser.uid}/logicProgress`), {
      isCorrect,
      problem: currentLogicProblem.question,
      timestamp: serverTimestamp()
    });
    
    await updateUserStats(isCorrect ? 15 : 0, 0, currentStreak);
  } catch (error) {
    console.error("Error guardando progreso de lógica:", error);
  }
}

async function updateUserStats(mathPoints = 0, memoryPoints = 0, logicPoints = 0, streak = 0) {
  if (!currentUser) return;
  
  try {
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);
    
    const currentData = userSnap.exists() ? userSnap.data() : {};
    const currentTotal = currentData.totalPoints || 0;
    const currentMath = currentData.mathPoints || 0;
    const currentMemory = currentData.memoryPoints || 0;
    const currentLogic = currentData.logicPoints || 0;
    const bestStreak = Math.max(streak, currentData.bestStreak || 0);
    const gamesPlayed = (currentData.gamesPlayed || 0) + 1;
    
    await updateDoc(userRef, {
      totalPoints: currentTotal + mathPoints + memoryPoints + logicPoints,
      mathPoints: currentMath + mathPoints,
      memoryPoints: currentMemory + memoryPoints,
      logicPoints: currentLogic + logicPoints,
      bestStreak,
      gamesPlayed,
      lastPlayed: serverTimestamp()
    });
    
    if (userSnap.exists()) loadProfile();
  } catch (error) {
    console.error("Error actualizando estadísticas de usuario:", error);
  }
}

// ======================
// MANEJO DE EVENTOS
// ======================

function setupEventListeners() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Modos de juego
    document.querySelectorAll('.game-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => switchGameMode(btn.dataset.mode));
    });
    
    // Juego matemático
    document.getElementById('shuffle-button')?.addEventListener('click', async () => {
      await cardsApi.initNewDeck();
    });
    
    document.getElementById('draw-button')?.addEventListener('click', generateMathProblem);
    
    // Juego de memoria
    document.getElementById('start-memory-button')?.addEventListener('click', startMemoryGame);
    
    // Juego de lógica
    document.getElementById('next-logic-btn')?.addEventListener('click', startLogicGame);
    
    // Aprendizaje - Tabs
    document.querySelectorAll('.learn-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.learn-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        document.querySelectorAll('.learn-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`${tab.dataset.tab}-content`).classList.add('active');
        
        // Inicializar el módulo correspondiente
        switch(tab.dataset.tab) {
          case 'multiplicacion':
            initTables();
            break;
          case 'fracciones':
            initFractions();
            break;
          case 'porcentajes':
            initPercentages();
            break;
          case 'algebra':
            initAlgebra();
            break;
        }
      });
    });
    
    // Autenticación
    document.getElementById('login-btn')?.addEventListener('click', handleLogin);
    document.getElementById('signup-btn')?.addEventListener('click', handleSignup);
    
    // Perfil
    document.getElementById('logout-button')?.addEventListener('click', handleLogout);
    
    // Salir del juego
    document.getElementById('exit-game-btn')?.addEventListener('click', () => {
      showResultModal('Salir', '¿Estás seguro de que quieres salir del juego?', 'warning', [
        { text: 'Cancelar', action: () => {} },
        { text: 'Salir', action: () => {
          currentScore = 0;
          currentStreak = 0;
          updateScoreUI();
          generateMathProblem();
        }}
      ]);
    });
    
    // Ajustes
    document.getElementById('sounds-toggle')?.addEventListener('change', (e) => {
      soundsEnabled = e.target.checked;
      localStorage.setItem('soundsEnabled', soundsEnabled);
    });
    
    document.getElementById('volume-control')?.addEventListener('input', (e) => {
      volume = parseFloat(e.target.value);
      localStorage.setItem('volume', volume);
    });
    
    document.getElementById('kids-mode-toggle')?.addEventListener('change', (e) => {
      document.body.classList.toggle('kids-mode', e.target.checked);
      localStorage.setItem('kidsMode', e.target.checked);
    });
    
    document.getElementById('theme-selector')?.addEventListener('change', (e) => {
      document.body.className = e.target.value;
      localStorage.setItem('theme', e.target.value);
    });
  }
  
  function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === tabId);
    });
    
    if (tabId === 'juego') {
      generateMathProblem();
    } else if (tabId === 'perfil') {
      loadProfile();
    } else if (tabId === 'aprendizaje') {
      initTables(); // Inicializar tablas por defecto
    } else if (tabId === 'memoria') {
      startMemoryGame(); // Iniciar juego de memoria al cambiar a esa pestaña
    }
  }
  
  // ======================
  // INICIALIZACIÓN
  // ======================
  
  function loadSettings() {
    // Cargar configuración de sonido
    const savedSounds = localStorage.getItem('soundsEnabled');
    if (savedSounds !== null) {
      soundsEnabled = savedSounds === 'true';
      document.getElementById('sounds-toggle').checked = soundsEnabled;
    }
    
    // Cargar volumen
    const savedVolume = localStorage.getItem('volume');
    if (savedVolume !== null) {
      volume = parseFloat(savedVolume);
      document.getElementById('volume-control').value = volume;
    }
    
    // Cargar modo niños
    const savedKidsMode = localStorage.getItem('kidsMode');
    if (savedKidsMode !== null) {
      document.getElementById('kids-mode-toggle').checked = savedKidsMode === 'true';
      document.body.classList.toggle('kids-mode', savedKidsMode === 'true');
    }
    
    // Cargar tema
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.getElementById('theme-selector').value = savedTheme;
      document.body.className = savedTheme;
    }
    
    // Cargar dificultad
    const savedDifficulty = localStorage.getItem('gameDifficulty');
    if (savedDifficulty) {
      currentDifficulty = savedDifficulty;
      document.getElementById('difficulty-select').value = currentDifficulty;
    }
    
    // Cargar nivel de memoria
    const savedLevel = localStorage.getItem('memoryLevel');
    if (savedLevel) {
      currentMemoryLevel = parseInt(savedLevel);
      document.getElementById('memory-level-select').value = currentMemoryLevel;
    }
  }
  
  function initApp() {
    // Configurar imágenes por defecto
    document.querySelectorAll('img').forEach(img => {
      img.onerror = function() {
        if (this.id === 'profile-pic') this.src = 'assets/images/default-avatar.png';
        if (this.classList.contains('splash-icon')) this.src = 'assets/images/default-icon.png';
        if (this.classList.contains('math-card') || this.classList.contains('memory-card-back')) {
          this.src = 'https://deckofcardsapi.com/static/img/back.png';
        }
      };
    });
  
    // Configurar listeners
    setupEventListeners();
    
    // Cargar ajustes
    loadSettings();
    
    // Iniciar música de fondo
    if (soundsEnabled) {
      sounds.background.volume = volume * 0.5; // Volumen más bajo para música de fondo
      sounds.background.play().catch(e => console.log("No se pudo reproducir música:", e));
    }
    
    // Verificar autenticación
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
      if (user) {
        loadProfile();
      } else {
        document.getElementById('auth-forms').style.display = 'block';
        document.getElementById('profile-info').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('signup-form').style.display = 'none';
      }
    });
    
    // Ocultar splash screen después de 2 segundos
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      document.getElementById('app-content').style.display = 'block';
      generateMathProblem();
      cardsApi.initNewDeck();
    }, 2000);
  }
  
  // Iniciar la aplicación cuando el DOM esté listo
  document.addEventListener('DOMContentLoaded', initApp);