
/// Importaciones de Firebase
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
const DEFAULT_AVATAR = 'assets/images/default-avatar.png';
const DEFAULT_ICON = 'assets/images/default-icon.png';

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB2nux4LCuAsq6YNNUjv3BJUrjSmodo4yo",
    authDomain: "logic-game-2bec1.firebaseapp.com",
    projectId: "logic-game-2bec1",
    storageBucket: "logic-game-2bec1.firebasestorage.app",
    messagingSenderId: "49694670172",
    appId: "1:49694670172:web:c2e1c8069124c4a05f9599"
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
  },
  {
    question: "Si hoy es lunes, ¿qué día será dentro de 3 días?",
    options: ["Martes", "Miércoles", "Jueves", "Viernes"],
    answer: 2
  },
  {
    question: "¿Cuál es el número que continúa la serie: 2, 4, 8, 16, ___?",
    options: ["18", "20", "24", "32"],
    answer: 3
  },
  {
    question: "Si todas las rosas son flores y algunas flores se marchitan rápidamente, entonces:",
    options: [
      "Todas las rosas se marchitan rápidamente",
      "Algunas rosas se marchitan rápidamente",
      "Ninguna rosa se marchita rápidamente",
      "No se puede determinar"
    ],
    answer: 1
  },
  {
    question: "¿Cuál es la figura que no pertenece al grupo? (Círculo, Cuadrado, Triángulo, Esfera)",
    options: ["Círculo", "Cuadrado", "Triángulo", "Esfera"],
    answer: 3
  },
  {
    question: "Si 3 manzanas cuestan $6, ¿cuánto costarán 5 manzanas?",
    options: ["$8", "$10", "$12", "$15"],
    answer: 1
  },
  {
    question: "¿Cuál es la palabra que no pertenece al grupo? (Perro, Gato, Pájaro, Árbol)",
    options: ["Perro", "Gato", "Pájaro", "Árbol"],
    answer: 3
  },
  {
    question: "Si 5 máquinas hacen 5 artículos en 5 minutos, ¿cuánto tardarán 100 máquinas en hacer 100 artículos?",
    options: ["5 minutos", "50 minutos", "100 minutos", "500 minutos"],
    answer: 0,
  }
];

// Variables para el juego de aprendizaje
let currentLearnTopic = 'multiplicacion';
const multiplicationTables = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
let fractionCards = [];
let percentageProblems = [];
let algebraProblems = [];

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
  
      // 1. Verificar y preparar el mazo
      if (!cardsApi.currentDeckId || cardsApi.remainingCards < 2) {
        await cardsApi.initNewDeck();
      }
  
      // 2. Obtener cartas con validación robusta
      const data = await cardsApi.drawCards(2);
      
      // Validación exhaustiva
      if (!data?.success || !Array.isArray(data.cards)) { // Corrección: se cerró correctamente el paréntesis
        throw new Error("Respuesta inválida de la API de cartas");
      }
      
      if (data.cards.length < 2) {
        throw new Error("No se obtuvieron suficientes cartas");
      }
  
      // 3. Acceso seguro a las cartas (sin destructuración)
      const card1 = data.cards[0];
      const card2 = data.cards[1];
  
      // Validación adicional de valores
      if (!card1 || !card2) {
        throw new Error("Cartas inválidas recibidas");
      }
  
      const value1 = cardValueToNumber(card1.value);
      const value2 = cardValueToNumber(card2.value);
      
      // 4. Selección de operación segura
      const operation = mathOperations[Math.floor(Math.random() * mathOperations.length)] || 'suma';
      
      currentMathProblem = createMathProblem(value1, value2, operation, card1, card2);
      displayMathProblem();
      startGameTimer();
  
    } catch (error) {
      console.error("Error en generateMathProblem:", error);
      
      // Mostrar error específico al usuario
      const errorMessage = error.message.includes("API") 
        ? "Problema con el servidor de cartas" 
        : "Error al crear el problema matemático";
      
      showResultModal('Error', `${errorMessage}. Intentando nuevamente...`, 'error');
      
      // Reintento con delay
      setTimeout(() => {
        cardsApi.initNewDeck().finally(generateMathProblem);
      }, 2000);
    }
  }
    
    // Mostrar cartas con manejo de errores
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
    problemDisplay = document.getElementById('problem-display');
    if (problemDisplay) {
      problemDisplay.innerHTML = `<h3>${problem} = ?</h3>`;
    }
    
    // Mostrar opciones de respuesta con estilos claros
    const answerOptions = document.getElementById('answer-options');
    if (answerOptions) {
      answerOptions.innerHTML = '';
      const answers = generateAnswerOptions(answer, 4);
      
      answers.forEach((answer, index) => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = answer;
        button.dataset.answer = answer;
        button.addEventListener('click', checkMathAnswer);
        
        // Estilo para cada botón de respuesta
        button.style.cssText = `
          margin: 5px;
          padding: 10px 15px;
          font-size: 1.2em;
          background-color: #4CAF50;
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          min-width: 60px;
        `;
        
        answerOptions.appendChild(button);
      });
    }
  
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
  
  // Reutilizar la variable answerOptions
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
  
  // Seleccionar un problema aleatorio que no se haya mostrado recientemente
  let availableProblems = [...logicProblems];
  if (currentLogicProblem) {
    availableProblems = availableProblems.filter(p => p.question !== currentLogicProblem.question);
  }
  
  if (availableProblems.length === 0) {
    availableProblems = [...logicProblems]; // Reiniciar si ya se mostraron todos
  }
  
  currentLogicProblem = availableProblems[Math.floor(Math.random() * availableProblems.length)];
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
  
  // Ocultar el botón de siguiente hasta que respondan
  document.getElementById('next-logic-btn').style.display = 'none';
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
// JUEGO DE APRENDIZAJE
// ======================

