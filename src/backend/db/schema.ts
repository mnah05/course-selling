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
  /** Unique user identifier (typically from auth provider like Clerk/Auth0) */
  id: varchar("id").primaryKey(),

  /** User's full display name */
  full_name: text("full_name").notNull(),

  /** Unique email address for authentication and communication */
  email: varchar("email").unique().notNull(),

  /** Timestamp when the user account was created */
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

  /** User's role determining their permissions in the system */
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
  /** Unique course identifier */
  id: varchar("course_id").primaryKey(),

  /**
   * Admin who created this course
   * Set to null if admin is deleted (onDelete: "set null")
   */
  admin_id: varchar("admin_id").references(() => users_table.id, {
    onDelete: "set null",
  }),

  /** Display name of the course */
  course_name: varchar("course_name").notNull(),

  /**
   * Course price in USD
   * Supports up to 99,999,999.99 (10 digits total, 2 decimal places)
   */
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),

  /** Timestamp when the course was created */
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
  /** Unique content item identifier */
  id: varchar("content_id").primaryKey(),

  /**
   * Parent course reference
   * Content is automatically deleted when course is deleted (onDelete: "cascade")
   */
  course_id: varchar("course_id").references(() => courses_table.id, {
    onDelete: "cascade",
  }),

  /** Display title of the content item (e.g., "Introduction to React") */
  title: varchar("title", { length: 255 }).notNull(),

  /** Optional detailed description or transcript of the content */
  description: text("description"),

  /**
   * Type of content stored
   * Expected values: 'video', 'image', 'pdf'
   * Consider using an enum if types are fixed
   */
  content_type: varchar("content_type").notNull(),

  /**
   * URL to the content file in external storage (e.g., S3, Cloudflare R2)
   * Example: https://cdn.example.com/videos/intro-to-react.mp4
   * NOTE: Do NOT store actual file data in the database
   */
  content_url: text("content_url").notNull(),

  /**
   * Display order of content within the course
   * Lower numbers appear first. Allows manual ordering by admin
   */
  order: integer("order"),

  /** Timestamp when the content was created */
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
  /** Unique purchase transaction identifier */
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

  /** Timestamp when the purchase was initiated */
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

  /**
   * Amount paid for the course in USD
   * Should match course price at time of purchase
   * Supports up to 99,999,999.99
   */
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
  /** Unique enrollment record identifier */
  id: varchar("enrollment_id").primaryKey(),

  /**
   * User enrolled in the course
   * Enrollment deleted when user is deleted (onDelete: "cascade")
   */
  user_id: varchar("user_id")
    .references(() => users_table.id, {
      onDelete: "cascade",
    })
    .notNull(),

  /**
   * Course the user is enrolled in
   * Enrollment deleted when course is deleted (onDelete: "cascade")
   */
  course_id: varchar("course_id")
    .references(() => courses_table.id, {
      onDelete: "cascade",
    })
    .notNull(),

  /** Timestamp when user was granted access to the course */
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
