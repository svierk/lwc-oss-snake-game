function i(t,r){var e=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);r&&(n=n.filter(function(u){return Object.getOwnPropertyDescriptor(t,u).enumerable})),e.push.apply(e,n)}return e}function O(t){for(var r=1;r<arguments.length;r++){var e=arguments[r]!=null?arguments[r]:{};r%2?i(Object(e),!0).forEach(function(n){b(t,n,e[n])}):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(e)):i(Object(e)).forEach(function(n){Object.defineProperty(t,n,Object.getOwnPropertyDescriptor(e,n))})}return t}function b(t,r,e){return r=g(r),r in t?Object.defineProperty(t,r,{value:e,enumerable:!0,configurable:!0,writable:!0}):t[r]=e,t}function g(t){var r=v(t,"string");return typeof r=="symbol"?r:String(r)}function v(t,r){if(typeof t!="object"||t===null)return t;var e=t[Symbol.toPrimitive];if(e!==void 0){var n=e.call(t,r||"default");if(typeof n!="object")return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return(r==="string"?String:Number)(t)}var f=function(t){return t[t.Start=0]="Start",t[t.End=1]="End",t}(f||{});let a;function P(t){a=t}const o=globalThis.performance,l=typeof o!="undefined"&&typeof o.mark=="function"&&typeof o.clearMarks=="function"&&typeof o.measure=="function"&&typeof o.clearMeasures=="function";function s(t,r){return r?`${t}-${r}`:t}function m(t,r,e){const n=s(t,r);return r&&e?`${n}_${e}`:n}function p(t,r){const e=t||r?O({},r):null;return e&&t&&(e.specifier=t),e}function S({id:t,specifier:r,specifierIndex:e,metadata:n}){if(a){a({id:t,phase:f.Start,specifier:r,metadata:n});return}if(l){const u=m(t,r,e),c=p(r,n);o.mark(u,{detail:c})}}function d({id:t,specifier:r,specifierIndex:e,metadata:n}){if(a)a({id:t,phase:f.End,specifier:r,metadata:n});else if(l){const u=m(t,r,e),c=s(t,r),y=p(r,n);o.measure(c,{start:u,detail:y}),o.clearMarks(u),o.clearMeasures(c)}}export{P as attachDispatcher,d as logOperationEnd,S as logOperationStart};