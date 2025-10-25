import { InferSelectModel } from "drizzle-orm";
import { courses_table } from "../db/schema";

export type Course = InferSelectModel<typeof courses_table>