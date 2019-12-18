const entries = require('object.entries');

const ATTRIBUTE_PRESENT = {exists: true};

/**
 * _isWhere matching checks
 * `where` should be an object with keys you wish to match against a `target` object
 *
 * { attr: ATTRIBUTE_PRESENT } - If the value of a key is the ATTRIBUTE_PRESENT constant
 *                               we return false if the attribute is not a property of that
 *                               object. `'attr' in target`
 *
 * { attr: null } - Asserts that `target.attr === null`
 *
 * { attr: anotherObject } - Recurses using `_isWhere(where.attr, target.attr)`
 *
 * { type: String|Function } - Matches value checking `target.type`.
 *     When `target.type` is a function, it tests that `name`, `displayName` match the
 *     String given, or when a Function, that they are equal.
 *
 * { class: String } or { className: String } - Tests the `target.class || target.className` for
 *     the presence of the given string.  Will "split" the target class attribute into an array on
 *     whitespace, and returns false if the given class isn't present.
 *
 * { attr: value } - All other value/attribute combinations are a simple === test
 */

const _isWhere = (where, target) => {
  // Check each key from where
  for (const [key, value] of entries(where)) {
    // do not recurse into private keys
    if (key[0] === '_') {
      continue;
    }

    // If the key is set, but value is undefined, we ignore it
    if (typeof value === 'undefined') {
      continue;
    }

    // Allow a way to check for the pressenece of an attribute with that name.
    if (value === ATTRIBUTE_PRESENT) {
      if (!(key in target)) {
        return false;
      }
      continue;
    }

    // Null check
    if (value === null) {
      // eslint-disable-next-line no-prototype-builtins
      if (!target.hasOwnProperty(key)) {
        return false;
      }
      continue;
    }

    // Object checks (recursion)
    if (typeof value === 'object') {
      if (!(Boolean(target[key]) && _isWhere(value, target[key]))) {
        return false;
      }
      continue;
    }

    // type attributes
    if (key === 'type') {
      // if the target is a component
      if (typeof target.type === 'function') {
        // match the raw function value, name value, or displayName value
        if (target.type !== value && target.type.name !== value && target.type.displayName !== value) {
          return false;
        }
      }
      else if (/[a-z]/.test(value[0])) {
        // type starts with a lowercase letter = standard string types
        if (target.type !== value) {
          return false;
        }
      }
      else {
        // some unsupported type query
        return false;
      }
      continue;
    }

    if (key === 'class' || key === 'className') {
      let attr = target.class || target.className;
      if (!attr) {
        attr = [];
      }
      else if (typeof attr === 'string') {
        attr = attr.split(/\s+/);
      }
      else {
        return false;
      }

      if (!attr || attr.indexOf(value) === -1) {
        return false;
      }
      continue;
    }

    if (!target || target[key] !== value) {
      return false;
    }
  }
  return true;
};

const isWhere = where => value => _isWhere(where, value);

module.exports = {
  _isWhere,
  isWhere,
  ATTRIBUTE_PRESENT,
};
