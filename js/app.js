
// Importar Firebase y sus módulos (Asegúrate que las rutas sean correctas si los descargas)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// ======================
// CONFIGURACIÓN DE FIREBASE (¡¡¡IMPORTANTE: RELLENA ESTO!!!)
// ======================
const firebaseConfig = {
    apiKey: "AIzaSyDU9eUVNvAhKoB_7fCR4YAQET3NIQwTAYA",
    authDomain: "logic-game-2bec1.firebaseapp.com",
    projectId: "logic-game-2bec1",
    storageBucket: "logic-game-2bec1.firebasestorage.app",
    messagingSenderId: "49694670172",
    appId: "1:49694670172:web:c2e1c8069124c4a05f9599"
  };
  
// Inicializar Firebase
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase inicializado correctamente.");
} catch (error) {
    console.error("Error inicializando Firebase:", error);
    alert("Error crítico: No se pudo conectar con Firebase. Revisa la configuración en app.js y tu consola.");
    // Podrías deshabilitar funciones o mostrar un mensaje permanente
}


// ======================
// VARIABLES GLOBALES Y SELECTORES DEL DOM
// ======================
let currentDeckId = null; // Empezar con null hasta que se inicialice
let remainingCards = 0;
let userFavorites = []; // Array para guardar objetos {id, code, value, suit, image}
let currentUser = null; // Guardará el objeto de usuario de Firebase si está logueado
let currentCard = null; // Guardará la última carta robada

// --- Selectores del DOM ---
// Contenedores principales
const splashScreen = document.getElementById('splash');
const appContent = document.getElementById('app-content');
// Juego
const drawButton = document.getElementById('draw-button');
const shuffleButton = document.getElementById('shuffle-button');
const cardDisplay = document.getElementById('card-display');
const remainingCardsSpan = document.getElementById('remaining-cards');
// Favoritos
const favoritesListDiv = document.getElementById('favorites-list');
const favoritesCountSpan = document.getElementById('favorites-count');
const suitFilterSelect = document.getElementById('suit-filter');
const searchInput = document.getElementById('search');
// Autenticación y Perfil
const authFormsDiv = document.getElementById('auth-forms');
const loginForm = document.getElementById('login-form-element');
const registerForm = document.getElementById('register-form-element');
const loginFormContainer = document.getElementById('login-form');
const registerFormContainer = document.getElementById('register-form');
const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const profileInfoDiv = document.getElementById('profile-info');
const logoutButton = document.getElementById('logout-button');
const userInfoHeaderDiv = document.getElementById('user-info');
const profileNameH3 = document.getElementById('profile-name');
const profileEmailP = document.getElementById('profile-email');
const profileCountrySpan = document.getElementById('profile-country');
const profileUsernameSpan = document.getElementById('profile-username');
const loginErrorP = document.getElementById('login-error');
const registerErrorP = document.getElementById('register-error');
// Navegación y Ajustes
const bottomNav = document.querySelector('.bottom-nav');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const themeSelector = document.getElementById('theme-selector');
// Memoria (Placeholder)
const startMemoryButton = document.getElementById('start-memory-button');
const memoryGameDiv = document.getElementById('memory-game');

// === AÑADE ESTAS VARIABLES GLOBALES AL INICIO DE TU app.js ===
let memoryCards = [];       // Array de cartas para el juego actual
let flippedCards = [];      // Array para guardar las 1 o 2 cartas volteadas temporalmente
let matchedPairs = 0;       // Contador de pares encontrados
let totalPairs = 0;         // Total de pares en el nivel actual
let memoryMoves = 0;        // Contador de movimientos (intentos)
let memoryGameActive = false; // Flag para evitar clics rápidos durante la comparación/animación
let currentMemoryLevel = 1; // Nivel actual del juego (inicializado en 1)

// === SELECTORES ADICIONALES (asegúrate que estén definidos) ===
const memoryResultDiv = document.getElementById('memory-result');
const memoryLevelSpan = document.getElementById('memory-level');
const memoryLevelSelect = document.getElementById('memory-level-select'); // Nuevo selector
// const memoryMovesSpan = document.getElementById('memory-moves'); // Podrías añadir un span para mostrar movimientos

