import os
import numpy as np
import json
from flask import Flask, jsonify, request, render_template, redirect, url_for, flash, session, g, send_from_directory, make_response
from flask_sqlalchemy import SQLAlchemy
from PIL import Image, ImageDraw
from skimage.filters import gaussian, sobel
from skimage.exposure import equalize_hist
from ultralytics import YOLO
from datetime import datetime
import bcrypt
from functools import wraps
from werkzeug.utils import secure_filename
import base64
import shutil
import smtplib
from email.mime.text import MIMEText
import ssl
import csv
from io import StringIO
import re

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Necesario para manejar sesiones y mensajes flash

# Configuración de la base de datos
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app_database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['ORIGINALS_FOLDER'] = 'static/originals'
db = SQLAlchemy(app)

# Directorios de almacenamiento
app.config['UPLOAD_FOLDER'] = os.path.join('uploads')
app.config['PREPROCESSED_FOLDER'] = os.path.join('preprocessed')
app.config['PREDICTIONS_FOLDER'] = os.path.join('predictions')
app.config['RESULTS_FOLDER'] = os.path.join('results')

# Crear las carpetas si no existen
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PREPROCESSED_FOLDER'], exist_ok=True)
os.makedirs(app.config['PREDICTIONS_FOLDER'], exist_ok=True)
os.makedirs(app.config['RESULTS_FOLDER'], exist_ok=True)
os.makedirs(app.config['ORIGINALS_FOLDER'], exist_ok=True)

# Carga el modelo YOLO preentrenado con los pesos en 'last.pt'
model = YOLO('best.pt')

def audit_log(log: str = ''):
    with open('audit_log.txt', 'a') as audit_log_file:
        audit_log_file.write(log)
    audit_log_file.close()

# Modelo de Usuario
class Usuario(db.Model):
    __tablename__ = 'usuarios'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False)  # Añadido campo username
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    notify = db.Column(db.Boolean, nullable=False)
    
    pacientes = db.relationship('Paciente', backref='usuario', cascade="all, delete-orphan")
    
    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

# Modelo de Paciente
class Paciente(db.Model):
    __tablename__ = 'pacientes'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    nombre = db.Column(db.String(100), nullable=False)
    dni = db.Column(db.String(20), unique=True, nullable=False)
    edad = db.Column(db.Integer, nullable=False)
    genero = db.Column(db.String(10), nullable=True)
    fecha_registro = db.Column(db.DateTime, default=datetime.utcnow)
    urgencia = db.Column(db.String(10), default='Bajo')  # Nuevo campo
    
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'))
    
    imagenes = db.relationship('Imagen', backref='paciente', cascade="all, delete-orphan")
    reportes = db.relationship('Reporte', backref='paciente', cascade="all, delete-orphan")


# Modelo de Imagen
class Imagen(db.Model):
    __tablename__ = 'imagenes'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    archivo_path = db.Column(db.String(200), nullable=False)
    fecha_subida = db.Column(db.DateTime, default=datetime.utcnow)
    paciente_id = db.Column(db.Integer, db.ForeignKey('pacientes.id'))
    reporte_id = db.Column(db.Integer, db.ForeignKey('reportes.id'), nullable=True)
    es_principal = db.Column(db.Boolean, default=False)
    es_original = db.Column(db.Boolean, default=True)  # Nuevo campo
    copia_original_guardada = db.Column(db.Boolean, default=False)  # Nuevo campo
    archivo_original_path = db.Column(db.String(200), nullable=True)  # Ruta de la copia original


# Modelo de Reporte
class Reporte(db.Model):
    __tablename__ = 'reportes'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    descripcion = db.Column(db.Text, nullable=True)
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    paciente_id = db.Column(db.Integer, db.ForeignKey('pacientes.id'))

