# Análisis de Diseño de Producto, Arquitectura TIC y Evaluación de Riesgos: Aplicaciones de IA para la Justicia

## 1. Contexto y Marco de Evaluación

Durante el desarrollo del evento **«IA, Estado, justicia y litigio»**, coorganizado por **IA Legal Studio**, el **Instituto Colombiano de Derecho Procesal (ICDP)** y **Claude for Legal Tech Colombia**, se llevó a cabo un ejercicio de construcción de software en vivo denominado **«La tutelatón»**. Mediante el uso de herramientas de programación asistida (*Claude Code*) e instrucciones en lenguaje natural, cuatro expertos formularon e implementaron prototipos funcionales orientados a intervenir diferentes etapas del flujo procesal de la acción de tutela en Colombia.

El presente documento analiza cada una de las cuatro soluciones desarrolladas desde la perspectiva del **Diseño de Producto (Product Design / UX / UI)**, la **Arquitectura Tecnológica (TIC y sistemas agénticos)**, la **Calidad del Dato**, los **Casos de Uso**, las **Fortalezas Operativas** y las **Situaciones Negativas o Riesgos de Implementación**.

---

## 2. Metodología de Análisis de Producto

Para la caracterización de cada prototipo se aplicaron los siguientes criterios estandarizados de la industria de software y el derecho procesal:

* **Necesidad Misional**: Problema de congestión o barrera de acceso a la justicia que la aplicación busca resolver.
* **Perfil de Usuario Objetivo**: Rol institucional o ciudadano al que se dirige la interfaz.
* **Diseño de Interfaz e Interacción (UX/UI)**: Disposición de elementos visuales, patrones de navegación y puntos de contacto del usuario.
* **Arquitectura de Datos y TIC**: Canal de entrada (*input*), mecanismos de procesamiento (agentes, RAG, MCP) y entregables (*output*).
* **Flujo Funcional Paso a Paso**: Secuencia operativa desde la recepción de la información hasta la ejecución del resultado.
* **Evaluación de Riesgos y Puntos a Mejorar**: Vulnerabilidades técnicas, sesgos, riesgos de opacidad algorítmica y cumplimiento del marco constitucional y de protección de datos.

---

## 3. Análisis Detallado de las Aplicaciones Propuestas

### 3.1. Tamiz de Tutelas

#### A. Ficha General y Creadora
* **Creadora**: Ana María Ramos (Experta en implementación de IA en la Corte Constitucional; exviceministra de Justicia).
* **Usuario Objetivo**: Despachos de la Magistratura y judicantes en la fase de Selección de Tutelas de la Corte Constitucional de Colombia.

#### B. Necesidad Misional y Caso de Uso
La Corte Constitucional recibe un volumen masivo que supera las 6.300 tutelas diarias. La revisión de estos expedientes para determinar su selección y revisión discrecional exige una tarea manual intensiva de lectura de archivos PDF escaneados, diligenciamiento de tablas en hojas de cálculo y elaboración de fichas sintéticas por parte de los judicantes.

* **Caso de Uso Principal**: Clasificación, agrupación y generación automática de síntesis de expedientes durante las salas de selección de la Corte Constitucional.

#### C. Diseño de Producto (UX/UI) y Arquitectura TIC
* **Patrón de Interfaz (UI)**: Estructuración basada en *cuadernos temáticos* o carpetas dinámicas organizadas por patrones fácticos (ej. fotomultas, insumos de salud, pensiones, transporte).
* **Procesamiento y Calidad del Dato**:
  * *Input*: Archivos PDF heterogéneos y no estructurados que contienen la tutela, historia clínica, respuesta de la EPS, fallo de primera y segunda instancia, e impugnación.
  * *Pipeline Agéntico*: Cadena multagente donde un primer agente ejecuta el OCR y extracción de texto; un segundo agente normaliza la información a Markdown; un tercer agente clasifica según el patrón fáctico; y un cuarto agente redacta la ficha técnica.
  * *Output*: Fichas temáticas estandarizadas y alertas de posible apartamiento del precedente constitucional por parte de los jueces de instancia.

