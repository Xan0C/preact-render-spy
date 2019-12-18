const {render, h, Component, cloneElement, toChildArray} = require('preact');
const {setupRerender} = require('preact/test-utils');
const isEqual = require('lodash.isequal');
const renderToString = require('preact-render-to-string/jsx');

const {isWhere} = require('./is-where');
const {selToWhere} = require('./sel-to-where');

const rerender = setupRerender();

const config = {
  SPY_PRIVATE_KEY: 'SPY_PRIVATE_KEY',
  createFragment: () => document.createDocumentFragment(),
  toStringOptions: {shallow: true, skipFalseAttributes: false},
};

const spyWalk = (context, vdom, depth) => {
  if (!vdom) {
    return vdom;
  }
  const spyCreator = depth > context.renderedDepth ? createNoopSpy : createSpy;
  if (typeof vdom.type === 'function' && !vdom.type.isSpy) {
    vdom = h(
      spyCreator(context, vdom.type),
      Object.assign({}, vdom.props, { [config.SPY_PRIVATE_KEY]: {vdom, depth} })
    );
  }
  else if (vdom.props && vdom.props.children) {
    const children = toChildArray(vdom.props && vdom.props.children)
      .map(child => spyWalk(context, child, depth));
    vdom = cloneElement(vdom, vdom.props, children);
  }
  return vdom;
};

const popSpyKey = _props => {
  const {vdom: spyKey, depth: spyDepth} = _props[config.SPY_PRIVATE_KEY];
  delete _props[config.SPY_PRIVATE_KEY];
  return [spyKey, spyDepth, _props];
};

const setVDom = (context, spyKey, vdom) => {
  context.vdomMap.set(spyKey, vdom);
  context.vdomRevision++;
  return vdom;
};

const NoopSpy = ()=>{};

const _createNoopSpy = (context, Component) => {
  return function(_props) {
    const [,, props] = popSpyKey(_props);
    const vdom = h(NoopSpy, Object.assign({ component: Component }, props));
    return vdom;
  };
};

const createFuncSpy = (context, Component) => {
  return function(_props, ...args) {
    const [spyKey, depth, props] = popSpyKey(_props);
    const output = Component.call(this, props, ...args);
    return spyWalk(context, setVDom(context, spyKey, output), depth + 1);
  };
};

const createClassSpy = (context, Component) => {
  class Spy extends Component {
    constructor(_props, ...args) {
      const [spyKey, spyDepth, props] = popSpyKey(_props);
      super(props, ...args);
      context.keyMap.set(this, spyKey);
      context.depthMap.set(this, spyDepth);
    }

    componentWillReceiveProps(_props, ...args) {
      const [spyKey, spyDepth, props] = popSpyKey(_props);
      context.keyMap.set(this, spyKey);
      context.depthMap.set(this, spyDepth);
      if (super.componentWillReceiveProps) {
        super.componentWillReceiveProps(props, ...args);
      }
    }

    render(...args) {
      const spyKey = context.keyMap.get(this);
      const spyDepth = context.depthMap.get(this);
      context.componentMap.set(spyKey, this);
      return spyWalk(context, setVDom(context, spyKey, super.render(...args)), spyDepth + 1);
    }
  }
  return Spy;
};

const createNoopSpy = (context, Component) => {
  if (context.componentNoopMap.get(Component)) {return context.componentNoopMap.get(Component);}

  const Spy = _createNoopSpy(context, Component);
  Spy.isSpy = true;

  context.componentNoopMap.set(Component, Spy);

  return Spy;
};

const createSpy = (context, Component) => {
  if (context.componentMap.get(Component)) {return context.componentMap.get(Component);}

  let Spy;
  if (!Component.prototype || !Component.prototype.render) {
    Spy = createFuncSpy(context, Component);
  }
  else {
    Spy = createClassSpy(context, Component);
  }

  Spy.isSpy = true;

  context.componentMap.set(Component, Spy);

  return Spy;
};

const vdomIter = function* (vdomMap, vdom) {
  if (vdom === null || vdom === undefined) {
    return;
  }
  yield vdom;
  if (typeof vdom.type === 'function' && vdomMap.has(vdom)) {
    const vdomNode = vdomMap.get(vdom);
    if (Array.isArray(vdomNode)) {
      for (let i=0; i < vdomNode.length; i++) {
        yield* vdomIter(vdomMap, vdomNode[i]);
      }
    } else {
      yield* vdomIter(vdomMap, vdomNode);
    }
  }
  else {
    for (const child of toChildArray(vdom.props && vdom.props.children)) {
      yield* vdomIter(vdomMap, child);
    }
  }
};

