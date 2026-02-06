/* =============================================================================
   ECO V ENGINE: HORIZON CORE
   Versión: 5.0.0 (Final Release)
   Arquitectura: ECS (Entity-Component-System) Híbrido
   ============================================================================= */

// --- 1. FIREBASE & TELEMETRY MODULE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getDatabase, ref, update } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAnYkdRY_LhrJwpClgfWs38iP2mfxyc2tk",
    authDomain: "declaracion-final.firebaseapp.com",
    projectId: "declaracion-final",
    storageBucket: "declaracion-final.firebasestorage.app",
    messagingSenderId: "288671326547",
    appId: "1:288671326547:web:e549d8d79e951e408e41a6"
};

/* =============================================================================
   2. CONFIGURACIÓN DEL MOTOR
   Ajustes de físicas y comportamiento
   ============================================================================= */
const CONFIG = {
    physics: {
        maxSpeed: 8,           // Velocidad máxima
        acceleration: 0.8,     // Cuánto tarda en llegar a maxSpeed
        friction: 0.88,        // Freno natural (0.9 = hielo, 0.7 = arena)
        worldWidth: 4000,      // Ancho total del nivel
    },
    camera: {
        smooth: 0.1,           // Factor de suavizado (Lerp) de la cámara
        deadzone: 0.3          // Zona central donde la cámara no se mueve tanto
    },
    audio: {
        typeSpeed: 40,         // MS entre letras
        musicVol: 0.4
    }
};

/* =============================================================================
   3. AUDIO ENGINE (WEB AUDIO API)
   Sintetizador en tiempo real y gestión de música
   ============================================================================= */
class AudioSystem {
    constructor() {
        this.ctx = null;
        this.bgNode = null;
        this.filterNode = null;
        this.gainNode = null;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        
        // Configurar pipeline de música (Source -> Filter -> Gain -> Destination)
        const audioEl = document.getElementById('bg-music');
        this.bgNode = this.ctx.createMediaElementSource(audioEl);
        
        // Crear filtro LowPass (efecto "debajo del agua" para diálogos)
        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.value = 20000; // Abierto por defecto
        
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = CONFIG.audio.musicVol;

        this.bgNode.connect(this.filterNode);
        this.filterNode.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);
        
        audioEl.play().catch(e => console.log("Esperando interacción..."));
        this.isInitialized = true;
    }

    // Efecto: Amortiguar música (modo concentración/diálogo)
    dampenMusic(active) {
        if (!this.ctx) return;
        const targetFreq = active ? 400 : 20000; // 400Hz suena "tapado"
        const now = this.ctx.currentTime;
        this.filterNode.frequency.cancelScheduledValues(now);
        this.filterNode.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.5);
    }

    // Sintetizador: Sonido de tecleo (Blip procedural)
    playBlip() {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // Aleatorizar tono ligeramente para que suene orgánico
        const freq = 600 + (Math.random() * 200);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.05);
        
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.06);
    }

    // Sintetizador: Sonido de éxito (Acorde etéreo)
    playChime() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        
        [440, 554, 659].forEach((freq, i) => { // Acorde La Mayor
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.1, now + 0.1 + (i*0.1));
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(now + 2.5);
        });
    }
}

/* =============================================================================
   4. DATA LAYER
   Contenido narrativo
   ============================================================================= */
const MEMORIES = [
    {
        id: "monolith-0",
        title: "VERDAD I: EL MIEDO",
        text: "Durante mucho tiempo, construí muros. No porque no te quisiera, sino porque me aterraba la idea de que alguien viera mi desorden y decidiera quedarse. Tu paciencia fue el martillo que derribó esos muros."
    },
    {
        id: "monolith-1",
        title: "VERDAD II: EL TIEMPO",
        text: "Sé que hemos perdido momentos. Sé que la distancia duele. Pero cada segundo lejos de ti me sirvió para entender una sola cosa: No quiero pasar mi tiempo con nadie más."
    },
    {
        id: "monolith-2",
        title: "VERDAD III: LA CERTEZA",
        text: "No sé qué nos depara el futuro. El código de la vida es impredecible. Pero si hay una verdad inmutable en mi historia, sos vos."
    }
];

/* =============================================================================
   5. INPUT HANDLER
   Unificación de Teclado y Touch
   ============================================================================= */