#### D. Flujo de Funcionamiento Paso a Paso
1. Carga masiva de la carpeta del expediente judicial en formato PDF.
2. Conversión estructurada del texto procesal a sintaxis Markdown para eliminar ruido de formato.
3. Extracción de metadatos procesales clave (identificación de la entidad, derecho vulnerado, diagnóstico médico, insumo solicitado y sentido de los fallos previos).
4. Agrupamiento del expediente en el cuaderno temático correspondiente y generación de la ficha de síntesis para el magistrado.

#### E. Fortalezas y Puntos Positivos
* Transforma un proceso de lectura desestructurada de miles de páginas en una matriz analítica navegable.
* Detecta patrones de vulneración sistemática y discrepancias jurisprudenciales entre juzgados de instancia de manera temprana.

#### F. Puntos a Mejorar y Riesgos (Situaciones Negativas)
* **Riesgo de Opacidad Algorítmica (Sentencia T-067)**: La incorporación de calificaciones automáticas de "urgencia" o recomendaciones de selección puede activar cuestionamientos de opacidad y vulneración del debido proceso.
* **Sensibilidad de Datos de Salud (Ley 1581 de 2012)**: Al procesar historias clínicas y diagnósticos sensibles, requiere un protocolo estricto de anonimización previo al procesamiento en modelos de lenguaje.

---

### 3.2. Tutela Líder

#### A. Ficha General y Creador
* **Creador**: Gabriel (CEO de Datoscol y embajador de *Claude for Science*).
* **Usuario Objetivo**: Jueces y secretarios de juzgados municipales y de circuito con alta congestión de tutelas masivas.

#### B. Necesidad Misional y Caso de Uso
Represo en despachos judiciales por el ingreso simultáneo de decenas o cientos de tutelas sustancialmente idénticas, dirigidas contra la misma entidad accionada (EPS, autoridad de tránsito) y por la misma pretensión (ej. entrega de losartán o insulina).

* **Caso de Uso Principal**: Gestión y resolución masiva de expedientes con identidad fáctica mediante la doctrina de la extensión de fallos y el efecto *inter communis*.

#### C. Diseño de Producto (UX/UI) y Arquitectura TIC
* **Fundamentación Procesal en el Prompt**: Implementación del marco normativo del Decreto 1069 de 2015 (reparto masivo) y de la jurisprudencia constitucional sobre fallos con efectos *inter communis* (Sentencia SU-1023 de 2021).
* **Patrón de Interfaz (UI)**: Disposición de pantalla dividida (*split screen*). El panel izquierdo despliega el análisis detallado de la "Tutela Líder", mientras el panel derecho exhibe un tablero de tarjetas interactivas (*thumbnails*) con los 200+ expedientes idénticos agrupados.
* **Micro-interacción Clave (CTA)**: Botón de ejecución masiva: *"Extender la orden a las 146 tutelas idénticas de la lista"*.

#### D. Flujo de Funcionamiento Paso a Paso
1. Ingesta y comparación semántica de las tutelas ingresadas en el despacho en el mismo periodo.
2. Identificación de la tutela con la pretensión más completa y estructuración del fallo como "Tutela Líder".
3. Verificación automática de los requisitos de procedibilidad (legitimación, subsidiariedad e inmediatez).
4. Revisión por parte del juez y aplicación del efecto *inter communis* para extender la orden masivamente con un solo comando.

#### E. Fortalezas y Puntos Positivos
* **Desgestión Operativa Significativa**: Reduce el tiempo de proyección de cientos de providencias repetitivas a la revisión de un único fallo matriz.
* **Unidad de Criterio Judicial**: Garantiza que decisiones sobre el mismo hecho y la misma entidad mantengan estricta coherencia en el despacho.

#### F. Puntos a Mejorar y Riesgos (Situaciones Negativas)
* **Riesgo de Omisión de Excepciones Fácticas**: Si uno de los expedientes del grupo contiene una condición de vulnerabilidad adicional o un hecho superado, el agrupamiento automático podría invisibilizarlo si no existe un módulo de filtrado de anomalías.
* **Falta de Módulo de Notificación**: El prototipo requiere integrarse con sistemas de gestión documental para automatizar el envío de los oficios de notificación individual a las partes.

---

### 3.3. Pulso / Amparo

#### A. Ficha General y Creador
* **Creador**: Alejandro (Líder de Ágatha, GovTech pública).
* **Usuario Objetivo**: Abogados litigantes, firmas de servicios legales, startups *legaltech* y ciudadanos.

