# Documentación del código — MoodTunes

Guía rápida para desarrolladores. El detalle de cada función está en los comentarios **JSDoc** de cada archivo.

## Orden de carga (cliente)

```
playlists.js → notify.js → player-controller.js → app.js
```

Definido en `views/partials/layout-end.ejs`.

## Módulos

| Archivo | Responsabilidad | Global |
|---------|-----------------|--------|
| `server.js` | Express, búsqueda Deezer, vistas EJS | — |
| `public/playlists.js` | CRUD playlists en `sessionStorage` | `PlaylistStore` |
| `public/notify.js` | Notification API + evento toast | `MoodNotify` |
| `public/player-controller.js` | Audio único, sync UI | `GlobalPlayer` |
| `public/app.js` | UI, modal, render playlists | — |

## Eventos personalizados

| Evento | Emisor | Uso |
|--------|--------|-----|
| `moodtunes:playlists-updated` | `PlaylistStore` | Refrescar selector y página playlists |
| `moodtunes:dom-updated` | `app.js` | Re-enlazar mini players tras HTML dinámico |
| `moodtunes:notify` | `MoodNotify` | Mostrar toast |
| `moodtunes:player-play` | `GlobalPlayer` | Extensiones futuras |
| `moodtunes:player-pause` | `GlobalPlayer` | Extensiones futuras |

## sessionStorage

| Clave | Contenido |
|-------|-----------|
| `moodtunes_data` | `{ activePlaylistId, playlists[] }` |
| `moodtunes_player` | `{ track, currentTime, wasPlaying, volume }` |

## Atributos HTML importantes

| Atributo | Dónde | Formato |
|----------|-------|---------|
| `data-track` | `.song-card`, `[data-player]`, `.btn-save` | `encodeURIComponent(JSON.stringify(track))` |
| `data-player` | Mini reproductor | Marca contenedor enlazable por `GlobalPlayer` |
| `data-player-bound` | `[data-player]` | `"1"` cuando ya tiene listeners |

## Flujo: guardar canción

1. Usuario pulsa `.btn-save` en resultados.
2. `requirePlaylistBeforeSave()` valida que exista playlist.
3. `PlaylistStore.addTrack()` normaliza y persiste.
4. `MoodNotify` + toast confirman la acción.

## Flujo: reproducir

1. Clic en play (card, overlay o barra global).
2. `GlobalPlayer.toggleTrack()` — misma pista → pause/resume; otra → `loadAndPlay()`.
3. `syncAllProgress()` y `syncPlayingState()` actualizan toda la UI.

## Vistas EJS

| Vista | Ruta | Notas |
|-------|------|-------|
| `index.ejs` | `/` | Hero + búsqueda |
| `resultados.ejs` | `/buscar` | Loop Deezer, `trackJson` por card |
| `mi-playlist.ejs` | `/ver-playlist` | Shell; contenido en `#playlists-app` |

## Convenciones

- **IIFE** en cliente para no contaminar el scope global (solo exportan lo necesario).
- **Strict mode** en todos los scripts del navegador.
- **Sin innerHTML** con datos de usuario sin pasar por `escapeHtml()`.
- Comentarios en español; identificadores y API en inglés cuando es estándar (play, seek, store).
