import { Component, Input, OnChanges, OnDestroy, SimpleChanges, inject, signal, computed } from '@angular/core';
import { NgFor, NgIf, NgClass, DatePipe } from '@angular/common';
import { IonIcon, IonButton, IonBadge, IonSpinner } from '@ionic/angular/standalone';
import { Subject, combineLatest, of } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline, todayOutline } from 'ionicons/icons';
import { FirestoreService } from '../firebase/firestore';

type TipoEventoCalendario = 'vacuna' | 'examen' | 'medicamento' | 'cita' | 'tratamiento';
type EstadoEventoCalendario = 'hecho' | 'pendiente' | 'vencido';

interface EventoCalendario {
  tipo: TipoEventoCalendario;
  titulo: string;
  subtitulo?: string;
  lugar?: string;
  fecha: Date;
  estado: EstadoEventoCalendario;
}

interface CeldaCalendario {
  fecha: Date;
  diaKey: string;
  enMesActual: boolean;
  esHoy: boolean;
  eventos: EventoCalendario[];
}

// No se usa 'primary': en el tema de Ashbis --ion-color-primary está
// pisado al mismo rojo que --ion-color-danger (ver global.scss), así que
// coincidiría visualmente con "cita" — se evita esa colisión eligiendo
// solo entre los tonos que sí son distintos entre sí en este tema.
const COLOR_POR_TIPO: Record<TipoEventoCalendario, string> = {
  vacuna: 'tertiary',
  examen: 'secondary',
  medicamento: 'warning',
  cita: 'danger',
  tratamiento: 'success',
};

const ETIQUETA_POR_TIPO: Record<TipoEventoCalendario, string> = {
  vacuna: 'Vacuna',
  examen: 'Examen',
  medicamento: 'Medicamento',
  cita: 'Cita',
  tratamiento: 'Tratamiento',
};

/** Cuántos días hacia adelante se "rellena" un medicamento sin fecha de fin
 *  conocida (tratamiento indefinido) — solo para que se vea algo razonable
 *  en el calendario, no representa una fecha de término real. */
const DIAS_RELLENO_MEDICAMENTO_INDEFINIDO = 30;
/** Tope duro por si una mascota tuviera un rango de fechas absurdamente
 *  largo cargado a mano — evita generar miles de celdas. */
const MAX_DIAS_EXPANDIDOS_MEDICAMENTO = 180;

