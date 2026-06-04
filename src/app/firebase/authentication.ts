import { Injectable, inject } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  user
} from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { User } from 'firebase/auth';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {

  private auth = inject(Auth);

  // ✅ forma correcta (sin conflictos con Angular signals)
  authState$: Observable<User | null> = user(this.auth);

  constructor() {}

  // ✅ REGISTRO
  async createUser(email: string, password: string) {
    return await createUserWithEmailAndPassword(this.auth, email, password);
  }

  // ✅ LOGIN EMAIL
  async login(email: string, password: string) {
    return await signInWithEmailAndPassword(this.auth, email, password);
  }

  // 🔵 LOGIN GOOGLE
  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return await signInWithPopup(this.auth, provider);
  }

  getAuthConfigStatus() {
    return {
      authDomain: environment.firebase.authDomain,
      expectedAuthorizedDomains: environment.authAuthorizedDomains
    };
  }

  // 🔐 RESET PASSWORD
  async resetPassword(email: string) {
    return await sendPasswordResetEmail(this.auth, email);
  }

  // 🚪 LOGOUT
  logout() {
    return signOut(this.auth);
  }

  // 👤 USUARIO ACTUAL
  getCurrentUser() {
    return this.auth.currentUser;
  }

  // ✅ obtener usuario una vez
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
