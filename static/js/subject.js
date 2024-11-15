let isDrawing = false;
let x = 0;
let y = 0;
let canvas, ctx;
let color = '#ff0000';
let imageToEdit = null;
let hasChanges = false;

function openDrawingModal(imageSrc, imageId) {
    imageToEdit = { src: imageSrc, id: imageId };
    hasChanges = false;

    canvas = document.getElementById('drawingCanvas');
    ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = function() {
        // Ajustar el tamaño del canvas a la imagen
        canvas.width = img.width;
        canvas.height = img.height;

        // Limpiar el canvas y dibujar la imagen
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // Configurar eventos para dibujar
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
    };
    img.src = imageSrc;

    // Mostrar el modal
    const modal = document.getElementById('drawingModal');
    modal.style.display = 'block';
}


function startDrawing(event) {
    isDrawing = true;
    x = event.offsetX;
    y = event.offsetY;
}

function draw(event) {
    if (!isDrawing) return;

    hasChanges = true;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(event.offsetX, event.offsetY);
    ctx.stroke();

    x = event.offsetX;
    y = event.offsetY;
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
}

function closeDrawingModal() {
    const modal = document.getElementById('drawingModal');
    modal.style.display = 'none';

    // Remover los eventos del canvas
    canvas.removeEventListener('mousedown', startDrawing);
    canvas.removeEventListener('mousemove', draw);
    canvas.removeEventListener('mouseup', stopDrawing);
    canvas.removeEventListener('mouseout', stopDrawing);
}


// Evento para el colorPicker
document.getElementById('colorPicker').addEventListener('change', function() {
    color = this.value;
});

// Evento para el botón Guardar
document.getElementById('saveDrawingButton').addEventListener('click', function() {
    if (!hasChanges) {
        alert('No se han realizado cambios.');
        return;
    }

    // Obtener la imagen del canvas como Data URL
    const editedImageData = canvas.toDataURL('image/png');

    // Enviar la imagen al servidor
    saveEditedImage(editedImageData, imageToEdit.id);

    // Cerrar el modal
    closeDrawingModal();
});

// Evento para el botón Cancelar
document.getElementById('cancelDrawingButton').addEventListener('click', function() {
    closeDrawingModal();
});

document.getElementById('restoreImageButton').addEventListener('click', function() {
    if (confirm('¿Estás seguro de que deseas restaurar la imagen original? Esta acción no se puede deshacer.')) {
        restoreOriginalImage(imageToEdit.id);
    }
});

function restoreOriginalImage(imageId) {
    fetch('/restore_original_image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_id: imageId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Imagen restaurada exitosamente.');
            // Recargar las imágenes
            loadPatientImages();
        } else {
            alert('Error al restaurar la imagen: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ocurrió un error al restaurar la imagen.');
    });
}


document.addEventListener('DOMContentLoaded', function() {
    // Cargar imágenes existentes del paciente
    loadPatientImages();

    document.getElementById('analyzeButton').addEventListener('click', function() {
        const files = document.getElementById('fileUpload').files;

        var fileSize = true;

        for (var i = 0; file = files[i]; i++) {
            // Higher than 20MB
            if(file.size > 20000000){
                console.log(file.size);
                fileSize = false;
                break;
            }
        } 

        if (files.length > 0 && fileSize == true) {
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
        } else if (fileSize == false) { 
            alert('Los archivos deben pesar menos de 20 MB.');
        } else {
            alert('Por favor, sube al menos una tomografía para analizar.');
        }
    });

    // Evento para actualizar el nivel de urgencia
    document.getElementById('updateUrgencyButton').addEventListener('click', function() {
        const urgency = document.getElementById('urgencySelect').value;
        const pacienteId = document.getElementById('subjectId').textContent;

        fetch('/update_urgency', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 'paciente_id': pacienteId, 'urgencia': urgency })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Nivel de urgencia actualizado.');
            } else {
                alert('Error al actualizar el nivel de urgencia: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocurrió un error al actualizar el nivel de urgencia.');
        });
    });

    // Evento para descargar el informe
    document.getElementById('downloadReportButton').addEventListener('click', function() {
        const pacienteId = document.getElementById('subjectId').textContent.trim();
        downloadReport(pacienteId);
    });
});

