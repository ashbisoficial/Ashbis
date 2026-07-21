import { Component, inject, signal, OnDestroy } from '@angular/core';
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
import { alertCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { FirestoreService, Mascota } from '../firebase/firestore';
import { VeterinariaFavorita } from 'src/app/firebase/firestore';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { SecurityService } from 'src/app/services/security.service';
import { PublicQrService } from 'src/app/services/public-qr.service';

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
  private publicQrSvc = inject(PublicQrService);

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

  private miUid: string | null = null;
  private misRefugios: string[] = [];
  private miRolEsRefugio = false;

  constructor() {
    addIcons({ alertCircleOutline, checkmarkCircleOutline });

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
      return;
    }
    const esDuenoDirecto = m.uidUsuario === this.miUid;
    const esEquipoDelRefugioDueno = this.misRefugios.includes(m.uidUsuario);
    this.puedeTransferir.set((esDuenoDirecto && this.miRolEsRefugio) || esEquipoDelRefugioDueno);
    this.puedePublicarAdopcion.set(esDuenoDirecto);
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
      message: 'A partir de ahora, quien escanee el QR de "mascota perdida" va a poder ver tu nombre y teléfono de contacto para ayudarte a encontrarla. Podés desactivarlo cuando quieras.',
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
    if (m?.id) this.pedirDatosTransferencia(m, 'adopcion');
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
      message: 'Va a aparecer públicamente en el feed del Home para que cualquier persona la vea y pueda postular a adoptarla. Confirmás que la información es real.',
      inputs: [
        { name: 'descripcion', type: 'textarea', placeholder: `Contá algo de ${m.nombre}: personalidad, por qué la das en adopción, etc.` },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Publicar',
          handler: async (data) => {
            const descripcion = this.security.sanitizeText(data.descripcion || '', 1000);
            if (descripcion.length < 10) {
              await this.presentToast('Contanos un poco más antes de publicar (mínimo 10 caracteres).', 'danger');
              return false;
            }
            this.publicandoAdopcion = true;
            try {
              const uid = this.auth.getCurrentUser()?.uid;
              const perfil = uid ? await this.fs.getDocument(`usuarios/${uid}`) : null;
              const nombreAutor = perfil?.nombreRefugio?.trim()
                || `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim()
                || 'Alguien de Ashbis';
              await this.fs.crearPublicacion({
                uidAutor: m.uidUsuario,
                nombreAutor,
                tipo: 'adopcion',
                titulo: m.nombre,
                descripcion,
                mascotaId: m.id!,
                aceptaVeracidad: true,
                ...(m.fotoUrl ? { fotoUrl: m.fotoUrl } : {}),
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
    this.pedirDatosTransferencia(m, 'hogar_temporal');
  }

  private async pedirDatosTransferencia(
    m: Mascota,
    tipo: 'adopcion' | 'hogar_temporal'
  ): Promise<void> {
    const esAdopcion = tipo === 'adopcion';
    const alert = await this.alertCtrl.create({
      header: esAdopcion ? `Adopción de ${m.nombre}` : `Hogar temporal para ${m.nombre}`,
      message: esAdopcion
        ? 'El nuevo dueño recibirá una solicitud en su perfil. La mascota (con todo su historial) solo pasa a su cuenta cuando la acepte.'
        : 'La persona recibirá una solicitud en su perfil. Al aceptar, comparte acceso al perfil e historial de la mascota, pero vos seguís como dueño/a.',
      inputs: [
        { name: 'email', type: 'email', placeholder: `Email de ${esAdopcion ? 'quien la adopta' : 'quien la va a cuidar'}` },
        { name: 'mensaje', type: 'textarea', placeholder: 'Mensaje (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Enviar',
          handler: async (data) => {
            const email = this.security.sanitizeText(data.email || '', 200);
            if (!this.security.isValidEmail(email)) {
              await this.presentToast('Ingresa un email válido.', 'danger');
              return false;
            }
            try {
              const uid = this.auth.getCurrentUser()?.uid;
              const perfil = uid ? await this.fs.getDocument(`usuarios/${uid}`) : null;
              const deNombre = perfil?.nombreRefugio?.trim()
                || `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim()
                || 'Un refugio';
              await this.fs.crearTransferencia(
                tipo,
                m.id!,
                m.nombre,
                m.uidUsuario,
                deNombre,
                email,
                data.mensaje ? this.security.sanitizeText(data.mensaje, 500) : undefined
              );
              await this.presentToast(
                esAdopcion ? 'Solicitud de adopción enviada.' : 'Solicitud de hogar temporal enviada.',
                'success'
              );
              return true;
            } catch (err: any) {
              await this.presentToast(
                err?.message || 'No se pudo enviar la solicitud. Intenta nuevamente.',
                'danger'
              );
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private async presentToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