// ===========================================================
// === REEMPLAZA TU FUNCIÓN startMemoryGame CON ESTA VERSIÓN ===
// ===========================================================

async function startMemoryGame() {
    console.log(`Iniciando Juego de Memoria - Nivel ${currentMemoryLevel}`);
    memoryGameActive = false; // Asegurar que esté inactivo al inicio
    memoryResultDiv.innerHTML = ''; // Limpiar resultados previos
    memoryGameDiv.innerHTML = '<div class="spinner" style="grid-column: 1 / -1; margin: 20px auto;"></div>'; // Indicador de carga
    startMemoryButton.disabled = true;
    startMemoryButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando Nivel...';
    // memoryLevelSpan.textContent = currentMemoryLevel; // Ya no es necesario mostrarlo aquí, está en el selector
    memoryMoves = 0;
    matchedPairs = 0;
    flippedCards = [];

    // --- 1. Decidir número de pares según nivel ---
    const level = parseInt(currentMemoryLevel); // Asegurarse de que sea un número
    let numPairs;
    switch (level) {
        case 1:
            numPairs = 4;
            break;
        case 2:
            numPairs = 6;
            break;
        case 3:
            numPairs = 8;
            break;
        case 4:
            numPairs = 10;
            break;
        case 5:
            numPairs = 12;
            break;
        default:
            numPairs = 4; // Nivel por defecto si algo sale mal
            currentMemoryLevel = 1; // Resetear a nivel por defecto
            memoryLevelSelect.value = 1; // Actualizar el selector
            console.warn("Nivel de memoria inválido, se estableció en 1.");
    }
    totalPairs = numPairs;
    console.log(`Nivel ${currentMemoryLevel} requiere ${totalPairs} pares (${totalPairs * 2} cartas).`);

    // --- 2. Robar N cartas ÚNICAS de la API ---
    try {
        const uniqueCards = await fetchUniqueCardsForMemory(totalPairs);
        if (!uniqueCards) {
            throw new Error("No se pudieron obtener cartas únicas.");
        }

        // --- 3. Duplicar para tener pares y 4. Barajar ---
        memoryCards = prepareMemoryCards(uniqueCards);

        // --- 5. Crear elementos HTML ---
        renderMemoryBoard();

        // --- Marcar juego como activo ---
        memoryGameActive = true;

    } catch (error) {
        console.error("Error iniciando juego de memoria:", error);
        memoryResultDiv.innerHTML = `<p style="color: var(--error-color);">Error al cargar el nivel: ${error.message}</p>`;
        memoryGameDiv.innerHTML = ''; // Limpiar spinner
    } finally {
        startMemoryButton.disabled = false; // Rehabilitar botón
         startMemoryButton.innerHTML = '<i class="fas fa-play"></i> Comenzar Juego';
    }
}

async function fetchUniqueCardsForMemory(numPairs) {
    console.log(`Intentando robar ${numPairs} cartas únicas.`);
    if (!currentDeckId || remainingCards < numPairs) {
        console.log("No hay baraja válida o suficientes cartas. Inicializando nueva baraja...");
        await initDeck(); // Espera a que la nueva baraja esté lista
        if (!currentDeckId || remainingCards < numPairs) {
            // Si aún después de inicializar no hay suficientes, es un problema mayor
            alert("No se pudo obtener una baraja con suficientes cartas para el juego.");
            return null;
        }
    }

    try {
        // Intenta robar las cartas necesarias
        const response = await fetch(`https://deckofcardsapi.com/api/deck/${currentDeckId}/draw/?count=${numPairs}`);
        if (!response.ok) throw new Error(`Error ${response.status} de la API al robar para memoria`);
        const data = await response.json();

        if (data.success && data.cards.length === numPairs) {
            remainingCards = data.remaining; // Actualizar cartas restantes globales
            updateGameUI(); // Actualizar span de cartas restantes
            console.log("Cartas únicas robadas para memoria:", data.cards);
            return data.cards; // Devuelve las cartas robadas
        } else {
            // Si falla (ej. no quedan suficientes), intenta reiniciar la baraja y robar de nuevo
            console.warn("No se pudieron robar suficientes cartas, reintentando con nueva baraja...");
             await initDeck();
             if (!currentDeckId || remainingCards < numPairs) {
                 alert("Fallo crítico: No se pudo obtener una baraja con suficientes cartas.");
                 return null;
             }
             // Segundo intento
            const response2 = await fetch(`https://deckofcardsapi.com/api/deck/${currentDeckId}/draw/?count=${numPairs}`);
             if (!response2.ok) throw new Error(`Error ${response2.status} en segundo intento de robo`);
             const data2 = await response2.json();

             if (data2.success && data2.cards.length === numPairs) {
                  remainingCards = data2.remaining;
                  updateGameUI();
                  console.log("Cartas únicas robadas en segundo intento:", data2.cards);
                  return data2.cards;
             } else {
                 throw new Error("No se pudieron obtener las cartas necesarias después de reintentar.");
             }
        }
    } catch (error) {
        console.error("Error fetching memory cards:", error);
        alert(`Error al obtener cartas para el juego: ${error.message}`);
        return null;
    }
}

