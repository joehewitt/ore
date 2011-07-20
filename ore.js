/* See license.txt for terms of usage */

var $ = require('./query');
var iter = require('./iter');
var events = require('./events');
var ajax = require('./ajax');

iter.extend($, iter);
iter.extend($, ajax);
iter.extend($, events);

module.exports = $;
