//
// Name    : wow
// Author  : Matthieu Aussaguel, http://mynameismatthieu.com/, @mattaussaguel
// Version : 1.1.2
// Repo    : https://github.com/matthieua/WOW
// Website : http://mynameismatthieu.com/wow

function fact() {
class Util {
  extend(custom, defaults) {
    for (let key in defaults) { let value = defaults[key];     if (custom[key] == null) { custom[key] = value; } }
    return custom;
  }

  isMobile(agent) {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(agent);
  }

  createEvent(event, bubble = false, cancel = false, detail = null) {
    if (document.createEvent != null) { // W3C DOM
      var customEvent = document.createEvent('CustomEvent');
      customEvent.initCustomEvent(event, bubble, cancel, detail);
    } else if (document.createEventObject != null) { // IE DOM < 9
      var customEvent = document.createEventObject();
      customEvent.eventType = event;
    } else {
      customEvent.eventName = event;
    }

    return customEvent;
  }

  emitEvent(elem, event) {
    if (elem.dispatchEvent != null) { // W3C DOM
      elem.dispatchEvent(event);
    } else if (event in (elem != null)) {
      var evt = elem[event];
      evt();
    } else if (`on${event}` in (elem != null)) {
      var evt = elem[`on${event}`];
      evt();
    }
    return undefined;
  }

  addEvent(elem, event, fn) {
    if (elem.addEventListener != null) { // W3C DOM
      return elem.addEventListener(event, fn, false);
    } else if (elem.attachEvent != null) { // IE DOM
      return elem.attachEvent(`on${event}`, fn);
    } else { // fallback
      return elem[event] = fn;
    }
  }

  removeEvent(elem, event, fn) {
    if (elem.removeEventListener != null) { // W3C DOM
      return elem.removeEventListener(event, fn, false);
    } else if (elem.detachEvent != null) { // IE DOM
      return elem.detachEvent(`on${event}`, fn);
    } else { // fallback
      return delete elem[event];
    }
  }

  innerHeight() {
    if ('innerHeight' in window) {
      return window.innerHeight;
    } else { return document.documentElement.clientHeight; }
  }
}

// Minimalistic WeakMap shim, just in case.
let WeakMap = this.WeakMap || this.MozWeakMap || 
  class WeakMap {
    constructor() {
      this.keys   = [];
      this.values = [];
    }

    get(key) {
      for (let i = 0; i < this.keys.length; i++) {
        let item = this.keys[i];
        if (item === key) {
          return this.values[i];
        }
      }
    }

    set(key, value) {
      for (let i = 0; i < this.keys.length; i++) {
        let item = this.keys[i];
        if (item === key) {
          this.values[i] = value;
          return;
        }
      }
      this.keys.push(key);
      return this.values.push(value);
    }
  };

// Dummy MutationObserver, to avoid raising exceptions.
let MutationObserver = this.MutationObserver || this.WebkitMutationObserver || this.MozMutationObserver || 
  class MutationObserver {
    constructor() {
      if (typeof console !== 'undefined' && console !== null) {
        console.warn('MutationObserver is not supported by your browser.');
        console.warn('WOW.js cannot detect dom mutations, please call .sync() after loading new content.');
      }
    }

    static notSupported = true;

    observe() {}
  };

// getComputedStyle shim, from http://stackoverflow.com/a/21797294
let getComputedStyle = this.getComputedStyle || 
  function(el, pseudo) {
    this.getPropertyValue = function(prop) {
      let getComputedStyleRX = /(\-([a-z]){1})/g;
      if (prop === 'float') { prop = 'styleFloat'; }
      if (getComputedStyleRX.test(prop)) { prop.replace(getComputedStyleRX, (_, _char)=> _char.toUpperCase()
      ); }
      let { currentStyle } = el;
      return (currentStyle != null ? currentStyle[prop] : void 0) || null;
    };
    return this;
  };

let WOW = class WOW {
  defaults = {
    boxClass:        'wow',
    animateClass:    'animated',
    offset:          0,
    mobile:          true,
    live:            true,
    callback:        null,
    scrollContainer: null
  };

  constructor(options = {}) {
    this.start = this.start.bind(this);
    this.resetAnimation = this.resetAnimation.bind(this);
    this.scrollHandler = this.scrollHandler.bind(this);
    this.scrollCallback = this.scrollCallback.bind(this);
    this.scrolled = true;
    this.config   = this.util().extend(options, this.defaults);
    if (options.scrollContainer != null) {
      this.config.scrollContainer = document.querySelector(options.scrollContainer);
    }
    // Map of elements to animation names:
    this.animationNameCache = new WeakMap();
    this.wowEvent = this.util().createEvent(this.config.boxClass);
  }

  init() {
    this.element = window.document.documentElement;
    if (__in__(document.readyState, ["interactive", "complete"])) {
      this.start();
    } else {
      this.util().addEvent(document, 'DOMContentLoaded', this.start);
    }
    return this.finished = [];
  }

  start() {
    this.stopped = false;
    this.boxes = [].slice.call(this.element.querySelectorAll(`.${this.config.boxClass}`));
    this.all = this.boxes.slice(0);
    if (this.boxes.length) {
      if (this.disabled()) {
        this.resetStyle();
      } else {
        for (let i = 0; i < this.boxes.length; i++) {
          let box = this.boxes[i];
          this.applyStyle(box, true);
        }
      }
    }
    if (!this.disabled()) {
      this.util().addEvent(this.config.scrollContainer || window, 'scroll', this.scrollHandler);
      this.util().addEvent(window, 'resize', this.scrollHandler);
      this.interval = setInterval(this.scrollCallback, 50);
    }
    if (this.config.live) {
      return new MutationObserver(records => {
        for (let j = 0; j < records.length; j++) {
          let record = records[j];
          for (let k = 0; k < record.addedNodes.length; k++) {
            let node = record.addedNodes[k];
            this.doSync(node);
          }
        }
        return undefined;
      })
      .observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  // unbind the scroll event
  stop() {
    this.stopped = true;
    this.util().removeEvent(this.config.scrollContainer || window, 'scroll', this.scrollHandler);
    this.util().removeEvent(window, 'resize', this.scrollHandler);
    if (this.interval != null) { return clearInterval(this.interval); }
  }

  sync(element) {
    if (MutationObserver.notSupported) { return this.doSync(this.element); }
  }

  doSync(element) {
    if (typeof element === 'undefined' || element === null) { ({ element } = this); }
    if (element.nodeType !== 1) { return; }
    element = element.parentNode || element;
    let iterable = element.querySelectorAll(`.${this.config.boxClass}`);
    for (let i = 0; i < iterable.length; i++) {
      let box = iterable[i];
      if (!__in__(box, this.all)) {
        this.boxes.push(box);
        this.all.push(box);
        if (this.stopped || this.disabled()) {
          this.resetStyle();
        } else {
          this.applyStyle(box, true);
        }
        this.scrolled = true;
      }
    }
    return undefined;
  }

  // show box element
  show(box) {
    this.applyStyle(box);
    box.className = `${box.className} ${this.config.animateClass}`;
    if (this.config.callback != null) { this.config.callback(box); }
    this.util().emitEvent(box, this.wowEvent);

    this.util().addEvent(box, 'animationend', this.resetAnimation);
    this.util().addEvent(box, 'oanimationend', this.resetAnimation);
    this.util().addEvent(box, 'webkitAnimationEnd', this.resetAnimation);
    this.util().addEvent(box, 'MSAnimationEnd', this.resetAnimation);

    return box;
  }

  applyStyle(box, hidden) {
    let duration  = box.getAttribute('data-wow-duration');
    let delay     = box.getAttribute('data-wow-delay');
    let iteration = box.getAttribute('data-wow-iteration');

    return this.animate(() => this.customStyle(box, hidden, duration, delay, iteration));
  }

  animate = (function() {
    if ('requestAnimationFrame' in window) {
      return callback => window.requestAnimationFrame(callback);
    } else {
      return callback => callback();
    }
  })();

  resetStyle() {
    for (let i = 0; i < this.boxes.length; i++) {
      let box = this.boxes[i];
      box.style.visibility = 'visible';
    }
    return undefined;
  }

  resetAnimation(event) {
    if (event.type.toLowerCase().indexOf('animationend') >= 0) {
      let target = event.target || event.srcElement;
      return target.className = target.className.replace(this.config.animateClass, '').trim();
    }
  }

  customStyle(box, hidden, duration, delay, iteration) {
    if (hidden) { this.cacheAnimationName(box); }
    box.style.visibility = hidden ? 'hidden' : 'visible';

    if (duration) { this.vendorSet(box.style, {animationDuration: duration}); }
    if (delay) { this.vendorSet(box.style, {animationDelay: delay}); }
    if (iteration) { this.vendorSet(box.style, {animationIterationCount: iteration}); }
    this.vendorSet(box.style, {animationName: hidden ? 'none' : this.cachedAnimationName(box)});

    return box;
  }

  vendors = ["moz", "webkit"];
  vendorSet(elem, properties) {
    for (let name in properties) {
      let value = properties[name];
      elem[`${name}`] = value;
      for (let i = 0; i < this.vendors.length; i++) { let vendor = this.vendors[i];       elem[`${vendor}${name.charAt(0).toUpperCase()}${name.substr(1)}`] = value; }
    }
    return undefined;
  }
  vendorCSS(elem, property) {
    let style = getComputedStyle(elem);
    let result = style.getPropertyCSSValue(property);
    for (let i = 0; i < this.vendors.length; i++) { let vendor = this.vendors[i];     result = result || style.getPropertyCSSValue(`-${vendor}-${property}`); }
    return result;
  }

  animationName(box) {
    try {
      var animationName = this.vendorCSS(box, 'animation-name').cssText;
    } catch (error) { // Opera, fall back to plain property value
      var animationName = getComputedStyle(box).getPropertyValue('animation-name');
    }
    if (animationName === 'none') {
      return '';  // SVG/Firefox, unable to get animation name?
    } else {
      return animationName;
    }
  }

  cacheAnimationName(box) {
    // https://bugzilla.mozilla.org/show_bug.cgi?id=921834
    // box.dataset is not supported for SVG elements in Firefox
    return this.animationNameCache.set(box, this.animationName(box));
  }
  cachedAnimationName(box) {
    return this.animationNameCache.get(box);
  }

  // fast window.scroll callback
  scrollHandler() {
    return this.scrolled = true;
  }

  scrollCallback() {
    if (this.scrolled) {
      this.scrolled = false;
      let results = [];
      for (let i = 0; i < this.boxes.length; i++) {
        let box = this.boxes[i];
        if (box) {
          if (this.isVisible(box)) {
            this.show(box);
            continue;
        }
          results.push(box);
        }
      }
      this.boxes = results;
      if (!this.boxes.length && !this.config.live) { return this.stop(); }
    }
  }


  // Calculate element offset top
  offsetTop(element) {
    // SVG elements don't have an offsetTop in Firefox.
    // This will use their nearest parent that has an offsetTop.
    // Also, using ('offsetTop' of element) causes an exception in Firefox.
    while (element.offsetTop === undefined) { element = element.parentNode; }
    let top = element.offsetTop;
    while (element = element.offsetParent) { top += element.offsetTop; }
    return top;
  }

  // check if box is visible
  isVisible(box) {
    let offset     = box.getAttribute('data-wow-offset') || this.config.offset;
    let viewTop    = (this.config.scrollContainer && this.config.scrollContainer.scrollTop) || window.pageYOffset;
    let viewBottom = viewTop + Math.min(this.element.clientHeight, this.util().innerHeight()) - offset;
    let top        = this.offsetTop(box);
    let bottom     = top + box.clientHeight;

    return top <= viewBottom && bottom >= viewTop;
  }

  util() {
    return this._util != null ? this._util : (this._util = new Util());
  }

  disabled() {
    return !this.config.mobile && this.util().isMobile(navigator.userAgent);
  }
};

function __in__(needle, haystack) {
  return haystack.indexOf(needle) >= 0;
}

return WOW;
}

const WOW = fact.call(window);
export { WOW };
export default WOW;
