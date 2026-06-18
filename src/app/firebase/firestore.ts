import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection, collectionData, deleteDoc, doc, getDoc,
  serverTimestamp, setDoc, updateDoc, docData, addDoc,
  query, where, orderBy, CollectionReference,
  arrayUnion, arrayRemove,
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Auth } from '@angular/fire/auth';
import { SecurityService } from 'src/app/services/security.service';

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type Cita = {
  id?: string;
  titulo: string;
  fechaInicio: string;
  fechaFin?: string;
  lugar?: string;
  notas?: string;
  creadoPor: string;
};

export interface Mascota {
  id: string;
  nombre: string;
  especie: string;
  raza: string;
  sexo: string;
  color?: string;
  castrado?: 'Sí' | 'No';
  edad?: number;
  fechaNacimiento?: string;
  fechaRegistro?: string;
  date?: any;
  uidUsuario: string;
  fotoUrl?: string;
  galeria?: string[];
  numeroChip?: string;
  peso?: number;
  indicadores?: string[];
}

export type Vacuna = {
  id?: string;
  tipo: string;
  fechaAplicacion: string;
  notas?: string;
  creadoPor: string;
  proximaFecha?: string;
};

export type Examen = {
  id?: string;
  tipo: string;
  fechaProgramada?: string;
  realizado?: boolean;
  fechaRealizado?: string;
  lugar?: string;
  costo?: number;
  notas?: string;
  ordenUrl?: string;
  resultadoUrl?: string;
  creadoPor: string;
};

export type Medicamento = {
  id?: string;
  nombre: string;
  mg: number;
  fechaInicio: string;
  fechaFin?: string;
  costo?: number;
  notas?: string;
  creadoPor: string;
};

export type VeterinariaFavorita = {
  id?: string;
  placeId: string;
  nombre: string;
  direccion: string;
  lat: number;
  lng: number;
  rating?: number;
  tipos?: string[];
  uidUsuario: string;
  fechaRegistro?: string;
};

// Nuevo tipo para documentos PDF adjuntos a la mascota
export type DocumentoMascota = {
  id?: string;
  nombre: string;       // nombre descriptivo
  tipo: string;         // 'historial' | 'vacunas' | 'examen' | 'otro'
  url: string;          // URL de descarga en Storage
  storagePath: string;  // ruta en Storage (para borrado)
  fechaSubida: string;
  creadoPor: string;
  tamanioBytes?: number;
};

