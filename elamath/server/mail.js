// mail.js — envío de correo con Resend por REST (sin SDK). Si no hay credenciales devuelve null
// y la ruta responde "no configurado" en lugar de fingir que envió algo.

export function createMailer(config, fetchFn = (...a) => globalThis.fetch(...a)) {
  const { resendKey, from } = config.email;
  if (!resendKey || !from) return null;
  return {
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
      if (!res.ok) throw new Error('email_failed');
    },
  };
}
