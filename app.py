from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__)

# Ruta para la página de inicio de sesión
@app.route('/login')
def serve_login():
    return send_from_directory('login', 'login.html')

# Ruta para archivos estáticos de la carpeta login (CSS y JS)
@app.route('/login/<path:filename>')
def serve_login_static(filename):
    return send_from_directory('login', filename)

# Agrega más rutas para las demás carpetas como newcase, register, subject, workspace
@app.route('/newcase/<path:filename>')
def serve_newcase_static(filename):
    return send_from_directory('newcase', filename)

@app.route('/register/<path:filename>')
def serve_register_static(filename):
    return send_from_directory('register', filename)

@app.route('/subject/<path:filename>')
def serve_subject_static(filename):
    return send_from_directory('subject', filename)

@app.route('/workspace/<path:filename>')
def serve_workspace_static(filename):
    return send_from_directory('workspace', filename)

# Ruta raíz o principal, redirigir a login o página de inicio
@app.route('/')
def index():
    return send_from_directory('login', 'login.html')  # Redirige a la página de login como página principal

# Ruta general para servir archivos estáticos (CSS, JS) desde subcarpetas
@app.route('/<folder>/<path:filename>')
def serve_static(folder, filename):
    return send_from_directory(folder, filename)

if __name__ == '__main__':
    app.run(port=5000, debug=True)