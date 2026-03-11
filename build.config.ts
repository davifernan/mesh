export default {
  base: '/',
  // URL to self-hosted nordeck/matrix-poll-widget Docker container.
  // Example: 'https://polls.your-domain.com'
  // Leave empty ('') to hide Polls from the app catalog.
  pollsWidgetUrl: '' as string,
  // URL to self-hosted nordeck/matrix-neoboard-widget Docker container.
  // Example: 'https://whiteboard.your-domain.com'
  // Leave empty ('') to hide Whiteboard from the app catalog.
  whiteboardWidgetUrl: '' as string,
};
