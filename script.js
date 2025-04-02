if (typeof Phaser === 'undefined') {
  throw new Error("Phaser no está cargado. Asegúrate de incluir el script de Phaser antes de tu código.");
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { 
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { 
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDU9eUVNvAhKoB_7fCR4YAQET3NIQwTAYA",
    authDomain: "logic-game-2bec1.firebaseapp.com",
    projectId: "logic-game-2bec1",
    storageBucket: "logic-game-2bec1.firebasestorage.app",
    messagingSenderId: "49694670172",
    appId: "1:49694670172:web:c2e1c8069124c4a05f9599"
  };
  

/// 2. Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// 3. Variables globales
let currentDeckId = 'new';
let remainingCards = 52;
let userFavorites = [];
let currentUser = null;
let suitsStats = {
  HEARTS: 0,
  DIAMONDS: 0,
  CLUBS: 0,
  SPADES: 0
};

// ======================
// FUNCIONES DE LA API
// ======================

// 1. Inicializar baraja
async function initDeck() {
  try {
    const response = await fetch(`https://deckofcardsapi.com/api/deck/new/shuffle/`);
    const data = await response.json();
    currentDeckId = data.deck_id;
    remainingCards = data.remaining;
    updateUI();
    return data;
  } catch (error) {
    console.error("Error al inicializar baraja:", error);
    throw error;
  }
}

// 2. Robar carta
async function drawCard() {
  if (remainingCards <= 0) {
    alert("¡No quedan cartas! Barajeando nuevo mazo...");
    await initDeck();
    return;
  }

  try {
    const response = await fetch(`https://deckofcardsapi.com/api/deck/${currentDeckId}/draw/?count=1`);
    const data = await response.json();
    
    if (data.success) {
      remainingCards = data.remaining;
      const card = data.cards[0];
      
      // Actualizar estadísticas
      suitsStats[card.suit]++;
      updateStats();
      
      // Mostrar carta
      displayCard(card);
      return card;
    }
  } catch (error) {
    console.error("Error al robar carta:", error);
    throw error;
  }
}

// 3. Mostrar carta en UI
function displayCard(card) {
  const cardDisplay = document.getElementById('card-display');
  cardDisplay.innerHTML = `
    <div class="card">
      <img src="${card.image}" alt="${card.value} of ${card.suit}">
      <div class="card-info">
        <h3>${translateValue(card.value)} de ${translateSuit(card.suit)}</h3>
        <button onclick="saveFavorite('${card.code}', '${card.value}', '${card.suit}', '${card.image}')">
          <i class="fas fa-heart"></i> Guardar
        </button>
      </div>
    </div>
  `;
}

// ======================
// FUNCIONES DE FIREBASE
// ======================

// 1. Guardar favorito
async function saveFavorite(code, value, suit, image) {
  if (!currentUser) {
    alert("Debes iniciar sesión para guardar favoritos");
    showTab('perfil');
    return;
  }

  try {
    await db.collection('users').doc(currentUser.uid).collection('favorites').add({
      code,
      value,
      suit,
      image,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("¡Carta guardada en favoritos!");
    loadFavorites();
  } catch (error) {
    console.error("Error al guardar favorito:", error);
    alert("Error al guardar: " + error.message);
  }
}

// 2. Cargar favoritos
async function loadFavorites() {
  if (!currentUser) return;

  try {
    const snapshot = await db.collection('users').doc(currentUser.uid)
      .collection('favorites')
      .orderBy('createdAt', 'desc')
      .get();

    userFavorites = [];
    const favoritesList = document.getElementById('favorites-list');
    favoritesList.innerHTML = '';

    snapshot.forEach(doc => {
      const card = doc.data();
      userFavorites.push({ id: doc.id, ...card });
      
      favoritesList.innerHTML += `
        <div class="favorite-item">
          <img src="${card.image}" alt="${card.value}">
          <button onclick="deleteFavorite('${doc.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;
    });
  } catch (error) {
    console.error("Error cargando favoritos:", error);
  }
}

// 3. Eliminar favorito
async function deleteFavorite(favId) {
  try {
    await db.collection('users').doc(currentUser.uid)
      .collection('favorites')
      .doc(favId)
      .delete();
    loadFavorites();
  } catch (error) {
    console.error("Error eliminando favorito:", error);
  }
}

// ======================
// AUTENTICACIÓN
// ======================

// 1. Registrar usuario
async function registerUser(email, password, userData) {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    
    // Guardar datos adicionales
    await db.collection('users').doc(userCredential.user.uid).set({
      ...userData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    currentUser = userCredential.user;
    updateUI();
    return userCredential;
  } catch (error) {
    console.error("Error en registro:", error);
    throw error;
  }
}

// 2. Iniciar sesión
async function loginUser(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    currentUser = userCredential.user;
    loadFavorites();
    updateUI();
    return userCredential;
  } catch (error) {
    console.error("Error en login:", error);
    throw error;
  }
}

// 3. Cerrar sesión
async function logoutUser() {
  try {
    await auth.signOut();
    currentUser = null;
    userFavorites = [];
    updateUI();
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    throw error;
  }
}

// ======================
// FUNCIONALIDADES UI
// ======================

// 1. Mostrar/ocultar pestañas
function showTab(tabId) {
  // Ocultar todas las pestañas
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.style.display = 'none';
  });
  
  // Mostrar la seleccionada
  document.getElementById(tabId).style.display = 'block';
  
  // Actualizar navegación
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.nav-btn[data-tab="${tabId}"]`).classList.add('active');
}

// 2. Actualizar UI según estado
function updateUI() {
  const userSection = document.getElementById('user-section');
  
  if (currentUser) {
    userSection.innerHTML = `
      <p>Bienvenido, ${currentUser.email}</p>
      <button onclick="logoutUser()">Cerrar sesión</button>
    `;
    document.getElementById('login-form').style.display = 'none';
  } else {
    userSection.innerHTML = '';
    document.getElementById('login-form').style.display = 'block';
  }
}

// 3. Filtro de búsqueda
function filterCards() {
  const searchTerm = document.getElementById('search').value.toLowerCase();
  const filtered = userFavorites.filter(card => 
    card.value.toLowerCase().includes(searchTerm) || 
    card.suit.toLowerCase().includes(searchTerm)
  );
  
  renderFilteredFavorites(filtered);
}

// ======================
// FUNCIONES AUXILIARES
// ======================

function translateSuit(suit) {
  const suits = {
    'HEARTS': 'Corazones',
    'DIAMONDS': 'Diamantes',
    'CLUBS': 'Tréboles',
    'SPADES': 'Picas'
  };
  return suits[suit] || suit;
}

function translateValue(value) {
  const values = {
    'ACE': 'As',
    'KING': 'Rey',
    'QUEEN': 'Reina',
    'JACK': 'Jota'
  };
  return values[value] || value;
}

function updateStats() {
  document.getElementById('remaining-cards').textContent = remainingCards;
  document.getElementById('total-favorites').textContent = userFavorites.length;
}

function translateSuit(suit) {
  const suits = {
      'HEARTS': 'Corazones',
      'DIAMONDS': 'Diamantes',
      'CLUBS': 'Tréboles',
      'SPADES': 'Picas'
  };
  return suits[suit] || suit;
}

function translateValue(value) {
  const values = {
      'ACE': 'As',
      'KING': 'Rey',
      'QUEEN': 'Reina',
      'JACK': 'Jota',
      '10': '10',
      '9': '9',
      '8': '8',
      '7': '7',
      '6': '6',
      '5': '5',
      '4': '4',
      '3': '3',
      '2': '2'
  };
  return values[value] || value;
}

// ======================
// INICIALIZACIÓN
// ======================

// 1. Escuchar cambios de autenticación
auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    loadFavorites();
  }
  updateUI();
});

// 2. Inicializar al cargar la página
window.addEventListener('DOMContentLoaded', async () => {
  // Ocultar splash screen después de 2 segundos
  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
  }, 2000);
  
  // Inicializar baraja
  await initDeck();
  
  // Mostrar pestaña por defecto
  showTab('juego');
});

// ======================
// EVENT LISTENERS
// ======================

document.getElementById('draw-btn').addEventListener('click', drawCard);
document.getElementById('search').addEventListener('input', filterCards);
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;
  const userData = {
    name: e.target.name.value,
    birthdate: e.target.birthdate.value
  };
  await registerUser(email, password, userData);
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;
  await loginUser(email, password);
});

