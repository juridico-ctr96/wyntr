window.WYNTR_API = (() => {
  async function request(url, options = {}) {
    const timeout = options.timeout ?? 15000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal,
        headers: {
          Accept: "application/json",
          ...(options.headers || {})
        }
      });

      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch {}

      if (!response.ok) {
        const error = new Error(
          body?.error || body?.message || `HTTP ${response.status}`
        );
        error.status = response.status;
        error.details = body;
        throw error;
      }

      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  return Object.freeze({
    request,
    health: () => request(window.WYNTR_CONFIG.api.health),
    games: query => request(
      `${window.WYNTR_CONFIG.api.games}${query ? `?${query}` : ""}`
    ),
    odds: query => request(
      `${window.WYNTR_CONFIG.api.odds}${query ? `?${query}` : ""}`
    ),
    injuries: query => request(
      `${window.WYNTR_CONFIG.api.injuries}${query ? `?${query}` : ""}`
    ),
    officialSchedule: () => request(
      window.WYNTR_CONFIG.api.officialSchedule
    )
  });
})();