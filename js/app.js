// Importar Firebase y sus módulos (Asegúrate que las rutas sean correctas si los descargas)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc, getDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// ======================
// CONFIGURACIÓN DE FIREBASE (¡¡¡IMPORTANTE: RELLENA ESTO!!!)
// ======================
const firebaseConfig = {
  apiKey: "TU_API_KEY", // <-- RELLENA ESTO
  authDomain: "TU_AUTH_DOMAIN", // logic-game-2bec1.firebaseapp.com <-- RELLENA ESTO
  projectId: "TU_PROJECT_ID", // logic-game-2bec1 <-- RELLENA ESTO
  storageBucket: "TU_STORAGE_BUCKET", // logic-game-2bec1.appspot.com <-- RELLENA ESTO
  messagingSenderId: "TU_MESSAGING_SENDER_ID", // <-- RELLENA ESTO
  appId: "TU_APP_ID" // <-- RELLENA ESTO
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

async function loadFavorites() {
  if (!currentUser) {
      userFavorites = [];
      displayFavorites(); // Mostrar lista vacía si no hay usuario
      return;
  }
  console.log("Cargando favoritos para:", currentUser.uid);

  try {
    const favCollection = collection(db, `users/${currentUser.uid}/favorites`);
    const q = query(favCollection, orderBy("createdAt", "desc")); // Ordenar por fecha
    const snapshot = await getDocs(q);

    userFavorites = []; // Limpiar antes de llenar
    snapshot.forEach(doc => {
      userFavorites.push({ id: doc.id, ...doc.data() });
    });
    console.log("Favoritos cargados:", userFavorites.length);
    displayFavorites(); // Mostrar los favoritos cargados
    updateFavoritesCount(); // Actualizar contador

    // Si hay una carta mostrándose, actualizar su botón de favorito
    if (currentCard) {
        displayCard(currentCard);
    }

  } catch (error) {
    console.error("Error cargando favoritos:", error);
    alert("No se pudieron cargar tus favoritos.");
    userFavorites = []; // Asegurar que esté vacío en caso de error
    displayFavorites();
    updateFavoritesCount();
  }
}

async function deleteFavorite(favId, buttonElement = null) {
  if (!currentUser) return;

   if (buttonElement) {
        buttonElement.disabled = true;
        buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Borrando...';
    }
  console.log("Eliminando favorito:", favId);

  try {
    await deleteDoc(doc(db, `users/${currentUser.uid}/favorites`, favId));
    console.log("Favorito eliminado.");
    // No mostrar alert, el cambio visual es suficiente
    await loadFavorites(); // Recargar para actualizar UI

    // Si la carta actual era la eliminada, actualizar su display
     if (currentCard && cardDisplay.contains(buttonElement) && buttonElement.dataset.code === currentCard.code) {
        displayCard(currentCard);
    }

  } catch (error) {
    console.error("Error eliminando favorito:", error);
    alert("No se pudo eliminar el favorito. Intenta nuevamente.");
    // Restaurar botón si estaba asociado a la carta actual
     if (buttonElement && cardDisplay.contains(buttonElement)) {
        buttonElement.disabled = false;
        buttonElement.innerHTML = '<i class="fas fa-heart"></i> Guardada'; // Asumiendo que estaba guardada
    }
  }
}

// ======================
// FUNCIONES DE AUTENTICACIÓN (Firebase Auth)
// ======================

async function handleRegisterSubmit(event) {
    event.preventDefault(); // Evitar recarga de página
    registerErrorP.style.display = 'none'; // Ocultar error previo
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const birthdate = document.getElementById('register-birthdate').value;
    const username = document.getElementById('register-username').value;
    const country = document.getElementById('register-country').value;
    const interests = document.getElementById('register-interests').value;

    if (password.length < 6) {
        showAuthError(registerErrorP, "La contraseña debe tener al menos 6 caracteres.");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;
        console.log("Usuario registrado:", currentUser.uid);

        // Ahora guarda los datos adicionales en Firestore
        const userData = { name, username, country, birthdate, interests, email };
        await saveUserData(currentUser.uid, userData);

        alert("¡Registro exitoso! Has iniciado sesión.");
        updateUIAfterLogin(userData); // Actualiza UI con datos del perfil
        await loadFavorites(); // Cargar favoritos del nuevo usuario (estará vacío)

    } catch (error) {
        console.error("Error en registro:", error);
        showAuthError(registerErrorP, getFirebaseErrorMessage(error));
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    loginErrorP.style.display = 'none';
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        currentUser = userCredential.user;
        console.log("Usuario inició sesión:", currentUser.uid);

        // Cargar perfil de Firestore
        const userProfile = await loadUserProfile(currentUser.uid);

        alert("¡Inicio de sesión exitoso!");
        updateUIAfterLogin(userProfile); // Actualizar UI con datos
        await loadFavorites(); // Cargar favoritos

    } catch (error) {
        console.error("Error en login:", error);
         showAuthError(loginErrorP, getFirebaseErrorMessage(error));
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        console.log("Sesión cerrada");
        currentUser = null;
        userFavorites = [];
        currentCard = null; // Resetear carta
        // alert("Sesión cerrada"); // No necesario, el cambio de UI es suficiente
        updateUIAfterLogout();
        cardDisplay.innerHTML = '<p>Inicia sesión para jugar y guardar favoritos.</p>'; // Mensaje post-logout
        remainingCardsSpan.textContent = '--'; // Indicar que no hay juego activo
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        alert("Error al cerrar sesión: " + error.message);
    }
}

// Listener de cambio de estado de autenticación
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Usuario ha iniciado sesión o ya estaba logueado
    console.log("Auth state changed: Usuario logueado", user.uid);
    if (!currentUser || currentUser.uid !== user.uid) { // Solo actualizar si es un cambio real
        currentUser = user;
        const userProfile = await loadUserProfile(user.uid);
        updateUIAfterLogin(userProfile);
        await loadFavorites();
        if (!currentDeckId) { // Si no hay baraja (ej. al recargar página), inicializarla
            await initDeck();
        } else {
             // Si ya había una carta, actualizar su estado de favorito
            if (currentCard) displayCard(currentCard);
        }
    }
  } else {
    // Usuario ha cerrado sesión o no está logueado
     console.log("Auth state changed: Usuario no logueado");
    if (currentUser) { // Solo actualizar si realmente hubo un logout
        currentUser = null;
        userFavorites = [];
        updateUIAfterLogout();
    }
  }
  // Ocultar splash screen una vez que se resuelve el estado de auth
  hideSplashScreen();
});

