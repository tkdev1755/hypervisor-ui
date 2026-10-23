import { Component, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { PageComponent } from '@app/components/layout/page/page.component';
import { LessonAuthenticationComponent } from '@app/components/lessons/lesson-authentication/lesson-authentication.component';
import { LessonClassesComponent } from '@app/components/lessons/lesson-classes/lesson-classes.component';
import { LessonComponentComponent } from '@app/components/lessons/lesson-component/lesson-component.component';
import { LessonControlFlowComponent } from '@app/components/lessons/lesson-control-flow/lesson-control-flow.component';
import { LessonFunctionsComponent } from '@app/components/lessons/lesson-functions/lesson-functions.component';
import { LessonInputsOutputsComponent } from '@app/components/lessons/lesson-inputs-outputs/lesson-inputs-outputs.component';
import { LessonLayoutComponent } from '@app/components/lessons/lesson-layout/lesson-layout.component';
import { LessonObjectsComponent } from '@app/components/lessons/lesson-objects/lesson-objects.component';
import { LessonServicesComponent } from '@app/components/lessons/lesson-services/lesson-services.component';
import { LessonSignalsComponent } from '@app/components/lessons/lesson-signals/lesson-signals.component';
import { LessonVariablesComponent } from '@app/components/lessons/lesson-variables/lesson-variables.component';
import { LessonRoutingComponent } from '@app/components/lessons/lesson-routing/lesson-routing.component';
import { LessonModalsComponent } from '@app/components/lessons/lesson-modals/lesson-modals.component';
import { LessonCustomModalComponent } from '@app/components/lessons/lesson-custom-modal/lesson-custom-modal.component';
import { LessonContextBridgeComponent } from '@app/components/lessons/lesson-context-bridge/lesson-context-bridge.component';
import { LessonAdvancedSignalsComponent } from '@app/components/lessons/lesson-advanced-signals/lesson-advanced-signals.component';
import { LessonRxjsComponent } from '@app/components/lessons/lesson-rxjs/lesson-rxjs.component';
import { LessonInjectionComponent } from '@app/components/lessons/lesson-injection/lesson-injection.component';
import { Tab, TabsComponent } from '@app/components/ui/tabs/tabs.component';

type Partie = 'typescript' | 'angular' | 'layout' | 'avance';

/** La page « Apprendre » : les leçons, rangées en quatre onglets. */
@Component({
  selector: 'app-learn',
  imports: [
    PageComponent,
    ColumnComponent,
    TabsComponent,
    LessonVariablesComponent,
    LessonObjectsComponent,
    LessonFunctionsComponent,
    LessonClassesComponent,
    LessonComponentComponent,
    LessonSignalsComponent,
    LessonControlFlowComponent,
    LessonInputsOutputsComponent,
    LessonServicesComponent,
    LessonLayoutComponent,
    LessonRoutingComponent,
    LessonModalsComponent,
    LessonCustomModalComponent,
    LessonContextBridgeComponent,
    LessonAdvancedSignalsComponent,
    LessonRxjsComponent,
    LessonInjectionComponent,
    LessonAuthenticationComponent,
  ],
  templateUrl: './learn.component.html',
  styleUrl: './learn.component.scss',
})
export class LearnComponent {
  readonly parties: Tab<Partie>[] = [
    { id: 'typescript', label: '1. TypeScript', icon: 'code' },
    { id: 'angular', label: '2. Angular', icon: 'learn' },
    { id: 'layout', label: '3. Mise en page', icon: 'layout' },
    { id: 'avance', label: '4. Avancé', icon: 'terminal' },
  ];
  readonly partie = signal<Partie>('typescript');
}
