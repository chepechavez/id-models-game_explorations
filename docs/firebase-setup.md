# Configuración de Firebase para «El Encargo» (Plan Spark — 100 % Gratuito)

Esta guía paso a paso te permite conectar tu propio proyecto gratuito de **Firebase Realtime Database** en menos de 5 minutos, sin tarjeta de crédito.

> **Nota importante:** Mientras no configures Firebase, la aplicación funciona automáticamente en **Modo Ensayo Local** (sincronizando pestañas del mismo navegador mediante `BroadcastChannel` y `localStorage`), por lo que puedes probar el flujo Docente + Proyección + Estudiantes en un mismo equipo de inmediato. Para jugar con estudiantes conectados desde sus celulares o computadoras en distintas redes, sigue los 5 pasos siguientes.

---

## Paso 1: Crear el proyecto en Firebase (Plan Spark $0)
1. Ingresa a [https://console.firebase.google.com/](https://console.firebase.google.com/) con tu cuenta de Google.
2. Haz clic en **Crear un proyecto** (o *Add project*).
3. Asigna un nombre (por ejemplo, `el-encargo-id-models`).
4. Desactiva *Google Analytics* (no es necesario para el juego y simplifica la creación) y haz clic en **Crear proyecto**.
5. Verifica en la esquina inferior izquierda que el proyecto esté en el **Plan Spark (Sin costo / $0)**. No requiere método de pago.

## Paso 2: Habilitar Autenticación Anónima
La autenticación anónima asigna un identificador único (`uid`) invisible a cada participante y al docente sin pedirles correo ni contraseña, evitando que un estudiante altere el estado de la sala o el puntaje.
1. En el menú lateral izquierdo, abre **Compilación (Build) → Authentication** y haz clic en **Comenzar**.
2. En la pestaña **Sign-in method**, selecciona **Anónimo (Anonymous)**.
3. Activa el interruptor **Habilitar** y presiona **Guardar**.

## Paso 3: Crear la Realtime Database
1. En el menú lateral izquierdo, abre **Compilación (Build) → Realtime Database** y haz clic en **Crear base de datos**.
2. Elige la ubicación `United States (us-central1)` y haz clic en **Siguiente**.
3. Selecciona **Comenzar en modo bloqueado** y haz clic en **Habilitar**.

## Paso 4: Publicar las Reglas de Seguridad
1. Dentro de **Realtime Database**, abre la pestaña **Reglas (Rules)**.
2. Reemplaza todo el contenido por el archivo [`database.rules.json`](../database.rules.json) de este repositorio.
3. Haz clic en **Publicar (Publish)**.

Estas reglas garantizan que:
- Solo el creador de la sala (`hostUid`) pueda abrir/cerrar rondas, revelar resultados y asignar puntajes.
- Cada estudiante solo pueda escribir su propio voto mientras `state.phase === "open"` y antes de la hora límite (`now <= state.deadline`), con sello de tiempo del servidor (`now`).

## Paso 5: Conectar las credenciales Web a la aplicación
1. Ve a **Configuración del proyecto (⚙️) → General**.
2. Baja hasta la sección **Tus apps** y haz clic en el ícono Web **`</>`**.
3. Ponle un apodo (por ejemplo, `el-encargo-web`), deja desmarcado *Firebase Hosting* y haz clic en **Registrar app**.
4. Copia el objeto `firebaseConfig`:
   ```json
   {
     "apiKey": "AIzaSy...",
     "authDomain": "tu-proyecto.firebaseapp.com",
     "databaseURL": "https://tu-proyecto-default-rtdb.firebaseio.com",
     "projectId": "tu-proyecto",
     "appId": "1:123456789:web:abcdef"
   }
   ```
5. Tienes **dos formas** de activarlo:
   - **Opción A (Directo desde la interfaz web, sin tocar código):** En la pantalla del Docente (`#/host`), abre el panel **«Configurar Firebase en vivo»** y pega el bloque `firebaseConfig`. Al crear la sala, el enlace y el código QR que compartes con los estudiantes incluyen automáticamente los parámetros de conexión a tu base de datos.
   - **Opción B (Fijo en el repositorio):** Pega los valores en `src/firebaseConfig.ts` (o pásamelos en el chat para que yo los deje guardados en `main`).
