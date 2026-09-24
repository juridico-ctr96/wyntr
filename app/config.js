window.WYNTR_CONFIG = Object.freeze({
  appName: "WYNTR",
  version: "0.2.0",
  sport: "nba",
  api: {
    games: "/api/balldontlie",
    odds: "/api/odds",
    injuries: "/api/injuries",
    officialSchedule: "/api/nba-schedule",
    health: "/api/health"
  },
  features: {
    live: true,
    analysis: true,
    odds: true,
    injuries: true,
    scheduleVerification: true,
    accounts: false,
    subscriptions: false
  }
});