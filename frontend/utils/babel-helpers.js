// Babel 辅助函数
function arrayWithHoles(arr) {
  if (Array.isArray(arr)) return arr;
}

function iterableToArrayLimit(arr, i) {
  var _arr = [];
  if (typeof arr !== "object" || !arr) return _arr;
  var _n = true;
  var _d = false;
  var _e = undefined;
  var _i = 0;

  try {
    for (; _i < arr.length; _i++) {
      _arr.push(arr[_i]);
      if (i && _arr.length === i) break;
    }
  } catch (err) {
    _d = true;
    _e = err;
  }

  return _arr;
}

function unsupportedIterableToArray(o, minLen) {
  if (!o) return [];
  if (typeof o === "string") return arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
  return [];
}

function arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;
  var arr2 = new Array(len);
  for (var i = 0; i < len; i++) arr2[i] = arr[i];
  return arr2;
}

function nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}

function slicedToArray(arr, i) {
  return arrayWithHoles(arr) || iterableToArrayLimit(arr, i) || unsupportedIterableToArray(arr, i) || nonIterableRest();
}

module.exports = {
  slicedToArray: slicedToArray
};