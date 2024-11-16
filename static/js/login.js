// login.js

document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();

    // Obtener los valores de los campos
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Validar que todos los campos estén completos
    if (!username || !password) {
        displayMessage('Por favor, completa todos los campos.', 'error');
        return;
    }

    const loginData = {
        username: username,
        password: password
    };

    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            displayMessage('¡Inicio de sesión exitoso!', 'success');
            // Redirigir al usuario al área de trabajo después de un breve retraso
            setTimeout(() => {
                window.location.href = '/workspace';
            }, 1000);
        } else {
            displayMessage(data.message, 'error');
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        displayMessage('Ocurrió un error al iniciar sesión. Por favor, inténtalo de nuevo.', 'error');
    });
});

// Función para mostrar mensajes al usuario
function displayMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = type; // Puedes usar clases CSS para estilos
}