const vdomWalk = function* (vdomMap, iter) {
  for (const vdom of iter) {
    yield* vdomIter(vdomMap, vdom);
  }
};

const skip = function* (count, iter) {
  for (let i = 0; i < count; i++) {
    if (iter.next().done) {break;}
  }
  yield* iter;
};

const vdomFilter = (pred, vdomMap, vdom) => {
  return Array.from(skip(1, vdomIter(vdomMap, vdom))).filter(pred);
};

const verifyFoundNodes = wrapper => {
  if (wrapper.vdomRevision !== wrapper.context.vdomRevision) {
    console.warn('preact-render-spy: Warning! Performing operation on stale find() result.');
  }
};

const verifyOnlySingleNode = (wrapper, methodName) => {
  if (wrapper.length !== 1) {
    throw new Error(`preact-render-spy: ${methodName} method can only be used on a single node`);
  }
};

class FindWrapper {
  constructor(context, _iter, selector) {
    // Set a non-enumerable property for context. In case a user does an deep
    // equal comparison this removes the chance for recursive comparisons.
    setHiddenProp(this, 'context', context || this);
    setHiddenProp(this, 'vdomRevision', this.context.vdomRevision);
    this.length = 0;
    let iter = _iter;
    if (selector) {
      Object.defineProperty(this, 'selector', {enumerable: false, value: selector});
      iter = [].concat(...Array.from(iter, root => (
        Array.from(vdomFilter(isWhere(selToWhere(selector)), context.vdomMap, root))
      )));
    }
    iter
      .forEach((element, index) => {
        this[index] = element;
        this.length = index + 1;
      });
  }

  at(index) {
    if (index >= this.length) {
      throw new Error(`preact-render-spy: Must have enough results for .at(${index}).`);
    }
    verifyFoundNodes(this);

    return new FindWrapper(this.context, [this[index]]);
  }

  first() {
    if (this.length <= 0) {
      throw new Error(`preact-render-spy: Must have at least one result for .first().`);
    }
    return this.at(0);
  }

  last() {
    if (this.length <= 0) {
      throw new Error(`preact-render-spy: Must have at least one result for .last().`);
    }
    return this.at(this.length - 1);
  }

  attr(name) {
    if (this.length > 1 || this.length === 0) {
      throw new Error(`preact-render-spy: Must have only 1 result for .attr(${name})`);
    }
    verifyFoundNodes(this);

    const item = this[0];
    if (
      typeof item === 'object' &&
      item.props
    ) {
      return item.props[name];
    }
  }

  /**
   * Return an object copy of the attributes from the first node that matched.
   */
  attrs() {
    if (this.length > 1 || this.length === 0) {
      throw new Error('preact-render-spy: Must have only 1 result for .attrs().');
    }
    verifyFoundNodes(this);
    const props = Object.assign({}, this[0].props);
    delete props.children;
    return props;
  }

  /**
   * Return the text of all nested children concatenated together.
   */
  text() {
    verifyFoundNodes(this);
    return Array.from(vdomWalk(this.context.vdomMap, Array.from(this)))
      // Filter for primitive that can be converted to strings (text nodes)
      .filter(value => typeof value === 'string' || typeof value === 'number' || typeof value === "boolean" || typeof value === "undefined")
      // Concatenate all strings together
      .join('');
  }

  contains(vdom) {
    verifyFoundNodes(this);
    return Array.from(vdomWalk(this.context.vdomMap, Array.from(this)))
      .filter(value => isEqual(renderToString(vdom), renderToString(value)))
      .length > 0;
  }

  children() {
    verifyFoundNodes(this);
    verifyOnlySingleNode(this, 'children');

    return new FindWrapper(
      this.context,
      toChildArray(this[0].props && this[0].props.children)
    );
  }

  childAt(index) {
    return this.children().at(index);
  }

  exists() {
    verifyFoundNodes(this);
    return this.length > 0;
  }

  simulate(event, ...args) {
    verifyFoundNodes(this);
    for (let i = 0; i < this.length; i++) {
      const vdom = this[i];
      const eventlc = event.toLowerCase();
      const eventKeys = new Set([`on${eventlc}`, `on${eventlc}capture`]);

      for (const key in vdom.props) {
        if (eventKeys.has(key.toLowerCase())) {
          vdom.props[key](...args);
          break;
        }
      }
    }
    rerender();
  }

  find(selector) {
    verifyFoundNodes(this);
    return new FindWrapper(this.context, Array.from(this), selector);
  }

