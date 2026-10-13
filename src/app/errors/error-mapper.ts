import { HttpErrorResponse } from '@angular/common/http';
import { InjectionToken, Provider, Type } from '@angular/core';

import { AppError, ErrorOrigin } from '../models/app-error.model';
import { ApiName } from '../utils/api-context';

/**
 * Un mapper sait traduire les erreurs d'UNE API en AppError. Chaque API parle à
 * sa façon (format du corps, codes HTTP) : on isole ce savoir dans un mapper par
 * API, au lieu de le disperser dans les composants.
 */
export interface ErrorMapper {
  readonly api: ApiName;
  map(error: HttpErrorResponse, origin: ErrorOrigin): AppError;
}

/** La liste de tous les mappers, remplie depuis app.config.ts. */
export const ERROR_MAPPERS = new InjectionToken<ErrorMapper[]>('ERROR_MAPPERS');

/** Dans app.config.ts : provideErrorMapper(HypervisorApiErrorMapper) */
export function provideErrorMapper(mapper: Type<ErrorMapper>): Provider {
  return { provide: ERROR_MAPPERS, useClass: mapper, multi: true };
}