class InputHandler {
    constructor() {
        this.direction = 0; // -1, 0, 1
        this.keys = { left: false, right: false };
        
        this.setupKeyboard();
        this.setupTouch();
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = true;
            this.updateDirection();
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = false;
            this.updateDirection();
        });
    }

    setupTouch() {
        const btnL = document.getElementById('btn-left');
        const btnR = document.getElementById('btn-right');

        const start = (dir) => { this.direction = dir; };
        const end = () => { this.direction = 0; };

        // Soporte multitouch básico
        btnL.addEventListener('touchstart', (e) => { e.preventDefault(); start(-1); });
        btnR.addEventListener('touchstart', (e) => { e.preventDefault(); start(1); });
        btnL.addEventListener('touchend', (e) => { e.preventDefault(); end(); });
        btnR.addEventListener('touchend', (e) => { e.preventDefault(); end(); });
    }

    updateDirection() {
        if (this.keys.left && !this.keys.right) this.direction = -1;
        else if (this.keys.right && !this.keys.left) this.direction = 1;
        else this.direction = 0;
    }
}

/* =============================================================================
   6. VISUAL EFFECTS ENGINE
   Manipulación del DOM para FX
   ============================================================================= */
class VFX {
    constructor() {
        this.cameraShakeTimeout = null;
        this.viewport = document.getElementById('game-viewport');
    }

    shake(intensity = 5, duration = 200) {
        if (this.cameraShakeTimeout) clearTimeout(this.cameraShakeTimeout);
        
        this.viewport.style.transform = `translate(${Math.random()*intensity}px, ${Math.random()*intensity}px)`;
        
        let elapsed = 0;
        const interval = setInterval(() => {
            const x = (Math.random() - 0.5) * intensity;
            const y = (Math.random() - 0.5) * intensity;
            this.viewport.style.transform = `translate(${x}px, ${y}px)`; // Nota: esto podría conflictos con el parallax si no se maneja con cuidado, usaremos un wrapper interno si es necesario, pero para efectos rápidos está bien.
            elapsed += 50;
            if (elapsed >= duration) {
                clearInterval(interval);
                this.viewport.style.transform = 'none'; // Reset
            }
        }, 50);
    }

    // Efecto de Glitch en el texto del HUD
    textGlitch(element, originalText) {
        const chars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        let iterations = 0;
        const interval = setInterval(() => {
            element.innerText = originalText
                .split('')
                .map((letter, index) => {
                    if (index < iterations) return originalText[index];
                    return chars[Math.floor(Math.random() * chars.length)];
                })
                .join('');
            
            if (iterations >= originalText.length) clearInterval(interval);
            iterations += 1 / 3;
        }, 30);
    }
}

/* =============================================================================
   7. CORE GAME ENGINE
   El cerebro de la operación
   ============================================================================= */
class GameEngine {
    constructor() {
        // Sistemas
        this.audio = new AudioSystem();
        this.input = new InputHandler();
        this.vfx = new VFX();
        this.db = getDatabase(initializeApp(FIREBASE_CONFIG));

        // Estado del Juego
        this.state = 'BOOT'; // BOOT, PLAY, DIALOGUE, END
        this.lastTime = 0;
        this.collected = 0;
        
        // Físicas
        this.playerX = 100;
        this.velocity = 0;
        
        // Referencias DOM (Cache)
        this.dom = {
            player: document.getElementById('player-sprite'),
            playerContainer: document.getElementById('player-container'),
            track: document.getElementById('world-track'),
            bgDeep: document.getElementById('bg-layer-deep'),
            bgMid: document.getElementById('bg-layer-mid'),
            hudCount: document.getElementById('fragment-count'),
            hudBar: document.getElementById('progress-fill'),
            actionBtn: document.getElementById('action-btn'),
            dialogBox: document.getElementById('rpg-dialogue-box'),
            dialogTitle: document.getElementById('dialogue-title'),
            dialogText: document.getElementById('dialogue-text'),
            zones: document.querySelectorAll('.interactive-zone')
        };

        this.currentZone = null;
    }

    init() {
        // Pantalla de inicio
        const startBtn = document.getElementById('btn-start');
        startBtn.addEventListener('click', () => this.bootSequence());
    }

    // Secuencia de arranque tipo "Bios"
    bootSequence() {
        this.audio.init();
        
        const startScreen = document.getElementById('start-screen');
        startScreen.style.opacity = 0;
        document.body.dataset.state = "running"; // Activa transiciones CSS globales

        setTimeout(() => {
            startScreen.style.display = 'none';
            this.state = 'PLAY';
            this.trackEntry();
            this.gameLoop(0);
        }, 1000);
    }

