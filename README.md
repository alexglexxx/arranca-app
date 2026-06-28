# arranca. — Préstamos para gasolina (choferes de apps)

Piloto de microcrédito de $200 MXN para choferes de Uber/DiDi/inDriver, con
verificación de identidad y actividad, panel de administrador, y WhatsApp
Business API para códigos de acceso. Ver razonamiento completo del proyecto
en `ale-nota-proyecto-arranca.md` (en el repo de ALE).

## Stack
- Next.js 14 (App Router) + TypeScript + Tailwind
- Firebase Auth (Phone) — login con código SMS nativo de Firebase
- Firebase (Firestore + Storage + Admin SDK)
- WhatsApp Business API (Meta, cuenta "Titan") — SOLO para recordatorios de pago
- PWA — se instala con ícono en pantalla de inicio, sin necesitar App Store

## Antes de arrancar — checklist de configuración

1. **Crear proyecto en Firebase Console** (https://console.firebase.google.com)
   - Habilitar **Authentication → Sign-in method → Phone**
   - Habilitar Firestore (modo producción — las reglas ya vienen restrictivas
     en `firestore.rules`, todo pasa por las API routes)
   - Habilitar Storage (las reglas en `storage.rules` ya están listas para
     desplegarse, basadas en `request.auth.uid`)
   - Crear una Service Account (Configuración del proyecto → Cuentas de servicio
     → Generar nueva clave privada) — descarga el JSON

2. **Desplegar las reglas de seguridad** (necesitas Firebase CLI):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init   # selecciona Firestore y Storage, usa los archivos .rules ya incluidos
   firebase deploy --only firestore:rules,storage:rules
   ```

3. **WhatsApp Business API — solo para recordatorios de pago** (ya no para login)
   - Crear y que Meta apruebe una plantilla de tipo **Utility** llamada
     `recordatorio_pago` con 3 parámetros (nombre, monto, fecha)
   - El `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_ACCESS_TOKEN` siguen siendo
     necesarios para esto, dados de alta dentro de Titan

4. **Llenar `.env.local`** copiando `.env.example` y completando cada valor.

## Instalación (vía Termius/SSH en tu VM)

```bash
cd ~
git clone <tu-repo-de-este-proyecto>  # o sube los archivos por SFTP/scp
cd arranca-app
npm install
cp .env.example .env.local
nano .env.local   # llena los valores reales
```

## Inicializar capital (una sola vez)

```bash
npx tsx scripts/inicializar-capital.ts
```

## Probar en desarrollo

⚠️ **Lección ya aprendida en InteriorLab**: nunca debuguear subida de archivos
desde el iPhone a través de un túnel sobre `next dev` — el Hot Module
Reload interfiere con WebSockets y vas a perder tiempo pensando que es un bug
cuando es solo el dev server. Para probar subida de selfies/videos/comprobantes
desde tu iPhone real, siempre usa build de producción:

```bash
npm run build
npm run start
# en otra sesión de Termius:
cloudflared tunnel --url http://localhost:3000
```

Eso te da una URL pública temporal que puedes abrir directo desde el navegador
de tu iPhone, ya sin los problemas de HMR.

## Cron de marcado de mora

Agrega esto a tu crontab (`crontab -e`) para que corra una vez al día:

```
0 8 * * * curl -s "http://localhost:3000/api/cron/marcar-mora?secreto=TU_CRON_SECRET" >> /home/alexglex/arranca-cron.log 2>&1
```

## Estructura del proyecto

```
app/
├── registro/          → Pantalla 1: nombre, teléfono, correo → envía SMS (Firebase Auth)
│                          Soporta ?ref=CODIGO para registrar referidos
├── verificar/          → Pantalla 2: ingresar código SMS (6 dígitos, Firebase Auth)
├── kyc/                 → Pantalla 3: selfie+INE, tarjeta circulación, video de perfil
├── solicitar/          → Pantalla 4: cuestionario, referencias, tasas (3 escalones), compromiso
├── prestamo/            → Pantallas 5-8: revisión, activo, comprobante, pagado
├── referidos/           → Código propio, compartir link, saldo de recompensas
├── admin/               → Panel admin: lista de solicitudes y activos
├── admin/revisar/       → Panel admin: checklist + cuestionario/referencias + aprobar/rechazar
├── admin/confirmar-pago/→ Panel admin: confirmar monto recibido (calcula tasa automático)
├── admin/referidos/     → Panel admin: recompensas pendientes de pago
└── api/                 → Toda la lógica de backend (ver cada route.ts comentado)

lib/
├── firebase.ts          → Cliente Firebase + Auth (navegador)
├── firebase-admin.ts    → Admin SDK (solo servidor)
├── whatsapp.ts          → Envío de recordatorios vía WhatsApp Business API
└── storage.ts           → Subida de archivos a Firebase Storage

types/index.ts           → Tipos centrales + reglas de negocio (tasas, montos)
firestore.rules           → Bloqueo total de acceso directo (todo pasa por API routes)
storage.rules             → Permite subida solo al propio usuario autenticado
```

## Pendientes conocidos (no bloqueantes para el piloto)

- Notificaciones push reales (actualmente la pantalla `/prestamo` usa polling
  cada 8 segundos en vez de push — funciona, pero push sería más eficiente)
- Migrar el paso a "anillos"/niveles de monto mayor cuando se valide este piloto
- En producción, Firebase Phone Auth puede pedir agregar tu dominio real a
  la lista de dominios autorizados (Authentication → Settings → Authorized domains)
