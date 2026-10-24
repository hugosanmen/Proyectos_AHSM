// richtext.js — convierte la respuesta del tutor (texto con $...$, $$...$$, **negritas**, listas)
// en nodos del DOM. NUNCA usa innerHTML: lo que escriba el modelo (o un atacante vía inyección de
// instrucciones) siempre es texto, jamás HTML ni scripts.

const INLINE = /\$\$([^$]+?)\$\$|\$(?=\S)([^$\n]*?\S)\$(?!\d)|\*\*([^*\n]+?)\*\*/g;

/**
 * @param {HTMLElement} container  elemento donde se escribe (se vacía antes)
 * @param {string} text            texto del tutor
 * @param {(latex: string, display: boolean) => Node} mathNode  crea el nodo de una fórmula
 */
export function renderRichText(container, text, mathNode) {
  const doc = container.ownerDocument;
  container.replaceChildren();

  const el = (tag, ...kids) => {
    const e = doc.createElement(tag);
    e.append(...kids);
    return e;
  };

  const inline = (src) => {
    const nodes = [];
    let last = 0;
    for (const m of src.matchAll(INLINE)) {
      if (m.index > last) nodes.push(doc.createTextNode(src.slice(last, m.index)));
      if (m[1] !== undefined) nodes.push(mathNode(m[1].trim(), true));
      else if (m[2] !== undefined) nodes.push(mathNode(m[2], false));
      else nodes.push(el('strong', doc.createTextNode(m[3])));
      last = m.index + m[0].length;
    }
    if (last < src.length) nodes.push(doc.createTextNode(src.slice(last)));
    return nodes;
  };

  // Las fórmulas en bloque ($$ ... $$) pueden ocupar varias líneas: se aplanan para no partirlas.
  const flat = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\$\$([\s\S]+?)\$\$/g, (m) => m.replace(/\s*\n\s*/g, ' '));

  for (const block of flat.split(/\n{2,}/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) continue;

    const display = /^\s*\$\$([\s\S]+)\$\$\s*$/.exec(block);
    if (display) {
      const d = el('div', mathNode(display[1].trim(), true));
      d.className = 'chat-display';
      container.append(d);
    } else if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
      container.append(el('ul', ...lines.map((l) => el('li', ...inline(l.replace(/^\s*[-*•]\s+/, ''))))));
    } else if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      container.append(el('ol', ...lines.map((l) => el('li', ...inline(l.replace(/^\s*\d+[.)]\s+/, ''))))));
    } else {
      const p = el('p');
      lines.forEach((l, i) => {
        if (i) p.append(doc.createElement('br'));
        p.append(...inline(l));
      });
      container.append(p);
    }
  }
  return container;
}
