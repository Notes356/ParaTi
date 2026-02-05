// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getDatabase, ref, set, update, get, onValue, remove, child } 
    from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAnYkdRY_LhrJwpClgfWs38iP2mfxyc2tk",
    authDomain: "declaracion-final.firebaseapp.com",
    projectId: "declaracion-final",
    storageBucket: "declaracion-final.firebasestorage.app",
    messagingSenderId: "288671326547",
    appId: "1:288671326547:web:e549d8d79e951e408e41a6"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Exportamos todo lo necesario
export { db, ref, set, update, get, onValue, remove, child };