    trackEntry() {
        // Telemetría silenciosa
        try {
            const params = new URLSearchParams(window.location.search);
            const key = params.get('key');
            if (key) {
                update(ref(this.db, 'llaves/' + key), { 
                    fase_actual: "Eco V : El Horizonte", 
                    timestamp: new Date().toISOString() 
                });
            }
        } catch (e) { console.warn("Modo offline"); }
    }

    // BUCLE PRINCIPAL (Game Loop)
    gameLoop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (this.state === 'PLAY') {
            this.updatePhysics(dt);
            this.updateCamera();
            this.checkCollisions();
            this.render();
        }

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    updatePhysics(dt) {
        // Aceleración
        if (this.input.direction !== 0) {
            this.velocity += this.input.direction * CONFIG.physics.acceleration;
        } else {
            this.velocity *= CONFIG.physics.friction; // Fricción
        }

        // Limites de velocidad (Clamping)
        const max = CONFIG.physics.maxSpeed;
        if (this.velocity > max) this.velocity = max;
        if (this.velocity < -max) this.velocity = -max;
        
        // Stop total si es muy lento
        if (Math.abs(this.velocity) < 0.1) this.velocity = 0;

        // Actualizar posición
        this.playerX += this.velocity;

        // Limites del mundo
        if (this.playerX < 50) { this.playerX = 50; this.velocity = 0; }
        if (this.playerX > CONFIG.physics.worldWidth - 150) { 
            this.playerX = CONFIG.physics.worldWidth - 150; 
            this.velocity = 0; 
        }
    }

    updateCamera() {
        // La cámara intenta mantener al jugador centrado, pero con 'lerp'
        const viewportW = window.innerWidth;
        
        // Objetivo: Que el jugador esté al 30% de la pantalla (regla de tercios)
        let targetCamX = -(this.playerX - (viewportW * 0.3));
        
        // Clamping de la cámara (no ver más allá del inicio o fin)
        if (targetCamX > 0) targetCamX = 0;
        const minCam = -(CONFIG.physics.worldWidth - viewportW);
        if (targetCamX < minCam) targetCamX = minCam;

        // Aplicamos al DOM
        // Usamos translate3d para aceleración por hardware
        this.dom.track.style.transform = `translate3d(${targetCamX}px, 0, 0)`;

        // Parallax Math
        // Las capas de fondo se mueven a una fracción de la velocidad de la cámara
        this.dom.bgDeep.style.transform = `translate3d(${targetCamX * 0.05}px, 0, 0)`;
        this.dom.bgMid.style.transform = `translate3d(${targetCamX * 0.2}px, 0, 0)`;
    }

    checkCollisions() {
        let nearestZone = null;
        const detectionRadius = 120;

        this.dom.zones.forEach(zone => {
            // Extraer posición X real del estilo inline
            const zoneX = parseInt(zone.style.left);
            const dist = Math.abs(this.playerX - zoneX);

            // LOGICA DE ROTACIÓN 3D DE LAS CARTAS
            // Si está cerca (< 400px), girar la carta hacia el jugador
            if (dist < 400 && zone.dataset.type === 'memory') {
                // Cálculo de ángulo: 0 grados cuando estamos frente a ella
                // Max 45 grados cuando nos alejamos
                const angle = (this.playerX - zoneX) * 0.1; 
                const clampedAngle = Math.max(-60, Math.min(60, angle));
                
                // Aplicamos rotación al contenedor interno
                const inner = zone.querySelector('.card-inner');
                if (inner) {
                    // Si ya fue leída, la mostramos dada vuelta (180) + el ángulo de perspectiva
                    const baseRot = zone.classList.contains('read') ? 180 : 0;
                    inner.style.transform = `rotateY(${baseRot + clampedAngle}deg)`;
                }
            }

            // Lógica de Interacción
            if (dist < detectionRadius) {
                nearestZone = zone;
            }
        });

        // Gestionar UI del botón
        if (nearestZone && nearestZone !== this.currentZone) {
            this.currentZone = nearestZone;
            this.showInteractionButton(true, nearestZone.dataset.type);
            // Mostrar indicador visual "!"
            const hint = nearestZone.querySelector('.interaction-hint');
            if(hint) hint.style.display = 'block';

        } else if (!nearestZone && this.currentZone) {
            // Salimos de la zona
            const hint = this.currentZone.querySelector('.interaction-hint');
            if(hint) hint.style.display = 'none';
            
            this.currentZone = null;
            this.showInteractionButton(false);
        }
    }

