export const environment = {
  production: true,

  firebase: {
    apiKey:            'AIzaSyAhVl-d7fikWwNB4gNPLV6ZcO6mg-CSoEg',
    authDomain:        'ashbis-ae5b2.firebaseapp.com',
    projectId:         'ashbis-ae5b2',
    storageBucket:     'ashbis-ae5b2.firebasestorage.app',
    messagingSenderId: '691736988474',
    appId:             '1:691736988474:web:8fb6e043aa8e0b0c779e03',
    measurementId:     'G-8P1SNJ4TL3',
  },

  aiProxyUrl: '/api/ai-proxy',

  // Mismo motivo que en environment.ts: los QR deben apuntar a la URL pública,
  // nunca a window.location.origin (rompe en la app Android/Capacitor).
  appUrl: 'https://ashbis-ae5b2.web.app',

  appCheckSiteKey: '6LdcheUsAAAAAIup4YqAAxTuwnXiRqEJ7dYf7XD6',

  // Misma clave VAPID que en environment.ts (Firebase Console → Cloud Messaging
  // → Configuración web → Generar par de claves).
  webPushVapidKey: 'BDj6Ftrfb1LpSgmhVqDZaS0YWrFqwYLGqpqZSID22POwJ7EII9R407oC50CTJYPh0ZWlJtJzAoeObkt2YpSP8Qo',

  // Mismo Web Client ID que en environment.ts (es público, no es un secreto)
  googleWebClientId: '691736988474-1k8beq55v07k8tsbj3d1rsle52q5s12l.apps.googleusercontent.com',

  // Mismo criterio que en environment.ts: restringida por HTTP referrer, segura de exponer.
  googlePlacesApiKey: 'AIzaSyBUMGw2keUDxu4zHYDS8pehHMHtXC7cx9c',

  authAuthorizedDomains: [
    'ashbis-ae5b2.web.app',
    'ashbis-ae5b2.firebaseapp.com',
    // 'ashbis.app',
  ],

  maxImageSizeMb:    10,
  maxDocumentSizeMb: 20,
  allowedImageTypes:    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  allowedDocumentTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
};