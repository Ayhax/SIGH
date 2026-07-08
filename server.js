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
    else console.log('Servidor conectado a la Base de Datos.');
});

// MIDDLEWARE MANDATORIO DE SEGURIDAD
function verificarPermiso(moduloId) {
    return (req, res, next) => {
        // Leemos el token del header Authorization, no un ID que el cliente inventa
        const authHeader = req.headers['authorization'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: "No identificado." });
        }

        const token = authHeader.split(' ')[1];
        let payload;
        try {
            // jwt.verify revisa la firma: si el token fue alterado o no lo generamos
            // nosotros, esto lanza un error y cae al catch
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ success: false, message: "Sesión inválida o expirada." });
        }

        const usuarioId = payload.usuario_id;

        const sql = `
            SELECT COUNT(*) as permitido 
            FROM usuario_modulo_detalle umd
            WHERE umd.usuario_id = ? AND umd.modulo_id = ?
        `;

        db.query(sql, [usuarioId, moduloId], (err, results) => {
            if (err) return res.status(500).json({ success: false, error: err.message });

            if (results[0].permitido > 0) {
                req.usuarioId = usuarioId; // lo dejamos disponible por si la ruta lo necesita
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

    // Ya no comparamos la contraseña dentro del SQL (SHA2 no aplica).
    // Traemos el hash (u.pass) y comparamos en JavaScript con bcrypt.
    const sql = `
        SELECT u.usuario_id, u.username, u.pass, u.dni, u.nombres, u.apellidos, 
               r.nombre AS nombre_rol, 
               GROUP_CONCAT(DISTINCT umd.modulo_id) as modulos_ids,
               GROUP_CONCAT(DISTINCT m.nombre) as modulos_nombres
        FROM usuario u
        JOIN rol r ON u.rol_id = r.rol_id
        LEFT JOIN usuario_modulo_detalle umd ON u.usuario_id = umd.usuario_id
        LEFT JOIN modulo m ON umd.modulo_id = m.modulo_id
        WHERE u.username = ?
        GROUP BY u.usuario_id;
    `;

    db.query(sql, [username], async (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: "Error en servidor" });
        }
        if (results.length === 0) {
            return res.status(401).json({ success: false, message: "El usuario o la contraseña incorrectos." });
        }

        const user = results[0];

        // Comparamos la contraseña escrita contra el hash guardado.
        // bcrypt.compare se encarga de todo (incluyendo el salt), no se compara texto plano.
        const passwordCorrecta = await bcrypt.compare(password, user.pass);
        if (!passwordCorrecta) {
            return res.status(401).json({ success: false, message: "El usuario o la contraseña incorrectos." });
        }

        // Procesamos ambos arrays por separado
        const modulosIds = user.modulos_ids ? user.modulos_ids.split(',').map(Number) : [];
        const modulosNombres = user.modulos_nombres ? user.modulos_nombres.split(',') : [];

        // Generamos el token firmado: es la "pulsera VIP" que el usuario va a
        // presentar en cada petición futura, en vez de mandar su usuario_id "a mano"
        const token = jwt.sign(
            { usuario_id: user.usuario_id, username: user.username, role: user.nombre_rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' } // el token deja de ser válido después de 8 horas
        );

        res.json({
            success: true,
            token,
            usuario_id: user.usuario_id,
            role: user.nombre_rol,
            modulos: modulosNombres,
            modulos_ids: modulosIds,
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
    // Seleccionamos columnas específicas -- NUNCA u.* -- para no exponer
    // el hash de la contraseña (u.pass) al frontend.
    const sql = `
        SELECT u.usuario_id, u.dni, u.nombres, u.apellidos, u.correo, 
               u.username, u.telefono, u.rol_id, r.nombre AS rol_nombre 
        FROM usuario u 
        LEFT JOIN rol r ON u.rol_id = r.rol_id
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/usuarios', verificarPermiso(4), async (req, res) => {
    const { dni, nombres, apellidos, correo, username, pass, telefono, rol_id } = req.body;

    // Generamos el hash bcrypt aquí en JS antes de guardarlo (ya no con SHA2 en SQL)
    const hashPass = await bcrypt.hash(pass, 10);

    const sql = `INSERT INTO usuario (dni, nombres, apellidos, correo, username, pass, telefono, rol_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [dni, nombres, apellidos, correo, username, hashPass, telefono, rol_id], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// Catálogo completo de módulos: cualquier usuario logueado puede consultarlo
// (no es información sensible). El filtrado de qué módulos puede VER cada quien
// se hace en el frontend, cruzando contra su propio usuarioLogueado.modulos.
app.get('/api/modulos', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: "No identificado." });
    }
    try {
        jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ success: false, message: "Sesión inválida o expirada." });
    }
    db.query('SELECT modulo_id AS id, nombre, descripcion FROM modulo', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/usuarios/:id/permisos', verificarPermiso(4), (req, res) => {
    const sql = `SELECT modulo_id FROM usuario_modulo_detalle WHERE usuario_id = ?`;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results.map(row => row.modulo_id));
    });
});

// Asignación de permisos AHORA por usuario individual (ya no por rol)
app.post('/api/usuarios/:usuarioId/permisos', verificarPermiso(4), (req, res) => {
    const { usuarioId } = req.params;
    const { modulos } = req.body;
    db.query('DELETE FROM usuario_modulo_detalle WHERE usuario_id = ?', [usuarioId], (err) => {
        if (err) return res.status(500).json({ success: false });
        if (!modulos || modulos.length === 0) return res.json({ success: true });
        const values = modulos.map(mId => [usuarioId, mId]);
        db.query('INSERT INTO usuario_modulo_detalle (usuario_id, modulo_id) VALUES ?', [values], (err) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true });
        });
    });
});

app.listen(3000, () => console.log('Servidor seguro en puerto 3000'));