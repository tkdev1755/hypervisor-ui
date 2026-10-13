import { bootstrapApplication } from '@angular/platform-browser';

import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Le point de départ : Angular démarre l'application à partir de AppComponent.
bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
