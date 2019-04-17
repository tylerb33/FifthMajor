import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { PastChampsComponent } from './past-champs.component';

describe('PastChampsComponent', () => {
  let component: PastChampsComponent;
  let fixture: ComponentFixture<PastChampsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ PastChampsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PastChampsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
