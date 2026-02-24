import { db } from "./storage";
import { sql } from "drizzle-orm";

export async function createNotification({
  userId,
  title,
  message,
  type,
  actionUrl,
}: {
  userId: number;
  title: string;
  message: string;
  type: string;
  actionUrl?: string;
}) {
  await db.execute(sql`
    INSERT INTO notifications (user_id, title, message, type, action_url, is_read, created_at)
    VALUES (${userId}, ${title}, ${message}, ${type}, ${actionUrl || null}, false, NOW())
  `);
}
