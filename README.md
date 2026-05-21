# proyectoFinal

# Musica 

Una aplicación web para descubrir música y gestionar tu propia playlist.

## 🚀 Descripción del Proyecto
Es una herramienta interactiva que permite a los usuarios buscar canciones a través de la API de Deezer y guardar sus favoritas en una base de datos local. El proyecto está enfocado en la simplicidad, la persistencia de datos y una interfaz moderna.

## 🛠️ Tecnologías Utilizadas
* **Backend:** Node.js con Express.
* **Motor de plantillas:** EJS.
* **Base de datos:** NeDB (almacenamiento local ligero).
* **API Externa:** Deezer API.
* **Gestor de peticiones:** Axios.

## 📂 Arquitectura del sistema
Para entender cómo se comunican los componentes, este diagrama ilustra el flujo de datos:

1. **Frontend:** El usuario solicita música.
2. **Servidor:** Procesa la solicitud y consulta a la API de Deezer.
3. **Persistencia:** La base de datos NeDB guarda la selección en un archivo local (`/data/playlists.db`).

## 💻 Instalación y Uso
1. **Clonar el repositorio:**
   `git clone https://github.com/izzycaicedx/proyectoFinal.git`
2. **Instalar dependencias:**
   `npm install`
3. **Ejecutar el servidor:**
   `node server.js`
4. **Acceder a la app:**
   Entra en `http://localhost:3000` en tu navegador.

## 👨‍💻 Equipo de Trabajo
* **Isabella Pinzón:** Desarrollo del servidor, lógica de base de datos y consumo de API.
* **Sebastian Arias:** maquetación CSS y experiencia de usuario.
