window.WYNTR_STORE = (() => {
  const state = {
    sport: "nba",
    selectedGameId: null,
    filters: {
      team: "all",
      type: "all",
      range: 360
    },
    session: {
      status: "guest",
      user: null
    },
    subscription: {
      status: "not_configured",
      plan: null
    }
  };

  const listeners = new Set();

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  function emit() {
    const current = snapshot();
    listeners.forEach(listener => listener(current));
  }

  return {
    getState: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(path, value) {
      const parts = String(path).split(".");
      let target = state;
      parts.slice(0, -1).forEach(key => {
        if (!target[key] || typeof target[key] !== "object") target[key] = {};
        target = target[key];
      });
      target[parts.at(-1)] = value;
      emit();
    },
    reset() {
      state.selectedGameId = null;
      state.filters = { team: "all", type: "all", range: 360 };
      emit();
    }
  };
})();