'use strict';

/**
 * Adapts @nestjs/swagger's CLI compiler plugin (which exports `before(options, program)`)
 * to the `{ name, version, factory(compilerInstance, options) }` shape ts-jest expects for
 * string-referenced `astTransformers` entries — the raw plugin module has no `factory` export,
 * so referencing it directly throws `beforeTransformer.factory is not a function`.
 *
 * @author Saulo Santos
 * @date 09/08/2026
 */
const plugin = require('@nestjs/swagger/plugin');

module.exports = {
  name: 'nestjs-swagger-plugin',
  version: '1',
  factory(compilerInstance, options) {
    return plugin.before(options, compilerInstance.program);
  },
};
