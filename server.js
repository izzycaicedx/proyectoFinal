/**
 * MoodTunes — Servidor Express
 * ---------------------------------
 * Responsabilidades:
 * - Servir vistas EJS y archivos estáticos (`/public`)
 * - Proxy de búsqueda hacia la API pública de Deezer
 *
 * Las playlists y el reproductor viven en el cliente (sessionStorage).
 * @see public/playlists.js
 * @see public/player-controller.js
 */

const express = require('express');
const axios = require('axios');

/** @type {import('express').Express} */
const app = express();

const PORT = 3000;
const DEEZER_SEARCH_URL = 'https://api.deezer.com/search';

// ——— Configuración Express ———
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

/**
 * Página de inicio: formulario de búsqueda por mood.
 * @route GET /
 */
app.get('/', (req, res) => res.render('index'));

/**
 * Busca canciones en Deezer y renderiza la grilla de resultados.
 * @route GET /buscar?mood={termino}
 * @param {string} req.query.mood - Término de búsqueda (artista, género, mood, etc.)
 */
app.get('/buscar', async (req, res) => {
    try {
        const busqueda = req.query.mood;
        const url = `${DEEZER_SEARCH_URL}?q=${encodeURIComponent(busqueda)}`;
        const response = await axios.get(url);

        res.render('resultados', {
            canciones: response.data.data,
            mood: busqueda,
        });
    } catch (error) {
        res.status(500).send('Error al buscar en Deezer: ' + error.message);
    }
});

/**
 * Vista de playlists; los datos se cargan en el cliente vía PlaylistStore.
 * @route GET /ver-playlist
 */
app.get('/ver-playlist', (req, res) => {
    res.render('mi-playlist');
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