function prepareMemoryCards(uniqueCards) {
    let cards = [];
    uniqueCards.forEach(card => {
        // Añadir dos copias de cada carta, con identificadores únicos si es necesario,
        // pero con el mismo 'matchCode' para la comparación.
        cards.push({ ...card, id: `${card.code}-a`, matchCode: card.code, isFlipped: false, isMatched: false });
        cards.push({ ...card, id: `${card.code}-b`, matchCode: card.code, isFlipped: false, isMatched: false });
    });
    // Barajar las cartas
    return shuffleArray(cards);
}

function renderMemoryBoard() {
    memoryGameDiv.innerHTML = ''; // Limpiar contenido anterior (spinner)

    // Ajustar el estilo de la cuadrícula según el número de cartas
    const numCards = memoryCards.length;
    let columns = 4; // Por defecto
    if (numCards === 8) columns = 4; // 4x2 (Nivel 1)
    else if (numCards === 12) columns = 4; // 4x3 (Nivel 2)
    else if (numCards === 16) columns = 4; // 4x4 (Nivel 3)
    else if (numCards === 20) columns = 5; // 5x4 (Nivel 4)
    else if (numCards === 24) columns = 6; // 6x4 (Nivel 5)
    memoryGameDiv.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

    // Crear y añadir las cartas al tablero
    memoryCards.forEach((cardData, index) => {
        const cardElement = document.createElement('div');
        cardElement.classList.add('memory-card');
        cardElement.dataset.index = index; // Guardar índice para referenciar cardData
        cardElement.dataset.matchCode = cardData.matchCode;

        // Contenido interno (para mostrar imagen al voltear)
        cardElement.innerHTML = `
            <div class="memory-card-inner">
                <div class="memory-card-front">
                    <i class="fas fa-question"></i>
                </div>
                <div class="memory-card-back">
                    <img src="${cardData.image}" alt="${cardData.code}" loading="lazy">
                </div>
            </div>
        `;

        cardElement.addEventListener('click', handleMemoryCardClick);
        memoryGameDiv.appendChild(cardElement);
    });
     console.log("Tablero de memoria renderizado con", numCards, "cartas.");
}

function handleMemoryCardClick(event) {
    if (!memoryGameActive) return; // Ignorar clics si el juego está "pausado"

    const clickedCardElement = event.currentTarget;
    const cardIndex = parseInt(clickedCardElement.dataset.index);
    const cardData = memoryCards[cardIndex];

    // Ignorar si ya está volteada o encontrada, o si ya hay 2 volteadas
    if (cardData.isFlipped || cardData.isMatched || flippedCards.length >= 2) {
        return;
    }

    // --- Voltear la carta ---
    cardData.isFlipped = true;
    clickedCardElement.classList.add('flipped');
    flippedCards.push({ element: clickedCardElement, data: cardData });
    console.log("Carta volteada:", cardData.code);

    // --- Comprobar si hay dos cartas volteadas ---
    if (flippedCards.length === 2) {
        memoryGameActive = false; // Pausar el juego mientras se comprueba
        memoryMoves++;
        // console.log("Movimiento:", memoryMoves); // Actualizar contador de movimientos en UI si existe
        checkForMatch();
    }
}

