// mail.js — envío de correo. Dos proveedores, sin SDK:
//   · Gmail por SMTP (GMAIL_USER + GMAIL_APP_PASSWORD): sirve sin dominio propio; tiene prioridad si está configurado.
//   · Resend por REST (RESEND_API_KEY + EMAIL_FROM): necesita un dominio verificado para escribir a cualquier correo.
// Si no hay credenciales devuelve null y la ruta responde "no configurado" en lugar de fingir que envió algo.

import { connect as tlsConnect } from 'node:tls';
import { randomBytes } from 'node:crypto';

const hideEmails = (s) => String(s).replace(/[\w.+-]+@[\w.-]+/g, '<correo>');

export function createMailer(config, fetchFn = (...a) => globalThis.fetch(...a), { connect = tlsConnect } = {}) {
  const { resendKey, from, gmailUser, gmailAppPassword } = config.email;
  if (gmailUser && gmailAppPassword) return gmailMailer({ user: gmailUser, pass: gmailAppPassword, name: config.email.fromName || 'ElaMath', connect });
  if (!resendKey || !from) return null;
  return {
    provider: 'resend',
    async send({ to, subject, text }) {
      let res;
      try {
        res = await fetchFn('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: [to], subject, text }),
        });
      } catch {
        throw new Error('email_failed');
      }
      if (!res.ok) {
        // Deja en los registros de Vercel el motivo que da Resend (sin la clave ni el destinatario).
        let detail = '';
        try {
          const j = await res.json();
          detail = hideEmails(`${j?.name ?? ''} ${j?.message ?? ''}`).slice(0, 300);
        } catch {
          /* sin cuerpo JSON */
        }
        console.error(`[mail] resend ${res.status} ${detail}`.trim());
        throw new Error('email_failed');
      }
    },
  };
}

// ───────────── Gmail (SMTP con TLS directo, puerto 465) ─────────────

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const encodeHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

/** Mensaje RFC 5322 en texto plano UTF-8 (cuerpo en base64: no hay que escapar puntos ni líneas largas). */
export function buildMessage({ fromName, fromAddr, to, subject, text, now = new Date() }) {
  const body = b64(text.replace(/\r?\n/g, '\r\n')).replace(/.{1,76}/g, '$&\r\n');
  return [
    `From: ${encodeHeader(fromName)} <${fromAddr}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${now.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${randomBytes(12).toString('hex')}@${fromAddr.split('@')[1]}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    body,
  ].join('\r\n');
}

/** Lee respuestas SMTP completas (una respuesta puede tener varias líneas "250-..." y termina en "250 ..."). */
function replyReader(sock) {
  let buf = '';
  let lines = [];
  let failure = null;
  const ready = [];
  const waiting = [];
  const deliver = (r) => (waiting.length ? waiting.shift().resolve(r) : ready.push(r));
  sock.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 2);
      lines.push(line);
      if (/^\d{3}(?!-)/.test(line)) {
        deliver({ code: Number(line.slice(0, 3)), text: lines.join(' | ') });
        lines = [];
      }
    }
  });
  const fail = (err) => {
    failure ??= err;
    while (waiting.length) waiting.shift().reject(failure);
  };
  sock.on('error', fail);
  sock.on('close', () => fail(new Error('conexión cerrada')));
  return () => (ready.length ? Promise.resolve(ready.shift()) : failure ? Promise.reject(failure) : new Promise((resolve, reject) => waiting.push({ resolve, reject })));
}

function gmailMailer({ user, pass, name, connect, host = 'smtp.gmail.com', port = 465, timeoutMs = 15_000 }) {
  return {
    provider: 'gmail',
    async send({ to, subject, text }) {
      const sock = connect({ host, port, servername: host });
      sock.setTimeout?.(timeoutMs, () => sock.destroy(new Error('tiempo agotado')));
      const read = replyReader(sock);
      const step = async (cmd, ok, label = cmd) => {
        if (cmd !== null) sock.write(`${cmd}\r\n`);
        const r = await read();
        if (!ok.includes(r.code)) throw Object.assign(new Error('smtp'), { smtp: `${label.split(' ')[0]} → ${r.code} ${r.text}` });
      };
      try {
        await step(null, [220], 'saludo');
        await step('EHLO elamath', [250]);
        await step(`AUTH PLAIN ${b64(`\0${user}\0${pass}`)}`, [235], 'AUTH');
        await step(`MAIL FROM:<${user}>`, [250]);
        await step(`RCPT TO:<${to}>`, [250, 251]);
        await step('DATA', [354]);
        await step(`${buildMessage({ fromName: name, fromAddr: user, to, subject, text })}\r\n.`, [250], 'mensaje');
        sock.write('QUIT\r\n');
      } catch (err) {
        console.error(`[mail] gmail ${hideEmails(err.smtp ?? err.message).slice(0, 300)}`);
        throw new Error('email_failed');
      } finally {
        sock.end?.();
      }
    },
  };
}
