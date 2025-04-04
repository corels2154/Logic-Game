
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

// URLs de recursos por defecto
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';
const DEFAULT_ICON = 'https://cdn-icons-png.flaticon.com/512/3663/3663398.png';

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

// Temporizadores
let gameTimer = null;
let timeLeft = 60;

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

function createMathProblem(value1, value2, operation, card1, card2) {
  let problemText = '';
  let answer = 0;
  
  switch(operation) {
    case 'suma':
      problemText = `${value1} + ${value2}`;
      answer = value1 + value2;
      break;
    case 'resta':
      problemText = `${value1} - ${value2}`;
      answer = value1 - value2;
      break;
    case 'multiplicacion':
      problemText = `${value1} × ${value2}`;
      answer = value1 * value2;
      break;
    case 'division':
      if (value2 === 0) value2 = 1; // Evitar división por cero
      answer = Math.round((value1 / value2) * 10) / 10;
      problemText = `${value1} ÷ ${value2}`;
      break;
  }
  
  return {
    card1,
    card2,
    problem: problemText,
    answer,
    operation
  };
}

function cardValueToNumber(value) {
  const valuesMap = {
    'ACE': 1,
    'JACK': 11,
    'QUEEN': 12,
    'KING': 13
  };
  return valuesMap[value] || parseInt(value) || 0;
}

function displayMathProblem() {
  if (!currentMathProblem) return;
  
  const { card1, card2, operation, problem, answer } = currentMathProblem;
  
  // Mostrar cartas
  const cardDisplay = document.getElementById('card-display');
  if (cardDisplay) {
    cardDisplay.innerHTML = `
      <div class="math-card">
        <img src="${card1.image}" alt="${card1.value}" onerror="this.src='https://deckofcardsapi.com/static/img/back.png'">
        <span class="math-symbol">${getOperationSymbol(operation)}</span>
        <img src="${card2.image}" alt="${card2.value}" onerror="this.src='https://deckofcardsapi.com/static/img/back.png'">
        <span class="math-symbol">=</span>
        <span class="question-mark">?</span>
      </div>
    `;
  }
  
  // Mostrar problema
  const problemDisplay = document.getElementById('problem-display');
  if (problemDisplay) {
    problemDisplay.innerHTML = `<h3>${problem} = ?</h3>`;
  }
  
  // Mostrar opciones de respuesta
  const answerOptions = document.getElementById('answer-options');
  if (answerOptions) {
    answerOptions.innerHTML = '';
    const answers = generateAnswerOptions(answer, 4);
    
    answers.forEach(answer => {
      const button = document.createElement('button');
      button.className = 'answer-btn';
      button.textContent = answer;
      button.dataset.answer = answer;
      button.addEventListener('click', checkMathAnswer);
      answerOptions.appendChild(button);
    });
  }
}

function checkMathAnswer(event) {
  const selectedAnswer = parseFloat(event.target.dataset.answer);
  const isCorrect = selectedAnswer === currentMathProblem.answer;
  
  if (isCorrect) {
    currentStreak++;
    const pointsEarned = calculatePoints();
    currentScore += pointsEarned;
    
    event.target.classList.add('correct');
    showResultModal('¡Correcto!', `Ganaste ${pointsEarned} puntos. Racha: ${currentStreak}`, 'success');
    updateScoreUI();
    
    if (currentUser) saveMathProgress(currentMathProblem.operation, true);
    
    setTimeout(generateMathProblem, 1500);
  } else {
    currentStreak = 0;
    event.target.classList.add('incorrect');
    
    // Mostrar la respuesta correcta
    document.querySelectorAll('.answer-btn').forEach(btn => {
      if (parseFloat(btn.dataset.answer) === currentMathProblem.answer) {
        btn.classList.add('correct');
      }
    });
    
    showResultModal('¡Ups!', `La respuesta correcta era ${currentMathProblem.answer}`, 'error');
    if (currentUser) saveMathProgress(currentMathProblem.operation, false);
    
    setTimeout(() => displayMathProblem(), 2000);
  }
}

function calculatePoints() {
  const difficultyPoints = {
    'facil': 5,
    'medio': 10,
    'dificil': 20
  };
  
  const basePoints = difficultyPoints[currentDifficulty] || 10;
  const streakBonus = Math.min(currentStreak * 2, 20);
  return basePoints + streakBonus;
}

