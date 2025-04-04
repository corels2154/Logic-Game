
// Importar Firebase y sus módulos
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const DECK_API_URL = 'https://deckofcardsapi.com/api/deck';
let currentDeckId = null;
let remainingCards = 0;

// Función para inicializar una nueva baraja
async function initNewDeck() {
    try {
        const response = await fetch(`${DECK_API_URL}/new/shuffle/?deck_count=1`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error('Error al crear baraja');
        }
        
        currentDeckId = data.deck_id;
        remainingCards = data.remaining;
        console.log(`Baraja creada: ${currentDeckId}`);
        return true;
    } catch (error) {
        console.error("Error inicializando baraja:", error);
        showErrorToUser("No se pudo crear la baraja de cartas");
        return false;
    }
}

// Función para robar cartas
async function drawCards(count = 1) {
    if (!currentDeckId || remainingCards < count) {
        await initNewDeck();
    }
    
    try {
        const response = await fetch(`${DECK_API_URL}/${currentDeckId}/draw/?count=${count}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error('Error al robar cartas');
        }
        
        remainingCards = data.remaining;
        updateRemainingCardsUI(); // Actualizar UI
        return data.cards;
    } catch (error) {
        console.error("Error robando cartas:", error);
        showErrorToUser("No se pudieron obtener cartas");
        return null;
    }
}

// ======================
// VARIABLES GLOBALES
// ======================
let app, auth, db; // Firebase variables
const splashScreen = document.getElementById('splash');
const appContent = document.getElementById('app-content');

// Variables del juego
let userFavorites = [];
let currentUser = null;
let currentCard = null;

// Variables para juegos educativos
let currentScore = 0;
let currentStreak = 0;
let gameTimer = null;
let timeLeft = 60;
let currentDifficulty = 'medio';
let kidsMode = false;

// Variables para el juego de memoria
let memoryCards = [];
let flippedCards = [];
let matchedPairs = 0;
let totalPairs = 0;
let memoryMoves = 0;
let memoryGameActive = false;
let currentMemoryLevel = 1;
let memoryGameTime = 0;
let memoryTimer = null;

// Variables para el juego matemático
let currentMathProblem = null;
let correctAnswer = null;
let mathOperations = ['suma', 'resta', 'multiplicacion', 'division'];

// ======================
// FUNCIONES DE INICIALIZACIÓN
// ======================

// Función principal de inicialización
async function initApp() {
    try {
        // Mostrar splash screen
        if (splashScreen) splashScreen.style.display = 'flex';
        if (appContent) appContent.style.display = 'none';
        
        // Inicializar Firebase
        await initFirebase();
        
        // Inicializar baraja
        await initDeck();
        
        // Configurar listeners
        setupEventListeners();
        
        // Verificar autenticación
        checkAuthState();
        
        // Cargar ajustes
        loadSettings();
        
        // Ocultar splash después de 2 segundos
        setTimeout(() => {
            if (splashScreen) splashScreen.style.display = 'none';
            if (appContent) appContent.style.display = 'block';
            
            // Iniciar el juego según la pestaña activa
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab && activeTab.id === 'juego') {
                generateMathProblem();
            }
        }, 2000);
        
    } catch (error) {
        console.error("Error inicializando la aplicación:", error);
        showErrorScreen();
    }
}

// Función para mostrar pantalla de error
function showErrorScreen() {
    if (appContent) {
        appContent.innerHTML = `
            <div class="error-container">
                <h2>¡Ups! Algo salió mal</h2>
                <p>No se pudo iniciar la aplicación. Por favor recarga la página.</p>
                <button onclick="window.location.reload()" class="btn primary">Recargar</button>
            </div>
        `;
        appContent.style.display = 'block';
    }
    if (splashScreen) splashScreen.style.display = 'none';
}

// Inicializar Firebase
async function initFirebase() {
    try {
        const firebaseConfig = {
            apiKey: "AIzaSyDU9eUVNvAhKoB_7fCR4YAQET3NIQwTAYA",
            authDomain: "logic-game-2bec1.firebaseapp.com",
            projectId: "logic-game-2bec1",
            storageBucket: "logic-game-2bec1.firebasestorage.app",
            messagingSenderId: "49694670172",
            appId: "1:49694670172:web:c2e1c8069124c4a05f9599"
          };
        
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase inicializado correctamente");
    } catch (error) {
        console.error("Error inicializando Firebase:", error);
        throw new Error("No se pudo conectar con Firebase");
    }
}

// Inicializar baraja de cartas
async function initDeck() {
    try {
        const response = await fetch('https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1');
        if (!response.ok) throw new Error('Error al crear baraja');
        
        const data = await response.json();
        currentDeckId = data.deck_id;
        remainingCards = data.remaining;
        console.log("Baraja inicializada:", currentDeckId);
    } catch (error) {
        console.error("Error inicializando baraja:", error);
        throw new Error("No se pudo inicializar la baraja de cartas");
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Aquí irían todos los event listeners de tu aplicación
    // Ejemplo:
    document.getElementById('math-submit-btn')?.addEventListener('click', checkMathAnswer);
    document.getElementById('start-memory-btn')?.addEventListener('click', startMemoryGame);
    // ... otros listeners
}

// Verificar estado de autenticación
function checkAuthState() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadProfileDetails();
        } else {
            currentUser = null;
        }
        updateAuthUI();
    });
}

// Cargar configuración del usuario
function loadSettings() {
    // Implementar según necesidades
}

// ======================
// JUEGO MATEMÁTICO
// ======================

async function generateMathProblem() {
    if (!currentDeckId || remainingCards < 2) {
        await initDeck();
    }
    
    try {
        const response = await fetch(`https://deckofcardsapi.com/api/deck/${currentDeckId}/draw/?count=2`);
        if (!response.ok) throw new Error('Error al robar cartas');
        const data = await response.json();
        
        if (data.success && data.cards.length === 2) {
            remainingCards = data.remaining;
            updateGameUI();
            
            const card1 = data.cards[0];
            const card2 = data.cards[1];
            const value1 = cardValueToNumber(card1.value);
            const value2 = cardValueToNumber(card2.value);
            const operation = mathOperations[Math.floor(Math.random() * mathOperations.length)];
            
            currentMathProblem = createMathProblem(value1, value2, operation, card1, card2);
            displayMathProblem();
        }
    } catch (error) {
        console.error("Error generando problema matemático:", error);
        document.getElementById('problem-display').innerHTML = 
            `<p class="error">Error al crear el problema. Intenta de nuevo.</p>`;
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
            if (currentDifficulty === 'facil' && value1 < value2) {
                problemText = `${value2} - ${value1}`;
                answer = value2 - value1;
            } else {
                problemText = `${value1} - ${value2}`;
                answer = value1 - value2;
            }
            break;
        case 'multiplicacion':
            problemText = `${value1} × ${value2}`;
            answer = value1 * value2;
            break;
        case 'division':
            if (value2 === 0) value2 = 1;
            if (currentDifficulty === 'facil') {
                answer = value1;
                problemText = `${answer * value2} ÷ ${value2}`;
            } else {
                answer = Math.round((value1 / value2) * 10) / 10;
                problemText = `${value1} ÷ ${value2}`;
            }
            break;
    }
    
    return {
        card1: card1,
        card2: card2,
        problem: problemText,
        answer: answer,
        operation: operation
    };
}

function cardValueToNumber(value) {
    switch(value) {
        case 'ACE': return 1;
        case 'JACK': return 11;
        case 'QUEEN': return 12;
        case 'KING': return 13;
        default: return parseInt(value) || 0;
    }
}

function displayMathProblem() {
    if (!currentMathProblem) return;
    
    const cardDisplay = document.getElementById('card-display');
    cardDisplay.innerHTML = `
        <div class="math-card">
            <img src="${currentMathProblem.card1.image}" alt="${currentMathProblem.card1.value}">
            <span class="math-symbol">${getOperationSymbol(currentMathProblem.operation)}</span>
            <img src="${currentMathProblem.card2.image}" alt="${currentMathProblem.card2.value}">
            <span class="math-symbol">=</span>
            <span class="question-mark">?</span>
        </div>
    `;
    
    document.getElementById('problem-display').innerHTML = `
        <p>Resuelve:</p>
        <h2>${currentMathProblem.problem} = ?</h2>
    `;
    
    const answerOptions = document.getElementById('answer-options');
    answerOptions.innerHTML = '';
    
    const answers = generateAnswerOptions(currentMathProblem.answer, kidsMode ? 3 : 4);
    answers.forEach(answer => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = answer;
        button.dataset.answer = answer;
        button.addEventListener('click', checkMathAnswer);
        answerOptions.appendChild(button);
    });
    
    if (!gameTimer) startGameTimer();
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

function checkMathAnswer(event) {
    const selectedAnswer = parseFloat(event.target.dataset.answer);
    const isCorrect = selectedAnswer === currentMathProblem.answer;
    
    if (isCorrect) {
        currentStreak++;
        currentScore += calculatePoints();
        event.target.classList.add('correct');
        showResultModal('¡Correcto!', `Ganaste ${calculatePoints()} puntos. Racha: ${currentStreak}`, 'success');
        updateScoreUI();
        
        if (currentUser) saveMathProgress(currentMathProblem.operation, true);
        
        setTimeout(generateMathProblem, 1500);
    } else {
        currentStreak = 0;
        event.target.classList.add('incorrect');
        
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
    let basePoints = 10;
    switch(currentDifficulty) {
        case 'facil': basePoints = 5; break;
        case 'dificil': basePoints = 20; break;
    }
    const streakBonus = Math.min(currentStreak * 2, 20);
    return basePoints + streakBonus;
}

// ======================
// JUEGO DE MEMORIA
// ======================

async function startMemoryGame() {
    memoryGameActive = false;
    document.getElementById('memory-result').innerHTML = '';
    document.getElementById('memory-game').innerHTML = '<div class="spinner"></div>';
    document.getElementById('start-memory-btn').disabled = true;
    
    const level = parseInt(document.getElementById('memory-level').value);
    totalPairs = getPairCountByLevel(level);
    matchedPairs = 0;
    memoryMoves = 0;
    memoryGameTime = 0;
    
    updateMemoryUI();
    
    try {
        const uniqueCards = await fetchUniqueCardsForMemory(totalPairs);
        if (!uniqueCards) throw new Error("No se pudieron obtener cartas");
        
        memoryCards = prepareMemoryCards(uniqueCards);
        renderMemoryBoard();
        startMemoryTimer();
        memoryGameActive = true;
    } catch (error) {
        console.error("Error iniciando juego de memoria:", error);
        document.getElementById('memory-result').innerHTML = `<p class="error">Error: ${error.message}</p>`;
    } finally {
        document.getElementById('start-memory-btn').disabled = false;
    }
}

function getPairCountByLevel(level) {
    switch(level) {
        case 1: return 4;
        case 2: return 6;
        case 3: return 8;
        case 4: return 10;
        case 5: return 12;
        default: return 4;
    }
}

function prepareMemoryCards(cards) {
    const pairedCards = [];
    cards.forEach(card => {
        pairedCards.push({...card, matchCode: `${card.value}-${card.suit}`, isFlipped: false, isMatched: false});
        pairedCards.push({...card, matchCode: `${card.value}-${card.suit}`, isFlipped: false, isMatched: false});
    });
    return shuffleArray(pairedCards);
}

function renderMemoryBoard() {
    const memoryGameDiv = document.getElementById('memory-game');
    memoryGameDiv.innerHTML = '';
    
    const numCards = memoryCards.length;
    let columns = Math.ceil(Math.sqrt(numCards));
    memoryGameDiv.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    
    memoryCards.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = 'memory-card';
        cardElement.dataset.index = index;
        
        cardElement.innerHTML = `
            <div class="memory-card-inner">
                <div class="memory-card-front">
                    <img src="assets/images/card-back.png" alt="Carta boca abajo">
                </div>
                <div class="memory-card-back">
                    <img src="${card.image}" alt="${card.value} of ${card.suit}">
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
            matchedPairs++;
            flippedCards.forEach(i => {
                memoryCards[i].isMatched = true;
                document.querySelector(`.memory-card[data-index="${i}"]`).classList.add('matched');
            });
            
            flippedCards = [];
            
            if (matchedPairs === totalPairs) {
                endMemoryGame(true);
            } else {
                memoryGameActive = true;
            }
        } else {
            setTimeout(() => {
                flippedCards.forEach(i => flipCard(i, false));
                flippedCards = [];
                memoryGameActive = true;
            }, 1000);
        }
    }
}

function flipCard(index, show) {
    const cardElement = document.querySelector(`.memory-card[data-index="${index}"]`);
    if (show) {
        cardElement.classList.add('flipped');
        memoryCards[index].isFlipped = true;
    } else {
        cardElement.classList.remove('flipped');
        memoryCards[index].isFlipped = false;
    }
}

function checkForMatch() {
    return flippedCards.length === 2 && 
           memoryCards[flippedCards[0]].matchCode === memoryCards[flippedCards[1]].matchCode;
}

function endMemoryGame(isCompleted) {
    clearInterval(memoryTimer);
    memoryGameActive = false;
    
    const timeBonus = Math.max(0, 300 - memoryGameTime);
    const movesPenalty = memoryMoves * 2;
    const levelMultiplier = currentMemoryLevel;
    const pointsEarned = Math.max(50, (500 + timeBonus - movesPenalty) * levelMultiplier);
    
    if (isCompleted) {
        currentScore += pointsEarned;
        updateScoreUI();
        
        document.getElementById('memory-result').innerHTML = `
            <div class="memory-result success">
                <h3>¡Nivel completado!</h3>
                <p>Movimientos: ${memoryMoves}</p>
                <p>Tiempo: ${formatTime(memoryGameTime)}</p>
                <p>Puntos ganados: ${pointsEarned}</p>
                <button id="next-level-btn" class="btn primary">Siguiente Nivel</button>
            </div>
        `;
        
        document.getElementById('next-level-btn').addEventListener('click', () => {
            currentMemoryLevel = Math.min(5, currentMemoryLevel + 1);
            document.getElementById('memory-level').value = currentMemoryLevel;
            startMemoryGame();
        });
        
        if (currentUser) {
            saveMemoryProgress(pointsEarned, currentMemoryLevel, memoryMoves, memoryGameTime);
        }
    }
}

// ======================
// FUNCIONES AUXILIARES
// ======================

function updateScoreUI() {
    document.getElementById('current-score').textContent = currentScore;
    document.getElementById('current-streak').textContent = currentStreak;
    if (currentUser) document.getElementById('profile-points').textContent = currentScore;
}

function updateMemoryUI() {
    document.getElementById('memory-moves').textContent = memoryMoves;
    document.getElementById('memory-time').textContent = formatTime(memoryGameTime);
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

function startMemoryTimer() {
    clearInterval(memoryTimer);
    memoryGameTime = 0;
    updateMemoryUI();
    
    memoryTimer = setInterval(() => {
        memoryGameTime++;
        updateMemoryUI();
    }, 1000);
}

function showResultModal(title, message, type) {
    const modal = document.getElementById('result-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    
    modalTitle.textContent = title;
    modalContent.innerHTML = `<p>${message}</p>`;
    modalContent.className = type;
    modal.style.display = 'block';
    
    document.getElementById('modal-button').onclick = function() {
        modal.style.display = 'none';
    };
    
    modal.onclick = function(event) {
        if (event.target === modal) modal.style.display = 'none';
    };
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
    switch(operation) {
        case 'suma': return '+';
        case 'resta': return '-';
        case 'multiplicacion': return '×';
        case 'division': return '÷';
        default: return '?';
    }
}

// ======================
// INTEGRACIÓN CON FIREBASE
// ======================

async function saveMathProgress(operation, isCorrect) {
    if (!currentUser) return;
    
    try {
        const progressRef = collection(db, `users/${currentUser.uid}/mathProgress`);
        await addDoc(progressRef, {
            operation,
            isCorrect,
            difficulty: currentDifficulty,
            timestamp: serverTimestamp(),
            problem: currentMathProblem?.problem,
            streak: currentStreak
        });
        
        await updateUserStats(isCorrect ? 1 : 0, 0, currentStreak);
    } catch (error) {
        console.error("Error guardando progreso matemático:", error);
    }
}

async function saveMemoryProgress(pointsEarned, level, moves, time) {
    if (!currentUser) return;
    
    try {
        const progressRef = collection(db, `users/${currentUser.uid}/memoryProgress`);
        await addDoc(progressRef, {
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

async function updateUserStats(mathPoints = 0, memoryPoints = 0, streak = 0) {
    if (!currentUser) return;
    
    try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        const currentData = userSnap.exists() ? userSnap.data() : {};
        const currentTotal = currentData.totalPoints || 0;
        const currentMath = currentData.mathPoints || 0;
        const currentMemory = currentData.memoryPoints || 0;
        const bestStreak = Math.max(streak, currentData.bestStreak || 0);
        
        await setDoc(userRef, {
            totalPoints: currentTotal + mathPoints + memoryPoints,
            mathPoints: currentMath + mathPoints,
            memoryPoints: currentMemory + memoryPoints,
            bestStreak: bestStreak,
            lastPlayed: serverTimestamp()
        }, { merge: true });
        
        if (userSnap.exists()) loadProfileDetails();
    } catch (error) {
        console.error("Error actualizando estadísticas de usuario:", error);
    }
}

// ======================
// INICIO DE LA APLICACIÓN
// ======================

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (splashScreen) splashScreen.style.display = 'none';
        if (appContent) appContent.style.display = 'block';
        initApp();
    }, 2000);
});