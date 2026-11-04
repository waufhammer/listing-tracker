// Print one weekly email as JSON (test mode: To Will only, no CC).
//   npx tsx --env-file=.env.local scripts/print-weekly-email.ts <listing-id> <monday YYYY-MM-DD>
import { loadWeeklyEmail } from "../src/lib/weekly-email-data";
loadWeeklyEmail(process.argv[2], process.argv[3], { testMode: true }).then((r) => console.log(JSON.stringify(r)));
