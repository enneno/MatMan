// MatMan date-plan API: save plans and list them for the private admin page.
const ALLOWED_ORIGIN = "https://enneno.github.io";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (origin && origin !== ALLOWED_ORIGIN) {
      return json({ error: "Origin not allowed" }, 403, corsHeaders);
    }

    if (request.method === "GET") {
      const supplied = request.headers.get("Authorization") || "";
      if (!env.ADMIN_SECRET || supplied !== `Bearer ${env.ADMIN_SECRET}`) {
        return json({ error: "Unauthorized" }, 401, corsHeaders);
      }
      try {
        const result = await env.DB.prepare(
          "SELECT id, date, time, program, place, created_at FROM date_plans ORDER BY id DESC LIMIT 200"
        ).all();
        return json({ plans: result.results || [] }, 200, corsHeaders);
      } catch (error) {
        return json({ error: "Could not load plans" }, 500, corsHeaders);
      }
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    try {
      const body = await request.json();
      const date = String(body.date || "").trim();
      const time = String(body.time || "").trim();
      const program = String(body.program || "").trim();
      const place = String(body.place || "").trim().slice(0, 500);

      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date) ||
          !/^\\d{2}:\\d{2}$/.test(time) ||
          !program || program.length > 100) {
        return json({ error: "Invalid date plan" }, 400, corsHeaders);
      }

      await env.DB.prepare(
        "INSERT INTO date_plans (date, time, program, place) VALUES (?, ?, ?, ?)"
      ).bind(date, time, program, place).run();

      return json({ ok: true }, 201, corsHeaders);
    } catch (error) {
      return json({ error: "Could not save plan" }, 500, corsHeaders);
    }
  }
};

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}
