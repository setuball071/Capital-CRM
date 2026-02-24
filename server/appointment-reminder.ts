import { db } from "./storage";
import { sql } from "drizzle-orm";
import { createNotification } from "./notification-service";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const REMINDER_MINUTES_BEFORE = 15;

async function checkUpcomingAppointments() {
  try {
    const now = new Date();
    const reminderWindow = new Date(now.getTime() + REMINDER_MINUTES_BEFORE * 60 * 1000);

    const result = await db.execute(sql`
      SELECT a.*, u.name as user_name
      FROM appointments a
      JOIN users u ON u.id = a.user_id
      WHERE a.status = 'open'
        AND a.scheduled_for > ${now.toISOString()}
        AND a.scheduled_for <= ${reminderWindow.toISOString()}
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.user_id = a.user_id
            AND n.type = 'agendamento'
            AND n.action_url = '/vendas/agenda'
            AND n.title LIKE '%' || a.title || '%'
            AND n.created_at > ${new Date(now.getTime() - 60 * 60 * 1000).toISOString()}
        )
    `);

    for (const row of result.rows as any[]) {
      const scheduledDate = new Date(row.scheduled_for);
      const minutesUntil = Math.round((scheduledDate.getTime() - now.getTime()) / 60000);
      const timeStr = scheduledDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      try {
        await createNotification({
          userId: row.user_id,
          title: `Lembrete: ${row.title}`,
          message: `Compromisso em ${minutesUntil} min (${timeStr})${row.client_name ? ` - ${row.client_name}` : ""}`,
          type: "agendamento",
          actionUrl: "/vendas/agenda",
        });
      } catch (err) {
        console.error(`[AppointmentReminder] Failed to create notification for appointment ${row.id}:`, err);
      }
    }

    if (result.rows.length > 0) {
      console.log(`[AppointmentReminder] Sent ${result.rows.length} reminder(s)`);
    }
  } catch (error) {
    console.error("[AppointmentReminder] Error checking appointments:", error);
  }
}

export function startAppointmentReminder() {
  console.log(`[AppointmentReminder] Starting reminder checker (every ${CHECK_INTERVAL_MS / 60000} min, ${REMINDER_MINUTES_BEFORE} min before)`);
  setInterval(checkUpcomingAppointments, CHECK_INTERVAL_MS);
  setTimeout(checkUpcomingAppointments, 10000);
}