#### B. Necesidad Misional y Caso de Uso
Falta de orientación jurídica en la ciudadanía para estructurar demandas de tutela y dificultades en las firmas de abogados para gestionar el flujo de trabajo y el control estricto de los términos procesales.

* **Caso de Uso Principal**: Captura de historias ciudadanas por voz o texto, evaluación de procedencia, generación del borrador en Word (`.docx`) y seguimiento de calendario procesal con alertas de términos (10 y 15 días).

#### C. Diseño de Producto (UX/UI) y Arquitectura TIC
* **Enfoque de Producto (SaaS Multi-rol)**: Plataforma web estructurada en pestañas independientes (*"Ciudadano"*, *"Abogado"*, *"Despacho"*, *"Términos"*).
* **Multimodalidad de Entrada**: Módulo de captura de audio (*speech-to-text*) para personas que no pueden o no saben redactar la solicitud por escrito.
* **Motor de Reglas Procesales**: Evaluación de procedibilidad basada en 5 filtros constitucionales (legitimación activa, legitimación pasiva, derecho fundamental invocado, subsidiariedad e inmediatez).
* **Outputs Integrados**: Documento estructurado descargable en `.docx` y tablero de control con semáforo de vencimiento de términos procesales.

#### D. Flujo de Funcionamiento Paso a Paso
1. El ciudadano dicta o escribe el relato de la situación que enfrenta con su servicio de salud o petición.
2. El sistema procesa la entrada, evalúa la procedibilidad y extrae los hechos jurídicamente relevantes.
3. Se genera la plantilla de la acción de tutela en formato Word con la técnica jurídica adecuada.
4. En el módulo de abogados, el expediente queda registrado en un tablero con un contador visual de días hábiles restantes para el fallo o impugnación.

#### E. Fortalezas y Puntos Positivos
* Elevado nivel de acabado en el diseño de interfaz (UX/UI), facilitando la adopción por parte de usuarios sin formación legal.
* Cubre el ciclo completo de trabajo: desde la toma de hechos hasta el seguimiento del calendario procesal.

#### F. Puntos a Mejorar y Riesgos (Situaciones Negativas)
* **Riesgo de Estimulación del Litigio Innecesario**: La extrema facilidad de generación de documentos puede incentivar la radicación desmedida de tutelas sin agotar previamente canales directos de petición.
* **Verificación de Fuentes**: Requiere la inclusión de motores de auditoría para evitar que las citas jurisprudenciales incluidas en el `.docx` presenten imprecisiones.

---

### 3.4. Tutela Precisa (Ganadora de la Votación del Auditorio)

#### A. Ficha General y Creador
* **Creador**: Jairo Parra Cuadros (Secretario General del Instituto Colombiano de Derecho Procesal).
* **Usuario Objetivo**: Ciudadanía en general y usuarios del sistema de justicia (financiado e integrado como herramienta pública de la Rama Judicial).

#### B. Necesidad Misional y Caso de Uso
Incapacidad del ciudadano común para filtrar la emotividad o los detalles irrelevantes al redactar una tutela, lo que genera escritos extensos y desordenados que ralentizan la labor del juez. Necesidad de garantizar fundamentación jurisprudencial real y transparente.

* **Caso de Uso Principal**: Asistencia guiada al ciudadano para la redacción de tutelas depuradas, comprobación de jurisprudencia en la relatoría oficial y cálculo de probabilidad de éxito.

#### C. Diseño de Producto (UX/UI) y Arquitectura TIC
* **Algoritmo de Depuración Fáctica**: Módulo de *prompt engineering* diseñado para identificar y remover el "ruido" o la emotividad de la narración (ej. descartar quejas sobre el parqueadero o la atención en ventanilla) y conservar únicamente los hechos procesales relevantes.
* **Conexión RAG / MCP con Fuente Oficial**: Verificación directa contra la base de datos de la relatoría de la Corte Constitucional, validando la vigencia de sentencias hito (ej. T-760/08, T-508/20).
* **Transparencia y Elementos de UI**: Panel que despliega enlaces directos a las sentencias citadas en la web oficial de la Corte Constitucional, gráfico interactivo de estimación de éxito (ej. 92%) e instructivo de radicación paso a paso.
* **Aviso de Responsabilidad (Disclaimer)**: Advertencia clara de que el cálculo es orientativo y no vincula la decisión del juez.

