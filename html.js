/* See license.txt for terms of usage */

var $ = require('./tag');

function defineTags() {
    for (var i = 0; i < arguments.length; ++i) {
        var tagName = arguments[i];
        exports[tagName] = $.tag(tagName);
    }
}

defineTags(
    "a", "audio", "button", "br", "canvas", "col", "colgroup", "div", "fieldset", "form",
    "h1", "h2", "h3", "hr", "img", "input", "label", "legend", "li", "ol", "optgroup", "option",
    "p", "pre", "select", "span", "strong", "table", "tbody", "td", "textarea", "tfoot", "th",
    "thead", "tr", "tt", "ul", "video"
);

exports.EMBED = $.EMBED;
exports.FOR = $.FOR;
exports.IF = $.IF;
exports.HERE = $.HERE;
