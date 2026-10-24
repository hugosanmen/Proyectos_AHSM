// llm.js — adaptador de proveedores de IA (Groq hoy, Anthropic cuando quieras). El resto del servidor
// habla con `chat()` y no sabe qué proveedor hay detrás.
//
// Formato común:
//   system   : string | [{ type:'text', text, cache_control? }]
//   messages : [{ role:'user'|'assistant', content: string | [{ type:'text', text } | { type:'image', mediaType, data }] }]
// Todo fallo (red, estado ≠ 2xx, respuesta vacía) se convierte en UpstreamError sin filtrar detalles.

export class UpstreamError extends Error {}

const TIMEOUT_MS = 25_000;

const systemText = (system) => (typeof system === 'string' ? system : system.map((b) => b.text).join('\n\n'));

async function post(url, headers, body, fetchFn, timeoutMs = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetchFn(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
  } catch {
    throw new UpstreamError('network');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new UpstreamError(`status_${res.status}`);
  try {
    return await res.json();
  } catch {
    throw new UpstreamError('bad_json');
  }
}

// ── Anthropic ───────────────────────────────────────────────────
const anthropicContent = (c) =>
  typeof c === 'string' ? c : c.map((p) => (p.type === 'image' ? { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.data } } : { type: 'text', text: p.text }));

export async function callAnthropic({ apiKey, model, system, messages, maxTokens }, fetchFn = (...a) => globalThis.fetch(...a)) {
  const data = await post(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    { model, max_tokens: maxTokens, system: typeof system === 'string' ? system : system, messages: messages.map((m) => ({ role: m.role, content: anthropicContent(m.content) })) },
    fetchFn,
  );
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  if (!text) throw new UpstreamError('empty');
  return { text, usage: data.usage ?? null };
}

// ── Groq (API compatible con OpenAI) ────────────────────────────
const groqContent = (c) =>
  typeof c === 'string' ? c : c.map((p) => (p.type === 'image' ? { type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.data}` } } : { type: 'text', text: p.text }));

export async function callGroq({ apiKey, model, system, messages, maxTokens }, fetchFn = (...a) => globalThis.fetch(...a)) {
  const reasoning = /gpt-oss/.test(model); // modelos de razonamiento: gastan tokens "pensando"
  const body = {
    model,
    messages: [{ role: 'system', content: systemText(system) }, ...messages.map((m) => ({ role: m.role, content: groqContent(m.content) }))],
    max_completion_tokens: reasoning ? maxTokens * 3 : maxTokens,
    temperature: 0.3,
  };
  if (reasoning) Object.assign(body, { reasoning_effort: 'medium', include_reasoning: false });
  const data = await post('https://api.groq.com/openai/v1/chat/completions', { authorization: `Bearer ${apiKey}` }, body, fetchFn);
  const text = String(data.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new UpstreamError('empty');
  return { text, usage: data.usage ?? null };
}

/** Llama al proveedor configurado. `config` es el objeto de loadConfig. */
export async function chat({ config, model, system, messages, maxTokens }, fetchFn) {
  const { provider, key } = config.llm;
  const args = { apiKey: key, model, system, messages, maxTokens };
  if (provider === 'groq') return callGroq(args, fetchFn);
  if (provider === 'anthropic') return callAnthropic(args, fetchFn);
  throw new UpstreamError('no_provider');
}

export const llmConfigured = (config) => Boolean(config.llm?.provider && config.llm.key);
