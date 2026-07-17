import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { CarnetMascotaPage } from './carnet-mascota.page';

describe('CarnetMascotaPage', () => {
  let component: CarnetMascotaPage;
  let fixture: ComponentFixture<CarnetMascotaPage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [CarnetMascotaPage],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'test-id' }) } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CarnetMascotaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
