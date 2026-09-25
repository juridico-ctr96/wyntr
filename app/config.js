window.WYNTR_CONFIG = Object.freeze({
  appName: "PRIME SCORE",
  version: "0.4.2",
  sport: "nba",
  api: {
    games: "/api/balldontlie",
    odds: "/api/odds",
    injuries: "/api/injuries",
    news: "/api/nba-news",
    tennis: "/api/live-tennis",
    officialSchedule: "/api/nba-schedule",
    health: "/api/health"
  },
  features: {
    live: true,
    analysis: true,
    odds: true,
    injuries: true,
    scheduleVerification: true,
    tennis: true,
    accounts: false,
    subscriptions: false
  }
});