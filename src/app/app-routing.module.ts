import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TrackJacketComponent } from './track-jacket/track-jacket.component';
import { TeeTimesComponent } from './tee-times/tee-times.component';
import { PastChampsComponent } from './past-champs/past-champs.component';

const routes: Routes = [
  { path: 'tee-times', component: TeeTimesComponent },
  { path: 'track-jacket', component: TrackJacketComponent },
  { path: 'past-champions', component: PastChampsComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