function checkForMatch() {
    const card1 = flippedCards[0];
    const card2 = flippedCards[1];

    if (card1.data.matchCode === card2.data.matchCode) {
        // --- ¡Es un par! ---
        console.log("¡Par encontrado!", card1.data.matchCode);
        handleMatch(card1, card2);
        checkGameOver();
        memoryGameActive = true; // Reactivar juego
    } else {
        // --- No es un par ---
        console.log("No es par.");
        // Esperar un poco antes de voltearlas de nuevo
        setTimeout(() => {
            handleNoMatch(card1, card2);
             memoryGameActive = true; // Reactivar juego después de voltear
        }, 1000); // Esperar 1 segundo
    }
     // Limpiar array de cartas volteadas después del procesamiento (sea match o no)
     // Se hace aquí o dentro de handleMatch/handleNoMatch. Aquí parece más seguro.
     flippedCards = [];
}

function handleMatch(card1, card2) {
    card1.data.isMatched = true;
    card2.data.isMatched = true;
    card1.element.classList.add('matched');
    card2.element.classList.add('matched');
    // Opcional: remover el listener para que no se puedan clickear más
    card1.element.removeEventListener('click', handleMemoryCardClick);
    card2.element.removeEventListener('click', handleMemoryCardClick);
    matchedPairs++;
}

function handleNoMatch(card1, card2) {
    card1.data.isFlipped = false;
    card2.data.isFlipped = false;
    card1.element.classList.remove('flipped');
    card2.element.classList.remove('flipped');
}

function checkGameOver() {
    if (matchedPairs === totalPairs) {
        console.log("¡Juego terminado!");
        memoryGameActive = false; // Juego finalizado
        memoryResultDiv.innerHTML = `
            <h3 style="color: var(--primary-color);">¡Felicidades!</h3>
            <p>Completaste el Nivel ${currentMemoryLevel} en ${memoryMoves} movimientos.</p>
            <button id="next-level-btn" class="btn primary">Siguiente Nivel</button>
            <button id="play-again-btn" class="btn">Jugar de Nuevo (Nivel ${currentMemoryLevel})</button>
        `;
        // Añadir listeners a los nuevos botones
        document.getElementById('next-level-btn')?.addEventListener('click', () => {
            currentMemoryLevel++; // Incrementar nivel
            memoryLevelSelect.value = currentMemoryLevel; // Actualizar el selector
            startMemoryGame();    // Empezar el siguiente nivel
        });
         document.getElementById('play-again-btn')?.addEventListener('click', startMemoryGame); // Reiniciar nivel actual
    }
}

// --- Función auxiliar para barajar un array (Fisher-Yates) ---
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // Intercambio de elementos
  }
  return array;
}



// ======================
// FUNCIONES DE LA API DECK OF CARDS
// ======================

async function initDeck() {
  console.log("Inicializando baraja...");
  try {
    // Siempre pedir una nueva baraja barajada al inicio o al quedarse sin cartas
    const response = await fetch('https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1');
    if (!response.ok) throw new Error(`Error ${response.status} de la API`);
    const data = await response.json();

    if (data.success) {
        currentDeckId = data.deck_id;
        remainingCards = data.remaining;
        currentCard = null; // Resetear carta actual
        console.log("Nueva baraja inicializada:", currentDeckId, "Cartas:", remainingCards);
        updateGameUI(); // Actualizar UI del juego
        cardDisplay.innerHTML = '<p>Baraja lista. ¡Roba una carta!</p>'; // Mensaje inicial
    } else {
        console.error("La API no devolvió éxito al crear baraja:", data);
        alert("No se pudo obtener una nueva baraja de la API.");
    }
  } catch (error) {
    console.error("Error al inicializar baraja:", error);
    alert(`Error conectando con la API de cartas: ${error.message}. Intenta de nuevo más tarde.`);
    // Podrías deshabilitar los botones de juego aquí
    drawButton.disabled = true;
    shuffleButton.disabled = true;
  }
}

