/* =============================================================================
   LOGIC.JS - MOTOR DEL JUEGO "EL HORIZONTE"
   ============================================================================= */

// 1. IMPORTACIÓN DE FIREBASE (Para el rastreo del usuario)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getDatabase, ref, update } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

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

/* =============================================================================
   2. SISTEMA DE AUDIO (SINTETIZADOR)
   Genera sonidos matemáticos para no depender de archivos externos.
   ============================================================================= */
const AudioEngine = {
    ctx: null,
    
    init() {
        // Inicializa el contexto de audio solo tras una interacción del usuario
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
    },

    // Sonido de "bloop" al escribir texto
    playTypingSound() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.05);
        
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    },

    // Sonido angelical al encontrar un fragmento
    playDiscovery() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime); // La
        osc.frequency.linearRampToValueAtTime(880, this.ctx.currentTime + 1); // La octava arriba
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.5);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 2);
    }
};

/* =============================================================================
   3. DATOS DE LA HISTORIA (LAS VERDADES)
   Aquí configuras qué dice cada monolito.
   ============================================================================= */
const GAME_DATA = [
    {
        id: 0,
        title: "VERDAD I: EL MIEDO",
        text: "Durante mucho tiempo, construí muros. No porque no te quisiera, sino porque me aterraba la idea de que alguien viera mi desorden y decidiera quedarse. Tu paciencia fue el martillo que derribó esos muros."
    },
    {
        id: 1,
        title: "VERDAD II: EL TIEMPO",
        text: "Sé que hemos perdido momentos. Sé que la distancia duele. Pero cada segundo lejos de ti me sirvió para entender una sola cosa: No quiero pasar mi tiempo con nadie más."
    },
    {
        id: 2,
        title: "VERDAD III: LA CERTEZA",
        text: "No sé qué nos depara el futuro. El código de la vida es impredecible. Pero si hay una variable constante en mi ecuación, eres tú. Siempre has sido tú."
    }
];

/* =============================================================================
   4. MOTOR PRINCIPAL (GAME ENGINE)
   ============================================================================= */
