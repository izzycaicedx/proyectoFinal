/**
 * Reproductor global fijo (estilo Spotify) + volumen persistente
 */
(function (global) {
  "use strict";

  const PLAYER_STATE_KEY = "moodtunes_player";

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function loadPlayerState() {
    try {
      return JSON.parse(sessionStorage.getItem(PLAYER_STATE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function savePlayerState(patch) {
    const prev = loadPlayerState();
    sessionStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ ...prev, ...patch }));
  }

  const GlobalPlayer = {
    audio: null,
    bar: null,
    currentTrack: null,
    activeInlineEl: null,
    volume: 0.8,

    init() {
      this.bar = document.getElementById("global-player");
      this.audio = document.getElementById("global-audio");
      if (!this.bar || !this.audio) return;

      const saved = loadPlayerState();
      this.volume = typeof saved.volume === "number" ? saved.volume : 0.8;
      this.audio.volume = this.volume;

      this.bindBarControls();
      this.restoreLastTrack(saved);

      document.addEventListener("click", (e) => this.onDocumentClick(e));
    },

    bindBarControls() {
      const playBtn = this.bar.querySelector(".gp-play-btn");
      const seek = this.bar.querySelector(".gp-seek");
      const vol = this.bar.querySelector(".gp-volume-input");
      const volBtn = this.bar.querySelector(".gp-volume-btn");
      const fill = this.bar.querySelector(".gp-progress-fill");
      const buffer = this.bar.querySelector(".gp-progress-buffer");
      const timeCur = this.bar.querySelector(".gp-time-current");
      const timeDur = this.bar.querySelector(".gp-time-duration");

      playBtn?.addEventListener("click", () => this.toggle());

      this.audio.addEventListener("play", () => {
        this.bar.classList.add("is-playing", "is-visible");
        document.body.classList.add("has-global-player");
        this.syncInlinePlayers();
        syncInlineProgressGlobal();
        this.emit("play");
      });

      this.audio.addEventListener("pause", () => {
        this.bar.classList.remove("is-playing");
        this.syncInlinePlayers();
        this.persistState();
        this.emit("pause");
      });

      this.audio.addEventListener("ended", () => {
        this.bar.classList.remove("is-playing");
        this.audio.currentTime = 0;
        this.updateProgressUI();
        this.syncInlinePlayers();
        this.persistState();
      });

      this.audio.addEventListener("loadedmetadata", () => {
        if (timeDur) timeDur.textContent = formatTime(this.audio.duration);
      });

      this.audio.addEventListener("timeupdate", () => {
        this.updateProgressUI();
        if (fill && this.audio.duration) {
          const pct = (this.audio.currentTime / this.audio.duration) * 100;
          fill.style.width = pct + "%";
          if (seek) seek.value = String(pct);
        }
        if (timeCur) timeCur.textContent = formatTime(this.audio.currentTime);
        syncInlineProgressGlobal();
      });

      this.audio.addEventListener("progress", () => {
        if (!buffer || !this.audio.duration || !this.audio.buffered.length) return;
        const end = this.audio.buffered.end(this.audio.buffered.length - 1);
        buffer.style.width = (end / this.audio.duration) * 100 + "%";
      });

      seek?.addEventListener("input", () => {
        if (!this.audio.duration) return;
        const pct = parseFloat(seek.value) / 100;
        this.audio.currentTime = pct * this.audio.duration;
        if (fill) fill.style.width = seek.value + "%";
        if (timeCur) timeCur.textContent = formatTime(this.audio.currentTime);
      });

      vol?.addEventListener("input", () => {
        this.setVolume(parseFloat(vol.value) / 100);
      });

      volBtn?.addEventListener("click", () => {
        if (this.volume > 0) {
          this._prevVolume = this.volume;
          this.setVolume(0);
        } else {
          this.setVolume(this._prevVolume || 0.8);
        }
      });

      if (vol) {
        vol.value = String(Math.round(this.volume * 100));
        this.bar.querySelector(".gp-volume-fill")?.style.setProperty("width", vol.value + "%");
      }
    },

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.audio) this.audio.volume = this.volume;
      const vol = this.bar?.querySelector(".gp-volume");
      const fill = this.bar?.querySelector(".gp-volume-fill");
      const btn = this.bar?.querySelector(".gp-volume-btn");
      if (vol) vol.value = String(Math.round(this.volume * 100));
      if (fill) fill.style.width = Math.round(this.volume * 100) + "%";
      if (btn) {
        btn.classList.toggle("is-muted", this.volume === 0);
        btn.setAttribute("aria-label", this.volume === 0 ? "Activar sonido" : "Silenciar");
      }
      savePlayerState({ volume: this.volume });
      this.emit("volume");
    },

    updateProgressUI() {
      /* driven by timeupdate */
    },

    parseTrack(el) {
      const raw = el?.getAttribute("data-track");
      if (!raw) return null;
      try {
        return JSON.parse(decodeURIComponent(raw));
      } catch {
        return null;
      }
    },

    onDocumentClick(e) {
      if (
        e.target.closest(
          ".gp-controls-right, .btn-save, .btn-remove-track, .pl-delete-btn"
        )
      ) {
        return;
      }

      const playBtn = e.target.closest(".player-play-btn, .art-play-overlay");
      const playerEl = e.target.closest("[data-player]");

      if (playBtn || playerEl) {
        const root = playerEl || playBtn?.closest(".song-card, .playlist-row");
        const track = this.parseTrack(root) || this.parseTrack(root?.querySelector("[data-player]"));
        if (track?.preview) {
          e.preventDefault();
          this.play(track, playerEl || root);
        }
      }
    },

    play(track, inlineEl) {
      if (!track?.preview || !this.audio) return;

      const same =
        this.currentTrack &&
        this.currentTrack.id === track.id &&
        this.audio.src.includes(encodeURI(track.preview).slice(0, 40));

      this.currentTrack = track;
      this.activeInlineEl = inlineEl || null;

      if (!same) {
        this.audio.src = track.preview;
      }

      this.updateBarInfo(track);
      this.bar.classList.add("is-visible");
      document.body.classList.add("has-global-player");

      this.audio.play().catch(() => {});
      this.persistState();
    },

    toggle() {
      if (!this.currentTrack) return;
      if (this.audio.paused) this.audio.play().catch(() => {});
      else this.audio.pause();
    },

    pause() {
      this.audio?.pause();
    },

    updateBarInfo(track) {
      const cover = this.bar.querySelector(".gp-cover");
      const title = this.bar.querySelector(".gp-title");
      const artist = this.bar.querySelector(".gp-artist");
      if (cover) {
        cover.src = track.cover || "";
        cover.alt = track.title || "";
      }
      if (title) title.textContent = track.title || "";
      if (artist) artist.textContent = track.artist || "";
    },

    syncInlinePlayers() {
      const playing = this.currentTrack && !this.audio.paused;
      document.querySelectorAll("[data-player]").forEach((el) => {
        const track = this.parseTrack(el);
        const match = playing && track && this.currentTrack && track.id === this.currentTrack.id;
        el.classList.toggle("is-playing", !!match);
        const ctx = el.closest(".song-card, .playlist-row");
        if (ctx) ctx.classList.toggle("is-playing", !!match);
      });
    },

    persistState() {
      if (!this.currentTrack) return;
      savePlayerState({
        track: this.currentTrack,
        currentTime: this.audio?.currentTime || 0,
        wasPlaying: this.audio ? !this.audio.paused : false,
        volume: this.volume,
      });
    },

    restoreLastTrack(saved) {
      if (!saved?.track?.preview) return;
      this.currentTrack = saved.track;
      this.audio.src = saved.track.preview;
      this.updateBarInfo(saved.track);
      this.bar.classList.add("is-visible");
      document.body.classList.add("has-global-player");
      if (saved.currentTime) {
        this.audio.addEventListener(
          "loadedmetadata",
          () => {
            this.audio.currentTime = saved.currentTime;
          },
          { once: true }
        );
      }
      const timeDur = this.bar.querySelector(".gp-time-duration");
      if (timeDur && saved.track.duration) {
        timeDur.textContent = formatTime(saved.track.duration);
      }
    },

    emit(type) {
      global.dispatchEvent(new CustomEvent("moodtunes:player-" + type, { detail: { track: this.currentTrack } }));
    },

    isPlayingTrack(trackId) {
      return (
        this.currentTrack &&
        Number(this.currentTrack.id) === Number(trackId) &&
        this.audio &&
        !this.audio.paused
      );
    },
  };

  function syncInlineProgressGlobal() {
    const gp = GlobalPlayer;
    if (!gp.audio || !gp.currentTrack) return;
    document.querySelectorAll("[data-player].is-playing").forEach((el) => {
      const fill = el.querySelector(".player-progress-fill");
      const seek = el.querySelector(".player-seek");
      const cur = el.querySelector(".player-time--current");
      const dur = el.querySelector(".player-time--duration");
      if (gp.audio.duration) {
        const pct = (gp.audio.currentTime / gp.audio.duration) * 100;
        if (fill) fill.style.width = pct + "%";
        if (seek) seek.value = String(pct);
      }
      if (cur) cur.textContent = formatTime(gp.audio.currentTime);
      if (dur && gp.audio.duration) dur.textContent = formatTime(gp.audio.duration);
    });
  }

  global.GlobalPlayer = GlobalPlayer;
  global.MoodTunesFormatTime = formatTime;
  global.syncInlineProgressGlobal = syncInlineProgressGlobal;
})(window);
