import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { EcoReportComponent } from './eco-report/eco-report.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'eco-report', component: EcoReportComponent }
];