@Component({
  selector: 'app-mascota-calendario',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, DatePipe, IonIcon, IonButton, IonBadge, IonSpinner],
  templateUrl: './mascota-calendario.component.html',
  styleUrls: ['./mascota-calendario.component.scss'],
})
export class MascotaCalendarioComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) petId!: string;

  private fs = inject(FirestoreService);
  private destroy$ = new Subject<void>();
  private petId$ = new Subject<string>();

  loading = signal(true);
  private eventos = signal<EventoCalendario[]>([]);

  mesActual = signal<Date>(this.primerDiaDelMes(new Date()));
  diaSeleccionado = signal<string | null>(this.diaKey(new Date()));

  readonly diasSemana = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  readonly leyenda = (Object.keys(ETIQUETA_POR_TIPO) as TipoEventoCalendario[]).map(tipo => ({
    tipo, color: COLOR_POR_TIPO[tipo], etiqueta: ETIQUETA_POR_TIPO[tipo],
  }));

  tituloMes = computed(() =>
    this.mesActual().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  );

  private eventosPorDia = computed(() => {
    const map = new Map<string, EventoCalendario[]>();
    for (const ev of this.eventos()) {
      const key = this.diaKey(ev.fecha);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    for (const lista of map.values()) lista.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    return map;
  });

  celdas = computed<CeldaCalendario[]>(() => {
    const mes = this.mesActual();
    const hoyKey = this.diaKey(new Date());
    const porDia = this.eventosPorDia();

    // Domingo=0 en JS; convertimos a "días desde el lunes" para que la
    // grilla empiece en lunes (convención habitual en Chile).
    const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const offsetLunes = (primerDia.getDay() + 6) % 7;
    const inicioGrilla = new Date(mes.getFullYear(), mes.getMonth(), 1 - offsetLunes);

    const celdas: CeldaCalendario[] = [];
    for (let i = 0; i < 42; i++) {
      const fecha = new Date(inicioGrilla.getFullYear(), inicioGrilla.getMonth(), inicioGrilla.getDate() + i);
      const key = this.diaKey(fecha);
      celdas.push({
        fecha,
        diaKey: key,
        enMesActual: fecha.getMonth() === mes.getMonth(),
        esHoy: key === hoyKey,
        eventos: porDia.get(key) ?? [],
      });
    }
    return celdas;
  });

  eventosDelDiaSeleccionado = computed<EventoCalendario[]>(() => {
    const key = this.diaSeleccionado();
    if (!key) return [];
    return this.eventosPorDia().get(key) ?? [];
  });

  fechaSeleccionadaLegible = computed(() => {
    const key = this.diaSeleccionado();
    if (!key) return '';
    return this.parseFechaLocal(key).toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  });

  constructor() {
    addIcons({ chevronBackOutline, chevronForwardOutline, todayOutline });

    this.petId$
      .pipe(
        switchMap(petId => {
          if (!petId) return of([] as EventoCalendario[]);
          this.loading.set(true);
          return combineLatest([
            this.fs.getVacunasByMascota(petId),
            this.fs.getExamenesByMascota(petId),
            this.fs.getMedicamentosByMascota(petId),
            this.fs.getCitasByMascota(petId),
            this.fs.getTratamientosConSesiones(petId),
          ]).pipe(switchMap(([vacunas, examenes, medicamentos, citas, tratamientos]) =>
            of(this.normalizar(vacunas, examenes, medicamentos, citas, tratamientos))
          ));
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(eventos => {
        this.eventos.set(eventos);
        this.loading.set(false);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['petId'] && this.petId) this.petId$.next(this.petId);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  mesAnterior(): void {
    const m = this.mesActual();
    this.mesActual.set(new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  mesSiguiente(): void {
    const m = this.mesActual();
    this.mesActual.set(new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  irAHoy(): void {
    this.mesActual.set(this.primerDiaDelMes(new Date()));
    this.diaSeleccionado.set(this.diaKey(new Date()));
  }

  seleccionarDia(c: CeldaCalendario): void {
    this.diaSeleccionado.set(c.diaKey);
  }

  colorTipo(tipo: TipoEventoCalendario): string {
    return COLOR_POR_TIPO[tipo];
  }

  etiquetaTipo(tipo: TipoEventoCalendario): string {
    return ETIQUETA_POR_TIPO[tipo];
  }

  colorEstado(estado: EstadoEventoCalendario): string {
    return estado === 'hecho' ? 'success' : estado === 'vencido' ? 'danger' : 'medium';
  }

  etiquetaEstado(estado: EstadoEventoCalendario): string {
    return estado === 'hecho' ? 'Hecho' : estado === 'vencido' ? 'Vencido' : 'Pendiente';
  }

  /** Tipos únicos presentes en un día, en orden fijo — para pintar como
   *  máximo un punto de color por categoría (no uno por evento). */
  tiposDelDia(c: CeldaCalendario): TipoEventoCalendario[] {
    const vistos = new Set(c.eventos.map(e => e.tipo));
    return (Object.keys(ETIQUETA_POR_TIPO) as TipoEventoCalendario[]).filter(t => vistos.has(t));
  }

  // ── Normalización de las 5 fuentes a un mismo formato de evento ────────────────

  private normalizar(
    vacunas: import('../firebase/firestore').Vacuna[],
    examenes: import('../firebase/firestore').Examen[],
    medicamentos: import('../firebase/firestore').Medicamento[],
    citas: import('../firebase/firestore').Cita[],
    tratamientos: (import('../firebase/firestore').Tratamiento & { sesiones: import('../firebase/firestore').SesionTratamiento[] })[]
  ): EventoCalendario[] {
    const hoy = new Date();
    const eventos: EventoCalendario[] = [];

    for (const v of vacunas) {
      if (v.fechaAplicacion) {
        eventos.push({
          tipo: 'vacuna', titulo: `Vacuna aplicada: ${v.tipo}`,
          fecha: this.parseFechaLocal(v.fechaAplicacion), estado: 'hecho',
        });
      }
      if (v.proximaFecha) {
        const fecha = this.parseFechaLocal(v.proximaFecha);
        eventos.push({
          tipo: 'vacuna', titulo: `Próxima vacuna: ${v.tipo}`,
          fecha, estado: this.soloFecha(fecha) < this.soloFecha(hoy) ? 'vencido' : 'pendiente',
        });
      }
    }

    for (const e of examenes) {
      if (e.realizado && e.fechaRealizado) {
        eventos.push({
          tipo: 'examen', titulo: `Examen: ${e.tipo}`, lugar: e.lugar,
          fecha: this.parseFechaLocal(e.fechaRealizado), estado: 'hecho',
        });
      } else if (e.fechaProgramada) {
        const fecha = this.parseFechaLocal(e.fechaProgramada);
        eventos.push({
          tipo: 'examen', titulo: `Examen: ${e.tipo}`, lugar: e.lugar, fecha,
          estado: e.realizado ? 'hecho' : (this.soloFecha(fecha) < this.soloFecha(hoy) ? 'vencido' : 'pendiente'),
        });
      }
    }

    for (const m of medicamentos) {
      if (!m.fechaInicio) continue;
      const inicio = this.parseFechaLocal(m.fechaInicio);
      const finBase = m.fechaFin
        ? this.parseFechaLocal(m.fechaFin)
        : this.addDias(inicio > hoy ? inicio : hoy, DIAS_RELLENO_MEDICAMENTO_INDEFINIDO);
      const finTope = this.addDias(inicio, MAX_DIAS_EXPANDIDOS_MEDICAMENTO);
      const fin = finBase < finTope ? finBase : finTope;

      for (let d = new Date(inicio); this.soloFecha(d) <= this.soloFecha(fin); d = this.addDias(d, 1)) {
        eventos.push({
          tipo: 'medicamento', titulo: `${m.nombre} (${m.mg} mg)`,
          fecha: new Date(d), estado: this.soloFecha(d) < this.soloFecha(hoy) ? 'hecho' : 'pendiente',
        });
      }
    }

    for (const c of citas) {
      if (!c.fechaInicio) continue;
      const fecha = this.parseFechaLocal(c.fechaInicio);
      eventos.push({
        tipo: 'cita', titulo: c.titulo, lugar: c.lugar, fecha,
        estado: fecha < hoy ? 'hecho' : 'pendiente',
      });
    }

    for (const t of tratamientos) {
      for (const s of t.sesiones) {
        if (!s.fecha) continue;
        const fecha = this.parseFechaLocal(s.fecha);
        eventos.push({
          tipo: 'tratamiento', titulo: `${t.tipo}${s.lugar ? ' · ' + s.lugar : ''}`, lugar: s.lugar,
          fecha, estado: s.realizada ? 'hecho' : (fecha < hoy ? 'vencido' : 'pendiente'),
        });
      }
    }

    return eventos;
  }

  // ── Utilidades de fecha (mismo criterio "horario local" que el resto de la app) ─

  private parseFechaLocal(s: string): Date {
    if (s.length <= 10) {
      const [yyyy, mm, dd] = s.split('-').map(n => parseInt(n, 10));
      return new Date(yyyy, mm - 1, dd);
    }
    return new Date(s);
  }

  private soloFecha(d: Date): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  private addDias(d: Date, dias: number): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias, d.getHours(), d.getMinutes());
  }

  private primerDiaDelMes(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  private diaKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
