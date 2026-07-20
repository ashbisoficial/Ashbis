import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from 'src/environments/environment';
import { RefugioChatComponent } from './refugio-chat.component';

describe('RefugioChatComponent', () => {
  let component: RefugioChatComponent;
  let fixture: ComponentFixture<RefugioChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefugioChatComponent],
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

    fixture = TestBed.createComponent(RefugioChatComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
