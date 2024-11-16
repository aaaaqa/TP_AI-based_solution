// Obtener referencias a los elementos
const registrationForm = document.getElementById('registrationForm');
const usernameField = document.getElementById('username');
const emailField = document.getElementById('email');
const passwordField = document.getElementById('password');
const confirmPasswordField = document.getElementById('confirmPassword');
const notifyField = document.getElementById('notify');

const passwordError = document.getElementById('passwordError');
const confirmPasswordError = document.getElementById('confirmPasswordError');

// Función para validar la contraseña
function validatePassword() {
    const password = passwordField.value;
    let isValid = true;
    let errorMessage = '';

    // Verificar longitud mínima
    if (password.length < 8) {
        isValid = false;
        errorMessage = 'La contraseña debe tener al menos 8 caracteres.';
    }

    // Verificar que contenga al menos un número
    else if (!/\d/.test(password)) {
        isValid = false;
        errorMessage = 'La contraseña debe contener al menos un número.';
    }

    // Mostrar mensaje de error si no es válida
    if (!isValid) {
        passwordError.textContent = errorMessage;
    } else {
        passwordError.textContent = '';
    }

    return isValid;
}

// Función para validar que las contraseñas coincidan
function validateConfirmPassword() {
    const password = passwordField.value;
    const confirmPassword = confirmPasswordField.value;
    let isValid = true;

    if (password !== confirmPassword) {
        isValid = false;
        confirmPasswordError.textContent = 'Las contraseñas no coinciden.';
    } else {
        confirmPasswordError.textContent = '';
    }

    return isValid;
}

// Escuchar eventos de entrada en los campos de contraseña
passwordField.addEventListener('input', function() {
    validatePassword();
    validateConfirmPassword();
});

confirmPasswordField.addEventListener('input', validateConfirmPassword);

// Manejador del evento submit
registrationForm.addEventListener('submit', function(event) {
    event.preventDefault();

    // Validar los campos
    const isPasswordValid = validatePassword();
    const isConfirmPasswordValid = validateConfirmPassword();

    if (!isPasswordValid || !isConfirmPasswordValid) {
        displayMessage('Por favor, corrige los errores en el formulario.', 'error');
        return;
    }

    // Obtener los valores de los campos
    const username = usernameField.value.trim();
    const email = emailField.value.trim();
    const password = passwordField.value;
    const confirmPassword = confirmPasswordField.value;
    const notify = notifyField.checked;

    // Validar que todos los campos estén completos
    if (!username || !email || !password) {
        displayMessage('Por favor, completa todos los campos.', 'error');
        return;
    }

    const userData = {
        username: username,
        email: email,
        password: password,
        confirm_password: confirmPassword,
        notify: notify
    };

    console.log('Datos a enviar:', userData);  // Para depuración

    fetch('/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
    })
    .then(response => {
        return response.json().then(data => {
            return { status: response.status, body: data };
        });
    })
    .then(({ status, body }) => {
        if (status === 201) {  // Registro exitoso
            // Ocultar el formulario
            const form = document.getElementById('registrationForm');
            form.style.display = 'none';

            // Mostrar mensaje de éxito
            displayMessage('¡Registro exitoso!', 'success');

            // Redirigir al usuario a la página de inicio de sesión después de un breve retraso
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            // Mostrar mensaje de error
            displayMessage(body.message, 'error');

            // Limpiar los campos del formulario si es necesario
            // Puedes decidir qué campos limpiar según el error
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
    messageDiv.textContent = ''; // Limpiar mensajes anteriores
    messageDiv.className = ''; // Resetear clases

    const resultMessageDiv = document.getElementById('resultMessage');
    resultMessageDiv.innerHTML = ''; // Limpiar mensajes anteriores
    resultMessageDiv.className = 'result-message ' + type;

    const symbolSpan = document.createElement('span');
    symbolSpan.className = 'symbol';

    if (type === 'success') {
        symbolSpan.textContent = '✔'; // Símbolo de check
    } else if (type === 'error') {
        symbolSpan.textContent = '✖'; // Símbolo de equis
    }

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;

    resultMessageDiv.appendChild(symbolSpan);
    resultMessageDiv.appendChild(messageSpan);
}
