import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from 'src/environments/environment';
import { ChatDirectoComponent } from './chat-directo.component';

describe('ChatDirectoComponent', () => {
  let component: ChatDirectoComponent;
  let fixture: ComponentFixture<ChatDirectoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatDirectoComponent],
      providers: [
        provideFirebaseApp(() => initializeApp(environment.firebase)),
        provideAuth(() => getAuth()),
        provideFirestore(() => getFirestore()),
        provideStorage(() => getStorage()),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ chatId: 'test-chat-id' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatDirectoComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
