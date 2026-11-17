// La app está en español: así Siri lee las frases de app-intents/ como español y no como inglés.
const { withXcodeProject, withInfoPlist } = require('expo/config-plugins');

module.exports = function withSpanish(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.CFBundleDevelopmentRegion = 'es';
    c.modResults.CFBundleLocalizations = ['es'];
    return c;
  });
  return withXcodeProject(config, (c) => {
    const project = c.modResults.getFirstProject().firstProject;
    project.developmentRegion = 'es';
    project.knownRegions = [...new Set(['es', 'Base', ...(project.knownRegions ?? [])])];
    return c;
  });
};