function saveEditedImage(imageData, imageId) {
    fetch('/save_edited_image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_data: imageData, image_id: imageId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Imagen guardada exitosamente.');
            // Recargar las imágenes
            loadPatientImages();
        } else {
            alert('Error al guardar la imagen: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Ocurrió un error al guardar la imagen.');
    });
}


// Función para descargar el informe
function downloadReport(pacienteId) {
    fetch(`/download_report?paciente_id=${pacienteId}`)
        .then(response => {
            if (response.ok) {
                return response.blob();
            } else {
                return response.json().then(data => {
                    throw new Error(data.message || 'Error al descargar el informe');
                });
            }
        })
        .then(blob => {
            // Crear un enlace temporal para descargar el archivo
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reporte_Paciente_${pacienteId}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error al descargar el informe: ' + error.message);
        });
}

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

                    // Verificar si es una imagen original
                    if (image.es_original) {
                        img.onclick = function() {
                            openDrawingModal(img.src, image.id);
                        };
                    } else {
                        // Si es una imagen analizada, abrir en el modal de visualización
                        img.onclick = function() {
                            openImageInModal(img.src);
                        };
                    }

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
                        image.analisis_imagenes.forEach(analisis => {
                            const analisisContainer = document.createElement('div');
                            analisisContainer.className = 'analisis-container';

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
                                compareImages(image.url, analisisImg.src, image.id);
                            };

                            // Botón para ver detalles del análisis
                            const detailsButton = document.createElement('button');
                            detailsButton.textContent = 'Ver Detalles';
                            detailsButton.onclick = function() {
                                showAnalysisDetails(analisis.resultados);
                            };

                            const analisisInfo = document.createElement('div');
                            analisisInfo.className = 'analisis-info';
                            analisisInfo.textContent = 'Fecha análisis: ' + analisis.fecha_analisis;

                            analisisContainer.appendChild(analisisImg);
                            analisisContainer.appendChild(compareButton);
                            analisisContainer.appendChild(detailsButton);
                            analisisContainer.appendChild(analisisInfo);

                            imgContainer.appendChild(analisisContainer);
                        });
                    }

                    imageGallery.appendChild(imgContainer);
                });
            } else {
                console.error('Error al cargar las imágenes: ' + data.message);
            }
        })
        .catch(error => console.error('Error:', error));
}

// Función para mostrar detalles del análisis
function showAnalysisDetails(resultados) {
    const detailsContainer = document.getElementById('analysisDetails');
    detailsContainer.innerHTML = ''; // Limpiar contenido previo

    resultados.predictions.forEach((prediction, index) => {
        const detailsHTML = `
            <div class="prediction-detail">
                <h3>Predicción ${index + 1}</h3>
                <p><strong>Confianza:</strong> ${prediction.confidence}</p>
                <p><strong>Coordenadas:</strong> (${prediction.coordinates.x1}, ${prediction.coordinates.y1}) - (${prediction.coordinates.x2}, ${prediction.coordinates.y2})</p>
                <p><strong>Tamaño:</strong> Ancho: ${prediction.size.width}, Alto: ${prediction.size.height}</p>
                <p><strong>ID de Clase:</strong> ${prediction.class_id}</p>
            </div>
        `;
        detailsContainer.innerHTML += detailsHTML;
    });

    // Mostrar el modal de detalles
    const modal = document.getElementById("detailsModal");
    modal.style.display = "block";
}

function closeDetailsModal() {
    const modal = document.getElementById("detailsModal");
    modal.style.display = "none";
}

function compareImages(originalImageUrl, analyzedImageUrl, imageId) {
    // Mostrar las imágenes en el modal de comparación
    document.getElementById('compareOriginalImage').src = originalImageUrl;
    document.getElementById('compareAnalyzedImage').src = analyzedImageUrl;

    // Mostrar el botón de restaurar si es una imagen original
    const restoreButton = document.getElementById('restoreImageButton');
    restoreButton.style.display = 'block';
    restoreButton.onclick = function() {
        if (confirm('¿Estás seguro de que deseas restaurar la imagen original? Esta acción no se puede deshacer.')) {
            restoreOriginalImage(imageId);
        }
    };

    const modal = document.getElementById('compareModal');
    modal.style.display = 'block';
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

function openImageInModal(src) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    modal.style.display = 'block';
    modalImg.src = src;
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