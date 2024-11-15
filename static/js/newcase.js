document.getElementById('caseForm').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const patientName = document.getElementById('patientName').value.trim();
    const patientAge = document.getElementById('patientAge').value;
    const patientGender = document.getElementById('patientGender').value;
    const dni = document.getElementById('dni').value.trim();
    const caseDescription = document.getElementById('caseDescription').value.trim();

    const caseData = {
        nombre: patientName,
        edad: patientAge,
        genero: patientGender,
        dni: dni,
        descripcion: caseDescription
    };

    fetch('/newcase', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(caseData)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('¡Caso registrado exitosamente!');
            window.location.href = '/workspace';
        } else {
            alert('Error al registrar el caso: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ocurrió un error al registrar el caso.');
    });
});