#### D. Flujo de Funcionamiento Paso a Paso
1. El ciudadano dicta o escribe su caso de forma abierta e informal.
2. La herramienta filtra el contenido, extrae los hechos sustanciales y consulta la relatoría oficial mediante MCP/RAG.
3. Presenta una sección de "Jurisprudencia Verificada" con enlaces activos y explica en lenguaje sencillo por qué aplican al caso.
4. Genera el borrador depurado de la tutela, muestra la estimación de probabilidad e indica los pasos para radicar ante la autoridad judicial.

#### E. Fortalezas y Puntos Positivos
* **Cero Alucinaciones**: Máxima confiabilidad técnica al validar las citas directamente contra la fuente oficial de la Corte Constitucional en tiempo real.
* **Ahorro de Tiempo Procesal**: Entrega al despacho judicial un escrito limpio, conciso y fundamentado, facilitando la labor de sustanciación.
* **Alta Aceptación del Público**: Fue el prototipo más votado por el auditorio en la evaluación interactiva del evento.

#### F. Puntos a Mejorar y Riesgos (Situaciones Negativas)
* **Gestión de Falsas Expectativas**: La exhibición de porcentajes de probabilidad (ej. 92%) puede derivar en reclamos de los usuarios si el fallo resulta desfavorable tras la valoración probatoria de la contraparte.
* **Protección de Datos Sensibles**: Al solicitar detalles médicos del ciudadano, requiere mecanismos avanzados de encriptación y consentimiento explícito en cumplimiento de la Ley 1581 de 2012.

---

## 4. Matriz Comparativa Sintética

| Dimensión | Tamiz de Tutelas | Tutela Líder | Pulso / Amparo | Tutela Precisa |
| :--- | :--- | :--- | :--- | :--- |
| **Creador** | Ana María Ramos | Gabriel | Alejandro | Jairo Parra Cuadros |
| **Audiencia** | Corte Constitucional | Jueces de Instancia | Abogados / Startups | Ciudadano / Rama Judicial |
| **Entrada (Input)** | PDF escaneados | Expedientes digitales | Voz o texto informal | Voz o texto informal |
| **Procesamiento** | Agentes + OCR + MD | Filtro de coincidencia + *Prompt* | Motor de 5 reglas procesales | Algoritmo depurador + RAG/MCP |
| **Entregable (Output)** | Ficha temática + Alerta | Fallo matriz + Extensión masiva | Documento `.docx` + Alerta términos | Escrito depurado + Enlaces reales |
| **Aporte Principal** | Agrupación de 6.300 tutelas/día | Extensión *inter communis* en 1 clic | Gestión de ciclo completo B2B/B2C | Cero alucinación en jurisprudencia |
| **Riesgo Clave** | Opacidad en selección | Omisión de casos excepcionales | Estimulación de litigio masivo | Falsas expectativas por % éxito |
| **Votación Público** | 4º Lugar (Opción D) | 3º Lugar (Opción A) | 2º Lugar (Opción C) | **1º Lugar (Ganadora - Opción B)** |

---

## 5. Principios Transversales de Product Design y Arquitectura TIC

El ejercicio práctico de «La tutelatón» permitió extraer cuatro lecciones fundamentales sobre el desarrollo de soluciones de software para la administración de justicia:

1. **Prevalencia del Conocimiento de Dominio sobre la Programación Tradicional**: La capacidad de formular instrucciones precisas basadas en el derecho procesal (*velocidad de producto*) demostró ser más determinante para el éxito de la aplicación que la escritura manual de código (*velocidad técnica*).
2. **Evolución hacia Sistemas Agénticos Especializados**: El desarrollo de herramientas profesionales exige superar el uso de modelos de lenguaje aislados e implementar cadenas agénticas con protocolo de contexto (MCP) y agentes auditores que validen la información procesada.
3. **Control Humano Efectivo (*Human-on-the-loop*)**: En el ámbito jurídico, el profesional mantiene la responsabilidad exclusiva sobre el contenido final firmado (*"Meat Proxy"*), utilizando la tecnología como un acelerador de tareas operativas de lectura, clasificación y redacción.
4. **Diseño Centrado en la Confianza y la Transparencia**: Las herramientas con mayor respaldo por parte de los usuarios son aquellas que garantizan la trazabilidad de sus fuentes normativas y eliminan los márgenes de alucinación jurisprudencial.
