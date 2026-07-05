/**
 * Traduce códigos de error de Firebase (Auth/Firestore/Storage) y del login
 * nativo con Google a un mensaje en español que le dice al usuario qué pasó,
 * por qué, y qué puede hacer — en vez de mostrarle el código/mensaje crudo.
 *
 * `origen` distingue los códigos de Google Sign-In nativo (que no llevan
 * prefijo `auth/` y se solapan en rango numérico con otros dominios) de los
 * códigos de Firebase.
 */
export function getFriendlyErrorMessage(
  error: any,
  origen: 'auth' | 'google-nativo' | 'firestore' | 'storage' = 'auth'
): string {
  const code: string = error?.code ?? '';

  if (origen === 'google-nativo') {
    return mapGoogleNativoError(code);
  }

  if (code.startsWith('auth/')) {
    return mapAuthError(code);
  }

  return mapFirestoreOStorageError(code);
}

function mapGoogleNativoError(code: string): string {
  switch (code) {
    case 'GOOGLE_PLAY_SERVICES_UNAVAILABLE':
      return 'Este dispositivo no tiene Google Play Services instalado, así que no puede usar el inicio de sesión con Google. Usa tu correo y contraseña.';
    case '10': // GoogleSignInStatusCodes.DEVELOPER_ERROR
      return 'No se pudo verificar la app con Google. Este es un problema de configuración de Ashbis, no tuyo — repórtalo para que lo arreglemos.';
    case '12501': // GoogleSignInStatusCodes.SIGN_IN_CANCELLED
      return 'Inicio de sesión cancelado.';
    case '12500': // GoogleSignInStatusCodes.SIGN_IN_FAILED
      return 'No se pudo completar el inicio de sesión con Google. Intenta nuevamente.';
    case '7': // CommonStatusCodes.NETWORK_ERROR
      return 'Sin conexión a Internet. Verifica tu red e intenta nuevamente.';
    default:
      return 'No se pudo iniciar sesión con Google. Intenta nuevamente o usa tu correo y contraseña.';
  }
}

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'No existe una cuenta con ese correo y contraseña.';
    case 'auth/wrong-password':
      return 'La contraseña es incorrecta.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.';
    case 'auth/network-request-failed':
      return 'Sin conexión a Internet. Verifica tu red e intenta nuevamente.';
    case 'auth/user-disabled':
      return 'Esta cuenta fue deshabilitada. Contacta a soporte.';
    case 'auth/email-already-in-use':
      return 'Ese correo ya está registrado. Intenta iniciar sesión en vez de crear una cuenta nueva.';
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil. Usa al menos 8 caracteres, con letras y números.';
    case 'auth/invalid-email':
      return 'El formato del correo no es válido.';
    case 'auth/operation-not-allowed':
      return 'Este método de inicio de sesión no está habilitado. Contacta a soporte.';
    case 'auth/requires-recent-login':
      return 'Por seguridad, vuelve a iniciar sesión antes de repetir esta acción.';
    default:
      return 'No se pudo completar la operación. Intenta nuevamente.';
  }
}

function mapFirestoreOStorageError(code: string): string {
  switch (code) {
    case 'permission-denied':
      return 'No tienes permisos suficientes para realizar esta acción.';
    case 'unavailable':
      return 'El servidor no está disponible en este momento. Intenta nuevamente en unos minutos.';
    case 'deadline-exceeded':
    case 'cancelled':
      return 'La operación tardó demasiado. Verifica tu conexión e intenta nuevamente.';
    case 'not-found':
      return 'No se encontró la información solicitada.';
    case 'already-exists':
      return 'Ese registro ya existe.';
    case 'resource-exhausted':
      return 'Se alcanzó el límite de uso. Intenta nuevamente más tarde.';
    case 'unauthenticated':
      return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    default:
      return 'Ocurrió un error inesperado. Intenta nuevamente.';
  }
}