// Variables globales
let currentDeckId = 'new';
let remainingCards = 52;
let userFavorites = [];
let currentCard = null;

// Inicialización al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    // Ocultar splash screen después de 2 segundos
    setTimeout(() => {
        document.getElementById('splash').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
    }, 2000);

    // Iniciar sesión anónima en Firebase
    try {
        await firebaseAuth.signInAnonymously();
        console.log("Autenticación anónima exitosa");
        await loadFavorites();
    } catch (error) {
        console.error("Error en autenticación:", error);
    }

    // Inicializar baraja
    await shuffleDeck();
});

// ======================
// Funciones de la API Deck of Cards
// ======================
async function shuffleDeck() {
    try {
        const response = await fetch(`https://deckofcardsapi.com/api/deck/new/shuffle/`);
        const data = await response.json();
        currentDeckId = data.deck_id;
        remainingCards = data.remaining;
        updateDeckInfo();
        return data;
    } catch (error) {
        console.error("Error al barajar:", error);
    }
}

async function drawCard() {
    if (remainingCards <= 0) {
        alert("¡Mazo vacío! Barajeando nuevo mazo...");
        await shuffleDeck();
        return;
    }

    try {
        const response = await fetch(`https://deckofcardsapi.com/api/deck/${currentDeckId}/draw/?count=1`);
        const data = await response.json();
        
        if (data.success) {
            remainingCards = data.remaining;
            currentCard = data.cards[0];
            displayCard(currentCard);
            updateDeckInfo();
            return currentCard;
        }
    } catch (error) {
        console.error("Error al robar carta:", error);
    }
}

