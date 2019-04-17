import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from './material';
import { MainNavComponent } from './main-nav/main-nav.component';
import { LayoutModule } from '@angular/cdk/layout';
import { MatToolbarModule, MatButtonModule, MatSidenavModule, MatIconModule, MatListModule } from '@angular/material';
import { TeeTimesComponent } from './tee-times/tee-times.component';
import { TrackJacketComponent } from './track-jacket/track-jacket.component';
import { PastChampsComponent } from './past-champs/past-champs.component';
import { AddScoreComponent } from './add-score/add-score.component';

@NgModule({
  declarations: [
    AppComponent,
    MainNavComponent,
    TeeTimesComponent,
    TrackJacketComponent,
    PastChampsComponent,
    AddScoreComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MaterialModule,
    LayoutModule,
    MatToolbarModule,
    MatButtonModule,
    MatSidenavModule,
    MatIconModule,
    MatListModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
