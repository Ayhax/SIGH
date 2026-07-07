document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificamos si existe el objeto completo 'usuario' en localStorage
    const rawData = localStorage.getItem('usuario');

    // Si no hay datos de usuario, mandamos de regreso al login (index.html)
    if (!rawData) {
        window.location.href = 'index.html';
        return;
    }

    // 2. Parseamos el objeto para extraer el rol de manera segura
    const usuarioLogueado = JSON.parse(rawData);
    const userRole = usuarioLogueado.role || "Sin rol";

    // 3. Mostramos el rol en la interfaz (solo si el elemento existe en el HTML actual)
    const displayElement = document.getElementById('userRoleDisplay');
    if (displayElement) {
        displayElement.innerText = userRole;
    }

    // 4. Funcionalidad de logout corregida para limpiar todo el localStorage
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear(); // Borra 'usuario' y limpia de forma segura
            window.location.href = 'index.html'; // Enviamos al login
        });
    }
});