function displayCard(card) {
    const cardDisplay = document.getElementById('card-display');
    cardDisplay.innerHTML = `
        <img src="${card.image}" alt="${card.value} of ${card.suit}" class="card-image">
        <div class="card-details">
            <h3>${translateValue(card.value)} de ${translateSuit(card.suit)}</h3>
            <button onclick="saveFavorite()" class="save-btn">
                <i class="fas fa-heart"></i> Guardar
            </button>
        </div>
    `;
}

// ======================
// Funciones de Firebase
// ======================
async function saveFavorite() {
    if (!currentCard) return;

    try {
        await firebaseDb.collection("favorites").add({
            code: currentCard.code,
            value: currentCard.value,
            suit: currentCard.suit,
            image: currentCard.image,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("¡Carta guardada en favoritos!");
        await loadFavorites();
    } catch (error) {
        console.error("Error al guardar favorito:", error);
    }
}

async function loadFavorites() {
    try {
        const snapshot = await firebaseDb.collection("favorites")
            .orderBy("timestamp", "desc")
            .get();
        
            userFavorites = [];
            const favoritesList = document.getElementById('favorites-list');
            favoritesList.innerHTML = ''; // Limpiar la lista antes de agregar nuevos elementos
            
            snapshot.forEach(doc => {
                const card = doc.data();
                userFavorites.push({ 
                    id: doc.id, 
                    code: card.code,
                    value: card.value,
                    suit: card.suit,
                    image: card.image,
                    timestamp: card.timestamp?.toDate() || new Date()
                });
                
                // Crear elemento HTML para cada carta favorita
                const favoriteItem = document.createElement('div');
                favoriteItem.className = 'favorite-item';
                favoriteItem.innerHTML = `
                    <img src="${card.image}" alt="${card.value} of ${card.suit}" class="favorite-img">
                    <div class="favorite-info">
                        <span>${translateValue(card.value)} de ${translateSuit(card.suit)}</span>
                        <button onclick="deleteFavorite('${doc.id}')" class="delete-btn">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                `;
                
                favoritesList.appendChild(favoriteItem);
            });
            
            // Actualizar contador de favoritos
            document.getElementById('favorites-count').textContent = userFavorites.length;