async function drawCardAction() {
  if (!currentDeckId) {
      alert("La baraja no está inicializada. Intentando inicializar...");
      await initDeck();
      return; // Salir y esperar a que initDeck termine
  }

  if (remainingCards <= 0) {
      alert("¡No quedan cartas! Barajando nuevo mazo...");
      await initDeck(); // Baraja automáticamente
      return; // Salir, el usuario tendrá que volver a hacer clic
  }

  drawButton.disabled = true; // Deshabilitar mientras se roba
  drawButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Robando...';

  try {
    const response = await fetch(`https://deckofcardsapi.com/api/deck/${currentDeckId}/draw/?count=1`);
     if (!response.ok) throw new Error(`Error ${response.status} de la API`);
    const data = await response.json();

    if (data.success && data.cards.length > 0) {
        remainingCards = data.remaining;
        currentCard = data.cards[0]; // Guardar la carta actual
        console.log("Carta robada:", currentCard);
        displayCard(currentCard);
        updateGameUI();
    } else if (!data.success && data.error.includes("Not enough cards remaining")) {
        // Caso específico donde la API dice que no quedan cartas
         alert("¡No quedan cartas según la API! Barajando nuevo mazo...");
         await initDeck();
    } else {
        console.error("Respuesta inesperada al robar carta:", data);
        alert("Hubo un problema al robar la carta.");
        remainingCards = data.remaining; // Actualizar por si acaso la API lo devuelve
        updateGameUI();
    }
  } catch (error) {
    console.error("Error al robar carta:", error);
    alert(`Error conectando con la API de cartas al robar: ${error.message}.`);
  } finally {
      drawButton.disabled = false; // Rehabilitar el botón
      drawButton.innerHTML = '<i class="fas fa-hand-paper"></i> Robar Carta';
  }
}

function displayCard(card) {
  if (!card) {
      cardDisplay.innerHTML = '<p>No hay carta para mostrar.</p>';
      return;
  }
  // Comprobar si la carta actual ya es favorita
  const isFavorite = currentUser ? userFavorites.some(fav => fav.code === card.code) : false;
  const buttonHtml = currentUser
    ? `<button class="save-favorite-btn ${isFavorite ? 'favorited' : ''}" data-code="${card.code}" data-value="${card.value}" data-suit="${card.suit}" data-image="${card.image}">
         <i class="fas fa-heart"></i> ${isFavorite ? 'Guardada' : 'Guardar'}
       </button>`
    : '<p><small>Inicia sesión para guardar favoritos.</small></p>'; // Mensaje si no está logueado

  cardDisplay.innerHTML = `
    <div class="card">
      <img src="${card.image}" alt="${card.value} of ${card.suit}">
      <div class="card-info">
        <h3>${translateValue(card.value)} de ${translateSuit(card.suit)}</h3>
        ${buttonHtml}
      </div>
    </div>
  `;

  // Añadir event listener al botón de guardar si existe
   const saveButton = cardDisplay.querySelector('.save-favorite-btn');
   if (saveButton) {
       saveButton.addEventListener('click', handleSaveFavoriteClick);
   }
}

function handleSaveFavoriteClick(event) {
    const button = event.currentTarget;
    const { code, value, suit, image } = button.dataset;

    // Verificar si ya es favorita para decidir si guardar o borrar
    const isAlreadyFavorite = userFavorites.some(fav => fav.code === code);

    if (isAlreadyFavorite) {
        // Encontrar el ID del favorito para borrarlo
        const favoriteToRemove = userFavorites.find(fav => fav.code === code);
        if (favoriteToRemove) {
            deleteFavorite(favoriteToRemove.id, button); // Pasar el botón para feedback visual
        }
    } else {
        saveFavorite(code, value, suit, image, button); // Pasar el botón para feedback visual
    }
}

// ======================
// FUNCIONES DE FIREBASE (Firestore)
// ======================

async function saveUserData(userId, userData) {
    try {
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, { // Usar setDoc para crear o sobrescribir el perfil
            name: userData.name,
            username: userData.username,
            country: userData.country,
            birthdate: userData.birthdate || null, // Guardar como null si no se proporciona
            interests: userData.interests || null,
            email: userData.email // Guardar email para referencia, aunque esté en Auth
        }, { merge: true }); // merge: true es útil si quieres añadir campos sin borrar otros
        console.log("Datos de usuario guardados en Firestore para:", userId);
    } catch (error) {
        console.error("Error al guardar datos de usuario en Firestore:", error);
        alert("Hubo un error al guardar tu información de perfil.");
    }
}

