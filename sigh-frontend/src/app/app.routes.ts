import { Routes } from '@angular/router';
import { Login } from './login/login'; 
import { Dashboard } from './dashboard/dashboard'; // Asegúrate de importar tu Dashboard aquí

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'dashboard', component: Dashboard },
  { path: '**', redirectTo: 'login' }
];