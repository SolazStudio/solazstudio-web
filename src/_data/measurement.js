function cleanEnvironmentValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export default {
  enabled: process.env.MEASUREMENT_ENABLED === "true",
  gaMeasurementId: cleanEnvironmentValue(process.env.GA_MEASUREMENT_ID)
};
