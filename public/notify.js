/**
 * @file notify.js
 * @description Wrapper de la Notification API del navegador.
 * Siempre emite `moodtunes:notify` para que la UI muestre un toast de respaldo.
 *
 * @namespace MoodNotify
 */
(function (global) {
  "use strict";

  const MoodNotify = {
    /** @type {boolean} */
    supported: "Notification" in global,

    /**
     * Permiso actual: 'default' | 'granted' | 'denied'
     * @returns {string}
     */
    get permission() {
      return this.supported ? Notification.permission : "denied";
    },

    /**
     * Solicita permiso al usuario (solo si aún está en 'default').
     * @returns {Promise<string>}
     */
    async requestPermission() {
      if (!this.supported) return "denied";
      if (Notification.permission === "granted") return "granted";
      if (Notification.permission === "denied") return "denied";
      try {
        return await Notification.requestPermission();
      } catch {
        return "denied";
      }
    },

    /**
     * Muestra notificación nativa (si hay permiso) y dispara evento de toast.
     * @param {string} title
     * @param {string} [body]
     * @param {NotificationOptions & { duration?: number, onClick?: Function }} [options]
     */
    show(title, body, options) {
      const opts = {
        body: body || "",
        icon: options?.icon || "/favicon.ico",
        badge: options?.badge,
        tag: options?.tag || "moodtunes",
        silent: false,
        ...options,
      };

      if (this.supported && Notification.permission === "granted") {
        try {
          const n = new Notification(title, opts);
          n.onclick = () => {
            global.focus();
            n.close();
            if (options?.onClick) options.onClick();
          };
          setTimeout(() => n.close(), options?.duration || 6000);
        } catch (e) {
          console.warn("[MoodNotify]", e);
        }
      }

      global.dispatchEvent(
        new CustomEvent("moodtunes:notify", {
          detail: { title, body },
        })
      );
    },

    /**
     * Pide permiso si hace falta y luego muestra la notificación.
     * @param {string} title
     * @param {string} [body]
     * @param {Object} [options]
     */
    async showWithPermission(title, body, options) {
      if (this.permission !== "granted") {
        await this.requestPermission();
      }
      this.show(title, body, options);
    },
  };

  global.MoodNotify = MoodNotify;
})(window);
