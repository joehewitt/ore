
var _ = require('underscore');

// *************************************************************************************************

exports.Binder = function() {
    this.bindings = {};
    this.values = {};
}

exports.Binder.prototype = {
    persist: function() {
        if (this.storageKey) {
            localStorage[this.storageKey] = JSON.stringify(this.values);
        }
    },

    restore: function(storageKey, defaults) {
        this.storageKey = storageKey;
        this.values = {};

        var values = localStorage[storageKey];
        if (values) {
            values = JSON.parse(values);
        } else {
            values = {};
        }

        for (var key in defaults) {
            var value = key in values ? values[key] : defaults[key];
            this.dispatch(key, value, true);
        }
    },

    bind: function(key, object, property) {
        var keyBindings = this.bindings[key];
        if (!keyBindings) {
            keyBindings = [];
            this.bindings[key] = keyBindings;
        }
        keyBindings.push(object, property);
    },

    unbind: function(key, object, property) {
        var keyBindings = this.bindings[key];
        if (keyBindings) {
            var newBindings = [];
            for (var i = 0, l = keyBindings.length; i < l; i += 2) {
                var bindingObject = keyBindings[i];
                var bindingProperty = keyBindings[i+1];
                if (!(bindingObject == bindingObject && bindingProperty == property)) {
                    newBindings.push(bindingObject, bindingProperty);
                }
            }
            this.bindings[key] = newBindings
        }
    },

    dispatch: function(key, value, dontPersist) {
        var oldValue = this.values[key];
        if (value != oldValue) {
            this.values[key] = value;

            var keyBindings = this.bindings[key];
            for (var i = 0, l = keyBindings ? keyBindings.length : 0; i < l; i += 2) {
                var bindingObject = keyBindings[i];
                var bindingProperty = keyBindings[i+1];
                bindingObject[bindingProperty] = value;
            }
        }

        if (!dontPersist) {
            this.persist();
        }
    }
};

var binder = new exports.Binder();
exports.binder = binder;

// *************************************************************************************************

exports.Bindable = function() {

}

exports.Bindable.prototype = {
    addBinding: function(property, key) {
        if (!this.bindings) {
            this.bindings = {};
        }
        if (property in this.bindings) {
            this.bindings[property].push(key);
        } else {
            var propertyBindings = [key];
            this.bindings[property] = propertyBindings;
            binder.bind(key, this, property);

            wrapProperty(this, property);
        }
    },

    removeBinding: function(property, key) {
        if (this.bindings && property in this.bindings) {
            var propertyBindings = this.bindings[property];
            var index = propertyBindings.indexOf(key);
            if (index != -1) {
                propertyBindings.splice(index, 1);
            }
        }
        binder.unbind(key, this, property);
    },
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
                    var key = propertyBindings[i];
                    binder.dispatch(key, value);
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