// ======================
// JUEGO DE MEMORIA
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
    
  } catch (error) {
    console.error("Error en el juego de memoria:", error);
    showResultModal('Error', error.message, 'error');
  } finally {
    const startMemoryButton = document.getElementById('start-memory-button');
    if (startMemoryButton) startMemoryButton.disabled = false;
  }
}

function getPairCountByLevel(level) {
  const levels = {
    1: 4,   // Principiante
    2: 6,   // Intermedio
    3: 8,   // Avanzado
    4: 10,  // Experto
    5: 12   // Maestro
  };
  return levels[level] || 4;
}

function prepareMemoryCards(cards) {
  const pairedCards = [];
  
  cards.forEach(card => {
    const matchCode = `${card.value}-${card.suit}`;
    pairedCards.push({...card, matchCode, isFlipped: false, isMatched: false});
    pairedCards.push({...card, matchCode, isFlipped: false, isMatched: false});
  });
  
  return shuffleArray(pairedCards);
}

function renderMemoryBoard() {
  const memoryGameDiv = document.getElementById('memory-game');
  if (!memoryGameDiv) return;
  
  memoryGameDiv.innerHTML = '';
  const columns = Math.ceil(Math.sqrt(memoryCards.length));
  memoryGameDiv.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  
  memoryCards.forEach((card, index) => {
    const cardElement = document.createElement('div');
    cardElement.className = 'memory-card';
    cardElement.dataset.index = index;
    
    cardElement.innerHTML = `
      <div class="memory-card-inner">
        <div class="memory-card-front">
          <img src="https://deckofcardsapi.com/static/img/back.png" alt="Carta boca abajo">
        </div>
        <div class="memory-card-back">
          <img src="${card.image}" alt="${card.value} of ${card.suit}" onerror="this.src='https://deckofcardsapi.com/static/img/back.png'">
        </div>
      </div>
    `;
    
    cardElement.addEventListener('click', () => handleMemoryCardClick(index));
    memoryGameDiv.appendChild(cardElement);
  });
}

function handleMemoryCardClick(index) {
  if (!memoryGameActive || memoryCards[index].isFlipped || memoryCards[index].isMatched) return;
  
  flipCard(index, true);
  flippedCards.push(index);
  
  if (flippedCards.length === 2) {
    memoryMoves++;
    updateMemoryUI();
    memoryGameActive = false;
    
    if (checkForMatch()) {
      setTimeout(() => {
        handleMatch();
      }, 500);
    } else {
      setTimeout(() => {
        handleMismatch();
      }, 1000);
    }
  }
}

function flipCard(index, show) {
  const cardElement = document.querySelector(`.memory-card[data-index="${index}"]`);
  if (cardElement) {
    cardElement.classList.toggle('flipped', show);
    memoryCards[index].isFlipped = show;
  }
}

function checkForMatch() {
  return memoryCards[flippedCards[0]].matchCode === memoryCards[flippedCards[1]].matchCode;
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
  } else {
    memoryGameActive = true;
  }
}

function handleMismatch() {
  flippedCards.forEach(i => flipCard(i, false));
  flippedCards = [];
  memoryGameActive = true;
}

function endMemoryGame(isCompleted) {
  clearInterval(memoryTimer);
  memoryGameActive = false;
  
  if (isCompleted) {
    const pointsEarned = calculateMemoryPoints();
    currentScore += pointsEarned;
    updateScoreUI();
    
    showMemoryResult(pointsEarned);
    
    if (currentUser) {
      saveMemoryProgress(pointsEarned, currentMemoryLevel, memoryMoves, memoryGameTime);
    }
  }
}

function calculateMemoryPoints() {
  const timeBonus = Math.max(0, 300 - memoryGameTime);
  const movesPenalty = memoryMoves * 2;
  const levelMultiplier = currentMemoryLevel;
  return Math.max(50, (500 + timeBonus - movesPenalty) * levelMultiplier);
}

function showMemoryResult(pointsEarned) {
  const memoryResultDiv = document.getElementById('memory-result');
  if (memoryResultDiv) {
    memoryResultDiv.innerHTML = `
      <div class="memory-result success">
        <h3>¡Nivel completado!</h3>
        <p>Movimientos: ${memoryMoves}</p>
        <p>Tiempo: ${formatTime(memoryGameTime)}</p>
        <p>Puntos ganados: ${pointsEarned}</p>
      </div>
    `;
  }
}

