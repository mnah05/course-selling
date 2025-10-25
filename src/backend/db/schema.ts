import {
  pgTable,
  varchar,
  text,
  timestamp,
  pgEnum,
  boolean,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * User role enumeration
 * - admin: Can create, edit, and delete courses and content
 * - consumer: Can browse, purchase, and access courses
 */
export const user_role_enum = pgEnum("user_role", ["admin", "consumer"]);

/**
 * Purchase transaction status
 * - pending: Payment initiated but not yet confirmed
 * - completed: Payment successful, user should be granted access
 * - refunded: Payment reversed, user access should be revoked
 */
export const purchase_status_enum = pgEnum("purchase_status", [
  "pending",
  "completed",
  "refunded",
]);

/**
 * Users table - stores all system users (admins and consumers)
 * Admins create and manage courses, consumers purchase and view them
 */
export const users_table = pgTable("users", {
  id: varchar("id").primaryKey(),
  full_name: text("full_name").notNull(),
  email: varchar("email").unique().notNull(),
  hashedPassword: varchar("password").notNull(),
  saltPassword: varchar("salt").notNull(),
  created_at: timestamp("created_at")
    .default(sql`NOW()`)
    .notNull(),

  /**
   * Timestamp of last modification
   * NOTE: Must be updated manually in application code on every update
   */
  updated_at: timestamp("updated_at")
    .default(sql`NOW()`)
    .notNull(),

  role: user_role_enum("role").notNull().default("consumer"),

  /**
   * Soft delete flag - false indicates account is disabled/deactivated
   * Inactive users cannot log in or perform actions
   */
  is_active: boolean("is_active").notNull().default(true),
});

/**
 * Courses table - stores course information created by admins
 * Each course has content items and can be purchased by consumers
 */
export const courses_table = pgTable("courses", {
  id: varchar("course_id").primaryKey(),

  /**
   * Admin who created this course
   * Set to null if admin is deleted (onDelete: "set null")
   */
  admin_id: varchar("admin_id").references(() => users_table.id, {
    onDelete: "set null",
  }),

  course_name: varchar("course_name").notNull(),

  price: numeric("price", { precision: 10, scale: 2 }).notNull(),

  created_at: timestamp("created_at")
    .default(sql`NOW()`)
    .notNull(),

  /**
   * Timestamp of last modification
   * NOTE: Must be updated manually in application code on every update
   */
  updated_at: timestamp("updated_at")
    .default(sql`NOW()`)
    .notNull(),

  /**
   * Soft delete flag - true means course is deleted and should not be visible
   * Use soft delete to preserve purchase history and enrollment data
   */
  is_deleted: boolean("is_deleted").notNull().default(false),
});

/**
 * Course content table - stores individual content items within courses
 * Content can be videos, images, or PDFs stored in external storage (S3, R2, etc.)
 * Content is deleted when parent course is deleted (onDelete: "cascade")
 */
export const course_content_table = pgTable("course_content", {
  id: varchar("content_id").primaryKey(),

  /**
   * Parent course reference
   * Content is automatically deleted when course is deleted (onDelete: "cascade")
   */
  course_id: varchar("course_id").references(() => courses_table.id, {
    onDelete: "cascade",
  }),

  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  content_type: varchar("content_type").notNull(),
  content_url: text("content_url").notNull(),

  order: integer("order"),

  created_at: timestamp("created_at")
    .default(sql`NOW()`)
    .notNull(),

  /**
   * Timestamp of last modification
   * NOTE: Must be updated manually in application code on every update
   */
  updated_at: timestamp("updated_at")
    .default(sql`NOW()`)
    .notNull(),

  /**
   * Soft delete flag - true means content is removed from course
   * Preserves historical data while hiding from users
   */
  is_deleted: boolean("is_deleted").notNull().default(false),
});

/**
 * Purchase history table - records all course purchase transactions
 * Maintains financial records and purchase audit trail
 *
 * WORKFLOW:
 * 1. User initiates purchase -> insert with status='pending'
 * 2. Payment confirmed -> update status='completed', create enrollment
 * 3. Refund processed -> update status='refunded', revoke enrollment access
 */
export const purchase_history_table = pgTable("purchase_history", {
  id: varchar("purchase_id").primaryKey(),

  /**
   * User who made the purchase
   * Cannot delete users with purchase history (onDelete: "restrict")
   */
  user_id: varchar("user_id").references(() => users_table.id, {
    onDelete: "restrict",
  }),

  /**
   * Course that was purchased
   * Cannot delete courses with purchase history (onDelete: "restrict")
   */
  course_id: varchar("course_id").references(() => courses_table.id, {
    onDelete: "restrict",
  }),

  purchase_date: timestamp("purchase_date")
    .default(sql`NOW()`)
    .notNull(),

  /**
   * Timestamp of last status change
   * NOTE: Must be updated manually when status changes
   */
  updated_at: timestamp("updated_at")
    .default(sql`NOW()`)
    .notNull(),

  /** Current status of the purchase transaction */
  status: purchase_status_enum("status").notNull().default("pending"),

  /**
   * Payment method used (e.g., 'stripe', 'paypal', 'credit_card')
   * Consider using an enum for fixed payment methods
   */
  payment_method: varchar("payment_method").notNull(),

  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
});

/**
 * Course enrollments table - tracks user access to courses
 * Separate from purchase_history to handle access management independently
 *
 * USAGE:
 * - Created automatically when purchase status becomes 'completed'
 * - has_access can be toggled for refunds or manual access grants
 * - Query this table to verify if user can view course content
 */
export const course_enrollments_table = pgTable("course_enrollments", {
  id: varchar("enrollment_id").primaryKey(), // for future use like tracking stats,grades or assignment

  user_id: varchar("user_id")
    .references(() => users_table.id, {
      onDelete: "cascade",
    })
    .notNull(),

  course_id: varchar("course_id")
    .references(() => courses_table.id, {
      onDelete: "cascade",
    })
    .notNull(),

  enrolled_at: timestamp("enrolled_at")
    .default(sql`NOW()`)
    .notNull(),

  /**
   * Whether user currently has access to view course content
   * Set to false for refunds or access revocation
   * Check this flag before allowing content access
   */
  has_access: boolean("has_access").notNull().default(true),
});
