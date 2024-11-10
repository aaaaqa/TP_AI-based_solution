const cases = [
    { id: '001', date: '2023-10-01', image: '1-001_1.jpg' },
    { id: '002', date: '2023-10-02', image: '1-001_2.jpg' },
    { id: '003', date: '2023-10-03', image: '1-001-_2__1.jpg' },
    { id: '004', date: '2023-10-04', image: '1-001-_1__1.jpg' },
    { id: '005', date: '2023-10-05', image: '1-062.jpg' },
    { id: '006', date: '2023-10-06', image: '1-116.jpg' },
    { id: '007', date: '2023-10-07', image: '1-262.jpg' },
];

function displayCases(casesToDisplay) {
    const caseListElement = document.getElementById('caseList');
    caseListElement.innerHTML = '';
    casesToDisplay.forEach(caseItem => {
        const caseDiv = document.createElement('div');
        caseDiv.className = 'case-item';
        
        caseDiv.innerHTML = `
            <img src="${caseItem.image}" alt="Tomography Preview" class="case-preview">
            <div class="case-info">
                <div class="case-id">ID: ${caseItem.id}</div>
                <div class="case-date">${caseItem.date}</div>
            </div>
        `;
        
        caseListElement.appendChild(caseDiv);
    });
}

function handleSearch(event) {
    const query = event.target.value.toLowerCase();
    const filteredCases = cases.filter(caseItem => caseItem.id.toLowerCase().includes(query));
    displayCases(filteredCases);
}

document.getElementById('searchInput').addEventListener('input', handleSearch);

displayCases(cases);