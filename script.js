if (typeof Phaser === 'undefined') {
  throw new Error("Phaser no está cargado. Asegúrate de incluir el script de Phaser antes de tu código.");
}

// Importaciones (Firebase ya configurado)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit 
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDU9eUVNvAhKoB_7fCR4YAQET3NIQwTAYA",
    authDomain: "logic-game-2bec1.firebaseapp.com",
    projectId: "logic-game-2bec1",
    storageBucket: "logic-game-2bec1.firebasestorage.app",
    messagingSenderId: "49694670172",
    appId: "1:49694670172:web:c2e1c8069124c4a05f9599"
  };
  

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Variables de estado
let currentDeckId = 'new';
let remainingCards = 52;
let drawnCards = 0;
let userFavorites = [];
let memoryGame = {
  cards: [],
  flippedCards: [],
  matchedPairs: 0,
  level: 1
};
let suitsStats = {
  HEARTS: 0,
  DIAMONDS: 0,
  CLUBS: 0,
  SPADES: 0
};
let suitsChart = null;

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  // Ocultar splash screen después de 2 segundos
  setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      checkAuthState();
  }, 2000);
  
  // Inicializar baraja
  shuffleDeck();
  
  // Configurar listeners de autenticación
  auth.onAuthStateChanged(user => {
      if (user) {
          // Usuario logueado
          document.getElementById('auth-forms').style.display = 'none';
          document.getElementById('profile-info').style.display = 'block';
          document.getElementById('profile-name').textContent = user.displayName || 'Usuario';
          document.getElementById('profile-email').textContent = user.email;
          loadUserProfile(user.uid);
          loadFavorites(user.uid);
      } else {
          // Usuario no logueado
          document.getElementById('auth-forms').style.display = 'block';
          document.getElementById('profile-info').style.display = 'none';
          document.getElementById('login-form').style.display = 'block';
          document.getElementById('register-form').style.display = 'none';
      }
  });
  
  // Cargar tema guardado
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.getElementById('theme-selector').value = savedTheme;
  
  // Mostrar pestaña inicial
  showTab('juego');
});

// Función para verificar estado de autenticación
function checkAuthState() {
  const user = auth.currentUser;
  const userInfo = document.getElementById('user-info');
  
  if (user) {
      userInfo.innerHTML = `
          <span>Hola, ${user.displayName || 'Usuario'}</span>
          <button onclick="logoutUser()" class="btn small">
              <i class="fas fa-sign-out-alt"></i>
          </button>
      `;
  } else {
      userInfo.innerHTML = '<span>No has iniciado sesión</span>';
  }
}

// Funciones para la API Deck of Cards
async function shuffleDeck() {
  try {
      const response = await fetch(`https://deckofcardsapi.com/api/deck/${currentDeckId}/shuffle/`);
      const data = await response.json();
      
      if (data.success) {
          currentDeckId = data.deck_id;
          remainingCards = data.remaining;
          document.getElementById('remaining-cards').textContent = remainingCards;
          
          // Reiniciar estadísticas de palos
          suitsStats = { HEARTS: 0, DIAMONDS: 0, CLUBS: 0, SPADES: 0 };
          updateStats();
          
          return true;
      } else {
          throw new Error('No se pudo barajar el mazo');
      }
  } catch (error) {
      console.error('Error al barajar:', error);
      alert('Error al barajar el mazo. Intenta nuevamente.');
      return false;
  }
}

async function drawCard() {
  try {
      const response = await fetch(`https://deckofcardsapi.com/api/deck/${currentDeckId}/draw/?count=1`);
      const data = await response.json();
      
      if (data.success && data.cards.length > 0) {
          const card = data.cards[0];
          remainingCards = data.remaining;
          drawnCards++;
          
          // Actualizar UI
          document.getElementById('remaining-cards').textContent = remainingCards;
          displayCard(card);
          
          // Actualizar estadísticas
          suitsStats[card.suit]++;
          updateStats();
          
          return card;
      } else {
          if (data.remaining === 0) {
              const reshuffle = confirm('No quedan cartas en el mazo. ¿Quieres barajar de nuevo?');
              if (reshuffle) {
                  await shuffleDeck();
                  return drawCard();
              }
          } else {
              throw new Error('No se pudo robar carta');
          }
      }
  } catch (error) {
      console.error('Error al robar carta:', error);
      alert('Error al robar carta. Intenta nuevamente.');
      return null;
  }
}

