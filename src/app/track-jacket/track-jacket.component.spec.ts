import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TrackJacketComponent } from './track-jacket.component';

describe('TrackJacketComponent', () => {
  let component: TrackJacketComponent;
  let fixture: ComponentFixture<TrackJacketComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TrackJacketComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TrackJacketComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