async function loadUserProfile(userId) {
    try {
        const userRef = doc(db, "users", userId);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
            console.log("Perfil de usuario cargado:", docSnap.data());
            return docSnap.data();
        } else {
            console.log("No existe documento de perfil para el usuario:", userId);
            return null; // No hay perfil guardado
        }
    } catch (error) {
        console.error("Error cargando perfil de usuario:", error);
        return null;
    }
}

async function saveFavorite(code, value, suit, image, buttonElement = null) {
  if (!currentUser) {
    alert("Debes iniciar sesión para guardar favoritos.");
    return;
  }
   if (buttonElement) {
      buttonElement.disabled = true;
      buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  }

  try {
    const favRef = collection(db, `users/${currentUser.uid}/favorites`);
    await addDoc(favRef, {
      code,
      value,
      suit,
      image,
      createdAt: serverTimestamp() // Fecha de guardado
    });
    console.log("Favorito guardado:", code);
    // alert("¡Carta guardada en favoritos!"); // Quizás mejor feedback visual
    await loadFavorites(); // Recargar favoritos para actualizar la lista y el estado del botón

    // Actualizar el botón de la carta actual si es la que se guardó
    if (currentCard && currentCard.code === code && cardDisplay.contains(buttonElement)) {
        displayCard(currentCard); // Volver a renderizar la carta actual con el estado de favorito actualizado
    }

  } catch (error) {
    console.error("Error al guardar favorito:", error);
    alert("Error al guardar la carta: " + error.message);
     if (buttonElement) { // Restaurar botón en caso de error
        buttonElement.disabled = false;
        buttonElement.innerHTML = '<i class="fas fa-heart"></i> Guardar';
    }
  }
}

async function deleteFavorite(favoriteId, buttonElement = null) {
    if (!currentUser) {
        alert("Debes iniciar sesión para gestionar favoritos.");
        return;
    }
    if (buttonElement) {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Borrando...';
    }

    try {
        const favRef = doc(db, `users/${currentUser.uid}/favorites`, favoriteId);
        await deleteDoc(favRef);
        console.log("Favorito borrado:", favoriteId);
        await loadFavorites(); // Recargar favoritos
        // Actualizar el botón de la carta actual si es la que se borró
        if (currentCard && currentCard.code === favoriteId && cardDisplay.contains(buttonElement)) {
            displayCard(currentCard); // Volver a renderizar
        }
    } catch (error) {
        console.error("Error al borrar favorito:", error);
        alert("Error al borrar la carta de favoritos: " + error.message);
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.innerHTML = '<i class="fas fa-heart"></i> Guardar'; // O 'Guardada' si era el estado anterior
        }
    }
}

async function loadFavorites(filterSuit = null, searchTerm = '') {
    if (!currentUser) {
        favoritesListDiv.innerHTML = '<p>Inicia sesión para ver tus cartas favoritas.</p>';
        favoritesCountSpan.textContent = '0';
        userFavorites = []; // Asegurar que esté vacío si no hay usuario
        return;
    }

    favoritesListDiv.innerHTML = '<div class="spinner"></div>'; // Mostrar cargando
    try {
        const favRef = collection(db, `users/${currentUser.uid}/favorites`);
        const q = query(favRef, orderBy("createdAt", "desc")); // Ordenar por fecha de guardado

        const querySnapshot = await getDocs(q);
        userFavorites = []; // Limpiar el array antes de recargar

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if ((!filterSuit || data.suit === filterSuit) &&
                (searchTerm === '' || `${data.value} ${data.suit}`.toLowerCase().includes(searchTerm.toLowerCase()))) {
                userFavorites.push({ id: doc.id, ...data });
            }
        });

        favoritesCountSpan.textContent = userFavorites.length;
        renderFavoritesList(userFavorites);

    } catch (error) {
        console.error("Error al cargar favoritos:", error);
        favoritesListDiv.innerHTML = `<p style="color: var(--error-color);">Error al cargar tus favoritos: ${error.message}</p>`;
        favoritesCountSpan.textContent = '0';
        userFavorites = [];
    }
}

