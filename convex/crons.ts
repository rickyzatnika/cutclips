import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "requeue stuck processing jobs",
  { minutes: 5 },
  internal.processingJobs.requeueStuckJobs,
);

crons.interval(
  "cancel expired invoices",
  { hours: 1 },
  internal.payments.cancelExpiredInvoices,
);

export default crons;
