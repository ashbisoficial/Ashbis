// ─── NOTA DE SEGURIDAD ────────────────────────────────────────────────────────
//
// Las claves de Firebase (apiKey, appId, etc.) son PÚBLICAS por diseño:
// son identificadores de proyecto, no secretos. La seguridad real está en:
//   1. Las Firestore Security Rules  → firestore.rules
//   2. Las Storage Security Rules    → storage.rules
//   3. Firebase App Check            → valida que las peticiones vienen de tu app
//
// LO QUE NUNCA DEBE ESTAR AQUÍ:
//   ❌ La clave de la API de Anthropic/Claude
//   ❌ Claves de servicios de pago
//   ❌ Secretos de backend
//
// Esas claves van en Firebase Functions config:
//   firebase functions:config:set anthropic.key="sk-ant-..."
//
// ─────────────────────────────────────────────────────────────────────────────

export const environment = {
  production: false,

  firebase: {
    apiKey:            'AIzaSyAhVl-d7fikWwNB4gNPLV6ZcO6mg-CSoEg',
    authDomain:        'ashbis-ae5b2.firebaseapp.com',
    projectId:         'ashbis-ae5b2',
    storageBucket:     'ashbis-ae5b2.firebasestorage.app',
    messagingSenderId: '691736988474',
    appId:             '1:691736988474:web:8fb6e043aa8e0b0c779e03',
    measurementId:     'G-8P1SNJ4TL3',
  },

  // Proxy para el chat IA — nunca llames a Anthropic directamente desde el cliente
  aiProxyUrl: '/api/ai-proxy',

  // App Check reCAPTCHA v3 (defensa contra bots y abuso de cuota)
  // Actívalo en Firebase Console → App Check → Registrar app
  appCheckSiteKey: '6LdcheUsAAAAAIup4YqAAxTuwnXiRqEJ7dYf7XD6',

  // Web Client ID de OAuth para "Sign in with Google" (Google Identity Services).
  // Sácalo de: Firebase Console → Authentication → Sign-in method → Google →
  // "Web SDK configuration" → "Web client ID" (termina en .apps.googleusercontent.com).
  // ⚠️ Reemplaza este placeholder o el botón de Google no funcionará.
  googleWebClientId: '691736988474-1k8beq55v07k8tsbj3d1rsle52q5s12l.apps.googleusercontent.com',

  // Dominios autorizados para OAuth de Google (añadir el dominio de producción)
  authAuthorizedDomains: [
    'localhost',
    '127.0.0.1',
    'ashbis-ae5b2.web.app',
    'ashbis-ae5b2.firebaseapp.com',
    // 'ashbis.app',  // ← añadir cuando tengas dominio propio
  ],

  // Tamaños máximos de archivo (en MB)
  maxImageSizeMb: 10,
  maxDocumentSizeMb: 20,

  // Tipos MIME permitidos por categoría
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  allowedDocumentTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
};