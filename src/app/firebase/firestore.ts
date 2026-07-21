import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection, collectionData, collectionGroup, deleteDoc, doc, getDoc, getDocs,
  serverTimestamp, setDoc, updateDoc, docData, addDoc,
  query, where, orderBy, limit, CollectionReference, Timestamp,
  arrayUnion, arrayRemove,
} from '@angular/fire/firestore';
import { Storage, ref, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Observable, catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Auth } from '@angular/fire/auth';
import { SecurityService } from 'src/app/services/security.service';
import { Models } from '../models/models';

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

export type Mascota = Models.Mascotas.Mascota;

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

  /**
   * Mascotas cuyo dueño legal es exactamente uid (sin sumar mascotas de
   * otros refugios ni de hogar temporal). Pública para poder mostrar el
   * panel de UN refugio puntual (ver refugio-panel.component.ts), a
   * diferencia de getUserPets que mezcla todo lo que ve el usuario logueado.
   */
  getUserPetsPropios(uid: string): Observable<Mascota[]> {
    const r = collection(this.firestore, 'mascotas') as CollectionReference<Mascota>;
    const q = query(r, where('uidUsuario', '==', uid), orderBy('date', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Mascota[]>;
  }

  /**
   * Mascotas propias, más las de cualquier refugio del que uid sea parte
   * del equipo (mismas que ve el dueño original, sin duplicar entre sí).
   */
  getUserPets(uid: string): Observable<Mascota[]> {
    return this.getMisRefugios(uid).pipe(
      switchMap(refugioUids => {
        if (!refugioUids.length) return this.getUserPetsPropios(uid);
        const fuentes = [uid, ...refugioUids].map(u => this.getUserPetsPropios(u));
        return combineLatest(fuentes).pipe(
          map(listas => {
            const porId = new Map<string, Mascota>();
            listas.forEach(lista => lista.forEach(m => porId.set(m.id, m)));
            return Array.from(porId.values());
          })
        );
      })
    );
  }

  /**
   * uids de los refugios de cuyo equipo uid forma parte. Si la consulta
   * falla (por ejemplo, el índice de collectionGroup todavía no terminó de
   * desplegarse), no debe tumbar el resto de la carga de mascotas: se
   * degrada a "no soy miembro de ningún equipo" en vez de romper la
   * pantalla entera.
   */
  getMisRefugios(uid: string): Observable<string[]> {
    const r = collectionGroup(this.firestore, Models.Equipo.PathMiembros);
    const q = query(r, where('uid', '==', uid));
    return collectionData(q).pipe(
      map(docs => (docs as Models.Equipo.MiembroEquipo[]).map(d => d.refugioUid)),
      catchError(err => {
        console.error('getMisRefugios falló, sigo solo con mascotas propias:', err);
        return of<string[]>([]);
      })
    );
  }

  /**
   * Mascotas donde uid es colaborador de hogar temporal (aceptó una
   * Transferencia tipo 'hogar_temporal'): acceso compartido sin ser el
   * dueño legal. Separadas de getUserPets a propósito, para que la UI
   * pueda mostrarlas aparte de las mascotas propias/del refugio.
   */
  getMascotasHogarTemporal(uid: string): Observable<Mascota[]> {
    const r = collectionGroup(this.firestore, 'colaboradores');
    const q = query(r, where('uid', '==', uid));
    return collectionData(q).pipe(
      switchMap(docs => {
        const ids = Array.from(new Set(
          (docs as Models.Mascotas.ColaboradorMascota[])
            .map(d => d.mascotaId)
            .filter((id): id is string => !!id)
        ));
        if (!ids.length) return of<Mascota[]>([]);
        return combineLatest(ids.map(id => this.getPetById(id))).pipe(
          map(list => list.filter((m): m is Mascota => !!m))
        );
      }),
      catchError(err => {
        console.error('getMascotasHogarTemporal falló:', err);
        return of<Mascota[]>([]);
      })
    );
  }

  /**
   * ¿Esta mascota ya tiene un hogar temporal activo (algún colaborador)?
   * Una mascota solo puede estar en UN hogar temporal a la vez — se usa
   * para avisar antes de mandar una nueva solicitud, aunque el chequeo
   * real que no se puede saltear vive en la Cloud Function
   * aceptarTransferencia (esto es solo para dar feedback temprano en la UI).
   */
  async hayHogarTemporalActivo(petId: string): Promise<boolean> {
    const snap = await getDocs(
      query(collection(this.firestore, `mascotas/${petId}/colaboradores`), limit(1))
    );
    return !snap.empty;
  }

  /** Quién tiene hogar temporal activo de esta mascota ahora mismo (para
   *  mostrarlo y poder revocarlo desde el refugio). */
  getColaboradoresMascota(petId: string): Observable<Models.Mascotas.ColaboradorMascota[]> {
    const r = collection(this.firestore, `mascotas/${petId}/colaboradores`);
    return collectionData(r) as Observable<Models.Mascotas.ColaboradorMascota[]>;
  }

  /** El refugio (dueño/equipo) le quita a alguien el acceso de hogar
   *  temporal directamente, sin esperar a que se vaya solo. */
  async quitarColaboradorMascota(petId: string, colabUid: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `mascotas/${petId}/colaboradores/${colabUid}`));
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

  // ── Historial médico (append-only) y acceso veterinario por PIN ─────────────
  // Lo que ve un veterinario como "historial médico" combina las secciones
  // estructuradas de arriba (vacunas/exámenes/medicamentos/citas, de solo
  // lectura para él) con esta bitácora de notas de consulta, que sí puede
  // escribir. Todo append-only: ver Models.HistorialMedico.

  /** Genera (o regenera) el PIN de 6 dígitos de esta mascota. Regenerarlo
   *  invalida el PIN anterior para otorgar accesos NUEVOS, pero no revoca
   *  los que ya se otorgaron — eso se hace aparte con revocarAccesoVeterinario. */
  async regenerarPinMascota(petId: string): Promise<string> {
    this.assertAuthenticated();
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const pin = String(100000 + (buf[0] % 900000));
    await updateDoc(doc(this.firestore, 'mascotas', petId), {
      pinHistorial: pin,
      updatedAt: serverTimestamp(),
    });
    return pin;
  }

  getAccesosVeterinario(petId: string): Observable<Models.Mascotas.AccesoVeterinario[]> {
    const r = collection(this.firestore, `mascotas/${petId}/accesosVeterinario`);
    const q = query(r, orderBy('otorgadoEn', 'desc'));
    return collectionData(q) as Observable<Models.Mascotas.AccesoVeterinario[]>;
  }

  async revocarAccesoVeterinario(petId: string, vetUid: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `mascotas/${petId}/accesosVeterinario/${vetUid}`));
  }

  /**
   * Mascotas donde tengo (como veterinario) acceso otorgado por PIN. Si la
   * consulta falla (índice de collectionGroup aún propagándose), se degrada
   * a lista vacía en vez de romper el panel del veterinario.
   */
  getMisPacientesVeterinario(vetUid: string): Observable<Models.Mascotas.AccesoVeterinario[]> {
    const r = collectionGroup(this.firestore, 'accesosVeterinario');
    const q = query(r, where('vetUid', '==', vetUid));
    return collectionData(q).pipe(
      map(docs => docs as Models.Mascotas.AccesoVeterinario[]),
      catchError(err => {
        console.error('getMisPacientesVeterinario falló:', err);
        return of<Models.Mascotas.AccesoVeterinario[]>([]);
      })
    );
  }

  getHistorialMedico(petId: string): Observable<Models.HistorialMedico.Entrada[]> {
    const r = collection(this.firestore, `mascotas/${petId}/${Models.HistorialMedico.PathEntradas}`);
    const q = query(r, orderBy('createdAt', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Models.HistorialMedico.Entrada[]>;
  }

  async agregarEntradaHistorial(petId: string, texto: string): Promise<void> {
    const uid = this.assertAuthenticated();
    const perfil = await this.getDocument(`usuarios/${uid}`);
    const autorNombre = `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim() || perfil?.email || 'Alguien';
    const payload: Omit<Models.HistorialMedico.Entrada, 'id'> = {
      texto,
      autorUid: uid,
      autorNombre,
      autorRol: (perfil?.rol as Models.Auth.Rol) ?? 'usuario',
      createdAt: serverTimestamp(),
    };
    await addDoc(
      collection(this.firestore, `mascotas/${petId}/${Models.HistorialMedico.PathEntradas}`),
      this.security.sanitizeFirestoreObject(payload as any)
    );
  }

  /**
   * Valida el PIN de una mascota vía la Cloud Function validarPinVeterinario
   * (nunca del lado del cliente: las reglas no dejan leer una mascota ajena
   * para comparar el PIN). Si coincide, el servidor otorga acceso de solo
   * lectura al historial médico y devuelve un resumen de la mascota.
   */
  async validarPinVeterinario(mascotaId: string, pin: string): Promise<{
    id: string; nombre: string; especie: string; raza: string; fotoUrl?: string;
  }> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Usuario no autenticado');
    const token = await user.getIdToken();
    const res = await fetch(
      'https://us-central1-ashbis-ae5b2.cloudfunctions.net/validarPinVeterinario',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mascotaId, pin }),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || 'No se pudo validar el PIN.');
    }
    return body.mascota;
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

  // ── Finanzas del refugio ─────────────────────────────────────────────────────

  getMovimientosFinancieros(refugioUid: string): Observable<Models.Finanzas.Movimiento[]> {
    const r = collection(this.firestore, `usuarios/${refugioUid}/${Models.Finanzas.PathMovimientos}`);
    const q = query(r, orderBy('fecha', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Models.Finanzas.Movimiento[]>;
  }

  async addMovimientoFinanciero(
    refugioUid: string,
    data: Omit<Models.Finanzas.Movimiento, 'id' | 'creadoPor' | 'createdAt'>
  ): Promise<void> {
    const uid = this.assertAuthenticated();
    const payload = {
      ...data,
      creadoPor: uid,
      createdAt: serverTimestamp(),
    };
    await addDoc(
      collection(this.firestore, `usuarios/${refugioUid}/${Models.Finanzas.PathMovimientos}`),
      this.security.sanitizeFirestoreObject(payload as any)
    );
  }

  async deleteMovimientoFinanciero(refugioUid: string, movId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `usuarios/${refugioUid}/${Models.Finanzas.PathMovimientos}/${movId}`));
  }

  // ── Chat de equipo del refugio ───────────────────────────────────────────────

  getMensajesChatEquipo(refugioUid: string): Observable<Models.ChatEquipo.Mensaje[]> {
    const r = collection(this.firestore, `usuarios/${refugioUid}/${Models.ChatEquipo.PathMensajes}`);
    const q = query(r, orderBy('createdAt', 'asc'));
    return collectionData(q, { idField: 'id' }) as Observable<Models.ChatEquipo.Mensaje[]>;
  }

  async enviarMensajeChatEquipo(refugioUid: string, texto: string): Promise<void> {
    const uid = this.assertAuthenticated();
    const perfil = await this.getDocument(`usuarios/${uid}`);
    const autorNombre = `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim() || 'Alguien del equipo';
    const payload: Omit<Models.ChatEquipo.Mensaje, 'id'> = {
      texto,
      autorUid: uid,
      autorNombre,
      createdAt: serverTimestamp(),
    };
    await addDoc(
      collection(this.firestore, `usuarios/${refugioUid}/${Models.ChatEquipo.PathMensajes}`),
      this.security.sanitizeFirestoreObject(payload as any)
    );
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

  /**
   * Mantiene una copia mínima y pública de los datos de contacto del usuario
   * (nombre, apellido, teléfono) en usuarios/{uid}/publico/contacto, separada
   * del documento de perfil completo (que es privado). La usa la ficha
   * pública del carnet de mascota perdida para mostrar a quién contactar
   * sin exponer el email, la dirección o la fecha de nacimiento del dueño.
   */
  async setPublicContact(
    uid: string,
    datos: {
      nombre: string;
      apellido: string;
      telefono?: string;
      contactosEmergencia?: Models.Auth.ContactoEmergencia[];
    }
  ): Promise<void> {
    const { contactosEmergencia, ...resto } = datos;
    const clean = this.security.sanitizeFirestoreObject(resto);
    // sanitizeFirestoreObject() no sanea a fondo un array de objetos (solo
    // strings sueltos), y este doc es de lectura pública, así que cada
    // campo de cada contacto se limpia acá a mano.
    const contactosLimpios = (contactosEmergencia ?? [])
      .slice(0, 2)
      .map(c => ({
        nombre: this.security.sanitizeText(c.nombre ?? '', 60),
        telefono: this.security.sanitizeText(c.telefono ?? '', 20),
      }))
      .filter(c => c.nombre && c.telefono);

    await setDoc(
      doc(this.firestore, `usuarios/${uid}/publico/contacto`),
      { ...clean, contactosEmergencia: contactosLimpios, actualizadoEn: serverTimestamp() },
      { merge: true }
    );
  }

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

  /**
   * Sube el título/certificado de una cuenta veterinaria para verificación
   * manual futura. Se llama justo después de crear el usuario de Auth, antes
   * de que exista el documento en usuarios/{uid} — por eso, a diferencia de
   * uploadProfilePhoto, no intenta actualizar Firestore: el caller mete la
   * URL resultante en el mismo payload con el que crea el perfil.
   */
  async uploadTituloVeterinario(uid: string, file: File): Promise<string> {
    const safeFilename = this.sanitizeFilename(file.name);
    const path = `usuarios/${uid}/titulo/${Date.now()}-${safeFilename}`;
    const r = ref(this.storage, path);
    await uploadBytes(r, file);
    return getDownloadURL(r);
  }

  // ── Publicaciones (refugio: adopción/recolección/donación) ─────────────────

  getPublicacionesActivas(): Observable<Models.Publicaciones.Publicacion[]> {
    const r = collection(this.firestore, Models.Publicaciones.PathPublicaciones);
    const q = query(r, where('activa', '==', true), orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Models.Publicaciones.Publicacion[]>;
  }

  getPublicacionById(id: string): Observable<Models.Publicaciones.Publicacion | undefined> {
    return docData(
      doc(this.firestore, `${Models.Publicaciones.PathPublicaciones}/${id}`),
      { idField: 'id' }
    ) as Observable<Models.Publicaciones.Publicacion | undefined>;
  }

  getPublicacionesByUsuario(uid: string): Observable<Models.Publicaciones.Publicacion[]> {
    const r = collection(this.firestore, Models.Publicaciones.PathPublicaciones);
    const q = query(r, where('uidAutor', '==', uid), orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Models.Publicaciones.Publicacion[]>;
  }

  async uploadPublicacionPhoto(uid: string, file: File): Promise<string> {
    this.assertAuthenticated();
    const safeFilename = this.sanitizeFilename(file.name);
    const path = `publicaciones/${uid}/${Date.now()}-${safeFilename}`;
    const r = ref(this.storage, path);
    await uploadBytes(r, file);
    return getDownloadURL(r);
  }

  async crearPublicacion(
    data: Omit<Models.Publicaciones.Publicacion, 'id' | 'activa' | 'createdAt' | 'updatedAt' | 'expiraEn'>
  ): Promise<string> {
    if (!data.aceptaVeracidad) {
      throw new Error('Falta confirmar que la información publicada es real.');
    }
    // sanitizeFirestoreObject() destruiría un Timestamp real si viajara
    // dentro de "data" (lo trataría como objeto plano a limpiar), así que
    // expiraEn se agrega después, igual que createdAt/updatedAt.
    const clean = this.security.sanitizeFirestoreObject(data as any);
    const treintaDiasMs = 30 * 24 * 60 * 60 * 1000;
    const refDoc = doc(collection(this.firestore, Models.Publicaciones.PathPublicaciones));
    await setDoc(refDoc, {
      ...clean,
      activa: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiraEn: Timestamp.fromMillis(Date.now() + treintaDiasMs),
    });
    return refDoc.id;
  }

  async actualizarPublicacion(id: string, data: Partial<Models.Publicaciones.Publicacion>): Promise<void> {
    const clean = this.security.sanitizeFirestoreObject(data as any);
    clean['updatedAt'] = serverTimestamp();
    await updateDoc(doc(this.firestore, `${Models.Publicaciones.PathPublicaciones}/${id}`), clean);
  }

  async eliminarPublicacion(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `${Models.Publicaciones.PathPublicaciones}/${id}`));
  }

  // ── Transferencias de dueño (adopción) y hogar temporal ─────────────────────
  // Aceptar una transferencia NO se hace desde acá: requiere la Cloud
  // Function aceptarTransferencia. Para 'adopcion' reasigna
  // mascotas/{id}.uidUsuario; para 'hogar_temporal' agrega un colaborador
  // sin cambiar de dueño. Ninguna de las dos cosas se la permiten las
  // reglas de Firestore al cliente directo.

  async crearTransferencia(
    tipo: Models.Transferencias.TipoTransferencia,
    mascotaId: string,
    mascotaNombre: string,
    deUid: string,
    deNombre: string,
    paraEmail: string,
    mensaje?: string
  ): Promise<string> {
    // deUid es el dueño real de la mascota (el refugio), no necesariamente
    // quien ejecuta la acción: puede ser un miembro del equipo operando en
    // nombre del refugio.
    this.assertAuthenticated();

    // Evita mandar la misma solicitud dos veces por accidente: si ya hay
    // una pendiente para esta mascota + este email, no se crea otra —
    // reenviar el aviso a esa misma solicitud se hace con
    // reenviarNotificacionTransferencia, no creando un duplicado.
    //
    // El filtro por deUid es imprescindible para que las reglas de
    // Firestore puedan aprobar esta consulta: las reglas evalúan el
    // conjunto de resultados POTENCIAL de la consulta, no los documentos
    // reales que devuelve — sin deUid como filtro, Firestore no puede
    // garantizar que todo posible resultado cumple
    // puedeOperarComoRefugio(resource.data.deUid) (paraEmail es el email
    // del destinatario, no el propio, así que esa otra rama tampoco sirve),
    // y rechaza la consulta entera con "Missing or insufficient permissions".
    const emailNormalizado = paraEmail.trim().toLowerCase();
    const yaExiste = await getDocs(query(
      collection(this.firestore, Models.Transferencias.PathTransferencias),
      where('deUid', '==', deUid),
      where('mascotaId', '==', mascotaId),
      where('paraEmail', '==', emailNormalizado),
      where('estado', '==', 'pendiente')
    ));
    if (!yaExiste.empty) {
      throw new Error('Ya hay una solicitud pendiente para esta mascota con ese email. Podés reenviarla desde el panel del refugio.');
    }

    const clean = this.security.sanitizeFirestoreObject({
      tipo,
      mascotaId,
      mascotaNombre,
      deUid,
      deNombre,
      paraEmail: paraEmail.trim().toLowerCase(),
      estado: 'pendiente' as const,
      ...(mensaje?.trim() ? { mensaje } : {}),
    });
    const refDoc = doc(collection(this.firestore, Models.Transferencias.PathTransferencias));
    await setDoc(refDoc, { ...clean, createdAt: serverTimestamp() });
    return refDoc.id;
  }

  getTransferenciasEnviadas(uid: string): Observable<Models.Transferencias.Transferencia[]> {
    const r = collection(this.firestore, Models.Transferencias.PathTransferencias);
    const q = query(r, where('deUid', '==', uid), orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Models.Transferencias.Transferencia[]>;
  }

  getTransferenciasPendientesParaMi(email: string): Observable<Models.Transferencias.Transferencia[]> {
    const r = collection(this.firestore, Models.Transferencias.PathTransferencias);
    const q = query(
      r,
      where('paraEmail', '==', email.trim().toLowerCase()),
      where('estado', '==', 'pendiente')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Models.Transferencias.Transferencia[]>;
  }

  async rechazarTransferencia(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, `${Models.Transferencias.PathTransferencias}/${id}`), {
      estado: 'rechazada',
      resueltaEn: serverTimestamp(),
    });
  }

  async cancelarTransferencia(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, `${Models.Transferencias.PathTransferencias}/${id}`), {
      estado: 'cancelada',
      resueltaEn: serverTimestamp(),
    });
  }

  /** Reenvía el aviso (push) de una solicitud que sigue pendiente, sin crear
   *  un duplicado — crearTransferencia ya no deja crear otra mientras esta
   *  siga pendiente. */
  async reenviarNotificacionTransferencia(transferenciaId: string): Promise<void> {
    await this.postToCloudFunction(
      'https://us-central1-ashbis-ae5b2.cloudfunctions.net/reenviarNotificacionTransferencia',
      { transferenciaId }
    );
  }

  // Aceptar NUNCA se hace desde el cliente directo: reasigna uidUsuario o
  // crea un colaborador, y eso solo lo hace esta Cloud Function con el
  // Admin SDK, después de validar que quien acepta es el destinatario real.
  async aceptarTransferencia(transferenciaId: string): Promise<void> {
    await this.postToCloudFunction(
      'https://us-central1-ashbis-ae5b2.cloudfunctions.net/aceptarTransferencia',
      { transferenciaId }
    );
  }

  // Elimina la cuenta y todos los datos asociados. Solo lo puede hacer la
  // Cloud Function (Admin SDK): borra subcolecciones, mascotas, tokens de
  // push, etc. — un borrado directo desde el cliente dejaría huérfanos.
  async eliminarCuenta(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Usuario no autenticado');
    const token = await user.getIdToken();
    const res = await fetch('https://us-central1-ashbis-ae5b2.cloudfunctions.net/eliminarCuenta', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'No se pudo eliminar la cuenta.');
    }
  }

  private async postToCloudFunction(url: string, body: Record<string, string>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Usuario no autenticado');
    const token = await user.getIdToken();
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'No se pudo completar la operación.');
    }
  }

  // ── Equipo de refugio ────────────────────────────────────────────────────────
  // Aceptar una invitación NO se hace desde acá: requiere la Cloud Function
  // aceptarInvitacionEquipo, que crea usuarios/{refugioUid}/miembros/{uid}
  // después de validar que quien acepta es el destinatario real.

  async crearInvitacionEquipo(
    refugioUid: string,
    refugioNombre: string,
    paraEmail: string,
    rolEquipo: Models.Equipo.RolEquipo
  ): Promise<string> {
    this.assertAuthenticated();
    const clean = this.security.sanitizeFirestoreObject({
      refugioUid,
      refugioNombre,
      paraEmail: paraEmail.trim().toLowerCase(),
      rolEquipo,
      estado: 'pendiente' as const,
    });
    const refDoc = doc(collection(this.firestore, Models.Equipo.PathInvitaciones));
    await setDoc(refDoc, { ...clean, createdAt: serverTimestamp() });
    return refDoc.id;
  }

  getInvitacionesEquipoEnviadas(refugioUid: string): Observable<Models.Equipo.InvitacionEquipo[]> {
    const r = collection(this.firestore, Models.Equipo.PathInvitaciones);
    const q = query(r, where('refugioUid', '==', refugioUid), orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Models.Equipo.InvitacionEquipo[]>;
  }

  getInvitacionesEquipoPendientesParaMi(email: string): Observable<Models.Equipo.InvitacionEquipo[]> {
    const r = collection(this.firestore, Models.Equipo.PathInvitaciones);
    const q = query(
      r,
      where('paraEmail', '==', email.trim().toLowerCase()),
      where('estado', '==', 'pendiente')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Models.Equipo.InvitacionEquipo[]>;
  }

  async rechazarInvitacionEquipo(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, `${Models.Equipo.PathInvitaciones}/${id}`), {
      estado: 'rechazada',
      resueltaEn: serverTimestamp(),
    });
  }

  async cancelarInvitacionEquipo(id: string): Promise<void> {
    await updateDoc(doc(this.firestore, `${Models.Equipo.PathInvitaciones}/${id}`), {
      estado: 'cancelada',
      resueltaEn: serverTimestamp(),
    });
  }

  // Aceptar NUNCA se hace desde el cliente directo: crea
  // usuarios/{refugioUid}/miembros/{uid}, y eso solo lo hace esta Cloud
  // Function con el Admin SDK, después de validar la invitación por email.
  async aceptarInvitacionEquipo(invitacionId: string): Promise<void> {
    await this.postToCloudFunction(
      'https://us-central1-ashbis-ae5b2.cloudfunctions.net/aceptarInvitacionEquipo',
      { invitacionId }
    );
  }

  getMiembrosEquipo(refugioUid: string): Observable<Models.Equipo.MiembroEquipo[]> {
    const r = collection(this.firestore, `usuarios/${refugioUid}/${Models.Equipo.PathMiembros}`);
    return collectionData(r) as Observable<Models.Equipo.MiembroEquipo[]>;
  }

  /** El dueño/admin saca a alguien, o un miembro se va solo (memberUid === su propio uid). */
  async quitarMiembroEquipo(refugioUid: string, memberUid: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `usuarios/${refugioUid}/${Models.Equipo.PathMiembros}/${memberUid}`));
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