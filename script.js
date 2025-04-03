if (typeof Phaser === 'undefined') {
  throw new Error("Phaser no está cargado. Asegúrate de incluir el script de Phaser antes de tu código.");
}

// Importar Firebase y sus módulos
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDU9eUVNvAhKoB_7fCR4YAQET3NIQwTAYA",
  authDomain: "logic-game-2bec1.firebaseapp.com",
  projectId: "logic-game-2bec1",
  storageBucket: "logic-game-2bec1.appspot.com",
  messagingSenderId: "49694670172",
  appId: "1:49694670172:web:c2e1c8069124c4a05f9599"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variables globales
let currentDeckId = 'new';
let remainingCards = 52;
let userFavorites = [];
let currentUser = null;

// ======================
// FUNCIONES DE LA API DECK OF CARDS
// ======================

// Inicializar baraja
async function initDeck() {
  try {
    const response = await fetch('https://deckofcardsapi.com/api/deck/new/shuffle/');
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

// Robar carta
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
      displayCard(card);
      return card;
    }
  } catch (error) {
    console.error("Error al robar carta:", error);
    throw error;
  }
}

// Mostrar carta en la UI
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

// Guardar carta favorita
async function saveFavorite(code, value, suit, image) {
  if (!currentUser) {
    alert("Debes iniciar sesión para guardar favoritos");
    return;
  }

  try {
    await addDoc(collection(db, `users/${currentUser.uid}/favorites`), {
      code,
      value,
      suit,
      image,
      createdAt: serverTimestamp()
    });
    alert("¡Carta guardada en favoritos!");
    loadFavorites();
  } catch (error) {
    console.error("Error al guardar favorito:", error);
    alert("Error al guardar: " + error.message);
  }
}

// Cargar favoritos
async function loadFavorites() {
  if (!currentUser) return;

  try {
    const snapshot = await getDocs(collection(db, `users/${currentUser.uid}/favorites`));
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

// Eliminar favorito
async function deleteFavorite(favId) {
  try {
    await deleteDoc(doc(db, `users/${currentUser.uid}/favorites`, favId));
    loadFavorites();
  } catch (error) {
    console.error("Error eliminando favorito:", error);
    alert("No se pudo eliminar. Intenta nuevamente.");
  }
}

// ======================
// AUTENTICACIÓN
// ======================

// Registrar usuario
async function registerUser(email, password, userData) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;
    alert("Usuario registrado con éxito");
    return userCredential;
  } catch (error) {
    console.error("Error en registro:", error);
    throw error;
  }
}

// Iniciar sesión
async function loginUser(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    currentUser = userCredential.user;
    loadFavorites();
    return userCredential;
  } catch (error) {
    console.error("Error en login:", error);
    throw error;
  }
}

// Cerrar sesión
async function logoutUser() {
  try {
    await signOut(auth);
    currentUser = null;
    userFavorites = [];
    alert("Sesión cerrada");
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    throw error;
  }
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

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    loadFavorites();
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  await initDeck();
});