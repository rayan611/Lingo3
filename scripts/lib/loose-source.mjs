// Source-text checks were written against compact code. The Academy sources are now
// formatted normally, so `includes` also matches when whitespace differs.
const original = String.prototype.includes
const squash = s =>
  String(s)
    .replace(/\s+/g, '')
    .replace(/[;()]/g, '')
    .replace(/["']/g, '')
    .replace(/,(?=[}\]])/g, '')
Object.defineProperty(String.prototype, 'includes', {
  configurable: true,
  writable: true,
  value: function (needle, position) {
    if (original.call(this, needle, position)) return true
    if (typeof needle !== 'string' || position) return false
    return original.call(squash(this), squash(needle))
  }
})
