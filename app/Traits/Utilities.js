'use struct'

let o = {};

o.areUnsortedArraysEqual = (...arrs) => // Can check unsorted arrays
  arrs.every((arr, i, [first]) => !i || arr.length === first.length) &&
  arrs
    .map(arr =>
      arr.reduce(
        (map, item) => map.set(item, (map.get(item) || 0) + 1),
        new Map(),
      ),
    )
    .every(
      (map, i, [first]) =>
        !i ||
        [...first, ...map].every(([item]) => first.get(item) === map.get(item)),
    );

module.exports = o;