
var _ = require('underscore'),
    fool = require('fool'),
    $ = require('./query'),
    bindings = require('./bindings'),
    events = require('./events');

var womb = null;
var NoInit = {};

// *************************************************************************************************

function Tag(tagName, baseTag) {
    this.tagName = tagName;
    this.baseTag = baseTag;
    this.attrs = {};
    this.classes = null;
    this.styles = null;
    this.props = null;
    this.listeners = null;
    this.bindings = null;
    this.children = [];
    this.vars = baseTag ? _.clone(baseTag.vars) : [];
    this.symbols = baseTag ? _.clone(baseTag.symbols) : {};
    this.params = baseTag ? _.clone(baseTag.params) : null;
    this.hasClasses = baseTag ? baseTag.hasClasses : false;
    this.hasStyles = baseTag ? baseTag.hasStyles : false;
    this.hasListeners = baseTag ? baseTag.hasListeners : false;
    this.hasBindings = baseTag ? baseTag.hasBindings : false;
    this.hasProps = baseTag ? baseTag.hasProps : false;
    this.hasDefinition = baseTag ? baseTag.hasDefinition : false;
}

Tag.prototype = {
    instantiate: function(instance, params, context, noInit) {
        if (noInit != NoInit) {
            var nodes = this.insert(params, context||instance);
            if (!instance.nodes) {
                instance.assign(nodes);
            }
        }
    },
    
    merge: function(className, attrs, children, definition) {
        if (attrs instanceof Array) {
            definition = children;
            children = attrs;
            attrs = null;
        }

        if (className) {
            if (!this.classes) {
                this.classes = {};
                this.hasClasses = true;
            }

            _.each(className.split('.'), _.bind(function(name) {
                if (name) {
                    this.classes[name] = 1;
                }
            }, this));
        }

        if (children) {
            parseChildren(children, this.vars, this.symbols, this.children);
        }

        if (attrs) {
            this.parseAttrs(attrs, this.baseTag ? this.baseTag.symbols : null);
        }
        
        if (definition) {
            this.hasDefinition = true;
            return definition;
        }
    },

    parseAttrs: function(args, inheritedSymbols) {
        for (var name in args) {
            var val = parseValue(args[name]);
            readPartNames(val, this.vars, this.symbols);

            if (name.indexOf("on") == 0) {
                var eventName = name.substr(2);
                if (!this.listeners)
                    this.listeners = [];
                this.listeners.push(eventName, val);
                this.hasListeners = true;
            } else if (name[0] == "_") {
                var propName = name.substr(1);
                if (!this.props)
                    this.props = {};
                this.props[propName] = val;
                this.hasProps = true;
            } else if (name[0] == "$" && name[1] == "$") {
                var styleName = name.substr(2);
                if (!this.styles)
                    this.styles = {};
                this.styles[styleName] = val;
                this.hasStyles = true;
            } else if (name[0] == "$") {
                var className = name.substr(1);
                if (!this.classes) {
                    this.classes = {};
                    this.hasClasses = true;
                }
                this.classes[className] = val;
            } else if (name[0] == "@") {                
                var bindingName = name.substr(1);
                if (!this.bindings)
                    this.bindings = [];
                this.bindings.push(bindingName, val);
                this.hasBindings = true;
            } else {
                if (name == "class" && this.attrs.hasOwnProperty(name)) {
                    this.attrs[name] += " " + val;
                    this.hasClasses = true;
                } else if (name == "style") {
                    this.attrs[name] = val;
                    this.hasStyles = true;
                } else if (inheritedSymbols && inheritedSymbols[name]) {
                    if (!this.params) {
                        this.params = {};
                    }
                    this.params[name] = val;
                } else {
                    this.attrs[name] = val;
                }
            }
        }
    },

    compile: function() {
        if (!this.renderMarkup) {
            this.compileMarkup();
            this.compileDOM();
        }
    },

    compileMarkup: function() {
        this.staticArgs = [];
        var topBlock = [], topOuts = [], blocks = [];
        var info = {args: this.staticArgs, argIndex: 0, paramIndex: 0, stack: []};
         var lhs = ['__context__', '__args__'];
         
        this.generateMarkup(topBlock, topOuts, blocks, info, true, lhs);
        this.addCode(topBlock, topOuts, blocks);

        var fnBlock = ['(function() { return function (__context__, __args__, __code__, __out__'];
        for (var i = 0; i < info.argIndex; ++i) {
            fnBlock.push(', s', i);
        }
        fnBlock.push(') {');
        fnBlock.push.apply(fnBlock, blocks);
        fnBlock.push('};})()');

        var sandbox = {
            NoInit: NoInit,
            _: _,

            __escape__: function(value) {
                function replaceChars(ch) {
                    switch (ch) {
                        case "<":
                            return "&lt;";
                        case ">":
                            return "&gt;";
                        case "&":
                            return "&amp;";
                        case "'":
                            return "&#39;";
                        case '"':
                            return "&quot;";
                    }
                    return "?";
                }
                return String(value).replace(/[<>&"']/g, replaceChars);
            },

            __embed__: function(tag, code, outputs, context, args) {
                if (!tag || !tag.tag)
                    return;

                tag.tag.compile();

                var tagOutputs = [];
                var markupArgs = [context, args, code, tagOutputs];
                markupArgs.push.apply(markupArgs, tag.tag.staticArgs);
                tag.tag.renderMarkup.apply(tag.tag.proto, markupArgs);

                outputs.push(tag);
                outputs.push(tagOutputs);
            },

            __loop__: function(varName, iter, outputs, fn) {
                var iterOuts = [];
                outputs.push(iterOuts);

                if (iter) {
                    var valueHolder = {};
                    for (var i = 0; i < iter.length; ++i) {
                        valueHolder[varName] = iter[i];
                        var itemOuts = [0,0];
                        iterOuts.push(itemOuts);
                        fn.apply(this, [i, valueHolder, itemOuts]);
                    }
                }
            },

            __if__: function(booleanVar, outputs, fn) {
                var ifControl = [];
                outputs.push(ifControl);

                if (booleanVar) {
                  ifControl.push(1);
                  fn.apply(this, [ifControl]);
                } else {
                  ifControl.push(0);
                }
            },

            __get__: function(name, bound) {
                for (var i = arguments.length-1; i > 1; --i) {
                    var obj = arguments[i];
                    var v = obj[name];
                    if (v !== undefined) {
                        if (bound && v) {
                            v = _.bind(v, obj);
                        }
                        return v;
                    }
                }
                console.log('WARNING: "'+name+'" not found');
            }
        };

        var js = fnBlock.join("");
        // console.log(js.replace(/(\;|\{)/g, "$1\n"));
        this.renderMarkup = sandboxEval(js, sandbox);
    },

    getVarNames: function(names) {
        if (this.vars) {
            names.push.apply(names, this.vars);
        }
        
        for (var i = 0; i < this.children.length; ++i) {
            var child = this.children[i];
            if (isTag(child)) {
                child.tag.getVarNames(names);
            } else if (child instanceof Parts) {
                for (var i = 0; i < child.parts.length; ++i) {
                    if (child.parts[i] instanceof Variables) {
                        var name = child.parts[i].names[0];
                        var names = name.split(".");
                        names.push(names[0]);
                    }
                }
            }
        }
    },
    
    generateMarkup: function(topBlock, topOuts, blocks, info, isRoot, lhs) {
        var lhs2 = [];

        var paramsName;
        if (this.params) {
            this.addCode(topBlock, topOuts, blocks);
            
            paramsName = 'params' + info.paramIndex++;
            blocks.push('var ' + paramsName + ' = {');
            for (var name in this.params) {
                blocks.push('"' + name + '": ');
                // XXXjoe Will need to concatenate strings!
                addParts(this.params[name], '', '', blocks, info);
                blocks.push(',');
            }
            blocks.push('};');

            if (isRoot) {
                blocks.push('_.extend(' + paramsName + ', __args__);');
            }
            lhs2.push(paramsName);
        } else if (isRoot) {
            paramsName = '__args__';
            lhs2.push(paramsName);
        } else {
            paramsName = '{}';
        }
        
        if (this.hasDefinition) {
            this.addCode(topBlock, topOuts, blocks);
            
            info.args.push(this.cons);

            var oreName = 'v' + info.argIndex;
            var argName = 's' + info.argIndex++;
            
            topOuts.push(oreName);
            if (isRoot) {
                blocks.push('var ' + oreName + ' = this;');
            } else {
                blocks.push('var '+oreName+' = new '+argName+'('+paramsName+', null, NoInit);');
            }

            lhs2.push(oreName);
        }

        for (var tag = this; tag; tag = tag.baseTag) {
            var l = tag == this ? lhs : lhs2;
            if (tag.listeners) {
                for (var i = 0; i < tag.listeners.length; i += 2) {
                    readNames(tag.listeners[i+1], topOuts, l, true);
                }
            }
        }
        
        var map = {};
        for (var tag = this; tag; tag = tag.baseTag) {
            var l = tag == this ? lhs : lhs2;
            if (tag.props) {
                for (var name in tag.props) {
                    if (!(name in map)) {
                        readNames(tag.props[name], topOuts, l);
                        map[name] = 1;
                    }
                }
            }
        }
        
        topBlock.push(',"<', this.tagName, '"');

        map = {};
        for (var tag = this; tag; tag = tag.baseTag) {
            var l = tag == this ? lhs : lhs2;
            for (var name in tag.attrs) {
                if (name != "class" && !(name in map)) {
                    var val = tag.attrs[name];
                    topBlock.push(', " ', name, '=\\""');
                    addParts(val, ',', '', topBlock, info, true, l);
                    topBlock.push(', "\\""');
                    map[name] = 1;
                }
            }
        }
        
        if (this.hasClasses) {
            map = {};
            topBlock.push(', " class=\\""');
            for (var tag = this; tag; tag = tag.baseTag) {
                var l = tag == this ? lhs : lhs2;
                if (tag.attrs.hasOwnProperty("class") || tag.classes) {
                    if (tag.attrs.hasOwnProperty("class") && !('?' in map)) {
                        addParts(tag.attrs["class"], ',', '', topBlock, info, true, l);
                        topBlock.push(', " "');
                        map['?'] = 1;
                    }
                    for (var name in tag.classes) {
                        if (!(name in map)) {
                            topBlock.push(', (');
                            addParts(tag.classes[name], '', '', topBlock, info, false, l);
                            topBlock.push(' ? "', name, '" + " " : "")');
                            map[name] = 1;
                        }
                    }
                }
            }
            topBlock.push(', "\\""');
        }
        
        if (this.hasStyles) {
            map = {};
            topBlock.push(', " style=\\""');
            for (var tag = this; tag; tag = tag.baseTag) {
                var l = tag == this ? lhs : lhs2;
                if (tag.attrs.hasOwnProperty("style") || tag.styles) {
                    if (tag.attrs.hasOwnProperty("style") && !('?' in map)) {
                        addParts(tag.attrs["style"], ',', '', topBlock, info, true, l);
                        map['?'] = 1;
                    }
                    for (var name in tag.styles) {
                        if (!(name in map)) {
                            var val = tag.styles[name];
                            topBlock.push(', " ', name, ':"');
                            addParts(val, ',', '', topBlock, info, true, l);
                            topBlock.push(', ";"');
                            map[name] = 1;
                        }
                    }
                }
            }
            topBlock.push(', "\\""');
        }
        
        topBlock.push(',">"');

        this.generateChildMarkup(topBlock, topOuts, blocks, info, lhs, lhs2);
        
        topBlock.push(',"</', this.tagName, '>"');

        if (this.params || isRoot || this.hasDefinition) {
            this.addCode(topBlock, topOuts, blocks);
        }
    },

    generateChildMarkup: function(topBlock, topOuts, blocks, info, lhs, lhs2) {
        function generateTag(tag, l, insideOut) {
            if (tag.baseTag && !insideOut) {
                info.stack.push(tag.baseTag, l);
                generateTag(tag.baseTag, l);
            }

            var actual = info.stack[info.stack.length-2];
            if (actual == tag) {
                var l = info.stack.pop();
                info.stack.pop();

                for (var i = 0; i < tag.children.length; ++i) {
                    var child = tag.children[i];
                    if (isTag(child)) {
                        child.tag.generateMarkup(topBlock, topOuts, blocks, info, false, l);
                    } else if (child == HERE) {
                        var outerL = info.stack[info.stack.length-1];
                        var outer = info.stack[info.stack.length-2];
                        if (outer) {
                            generateTag(outer, outerL, true);    
                        }
                    } else {
                        addParts(child, ',', '', topBlock, info, true, lhs);
                    }
                }
            }
        }

        var rootTag = this;
        info.stack.push(this, lhs);
        generateTag(this, lhs2);
    },

    addCode: function(topBlock, topOuts, blocks) {
        if (topBlock.length)
            blocks.push('    __code__.push(""', topBlock.join(""), ');');
        if (topOuts.length)
            blocks.push('__out__.push(', topOuts.join(","), ');');
        topBlock.splice(0, topBlock.length);
        topOuts.splice(0, topOuts.length);
    },

    addLocals: function(blocks) {
        var varNames = [];
        this.getVarNames(varNames);

        var map = {};
        for (var i = 0; i < varNames.length; ++i) {
            var name = varNames[i];
            if (map.hasOwnProperty(name))
                continue;

            map[name] = 1;
            var names = name.split(".");
            blocks.push('var ', names[0] + ' = ' + '__args__.' + names[0] + ';');
        }
    },

    compileDOM: function() {
        var path = [];
        var blocks = [];
        this.staticDOMArgs = [];
        path.embedIndex = 0;
        path.loopIndex = 0;
        path.ifIndex = 0;
        path.staticIndex = 0;
        path.renderIndex = 0;
        path.nodeIndex = 0;

        var nodeCount = this.generateDOM(path, blocks, this.staticDOMArgs, []);

        var fnBlock = ['(function() { return function (root, o'];
        for (var i = 0; i < path.staticIndex; ++i)
            fnBlock.push(', ', 's'+i);
        for (var i = 0; i < path.renderIndex; ++i)
            fnBlock.push(', ', 'd'+i);
        fnBlock.push(') {');

        for (var i = 0; i < path.loopIndex; ++i)
            fnBlock.push('  var l', i, ' = 0;');
        for (var i = 0; i < path.ifIndex; ++i)
            fnBlock.push('  var if_', i, ' = 0;');
        for (var i = 0; i < path.embedIndex; ++i)
            fnBlock.push('  var e', i, ' = 0;');

        fnBlock.push(blocks.join(""));

        fnBlock.push('  return ', nodeCount, ';');
        fnBlock.push('};})()');

        var sandbox = {
            NoInit: NoInit,
            _: _,

            __embed__: function(node, tag, dynamicArgs) {
                if (!tag || !tag.tag)
                    return;

                tag.tag.compile();

                var domArgs = [node, 0];
                domArgs.push.apply(domArgs, tag.tag.staticDOMArgs);
                domArgs.push.apply(domArgs, dynamicArgs);

                return tag.tag.renderDOM.apply(tag.tag.proto, domArgs);
            },

            __loop__: function(iter, fn) {
                var nodeCount = 0;
                for (var i = 0; i < iter.length; ++i) {
                    iter[i][0] = i;
                    iter[i][1] = nodeCount;
                    nodeCount += fn.apply(this, iter[i]);
                }

                return nodeCount;
            },

            __if__: function(control, fn) {
                if (control[0]) {
                  fn.apply(this, [0,control[1]]);
                } else {
                  // We need to skip it
                }
            },

            __path__: function(parent, offset) {
                var root = parent;

                for (var i = 2; i < arguments.length; ++i) {
                    var index = arguments[i];

                    if (i == 3)
                        index += offset;

                    if (index == -1) {
                        parent = parent.parentNode;
                    } else {
                        parent = parent.childNodes[index];
                    }    
                }

                return parent;
            },

            __listen__: function(node, object, name, cb) {
                var e = object[name];
                if (e == events.event) {
                    e = object[name] = e.create();
                }
                if (e && e.addListener) {
                    e.addListener(cb);
                } else {
                    node.addEventListener(name, cb, false);
                }
            },

            __bind__: function(node, object, propName, keyName) {
                object.addBinding(propName, keyName);
            }
        };
        
        var js = fnBlock.join("");
        // console.log(js.replace(/(\;|\{)/g, "$1\n"));
        // js = js.replace(/(\;|\{)/g, "$1\n");
        this.renderDOM = sandboxEval(js, sandbox);
    },

    generateDOM: function(path, blocks, args, stack) {
        var thisName = 'this';
        var nodeName = 'n' + path.nodeIndex++;

        if (this.hasListeners || this.hasBindings || this.hasProps || this.hasDefinition) {
            this.addNodePath(nodeName, path, blocks);
        }
        
        if (this.hasDefinition) {
            thisName = 'd' + path.renderIndex++;
            blocks.push(thisName + '.assign('+nodeName+');');
        }
        

        for (var tag = this; tag; tag = tag.baseTag) {
            if (tag.listeners) {
                for (var i = 0; i < tag.listeners.length; i += 2) {
                    var val = tag.listeners[i+1];
                    var arg = generateArg(val, path, args);
                    blocks.push('__listen__(',nodeName, ',',thisName,', "', tag.listeners[i],
                                '", _.bind(', arg, ', ', thisName, '));');
                }
            }
            if (tag.bindings) {
                for (var i = 0; i < tag.bindings.length; i += 2) {
                    var val = tag.bindings[i+1];
                    var arg = generateArg(val, path, args);
                    blocks.push('__bind__(',nodeName,', ',thisName,', "', tag.bindings[i],
                                '", ', arg, ');');
                }
            }
        }

        var propBlocks = [];
        for (var tag = this; tag; tag = tag.baseTag) {
            if (tag.props) {
                for (var name in tag.props) {
                    var val = tag.props[name];
                    var arg = generateArg(val, path, args);
                    if (tag.hasDefinition) {
                        propBlocks.push(thisName+'.', name, ' = ', arg, ';');
                    } else {
                        propBlocks.push(nodeName,'.', name, ' = ', arg, ';');
                    }
                }
            }
        }

        this.generateChildDOM(path, blocks, args, stack, thisName);
        
        blocks.push.apply(blocks, propBlocks);

        if (this.hasDefinition) {
            blocks.push(thisName + '.init();');
        }

        return 1;
    },

    addNodePath: function(nodeName, path, blocks) {
        blocks.push("        var " + nodeName + " = " + generateNodePath(path) + ';');
    },

    generateChildDOM: function(path, blocks, args, stack, thisName) {
        function generateTag(tag, insideOut) {
            if (tag.baseTag && !insideOut) {
                stack.push(tag.baseTag, thisName, path.length-1);
                generateTag(tag.baseTag);
            }

            var actual = stack[stack.length-3];
            if (actual == tag) {
                stack.pop();
                stack.pop();
                stack.pop();

                for (var i = 0; i < tag.children.length; ++i) {
                    var child = tag.children[i];
                    if (isTag(child)) {
                        path[path.length-1] += '+'
                            + child.tag.generateDOM(path, blocks, args, stack);
                    } else if (child == HERE) {
                        if (stack.length) {
                            var outer = stack[stack.length-3];
                            var t = stack[stack.length-2];
                            var p = stack[stack.length-1];
                            var thisPath = generateNodePath(path.slice(0, p));
                            var slotPath = generateNodePath(path.slice(0, path.length-1));
                            blocks.push(thisPath + '.__slot__ = ' + slotPath + ';')
                            generateTag(outer, true);
                        } else {
                            var thisPath = generateNodePath(path.slice(0, path.length-2));
                            var slotPath = generateNodePath(path.slice(0, path.length-1));
                            blocks.push(thisPath + '.__slot__ = ' + slotPath + ';')                            
                        }
                    } else {
                        path[path.length-1] += '+1';
                    }
                }
            }
        }

        path.push(0);
        stack.push(this, thisName, path.length-1);
        var rootTag = this;
        generateTag(this);
        path.pop();
    },
    
    // ---------------------------------------------------------------------------------------------
    
    createHTML: function(args, outputs, context) {
        var code = [];
        var markupArgs = [context, args||{}, code, outputs];
        markupArgs.push.apply(markupArgs, this.staticArgs);
        this.renderMarkup.apply(context, markupArgs);
        return code.join("");
    },
    
    createDOM: function(html, outputs, context, parent) {
        if (!parent) {
            parent = exports.getWomb();
        }

        parent.innerHTML = html;
        
        var domArgs = [parent.firstChild, 0];
        domArgs.push.apply(domArgs, this.staticDOMArgs);
        domArgs.push.apply(domArgs, outputs);
        this.renderDOM.apply(context, domArgs);

        return parent.firstChild;
    },
    
    insert: function(args, context, parent) {
        if (parent instanceof TagSet) {
            parent = parent.val();
        }
        
        this.compile();

        var outputs = [];
        var html = this.createHTML(args, outputs, context);
        var firstChild = this.createDOM(html, outputs, context, parent);

        if (!parent && firstChild) {
            var womb = firstChild.parentNode;
            var nodes = $.slice(womb.childNodes, 0);
            var result = nodes.length > 1 ? nodes : nodes[0];
            // womb.innerHTML = '';
            womb.removeChild(result);
            return result;
        }
    }    
};

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

function Embed() {}

Embed.prototype = fool.subclass(Tag, {
    merge: function(value, params) {
        this.value = parseValue(value);
        this.params = {};
        this.vars = [];

        for (var name in params) {
            var val = parseValue(params[name]);
            this.params[name] = val;
            readPartNames(val, this.vars, this.symbols);
        }
    },

    getVarNames: function(names) {
        if (this.value instanceof Parts)
            names.push(this.value.parts[0].name);

        if (this.vars)
            names.push.apply(names, this.vars);
    },

    generateMarkup: function(topBlock, topOuts, blocks, info, isRoot, lhs) {
        this.addCode(topBlock, topOuts, blocks);

        blocks.push('__embed__(');
        addParts(this.value, '', '', blocks, info, false, lhs);
        blocks.push(', __code__, __out__, this, {');

        var lastName = null;
        for (var name in this.params) {
            if (lastName)
                blocks.push(',');
            lastName = name;

            var val = this.params[name];
            blocks.push('"', name, '": ');
            addParts(val, '', '', blocks, info, false, lhs);
        }

        blocks.push('});');
        //this.generateChildMarkup(topBlock, topOuts, blocks, info, lhs);
    },

    generateDOM: function(path, blocks, args, stack) {
        var embedName = 'e'+path.embedIndex++;
        var nodeName = 'n'+path.nodeIndex++;
        var valueName = 'd' + path.renderIndex++;
        var argsName = 'd' + path.renderIndex++;

        this.addNodePath(nodeName, path, blocks);
        
        blocks.push('        ',embedName + ' = __embed__(',nodeName, ',', valueName, ', ',
                    argsName, ');');

        return embedName;
    }
});

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

function Loop() {
    this.vars = [];
    this.children = [];
}

Loop.prototype = fool.subclass(Tag, {
    merge: function(varName, iter, children) {
        this.varName = varName;
        this.iter = parseValue(iter);
        parseChildren(children, this.vars, this.symbols, this.children);
    },
    
    getVarNames: function(names) {
        if (this.iter instanceof Parts)
            names.push(this.iter.parts[0].name);

        Tag.prototype.getVarNames.apply(this, [names]);
    },

    generateMarkup: function(topBlock, topOuts, blocks, info, isRoot, lhs) {
        this.addCode(topBlock, topOuts, blocks);

        if (isRoot) {
            lhs.push('__args__');
        }

        var iterName;
        if (this.iter instanceof Parts) {
            var part = this.iter.parts[0];
            iterName = getName(part.names[0], lhs);

            if (part.format) {
                for (var i = 0; i < part.format.length; ++i) {
                    iterName = getName(part.format[i], lhs) + "(" + iterName + ")";
                }
            }

        } else {
            iterName = this.iter;
        }
        
        blocks.push('    __loop__.apply(this, [', '"', this.varName, '", ',
                    iterName, ', __out__, function(i, ', this.varName, ', __out__) {');
        lhs.push(this.varName);
        this.generateChildMarkup(topBlock, topOuts, blocks, info, lhs);
        lhs.pop();
        this.addCode(topBlock, topOuts, blocks);
        blocks.push('    }]);');

        if (isRoot) {
            lhs.pop();
        }
    },

    generateDOM: function(path, blocks, args, stack) {
        var iterName = 'd'+path.renderIndex++;
        var counterName = 'i'+path.loopIndex;
        var loopName = 'l'+path.loopIndex++;

        if (!path.length)
            path.push(-1, 0);

        var preIndex = path.renderIndex;
        path.renderIndex = 0;

        var nodeCount = 0;

        var subBlocks = [];
        var basePath = path[path.length-1];
        for (var i = 0; i < this.children.length; ++i) {
            path[path.length-1] = basePath+'+'+loopName+'+'+nodeCount;

            var child = this.children[i];
            if (isTag(child))
                nodeCount += '+' + child.tag.generateDOM(path, subBlocks, args, stack);
            else
                nodeCount += '+1';
        }

        path[path.length-1] = basePath+'+'+loopName;

        blocks.push('      ',loopName,' = __loop__.apply(this, [', iterName,
                    ', function(', counterName,',',loopName);
        for (var i = 0; i < path.renderIndex; ++i)
            blocks.push(',d'+i);
        blocks.push(') {');
        
        blocks.push(subBlocks.join(""));
        blocks.push('        return ', nodeCount, ';');
        blocks.push('      }]);');

        path.renderIndex = preIndex;

        return loopName;
    }
});

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

function If() {
    this.vars = [];
    this.children = [];
}

If.prototype = fool.subclass(Tag, {
    merge: function(condition, children) {
        this.booleanVar = parseValue(condition);
        parseChildren(children, this.vars, this.symbols, this.children);
    },

    getVarNames: function(names) {
        if (this.booleanVar instanceof Parts)
            names.push(this.booleanVar.parts[0].name);

        Tag.prototype.getVarNames.apply(this, [names]);
    },

    generateMarkup: function(topBlock, topOuts, blocks, info, isRoot, lhs) {
        this.addCode(topBlock, topOuts, blocks);

        if (isRoot) {
            lhs.push('__args__');
        }
        
        // Generate the expression to be used for the if(expr) { ... }
        var expr;
        if (this.booleanVar instanceof Parts) {
            // We have a function with optional aruments or just one variable
            var part = this.booleanVar.parts[0];
            
            // Join our function arguments or variables
            // If the user has supplied multiple variables without a function
            // this will create an invalid result and we should probably add an
            // error message here or just take the first variable
            expr = part.names.join(',');

            // Nest our functions
            if (part.format) {
                for (var i = 0; i < part.format.length; ++i)
                    expr = getName(part.format[i], lhs) + "(" + expr + ")";
            }
        } else {
            // We have just a simple function name without any arguments
            expr = this.booleanVar;
        }
        
        blocks.push('__if__.apply(this, [', expr, ', __out__, function(__out__) {');
        this.generateChildMarkup(topBlock, topOuts, blocks, info, lhs);
        this.addCode(topBlock, topOuts, blocks);
        blocks.push('}]);');

        if (isRoot) {
            lhs.pop();
        }
    },

    generateDOM: function(path, blocks, args, stack) {
        var controlName = 'd'+path.renderIndex++;
        var ifName = 'if_'+path.ifIndex++;

        if (!path.length)
            path.push(-1, 0);

        var preIndex = path.renderIndex;
        path.renderIndex = 0;

        var nodeCount = 0;

        var subBlocks = [];
       // var basePath = path[path.length-1];

        for (var i = 0; i < this.children.length; ++i)
        {
           // path[path.length-1] = basePath+'+'+ifName+'+'+nodeCount;

            var child = this.children[i];
            if (isTag(child))
                nodeCount += '+' + child.tag.generateDOM(path, subBlocks, args, stack);
            else
                nodeCount += '+1';
        }

       // path[path.length-1] = basePath+'+'+ifName;

        blocks.push('      ',ifName,' = __if__.apply(this, [', controlName, ', function(',ifName);
        for (var i = 0; i < path.renderIndex; ++i)
            blocks.push(',d'+i);
        blocks.push(') {');
        
        blocks.push(subBlocks.join(""));
       // blocks.push('        return ', nodeCount, ';');
        blocks.push('      }]);');

        path.renderIndex = preIndex;

        return controlName;
    }
});

// * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

function Variables(names,format) {
    this.names = names;
    this.format = format;
}

function Parts(parts) {
    this.parts = parts;
}

// ************************************************************************************************

function parseParts(str) {
    var index = 0;
    var parts = [];
    var m;

    var re = /\$([_A-Za-z][$_A-Za-z0-9.,|]*)/g;
    while (m = re.exec(str)) {
        var pre = str.substr(index, (re.lastIndex-m[0].length)-index);
        if (pre)
            parts.push(pre);

        var segs = m[1].split("|");
        var vars = segs[0].split(",$");

        parts.push(new Variables(vars, segs.slice(1)));
        
        index = re.lastIndex;
    }

    if (!index) {
        return str;
    }

    var post = str.substr(index);
    if (post)
        parts.push(post);


    return new Parts(parts);
}

function parseValue(val) {
    return typeof(val) == 'string' ? parseParts(val) : val;
}

function parseChildren(childrenArgs, vars, symbols, children) {
    _.each(childrenArgs || [], function(value) {
        var child = parseValue(value);
        children[children.length] = child;
        readPartNames(child, vars, symbols);
    });
}

function readPartNames(val, vars, symbols) {
    if (val instanceof Parts) {
        for (var i = 0; i < val.parts.length; ++i) {
            var part = val.parts[i];
            if (part instanceof Variables) {
                vars.push.apply(vars, part.names);
                
                if (symbols) {
                    for (var j = 0; j < part.names.length; ++j) {
                        var names = part.names[j].split('.');
                        symbols[names[0]] = 1;
                    }
                }
            }
        }
    }
}

function generateArg(val, path, args) {
    if (val instanceof Parts) {
        var vals = [];
        for (var i = 0; i < val.parts.length; ++i) {
            var part = val.parts[i];
            if (part instanceof Variables) {
                var varName = 'd'+path.renderIndex++;
                if (part.format) {
                    for (var j = 0; j < part.format.length; ++j) {
                        varName = part.format[j] + '(' + varName + ')';
                    }
                }

                vals.push(varName);
            }
            else {
                vals.push('"'+part.replace(/"/g, '\\"')+'"');
            }
        }

        return vals.join('+');
    } else {
        args.push(val);
        return 's' + path.staticIndex++;
    }
}

function generateNodePath(path) {
    var source = [];
    source.push("__path__(root, o");
    for (var i = 0; i < path.length; ++i) {
        source.push(",", path[i]);
    }
    source.push(")");
    return source.join('');
}

function getName(name, lhs, bound) {
    if (lhs && lhs.length) {
        var parts = name.split('.');
        name = '__get__("' + parts[0] + '",' + (bound ? '1,' : '0,') + lhs.join(',') + ')';
        if (parts.length > 1) {
            name = name + '.' + parts.slice(1).join('.');
        }
        return name;
    } else {
        return 'null';
    }
}

function getNames(names, lhs, bound) {
    return _.map(names, function(name) { return getName(name, lhs, bound); });
}


function readNames(val, vars, lhs, bound) {
    if (val instanceof Parts) {
        for (var i = 0; i < val.parts.length; ++i) {
            var part = val.parts[i];
            if (part instanceof Variables) {
                var name = getName(part.names[0], lhs, bound);
                vars.push(name);
            }
        }
    }
}

function addParts(val, delim, lead, block, info, escapeIt, lhs) {
    var vals = [];
    if (val instanceof Parts) {
        for (var i = 0; i < val.parts.length; ++i) {
            var part = val.parts[i];
            if (part instanceof Variables) {
                // Only grap one variable.
                // This is fine as we are not passing it to a function and only displaying it.
                var partName = getName(part.names[0], lhs);
                if (part.format) {
                    var partNames = [];
                    for (var j = 0; j < part.names.length; ++j) {
                        partNames.push(getName(part.names[j], lhs));
                    }
                    for (var j = 0; j < part.format.length; ++j) {
                        var format = part.format[j];
                        if (format == 'html') {
                            escapeIt = false;
                        } else {
                            partName = getName(format, lhs) + "("
                                + (partNames ? partNames.join(',') : partName)
                                + ")";
                            partNames = null;
                        }
                    }
                } else {
                    partName = getName(part.names[0], lhs)
                }

                if (escapeIt)
                    vals.push("__escape__(" + partName + ")");
                else
                    vals.push(partName);
            } else {
                vals.push('"'+ part + '"');
            }
        }
    } else if (isTag(val)) {
        info.args.push(val);
        vals.push('s'+info.argIndex++);
    } else {
        vals.push(JSON.stringify(val));
    }

    var parts = vals.join(delim);
    if (parts) {
        block.push(lead, delim, parts);
    }
}

exports.getWomb = function() {
    if (!womb) {
        womb = document.createElement("div");
    }
    return womb;
}

function isTag(obj) {
    return (typeof(obj) == "function" || obj instanceof Function) && !!obj.tag;
}

// *************************************************************************************************

function TagSet() {}

TagSet.prototype = fool.subclass($.Set, {
    slots: function() {
        return _.map(this.nodes, function(n) { return n.__slot__ ? n.__slot__ : n; });
    },
});

// *************************************************************************************************

function createTag(base) {
    function cons(params, context, noInit) {
        if (this instanceof cons) {
            var previousBinder;
            if (this.binder) {
                previousBinder = bindings.binder;
                bindings.binder = this.binder;
            }
            cons.tag.instantiate(this, params, context, noInit);
            if (previousBinder) {
                bindings.binder = previousBinder;
            }
        } else {
            var cons2 = createTag(cons.tag);
            var definition = cons2.tag.merge.apply(cons2.tag, arguments);
            fool.extend(cons2.prototype, definition);
            cons2.prototype.ready ? cons2.prototype.ready.apply(cons2.prototype, [cons2]) : 0;
            return cons2;
        }
    }
    
    if (typeof(base) == 'string') {
        cons.tag = new Tag(base);
        cons.prototype = fool.subclass(TagSet);
    } else {
        cons.tag = new Tag(base.tagName, base);
        cons.prototype = fool.subclass(base.cons);
    }

    cons.isTypeOf = function(otherType) {
        return this.tag.baseClass.tag == otherType.tag;
    }

    cons.tag.cons = cons;
    return cons;
}

function EMBED() {
    function cons() {}
    cons.prototype = fool.subclass(TagSet);
    var tag = new Embed();
    tag.merge.apply(tag, arguments);
    cons.tag = tag;
    return cons;
}

function FOR() {
    function cons(params, context, noInit) {
        if (this instanceof cons) {
            cons.tag.instantiate(this, params, context, noInit);
        }
    }
    cons.prototype = fool.subclass(TagSet);
    var tag = new Loop();
    tag.merge.apply(tag, arguments);
    cons.tag = tag;
    return cons;
}

function IF() {
    function cons() {}
    cons.prototype = fool.subclass(TagSet);
    var tag = new If();
    tag.merge.apply(tag, arguments);
    cons.tag = tag;
    return cons;
}

function HERE() {}

exports.tag = createTag;
exports.EMBED = EMBED;
exports.FOR = FOR;
exports.IF = IF;
exports.HERE = HERE;