function displayCard(card) {
  const cardDisplay = document.getElementById('card-display');
  
  cardDisplay.innerHTML = `
      <div class="card">
          <img src="${card.image}" alt="${card.value} of ${card.suit}" class="card-image">
          <div class="card-info">
              <h3>${card.value} of ${translateSuit(card.suit)}</h3>
              <p>Código: ${card.code}</p>
              <div class="card-actions">
                  <button onclick="addToFavorites('${card.code}', '${card.value}', '${card.suit}', '${card.image}')" 
                          class="btn">
                      <i class="fas fa-heart"></i> Favorito
                  </button>
              </div>
          </div>
      </div>
  `;
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

// Funciones de Favoritos
async function addToFavorites(code, value, suit, image) {
  const user = auth.currentUser;
  if (!user) {
      alert('Debes iniciar sesión para guardar favoritos');
      showTab('perfil');
      return;
  }
  
  try {
      // Verificar si ya existe
      const existing = userFavorites.find(fav => fav.code === code);
      if (existing) {
          alert('Esta carta ya está en tus favoritos');
          return;
      }
      
      // Añadir a Firestore
      await db.collection('users').doc(user.uid).collection('favorites').add({
          code,
          value,
          suit,
          image,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Actualizar lista local
      await loadFavorites(user.uid);
      alert('Carta añadida a favoritos');
  } catch (error) {
      console.error('Error al añadir favorito:', error);
      alert('Error al guardar favorito');
  }
}

async function loadFavorites(userId) {
  try {
      const snapshot = await db.collection('users').doc(userId).collection('favorites')
          .orderBy('createdAt', 'desc')
          .get();
      
      userFavorites = [];
      const favoritesList = document.getElementById('favorites-list');
      favoritesList.innerHTML = '';
      
      snapshot.forEach(doc => {
          const fav = doc.data();
          fav.id = doc.id;
          userFavorites.push(fav);
          
          favoritesList.innerHTML += `
              <div class="favorite-card">
                  <img src="${fav.image}" alt="${fav.value} of ${fav.suit}">
                  <p>${fav.value} de ${translateSuit(fav.suit)}</p>
                  <button onclick="removeFavorite('${doc.id}')" class="btn small">
                      <i class="fas fa-trash"></i> Eliminar
                  </button>
              </div>
          `;
      });
      
      document.getElementById('total-favorites').textContent = userFavorites.length;
      return userFavorites;
  } catch (error) {
      console.error('Error cargando favoritos:', error);
      return [];
  }
}

async function removeFavorite(favId) {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
      await db.collection('users').doc(user.uid).collection('favorites').doc(favId).delete();
      await loadFavorites(user.uid);
  } catch (error) {
      console.error('Error eliminando favorito:', error);
      alert('Error al eliminar favorito');
  }
}

function filterFavorites() {
  const suitFilter = document.getElementById('suit-filter').value;
  const filtered = suitFilter 
      ? userFavorites.filter(fav => fav.suit === suitFilter)
      : userFavorites;
  
  const favoritesList = document.getElementById('favorites-list');
  favoritesList.innerHTML = '';
  
  filtered.forEach(fav => {
      favoritesList.innerHTML += `
          <div class="favorite-card">
              <img src="${fav.image}" alt="${fav.value} of ${fav.suit}">
              <p>${fav.value} de ${translateSuit(fav.suit)}</p>
              <button onclick="removeFavorite('${fav.id}')" class="btn small">
                  <i class="fas fa-trash"></i> Eliminar
              </button>
          </div>
      `;
  });
}

// Funciones de Autenticación
async function loginUser(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
      await auth.signInWithEmailAndPassword(email, password);
      alert('Inicio de sesión exitoso');
  } catch (error) {
      console.error('Error en login:', error);
      alert('Error al iniciar sesión: ' + error.message);
  }
}

async function registerUser(event) {
  event.preventDefault();
  
  const formData = {
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value,
      birthdate: document.getElementById('birthdate').value,
      username: document.getElementById('username').value,
      country: document.getElementById('country').value,
      interests: document.getElementById('interests').value
  };
  
  try {
      // Crear usuario en Authentication
      const userCredential = await auth.createUserWithEmailAndPassword(
          formData.email, 
          formData.password
      );
      
      // Guardar datos adicionales en Firestore
      await db.collection('users').doc(userCredential.user.uid).set({
          name: formData.name,
          email: formData.email,
          birthdate: formData.birthdate,
          username: formData.username,
          country: formData.country,
          interests: formData.interests,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Actualizar perfil
      await userCredential.user.updateProfile({
          displayName: formData.name
      });
      
      alert('Registro exitoso!');
      showTab('juego');
  } catch (error) {
      console.error('Error en registro:', error);
      alert('Error en registro: ' + error.message);
  }
}

async function logoutUser() {
  try {
      await auth.signOut();
      alert('Sesión cerrada correctamente');
  } catch (error) {
      console.error('Error al cerrar sesión:', error);
      alert('Error al cerrar sesión');
  }
}

async function loadUserProfile(userId) {
  try {
      const doc = await db.collection('users').doc(userId).get();
      if (doc.exists) {
          const data = doc.data();
          document.getElementById('profile-name').textContent = data.name;
          document.getElementById('profile-email').textContent = data.email;
          document.getElementById('profile-country').textContent = data.country;
      }
  } catch (error) {
      console.error('Error cargando perfil:', error);
  }
}

// Funciones de UI
function showTab(tabId) {
  // Ocultar todas las pestañas
  document.querySelectorAll('.tab-content').forEach(tab => {
      tab.classList.remove('active');
  });
  
  // Mostrar la pestaña seleccionada
  document.getElementById(tabId).classList.add('active');
  
  // Actualizar botones de navegación
  document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.remove('active');
  });
  
  document.querySelector(`.tab-btn[onclick="showTab('${tabId}')"]`).classList.add('active');
  
  // Actualizar contenido según la pestaña
  if (tabId === 'estadisticas') {
      updateStats();
  } else if (tabId === 'memoria') {
      resetMemoryGame();
  }
}

function showLoginForm() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
}

