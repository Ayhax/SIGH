document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const mensajeError = document.getElementById('mensajeError');

    try {
        const response = await fetch('http://localhost:3000/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
    // Imprimimos todo lo que llega para ver qué campos tiene el objeto data
    console.log("CONTENIDO DE DATA:", data);

    // Guardamos todo el objeto data directamente en 'usuario'
    // Así, si el servidor envía { dni: '123', nombres: 'Juan' }, se guardará todo.
    localStorage.setItem('usuario', JSON.stringify(data));
    
    window.location.href = 'home.html';
} else {
            mensajeError.innerText = data.message || "Usuario o contraseña incorrectos";
        }
    } catch (error) {
        console.error("Error al conectar:", error);
        mensajeError.innerText = "Error de conexión con el servidor";
    }
});


