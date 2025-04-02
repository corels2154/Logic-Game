<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
const firebaseConfig = {
    apiKey: "AIzaSyDU9eUVNvAhKoB_7fCR4YAQET3NIQwTAYA",
    authDomain: "logic-game-2bec1.firebaseapp.com",
    projectId: "logic-game-2bec1",
    storageBucket: "logic-game-2bec1.firebasestorage.app",
    messagingSenderId: "49694670172",
    appId: "1:49694670172:web:c2e1c8069124c4a05f9599"
  };
  
  };
  
  // Initialize Firebase
  const app = firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore(app);
</script>
// Conexión con Deck of Cards API
const deckId = "new"; // Genera una nueva baraja
let deck;

async function getDeck() {
  const response = await fetch(`https://deckofcardsapi.com/api/deck/${deckId}/shuffle/`);
  const data = await response.json();
  deck = data;
  console.log("Baraja generada: ", deck);
}

// Robar cartas aleatorias
async function drawCard() {
  if (!deck) {
    console.error("No hay baraja disponible. Por favor, genera una primero.");
    return;
  }

  const response = await fetch(`https://deckofcardsapi.com/api/deck/${deckId}/draw/?count=1`);
  const data = await response.json();
  const card = data.cards[0];
  displayCard(card);
}
// Guardar cartas favoritas en Firebase Firestore
async function saveFavorite(card) {
    try {
      const docRef = await db.collection("favorites").add({
        value: card.value,
        suit: card.suit,
        image: card.image,
      });
      console.log("Carta favorita guardada con ID: ", docRef.id);
    } catch (error) {
      console.error("Error al guardar la carta favorita: ", error);
    }
  }
  async function getFavorites() {
    try {
      const querySnapshot = await db.collection("favorites").get();
      querySnapshot.forEach((doc) => {
        const card = doc.data();
        console.log("Carta favorita: ", card);
        // Mostrar las cartas favoritas en la interfaz
      });
    } catch (error) {
      console.error("Error al recuperar las cartas favoritas: ", error);
    }
  }
    

// Mostrar la carta robada
function displayCard(card) {
  const cardContainer = document.getElementById("card-container");
  const cardElement = document.createElement("img");
  cardElement.src = card.image;
  cardElement.alt = `${card.value} of ${card.suit}`;
  cardElement.className = "card";
  cardContainer.innerHTML = '';  // Limpiar el contenedor
  cardContainer.appendChild(cardElement);
}

// **Firebase: Guardar favoritos**
const db = firebase.firestore();

async function saveFavorite(card) {
  try {
    const docRef = await db.collection("favorites").add({
      value: card.value,
      suit: card.suit,
      image: card.image,
    });
    console.log("Carta favorita guardada: ", docRef.id);
  } catch (error) {
    console.error("Error al guardar favorito: ", error);
  }
}

// Función para manejar el formulario de registro
document.getElementById("register-form").addEventListener("submit", function(event) {
  event.preventDefault();
  
  // Validación de los campos
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  
  if (username === "" || email === "") {
    alert("Por favor, llena todos los campos.");
    return;
  }
  
  // Guardar el registro en Firebase (esto es un ejemplo, puedes extenderlo)
  const usersRef = db.collection("users");
  usersRef.add({
    username: username,
    email: email,
  })
  .then(() => {
    alert("¡Registro exitoso!");
    document.getElementById("register-form").reset();  // Limpiar el formulario
  })
  .catch((error) => {
    console.error("Error al registrar el usuario: ", error);
    alert("Hubo un error en el registro.");
  });
});

// Llamada inicial para generar una nueva baraja
getDeck();