// ======================
// FUNCIONES DE UI (Interfaz de Usuario)
// ======================

function updateGameUI() {
  remainingCardsSpan.textContent = remainingCards;
   // Habilitar/deshabilitar botones si es necesario (ej. si remaining es 0)
  drawButton.disabled = (remainingCards <= 0);
  shuffleButton.disabled = false; // Shuffle siempre debería estar activo (o casi siempre)
}

function displayFavorites() {
    favoritesListDiv.innerHTML = ''; // Limpiar lista actual
    const filterValue = suitFilterSelect.value;
    const searchTerm = searchInput.value.toLowerCase();

    const filteredFavorites = userFavorites.filter(card => {
        const suitMatch = !filterValue || card.suit === filterValue;
        const name = `${translateValue(card.value)} de ${translateSuit(card.suit)}`.toLowerCase();
        const searchMatch = !searchTerm || name.includes(searchTerm) || card.code.toLowerCase().includes(searchTerm);
        return suitMatch && searchMatch;
    });

    if (!currentUser) {
        favoritesListDiv.innerHTML = '<p>Inicia sesión para ver tus favoritos.</p>';
    } else if (filteredFavorites.length === 0 && userFavorites.length > 0) {
         favoritesListDiv.innerHTML = '<p>No hay favoritos que coincidan con tu filtro/búsqueda.</p>';
    } else if (userFavorites.length === 0) {
        favoritesListDiv.innerHTML = '<p>Aún no has guardado ninguna carta favorita.</p>';
    } else {
        filteredFavorites.forEach(card => {
            favoritesListDiv.innerHTML += `
                <div class="favorite-card">
                    <img src="${card.image}" alt="${translateValue(card.value)} de ${translateSuit(card.suit)}" loading="lazy">
                    <p>${translateValue(card.value)} ${translateSuit(card.suit)}</p>
                    <button class="delete-favorite-btn" data-id="${card.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        });
         // Añadir listeners a los botones de borrar recién creados
        addDeleteButtonListeners();
    }
     updateFavoritesCount(); // Actualizar contador total (no solo los filtrados)
}


function addDeleteButtonListeners() {
    document.querySelectorAll('.delete-favorite-btn').forEach(button => {
        // Remover listener previo si existiera para evitar duplicados
        button.removeEventListener('click', handleDeleteFavoriteClick);
        button.addEventListener('click', handleDeleteFavoriteClick);
    });
}

function handleDeleteFavoriteClick(event) {
    const favId = event.currentTarget.dataset.id;
    if (confirm("¿Seguro que quieres eliminar esta carta de tus favoritos?")) {
        deleteFavorite(favId);
    }
}

function updateFavoritesCount() {
    const count = userFavorites.length;
    favoritesCountSpan.textContent = count;
    // Actualizar también el contador en la sección de estadísticas si existe
    const totalFavoritesStat = document.getElementById('total-favorites');
    if (totalFavoritesStat) {
        totalFavoritesStat.textContent = count;
    }
}

function showTab(tabId) {
    // Ocultar todos los contenidos
    tabContents.forEach(content => content.classList.remove('active'));
    // Desactivar todos los botones
    tabButtons.forEach(button => button.classList.remove('active'));

    // Mostrar el contenido de la pestaña seleccionada
    const activeContent = document.getElementById(tabId);
    if (activeContent) {
        activeContent.classList.add('active');
    }

    // Activar el botón correspondiente
    const activeButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    console.log("Mostrando pestaña:", tabId);

    // Lógica adicional al cambiar de pestaña
    if (tabId === 'favoritos') {
        displayFavorites(); // Asegurarse que los favoritos se muestren al ir a la pestaña
    } else if (tabId === 'perfil') {
        // La lógica de mostrar login o perfil ya la maneja onAuthStateChanged
    }
}

function updateUIAfterLogin(userProfile) {
    // Ocultar formularios, mostrar perfil
    authFormsDiv.style.display = 'none';
    profileInfoDiv.style.display = 'block';
    loginFormContainer.style.display = 'none'; // Asegurar que ambos formularios estén ocultos
    registerFormContainer.style.display = 'none';

    // Llenar información del perfil
    profileNameH3.textContent = userProfile?.name || currentUser.email; // Usar email como fallback
    profileEmailP.textContent = currentUser.email;
    profileCountrySpan.textContent = userProfile?.country || '--';
    profileUsernameSpan.textContent = userProfile?.username || '--';
    // Podrías añadir lógica para la foto de perfil aquí si la guardas

    // Actualizar header
    userInfoHeaderDiv.innerHTML = `Bienvenido, ${userProfile?.name || currentUser.email}!`;

     // Habilitar botones de juego
    drawButton.disabled = false;
    shuffleButton.disabled = false;

    // Asegurar que la pestaña de perfil muestre la info y no los forms
    if(document.querySelector('.tab-btn.active')?.dataset.tab === 'perfil') {
         profileInfoDiv.style.display = 'block';
         authFormsDiv.style.display = 'none';
    }
    // Mostrar la carta actual y actualizar su botón de favorito
    if (currentCard) displayCard(currentCard);
}

function updateUIAfterLogout() {
    // Mostrar formularios, ocultar perfil
    authFormsDiv.style.display = 'block';
    profileInfoDiv.style.display = 'none';
    loginFormContainer.style.display = 'block'; // Mostrar login por defecto
    registerFormContainer.style.display = 'none';
    loginErrorP.style.display = 'none'; // Limpiar errores
    registerErrorP.style.display = 'none';

    // Limpiar info del perfil
    profileNameH3.textContent = 'Nombre Usuario';
    profileEmailP.textContent = 'correo@ejemplo.com';
    profileCountrySpan.textContent = '--';
    profileUsernameSpan.textContent = '--';

    // Actualizar header
    userInfoHeaderDiv.innerHTML = `<button id="login-header-btn" class="btn btn-small">Iniciar Sesión</button>`;
    // Añadir listener al nuevo botón del header
    document.getElementById('login-header-btn')?.addEventListener('click', () => showTab('perfil'));

    // Limpiar y actualizar UI de favoritos
    userFavorites = [];
    displayFavorites();
     // Limpiar display de carta
    cardDisplay.innerHTML = '<p>Inicia sesión para jugar y guardar favoritos.</p>';
    remainingCardsSpan.textContent = '--';

    // Deshabilitar botones de juego (o redirigir a login si se intentan usar)
    drawButton.disabled = true;
    // shuffleButton.disabled = true; // Shuffle podría quedar habilitado para ver la animación? O deshabilitar.

    // Si el usuario estaba en la pestaña perfil, asegurarse que vea el login
    if(document.querySelector('.tab-btn.active')?.dataset.tab === 'perfil') {
         profileInfoDiv.style.display = 'none';
         authFormsDiv.style.display = 'block';
         loginFormContainer.style.display = 'block';
         registerFormContainer.style.display = 'none';
    }
}

function changeTheme() {
    const selectedTheme = themeSelector.value;
    document.documentElement.setAttribute('data-theme', selectedTheme);
    localStorage.setItem('theme', selectedTheme); // Guardar preferencia
    console.log("Tema cambiado a:", selectedTheme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light'; // 'light' por defecto
    themeSelector.value = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function showAuthError(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

function getFirebaseErrorMessage(error) {
  // Mapeo básico de errores comunes de Firebase Auth a mensajes en español
  switch (error.code) {
    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';
    case 'auth/user-disabled':
      return 'Esta cuenta de usuario ha sido deshabilitada.';
    case 'auth/user-not-found':
      return 'No se encontró ningún usuario con este correo electrónico.';
    case 'auth/wrong-password':
      return 'La contraseña es incorrecta.';
    case 'auth/email-already-in-use':
      return 'Este correo electrónico ya está registrado.';
    case 'auth/operation-not-allowed':
      return 'El inicio de sesión con correo/contraseña no está habilitado.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil (debe tener al menos 6 caracteres).';
    case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Intenta de nuevo más tarde.';
    default:
      return `Error desconocido (${error.code}): ${error.message}`;
  }
}

function hideSplashScreen() {
    if (splashScreen) {
        splashScreen.style.opacity = '0';
        // Esperar que termine la transición antes de ocultarlo completamente
        setTimeout(() => {
            splashScreen.style.display = 'none';
            // Mostrar contenido de la app
            if(appContent) appContent.style.display = 'block';
        }, 500); // 500ms, debe coincidir con la duración de la transición en CSS si la hay
    } else {
         // Si no hay splash screen, solo mostrar el contenido
         if(appContent) appContent.style.display = 'block';
    }
}

// ======================
// FUNCIONES AUXILIARES
// ======================
function translateSuit(suit) {
  const suits = { 'HEARTS': 'Corazones', 'DIAMONDS': 'Diamantes', 'CLUBS': 'Tréboles', 'SPADES': 'Picas' };
  return suits[suit.toUpperCase()] || suit;
}

function translateValue(value) {
  const values = { 'ACE': 'As', 'KING': 'Rey', 'QUEEN': 'Reina', 'JACK': 'Jota' };
  return values[value.toUpperCase()] || value;
}

// ======================
// LÓGICA JUEGO DE MEMORIA (Placeholder - ¡Requiere implementación!)
// ======================
function startMemoryGame() {
    alert("¡El juego de memoria aún no está implementado!");
    memoryGameDiv.innerHTML = '<p style="text-align: center; color: orange;">Próximamente...</p>';
    // Aquí iría la lógica para:
    // 1. Decidir cuántos pares usar según el nivel.
    // 2. Robar N cartas únicas de la API (o usar un conjunto predefinido).
    // 3. Duplicar las cartas para tener pares.
    // 4. Barajar los pares.
    // 5. Crear los elementos HTML para las cartas boca abajo en `memoryGameDiv`.
    // 6. Añadir event listeners a las cartas para voltearlas.
    // 7. Implementar la lógica de matching, conteo de intentos, fin de juego, etc.
}

// ======================
// INICIALIZACIÓN Y EVENT LISTENERS
// ======================
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM cargado. Configurando listeners...");

  loadTheme(); // Cargar tema guardado al inicio

  // --- Listeners de Botones Principales ---
  if(drawButton) drawButton.addEventListener('click', drawCardAction);
  if(shuffleButton) shuffleButton.addEventListener('click', initDeck); // Barajar es inicializar nueva baraja
  if(logoutButton) logoutButton.addEventListener('click', handleLogout);
  if(startMemoryButton) startMemoryButton.addEventListener('click', startMemoryGame);

  // --- Listeners Formularios Auth ---
  if(loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
  if(registerForm) registerForm.addEventListener('submit', handleRegisterSubmit);
  if(showRegisterLink) showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginFormContainer.style.display = 'none';
      registerFormContainer.style.display = 'block';
      registerErrorP.style.display = 'none'; // Limpiar error
  });
  if(showLoginLink) showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      registerFormContainer.style.display = 'none';
      loginFormContainer.style.display = 'block';
       loginErrorP.style.display = 'none'; // Limpiar error
  });

   // --- Listeners Navegación ---
  if (bottomNav) {
      bottomNav.addEventListener('click', (event) => {
          const targetButton = event.target.closest('.tab-btn'); // Buscar el botón padre
          if (targetButton && targetButton.dataset.tab) {
              showTab(targetButton.dataset.tab);
          }
      });
  }

  // --- Listeners Filtros y Búsqueda ---
   if(suitFilterSelect) suitFilterSelect.addEventListener('change', displayFavorites);
   if(searchInput) searchInput.addEventListener('input', displayFavorites); // Filtrar al escribir

   // --- Listener Ajustes ---
   if(themeSelector) themeSelector.addEventListener('change', changeTheme);

  // Inicializar la primera pestaña (Juego por defecto)
  showTab('juego');

  // La inicialización de la baraja y el estado de auth se manejan con onAuthStateChanged
  // para asegurar que Firebase esté listo y sepamos si hay usuario.
  // La llamada inicial a hideSplashScreen() también se movió a onAuthStateChanged.

   // Si no se usa Firebase Auth o falla, podríamos necesitar iniciar la baraja aquí
   // if (!auth) { initDeck(); hideSplashScreen(); }
   // Pero la lógica actual depende de onAuthStateChanged para el flujo principal.

});

// Nota: La comprobación de Phaser fue eliminada ya que no se usa.
// Nota: La implementación de Estadísticas (gráfico) y Juego de Memoria requiere código adicional significativo.