function renderFavoritesList(favorites) {
    favoritesListDiv.innerHTML = ''; // Limpiar lista
    if (favorites.length === 0) {
        favoritesListDiv.innerHTML = '<p>No has guardado ninguna carta favorita aún.</p>';
        return;
    }

    favorites.forEach(fav => {
        const favCard = document.createElement('div');
        favCard.classList.add('favorite-card');
        favCard.innerHTML = `
            <img src="${fav.image}" alt="${fav.value} of ${fav.suit}">
            <div class="favorite-card-info">
                <h4>${translateValue(fav.value)} de ${translateSuit(fav.suit)}</h4>
                <button class="remove-favorite-btn" data-id="${fav.id}" data-code="${fav.code}">
                    <i class="fas fa-trash"></i> Borrar
                </button>
            </div>
        `;
        favoritesListDiv.appendChild(favCard);
    });

    // Añadir event listeners a los botones de borrar
    const removeButtons = favoritesListDiv.querySelectorAll('.remove-favorite-btn');
    removeButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const favoriteId = event.currentTarget.dataset.id;
            const cardCode = event.currentTarget.dataset.code;
            deleteFavorite(favoriteId);
            // Opcional: podría ser útil dar feedback visual inmediato aquí
            const cardElementToRemove = event.currentTarget.closest('.favorite-card');
            if (cardElementToRemove) {
                cardElementToRemove.remove();
                const index = userFavorites.findIndex(fav => fav.id === favoriteId);
                if (index > -1) {
                    userFavorites.splice(index, 1);
                    favoritesCountSpan.textContent = userFavorites.length;
                    if (userFavorites.length === 0) {
                        favoritesListDiv.innerHTML = '<p>No has guardado ninguna carta favorita aún.</p>';
                    }
                }
            }
        });
    });
}

// ======================
// FUNCIONES DE AUTENTICACIÓN DE FIREBASE
// ======================

auth.onAuthStateChanged(async (user) => {
    if (user) {
        // Usuario está logueado
        currentUser = user;
        console.log("Usuario autenticado:", currentUser.uid);
        updateAuthUI(true);
        await loadUserProfile(currentUser.uid); // Cargar datos del perfil desde Firestore
        await loadFavorites(); // Cargar favoritos al iniciar sesión
    } else {
        // Usuario no está logueado
        currentUser = null;
        console.log("Usuario no autenticado.");
        updateAuthUI(false);
        userFavorites = []; // Limpiar favoritos
        favoritesCountSpan.textContent = '0';
        favoritesListDiv.innerHTML = '<p>Inicia sesión para ver tus cartas favoritas.</p>';
    }
});

function updateAuthUI(isLoggedIn) {
    if (isLoggedIn) {
        // Ocultar formularios de login/registro, mostrar info de perfil
        authFormsDiv.style.display = 'none';
        profileInfoDiv.style.display = 'block';
        userInfoHeaderDiv.innerHTML = `<i class="fas fa-user"></i> ${currentUser.email}`;
        // Cargar el perfil específico del usuario
        loadProfileDetails();
    } else {
        // Mostrar formularios, ocultar info de perfil
        authFormsDiv.style.display = 'block';
        profileInfoDiv.style.display = 'none';
        userInfoHeaderDiv.innerHTML = '<i class="fas fa-user-circle"></i> Invitado';
        profileNameH3.textContent = 'Invitado';
        profileEmailP.textContent = 'No logueado';
        profileCountrySpan.textContent = '--';
        profileUsernameSpan.textContent = '--';
    }
}

