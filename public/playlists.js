/**
 * @file playlists.js
 * @description Capa de persistencia de playlists en `sessionStorage`.
 * Almacena metadatos reales devueltos por la API de Deezer.
 *
 * @fires moodtunes:playlists-updated - Tras cada mutación del store
 *
 * @typedef {Object} Track
 * @property {number} id - ID Deezer
 * @property {string} title
 * @property {string} artist
 * @property {number|null} artistId
 * @property {string} album
 * @property {string} cover - URL portada
 * @property {string} preview - URL preview MP3 (~30s)
 * @property {number} duration - Segundos
 * @property {string} link - Enlace Deezer
 * @property {number} addedAt - Timestamp
 *
 * @typedef {Object} Playlist
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} emoji
 * @property {number} createdAt
 * @property {Track[]} tracks
 *
 * @typedef {Object} AppState
 * @property {string|null} activePlaylistId
 * @property {Playlist[]} playlists
 *
 * @typedef {Object} AddTrackResult
 * @property {boolean} ok
 * @property {'no-preview'|'no-playlist'|'duplicate'} [reason]
 * @property {Playlist} [playlist]
 * @property {Track} [track]
 */
(function (global) {
  "use strict";

  /** Clave única en sessionStorage */
  const STORAGE_KEY = "moodtunes_data";

  /**
   * Genera un identificador único para playlists.
   * @returns {string}
   */
  function uid() {
    return "pl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Estado inicial cuando no hay datos o son inválidos.
   * @returns {AppState}
   */
  function defaultState() {
    return {
      activePlaylistId: null,
      playlists: [],
    };
  }

  /**
   * Nombre visible con emoji opcional.
   * @param {Playlist} pl
   * @returns {string}
   */
  function displayName(pl) {
    const emoji = pl.emoji ? pl.emoji + " " : "";
    return emoji + (pl.name || "Playlist");
  }

  /**
   * Lee y valida el estado desde sessionStorage.
   * @returns {AppState}
   */
  function load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();

      const data = JSON.parse(raw);
      if (!data.playlists) return defaultState();

      // Corrige referencia huérfana a playlist activa
      if (data.activePlaylistId && !data.playlists.some((p) => p.id === data.activePlaylistId)) {
        data.activePlaylistId = data.playlists[0]?.id || null;
      }
      return data;
    } catch {
      return defaultState();
    }
  }

  /**
   * Persiste el estado y notifica a la UI.
   * @param {AppState} data
   */
  function save(data) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    global.dispatchEvent(new CustomEvent("moodtunes:playlists-updated", { detail: data }));
  }

  /**
   * Normaliza un objeto track (desde `data-track` o Deezer) al formato interno.
   * @param {Object} raw
   * @returns {Track|null}
   */
  function normalizeTrack(raw) {
    if (!raw || !raw.id) return null;
    return {
      id: Number(raw.id),
      title: raw.title || "",
      artist: raw.artist || "",
      artistId: raw.artistId || null,
      album: raw.album || "",
      cover: raw.cover || "",
      preview: raw.preview || "",
      duration: raw.duration || 0,
      link: raw.link || "",
      addedAt: Date.now(),
    };
  }

  /**
   * API pública del almacén de playlists.
   * @namespace PlaylistStore
   */
  const PlaylistStore = {
    /** @returns {AppState} */
    getState() {
      return load();
    },

    /** @returns {Playlist[]} */
    getPlaylists() {
      return load().playlists;
    },

    /**
     * Playlist seleccionada actualmente.
     * @returns {Playlist|null}
     */
    getActivePlaylist() {
      const data = load();
      if (!data.playlists.length) return null;
      return (
        data.playlists.find((p) => p.id === data.activePlaylistId) ||
        data.playlists[0]
      );
    },

    /** @returns {boolean} */
    hasPlaylists() {
      return load().playlists.length > 0;
    },

    /**
     * @param {Playlist} pl
     * @returns {string}
     */
    getDisplayName(pl) {
      return displayName(pl);
    },

    /**
     * @param {string} id - ID de playlist
     */
    setActivePlaylist(id) {
      const data = load();
      if (!data.playlists.some((p) => p.id === id)) return;
      data.activePlaylistId = id;
      save(data);
    },

    /**
     * @param {{ name: string, description?: string, emoji?: string }} payload
     * @returns {Playlist}
     */
    createPlaylist({ name, description, emoji }) {
      const data = load();
      const pl = {
        id: uid(),
        name: (name || "").trim() || "Nueva playlist",
        description: (description || "").trim(),
        emoji: (emoji || "").trim() || "🎵",
        createdAt: Date.now(),
        tracks: [],
      };
      data.playlists.push(pl);
      data.activePlaylistId = pl.id;
      save(data);
      return pl;
    },

    /**
     * @param {string} id
     * @returns {boolean}
     */
    deletePlaylist(id) {
      const data = load();
      data.playlists = data.playlists.filter((p) => p.id !== id);
      if (data.activePlaylistId === id) {
        data.activePlaylistId = data.playlists[0]?.id || null;
      }
      save(data);
      return true;
    },

    /**
     * @param {string} id
     * @param {string} name
     */
    renamePlaylist(id, name) {
      const data = load();
      const pl = data.playlists.find((p) => p.id === id);
      if (!pl) return;
      pl.name = name.trim() || pl.name;
      save(data);
    },

    /**
     * Añade una pista si tiene preview y no está duplicada.
     * @param {Object} trackRaw
     * @param {string} [playlistId]
     * @returns {AddTrackResult}
     */
    addTrack(trackRaw, playlistId) {
      const track = normalizeTrack(trackRaw);
      if (!track || !track.preview) return { ok: false, reason: "no-preview" };

      const data = load();
      const pid = playlistId || data.activePlaylistId;
      const pl = data.playlists.find((p) => p.id === pid);
      if (!pl) return { ok: false, reason: "no-playlist" };

      if (pl.tracks.some((t) => t.id === track.id)) {
        return { ok: false, reason: "duplicate" };
      }

      pl.tracks.push(track);
      save(data);
      return { ok: true, playlist: pl, track };
    },

    /**
     * @param {string} playlistId
     * @param {number} trackId
     */
    removeTrack(playlistId, trackId) {
      const data = load();
      const pl = data.playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      pl.tracks = pl.tracks.filter((t) => t.id !== trackId);
      save(data);
    },

    /**
     * @param {number|string} trackId
     * @param {string} [playlistId]
     * @returns {boolean}
     */
    isInPlaylist(trackId, playlistId) {
      const pl = playlistId
        ? load().playlists.find((p) => p.id === playlistId)
        : this.getActivePlaylist();
      return pl ? pl.tracks.some((t) => t.id === Number(trackId)) : false;
    },
  };

  global.PlaylistStore = PlaylistStore;
})(window);
