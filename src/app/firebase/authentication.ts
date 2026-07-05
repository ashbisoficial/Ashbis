import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  user
} from '@angular/fire/auth';
import { Observable } from 'rxjs';
import type {
  User,
  UserCredential
} from 'firebase/auth';
import { environment } from 'src/environments/environment';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@southdevs/capacitor-google-auth';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {

  private auth = inject(Auth);
  private injector = inject(Injector);

  authState$: Observable<User | null> = user(this.auth);

  constructor() {

    

  }

  // ✅ REGISTRO
  async createUser(email: string, password: string) {
    return await createUserWithEmailAndPassword(
      this.auth,
      email,
      password
    );
  }

  // ✅ LOGIN EMAIL
  async login(email: string, password: string) {
    return await signInWithEmailAndPassword(
      this.auth,
      email,
      password
    );
  }

  // 🔵 LOGIN GOOGLE (WEB) — Google Identity Services, API OAuth2 (en uso actualmente)
  // El componente de login obtiene un access token con
  // google.accounts.oauth2.initTokenClient()/requestAccessToken() — abre el
  // consentimiento de Google en su propia ventana emergente (no un overlay
  // dentro de la página, como hacían accounts.id.prompt()/renderButton()) —
  // y lo intercambiamos aquí por una sesión de Firebase Auth. A diferencia de
  // signInWithPopup/signInWithRedirect, esto no depende del iframe puente de
  // Firebase ni de cookies de terceros entre tu dominio y *.firebaseapp.com,
  // así que funciona aunque Chrome las bloquee.
  async signInWithGoogleAccessToken(accessToken: string): Promise<UserCredential> {
    const credential = GoogleAuthProvider.credential(null, accessToken);
    return await runInInjectionContext(this.injector, () =>
      signInWithCredential(this.auth, credential)
    );
  }

  // 🔵 LOGIN GOOGLE (NATIVO) — para la app Android/Capacitor.
  // Google Identity Services (usado en signInWithGoogleAccessToken) es solo
  // para web: no funciona dentro del WebView de una app empaquetada. En Android
  // usamos el plugin nativo, que abre el selector de cuentas del sistema y
  // nos entrega un idToken que canjeamos por la misma sesión de Firebase Auth.
  async signInWithGoogleNative(): Promise<UserCredential> {
    const scopes = ['email', 'profile'];
    await GoogleAuth.initialize({ scopes });
    const googleUser = await GoogleAuth.signIn({ scopes });
    const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
    return await runInInjectionContext(this.injector, () =>
      signInWithCredential(this.auth, credential)
    );
  }

  isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }

  // 🔵 LOGIN GOOGLE (REDIRECT) — LEGADO, ya no se usa desde el componente de login.
  // Se deja aquí por si en el futuro se necesita para apps nativas con
  // Capacitor (donde GIS web no aplica igual y se usaría un plugin nativo
  // en su lugar). En navegador de escritorio/móvil, este flujo es el que
  // fallaba con auth/internal-error cuando Chrome bloquea cookies de
  // terceros en localhost; por eso se reemplazó por signInWithGoogleAccessToken.
  async loginWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    await runInInjectionContext(this.injector, () =>
      signInWithRedirect(this.auth, provider)
    );
    // La página se recarga aquí; el resultado se obtiene después con
    // getGoogleRedirectResult() (normalmente llamado en ngOnInit del login).
  }

  // 🔵 Recoge el resultado tras volver del redirect de Google (legado, ver nota arriba)
  async getGoogleRedirectResult(): Promise<UserCredential | null> {
    try {
      const result = await runInInjectionContext(this.injector, () =>
        getRedirectResult(this.auth)
      );
      return result;
    } catch (error: any) {
      console.error('AUTH REDIRECT ERROR');
      console.error('CODE:', error?.code);
      console.error('MESSAGE:', error?.message);
      console.error(error);
      throw error;
    }
  }

  getAuthConfigStatus() {
    return {
      authDomain: environment.firebase.authDomain,
      expectedAuthorizedDomains: environment.authAuthorizedDomains
    };
  }

  // 🔐 RESET PASSWORD
  async resetPassword(email: string) {
    return await sendPasswordResetEmail(
      this.auth,
      email
    );
  }

  // 🚪 LOGOUT
  logout() {
    return signOut(this.auth);
  }

  // 👤 USUARIO ACTUAL
  getCurrentUser() {
    return this.auth.currentUser;
  }

  // ✅ OBTENER USUARIO
  getUser(): Promise<User | null> {
    return new Promise((resolve, reject) => {

      const sub = this.authState$.subscribe({
        next: (user) => {
          sub.unsubscribe();
          resolve(user);
        },
        error: reject
      });

    });
  }
}