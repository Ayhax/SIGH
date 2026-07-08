require('dotenv').config();
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Todos los usuarios van a quedar con esta contraseña temporal.
// Cámbiala aquí antes de correr el script si quieres usar otra.
const CONTRASENA_TEMPORAL = '123456';

db.connect((err) => {
    if (err) {
        console.error('Error de conexión:', err);
        process.exit(1);
    }
    console.log('Conectado. Iniciando migración a bcrypt...\n');

    db.query('SELECT usuario_id, username FROM usuario', async (err, usuarios) => {
        if (err) {
            console.error('Error al obtener usuarios:', err);
            db.end();
            return;
        }
        if (usuarios.length === 0) {
            console.log('No hay usuarios para migrar.');
            db.end();
            return;
        }

        const hash = await bcrypt.hash(CONTRASENA_TEMPORAL, 10);
        let pendientes = usuarios.length;

        usuarios.forEach(u => {
            db.query('UPDATE usuario SET pass = ? WHERE usuario_id = ?', [hash, u.usuario_id], (err) => {
                if (err) {
                    console.error(`✘ Error actualizando a ${u.username}:`, err);
                } else {
                    console.log(`✔ ${u.username} → contraseña temporal: ${CONTRASENA_TEMPORAL}`);
                }
                pendientes--;
                if (pendientes === 0) {
                    console.log('\nMigración completa. Avisa a cada usuario su contraseña temporal.');
                    db.end();
                }
            });
        });
    });
});