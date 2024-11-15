// static/js/workspace.js

document.addEventListener('DOMContentLoaded', function() {
    fetchCases();

    // Agregar evento al campo de búsqueda
    document.getElementById('searchInput').addEventListener('input', handleSearch);
});

let cases = [];
let filteredCases = [];

// Función para obtener los casos desde la API
function fetchCases() {
    fetch('/api/get_cases')
        .then(response => response.json())
        .then(data => {
            if (data.cases.length > 0) {
                cases = data.cases;
                filteredCases = cases;
                displayCases(filteredCases);
            } else {
                displayMessage('No hay casos disponibles.');
            }
        })
        .catch(error => {
            console.error('Error al obtener los casos:', error);
            displayMessage('Error al obtener los casos.');
        });
}

// Función para mostrar los casos en la interfaz
function displayCases(casesToDisplay) {
    const caseListElement = document.getElementById('caseList');
    caseListElement.innerHTML = '';

    if (casesToDisplay.length === 0) {
        displayMessage('No se encontraron casos con ese ID.');
        return;
    } else {
        clearMessage();
    }

    casesToDisplay.forEach(caseItem => {
        const caseDiv = document.createElement('div');
        caseDiv.className = 'case-item';

        const imageSrc = caseItem.imagen_path;

        caseDiv.innerHTML = `
            <img src="${imageSrc}" alt="Tomography Preview" class="case-preview">
            <div class="case-info">
                <div class="case-id">ID: ${caseItem.id}</div>
                <div class="case-name">Nombre: ${caseItem.nombre}</div>
                <div class="case-date">Fecha: ${caseItem.fecha_registro}</div>
            </div>
        `;

        // Al hacer clic en un caso, redirigir a la página del caso
        caseDiv.addEventListener('click', function() {
            window.location.href = '/subject?id=' + caseItem.id;
        });

        caseListElement.appendChild(caseDiv);
    });
}

// ... (resto del código permanece igual)

// Función para manejar la búsqueda
function handleSearch(event) {
    const query = event.target.value.toLowerCase();
    filteredCases = cases.filter(caseItem => caseItem.id.toString().includes(query));
    displayCases(filteredCases);
}

// Función para mostrar mensajes al usuario
function displayMessage(message) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
}

// Función para limpiar el mensaje
function clearMessage() {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = '';
}
