import { users_table } from "../schema";
import { db } from "../db";
import { DbResult } from "../../types/results.types";
import { createPasswordHash, verifyPassword } from "../../util tools/auth.util";
import {
  SignupRequest,
  PublicUser,
  LoginRequest,
} from "../../types/auth.types";
import { eq } from "drizzle-orm";

// Helper: Check if email exists
const checkEmail = async function (email: string): Promise<DbResult<boolean>> {
  try {
    const user = await db.query.users_table.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });
    return { success: true, data: !!user }; // true if exists, false if not
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
};

// Signup: Create new user
export const createNewUser = async function (
  signupData: SignupRequest
): Promise<DbResult<PublicUser>> {
  const { full_name, email, password, role = "consumer" } = signupData;

  // Validate inputs
  if (!full_name || !email || !password) {
    return {
      success: false,
      error: "All fields are required: full_name, email, and password",
    };
  }

  // Validate role
  if (role !== "admin" && role !== "consumer") {
    return { success: false, error: "Invalid user role" };
  }

  try {
    // Check if email already exists
    const emailExists = await checkEmail(email);
    if (!emailExists.success) {
      return { success: false, error: emailExists.error };
    }
    if (emailExists.data) {
      return { success: false, error: "Email already registered" };
    }

    // Create hashed password
    const { hashedPassword, salt } = createPasswordHash(password);

    // Generate user ID (you can use uuid or nanoid)
    const userId = crypto.randomUUID();

    // Insert user into database
    const [newUser] = await db
      .insert(users_table)
      .values({
        id: userId,
        full_name,
        email,
        hashedPassword,
        saltPassword: salt,
        role,
        is_active: true,
      })
      .returning();

    // Return user without sensitive data
    const { hashedPassword: _, saltPassword: __, ...publicUser } = newUser;
    return { success: true, data: publicUser as PublicUser };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

// Login: Find user by email and verify password
export const loginUser = async function (
  loginData: LoginRequest
): Promise<DbResult<PublicUser>> {
  const { email, password } = loginData;

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  try {
    // Find user by email
    const user = await db.query.users_table.findFirst({
      where: eq(users_table.email, email),
    });

    if (!user) {
      return { success: false, error: "Invalid email or password" };
    }

    // Check if user is active
    if (!user.is_active) {
      return { success: false, error: "Account is deactivated" };
    }

    // Verify password
    const isValidPassword = verifyPassword(
      password,
      user.hashedPassword,
      user.saltPassword
    );

    if (!isValidPassword) {
      return { success: false, error: "Invalid email or password" };
    }

    // Return user without sensitive data
    const { hashedPassword, saltPassword, ...publicUser } = user;
    return { success: true, data: publicUser as PublicUser };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};

// Get user by ID (for auth middleware/session verification)
export const getUserById = async function (
  userId: string
): Promise<DbResult<PublicUser>> {
  try {
    const user = await db.query.users_table.findFirst({
      where: eq(users_table.id, userId),
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (!user.is_active) {
      return { success: false, error: "Account is deactivated" };
    }

    const { hashedPassword, saltPassword, ...publicUser } = user;
    return { success: true, data: publicUser as PublicUser };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
};
