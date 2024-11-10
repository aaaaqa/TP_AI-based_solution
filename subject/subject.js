document.getElementById('analyzeButton').addEventListener('click', function() {
    const files = document.getElementById('fileUpload').files;
    if (files.length > 0) {
        alert(`Analyzing ${files.length} new tomographies with AI...`);
        generateReport(files.length);
    } else {
        alert('Please upload at least one tomography to analyze.');
    }
});

function viewImage(imageSrc) {
    const imageOverlay = document.createElement('div');
    imageOverlay.style.position = 'fixed';
    imageOverlay.style.top = '0';
    imageOverlay.style.left = '0';
    imageOverlay.style.width = '100%';
    imageOverlay.style.height = '100%';
    imageOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    imageOverlay.style.display = 'flex';
    imageOverlay.style.justifyContent = 'center';
    imageOverlay.style.alignItems = 'center';
    imageOverlay.style.zIndex = '1000';
    
    const img = document.createElement('img');
    img.src = imageSrc;
    img.style.maxWidth = '90%';
    img.style.maxHeight = '90%';
    
    imageOverlay.appendChild(img);
    document.body.appendChild(imageOverlay);
    
    imageOverlay.addEventListener('click', function() {
        document.body.removeChild(imageOverlay);
    });
}

function generateReport(fileCount) {
    const reportSection = document.querySelector('.reports-section');
    reportSection.innerHTML = '<h2>Reports</h2>';
    
    for (let i = 1; i <= fileCount; i++) {
        const reportParagraph = document.createElement('p');
        reportParagraph.textContent = `Report for Tomography ${i}: Analysis complete. Nodules detected: ${Math.floor(Math.random() * 5)+1}`;
        
        reportSection.appendChild(reportParagraph);
    }
}