class AnalisisImagen(db.Model):
    __tablename__ = 'analisis_imagenes'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    archivo_path = db.Column(db.String(200), nullable=False)
    fecha_analisis = db.Column(db.DateTime, default=datetime.utcnow)
    imagen_original_id = db.Column(db.Integer, db.ForeignKey('imagenes.id'), nullable=False)
    resultados = db.Column(db.Text, nullable=True)  # Nuevo campo para almacenar los resultados

    # Relación con la imagen original
    imagen_original = db.relationship('Imagen', backref='analisis_imagenes')

# Creación de tablas
with app.app_context():
    db.create_all()

# Decorador para proteger rutas
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Ruta para la página de inicio de sesión y manejo de login
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No se proporcionaron datos'}), 400

        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'success': False, 'message': 'Todos los campos son obligatorios'}), 400

        # Buscar al usuario por nombre de usuario
        user = Usuario.query.filter_by(username=username).first()

        if user and user.check_password(password):
            # Iniciar sesión estableciendo el usuario en la sesión
            session['user_id'] = user.id
            session['username'] = user.username
            audit_log(f'{datetime.now().strftime("%m/%d/%Y, %H:%M:%S")} LOGIN {session['username']}\n')
            return jsonify({'success': True, 'message': 'Inicio de sesión exitoso'}), 200
        else:
            return jsonify({'success': False, 'message': 'Nombre de usuario o contraseña incorrectos'}), 401
    else:
        # Si la solicitud es GET, renderiza la plantilla de inicio de sesión
        return render_template('login.html')

# Ruta de registro de usuario
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No se proporcionaron datos'}), 400

        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        notify = data.get('notify')

        # Validación básica
        if not username or not email or not password:
            return jsonify({'success': False, 'message': 'Todos los campos son obligatorios'}), 400

        # Verificar si el correo o el nombre de usuario ya están registrados
        if Usuario.query.filter_by(email=email).first():
            return jsonify({'success': False, 'message': 'El correo ya está registrado'}), 400

        if Usuario.query.filter_by(username=username).first():
            return jsonify({'success': False, 'message': 'El nombre de usuario ya está en uso'}), 400

        # Crear nuevo usuario
        new_user = Usuario(username=username, email=email, notify=notify)
        new_user.set_password(password)  # Encripta la contraseña
        db.session.add(new_user)
        db.session.commit()

        audit_log(f'{datetime.now().strftime("%m/%d/%Y, %H:%M:%S")} REGISTER {username}\n')

        return jsonify({'success': True, 'message': 'Registro exitoso'}), 200
    else:
        return render_template('register.html')

# Ruta protegida de workspace
@app.route('/workspace')
@login_required
def workspace():
    # Renderiza la plantilla del área de trabajo
    return render_template('workspace.html', username=session.get('username'))

@app.route('/api/get_cases')
@login_required
def get_cases():
    # Obtener el ID del usuario actual
    user_id = session.get('user_id')
    
    # Consultar los pacientes asociados al usuario
    pacientes = Paciente.query.filter_by(usuario_id=user_id).all()

    user = Usuario.query.filter_by(id=user_id).first()
    audit_log(f'{datetime.now().strftime("%m/%d/%Y, %H:%M:%S")} RETRIEVE CASES {user.username}\n')
    
    cases = []
    for paciente in pacientes:
        # Obtener la imagen principal si existe
        imagen_principal = None
        for imagen in paciente.imagenes:
            if imagen.es_principal:
                imagen_principal = imagen
                break

        # Si no hay imagen principal, usar un marcador de posición
        if imagen_principal:
            imagen_path = url_for('serve_uploads', filename=os.path.basename(imagen_principal.archivo_path))
        else:
            imagen_path = url_for('static', filename='images/placeholder.png')

        cases.append({
            'id': paciente.id,
            'nombre': paciente.nombre,
            'dni': paciente.dni,
            'edad': paciente.edad,
            'fecha_registro': paciente.fecha_registro.strftime('%Y-%m-%dT%H:%M:%S') if paciente.fecha_registro else '',
            'imagen_id': imagen_principal.id if imagen_principal else None,
            'imagen_path': imagen_path,
            'urgencia': paciente.urgencia  # Incluir nivel de urgencia
        })
    
    # Devolver los casos
    return jsonify({'cases': cases})



