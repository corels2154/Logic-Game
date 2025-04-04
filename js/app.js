
// Importar Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB2nux4LCuAsq6YNNUjv3BJUrjSmodo4yo",
    authDomain: "logic-game-2bec1.firebaseapp.com",
    projectId: "logic-game-2bec1",
    storageBucket: "logic-game-2bec1.firebasestorage.app",
    messagingSenderId: "49694670172",
    appId: "1:49694670172:web:c2e1c8069124c4a05f9599"
  };

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variables globales
let currentUser = null;
let currentScore = 0;
let currentStreak = 0;
let currentDifficulty = 'medio';
let currentMathProblem = null;
let currentMemoryLevel = 1;
let memoryGameActive = false;
let memoryCards = [];
let flippedCards = [];
let matchedPairs = 0;
let memoryMoves = 0;
let memoryGameTime = 0;
let gameTimer = null;
let memoryTimer = null;
let timeLeft = 60;

const mathOperations = ['suma', 'resta', 'multiplicacion', 'division'];

// Elementos del DOM (adaptados a tu HTML)
const splashScreen = document.getElementById('splash');
const appContent = document.getElementById('app-content');
const currentScoreDisplay = document.getElementById('current-score');
const currentStreakDisplay = document.getElementById('current-streak');
const remainingCardsDisplay = document.getElementById('remaining-cards');
const timeLeftDisplay = document.getElementById('time-left');
const problemDisplay = document.getElementById('problem-display');
const answerOptions = document.getElementById('answer-options');
const cardDisplay = document.getElementById('card-display');
const shuffleButton = document.getElementById('shuffle-button');
const drawButton = document.getElementById('draw-button');
const hintButton = document.getElementById('hint-button');
const memoryGameDiv = document.getElementById('memory-game');
const memoryResultDiv = document.getElementById('memory-result');
const memoryLevelSelect = document.getElementById('memory-level-select');
const memoryMovesDisplay = document.getElementById('memory-moves');
const memoryTimeDisplay = document.getElementById('memory-time');
const memoryPointsDisplay = document.getElementById('memory-points');
const startMemoryButton = document.getElementById('start-memory-button');
const resultModal = document.getElementById('result-modal');
const modalTitle = document.getElementById('modal-title');
const modalContent = document.getElementById('modal-content');
const modalButton = document.getElementById('modal-button');
const profileInfo = document.getElementById('profile-info');
const profilePic = document.getElementById('profile-pic');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profilePoints = document.getElementById('profile-points');
const logoutButton = document.getElementById('logout-button');
const difficultySelect = document.getElementById('difficulty-select');
const tabBtns = document.querySelectorAll('.tab-btn');
const gameModeBtns = document.querySelectorAll('.game-mode-btn');

// Configuración de la API de cartas
const ApiConfig = {
    baseUrl: 'https://deckofcardsapi.com/api',
    endpoints: {
        newDeck: '/deck/new/shuffle/',
        drawCards: '/deck/{deck_id}/draw/'
    },
    defaultParams: {
        deck_count: 1
    }
};

class DeckOfCardsAPI {
    constructor(config) {
        this.config = config;
        this.currentDeckId = null;
        this.remainingCards = 0;
    }

