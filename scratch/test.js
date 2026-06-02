// Test script to verify measureOffsets calculation with variable measure lengths
const bmsData = {
  notes: [],
  measureLengths: {
    7: 0.875
  }
};

const noteMax = bmsData && bmsData.notes.length > 0 ? Math.max(...bmsData.notes.map(n => n.measure)) : 0;
const lengthMax = bmsData && Object.keys(bmsData.measureLengths).length > 0 ? Math.max(...Object.keys(bmsData.measureLengths).map(Number)) : 0;
const maxM = Math.max(100, noteMax, lengthMax) + 1;

const offsets = [];
let currentOffset = 0;

for (let m = 0; m <= maxM; m++) {
  offsets.push(currentOffset);
  const len = bmsData?.measureLengths?.[m] ?? 1;
  currentOffset += len;
}

console.log("maxM:", maxM);
console.log("offsets length:", offsets.length);
console.log("offsets[7]:", offsets[7]);
console.log("offsets[8]:", offsets[8]);
console.log("offsets[9]:", offsets[9]);
console.log("offsets[100]:", offsets[100]);
