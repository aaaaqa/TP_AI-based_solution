// register.js

document.getElementById('registrationForm').addEventListener('submit', function(event) {
    event.preventDefault();

    // Obtener los valores de los campos
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const notify = document.getElementById('notify').checked;

    console.log(notify);

    // Validar que todos los campos estén completos
    if (!username || !email || !password) {
        displayMessage('Por favor, completa todos los campos.', 'error');
        return;
    }

    const userData = {
        username: username,
        email: email,
        password: password,
        notify: notify
    };

    fetch('/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            displayMessage('¡Registro exitoso!', 'success');
            // Redirigir al usuario a la página de inicio de sesión después de un breve retraso
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            displayMessage(data.message, 'error');
        }
    })
    .catch((error) => {
        console.error('Error:', error);
        displayMessage('Ocurrió un error al registrar. Por favor, inténtalo de nuevo.', 'error');
    });
});

// Función para mostrar mensajes al usuario
function displayMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
    messageDiv.className = type; // Puedes usar clases CSS para estilos
}
