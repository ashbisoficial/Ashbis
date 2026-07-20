import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from 'src/environments/environment';
import { RefugioFinanzasComponent } from './refugio-finanzas.component';

describe('RefugioFinanzasComponent', () => {
  let component: RefugioFinanzasComponent;
  let fixture: ComponentFixture<RefugioFinanzasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefugioFinanzasComponent],
      providers: [
        provideFirebaseApp(() => initializeApp(environment.firebase)),
        provideAuth(() => getAuth()),
        provideFirestore(() => getFirestore()),
        provideStorage(() => getStorage()),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ refugioUid: 'test-uid' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RefugioFinanzasComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
