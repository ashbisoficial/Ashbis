import { Injectable, inject, Injector, runInInjectionContext } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
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

  // 🔵 LOGIN GOOGLE (REDIRECT)
  // Usamos redirect en vez de popup: signInWithPopup tiene un bug intermitente
  // (auth/internal-error en el manejo del iframe de gapi) en varios proyectos.
  // El flujo de redirect recarga la página y el resultado se recoge con
  // getGoogleRedirectResult() al volver.
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

  // 🔵 Recoge el resultado tras volver del redirect de Google
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