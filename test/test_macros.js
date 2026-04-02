import { WgslPreprocessor } from '../dist/index.js'

const s = `
#define twice(x) (2*(x))
#define squaredLength(x, y, z) (x*x + y*y + z*z)

let a: f32 = twice(5);
let b: f32 = twice(5) + twice(7);
let c: f32 = squaredLength(1, 2, 3);
let d: f32 = squaredLength(1, 2, 3) + squaredLength(4, 5, 6);
`

console.info(WgslPreprocessor.preprocessWgsl(s, new Map([['TEST1']])));;
