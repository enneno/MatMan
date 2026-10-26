const TYPES = new Set([
  "Kávézás", "Reggeli vagy brunch", "Ebéd", "Vacsora", "Mozi",
  "Séta a szabadban", "Piknik", "Múzeum vagy kiállítás",
  "Játékterem vagy bowling", "Meglepetésrandi"
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
function clean(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}
function formatDate(value) {
  const parts = value.split("-");
  return parts.length === 3 ? parts[2] + ". " + parts[1] + ". " + parts[0] + "." : value;
}
function buildMessage(row, data) {
  const where = data.place ? " Helyszín: " + data.place + "." : "";
  const note = data.note ? " Extra kívánság: " + data.note + "." : "";
  return "Szia " + row.sender_name + "! 💗\n\n" +
    "Örömmel elfogadom a randimeghívást! Legyen " +
    formatDate(data.date) + " " + data.time + ", és csináljuk ezt: " +
    data.dateType.toLowerCase() + "." + where + note +
    "\n\nMár várom! 😊\n— " + row.recipient_name;
}
async function sendEmail(env, to, subject, body) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !validEmail(to)) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "authorization": "Bearer " + env.RESEND_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [to],
        subject,
        text: body
      })
    });
    return response.ok;
  } catch (_) {
    return false;
  }
}
function getDb(env) {
  if (!env.DB) throw new Error("A Cloudflare D1 adatbázis DB kötése nincs beállítva.");
  return env.DB;
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const id = clean(url.searchParams.get("id"), 80);
    if (!/^[a-f0-9-]{36}$/i.test(id)) return json({ error: "Érvénytelen meghívólink." }, 400);
    try {
      const db = getDb(env);
      const row = await db.prepare(
        "SELECT id, sender_name, recipient_name, status FROM invites WHERE id = ?"
      ).bind(id).first();
      if (!row) return json({ error: "Ez a meghívó nem található, vagy a link hibás." }, 404);
      return json({
        id: row.id,
        senderName: row.sender_name,
        recipientName: row.recipient_name,
        status: row.status
      });
    } catch (error) {
      return json({ error: error.message || "Az adatbázis jelenleg nem érhető el." }, 503);
    }
  }

  if (request.method !== "POST") {
    return json({ error: "Ez a művelet nem támogatott." }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ error: "A kérés adatai nem olvashatók." }, 400);
  }

  try {
    const db = getDb(env);
    if (body.action === "create") {
      const senderName = clean(body.senderName, 60);
      const recipientName = clean(body.recipientName, 60);
      const senderEmail = clean(body.senderEmail, 254).toLowerCase();
      if (!senderName || !recipientName || !validEmail(senderEmail)) {
        return json({ error: "Add meg a nevedet, a címzett nevét és egy érvényes e-mail-címet." }, 400);
      }
      const id = crypto.randomUUID();
      await db.prepare(
        "INSERT INTO invites (id, sender_name, recipient_name, sender_email, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)"
      ).bind(id, senderName, recipientName, senderEmail, new Date().toISOString()).run();
      const shareUrl = new URL(request.url);
      shareUrl.pathname = "/";
      shareUrl.search = "";
      shareUrl.searchParams.set("invite", id);
      shareUrl.hash = "";
      return json({ ok: true, id, url: shareUrl.toString() }, 201);
    }

    if (body.action === "respond") {
      const id = clean(body.id, 80);
      const date = clean(body.date, 10);
      const time = clean(body.time, 5);
      const dateType = clean(body.dateType, 80);
      const place = clean(body.place, 140);
      const note = clean(body.note, 500);
      const respondentEmail = clean(body.respondentEmail, 254).toLowerCase();
      if (!/^[a-f0-9-]{36}$/i.test(id)) return json({ error: "Érvénytelen meghívólink." }, 400);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !TYPES.has(dateType)) {
        return json({ error: "Ellenőrizd a dátumot, időpontot és a randi típusát." }, 400);
      }
      if (respondentEmail && !validEmail(respondentEmail)) return json({ error: "A megadott e-mail-cím nem érvényes." }, 400);

      const row = await db.prepare(
        "SELECT id, sender_name, recipient_name, sender_email, status FROM invites WHERE id = ?"
      ).bind(id).first();
      if (!row) return json({ error: "Ez a meghívó nem található." }, 404);
      if (row.status !== "pending") return json({ error: "Erre a meghívóra már érkezett válasz." }, 409);

      const data = { date, time, dateType, place, note };
      const responseText = buildMessage(row, data);
      const result = await db.prepare(
        "UPDATE invites SET status = 'accepted', selected_date = ?, selected_time = ?, date_type = ?, place = ?, note = ?, respondent_email = ?, response_text = ?, responded_at = ? WHERE id = ? AND status = 'pending'"
      ).bind(date, time, dateType, place, note, respondentEmail, responseText, new Date().toISOString(), id).run();
      if (!result.meta || result.meta.changes !== 1) {
        return json({ error: "Erre a meghívóra már érkezett válasz." }, 409);
      }

      const summary = "Randi-visszaigazolás 💌\n\n" +
        "Elfogadták a meghívásodat!\n\n" + responseText +
        "\n\nKiválasztott program: " + dateType +
        "\nDátum: " + formatDate(date) + "\nIdőpont: " + time +
        (place ? "\nHelyszín: " + place : "") +
        (note ? "\nExtra kívánság: " + note : "");
      const senderEmailSent = await sendEmail(
        env, row.sender_email, "💌 Elfogadták a randimeghívásodat!", summary
      );
      const respondentEmailSent = respondentEmail
        ? await sendEmail(
            env, respondentEmail, "Randi-visszaigazolás 💗",
            "Sikeresen rögzítettük a válaszodat.\n\n" + responseText +
            "\n\nA választott időpont: " + formatDate(date) + " " + time +
            "\nProgram: " + dateType +
            (place ? "\nHelyszín: " + place : "") +
            "\n\nSzép randit! 💗"
          )
        : false;

      return json({
        ok: true,
        saved: true,
        responseText,
        senderEmailSent,
        respondentEmailSent
      });
    }

    return json({ error: "Ismeretlen művelet." }, 400);
  } catch (error) {
    return json({ error: error.message || "A művelet nem sikerült." }, 503);
  }
}