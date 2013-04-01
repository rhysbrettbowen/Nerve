// ==========================================
// Copyright 2013 Dataminr
// Licensed under The MIT License
// http://opensource.org/licenses/MIT
// work derived from https://github.com/rhysbrettbowen/PlastronJS
// ==========================================

/*******************************************************************************
********************************************************************************
**                                                                            **
**  Copyright (c) 2012 Catch.com, Inc.                                        **
**                                                                            **
**  Licensed under the Apache License, Version 2.0 (the "License");           **
**  you may not use this file except in compliance with the License.          **
**  You may obtain a copy of the License at                                   **
**                                                                            **
**      http://www.apache.org/licenses/LICENSE-2.0                            **
**                                                                            **
**  Unless required by applicable law or agreed to in writing, software       **
**  distributed under the License is distributed on an "AS IS" BASIS,         **
**  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  **
**  See the License for the specific language governing permissions and       **
**  limitations under the License.                                            **
**                                                                            **
********************************************************************************
*******************************************************************************/
var Nerve = function() {


var regEsc = function(str) {
  return String(str)
    .replace(/([\-()\[\]{}+?*.$\^|,:#<!\\])/g, '\\$1')
    .replace(/\x08/g, '\\x08');
};

/**
 * @constructor
 * @param {{split: string, wild: string, wildlvl: string}=} opt_options
 * to define options.
 */
var Nerve = function() {
  /** @private */
  this.available_ = {};
  /** @private */
  this.listeners_ = {};
  this.configure();
};


Nerve.prototype.configure = function(options) {
  if (options) {
    this.split_ = options.split || this.split_;
    this.wild_ = options.wild || this.wild_;
    this.wildlvl_ = options.wildlvl || this.wildlvl_;
  }
  this.wildRegex_ = new RegExp(
      regEsc(regEsc(this.wild_)), 'gi');
  this.wildlvlRegex_ = new RegExp(
      regEsc(regEsc(this.wildlvl_)), 'gi');
};

/**
 * the character or string to define hierarchy.
 *
 * @private
 * @type {string}
 */
Nerve.prototype.split_ = '.';


/**
 * the character or string to denote a wild card
 *
 * @private
 * @type {string}
 */
Nerve.prototype.wild_ = '*';

/**
 * the character or string to denote a wild card
 *
 * @private
 * @type {string}
 */
Nerve.prototype.wildlvl_ = '%';

/**
 * lets components know that a message can be fired by an object.
 *
 * @param {Object} obj to register.
 * @param {string|Array.<string>} messages that the object can broadcast.
 * @param {boolean=} opt_noBroadcast don't add broadcast to object.
 */
Nerve.prototype.register = function(obj, messages, opt_noBroadcast) {

  if(!obj.broadcast && !opt_noBroadcast) {
    obj.broadcast = _.bind(this.broadcast, this);
  }

  if(!_.isArray(messages))
    messages = [messages];
  // each message we save the object reference in an array so we know it
  // can provide that message
  _.each(messages, function(message) {
    this.available_[message] = this.available_[message] || [];
    _.insert(this.available_[message], obj);

    // if we registered any listeners for a message that can now start we
    // fire it with the object
    if (this.available_[message].length == 1) {
      _.each(this.listeners_, function(val, key) {
        _.each(val, function(listener) {
          if (!listener.initDone &&
              this.canFire_(key, message)) {
            listener.initDone = true;
            listener.disDone = false;
            if(listener.init)
              listener.init([obj]);
          }
        }, this);
      }, this);
    }
  }, this);
};


/**
 * checks to see if the first param is fired by the message.
 *
 * @param {string} key the listeners key.
 * @param {string} message that was fired.
 * @return {boolean} whether it's a match.
 */
Nerve.prototype.matchMessage_ = function(key, message) {
  // escape for regex
  key = regEsc(key);
  // change wildcards to regex
  key = key.replace(this.wildRegex_, '.*')
      .replace(this.wildlvlRegex_, '[^' + this.split_ + ']*');
  return !!message.match(new RegExp('^' + key + '$', 'i'));
};


/**
 * checks to see if there is an availble listener for the key.
 *
 * @param {string} key to be broadcast.
 * @return {boolean} whether there is a match.
 */
Nerve.prototype.canFireAvailable_ = function(key) {
  return _.some(_.keys(this.available_),
      _.bind(this.canFire_, this, key));
};


/**
 * if a message is registered could a key match it.
 *
 * @param {string} message to check.
 * @param {string} key to register.
 * @return {boolean} if a submessage of message could match key.
 */
Nerve.prototype.canFire_ = function(key, message) {
  var wildInd = key.indexOf(this.wild_);
  var keyArr;
  var messageArr;
  if (wildInd > -1)
    keyArr = key.substring(0, wildInd);
  keyArr = key.split(this.split_);
  messageArr = message.split(this.split_);
  return _.every(messageArr, function(part, ind) {
    if(!keyArr[ind])
      return true;
    var regex = new RegExp(
        '^' + regEsc(keyArr[ind])
          .replace(this.wildlvlRegex_, '.*') + '$', 'i');
    if(part.match(regex))
      return true;
    else if (wildInd > -1 && part.match(regex))
      return true;
    return false;
  }, this);
};


/**
 * removes the object from the register for that message
 *
 * @param {Object} obj to unregister.
 * @param {Array.<string>|string=} opt_messages an array of message to
 * unregister the object from being able to broadcast, or undefined to
 * unregister from all.
 */
Nerve.prototype.unregister = function(obj, opt_messages) {
  var messages = opt_messages || [];
  if(opt_messages && !_.isArray(opt_messages))
    messages = [opt_messages];

  // remove the object from all available
  _.each(this.available_, function(val, message) {

    // if it's not in the messages to remove then skip
    if (opt_messages &&
        !_.find(/** @type {Array} */(messages), function(opt) {
          return opt.toLowerCase() ==
              message.substring(0, opt.length).toLowerCase() &&
              (message.length == opt.length ||
              message.charAt(opt.length) == this.split_);
        }, this)
    )
      return;
    // remove from the array
    _.remove(val, obj);
  }, this);

  // cleanup the available object
  var check = [];
  _.each(this.available_, function(val, message) {
    if (val.length > 0) {
      return;
    }
    check.push(message);
  });
  _.each(check, function(message) {
    delete this.available_[message];
  }, this);

  // check for listeners that should be disposed
  _.each(this.listeners_, function(list, key) {
    if (this.canFireAvailable_(key))
      return;
    _.each(list.slice(), function(listener) {
      if (!listener.disDone) {
        listener.disDone = true;
        if(listener.dispose)
          listener.dispose(listener.initDone);
        listener.initDone = false;
      }
    });
  }, this);
};


/**
 * the message to listen for and the handler. Can either be a function to run
 * or an object of the type: {init:Function, fn:Function, dispose:Function}
 * which will run init when the message becomes available and dispose when
 * a message is no longer supported. Returns a uid that can be used with
 * off to remove the listener
 *
 * @param {string|Array.<string>} message (s) to listen to.
 * @param {Function|Object} fn to run on message or object of functions to run
 * that can include init, fn and dispose.
 * @param {Object=} opt_handler to use as 'this' for the function.
 * @return {?number} the id to pass to off method.
 */
Nerve.prototype.on = function(message, fn, opt_handler) {
  if (_.isArray(message)) {
    _.each(/** @type {Array} */(message), function(mess) {
      this.on(mess, fn, opt_handler);
    }, this);
    return null;
  }
  if (_.isFunction(fn)) {
    fn = {fn: fn};
  }
  if (fn.fn)
    fn.fn = _.bind(fn.fn, opt_handler || this);
  if (fn.init)
    fn.init = _.bind(fn.init, opt_handler || this);
  if (fn.dispose)
    fn.dispose = _.bind(fn.dispose, opt_handler || this);
  this.listeners_[message] = this.listeners_[message] || [];
  if (!this.listeners_[message].length) {
    if (fn.init && this.available_[message]) {
      fn.init(this.available_[message][0]);
    }
  }
  fn.id = opt_handler || this;
  _.insert(this.listeners_[message],
      fn);
  return _.giveUid(fn);
};


/**
 * this will only run the function the first time the message is given
 *
 * @param {string} message to listen to.
 * @param {Function} handler the function to run on a message.
 * @param {Object=} opt_handler to use as 'this' for the function.
 * @return {number} the id to pass to off method.
 */
Nerve.prototype.once = function(message, handler, opt_handler) {
  var uid;
  var fn = _.bind(function() {
    handler.apply(opt_handler || this, [].slice.call(arguments, 0));
    this.off(uid);
  },this);
  uid = this.on(message, fn);
  return /** @type {number} */(uid);
};


/**
 * return the listener by id.
 *
 * @param {number} id id of the listener (from on).
 * @return {?Object} the found listener.
 */
Nerve.prototype.getById = function(id) {
  var ret;
  _.each(this.listeners_, function(listeners) {
    ret = ret || _.find(listeners, function(listener) {
      return _.giveUid(listener) == id;
    });
  });
  return ret;
};


/**
 * if the init function has been run and not disposed.
 *
 * @param {number} id id of the listener (from on).
 * @return {?boolean}
 */
Nerve.prototype.isInit = function(id) {
  var ret = this.getById(id);
  return ret && ret.initDone;
};


/**
 * if the listener has been disposed and not re-inited
 *
 * @param {number} id id of the listener (from on).
 * @return {?boolean}
 */
Nerve.prototype.isDisposed = function(id) {
  var ret = this.getById(id);
  return ret && ret.disDone;
};


/**
 * remove the listener by it's id
 *
 * @param {Object} uid of the listener to turn off.
 */
Nerve.prototype.off = function(uid) {
  var ret = false;
  var rem = [];
  _.each(this.listeners_, function(listener, key) {
    var fn = function(el) {
      var del = _.giveUid(el) == uid || el.id == uid;
      ret = ret || del;
      return !del;
    };
    this.listeners_[key] = _.filter(listener, fn);
    if(!listener.length)
      rem.push(key);
  }, this);
  _.each(rem, function(key) {
    delete this.listeners_[key];
  }, this);
  return ret;
};


/**
 * check to see if anyone is listening for a message
 *
 * @param {string} message the message to test.
 * @return {boolean} whether the message has at least one listener.
 */
Nerve.prototype.isListened = function(message) {
  var isListen = false;
  _.each(this.listeners_, function(val, key) {
    isListen = isListen || (val.length && this.matchMessage_(key, message));
  }, this);
  return isListen;
};


/**
 * broadcast the message to the listeners
 *
 * @param {string} message to broadcast.
 * @param {*=} opt_args arguments to pass to listener functions.
 */
Nerve.prototype.broadcast = function(message, opt_args) {
  _.each(this.listeners_, function(listeners, key) {
    if (!this.matchMessage_(key, message))
      return;
    _.each(listeners.slice(), function(listener) {
      if (_.isFunction(listener)) {
        listener(opt_args, message);
      } else if (listener.fn) {
        listener.fn(opt_args, message);
      }
    });
  }, this);
};


/**
 * reset the Nerve to it's original state
 */
Nerve.prototype.reset = function() {
  this.available_ = {};
  _.each(this.listeners_, function(listener) {
    _.each(listener, function(l) {
      if (l.dispose)
        l.dispose();
    });
  });
  this.listeners_ = {};
};

return Nerve;

}();