function initLearningGames() {
  // Inicializar tablas de multiplicar
  renderMultiplicationTables();
  
  // Inicializar juego de fracciones
  initFractionGame();
  
  // Inicializar juego de porcentajes
  initPercentageGame();
  
  // Inicializar juego de álgebra
  initAlgebraGame();
}

function renderMultiplicationTables() {
  const tablesGrid = document.getElementById('tables-grid');
  if (!tablesGrid) return;
  
  tablesGrid.innerHTML = '';
  
  multiplicationTables.forEach(table => {
    const tableElement = document.createElement('div');
    tableElement.className = 'table-card';
    tableElement.innerHTML = `<h4>Tabla del ${table}</h4>`;
    
    for (let i = 1; i <= 10; i++) {
      const row = document.createElement('div');
      row.className = 'table-row';
      row.textContent = `${table} × ${i} = ${table * i}`;
      tableElement.appendChild(row);
    }
    
    tableElement.addEventListener('click', () => startTablePractice(table));
    tablesGrid.appendChild(tableElement);
  });
}

function startTablePractice(table) {
  currentLearnTopic = 'multiplicacion';
  const problems = [];
  
  for (let i = 1; i <= 10; i++) {
    problems.push({
      question: `${table} × ${i}`,
      answer: table * i,
      options: generateMathOptions(table * i, 4)
    });
  }
  
  startLearningGame(problems, `Practica la tabla del ${table}`);
}

async function initFractionGame() {
  try {
    const data = await cardsApi.drawCards(8);
    fractionCards = data.cards.slice(0, 8);
    renderFractionGame();
  } catch (error) {
    console.error("Error inicializando juego de fracciones:", error);
  }
}

