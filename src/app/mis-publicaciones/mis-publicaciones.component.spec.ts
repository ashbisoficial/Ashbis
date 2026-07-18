import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { environment } from 'src/environments/environment';
import { MisPublicacionesComponent } from './mis-publicaciones.component';

describe('MisPublicacionesComponent', () => {
  let component: MisPublicacionesComponent;
  let fixture: ComponentFixture<MisPublicacionesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisPublicacionesComponent],
      providers: [
        provideFirebaseApp(() => initializeApp(environment.firebase)),
        provideAuth(() => getAuth()),
        provideFirestore(() => getFirestore()),
        provideStorage(() => getStorage()),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MisPublicacionesComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
