document.addEventListener('DOMContentLoaded', function() {
    // Cargar imágenes existentes del paciente
    loadPatientImages();

    document.getElementById('analyzeButton').addEventListener('click', function() {
        const files = document.getElementById('fileUpload').files;
        if (files.length > 0) {
            const formData = new FormData();
            // Agregar el ID del paciente
            const pacienteId = document.getElementById('subjectId').textContent;

            formData.append('paciente_id', pacienteId);

            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }

            // Subir y preprocesar las imágenes
            fetch('/upload_images', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert("Imágenes subidas y preprocesadas correctamente.");

                    // Actualizar la galería de imágenes
                    loadPatientImages();

                    // Enviar las imágenes preprocesadas para analizar
                    return fetch('/analyze_images', {
                        method: 'POST',
                        body: JSON.stringify({ 'imagen_ids': data.imagen_ids }),
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                } else {
                    throw new Error("Error al subir las imágenes: " + data.message);
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert("Análisis completado. Resultados guardados en predicciones.");
                    
                    // Mostrar los resultados en la sección "Reporte de Análisis"
                    displayAnalysisResults(data.results);
                } else {
                    throw new Error("Error al realizar el análisis: " + data.message);
                }
            })
            .catch(error => console.error('Error:', error));
        } else {
            alert('Por favor, sube al menos una tomografía para analizar.');
        }
    });
});

function loadPatientImages() {
    const pacienteId = document.getElementById('subjectId').textContent;
    fetch('/api/get_patient_images?paciente_id=' + pacienteId)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const imageGallery = document.getElementById('imageGallery');
                imageGallery.innerHTML = ''; // Limpiar la galería
                data.images.forEach(image => {
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'image-container';

                    const img = document.createElement('img');
                    img.src = image.url;
                    img.alt = 'Tomografía ' + image.id;
                    img.onclick = function() {
                        openImageInModal(img.src);
                    };

                    // Botón para marcar como imagen principal
                    const mainButton = document.createElement('button');
                    mainButton.textContent = image.es_principal ? 'Imagen Principal' : 'Marcar como Principal';
                    mainButton.disabled = image.es_principal;
                    mainButton.onclick = function() {
                        setMainImage(image.id);
                    };

                    imgContainer.appendChild(img);
                    imgContainer.appendChild(mainButton);

                    // Mostrar imágenes analizadas
                    if (image.analisis_imagenes && image.analisis_imagenes.length > 0) {
                        const analisisContainer = document.createElement('div');
                        analisisContainer.className = 'analisis-container';

                        image.analisis_imagenes.forEach(analisis => {
                            const analisisImg = document.createElement('img');
                            analisisImg.src = analisis.url;
                            analisisImg.alt = 'Análisis ' + analisis.id;
                            analisisImg.onclick = function() {
                                openImageInModal(analisisImg.src);
                            };

                            // Botón para comparar imágenes
                            const compareButton = document.createElement('button');
                            compareButton.textContent = 'Comparar';
                            compareButton.onclick = function() {
                                compareImages(image.url, analisisImg.src);
                            };

                            const analisisInfo = document.createElement('div');
                            analisisInfo.className = 'analisis-info';
                            analisisInfo.textContent = 'Fecha análisis: ' + analisis.fecha_analisis;

                            analisisContainer.appendChild(analisisImg);
                            analisisContainer.appendChild(compareButton);
                            analisisContainer.appendChild(analisisInfo);
                        });

                        imgContainer.appendChild(analisisContainer);
                    }

                    imageGallery.appendChild(imgContainer);
                });
            } else {
                console.error('Error al cargar las imágenes: ' + data.message);
            }
        })
        .catch(error => console.error('Error:', error));
}

function compareImages(originalImageSrc, analyzedImageSrc) {
    // Crear un modal para mostrar ambas imágenes
    const modal = document.getElementById("compareModal");
    const originalImg = document.getElementById("compareOriginalImage");
    const analyzedImg = document.getElementById("compareAnalyzedImage");

    originalImg.src = originalImageSrc;
    analyzedImg.src = analyzedImageSrc;

    modal.style.display = "block";
}

function closeCompareModal() {
    const modal = document.getElementById("compareModal");
    modal.style.display = "none";
}


function displayAnalysisResults(results) {
    const analysisImagesContainer = document.getElementById('analysisImagesContainer');
    analysisImagesContainer.innerHTML = ''; // Limpiar contenido previo

    const detailsContainer = document.getElementById('predictionDetails');
    detailsContainer.innerHTML = ''; // Limpiar contenido previo

    results.forEach(result => {
        // Mostrar imágenes
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'image-wrapper';

        const h3 = document.createElement('h3');
        h3.textContent = 'Imagen ' + result.imagen_id;

        const img = document.createElement('img');
        img.src = result.prediction_image_url;
        img.alt = 'Predicción Imagen ' + result.imagen_id;
        img.onclick = function() {
            openImageInModal(img.src);
        };

        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Descargar Predicción';
        downloadButton.onclick = function() {
            downloadImageFromURL(img.src, img.alt);
        };

        imageWrapper.appendChild(h3);
        imageWrapper.appendChild(img);
        imageWrapper.appendChild(downloadButton);

        analysisImagesContainer.appendChild(imageWrapper);

        // Mostrar detalles de predicción
        const detailsHTML = `
            <div>
                <h3>Predicción para Imagen ${result.imagen_id}</h3>
                <p><strong>Número de Nódulos Detectados:</strong> ${result.predictions.length}</p>
                <!-- Más detalles si es necesario -->
            </div>
        `;
        detailsContainer.innerHTML += detailsHTML;
    });
}

function openImageInModal(imageSrc) {
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImage");
    
    modal.style.display = "block";
    modalImg.src = imageSrc;
}

function closeModal() {
    const modal = document.getElementById("imageModal");
    modal.style.display = "none";
}

function downloadImageFromURL(imageURL, imageName) {
    const link = document.createElement('a');
    link.href = imageURL;
    link.download = imageName;
    link.click();
}

// Cierra el modal al hacer clic fuera de la imagen
window.onclick = function(event) {
    const modal = document.getElementById("imageModal");
    if (event.target === modal) {
        modal.style.display = "none";
    }
};


function setMainImage(imagenId) {
    fetch('/set_main_image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imagen_id: imagenId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Imagen establecida como principal.');
            loadPatientImages();
        } else {
            alert('Error al establecer la imagen principal: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ocurrió un error al establecer la imagen principal.');
    });
}