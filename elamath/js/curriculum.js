// curriculum.js — estructura curricular como DATOS. Cada materia lista los `topics` (nombres EXACTOS del campo
// `topic` de las plantillas del motor). Una materia sin `available: true` aparece como «Próximamente».
// Las materias con `mixed: true` (Preparación, Retos) reutilizan temas de otras materias;
// `minDifficulty` limita el sorteo a ejercicios de esa dificultad o más.
// `final` describe un simulacro tipo examen final: bloques con temas, puntos y número de reactivos,
// con la misma mezcla y peso de temas que los finales reales de la materia.

export const CURRICULUM = [
  {
    level: 1,
    name: 'Ingreso y Ciencias Básicas',
    semesters: '1.º a 2.º semestre',
    subjects: [
      { id: 'algebra', name: 'Álgebra', available: true, topics: ['Trigonometría', 'Números reales', 'Complejos en forma polar', 'Polinomios', 'Ecuaciones y sistemas', 'Matrices', 'Exponentes y logaritmos', 'Binomio de Newton'],
        final: {
          minutes: 60,
          blocks: [
            { name: 'Trigonometría', topics: ['Trigonometría'], points: 15, count: 2 },
            { name: 'Números reales', topics: ['Números reales'], points: 15, count: 2 },
            { name: 'Números complejos', topics: ['Complejos en forma polar'], points: 20, count: 2 },
            { name: 'Polinomios', topics: ['Polinomios'], points: 15, count: 2 },
            { name: 'Sistemas de ecuaciones', topics: ['Ecuaciones y sistemas'], points: 15, count: 2 },
            { name: 'Matrices', topics: ['Matrices'], points: 20, count: 2 },
          ],
        },
      },
      { id: 'geometria-analitica', name: 'Geometría Analítica', available: true, topics: ['Rectas y distancias', 'Cónicas'] },
      { id: 'calculo-diferencial', name: 'Cálculo Diferencial', available: true, topics: ['Límites', 'Derivadas', 'Aplicaciones de la derivada'] },
      { id: 'calculo-integral', name: 'Cálculo Integral', available: true, topics: ['Integral indefinida', 'Métodos de integración', 'Integral definida', 'Aplicaciones de la integral', 'Sucesiones y series'],
        final: {
          minutes: 60,
          blocks: [
            { name: 'Métodos de integración', topics: ['Métodos de integración', 'Integral indefinida'], points: 30, count: 3 },
            { name: 'Integral definida e impropia', topics: ['Integral definida'], points: 20, count: 2 },
            { name: 'Aplicaciones de la integral', topics: ['Aplicaciones de la integral'], points: 25, count: 3 },
            { name: 'Sucesiones y series', topics: ['Sucesiones y series'], points: 25, count: 2 },
          ],
        },
      },
    ],
  },
  {
    level: 2,
    name: 'Intermedio',
    semesters: '3.º a 4.º semestre',
    subjects: [
      { id: 'calculo-vectorial', name: 'Cálculo Vectorial', available: true, topics: ['Vectores', 'Funciones de varias variables', 'Integrales múltiples', 'Campos vectoriales'] },
      { id: 'algebra-lineal', name: 'Álgebra Lineal', available: true, topics: ['Matrices', 'Valores propios'] },
      { id: 'ecuaciones-diferenciales', name: 'Ecuaciones Diferenciales', available: true, topics: ['EDO de primer orden', 'EDO de segundo orden'] },
    ],
  },
  {
    level: 3,
    name: 'Avanzado',
    semesters: '5.º a 6.º semestre',
    subjects: [
      { id: 'metodos-numericos', name: 'Métodos Numéricos', available: true, topics: ['Raíces de ecuaciones', 'Integración y EDO numéricas'] },
      { id: 'probabilidad-estadistica', name: 'Probabilidad y Estadística', available: true, topics: ['Combinatoria y probabilidad', 'Estadística descriptiva', 'Distribuciones'] },
      { id: 'variable-compleja', name: 'Funciones de Variable Compleja', available: true, topics: ['Números complejos', 'Funciones analíticas', 'Integración compleja', 'Mapeos'] },
    ],
  },
  {
    level: 4,
    name: 'Especializado',
    semesters: '7.º a 8.º semestre',
    subjects: [
      { id: 'matematicas-avanzadas', name: 'Matemáticas Avanzadas para Ingeniería', available: true, topics: ['Transformada de Laplace', 'Series', 'Series de Fourier', 'Transformada de Fourier'],
        final: {
          minutes: 60,
          blocks: [
            { name: 'Funciones analíticas y mapeos', topics: ['Funciones analíticas', 'Mapeos'], points: 25, count: 3 },
            { name: 'Integración compleja', topics: ['Integración compleja'], points: 25, count: 3 },
            { name: 'Series de Fourier', topics: ['Series de Fourier'], points: 25, count: 3 },
            { name: 'Transformada de Fourier', topics: ['Transformada de Fourier'], points: 25, count: 3 },
          ],
        },
      },
      { id: 'sistemas-senales', name: 'Análisis de Sistemas y Señales', available: true, topics: ['Señales y sistemas'] },
      { id: 'optimizacion', name: 'Optimización', available: true, topics: ['Optimización sin restricciones', 'Optimización con restricciones'] },
    ],
  },
  {
    level: 5,
    name: 'Integrador / Egreso',
    semesters: '9.º a 10.º semestre',
    subjects: [
      { id: 'modelado', name: 'Modelado Matemático Aplicado', available: true, topics: ['Crecimiento y decaimiento', 'Sistemas dinámicos'] },
      {
        id: 'preparacion',
        name: 'Exámenes de Preparación',
        available: true,
        mixed: true,
        topics: ['Límites', 'Derivadas', 'Integral indefinida', 'Integral definida', 'Ecuaciones y sistemas', 'Matrices', 'EDO de primer orden', 'Combinatoria y probabilidad'],
      },
      {
        id: 'retos',
        name: 'Retos de Grado',
        available: true,
        mixed: true,
        minDifficulty: 3,
        topics: ['Aplicaciones de la derivada', 'Integrales múltiples', 'Valores propios', 'EDO de segundo orden', 'Transformada de Laplace', 'Optimización con restricciones', 'Sistemas dinámicos', 'Distribuciones'],
      },
    ],
  },
];
