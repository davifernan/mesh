import { registerApp } from '../../app/state/microappCatalog';

registerApp({
  id: 'spotify',
  name: 'Spotify',
  description: 'Listen to music together',
  icon: '🎵',
  category: 'media',
  widgetUrl: '/spotify.html?widgetId=$matrix_widget_id&parentUrl=$matrix_client_origin',
  capabilities: ['eu.bettercord.apps.spotify', 'm.room.power_levels'],
});
