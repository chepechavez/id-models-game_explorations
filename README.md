# El Encargo — Simulador de Decisiones en Diseño Instruccional

Aplicación web sincrónica en tiempo real para clases de posgrado y diplomados en Diseño Instruccional. Los participantes asumen el rol de **Lead Instructional Designers** en una firma de consultoría educativa y corporativa: en cada ronda reciben el **encargo (brief) de un cliente** con síntomas operativos y restricciones reales, consultan el **Vademécum Interactivo de Modelos** desde la primera ronda y prescriben la arquitectura metodológica idónea antes de que el docente cierre la votación.

- **Aplicación publicada (GitHub Pages):** `https://chepechavez.github.io/id-models-game_explorations/`

---

## Características Principales

1. **Vistas sincronizadas en tiempo real:**
   - **Ingreso de Estudiantes (`#/`):** Acceso sin registro mediante código de sala (5 caracteres sin letras ambiguas) o código QR + nombre/apodo. Si el estudiante recarga o pierde conexión temporalmente, recupera su puntaje automáticamente.
   - **Vista del Estudiante (`#/play/:code`):** Diseñada primero para celular y computador. Permite leer el brief, elegir y **cambiar de opción libremente hasta que el docente cierre la ronda**, consultar en cualquier momento la pestaña del **Vademécum de 6 Modelos**, y recibir al revelar el dictamen específico sobre la opción elegida y el análisis completo de todas las opciones.
   - **Consola Privada del Docente (`#/host` y `#/host/:code`):** Permite elegir sesiones de **6, 12 o 18 rondas**, configurar temporizadores por nivel, monitorear cuántos estudiantes han votado (sin delatar qué votaron antes del cierre), extender tiempo (+60s), cerrar votación, revelar retroalimentación y consultar notas privadas de facilitación con citas verificadas.
   - **Vista de Proyección (`#/screen/:code`):** Modo oscuro de alto contraste optimizado para compartir pantalla en Zoom/Meet o proyectar en aula. Muestra QR de ingreso, brief, temporizador, barras de distribución de votos al revelar, **Ranking Top 5** por ronda y, al finalizar, el **Podio Final** junto con el **Mapa de Decisiones de la Cohorte** (matriz de precisión y trampas más frecuentes por modelo).
   - **Vademécum Independiente (`#/guia`):** Guía visual interactiva (en formato de Fichas Tácticas por Modelo y Tabla Comparativa filtrable) disponible tanto dentro como fuera del juego.
   - **Modo Práctica (`#/practica`):** Entrenamiento individual a ritmo propio sin límite de tiempo ni conexión a sala, con filtro opcional de modelos, retoma automática ante recargas, balance por modelo y reintento de casos fallados.

2. **Banco de 18 Casos y Vademécum Validados con Fuentes Primarias:**
   - **6 Modelos cubiertos (3 casos por modelo: Nivel 1 con 3 opciones, Nivel 2 con 4 opciones, Nivel 3 con 5 opciones):**
     - **Action Mapping** — Cathy Moore (2017, *Map It*)
     - **4C-ID** — Jeroen J. G. van Merriënboer & Paul A. Kirschner (2002, 2019, 2021, 2024, *Ten Steps to Complex Learning*, 4th ed.)
     - **ADDIE (Marco Contenedor de Ciclo de Vida)** — Robert M. Branch (2009, *Instructional Design: The ADDIE Approach*)
     - **Enfoque de Sistemas (Dick & Carey)** — Walter Dick, Lou Carey & James O. Carey (2015, *The Systematic Design of Instruction*, 8th ed.)
     - **Pebble-in-the-Pond (First Principles of Instruction)** — M. David Merrill (2002, 2008, 2013, 2017, *First Principles of Instruction*)
     - **Backward Design / Understanding by Design (UbD)** — Grant Wiggins & Jay McTighe (2005, 2011, 2012, *Understanding by Design*)
   - Todos los casos están redactados en **lenguaje de síntomas operativos** (verificados automáticamente por `npm run validate:content` para impedir que se resuelvan buscando palabras clave con `Ctrl + F`).

3. **Fórmula de Puntaje Mixto:**
   - **Base por acierto:** `600 puntos` fijos (premia el juicio clínico y la consulta del Vademécum sin penalizar severamente el tiempo de lectura).
   - **Bono de rapidez:** hasta `400 puntos` adicionales que decrecen linealmente entre la apertura y el cierre de la ronda, tomando la hora de la **última opción seleccionada** antes del cierre.

---

## Documentación de Validación y Configuración

- [`content/validation/protocolo.md`](./content/validation/protocolo.md): Protocolo estructurado de validación frente al cuaderno *«Experto en modelos de diseño instruccional»*.
- [`content/validation/respuestas/auditoria-fuentes-primarias.md`](./content/validation/respuestas/auditoria-fuentes-primarias.md): Citas textuales verbatim y páginas exactas extraídas de las obras originales de los autores.
- [`content/validation/registro-cambios.md`](./content/validation/registro-cambios.md): Registro detallado de correcciones y matices sugeridos para la hoja `Comparativa modelos ID_v2` (sin modificar tu archivo original en Google Drive).
- [`docs/firebase-setup.md`](./docs/firebase-setup.md): Guía paso a paso (5 minutos) para conectar un proyecto gratuito de **Firebase Realtime Database (Plan Spark $0)** para sesiones multidispositivo, más el modo automático de ensayo multi-pestaña.

---

## Comandos de Desarrollo y Verificación

```bash
npm install                # Instalar dependencias
npm run validate:content   # Validar estructura 3x6, filtro anti-Ctrl+F y citas de los 18 casos
npm test                   # Ejecutar pruebas unitarias (Vitest: puntaje, códigos y secuencias)
npm run test:rules         # Probar reglas de seguridad database.rules.json en el emulador Firebase
npm run test:e2e           # Ejecutar prueba E2E completa (Playwright: Docente + Proyección + Estudiante)
npm run dev                # Iniciar servidor local en http://127.0.0.1:5173
npm run build              # Compilar bundle de producción en ./dist
```
