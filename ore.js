/* See license.txt for terms of usage */

var iter = require('./iter');
var query = require('./query').query;
var events = require('./events');
var ajax = require('./ajax');

var $ = exports.query = query;
iter.extend($, iter);
iter.extend($, ajax);
iter.extend($, events);
