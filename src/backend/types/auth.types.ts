import { InferSelectModel } from "drizzle-orm";
import { users_table } from "../db/schema";

// Full user from database (with all fields)
export type User = InferSelectModel<typeof users_table>;

// For API responses (exclude sensitive fields)
export type PublicUser = Omit<User, "hashedPassword" | "saltPassword">;

// For signup request body
export type SignupRequest = {
  full_name: string;
  email: string;
  password: string;
  role?: "admin" | "consumer";
};
// For login request body
export type LoginRequest = {
  email: string;
  password: string;
};

// For updating user profile
export type UpdateUserRequest = {
  full_name?: string;
  email?: string;
};
