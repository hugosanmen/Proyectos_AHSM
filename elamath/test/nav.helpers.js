// nav.helpers.js — búsqueda de controles para las pruebas de interfaz.
// La app tiene cuatro secciones (Inicio, Materias, Exámenes, Cuenta). Si un control no está en la pantalla
// actual, `seek` recorre las secciones como lo haría el alumno con la barra inferior y se queda donde lo encuentra.
// Desde práctica o examen (donde la barra está oculta) regresa a esa pantalla y devuelve el control ya localizado.

const SECTIONS = ['subjects', 'exams', 'account', 'home'];

export function makeSeek(doc, go) {
  return function seek(sel) {
    let el = doc.querySelector(sel);
    if (el) return el;
    const from = doc.body.dataset.view ?? 'home';
    const focused = from === 'practice' || from === 'exam';
    for (const view of SECTIONS) {
      if (view === from) continue;
      go(view);
      el = doc.querySelector(sel);
      if (el) break;
    }
    if (!el || focused) go(from);
    return el;
  };
}

/** Abre la pantalla de una materia desde la lista de Materias. */
export function openSubject(doc, go, name) {
  go('subjects');
  const card = [...doc.querySelectorAll('article.subject')].find((a) => a.querySelector('h3')?.textContent === name);
  card?.querySelector('.subject-open')?.click();
  return doc.body.dataset.view === 'subject';
}
