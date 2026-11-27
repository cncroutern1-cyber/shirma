// Vercel serverless function: delivers website orders / contact messages.
// (File keeps its old name so the site's /api/telegram calls keep working.)
//
// EMAIL (recommended) — Vercel -> Settings -> Environment Variables:
//   RESEND_API_KEY  - API key from https://resend.com (sign up with the receiving e-mail address)
//   ORDER_EMAIL     - optional, where to send (default: cncroutern1@gmail.com)
//   MAIL_FROM       - optional, default "Revo sayt <onboarding@resend.dev>"
// TELEGRAM (optional, extra copy):
//   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (one id, or several separated by commas: "123,456,-100789")
// A message counts as delivered when at least one configured channel accepts it.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const mailKey = process.env.RESEND_API_KEY;
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChat = process.env.TELEGRAM_CHAT_ID;
  const useMail = !!mailKey;
  const useTg = !!(tgToken && tgChat);
  if (!useMail && !useTg) return res.status(503).json({ ok: false, error: "not-configured" });

  let b = req.body;
  if (typeof b === "string") {
    try {
      b = JSON.parse(b);
    } catch (e) {
      b = {};
    }
  }
  b = b || {};
  if (b.website) return res.status(200).json({ ok: true }); // honeypot: bots fill this field
  const clean = (v, n) => String(v || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);

  const name = clean(b.name, 80);
  const phone = clean(b.phone, 40);
  if (name.length < 2 || phone.replace(/\D/g, "").length < 9) return res.status(400).json({ ok: false, error: "invalid" });

  let subject, text, image = null;
  if (b.kind === "product") {
    const title = clean(b.title, 150);
    const price = clean(b.price, 60);
    const info = clean(b.info, 300);
    if (!title) return res.status(400).json({ ok: false, error: "invalid" });
    subject = `🛍 Buyurtma: ${title}`;
    text = `🛍 Mahsulotga qiziqish\n\n📦 ${title}\n💰 Narx: ${price || "—"} (namunaviy)\nℹ️ ${info || "—"}\n\n👤 ${name}\n📞 ${phone}\n\nMen shu mahsulotni sotib olmoqchiman.`;
    const mt = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ""));
    if (mt && mt[2].length < 3_000_000) image = { ext: mt[1] === "jpeg" ? "jpg" : mt[1], type: "image/" + mt[1], b64: mt[2] };
  } else {
    const topic = clean(b.topic, 80);
    const message = clean(b.message, 1500);
    if (message.length < 5) return res.status(400).json({ ok: false, error: "invalid" });
    subject = `📩 Saytdan xabar: ${topic || "savol"} — ${name}`;
    text = `📩 Saytdan yangi xabar\n\nMavzu: ${topic || "—"}\nIsm: ${name}\nTelefon: ${phone}\n\n${message}`;
  }

  const jobs = [];
  if (useMail) jobs.push(sendMail(mailKey, subject, text, image, phone));
  if (useTg) {
    // TELEGRAM_CHAT_ID may hold several ids separated by commas: every one receives the order.
    const chats = tgChat.split(/[,\s]+/).filter(Boolean);
    chats.forEach((c) => jobs.push(sendTelegram(tgToken, c, text.slice(0, 1000), image)));
  }
  const results = await Promise.all(jobs.map((p) => p.catch((e) => "network: " + (e && e.message))));
  if (results.some((x) => x === true)) {
    const bad = results.filter((x) => typeof x === "string");
    if (bad.length) console.error("partial delivery:", bad.join(" | "));
    return res.status(200).json({ ok: true });
  }
  const detail = results.filter((x) => typeof x === "string");
  console.error("delivery failed:", detail.join(" | "));
  return res.status(502).json({ ok: false, error: "delivery", detail });
}

async function sendMail(key, subject, text, image, phone) {
  const to = (process.env.ORDER_EMAIL || "cncroutern1@gmail.com").split(",").map((s) => s.trim()).filter(Boolean);
  const html =
    `<div style="font:15px/1.6 system-ui,sans-serif;color:#10201C;max-width:560px">` +
    `<div style="white-space:pre-wrap">${esc(text)}</div>` +
    `<p><a href="tel:${esc(phone.replace(/[^+\d]/g, ""))}" style="display:inline-block;background:#0E6B5A;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">📞 ${esc(phone)}</a></p>` +
    (image ? `<p style="color:#566660;font-size:13px">Mahsulot rasmi ilova qilingan.</p>` : "") +
    `</div>`;
  const body = {
    from: process.env.MAIL_FROM || "Revo sayt <onboarding@resend.dev>",
    to,
    subject,
    text,
    html,
  };
  if (image) body.attachments = [{ filename: "mahsulot." + image.ext, content: image.b64 }];
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.ok ? true : "email: " + r.status + " " + (await r.text()).slice(0, 200);
}

async function sendTelegram(token, chat, caption, image) {
  const api = (m) => `https://api.telegram.org/bot${token}/${m}`;
  let photoErr = "";
  if (image) {
    const fd = new FormData();
    fd.append("chat_id", chat);
    fd.append("caption", caption);
    fd.append("photo", new Blob([Buffer.from(image.b64, "base64")], { type: image.type }), "product." + image.ext);
    const r = await fetch(api("sendPhoto"), { method: "POST", body: fd });
    if (r.ok) return true;
    photoErr = "photo: " + r.status + " " + (await r.text()).slice(0, 200);
  }
  const r2 = await fetch(api("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: caption, disable_web_page_preview: true }),
  });
  if (r2.ok) return true;
  let who = "";
  try {
    const me = await (await fetch(api("getMe"))).json();
    who = me && me.result ? " [bot=@" + me.result.username + " chat=" + chat + "]" : "";
  } catch (e) {}
  return "telegram: " + r2.status + " " + (await r2.text()).slice(0, 200) + who + (photoErr ? " / " + photoErr : "");
}