function renderFractionGame() {
  const fractionGame = document.getElementById('fraction-game');
  if (!fractionGame) return;
  
  fractionGame.innerHTML = '<h4>Compara fracciones usando cartas</h4>';
  
  // Creamos 4 fracciones (2 pares para comparar)
  const fractions = [];
  for (let i = 0; i < 4; i++) {
    const card1 = fractionCards[i * 2];
    const card2 = fractionCards[i * 2 + 1];
    
    const value1 = cardValueToNumber(card1.value);
    const value2 = cardValueToNumber(card2.value);
    
    // Aseguramos que el denominador no sea cero
    const denominator = value2 === 0 ? 1 : value2;
    fractions.push({
      numerator: value1,
      denominator: denominator,
      value: value1 / denominator,
      card1: card1,
      card2: card2
    });
  }
  
  // Creamos preguntas de comparación
  const problems = [];
  for (let i = 0; i < 2; i++) {
    const frac1 = fractions[i * 2];
    const frac2 = fractions[i * 2 + 1];
    
    problems.push({
      question: `¿Cuál es mayor? ${frac1.numerator}/${frac1.denominator} o ${frac2.numerator}/${frac2.denominator}?`,
      answer: frac1.value > frac2.value ? 0 : 1,
      options: [
        `${frac1.numerator}/${frac1.denominator}`,
        `${frac2.numerator}/${frac2.denominator}`
      ],
      images: [frac1.card1.image, frac1.card2.image, frac2.card1.image, frac2.card2.image]
    });
  }
  
  // Mostramos las cartas
  const cardDisplay = document.createElement('div');
  cardDisplay.className = 'fraction-cards';
  
  fractions.forEach(frac => {
    cardDisplay.innerHTML += `
      <div class="fraction-card">
        <img src="${frac.card1.image}" alt="${frac.card1.value}">
        <div class="fraction-line"></div>
        <img src="${frac.card2.image}" alt="${frac.card2.value}">
      </div>
    `;
  });
  
  fractionGame.appendChild(cardDisplay);
  
  // Botón para iniciar el juego
  const startBtn = document.createElement('button');
  startBtn.className = 'btn primary';
  startBtn.textContent = 'Practicar Fracciones';
  startBtn.addEventListener('click', () => startLearningGame(problems, 'Comparación de Fracciones'));
  fractionGame.appendChild(startBtn);
}

function initPercentageGame() {
  percentageProblems = [
    {
      question: "¿Cuánto es el 10% de 50?",
      answer: 5,
      options: generateMathOptions(5, 4)
    },
    {
      question: "¿Cuánto es el 25% de 80?",
      answer: 20,
      options: generateMathOptions(20, 4)
    },
    {
      question: "¿Cuánto es el 50% de 120?",
      answer: 60,
      options: generateMathOptions(60, 4)
    },
    {
      question: "Si un artículo cuesta $200 con 20% de descuento, ¿cuál es su precio final?",
      answer: 160,
      options: generateMathOptions(160, 4)
    },
    {
      question: "¿De qué número es 15 el 30%?",
      answer: 50,
      options: generateMathOptions(50, 4)
    }
  ];
  
  const percentageGame = document.getElementById('percentage-game');
  if (percentageGame) {
    percentageGame.innerHTML = `
      <h4>Porcentajes con cartas</h4>
      <p>Calcula porcentajes usando valores de cartas</p>
      <button id="start-percentage-game" class="btn primary">Comenzar</button>
    `;
    
    document.getElementById('start-percentage-game')?.addEventListener('click', () => {
      startLearningGame(percentageProblems, 'Porcentajes');
    });
  }
}

function initAlgebraGame() {
  algebraProblems = [
    {
      question: "Si x + 5 = 10, ¿cuánto vale x?",
      answer: 5,
      options: generateMathOptions(5, 4)
    },
    {
      question: "Si 2x = 16, ¿cuánto vale x?",
      answer: 8,
      options: generateMathOptions(8, 4)
    },
    {
      question: "Si x - 3 = 7, ¿cuánto vale x?",
      answer: 10,
      options: generateMathOptions(10, 4)
    },
    {
      question: "Si x/4 = 5, ¿cuánto vale x?",
      answer: 20,
      options: generateMathOptions(20, 4)
    },
    {
      question: "Si 3x + 2 = 14, ¿cuánto vale x?",
      answer: 4,
      options: generateMathOptions(4, 4)
    }
  ];
  
  const algebraGame = document.getElementById('algebra-game');
  if (algebraGame) {
    algebraGame.innerHTML = `
      <h4>Álgebra básica</h4>
      <p>Resuelve ecuaciones simples</p>
      <button id="start-algebra-game" class="btn primary">Comenzar</button>
    `;
    
    document.getElementById('start-algebra-game')?.addEventListener('click', () => {
      startLearningGame(algebraProblems, 'Álgebra Básica');
    });
  }
}

