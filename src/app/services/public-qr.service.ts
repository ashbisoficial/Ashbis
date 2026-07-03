import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root'
})
export class PublicQrService {

  private firestore = inject(Firestore);

  generateToken(): string {
    return crypto.randomUUID().replace(/-/g, '');
  }

  async createQrToken(
    mascotaId: string,
    ownerId: string,
    tipo: 'carnet' | 'perdida',
    token: string
  ): Promise<void> {

    await setDoc(
      doc(this.firestore, `public_qr/${tipo}/tokens/${token}`),
      {
        mascotaId,
        ownerId,
        tipo,
        activa: true,
        createdAt: serverTimestamp()
      }
    );
  }

  async getQrToken(
  tipo: 'carnet' | 'perdida',
  token: string
): Promise<any | null> {

  const path =
    `public_qr/${tipo}/tokens/${token}`;


  const snap = await getDoc(
    doc(this.firestore, path)
  );


  if (snap.exists()) {
  }

  return snap.exists()
    ? snap.data()
    : null;
}
}