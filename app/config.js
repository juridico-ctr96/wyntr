window.WYNTR_CONFIG = Object.freeze({
  appName: "PRIME SCORE",
  version: "0.3.1",
  sport: "nba",
  api: {
    games: "/api/balldontlie",
    odds: "/api/odds",
    injuries: "/api/injuries",
    news: "/api/nba-news",
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