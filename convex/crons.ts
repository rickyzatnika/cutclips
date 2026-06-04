import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "reset monthly credits",
  { hours: 1 },
  internal.credits.resetAllMonthlyCredits,
);

crons.interval(
  "requeue stuck processing jobs",
  { minutes: 5 },
  internal.processingJobs.requeueStuckJobs,
);

export default crons;
