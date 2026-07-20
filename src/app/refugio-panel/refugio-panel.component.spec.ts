import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideRouter } from '@angular/router';
import { environment } from 'src/environments/environment';
import { RefugioPanelComponent } from './refugio-panel.component';

describe('RefugioPanelComponent', () => {
  let component: RefugioPanelComponent;
  let fixture: ComponentFixture<RefugioPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefugioPanelComponent],
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

    fixture = TestBed.createComponent(RefugioPanelComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