  filter(selector) {
    verifyFoundNodes(this);
    return new FindWrapper(
      this.context,
      Array.from(this).filter(isWhere(selToWhere(selector)))
    );
  }

  map(fn) {
    verifyFoundNodes(this);
    return Array.from(this).map((vnode, index) =>
      fn(new FindWrapper(this.context, [vnode]), index)
    );
  }

  component() {
    verifyOnlySingleNode(this, 'component');
    verifyFoundNodes(this);

    const ref = this.context.componentMap.get(this[0]);

    if (!ref) {
      throw new Error('preact-render-spy: not a component node, no instance to return');
    }

    return ref;
  }

  setState(...args) {
    const val = this.component().setState(...args);
    rerender();
    return val;
  }

  state(key) {
    const state = this.component().state;
    if (key) {
      return state[key];
    }
    return state;
  }

  output() {
    if (this.length > 1 || this.length === 0) {
      throw new Error('preact-render-spy: Must have only 1 result for .output().');
    }

    if (!this[0] || typeof this[0].type !== 'function') {
      throw new Error('preact-render-spy: Must have a result of a preact class or function component for .output()');
    }
    verifyFoundNodes(this);

    const getOutput = node => {
      if (!node || typeof node !== 'object') {
        return node;
      }
      // recursively resolve the node
      let nodeOutput = node;
      while (this.context.vdomMap.has(nodeOutput)) {
        nodeOutput = this.context.vdomMap.get(nodeOutput);
      }
      // in case the node output null or false...
      if (!nodeOutput || typeof nodeOutput !== 'object') {
        return nodeOutput;
      }
      const clone = h(
        nodeOutput.type,
        nodeOutput.props,
        ...toChildArray(nodeOutput.props && nodeOutput.props.children).map(getOutput)
      );

      clone.key = clone.key || null;
      clone.ref = clone.ref || null;

      return clone;
    };

    return getOutput(this[0]);
  }

  toString() {
    verifyFoundNodes(this);
    const render = (jsx, index) => {
      if (typeof jsx.type === 'function') {
        jsx = this.at(index).output();
      }
      if (!jsx) return `{${JSON.stringify(jsx)}}`;
      return renderToString(jsx, {}, config.toStringOptions, true);
    };

    const header = `preact-render-spy (${this.length} nodes)`;
    if (!this.length) {
      return header;
    }
    return `${header}
-------
${Array.from(this).map(render).join('\n')}
`;
  }
}

const setHiddenProp = (object, prop, value) => {
  Object.defineProperty(object, prop, {
    enumerable: false,
    configurable: true,
    writable: true,
    value,
  });
  return value;
};

class ContextRootWrapper extends Component {
  constructor(props) {
    super(props);

    const { vdom, renderRef } = props;
    this.state = {vdom};

    // setup the re-renderer - call the `renderRef` callback with a
    // function that will re-render the content here
    renderRef(vdom => {
      this.setState({ vdom });
      rerender();
    });
  }

  render({}, {vdom}) {
    return vdom;
  }
}

class RenderContext extends FindWrapper {
  constructor({depth}) {
    super(null, []);

    setHiddenProp(this, 'context', this);
    setHiddenProp(this, 'renderedDepth', (depth || Infinity) - 1);

    setHiddenProp(this, 'fragment', config.createFragment());
    setHiddenProp(this, 'vdomRevision', 0);

    // Create our Maps
    ['keyMap', 'depthMap', 'componentMap', 'componentNoopMap', 'vdomMap'].forEach(prop => {
      setHiddenProp(this, prop, new Map());
    });

    // Render an Empty ContextRootWrapper.  This sets up `this.contextRender`.
    render(h(ContextRootWrapper,{
      vdom: null,
      renderRef: contextRender => setHiddenProp(this, 'contextRender', contextRender),
    }), this.fragment);
  }

  render(vdom) {
    // Add what we need to be a FindWrapper:
    this[0] = vdom;
    this.length = 1;
    this.contextRender(spyWalk(this, setVDom(this, 'root', vdom), 0));

    return this;
  }

  rerender() {
    rerender();
  }
}

const deep = (vdom, {depth = Infinity} = {}) => new RenderContext({depth}).render(vdom);
const shallow = vdom => deep(vdom, {depth: 1});

exports = module.exports = deep;

exports.config = config;
exports.deep = deep;
exports.default = deep;
exports.render = deep;
exports.rerender = rerender;
exports.shallow = shallow;
exports.RenderContext = RenderContext;
exports.FindWrapper = FindWrapper;
