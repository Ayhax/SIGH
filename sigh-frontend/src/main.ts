import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app'; // <-- Importamos 'App' de forma directa

bootstrapApplication(App, appConfig) // <-- Arrancamos usando 'App'
  .catch((err) => console.error(err));
