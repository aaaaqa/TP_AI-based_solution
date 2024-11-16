document.addEventListener('DOMContentLoaded', function() {
    fetchCases();

    // Eventos para búsqueda y ordenamiento
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('sortSelect').addEventListener('change', handleSort);
});

let cases = [];
let filteredCases = [];

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
                <div class="case-urgency">Urgencia: ${caseItem.urgencia}</div>
            </div>
        `;

        // Evento click para redirigir a la página del caso
        caseDiv.addEventListener('click', function() {
            window.location.href = '/subject?id=' + caseItem.id;
        });

        caseListElement.appendChild(caseDiv);
    });
}

function handleSearch(event) {
    const query = event.target.value.toLowerCase();
    filteredCases = cases.filter(caseItem => caseItem.id.toString().includes(query));
    handleSort({ target: document.getElementById('sortSelect') }); // Aplicar ordenamiento actual
}

function handleSort(event) {
    const sortBy = event.target.value;

    // Crear una copia de filteredCases para no modificar el arreglo original
    let casesToSort = [...filteredCases];

    if (sortBy === 'urgency') {
        const urgencyLevels = { 'Crítico': 4, 'Alto': 3, 'Medio': 2, 'Bajo': 1 };
        casesToSort.sort((a, b) => urgencyLevels[b.urgencia] - urgencyLevels[a.urgencia]);
    } else if (sortBy === 'date') {
        casesToSort.sort((a, b) => new Date(b.fecha_registro) - new Date(a.fecha_registro));
    }

    displayCases(casesToSort);
}

function displayMessage(message) {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = message;
}

function clearMessage() {
    const messageDiv = document.getElementById('message');
    messageDiv.textContent = '';
}