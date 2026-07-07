const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123',
    database: 'hospital_logistica'
});

db.connect((err) => {
    if (err) console.error('Error BD:', err);
    else console.log('Servidor conectado a la Base de Datos.');
});

// MIDDLEWARE MANDATORIO DE SEGURIDAD
function verificarPermiso(moduloId) {
    return (req, res, next) => {
        const usuarioId = req.headers['x-usuario-id'];

        if (!usuarioId) {
            return res.status(401).json({ success: false, message: "No identificado." });
        }

        const sql = `
            SELECT COUNT(*) as permitido 
            FROM usuario u
            JOIN rol_modulo_detalle rmd ON u.rol_id = rmd.rol_id
            WHERE u.usuario_id = ? AND rmd.modulo_id = ?
        `;

        db.query(sql, [usuarioId, moduloId], (err, results) => {
            if (err) return res.status(500).json({ success: false, error: err.message });
            
            if (results[0].permitido > 0) {
                next(); 
            } else {
                res.status(403).json({ success: false, message: "Acceso Denegado por Servidor." });
            }
        });
    };
}

// Ruta para el Login (Envía IDs para seguridad y Nombres para la interfaz)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    const sql = `
        SELECT u.usuario_id, u.username, u.dni, u.nombres, u.apellidos, 
               r.nombre AS nombre_rol, 
               GROUP_CONCAT(DISTINCT rmd.modulo_id) as modulos_ids,
               GROUP_CONCAT(DISTINCT m.nombre) as modulos_nombres
        FROM usuario u
        JOIN rol r ON u.rol_id = r.rol_id
        LEFT JOIN rol_modulo_detalle rmd ON r.rol_id = rmd.rol_id
        LEFT JOIN modulo m ON rmd.modulo_id = m.modulo_id
        WHERE u.username = ? AND u.pass = SHA2(?, 256)
        GROUP BY u.usuario_id;
    `;

    db.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: "Error en servidor" });
        }
        if (results.length === 0) {
            return res.status(401).json({ success: false, message: "El usuario o la contraseña incorrectos." });
        }
        
        const user = results[0];
        
        // Procesamos ambos arrays por separado
        const modulosIds = user.modulos_ids ? user.modulos_ids.split(',').map(Number) : [];
        const modulosNombres = user.modulos_nombres ? user.modulos_nombres.split(',') : [];
        
        res.json({ 
            success: true, 
            usuario_id: user.usuario_id,
            role: user.nombre_rol, 
            modulos: modulosNombres, // Mantiene los nombres para que home.html pinte los botones
            modulos_ids: modulosIds,  // Guarda los IDs numéricos para las validaciones de seguridad
            nombres: user.nombres,   
            apellidos: user.apellidos 
        });
    });
});

// RUTAS PROTEGIDAS BAJO EL MÓDULO ID 4 (GESTIÓN DE USUARIOS = "GUH" en la tabla `modulo`)
// OJO: antes decía verificarPermiso(2), pero el 2 corresponde a "CAF" (Control de Activos Fijos).
// El módulo de Gestión de Usuarios es el 4 según la tabla `modulo`.
app.get('/api/roles', verificarPermiso(4), (req, res) => {
    db.query('SELECT * FROM rol', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/usuarios', verificarPermiso(4), (req, res) => {
    const sql = `SELECT u.*, r.nombre AS rol_nombre FROM usuario u LEFT JOIN rol r ON u.rol_id = r.rol_id`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/usuarios', verificarPermiso(4), (req, res) => {
    const { dni, nombres, apellidos, correo, username, pass, telefono, rol_id } = req.body;
    const sql = `INSERT INTO usuario (dni, nombres, apellidos, correo, username, pass, telefono, rol_id) VALUES (?, ?, ?, ?, ?, SHA2(?, 256), ?, ?)`;
    db.query(sql, [dni, nombres, apellidos, correo, username, pass, telefono, rol_id], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// Catálogo completo de módulos: cualquier usuario logueado puede consultarlo
// (no es información sensible). El filtrado de qué módulos puede VER cada quien
// se hace en el frontend, cruzando contra su propio usuarioLogueado.modulos.
app.get('/api/modulos', (req, res) => {
    const usuarioId = req.headers['x-usuario-id'];
    if (!usuarioId) {
        return res.status(401).json({ success: false, message: "No identificado." });
    }
    db.query('SELECT modulo_id AS id, nombre, descripcion FROM modulo', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/usuarios/:id/permisos', verificarPermiso(4), (req, res) => {
    const sql = `SELECT rmd.modulo_id FROM usuario u JOIN rol_modulo_detalle rmd ON u.rol_id = rmd.rol_id WHERE u.usuario_id = ?`;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results.map(row => row.modulo_id));
    });
});

app.post('/api/roles/:rolId/permisos', verificarPermiso(4), (req, res) => {
    const { rolId } = req.params;
    const { modulos } = req.body;
    db.query('DELETE FROM rol_modulo_detalle WHERE rol_id = ?', [rolId], (err) => {
        if (err) return res.status(500).json({ success: false });
        if (!modulos || modulos.length === 0) return res.json({ success: true });
        const values = modulos.map(mId => [rolId, mId]);
        db.query('INSERT INTO rol_modulo_detalle (rol_id, modulo_id) VALUES ?', [values], (err) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true });
        });
    });
});

app.listen(3000, () => console.log('Servidor seguro en puerto 3000'));