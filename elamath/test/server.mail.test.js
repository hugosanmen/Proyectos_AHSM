// Envío por Gmail (SMTP) con un servidor simulado: orden de comandos, autenticación y errores.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { loadConfig } from '../server/config.js';
import { buildMessage, createMailer } from '../server/mail.js';

/** Socket falso: responde a cada comando según `replies` (por prefijo del comando). */
function fakeSmtp(replies = {}) {
  const log = [];
  let opened;
  const connect = (opts) => {
    opened = opts;
    const s = new EventEmitter();
    const say = (txt) => setImmediate(() => s.emit('data', Buffer.from(txt)));
    s.setTimeout = () => {};
    s.end = () => {};
    s.destroy = (e) => s.emit('error', e);
    s.write = (chunk) => {
      log.push(chunk);
      const cmd = chunk.startsWith('From:') ? 'mensaje' : chunk.split(' ')[0].replace(/\r\n$/, '');
      if (cmd === 'QUIT') return;
      const def = { EHLO: '250-smtp.gmail.com\r\n250-AUTH PLAIN\r\n250 SMTPUTF8\r\n', AUTH: '235 2.7.0 Accepted\r\n', MAIL: '250 OK\r\n', RCPT: '250 OK\r\n', DATA: '354 Go ahead\r\n', mensaje: '250 2.0.0 OK queued\r\n' };
      say(replies[cmd] ?? def[cmd]);
    };
    say('220 smtp.gmail.com ESMTP\r\n');
    return s;
  };
  return { connect, log, opened: () => opened };
}
const cfg = (env) => loadConfig({ GMAIL_USER: 'elamath.app@gmail.com', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop', ...env });

describe('correo por Gmail', () => {
  it('con GMAIL_* configurado usa Gmail aunque también exista Resend', () => {
    const m = createMailer(cfg({ RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.mx' }), undefined, { connect: fakeSmtp().connect });
    assert.equal(m.provider, 'gmail');
    assert.equal(createMailer(loadConfig({ RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.mx' })).provider, 'resend');
  });

  it('dialoga SMTP en orden, autentica con la contraseña sin espacios y manda el mensaje', async () => {
    const smtp = fakeSmtp();
    await createMailer(cfg(), undefined, { connect: smtp.connect }).send({ to: 'ana@correo.com', subject: 'Tu enlace para entrar a ElaMath', text: 'Hola,\n\nEntra aquí: https://x/?login=abc\n\nÁnimo' });
    assert.deepEqual(smtp.opened(), { host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com' });
    const cmds = smtp.log.map((c) => (c.startsWith('From:') ? 'mensaje' : c.split(' ')[0].trim()));
    assert.deepEqual(cmds, ['EHLO', 'AUTH', 'MAIL', 'RCPT', 'DATA', 'mensaje', 'QUIT']);
    const auth = Buffer.from(smtp.log[1].split(' ')[2].trim(), 'base64').toString();
    assert.equal(auth, '\0elamath.app@gmail.com\0abcdefghijklmnop');
    assert.equal(smtp.log[2], 'MAIL FROM:<elamath.app@gmail.com>\r\n');
    assert.equal(smtp.log[3], 'RCPT TO:<ana@correo.com>\r\n');
    const msg = smtp.log[5];
    assert.ok(msg.endsWith('\r\n.\r\n'));
    assert.match(msg, /^From: ElaMath <elamath\.app@gmail\.com>\r\n/);
    const body = msg.split('\r\n\r\n')[1].replace(/\r\n\.\r\n$/, '').replace(/\r\n/g, '');
    assert.match(Buffer.from(body, 'base64').toString('utf8'), /Ánimo/);
  });

  it('contraseña incorrecta o destinatario rechazado → email_failed, sin filtrar la contraseña', async () => {
    const errs = [];
    const orig = console.error;
    console.error = (m) => errs.push(m);
    try {
      for (const replies of [{ AUTH: '535-5.7.8 Username and Password not accepted\r\n535 5.7.8 BadCredentials\r\n' }, { RCPT: '550 5.1.1 The email account that you tried to reach does not exist\r\n' }]) {
        await assert.rejects(createMailer(cfg(), undefined, { connect: fakeSmtp(replies).connect }).send({ to: 'x@y.mx', subject: 's', text: 't' }), /email_failed/);
      }
    } finally {
      console.error = orig;
    }
    assert.match(errs[0], /AUTH → 535/);
    assert.match(errs[1], /RCPT → 550/);
    assert.ok(!errs.join(' ').includes('abcdefghijklmnop'));
  });

  it('el asunto con acentos va codificado y el cuerpo en base64', () => {
    const m = buildMessage({ fromName: 'ElaMath', fromAddr: 'a@gmail.com', to: 'b@c.mx', subject: 'Código de acceso', text: 'x', now: new Date(0) });
    assert.match(m, /Subject: =\?UTF-8\?B\?/);
    assert.match(m, /Content-Transfer-Encoding: base64/);
  });
});
