// latexEval.js — evaluador mínimo de LaTeX (solo para pruebas).
//
// Compila el LaTeX que verá el estudiante a una función numérica, para compararlo contra
// un cálculo independiente. Soporta: números, x, y, e, + - , \cdot, multiplicación implícita,
// ^ (con o sin llaves), paréntesis, |valor absoluto|, \frac{}{}, \sqrt{}, \pi, \omega (variable w),
// \sin, \cos, \tan, \sec, \csc, \cot, \ln y potencias de función como \sin^{2}(x).
// Falla con error ante cualquier símbolo que no reconozca (no ignora nada en silencio).

const FUNCS = {
  '\\sin': Math.sin,
  '\\cos': Math.cos,
  '\\tan': Math.tan,
  '\\sec': (x) => 1 / Math.cos(x),
  '\\csc': (x) => 1 / Math.sin(x),
  '\\cot': (x) => 1 / Math.tan(x),
  '\\ln': Math.log,
};

export function compileLatex(src) {
  const toks = src.match(/\\[a-zA-Z]+|\d+(?:\.\d+)?|[a-zA-Z]|[-+^(){}|]/g) ?? [];
  if (toks.join('') !== src.replace(/\s+/g, '')) {
    throw new Error(`LaTeX con símbolos no soportados: ${src}`);
  }
  let i = 0;
  const peek = () => toks[i];
  const eat = (t) => {
    if (toks[i] !== t) throw new Error(`Se esperaba "${t}" y llegó "${toks[i]}" en: ${src}`);
    i++;
  };
  const startsFactor = (t) =>
    t !== undefined && (/^\d/.test(t) || /^[a-zA-Z]$/.test(t) || t === '(' || t === '\\frac' || t === '\\sqrt' || t === '\\pi' || t === '\\omega' || Object.hasOwn(FUNCS, t));

  function expr() {
    let f = term();
    while (peek() === '+' || peek() === '-') {
      const op = toks[i++];
      const a = f;
      const g = term();
      f = op === '+' ? (env) => a(env) + g(env) : (env) => a(env) - g(env);
    }
    return f;
  }

  function term() {
    if (peek() === '-') {
      i++;
      const t = term();
      return (env) => -t(env);
    }
    let f = power();
    while (peek() === '\\cdot' || startsFactor(peek())) {
      if (peek() === '\\cdot') i++;
      const a = f;
      const g = power();
      f = (env) => a(env) * g(env);
    }
    return f;
  }

  function power() {
    const base = atom();
    if (peek() === '^') {
      i++;
      const ex = group();
      return (env) => Math.pow(base(env), ex(env));
    }
    return base;
  }

  function group() {
    if (peek() === '{') {
      i++;
      const f = expr();
      eat('}');
      return f;
    }
    return atom();
  }

  function atom() {
    const t = toks[i++];
    if (t === undefined) throw new Error(`Expresión incompleta: ${src}`);
    if (/^\d/.test(t)) {
      const v = parseFloat(t);
      return () => v;
    }
    if (t === 'e') return () => Math.E;
    if (/^[a-zA-Z]$/.test(t)) {
      return (env) => {
        if (!(t in env)) throw new Error(`Variable "${t}" no definida al evaluar: ${src}`);
        return env[t];
      };
    }
    if (t === '(') {
      const f = expr();
      eat(')');
      return f;
    }
    if (t === '\\pi') return () => Math.PI;
    if (t === '\\omega') {
      return (env) => {
        if (!('w' in env)) throw new Error(`Variable "w" (ω) no definida al evaluar: ${src}`);
        return env.w;
      };
    }
    if (t === '|') {
      const f = expr();
      eat('|');
      return (env) => Math.abs(f(env));
    }
    if (t === '\\sqrt') {
      eat('{');
      const f = expr();
      eat('}');
      return (env) => Math.sqrt(f(env));
    }
    if (t === '\\frac') {
      eat('{');
      const n = expr();
      eat('}');
      eat('{');
      const d = expr();
      eat('}');
      return (env) => n(env) / d(env);
    }
    if (Object.hasOwn(FUNCS, t)) {
      const fn = FUNCS[t];
      let ex = null;
      if (peek() === '^') {
        i++;
        ex = group();
      }
      const arg = peek() === '(' ? atom() : power();
      return ex ? (env) => Math.pow(fn(arg(env)), ex(env)) : (env) => fn(arg(env));
    }
    throw new Error(`Token no soportado "${t}" en: ${src}`);
  }

  const f = expr();
  if (i !== toks.length) throw new Error(`Sobraron símbolos sin interpretar ("${toks[i]}") en: ${src}`);
  return f;
}
