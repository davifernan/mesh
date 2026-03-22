import { registerApp } from '../../app/state/microappCatalog';

registerApp({
  id: 'youtube',
  name: 'YouTube',
  description: 'Watch videos together in the room',
  icon: '📺',
  category: 'media',
  widgetUrl: '/youtube.html?widgetId=$matrix_widget_id&parentUrl=$matrix_client_origin',
  capabilities: [
    'eu.mesh.apps.youtube',
    'eu.mesh.apps.youtube.cmd',
    'm.room.power_levels',
  ],
});
