const express = require('express');
const app = express();
const axios = require('axios');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => res.render('index'));

app.get('/buscar', async (req, res) => {
    try {
        const busqueda = req.query.mood;
        const response = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(busqueda)}`);
        res.render('resultados', { canciones: response.data.data, mood: busqueda });
    } catch (e) {
        res.send('Error al buscar en Deezer: ' + e.message);
    }
});

// Playlists en sessionStorage (cliente) — solo renderiza la vista
app.get('/ver-playlist', (req, res) => {
    res.render('mi-playlist');
});

app.listen(3000, () => console.log('Servidor corriendo en http://localhost:3000'));
