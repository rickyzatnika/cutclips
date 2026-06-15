import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "send pending notifications",
  { seconds: 5 },
  internal.telegramBot.sendPendingNotifications,
);

export default crons;