@app.route('/newcase', methods=['GET', 'POST'])
@login_required
def newcase():
    if request.method == 'POST':
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No se proporcionaron datos'}), 400

        nombre = data.get('nombre')
        edad = data.get('edad')
        genero = data.get('genero')
        dni = data.get('dni')
        descripcion = data.get('descripcion')
        urgencia = data.get('urgencia', 'Bajo')  # Obtener el nivel de urgencia

        # Validaciones
        if not nombre or not edad or not dni:
            return jsonify({'success': False, 'message': 'Todos los campos son obligatorios'}), 400

        # Verificar si el DNI ya está registrado
        if Paciente.query.filter_by(dni=dni).first():
            return jsonify({'success': False, 'message': 'El DNI ya está registrado'}), 400

        # Crear nuevo paciente
        new_paciente = Paciente(
            nombre=nombre,
            edad=int(edad),
            genero=genero,
            dni=dni,
            urgencia=urgencia,
            usuario_id=session.get('user_id')
        )

        db.session.add(new_paciente)
        db.session.commit()

        # Crear reporte asociado si es necesario
        if descripcion:
            new_reporte = Reporte(
                descripcion=descripcion,
                paciente_id=new_paciente.id
            )
            db.session.add(new_reporte)
            db.session.commit()

        user = Usuario.query.filter_by(id=session.get('user_id')).first()
        audit_log(f'{datetime.now().strftime("%m/%d/%Y, %H:%M:%S")} NEW CASE {user.username}\n')

        return jsonify({'success': True, 'message': 'Paciente registrado exitosamente'}), 200
    else:
        return render_template('newcase.html')

@app.route('/update_urgency', methods=['POST'])
@login_required
def update_urgency():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No se proporcionaron datos'}), 400

    paciente_id = data.get('paciente_id')
    urgencia = data.get('urgencia')

    if not paciente_id or not urgencia:
        return jsonify({'success': False, 'message': 'Faltan datos necesarios'}), 400

    paciente = Paciente.query.filter_by(id=paciente_id, usuario_id=session.get('user_id')).first()
    if not paciente:
        return jsonify({'success': False, 'message': 'Paciente no encontrado'}), 404

    # Actualizar el nivel de urgencia
    paciente.urgencia = urgencia
    db.session.commit()

    return jsonify({'success': True, 'message': 'Nivel de urgencia actualizado'}), 200


@app.route('/subject')
@login_required
def subject():
    # Obtener el ID del paciente desde los parámetros de la URL
    paciente_id = request.args.get('id')
    if not paciente_id:
        return redirect(url_for('workspace'))
    
    # Consultar el paciente y sus datos
    paciente = Paciente.query.filter_by(id=paciente_id, usuario_id=session.get('user_id')).first()
    if not paciente:
        flash('Paciente no encontrado.', 'error')
        return redirect(url_for('workspace'))
    
    # Renderizar la plantilla con los datos del paciente
    return render_template('subject.html', paciente=paciente)

@app.route('/set_main_image', methods=['POST'])
@login_required
def set_main_image():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No se proporcionaron datos'}), 400

    imagen_id = data.get('imagen_id')
    if not imagen_id:
        return jsonify({'success': False, 'message': 'No se proporcionó el ID de la imagen'}), 400

    # Obtener la imagen y verificar que pertenece al usuario
    imagen = Imagen.query.get(imagen_id)
    if not imagen:
        return jsonify({'success': False, 'message': 'Imagen no encontrada'}), 404

    paciente = Paciente.query.filter_by(id=imagen.paciente_id, usuario_id=session.get('user_id')).first()
    if not paciente:
        return jsonify({'success': False, 'message': 'No tiene permiso para modificar esta imagen'}), 403

    # Establecer la imagen como principal
    # Primero, desmarcar cualquier imagen principal existente
    for img in paciente.imagenes:
        img.es_principal = False

    imagen.es_principal = True
    db.session.commit()

    return jsonify({'success': True, 'message': 'Imagen establecida como principal'}), 200