    async _fetchApi(endpoint, params = {}) {
        const urlParams = new URLSearchParams({...this.config.defaultParams, ...params}).toString();
        const url = `${this.config.baseUrl}${endpoint}?${urlParams}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error en la petición a la API');
            return await response.json();
        } catch (error) {
            console.error("Error en DeckOfCardsAPI:", error);
            throw error;
        }
    }

    async initNewDeck() {
        const data = await this._fetchApi(this.config.endpoints.newDeck);
        this.currentDeckId = data.deck_id;
        this.remainingCards = data.remaining;
        return data;
    }

    async drawCards(count = 1) {
        if (!this.currentDeckId || this.remainingCards < count) {
            await this.initNewDeck();
        }
        
        const endpoint = this.config.endpoints.drawCards.replace('{deck_id}', this.currentDeckId);
        const data = await this._fetchApi(endpoint, {count});
        
        this.remainingCards = data.remaining;
        return data;
    }
}

// Instancia global de la API de cartas
const cardsApi = new DeckOfCardsAPI(ApiConfig);

// Inicializar la aplicación
async function initApp() {
    try {
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
            
            // Iniciar el juego matemático por defecto
            generateMathProblem();
        }, 2000);
        
    } catch (error) {
        console.error("Error inicializando la aplicación:", error);
        showErrorScreen();
    }
}

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

function setupEventListeners() {
    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Modos de juego
    gameModeBtns.forEach(btn => {
        btn.addEventListener('click', () => switchGameMode(btn.dataset.mode));
    });
    
    // Juego matemático
    if (shuffleButton) shuffleButton.addEventListener('click', async () => {
        await cardsApi.initNewDeck();
        updateGameUI();
    });
    
    if (drawButton) drawButton.addEventListener('click', generateMathProblem);
    
    if (difficultySelect) difficultySelect.addEventListener('change', (e) => {
        currentDifficulty = e.target.value;
        localStorage.setItem('gameDifficulty', currentDifficulty);
        if (currentMathProblem) generateMathProblem();
    });
    
    // Juego de memoria
    if (startMemoryButton) startMemoryButton.addEventListener('click', startMemoryGame);
    
    // Perfil
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    
    // Modal
    if (modalButton) modalButton.addEventListener('click', () => {
        resultModal.style.display = 'none';
    });
    
    document.querySelector('.close-modal')?.addEventListener('click', () => {
        resultModal.style.display = 'none';
    });
}

function switchTab(tabId) {
    // Actualizar botones de tab
    tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    // Actualizar contenido de tab
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
    
    // Iniciar juegos según la pestaña
    if (tabId === 'juego') {
        generateMathProblem();
    } else if (tabId === 'perfil') {
        loadProfileDetails();
    }
}

function switchGameMode(mode) {
    // Actualizar botones de modo
    gameModeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Mostrar el modo seleccionado
    document.getElementById('math-game').style.display = mode === 'math' ? 'block' : 'none';
    document.getElementById('memory-game-container').style.display = mode === 'memory' ? 'block' : 'none';
    document.getElementById('logic-game-container').style.display = mode === 'logic' ? 'block' : 'none';
    
    if (mode === 'math') {
        generateMathProblem();
    } else if (mode === 'memory') {
        startMemoryGame();
    }
}

// Juego matemático
async function generateMathProblem() {
    try {
        clearInterval(gameTimer);
        timeLeft = 60;
        updateTimerUI();
        
        const data = await cardsApi.drawCards(2);
        
        if (data.success && data.cards.length === 2) {
            updateGameUI();
            
            const card1 = data.cards[0];
            const card2 = data.cards[1];
            const value1 = cardValueToNumber(card1.value);
            const value2 = cardValueToNumber(card2.value);
            const operation = mathOperations[Math.floor(Math.random() * mathOperations.length)];
            
            currentMathProblem = createMathProblem(value1, value2, operation, card1, card2);
            displayMathProblem();
            startGameTimer();
        }
    } catch (error) {
        console.error("Error generando problema matemático:", error);
        problemDisplay.innerHTML = `<p class="error">Error al crear el problema. Intenta de nuevo.</p>`;
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
    
    cardDisplay.innerHTML = `
        <div class="math-card">
            <img src="${currentMathProblem.card1.image}" alt="${currentMathProblem.card1.value}">
            <span class="math-symbol">${getOperationSymbol(currentMathProblem.operation)}</span>
            <img src="${currentMathProblem.card2.image}" alt="${currentMathProblem.card2.value}">
            <span class="math-symbol">=</span>
            <span class="question-mark">?</span>
        </div>
    `;
    
    problemDisplay.innerHTML = `
        <h3>${currentMathProblem.problem} = ?</h3>
    `;
    
    answerOptions.innerHTML = '';
    
    const answers = generateAnswerOptions(currentMathProblem.answer, 4);
    answers.forEach(answer => {
        const button = document.createElement('button');
        button.className = 'answer-btn';
        button.textContent = answer;
        button.dataset.answer = answer;
        button.addEventListener('click', checkMathAnswer);
        answerOptions.appendChild(button);
    });
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

// Juego de memoria
async function startMemoryGame() {
    memoryGameActive = false;
    memoryResultDiv.innerHTML = '';
    memoryGameDiv.innerHTML = '<div class="spinner"></div>';
    startMemoryButton.disabled = true;
    
    totalPairs = getPairCountByLevel(currentMemoryLevel);
    matchedPairs = 0;
    memoryMoves = 0;
    memoryGameTime = 0;
    flippedCards = [];
    
    updateMemoryUI();
    
    try {
        const drawData = await cardsApi.drawCards(totalPairs);
        if (!drawData.success) throw new Error("No se pudieron obtener cartas");
        
        memoryCards = prepareMemoryCards(drawData.cards);
        renderMemoryBoard();
        startMemoryTimer();
        memoryGameActive = true;
    } catch (error) {
        console.error("Error iniciando juego de memoria:", error);
        memoryResultDiv.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    } finally {
        startMemoryButton.disabled = false;
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
                    <img src="https://deckofcardsapi.com/static/img/back.png" alt="Carta boca abajo">
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
        
        memoryResultDiv.innerHTML = `
            <div class="memory-result success">
                <h3>¡Nivel completado!</h3>
                <p>Movimientos: ${memoryMoves}</p>
                <p>Tiempo: ${formatTime(memoryGameTime)}</p>
                <p>Puntos ganados: ${pointsEarned}</p>
            </div>
        `;
        
        if (currentUser) {
            saveMemoryProgress(pointsEarned, currentMemoryLevel, memoryMoves, memoryGameTime);
        }
    }
}

// Funciones auxiliares
function updateGameUI() {
    if (remainingCardsDisplay) {
        remainingCardsDisplay.textContent = cardsApi.remainingCards;
    }
    updateScoreUI();
}

function updateScoreUI() {
    if (currentScoreDisplay) currentScoreDisplay.textContent = currentScore;
    if (currentStreakDisplay) currentStreakDisplay.textContent = currentStreak;
    if (currentUser && profilePoints) profilePoints.textContent = currentScore;
}

function updateMemoryUI() {
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
    if (timeLeftDisplay) {
        timeLeftDisplay.textContent = timeLeft;
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

function showResultModal(title, message, type) {
    if (modalTitle) modalTitle.textContent = title;
    if (modalContent) {
        modalContent.innerHTML = `<p>${message}</p>`;
        modalContent.className = type;
    }
    if (resultModal) resultModal.style.display = 'block';
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

// Autenticación y perfil
async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showResultModal('Éxito', 'Inicio de sesión correcto', 'success');
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        showResultModal('Error', 'Usuario o contraseña incorrectos', 'error');
    }
}

async function handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Crear documento de usuario en Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
            email: email,
            totalPoints: 0,
            mathPoints: 0,
            memoryPoints: 0,
            bestStreak: 0,
            gamesPlayed: 0,
            createdAt: serverTimestamp()
        });
        
        showResultModal('Éxito', 'Usuario registrado correctamente', 'success');
    } catch (error) {
        console.error("Error al registrar:", error);
        showResultModal('Error', error.message, 'error');
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
}

function checkAuthState() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loadProfileDetails();
            document.getElementById('auth-forms').style.display = 'none';
            document.getElementById('profile-info').style.display = 'block';
        } else {
            currentUser = null;
            document.getElementById('auth-forms').style.display = 'block';
            document.getElementById('profile-info').style.display = 'none';
        }
    });
}

async function loadProfileDetails() {
    if (!currentUser) return;
    
    try {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            
            if (profileName) profileName.textContent = currentUser.displayName || currentUser.email.split('@')[0];
            if (profileEmail) profileEmail.textContent = currentUser.email;
            if (profilePoints) profilePoints.textContent = userData.totalPoints || 0;
            
            // Actualizar puntuación global si es mayor
            if (userData.totalPoints > currentScore) {
                currentScore = userData.totalPoints;
                updateScoreUI();
            }
        }
    } catch (error) {
        console.error("Error cargando perfil:", error);
    }
}

function loadSettings() {
    const savedDifficulty = localStorage.getItem('gameDifficulty');
    if (savedDifficulty && difficultySelect) {
        difficultySelect.value = savedDifficulty;
        currentDifficulty = savedDifficulty;
    }
    
    const savedLevel = localStorage.getItem('memoryLevel');
    if (savedLevel && memoryLevelSelect) {
        currentMemoryLevel = parseInt(savedLevel);
        memoryLevelSelect.value = currentMemoryLevel;
    }
}

// Guardar progreso
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
        const gamesPlayed = (currentData.gamesPlayed || 0) + 1;
        
        await setDoc(userRef, {
            totalPoints: currentTotal + mathPoints + memoryPoints,
            mathPoints: currentMath + mathPoints,
            memoryPoints: currentMemory + memoryPoints,
            bestStreak: bestStreak,
            gamesPlayed: gamesPlayed,
            lastPlayed: serverTimestamp()
        }, { merge: true });
        
        if (userSnap.exists()) loadProfileDetails();
    } catch (error) {
        console.error("Error actualizando estadísticas de usuario:", error);
    }
}

// Iniciar la aplicación
document.addEventListener('DOMContentLoaded', initApp);