// ── Servicio ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class FirestoreService {

  private firestore: Firestore  = inject(Firestore);
  private storage:   Storage    = inject(Storage);
  private auth:      Auth       = inject(Auth);
  private security:  SecurityService = inject(SecurityService);

  // ── Genéricos ───────────────────────────────────────────────────────────────

  getCollectionChanges<T>(path: string): Observable<T[]> {
    return collectionData(collection(this.firestore, path)) as Observable<T[]>;
  }

  async createDocument<T>(path: string, data: T, id = ''): Promise<string> {
    this.assertOwnershipForWrite(path, data as any);
    const refDoc = id
      ? doc(this.firestore, `${path}/${id}`)
      : doc(collection(this.firestore, path));

    const dataDoc: any = this.security.sanitizeFirestoreObject((data as any) ?? {});
    dataDoc.id   = refDoc.id;
    dataDoc.date = serverTimestamp();
    await setDoc(refDoc, dataDoc);
    return dataDoc.id;
  }

  createId(): string {
    return uuidv4();
  }

  async deleteDocumentID(path: string, idDoc: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `${path}/${idDoc}`));
  }

  getDocumentChanges<T>(path: string): Observable<T> {
    return docData(doc(this.firestore, path)) as Observable<T>;
  }

  async updateDocument(path: string, data: any): Promise<void> {
    this.assertOwnershipForWrite(path, data);
    const payload = this.security.sanitizeFirestoreObject(data ?? {});
    payload['updatedAt'] = serverTimestamp();
    await updateDoc(doc(this.firestore, path), payload);
  }

  async getDocument(path: string): Promise<any | null> {
    const snap = await getDoc(doc(this.firestore, path));
    return snap.exists() ? snap.data() : null;
  }

  // ── Mascotas ─────────────────────────────────────────────────────────────────

  getUserPets(uid: string): Observable<Mascota[]> {
    const r = collection(this.firestore, 'mascotas') as CollectionReference<Mascota>;
    const q = query(r, where('uidUsuario', '==', uid), orderBy('date', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Mascota[]>;
  }

  getPetById(id: string): Observable<Mascota | undefined> {
    return docData(doc(this.firestore, 'mascotas', id), { idField: 'id' }) as Observable<Mascota | undefined>;
  }

  async updatePet(id: string, data: Partial<Mascota>): Promise<void> {
    const uid = this.assertAuthenticated();
    // Verificamos ownership antes de escribir
    const existing = await this.getDocument(`mascotas/${id}`);
    if (!existing || existing.uidUsuario !== uid) {
      throw new Error('No autorizado para editar esta mascota.');
    }
    const clean = this.security.sanitizeFirestoreObject(data as any);
    // Asegurar que uidUsuario no se puede cambiar
    delete clean['uidUsuario'];
    clean['updatedAt'] = serverTimestamp();
    await updateDoc(doc(this.firestore, 'mascotas', id), clean);
  }

  async uploadPetPhoto(uid: string, petId: string, file: File): Promise<string> {
    this.assertAuthenticated();
    const path = `mascotas/${uid}/${petId}/foto/${Date.now()}-${this.sanitizeFilename(file.name)}`;
    const r = ref(this.storage, path);
    await uploadBytes(r, file);
    return getDownloadURL(r);
  }

  async uploadPetPhotos(uid: string, petId: string, files: File[]): Promise<string[]> {
    const urls: string[] = [];
    for (const f of files) {
      const path = `mascotas/${uid}/${petId}/galeria/${Date.now()}-${this.sanitizeFilename(f.name)}`;
      const r = ref(this.storage, path);
      await uploadBytes(r, f);
      urls.push(await getDownloadURL(r));
    }
    return urls;
  }

  async appendPhotos(petId: string, urls: string[]): Promise<void> {
    const refDoc = doc(this.firestore, 'mascotas', petId);
    await updateDoc(refDoc, { galeria: arrayUnion(...urls) } as any);
  }

  async removePhoto(petId: string, url: string): Promise<void> {
    const refDoc = doc(this.firestore, 'mascotas', petId);
    await updateDoc(refDoc, { galeria: arrayRemove(url) } as any);
  }

  async deletePhotoFromStorage(url: string): Promise<void> {
    await deleteObject(ref(this.storage, url));
  }

  // ── Citas ─────────────────────────────────────────────────────────────────────

  getCitasByMascota(petId: string): Observable<Cita[]> {
    const r = collection(this.firestore, `mascotas/${petId}/citas`);
    const q = query(r, orderBy('fechaInicio', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Cita[]>;
  }

  async addCita(petId: string, data: Cita): Promise<any> {
    const clean = this.security.sanitizeFirestoreObject(data as any);
    return addDoc(collection(this.firestore, `mascotas/${petId}/citas`), clean);
  }

  async updateCita(petId: string, citaId: string, data: Partial<Cita>): Promise<void> {
    const clean = this.security.sanitizeFirestoreObject(data as any);
    await updateDoc(doc(this.firestore, `mascotas/${petId}/citas/${citaId}`), clean);
  }

  async deleteCita(petId: string, citaId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `mascotas/${petId}/citas/${citaId}`));
  }

  // ── Vacunas ───────────────────────────────────────────────────────────────────

  getVacunasByMascota(petId: string): Observable<Vacuna[]> {
    const r = collection(this.firestore, `mascotas/${petId}/vacunas`);
    const q = query(r, orderBy('fechaAplicacion', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Vacuna[]>;
  }

  async addVacuna(petId: string, data: Vacuna): Promise<any> {
    const clean = this.security.sanitizeFirestoreObject(data as any);
    return addDoc(collection(this.firestore, `mascotas/${petId}/vacunas`), clean);
  }

  async updateVacuna(petId: string, vacunaId: string, data: Partial<Vacuna>): Promise<void> {
    const clean = this.security.sanitizeFirestoreObject(data as any);
    await updateDoc(doc(this.firestore, `mascotas/${petId}/vacunas/${vacunaId}`), clean);
  }

  async deleteVacuna(petId: string, vacunaId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `mascotas/${petId}/vacunas/${vacunaId}`));
  }

  // ── Exámenes ──────────────────────────────────────────────────────────────────

  getExamenesByMascota(petId: string): Observable<Examen[]> {
    const r = collection(this.firestore, `mascotas/${petId}/examenes`);
    const q = query(r, orderBy('fechaProgramada', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Examen[]>;
  }

  async addExamen(petId: string, data: Examen): Promise<any> {
    const clean = this.security.sanitizeFirestoreObject(data as any);
    return addDoc(collection(this.firestore, `mascotas/${petId}/examenes`), clean);
  }

  async updateExamen(petId: string, examenId: string, data: Partial<Examen>): Promise<void> {
    const clean = this.security.sanitizeFirestoreObject(data as any);
    await updateDoc(doc(this.firestore, `mascotas/${petId}/examenes/${examenId}`), clean);
  }

  async deleteExamen(petId: string, examenId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `mascotas/${petId}/examenes/${examenId}`));
  }

  async uploadExamenFile(
    uid: string, petId: string, examenId: string,
    file: File, kind: 'orden' | 'resultado'
  ): Promise<string> {
    const path = `mascotas/${uid}/${petId}/examenes/${examenId}/${kind}-${Date.now()}-${this.sanitizeFilename(file.name)}`;
    const r = ref(this.storage, path);
    await uploadBytes(r, file);
    return getDownloadURL(r);
  }

  async removeExamenFileByUrl(url: string): Promise<void> {
    await deleteObject(ref(this.storage, url));
  }

  // ── Medicamentos ──────────────────────────────────────────────────────────────

  getMedicamentosByMascota(petId: string): Observable<Medicamento[]> {
    const r = collection(this.firestore, `mascotas/${petId}/medicamentos`);
    const q = query(r, orderBy('fechaInicio', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Medicamento[]>;
  }

  async addMedicamento(petId: string, data: Medicamento): Promise<any> {
    const clean = this.security.sanitizeFirestoreObject(data as any);
    return addDoc(collection(this.firestore, `mascotas/${petId}/medicamentos`), clean);
  }

  async updateMedicamento(petId: string, medId: string, data: Partial<Medicamento>): Promise<void> {
    const clean = this.security.sanitizeFirestoreObject(data as any);
    await updateDoc(doc(this.firestore, `mascotas/${petId}/medicamentos/${medId}`), clean);
  }

  async deleteMedicamento(petId: string, medId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `mascotas/${petId}/medicamentos/${medId}`));
  }

  // ── Documentos PDF ────────────────────────────────────────────────────────────

  getDocumentosByMascota(petId: string): Observable<DocumentoMascota[]> {
    const r = collection(this.firestore, `mascotas/${petId}/documentos`);
    const q = query(r, orderBy('fechaSubida', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<DocumentoMascota[]>;
  }

  async uploadDocumento(
    uid: string, petId: string, file: File,
    meta: { nombre: string; tipo: string }
  ): Promise<DocumentoMascota> {
    this.assertAuthenticated();
    const safeFilename  = this.sanitizeFilename(file.name);
    const storagePath   = `mascotas/${uid}/${petId}/documentos/${Date.now()}-${safeFilename}`;
    const storageRef    = ref(this.storage, storagePath);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    const docData: DocumentoMascota = {
      nombre:       this.security.sanitizeText(meta.nombre, 200),
      tipo:         this.security.sanitizeText(meta.tipo, 50),
      url,
      storagePath,
      fechaSubida:  new Date().toISOString(),
      creadoPor:    uid,
      tamanioBytes: file.size,
    };

    const ref2 = await addDoc(
      collection(this.firestore, `mascotas/${petId}/documentos`),
      this.security.sanitizeFirestoreObject(docData as any)
    );
    return { ...docData, id: ref2.id };
  }

  async deleteDocumento(petId: string, docId: string, storagePath: string): Promise<void> {
    await Promise.all([
      deleteDoc(doc(this.firestore, `mascotas/${petId}/documentos/${docId}`)),
      deleteObject(ref(this.storage, storagePath)).catch(() => { /* ya borrado */ }),
    ]);
  }

  // ── Veterinarias favoritas ─────────────────────────────────────────────────

  getVeterinariasFavoritasByUsuario(uid: string): Observable<VeterinariaFavorita[]> {
    const r = collection(this.firestore, `usuarios/${uid}/veterinariasFavoritas`);
    const q = query(r, orderBy('fechaRegistro', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<VeterinariaFavorita[]>;
  }

  async addVeterinariaFavorita(
    uid: string,
    data: Omit<VeterinariaFavorita, 'id' | 'uidUsuario' | 'fechaRegistro'>
  ): Promise<any> {
    const payload: VeterinariaFavorita = {
      ...data,
      uidUsuario:    uid,
      fechaRegistro: new Date().toISOString(),
    };
    return addDoc(
      collection(this.firestore, `usuarios/${uid}/veterinariasFavoritas`),
      this.security.sanitizeFirestoreObject(payload as any)
    );
  }

  async updateVeterinariaFavorita(uid: string, vetId: string, data: Partial<VeterinariaFavorita>): Promise<void> {
    const clean = this.security.sanitizeFirestoreObject(data as any);
    await updateDoc(doc(this.firestore, `usuarios/${uid}/veterinariasFavoritas/${vetId}`), clean);
  }

  async deleteVeterinariaFavorita(uid: string, vetId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `usuarios/${uid}/veterinariasFavoritas/${vetId}`));
  }

  // ── Lugares públicos (caché mapa) ──────────────────────────────────────────

  async getLugaresInfo(placeIds: string[]): Promise<Record<string, any>> {
    const result: Record<string, any> = {};
    if (!placeIds.length) return result;

    const chunks: string[][] = [];
    for (let i = 0; i < placeIds.length; i += 10) {
      chunks.push(placeIds.slice(i, i + 10));
    }

    await Promise.all(
      chunks.map(chunk =>
        Promise.all(
          chunk.map(async id => {
            const snap = await getDoc(doc(this.firestore, `lugares/${id}`));
            if (snap.exists()) result[id] = snap.data();
          })
        )
      )
    );
    return result;
  }

  async saveLugarInfo(placeId: string, info: any): Promise<void> {
    const clean = this.security.sanitizeFirestoreObject(info ?? {});
    await setDoc(
      doc(this.firestore, `lugares/${placeId}`),
      { ...clean, actualizadoEn: serverTimestamp() },
      { merge: true }
    );
  }

  // ── Foto de perfil de usuario ──────────────────────────────────────────────

  async uploadProfilePhoto(uid: string, file: File): Promise<string> {
    this.assertAuthenticated();
    const safeFilename = this.sanitizeFilename(file.name);
    const path = `usuarios/${uid}/foto/${Date.now()}-${safeFilename}`;
    const r = ref(this.storage, path);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    // Guardamos la URL en el perfil del usuario, marcando que ahora el origen es una foto propia
    await updateDoc(doc(this.firestore, `usuarios/${uid}`), { foto: url, fotoOrigen: 'custom', updatedAt: serverTimestamp() });
    return url;
  }

  // ── Privados ───────────────────────────────────────────────────────────────

  private assertAuthenticated(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Usuario no autenticado');
    return uid;
  }

  private assertOwnershipForWrite(path: string, data: any): void {
    const uid = this.assertAuthenticated();

    if (path === 'usuarios') {
      if (data?.uid && data.uid !== uid) throw new Error('No autorizado');
      return;
    }
    if (path.startsWith('usuarios/')) {
      const targetUid = path.split('/')[1];
      if (targetUid !== uid) throw new Error('No autorizado');
      return;
    }
    if (path === 'mascotas') {
      if (data?.uidUsuario && data.uidUsuario !== uid) throw new Error('No autorizado');
    }
  }

  /** Elimina caracteres peligrosos en nombres de archivo */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.\-_]/g, '_')
      .replace(/\.{2,}/g, '.')  // evita path traversal con ..
      .slice(0, 100);
  }
}