@app.route('/download_report', methods=['GET'])
@login_required
def download_report():
    paciente_id = request.args.get('paciente_id')
    if not paciente_id:
        return jsonify({'success': False, 'message': 'No se proporcionó el ID del paciente'}), 400

    # Verificar que el paciente pertenece al usuario actual
    paciente = Paciente.query.filter_by(id=paciente_id, usuario_id=session.get('user_id')).first()
    if not paciente:
        return jsonify({'success': False, 'message': 'Paciente no encontrado o no autorizado'}), 404

    # Obtener los datos del paciente
    paciente_data = {
        'id': paciente.id,
        'nombre': paciente.nombre,
        'dni': paciente.dni,
        'edad': paciente.edad,
        'genero': paciente.genero,
        'fecha_registro': paciente.fecha_registro.strftime('%Y-%m-%d %H:%M:%S') if paciente.fecha_registro else '',
        'urgencia': paciente.urgencia,
    }

    # Obtener los análisis realizados
    analisis_list = []
    resultados = []
    for imagen in paciente.imagenes:

        for analisis in imagen.analisis_imagenes:
            # Cargar los resultados almacenados
            preparsed_resultados = analisis.resultados if analisis.resultados else {}
            preparsed_resultados = preparsed_resultados.strip('[]')

            patron_resultados = r'"(\w+)"\s*:\s*("[^"]*"|\d+\.?\d*|\{[^}]*\})'
            preparsed_resultados = re.findall(patron_resultados, preparsed_resultados)

            resultados_data = []

            for _, value in preparsed_resultados:
                if value.startswith("{"):
                    nested_dict = value.strip("{}")
                    nested_pairs = nested_dict.split(",")
                    for pair in nested_pairs:
                        nested_key, nested_value = pair.split(":")
                        nested_key = nested_key.strip('"')
                        nested_value = nested_value.strip()
                        resultados_data.append(nested_value.strip('"'))
                else:
                    resultados_data.append(value.strip('"'))

            analisis_data = {
                'analisis_id': analisis.id,
                'fecha_analisis': analisis.fecha_analisis.strftime('%Y-%m-%d %H:%M:%S'),
                'imagen_original_id': analisis.imagen_original_id,
            }
            analisis_list.append(analisis_data)

            resultados_data[1] = resultados_data[1][:5]
            resultados_data[6] = str(int(resultados_data[6]) * 0.2645833333)[:4]
            resultados_data[7] = str(int(resultados_data[7]) * 0.2645833333)[:4]
            resultados_data[-1] = 'Si' if resultados_data[-1] == '0' else 'No'

            resultados.append(resultados_data)

    output = StringIO()
    writer = csv.writer(output, delimiter=';')

    # Encabezados del archivo CSV
    writer.writerow(['Paciente ID', 'Nombre', 'DNI', 'Edad', 'Genero', 'Fecha Registro', 'Urgencia'])
    writer.writerow([
        paciente_data['id'], paciente_data['nombre'], paciente_data['dni'],
        paciente_data['edad'], paciente_data['genero'], paciente_data['fecha_registro'], paciente_data['urgencia']
    ])

    # Añadir datos de los análisis
    writer.writerow([])  # Línea vacía para separar secciones
    writer.writerow(['Analisis ID', 'Fecha Analisis', 'Imagen Original ID', 'Nombre de archivo', 'Probabilidad', 'Coordenadas.x1', 'Coordenadas.y1', 'Coordenadas.x2', 'Coordenadas.y1', 'Ancho', 'Largo', 'Nodulo'])

    i = 0

    for analisis in analisis_list:
        combine_data = [analisis['analisis_id'], analisis['fecha_analisis'], analisis['imagen_original_id']]
        for data in resultados[i]:
            combine_data.append(data)
        writer.writerow(combine_data)
        i += 1

    response = make_response(output.getvalue())
    response.headers['Content-Type'] = 'text/csv'
    response.headers['Content-Disposition'] = f'attachment; filename=Reporte_Paciente_{paciente_id}.csv'

    return response