function startLearningGame(problems, title) {
  if (!problems || problems.length === 0) {
    showResultModal('Error', 'No hay problemas disponibles para este tema', 'error');
    return;
  }
  
  // Configurar la interfaz para el juego de aprendizaje
  const learningContainer = document.createElement('div');
  learningContainer.className = 'learning-game-container';
  learningContainer.innerHTML = `
    <h3>${title}</h3>
    <div class="learning-problem" id="current-learning-problem"></div>
    <div class="learning-options" id="learning-options"></div>
    <div class="learning-stats">
      <span id="learning-score">0</span> puntos | 
      <span id="learning-streak">0</span> racha
    </div>
  `;
  
  // Reemplazar el contenido de la sección de aprendizaje
  const learnContent = document.querySelector(`#${currentLearnTopic}-content`);
  if (learnContent) {
    learnContent.innerHTML = '';
    learnContent.appendChild(learningContainer);
  }
  
  let currentProblemIndex = 0;
  let learningScore = 0;
  let learningStreak = 0;
  
  function showNextProblem() {
    if (currentProblemIndex >= problems.length) {
      // Juego terminado
      showResultModal(
        '¡Completado!', 
        `Obtuviste ${learningScore} puntos en ${problems.length} problemas.`, 
        'success'
      );
      currentScore += learningScore;
      updateScoreUI();
      initLearningGames(); // Volver a la vista inicial
      return;
    }
    
    const problem = problems[currentProblemIndex];
    const problemDisplay = document.getElementById('current-learning-problem');
    const optionsDisplay = document.getElementById('learning-options');
    
    if (problemDisplay) {
      problemDisplay.innerHTML = `<p>${problem.question}</p>`;
      
      // Mostrar imágenes si existen
      if (problem.images) {
        problem.images.forEach(img => {
          problemDisplay.innerHTML += `<img src="${img}" class="learning-image">`;
        });
      }
    }
    
    if (optionsDisplay) {
      optionsDisplay.innerHTML = '';
      problem.options.forEach((option, index) => {
        const optionBtn = document.createElement('button');
        optionBtn.className = 'learning-option';
        optionBtn.textContent = option;
        optionBtn.addEventListener('click', () => checkLearningAnswer(index, problem.answer));
        optionsDisplay.appendChild(optionBtn);
      });
    }
  }
  
  function checkLearningAnswer(selectedIndex, correctAnswer) {
    const isCorrect = selectedIndex === correctAnswer;
    const optionButtons = document.querySelectorAll('.learning-option');
    
    optionButtons.forEach((btn, idx) => {
      if (idx === correctAnswer) {
        btn.classList.add('correct');
      }
      if (idx === selectedIndex && !isCorrect) {
        btn.classList.add('incorrect');
      }
      btn.disabled = true;
    });
    
    if (isCorrect) {
      learningStreak++;
      const pointsEarned = 10 * learningStreak;
      learningScore += pointsEarned;
      
      // Actualizar UI
      document.getElementById('learning-score').textContent = learningScore;
      document.getElementById('learning-streak').textContent = learningStreak;
      
      setTimeout(() => {
        currentProblemIndex++;
        showNextProblem();
      }, 1000);
    } else {
      learningStreak = 0;
      document.getElementById('learning-streak').textContent = learningStreak;
      
      setTimeout(() => {
        currentProblemIndex++;
        showNextProblem();
      }, 1500);
    }
  }
  
  // Comenzar el juego
  showNextProblem();
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

function generateMathOptions(correctAnswer, numOptions) {
  let answers = [correctAnswer];
  
  while (answers.length < numOptions) {
    let variation = Math.floor(Math.random() * 10) + 1;
    if (currentMathProblem?.operation === 'multiplicacion' || currentMathProblem?.operation === 'division') {
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

function setupBottomNavListeners() {
  // Botón de Juego
  document.querySelector('[data-tab="juego"]').addEventListener('click', () => {
    switchTab('juego');
    switchGameMode('math');
  });
  
  // Botón de Aprendizaje
  document.querySelector('[data-tab="aprendizaje"]').addEventListener('click', () => {
    switchTab('aprendizaje');
    initLearningGames();
  });
  
  // Botón de Memoria
  document.querySelector('[data-tab="memoria"]').addEventListener('click', () => {
    switchTab('juego');
    switchGameMode('memory');
    startMemoryGame();
  });
  
  // Botón de Perfil
  document.querySelector('[data-tab="perfil"]').addEventListener('click', () => {
    switchTab('perfil');
    loadProfile();
  });
}

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
  
  // Aprendizaje
  document.querySelectorAll('.learn-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      document.querySelectorAll('.learn-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.learn-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(`${tabId}-content`).classList.add('active');
      currentLearnTopic = tabId;
    });
  });
  
  // Configurar navegación inferior
  setupBottomNavListeners();
  
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
  
  // Inicializar juegos de aprendizaje
  initLearningGames();
  
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