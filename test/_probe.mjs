import bwipjs from "bwip-js/node"
for (const s of bwipjs.symbolList) console.log(s.bcid.padEnd(24), s.desc)
