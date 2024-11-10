document.getElementById('caseForm').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const patientName = document.getElementById('patientName').value;
    const patientAge = document.getElementById('patientAge').value;
    const patientGender = document.getElementById('patientGender').value;
    const dni = document.getElementById('dni').value;
    const caseDescription = document.getElementById('caseDescription').value;
    const date = document.getElementById('date').value;

    const caseData = {
        patientName,
        patientAge,
        patientGender,
        dni,
        caseDescription,
        date
    };

    console.log('New case registered:', caseData);
    
    alert('Case registered successfully!');
    document.getElementById('caseForm').reset();
});