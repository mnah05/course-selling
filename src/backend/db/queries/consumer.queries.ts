import {
  courses_table,
  course_enrollments_table,
  course_content_table,
} from "../schema";
import { db } from "../db";
import { DbResult } from "../../types/results.types";
import { Course } from "../../types/course.types";
import { eq, and } from "drizzle-orm";

//list all active courses
export const activeCourse = async function (): Promise<DbResult<Course[]>> {
  try {
    const courses = await db
      .select()
      .from(courses_table)
      .where(eq(courses_table.is_deleted, false));

    return { success: true, data: courses };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

//get single course details
export const detailCourse = async function (
  id: string
): Promise<DbResult<Course>> {
  if (!id) {
    return { success: false, error: "ID is needed!" };
  }
  try {
    const course = await db
      .select()
      .from(courses_table)
      .where(eq(courses_table.id, id))
      .then((result) => result[0]);
    return { success: true, data: course };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

//Check if user is enrolled in course
export const isUserEnrolled = async function (
  userId: string,
  courseId: string
): Promise<DbResult<boolean>> {
  if (!userId || !courseId) {
    return { success: false, error: "User ID and Course ID are required!" };
  }
  try {
    const enrollment = await db
      .select()
      .from(course_enrollments_table)
      .where(
        and(
          eq(course_enrollments_table.course_id, courseId),
          eq(course_enrollments_table.user_id, userId)
        )
      )
      .then((result) => result.length > 0);

    return { success: true, data: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};

//get course content if only it has access to it
export const getCourseContent = async function (
  userId: string,
  courseId: string
): Promise<DbResult<unknown>> {
  if (!userId || !courseId) {
    return { success: false, error: "User ID and Course ID are required!" };
  }

  try {
    // Check if the user is enrolled in the course
    const isEnrolled = await isUserEnrolled(userId, courseId);
    if (!isEnrolled.success || !isEnrolled.data) {
      return {
        success: false,
        error: "Access denied. User is not enrolled in the course.",
      };
    }

    // Fetch course content
    const courseContent = await db
      .select()
      .from(course_content_table)
      .where(eq(course_content_table.course_id, courseId))
      .then((result) => result);

    if (!courseContent) {
      return { success: false, error: "Course content not found." };
    }

    return { success: true, data: courseContent };
  } catch (error) {
    return { success: false, error: String(error) };
  }
};
