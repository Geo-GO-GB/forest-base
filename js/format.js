/* 大きな数の表示。999、1.2k、3.4M、5.6G、7.8T。小数は1桁で、.0 は省く。 */
(function (root) {
  "use strict";

  const SUFFIX = ["", "k", "M", "G", "T", "P", "E", "Z", "Y"];

  function count(value) {
    let n = Math.floor(Number(value));
    if (!Number.isFinite(n)) n = 0;
    const sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    let tier = 0;
    let scaled = n;
    while (scaled >= 1000 && tier < SUFFIX.length - 1) {
      scaled /= 1000;
      tier += 1;
    }
    if (tier === 0) return sign + String(n);
    let rounded = Math.round(scaled * 10) / 10;
    if (rounded >= 1000 && tier < SUFFIX.length - 1) {
      rounded /= 1000;
      tier += 1;
    }
    const text = rounded.toFixed(1).replace(/\.0$/, "");
    return sign + text + SUFFIX[tier];
  }

  root.Format = { count: count };
})(globalThis);
