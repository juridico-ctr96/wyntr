window.WYNTR_ENTITLEMENTS = (() => {
  const plans = Object.freeze({
    free: {
      key: "free",
      name: "WYNTR Free",
      active: true
    },
    pro: {
      key: "pro",
      name: "WYNTR PRO",
      active: false
    }
  });

  function currentPlan() {
    return plans.free;
  }

  function can(feature) {
    // Until accounts/subscriptions are implemented, the app remains fully
    // functional without artificial paywalls.
    return feature === "core" || feature === "analysis" ||
      feature === "market" || feature === "data";
  }

  return Object.freeze({ plans, currentPlan, can });
})();