@app.route('/save_edited_image', methods=['POST'])
@login_required
def save_edited_image():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No se proporcionaron datos'}), 400

    image_data = data.get('image_data')
    image_id = data.get('image_id')

    if not image_data or not image_id:
        return jsonify({'success': False, 'message': 'Datos incompletos'}), 400

    # Obtener la imagen y verificar permisos
    imagen = Imagen.query.get(image_id)
    if not imagen:
        return jsonify({'success': False, 'message': 'Imagen no encontrada'}), 404

    paciente = Paciente.query.filter_by(id=imagen.paciente_id, usuario_id=session.get('user_id')).first()
    if not paciente:
        return jsonify({'success': False, 'message': 'No tiene permiso para modificar esta imagen'}), 403

    # Verificar que es una imagen original (no generada después del análisis)
    if not imagen.es_original:
        return jsonify({'success': False, 'message': 'Solo se pueden editar imágenes originales'}), 400

    # Si es la primera vez que se edita, hacer una copia de la imagen original
    if not imagen.copia_original_guardada:
        original_filename = os.path.basename(imagen.archivo_path)
        original_copy_filename = f"original_{original_filename}"
        original_copy_path = os.path.join(app.config['ORIGINALS_FOLDER'], original_copy_filename)

        # Copiar la imagen original
        shutil.copy(imagen.archivo_path, original_copy_path)

        # Marcar que se ha guardado la copia
        imagen.copia_original_guardada = True
        imagen.archivo_original_path = original_copy_path
        db.session.commit()

    # Guardar la imagen editada
    image_data = image_data.replace('data:image/png;base64,', '')
    image_bytes = base64.b64decode(image_data)

    edited_image_path = imagen.archivo_path  # Sobrescribir la imagen actual
    with open(edited_image_path, 'wb') as f:
        f.write(image_bytes)

    return jsonify({'success': True, 'message': 'Imagen guardada exitosamente'}), 200

@app.route('/restore_original_image', methods=['POST'])
@login_required
def restore_original_image():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No se proporcionaron datos'}), 400

    image_id = data.get('image_id')

    if not image_id:
        return jsonify({'success': False, 'message': 'Datos incompletos'}), 400

    # Obtener la imagen y verificar permisos
    imagen = Imagen.query.get(image_id)
    if not imagen:
        return jsonify({'success': False, 'message': 'Imagen no encontrada'}), 404

    paciente = Paciente.query.filter_by(id=imagen.paciente_id, usuario_id=session.get('user_id')).first()
    if not paciente:
        return jsonify({'success': False, 'message': 'No tiene permiso para modificar esta imagen'}), 403

    # Verificar que existe una copia de la imagen original
    if not imagen.copia_original_guardada or not imagen.archivo_original_path:
        return jsonify({'success': False, 'message': 'No existe una copia de la imagen original'}), 400

    # Restaurar la imagen original
    shutil.copy(imagen.archivo_original_path, imagen.archivo_path)

    return jsonify({'success': True, 'message': 'Imagen restaurada exitosamente'}), 200


# Ruta para cerrar sesión
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# Ruta raíz o principal, redirigir a login o página de inicio
@app.route('/')
def index():
    return redirect(url_for('login'))  # Redirige a la página de login como página principal

# No es necesario definir rutas para servir archivos estáticos; Flask lo hace automáticamente desde la carpeta 'static'

