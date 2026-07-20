import { CommonModule } from '@angular/common';
import {
  AfterViewInit, Component, ElementRef, inject, OnDestroy, ViewChild, computed, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { Chart, registerables } from 'chart.js';
import { addIcons } from 'ionicons';
import { addOutline, cashOutline, trashOutline, trendingDownOutline, trendingUpOutline } from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';

Chart.register(...registerables);

const CATEGORIAS: { id: Models.Finanzas.CategoriaMovimiento; label: string }[] = [
  { id: 'alimentacion', label: 'Alimentación' },
  { id: 'veterinaria', label: 'Veterinaria' },
  { id: 'medicamentos', label: 'Medicamentos' },
  { id: 'insumos', label: 'Insumos' },
  { id: 'donacion', label: 'Donación' },
  { id: 'adopcion', label: 'Adopción' },
  { id: 'eventos', label: 'Eventos' },
  { id: 'transporte', label: 'Transporte' },
  { id: 'otro', label: 'Otro' },
];

@Component({
  selector: 'app-refugio-finanzas',
  standalone: true,
  templateUrl: './refugio-finanzas.component.html',
  styleUrls: ['./refugio-finanzas.component.scss'],
  imports: [
    CommonModule, ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonIcon, IonButton, IonList, IonSpinner,
    IonGrid, IonRow, IonCol, IonInput, IonSelect, IonSelectOption, IonTextarea,
  ],
})
export class RefugioFinanzasComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly fs = inject(FirestoreService);
  private readonly fb = inject(FormBuilder);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('grafico') graficoRef?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  refugioUid = '';
  cargando = signal(true);
  movimientos = signal<Models.Finanzas.Movimiento[]>([]);
  categorias = CATEGORIAS;
  guardando = false;

  totalIngresos = computed(() =>
    this.movimientos().filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  );
  totalGastos = computed(() =>
    this.movimientos().filter(m => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0)
  );
  balance = computed(() => this.totalIngresos() - this.totalGastos());

  form = this.fb.nonNullable.group({
    tipo: this.fb.nonNullable.control<Models.Finanzas.TipoMovimiento>('gasto', Validators.required),
    monto: this.fb.nonNullable.control<number | null>(null, [Validators.required, Validators.min(1)]),
    categoria: this.fb.nonNullable.control<Models.Finanzas.CategoriaMovimiento>('otro', Validators.required),
    descripcion: this.fb.nonNullable.control(''),
    fecha: this.fb.nonNullable.control(new Date().toISOString().slice(0, 10), Validators.required),
  });

  constructor() {
    addIcons({ addOutline, cashOutline, trashOutline, trendingDownOutline, trendingUpOutline });
  }

  ngAfterViewInit(): void {
    this.refugioUid = this.route.snapshot.paramMap.get('refugioUid')!;
    if (!this.refugioUid) return;

    this.fs.getMovimientosFinancieros(this.refugioUid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(movs => {
        this.movimientos.set(movs ?? []);
        this.cargando.set(false);
        this.actualizarGrafico();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.chart?.destroy();
  }

  trackById = (_: number, m: { id?: string }) => m.id;

  categoriaLabel(id: string): string {
    return this.categorias.find(c => c.id === id)?.label ?? id;
  }

  async registrar(): Promise<void> {
    if (this.form.invalid || this.guardando) {
      this.form.markAllAsTouched();
      return;
    }
    this.guardando = true;
    const v = this.form.getRawValue();
    try {
      await this.fs.addMovimientoFinanciero(this.refugioUid, {
        tipo: v.tipo,
        monto: Number(v.monto),
        categoria: v.categoria,
        descripcion: v.descripcion?.trim() || undefined,
        fecha: v.fecha,
      });
      this.form.reset({
        tipo: 'gasto',
        monto: null,
        categoria: 'otro',
        descripcion: '',
        fecha: new Date().toISOString().slice(0, 10),
      });
      await this.mostrarToast('Movimiento registrado.', 'success');
    } catch {
      await this.mostrarToast('No se pudo registrar. Intenta nuevamente.', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  async eliminar(m: Models.Finanzas.Movimiento): Promise<void> {
    if (!m.id) return;
    const alert = await this.alertCtrl.create({
      header: 'Eliminar movimiento',
      message: `¿Eliminar este ${m.tipo === 'ingreso' ? 'ingreso' : 'gasto'} de $${m.monto}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.fs.deleteMovimientoFinanciero(this.refugioUid, m.id!);
            } catch {
              await this.mostrarToast('No se pudo eliminar. Intenta nuevamente.', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private actualizarGrafico(): void {
    const canvas = this.graficoRef?.nativeElement;
    if (!canvas) return;

    // Últimos 6 meses, ingresos vs gastos por mes.
    const meses: { label: string; key: string }[] = [];
    const hoy = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      meses.push({
        label: d.toLocaleDateString('es-CL', { month: 'short' }),
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      });
    }

    const ingresosPorMes = meses.map(({ key }) =>
      this.movimientos()
        .filter(m => m.tipo === 'ingreso' && m.fecha?.startsWith(key))
        .reduce((s, m) => s + m.monto, 0)
    );
    const gastosPorMes = meses.map(({ key }) =>
      this.movimientos()
        .filter(m => m.tipo === 'gasto' && m.fecha?.startsWith(key))
        .reduce((s, m) => s + m.monto, 0)
    );

    if (this.chart) {
      this.chart.data.labels = meses.map(m => m.label);
      this.chart.data.datasets[0].data = ingresosPorMes;
      this.chart.data.datasets[1].data = gastosPorMes;
      this.chart.update();
      return;
    }

    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: meses.map(m => m.label),
        datasets: [
          { label: 'Ingresos', data: ingresosPorMes, backgroundColor: '#2dd36f' },
          { label: 'Gastos', data: gastosPorMes, backgroundColor: '#8b0808' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#999999' }, grid: { color: 'rgba(153,153,153,.15)' } },
          y: { ticks: { color: '#999999' }, grid: { color: 'rgba(153,153,153,.15)' }, beginAtZero: true },
        },
        plugins: {
          legend: { labels: { color: '#999999' } },
        },
      },
    });
  }

  private async mostrarToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
