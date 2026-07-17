import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { provideRouter } from '@angular/router';
import { environment } from 'src/environments/environment';
import { ListarMascotasComponent } from './listar-mascotas.component';

describe('ListarMascotasComponent', () => {
  let component: ListarMascotasComponent;
  let fixture: ComponentFixture<ListarMascotasComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ListarMascotasComponent],
      providers: [
        provideFirebaseApp(() => initializeApp(environment.firebase)),
        provideAuth(() => getAuth()),
        provideFirestore(() => getFirestore()),
        provideStorage(() => getStorage()),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListarMascotasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
