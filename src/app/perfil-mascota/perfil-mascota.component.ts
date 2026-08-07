import { Component, ElementRef, ViewChild, inject, signal, OnDestroy } from '@angular/core';
import { NgIf, NgFor, TitleCasePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
  IonContent, IonGrid, IonRow, IonCol,
  IonItem, IonLabel, IonButton, IonIcon, IonAvatar, IonList, IonSkeletonText,
  IonCard, IonCardContent,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline, checkmarkCircleOutline, keyOutline, chevronForwardOutline,
  createOutline, timeOutline, qrCodeOutline, pawOutline, homeOutline, megaphoneOutline,
  peopleOutline
} from 'ionicons/icons';
import { FirestoreService, Mascota } from '../firebase/firestore';
import { VeterinariaFavorita } from 'src/app/firebase/firestore';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { SecurityService } from 'src/app/services/security.service';
import { PreferenciasService } from 'src/app/services/preferencias.service';
import { PublicQrService } from 'src/app/services/public-qr.service';
import { QrDecodeService } from 'src/app/services/qr-decode.service';
import { Models } from '../models/models';

@Component({
  selector: 'app-mascota-perfil',
  standalone: true,
  imports: [
    NgIf, NgFor,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
    IonContent, IonGrid, IonRow, IonCol,
    IonItem, IonLabel, IonButton, IonIcon, IonAvatar, IonList, IonSkeletonText,
    IonCard, IonCardContent
  ],
  templateUrl: './perfil-mascota.component.html',
  styleUrls: ['./perfil-mascota.component.scss']
})
export class MascotaPerfilComponent implements OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fs = inject(FirestoreService);
  private destroy$ = new Subject<void>();
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private security = inject(SecurityService);
  private preferencias = inject(PreferenciasService);
  private publicQrSvc = inject(PublicQrService);
  private qrDecodeSvc = inject(QrDecodeService);

  veterinariasFavoritas: VeterinariaFavorita[] = [];
  private auth = inject(AuthenticationService);

  mascota = signal<Mascota | null>(null);
  loading = signal(true);
  /** true si el usuario actual es dueño de esta mascota (directo, o vía equipo de un refugio). */
  puedeTransferir = signal(false);
  /** true si puede publicarla en adopción en el feed público: solo la
   *  cuenta que figura como dueña real de la mascota (mascotas/{id}.uidUsuario),
   *  sea cual sea su rol — a diferencia de puedeTransferir, no requiere que
   *  la cuenta sea de rol 'refugio'. El equipo de un refugio NO puede
   *  usarlo (las reglas de "publicaciones" exigen que uidAutor sea quien
   *  ejecuta la acción, igual que "Mis Publicaciones"). */
  puedePublicarAdopcion = signal(false);
  publicandoAdopcion = false;
  actualizandoEstado = false;

  // ── Escanear QR de cuenta (evita tipear el email a mano) ─────────────────
  @ViewChild('qrInput') private qrInputRef?: ElementRef<HTMLInputElement>;
  escaneandoQr = false;
  private tipoEscaneoPendiente: 'adopcion' | 'hogar_temporal' | 'co_dueno' | null = null;

  private miUid: string | null = null;
  private misRefugios: string[] = [];
  private miRolEsRefugio = false;

  /** true si soy dueño/a directo O ya soy co-dueño/a de esta mascota — a
   *  diferencia de puedeTransferir (dar en adopción/hogar temporal), esto
   *  NO requiere rol 'refugio': cualquier cuenta común puede compartir su
   *  mascota con hasta 2 co-dueños más. */
  puedeGestionarCoDuenos = signal(false);
  private soyCoDuenoActual = false;

  constructor() {
    addIcons({
      alertCircleOutline, checkmarkCircleOutline, keyOutline, chevronForwardOutline,
      createOutline, timeOutline, qrCodeOutline, pawOutline, homeOutline, megaphoneOutline,
      peopleOutline
    });

    // 1) intenta tomar desde router state (rápido)
    const st = this.router.getCurrentNavigation()?.extras?.state as { mascota?: Mascota } | undefined;
    if (st?.mascota) {
      this.mascota.set(st.mascota);
      this.loading.set(false);
    }

    // 2) lee por :id (fuente de verdad) — es un stream vivo de Firestore, hay
    // que cortarlo al salir de la pantalla o queda escuchando para siempre.
    const id = this.route.snapshot.paramMap.get('id')!;
    this.fs.getPetById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe((doc) => {
        if (doc) this.mascota.set(doc);
        this.loading.set(false);
        this.actualizarPuedeTransferir();
      });

    this.fs.getColaboradoresMascota(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(colabs => {
        this.soyCoDuenoActual = !!this.miUid && colabs.some(c => c.uid === this.miUid && c.tipo === 'co_dueno');
        this.actualizarPuedeTransferir();
      });

    // Transferir (dar en adopción / hogar temporal) requiere: ser el dueño
    // legal de la mascota (directo, o vía equipo de un refugio) Y que esa
    // cuenta dueña sea de rol 'refugio' — las reglas de Firestore exigen
    // esCuentaRefugio(deUid), así que ocultamos el botón si de todos modos
    // el backend lo va a rechazar. Un colaborador de hogar temporal, por
    // ejemplo, NO puede volver a transferirla — no es su dueño.
    this.miUid = this.auth.getCurrentUser()?.uid ?? null;
    if (this.miUid) {
      this.fs.getDocument(`usuarios/${this.miUid}`).then(perfil => {
        this.miRolEsRefugio = perfil?.rol === 'refugio';
        this.actualizarPuedeTransferir();
      });
      this.fs.getMisRefugios(this.miUid)
        .pipe(takeUntil(this.destroy$))
        .subscribe(refugioUids => {
          this.misRefugios = refugioUids;
          this.actualizarPuedeTransferir();
        });
    }
  }

  private actualizarPuedeTransferir(): void {
    const m = this.mascota();
    if (!m || !this.miUid) {
      this.puedeTransferir.set(false);
      this.puedePublicarAdopcion.set(false);
      this.puedeGestionarCoDuenos.set(false);
      return;
    }
    const esDuenoDirecto = m.uidUsuario === this.miUid;
    const esEquipoDelRefugioDueno = this.misRefugios.includes(m.uidUsuario);
    this.puedeTransferir.set((esDuenoDirecto && this.miRolEsRefugio) || esEquipoDelRefugioDueno);
    this.puedePublicarAdopcion.set(esDuenoDirecto);
    this.puedeGestionarCoDuenos.set(esDuenoDirecto || this.soyCoDuenoActual);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get avatar(): string {
    return this.mascota()?.fotoUrl || 'assets/img/logo_ashbis.jpeg';
  }

  // Acciones (placeholders)
editarPerfil() {
  const id = this.mascota()?.id;
  if (id) {
    this.router.navigate(['/tabs/mascota-editar', id, 'editar']);
  }
}
  async verHistorial(): Promise<void> {
    const m = this.mascota();
    if (!m?.id) return;

    // La ruta /carnet/:id espera el TOKEN del QR (public_qr/carnet/tokens/{token}),
    // no el id del documento de la mascota — son cosas distintas. Casi
    // siempre ya existe (se crea al dar de alta la mascota); esto es solo
    // el resguardo para mascotas viejas que no lo tengan todavía.
    let token = m.qrCarnetToken;
    if (!token) {
      const uid = this.auth.getCurrentUser()?.uid;
      if (!uid) return;
      try {
        token = this.publicQrSvc.generateToken();
        await this.publicQrSvc.createQrToken(m.id, uid, 'carnet', token);
        await this.fs.updatePet(m.id, { qrCarnetToken: token });
      } catch {
        await this.presentToast('No se pudo abrir el carnet. Intenta nuevamente.', 'danger');
        return;
      }
    }

    // Va directo al carnet (mismo link que el QR), no a una página que
    // primero muestra un QR para escanear.
    this.router.navigate(['/carnet', token]);
  }
  verQR() { this.router.navigate(['/tabs/mascota-qr',]) }

  /** El PIN para compartir el historial con un veterinario se genera y
   *  muestra en mascota-detalle (junto con la lista de accesos otorgados) —
   *  este botón es solo para que se encuentre fácil desde el perfil. */
  compartirConVeterinario(): void {
    const id = this.mascota()?.id;
    if (id) this.router.navigate(['/tabs/mascota-detalle', id], { queryParams: { segmento: 'historial' } });
  }

  get estaPerdida(): boolean {
    return this.mascota()?.estado === 'perdida';
  }

  async toggleEstadoPerdida(): Promise<void> {
    if (this.estaPerdida) {
      // Marcar como encontrada no expone nada, se hace directo.
      await this.actualizarEstado('normal', 'Marcada como encontrada. Ya no se muestra tu contacto en la ficha.');
      return;
    }

    // Activar el reporte de pérdida expone tu contacto en la ficha pública
    // del QR, así que se pide confirmación antes.
    const alert = await this.alertCtrl.create({
      header: 'Reportar como perdida',
      message: 'A partir de ahora, quien escanee el QR de "mascota perdida" va a poder ver tu nombre y teléfono de contacto para ayudarte a encontrarla. Puedes desactivarlo cuando quieras.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Reportar perdida',
          handler: () => this.actualizarEstado('perdida', 'Mascota reportada como perdida. Tu contacto ya es visible en la ficha del QR.')
        }
      ]
    });
    await alert.present();
  }

  private async actualizarEstado(estado: 'normal' | 'perdida', mensajeExito: string): Promise<void> {
    const id = this.mascota()?.id;
    if (!id || this.actualizandoEstado) return;
    this.actualizandoEstado = true;
    try {
      await this.fs.updatePet(id, { estado });
      await this.presentToast(mensajeExito, 'success');
    } catch {
      await this.presentToast('No se pudo actualizar el estado. Intenta nuevamente.', 'danger');
    } finally {
      this.actualizandoEstado = false;
    }
  }

  darEnAdopcion(): void {
    const m = this.mascota();
    if (m?.id) this.elegirMetodoTransferencia(m, 'adopcion');
  }

  /** Publica a la mascota en el feed público de adopción (a diferencia de
   *  "Dar en adopción", que la transfiere a un email puntual): cualquier
   *  dueño puede hacerlo, no hace falta cuenta de refugio. Pide un mensaje
   *  y confirmación explícita antes de postear, porque queda visible para
   *  cualquier persona en el Home. */
  async publicarEnAdopcion(): Promise<void> {
    const m = this.mascota();
    if (!m?.id || this.publicandoAdopcion) return;

    const alert = await this.alertCtrl.create({
      header: `Publicar a ${m.nombre} en adopción`,
      message: 'Va a aparecer públicamente en el feed del Home para que cualquier persona la vea y pueda postular a adoptarla. Confirmas que la información es real.',
      inputs: [
        { name: 'descripcion', type: 'textarea', placeholder: `Cuenta algo de ${m.nombre}: personalidad, por qué la das en adopción, etc.` },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Publicar',
          handler: async (data) => {
            const descripcion = this.security.sanitizeText(data.descripcion || '', 1000);
            if (descripcion.length < 10) {
              await this.presentToast('Cuéntanos un poco más antes de publicar (mínimo 10 caracteres).', 'danger');
              return false;
            }
            this.publicandoAdopcion = true;
            try {
              const uid = this.auth.getCurrentUser()?.uid;
              const perfil = uid ? await this.fs.getDocument(`usuarios/${uid}`) : null;
              // Solo el primer nombre (o el nombre del refugio): nunca el
              // apellido completo ni la dirección, para no exponer datos
              // personales en un feed público.
              const nombreAutor = perfil?.nombreRefugio?.trim()
                || perfil?.nombre?.trim()
                || 'Alguien de Ashbis';
              await this.fs.crearPublicacion({
                uidAutor: m.uidUsuario,
                nombreAutor,
                ...(perfil?.region ? { region: perfil.region } : {}),
                ...(perfil?.comuna ? { comuna: perfil.comuna } : {}),
                tipo: 'adopcion',
                titulo: m.nombre,
                descripcion,
                mascotaId: m.id!,
                aceptaVeracidad: true,
                ...(m.fotoUrl ? { fotoUrl: m.fotoUrl } : {}),
                // Info pública de la mascota: mascotas/{id} no es legible por
                // cualquiera, así que esto es lo único que va a poder ver
                // alguien que no sea el dueño/equipo. La Cloud Function
                // onMascotaActualizada la mantiene al día si después editas
                // la ficha (nueva foto, edad, etc.).
                ...(m.especie ? { especie: m.especie } : {}),
                ...(m.raza ? { raza: m.raza } : {}),
                ...(m.sexo ? { sexo: m.sexo } : {}),
                ...(m.edad != null ? { edad: m.edad } : {}),
                ...(m.color ? { color: m.color } : {}),
                ...(m.castrado ? { castrado: m.castrado } : {}),
              });
              await this.presentToast('¡Publicado! Ya aparece en el feed de adopciones del Home.', 'success');
              return true;
            } catch (err: any) {
              await this.presentToast(err?.message || 'No se pudo publicar. Intenta nuevamente.', 'danger');
              return false;
            } finally {
              this.publicandoAdopcion = false;
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async darHogarTemporal(): Promise<void> {
    const m = this.mascota();
    if (!m?.id) return;
    // Una mascota solo puede estar en UN hogar temporal a la vez — se avisa
    // acá antes de mandar una solicitud nueva; el chequeo que de verdad no
    // se puede saltear vive en la Cloud Function aceptarTransferencia.
    if (await this.fs.hayHogarTemporalActivo(m.id)) {
      const alert = await this.alertCtrl.create({
        header: 'Ya tiene un hogar temporal',
        message: `${m.nombre} ya está en un hogar temporal activo. Termínalo antes de mandar una nueva solicitud.`,
        buttons: ['Entendido'],
      });
      await alert.present();
      return;
    }
    this.elegirMetodoTransferencia(m, 'hogar_temporal');
  }

  /** Invitar a un co-dueño: hasta 2 además de mí (3 cuentas en total
   *  compartiendo la mascota con los mismos permisos). Lo puede iniciar
   *  el dueño real o cualquier co-dueño ya aceptado (ver puedeGestionarCoDuenos). */
  async agregarCoDueno(): Promise<void> {
    const m = this.mascota();
    if (!m?.id) return;
    const coDuenos = await this.fs.contarCoDuenos(m.id);
    if (coDuenos >= 2) {
      const alert = await this.alertCtrl.create({
        header: 'Ya tiene el máximo de dueños',
        message: `${m.nombre} ya tiene 3 dueños (vos y 2 más). Quita a alguien antes de invitar a otra persona.`,
        buttons: ['Entendido'],
      });
      await alert.present();
      return;
    }
    this.elegirMetodoTransferencia(m, 'co_dueno');
  }

  /** Título/mensajes por tipo de solicitud, para no repetir el mismo
   *  ternario/switch en cada método de abajo. */
  private copiaTransferencia(tipo: 'adopcion' | 'hogar_temporal' | 'co_dueno', nombre: string) {
    switch (tipo) {
      case 'adopcion':
        return {
          titulo: `Adopción de ${nombre}`,
          mensajeInvitar: 'El nuevo dueño recibirá una solicitud en su perfil. La mascota (con todo su historial) solo pasa a su cuenta cuando la acepte.',
          placeholderEmail: 'Email de quien la adopta',
          mensajeExito: 'Solicitud de adopción enviada.',
        };
      case 'hogar_temporal':
        return {
          titulo: `Hogar temporal para ${nombre}`,
          mensajeInvitar: 'La persona recibirá una solicitud en su perfil. Al aceptar, comparte acceso al perfil e historial de la mascota, pero tú sigues como dueño/a.',
          placeholderEmail: 'Email de quien la va a cuidar',
          mensajeExito: 'Solicitud de hogar temporal enviada.',
        };
      case 'co_dueno':
        return {
          titulo: `Agregar co-dueño de ${nombre}`,
          mensajeInvitar: `La persona recibirá una solicitud en su perfil. Al aceptarla, va a tener los mismos permisos que vos sobre ${nombre}: puede editar su información, agregar vacunas/historial, e invitar a un tercer co-dueño (máximo 3 en total).`,
          placeholderEmail: 'Email del otro dueño/a',
          mensajeExito: 'Invitación de co-dueño enviada.',
        };
    }
  }

  /** Un solo botón por tipo de solicitud (adopción / hogar temporal /
   *  co-dueño): al tocarlo se pregunta cómo identificar a la otra persona —
   *  tipeando su email o escaneando su QR de cuenta. Ambos métodos hacen
   *  exactamente lo mismo, solo cambia cómo se llega al email. */
  private async elegirMetodoTransferencia(
    m: Mascota,
    tipo: 'adopcion' | 'hogar_temporal' | 'co_dueno'
  ): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.copiaTransferencia(tipo, m.nombre).titulo,
      message: '¿Cómo quieres identificar a la persona? Las dos formas hacen lo mismo.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Escribir su email', handler: () => this.pedirDatosTransferencia(m, tipo) },
        { text: 'Escanear su QR', handler: () => this.iniciarEscaneoQr(tipo) },
      ],
    });
    await alert.present();
  }

  private async pedirDatosTransferencia(
    m: Mascota,
    tipo: 'adopcion' | 'hogar_temporal' | 'co_dueno'
  ): Promise<void> {
    const copia = this.copiaTransferencia(tipo, m.nombre);
    const alert = await this.alertCtrl.create({
      header: copia.titulo,
      message: copia.mensajeInvitar,
      inputs: [
        { name: 'email', type: 'email', placeholder: copia.placeholderEmail },
        { name: 'mensaje', type: 'textarea', placeholder: 'Mensaje (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Enviar',
          handler: (data) => {
            const email = this.security.sanitizeText(data.email || '', 200);
            if (!this.security.isValidEmail(email)) {
              this.presentToast('Ingresa un email válido.', 'danger');
              return false;
            }
            const mensaje = data.mensaje ? this.security.sanitizeText(data.mensaje, 500) : undefined;
            return this.enviarSolicitudTransferencia(m, tipo, email, mensaje);
          }
        }
      ]
    });
    await alert.present();
  }

  /** Lógica común de "mandar la solicitud", ya sea que el email se haya
   *  tipeado a mano o se haya resuelto escaneando el QR de cuenta de la
   *  otra persona. */
  private async enviarSolicitudTransferencia(
    m: Mascota,
    tipo: 'adopcion' | 'hogar_temporal' | 'co_dueno',
    email: string,
    mensaje?: string
  ): Promise<boolean> {
    try {
      const uid = this.auth.getCurrentUser()?.uid;
      const perfil = uid ? await this.fs.getDocument(`usuarios/${uid}`) : null;
      const deNombre = perfil?.nombreRefugio?.trim()
        || `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim()
        || 'Un refugio';
      await this.fs.crearTransferencia(tipo, m.id!, m.nombre, m.uidUsuario, deNombre, email, mensaje);
      await this.presentToast(this.copiaTransferencia(tipo, m.nombre).mensajeExito, 'success');
      return true;
    } catch (err: any) {
      await this.presentToast(err?.message || 'No se pudo enviar la solicitud. Intenta nuevamente.', 'danger');
      return false;
    }
  }

  private async iniciarEscaneoQr(tipo: 'adopcion' | 'hogar_temporal' | 'co_dueno'): Promise<void> {
    const m = this.mascota();
    if (!m?.id) return;
    if (tipo === 'hogar_temporal' && await this.fs.hayHogarTemporalActivo(m.id)) {
      await this.presentToast(`${m.nombre} ya está en un hogar temporal activo.`, 'danger');
      return;
    }
    if (tipo === 'co_dueno' && (await this.fs.contarCoDuenos(m.id)) >= 2) {
      await this.presentToast(`${m.nombre} ya tiene el máximo de 3 dueños.`, 'danger');
      return;
    }
    if (!this.preferencias.camaraHabilitada) {
      await this.presentToast('Activa la cámara en Configuración → Permisos para escanear un QR.', 'danger');
      return;
    }
    this.tipoEscaneoPendiente = tipo;
    this.qrInputRef?.nativeElement.click();
  }

  /** El input de archivo (con capture="environment") abre directo la
   *  cámara en el celular, igual que el resto de las fotos de la app — no
   *  hace falta un stream de video en vivo ni un plugin nuevo. */
  async onQrFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const tipo = this.tipoEscaneoPendiente;
    const m = this.mascota();
    this.tipoEscaneoPendiente = null;
    if (!file || !tipo || !m) return;

    this.escaneandoQr = true;
    try {
      const token = await this.qrDecodeSvc.decodificarArchivo(file);
      if (!token) {
        await this.presentToast('No se detectó ningún código QR en la foto. Prueba con más luz y de más cerca.', 'danger');
        return;
      }
      const info = await this.fs.resolverQrCuenta(token);
      if (!info) {
        await this.presentToast('Ese código QR no es válido.', 'danger');
        return;
      }
      await this.confirmarEnvioPorQr(m, tipo, info);
    } catch {
      await this.presentToast('No se pudo leer el código QR. Intenta de nuevo.', 'danger');
    } finally {
      this.escaneandoQr = false;
    }
  }

  private async confirmarEnvioPorQr(
    m: Mascota,
    tipo: 'adopcion' | 'hogar_temporal' | 'co_dueno',
    info: Models.Auth.QrCuentaInfo
  ): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.copiaTransferencia(tipo, m.nombre).titulo,
      message: `¿Enviarle la solicitud a ${info.nombre} (${info.email})?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Enviar', handler: () => this.enviarSolicitudTransferencia(m, tipo, info.email) },
      ],
    });
    await alert.present();
  }

  private async presentToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
