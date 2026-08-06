import { CommonModule } from '@angular/common';
import { Component, HostBinding, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IonIcon, IonItem, IonLabel, IonNote, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { Subject, takeUntil } from 'rxjs';
import { COMUNAS_POR_REGION, REGIONES_CHILE } from 'src/app/shared/data/chile-ubicacion';

/**
 * Selector de región + comuna reutilizado en registro, completar-perfil y
 * perfil: al cambiar la región, recalcula las comunas disponibles desde
 * COMUNAS_POR_REGION y limpia el valor de comuna si ya no pertenece a la
 * región elegida (evita guardar una comuna que no corresponde).
 *
 * `variant` existe porque el CSS de cada pantalla está encapsulado por
 * Angular (no "atraviesa" a este componente hijo): 'form' replica a mano el
 * estilo de ion-item con línea roja inferior que usan registro/
 * completar-perfil; 'plain' lo desactiva para Perfil, donde el ion-item ya
 * usa el look por defecto de Ionic y no tiene esa línea.
 */
@Component({
  selector: 'app-region-comuna-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonIcon, IonItem, IonLabel, IonSelect, IonSelectOption, IonNote],
  templateUrl: './region-comuna-select.component.html',
  styleUrls: ['./region-comuna-select.component.scss'],
})
export class RegionComunaSelectComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) form!: FormGroup;
  @Input() regionControlName = 'region';
  @Input() comunaControlName = 'comuna';
  @Input() required = true;
  /** Para reusar en pantallas con modo ver/editar (ej. Perfil), donde el
   *  select debe quedar bloqueado fuera de modo edición aunque el
   *  FormControl en sí siga habilitado. */
  @Input() disabled = false;
  /** Nombre de ion-icon para el slot="start" de cada ion-item (ej.
   *  "location-outline" en Perfil, donde el resto de los campos de esa
   *  tarjeta ya tienen ícono). null = sin ícono, para no romper el estilo
   *  de registro/completar-perfil, donde ningún campo lo usa. */
  @Input() icon: string | null = null;
  @Input() variant: 'form' | 'plain' = 'form';

  @HostBinding('attr.data-variant') get dataVariant(): string {
    return this.variant;
  }

  private readonly destroy$ = new Subject<void>();

  readonly regiones = REGIONES_CHILE;
  comunasDisponibles: string[] = [];

  get regionControl(): FormControl {
    return this.form.get(this.regionControlName) as FormControl;
  }

  get comunaControl(): FormControl {
    return this.form.get(this.comunaControlName) as FormControl;
  }

  ngOnInit(): void {
    this.actualizarComunas(this.regionControl.value, false);
    this.regionControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(region => this.actualizarComunas(region, true));
  }

  ngOnChanges(changes: SimpleChanges): void {
    // El formulario puede llegar ya con datos (ej: editar perfil) después de ngOnInit.
    if (changes['form'] && !changes['form'].firstChange) {
      this.actualizarComunas(this.regionControl.value, false);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private actualizarComunas(region: string, limpiarSiNoPertenece: boolean): void {
    this.comunasDisponibles = COMUNAS_POR_REGION[region] || [];
    if (limpiarSiNoPertenece && !this.comunasDisponibles.includes(this.comunaControl.value)) {
      this.comunaControl.setValue('');
    }
  }
}