    showInteractionButton(show, type) {
        const btn = this.dom.actionBtn;
        if (show) {
            btn.classList.remove('hidden');
            const textSpan = btn.querySelector('.btn-text');
            textSpan.innerText = (type === 'end') ? "SINCRONIZAR" : "LEER DATOS";
            
            // Reemplazar evento click antiguo para evitar duplicados
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            this.dom.actionBtn = newBtn;
            
            this.dom.actionBtn.addEventListener('click', () => this.triggerInteraction());
        } else {
            btn.classList.add('hidden');
        }
    }

    render() {
        // Animación del Sprite del Jugador
        // Si hay velocidad, añadir clase 'anim-walking'
        if (Math.abs(this.velocity) > 0.5) {
            this.dom.playerContainer.classList.add('anim-walking');
            // Flip Sprite horizontal
            const scaleX = this.velocity < 0 ? -1 : 1;
            this.dom.player.style.transform = `scaleX(${scaleX})`;
        } else {
            this.dom.playerContainer.classList.remove('anim-walking');
        }
    }

    /* =============================================================================
       8. INTERACTION SYSTEM
       Diálogos y Eventos
       ============================================================================= */
    triggerInteraction() {
        if (!this.currentZone) return;

        this.state = 'DIALOGUE';
        this.velocity = 0; // Detener jugador
        this.dom.playerContainer.classList.remove('anim-walking');
        this.dom.actionBtn.classList.add('hidden');
        
        // Efecto de audio: Amortiguar música
        this.audio.dampenMusic(true);

        const type = this.currentZone.dataset.type;

        if (type === 'end') {
            this.triggerEnding();
        } else {
            // Es un monolito
            const id = this.currentZone.id;
            const data = MEMORIES.find(m => m.id === id);
            
            // Marcar visualmente como leído
            this.currentZone.classList.add('read');
            // Girar carta permanentemente
            const inner = this.currentZone.querySelector('.card-inner');
            if(inner) inner.style.transform = 'rotateY(180deg)';

            this.runDialogue(data.title, data.text);
            
            // Si es la primera vez que se lee, sumar contador
            if (!this.currentZone.dataset.collected) {
                this.currentZone.dataset.collected = "true";
                this.updateProgress();
            }
        }
    }

    updateProgress() {
        this.collected++;
        this.dom.hudCount.innerText = this.collected;
        const pct = (this.collected / 3) * 100;
        this.dom.hudBar.style.width = `${pct}%`;
        this.audio.playChime();
    }

    runDialogue(title, text) {
        const box = this.dom.dialogBox;
        box.classList.remove('hidden');
        
        this.dom.dialogTitle.innerText = "";
        this.vfx.textGlitch(this.dom.dialogTitle, title);
        
        const content = this.dom.dialogText;
        content.innerHTML = "";
        
        let i = 0;
        // Efecto máquina de escribir
        const interval = setInterval(() => {
            content.innerHTML += text.charAt(i);
            
            // Sonido procedural de tecleo
            if (i % 2 === 0) this.audio.playBlip();
            
            i++;
            if (i >= text.length) {
                clearInterval(interval);
                this.waitForExit();
            }
        }, CONFIG.audio.typeSpeed);
    }

    waitForExit() {
        const box = this.dom.dialogBox;
        const closeHandler = () => {
            box.classList.add('hidden');
            this.state = 'PLAY';
            this.audio.dampenMusic(false); // Restaurar música
            box.removeEventListener('click', closeHandler);
        };
        // Pequeño delay para no cerrar accidentalmente al intentar leer rápido
        setTimeout(() => {
            box.addEventListener('click', closeHandler);
        }, 500);
    }

    /* =============================================================================
       9. ENDING SEQUENCE
       Cinemática Final
       ============================================================================= */
    triggerEnding() {
        const overlay = document.getElementById('ending-overlay');
        overlay.classList.remove('hidden');
        
        // Apagar música gradualmente
        const fadeAudio = setInterval(() => {
            if (this.audio.gainNode.gain.value > 0.01) {
                this.audio.gainNode.gain.value -= 0.05;
            } else {
                clearInterval(fadeAudio);
                this.audio.ctx.suspend();
            }
        }, 200);

        // Registro final en Firebase
        update(ref(this.db, 'status_juego'), { 
            completado: true, 
            final: "Eco V Terminado" 
        });
    }
}

// ARRANQUE DEL SISTEMA
window.onload = () => {
    const game = new GameEngine();
    game.init();
};
