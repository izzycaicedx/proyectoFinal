/**
 * Playlists en sessionStorage — datos reales de Deezer API
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "moodtunes_data";

  function uid() {
    return "pl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function defaultState() {
    return {
      activePlaylistId: null,
      playlists: [],
    };
  }

  function displayName(pl) {
    const emoji = pl.emoji ? pl.emoji + " " : "";
    return emoji + (pl.name || "Playlist");
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const data = JSON.parse(raw);
      if (!data.playlists) return defaultState();
      if (data.activePlaylistId && !data.playlists.some((p) => p.id === data.activePlaylistId)) {
        data.activePlaylistId = data.playlists[0]?.id || null;
      }
      return data;
    } catch {
      return defaultState();
    }
  }

  function save(data) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    global.dispatchEvent(new CustomEvent("moodtunes:playlists-updated", { detail: data }));
  }

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

  const PlaylistStore = {
    getState() {
      return load();
    },

    getPlaylists() {
      return load().playlists;
    },

    getActivePlaylist() {
      const data = load();
      if (!data.playlists.length) return null;
      return (
        data.playlists.find((p) => p.id === data.activePlaylistId) ||
        data.playlists[0]
      );
    },

    hasPlaylists() {
      return load().playlists.length > 0;
    },

    getDisplayName(pl) {
      return displayName(pl);
    },

    setActivePlaylist(id) {
      const data = load();
      if (!data.playlists.some((p) => p.id === id)) return;
      data.activePlaylistId = id;
      save(data);
    },

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

    deletePlaylist(id) {
      const data = load();
      data.playlists = data.playlists.filter((p) => p.id !== id);
      if (data.activePlaylistId === id) {
        data.activePlaylistId = data.playlists[0]?.id || null;
      }
      save(data);
      return true;
    },

    renamePlaylist(id, name) {
      const data = load();
      const pl = data.playlists.find((p) => p.id === id);
      if (!pl) return;
      pl.name = name.trim() || pl.name;
      save(data);
    },

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

    removeTrack(playlistId, trackId) {
      const data = load();
      const pl = data.playlists.find((p) => p.id === playlistId);
      if (!pl) return;
      pl.tracks = pl.tracks.filter((t) => t.id !== trackId);
      save(data);
    },

    isInPlaylist(trackId, playlistId) {
      const pl = playlistId
        ? load().playlists.find((p) => p.id === playlistId)
        : this.getActivePlaylist();
      return pl ? pl.tracks.some((t) => t.id === Number(trackId)) : false;
    },
  };

  global.PlaylistStore = PlaylistStore;
})(window);