async function loadProfileDetails() {
    if (currentUser && currentUser.uid) {
        const profileData = await loadUserProfile(currentUser.uid);
        if (profileData) {
            profileNameH3.textContent = profileData.name || 'Nombre no disponible';
            profileEmailP.textContent = profileData.email || currentUser.email;
            profileCountrySpan.textContent = profileData.country || '--';
            profileUsernameSpan.textContent = profileData.username || 'Usuario no disponible';
            // Aquí podrías cargar también la foto de perfil si la guardas en Firestore
        }
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.loginEmail.value;
    const password = loginForm.loginPassword.value;
    loginErrorP.style.display = 'none'; // Ocultar errores previos

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Usuario logueado:", userCredential.user);
        // auth.onAuthStateChanged se encargará de actualizar la UI
    } catch (error) {
        console.error("Error al iniciar sesión:", error.message);
        loginErrorP.textContent = traducirErrorAuth(error.code);
        loginErrorP.style.display = 'block';
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const registerFormElement = document.getElementById('register-form-element');

    if (registerFormElement) {
        const name = registerFormElement.querySelector('#register-name').value;
        const email = registerFormElement.querySelector('#register-email').value;
        const password = registerFormElement.querySelector('#register-password').value;
        const birthdate = registerFormElement.querySelector('#register-birthdate').value;
        const username = registerFormElement.querySelector('#register-username').value;
        const country = registerFormElement.querySelector('#register-country').value;
        const interests = registerFormElement.querySelector('#register-interests').value;

        // Ahora puedes usar las variables name, email, password, etc.
        console.log("Nombre:", name);
        console.log("Email:", email);
        // ... y así sucesivamente

        registerErrorP.style.display = 'none'; // Ocultar errores previos

        if (password.length < 6) {
            registerErrorP.textContent = "La contraseña debe tener al menos 6 caracteres.";
            registerErrorP.style.display = 'block';
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log("Usuario registrado:", userCredential.user);
            // Guardar datos adicionales en Firestore
            await saveUserData(userCredential.user.uid, { name, username, country, birthdate, interests, email });
            // auth.onAuthStateChanged se encargará de actualizar la UI
        } catch (error) {
            console.error("Error al registrar usuario:", error.message);
            registerErrorP.textContent = traducirErrorAuth(error.code);
            registerErrorP.style.display = 'block';
        }

    } else {
        console.error("No se encontró el formulario de registro.");
    }
});

// ... el resto de tu código (listeners para logout y cambio de formularios)
function traducirErrorAuth(errorCode) {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'Este correo electrónico ya está en uso.';
        case 'auth/invalid-email':
            return 'El correo electrónico no es válido.';
        case 'auth/wrong-password':
            return 'Contraseña incorrecta.';
        case 'auth/user-not-found':
            return 'No se encontró usuario con este correo electrónico.';
        case 'auth/weak-password':
            return 'La contraseña es demasiado débil.';
        default:
            return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
    }
}

// ======================
// FUNCIONES DE UTILIDAD Y EVENT LISTENERS INICIALES
// ======================

function translateSuit(suit) {
    switch (suit) {
        case 'HEARTS': return 'Corazones';
        case 'DIAMONDS': return 'Diamantes';
        case 'CLUBS': return 'Tréboles';
        case 'SPADES': return 'Picas';
        default: return suit;
    }
}

function translateValue(value) {
    switch (value) {
        case 'ACE': return 'As';
        case 'KING': return 'Rey';
        case 'QUEEN': return 'Reina';
        case 'JACK': return 'Jota';
        default: return value;
    }
}

function updateGameUI() {
  remainingCardsSpan.textContent = remainingCards;
}

// --- Event listeners ---
drawButton.addEventListener('click', drawCardAction);
shuffleButton.addEventListener('click', initDeck);
suitFilterSelect.addEventListener('change', (e) => loadFavorites(e.target.value, searchInput.value));
searchInput.addEventListener('input', (e) => loadFavorites(suitFilterSelect.value, e.target.value));
startMemoryButton.addEventListener('click', startMemoryGame);

// --- Selector de nivel de memoria ---
memoryLevelSelect.addEventListener('change', function() {
    currentMemoryLevel = parseInt(this.value);
    console.log("Nivel de memoria seleccionado:", currentMemoryLevel);
});

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        splashScreen.style.display = 'none';
        appContent.style.display = 'block';
        initDeck(); // Inicializar la baraja al cargar la aplicación
        // Inicializar el nivel del juego de memoria al cargar la página
        const initialMemoryLevel = parseInt(memoryLevelSelect.value);
        if (!isNaN(initialMemoryLevel)) {
            currentMemoryLevel = initialMemoryLevel;
            console.log("Nivel de memoria inicializado a:", currentMemoryLevel);
        }
    }, 2000); // Simula un tiempo de carga
});

// --- Navegación por pestañas ---
bottomNav.addEventListener('click', (event) => {
    if (event.target.classList.contains('tab-btn')) {
        const tab = event.target.dataset.tab;
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        event.target.classList.add('active');
        document.getElementById(tab).classList.add('active');
        // Cargar datos específicos al cambiar de pestaña si es necesario
        if (tab === 'favoritos') {
            loadFavorites(suitFilterSelect.value, searchInput.value);
        }
    }
});