/**
 * Notificaciones nativas del sistema (Notification API)
 */
(function (global) {
  "use strict";

  const MoodNotify = {
    supported: "Notification" in global,

    get permission() {
      return this.supported ? Notification.permission : "denied";
    },

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
          console.warn("Notification error:", e);
        }
      }

      global.dispatchEvent(
        new CustomEvent("moodtunes:notify", {
          detail: { title, body },
        })
      );
    },

    async showWithPermission(title, body, options) {
      if (this.permission !== "granted") {
        await this.requestPermission();
      }
      this.show(title, body, options);
    },
  };

  global.MoodNotify = MoodNotify;
})(window);
