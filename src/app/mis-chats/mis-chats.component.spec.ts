import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { provideRouter } from '@angular/router';
import { environment } from 'src/environments/environment';
import { MisChatsComponent } from './mis-chats.component';

describe('MisChatsComponent', () => {
  let component: MisChatsComponent;
  let fixture: ComponentFixture<MisChatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MisChatsComponent],
      providers: [
        provideFirebaseApp(() => initializeApp(environment.firebase)),
        provideAuth(() => getAuth()),
        provideFirestore(() => getFirestore()),
        provideStorage(() => getStorage()),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MisChatsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
