/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Django REST API, including the `/api` prefix, e.g. http://127.0.0.1:8000/api */
  readonly VITE_API_BASE_URL?: string;
  /** @deprecated superseded by VITE_API_BASE_URL */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
