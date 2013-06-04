var expect = require('chai').expect;
var sandbox = require('sandboxed-module');
var libpath = process.env.COVERAGE ? '../lib-cov' : '../lib';
var lsLayouts = require(libpath + '/log4js-elasticsearch-layouts').esTemplateMakers.logstash;

describe('When passing options to the es-template', function() {
  it('Must return the template when no options are passed', function() {
    var r = lsLayouts('test');
    expect(r.template).to.equal('test');
  });
  it('Must keep the default value when no options are passed', function() {
    var r = lsLayouts('test');
    expect(r.settings['index.query.default_field']).to.equal('@message');
  });
  it('Must override the number of shards via the options', function() {
    var r = lsLayouts('test', {settings: { number_of_shards: 1 }});
    expect(r.settings.number_of_shards).to.equal(1);
  });
  it('Must override the total_shards_per_node via the options', function() {
    var r = lsLayouts('test', {settings: { 'index.routing.allocation.total_shards_per_node': 10 }});
    expect(r.settings['index.routing.allocation.total_shards_per_node']).to.equal(10);
  });
  it('Must delete the index.cache.field.type via the options', function() {
    var r = lsLayouts('test', {settings: { 'index.cache.field.type': '__delete__' }});
    expect(r.settings['index.cache.field.type']).to.not.exist;
  });
  it('Must enable the _all field via the options', function() {
    var r = lsLayouts('test', {mappings: { _default_: { _all: {enabled: true} } }});
    expect(r.mappings._default_._all.enabled).to.equal(true);
  });
});
