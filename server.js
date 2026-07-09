require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) console.error('Error BD:', err);
    else console.log('API conectada a la Base de Datos.');
});

// --- MIDDLEWARE DE SEGURIDAD ---
function verificarPermiso(moduloId) {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: "No autorizado." });
        }
        const token = authHeader.split(' ')[1];
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            
            // Verificamos en DB si tiene permiso específico para este moduloId
            const sql = `SELECT COUNT(*) as permitido FROM usuario_modulo_detalle WHERE usuario_id = ? AND modulo_id = ?`;
            db.query(sql, [payload.usuario_id, moduloId], (err, results) => {
                if (err || results[0].permitido === 0) return res.status(403).json({ success: false, message: "Acceso denegado." });
                req.usuarioId = payload.usuario_id;
                next();
            });
        } catch (err) {
            return res.status(401).json({ success: false, message: "Sesión inválida." });
        }
    };
}

// --- ENDPOINTS API ---

// 1. LOGIN: Devuelve solo datos puros (JSON) para que Angular los procese
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = `
        SELECT u.usuario_id, u.pass, u.nombres, u.apellidos, r.nombre AS role, 
               GROUP_CONCAT(DISTINCT umd.modulo_id) as modulos_ids
        FROM usuario u
        JOIN rol r ON u.rol_id = r.rol_id
        LEFT JOIN usuario_modulo_detalle umd ON u.usuario_id = umd.usuario_id
        WHERE u.username = ? GROUP BY u.usuario_id;
    `;

    db.query(sql, [username], async (err, results) => {
        if (err || results.length === 0 || !(await bcrypt.compare(password, results[0].pass))) {
            return res.status(401).json({ success: false, message: "Credenciales inválidas." });
        }

        const user = results[0];
        const token = jwt.sign({ usuario_id: user.usuario_id }, process.env.JWT_SECRET, { expiresIn: '8h' });

        res.json({
            success: true,
            token,
            nombres: user.nombres,
            apellidos: user.apellidos,
            role: user.role,
            modulos_ids: user.modulos_ids ? user.modulos_ids.split(',').map(Number) : []
        });
    });
});

// 2. CATÁLOGO DE MÓDULOS: Angular llama a esto para pintar el dashboard
app.get('/api/modulos', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: "No autorizado." });
    }

    let payload;
    try {
        payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ success: false, message: "Sesión inválida." });
    }

    const sql = `
        SELECT m.modulo_id AS id, m.nombre, m.descripcion AS \`descripcion\`
        FROM modulo m
        JOIN usuario_modulo_detalle umd ON m.modulo_id = umd.modulo_id
        WHERE umd.usuario_id = ?
    `;

    db.query(sql, [payload.usuario_id], (err, results) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json(results);
    });
});
// 3. RUTAS PROTEGIDAS (Ejemplo gestión de usuarios)
app.get('/api/usuarios', verificarPermiso(4), (req, res) => {
    db.query('SELECT usuario_id, nombres, apellidos, username FROM usuario', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.listen(3000, () => console.log('API REST funcionando en puerto 3000'));