// ======================
// JUEGO DE LÓGICA
// ======================

function startLogicGame() {
  if (logicProblems.length === 0) {
    showResultModal('Info', 'No hay más problemas de lógica disponibles', 'info');
    return;
  }
  
  currentLogicProblem = logicProblems[Math.floor(Math.random() * logicProblems.length)];
  displayLogicProblem();
}

function displayLogicProblem() {
  if (!currentLogicProblem) return;
  
  const logicDisplay = document.getElementById('logic-display');
  const logicOptions = document.getElementById('logic-options');
  
  if (logicDisplay) {
    logicDisplay.innerHTML = `<p>${currentLogicProblem.question}</p>`;
  }
  
  if (logicOptions) {
    logicOptions.innerHTML = '';
    currentLogicProblem.options.forEach((option, index) => {
      const optionElement = document.createElement('div');
      optionElement.className = 'logic-option';
      optionElement.textContent = option;
      optionElement.dataset.index = index;
      optionElement.addEventListener('click', () => checkLogicAnswer(index));
      logicOptions.appendChild(optionElement);
    });
  }
}

function checkLogicAnswer(selectedIndex) {
  const isCorrect = selectedIndex === currentLogicProblem.answer;
  const options = document.querySelectorAll('.logic-option');
  
  options.forEach((option, index) => {
    if (index === currentLogicProblem.answer) {
      option.classList.add('correct');
    }
    if (index === selectedIndex && !isCorrect) {
      option.classList.add('incorrect');
    }
    option.style.pointerEvents = 'none';
  });
  
  if (isCorrect) {
    currentStreak++;
    const pointsEarned = 15;
    currentScore += pointsEarned;
    updateScoreUI();
    
    showResultModal('¡Correcto!', `Ganaste ${pointsEarned} puntos. Racha: ${currentStreak}`, 'success');
    if (currentUser) saveLogicProgress(true);
  } else {
    currentStreak = 0;
    showResultModal('¡Ups!', `La respuesta correcta era: ${currentLogicProblem.options[currentLogicProblem.answer]}`, 'error');
    if (currentUser) saveLogicProgress(false);
  }
  
  document.getElementById('next-logic-btn').style.display = 'block';
}

// ======================
// PERFIL Y AUTENTICACIÓN
// ======================

async function handleLogin() {
  const email = document.getElementById('login-email')?.value;
  const password = document.getElementById('login-password')?.value;
  
  if (!email || !password) {
    showResultModal('Error', 'Por favor ingresa email y contraseña', 'error');
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showResultModal('Éxito', 'Inicio de sesión correcto', 'success');
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    showResultModal('Error', getAuthErrorMessage(error.code), 'error');
  }
}

async function handleSignup() {
  const email = document.getElementById('signup-email')?.value;
  const password = document.getElementById('signup-password')?.value;
  const username = document.getElementById('signup-username')?.value;
  const age = document.getElementById('signup-age')?.value;
  const school = document.getElementById('signup-school')?.value;
  const grade = document.getElementById('signup-grade')?.value;
  const interests = document.getElementById('signup-interests')?.value;
  
  if (!email || !password || !username || !age || !school || !grade || !interests) {
    showResultModal('Error', 'Por favor completa todos los campos', 'error');
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Actualizar perfil con nombre de usuario
    await updateProfile(auth.currentUser, {
      displayName: username
    });
    
    // Crear documento de usuario en Firestore con los 7 campos
    await setDoc(doc(db, "users", userCredential.user.uid), {
      email,
      username,
      age,
      school,
      grade,
      interests,
      totalPoints: 0,
      mathPoints: 0,
      memoryPoints: 0,
      logicPoints: 0,
      bestStreak: 0,
      gamesPlayed: 0,
      createdAt: serverTimestamp()
    });
    
    showResultModal('Éxito', 'Usuario registrado correctamente', 'success');
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
  } catch (error) {
    console.error("Error al registrar:", error);
    showResultModal('Error', getAuthErrorMessage(error.code), 'error');
  }
}

