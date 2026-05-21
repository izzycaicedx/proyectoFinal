const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const Datastore = require('nedb-promises');
const axios = require('axios');

// Configuración de base de datos
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) { fs.mkdirSync(dataDir); }
const db = Datastore.create(path.join(dataDir, 'playlists.db'));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// Rutas
app.get('/', (req, res) => res.render('index'));

app.get('/buscar', async (req, res) => {
    try {
        // Aquí leemos "mood" que viene del formulario
        const busqueda = req.query.mood; 
        const response = await axios.get(`https://api.deezer.com/search?q=${busqueda}`);
        res.render('resultados', { canciones: response.data.data, mood: busqueda });
    } catch (e) { 
        res.send("Error al buscar en Deezer: " + e.message); 
    }
});

app.post('/guardar', async (req, res) => {
    try {
        await db.insert({ titulo: req.body.titulo, artista: req.body.artista });
        res.send("<h1>¡Guardado!</h1><a href='/ver-playlist'>Ver mi playlist</a> | <a href='/'>Volver</a>");
    } catch (e) {
        res.send("Error al guardar en la base de datos.");
    }
});

app.get('/ver-playlist', async (req, res) => {
    const docs = await db.find({});
    res.render('mi-playlist', { cancionesGuardadas: docs });
});

app.listen(3000, () => console.log('Servidor corriendo en http://localhost:3000'));