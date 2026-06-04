/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as brandTemplates from "../brandTemplates.js";
import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as payments from "../payments.js";
import type * as processVideo from "../processVideo.js";
import type * as processingJobs from "../processingJobs.js";
import type * as projects from "../projects.js";
import type * as scriptGenerator from "../scriptGenerator.js";
import type * as users from "../users.js";
import type * as workerMutations from "../workerMutations.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  brandTemplates: typeof brandTemplates;
  credits: typeof credits;
  crons: typeof crons;
  payments: typeof payments;
  processVideo: typeof processVideo;
  processingJobs: typeof processingJobs;
  projects: typeof projects;
  scriptGenerator: typeof scriptGenerator;
  users: typeof users;
  workerMutations: typeof workerMutations;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
