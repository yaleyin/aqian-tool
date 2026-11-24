import type { AqianApi } from '@shared/api';

declare global {
  interface Window {
    aqian: AqianApi;
  }
}

export {};
