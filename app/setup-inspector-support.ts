import { DOMDomainDebugger } from '@nativescript/core/debugger/webinspector-dom';
import * as inspectorCommands from '@nativescript/core/debugger/InspectorBackendCommands';
import config from './env';
import { RSVP } from '@ember/-internals/runtime';
import Ember from 'ember';
import * as tracking from '@glimmer/tracking';
import * as runtime from '@glimmer/runtime';
import * as validator from '@glimmer/validator';
import * as reference from '@glimmer/reference';
import * as runloop from '@ember/runloop';
import ElementNode from './lib/dom/nodes/ElementNode';

console.log('inspector support');

globalThis.HTMLElement = ElementNode;
globalThis.window = globalThis;

window.define('@glimmer/tracking', () => tracking);
window.define('@glimmer/runtime', () => runtime);
window.define('@glimmer/validator', () => validator);
window.define('@glimmer/reference', () => reference);
window.define('@ember/runloop', () => runloop);

window.define('rsvp', () => RSVP);
window.define('ember', () => ({ default: Ember }));
window.define('doc-app/config/environment', () => ({
  default: config,
}));

console.debug = console.log;

const globalMessaging = {
  listeners: []
}

globalThis.postMessage = (msg, origin, ports) => {
  globalMessaging.listeners.forEach((listener) => listener({
    data: msg,
    origin,
    ports
  }));
}

globalThis.addEventListener = (type, cb) => {
  if (type === 'message') {
    globalMessaging.listeners.push(cb);
  }
  console.log('addEventListener', type);
}

globalThis.removeEventListener = (type, cb) => {
  if (type === 'message') {
    const i = globalMessaging.listeners.indexOf(cb);
    if (i >= 0) {
      globalMessaging.listeners.splice(i, 1);
    }
  }
}

if (document.documentElement && document.documentElement.dataset) {
  // let EmberDebug know that content script has executed
  document.documentElement.dataset.emberExtension = 1;
}

class Port {
  private msgId: number;
  listeners: any[];
  private otherPort: string;
  private channel: MessageChannel;
  constructor(channel: MessageChannel, otherPort: string) {
    this.channel = channel;
    this.otherPort = otherPort;
    console.log('port');
    this.msgId = 20000;
    this.listeners = [];
  }

  trigger(msg) {
    this.listeners.forEach((listener) => listener({ data: msg }));
  }

  get channelPort() {
    return this.channel[this.otherPort];
  }

  start() {

  }
  addEventListener(type, cb) {
    this.listeners.push(cb);
  }
  postMessage(msg) {
    this.channelPort.trigger(msg);
  }
}

class MessageChannel {
  port1 = new Port(this, 'port2');
  port2 = new Port(this, 'port1');
}

globalThis.MessageChannel = MessageChannel;




DOMDomainDebugger.prototype.resolveNode = ((params) => {
  const n = document.nodeMap.get(params.nodeId);
  console.log(n);

  return {
    object: {
      type: 'object',
      className: n.constructor.name,
      value: n,
      objectId: 'dont know'
    }
  };
});


let EmberDomain = class EmberDomain {
  port: MessagePort;
  private msgId: number;
  constructor() {
    this.msgId = 0;
    globalThis.addEventListener('message', (msg) => {
      console.log('global message', msg);
      if (msg.data === 'debugger-client') {
        this.port = msg.ports[0];
        this.port.addEventListener('message', (msg) => {
          console.log('port message', msg);
          __inspectorSendEvent(JSON.stringify({
            id: this.msgId++,
            method: 'Ember.toExtension',
            params: msg,
          }));
        })
      }
    })
  }
  fromExtension(msg) {
    console.log('ember fromExtension', msg);
    try {
      this.port?.postMessage(msg);
    } catch (e) {
      console.error(e);
    }

    if (msg.type === 'inject-code') {
      console.log('inject');
      try {
        eval('console.log("hi")');
        eval(msg.value);
      } catch(e) {
        console.error(e)
      }
    }
  }
}

EmberDomain = __decorate([
  inspectorCommands.DomainDispatcher('Ember'),
  __metadata("design:paramtypes", [])
], EmberDomain);


setInterval(() => {
  return;
  __inspectorSendEvent(JSON.stringify({
    id: Math.random() * 200000,
    method: 'Ember.toExtension',
    params: {
      test: 'x'
    },
  }));
}, 5000);
