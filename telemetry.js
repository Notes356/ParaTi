// telemetry.js
import { db, ref, update } from './firebase-config.js';

// Función para guardar dónde está la persona
export function registrarPaso(nombreFase) {
    // Recuperamos la llave que guardamos al entrar en el index
    const llaveUsuario = localStorage.getItem('llave_acceso_dedicatoria');

    if (llaveUsuario) {
        // Obtenemos la fecha y hora legible
        const ahora = new Date();
        const horaLegible = ahora.toLocaleString('es-ES', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            day: '2-digit', month: 'short'
        });

        // Actualizamos la base de datos sin borrar lo anterior
        update(ref(db, 'llaves/' + llaveUsuario), {
            ultima_ubicacion: nombreFase,
            ultima_conexion: horaLegible
        });
        console.log(`[Registro] Usuario en: ${nombreFase} - ${horaLegible}`);
    }
}