# Funciones y rutas para procesamiento de imágenes y predicciones
def preprocess_image(filepath):
    try:
        # Cargar imagen y convertir a escala de grises
        image = Image.open(filepath).convert('L')
        image_np = np.array(image).astype(np.float32)

        # Normalizar la imagen
        image_normalized = image_np / 255.0

        # Aplicar filtros de preprocesamiento
        image_smoothed = gaussian(image_normalized, sigma=1)
        image_edges = sobel(image_smoothed)
        image_equalized = equalize_hist(image_edges)

        # Convertir la imagen de nuevo al rango [0, 255] y a tipo uint8
        image_final = (image_equalized * 255).astype(np.uint8)

        # Guardar la imagen preprocesada
        processed_filename = os.path.basename(filepath)
        processed_path = os.path.join(app.config['PREPROCESSED_FOLDER'], processed_filename)
        Image.fromarray(image_final).save(processed_path)

        return processed_path
    except Exception as e:
        print(f"Error en el preprocesamiento: {e}")
        raise

# Ruta para subir y preprocesar una imagen
@app.route('/upload', methods=['POST'])
@login_required
def upload_image():
    if 'file' not in request.files:
        return jsonify({"error": "No se seleccionaron archivos"}), 400

    file = request.files['file']
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(filepath)

    # Preprocesar la imagen
    preprocessed_path = preprocess_image(filepath)

    user = Usuario.query.filter_by(id=session.get('user_id')).first()
    audit_log(f'{datetime.now().strftime("%m/%d/%Y, %H:%M:%S")} UPLOAD IMAGE {user.username}\n')

    return jsonify({"message": "Imagen cargada y preprocesada", "preprocessed_path": preprocessed_path})

@app.route('/upload_images', methods=['POST'])
@login_required
def upload_images():
    paciente_id = request.form.get('paciente_id')
    if not paciente_id:
        return jsonify({'success': False, 'message': 'No se proporcionó el ID del paciente'}), 400

    paciente = Paciente.query.filter_by(id=paciente_id, usuario_id=session.get('user_id')).first()
    if not paciente:
        return jsonify({'success': False, 'message': 'Paciente no encontrado'}), 404

    if 'files' not in request.files:
        return jsonify({'success': False, 'message': 'No se seleccionaron archivos'}), 400

    files = request.files.getlist('files')
    imagen_ids = []

    for file in files:
        if file.filename == '':
            continue
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # Preprocesar la imagen
        preprocessed_path = preprocess_image(filepath)

        # Crear objeto Imagen y asociarlo con el paciente
        nueva_imagen = Imagen(
            archivo_path=filepath,
            fecha_subida=datetime.utcnow(),
            paciente_id=paciente.id
        )
        db.session.add(nueva_imagen)
        db.session.commit()

        imagen_ids.append(nueva_imagen.id)

    user = Usuario.query.filter_by(id=session.get('user_id')).first()
    audit_log(f'{datetime.now().strftime("%m/%d/%Y, %H:%M:%S")} UPLOAD IMAGE {user.username}\n')

    return jsonify({'success': True, 'message': 'Imágenes subidas y preprocesadas', 'imagen_ids': imagen_ids}), 200


# Ruta para cargar y hacer predicción en una imagen
@app.route('/predict', methods=['POST'])
@login_required
def predict():
    if 'file' not in request.files:
        return jsonify({"error": "No se seleccionó ningún archivo"}), 400

    file = request.files['file']
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(filepath)

    # Realizar predicción
    results = model.predict(source=filepath, save=False)
    predictions = []

    # Procesar las predicciones
    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0]
            confidence = box.conf
            class_id = box.cls
            predictions.append({
                "x1": int(x1),
                "y1": int(y1),
                "x2": int(x2),
                "y2": int(y2),
                "confidence": float(confidence),
                "class_id": int(class_id)
            })
    # Elimina el archivo después de la predicción
    os.remove(filepath)

    return jsonify({"predictions": predictions})