function showRegisterForm() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
}

function filterCards() {
  const searchTerm = document.getElementById('search').value.toLowerCase();
  // Implementación de búsqueda (puedes expandir esto)
  console.log('Buscando:', searchTerm);
}

function updateStats() {
  document.getElementById('total-drawn').textContent = drawnCards;
  document.getElementById('total-favorites').textContent = userFavorites.length;
  
  // Actualizar gráfico de palos
  const ctx = document.getElementById('suits-chart').getContext('2d');
  const labels = ['Corazones', 'Diamantes', 'Tréboles', 'Picas'];
  const data = [
      suitsStats.HEARTS,
      suitsStats.DIAMONDS,
      suitsStats.CLUBS,
      suitsStats.SPADES
  ];
  
  if (suitsChart) {
      suitsChart.data.datasets[0].data = data;
      suitsChart.update();
  } else {
      suitsChart = new Chart(ctx, {
          type: 'bar',
          data: {
              labels: labels,
              datasets: [{
                  label: 'Cartas por palo',
                  data: data,
                  backgroundColor: [
                      'rgba(255, 99, 132, 0.7)',
                      'rgba(54, 162, 235, 0.7)',
                      'rgba(255, 206, 86, 0.7)',
                      'rgba(75, 192, 192, 0.7)'
                  ],
                  borderColor: [
                      'rgba(255, 99, 132, 1)',
                      'rgba(54, 162, 235, 1)',
                      'rgba(255, 206, 86, 1)',
                      'rgba(75, 192, 192, 1)'
                  ],
                  borderWidth: 1
              }]
          },
          options: {
              responsive: true,
              scales: {
                  y: {
                      beginAtZero: true
                  }
              }
          }
      });
  }
}

// Funciones del juego de memoria (funcionalidad única)
async function startMemoryGame() {
  try {
      // Obtener 8 cartas únicas (4 pares)
      const response = await fetch(`https://deckofcardsapi.com/api/deck/${currentDeckId}/draw/?count=8`);
      const data = await response.json();
      
      if (data.success) {
          memoryGame.cards = [];
          memoryGame.flippedCards = [];
          memoryGame.matchedPairs = 0;
          
          // Duplicar las cartas para hacer pares
          const cards = data.cards;
          const pairedCards =