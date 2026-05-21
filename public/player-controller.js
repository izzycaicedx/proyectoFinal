/**
 * @file player-controller.js
 * @description Reproductor de audio unificado (patrón single source of truth).
 *
 * - Un único elemento `<audio id="global-audio">` reproduce el audio.
 * - Los `[data-player]` en cards son controles espejo (play, seek, tiempos).
 * - `toggleTrack()` aplica la misma lógica en barra inferior y mini players.
 *
 * @fires moodtunes:player-play
 * @fires moodtunes:player-pause
 * @fires moodtunes:player-volume
 *
 * Escucha:
 * @listens moodtunes:dom-updated - Re-enlaza mini players tras render dinámico
 *
 * @typedef {Object} TrackPayload
 * @property {number} id
 * @property {string} title
 * @property {string} artist
 * @property {string} [cover]
 * @property {string} preview
 * @property {number} [duration]
 *
 * @namespace GlobalPlayer
 */
(function (global) {
  "use strict";

  /** @type {string} Clave sessionStorage para volumen, pista y posición */
  const PLAYER_STATE_KEY = "moodtunes_player";

  /**
   * Formatea segundos a m:ss
   * @param {number} sec
   * @returns {string}
   */
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  /** @returns {Object} */
  function loadPlayerState() {
    try {
      return JSON.parse(sessionStorage.getItem(PLAYER_STATE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  /** @param {Object} patch */
  function savePlayerState(patch) {
    const prev = loadPlayerState();
    sessionStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ ...prev, ...patch }));
  }

  const GlobalPlayer = {
    /** @type {HTMLAudioElement|null} */
    audio: null,
    /** @type {HTMLElement|null} */
    bar: null,
    /** @type {TrackPayload|null} */
    currentTrack: null,
    /** @type {HTMLElement|null} */
    activeInlineEl: null,
    /** @type {number} 0–1 */
    volume: 0.8,

    /** Inicializa controles, restaura sesión y enlaza mini players */
    init() {
      this.bar = document.getElementById("global-player");
      this.audio = document.getElementById("global-audio");
      if (!this.bar || !this.audio) return;

      const saved = loadPlayerState();
      this.volume = typeof saved.volume === "number" ? saved.volume : 0.8;
      this.audio.volume = this.volume;

      this.bindBarControls();
      this.restoreLastTrack(saved);
      this.initInlinePlayers();

      global.addEventListener("moodtunes:dom-updated", () => this.initInlinePlayers());
      document.addEventListener("click", (e) => this.onDocumentClick(e));
    },

    trackId(track) {
      return track ? Number(track.id) : null;
    },

    isSameTrack(track) {
      return (
        track &&
        this.currentTrack &&
        this.trackId(track) === this.trackId(this.currentTrack)
      );
    },

    /**
     * Lee JSON desde atributo `data-track` (URI-encoded).
     * @param {Element} el
     * @returns {TrackPayload|null}
     */
    parseTrack(el) {
      const raw = el?.getAttribute("data-track");
      if (!raw) return null;
      try {
        return JSON.parse(decodeURIComponent(raw));
      } catch {
        return null;
      }
    },

    getInlineEls() {
      return document.querySelectorAll("[data-player]");
    },

    getBarEls() {
      return {
        playBtn: this.bar?.querySelector(".gp-play-btn"),
        seek: this.bar?.querySelector(".gp-seek"),
        fill: this.bar?.querySelector(".gp-progress-fill"),
        buffer: this.bar?.querySelector(".gp-progress-buffer"),
        timeCur: this.bar?.querySelector(".gp-time-current"),
        timeDur: this.bar?.querySelector(".gp-time-duration"),
      };
    },

    getInlineElsFrom(playerEl) {
      return {
        playBtn: playerEl.querySelector(".player-play-btn"),
        seek: playerEl.querySelector(".player-seek"),
        fill: playerEl.querySelector(".player-progress-fill"),
        buffer: playerEl.querySelector(".player-progress-buffer"),
        timeCur: playerEl.querySelector(".player-time--current"),
        timeDur: playerEl.querySelector(".player-time--duration"),
      };
    },

    /**
     * Sincroniza barra de progreso, tiempos y buffer en global + inline activo.
     */
    syncAllProgress() {
      if (!this.audio || !this.currentTrack) return;

      const pct = this.audio.duration
        ? (this.audio.currentTime / this.audio.duration) * 100
        : 0;
      const cur = formatTime(this.audio.currentTime);
      const dur = this.audio.duration
        ? formatTime(this.audio.duration)
        : null;

      const bar = this.getBarEls();
      if (bar.fill) bar.fill.style.width = pct + "%";
      if (bar.seek) bar.seek.value = String(pct);
      if (bar.timeCur) bar.timeCur.textContent = cur;
      if (bar.timeDur && dur) bar.timeDur.textContent = dur;

      if (this.audio.buffered.length && this.audio.duration) {
        const end = this.audio.buffered.end(this.audio.buffered.length - 1);
        const bufPct = (end / this.audio.duration) * 100;
        if (bar.buffer) bar.buffer.style.width = bufPct + "%";
      }

      this.getInlineEls().forEach((el) => {
        if (!this.isSameTrack(this.parseTrack(el))) return;
        const inline = this.getInlineElsFrom(el);
        if (inline.fill) inline.fill.style.width = pct + "%";
        if (inline.seek) {
          inline.seek.value = String(pct);
          inline.seek.disabled = false;
        }
        if (inline.timeCur) inline.timeCur.textContent = cur;
        if (inline.timeDur && dur) inline.timeDur.textContent = dur;
        if (inline.buffer && this.audio.buffered.length && this.audio.duration) {
          const end = this.audio.buffered.end(this.audio.buffered.length - 1);
          inline.buffer.style.width = (end / this.audio.duration) * 100 + "%";
        }
      });
    },

    setDurationOnAll() {
      if (!this.audio?.duration) return;
      const dur = formatTime(this.audio.duration);
      const bar = this.getBarEls();
      if (bar.timeDur) bar.timeDur.textContent = dur;

      this.getInlineEls().forEach((el) => {
        if (!this.isSameTrack(this.parseTrack(el))) return;
        const inline = this.getInlineElsFrom(el);
        if (inline.timeDur) inline.timeDur.textContent = dur;
        const seek = inline.seek;
        if (seek) seek.disabled = false;
      });
    },

    /** Actualiza clases `is-playing`, visibilidad de barra y aria-labels */
    syncPlayingState() {
      const playing = !!(this.currentTrack && this.audio && !this.audio.paused);

      if (this.bar) {
        this.bar.classList.toggle("is-playing", playing);
        if (this.currentTrack) {
          this.bar.classList.add("is-visible");
          document.body.classList.add("has-global-player");
        }
        const gpBtn = this.bar.querySelector(".gp-play-btn");
        if (gpBtn) {
          gpBtn.setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
        }
      }

      this.getInlineEls().forEach((el) => {
        const track = this.parseTrack(el);
        const match = playing && this.isSameTrack(track);
        const isActive = this.isSameTrack(track);

        el.classList.toggle("is-playing", match);
        const ctx = el.closest(".song-card, .playlist-row");
        if (ctx) ctx.classList.toggle("is-playing", match);

        const btn = el.querySelector(".player-play-btn");
        if (btn) {
          btn.setAttribute(
            "aria-label",
            match ? "Pausar" : isActive ? "Reanudar" : "Reproducir preview"
          );
        }
      });
    },

    /**
     * Busca en la pista por porcentaje (0–100).
     * @param {number} pct
     */
    seekToPercent(pct) {
      if (!this.audio?.duration) return;
      const p = Math.max(0, Math.min(100, pct));
      this.audio.currentTime = (p / 100) * this.audio.duration;
      this.syncAllProgress();
      this.persistState();
    },

    /**
     * Play / pause / cambio de pista (misma lógica en barra y cards).
     * @param {TrackPayload} track
     * @param {HTMLElement} [inlineEl]
     */
    toggleTrack(track, inlineEl) {
      if (!track?.preview || !this.audio) return;

      if (this.isSameTrack(track)) {
        if (this.audio.paused) {
          this.audio.play().catch(() => {});
        } else {
          this.audio.pause();
        }
        return;
      }

      this.loadAndPlay(track, inlineEl);
    },

    /**
     * Carga nueva fuente de audio y reproduce.
     * @param {TrackPayload} track
     * @param {HTMLElement} [inlineEl]
     */
    loadAndPlay(track, inlineEl) {
      this.currentTrack = track;
      this.activeInlineEl = inlineEl || null;
      this.audio.src = track.preview;

      this.updateBarInfo(track);
      this.bar?.classList.add("is-visible");
      document.body.classList.add("has-global-player");

      this.getInlineEls().forEach((el) => {
        const t = this.parseTrack(el);
        const inline = this.getInlineElsFrom(el);
        if (this.isSameTrack(t)) {
          if (inline.seek) inline.seek.disabled = false;
          if (inline.timeDur && track.duration) {
            inline.timeDur.textContent = formatTime(track.duration);
          }
        } else {
          el.classList.remove("is-playing");
          const ctx = el.closest(".song-card, .playlist-row");
          if (ctx) ctx.classList.remove("is-playing");
        }
      });

      this.audio.play().catch(() => {});
      this.persistState();
    },

    bindBarControls() {
      const bar = this.getBarEls();
      const vol = this.bar.querySelector(".gp-volume-input");
      const volBtn = this.bar.querySelector(".gp-volume-btn");

      bar.playBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!this.currentTrack) return;
        this.toggleTrack(this.currentTrack, null);
      });

      bar.seek?.addEventListener("input", (e) => {
        e.stopPropagation();
        if (!this.currentTrack) return;
        this.seekToPercent(parseFloat(bar.seek.value));
      });

      this.audio.addEventListener("play", () => {
        this.syncPlayingState();
        syncInlineProgressGlobal();
        this.emit("play");
      });

      this.audio.addEventListener("pause", () => {
        this.syncPlayingState();
        this.persistState();
        this.emit("pause");
      });

      this.audio.addEventListener("ended", () => {
        this.audio.currentTime = 0;
        this.syncPlayingState();
        this.syncAllProgress();
        this.persistState();
      });

      this.audio.addEventListener("loadedmetadata", () => {
        this.setDurationOnAll();
        this.syncAllProgress();
      });

      this.audio.addEventListener("timeupdate", () => {
        this.syncAllProgress();
      });

      this.audio.addEventListener("progress", () => {
        this.syncAllProgress();
      });

      vol?.addEventListener("input", () => {
        this.setVolume(parseFloat(vol.value) / 100);
      });

      volBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.volume > 0) {
          this._prevVolume = this.volume;
          this.setVolume(0);
        } else {
          this.setVolume(this._prevVolume || 0.8);
        }
      });

      if (vol) {
        vol.value = String(Math.round(this.volume * 100));
        this.bar.querySelector(".gp-volume-fill")?.style.setProperty(
          "width",
          vol.value + "%"
        );
      }
    },

    /**
     * Enlaza eventos de un mini player (idempotente vía data-player-bound).
     * @param {HTMLElement} el
     */
    bindInlinePlayer(el) {
      if (el.dataset.playerBound === "1") return;
      el.dataset.playerBound = "1";

      const inline = this.getInlineElsFrom(el);
      const track = this.parseTrack(el);

      if (inline.timeDur && track?.duration) {
        inline.timeDur.textContent = formatTime(track.duration);
      }
      if (inline.seek) inline.seek.disabled = false;

      inline.playBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        const t = this.parseTrack(el);
        if (t) this.toggleTrack(t, el);
      });

      inline.seek?.addEventListener("input", (e) => {
        e.stopPropagation();
        if (!this.isSameTrack(this.parseTrack(el))) return;
        this.seekToPercent(parseFloat(inline.seek.value));
      });

      el.addEventListener("click", (e) => {
        if (
          e.target.closest(
            ".player-play-btn, .player-seek, .player-progress, .player-volume-wrap"
          )
        ) {
          return;
        }
        const t = this.parseTrack(el);
        if (t?.preview) {
          e.preventDefault();
          this.toggleTrack(t, el);
        }
      });
    },

    /** Enlaza todos los `[data-player]` presentes en el DOM */
    initInlinePlayers() {
      this.getInlineEls().forEach((el) => this.bindInlinePlayer(el));
      this.syncPlayingState();
      this.syncAllProgress();
    },

    setVolume(v) {
      this.volume = Math.max(0, Math.min(1, v));
      if (this.audio) this.audio.volume = this.volume;
      const volInput = this.bar?.querySelector(".gp-volume-input");
      const fill = this.bar?.querySelector(".gp-volume-fill");
      const btn = this.bar?.querySelector(".gp-volume-btn");
      if (volInput) volInput.value = String(Math.round(this.volume * 100));
      if (fill) fill.style.width = Math.round(this.volume * 100) + "%";
      if (btn) {
        btn.classList.toggle("is-muted", this.volume === 0);
        btn.setAttribute("aria-label", this.volume === 0 ? "Activar sonido" : "Silenciar");
      }
      savePlayerState({ volume: this.volume });
      this.emit("volume");
    },

    /** Delegación: overlay de portada en song-card */
    onDocumentClick(e) {
      if (
        e.target.closest(
          ".gp-controls-right, .gp-volume-input, .gp-volume-btn, .gp-seek, .gp-progress, .btn-save, .btn-remove-track, .pl-delete-btn"
        )
      ) {
        return;
      }

      const overlay = e.target.closest(".art-play-overlay");
      if (overlay) {
        e.preventDefault();
        const root = overlay.closest(".song-card, .playlist-row");
        const track =
          this.parseTrack(root) || this.parseTrack(root?.querySelector("[data-player]"));
        if (track?.preview) {
          this.toggleTrack(track, root?.querySelector("[data-player]") || root);
        }
        return;
      }

      const gpPlay = e.target.closest(".gp-play-btn");
      if (gpPlay) return;
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

      const applyTime = () => {
        if (saved.currentTime) this.audio.currentTime = saved.currentTime;
        this.setDurationOnAll();
        this.syncAllProgress();
        this.syncPlayingState();
        if (saved.wasPlaying) {
          this.audio.play().catch(() => this.syncPlayingState());
        }
      };

      if (this.audio.readyState >= 1) applyTime();
      else this.audio.addEventListener("loadedmetadata", applyTime, { once: true });

      if (saved.track.duration) {
        const bar = this.getBarEls();
        if (bar.timeDur) bar.timeDur.textContent = formatTime(saved.track.duration);
      }
    },

    /** Compatibilidad con código existente */
    play(track, inlineEl) {
      this.toggleTrack(track, inlineEl);
    },

    toggle() {
      if (this.currentTrack) this.toggleTrack(this.currentTrack, null);
    },

    pause() {
      this.audio?.pause();
    },

    syncInlinePlayers() {
      this.syncPlayingState();
      this.syncAllProgress();
    },

    emit(type) {
      global.dispatchEvent(
        new CustomEvent("moodtunes:player-" + type, { detail: { track: this.currentTrack } })
      );
    },

    isPlayingTrack(trackId) {
      return (
        this.currentTrack &&
        this.trackId(this.currentTrack) === Number(trackId) &&
        this.audio &&
        !this.audio.paused
      );
    },
  };

  /**
   * Alias usado por listeners de audio; mantiene compatibilidad con app.js.
   */
  function syncInlineProgressGlobal() {
    GlobalPlayer.syncAllProgress();
  }

  global.GlobalPlayer = GlobalPlayer;
  global.MoodTunesFormatTime = formatTime;
  global.syncInlineProgressGlobal = syncInlineProgressGlobal;
})(window);
