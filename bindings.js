
var _ = require('underscore');

// *************************************************************************************************

exports.Binder = function() {
    this.bindings = {};
    this.values = {};
}

exports.Binder.prototype = {
    persist: function(storageKey) {
        if (storageKey) {
            this.storageKey = storageKey;   
        }
        if (this.storageKey) {
            localStorage[this.storageKey] = JSON.stringify(this.values);
        }
    },

    restore: function(storageKey, defaults) {
        this.storageKey = storageKey;

        var values;
        if (storageKey) {
            values = localStorage[storageKey];
            if (values) {
                values = JSON.parse(values);
            }
        }

        this.initialize(values || {}, defaults);
    },

    initialize: function(values, defaults) {
        this.values = {};

        var allKeys = _.extend(defaults, values);

        for (var key in allKeys) {
            var value = key in values ? values[key] : defaults[key];
            this.update(key, value, true);
        }
    },

    bind: function(key, object, property) {
        var keyBindings = this.bindings[key];
        if (!keyBindings) {
            keyBindings = [];
            this.bindings[key] = keyBindings;
        }
        keyBindings.push({object: object, property: property});
    },

    unbind: function(key, object, property) {
        var keyBindings = this.bindings[key];
        if (keyBindings) {
            var newBindings = [];
            for (var i = 0, l = keyBindings.length; i < l; ++i) {
                var binding = keyBindings[i];
                if (!(binding.object == object && binding.property == property)) {
                    newBindings.push(binding);
                }
            }
            this.bindings[key] = newBindings;
        }
    },

    listen: function(key, listener) {
        var keyBindings = this.bindings[key];
        if (!keyBindings) {
            keyBindings = [];
            this.bindings[key] = keyBindings;
        }
        keyBindings.push({listener: listener});
    },

    unlisten: function(key, listener) {
        var keyBindings = this.bindings[key];
        if (keyBindings) {
            var newBindings = [];
            for (var i = 0, l = keyBindings.length; i < l; ++i) {
                var binding = keyBindings[i];
                if (binding.listener != listener) {
                    newBindings.push(binding);
                }
            }
            this.bindings[key] = newBindings
        }
    },

    update: function(key, value, dontPersist) {
        var oldValue = this.values[key];
        if (value !== oldValue) {
            this.values[key] = value;

            var keyBindings = this.bindings[key];
            for (var i = 0, l = keyBindings ? keyBindings.length : 0; i < l; ++i) {
                var binding = keyBindings[i];
                if (binding.object) {
                    binding.object[binding.property] = value;
                } else {
                    binding.listener(key, value);
                }
            }
        }

        if (!dontPersist) {
            this.persist();
        }
    }
};

exports.binder = new exports.Binder();

// *************************************************************************************************

exports.Bindable = function() {

}

exports.Bindable.prototype = {
    addBinding: function(property, key, binder) {
        if (!this.bindings) {
            this.bindings = {};
        }  
        if (!binder) {
            binder = exports.binder;
        }

        var binding = {key: key, binder: binder};
        if (property in this.bindings) {
            this.bindings[property].push(binding);
        } else {
            wrapProperty(this, property);
            this[property] = binder.values[key];

            var propertyBindings = [binding];
            this.bindings[property] = propertyBindings;
            binder.bind(key, this, property);
        }
    },

    removeBinding: function(property, key, binder) {
        if (!binder) {
            binder = exports.binder;
        }
        if (this.bindings && property in this.bindings) {
            var propertyBindings = this.bindings[property];
            for (var i = 0, l = propertyBindings.length; i < l; ++i) {
                var binding = propertyBindings[i];
                if (binding.key == key) {                    
                    propertyBindings.splice(i, 1);
                    --i;
                }
            }            
        }
        binder.unbind(key, this, property);
    }
};

function wrapProperty(object, property) {
    var storageName = '_' + property;
    var getter = object.__lookupGetter__(property);
    var setter = object.__lookupSetter__(property);

    object.__defineSetter__(property, _.bind(function(value) {
        if (object[storageName] != value) {
            object[storageName] = value;

            if (object.bindings && property in object.bindings) {
                var propertyBindings = object.bindings[property]
                for (var i = 0, l = propertyBindings.length; i < l; ++i) {
                    var binding = propertyBindings[i];
                    binding.binder.update(binding.key, value);
                }
            }

            if (setter) {
                return setter.apply(object, [value]);
            } else {
                return value;
            }
        }
    }, object));

    if (!getter) {
        object.__defineGetter__(property, _.bind(function() {
            return object[storageName];
        }, object));
    } else {
        // Redefine the getter since defining the setter above will reset it
        object.__defineGetter__(property, getter);
    }    
}
