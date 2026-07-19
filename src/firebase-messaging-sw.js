// Service worker de Firebase Cloud Messaging para Web Push (Safari/iOS 16.4+,
// Chrome, Edge, Firefox). Tiene que vivir en la raíz del sitio (no en /assets)
// para que su scope cubra toda la app. La config de Firebase es pública (ver
// nota de seguridad en src/environments/environment.ts) así que es seguro
// tenerla hardcodeada acá: un service worker no puede hacer `import` desde el
// bundle de Angular, solo `importScripts`.
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAhVl-d7fikWwNB4gNPLV6ZcO6mg-CSoEg',
  authDomain: 'ashbis-ae5b2.firebaseapp.com',
  projectId: 'ashbis-ae5b2',
  storageBucket: 'ashbis-ae5b2.firebasestorage.app',
  messagingSenderId: '691736988474',
  appId: '1:691736988474:web:8fb6e043aa8e0b0c779e03',
});

const messaging = firebase.messaging();

// Notificación recibida con la app en segundo plano o cerrada.
messaging.onBackgroundMessage((payload) => {
  const notificacion = payload.notification || {};
  const ruta = (payload.data && payload.data.ruta) || '/tabs/notificaciones';
  self.registration.showNotification(notificacion.title || 'Ashbis', {
    body: notificacion.body || '',
    icon: '/assets/icon/pwa/icon-192.png',
    badge: '/assets/icon/pwa/icon-192.png',
    data: { ruta },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const ruta = (event.notification.data && event.notification.data.ruta) || '/tabs/notificaciones';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const cliente of lista) {
        if ('focus' in cliente) {
          cliente.navigate(ruta);
          return cliente.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(ruta);
    })
  );
});