# Ruta para analizar la imagen preprocesada y guardar los resultados
@app.route('/analyze', methods=['POST'])
@login_required
def analyze_image():
    preprocessed_file = request.form.get('preprocessed_file')
    if not preprocessed_file:
        return jsonify({"error": "No se proporcionó la imagen preprocesada"}), 400

    # Rutas de las imágenes
    preprocessed_path = os.path.join(app.config['PREPROCESSED_FOLDER'], preprocessed_file)
    original_image_path = os.path.join(app.config['UPLOAD_FOLDER'], preprocessed_file)

    # Realizar la predicción con YOLO
    results = model.predict(source=preprocessed_path, save=False)
    predictions = []

    # Cargar la imagen original para superponer el cuadro de predicción
    image = Image.open(original_image_path)
    draw = ImageDraw.Draw(image)

    # Procesar y guardar la imagen con las predicciones
    for result in results:
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0]
            confidence = box.conf
            class_id = box.cls
            width = x2 - x1
            height = y2 - y1

            predictions.append({
                "filename": preprocessed_file,
                "confidence": float(confidence),
                "coordinates": {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)},
                "size": {"width": int(width), "height": int(height)},
                "class_id": int(class_id)
            })

            # Dibujar el cuadro de predicción en la imagen original
            draw.rectangle([(x1, y1), (x2, y2)], outline="red", width=3)

    # Guardar la imagen con predicciones
    prediction_image_path = os.path.join(app.config['PREDICTIONS_FOLDER'], preprocessed_file)
    image.save(prediction_image_path)

    # Guardar los resultados en formato JSON
    result_json_path = os.path.join(app.config['RESULTS_FOLDER'], f"{os.path.splitext(preprocessed_file)[0]}.json")
    with open(result_json_path, 'w') as json_file:
        json.dump({"predictions": predictions}, json_file, indent=4)

    return jsonify({
        "message": "Predicción realizada y guardada",
        "predictions": predictions,
        "original_image_path": f"/uploads/{preprocessed_file}",
        "prediction_image_path": f"/predictions/{preprocessed_file}",
        "result_json_path": result_json_path
    })

@app.route('/analyze_images', methods=['POST'])
@login_required
def analyze_images():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No se proporcionaron datos'}), 400

    imagen_ids = data.get('imagen_ids')
    if not imagen_ids:
        return jsonify({'success': False, 'message': 'No se proporcionaron IDs de imágenes'}), 400

    results = []
    for imagen_id in imagen_ids:
        imagen = Imagen.query.get(imagen_id)
        if not imagen:
            continue

        preprocessed_file = os.path.basename(imagen.archivo_path)
        preprocessed_path = os.path.join(app.config['PREPROCESSED_FOLDER'], preprocessed_file)
        original_image_path = imagen.archivo_path

        # Realizar la predicción con YOLO
        results_model = model.predict(source=preprocessed_path, save=False)
        predictions = []

        # Cargar la imagen original para superponer el cuadro de predicción
        image = Image.open(original_image_path)
        draw = ImageDraw.Draw(image)

        # Procesar y guardar la imagen con las predicciones
        for result in results_model:
            for box in result.boxes:
                x1, y1, x2, y2 = box.xyxy[0]
                confidence = box.conf
                class_id = box.cls
                width = x2 - x1
                height = y2 - y1

                predictions.append({
                    "filename": preprocessed_file,
                    "confidence": float(confidence),
                    "coordinates": {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)},
                    "size": {"width": int(width), "height": int(height)},
                    "class_id": int(class_id)
                })

                # Dibujar el cuadro de predicción en la imagen original
                draw.rectangle([(x1, y1), (x2, y2)], outline="red", width=3)

        # Guardar la imagen con predicciones
        prediction_image_filename = f"prediction_{preprocessed_file}"
        prediction_image_path = os.path.join(app.config['PREDICTIONS_FOLDER'], prediction_image_filename)
        image.save(prediction_image_path)

        # Guardar los resultados en formato JSON en el campo 'resultados' del modelo
        resultados_json = json.dumps({"predictions": predictions})

        # Guardar la imagen analizada en la base de datos
        analisis_imagen = AnalisisImagen(
            archivo_path=prediction_image_path,
            imagen_original_id=imagen.id,
            resultados=resultados_json
        )
        db.session.add(analisis_imagen)
        db.session.commit()

        results.append({
            'imagen_id': imagen.id,
            'analisis_id': analisis_imagen.id,
            'prediction_image_url': url_for('serve_predictions', filename=prediction_image_filename),
            'predictions': predictions
        })

    user_id = session.get('user_id')
    user = Usuario.query.filter_by(id=user_id).first()
    if user.notify:
        user_email = user.email
        with open('static/user_notify.txt') as user_notify_file:
            user_notify = MIMEText(user_notify_file.read())

        business_email = 'cancervision.dontreply@gmail.com'
        business_password = 'dtcj mwae lvrb sgqq'
        user_notify['Subject'] = 'Su análisis ha finalizado.'
        user_notify['From'] = business_email
        user_notify['To'] = user_email
        context = ssl.create_default_context()

        with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=context) as smtp:
            smtp.login(business_email, business_password)
            smtp.sendmail(business_email, user_email, user_notify.as_string())

    user = Usuario.query.filter_by(id=user_id).first()
    audit_log(f'{datetime.now().strftime("%m/%d/%Y, %H:%M:%S")} ANALYZE IMAGES {user.username}\n')

    return jsonify({'success': True, 'results': results}), 200


