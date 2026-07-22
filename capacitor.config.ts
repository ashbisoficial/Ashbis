import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'proyecto.ashbis2026',
  appName: 'Ashbis',
  webDir: 'www',
  // La app usa un único tema oscuro (ver global.scss, dark.always.css); esto
  // evita el flash blanco nativo antes de que el WebView pinte el contenido.
  backgroundColor: '#070707'
};

export default config;
