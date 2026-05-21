(function () {
  "use strict";

  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const navBtn = document.querySelector(".mobile-nav-btn");

  function closeSidebar() {
    sidebar?.classList.remove("open");
    backdrop?.classList.remove("is-visible");
    document.body.classList.remove("sidebar-open");
  }

  function openSidebar() {
    sidebar?.classList.add("open");
    backdrop?.classList.add("is-visible");
    document.body.classList.add("sidebar-open");
  }

  function toggleSidebar() {
    if (sidebar?.classList.contains("open")) closeSidebar();
    else openSidebar();
  }

  if (navBtn && sidebar) {
    navBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSidebar();
    });
    backdrop?.addEventListener("click", closeSidebar);
    sidebar.querySelectorAll(".nav-links a").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 768px)").matches) closeSidebar();
      });
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) closeSidebar();
    });
  }

  document.body.classList.add("has-mobile-nav");

  document.querySelectorAll(".mood-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const input = document.querySelector('input[name="mood"]');
      if (input) {
        input.value = chip.dataset.mood || chip.textContent.trim();
        input.focus();
      }
    });
  });

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function notifyUser(title, body) {
    MoodNotify.showWithPermission(title, body);
  }

  window.addEventListener("moodtunes:notify", (e) => {
    if (e.detail?.body) showToast(e.detail.body);
  });

  const PlaylistModal = {
    modal: null,
    form: null,
    emojiInput: null,
    preview: null,
    onCreated: null,

    init() {
      this.modal = document.getElementById("playlist-modal");
      this.form = document.getElementById("playlist-form");
      this.emojiInput = document.getElementById("playlist-emoji-input");
      this.preview = document.getElementById("modal-emoji-preview");
      if (!this.modal || !this.form) return;

      this.form.addEventListener("submit", (e) => this.onSubmit(e));
      this.modal.querySelectorAll("[data-close-modal]").forEach((el) => {
        el.addEventListener("click", () => this.close());
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.modal.classList.contains("is-open")) this.close();
      });

      this.modal.querySelectorAll(".emoji-opt").forEach((btn) => {
        btn.addEventListener("click", () => this.selectEmoji(btn.dataset.emoji, btn));
      });

      this.emojiInput?.addEventListener("input", () => {
        const v = this.emojiInput.value.trim();
        if (v) {
          this.preview.textContent = v.slice(0, 2);
          this.modal.querySelectorAll(".emoji-opt").forEach((b) => b.classList.remove("is-selected"));
        }
      });

      const desc = document.getElementById("playlist-description");
      const counter = document.getElementById("desc-count");
      desc?.addEventListener("input", () => {
        if (counter) counter.textContent = String(desc.value.length);
      });
    },

    selectEmoji(emoji, btn) {
      if (this.emojiInput) this.emojiInput.value = emoji;
      if (this.preview) this.preview.textContent = emoji;
      this.modal.querySelectorAll(".emoji-opt").forEach((b) => b.classList.remove("is-selected"));
      btn?.classList.add("is-selected");
    },

    open(callback) {
      this.onCreated = callback || null;
      this.form.reset();
      this.selectEmoji(
        "🎵",
        this.modal.querySelector('.emoji-opt[data-emoji="🎵"]')
      );
      const counter = document.getElementById("desc-count");
      if (counter) counter.textContent = "0";
      this.modal.classList.add("is-open");
      this.modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      setTimeout(() => document.getElementById("playlist-name")?.focus(), 200);
      MoodNotify.requestPermission();
    },

    close() {
      this.modal.classList.remove("is-open");
      this.modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      this.onCreated = null;
    },

    onSubmit(e) {
      e.preventDefault();
      const name = document.getElementById("playlist-name")?.value.trim();
      const description = document.getElementById("playlist-description")?.value.trim();
      let emoji = this.emojiInput?.value.trim() || "🎵";
      if (!name) {
        document.getElementById("playlist-name")?.focus();
        showToast("Escribe un nombre para la playlist");
        return;
      }

      const pl = PlaylistStore.createPlaylist({ name, description, emoji });
      this.close();

      notifyUser("MoodTunes", "Playlist «" + PlaylistStore.getDisplayName(pl) + "» creada");

      if (typeof this.onCreated === "function") this.onCreated(pl);
      window.dispatchEvent(new CustomEvent("moodtunes:playlists-updated"));
    },
  };

  function parseTrack(el) {
    const raw = el?.getAttribute("data-track");
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch {
      return null;
    }
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function requirePlaylistBeforeSave(onReady) {
    if (PlaylistStore.hasPlaylists()) {
      if (onReady) onReady();
      return;
    }

    notifyUser(
      "MoodTunes",
      "Primero debes crear una playlist para guardar canciones"
    );

    PlaylistModal.open(() => {
      if (onReady) onReady();
    });
  }

  function initSaveButtons() {
    document.querySelectorAll(".btn-save").forEach((btn) => {
      const track = parseTrack(btn);
      if (!track) return;

      function updateLabel() {
        if (!PlaylistStore.hasPlaylists()) {
          btn.classList.remove("is-saved");
          const label = btn.querySelector(".btn-save-label");
          if (label) label.textContent = "Guardar";
          return;
        }
        const active = PlaylistStore.getActivePlaylist();
        const saved = active && PlaylistStore.isInPlaylist(track.id, active.id);
        btn.classList.toggle("is-saved", !!saved);
        btn.disabled = false;
        btn.classList.remove("is-saving");
        const label = btn.querySelector(".btn-save-label");
        if (label) label.textContent = saved ? "Guardada" : "Guardar";
      }

      updateLabel();

      btn.addEventListener("click", () => {
        requirePlaylistBeforeSave(doSave);

        function doSave() {
          const select = document.getElementById("playlist-select");
          const playlistId = select?.value || PlaylistStore.getState().activePlaylistId;
          const result = PlaylistStore.addTrack(track, playlistId);

          if (result.ok) {
            const name = PlaylistStore.getDisplayName(result.playlist);
            notifyUser("MoodTunes", "Guardada en " + name);
            updateLabel();
            buildPlaylistSelect();
          } else if (result.reason === "duplicate") {
            notifyUser("MoodTunes", "Ya está en esta playlist");
            updateLabel();
          } else if (result.reason === "no-preview") {
            notifyUser("MoodTunes", "Esta canción no tiene preview");
          } else if (result.reason === "no-playlist") {
            requirePlaylistBeforeSave(doSave);
          } else {
            showToast("No se pudo guardar");
          }
        }
      });
    });
  }

  function buildPlaylistSelect() {
    const wrap = document.getElementById("save-playlist-picker");
    if (!wrap) return;

    if (!PlaylistStore.hasPlaylists()) {
      wrap.className = "save-playlist-picker is-empty";
      wrap.innerHTML =
        '<p class="picker-warning">⚠️ Crea una playlist antes de guardar canciones</p>' +
        '<button type="button" class="btn btn-primary btn-sm" id="btn-create-playlist-inline">+ Crear playlist</button>';
      document.getElementById("btn-create-playlist-inline")?.addEventListener("click", () => {
        PlaylistModal.open(() => buildPlaylistSelect());
      });
      return;
    }

    wrap.className = "save-playlist-picker";
    const playlists = PlaylistStore.getPlaylists();
    const activeId = PlaylistStore.getState().activePlaylistId;

    wrap.innerHTML =
      '<label for="playlist-select" class="picker-label">Guardar en</label>' +
      '<select id="playlist-select" class="playlist-select">' +
      playlists
        .map(
          (p) =>
            '<option value="' +
            p.id +
            '"' +
            (p.id === activeId ? " selected" : "") +
            ">" +
            escapeHtml(PlaylistStore.getDisplayName(p)) +
            " (" +
            p.tracks.length +
            ")</option>"
        )
        .join("") +
      '</select>' +
      '<button type="button" class="btn btn-secondary btn-sm" id="btn-create-playlist-inline">+ Nueva</button>';

    document.getElementById("btn-create-playlist-inline")?.addEventListener("click", () => {
      PlaylistModal.open(() => buildPlaylistSelect());
    });
  }

  function renderPlaylistsPage() {
    const root = document.getElementById("playlists-app");
    if (!root) return;

    if (!PlaylistStore.hasPlaylists()) {
      root.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-icon">📋</div>' +
        "<h2>Aún no tienes playlists</h2>" +
        "<p>Crea tu primera playlist con nombre, emoji y descripción.</p>" +
        '<button type="button" class="btn btn-primary" id="btn-first-playlist">+ Crear mi playlist</button>' +
        "</div>";
      document.getElementById("btn-first-playlist")?.addEventListener("click", () => {
        PlaylistModal.open(() => renderPlaylistsPage());
      });
      return;
    }

    const data = PlaylistStore.getState();
    const active = PlaylistStore.getActivePlaylist();
    if (!active) return;

    let sidebarHtml =
      '<div class="pl-sidebar">' +
      '<div class="pl-sidebar-head">' +
      "<h2>Tus playlists</h2>" +
      '<button type="button" class="btn btn-primary btn-sm" id="btn-new-playlist">+ Nueva</button>' +
      "</div>" +
      '<ul class="pl-list">';

    data.playlists.forEach((pl) => {
      sidebarHtml +=
        '<li class="pl-list-item' +
        (pl.id === active.id ? " is-active" : "") +
        '" data-id="' +
        pl.id +
        '">' +
        '<span class="pl-list-emoji">' +
        escapeHtml(pl.emoji || "🎵") +
        "</span>" +
        '<span class="pl-list-name">' +
        escapeHtml(pl.name) +
        "</span>" +
        '<span class="pl-list-count">' +
        pl.tracks.length +
        "</span>" +
        '<button type="button" class="pl-delete-btn" data-delete-pl="' +
        pl.id +
        '" aria-label="Eliminar playlist">✕</button>' +
        "</li>";
    });

    sidebarHtml += "</ul></div>";

    let tracksHtml = '<div class="pl-main">';
    tracksHtml +=
      '<div class="pl-main-header">' +
      "<h2>" +
      escapeHtml((active.emoji || "🎵") + " " + active.name) +
      "</h2>";
    if (active.description) {
      tracksHtml += '<p class="pl-main-desc">' + escapeHtml(active.description) + "</p>";
    }
    tracksHtml += "</div>";

    if (!active.tracks.length) {
      tracksHtml +=
        '<div class="empty-state" style="padding: 2rem 1rem">' +
        '<div class="empty-icon">💿</div>' +
        "<h2>Esta playlist está vacía</h2>" +
        "<p>Busca música y guárdala aquí.</p>" +
        '<a href="/" class="btn btn-primary">Descubrir canciones</a></div>';
    } else {
      tracksHtml += '<div class="playlist-list">';
      active.tracks.forEach((track, i) => {
        const trackJson = encodeURIComponent(JSON.stringify(track));
        tracksHtml +=
          '<div class="playlist-row" data-track="' +
          trackJson +
          '">' +
          '<span class="track-num">' +
          (i + 1) +
          "</span>";
        if (track.cover) {
          tracksHtml +=
            '<img class="track-cover" src="' +
            escapeHtml(track.cover) +
            '" alt="" loading="lazy" width="56" height="56">';
        } else {
          tracksHtml += '<div class="track-cover placeholder">♪</div>';
        }
        tracksHtml +=
          '<div class="track-info"><h3>' +
          escapeHtml(track.title) +
          '</h3><p class="artist">' +
          escapeHtml(track.artist) +
          (track.album ? " · " + escapeHtml(track.album) : "") +
          "</p></div>" +
          '<div class="row-actions">';

        if (track.preview) {
          tracksHtml +=
            '<div class="custom-player custom-player--compact" data-player data-track="' +
            trackJson +
            '">' +
            '<div class="player-bar">' +
            '<button type="button" class="player-play-btn" aria-label="Reproducir">' +
            '<svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
            '<svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z"/></svg>' +
            "</button>" +
            '<div class="player-main"><div class="player-progress">' +
            '<div class="player-progress-track"><div class="player-progress-fill"></div></div>' +
            '<input type="range" class="player-seek" min="0" max="100" value="0" step="0.1"></div>' +
            '<div class="player-meta"><span class="player-time player-time--current">0:00</span>' +
            '<span class="player-time-sep">/</span>' +
            '<span class="player-time player-time--duration">' +
            MoodTunesFormatTime(track.duration || 30) +
            "</span></div></div></div></div>";
        }

        tracksHtml +=
          '<button type="button" class="btn btn-danger btn-sm btn-icon btn-remove-track" data-pl="' +
          active.id +
          '" data-track-id="' +
          track.id +
          '" aria-label="Eliminar">✕</button>' +
          "</div></div>";
      });
      tracksHtml += "</div>";
    }
    tracksHtml += "</div>";

    root.innerHTML = '<div class="pl-layout">' + sidebarHtml + tracksHtml + "</div>";

    root.querySelectorAll(".pl-list-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".pl-delete-btn")) return;
        PlaylistStore.setActivePlaylist(item.dataset.id);
        renderPlaylistsPage();
      });
    });

    root.querySelector("#btn-new-playlist")?.addEventListener("click", () => {
      PlaylistModal.open(() => renderPlaylistsPage());
    });

    root.querySelectorAll(".pl-delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!confirm("¿Eliminar esta playlist y todas sus canciones?")) return;
        PlaylistStore.deletePlaylist(btn.dataset.deletePl);
        renderPlaylistsPage();
        notifyUser("MoodTunes", "Playlist eliminada");
      });
    });

    root.querySelectorAll(".btn-remove-track").forEach((btn) => {
      btn.addEventListener("click", () => {
        PlaylistStore.removeTrack(btn.dataset.pl, Number(btn.dataset.trackId));
        renderPlaylistsPage();
        notifyUser("MoodTunes", "Canción eliminada de la playlist");
      });
    });

    window.dispatchEvent(new CustomEvent("moodtunes:dom-updated"));
    GlobalPlayer.initInlinePlayers();
  }

  PlaylistModal.init();
  GlobalPlayer.init();
  initSaveButtons();
  buildPlaylistSelect();

  window.addEventListener("moodtunes:playlists-updated", () => {
    buildPlaylistSelect();
    renderPlaylistsPage();
    initSaveButtons();
    window.dispatchEvent(new CustomEvent("moodtunes:dom-updated"));
  });

  renderPlaylistsPage();

  document.body.addEventListener(
    "click",
    () => {
      if (MoodNotify.permission === "default") {
        MoodNotify.requestPermission();
      }
    },
    { once: true }
  );
})();
