import { Component, signal } from '@angular/core';

import { ColumnComponent } from '@app/components/layout/column/column.component';
import { PageComponent } from '@app/components/layout/page/page.component';
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
import { Tab, TabsComponent } from '@app/components/ui/tabs/tabs.component';

type Partie = 'typescript' | 'angular' | 'layout';

/** La page « Apprendre » : les leçons, rangées en trois onglets. */
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
  ],
  templateUrl: './learn.component.html',
  styleUrl: './learn.component.scss',
})
export class LearnComponent {
  readonly parties: Tab<Partie>[] = [
    { id: 'typescript', label: '1. TypeScript', icon: 'code' },
    { id: 'angular', label: '2. Angular', icon: 'learn' },
    { id: 'layout', label: '3. Mise en page', icon: 'layout' },
  ];
  readonly partie = signal<Partie>('typescript');
}