async function loadProfile() {
  if (!currentUser) return;

  try {
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      updateProfileUI(userData);
    }
  } catch (error) {
    console.error("Error cargando perfil:", error);
    showResultModal('Error', 'No se pudo cargar el perfil', 'error');
  }
}

function updateProfileUI(userData) {
  document.getElementById('profile-name').textContent = currentUser.displayName || currentUser.email.split('@')[0];
  document.getElementById('profile-email').textContent = currentUser.email;
  document.getElementById('profile-age').querySelector('span').textContent = userData.age || '--';
  document.getElementById('profile-school').querySelector('span').textContent = userData.school || '--';
  document.getElementById('profile-grade').querySelector('span').textContent = userData.grade || '--';
  document.getElementById('profile-interests').querySelector('span').textContent = userData.interests || '--';
  document.getElementById('profile-points').textContent = userData.totalPoints || 0;
  document.getElementById('profile-level').textContent = calculateLevel(userData.totalPoints || 0);
  
  document.getElementById('auth-forms').style.display = 'none';
  document.getElementById('profile-info').style.display = 'block';
}

async function handleLogout() {
  try {
    await signOut(auth);
    showResultModal('Éxito', 'Sesión cerrada correctamente', 'success');
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    showResultModal('Error', 'No se pudo cerrar la sesión', 'error');
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
  
  document.getElementById('difficulty-select')?.addEventListener('change', (e) => {
    currentDifficulty = e.target.value;
    localStorage.setItem('gameDifficulty', currentDifficulty);
    if (currentMathProblem) generateMathProblem();
  });
  
  // Juego de memoria
  document.getElementById('start-memory-button')?.addEventListener('click', startMemoryGame);
  
  document.getElementById('memory-level-select')?.addEventListener('change', (e) => {
    currentMemoryLevel = parseInt(e.target.value);
    localStorage.setItem('memoryLevel', currentMemoryLevel);
  });
  
  // Juego de lógica
  document.getElementById('next-logic-btn')?.addEventListener('click', startLogicGame);
  
  // Autenticación
  document.getElementById('login-btn')?.addEventListener('click', handleLogin);
  document.getElementById('signup-btn')?.addEventListener('click', handleSignup);
  document.getElementById('show-signup')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'block';
  });
  document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signup-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
  });
  
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
  
  // Modal
  document.querySelector('.close-modal')?.addEventListener('click', () => {
    document.getElementById('result-modal').style.display = 'none';
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
  }
}

function switchGameMode(mode) {
  document.querySelectorAll('.game-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  
  document.getElementById('math-game').style.display = mode === 'math' ? 'block' : 'none';
  document.getElementById('memory-game-container').style.display = mode === 'memory' ? 'block' : 'none';
  document.getElementById('logic-game-container').style.display = mode === 'logic' ? 'block' : 'none';
  
  if (mode === 'math') {
    generateMathProblem();
  } else if (mode === 'memory') {
    startMemoryGame();
  } else if (mode === 'logic') {
    startLogicGame();
    document.getElementById('next-logic-btn').style.display = 'none';
  }
}

// ======================
// INICIALIZACIÓN
// ======================

function loadSettings() {
  const savedDifficulty = localStorage.getItem('gameDifficulty');
  if (savedDifficulty) {
    currentDifficulty = savedDifficulty;
    const difficultySelect = document.getElementById('difficulty-select');
    if (difficultySelect) difficultySelect.value = currentDifficulty;
  }
  
  const savedLevel = localStorage.getItem('memoryLevel');
  if (savedLevel) {
    currentMemoryLevel = parseInt(savedLevel);
    const memoryLevelSelect = document.getElementById('memory-level-select');
    if (memoryLevelSelect) memoryLevelSelect.value = currentMemoryLevel;
  }
}

function initApp() {
  // Configurar imágenes por defecto
  document.querySelectorAll('img').forEach(img => {
    img.onerror = function() {
      if (this.id === 'profile-pic') this.src = DEFAULT_AVATAR;
      if (this.classList.contains('splash-icon')) this.src = DEFAULT_ICON;
      if (this.classList.contains('math-card') || this.classList.contains('memory-card-back')) {
        this.src = 'https://deckofcardsapi.com/static/img/back.png';
      }
    };
  });

  // Configurar listeners
  setupEventListeners();
  
  // Cargar ajustes
  loadSettings();
  
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