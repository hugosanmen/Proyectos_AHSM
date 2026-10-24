// curriculum.js — estructura curricular como DATOS. Cada materia lista los `topics` (nombres EXACTOS del campo
// `topic` de las plantillas del motor). Una materia sin `available: true` aparece como «Próximamente».
// Las materias con `mixed: true` (Preparación, Retos) reutilizan temas de otras materias;
// `minDifficulty` limita el sorteo a ejercicios de esa dificultad o más.

export const CURRICULUM = [
  {
    level: 1,
    name: 'Ingreso y Ciencias Básicas',
    semesters: '1.º a 2.º semestre',
    subjects: [
      { id: 'algebra', name: 'Álgebra', available: true, topics: ['Ecuaciones y sistemas', 'Exponentes y logaritmos', 'Binomio de Newton'] },
      { id: 'geometria-analitica', name: 'Geometría Analítica', available: true, topics: ['Rectas y distancias', 'Cónicas'] },
      { id: 'calculo-diferencial', name: 'Cálculo Diferencial', available: true, topics: ['Límites', 'Derivadas', 'Aplicaciones de la derivada'] },
      { id: 'calculo-integral', name: 'Cálculo Integral', available: true, topics: ['Integral indefinida', 'Integral definida'] },
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
      { id: 'variable-compleja', name: 'Funciones de Variable Compleja', available: true, topics: ['Números complejos', 'Funciones analíticas'] },
    ],
  },
  {
    level: 4,
    name: 'Especializado',
    semesters: '7.º a 8.º semestre',
    subjects: [
      { id: 'matematicas-avanzadas', name: 'Matemáticas Avanzadas para Ingeniería', available: true, topics: ['Transformada de Laplace', 'Series'] },
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
