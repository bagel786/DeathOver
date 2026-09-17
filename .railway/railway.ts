import { defineRailway, image, preserve, project, service } from "railway/iac";

// Partial: this file owns only the cron service. DeathOver is managed by its
// legacy railway.json and must not be touched by this file.
export const partial = "daily-challenge-cron";

export default defineRailway(() => {
  const cron = service("daily-challenge-cron", {
    source: image("curlimages/curl:8.10.1"),
    deploy: {
      // /bin/sh -c wrapper so ${CRON_SECRET} expands at runtime (image ENTRYPOINT overrides don't expand vars)
      startCommand: '/bin/sh -c "curl -fsS -X POST https://www.deathover.xyz/api/cron/generate -H \\"Authorization: Bearer ${CRON_SECRET}\\" -m 180"',
      cronSchedule: "5 0 * * *",
      restartPolicyType: "NEVER",
    },
    // CRON_SECRET is set out-of-band via `railway variable set` (kept out of source)
    env: { CRON_SECRET: preserve() },
  });

  return project("DeathOver", {
    resources: [cron],
  });
});