@app.route('/api/get_patient_images')
@login_required
def get_patient_images():
    paciente_id = request.args.get('paciente_id')
    if not paciente_id:
        return jsonify({'success': False, 'message': 'No se proporcionó el ID del paciente'}), 400

    paciente = Paciente.query.filter_by(id=paciente_id, usuario_id=session.get('user_id')).first()
    if not paciente:
        return jsonify({'success': False, 'message': 'Paciente no encontrado'}), 404

    images = []
    for imagen in paciente.imagenes:
        # URL de la imagen original
        original_image_url = url_for('serve_uploads', filename=os.path.basename(imagen.archivo_path))
        # Obtener las imágenes analizadas vinculadas a esta imagen original
        analisis_imagenes = []
        for analisis in imagen.analisis_imagenes:
            analisis_image_url = url_for('serve_predictions', filename=os.path.basename(analisis.archivo_path))
            # Cargar los resultados almacenados
            resultados = json.loads(analisis.resultados) if analisis.resultados else {}
            analisis_imagenes.append({
                'id': analisis.id,
                'url': analisis_image_url,
                'fecha_analisis': analisis.fecha_analisis.strftime('%Y-%m-%d %H:%M:%S'),
                'resultados': resultados  # Incluimos los resultados detallados
            })

        images.append({
            'id': imagen.id,
            'url': url_for('serve_uploads', filename=os.path.basename(imagen.archivo_path)),
            'es_principal': imagen.es_principal,
            'es_original': imagen.es_original,
            'analisis_imagenes': analisis_imagenes
        })

    return jsonify({'success': True, 'images': images})



# Rutas para obtener los resultados del análisis
@app.route('/api/get_analysis_results')
@login_required
def get_analysis_results():
    preprocessed_file = request.args.get('preprocessed_file')
    if not preprocessed_file:
        return jsonify({"error": "No se proporcionó el nombre del archivo"}), 400

    # Rutas de las imágenes y JSON
    original_image_path = os.path.join(app.config['UPLOAD_FOLDER'], preprocessed_file)
    prediction_image_path = os.path.join(app.config['PREDICTIONS_FOLDER'], preprocessed_file)
    result_json_path = os.path.join(app.config['RESULTS_FOLDER'], f"{os.path.splitext(preprocessed_file)[0]}.json")

    # Leer el contenido del archivo JSON
    with open(result_json_path, 'r') as json_file:
        predictions = json.load(json_file)["predictions"]

    # Devolver la respuesta JSON
    return jsonify({
        "original_image_path": f"/uploads/{preprocessed_file}",
        "prediction_image_path": f"/predictions/{preprocessed_file}",
        "predictions": predictions
    })

# Rutas para servir archivos en 'uploads' y 'predictions'
@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/predictions/<path:filename>')
def serve_predictions(filename):
    return send_from_directory(app.config['PREDICTIONS_FOLDER'], filename)

if __name__ == '__main__':
    app.run(port=5000, debug=True)