const Game = {
    // Configuración del Mundo
    worldWidth: 4000,     // Ancho total del nivel en píxeles
    viewportWidth: 0,     // Se calcula al iniciar
    playerPos: 100,       // Posición X del jugador
    velocity: 0,          // Velocidad actual
    maxSpeed: 6,          // Velocidad máxima
    friction: 0.8,        // Para que el personaje "patine" un poco al frenar
    acceleration: 1.5,    // Qué tan rápido arranca
    
    // Estado del Juego
    direction: 0,         // -1 (Izq), 0 (Quieto), 1 (Der)
    isPaused: true,       // Empieza pausado
    collectedCount: 0,    // Fragmentos encontrados
    activeZone: null,     // ¿Está cerca de un objeto?
    typingInterval: null, // Para el efecto de texto
    
    // Referencias DOM (Cache para rendimiento)
    dom: {
        player: document.getElementById('player-sprite'),
        track: document.getElementById('world-track'),
        bg1: document.getElementById('bg-layer-1'),
        bg2: document.getElementById('bg-layer-2'),
        hudCount: document.getElementById('fragment-count'),
        hudBar: document.getElementById('progress-fill'),
        actionBtn: document.getElementById('action-btn'),
        dialogBox: document.getElementById('rpg-dialogue-box'),
        dialogTitle: document.getElementById('dialogue-title'),
        dialogText: document.getElementById('dialogue-text')
    },

    /* --- INICIALIZACIÓN --- */
    init() {
        this.viewportWidth = window.innerWidth;
        
        // Configurar controles (Teclado y Táctil)
        this.setupInputs();
        
        // Iniciar pantalla
        document.getElementById('start-screen').onclick = () => {
            this.start();
        };

        // Generar decoración aleatoria en el fondo (Nubes, montañas lejanas)
        this.generateEnvironment();
    },

    start() {
        // Ocultar pantalla de inicio
        document.getElementById('start-screen').style.opacity = '0';
        setTimeout(() => document.getElementById('start-screen').style.display = 'none', 1000);
        
        // Activar audio
        AudioEngine.init();
        document.getElementById('bg-music').volume = 0.4;
        document.getElementById('bg-music').play().catch(e => console.log("Audio autoplay block"));

        // Rastrear en Firebase
        this.trackUser();

        // ARRANCAR EL BUCLE (GAME LOOP)
        this.isPaused = false;
        this.loop();
    },

    trackUser() {
        const params = new URLSearchParams(window.location.search);
        const key = params.get('key');
        if (key) {
            update(ref(db, 'llaves/' + key), { 
                fase_actual: "Fase 5: El Horizonte", 
                ultima_conexion: new Date().toISOString() 
            });
        }
    },

    /* --- BUCLE PRINCIPAL (60 FPS) --- */
    loop() {
        if (!this.isPaused) {
            this.updatePhysics();
            this.checkCollisions();
            this.render();
        }
        requestAnimationFrame(() => this.loop());
    },

    /* --- FÍSICA Y MOVIMIENTO --- */
    updatePhysics() {
        // Acelerar
        if (this.direction !== 0) {
            this.velocity += this.direction * this.acceleration;
        } else {
            // Frenar (Fricción)
            this.velocity *= this.friction;
        }

        // Limitar velocidad máxima
        if (Math.abs(this.velocity) > this.maxSpeed) {
            this.velocity = (this.velocity > 0 ? 1 : -1) * this.maxSpeed;
        }

        // Detener completamente si es muy lento
        if (Math.abs(this.velocity) < 0.1) this.velocity = 0;

        // Aplicar movimiento
        this.playerPos += this.velocity;

        // Límites del mundo (No salir del mapa)
        if (this.playerPos < 50) { this.playerPos = 50; this.velocity = 0; }
        if (this.playerPos > this.worldWidth - 100) { this.playerPos = this.worldWidth - 100; this.velocity = 0; }
    },

    /* --- RENDERIZADO (DIBUJAR EN PANTALLA) --- */
    render() {
        // 1. Animación del Personaje (Sprite)
        if (Math.abs(this.velocity) > 0.5) {
            this.dom.player.parentElement.classList.add('anim-walking');
            // Voltear sprite según dirección
            if (this.velocity < 0) this.dom.player.style.transform = "scaleX(-1)";
            else this.dom.player.style.transform = "scaleX(1)";
        } else {
            this.dom.player.parentElement.classList.remove('anim-walking');
        }

        // 2. Movimiento de Cámara (Parallax)
        // Calculamos cuánto debe moverse el mundo para que el jugador parezca centrado
        // Dejamos un margen del 30% de la pantalla para que se vea más cinematográfico
        let cameraX = -(this.playerPos - (this.viewportWidth * 0.3));
        
        // Evitar que la cámara vea fuera del mundo
        if (cameraX > 0) cameraX = 0;
        const minCamera = -(this.worldWidth - this.viewportWidth);
        if (cameraX < minCamera) cameraX = minCamera;

        // Aplicar transformaciones (Hardware Accelerated)
        this.dom.track.style.transform = `translate3d(${cameraX}px, 0, 0)`;
        
        // Capas de fondo (Se mueven más lento = sensación de lejanía)
        this.dom.bg1.style.transform = `translate3d(${cameraX * 0.1}px, 0, 0)`; // Cielo (muy lento)
        this.dom.bg2.style.transform = `translate3d(${cameraX * 0.5}px, 0, 0)`; // Montañas (velocidad media)
    },

    /* --- SISTEMA DE COLISIONES --- */
    checkCollisions() {
        const detectionRange = 100; // Píxeles de distancia para interactuar
        let foundZone = null;

        // Verificar Monolitos
        document.querySelectorAll('.interactive-zone').forEach((el) => {
            // Obtenemos la posición real (parseando el "left: 800px")
            const objX = parseInt(el.style.left);
            const dist = Math.abs(this.playerPos - objX);

            if (dist < detectionRange) {
                foundZone = el;
                // Mostrar indicador "!"
                el.querySelector('.zone-marker').style.display = 'block';
            } else {
                el.querySelector('.zone-marker').style.display = 'none';
            }
        });

        // Verificar NPC Final
        const npcX = 3600;
        if (Math.abs(this.playerPos - npcX) < 100) {
            foundZone = { id: 'npc-target', type: 'end' };
        }

        // Actualizar UI
        if (foundZone) {
            this.activeZone = foundZone;
            this.dom.actionBtn.classList.remove('hidden');
            
            // Texto del botón cambia según el objeto
            if(foundZone.type === 'end') this.dom.actionBtn.innerText = "HABLAR";
            else this.dom.actionBtn.innerText = "LEER";

        } else {
            this.activeZone = null;
            this.dom.actionBtn.classList.add('hidden');
        }
    },

    /* --- SISTEMA DE INTERACCIÓN (DIÁLOGOS) --- */
    triggerInteraction() {
        if (!this.activeZone) return;

        // Pausar juego
        this.isPaused = true;
        this.dom.actionBtn.classList.add('hidden');
        this.dom.player.parentElement.classList.remove('anim-walking');

        // Determinar qué mostrar
        if (this.activeZone.id === 'npc-target') {
            this.playEnding();
        } else {
            // Es un monolito
            const id = parseInt(this.activeZone.id.split('-')[1]);
            const data = GAME_DATA[id];
            this.showDialog(data.title, data.text);
            
            // Marcar como leído visualmente (apagar brillo)
            this.activeZone.style.filter = "grayscale(100%) opacity(0.5)";
            this.updateProgress();
        }
    },

    showDialog(title, text) {
        const box = this.dom.dialogBox;
        box.classList.remove('hidden');
        this.dom.dialogTitle.innerText = title;
        this.dom.dialogText.innerHTML = ""; // Limpiar texto previo

        let i = 0;
        clearInterval(this.typingInterval);
        
        // Efecto Typewriter (Máquina de escribir)
        this.typingInterval = setInterval(() => {
            this.dom.dialogText.innerHTML += text.charAt(i);
            i++;
            
            // Sonido aleatorio (no en cada letra para no saturar)
            if (i % 3 === 0) AudioEngine.playTypingSound();

            if (i >= text.length) {
                clearInterval(this.typingInterval);
                // Activar clic para cerrar
                box.onclick = () => this.closeDialog();
            }
        }, 30); // Velocidad de escritura
    },

    closeDialog() {
        this.dom.dialogBox.classList.add('hidden');
        this.dom.dialogBox.onclick = null;
        
        // Pequeña espera antes de devolver control
        setTimeout(() => {
            this.isPaused = false;
            this.loop();
        }, 200);
    },

    updateProgress() {
        this.collectedCount++;
        // Actualizar HUD
        this.dom.hudCount.innerText = this.collectedCount;
        const pct = (this.collectedCount / 3) * 100;
        this.dom.hudBar.style.width = pct + "%";
        
        AudioEngine.playDiscovery();
    },

    playEnding() {
        // Secuencia final
        document.getElementById('ending-overlay').classList.remove('hidden');
        
        // Bajar volumen de música gradualmente
        const music = document.getElementById('bg-music');
        let vol = music.volume;
        const fade = setInterval(() => {
            if (vol > 0) {
                vol -= 0.05;
                music.volume = vol;
            } else {
                clearInterval(fade);
            }
        }, 200);
    },

    /* --- INPUTS / CONTROLES --- */
    setupInputs() {
        const btnL = document.getElementById('btn-left');
        const btnR = document.getElementById('btn-right');
        const btnAction = document.getElementById('action-btn');

        // Táctil
        const startMove = (dir) => { this.direction = dir; };
        const stopMove = () => { this.direction = 0; };

        btnL.addEventListener('touchstart', (e) => { e.preventDefault(); startMove(-1); });
        btnR.addEventListener('touchstart', (e) => { e.preventDefault(); startMove(1); });
        
        btnL.addEventListener('touchend', stopMove);
        btnR.addEventListener('touchend', stopMove);

        // Acción
        btnAction.addEventListener('click', () => this.triggerInteraction());

        // Teclado (Para probar en PC)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.direction = -1;
            if (e.key === 'ArrowRight') this.direction = 1;
            if (e.key === 'Enter' || e.key === ' ') this.triggerInteraction();
        });
        document.addEventListener('keyup', () => { this.direction = 0; });
    },

    /* --- GENERACIÓN PROCEDURAL (DECORACIÓN) --- */
    generateEnvironment() {
        const layer = this.dom.bg2;
        // Crear 20 elementos decorativos aleatorios (montañas lejanas)
        for(let i=0; i<20; i++) {
            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.bottom = '100px';
            div.style.left = (Math.random() * 4000) + 'px';
            div.style.width = (50 + Math.random() * 150) + 'px';
            div.style.height = (50 + Math.random() * 100) + 'px';
            div.style.background = '#0b0b2b';
            div.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)'; // Triángulo
            div.style.opacity = '0.5';
            layer.appendChild(div);
        }
    }
};

// Iniciar el juego globalmente
window.Game = Game;
Game.init();


